const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  createSupportTicket,
  getMySupportTickets
} = require('../controllers/supportController');

router.get('/tickets', authenticateToken, getMySupportTickets);
router.post('/tickets', authenticateToken, createSupportTicket);

module.exports = router;
