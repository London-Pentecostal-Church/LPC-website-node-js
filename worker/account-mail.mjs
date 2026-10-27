// Transactional account mail uses an HTTP API, supported by Node and Workers.
export function accountMailConfigured(env = {}) {
  try {
    const origin = new URL(env.ACCOUNT_PUBLIC_URL);
    return !!env.RESEND_API_KEY && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env.ACCOUNT_MAIL_FROM || '') && origin.protocol === 'https:' && !origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash;
  } catch { return false; }
}
export async function sendAccountMail(env, message, fetcher = fetch) {
  if (!accountMailConfigured(env)) throw Error('Account email is not configured.');
  const url = new URL(env.ACCOUNT_PUBLIC_URL);
  url.hash = '/volunteers' + (message.token ? '?' + new URLSearchParams({ [message.type]: message.token }) : '');
  const content = message.type === 'verify'
    ? { subject: 'You are invited to the LPC team', text: `Your website administrator has invited you to the LPC team. Open this link to confirm your email and choose your password:\n\n${url.href}\n\nThis link expires in 24 hours. A church administrator will then approve access. If you were not expecting this invitation, ignore this email.` }
    : message.type === 'reset'
    ? { subject: 'Reset your LPC password', text: `Open this link to choose a new password:\n\n${url.href}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, ignore this email. Your password has not changed.` }
    : { subject: 'Your LPC account is ready', text: `Your church administrator has approved your account. Sign in with your email and password:\n\n${url.href}` };
  const response = await fetcher('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json', 'idempotency-key': message.id }, body: JSON.stringify({ from: 'LPC Church <' + env.ACCOUNT_MAIL_FROM + '>', to: [message.to], ...content }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error('Account email could not be sent.');
}
