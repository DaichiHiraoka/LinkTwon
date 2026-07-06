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
    type TEXT NOT NULL,
    points INTEGER NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE SET NULL
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
  )`
];

const columnMigrations = [
  ['events', 'status', "TEXT NOT NULL DEFAULT 'active'"],
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
  ['services', 'status', "TEXT NOT NULL DEFAULT 'active'"]
];

const indexStatements = [
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_event_organizers_login_code ON event_organizers(login_code)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_login_code ON stores(login_code) WHERE login_code IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS idx_event_organizer_events_event_id ON event_organizer_events(event_id)',
  'CREATE INDEX IF NOT EXISTS idx_portal_event_check_ins_user_id ON portal_event_check_ins(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_portal_store_exchanges_user_id ON portal_store_exchanges(user_id)'
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

async function getMysqlPool() {
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
    location: asOptionalString(row.location),
    grant_points: Number(row.grant_points || 0),
    description: asOptionalString(row.description),
    activity: asOptionalString(row.activity),
    notes: asOptionalString(row.notes)
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

function buildPartnerData({ organizers, assignments, stores, events, categories, services }) {
  const eventIdsByOrganizer = new Map();
  const assignedEventIds = new Set();
  for (const assignment of assignments) {
    const organizerId = asId(assignment.organizer_id);
    const eventId = asId(assignment.event_id);
    if (!eventIdsByOrganizer.has(organizerId)) {
      eventIdsByOrganizer.set(organizerId, []);
    }
    eventIdsByOrganizer.get(organizerId).push(eventId);
    assignedEventIds.add(eventId);
  }

  const unassignedEventIds = events.map((event) => asId(event.event_id)).filter((eventId) => !assignedEventIds.has(eventId));
  if (unassignedEventIds.length > 0) {
    for (const organizer of organizers) {
      const organizerId = asId(organizer.organizer_id);
      const eventIds = eventIdsByOrganizer.get(organizerId) || [];
      eventIdsByOrganizer.set(organizerId, [...eventIds, ...unassignedEventIds]);
    }
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
    services: mappedServices
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
        `SELECT event_id, event_name, event_datetime, location, grant_points,
                COALESCE(description, '') AS description,
                COALESCE(activity, '') AS activity,
                COALESCE(notes, '') AS notes
         FROM events
         WHERE COALESCE(status, 'active') = 'active'
         ORDER BY event_datetime DESC, event_id DESC`
      )
      .all();
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

    return buildPartnerData({ organizers, assignments, stores, events, categories, services });
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
    `SELECT event_id, event_name, event_datetime, location, grant_points,
            COALESCE(description, '') AS description,
            COALESCE(activity, '') AS activity,
            COALESCE(notes, '') AS notes
     FROM events
     WHERE COALESCE(status, 'active') = 'active'
     ORDER BY event_datetime DESC, event_id DESC`
  );
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

  return buildPartnerData({ organizers, assignments, stores, events, categories, services });
}

async function readPartnerData(options = {}) {
  if (getDbClient(options) === 'mysql') {
    return readMysqlPartnerData(options);
  }

  return readSqlitePartnerData(options);
}

function recordSqliteEventCheckIn({ organizer, event, user }, options = {}) {
  const db = openDatabase(options);

  try {
    const write = db.transaction(() => {
      const dbUser = db.prepare('SELECT user_id, name, points FROM users WHERE user_id = ?').get(user.user_id);
      if (!dbUser) {
        return { userNotFound: true };
      }

      const duplicate = db
        .prepare('SELECT check_in_id FROM portal_event_check_ins WHERE event_id = ? AND user_id = ? AND nonce = ?')
        .get(event.event_id, user.user_id, user.nonce);
      if (duplicate) {
        return { duplicate: true };
      }

      const participation = db
        .prepare('SELECT participation_id FROM participations WHERE event_id = ? AND user_id = ?')
        .get(event.event_id, user.user_id);
      if (participation) {
        return { alreadyParticipated: true };
      }

      db.prepare(
        `INSERT INTO participations (user_id, event_id, granted_points)
         VALUES (?, ?, ?)`
      ).run(user.user_id, event.event_id, event.grant_points);
      db.prepare('UPDATE users SET points = points + ? WHERE user_id = ?').run(event.grant_points, user.user_id);
      db.prepare(
        `INSERT INTO point_transactions (user_id, type, points, description)
         VALUES (?, 'grant', ?, ?)`
      ).run(user.user_id, event.grant_points, `Points granted for event: ${event.event_name}`);
      const result = db.prepare(
        `INSERT INTO portal_event_check_ins
          (organizer_id, event_id, user_id, user_name, nonce, qr_issued_at, qr_expires_at, granted_points)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        organizer.organizer_id,
        event.event_id,
        user.user_id,
        user.name,
        user.nonce,
        user.issued_at,
        user.expires_at,
        event.grant_points
      );

      return {
        duplicate: false,
        id: Number(result.lastInsertRowid),
        current_points: Number(dbUser.points || 0) + Number(event.grant_points || 0)
      };
    });

    return write();
  } finally {
    db.close();
  }
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

async function recordMysqlEventCheckIn({ organizer, event, user }) {
  return withMysqlTransaction(async (connection) => {
    const [users] = await connection.query('SELECT user_id, name, points FROM users WHERE user_id = ? FOR UPDATE', [user.user_id]);
    if (users.length === 0) {
      return { userNotFound: true };
    }

    const [duplicates] = await connection.query(
      'SELECT check_in_id FROM portal_event_check_ins WHERE event_id = ? AND user_id = ? AND nonce = ?',
      [event.event_id, user.user_id, user.nonce]
    );
    if (duplicates.length > 0) {
      return { duplicate: true };
    }

    const [participations] = await connection.query(
      'SELECT participation_id FROM participations WHERE event_id = ? AND user_id = ?',
      [event.event_id, user.user_id]
    );
    if (participations.length > 0) {
      return { alreadyParticipated: true };
    }

    await connection.query(
      `INSERT INTO participations (user_id, event_id, granted_points)
       VALUES (?, ?, ?)`,
      [user.user_id, event.event_id, event.grant_points]
    );
    await connection.query('UPDATE users SET points = points + ? WHERE user_id = ?', [event.grant_points, user.user_id]);
    await connection.query(
      `INSERT INTO point_transactions (user_id, type, points, description)
       VALUES (?, 'grant', ?, ?)`,
      [user.user_id, event.grant_points, `Points granted for event: ${event.event_name}`]
    );
    const [result] = await connection.query(
      `INSERT INTO portal_event_check_ins
        (organizer_id, event_id, user_id, user_name, nonce, qr_issued_at, qr_expires_at, granted_points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        organizer.organizer_id,
        event.event_id,
        user.user_id,
        user.name,
        user.nonce,
        user.issued_at,
        user.expires_at,
        event.grant_points
      ]
    );

    return {
      duplicate: false,
      id: result.insertId,
      current_points: Number(users[0].points || 0) + Number(event.grant_points || 0)
    };
  });
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

async function recordEventCheckIn(payload, options = {}) {
  if (getDbClient(options) === 'mysql') {
    return recordMysqlEventCheckIn(payload);
  }

  return recordSqliteEventCheckIn(payload, options);
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
  recordEventCheckIn,
  recordStoreExchange,
  resolveDbPath
};
