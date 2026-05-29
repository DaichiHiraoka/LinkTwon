const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getServices,
  exchangePoints,
  purchasePoints,
  favoriteService,
  unfavoriteService
} = require('../controllers/pointController');

router.get('/services', authenticateToken, getServices);
router.post('/services/:id/favorite', authenticateToken, favoriteService);
router.delete('/services/:id/favorite', authenticateToken, unfavoriteService);
router.post('/exchange', authenticateToken, exchangePoints);
router.post('/purchase', authenticateToken, purchasePoints);

module.exports = router;
