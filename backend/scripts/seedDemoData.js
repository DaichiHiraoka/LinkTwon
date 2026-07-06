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
    grantPoints: 60
  },
  {
    eventName: '見守りパトロール',
    legacyEventName: 'Demo Watch Patrol',
    eventDatetime: '2026-07-03 16:00:00',
    location: '駅前商店街',
    grantPoints: 80
  },
  {
    eventName: '子ども食堂サポート',
    legacyEventName: 'Demo Food Support',
    eventDatetime: '2026-07-08 11:00:00',
    location: '市民センター',
    grantPoints: 120
  }
];

const demoStores = [
  {
    storeName: 'Link Cafe',
    services: [
      { serviceName: 'コーヒー無料券', legacyServiceName: 'Demo Coffee Coupon', requiredPoints: 120 },
      { serviceName: 'ケーキセット割引', legacyServiceName: 'Demo Cake Coupon', requiredPoints: 180 }
    ]
  },
  {
    storeName: 'まちのパン屋',
    legacyStoreName: 'Demo Bakery',
    services: [{ serviceName: '焼きたてパン引換券', legacyServiceName: 'Demo Bread Coupon', requiredPoints: 150 }]
  },
  {
    storeName: '地域マルシェ',
    legacyStoreName: 'Demo Market',
    services: [{ serviceName: '野菜セット引換券', legacyServiceName: 'Demo Vegetable Coupon', requiredPoints: 220 }]
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
         SET event_name = ?, event_datetime = ?, location = ?, grant_points = ?, status = 'active'
         WHERE event_id = ?`,
        [event.eventName, event.eventDatetime, event.location, event.grantPoints, eventId]
      );
    } else {
      const result = await query(
        `INSERT INTO events (event_name, event_datetime, location, grant_points, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [event.eventName, event.eventDatetime, event.location, event.grantPoints]
      );
      eventId = result.insertId;
    }

    await ensureEventCheckInCode(eventId);
    eventIds.push(eventId);
  }

  return eventIds;
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
      await query('UPDATE stores SET store_name = ?, status = ? WHERE store_id = ?', [store.storeName, 'active', storeId]);
    } else {
      const result = await query(
        `INSERT INTO stores (store_name, status)
         VALUES (?, 'active')`,
        [store.storeName]
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
           SET service_name = ?, required_points = ?, status = 'active'
           WHERE service_id = ?`,
          [service.serviceName, service.requiredPoints, serviceId]
        );
        serviceIds.push(serviceId);
      } else {
        const result = await query(
          `INSERT INTO services (store_id, service_name, required_points, status)
           VALUES (?, ?, ?, 'active')`,
          [storeId, service.serviceName, service.requiredPoints]
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
  const eventIds = await ensureDemoEvents();
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
