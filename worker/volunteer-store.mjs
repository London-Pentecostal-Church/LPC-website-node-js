import { accountMailConfigured, sendAccountMail } from './account-mail.mjs';
import demoState from './demo-state.mjs';

const STATE_KEY = 'volunteers/state.json';
const PRIVATE_PREFIX = 'volunteers/private/';
const JSON_METADATA = { contentType: 'application/json' };

// One adapter per request: the read ETag prevents overwriting another editor's work.
export function createVolunteerStore(env) {
  const bucket = env.BUCKET;
  let etag = null;

  return {
    emailReady: accountMailConfigured(env),
    sendAccountMail: message => sendAccountMail(env, message),
    async getState() {
      const object = await bucket.get(STATE_KEY);
      etag = object?.etag || null;
      return object ? object.json() : structuredClone(demoState);
    },
    async saveState(value) {
      const saved = await bucket.put(STATE_KEY, JSON.stringify(value), {
        onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: '*' },
        httpMetadata: JSON_METADATA,
      });
      if (!saved) {
        throw Object.assign(new Error('Schedule changed. Reload before saving.'), { status: 409 });
      }
    },
    async getKey(key) {
      const object = await bucket.get(PRIVATE_PREFIX + key);
      return object ? object.json() : null;
    },
    async putKey(key, value) {
      await bucket.put(PRIVATE_PREFIX + key, JSON.stringify(value), { httpMetadata: JSON_METADATA });
    },
  };
}
