const pool = require('../config/db');

async function markNotificationRead(req, res, next) {
  try {
    const { id } = req.params;
    const [notifications] = await pool.query(
      'SELECT notification_id, user_id FROM notifications WHERE notification_id = ?',
      [id]
    );

    if (notifications.length === 0) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    if (req.user.role !== 'admin' && Number(notifications[0].user_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'You can only update your own notifications.' });
    }

    await pool.query(
      `UPDATE notifications
       SET read_at = CURRENT_TIMESTAMP
       WHERE notification_id = ?`,
      [id]
    );

    res.json({ message: 'Notification marked as read.', notification_id: Number(id) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  markNotificationRead
};
