const pool = require('../config/db');

async function getServices(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT s.service_id, s.service_name, s.required_points,
              st.store_id, st.store_name
       FROM services s
       JOIN stores st ON s.store_id = st.store_id
       ORDER BY s.service_id DESC`
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
       WHERE s.service_id = ?`,
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

module.exports = {
  getServices,
  exchangePoints
};
