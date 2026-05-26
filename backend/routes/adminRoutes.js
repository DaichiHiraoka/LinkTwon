const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');
const {
  getEvents,
  createEvent,
  updateEvent,
  getStores,
  createStore,
  updateStore,
  getServicesAdmin,
  createService,
  getStats
} = require('../controllers/adminController');

router.use(authenticateToken, authorizeRole('admin'));

router.get('/events', getEvents);
router.post('/events', createEvent);
router.put('/events/:id', updateEvent);

router.get('/stores', getStores);
router.post('/stores', createStore);
router.put('/stores/:id', updateStore);

router.get('/services', getServicesAdmin);
router.post('/services', createService);

router.get('/stats', getStats);

module.exports = router;
