const fs = require('fs');
const path = require('path');
const { DEFAULT_DB_PATH } = require('../database/sqlite');
const { env } = require('../config/env');

const dbPath = path.resolve(env.SQLITE_PATH || DEFAULT_DB_PATH);

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log(`Removed ${dbPath}`);
} else {
  console.log(`SQLite file not found: ${dbPath}`);
}
