require('./loadEnv');

const mysql = require('mysql2/promise');
const { getSqlitePool } = require('../database/sqlite');

const dbClient = process.env.DB_CLIENT || 'sqlite';

if (dbClient === 'mysql') {
  module.exports = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'linktown',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
} else {
  module.exports = getSqlitePool();
}
