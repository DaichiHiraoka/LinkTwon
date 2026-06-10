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

const app = express();

function normalizeOrigin(origin) {
  try {
    return new URL(origin).origin;
  } catch (error) {
    return origin.replace(/\/$/, '');
  }
}

function compileOriginPattern(pattern) {
  try {
    return new RegExp(pattern);
  } catch (error) {
    console.warn(`Ignoring invalid FRONTEND_ORIGIN_PATTERNS entry: ${pattern}`);
    return null;
  }
}

const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

const allowedOriginPatterns = (process.env.FRONTEND_ORIGIN_PATTERNS || '')
  .split(',')
  .map((pattern) => pattern.trim())
  .filter(Boolean)
  .map(compileOriginPattern)
  .filter(Boolean);

function isAllowedOrigin(origin) {
  const normalizedOrigin = normalizeOrigin(origin);
  return allowedOrigins.includes(normalizedOrigin) || allowedOriginPatterns.some((pattern) => pattern.test(normalizedOrigin));
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || (allowedOrigins.length === 0 && allowedOriginPatterns.length === 0) || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
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
