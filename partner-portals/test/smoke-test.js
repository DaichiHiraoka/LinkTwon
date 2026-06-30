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
const { openDatabase } = require('../lib/partnerRepository');

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

async function prepareTempPartnerDb() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'linktown-partner-db-'));
  const dbPath = path.join(tempDir, 'partner-portal.sqlite');
  const db = openDatabase({ dbPath });

  try {
    const eventCount = db.prepare('SELECT COUNT(*) AS count FROM events').get().count;
    const storeCount = db.prepare('SELECT COUNT(*) AS count FROM stores').get().count;
    assert.equal(eventCount, 2);
    assert.equal(storeCount, 1);
  } finally {
    db.close();
  }

  return dbPath;
}

async function testPortalPayloads(cachePath, dbPath) {
  const eventPayload = await buildEventPayload('event-demo', 'en', { cachePath, dbPath });
  const storePayload = await buildStorePayload('store-demo', 'en', { cachePath, dbPath });

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

async function testUserQrProcessing(cachePath, dbPath) {
  const userQrPayload = createUserQrPayload(`smoke-event-${Date.now()}`);
  const parsed = parseUserQrPayload(userQrPayload);
  assert.equal(parsed.user_id, '1');
  assert.equal(parsed.name, 'Demo User');

  const eventResult = await processEventCheckIn(
    {
      code: 'event-demo',
      event_id: 'event-001',
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
      event_id: 'event-001',
      user_qr_payload: userQrPayload
    },
    'en',
    { cachePath, dbPath }
  );
  assert.equal(duplicateResult.status, 409);

  const exchangeResult = await processStoreExchange(
    {
      code: 'store-demo',
      service_id: 'service-001',
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
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM event_check_ins').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM store_exchanges').get().count, 1);
    assert.equal(db.prepare('SELECT display_name FROM portal_users WHERE user_id = ?').get('1').display_name, 'Demo User');
  } finally {
    db.close();
  }
}

async function main() {
  const cachePath = await prepareTempTranslationCache();
  const dbPath = await prepareTempPartnerDb();
  await testPortalPayloads(cachePath, dbPath);
  await testUserQrProcessing(cachePath, dbPath);
  console.log('partner-portals smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
