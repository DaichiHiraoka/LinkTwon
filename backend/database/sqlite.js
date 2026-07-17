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
    event_end_datetime TEXT,
    location TEXT,
    grant_points INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'cancelled')),
    description TEXT,
    activity TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS event_organizers (
    organizer_id TEXT PRIMARY KEY,
    login_code TEXT NOT NULL UNIQUE,
    login_password TEXT NOT NULL,
    organizer_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS event_organizer_events (
    organizer_id TEXT NOT NULL,
    event_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organizer_id, event_id),
    FOREIGN KEY (organizer_id) REFERENCES event_organizers(organizer_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS stores (
    store_id INTEGER PRIMARY KEY AUTOINCREMENT,
    login_code TEXT,
    login_password TEXT,
    store_name TEXT NOT NULL,
    store_address TEXT,
    map_query TEXT,
    contact_email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS service_categories (
    category_id TEXT PRIMARY KEY,
    category_name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    service_id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    category_id TEXT,
    service_name TEXT NOT NULL,
    description TEXT,
    required_points INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES service_categories(category_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS participations (
    participation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'applied' CHECK(status IN ('applied', 'checked_in', 'completed', 'cancelled', 'absent', 'incomplete')),
    grant_points_snapshot INTEGER NOT NULL DEFAULT 0,
    granted_points INTEGER NOT NULL DEFAULT 0,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
    checked_in_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT,
    completion_method TEXT CHECK(completion_method IN ('qr', 'admin', 'legacy')),
    completion_note TEXT,
    completed_by_admin_id TEXT,
    participated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, event_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS point_transactions (
    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service_id INTEGER,
    participation_id INTEGER,
    type TEXT NOT NULL CHECK(type IN ('grant', 'exchange')),
    points INTEGER NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE SET NULL,
    FOREIGN KEY (participation_id) REFERENCES participations(participation_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS event_submissions (
    submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    organizer_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_datetime TEXT NOT NULL,
    event_end_datetime TEXT NOT NULL,
    location TEXT,
    description TEXT,
    activity TEXT,
    notes TEXT,
    requested_grant_points INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    review_note TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,
    approved_event_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES event_organizers(organizer_id) ON DELETE CASCADE,
    FOREIGN KEY (approved_event_id) REFERENCES events(event_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS event_participation_status_history (
    history_id INTEGER PRIMARY KEY AUTOINCREMENT,
    participation_id INTEGER NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    reason TEXT,
    actor_type TEXT NOT NULL CHECK(actor_type IN ('user', 'organizer', 'admin', 'system')),
    actor_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participation_id) REFERENCES participations(participation_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS event_attendance_scans (
    scan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    participation_id INTEGER NOT NULL,
    organizer_id TEXT NOT NULL,
    scan_type TEXT NOT NULL CHECK(scan_type IN ('check_in', 'completion')),
    nonce TEXT NOT NULL UNIQUE,
    qr_issued_at TEXT,
    qr_expires_at TEXT NOT NULL,
    processed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (participation_id, scan_type),
    FOREIGN KEY (participation_id) REFERENCES participations(participation_id) ON DELETE CASCADE,
    FOREIGN KEY (organizer_id) REFERENCES event_organizers(organizer_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS portal_event_check_ins (
    check_in_id INTEGER PRIMARY KEY AUTOINCREMENT,
    organizer_id TEXT NOT NULL,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    nonce TEXT NOT NULL,
    qr_issued_at TEXT,
    qr_expires_at TEXT NOT NULL,
    granted_points INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, user_id, nonce),
    FOREIGN KEY (organizer_id) REFERENCES event_organizers(organizer_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS portal_store_exchanges (
    exchange_id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    nonce TEXT NOT NULL,
    qr_issued_at TEXT,
    qr_expires_at TEXT NOT NULL,
    used_points INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (service_id, user_id, nonce),
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
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
  ['events', 'event_end_datetime', 'TEXT'],
  ['events', 'description', 'TEXT'],
  ['events', 'activity', 'TEXT'],
  ['events', 'notes', 'TEXT'],
  ['stores', 'login_code', 'TEXT'],
  ['stores', 'login_password', 'TEXT'],
  ['stores', 'store_address', 'TEXT'],
  ['stores', 'map_query', 'TEXT'],
  ['stores', 'contact_email', 'TEXT'],
  ['stores', 'status', "TEXT NOT NULL DEFAULT 'active'"],
  ['services', 'category_id', 'TEXT'],
  ['services', 'description', 'TEXT'],
  ['services', 'status', "TEXT NOT NULL DEFAULT 'active'"],
  ['participations', 'status', 'TEXT'],
  ['participations', 'grant_points_snapshot', 'INTEGER'],
  ['participations', 'applied_at', 'TEXT'],
  ['participations', 'checked_in_at', 'TEXT'],
  ['participations', 'completed_at', 'TEXT'],
  ['participations', 'cancelled_at', 'TEXT'],
  ['participations', 'completion_method', 'TEXT'],
  ['participations', 'completion_note', 'TEXT'],
  ['participations', 'completed_by_admin_id', 'TEXT'],
  ['point_transactions', 'participation_id', 'INTEGER']
];

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureEventLifecycleSchema(db) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'events'").get();
  if (!table?.sql || table.sql.includes("'completed'")) {
    return;
  }

  const columns = db.prepare('PRAGMA table_info(events)').all();
  const hasEndDate = columns.some((column) => column.name === 'event_end_datetime');
  db.pragma('foreign_keys = OFF');
  try {
    db.prepare(
      `CREATE TABLE events_lifecycle_migration (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT NOT NULL,
        event_datetime TEXT NOT NULL,
        event_end_datetime TEXT,
        location TEXT,
        grant_points INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed', 'cancelled')),
        description TEXT,
        activity TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    ).run();
    db.prepare(
      `INSERT INTO events_lifecycle_migration
        (event_id, event_name, event_datetime, event_end_datetime, location, grant_points, status,
         description, activity, notes, created_at)
       SELECT event_id, event_name, event_datetime, ${hasEndDate ? 'event_end_datetime' : 'NULL'}, location,
              grant_points, status, description, activity, notes, created_at
       FROM events`
    ).run();
    db.prepare('DROP TABLE events').run();
    db.prepare('ALTER TABLE events_lifecycle_migration RENAME TO events').run();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function applySchema(db) {
  ensureEventLifecycleSchema(db);

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

  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_event_organizers_login_code ON event_organizers(login_code)').run();
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_login_code ON stores(login_code) WHERE login_code IS NOT NULL').run();
  db.prepare(
    `UPDATE participations
     SET status = COALESCE(status, 'completed'),
         grant_points_snapshot = COALESCE(grant_points_snapshot, granted_points),
         applied_at = COALESCE(applied_at, participated_at),
         completed_at = COALESCE(completed_at, participated_at),
         completion_method = COALESCE(completion_method, 'legacy')
     WHERE status IS NULL OR grant_points_snapshot IS NULL OR applied_at IS NULL`
  ).run();
  db.prepare(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_participation ON point_transactions(participation_id) WHERE participation_id IS NOT NULL'
  ).run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_participations_event_status ON participations(event_id, status)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_event_submissions_status ON event_submissions(status, created_at)').run();
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

function ensurePartnerPortalDemoData(db) {
  db.prepare(
    `INSERT INTO service_categories (category_id, category_name)
     VALUES ('category-food', '商店街の人気商品')
     ON CONFLICT(category_id) DO UPDATE SET category_name = excluded.category_name, updated_at = CURRENT_TIMESTAMP`
  ).run();
  db.prepare(
    `INSERT INTO service_categories (category_id, category_name)
     VALUES ('category-life', '生活応援商品')
     ON CONFLICT(category_id) DO UPDATE SET category_name = excluded.category_name, updated_at = CURRENT_TIMESTAMP`
  ).run();

  const eventDetails = [
    [
      '地域清掃ボランティア',
      '地域の歩道と広場を清掃し、来街者が歩きやすい環境を整えます。',
      'ごみ拾い、落ち葉の回収、掲示板周辺の拭き掃除を担当します。',
      '軍手とごみ袋は主催者が用意します。'
    ],
    [
      '見守りパトロール',
      '駅前商店街を巡回し、住民と来街者に声かけを行います。',
      '巡回、案内、困りごとの聞き取りを担当します。',
      '集合時に当日の巡回ルートを共有します。'
    ],
    [
      '子ども食堂サポート',
      '子ども食堂の会場準備と配膳を支援します。',
      '受付、配膳、片付け、見守り補助を行います。',
      '衛生管理のため、マスク着用をお願いします。'
    ]
  ];
  const updateEvent = db.prepare(
    `UPDATE events
     SET description = COALESCE(NULLIF(description, ''), ?),
         activity = COALESCE(NULLIF(activity, ''), ?),
         notes = COALESCE(NULLIF(notes, ''), ?)
     WHERE event_name = ?`
  );
  eventDetails.forEach(([eventName, description, activity, notes]) => updateEvent.run(description, activity, notes, eventName));

  const organizerWithDemoCode = db.prepare('SELECT organizer_id FROM event_organizers WHERE login_code = ?').get('event-demo');
  const demoOrganizerId = organizerWithDemoCode?.organizer_id || 'org-demo';
  db.prepare(
    `INSERT INTO event_organizers (organizer_id, login_code, login_password, organizer_name, contact_email)
     VALUES (?, 'event-demo', 'event-demo-pass', 'LinkTwon地域活動事務局', 'event@example.com')
     ON CONFLICT(organizer_id) DO UPDATE SET
       login_password = excluded.login_password,
       organizer_name = excluded.organizer_name,
       contact_email = excluded.contact_email,
       updated_at = CURRENT_TIMESTAMP`
  ).run(demoOrganizerId);

  const assignEvent = db.prepare(
    `INSERT OR IGNORE INTO event_organizer_events (organizer_id, event_id)
     VALUES (?, ?)`
  );
  db.prepare("SELECT event_id FROM events WHERE status = 'active' ORDER BY event_id ASC")
    .all()
    .forEach((event) => assignEvent.run(demoOrganizerId, event.event_id));

  const demoStore =
    db.prepare('SELECT store_id FROM stores WHERE login_code = ?').get('store-demo') ||
    db.prepare("SELECT store_id FROM stores WHERE store_name = '地域マルシェ'").get() ||
    db.prepare('SELECT store_id FROM stores ORDER BY store_id ASC LIMIT 1').get();

  if (demoStore) {
    db.prepare(
      `UPDATE stores
       SET login_code = 'store-demo',
           login_password = 'store-demo-pass',
           store_address = COALESCE(NULLIF(store_address, ''), '東京都千代田区日比谷公園'),
           map_query = COALESCE(NULLIF(map_query, ''), store_name || ' 東京都千代田区日比谷公園'),
           contact_email = COALESCE(NULLIF(contact_email, ''), 'store@example.com')
       WHERE store_id = ?`
    ).run(demoStore.store_id);
  }

  const serviceDetails = [
    ['コーヒー無料券', 'category-food', '商店街の協力店舗が用意するコーヒー交換券です。'],
    ['ケーキセット割引', 'category-food', '店内で使えるケーキセットの割引商品です。'],
    ['焼きたてパン引換券', 'category-food', '焼きたてパンと交換できる商品です。'],
    ['野菜セット引換券', 'category-life', '地域で仕入れた旬の野菜を少量ずつ詰め合わせた交換商品です。']
  ];
  const updateService = db.prepare(
    `UPDATE services
     SET category_id = ?,
         description = COALESCE(NULLIF(description, ''), ?)
     WHERE service_name = ?`
  );
  serviceDetails.forEach(([serviceName, categoryId, description]) => updateService.run(categoryId, description, serviceName));
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
  ensurePartnerPortalDemoData(db);

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
