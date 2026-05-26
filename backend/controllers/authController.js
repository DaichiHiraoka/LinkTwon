const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { generateToken } = require('../utils/jwt');

async function register(req, res, next) {
  try {
    const { name, email, password, age_group, user_type } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const [existingUsers] = await pool.query(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, age_group, user_type, points)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [name, email, hashedPassword, age_group || null, user_type || 'general']
    );

    const token = generateToken({
      id: result.insertId,
      role: 'user'
    });

    res.status(201).json({
      message: 'User registered successfully.',
      user_id: result.insertId,
      token
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken({
      id: user.user_id,
      role: 'user'
    });

    res.json({
      message: 'Login successful.',
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        points: user.points,
        role: 'user'
      }
    });
  } catch (error) {
    next(error);
  }
}

async function adminLogin(req, res, next) {
  try {
    const { admin_id, password } = req.body;

    if (!admin_id || !password) {
      return res.status(400).json({ message: 'Admin ID and password are required.' });
    }

    const [admins] = await pool.query(
      'SELECT * FROM admins WHERE admin_id = ?',
      [admin_id]
    );

    if (admins.length === 0) {
      return res.status(401).json({ message: 'Invalid admin ID or password.' });
    }

    const admin = admins[0];
    const passwordMatch = await bcrypt.compare(password,  admin.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid admin ID or password.' });
    }

    const token = generateToken({
      id: admin.admin_id,
      role: 'admin'
    });

    res.json({
      message: 'Admin login successful.',
      token,
      admin: {
        admin_id: admin.admin_id,
        role: 'admin'
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  adminLogin
};
