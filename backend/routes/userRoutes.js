const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getUserPoints,
  getUserHistory
} = require('../controllers/userController');

router.get('/:id/points', authenticateToken, getUserPoints);
router.get('/:id/history', authenticateToken, getUserHistory);

module.exports = router;
