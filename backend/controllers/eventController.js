const pool = require('../config/db');
const { localizeRows } = require('../services/translationService');

async function getEvents(req, res, next) {
  try {
    const userId = req.user.id;
    const locale = req.query.locale === 'en' ? 'en' : 'ja';
    const [rows] = await pool.query(
      `SELECT e.event_id, e.event_name, e.event_datetime, e.location, e.grant_points,
              e.status,
              CASE WHEN el_self.like_id IS NULL THEN 0 ELSE 1 END AS liked,
              COUNT(el_all.like_id) AS like_count
       FROM events e
       LEFT JOIN event_likes el_self ON e.event_id = el_self.event_id AND el_self.user_id = ?
       LEFT JOIN event_likes el_all ON e.event_id = el_all.event_id
       WHERE e.status = 'active'
       GROUP BY e.event_id, e.event_name, e.event_datetime, e.location, e.grant_points, e.status, el_self.like_id
       ORDER BY e.event_datetime DESC`,
      [userId]
    );
    const localizedRows =
      locale === 'en'
        ? await localizeRows(rows, { contentType: 'event', idField: 'event_id', fields: ['event_name', 'location'] }, locale)
        : rows;

    res.json(localizedRows);
  } catch (error) {
    next(error);
  }
}

async function completeParticipation(connection, userId, event) {
  const [existing] = await connection.query(
    `SELECT participation_id
     FROM participations
     WHERE user_id = ? AND event_id = ?`,
    [userId, event.event_id]
  );

  if (existing.length > 0) {
    return {
      status: 400,
      body: { message: 'You have already participated in this event.' }
    };
  }

  await connection.query(
    `INSERT INTO participations (user_id, event_id, granted_points)
     VALUES (?, ?, ?)`,
    [userId, event.event_id, event.grant_points]
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

  return {
    status: 201,
    body: {
      message: 'Event participation registered successfully.',
      event_id: event.event_id,
      granted_points: event.grant_points,
      current_points: updatedUsers[0].points
    }
  };
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

    const result = await completeParticipation(connection, userId, events[0]);

    if (result.status >= 400) {
      await connection.rollback();
      return res.status(result.status).json(result.body);
    }

    await connection.commit();
    res.status(result.status).json(result.body);
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
      `SELECT p.participation_id, p.granted_points, e.event_name
       FROM participations p
       JOIN events e ON p.event_id = e.event_id
       WHERE p.user_id = ? AND p.event_id = ?`,
      [userId, id]
    );

    if (participations.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Event participation not found.' });
    }

    const participation = participations[0];

    await connection.query(
      `DELETE FROM participations
       WHERE participation_id = ?`,
      [participation.participation_id]
    );

    await connection.query(
      `UPDATE users
       SET points = CASE WHEN points >= ? THEN points - ? ELSE 0 END
       WHERE user_id = ?`,
      [participation.granted_points, participation.granted_points, userId]
    );

    await connection.query(
      `INSERT INTO point_transactions (user_id, type, points, description)
       VALUES (?, 'grant', ?, ?)`,
      [userId, -participation.granted_points, `Points revoked for cancelled event: ${participation.event_name}`]
    );

    const [updatedUsers] = await connection.query(
      'SELECT user_id, points FROM users WHERE user_id = ?',
      [userId]
    );

    await connection.commit();
    res.json({
      message: 'Event participation cancelled successfully.',
      event_id: Number(id),
      revoked_points: participation.granted_points,
      current_points: updatedUsers[0].points
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

async function checkInEvent(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const userId = req.user.id;
    const { check_in_code } = req.body;

    if (!check_in_code) {
      return res.status(400).json({ message: 'Check-in code is required.' });
    }

    await connection.beginTransaction();

    const [tokens] = await connection.query(
      `SELECT t.token_id, t.event_id, e.event_name, e.event_datetime, e.location, e.grant_points, e.status
       FROM event_checkin_tokens t
       JOIN events e ON t.event_id = e.event_id
       WHERE t.check_in_code = ?
         AND t.is_active = 1
         AND t.expires_at >= CURRENT_TIMESTAMP
         AND e.status = 'active'`,
      [check_in_code]
    );

    if (tokens.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid or expired check-in code.' });
    }

    const result = await completeParticipation(connection, userId, tokens[0]);

    if (result.status >= 400) {
      await connection.rollback();
      return res.status(result.status).json(result.body);
    }

    await connection.commit();
    res.status(result.status).json({
      ...result.body,
      check_in_code
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
  checkInEvent,
  likeEvent,
  unlikeEvent
};
