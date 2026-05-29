const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getUserPoints,
  getUserHistory,
  getUserPurchases,
  getLikedEvents,
  getFavoriteServices,
  updateEmail,
  deleteUser,
  getSettings,
  updateSettings,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  getNotifications
} = require('../controllers/userController');

router.get('/:id/points', authenticateToken, getUserPoints);
router.get('/:id/history', authenticateToken, getUserHistory);
router.get('/:id/purchases', authenticateToken, getUserPurchases);
router.get('/:id/liked-events', authenticateToken, getLikedEvents);
router.get('/:id/favorite-services', authenticateToken, getFavoriteServices);
router.put('/:id/email', authenticateToken, updateEmail);
router.delete('/:id', authenticateToken, deleteUser);
router.get('/:id/settings', authenticateToken, getSettings);
router.put('/:id/settings', authenticateToken, updateSettings);
router.get('/:id/payment-methods', authenticateToken, getPaymentMethods);
router.post('/:id/payment-methods', authenticateToken, addPaymentMethod);
router.delete('/:id/payment-methods/:paymentMethodId', authenticateToken, deletePaymentMethod);
router.get('/:id/notifications', authenticateToken, getNotifications);

module.exports = router;
