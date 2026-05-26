const pool = require('../config/db');

async function getEvents(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT event_id, event_name, event_datetime, location, grant_points
       FROM events
       ORDER BY event_datetime DESC`
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function participateInEvent(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const userId = req.user.id;
    const { event_id } = req.body;

    if (!event_id) {
      return res.status(400).json({ message: 'Event ID is required.' });
    }

    await connection.beginTransaction();

    const [events] = await connection.query(
      'SELECT * FROM events WHERE event_id = ?',
      [event_id]
    );

    if (events.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid event ID.' });
    }

    const event = events[0];

    const [existing] = await connection.query(
      `SELECT participation_id
       FROM participations
       WHERE user_id = ? AND event_id = ?`,
      [userId, event_id]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'You have already participated in this event.' });
    }

    await connection.query(
      `INSERT INTO participations (user_id, event_id, granted_points)
       VALUES (?, ?, ?)`,
      [userId, event_id, event.grant_points]
    );

    await connection.query(
      `UPDATE users
       SET points = points + ?
       WHERE user_id = ?`,
      [event.grant_points, userId]
    );

    await connection.query(
      `INSERT INTO point_transactions (user_id, type, points, description)
       VALUES (?, 'grant', ?, ?)`,
      [userId, event.grant_points, `Points granted for event: ${event.event_name}`]
    );

    const [updatedUsers] = await connection.query(
      'SELECT user_id, points FROM users WHERE user_id = ?',
      [userId]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Event participation registered successfully.',
      event_id,
      granted_points: event.grant_points,
      current_points: updatedUsers[0].points
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

module.exports = {
  getEvents,
  participateInEvent
};
