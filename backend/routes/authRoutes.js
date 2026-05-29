const express = require('express');
const router = express.Router();
const {
  register,
  login,
  adminLogin,
  requestPasswordReset,
  resetPassword,
  changePassword
} = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { rateLimit } = require('../middlewares/rateLimitMiddleware');

const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/admin/login', authLimiter, adminLogin);
router.post('/password/reset-request', authLimiter, requestPasswordReset);
router.post('/password/reset', authLimiter, resetPassword);
router.put('/password', authenticateToken, changePassword);

module.exports = router;
