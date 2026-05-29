const path = require('path');
require(path.resolve(__dirname, '../config/loadEnv'));

const pool = require('../config/db');

async function table(name, sql) {
  const [rows] = await pool.query(sql);
  console.log(`=== ${name} ===`);
  console.table(rows);
}

async function main() {
  await table(
    'USERS',
    `SELECT user_id, name, email, points, age_group, user_type, created_at
     FROM users
     ORDER BY user_id ASC`
  );
  await table(
    'EVENTS',
    `SELECT e.event_id, e.event_name, e.event_datetime, e.location, e.grant_points, e.status,
            t.check_in_code
     FROM events e
     LEFT JOIN event_checkin_tokens t ON e.event_id = t.event_id AND t.is_active = 1
     ORDER BY e.event_id ASC`
  );
  await table(
    'SERVICES',
    `SELECT s.service_id, s.service_name, s.required_points, s.status, st.store_name
     FROM services s
     JOIN stores st ON s.store_id = st.store_id
     ORDER BY s.service_id ASC`
  );
  await table(
    'PARTICIPATIONS',
    `SELECT participation_id, user_id, event_id, granted_points, participated_at
     FROM participations
     ORDER BY participation_id ASC`
  );
  await table(
    'POINT TRANSACTIONS',
    `SELECT transaction_id, user_id, service_id, type, points, description, created_at
     FROM point_transactions
     ORDER BY transaction_id ASC`
  );
  await table(
    'POINT PURCHASES',
    `SELECT purchase_id, user_id, payment_method_id, points, amount_yen, status, created_at
     FROM point_purchases
     ORDER BY purchase_id ASC`
  );
  await table(
    'EVENT LIKES',
    `SELECT like_id, user_id, event_id, created_at
     FROM event_likes
     ORDER BY like_id ASC`
  );
  await table(
    'SERVICE FAVORITES',
    `SELECT favorite_id, user_id, service_id, created_at
     FROM service_favorites
     ORDER BY favorite_id ASC`
  );
  await table(
    'PAYMENT METHODS',
    `SELECT payment_method_id, user_id, label, brand, last4, is_default, created_at
     FROM payment_methods
     ORDER BY payment_method_id ASC`
  );
  await table(
    'NOTIFICATIONS',
    `SELECT notification_id, user_id, title, read_at, created_at
     FROM notifications
     ORDER BY notification_id ASC`
  );
  await table(
    'SUPPORT TICKETS',
    `SELECT ticket_id, user_id, category, subject, status, admin_note, created_at, updated_at
     FROM support_tickets
     ORDER BY ticket_id ASC`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
