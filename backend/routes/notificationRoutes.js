const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { markNotificationRead } = require('../controllers/notificationController');

router.put('/:id/read', authenticateToken, markNotificationRead);

module.exports = router;
