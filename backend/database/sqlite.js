const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const DEFAULT_DB_PATH = path.resolve(__dirname, './dev.sqlite');
const BACKEND_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');

function resolveSqlitePath(filePath) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  const normalized = filePath.replace(/\\/g, '/');
  if (normalized === 'backend' || normalized.startsWith('backend/')) {
    return path.resolve(REPO_ROOT, filePath);
  }

  return path.resolve(BACKEND_ROOT, filePath);
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    login_password_plaintext TEXT,
    points INTEGER NOT NULL DEFAULT 0,
    age_group TEXT,
    user_type TEXT DEFAULT 'general',
    email_verified_at TEXT,
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
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stores (
    store_id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    service_id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    service_name TEXT NOT NULL,
    required_points INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused')),
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
  )`,
  `CREATE TABLE IF NOT EXISTS point_purchases (
    purchase_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    payment_method_id INTEGER,
    points INTEGER NOT NULL,
    amount_yen INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'failed', 'cancelled')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS event_likes (
    like_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, event_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS service_favorites (
    favorite_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, service_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS event_checkin_tokens (
    token_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    check_in_code TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reset_token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    verification_token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY,
    notification_enabled INTEGER NOT NULL DEFAULT 1,
    language TEXT NOT NULL DEFAULT 'ja',
    font_size TEXT NOT NULL DEFAULT 'medium' CHECK(font_size IN ('small', 'medium', 'large')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS payment_methods (
    payment_method_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'mock',
    last4 TEXT NOT NULL DEFAULT '0000',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS support_tickets (
    ticket_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    category TEXT NOT NULL DEFAULT 'support' CHECK(category IN ('support', 'bug')),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),
    admin_note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS content_translations (
    translation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    source_locale TEXT NOT NULL DEFAULT 'ja',
    target_locale TEXT NOT NULL,
    source_text_hash TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    translation_provider TEXT NOT NULL,
    translation_status TEXT NOT NULL DEFAULT 'current' CHECK(translation_status IN ('current', 'failed')),
    error_message TEXT,
    translated_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (content_type, content_id, field_name, target_locale)
  )`
];

const columnMigrations = [
  ['users', 'login_password_plaintext', 'TEXT'],
  ['users', 'email_verified_at', 'TEXT'],
  ['events', 'status', "TEXT NOT NULL DEFAULT 'active'"],
  ['stores', 'status', "TEXT NOT NULL DEFAULT 'active'"],
  ['services', 'status', "TEXT NOT NULL DEFAULT 'active'"]
];

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function applySchema(db) {
  for (const statement of schemaStatements) {
    db.prepare(statement).run();
  }

  for (const [tableName, columnName, definition] of columnMigrations) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const exists = columns.some((column) => column.name === columnName);
    if (!exists) {
      db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
      if (tableName === 'users' && columnName === 'email_verified_at') {
        db.prepare('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE email_verified_at IS NULL').run();
      }
    }
  }
}

function ensureUserSettings(db) {
  const insertSettings = db.prepare(
    `INSERT OR IGNORE INTO user_settings (user_id, notification_enabled, language, font_size)
     VALUES (?, 1, 'ja', 'medium')`
  );
  const users = db.prepare('SELECT user_id FROM users ORDER BY user_id ASC').all();
  users.forEach((user) => insertSettings.run(user.user_id));
}

function ensureEventCheckInCodes(db) {
  const events = db.prepare('SELECT event_id FROM events ORDER BY event_id ASC').all();
  const countToken = db.prepare('SELECT COUNT(*) AS count FROM event_checkin_tokens WHERE event_id = ?');
  const insertToken = db.prepare(
    `INSERT INTO event_checkin_tokens (event_id, check_in_code, expires_at, is_active)
     VALUES (?, ?, '2030-12-31 23:59:59', 1)`
  );

  events.forEach((event) => {
    if (countToken.get(event.event_id).count === 0) {
      insertToken.run(event.event_id, `EVENT-${event.event_id}`);
    }
  });
}

function seedDatabase(db) {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(
      `INSERT INTO users (name, email, password, login_password_plaintext, points, age_group, user_type, email_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    );
    const passwordHash = bcrypt.hashSync('password123', 10);
    insertUser.run('Demo User', 'demo@example.com', passwordHash, 'password123', 300, '30s', 'general');
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
      `INSERT INTO events (event_name, event_datetime, location, grant_points, status)
       VALUES (?, ?, ?, ?, 'active')`
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
      `INSERT INTO stores (store_name, status)
       VALUES (?, 'active')`
    );
    ['Link Cafe', 'まちのパン屋', '地域マルシェ'].forEach((storeName) => insertStore.run(storeName));
  }

  const serviceCount = db.prepare('SELECT COUNT(*) AS count FROM services').get().count;
  if (serviceCount === 0) {
    const stores = db.prepare('SELECT store_id, store_name FROM stores ORDER BY store_id ASC').all();
    const storeMap = Object.fromEntries(stores.map((store) => [store.store_name, store.store_id]));
    const insertService = db.prepare(
      `INSERT INTO services (store_id, service_name, required_points, status)
       VALUES (?, ?, ?, 'active')`
    );
    [
      [storeMap['Link Cafe'], 'コーヒー無料券', 120],
      [storeMap['Link Cafe'], 'ケーキセット割引', 180],
      [storeMap['まちのパン屋'], '焼きたてパン引換券', 150],
      [storeMap['地域マルシェ'], '野菜セット引換券', 220]
    ].forEach((serviceRow) => insertService.run(...serviceRow));
  }

  ensureUserSettings(db);
  ensureEventCheckInCodes(db);

  const demoUser = db.prepare('SELECT user_id FROM users WHERE email = ?').get('demo@example.com');
  if (demoUser) {
    db.prepare(
      `UPDATE users
       SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
           login_password_plaintext = COALESCE(login_password_plaintext, 'password123')
       WHERE user_id = ?`
    ).run(demoUser.user_id);

    const paymentCount = db.prepare('SELECT COUNT(*) AS count FROM payment_methods WHERE user_id = ?').get(demoUser.user_id).count;
    if (paymentCount === 0) {
      db.prepare(
        `INSERT INTO payment_methods (user_id, label, brand, last4, is_default)
         VALUES (?, '検証用カード', 'mock-visa', '4242', 1)`
      ).run(demoUser.user_id);
    }

    const notificationCount = db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ?').get(demoUser.user_id).count;
    if (notificationCount === 0) {
      db.prepare(
        `INSERT INTO notifications (user_id, title, body)
         VALUES (?, 'Link Townへようこそ', 'これは通知機能確認用の初期お知らせです。')`
      ).run(demoUser.user_id);
    }
  }
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').replace(/ FOR UPDATE/i, '').trim();
}

function execute(db, sql, params = []) {
  const normalizedSql = normalizeSql(sql);
  const statement = db.prepare(normalizedSql);

  if (/^select|^pragma/i.test(normalizedSql)) {
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
    sqlitePool = new SqlitePool(resolveSqlitePath(filePath));
  }
  return sqlitePool;
}

module.exports = {
  DEFAULT_DB_PATH,
  getSqlitePool
};
