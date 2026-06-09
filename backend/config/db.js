require('./loadEnv');

const fs = require('fs');
const mysql = require('mysql2/promise');
const { getSqlitePool } = require('../database/sqlite');

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function boolFromEnv(value) {
  return value === 'true' || value === '1';
}

function getSslOptions(searchParams = new URLSearchParams()) {
  const sslMode = (searchParams.get('ssl-mode') || searchParams.get('sslmode') || '').toUpperCase();
  const sslRequested =
    boolFromEnv(process.env.MYSQL_SSL) ||
    sslMode === 'REQUIRED' ||
    sslMode === 'VERIFY_CA' ||
    sslMode === 'VERIFY_IDENTITY';

  if (!sslRequested) {
    return undefined;
  }

  const ssl = {
    rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== 'false'
  };

  if (process.env.MYSQL_SSL_CA) {
    ssl.ca = fs.readFileSync(process.env.MYSQL_SSL_CA, 'utf8');
  }

  return ssl;
}

function getDbClient() {
  if (process.env.DB_CLIENT) {
    return process.env.DB_CLIENT.toLowerCase();
  }

  if (process.env.DATABASE_URL?.startsWith('mysql://') || process.env.DATABASE_URL?.startsWith('mysql2://')) {
    return 'mysql';
  }

  return 'sqlite';
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
    database: safeDecode(parsed.pathname.replace(/^\//, '')) || process.env.DB_NAME || 'linktown',
    ssl: getSslOptions(parsed.searchParams)
  };
}

function getMysqlConfigFromEnv() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'linktown',
    ssl: getSslOptions()
  };
}

function createMysqlPool() {
  const config = process.env.DATABASE_URL ? getMysqlConfigFromUrl(process.env.DATABASE_URL) : getMysqlConfigFromEnv();

  return mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0
  });
}

const dbClient = getDbClient();

if (dbClient === 'mysql') {
  module.exports = createMysqlPool();
} else {
  module.exports = getSqlitePool();
}
