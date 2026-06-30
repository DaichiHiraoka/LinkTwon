const fs = require('fs');
const mysql = require('mysql2/promise');
const { getSqlitePool } = require('../database/sqlite');
const { env } = require('./env');

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
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

function getDbClient() {
  return env.DB_CLIENT;
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

function createMysqlPool() {
  const config = env.DATABASE_URL ? getMysqlConfigFromUrl(env.DATABASE_URL) : getMysqlConfigFromEnv();

  return mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    queueLimit: 0
  });
}

const dbClient = getDbClient();

if (dbClient === 'mysql') {
  module.exports = createMysqlPool();
} else {
  module.exports = getSqlitePool(env.SQLITE_PATH);
}
