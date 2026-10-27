import test from 'node:test';
import assert from 'node:assert/strict';
import { createVolunteerStore } from '../worker/volunteer-store.mjs';

function bucketFixture() {
  const objects = new Map();
  let revision = 0;
  return {
    objects,
    async get(key) {
      const object = objects.get(key);
      return object ? { etag: object.etag, json: async () => JSON.parse(object.value) } : null;
    },
    async put(key, value, options = {}) {
      const previous = objects.get(key);
      if (options.onlyIf?.etagMatches && previous?.etag !== options.onlyIf.etagMatches) return null;
      if (options.onlyIf?.etagDoesNotMatch === '*' && previous) return null;
      const result = { etag: String(++revision), value };
      objects.set(key, result);
      return result;
    },
  };
}

test('Store keeps existing state and private sessions in their original namespaces', async () => {
  const bucket = bucketFixture();
  await bucket.put('volunteers/state.json', JSON.stringify({ revision: 7, members: [{id:'existing'}] }));
  const store = createVolunteerStore({ BUCKET: bucket });
  const state = await store.getState();
  assert.equal(state.revision,7);
  await store.saveState({...state,revision:8});
  assert.equal((await bucket.get('volunteers/state.json')).json instanceof Function,true);
  assert.equal((await (await bucket.get('volunteers/state.json')).json()).members[0].id,'existing');
  await store.putKey('session-example',{memberId:'existing',expires:123});
  assert.deepEqual(await store.getKey('session-example'),{memberId:'existing',expires:123});
  assert(bucket.objects.has('volunteers/private/session-example'));
  assert.equal(store.emailReady,false);
});

test('Concurrent editors cannot overwrite each other, including the first state creation', async () => {
  for (const initiallyPresent of [false,true]) {
    const bucket=bucketFixture();
    if(initiallyPresent) await bucket.put('volunteers/state.json',JSON.stringify({revision:4}));
    const first=createVolunteerStore({BUCKET:bucket});
    const second=createVolunteerStore({BUCKET:bucket});
    await first.getState(); await second.getState();
    await first.saveState({revision:5,marker:'first editor'});
    await assert.rejects(second.saveState({revision:5,marker:'stale editor'}),error=>error.status===409);
    assert.equal((await (await bucket.get('volunteers/state.json')).json()).marker,'first editor');
  }
});

test('Demo fallback is cloned and never replaces persisted data', async () => {
  const bucket=bucketFixture();
  const first=await createVolunteerStore({BUCKET:bucket}).getState();
  first.members.length=0;
  const second=await createVolunteerStore({BUCKET:bucket}).getState();
  assert(second.members.length>0);
  assert.equal(bucket.objects.size,0);
});
