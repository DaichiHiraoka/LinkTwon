const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { env } = require('../config/env');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_DB_PATH = path.join(ROOT_DIR, 'data', 'partner-portal.sqlite');
const DEFAULT_SEED_PATH = path.join(ROOT_DIR, 'data', 'partner-data.json');

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS event_organizers (
    organizer_id TEXT PRIMARY KEY,
    login_code TEXT NOT NULL UNIQUE,
    organizer_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS stores (
    store_id TEXT PRIMARY KEY,
    login_code TEXT NOT NULL UNIQUE,
    store_name TEXT NOT NULL,
    store_address TEXT NOT NULL,
    map_query TEXT NOT NULL,
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
    event_id TEXT PRIMARY KEY,
    organizer_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_datetime TEXT NOT NULL,
    location TEXT NOT NULL,
    grant_points INTEGER NOT NULL,
    description TEXT NOT NULL,
    activity TEXT NOT NULL,
    notes TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES event_organizers(organizer_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    service_id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    service_name TEXT NOT NULL,
    description TEXT NOT NULL,
    required_points INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES service_categories(category_id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS portal_users (
    user_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS event_check_ins (
    check_in_id INTEGER PRIMARY KEY AUTOINCREMENT,
    organizer_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    nonce TEXT NOT NULL,
    qr_issued_at TEXT,
    qr_expires_at TEXT NOT NULL,
    granted_points INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, user_id, nonce),
    FOREIGN KEY (organizer_id) REFERENCES event_organizers(organizer_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES portal_users(user_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS store_exchanges (
    exchange_id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    nonce TEXT NOT NULL,
    qr_issued_at TEXT,
    qr_expires_at TEXT NOT NULL,
    used_points INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (service_id, user_id, nonce),
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES portal_users(user_id) ON DELETE CASCADE
  )`
];

function resolveDbPath(filePath = env.PARTNER_SQLITE_PATH || env.PARTNER_DB_PATH || DEFAULT_DB_PATH) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(ROOT_DIR, filePath);
}

function readSeedData(seedPath = DEFAULT_SEED_PATH) {
  return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
}

function applySchema(db) {
  for (const statement of schemaStatements) {
    db.prepare(statement).run();
  }
}

function seedDatabase(db, seedPath) {
  const organizerCount = db.prepare('SELECT COUNT(*) AS count FROM event_organizers').get().count;
  const storeCount = db.prepare('SELECT COUNT(*) AS count FROM stores').get().count;
  const eventCount = db.prepare('SELECT COUNT(*) AS count FROM events').get().count;
  const serviceCount = db.prepare('SELECT COUNT(*) AS count FROM services').get().count;

  if (organizerCount || storeCount || eventCount || serviceCount) {
    return;
  }

  const data = readSeedData(seedPath);

  const insertOrganizer = db.prepare(
    `INSERT INTO event_organizers (organizer_id, login_code, organizer_name, contact_email)
     VALUES (@organizer_id, @login_code, @organizer_name, @contact_email)`
  );
  const insertStore = db.prepare(
    `INSERT INTO stores (store_id, login_code, store_name, store_address, map_query, contact_email)
     VALUES (@store_id, @login_code, @store_name, @store_address, @map_query, @contact_email)`
  );
  const insertCategory = db.prepare(
    `INSERT INTO service_categories (category_id, category_name)
     VALUES (@category_id, @category_name)`
  );
  const insertEvent = db.prepare(
    `INSERT INTO events (event_id, organizer_id, event_name, event_datetime, location, grant_points, description, activity, notes)
     VALUES (@event_id, @organizer_id, @event_name, @event_datetime, @location, @grant_points, @description, @activity, @notes)`
  );
  const insertService = db.prepare(
    `INSERT INTO services (service_id, store_id, category_id, service_name, description, required_points)
     VALUES (@service_id, @store_id, @category_id, @service_name, @description, @required_points)`
  );

  const seed = db.transaction(() => {
    data.eventOrganizers.forEach((organizer) => insertOrganizer.run(organizer));
    data.stores.forEach((store) => insertStore.run(store));
    data.serviceCategories.forEach((category) => insertCategory.run(category));
    data.events.forEach((event) => insertEvent.run(event));
    data.services.forEach((service) => insertService.run(service));
  });

  seed();
}

function openDatabase(options = {}) {
  const dbPath = resolveDbPath(options.dbPath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  applySchema(db);
  seedDatabase(db, options.seedPath || DEFAULT_SEED_PATH);
  return db;
}

function mapOrganizer(row) {
  return {
    organizer_id: row.organizer_id,
    login_code: row.login_code,
    organizer_name: row.organizer_name,
    contact_email: row.contact_email,
    event_ids: row.event_ids ? row.event_ids.split(',').filter(Boolean) : []
  };
}

function mapStore(row) {
  return {
    store_id: row.store_id,
    login_code: row.login_code,
    store_name: row.store_name,
    store_address: row.store_address,
    map_query: row.map_query,
    contact_email: row.contact_email,
    service_ids: row.service_ids ? row.service_ids.split(',').filter(Boolean) : []
  };
}

async function readPartnerData(options = {}) {
  const db = openDatabase(options);

  try {
    const eventOrganizers = db
      .prepare(
        `SELECT eo.*,
          COALESCE(GROUP_CONCAT(e.event_id), '') AS event_ids
         FROM event_organizers eo
         LEFT JOIN events e ON e.organizer_id = eo.organizer_id
         GROUP BY eo.organizer_id
         ORDER BY eo.organizer_id ASC`
      )
      .all()
      .map(mapOrganizer);
    const stores = db
      .prepare(
        `SELECT s.*,
          COALESCE(GROUP_CONCAT(sv.service_id), '') AS service_ids
         FROM stores s
         LEFT JOIN services sv ON sv.store_id = s.store_id
         GROUP BY s.store_id
         ORDER BY s.store_id ASC`
      )
      .all()
      .map(mapStore);
    const events = db.prepare('SELECT * FROM events ORDER BY event_id ASC').all();
    const serviceCategories = db.prepare('SELECT * FROM service_categories ORDER BY category_id ASC').all();
    const services = db.prepare('SELECT * FROM services ORDER BY service_id ASC').all();

    return {
      eventOrganizers,
      stores,
      events,
      serviceCategories,
      services
    };
  } finally {
    db.close();
  }
}

function upsertPortalUser(db, user) {
  db.prepare(
    `INSERT INTO portal_users (user_id, display_name)
     VALUES (@user_id, @name)
     ON CONFLICT(user_id) DO UPDATE SET
       display_name = excluded.display_name,
       updated_at = CURRENT_TIMESTAMP`
  ).run(user);
}

async function recordEventCheckIn({ organizer, event, user }, options = {}) {
  const db = openDatabase(options);

  try {
    const write = db.transaction(() => {
      upsertPortalUser(db, user);
      const result = db.prepare(
        `INSERT OR IGNORE INTO event_check_ins
          (organizer_id, event_id, user_id, user_name, nonce, qr_issued_at, qr_expires_at, granted_points)
         VALUES
          (@organizer_id, @event_id, @user_id, @user_name, @nonce, @issued_at, @expires_at, @granted_points)`
      ).run({
        organizer_id: organizer.organizer_id,
        event_id: event.event_id,
        user_id: user.user_id,
        user_name: user.name,
        nonce: user.nonce,
        issued_at: user.issued_at,
        expires_at: user.expires_at,
        granted_points: event.grant_points
      });

      return {
        duplicate: result.changes === 0,
        id: Number(result.lastInsertRowid)
      };
    });

    return write();
  } finally {
    db.close();
  }
}

async function recordStoreExchange({ store, service, user }, options = {}) {
  const db = openDatabase(options);

  try {
    const write = db.transaction(() => {
      upsertPortalUser(db, user);
      const result = db.prepare(
        `INSERT OR IGNORE INTO store_exchanges
          (store_id, service_id, user_id, user_name, nonce, qr_issued_at, qr_expires_at, used_points)
         VALUES
          (@store_id, @service_id, @user_id, @user_name, @nonce, @issued_at, @expires_at, @used_points)`
      ).run({
        store_id: store.store_id,
        service_id: service.service_id,
        user_id: user.user_id,
        user_name: user.name,
        nonce: user.nonce,
        issued_at: user.issued_at,
        expires_at: user.expires_at,
        used_points: service.required_points
      });

      return {
        duplicate: result.changes === 0,
        id: Number(result.lastInsertRowid)
      };
    });

    return write();
  } finally {
    db.close();
  }
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
