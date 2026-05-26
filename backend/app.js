const express = require('express');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const eventRoutes = require('./routes/eventRoutes');
const pointRoutes = require('./routes/pointRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { errorHandler } = require('./middlewares/errorMiddleware');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Link Town Backend API is running.' });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/events', eventRoutes);
app.use('/points', pointRoutes);
app.use('/admin', adminRoutes);

app.use(errorHandler);

module.exports = app;
