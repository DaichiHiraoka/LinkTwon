const pool = require('../config/db');

async function getServices(req, res, next) {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT s.service_id, s.service_name, s.required_points, s.status,
              st.store_id, st.store_name,
              CASE WHEN sf.favorite_id IS NULL THEN 0 ELSE 1 END AS favorited
       FROM services s
       JOIN stores st ON s.store_id = st.store_id
       LEFT JOIN service_favorites sf ON s.service_id = sf.service_id AND sf.user_id = ?
       WHERE s.status = 'active' AND st.status = 'active'
       ORDER BY s.service_id DESC`,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
}

async function exchangePoints(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const userId = req.user.id;
    const { service_id } = req.body;

    if (!service_id) {
      return res.status(400).json({ message: 'Service ID is required.' });
    }

    await connection.beginTransaction();

    const [services] = await connection.query(
      `SELECT s.*, st.store_name
       FROM services s
       JOIN stores st ON s.store_id = st.store_id
       WHERE s.service_id = ? AND s.status = 'active' AND st.status = 'active'`,
      [service_id]
    );

    if (services.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid service ID.' });
    }

    const service = services[0];

    const [users] = await connection.query(
      'SELECT user_id, points FROM users WHERE user_id = ? FOR UPDATE',
      [userId]
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = users[0];

    if (user.points < service.required_points) {
      await connection.rollback();
      return res.status(400).json({ message: 'Not enough points.' });
    }

    await connection.query(
      `UPDATE users
       SET points = points - ?
       WHERE user_id = ?`,
      [service.required_points, userId]
    );

    await connection.query(
      `INSERT INTO point_transactions (user_id, service_id, type, points, description)
       VALUES (?, ?, 'exchange', ?, ?)`,
      [
        userId,
        service_id,
        service.required_points,
        `Exchanged points for ${service.service_name} at ${service.store_name}`
      ]
    );

    const currentPoints = user.points - service.required_points;

    await connection.commit();

    res.json({
      message: 'Point exchange completed successfully.',
      service_id,
      service_name: service.service_name,
      used_points: service.required_points,
      current_points: currentPoints
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

async function purchasePoints(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const userId = req.user.id;
    const { points, payment_method_id, simulate_status } = req.body;
    const purchasePointsValue = Number(points);
    const status = simulate_status || 'paid';

    if (!Number.isInteger(purchasePointsValue) || purchasePointsValue <= 0) {
      return res.status(400).json({ message: 'Positive integer points are required.' });
    }

    if (!['pending', 'paid', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid purchase status.' });
    }

    await connection.beginTransaction();

    if (payment_method_id) {
      const [paymentMethods] = await connection.query(
        'SELECT payment_method_id FROM payment_methods WHERE payment_method_id = ? AND user_id = ?',
        [payment_method_id, userId]
      );

      if (paymentMethods.length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'Invalid payment method.' });
      }
    }

    const amountYen = purchasePointsValue;
    const [result] = await connection.query(
      `INSERT INTO point_purchases (user_id, payment_method_id, points, amount_yen, status)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, payment_method_id || null, purchasePointsValue, amountYen, status]
    );

    if (status === 'paid') {
      await connection.query(
        `UPDATE users
         SET points = points + ?
         WHERE user_id = ?`,
        [purchasePointsValue, userId]
      );
    }

    const [users] = await connection.query('SELECT points FROM users WHERE user_id = ?', [userId]);

    await connection.commit();

    res.status(201).json({
      message: status === 'paid' ? 'Point purchase completed successfully.' : 'Point purchase recorded without adding points.',
      purchase_id: result.insertId,
      points: purchasePointsValue,
      amount_yen: amountYen,
      status,
      current_points: users[0].points
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

async function favoriteService(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [services] = await pool.query(
      `SELECT s.service_id
       FROM services s
       JOIN stores st ON s.store_id = st.store_id
       WHERE s.service_id = ? AND s.status = 'active' AND st.status = 'active'`,
      [id]
    );

    if (services.length === 0) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    const [existing] = await pool.query(
      'SELECT favorite_id FROM service_favorites WHERE user_id = ? AND service_id = ?',
      [userId, id]
    );

    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO service_favorites (user_id, service_id)
         VALUES (?, ?)`,
        [userId, id]
      );
    }

    res.status(201).json({ message: 'Service favorited successfully.', service_id: Number(id), favorited: true });
  } catch (error) {
    next(error);
  }
}

async function unfavoriteService(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await pool.query(
      'DELETE FROM service_favorites WHERE user_id = ? AND service_id = ?',
      [userId, id]
    );

    res.json({ message: 'Service unfavorited successfully.', service_id: Number(id), favorited: false });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getServices,
  exchangePoints,
  purchasePoints,
  favoriteService,
  unfavoriteService
};
