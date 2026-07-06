const assert = require('assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

process.env.APP_ENV = 'test';
process.env.NODE_ENV = 'test';
process.env.TRANSLATION_API_URL = '';
process.env.TRANSLATION_API_TOKEN = '';
process.env.TRANSLATION_PROVIDER = 'mock-cache';

const {
  extractTranslationRecords,
  getTranslatedField,
  loadTranslationCache,
  refreshTranslationCache
} = require('../lib/translationCache');
const { buildEventPayload, buildStorePayload, parseUserQrPayload, processEventCheckIn, processStoreExchange } = require('../server');
const { openDatabase, readPartnerData } = require('../lib/partnerRepository');

async function prepareTempTranslationCache(dbPath) {
  const data = await readPartnerData({ dbPath, seedDemoData: true });
  const records = extractTranslationRecords(data);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'linktown-translation-cache-'));
  const cachePath = path.join(tempDir, 'translation-cache.json');
  const translatedEvent = data.events.find((eventItem) => eventItem.event_name === '防災備蓄点検と地域案内');

  assert.ok(records.length > 0);
  assert.ok(translatedEvent);

  const result = await refreshTranslationCache(data, {
    cachePath,
    targetLocales: ['en']
  });
  const cache = await loadTranslationCache(cachePath);

  assert.equal(result.failed, 0);
  assert.ok(result.translated > 0);
  assert.ok(cache.entries.length > 0);
  assert.equal(
    getTranslatedField(cache, 'event', translatedEvent.event_id, 'event_name', translatedEvent.event_name, 'en'),
    'Disaster Supply Check and Local Guidance'
  );

  return cachePath;
}

async function prepareTempPartnerDb() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'linktown-partner-db-'));
  const dbPath = path.join(tempDir, 'partner-portal.sqlite');
  const db = openDatabase({ dbPath, seedDemoData: true });

  try {
    const eventCount = db.prepare('SELECT COUNT(*) AS count FROM events').get().count;
    const storeCount = db.prepare('SELECT COUNT(*) AS count FROM stores').get().count;
    const organizerCount = db.prepare('SELECT COUNT(*) AS count FROM event_organizers').get().count;
    assert.equal(eventCount, 2);
    assert.equal(storeCount, 1);
    assert.equal(organizerCount, 1);
  } finally {
    db.close();
  }

  return dbPath;
}

async function testPortalPayloads(cachePath, dbPath) {
  const eventPayload = await buildEventPayload('event-demo', 'event-demo-pass', 'en', { cachePath, dbPath });
  const storePayload = await buildStorePayload('store-demo', 'store-demo-pass', 'en', { cachePath, dbPath });
  const translatedEvent = eventPayload.events.find((eventItem) => eventItem.grant_points === 100);
  const translatedService = storePayload.services.find((serviceItem) => serviceItem.required_points === 220);

  assert.equal(eventPayload.role, 'event');
  assert.equal(eventPayload.events.length, 2);
  assert.ok(translatedEvent);
  assert.equal(translatedEvent.event_name, 'Disaster Supply Check and Local Guidance');
  assert.equal(await buildEventPayload('event-demo', 'wrong-password', 'en', { cachePath, dbPath }), null);

  assert.equal(storePayload.role, 'store');
  assert.equal(storePayload.services.length, 3);
  assert.equal(storePayload.account.name, '地域マルシェ');
  assert.ok(translatedService);
  assert.equal(translatedService.service_name, 'Seasonal Vegetable Set');
  assert.equal(await buildStorePayload('store-demo', 'wrong-password', 'en', { cachePath, dbPath }), null);

  return {
    eventId: translatedEvent.event_id,
    serviceId: translatedService.service_id
  };
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

async function testUserQrProcessing(cachePath, dbPath, ids) {
  const userQrPayload = createUserQrPayload(`smoke-event-${Date.now()}`);
  const parsed = parseUserQrPayload(userQrPayload);
  assert.equal(parsed.user_id, '1');
  assert.equal(parsed.name, 'Demo User');

  const eventResult = await processEventCheckIn(
    {
      code: 'event-demo',
      password: 'event-demo-pass',
      event_id: ids.eventId,
      user_qr_payload: userQrPayload
    },
    'en',
    { cachePath, dbPath }
  );
  assert.equal(eventResult.status, 201);
  assert.equal(eventResult.body.granted_points, 100);
  assert.equal(eventResult.body.user.user_id, '1');

  const duplicateResult = await processEventCheckIn(
    {
      code: 'event-demo',
      password: 'event-demo-pass',
      event_id: ids.eventId,
      user_qr_payload: userQrPayload
    },
    'en',
    { cachePath, dbPath }
  );
  assert.equal(duplicateResult.status, 409);

  const exchangeResult = await processStoreExchange(
    {
      code: 'store-demo',
      password: 'store-demo-pass',
      service_id: ids.serviceId,
      user_qr_payload: createUserQrPayload(`smoke-store-${Date.now()}`)
    },
    'en',
    { cachePath, dbPath }
  );
  assert.equal(exchangeResult.status, 201);
  assert.equal(exchangeResult.body.used_points, 220);
  assert.equal(exchangeResult.body.user.name, 'Demo User');

  const db = openDatabase({ dbPath });
  try {
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM portal_event_check_ins').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM portal_store_exchanges').get().count, 1);
    assert.equal(db.prepare('SELECT points FROM users WHERE user_id = ?').get('1').points, 180);
  } finally {
    db.close();
  }
}

async function main() {
  const dbPath = await prepareTempPartnerDb();
  const cachePath = await prepareTempTranslationCache(dbPath);
  const ids = await testPortalPayloads(cachePath, dbPath);
  await testUserQrProcessing(cachePath, dbPath, ids);
  console.log('partner-portals smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
