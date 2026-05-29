const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const DEFAULT_DB_PATH = path.resolve(__dirname, './dev.sqlite');

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    age_group TEXT,
    user_type TEXT DEFAULT 'general',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS admins (
    admin_id TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    event_datetime TEXT NOT NULL,
    location TEXT,
    grant_points INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stores (
    store_id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    service_id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    service_name TEXT NOT NULL,
    required_points INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS participations (
    participation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    granted_points INTEGER NOT NULL,
    participated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, event_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS point_transactions (
    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service_id INTEGER,
    type TEXT NOT NULL CHECK(type IN ('grant', 'exchange')),
    points INTEGER NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE SET NULL
  )`
];

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function applySchema(db) {
  for (const statement of schemaStatements) {
    db.prepare(statement).run();
  }
}

function seedDatabase(db) {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(
      `INSERT INTO users (name, email, password, points, age_group, user_type)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const passwordHash = bcrypt.hashSync('password123', 10);
    insertUser.run('Demo User', 'demo@example.com', passwordHash, 300, '30s', 'general');
  }

  const adminCount = db.prepare('SELECT COUNT(*) AS count FROM admins').get().count;
  if (adminCount === 0) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      `INSERT INTO admins (admin_id, password_hash)
       VALUES (?, ?)`
    ).run('admin', passwordHash);
  }

  const eventCount = db.prepare('SELECT COUNT(*) AS count FROM events').get().count;
  if (eventCount === 0) {
    const insertEvent = db.prepare(
      `INSERT INTO events (event_name, event_datetime, location, grant_points)
       VALUES (?, ?, ?, ?)`
    );
    [
      ['地域清掃ボランティア', '2026-06-01 10:00:00', '中央公園', 60],
      ['見守りパトロール', '2026-06-03 16:00:00', '駅前商店街', 80],
      ['子ども食堂サポート', '2026-06-08 11:00:00', '市民センター', 120]
    ].forEach((eventRow) => insertEvent.run(...eventRow));
  }

  const storeCount = db.prepare('SELECT COUNT(*) AS count FROM stores').get().count;
  if (storeCount === 0) {
    const insertStore = db.prepare(
      `INSERT INTO stores (store_name)
       VALUES (?)`
    );
    ['Link Cafe', 'まちのパン屋', '地域マルシェ'].forEach((storeName) => insertStore.run(storeName));
  }

  const serviceCount = db.prepare('SELECT COUNT(*) AS count FROM services').get().count;
  if (serviceCount === 0) {
    const stores = db.prepare('SELECT store_id, store_name FROM stores ORDER BY store_id ASC').all();
    const storeMap = Object.fromEntries(stores.map((store) => [store.store_name, store.store_id]));
    const insertService = db.prepare(
      `INSERT INTO services (store_id, service_name, required_points)
       VALUES (?, ?, ?)`
    );
    [
      [storeMap['Link Cafe'], 'コーヒー無料券', 120],
      [storeMap['Link Cafe'], 'ケーキセット割引', 180],
      [storeMap['まちのパン屋'], '焼きたてパン引換券', 150],
      [storeMap['地域マルシェ'], '野菜セット引換券', 220]
    ].forEach((serviceRow) => insertService.run(...serviceRow));
  }
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').replace(/ FOR UPDATE/i, '').trim();
}

function execute(db, sql, params = []) {
  const normalizedSql = normalizeSql(sql);
  const statement = db.prepare(normalizedSql);

  if (/^select/i.test(normalizedSql)) {
    return [statement.all(params)];
  }

  const result = statement.run(params);
  return [
    {
      insertId: Number(result.lastInsertRowid),
      affectedRows: result.changes
    }
  ];
}

class SqliteConnection {
  constructor(db) {
    this.db = db;
    this.inTransaction = false;
  }

  async beginTransaction() {
    if (!this.inTransaction) {
      this.db.prepare('BEGIN IMMEDIATE').run();
      this.inTransaction = true;
    }
  }

  async query(sql, params = []) {
    return execute(this.db, sql, params);
  }

  async commit() {
    if (this.inTransaction) {
      this.db.prepare('COMMIT').run();
      this.inTransaction = false;
    }
  }

  async rollback() {
    if (this.inTransaction) {
      this.db.prepare('ROLLBACK').run();
      this.inTransaction = false;
    }
  }

  release() {}
}

class SqlitePool {
  constructor(filePath) {
    ensureDirectory(filePath);
    this.filePath = filePath;
    this.db = new Database(filePath);
    this.db.pragma('foreign_keys = ON');
    applySchema(this.db);
    seedDatabase(this.db);
  }

  async query(sql, params = []) {
    return execute(this.db, sql, params);
  }

  async getConnection() {
    return new SqliteConnection(this.db);
  }
}

let sqlitePool;

function getSqlitePool(filePath = process.env.SQLITE_PATH || DEFAULT_DB_PATH) {
  if (!sqlitePool) {
    sqlitePool = new SqlitePool(path.resolve(filePath));
  }
  return sqlitePool;
}

module.exports = {
  DEFAULT_DB_PATH,
  getSqlitePool
};
