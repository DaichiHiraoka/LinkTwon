const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getEvents,
  participateInEvent
} = require('../controllers/eventController');

router.get('/', authenticateToken, getEvents);
router.post('/participate', authenticateToken, participateInEvent);

module.exports = router;
