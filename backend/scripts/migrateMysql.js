const fs = require('fs');
const mysql = require('mysql2/promise');
const { env } = require('../config/env');

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function getDbClient() {
  return env.DB_CLIENT;
}

function getSslOptions(searchParams = new URLSearchParams()) {
  const sslMode = (searchParams.get('ssl-mode') || searchParams.get('sslmode') || '').toUpperCase();
  const sslRequested =
    env.MYSQL_SSL ||
    sslMode === 'REQUIRED' ||
    sslMode === 'VERIFY_CA' ||
    sslMode === 'VERIFY_IDENTITY';

  if (!sslRequested) {
    return undefined;
  }

  const ssl = {
    rejectUnauthorized: env.MYSQL_SSL_REJECT_UNAUTHORIZED
  };

  if (env.MYSQL_SSL_CA) {
    ssl.ca = fs.readFileSync(env.MYSQL_SSL_CA, 'utf8');
  }

  return ssl;
}

function getMysqlConfigFromUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);

  if (parsed.protocol !== 'mysql:' && parsed.protocol !== 'mysql2:') {
    throw new Error('DATABASE_URL must start with mysql:// or mysql2:// when DB_CLIENT=mysql.');
  }

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: safeDecode(parsed.username || ''),
    password: safeDecode(parsed.password || ''),
    database: safeDecode(parsed.pathname.replace(/^\//, '')) || env.DB_NAME,
    ssl: getSslOptions(parsed.searchParams)
  };
}

function getMysqlConfigFromEnv() {
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: getSslOptions()
  };
}

async function createPool() {
  if (getDbClient() !== 'mysql') {
    throw new Error('DB_CLIENT=mysql or a mysql:// DATABASE_URL is required to migrate the deployed MySQL database.');
  }

  const config = env.DATABASE_URL ? getMysqlConfigFromUrl(env.DATABASE_URL) : getMysqlConfigFromEnv();

  return mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0
  });
}

async function tableExists(pool, tableName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return Number(rows[0].count) > 0;
}

async function columnExists(pool, tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  return Number(rows[0].count) > 0;
}

async function ensureTable(pool, tableName, sql) {
  if (await tableExists(pool, tableName)) {
    console.log(`skip table ${tableName}`);
    return false;
  }

  await pool.query(sql);
  console.log(`create table ${tableName}`);
  return true;
}

async function ensureColumn(pool, tableName, columnName, sql) {
  if (await columnExists(pool, tableName, columnName)) {
    console.log(`skip column ${tableName}.${columnName}`);
    return false;
  }

  await pool.query(sql);
  console.log(`add column ${tableName}.${columnName}`);
  return true;
}

async function migrate() {
  const pool = await createPool();

  try {
    await ensureTable(
      pool,
      'users',
      `CREATE TABLE users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        points INT NOT NULL DEFAULT 0,
        age_group VARCHAR(50),
        user_type VARCHAR(50) DEFAULT 'general',
        email_verified_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );

    await ensureColumn(pool, 'users', 'points', 'ALTER TABLE users ADD COLUMN points INT NOT NULL DEFAULT 0 AFTER password');
    await ensureColumn(pool, 'users', 'age_group', 'ALTER TABLE users ADD COLUMN age_group VARCHAR(50) NULL AFTER points');
    await ensureColumn(pool, 'users', 'user_type', "ALTER TABLE users ADD COLUMN user_type VARCHAR(50) DEFAULT 'general' AFTER age_group");
    const addedEmailVerifiedAt = await ensureColumn(
      pool,
      'users',
      'email_verified_at',
      'ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL AFTER user_type'
    );
    await ensureColumn(
      pool,
      'users',
      'created_at',
      'ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    );

    if (addedEmailVerifiedAt) {
      await pool.query('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE email_verified_at IS NULL');
      console.log('backfill users.email_verified_at for existing users');
    }

    await ensureTable(
      pool,
      'user_settings',
      `CREATE TABLE user_settings (
        user_id INT PRIMARY KEY,
        notification_enabled TINYINT(1) NOT NULL DEFAULT 1,
        language VARCHAR(20) NOT NULL DEFAULT 'ja',
        font_size ENUM('small', 'medium', 'large') NOT NULL DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_settings_user
          FOREIGN KEY (user_id) REFERENCES users(user_id)
          ON DELETE CASCADE
      )`
    );

    await pool.query(
      `INSERT INTO user_settings (user_id, notification_enabled, language, font_size)
       SELECT users.user_id, 1, 'ja', 'medium'
       FROM users
       LEFT JOIN user_settings ON user_settings.user_id = users.user_id
       WHERE user_settings.user_id IS NULL`
    );
    console.log('backfill missing user_settings rows');

    await ensureTable(
      pool,
      'password_reset_tokens',
      `CREATE TABLE password_reset_tokens (
        token_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        reset_token VARCHAR(100) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_password_reset_user
          FOREIGN KEY (user_id) REFERENCES users(user_id)
          ON DELETE CASCADE
      )`
    );

    await ensureTable(
      pool,
      'email_verification_tokens',
      `CREATE TABLE email_verification_tokens (
        token_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        verification_token VARCHAR(100) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_email_verification_user
          FOREIGN KEY (user_id) REFERENCES users(user_id)
          ON DELETE CASCADE
      )`
    );

    await ensureTable(
      pool,
      'notifications',
      `CREATE TABLE notifications (
        notification_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        read_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_notifications_user
          FOREIGN KEY (user_id) REFERENCES users(user_id)
          ON DELETE CASCADE
      )`
    );

    console.log('mysql migration completed');
  } finally {
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
