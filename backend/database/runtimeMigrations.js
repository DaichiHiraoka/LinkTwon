const { env } = require('../config/env');

async function columnExists(pool, tableName, columnName) {
  if (env.DB_CLIENT === 'mysql') {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  const [columns] = await pool.query(`PRAGMA table_info(${tableName})`);
  return columns.some((column) => column.name === columnName);
}

async function ensureUserLoginPasswordPlaintext(pool) {
  const exists = await columnExists(pool, 'users', 'login_password_plaintext');
  if (exists) {
    return;
  }

  if (env.DB_CLIENT === 'mysql') {
    await pool.query('ALTER TABLE users ADD COLUMN login_password_plaintext VARCHAR(255) NULL AFTER password');
  } else {
    await pool.query('ALTER TABLE users ADD COLUMN login_password_plaintext TEXT');
  }
}

async function ensureColumn(pool, tableName, columnName, mysqlDefinition, sqliteDefinition) {
  if (await columnExists(pool, tableName, columnName)) {
    return;
  }
  await pool.query(
    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${
      env.DB_CLIENT === 'mysql' ? mysqlDefinition : sqliteDefinition
    }`
  );
}

async function indexExists(pool, tableName, indexName) {
  if (env.DB_CLIENT !== 'mysql') {
    return false;
  }
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function ensureEventLifecycle(pool) {
  if (env.DB_CLIENT !== 'mysql') {
    return;
  }

  await ensureColumn(pool, 'events', 'event_end_datetime', 'DATETIME NULL AFTER event_datetime', 'TEXT');
  await pool.query(
    "ALTER TABLE events MODIFY COLUMN status ENUM('active', 'paused', 'completed', 'cancelled') NOT NULL DEFAULT 'active'"
  );

  await ensureColumn(
    pool,
    'participations',
    'status',
    "ENUM('applied', 'checked_in', 'completed', 'cancelled', 'absent', 'incomplete') NULL AFTER event_id",
    'TEXT'
  );
  await ensureColumn(pool, 'participations', 'grant_points_snapshot', 'INT NULL AFTER status', 'INTEGER');
  await ensureColumn(pool, 'participations', 'applied_at', 'DATETIME NULL AFTER granted_points', 'TEXT');
  await ensureColumn(pool, 'participations', 'checked_in_at', 'DATETIME NULL AFTER applied_at', 'TEXT');
  await ensureColumn(pool, 'participations', 'completed_at', 'DATETIME NULL AFTER checked_in_at', 'TEXT');
  await ensureColumn(pool, 'participations', 'cancelled_at', 'DATETIME NULL AFTER completed_at', 'TEXT');
  await ensureColumn(
    pool,
    'participations',
    'completion_method',
    "ENUM('qr', 'admin', 'legacy') NULL AFTER cancelled_at",
    'TEXT'
  );
  await ensureColumn(pool, 'participations', 'completion_note', 'TEXT NULL AFTER completion_method', 'TEXT');
  await ensureColumn(
    pool,
    'participations',
    'completed_by_admin_id',
    'VARCHAR(100) NULL AFTER completion_note',
    'TEXT'
  );
  await ensureColumn(
    pool,
    'point_transactions',
    'participation_id',
    'INT NULL AFTER service_id',
    'INTEGER'
  );

  await pool.query(
    `UPDATE participations
     SET status = COALESCE(status, 'completed'),
         grant_points_snapshot = COALESCE(grant_points_snapshot, granted_points),
         applied_at = COALESCE(applied_at, participated_at),
         completed_at = COALESCE(completed_at, participated_at),
         completion_method = COALESCE(completion_method, 'legacy')`
  );
  await pool.query(
    "ALTER TABLE participations MODIFY COLUMN status ENUM('applied', 'checked_in', 'completed', 'cancelled', 'absent', 'incomplete') NOT NULL DEFAULT 'applied'"
  );
  await pool.query('ALTER TABLE participations MODIFY COLUMN grant_points_snapshot INT NOT NULL DEFAULT 0');

  await pool.query(
    `CREATE TABLE IF NOT EXISTS event_submissions (
      submission_id INT AUTO_INCREMENT PRIMARY KEY,
      organizer_id VARCHAR(100) NOT NULL,
      event_name VARCHAR(255) NOT NULL,
      event_datetime DATETIME NOT NULL,
      event_end_datetime DATETIME NOT NULL,
      location VARCHAR(255) NULL,
      description TEXT NULL,
      activity TEXT NULL,
      notes TEXT NULL,
      requested_grant_points INT NOT NULL DEFAULT 0,
      status ENUM('pending', 'approved', 'rejected', 'withdrawn') NOT NULL DEFAULT 'pending',
      review_note TEXT NULL,
      reviewed_by VARCHAR(100) NULL,
      reviewed_at DATETIME NULL,
      approved_event_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_event_submissions_status (status, created_at),
      FOREIGN KEY (organizer_id) REFERENCES event_organizers(organizer_id) ON DELETE CASCADE,
      FOREIGN KEY (approved_event_id) REFERENCES events(event_id) ON DELETE SET NULL
    )`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS event_participation_status_history (
      history_id INT AUTO_INCREMENT PRIMARY KEY,
      participation_id INT NOT NULL,
      from_status VARCHAR(32) NULL,
      to_status VARCHAR(32) NOT NULL,
      reason TEXT NULL,
      actor_type ENUM('user', 'organizer', 'admin', 'system') NOT NULL,
      actor_id VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (participation_id) REFERENCES participations(participation_id) ON DELETE CASCADE
    )`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS event_attendance_scans (
      scan_id INT AUTO_INCREMENT PRIMARY KEY,
      participation_id INT NOT NULL,
      organizer_id VARCHAR(100) NOT NULL,
      scan_type ENUM('check_in', 'completion') NOT NULL,
      nonce VARCHAR(255) NOT NULL,
      qr_issued_at DATETIME NULL,
      qr_expires_at DATETIME NOT NULL,
      processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_participation_scan_type (participation_id, scan_type),
      UNIQUE KEY unique_attendance_nonce (nonce),
      FOREIGN KEY (participation_id) REFERENCES participations(participation_id) ON DELETE CASCADE,
      FOREIGN KEY (organizer_id) REFERENCES event_organizers(organizer_id) ON DELETE CASCADE
    )`
  );
  if (!(await indexExists(pool, 'point_transactions', 'unique_participation_grant'))) {
    await pool.query(
      'CREATE UNIQUE INDEX unique_participation_grant ON point_transactions(participation_id)'
    );
  }
}

async function ensureRuntimeSchema(pool) {
  await ensureUserLoginPasswordPlaintext(pool);
  await ensureEventLifecycle(pool);
}

module.exports = {
  ensureRuntimeSchema
};
