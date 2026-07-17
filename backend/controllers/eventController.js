const pool = require('../config/db');
const { localizeRows } = require('../services/translationService');
const { addParticipationHistory } = require('../services/eventLifecycleService');

async function getEvents(req, res, next) {
  try {
    const userId = req.user.id;
    const locale = req.query.locale === 'en' ? 'en' : 'ja';
    const [rows] = await pool.query(
      `SELECT e.event_id, e.event_name, e.event_datetime, e.event_end_datetime, e.location, e.grant_points,
              e.description, e.activity, e.notes, e.status,
              p.status AS participation_status,
              p.applied_at, p.checked_in_at, p.completed_at, p.granted_points,
              CASE WHEN el_self.like_id IS NULL THEN 0 ELSE 1 END AS liked,
              COUNT(el_all.like_id) AS like_count
       FROM events e
       LEFT JOIN participations p ON e.event_id = p.event_id AND p.user_id = ?
       LEFT JOIN event_likes el_self ON e.event_id = el_self.event_id AND el_self.user_id = ?
       LEFT JOIN event_likes el_all ON e.event_id = el_all.event_id
       WHERE e.status = 'active' OR p.participation_id IS NOT NULL
       GROUP BY e.event_id, e.event_name, e.event_datetime, e.event_end_datetime, e.location, e.grant_points,
                e.description, e.activity, e.notes, e.status, p.status, p.applied_at,
                p.checked_in_at, p.completed_at, p.granted_points, el_self.like_id
       ORDER BY e.event_datetime DESC`,
      [userId, userId]
    );
    const localizedRows =
      locale === 'en'
        ? await localizeRows(rows, { contentType: 'event', idField: 'event_id', fields: ['event_name', 'description'] }, locale)
        : rows;

    res.json(localizedRows);
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
      `SELECT *
       FROM events
       WHERE event_id = ? AND status = 'active'`,
      [event_id]
    );

    if (events.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid event ID.' });
    }

    const [existing] = await connection.query(
      'SELECT participation_id, status FROM participations WHERE user_id = ? AND event_id = ? FOR UPDATE',
      [userId, event_id]
    );
    if (existing.length > 0 && existing[0].status !== 'cancelled') {
      await connection.rollback();
      return res.status(409).json({ message: 'You have already applied for this event.' });
    }

    let participationId;
    if (existing.length > 0) {
      participationId = existing[0].participation_id;
      await connection.query(
        `UPDATE participations
         SET status = 'applied', grant_points_snapshot = ?, granted_points = 0,
             applied_at = CURRENT_TIMESTAMP, cancelled_at = NULL
         WHERE participation_id = ?`,
        [events[0].grant_points, participationId]
      );
      await addParticipationHistory(connection, participationId, 'cancelled', 'applied', {
        reason: 'User reapplied',
        actorType: 'user',
        actorId: userId
      });
    } else {
      const [insertResult] = await connection.query(
        `INSERT INTO participations
           (user_id, event_id, status, grant_points_snapshot, granted_points, applied_at)
         VALUES (?, ?, 'applied', ?, 0, CURRENT_TIMESTAMP)`,
        [userId, event_id, events[0].grant_points]
      );
      participationId = insertResult.insertId;
      await addParticipationHistory(connection, participationId, null, 'applied', {
        reason: 'User applied',
        actorType: 'user',
        actorId: userId
      });
    }

    await connection.commit();
    res.status(201).json({
      message: 'Event application registered successfully.',
      event_id: Number(event_id),
      participation_id: participationId,
      participation_status: 'applied'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

async function cancelEventParticipation(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const userId = req.user.id;
    const { id } = req.params;

    await connection.beginTransaction();

    const [participations] = await connection.query(
      `SELECT p.participation_id, p.status
       FROM participations p
       WHERE p.user_id = ? AND p.event_id = ?`,
      [userId, id]
    );

    if (participations.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Event participation not found.' });
    }

    const participation = participations[0];
    if (participation.status !== 'applied') {
      await connection.rollback();
      return res.status(409).json({ message: 'Only an applied event can be cancelled.' });
    }
    await connection.query(
      `UPDATE participations
       SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
       WHERE participation_id = ?`,
      [participation.participation_id]
    );
    await addParticipationHistory(connection, participation.participation_id, 'applied', 'cancelled', {
      reason: 'User cancelled application',
      actorType: 'user',
      actorId: userId
    });

    await connection.commit();
    res.json({
      message: 'Event participation cancelled successfully.',
      event_id: Number(id),
      participation_status: 'cancelled'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

async function likeEvent(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [events] = await pool.query(
      `SELECT event_id
       FROM events
       WHERE event_id = ? AND status = 'active'`,
      [id]
    );

    if (events.length === 0) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const [existing] = await pool.query(
      'SELECT like_id FROM event_likes WHERE user_id = ? AND event_id = ?',
      [userId, id]
    );

    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO event_likes (user_id, event_id)
         VALUES (?, ?)`,
        [userId, id]
      );
    }

    res.status(201).json({ message: 'Event liked successfully.', event_id: Number(id), liked: true });
  } catch (error) {
    next(error);
  }
}

async function unlikeEvent(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await pool.query(
      'DELETE FROM event_likes WHERE user_id = ? AND event_id = ?',
      [userId, id]
    );

    res.json({ message: 'Event unliked successfully.', event_id: Number(id), liked: false });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getEvents,
  participateInEvent,
  cancelEventParticipation,
  likeEvent,
  unlikeEvent
};
