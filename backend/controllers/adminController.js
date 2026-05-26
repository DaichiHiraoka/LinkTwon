const pool = require('../config/db');

async function getEvents(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM events ORDER BY event_datetime DESC');
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function createEvent(req, res, next) {
  try {
    const { event_name, event_datetime, location, grant_points } = req.body;

    const [result] = await pool.query(
      `INSERT INTO events (event_name, event_datetime, location, grant_points)
       VALUES (?, ?, ?, ?)`,
      [event_name, event_datetime, location, grant_points]
    );

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
    const { event_name, event_datetime, location, grant_points } = req.body;

    await pool.query(
      `UPDATE events
       SET event_name = ?, event_datetime = ?, location = ?, grant_points = ?
       WHERE event_id = ?`,
      [event_name, event_datetime, location, grant_points, id]
    );

    res.json({ message: 'Event updated successfully.' });
  } catch (error) {
    next(error);
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
    const { store_name } = req.body;

    const [result] = await pool.query(
      `INSERT INTO stores (store_name) VALUES (?)`,
      [store_name]
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
    const { store_name } = req.body;

    await pool.query(
      `UPDATE stores SET store_name = ? WHERE store_id = ?`,
      [store_name, id]
    );

    res.json({ message: 'Store updated successfully.' });
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
    const { store_id, service_name, required_points } = req.body;

    const [result] = await pool.query(
      `INSERT INTO services (store_id, service_name, required_points)
       VALUES (?, ?, ?)`,
      [store_id, service_name, required_points]
    );

    res.status(201).json({
      message: 'Service created successfully.',
      service_id: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

async function getStats(req, res, next) {
  try {
    const [participationStats] = await pool.query(
      `SELECT COUNT(*) AS total_participations FROM participations`
    );

    const [pointStats] = await pool.query(
      `SELECT COALESCE(SUM(granted_points), 0) AS total_granted_points FROM participations`
    );

    const [exchangeStats] = await pool.query(
      `SELECT COUNT(*) AS total_exchanges
       FROM point_transactions
       WHERE type = 'exchange'`
    );

    res.json({
      total_participations: participationStats[0].total_participations,
      total_granted_points: pointStats[0].total_granted_points,
      total_exchanges: exchangeStats[0].total_exchanges
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getEvents,
  createEvent,
  updateEvent,
  getStores,
  createStore,
  updateStore,
  getServicesAdmin,
  createService,
  getStats
};
