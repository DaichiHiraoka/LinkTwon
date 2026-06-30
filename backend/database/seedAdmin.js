const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { env } = require('../config/env');

async function seedAdmin() {
  try {
    const adminId = env.DEFAULT_ADMIN_ID;
    const adminPassword = env.DEFAULT_ADMIN_PASSWORD;

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const [admins] = await pool.query(
      `SELECT admin_id FROM admins WHERE admin_id = ?`,
      [adminId]
    );

    if (admins.length > 0) {
      await pool.query(
        `UPDATE admins
         SET password_hash = ?
         WHERE admin_id = ?`,
        [hashedPassword, adminId]
      );
    } else {
      await pool.query(
        `INSERT INTO admins (admin_id, password_hash)
         VALUES (?, ?)`,
        [adminId, hashedPassword]
      );
    }

    console.log('Admin account created or updated.');
    console.log(`Admin ID: ${adminId}`);
  } catch (error) {
    console.error(error);
  } finally {
    process.exit();
  }
}

seedAdmin();
