const { env } = require('../config/env');

async function columnExists(pool, tableName, columnName) {
  if (env.DB_CLIENT === 'mysql') {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  const [columns] = await pool.query(`PRAGMA table_info(${tableName})`);
  return columns.some((column) => column.name === columnName);
}

async function ensureUserLoginPasswordPlaintext(pool) {
  const exists = await columnExists(pool, 'users', 'login_password_plaintext');
  if (exists) {
    return;
  }

  if (env.DB_CLIENT === 'mysql') {
    await pool.query('ALTER TABLE users ADD COLUMN login_password_plaintext VARCHAR(255) NULL AFTER password');
  } else {
    await pool.query('ALTER TABLE users ADD COLUMN login_password_plaintext TEXT');
  }
}

async function ensureRuntimeSchema(pool) {
  await ensureUserLoginPasswordPlaintext(pool);
}

module.exports = {
  ensureRuntimeSchema
};
