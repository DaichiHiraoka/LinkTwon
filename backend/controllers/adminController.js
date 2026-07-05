const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

function isValidStatus(status) {
  return ['active', 'paused'].includes(status);
}

function generateCheckInCode(eventId) {
  return `EVT-${eventId}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function ensureEventCheckInCode(eventId) {
  const [tokens] = await pool.query(
    `SELECT token_id, check_in_code, expires_at
     FROM event_checkin_tokens
     WHERE event_id = ? AND is_active = 1
     ORDER BY token_id DESC`,
    [eventId]
  );

  if (tokens.length > 0) {
    return tokens[0];
  }

  const code = generateCheckInCode(eventId);
  const [result] = await pool.query(
    `INSERT INTO event_checkin_tokens (event_id, check_in_code, expires_at, is_active)
     VALUES (?, ?, '2030-12-31 23:59:59', 1)`,
    [eventId, code]
  );

  return {
    token_id: result.insertId,
    check_in_code: code,
    expires_at: '2030-12-31 23:59:59'
  };
}

async function getEvents(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, t.check_in_code, t.expires_at AS check_in_expires_at
       FROM events e
       LEFT JOIN event_checkin_tokens t ON e.event_id = t.event_id AND t.is_active = 1
       ORDER BY e.event_datetime DESC`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function createEvent(req, res, next) {
  try {
    const { event_name, event_datetime, location, grant_points, status } = req.body;
    const eventStatus = status || 'active';

    if (!event_name || !event_datetime) {
      return res.status(400).json({ message: 'Event name and datetime are required.' });
    }

    if (!isValidStatus(eventStatus)) {
      return res.status(400).json({ message: 'Invalid event status.' });
    }

    const [result] = await pool.query(
      `INSERT INTO events (event_name, event_datetime, location, grant_points, status)
       VALUES (?, ?, ?, ?, ?)`,
      [event_name, event_datetime, location || null, Number(grant_points || 0), eventStatus]
    );

    const token = await ensureEventCheckInCode(result.insertId);

    res.status(201).json({
      message: 'Event created successfully.',
      event_id: result.insertId,
      check_in_code: token.check_in_code
    });
  } catch (error) {
    next(error);
  }
}

async function updateEvent(req, res, next) {
  try {
    const { id } = req.params;
    const { event_name, event_datetime, location, grant_points, status } = req.body;

    const [events] = await pool.query('SELECT * FROM events WHERE event_id = ?', [id]);
    if (events.length === 0) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const eventStatus = status || events[0].status || 'active';
    if (!isValidStatus(eventStatus)) {
      return res.status(400).json({ message: 'Invalid event status.' });
    }

    await pool.query(
      `UPDATE events
       SET event_name = ?, event_datetime = ?, location = ?, grant_points = ?, status = ?
       WHERE event_id = ?`,
      [
        event_name || events[0].event_name,
        event_datetime || events[0].event_datetime,
        location === undefined ? events[0].location : location,
        grant_points === undefined ? events[0].grant_points : Number(grant_points),
        eventStatus,
        id
      ]
    );

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

async function getEventCheckInCode(req, res, next) {
  try {
    const { id } = req.params;
    const [events] = await pool.query('SELECT event_id FROM events WHERE event_id = ?', [id]);

    if (events.length === 0) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const token = await ensureEventCheckInCode(id);
    res.json({
      event_id: Number(id),
      check_in_code: token.check_in_code,
      expires_at: token.expires_at
    });
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
    const { store_name, status } = req.body;
    const storeStatus = status || 'active';

    if (!store_name) {
      return res.status(400).json({ message: 'Store name is required.' });
    }

    if (!isValidStatus(storeStatus)) {
      return res.status(400).json({ message: 'Invalid store status.' });
    }

    const [result] = await pool.query(
      `INSERT INTO stores (store_name, status) VALUES (?, ?)`,
      [store_name, storeStatus]
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
    const { store_name, status } = req.body;

    const [stores] = await pool.query('SELECT * FROM stores WHERE store_id = ?', [id]);
    if (stores.length === 0) {
      return res.status(404).json({ message: 'Store not found.' });
    }

    const storeStatus = status || stores[0].status || 'active';
    if (!isValidStatus(storeStatus)) {
      return res.status(400).json({ message: 'Invalid store status.' });
    }

    await pool.query(
      `UPDATE stores SET store_name = ?, status = ? WHERE store_id = ?`,
      [store_name || stores[0].store_name, storeStatus, id]
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
    const { store_id, service_name, required_points, status } = req.body;
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
      `INSERT INTO services (store_id, service_name, required_points, status)
       VALUES (?, ?, ?, ?)`,
      [store_id, service_name, Number(required_points || 0), serviceStatus]
    );

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
    const { store_id, service_name, required_points, status } = req.body;

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

    await pool.query(
      `UPDATE services
       SET store_id = ?, service_name = ?, required_points = ?, status = ?
       WHERE service_id = ?`,
      [
        store_id || services[0].store_id,
        service_name || services[0].service_name,
        required_points === undefined ? services[0].required_points : Number(required_points),
        serviceStatus,
        id
      ]
    );

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
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventCheckInCode,
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
