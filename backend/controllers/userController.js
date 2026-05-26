const pool = require('../config/db');

async function getUserPoints(req, res, next) {
  try {
    const { id } = req.params;

    if (Number(req.user.id) !== Number(id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only view your own points.' });
    }

    const [users] = await pool.query(
      `SELECT user_id, name, email, points, age_group, user_type
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

    if (Number(req.user.id) !== Number(id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only view your own history.' });
    }

    const [participations] = await pool.query(
      `SELECT p.participation_id, p.participated_at, p.granted_points,
              e.event_id, e.event_name, e.event_datetime, e.location
       FROM participations p
       JOIN events e ON p.event_id = e.event_id
       WHERE p.user_id = ?
       ORDER BY p.participated_at DESC`,
      [id]
    );

    const [transactions] = await pool.query(
      `SELECT pt.transaction_id, pt.type, pt.points, pt.created_at,
              s.service_id, s.service_name, st.store_name
       FROM point_transactions pt
       LEFT JOIN services s ON pt.service_id = s.service_id
       LEFT JOIN stores st ON s.store_id = st.store_id
       WHERE pt.user_id = ?
       ORDER BY pt.created_at DESC`,
      [id]
    );

    res.json({
      participations,
      transactions
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUserPoints,
  getUserHistory
};
