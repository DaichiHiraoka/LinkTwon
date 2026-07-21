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
const {
  buildEventPayload,
  buildStorePayload,
  parseUserQrPayload,
  processEventEligibility,
  processEventCheckIn,
  processEventCompletion,
  processStoreExchange
} = require('../server');
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
    db.prepare(
      `INSERT INTO users (user_id, name, email, password, points, age_group, user_type, email_verified_at)
       VALUES (2, 'Not Applied User', 'not-applied@example.com', 'test-password-placeholder', 0, '20s', 'general', CURRENT_TIMESTAMP)`
    ).run();
    db.prepare(
      `INSERT INTO events
        (event_name, event_datetime, location, grant_points, status, description, activity, notes)
       VALUES
        ('管理者作成イベント', '2026-07-20T10:00:00+09:00', '市民ホール', 40, 'active',
         '管理画面から作成された未割当イベントです。', '受付確認を行います。', '割当がなくても主催者アプリに表示します。')`
    ).run();
    db.prepare(
      "UPDATE events SET event_end_datetime = '2000-01-01 12:00:00' WHERE grant_points = 100"
    ).run();
    db.prepare(
      `INSERT OR IGNORE INTO participations
         (user_id, event_id, status, grant_points_snapshot, granted_points, applied_at)
       SELECT 1, event_id, 'applied', grant_points, 0, CURRENT_TIMESTAMP
       FROM events WHERE grant_points = 100`
    ).run();
    const eventCount = db.prepare('SELECT COUNT(*) AS count FROM events').get().count;
    const storeCount = db.prepare('SELECT COUNT(*) AS count FROM stores').get().count;
    const organizerCount = db.prepare('SELECT COUNT(*) AS count FROM event_organizers').get().count;
    assert.equal(eventCount, 3);
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
  const unassignedEvent = eventPayload.events.find((eventItem) => eventItem.event_name.includes('管理者作成イベント'));
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

function createUserQrPayload(nonce, user = { userId: '1', name: 'Demo User' }) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);
  const params = new URLSearchParams({
    v: '1',
    type: 'user-present',
    user_id: user.userId,
    name: user.name,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    nonce
  });

  return `linktown://user-present?${params.toString()}`;
}

function createUserQrPayloadWithDates(nonce, issuedAt, expiresAt) {
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

function assertQrError(payload, expectedCode) {
  assert.throws(
    () => parseUserQrPayload(payload),
    (error) => error.code === expectedCode,
    `Expected QR error code ${expectedCode}`
  );
}

function testUserQrErrorClassification() {
  assertQrError('', 'QR_REQUIRED');
  assertQrError('not-a-url', 'QR_INVALID_FORMAT');
  assertQrError('https://example.com/user-present?type=user-present', 'QR_INVALID_FORMAT');
  assertQrError('{broken-json', 'QR_INVALID_FORMAT');
  assertQrError(JSON.stringify({ type: 'store-exchange', user_id: '1', nonce: 'wrong-type' }), 'QR_INVALID_TYPE');
  assertQrError(JSON.stringify({ type: 'user-present', user_id: '1' }), 'QR_MISSING_FIELDS');
}

function testUserQrTimeTolerance() {
  const now = Date.now();
  const withinFutureTolerance = parseUserQrPayload(
    createUserQrPayloadWithDates(
      'future-within-tolerance',
      new Date(now + 29 * 60 * 1000),
      new Date(now + 35 * 60 * 1000)
    )
  );
  assert.match(withinFutureTolerance.issued_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.match(withinFutureTolerance.expires_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

  const withinExpiredTolerance = parseUserQrPayload(
    createUserQrPayloadWithDates(
      'expired-within-tolerance',
      new Date(now - 40 * 60 * 1000),
      new Date(now - 29 * 60 * 1000)
    )
  );
  assert.equal(withinExpiredTolerance.user_id, '1');

  assertQrError(
    createUserQrPayloadWithDates(
      'future-outside-tolerance',
      new Date(now + 31 * 60 * 1000),
      new Date(now + 40 * 60 * 1000)
    ),
    'QR_NOT_YET_VALID'
  );
  assertQrError(
    createUserQrPayloadWithDates(
      'expired-outside-tolerance',
      new Date(now - 45 * 60 * 1000),
      new Date(now - 31 * 60 * 1000)
    ),
    'QR_EXPIRED'
  );
}

async function testUserQrProcessing(cachePath, dbPath, ids) {
  const notAppliedQr = createUserQrPayload(`smoke-not-applied-${Date.now()}`, {
    userId: '2',
    name: 'Not Applied User'
  });
  const notAppliedEligibility = await processEventEligibility(
    {
      code: 'event-demo',
      password: 'event-demo-pass',
      event_id: ids.eventId,
      scan_type: 'check_in',
      user_qr_payload: notAppliedQr
    },
    'en',
    { cachePath, dbPath }
  );
  assert.equal(notAppliedEligibility.status, 403);
  assert.equal(notAppliedEligibility.body.code, 'EVENT_APPLICATION_REQUIRED');
  assert.equal(notAppliedEligibility.body.participation_status, null);

  const blockedCheckIn = await processEventCheckIn(
    {
      code: 'event-demo',
      password: 'event-demo-pass',
      event_id: ids.eventId,
      user_qr_payload: notAppliedQr
    },
    'en',
    { cachePath, dbPath }
  );
  assert.equal(blockedCheckIn.status, 403);
  assert.equal(blockedCheckIn.body.code, 'EVENT_APPLICATION_REQUIRED');
  assert.equal(blockedCheckIn.body.message, 'This participant has not applied for the event.');
  const cancelledDb = openDatabase({ dbPath });
  cancelledDb.prepare(
    `INSERT INTO participations
       (user_id, event_id, status, grant_points_snapshot, granted_points, applied_at, cancelled_at)
     VALUES (2, ?, 'cancelled', 100, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).run(ids.eventId);
  cancelledDb.close();
  const cancelledEligibility = await processEventEligibility(
    {
      code: 'event-demo',
      password: 'event-demo-pass',
      event_id: ids.eventId,
      scan_type: 'check_in',
      user_qr_payload: createUserQrPayload(`smoke-cancelled-${Date.now()}`, {
        userId: '2',
        name: 'Not Applied User'
      })
    },
    'en',
    { cachePath, dbPath }
  );
  assert.equal(cancelledEligibility.status, 403);
  assert.equal(cancelledEligibility.body.code, 'EVENT_APPLICATION_REQUIRED');
  assert.equal(cancelledEligibility.body.participation_status, 'cancelled');

  const userQrPayload = createUserQrPayload(`smoke-event-${Date.now()}`);
  const parsed = parseUserQrPayload(userQrPayload);
  assert.equal(parsed.user_id, '1');
  assert.equal(parsed.name, 'Demo User');

  const appliedEligibility = await processEventEligibility(
    {
      code: 'event-demo',
      password: 'event-demo-pass',
      event_id: ids.eventId,
      scan_type: 'check_in',
      user_qr_payload: userQrPayload
    },
    'en',
    { cachePath, dbPath }
  );
  assert.equal(appliedEligibility.status, 200);
  assert.equal(appliedEligibility.body.eligible, true);
  assert.equal(appliedEligibility.body.participation_status, 'applied');

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
  assert.equal(eventResult.body.participation_status, 'checked_in');
  assert.equal('granted_points' in eventResult.body, false);
  assert.equal(eventResult.body.user.user_id, '1');

  const alreadyCheckedInEligibility = await processEventEligibility(
    {
      code: 'event-demo',
      password: 'event-demo-pass',
      event_id: ids.eventId,
      scan_type: 'check_in',
      user_qr_payload: createUserQrPayload(`smoke-already-checked-in-${Date.now()}`)
    },
    'ja',
    { cachePath, dbPath }
  );
  assert.equal(alreadyCheckedInEligibility.status, 403);
  assert.equal(alreadyCheckedInEligibility.body.code, 'EVENT_ALREADY_CHECKED_IN');
  assert.equal(alreadyCheckedInEligibility.body.message, 'この利用者はすでに開始受付済みです。');

  const completionEligibility = await processEventEligibility(
    {
      code: 'event-demo',
      password: 'event-demo-pass',
      event_id: ids.eventId,
      scan_type: 'completion',
      user_qr_payload: createUserQrPayload(`smoke-completion-eligibility-${Date.now()}`)
    },
    'en',
    { cachePath, dbPath }
  );
  assert.equal(completionEligibility.status, 200);
  assert.equal(completionEligibility.body.participation_status, 'checked_in');

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
  assert.equal(duplicateResult.body.code, 'QR_ALREADY_USED');

  const timingDb = openDatabase({ dbPath });
  timingDb.prepare("UPDATE events SET event_end_datetime = '2099-01-01 12:00:00' WHERE event_id = ?").run(ids.eventId);
  timingDb.close();
  const completionQr = createUserQrPayload(`smoke-completion-${Date.now()}`);
  const tooEarlyResult = await processEventCompletion(
    {
      code: 'event-demo',
      password: 'event-demo-pass',
      event_id: ids.eventId,
      user_qr_payload: completionQr
    },
    'en',
    { cachePath, dbPath }
  );
  assert.equal(tooEarlyResult.status, 409);
  assert.equal(tooEarlyResult.body.code, 'COMPLETION_TOO_EARLY');
  const finishedDb = openDatabase({ dbPath });
  finishedDb.prepare("UPDATE events SET event_end_datetime = '2000-01-01 12:00:00' WHERE event_id = ?").run(ids.eventId);
  finishedDb.close();

  const completionResult = await processEventCompletion(
    {
      code: 'event-demo',
      password: 'event-demo-pass',
      event_id: ids.eventId,
      user_qr_payload: completionQr
    },
    'en',
    { cachePath, dbPath }
  );
  assert.equal(completionResult.status, 201);
  assert.equal(completionResult.body.participation_status, 'completed');
  assert.equal(completionResult.body.granted_points, 100);

  const alreadyCompletedEligibility = await processEventEligibility(
    {
      code: 'event-demo',
      password: 'event-demo-pass',
      event_id: ids.eventId,
      scan_type: 'completion',
      user_qr_payload: createUserQrPayload(`smoke-already-completed-${Date.now()}`)
    },
    'ja',
    { cachePath, dbPath }
  );
  assert.equal(alreadyCompletedEligibility.status, 403);
  assert.equal(alreadyCompletedEligibility.body.code, 'EVENT_ALREADY_COMPLETED');

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
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM event_attendance_scans').get().count, 2);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM point_transactions WHERE participation_id IS NOT NULL').get().count,
      1
    );
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
  testUserQrErrorClassification();
  testUserQrTimeTolerance();
  await testUserQrProcessing(cachePath, dbPath, ids);
  console.log('partner-portals smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
