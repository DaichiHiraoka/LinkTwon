const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { env } = require('../config/env');

const demoEmail = env.DEMO_USER_EMAIL;
const demoPassword = env.DEMO_USER_PASSWORD;
const adminId = env.DEFAULT_ADMIN_ID;
const adminPassword = env.DEFAULT_ADMIN_PASSWORD;

const demoEvents = [
  {
    eventName: '地域清掃ボランティア',
    legacyEventName: 'Demo Community Cleanup',
    eventDatetime: '2026-07-01 10:00:00',
    location: '中央公園',
    grantPoints: 60,
    description: '地域の歩道と広場を清掃し、来街者が歩きやすい環境を整えます。',
    activity: 'ごみ拾い、落ち葉の回収、掲示板周辺の拭き掃除を担当します。',
    notes: '軍手とごみ袋は主催者が用意します。'
  },
  {
    eventName: '見守りパトロール',
    legacyEventName: 'Demo Watch Patrol',
    eventDatetime: '2026-07-03 16:00:00',
    location: '駅前商店街',
    grantPoints: 80,
    description: '駅前商店街を巡回し、住民と来街者に声かけを行います。',
    activity: '巡回、案内、困りごとの聞き取りを担当します。',
    notes: '集合時に当日の巡回ルートを共有します。'
  },
  {
    eventName: '子ども食堂サポート',
    legacyEventName: 'Demo Food Support',
    eventDatetime: '2026-07-08 11:00:00',
    location: '市民センター',
    grantPoints: 120,
    description: '子ども食堂の会場準備と配膳を支援します。',
    activity: '受付、配膳、片付け、見守り補助を行います。',
    notes: '衛生管理のため、マスク着用をお願いします。'
  }
];

const demoStores = [
  {
    storeName: 'Link Cafe',
    services: [
      {
        serviceName: 'コーヒー無料券',
        legacyServiceName: 'Demo Coffee Coupon',
        requiredPoints: 120,
        categoryId: 'category-food',
        description: '商店街の協力店舗が用意するコーヒー交換券です。'
      },
      {
        serviceName: 'ケーキセット割引',
        legacyServiceName: 'Demo Cake Coupon',
        requiredPoints: 180,
        categoryId: 'category-food',
        description: '店内で使えるケーキセットの割引商品です。'
      }
    ]
  },
  {
    storeName: 'まちのパン屋',
    legacyStoreName: 'Demo Bakery',
    services: [
      {
        serviceName: '焼きたてパン引換券',
        legacyServiceName: 'Demo Bread Coupon',
        requiredPoints: 150,
        categoryId: 'category-food',
        description: '焼きたてパンと交換できる商品です。'
      }
    ]
  },
  {
    storeName: '地域マルシェ',
    legacyStoreName: 'Demo Market',
    loginCode: 'store-demo',
    loginPassword: 'store-demo-pass',
    storeAddress: '東京都千代田区日比谷公園',
    mapQuery: '地域マルシェ 東京都千代田区日比谷公園',
    contactEmail: 'store@example.com',
    services: [
      {
        serviceName: '野菜セット引換券',
        legacyServiceName: 'Demo Vegetable Coupon',
        requiredPoints: 220,
        categoryId: 'category-life',
        description: '地域で仕入れた旬の野菜を少量ずつ詰め合わせた交換商品です。'
      }
    ]
  }
];

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

function buildNameLookup(name, legacyName) {
  return [...new Set([name, legacyName].filter(Boolean))];
}

async function ensureDemoUser() {
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const users = await query('SELECT user_id FROM users WHERE email = ?', [demoEmail]);

  let userId;
  if (users.length > 0) {
    userId = users[0].user_id;
    await query(
      `UPDATE users
       SET name = ?, password = ?, login_password_plaintext = ?, points = ?, age_group = ?, user_type = ?
       WHERE user_id = ?`,
      ['Demo User', passwordHash, demoPassword, 300, '30s', 'general', userId]
    );
  } else {
    const result = await query(
      `INSERT INTO users (name, email, password, login_password_plaintext, points, age_group, user_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Demo User', demoEmail, passwordHash, demoPassword, 300, '30s', 'general']
    );
    userId = result.insertId;
  }

  const settings = await query('SELECT user_id FROM user_settings WHERE user_id = ?', [userId]);
  if (settings.length > 0) {
    await query(
      `UPDATE user_settings
       SET notification_enabled = 1, language = 'ja', font_size = 'medium'
       WHERE user_id = ?`,
      [userId]
    );
  } else {
    await query(
      `INSERT INTO user_settings (user_id, notification_enabled, language, font_size)
       VALUES (?, 1, 'ja', 'medium')`,
      [userId]
    );
  }

  const paymentMethods = await query(
    'SELECT payment_method_id FROM payment_methods WHERE user_id = ? AND is_default = 1',
    [userId]
  );
  if (paymentMethods.length === 0) {
    await query(
      `INSERT INTO payment_methods (user_id, label, brand, last4, is_default)
       VALUES (?, ?, ?, ?, 1)`,
      [userId, 'Demo Card', 'mock-visa', '4242']
    );
  }

  return userId;
}

async function ensureAdmin() {
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admins = await query('SELECT admin_id FROM admins WHERE admin_id = ?', [adminId]);

  if (admins.length > 0) {
    await query(
      `UPDATE admins
       SET password_hash = ?
       WHERE admin_id = ?`,
      [passwordHash, adminId]
    );
    return;
  }

  await query(
    `INSERT INTO admins (admin_id, password_hash)
     VALUES (?, ?)`,
    [adminId, passwordHash]
  );
}

async function ensureEventCheckInCode(eventId) {
  const tokens = await query(
    `SELECT token_id
     FROM event_checkin_tokens
     WHERE event_id = ? AND is_active = 1`,
    [eventId]
  );

  if (tokens.length > 0) {
    return;
  }

  await query(
    `INSERT INTO event_checkin_tokens (event_id, check_in_code, expires_at, is_active)
     VALUES (?, ?, '2030-12-31 23:59:59', 1)`,
    [eventId, `EVENT-${eventId}`]
  );
}

async function ensureServiceCategories() {
  const categories = [
    ['category-food', '商店街の人気商品'],
    ['category-life', '生活応援商品']
  ];

  for (const [categoryId, categoryName] of categories) {
    const existing = await query('SELECT category_id FROM service_categories WHERE category_id = ?', [categoryId]);
    if (existing.length > 0) {
      await query('UPDATE service_categories SET category_name = ? WHERE category_id = ?', [categoryName, categoryId]);
    } else {
      await query('INSERT INTO service_categories (category_id, category_name) VALUES (?, ?)', [categoryId, categoryName]);
    }
  }
}

async function ensureDemoEvents() {
  const eventIds = [];

  for (const event of demoEvents) {
    const names = buildNameLookup(event.eventName, event.legacyEventName);
    const placeholders = names.map(() => '?').join(', ');
    const existingEvents = await query(
      `SELECT event_id
       FROM events
       WHERE event_name IN (${placeholders})
       ORDER BY CASE WHEN event_name = ? THEN 0 ELSE 1 END, event_id ASC`,
      [...names, event.eventName]
    );
    let eventId;

    if (existingEvents.length > 0) {
      eventId = existingEvents[0].event_id;
      await query(
        `UPDATE events
         SET event_name = ?, event_datetime = ?, location = ?, grant_points = ?, status = 'active',
             description = ?, activity = ?, notes = ?
         WHERE event_id = ?`,
        [event.eventName, event.eventDatetime, event.location, event.grantPoints, event.description, event.activity, event.notes, eventId]
      );
    } else {
      const result = await query(
        `INSERT INTO events (event_name, event_datetime, location, grant_points, status, description, activity, notes)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
        [event.eventName, event.eventDatetime, event.location, event.grantPoints, event.description, event.activity, event.notes]
      );
      eventId = result.insertId;
    }

    await ensureEventCheckInCode(eventId);
    eventIds.push(eventId);
  }

  return eventIds;
}

async function ensureDemoOrganizer(eventIds) {
  const organizerId = 'org-demo';
  const organizers = await query('SELECT organizer_id FROM event_organizers WHERE organizer_id = ?', [organizerId]);

  if (organizers.length > 0) {
    await query(
      `UPDATE event_organizers
       SET login_code = ?, login_password = ?, organizer_name = ?, contact_email = ?
       WHERE organizer_id = ?`,
      ['event-demo', 'event-demo-pass', 'LinkTwon Demo Organizer', 'event@example.com', organizerId]
    );
  } else {
    await query(
      `INSERT INTO event_organizers (organizer_id, login_code, login_password, organizer_name, contact_email)
       VALUES (?, ?, ?, ?, ?)`,
      [organizerId, 'event-demo', 'event-demo-pass', 'LinkTwon Demo Organizer', 'event@example.com']
    );
  }

  for (const eventId of eventIds) {
    const assignments = await query(
      `SELECT organizer_id
       FROM event_organizer_events
       WHERE organizer_id = ? AND event_id = ?`,
      [organizerId, eventId]
    );
    if (assignments.length === 0) {
      await query(
        `INSERT INTO event_organizer_events (organizer_id, event_id)
         VALUES (?, ?)`,
        [organizerId, eventId]
      );
    }
  }
}

async function ensureDemoStoresAndServices() {
  const serviceIds = [];

  for (const store of demoStores) {
    const storeNames = buildNameLookup(store.storeName, store.legacyStoreName);
    const storePlaceholders = storeNames.map(() => '?').join(', ');
    const existingStores = await query(
      `SELECT store_id
       FROM stores
       WHERE store_name IN (${storePlaceholders})
       ORDER BY CASE WHEN store_name = ? THEN 0 ELSE 1 END, store_id ASC`,
      [...storeNames, store.storeName]
    );
    let storeId;

    if (existingStores.length > 0) {
      storeId = existingStores[0].store_id;
      await query(
        `UPDATE stores
         SET store_name = ?,
             status = ?,
             login_code = ?,
             login_password = ?,
             store_address = ?,
             map_query = ?,
             contact_email = ?
       WHERE store_id = ?`,
        [
          store.storeName,
          'active',
          store.loginCode || null,
          store.loginPassword || null,
          store.storeAddress || null,
          store.mapQuery || null,
          store.contactEmail || null,
          storeId
        ]
      );
    } else {
      const result = await query(
        `INSERT INTO stores (store_name, login_code, login_password, store_address, map_query, contact_email, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [
          store.storeName,
          store.loginCode || null,
          store.loginPassword || null,
          store.storeAddress || null,
          store.mapQuery || null,
          store.contactEmail || null
        ]
      );
      storeId = result.insertId;
    }

    for (const service of store.services) {
      const serviceNames = buildNameLookup(service.serviceName, service.legacyServiceName);
      const servicePlaceholders = serviceNames.map(() => '?').join(', ');
      const existingServices = await query(
        `SELECT service_id
         FROM services
         WHERE store_id = ? AND service_name IN (${servicePlaceholders})
         ORDER BY CASE WHEN service_name = ? THEN 0 ELSE 1 END, service_id ASC`,
        [storeId, ...serviceNames, service.serviceName]
      );

      if (existingServices.length > 0) {
        const serviceId = existingServices[0].service_id;
        await query(
          `UPDATE services
           SET service_name = ?, category_id = ?, description = ?, required_points = ?, status = 'active'
           WHERE service_id = ?`,
          [service.serviceName, service.categoryId || null, service.description || null, service.requiredPoints, serviceId]
        );
        serviceIds.push(serviceId);
      } else {
        const result = await query(
          `INSERT INTO services (store_id, category_id, service_name, description, required_points, status)
           VALUES (?, ?, ?, ?, ?, 'active')`,
          [storeId, service.categoryId || null, service.serviceName, service.description || null, service.requiredPoints]
        );
        serviceIds.push(result.insertId);
      }
    }
  }

  return serviceIds;
}

async function seedDemoData() {
  const userId = await ensureDemoUser();
  await ensureAdmin();
  await ensureServiceCategories();
  const eventIds = await ensureDemoEvents();
  await ensureDemoOrganizer(eventIds);
  const serviceIds = await ensureDemoStoresAndServices();

  return {
    userId,
    demoEmail,
    adminId,
    eventIds,
    serviceIds
  };
}

async function main() {
  try {
    const result = await seedDemoData();
    console.log('Demo data created or updated.');
    console.log(`User: ${result.demoEmail}`);
    console.log(`User ID: ${result.userId}`);
    console.log(`Admin ID: ${result.adminId}`);
    console.log(`Events: ${result.eventIds.join(', ')}`);
    console.log(`Services: ${result.serviceIds.join(', ')}`);
  } catch (error) {
    console.error('Failed to seed demo data.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (typeof pool.end === 'function') {
      await pool.end();
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  seedDemoData
};
