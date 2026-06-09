const assert = require('assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {
  extractTranslationRecords,
  getTranslatedField,
  loadTranslationCache,
  refreshTranslationCache
} = require('../lib/translationCache');
const { buildEventPayload, buildStorePayload, parseUserQrPayload, processEventCheckIn, processStoreExchange } = require('../server');

async function readFixtureData() {
  const raw = await fs.readFile(path.join(__dirname, '..', 'data', 'partner-data.json'), 'utf8');
  return JSON.parse(raw);
}

async function prepareTempTranslationCache() {
  const data = await readFixtureData();
  const records = extractTranslationRecords(data);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'linktown-translation-cache-'));
  const cachePath = path.join(tempDir, 'translation-cache.json');

  assert.ok(records.length > 0);

  const result = await refreshTranslationCache(data, {
    cachePath,
    targetLocales: ['en']
  });
  const cache = await loadTranslationCache(cachePath);

  assert.equal(result.failed, 0);
  assert.ok(result.translated > 0);
  assert.ok(cache.entries.length > 0);
  assert.equal(
    getTranslatedField(cache, 'event', 'event-001', 'event_name', '防災備蓄点検と地域案内', 'en'),
    'Disaster Supply Check and Local Guidance'
  );

  return cachePath;
}

async function testPortalPayloads(cachePath) {
  const dataPath = path.join(__dirname, '..', 'data', 'partner-data.json');
  const eventPayload = await buildEventPayload('event-demo', 'en', { cachePath, dataPath });
  const storePayload = await buildStorePayload('store-demo', 'en', { cachePath, dataPath });

  assert.equal(eventPayload.role, 'event');
  assert.equal(eventPayload.events.length, 2);
  assert.equal(eventPayload.events[0].event_name, 'Disaster Supply Check and Local Guidance');

  assert.equal(storePayload.role, 'store');
  assert.equal(storePayload.services.length, 3);
  assert.equal(storePayload.account.name, '地域マルシェ');
  assert.equal(storePayload.services[0].service_name, 'Seasonal Vegetable Set');
}

function createUserQrPayload(nonce) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);
  const params = new URLSearchParams({
    v: '1',
    type: 'user-present',
    user_id: '1',
    name: 'Demo User',
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    nonce
  });

  return `linktown://user-present?${params.toString()}`;
}

async function testUserQrProcessing() {
  const userQrPayload = createUserQrPayload('smoke-event');
  const parsed = parseUserQrPayload(userQrPayload);
  assert.equal(parsed.user_id, '1');
  assert.equal(parsed.name, 'Demo User');

  const eventResult = await processEventCheckIn(
    {
      code: 'event-demo',
      event_id: 'event-001',
      user_qr_payload: userQrPayload
    },
    'en'
  );
  assert.equal(eventResult.status, 201);
  assert.equal(eventResult.body.granted_points, 100);
  assert.equal(eventResult.body.user.user_id, '1');

  const duplicateResult = await processEventCheckIn(
    {
      code: 'event-demo',
      event_id: 'event-001',
      user_qr_payload: userQrPayload
    },
    'en'
  );
  assert.equal(duplicateResult.status, 409);

  const exchangeResult = await processStoreExchange(
    {
      code: 'store-demo',
      service_id: 'service-001',
      user_qr_payload: createUserQrPayload('smoke-store')
    },
    'en'
  );
  assert.equal(exchangeResult.status, 201);
  assert.equal(exchangeResult.body.used_points, 220);
  assert.equal(exchangeResult.body.user.name, 'Demo User');
}

async function main() {
  const cachePath = await prepareTempTranslationCache();
  await testPortalPayloads(cachePath);
  await testUserQrProcessing();
  console.log('partner-portals smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
