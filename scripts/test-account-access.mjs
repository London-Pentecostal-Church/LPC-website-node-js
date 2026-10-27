import test from 'node:test';
import assert from 'node:assert/strict';
import { handleVolunteers, emptyVolunteers } from '../worker/volunteers.mjs';
import { accountMailConfigured, sendAccountMail } from '../worker/account-mail.mjs';
const admin = { id: 'admin', name: 'Website admin', admin: true };
function fixture(emailReady = true) {
  let state = emptyVolunteers(); const keys = new Map(), messages = [];
  const store = { emailReady, getState: async () => structuredClone(state), saveState: async (next, expected) => { assert.equal(expected, state.revision); state = structuredClone(next); }, getKey: async key => keys.get(key), putKey: async (key,value) => keys.set(key,value), sendAccountMail: async message => messages.push(message) };
  const call = async (path, input = {}, options = {}) => {
    const response = await handleVolunteers(new Request('https://lpc.test/api/volunteers' + path, { method: options.method || 'POST', headers: { origin: options.origin || 'https://lpc.test', cookie: options.cookie || '', 'cf-connecting-ip': options.ip || '192.0.2.33' }, ...(options.method === 'GET' ? {} : { body: JSON.stringify(path === '/action' ? { revision: state.revision, ...input } : input) }) }), store, options.actor || (path === "/register" && !options.public ? admin : null));
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  return { call, messages, get: () => state, store, mutate: f => f(state) };
}
const password = 'A church password 2026';
const approval = { action: 'approve-account', skills: ['Sound operator'], teams: ['English'], branches: ['Main Church'], manage: [] };
async function verified(f, email = 'new@example.test') {
  assert.equal((await f.call('/register', { name: 'New Volunteer', email, manage: ['ministry'], active: true })).status, 200);
  const mail = f.messages.at(-1);
  assert.equal((await f.call('/verify-email', { token: mail.token, password })).status, 200);
  return f.get().registrations.find(r => r.email === email);
}
test('Admin invitations require mailbox proof and explicit website-admin approval; no password or token leaks', async () => {
  const f = fixture();
  const record = await verified(f);
  assert.equal(f.get().members.length, 0, 'Verification alone gives no access');
  assert(!JSON.stringify(f.get()).includes(f.messages[0].token));
  assert(!JSON.stringify(f.get()).includes(password));
  assert.equal((await f.call('/verify-email', { token: f.messages[0].token, password })).status, 400);
  assert.equal((await f.call('/login', { username: record.email, password })).status, 401);
  const view = await f.call('/', {}, { actor: admin, method: 'GET' });
  assert.equal(view.body.pendingAccounts.length, 1);
  assert(!('registrations' in view.body));
  assert(!JSON.stringify(view.body).includes(record.passwordHash));
  assert(!JSON.stringify(view.body).includes('tokenHash'));
  assert.equal((await f.call('/action', { ...approval, registrationId: record.id }, { actor: { id: 'scheduler', manage: ['ministry'] } })).status, 403);
  assert.equal((await f.call('/action', { ...approval, registrationId: record.id }, { actor: admin })).status, 200);
  const m = f.get().members[0];
  assert.equal(m.username, record.email); assert(m.emailVerifiedAt); assert.deepEqual(m.manage, []); assert.deepEqual(m.skills, ['Sound operator']);
  assert.equal(f.get().registrations.length, 0); assert.equal(f.messages.at(-1).type, 'approved');
  const login = await f.call('/login', { username: m.username, password }); assert.equal(login.status, 200);
  const ownView = await f.call('/', {}, { cookie: login.cookie, method: 'GET' });
  assert.deepEqual(ownView.body.pendingAccounts, []); assert(!('registrations' in ownView.body));
});
test('An approved registration can link a legacy volunteer without losing identity or allocations', async () => {
  const f = fixture();
  await f.call('/action', { action: 'member', member: { name: 'Existing Volunteer', username: 'new@example.test', password, skills: ['Sound operator'], teams: ['English'], branches: ['Main Church'], manage: ['service'], active: true } }, { actor: admin });
  const old = structuredClone(f.get().members[0]);
  const record = await verified(f);
  assert.equal((await f.call('/action', { ...approval, registrationId: record.id }, { actor: admin })).status, 400, 'Cannot create a duplicate username');
  assert.equal((await f.call('/action', { ...approval, registrationId: record.id, memberId: old.id, manage: ['ministry'] }, { actor: admin })).status, 200);
  assert.equal(f.get().members.length, 1); assert.equal(f.get().members[0].id, old.id); assert.deepEqual(f.get().members[0].manage, old.manage);
  assert.equal(f.get().members[0].name, old.name);
});
test('Expired confirmation links and declined requests cannot be approved; absent email service fails honestly', async () => {
  const f = fixture();
  await f.call('/register', { name: 'Someone', email: 'expired@example.test' });
  f.mutate(s => s.registrations[0].expires = Date.now() - 1);
  assert.equal((await f.call('/verify-email', { token: f.messages[0].token, password })).status, 400);
  const record = await verified(f);
  assert.equal((await f.call('/action', { action: 'reject-account', registrationId: record.id }, { actor: admin })).status, 200);
  assert.equal((await f.call('/action', { ...approval, registrationId: record.id }, { actor: admin })).status, 409);
  const off = fixture(false);
  assert.equal((await off.call('/register', { name: 'Someone', email: 'user@example.test' })).status, 503);
  assert.equal((await off.call('/forgot-password', { email: 'user@example.test' })).status, 503);
  assert.equal(off.messages.length, 0); assert.equal(off.get().members.length, 0);
});
test('Email password reset is expiring, single-use, permission-preserving and invalidates all old sessions', async () => {
  const f = fixture(); const r = await verified(f);
  await f.call('/action', { ...approval, registrationId: r.id }, { actor: admin });
  const m = f.get().members[0];
  const login = await f.call('/login', { username: m.username, password });
  const known = await f.call('/forgot-password', { email: m.email }); const unknown = await f.call('/forgot-password', { email: 'missing@example.test' });
  assert.deepEqual(known, unknown);
  const mail = f.messages.at(-1); assert.equal(mail.type, 'reset');
  assert(!JSON.stringify(f.get()).includes(mail.token));
  const view = await f.call('/', {}, { actor: admin, method: 'GET' });
  assert(!JSON.stringify(view.body).includes(f.get().members[0].emailResetHash));
  assert(!JSON.stringify(view.body).includes('emailResetHash'));
  const reset = { token: mail.token, password: 'My replacement church password' };
  assert.equal((await f.call('/email-reset', reset, { origin: 'https://evil.test' })).status, 403);
  assert.equal((await f.call('/email-reset', { ...reset, token: 'incorrect' })).status, 400);
  assert.equal((await f.call('/email-reset', reset)).status, 200);
  assert.equal((await f.call('/email-reset', reset)).status, 400);
  assert.equal((await f.call('/session', {}, { cookie: login.cookie, method: 'GET' })).body.actor, null);
  assert.equal((await f.call('/login', { username: m.username, password })).status, 401);
  assert.equal((await f.call('/login', { username: m.username, password: reset.password })).status, 200);
  assert.deepEqual(f.get().members[0].skills, m.skills); assert.deepEqual(f.get().members[0].manage, m.manage);
  await f.call('/forgot-password', { email: m.email }); const expired = f.messages.at(-1);
  f.mutate(s => s.members[0].emailResetExpires = Date.now() - 1);
  assert.equal((await f.call('/email-reset', { ...reset, token: expired.token })).status, 400);
  await f.call('/forgot-password', { email: m.email }); const inactive = f.messages.at(-1);
  f.mutate(s => s.members[0].active = false);
  assert.equal((await f.call('/email-reset', { ...reset, token: inactive.token })).status, 400);
});
test('Mail links use only the configured HTTPS origin and fragment tokens; secrets stay out of the body', async () => {
  const env = { RESEND_API_KEY: 'synthetic-test-key', ACCOUNT_MAIL_FROM: 'accounts@example.test', ACCOUNT_PUBLIC_URL: 'https://church.example.test/' };
  assert(accountMailConfigured(env)); assert(!accountMailConfigured({ ...env, ACCOUNT_PUBLIC_URL: 'http://evil.test' }));
  assert(!accountMailConfigured({ ...env, ACCOUNT_PUBLIC_URL: 'https://church.example.test/path' }));
  let sent;
  await sendAccountMail(env, { id: 'test-message', type: 'reset', to: 'volunteer@example.test', token: 'synthetic-reset-token' }, async (url, options) => { sent = { url, ...options }; return new Response('{}'); });
  const body = JSON.parse(sent.body);
  assert.equal(sent.url, 'https://api.resend.com/emails'); assert.equal(sent.headers['idempotency-key'], 'test-message');
  assert(body.text.includes('https://church.example.test/#/volunteers?reset=synthetic-reset-token'));
  assert(!sent.body.includes(env.RESEND_API_KEY)); assert(!sent.body.includes(password));
  await assert.rejects(sendAccountMail(env, { id: 'failed', type: 'verify', to: 'volunteer@example.test', token: 'test' }, async () => new Response('{}', { status: 403 })));
});
test('Email delivery errors never grant access or undo approval, and reset failures do not expose account existence', async () => {
  const f = fixture();
  f.store.sendAccountMail = async () => { throw Error('synthetic delivery failure'); };
  assert.equal((await f.call('/register', { name: 'Example', email: 'blocked@example.test' })).status, 503);
  assert.equal(f.get().members.length, 0);
  f.store.sendAccountMail = async message => f.messages.push(message);
  const r = await verified(f);
  f.store.sendAccountMail = async () => { throw Error('synthetic delivery failure'); };
  const result = await f.call('/action', { ...approval, registrationId: r.id }, { actor: admin });
  assert.equal(result.status, 200); assert(result.body.accountEmailWarning);
  assert.equal(f.get().members.length, 1);
  const known = await f.call('/forgot-password', { email: r.email });
  const unknown = await f.call('/forgot-password', { email: 'not-known@example.test' });
  assert.deepEqual(known, unknown);
});


test('Public and scheduler account requests are rejected without email or account creation', async () => {
  const f = fixture();
  const before = structuredClone(f.get());
  assert.equal((await f.call('/register', {name:'Public Visitor',email:'public@example.test'}, {public:true})).status,403);
  assert.equal((await f.call('/register', {name:'Other Person',email:'other@example.test'}, {actor:{id:'scheduler',manage:['service']}})).status,403);
  assert.equal(f.messages.length,0); assert.deepEqual(f.get(),before);
  const options = await f.call('/account-options',{}, {method:'GET'});
  assert.equal(options.body.registrationEnabled,false);
});

test('Signing out invalidates the session before another account signs in', async () => {
  const f = fixture(); const record = await verified(f);
  await f.call('/action', {...approval, registrationId:record.id}, {actor:admin});
  const signedIn = await f.call('/login',{username:record.email,password});
  assert((await f.call('/session',{}, {method:'GET',cookie:signedIn.cookie})).body.actor);
  assert.equal((await f.call('/logout',{}, {cookie:signedIn.cookie})).status,200);
  assert.equal((await f.call('/session',{}, {method:'GET',cookie:signedIn.cookie})).body.actor,null);
  assert.equal((await f.call('/',{}, {method:'GET',cookie:signedIn.cookie})).status,401);
  assert.equal((await f.call('/login',{username:record.email,password})).status,200);
});
