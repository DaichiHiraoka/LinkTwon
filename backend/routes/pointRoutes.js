const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getServices,
  exchangePoints
} = require('../controllers/pointController');

router.get('/services', authenticateToken, getServices);
router.post('/exchange', authenticateToken, exchangePoints);

module.exports = router;
