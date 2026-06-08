const assert = require('assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { createQrImage } = require('../lib/qr');
const {
  extractTranslationRecords,
  getTranslatedField,
  loadTranslationCache,
  refreshTranslationCache
} = require('../lib/translationCache');
const { buildEventPayload, buildStorePayload } = require('../server');

async function readFixtureData() {
  const raw = await fs.readFile(path.join(__dirname, '..', 'data', 'partner-data.json'), 'utf8');
  return JSON.parse(raw);
}

async function testQrGeneration() {
  const dataUrl = await createQrImage('linktown://check-in?event_id=event-001&code=EVT-001-LKTWN');
  assert.match(dataUrl, /^data:image\/png;base64,/);
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
  assert.match(eventPayload.events[0].qr_image, /^data:image\/png;base64,/);
  assert.equal(eventPayload.events[0].event_name, 'Disaster Supply Check and Local Guidance');

  assert.equal(storePayload.role, 'store');
  assert.equal(storePayload.services.length, 3);
  assert.match(storePayload.services[0].qr_image, /^data:image\/png;base64,/);
  assert.equal(storePayload.account.name, '地域マルシェ');
  assert.equal(storePayload.services[0].service_name, 'Seasonal Vegetable Set');
}

async function main() {
  await testQrGeneration();
  const cachePath = await prepareTempTranslationCache();
  await testPortalPayloads(cachePath);
  console.log('partner-portals smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
