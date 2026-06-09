require('../config/loadEnv');

const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const demoEmail = process.env.DEMO_USER_EMAIL || 'demo@example.com';
const demoPassword = process.env.DEMO_USER_PASSWORD || 'password123';
const adminId = process.env.DEFAULT_ADMIN_ID || 'admin';
const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function ensureDemoUser() {
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const users = await query('SELECT user_id FROM users WHERE email = ?', [demoEmail]);

  let userId;
  if (users.length > 0) {
    userId = users[0].user_id;
    await query(
      `UPDATE users
       SET name = ?, password = ?, points = ?, age_group = ?, user_type = ?
       WHERE user_id = ?`,
      ['Demo User', passwordHash, 300, '30s', 'general', userId]
    );
  } else {
    const result = await query(
      `INSERT INTO users (name, email, password, points, age_group, user_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Demo User', demoEmail, passwordHash, 300, '30s', 'general']
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

async function seedDemoData() {
  const userId = await ensureDemoUser();
  await ensureAdmin();

  return {
    userId,
    demoEmail,
    adminId
  };
}

async function main() {
  try {
    const result = await seedDemoData();
    console.log('Demo data created or updated.');
    console.log(`User: ${result.demoEmail}`);
    console.log(`User ID: ${result.userId}`);
    console.log(`Admin ID: ${result.adminId}`);
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
