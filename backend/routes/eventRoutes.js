const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  getEvents,
  participateInEvent,
  cancelEventParticipation,
  likeEvent,
  unlikeEvent
} = require('../controllers/eventController');

router.get('/', authenticateToken, getEvents);
router.post('/participate', authenticateToken, participateInEvent);
router.delete('/:id/participation', authenticateToken, cancelEventParticipation);
router.post('/:id/like', authenticateToken, likeEvent);
router.delete('/:id/like', authenticateToken, unlikeEvent);

module.exports = router;
