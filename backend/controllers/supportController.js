const pool = require('../config/db');

async function createSupportTicket(req, res, next) {
  try {
    const { category, subject, body } = req.body;
    const ticketCategory = category || 'support';

    if (!subject || !body) {
      return res.status(400).json({ message: 'Subject and body are required.' });
    }

    if (!['support', 'bug'].includes(ticketCategory)) {
      return res.status(400).json({ message: 'Invalid support ticket category.' });
    }

    const userId = req.user.role === 'user' ? req.user.id : null;
    const [result] = await pool.query(
      `INSERT INTO support_tickets (user_id, category, subject, body, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [userId, ticketCategory, subject, body]
    );

    res.status(201).json({
      message: 'Support ticket created successfully.',
      ticket_id: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

async function getMySupportTickets(req, res, next) {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'Only users can view their own support tickets here.' });
    }

    const [rows] = await pool.query(
      `SELECT ticket_id, category, subject, body, status, admin_note, created_at, updated_at
       FROM support_tickets
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createSupportTicket,
  getMySupportTickets
};
