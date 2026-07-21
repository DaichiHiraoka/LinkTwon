const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { env } = require('../config/env');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT_DIR, '..');
const DEFAULT_DB_PATH = path.join(REPO_ROOT, 'backend', 'database', 'dev.sqlite');
const DEFAULT_SEED_PATH = path.join(ROOT_DIR, 'data', 'partner-data.json');
const DEFAULT_CATEGORY_ID = 'default';
const DEFAULT_CATEGORY_NAME = '一般';

let mysql;
let mysqlPool;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    age_group TEXT,
    user_type TEXT DEFAULT 'general',
    email_verified_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS event_organizers (
    organizer_id TEXT PRIMARY KEY,
    login_code TEXT NOT NULL,
    login_password TEXT NOT NULL,
    organizer_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS service_categories (
    category_id TEXT PRIMARY KEY,
    category_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    event_datetime TEXT NOT NULL,
    event_end_datetime TEXT,
    location TEXT,
    grant_points INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    description TEXT,
    activity TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stores (
    store_id INTEGER PRIMARY KEY AUTOINCREMENT,
    login_code TEXT,
    login_password TEXT,
    store_name TEXT NOT NULL,
    store_address TEXT,
    map_query TEXT,
    contact_email TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    service_id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id INTEGER NOT NULL,
    category_id TEXT,
    service_name TEXT NOT NULL,
    description TEXT,
    required_points INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES service_categories(category_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS participations (
    participation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'applied',
    grant_points_snapshot INTEGER NOT NULL DEFAULT 0,
    granted_points INTEGER NOT NULL DEFAULT 0,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
    checked_in_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT,
    completion_method TEXT,
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
    type TEXT NOT NULL,
    points INTEGER NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE SET NULL,
    FOREIGN KEY (participation_id) REFERENCES participations(participation_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS event_organizer_events (
    organizer_id TEXT NOT NULL,
    event_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organizer_id, event_id),
    FOREIGN KEY (organizer_id) REFERENCES event_organizers(organizer_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (service_id, user_id, nonce),
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
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
    status TEXT NOT NULL DEFAULT 'pending',
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
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participation_id) REFERENCES participations(participation_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS event_attendance_scans (
    scan_id INTEGER PRIMARY KEY AUTOINCREMENT,
    participation_id INTEGER NOT NULL,
    organizer_id TEXT NOT NULL,
    scan_type TEXT NOT NULL,
    nonce TEXT NOT NULL UNIQUE,
    qr_issued_at TEXT,
    qr_expires_at TEXT NOT NULL,
    processed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (participation_id, scan_type),
    FOREIGN KEY (participation_id) REFERENCES participations(participation_id) ON DELETE CASCADE,
    FOREIGN KEY (organizer_id) REFERENCES event_organizers(organizer_id) ON DELETE CASCADE
  )`
];

const columnMigrations = [
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

const indexStatements = [
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_event_organizers_login_code ON event_organizers(login_code)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_login_code ON stores(login_code) WHERE login_code IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS idx_event_organizer_events_event_id ON event_organizer_events(event_id)',
  'CREATE INDEX IF NOT EXISTS idx_portal_event_check_ins_user_id ON portal_event_check_ins(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_portal_store_exchanges_user_id ON portal_store_exchanges(user_id)'
  ,'CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_participation ON point_transactions(participation_id) WHERE participation_id IS NOT NULL'
  ,'CREATE INDEX IF NOT EXISTS idx_event_submissions_status ON event_submissions(status, created_at)'
];

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function resolveDbPath(filePath = env.PARTNER_SQLITE_PATH || env.PARTNER_DB_PATH || DEFAULT_DB_PATH) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  const normalized = filePath.replace(/\\/g, '/');
  if (normalized === 'backend' || normalized.startsWith('backend/') || normalized.startsWith('partner-portals/')) {
    return path.resolve(REPO_ROOT, filePath);
  }

  return path.resolve(ROOT_DIR, filePath);
}

function readSeedData(seedPath = DEFAULT_SEED_PATH) {
  return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
}

function applySchema(db) {
  for (const statement of schemaStatements) {
    db.prepare(statement).run();
  }

  for (const [tableName, columnName, definition] of columnMigrations) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (!columns.some((column) => column.name === columnName)) {
      db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
    }
  }

  for (const statement of indexStatements) {
    db.prepare(statement).run();
  }
  db.prepare(
    `UPDATE participations
     SET status = COALESCE(status, 'completed'),
         grant_points_snapshot = COALESCE(grant_points_snapshot, granted_points),
         applied_at = COALESCE(applied_at, participated_at),
         completed_at = COALESCE(completed_at, participated_at),
         completion_method = COALESCE(completion_method, 'legacy')
     WHERE status IS NULL OR grant_points_snapshot IS NULL OR applied_at IS NULL`
  ).run();
}

function getOrCreateEvent(db, event) {
  const existing = db.prepare('SELECT event_id FROM events WHERE event_name = ?').get(event.event_name);
  if (existing) {
    db.prepare(
      `UPDATE events
       SET event_datetime = ?, location = ?, grant_points = ?, status = 'active',
           description = ?, activity = ?, notes = ?
       WHERE event_id = ?`
    ).run(
      event.event_datetime,
      event.location,
      Number(event.grant_points || 0),
      event.description || '',
      event.activity || '',
      event.notes || '',
      existing.event_id
    );
    return existing.event_id;
  }

  const result = db.prepare(
    `INSERT INTO events (event_name, event_datetime, location, grant_points, status, description, activity, notes)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
  ).run(
    event.event_name,
    event.event_datetime,
    event.location,
    Number(event.grant_points || 0),
    event.description || '',
    event.activity || '',
    event.notes || ''
  );
  return Number(result.lastInsertRowid);
}

function getOrCreateStore(db, store) {
  const existing = db.prepare('SELECT store_id FROM stores WHERE store_name = ?').get(store.store_name);
  if (existing) {
    db.prepare(
      `UPDATE stores
       SET login_code = ?, login_password = ?, store_address = ?, map_query = ?,
           contact_email = ?, status = 'active'
       WHERE store_id = ?`
    ).run(
      store.login_code,
      store.login_password,
      store.store_address || '',
      store.map_query || store.store_name,
      store.contact_email || '',
      existing.store_id
    );
    return existing.store_id;
  }

  const result = db.prepare(
    `INSERT INTO stores
      (login_code, login_password, store_name, store_address, map_query, contact_email, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`
  ).run(
    store.login_code,
    store.login_password,
    store.store_name,
    store.store_address || '',
    store.map_query || store.store_name,
    store.contact_email || ''
  );
  return Number(result.lastInsertRowid);
}

function seedDatabase(db, seedPath) {
  const data = readSeedData(seedPath);
  const seed = db.transaction(() => {
    const demoUser = db.prepare('SELECT user_id FROM users WHERE user_id = 1').get();
    if (!demoUser) {
      db.prepare(
        `INSERT INTO users (user_id, name, email, password, points, age_group, user_type, email_verified_at)
         VALUES (1, 'Demo User', 'demo@example.com', 'demo-password-placeholder', 300, '30s', 'general', CURRENT_TIMESTAMP)`
      ).run();
    }

    const eventIdBySeedId = new Map();
    for (const event of data.events || []) {
      eventIdBySeedId.set(event.event_id, getOrCreateEvent(db, event));
    }

    const storeIdBySeedId = new Map();
    for (const store of data.stores || []) {
      storeIdBySeedId.set(store.store_id, getOrCreateStore(db, store));
    }

    const upsertCategory = db.prepare(
      `INSERT INTO service_categories (category_id, category_name)
       VALUES (?, ?)
       ON CONFLICT(category_id) DO UPDATE SET category_name = excluded.category_name, updated_at = CURRENT_TIMESTAMP`
    );
    for (const category of data.serviceCategories || []) {
      upsertCategory.run(category.category_id, category.category_name);
    }

    for (const service of data.services || []) {
      const storeId = storeIdBySeedId.get(service.store_id);
      if (!storeId) {
        continue;
      }

      const existing = db
        .prepare('SELECT service_id FROM services WHERE store_id = ? AND service_name = ?')
        .get(storeId, service.service_name);
      if (existing) {
        db.prepare(
          `UPDATE services
           SET category_id = ?, description = ?, required_points = ?, status = 'active'
           WHERE service_id = ?`
        ).run(service.category_id || null, service.description || '', Number(service.required_points || 0), existing.service_id);
      } else {
        db.prepare(
          `INSERT INTO services (store_id, category_id, service_name, description, required_points, status)
           VALUES (?, ?, ?, ?, ?, 'active')`
        ).run(storeId, service.category_id || null, service.service_name, service.description || '', Number(service.required_points || 0));
      }
    }

    const upsertOrganizer = db.prepare(
      `INSERT INTO event_organizers
        (organizer_id, login_code, login_password, organizer_name, contact_email)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(organizer_id) DO UPDATE SET
         login_code = excluded.login_code,
         login_password = excluded.login_password,
         organizer_name = excluded.organizer_name,
         contact_email = excluded.contact_email,
         updated_at = CURRENT_TIMESTAMP`
    );
    const upsertAssignment = db.prepare(
      `INSERT OR IGNORE INTO event_organizer_events (organizer_id, event_id)
       VALUES (?, ?)`
    );

    for (const organizer of data.eventOrganizers || []) {
      upsertOrganizer.run(
        organizer.organizer_id,
        organizer.login_code,
        organizer.login_password,
        organizer.organizer_name,
        organizer.contact_email
      );
      for (const seedEventId of organizer.event_ids || []) {
        const eventId = eventIdBySeedId.get(seedEventId);
        if (eventId) {
          upsertAssignment.run(organizer.organizer_id, eventId);
        }
      }
    }
  });

  seed();
}

function openDatabase(options = {}) {
  const dbPath = resolveDbPath(options.dbPath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  applySchema(db);
  if (options.seedDemoData || env.PARTNER_SEED_DEMO_DATA) {
    seedDatabase(db, options.seedPath || DEFAULT_SEED_PATH);
  }
  return db;
}

function getDbClient(options = {}) {
  if (options.dbClient) {
    return options.dbClient;
  }
  if (options.dbPath) {
    return 'sqlite';
  }
  return env.PARTNER_DB_CLIENT;
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
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: safeDecode(parsed.username || ''),
    password: safeDecode(parsed.password || ''),
    database: safeDecode(parsed.pathname.replace(/^\//, '')) || env.PARTNER_DB_NAME,
    ssl: getSslOptions(parsed.searchParams)
  };
}

function getMysqlPool() {
  if (!mysqlPool) {
    if (!mysql) {
      mysql = require('mysql2/promise');
    }
    const config = env.PARTNER_DATABASE_URL
      ? getMysqlConfigFromUrl(env.PARTNER_DATABASE_URL)
      : {
          host: env.PARTNER_DB_HOST,
          port: env.PARTNER_DB_PORT,
          user: env.PARTNER_DB_USER,
          password: env.PARTNER_DB_PASSWORD,
          database: env.PARTNER_DB_NAME,
          ssl: getSslOptions()
        };

    mysqlPool = mysql.createPool({
      ...config,
      dateStrings: true,
      waitForConnections: true,
      connectionLimit: env.PARTNER_DB_CONNECTION_LIMIT,
      queueLimit: 0
    });
  }

  return mysqlPool;
}

function asId(value) {
  return value === null || value === undefined ? '' : String(value);
}

function asOptionalString(value) {
  return value === null || value === undefined ? '' : String(value);
}

function asDateTime(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return asOptionalString(value);
}

function mapOrganizer(row, eventIdsByOrganizer) {
  return {
    organizer_id: asId(row.organizer_id),
    login_code: asOptionalString(row.login_code),
    login_password: asOptionalString(row.login_password),
    organizer_name: asOptionalString(row.organizer_name),
    contact_email: asOptionalString(row.contact_email),
    event_ids: eventIdsByOrganizer.get(asId(row.organizer_id)) || []
  };
}

function mapStore(row, serviceIdsByStore) {
  return {
    store_id: asId(row.store_id),
    login_code: asOptionalString(row.login_code),
    login_password: asOptionalString(row.login_password),
    store_name: asOptionalString(row.store_name),
    store_address: asOptionalString(row.store_address),
    map_query: asOptionalString(row.map_query || row.store_name),
    contact_email: asOptionalString(row.contact_email),
    service_ids: serviceIdsByStore.get(asId(row.store_id)) || []
  };
}

function mapEvent(row) {
  return {
    event_id: asId(row.event_id),
    event_name: asOptionalString(row.event_name),
    event_datetime: asDateTime(row.event_datetime),
    event_end_datetime: row.event_end_datetime ? asDateTime(row.event_end_datetime) : null,
    location: asOptionalString(row.location),
    grant_points: Number(row.grant_points || 0),
    description: asOptionalString(row.description),
    activity: asOptionalString(row.activity),
    notes: asOptionalString(row.notes),
    status: asOptionalString(row.status || 'active'),
    application_count: Number(row.application_count || 0),
    checked_in_count: Number(row.checked_in_count || 0),
    completed_count: Number(row.completed_count || 0),
    incomplete_count: Number(row.incomplete_count || 0)
  };
}

function mapService(row) {
  return {
    service_id: asId(row.service_id),
    store_id: asId(row.store_id),
    category_id: asOptionalString(row.category_id || DEFAULT_CATEGORY_ID),
    category_name: asOptionalString(row.category_name || DEFAULT_CATEGORY_NAME),
    service_name: asOptionalString(row.service_name),
    description: asOptionalString(row.description),
    required_points: Number(row.required_points || 0)
  };
}

function buildPartnerData({ organizers, assignments, stores, events, categories, services, submissions = [] }) {
  const eventIdsByOrganizer = new Map();
  for (const assignment of assignments) {
    const organizerId = asId(assignment.organizer_id);
    const eventId = asId(assignment.event_id);
    if (!eventIdsByOrganizer.has(organizerId)) {
      eventIdsByOrganizer.set(organizerId, []);
    }
    eventIdsByOrganizer.get(organizerId).push(eventId);
  }

  const serviceIdsByStore = new Map();
  for (const service of services) {
    const storeId = asId(service.store_id);
    if (!serviceIdsByStore.has(storeId)) {
      serviceIdsByStore.set(storeId, []);
    }
    serviceIdsByStore.get(storeId).push(asId(service.service_id));
  }

  const mappedServices = services.map(mapService);
  const mappedCategories = categories.map((category) => ({
    category_id: asId(category.category_id),
    category_name: asOptionalString(category.category_name)
  }));

  if (mappedServices.some((service) => service.category_id === DEFAULT_CATEGORY_ID)) {
    mappedCategories.push({
      category_id: DEFAULT_CATEGORY_ID,
      category_name: DEFAULT_CATEGORY_NAME
    });
  }

  return {
    eventOrganizers: organizers.map((organizer) => mapOrganizer(organizer, eventIdsByOrganizer)),
    stores: stores.map((store) => mapStore(store, serviceIdsByStore)),
    events: events.map(mapEvent),
    serviceCategories: mappedCategories,
    services: mappedServices,
    eventSubmissions: submissions
  };
}

function readSqlitePartnerData(options = {}) {
  const db = openDatabase(options);

  try {
    const organizers = db
      .prepare(
        `SELECT organizer_id, login_code, login_password, organizer_name, contact_email
         FROM event_organizers
         ORDER BY organizer_id ASC`
      )
      .all();
    const assignments = db
      .prepare(
        `SELECT organizer_id, event_id
         FROM event_organizer_events
         ORDER BY organizer_id ASC, event_id ASC`
      )
      .all();
    const stores = db
      .prepare(
        `SELECT store_id, login_code, login_password, store_name,
                COALESCE(store_address, '') AS store_address,
                COALESCE(map_query, store_name) AS map_query,
                COALESCE(contact_email, '') AS contact_email
         FROM stores
         WHERE login_code IS NOT NULL
           AND login_code <> ''
           AND COALESCE(status, 'active') = 'active'
         ORDER BY store_id ASC`
      )
      .all();
    const events = db
      .prepare(
        `SELECT e.event_id, e.event_name, e.event_datetime, e.event_end_datetime, e.location, e.grant_points,
                COALESCE(description, '') AS description,
                COALESCE(activity, '') AS activity,
                COALESCE(notes, '') AS notes, e.status,
                SUM(CASE WHEN p.status IN ('applied','checked_in','completed','absent','incomplete') THEN 1 ELSE 0 END) AS application_count,
                SUM(CASE WHEN p.status IN ('checked_in','completed','incomplete') THEN 1 ELSE 0 END) AS checked_in_count,
                SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
                SUM(CASE WHEN p.status = 'incomplete' THEN 1 ELSE 0 END) AS incomplete_count
         FROM events e
         LEFT JOIN participations p ON e.event_id = p.event_id
         WHERE COALESCE(e.status, 'active') IN ('active', 'paused')
         GROUP BY e.event_id
         ORDER BY e.event_datetime DESC, e.event_id DESC`
      )
      .all();
    const submissions = db.prepare('SELECT * FROM event_submissions ORDER BY created_at DESC').all();
    const categories = db.prepare('SELECT category_id, category_name FROM service_categories ORDER BY category_id ASC').all();
    const services = db
      .prepare(
        `SELECT s.service_id, s.store_id, COALESCE(s.category_id, ?) AS category_id,
                COALESCE(sc.category_name, ?) AS category_name,
                s.service_name, COALESCE(s.description, '') AS description, s.required_points
         FROM services s
         JOIN stores st ON s.store_id = st.store_id
         LEFT JOIN service_categories sc ON s.category_id = sc.category_id
         WHERE COALESCE(s.status, 'active') = 'active'
           AND COALESCE(st.status, 'active') = 'active'
         ORDER BY s.service_id ASC`
      )
      .all(DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME);

    return buildPartnerData({ organizers, assignments, stores, events, categories, services, submissions });
  } finally {
    db.close();
  }
}

async function readMysqlPartnerData() {
  const pool = await getMysqlPool();
  const [organizers] = await pool.query(
    `SELECT organizer_id, login_code, login_password, organizer_name, contact_email
     FROM event_organizers
     ORDER BY organizer_id ASC`
  );
  const [assignments] = await pool.query(
    `SELECT organizer_id, event_id
     FROM event_organizer_events
     ORDER BY organizer_id ASC, event_id ASC`
  );
  const [stores] = await pool.query(
    `SELECT store_id, login_code, login_password, store_name,
            COALESCE(store_address, '') AS store_address,
            COALESCE(map_query, store_name) AS map_query,
            COALESCE(contact_email, '') AS contact_email
     FROM stores
     WHERE login_code IS NOT NULL
       AND login_code <> ''
       AND COALESCE(status, 'active') = 'active'
     ORDER BY store_id ASC`
  );
  const [events] = await pool.query(
    `SELECT e.event_id, e.event_name, e.event_datetime, e.event_end_datetime, e.location, e.grant_points,
            COALESCE(description, '') AS description,
            COALESCE(activity, '') AS activity,
            COALESCE(notes, '') AS notes, e.status,
            SUM(CASE WHEN p.status IN ('applied','checked_in','completed','absent','incomplete') THEN 1 ELSE 0 END) AS application_count,
            SUM(CASE WHEN p.status IN ('checked_in','completed','incomplete') THEN 1 ELSE 0 END) AS checked_in_count,
            SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
            SUM(CASE WHEN p.status = 'incomplete' THEN 1 ELSE 0 END) AS incomplete_count
     FROM events e
     LEFT JOIN participations p ON e.event_id = p.event_id
     WHERE COALESCE(e.status, 'active') IN ('active', 'paused')
     GROUP BY e.event_id
     ORDER BY e.event_datetime DESC, e.event_id DESC`
  );
  const [submissions] = await pool.query('SELECT * FROM event_submissions ORDER BY created_at DESC');
  const [categories] = await pool.query('SELECT category_id, category_name FROM service_categories ORDER BY category_id ASC');
  const [services] = await pool.query(
    `SELECT s.service_id, s.store_id, COALESCE(s.category_id, ?) AS category_id,
            COALESCE(sc.category_name, ?) AS category_name,
            s.service_name, COALESCE(s.description, '') AS description, s.required_points
     FROM services s
     JOIN stores st ON s.store_id = st.store_id
     LEFT JOIN service_categories sc ON s.category_id = sc.category_id
     WHERE COALESCE(s.status, 'active') = 'active'
       AND COALESCE(st.status, 'active') = 'active'
     ORDER BY s.service_id ASC`,
    [DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME]
  );

  return buildPartnerData({ organizers, assignments, stores, events, categories, services, submissions });
}

async function readPartnerData(options = {}) {
  if (getDbClient(options) === 'mysql') {
    return readMysqlPartnerData(options);
  }

  return readSqlitePartnerData(options);
}

function recordSqliteStoreExchange({ store, service, user }, options = {}) {
  const db = openDatabase(options);

  try {
    const write = db.transaction(() => {
      const duplicate = db
        .prepare('SELECT exchange_id FROM portal_store_exchanges WHERE service_id = ? AND user_id = ? AND nonce = ?')
        .get(service.service_id, user.user_id, user.nonce);
      if (duplicate) {
        return { duplicate: true };
      }

      const dbUser = db.prepare('SELECT user_id, name, points FROM users WHERE user_id = ?').get(user.user_id);
      if (!dbUser) {
        return { userNotFound: true };
      }
      if (Number(dbUser.points || 0) < Number(service.required_points || 0)) {
        return { notEnoughPoints: true, current_points: Number(dbUser.points || 0) };
      }

      db.prepare('UPDATE users SET points = points - ? WHERE user_id = ?').run(service.required_points, user.user_id);
      db.prepare(
        `INSERT INTO point_transactions (user_id, service_id, type, points, description)
         VALUES (?, ?, 'exchange', ?, ?)`
      ).run(
        user.user_id,
        service.service_id,
        service.required_points,
        `Exchanged points for ${service.service_name} at ${store.store_name}`
      );
      const result = db.prepare(
        `INSERT INTO portal_store_exchanges
          (store_id, service_id, user_id, user_name, nonce, qr_issued_at, qr_expires_at, used_points)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        store.store_id,
        service.service_id,
        user.user_id,
        user.name,
        user.nonce,
        user.issued_at,
        user.expires_at,
        service.required_points
      );

      return {
        duplicate: false,
        id: Number(result.lastInsertRowid),
        current_points: Number(dbUser.points || 0) - Number(service.required_points || 0)
      };
    });

    return write();
  } finally {
    db.close();
  }
}

async function withMysqlTransaction(callback) {
  const pool = await getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function recordMysqlStoreExchange({ store, service, user }) {
  return withMysqlTransaction(async (connection) => {
    const [duplicates] = await connection.query(
      'SELECT exchange_id FROM portal_store_exchanges WHERE service_id = ? AND user_id = ? AND nonce = ?',
      [service.service_id, user.user_id, user.nonce]
    );
    if (duplicates.length > 0) {
      return { duplicate: true };
    }

    const [users] = await connection.query('SELECT user_id, name, points FROM users WHERE user_id = ? FOR UPDATE', [user.user_id]);
    if (users.length === 0) {
      return { userNotFound: true };
    }
    if (Number(users[0].points || 0) < Number(service.required_points || 0)) {
      return { notEnoughPoints: true, current_points: Number(users[0].points || 0) };
    }

    await connection.query('UPDATE users SET points = points - ? WHERE user_id = ?', [service.required_points, user.user_id]);
    await connection.query(
      `INSERT INTO point_transactions (user_id, service_id, type, points, description)
       VALUES (?, ?, 'exchange', ?, ?)`,
      [
        user.user_id,
        service.service_id,
        service.required_points,
        `Exchanged points for ${service.service_name} at ${store.store_name}`
      ]
    );
    const [result] = await connection.query(
      `INSERT INTO portal_store_exchanges
        (store_id, service_id, user_id, user_name, nonce, qr_issued_at, qr_expires_at, used_points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        store.store_id,
        service.service_id,
        user.user_id,
        user.name,
        user.nonce,
        user.issued_at,
        user.expires_at,
        service.required_points
      ]
    );

    return {
      duplicate: false,
      id: result.insertId,
      current_points: Number(users[0].points || 0) - Number(service.required_points || 0)
    };
  });
}

function verifySqliteEventApplication({ event, user, scanType = 'check_in' }, options = {}) {
  const db = openDatabase(options);
  try {
    const dbEvent = db.prepare('SELECT event_id, status FROM events WHERE event_id = ?').get(event.event_id);
    if (!dbEvent || !['active', 'paused'].includes(dbEvent.status)) {
      return { eventClosed: true };
    }

    const dbUser = db.prepare('SELECT user_id, name FROM users WHERE user_id = ?').get(user.user_id);
    if (!dbUser) {
      return { userNotFound: true };
    }

    const participation = db
      .prepare('SELECT participation_id, status FROM participations WHERE event_id = ? AND user_id = ?')
      .get(event.event_id, user.user_id);
    const expectedStatus = scanType === 'completion' ? 'checked_in' : 'applied';
    if (!participation || participation.status !== expectedStatus) {
      return {
        notEligible: true,
        expected_status: expectedStatus,
        participation_status: participation?.status ?? null
      };
    }

    return {
      eligible: true,
      participation_id: participation.participation_id,
      participation_status: participation.status,
      user_name: dbUser.name
    };
  } finally {
    db.close();
  }
}

async function verifyMysqlEventApplication({ event, user, scanType = 'check_in' }) {
  const pool = getMysqlPool();
  const [events] = await pool.query('SELECT event_id, status FROM events WHERE event_id = ?', [event.event_id]);
  if (events.length === 0 || !['active', 'paused'].includes(events[0].status)) {
    return { eventClosed: true };
  }

  const [users] = await pool.query('SELECT user_id, name FROM users WHERE user_id = ?', [user.user_id]);
  if (users.length === 0) {
    return { userNotFound: true };
  }

  const [participations] = await pool.query(
    'SELECT participation_id, status FROM participations WHERE event_id = ? AND user_id = ?',
    [event.event_id, user.user_id]
  );
  const expectedStatus = scanType === 'completion' ? 'checked_in' : 'applied';
  if (participations.length === 0 || participations[0].status !== expectedStatus) {
    return {
      notEligible: true,
      expected_status: expectedStatus,
      participation_status: participations[0]?.status ?? null
    };
  }

  return {
    eligible: true,
    participation_id: participations[0].participation_id,
    participation_status: participations[0].status,
    user_name: users[0].name
  };
}

async function verifyEventApplication(payload, options = {}) {
  if (getDbClient(options) === 'mysql') {
    return verifyMysqlEventApplication(payload);
  }

  return verifySqliteEventApplication(payload, options);
}

function recordSqliteEventAttendance({ organizer, event, user }, scanType, options = {}) {
  const db = openDatabase(options);
  try {
    return db.transaction(() => {
      const dbEvent = db
        .prepare('SELECT event_id, event_name, event_end_datetime, status FROM events WHERE event_id = ?')
        .get(event.event_id);
      if (!dbEvent || !['active', 'paused'].includes(dbEvent.status)) {
        return { eventClosed: true };
      }
      const dbUser = db.prepare('SELECT user_id, name, points FROM users WHERE user_id = ?').get(user.user_id);
      if (!dbUser) {
        return { userNotFound: true };
      }
      if (db.prepare('SELECT scan_id FROM event_attendance_scans WHERE nonce = ?').get(user.nonce)) {
        return { duplicate: true };
      }
      const participation = db
        .prepare(
          `SELECT participation_id, user_id, status, grant_points_snapshot, granted_points
           FROM participations WHERE event_id = ? AND user_id = ?`
        )
        .get(event.event_id, user.user_id);
      if (!participation) {
        return { notApplied: true };
      }

      const expectedStatus = scanType === 'check_in' ? 'applied' : 'checked_in';
      if (participation.status !== expectedStatus) {
        return { invalidStatus: true, participation_status: participation.status };
      }
      if (
        scanType === 'completion' &&
        (!dbEvent.event_end_datetime || Date.now() < new Date(dbEvent.event_end_datetime).getTime())
      ) {
        return { tooEarly: true, event_end_datetime: dbEvent.event_end_datetime };
      }

      if (scanType === 'check_in') {
        db.prepare(
          "UPDATE participations SET status = 'checked_in', checked_in_at = CURRENT_TIMESTAMP WHERE participation_id = ?"
        ).run(participation.participation_id);
      } else {
        const points = Number(participation.grant_points_snapshot || 0);
        db.prepare(
          `UPDATE participations
           SET status = 'completed', granted_points = ?, completed_at = CURRENT_TIMESTAMP,
               completion_method = 'qr'
           WHERE participation_id = ?`
        ).run(points, participation.participation_id);
        db.prepare('UPDATE users SET points = points + ? WHERE user_id = ?').run(points, user.user_id);
        db.prepare(
          `INSERT INTO point_transactions
             (user_id, participation_id, type, points, description)
           VALUES (?, ?, 'grant', ?, ?)`
        ).run(
          user.user_id,
          participation.participation_id,
          points,
          `Points granted for event: ${dbEvent.event_name}`
        );
      }
      const result = db.prepare(
        `INSERT INTO event_attendance_scans
           (participation_id, organizer_id, scan_type, nonce, qr_issued_at, qr_expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        participation.participation_id,
        organizer.organizer_id,
        scanType,
        user.nonce,
        user.issued_at,
        user.expires_at
      );
      db.prepare(
        `INSERT INTO event_participation_status_history
           (participation_id, from_status, to_status, reason, actor_type, actor_id)
         VALUES (?, ?, ?, ?, 'organizer', ?)`
      ).run(
        participation.participation_id,
        expectedStatus,
        scanType === 'check_in' ? 'checked_in' : 'completed',
        scanType === 'check_in' ? 'QR check-in' : 'QR completion',
        organizer.organizer_id
      );

      const grantedPoints =
        scanType === 'completion' ? Number(participation.grant_points_snapshot || 0) : 0;
      return {
        duplicate: false,
        id: Number(result.lastInsertRowid),
        participation_status: scanType === 'check_in' ? 'checked_in' : 'completed',
        granted_points: grantedPoints,
        current_points: Number(dbUser.points || 0) + grantedPoints
      };
    })();
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed')) {
      return { duplicate: true };
    }
    throw error;
  } finally {
    db.close();
  }
}

async function recordMysqlEventAttendance({ organizer, event, user }, scanType) {
  return withMysqlTransaction(async (connection) => {
    const [events] = await connection.query(
      'SELECT event_id, event_name, event_end_datetime, status FROM events WHERE event_id = ? FOR UPDATE',
      [event.event_id]
    );
    if (events.length === 0 || !['active', 'paused'].includes(events[0].status)) {
      return { eventClosed: true };
    }
    const [users] = await connection.query(
      'SELECT user_id, name, points FROM users WHERE user_id = ? FOR UPDATE',
      [user.user_id]
    );
    if (users.length === 0) {
      return { userNotFound: true };
    }
    const [duplicates] = await connection.query(
      'SELECT scan_id FROM event_attendance_scans WHERE nonce = ?',
      [user.nonce]
    );
    if (duplicates.length > 0) {
      return { duplicate: true };
    }
    const [participations] = await connection.query(
      `SELECT participation_id, user_id, status, grant_points_snapshot, granted_points
       FROM participations WHERE event_id = ? AND user_id = ? FOR UPDATE`,
      [event.event_id, user.user_id]
    );
    if (participations.length === 0) {
      return { notApplied: true };
    }
    const participation = participations[0];
    const expectedStatus = scanType === 'check_in' ? 'applied' : 'checked_in';
    if (participation.status !== expectedStatus) {
      return { invalidStatus: true, participation_status: participation.status };
    }
    if (
      scanType === 'completion' &&
      (!events[0].event_end_datetime ||
        Date.now() < new Date(events[0].event_end_datetime).getTime())
    ) {
      return { tooEarly: true, event_end_datetime: events[0].event_end_datetime };
    }
    let grantedPoints = 0;
    if (scanType === 'check_in') {
      await connection.query(
        "UPDATE participations SET status = 'checked_in', checked_in_at = CURRENT_TIMESTAMP WHERE participation_id = ?",
        [participation.participation_id]
      );
    } else {
      grantedPoints = Number(participation.grant_points_snapshot || 0);
      await connection.query(
        `UPDATE participations
         SET status = 'completed', granted_points = ?, completed_at = CURRENT_TIMESTAMP,
             completion_method = 'qr'
         WHERE participation_id = ?`,
        [grantedPoints, participation.participation_id]
      );
      await connection.query('UPDATE users SET points = points + ? WHERE user_id = ?', [
        grantedPoints,
        user.user_id
      ]);
      await connection.query(
        `INSERT INTO point_transactions
           (user_id, participation_id, type, points, description)
         VALUES (?, ?, 'grant', ?, ?)`,
        [
          user.user_id,
          participation.participation_id,
          grantedPoints,
          `Points granted for event: ${events[0].event_name}`
        ]
      );
    }
    const [result] = await connection.query(
      `INSERT INTO event_attendance_scans
         (participation_id, organizer_id, scan_type, nonce, qr_issued_at, qr_expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        participation.participation_id,
        organizer.organizer_id,
        scanType,
        user.nonce,
        user.issued_at,
        user.expires_at
      ]
    );
    await connection.query(
      `INSERT INTO event_participation_status_history
         (participation_id, from_status, to_status, reason, actor_type, actor_id)
       VALUES (?, ?, ?, ?, 'organizer', ?)`,
      [
        participation.participation_id,
        expectedStatus,
        scanType === 'check_in' ? 'checked_in' : 'completed',
        scanType === 'check_in' ? 'QR check-in' : 'QR completion',
        organizer.organizer_id
      ]
    );
    return {
      duplicate: false,
      id: result.insertId,
      participation_status: scanType === 'check_in' ? 'checked_in' : 'completed',
      granted_points: grantedPoints,
      current_points: Number(users[0].points || 0) + grantedPoints
    };
  });
}

async function recordEventCheckIn(payload, options = {}) {
  if (getDbClient(options) === 'mysql') {
    return recordMysqlEventAttendance(payload, 'check_in');
  }

  return recordSqliteEventAttendance(payload, 'check_in', options);
}

async function recordEventCompletion(payload, options = {}) {
  if (getDbClient(options) === 'mysql') {
    return recordMysqlEventAttendance(payload, 'completion');
  }
  return recordSqliteEventAttendance(payload, 'completion', options);
}

function validateSubmissionPayload(data) {
  const normalized = {
    event_name: String(data.event_name || '').trim(),
    event_datetime: String(data.event_datetime || '').trim().replace('T', ' '),
    event_end_datetime: String(data.event_end_datetime || '').trim().replace('T', ' '),
    location: String(data.location || '').trim() || null,
    description: String(data.description || '').trim() || null,
    activity: String(data.activity || '').trim() || null,
    notes: String(data.notes || '').trim() || null,
    requested_grant_points: Number(data.requested_grant_points || 0)
  };
  if (!normalized.event_name || !normalized.event_datetime || !normalized.event_end_datetime) {
    return { error: 'Event name, start datetime and end datetime are required.' };
  }
  if (
    !Number.isFinite(normalized.requested_grant_points) ||
    normalized.requested_grant_points < 0
  ) {
    return { error: 'Requested points must be zero or greater.' };
  }
  if (new Date(normalized.event_end_datetime) <= new Date(normalized.event_datetime)) {
    return { error: 'Event end datetime must be after the start datetime.' };
  }
  return { value: normalized };
}

function saveSqliteEventSubmission({ organizer, submissionId, action, data }, options = {}) {
  const db = openDatabase(options);
  try {
    return db.transaction(() => {
      if (action === 'create') {
        const validated = validateSubmissionPayload(data);
        if (validated.error) return validated;
        const value = validated.value;
        const result = db.prepare(
          `INSERT INTO event_submissions
             (organizer_id, event_name, event_datetime, event_end_datetime, location,
              description, activity, notes, requested_grant_points, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
        ).run(
          organizer.organizer_id,
          value.event_name,
          value.event_datetime,
          value.event_end_datetime,
          value.location,
          value.description,
          value.activity,
          value.notes,
          value.requested_grant_points
        );
        return { submission_id: Number(result.lastInsertRowid), status: 'pending' };
      }
      const current = db
        .prepare('SELECT * FROM event_submissions WHERE submission_id = ? AND organizer_id = ?')
        .get(submissionId, organizer.organizer_id);
      if (!current) return { notFound: true };
      if (action === 'withdraw') {
        if (current.status !== 'pending') return { conflict: true };
        db.prepare(
          "UPDATE event_submissions SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP WHERE submission_id = ?"
        ).run(submissionId);
        return { submission_id: Number(submissionId), status: 'withdrawn' };
      }
      if (!['pending', 'rejected'].includes(current.status)) return { conflict: true };
      const validated = validateSubmissionPayload({ ...current, ...data });
      if (validated.error) return validated;
      const value = validated.value;
      db.prepare(
        `UPDATE event_submissions
         SET event_name = ?, event_datetime = ?, event_end_datetime = ?, location = ?,
             description = ?, activity = ?, notes = ?, requested_grant_points = ?,
             status = 'pending', review_note = NULL, reviewed_by = NULL, reviewed_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE submission_id = ?`
      ).run(
        value.event_name,
        value.event_datetime,
        value.event_end_datetime,
        value.location,
        value.description,
        value.activity,
        value.notes,
        value.requested_grant_points,
        submissionId
      );
      return { submission_id: Number(submissionId), status: 'pending' };
    })();
  } finally {
    db.close();
  }
}

async function saveMysqlEventSubmission({ organizer, submissionId, action, data }) {
  return withMysqlTransaction(async (connection) => {
    if (action === 'create') {
      const validated = validateSubmissionPayload(data);
      if (validated.error) return validated;
      const value = validated.value;
      const [result] = await connection.query(
        `INSERT INTO event_submissions
           (organizer_id, event_name, event_datetime, event_end_datetime, location,
            description, activity, notes, requested_grant_points, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          organizer.organizer_id,
          value.event_name,
          value.event_datetime,
          value.event_end_datetime,
          value.location,
          value.description,
          value.activity,
          value.notes,
          value.requested_grant_points
        ]
      );
      return { submission_id: result.insertId, status: 'pending' };
    }
    const [rows] = await connection.query(
      'SELECT * FROM event_submissions WHERE submission_id = ? AND organizer_id = ? FOR UPDATE',
      [submissionId, organizer.organizer_id]
    );
    if (rows.length === 0) return { notFound: true };
    const current = rows[0];
    if (action === 'withdraw') {
      if (current.status !== 'pending') return { conflict: true };
      await connection.query(
        "UPDATE event_submissions SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP WHERE submission_id = ?",
        [submissionId]
      );
      return { submission_id: Number(submissionId), status: 'withdrawn' };
    }
    if (!['pending', 'rejected'].includes(current.status)) return { conflict: true };
    const validated = validateSubmissionPayload({ ...current, ...data });
    if (validated.error) return validated;
    const value = validated.value;
    await connection.query(
      `UPDATE event_submissions
       SET event_name = ?, event_datetime = ?, event_end_datetime = ?, location = ?,
           description = ?, activity = ?, notes = ?, requested_grant_points = ?,
           status = 'pending', review_note = NULL, reviewed_by = NULL, reviewed_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE submission_id = ?`,
      [
        value.event_name,
        value.event_datetime,
        value.event_end_datetime,
        value.location,
        value.description,
        value.activity,
        value.notes,
        value.requested_grant_points,
        submissionId
      ]
    );
    return { submission_id: Number(submissionId), status: 'pending' };
  });
}

async function saveEventSubmission(payload, options = {}) {
  if (getDbClient(options) === 'mysql') {
    return saveMysqlEventSubmission(payload);
  }
  return saveSqliteEventSubmission(payload, options);
}

function closeSqliteOrganizerEvent({ organizer, eventId }, options = {}) {
  const db = openDatabase(options);
  try {
    return db.transaction(() => {
      const event = db.prepare(
        `SELECT e.event_id, e.status
         FROM events e
         JOIN event_organizer_events eoe ON e.event_id = eoe.event_id
         WHERE e.event_id = ? AND eoe.organizer_id = ?`
      ).get(eventId, organizer.organizer_id);
      if (!event) return { notFound: true };
      if (!['active', 'paused'].includes(event.status)) return { conflict: true };
      const participations = db
        .prepare("SELECT participation_id, status FROM participations WHERE event_id = ? AND status IN ('applied','checked_in')")
        .all(eventId);
      db.prepare("UPDATE events SET status = 'completed' WHERE event_id = ?").run(eventId);
      const update = db.prepare('UPDATE participations SET status = ? WHERE participation_id = ?');
      const history = db.prepare(
        `INSERT INTO event_participation_status_history
           (participation_id, from_status, to_status, reason, actor_type, actor_id)
         VALUES (?, ?, ?, 'Event closed', 'organizer', ?)`
      );
      for (const item of participations) {
        const next = item.status === 'applied' ? 'absent' : 'incomplete';
        update.run(next, item.participation_id);
        history.run(item.participation_id, item.status, next, organizer.organizer_id);
      }
      return {
        event_id: Number(eventId),
        absent_count: participations.filter((item) => item.status === 'applied').length,
        incomplete_count: participations.filter((item) => item.status === 'checked_in').length
      };
    })();
  } finally {
    db.close();
  }
}

async function closeMysqlOrganizerEvent({ organizer, eventId }) {
  return withMysqlTransaction(async (connection) => {
    const [events] = await connection.query(
      `SELECT e.event_id, e.status
       FROM events e JOIN event_organizer_events eoe ON e.event_id = eoe.event_id
       WHERE e.event_id = ? AND eoe.organizer_id = ? FOR UPDATE`,
      [eventId, organizer.organizer_id]
    );
    if (events.length === 0) return { notFound: true };
    if (!['active', 'paused'].includes(events[0].status)) return { conflict: true };
    const [participations] = await connection.query(
      "SELECT participation_id, status FROM participations WHERE event_id = ? AND status IN ('applied','checked_in') FOR UPDATE",
      [eventId]
    );
    await connection.query("UPDATE events SET status = 'completed' WHERE event_id = ?", [eventId]);
    for (const item of participations) {
      const next = item.status === 'applied' ? 'absent' : 'incomplete';
      await connection.query('UPDATE participations SET status = ? WHERE participation_id = ?', [
        next,
        item.participation_id
      ]);
      await connection.query(
        `INSERT INTO event_participation_status_history
           (participation_id, from_status, to_status, reason, actor_type, actor_id)
         VALUES (?, ?, ?, 'Event closed', 'organizer', ?)`,
        [item.participation_id, item.status, next, organizer.organizer_id]
      );
    }
    return {
      event_id: Number(eventId),
      absent_count: participations.filter((item) => item.status === 'applied').length,
      incomplete_count: participations.filter((item) => item.status === 'checked_in').length
    };
  });
}

async function closeOrganizerEvent(payload, options = {}) {
  if (getDbClient(options) === 'mysql') return closeMysqlOrganizerEvent(payload);
  return closeSqliteOrganizerEvent(payload, options);
}

async function recordStoreExchange(payload, options = {}) {
  if (getDbClient(options) === 'mysql') {
    return recordMysqlStoreExchange(payload);
  }

  return recordSqliteStoreExchange(payload, options);
}

module.exports = {
  DEFAULT_DB_PATH,
  DEFAULT_SEED_PATH,
  openDatabase,
  readPartnerData,
  verifyEventApplication,
  recordEventCheckIn,
  recordEventCompletion,
  saveEventSubmission,
  closeOrganizerEvent,
  recordStoreExchange,
  resolveDbPath
};
