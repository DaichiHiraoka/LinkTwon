const pool = require('../config/db');
const { localizeRows } = require('../services/translationService');

function canAccessUser(req, userId) {
  return Number(req.user.id) === Number(userId) || req.user.role === 'admin';
}

async function assertUserAccess(req, res, userId, message) {
  if (!canAccessUser(req, userId)) {
    res.status(403).json({ message });
    return false;
  }

  return true;
}

async function ensureSettings(userId) {
  const [settings] = await pool.query('SELECT user_id FROM user_settings WHERE user_id = ?', [userId]);
  if (settings.length === 0) {
    await pool.query(
      `INSERT INTO user_settings (user_id, notification_enabled, language, font_size)
       VALUES (?, 1, 'ja', 'medium')`,
      [userId]
    );
  }
}

function getRequestLocale(req) {
  return req.query.locale === 'en' ? 'en' : 'ja';
}

async function localizeEventRows(rows, locale) {
  return locale === 'en'
    ? localizeRows(rows, { contentType: 'event', idField: 'event_id', fields: ['event_name', 'description'] }, locale)
    : rows;
}

async function localizeServiceRows(rows, locale) {
  return locale === 'en'
    ? localizeRows(rows, { contentType: 'service', idField: 'service_id', fields: ['service_name', 'description'] }, locale)
    : rows;
}

async function localizeNotificationRows(rows, locale) {
  return locale === 'en'
    ? localizeRows(rows, { contentType: 'notification', idField: 'notification_id', fields: ['title', 'body'] }, locale)
    : rows;
}

async function getUserPoints(req, res, next) {
  try {
    const { id } = req.params;

    if (!(await assertUserAccess(req, res, id, 'You can only view your own points.'))) {
      return;
    }

    const [users] = await pool.query(
      `SELECT user_id, name, email, points, age_group, user_type, email_verified_at
       FROM users
       WHERE user_id = ?`,
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json(users[0]);
  } catch (error) {
    next(error);
  }
}

async function getUserHistory(req, res, next) {
  try {
    const { id } = req.params;
    const locale = getRequestLocale(req);

    if (!(await assertUserAccess(req, res, id, 'You can only view your own history.'))) {
      return;
    }

    const [participations] = await pool.query(
      `SELECT p.participation_id, p.status, p.applied_at, p.checked_in_at,
              p.completed_at, p.cancelled_at, p.granted_points,
              e.event_id, e.event_name, e.event_datetime, e.event_end_datetime, e.location
       FROM participations p
       JOIN events e ON p.event_id = e.event_id
       WHERE p.user_id = ?
       ORDER BY p.applied_at DESC`,
      [id]
    );

    const [transactions] = await pool.query(
      `SELECT pt.transaction_id, pt.type, pt.points, pt.description, pt.created_at,
              s.service_id, s.service_name, st.store_name
       FROM point_transactions pt
       LEFT JOIN services s ON pt.service_id = s.service_id
       LEFT JOIN stores st ON s.store_id = st.store_id
       WHERE pt.user_id = ?
         AND (pt.participation_id IS NULL OR EXISTS (
           SELECT 1 FROM participations p
           WHERE p.participation_id = pt.participation_id AND p.status = 'completed'
         ))
       ORDER BY pt.created_at DESC`,
      [id]
    );

    const [purchases] = await pool.query(
      `SELECT purchase_id, payment_method_id, points, amount_yen, status, created_at
       FROM point_purchases
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      participations: await localizeEventRows(participations, locale),
      transactions: await localizeServiceRows(transactions, locale),
      purchases
    });
  } catch (error) {
    next(error);
  }
}

async function getUserPurchases(req, res, next) {
  try {
    const { id } = req.params;

    if (!(await assertUserAccess(req, res, id, 'You can only view your own purchases.'))) {
      return;
    }

    const [rows] = await pool.query(
      `SELECT p.purchase_id, p.payment_method_id, pm.label AS payment_method_label,
              p.points, p.amount_yen, p.status, p.created_at
       FROM point_purchases p
       LEFT JOIN payment_methods pm ON p.payment_method_id = pm.payment_method_id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
      [id]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function getLikedEvents(req, res, next) {
  try {
    const { id } = req.params;
    const locale = getRequestLocale(req);

    if (!(await assertUserAccess(req, res, id, 'You can only view your own liked events.'))) {
      return;
    }

    const [rows] = await pool.query(
      `SELECT e.event_id, e.event_name, e.event_datetime, e.location, e.grant_points,
              e.description, e.activity, e.notes, e.status, 1 AS liked, COUNT(el_all.like_id) AS like_count
       FROM event_likes el
       JOIN events e ON el.event_id = e.event_id
       LEFT JOIN event_likes el_all ON e.event_id = el_all.event_id
       WHERE el.user_id = ?
       GROUP BY e.event_id, e.event_name, e.event_datetime, e.location, e.grant_points,
                e.description, e.activity, e.notes, e.status
       ORDER BY el.created_at DESC`,
      [id]
    );

    res.json(await localizeEventRows(rows, locale));
  } catch (error) {
    next(error);
  }
}

async function getFavoriteServices(req, res, next) {
  try {
    const { id } = req.params;
    const locale = getRequestLocale(req);

    if (!(await assertUserAccess(req, res, id, 'You can only view your own favorite services.'))) {
      return;
    }

    const [rows] = await pool.query(
      `SELECT s.service_id, s.service_name, s.description, s.required_points, s.status,
              st.store_id, st.store_name, st.store_address, st.map_query, 1 AS favorited
       FROM service_favorites sf
       JOIN services s ON sf.service_id = s.service_id
       JOIN stores st ON s.store_id = st.store_id
       WHERE sf.user_id = ?
       ORDER BY sf.created_at DESC`,
      [id]
    );

    res.json(await localizeServiceRows(rows, locale));
  } catch (error) {
    next(error);
  }
}

async function updateEmail(req, res, next) {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!(await assertUserAccess(req, res, id, 'You can only update your own email.'))) {
      return;
    }

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const [existing] = await pool.query(
      'SELECT user_id FROM users WHERE email = ? AND user_id <> ?',
      [email, id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email is already registered.' });
    }

    const [result] = await pool.query('UPDATE users SET email = ? WHERE user_id = ?', [email, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ message: 'Email updated successfully.', email });
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;

    if (!(await assertUserAccess(req, res, id, 'You can only delete your own account.'))) {
      return;
    }

    const [result] = await pool.query('DELETE FROM users WHERE user_id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

async function getSettings(req, res, next) {
  try {
    const { id } = req.params;

    if (!(await assertUserAccess(req, res, id, 'You can only view your own settings.'))) {
      return;
    }

    await ensureSettings(id);

    const [settings] = await pool.query(
      `SELECT user_id, notification_enabled, language, font_size, updated_at
       FROM user_settings
       WHERE user_id = ?`,
      [id]
    );

    res.json(settings[0]);
  } catch (error) {
    next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const { id } = req.params;
    const { notification_enabled, language, font_size } = req.body;

    if (!(await assertUserAccess(req, res, id, 'You can only update your own settings.'))) {
      return;
    }

    if (font_size && !['small', 'medium', 'large'].includes(font_size)) {
      return res.status(400).json({ message: 'Invalid font size.' });
    }

    await ensureSettings(id);

    const [currentRows] = await pool.query('SELECT * FROM user_settings WHERE user_id = ?', [id]);
    const current = currentRows[0];

    await pool.query(
      `UPDATE user_settings
       SET notification_enabled = ?, language = ?, font_size = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [
        notification_enabled === undefined ? current.notification_enabled : Number(Boolean(notification_enabled)),
        language || current.language,
        font_size || current.font_size,
        id
      ]
    );

    const [settings] = await pool.query(
      `SELECT user_id, notification_enabled, language, font_size, updated_at
       FROM user_settings
       WHERE user_id = ?`,
      [id]
    );

    res.json(settings[0]);
  } catch (error) {
    next(error);
  }
}

async function getPaymentMethods(req, res, next) {
  try {
    const { id } = req.params;

    if (!(await assertUserAccess(req, res, id, 'You can only view your own payment methods.'))) {
      return;
    }

    const [rows] = await pool.query(
      `SELECT payment_method_id, label, brand, last4, is_default, created_at
       FROM payment_methods
       WHERE user_id = ?
       ORDER BY is_default DESC, payment_method_id DESC`,
      [id]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function addPaymentMethod(req, res, next) {
  try {
    const { id } = req.params;
    const { label, brand, last4, is_default } = req.body;

    if (!(await assertUserAccess(req, res, id, 'You can only update your own payment methods.'))) {
      return;
    }

    if (!label) {
      return res.status(400).json({ message: 'Payment method label is required.' });
    }

    if (is_default) {
      await pool.query('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?', [id]);
    }

    const [result] = await pool.query(
      `INSERT INTO payment_methods (user_id, label, brand, last4, is_default)
       VALUES (?, ?, ?, ?, ?)`,
      [id, label, brand || 'mock', last4 || '0000', is_default ? 1 : 0]
    );

    res.status(201).json({
      message: 'Payment method added successfully.',
      payment_method_id: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

async function deletePaymentMethod(req, res, next) {
  try {
    const { id, paymentMethodId } = req.params;

    if (!(await assertUserAccess(req, res, id, 'You can only update your own payment methods.'))) {
      return;
    }

    const [result] = await pool.query(
      'DELETE FROM payment_methods WHERE payment_method_id = ? AND user_id = ?',
      [paymentMethodId, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Payment method not found.' });
    }

    res.json({ message: 'Payment method deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

async function getNotifications(req, res, next) {
  try {
    const { id } = req.params;
    const locale = getRequestLocale(req);

    if (!(await assertUserAccess(req, res, id, 'You can only view your own notifications.'))) {
      return;
    }

    const [rows] = await pool.query(
      `SELECT notification_id, title, body, read_at, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    res.json(await localizeNotificationRows(rows, locale));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUserPoints,
  getUserHistory,
  getUserPurchases,
  getLikedEvents,
  getFavoriteServices,
  updateEmail,
  deleteUser,
  getSettings,
  updateSettings,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  getNotifications
};
