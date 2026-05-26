require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seedAdmin() {
  try {
    const adminId = process.env.DEFAULT_ADMIN_ID || 'admin';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await pool.query(
      `INSERT INTO admins (admin_id, password_hash)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [adminId, hashedPassword]
    );

    console.log('Admin account created or updated.');
    console.log(`Admin ID: ${adminId}`);
  } catch (error) {
    console.error(error);
  } finally {
    process.exit();
  }
}

seedAdmin();
