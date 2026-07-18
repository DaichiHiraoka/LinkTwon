const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');
const {
  getSystemConnection,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventSubmissions,
  getEventSubmission,
  approveEventSubmission,
  rejectEventSubmission,
  getEventParticipations,
  completeParticipationByAdmin,
  closeEventByAdmin,
  getStores,
  createStore,
  updateStore,
  deleteStore,
  getServicesAdmin,
  createService,
  updateService,
  deleteService,
  getUsers,
  getUserDetail,
  updateUser,
  getStats,
  createNotification,
  getSupportTickets,
  updateSupportTicket
} = require('../controllers/adminController');

router.use(authenticateToken, authorizeRole('admin'));

router.get('/system/connection', getSystemConnection);
router.get('/events', getEvents);
router.post('/events', createEvent);
router.get('/events/:id/participations', getEventParticipations);
router.post('/events/:id/close', closeEventByAdmin);
router.put('/events/:id', updateEvent);
router.delete('/events/:id', deleteEvent);

router.get('/event-submissions', getEventSubmissions);
router.get('/event-submissions/:id', getEventSubmission);
router.post('/event-submissions/:id/approve', approveEventSubmission);
router.post('/event-submissions/:id/reject', rejectEventSubmission);
router.post('/participations/:id/complete', completeParticipationByAdmin);

router.get('/stores', getStores);
router.post('/stores', createStore);
router.put('/stores/:id', updateStore);
router.delete('/stores/:id', deleteStore);

router.get('/services', getServicesAdmin);
router.post('/services', createService);
router.put('/services/:id', updateService);
router.delete('/services/:id', deleteService);

router.get('/users', getUsers);
router.get('/users/:id', getUserDetail);
router.put('/users/:id', updateUser);

router.post('/notifications', createNotification);

router.get('/support/tickets', getSupportTickets);
router.put('/support/tickets/:id', updateSupportTicket);

router.get('/stats', getStats);

module.exports = router;
