const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const eventRoutes = require('./routes/eventRoutes');
const pointRoutes = require('./routes/pointRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const supportRoutes = require('./routes/supportRoutes');
const { errorHandler } = require('./middlewares/errorMiddleware');
const { env } = require('./config/env');

const app = express();

function isAllowedOrigin(origin) {
  const normalizedOrigin = new URL(origin).origin;
  return env.FRONTEND_ORIGINS.includes(normalizedOrigin) || env.FRONTEND_ORIGIN_PATTERNS.some((pattern) => pattern.test(normalizedOrigin));
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    try {
      callback(null, isAllowedOrigin(origin));
    } catch (error) {
      callback(null, false);
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Link Town Backend API is running.' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/events', eventRoutes);
app.use('/points', pointRoutes);
app.use('/admin', adminRoutes);
app.use('/notifications', notificationRoutes);
app.use('/support', supportRoutes);

app.use(errorHandler);

module.exports = app;
