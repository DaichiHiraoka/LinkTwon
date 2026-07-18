const bcrypt = require('bcryptjs');
const path = require('path');
const pool = require('../config/db');
const { env } = require('../config/env');
const { translateText } = require('../services/translationService');
const { closeEvent, grantCompletionPoints } = require('../services/eventLifecycleService');

const TRANSLATION_CACHE_LOCALE = 'en';

function isValidStatus(status) {
  return ['active', 'paused', 'completed', 'cancelled'].includes(status);
}

function getDatabaseLabel() {
  if (env.DB_CLIENT === 'sqlite') {
    return path.basename(path.resolve(env.SQLITE_PATH));
  }

  if (env.DATABASE_URL) {
    try {
      return decodeURIComponent(new URL(env.DATABASE_URL).pathname.replace(/^\//, '')) || env.DB_NAME;
    } catch {
      return env.DB_NAME;
    }
  }

  return env.DB_NAME;
}

async function getSystemConnection(req, res, next) {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      environment: env.APP_ENV,
      db_client: env.DB_CLIENT,
      database: getDatabaseLabel()
    });
  } catch (error) {
    next(error);
  }
}

function normalizeEventDateTime(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return trimmed;
  }

  return `${match[1]} ${match[2]}:${match[3] || '00'}`;
}

async function prewarmTranslationCache(contentType, contentId, fields) {
  const entries = Object.entries(fields).filter(([, value]) => typeof value === 'string' && value.trim() !== '');

  if (entries.length === 0) {
    return;
  }

  try {
    await Promise.all(
      entries.map(([fieldName, sourceText]) =>
        translateText({
          contentType,
          contentId,
          fieldName,
          sourceText,
          targetLocale: TRANSLATION_CACHE_LOCALE
        })
      )
    );
  } catch (error) {
    console.warn(`Failed to prewarm ${contentType} translation cache for ${contentId}:`, error.message);
  }
}

async function getEvents(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT e.*,
              SUM(CASE WHEN p.status IN ('applied', 'checked_in', 'completed', 'absent', 'incomplete') THEN 1 ELSE 0 END) AS application_count,
              SUM(CASE WHEN p.status IN ('checked_in', 'completed', 'incomplete') THEN 1 ELSE 0 END) AS checked_in_count,
              SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
              SUM(CASE WHEN p.status = 'incomplete' THEN 1 ELSE 0 END) AS incomplete_count
       FROM events e
       LEFT JOIN participations p ON e.event_id = p.event_id
       GROUP BY e.event_id
       ORDER BY e.event_datetime DESC`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function createEvent(req, res, next) {
  try {
    const {
      event_name, event_datetime, event_end_datetime, location,
      grant_points, description, activity, notes, status
    } = req.body;
    const eventStatus = status || 'active';

    if (!event_name || !event_datetime || !event_end_datetime) {
      return res.status(400).json({ message: 'Event name, start datetime and end datetime are required.' });
    }

    if (!isValidStatus(eventStatus)) {
      return res.status(400).json({ message: 'Invalid event status.' });
    }

    const normalizedEventDatetime = normalizeEventDateTime(event_datetime);
    const normalizedEventEndDatetime = normalizeEventDateTime(event_end_datetime);
    if (new Date(normalizedEventEndDatetime) <= new Date(normalizedEventDatetime)) {
      return res.status(400).json({ message: 'Event end datetime must be after the start datetime.' });
    }
    const [result] = await pool.query(
      `INSERT INTO events
         (event_name, event_datetime, event_end_datetime, location, grant_points, description, activity, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event_name,
        normalizedEventDatetime,
        normalizedEventEndDatetime,
        location || null,
        Number(grant_points || 0),
        description || null,
        activity || null,
        notes || null,
        eventStatus
      ]
    );

    await prewarmTranslationCache('event', result.insertId, {
      event_name,
      description
    });

    res.status(201).json({
      message: 'Event created successfully.',
      event_id: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

async function updateEvent(req, res, next) {
  try {
    const { id } = req.params;
    const {
      event_name, event_datetime, event_end_datetime, location,
      grant_points, description, activity, notes, status
    } = req.body;

    const [events] = await pool.query('SELECT * FROM events WHERE event_id = ?', [id]);
    if (events.length === 0) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const eventStatus = status || events[0].status || 'active';
    if (!isValidStatus(eventStatus)) {
      return res.status(400).json({ message: 'Invalid event status.' });
    }

    const nextEvent = {
      event_name: event_name || events[0].event_name,
      event_datetime: event_datetime ? normalizeEventDateTime(event_datetime) : events[0].event_datetime,
      event_end_datetime: event_end_datetime
        ? normalizeEventDateTime(event_end_datetime)
        : events[0].event_end_datetime,
      location: location === undefined ? events[0].location : location,
      grant_points: grant_points === undefined ? events[0].grant_points : Number(grant_points),
      description: description === undefined ? events[0].description : description,
      activity: activity === undefined ? events[0].activity : activity,
      notes: notes === undefined ? events[0].notes : notes,
      status: eventStatus
    };
    if (!nextEvent.event_end_datetime) {
      return res.status(400).json({ message: 'Event end datetime is required.' });
    }
    if (new Date(nextEvent.event_end_datetime) <= new Date(nextEvent.event_datetime)) {
      return res.status(400).json({ message: 'Event end datetime must be after the start datetime.' });
    }

    await pool.query(
      `UPDATE events
       SET event_name = ?, event_datetime = ?, event_end_datetime = ?, location = ?, grant_points = ?,
           description = ?, activity = ?, notes = ?, status = ?
       WHERE event_id = ?`,
      [
        nextEvent.event_name,
        nextEvent.event_datetime,
        nextEvent.event_end_datetime,
        nextEvent.location,
        nextEvent.grant_points,
        nextEvent.description,
        nextEvent.activity,
        nextEvent.notes,
        nextEvent.status,
        id
      ]
    );
    await prewarmTranslationCache('event', id, {
      event_name: nextEvent.event_name,
      description: nextEvent.description
    });

    res.json({ message: 'Event updated successfully.' });
  } catch (error) {
    next(error);
  }
}

async function deleteEvent(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM events WHERE event_id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    res.json({ message: 'Event deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

async function getEventSubmissions(req, res, next) {
  try {
    const status = req.query.status;
    const params = [];
    let where = '';
    if (status) {
      if (!['pending', 'approved', 'rejected', 'withdrawn'].includes(status)) {
        return res.status(400).json({ message: 'Invalid submission status.' });
      }
      where = 'WHERE es.status = ?';
      params.push(status);
    }
    const [rows] = await pool.query(
      `SELECT es.*, eo.organizer_name, eo.contact_email
       FROM event_submissions es
       JOIN event_organizers eo ON es.organizer_id = eo.organizer_id
       ${where}
       ORDER BY CASE WHEN es.status = 'pending' THEN 0 ELSE 1 END, es.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function getEventSubmission(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT es.*, eo.organizer_name, eo.contact_email
       FROM event_submissions es
       JOIN event_organizers eo ON es.organizer_id = eo.organizer_id
       WHERE es.submission_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Event submission not found.' });
    }
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
}

async function approveEventSubmission(req, res, next) {
  const connection = await pool.getConnection();
  let approvedEvent;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT * FROM event_submissions WHERE submission_id = ? FOR UPDATE`,
      [req.params.id]
    );
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Event submission not found.' });
    }
    if (rows[0].status !== 'pending') {
      await connection.rollback();
      return res.status(409).json({ message: 'This event submission has already been reviewed.' });
    }

    const submission = rows[0];
    approvedEvent = {
      event_name: req.body.event_name ?? submission.event_name,
      event_datetime: normalizeEventDateTime(req.body.event_datetime ?? submission.event_datetime),
      event_end_datetime: normalizeEventDateTime(
        req.body.event_end_datetime ?? submission.event_end_datetime
      ),
      location: req.body.location ?? submission.location,
      grant_points: Number(req.body.grant_points ?? submission.requested_grant_points ?? 0),
      description: req.body.description ?? submission.description,
      activity: req.body.activity ?? submission.activity,
      notes: req.body.notes ?? submission.notes
    };
    if (
      !approvedEvent.event_end_datetime ||
      new Date(approvedEvent.event_end_datetime) <= new Date(approvedEvent.event_datetime)
    ) {
      await connection.rollback();
      return res.status(400).json({ message: 'Event end datetime must be after the start datetime.' });
    }

    const [eventResult] = await connection.query(
      `INSERT INTO events
         (event_name, event_datetime, event_end_datetime, location, grant_points,
          description, activity, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        approvedEvent.event_name,
        approvedEvent.event_datetime,
        approvedEvent.event_end_datetime,
        approvedEvent.location || null,
        approvedEvent.grant_points,
        approvedEvent.description || null,
        approvedEvent.activity || null,
        approvedEvent.notes || null
      ]
    );
    await connection.query(
      `INSERT INTO event_organizer_events (organizer_id, event_id) VALUES (?, ?)`,
      [submission.organizer_id, eventResult.insertId]
    );
    await connection.query(
      `UPDATE event_submissions
       SET status = 'approved', review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
           approved_event_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE submission_id = ?`,
      [req.body.review_note || null, req.user.id, eventResult.insertId, submission.submission_id]
    );
    await connection.commit();

    await prewarmTranslationCache('event', eventResult.insertId, {
      event_name: approvedEvent.event_name,
      description: approvedEvent.description
    });
    res.status(201).json({
      message: 'Event submission approved.',
      submission_id: submission.submission_id,
      event_id: eventResult.insertId
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

async function rejectEventSubmission(req, res, next) {
  const note = String(req.body.review_note || '').trim();
  if (!note) {
    return res.status(400).json({ message: 'A rejection reason is required.' });
  }
  try {
    const [result] = await pool.query(
      `UPDATE event_submissions
       SET status = 'rejected', review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE submission_id = ? AND status = 'pending'`,
      [note, req.user.id, req.params.id]
    );
    if (result.affectedRows === 0) {
      const [rows] = await pool.query('SELECT status FROM event_submissions WHERE submission_id = ?', [
        req.params.id
      ]);
      return res
        .status(rows.length === 0 ? 404 : 409)
        .json({ message: rows.length === 0 ? 'Event submission not found.' : 'This submission is not pending.' });
    }
    res.json({ message: 'Event submission rejected.', submission_id: Number(req.params.id) });
  } catch (error) {
    next(error);
  }
}

async function getEventParticipations(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, u.name AS user_name, u.email, e.event_name
       FROM participations p
       JOIN users u ON p.user_id = u.user_id
       JOIN events e ON p.event_id = e.event_id
       WHERE p.event_id = ?
       ORDER BY p.applied_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function completeParticipationByAdmin(req, res, next) {
  const note = String(req.body.reason || '').trim();
  if (!note) {
    return res.status(400).json({ message: 'A correction reason is required.' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT p.*, e.event_name
       FROM participations p
       JOIN events e ON p.event_id = e.event_id
       WHERE p.participation_id = ?
       FOR UPDATE`,
      [req.params.id]
    );
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Participation not found.' });
    }
    if (rows[0].status !== 'incomplete') {
      await connection.rollback();
      return res.status(409).json({ message: 'Only an incomplete participation can be corrected.' });
    }
    const result = await grantCompletionPoints(connection, rows[0], {
      method: 'admin',
      note,
      adminId: req.user.id,
      actorType: 'admin',
      actorId: req.user.id
    });
    if (result.conflict) {
      await connection.rollback();
      return res.status(409).json({ message: 'Points have already been granted.' });
    }
    await connection.commit();
    res.json({
      message: 'Participation corrected to completed.',
      participation_id: Number(req.params.id),
      granted_points: result.grantedPoints,
      current_points: result.currentPoints
    });
  } catch (error) {
    await connection.rollback();
    if (error?.code === 'ER_DUP_ENTRY' || String(error?.message).includes('UNIQUE constraint failed')) {
      return res.status(409).json({ message: 'Points have already been granted.' });
    }
    next(error);
  } finally {
    connection.release();
  }
}

async function closeEventByAdmin(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await closeEvent(connection, req.params.id, {
      actorType: 'admin',
      actorId: req.user.id,
      reason: req.body.reason || null
    });
    if (result.status >= 400) {
      await connection.rollback();
      return res.status(result.status).json(result.body);
    }
    await connection.commit();
    res.json(result.body);
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

async function getStores(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM stores ORDER BY store_id DESC');
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function createStore(req, res, next) {
  try {
    const { store_name, store_address, map_query, status } = req.body;
    const storeStatus = status || 'active';

    if (!store_name) {
      return res.status(400).json({ message: 'Store name is required.' });
    }

    if (!isValidStatus(storeStatus)) {
      return res.status(400).json({ message: 'Invalid store status.' });
    }

    const [result] = await pool.query(
      `INSERT INTO stores (store_name, store_address, map_query, status) VALUES (?, ?, ?, ?)`,
      [store_name, store_address || null, map_query || null, storeStatus]
    );

    res.status(201).json({
      message: 'Store created successfully.',
      store_id: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

async function updateStore(req, res, next) {
  try {
    const { id } = req.params;
    const { store_name, store_address, map_query, status } = req.body;

    const [stores] = await pool.query('SELECT * FROM stores WHERE store_id = ?', [id]);
    if (stores.length === 0) {
      return res.status(404).json({ message: 'Store not found.' });
    }

    const storeStatus = status || stores[0].status || 'active';
    if (!isValidStatus(storeStatus)) {
      return res.status(400).json({ message: 'Invalid store status.' });
    }

    await pool.query(
      `UPDATE stores
       SET store_name = ?, store_address = ?, map_query = ?, status = ?
       WHERE store_id = ?`,
      [
        store_name || stores[0].store_name,
        store_address === undefined ? stores[0].store_address : store_address || null,
        map_query === undefined ? stores[0].map_query : map_query || null,
        storeStatus,
        id
      ]
    );

    res.json({ message: 'Store updated successfully.' });
  } catch (error) {
    next(error);
  }
}

async function deleteStore(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM stores WHERE store_id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Store not found.' });
    }

    res.json({ message: 'Store deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

async function getServicesAdmin(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, st.store_name
       FROM services s
       JOIN stores st ON s.store_id = st.store_id
       ORDER BY s.service_id DESC`
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function createService(req, res, next) {
  try {
    const { store_id, service_name, description, required_points, status } = req.body;
    const serviceStatus = status || 'active';

    if (!store_id || !service_name) {
      return res.status(400).json({ message: 'Store ID and service name are required.' });
    }

    if (!isValidStatus(serviceStatus)) {
      return res.status(400).json({ message: 'Invalid service status.' });
    }

    const [stores] = await pool.query('SELECT store_id FROM stores WHERE store_id = ?', [store_id]);
    if (stores.length === 0) {
      return res.status(400).json({ message: 'Invalid store ID.' });
    }

    const [result] = await pool.query(
      `INSERT INTO services (store_id, service_name, description, required_points, status)
       VALUES (?, ?, ?, ?, ?)`,
      [store_id, service_name, description || null, Number(required_points || 0), serviceStatus]
    );
    await prewarmTranslationCache('service', result.insertId, {
      service_name,
      description
    });

    res.status(201).json({
      message: 'Service created successfully.',
      service_id: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

async function updateService(req, res, next) {
  try {
    const { id } = req.params;
    const { store_id, service_name, description, required_points, status } = req.body;

    const [services] = await pool.query('SELECT * FROM services WHERE service_id = ?', [id]);
    if (services.length === 0) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    const serviceStatus = status || services[0].status || 'active';
    if (!isValidStatus(serviceStatus)) {
      return res.status(400).json({ message: 'Invalid service status.' });
    }

    if (store_id) {
      const [stores] = await pool.query('SELECT store_id FROM stores WHERE store_id = ?', [store_id]);
      if (stores.length === 0) {
        return res.status(400).json({ message: 'Invalid store ID.' });
      }
    }

    const nextService = {
      store_id: store_id || services[0].store_id,
      service_name: service_name || services[0].service_name,
      description: description === undefined ? services[0].description : description,
      required_points: required_points === undefined ? services[0].required_points : Number(required_points),
      status: serviceStatus
    };

    await pool.query(
      `UPDATE services
       SET store_id = ?, service_name = ?, description = ?, required_points = ?, status = ?
       WHERE service_id = ?`,
      [
        nextService.store_id,
        nextService.service_name,
        nextService.description,
        nextService.required_points,
        nextService.status,
        id
      ]
    );
    await prewarmTranslationCache('service', id, {
      service_name: nextService.service_name,
      description: nextService.description
    });

    res.json({ message: 'Service updated successfully.' });
  } catch (error) {
    next(error);
  }
}

async function deleteService(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM services WHERE service_id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    res.json({ message: 'Service deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

async function getUsers(req, res, next) {
  try {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const [rows] = await pool.query(
      `SELECT user_id, name, email, login_password_plaintext, points, age_group, user_type, email_verified_at, created_at
       FROM users
       WHERE name LIKE ? OR email LIKE ?
       ORDER BY user_id DESC`,
      [search, search]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function getUserDetail(req, res, next) {
  try {
    const { id } = req.params;
    const [users] = await pool.query(
      `SELECT user_id, name, email, login_password_plaintext, points, age_group, user_type, email_verified_at, created_at
       FROM users
       WHERE user_id = ?`,
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const [participations] = await pool.query(
      `SELECT p.participation_id, p.participated_at, p.granted_points,
              e.event_id, e.event_name
       FROM participations p
       JOIN events e ON p.event_id = e.event_id
       WHERE p.user_id = ?
       ORDER BY p.participated_at DESC`,
      [id]
    );

    const [transactions] = await pool.query(
      `SELECT pt.transaction_id, pt.type, pt.points, pt.description, pt.created_at,
              s.service_name
       FROM point_transactions pt
       LEFT JOIN services s ON pt.service_id = s.service_id
       WHERE pt.user_id = ?
       ORDER BY pt.created_at DESC`,
      [id]
    );

    const [purchases] = await pool.query(
      `SELECT purchase_id, points, amount_yen, status, created_at
       FROM point_purchases
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      user: users[0],
      participations,
      transactions,
      purchases
    });
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { name, age_group, user_type, points, password } = req.body;

    const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    let passwordHash = users[0].password;
    let loginPasswordPlaintext = users[0].login_password_plaintext;
    if (password !== undefined && password !== null && password !== '') {
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters.' });
      }
      passwordHash = await bcrypt.hash(password, 10);
      loginPasswordPlaintext = password;
    }

    await pool.query(
      `UPDATE users
       SET name = ?, age_group = ?, user_type = ?, points = ?, password = ?, login_password_plaintext = ?
       WHERE user_id = ?`,
      [
        name || users[0].name,
        age_group === undefined ? users[0].age_group : age_group,
        user_type || users[0].user_type,
        points === undefined ? users[0].points : Number(points),
        passwordHash,
        loginPasswordPlaintext,
        id
      ]
    );

    res.json({ message: 'User updated successfully.' });
  } catch (error) {
    next(error);
  }
}

async function getStats(req, res, next) {
  try {
    const [participationStats] = await pool.query(
      `SELECT COUNT(*) AS total_participations, COALESCE(SUM(granted_points), 0) AS total_granted_points
       FROM participations`
    );

    const [exchangeStats] = await pool.query(
      `SELECT COUNT(*) AS total_exchanges, COALESCE(SUM(points), 0) AS total_exchanged_points
       FROM point_transactions
       WHERE type = 'exchange'`
    );

    const [purchaseStats] = await pool.query(
      `SELECT COUNT(*) AS total_purchases, COALESCE(SUM(points), 0) AS total_purchased_points
       FROM point_purchases
       WHERE status = 'paid'`
    );

    const [userStats] = await pool.query('SELECT COUNT(*) AS total_users FROM users');
    const [eventStats] = await pool.query("SELECT COUNT(*) AS active_events FROM events WHERE status = 'active'");
    const [ticketStats] = await pool.query("SELECT COUNT(*) AS open_tickets FROM support_tickets WHERE status IN ('open', 'in_progress')");

    const [eventParticipants] = await pool.query(
      `SELECT e.event_id, e.event_name, COUNT(p.participation_id) AS participation_count,
              COALESCE(SUM(p.granted_points), 0) AS granted_points
       FROM events e
       LEFT JOIN participations p ON e.event_id = p.event_id
       GROUP BY e.event_id, e.event_name
       ORDER BY participation_count DESC, e.event_id DESC`
    );

    const [serviceExchanges] = await pool.query(
      `SELECT s.service_id, s.service_name, COUNT(pt.transaction_id) AS exchange_count,
              COALESCE(SUM(pt.points), 0) AS exchanged_points
       FROM services s
       LEFT JOIN point_transactions pt ON s.service_id = pt.service_id AND pt.type = 'exchange'
       GROUP BY s.service_id, s.service_name
       ORDER BY exchange_count DESC, s.service_id DESC`
    );

    res.json({
      total_users: userStats[0].total_users,
      active_events: eventStats[0].active_events,
      open_tickets: ticketStats[0].open_tickets,
      total_participations: participationStats[0].total_participations,
      total_granted_points: participationStats[0].total_granted_points,
      total_exchanges: exchangeStats[0].total_exchanges,
      total_exchanged_points: exchangeStats[0].total_exchanged_points,
      total_purchases: purchaseStats[0].total_purchases,
      total_purchased_points: purchaseStats[0].total_purchased_points,
      event_participants: eventParticipants,
      service_exchanges: serviceExchanges
    });
  } catch (error) {
    next(error);
  }
}

async function createNotification(req, res, next) {
  try {
    const { user_id, title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({ message: 'Notification title and body are required.' });
    }

    let targetUsers = [];
    if (user_id) {
      const [users] = await pool.query('SELECT user_id FROM users WHERE user_id = ?', [user_id]);
      targetUsers = users;
    } else {
      const [users] = await pool.query('SELECT user_id FROM users ORDER BY user_id ASC');
      targetUsers = users;
    }

    if (targetUsers.length === 0) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    for (const user of targetUsers) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, body)
         VALUES (?, ?, ?)`,
        [user.user_id, title, body]
      );
    }

    res.status(201).json({
      message: 'Notification created successfully.',
      delivered_count: targetUsers.length
    });
  } catch (error) {
    next(error);
  }
}

async function getSupportTickets(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT t.ticket_id, t.user_id, u.name AS user_name, u.email AS user_email,
              t.category, t.subject, t.body, t.status, t.admin_note, t.created_at, t.updated_at
       FROM support_tickets t
       LEFT JOIN users u ON t.user_id = u.user_id
       ORDER BY t.created_at DESC`
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function updateSupportTicket(req, res, next) {
  try {
    const { id } = req.params;
    const { status, admin_note } = req.body;

    if (status && !['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid support ticket status.' });
    }

    const [tickets] = await pool.query('SELECT * FROM support_tickets WHERE ticket_id = ?', [id]);
    if (tickets.length === 0) {
      return res.status(404).json({ message: 'Support ticket not found.' });
    }

    await pool.query(
      `UPDATE support_tickets
       SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE ticket_id = ?`,
      [
        status || tickets[0].status,
        admin_note === undefined ? tickets[0].admin_note : admin_note,
        id
      ]
    );

    res.json({ message: 'Support ticket updated successfully.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSystemConnection,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventSubmissions,
  getEventSubmission,
  approveEventSubmission,
  rejectEventSubmission,
  getEventParticipations,
  completeParticipationByAdmin,
  closeEventByAdmin,
  getStores,
  createStore,
  updateStore,
  deleteStore,
  getServicesAdmin,
  createService,
  updateService,
  deleteService,
  getUsers,
  getUserDetail,
  updateUser,
  getStats,
  createNotification,
  getSupportTickets,
  updateSupportTicket
};
