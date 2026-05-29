const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { generateToken } = require('../utils/jwt');

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

function toSqlDate(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function register(req, res, next) {
  try {
    const { name, email, password, age_group, user_type } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
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

    await pool.query(
      `INSERT INTO user_settings (user_id, notification_enabled, language, font_size)
       VALUES (?, 1, 'ja', 'medium')`,
      [result.insertId]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, title, body)
       VALUES (?, ?, ?)`,
      [result.insertId, 'Link Townへようこそ', '登録が完了しました。仮実装UIから各機能を検証できます。']
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
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);

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

async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const [users] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.json({ message: 'If the email exists, a reset token has been issued.' });
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = toSqlDate(new Date(Date.now() + 30 * 60 * 1000));

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, reset_token, expires_at)
       VALUES (?, ?, ?)`,
      [users[0].user_id, resetToken, expiresAt]
    );

    const response = { message: 'If the email exists, a reset token has been issued.' };
    if (process.env.NODE_ENV !== 'production') {
      response.reset_token = resetToken;
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { reset_token, new_password } = req.body;

    if (!reset_token || !new_password) {
      return res.status(400).json({ message: 'Reset token and new password are required.' });
    }

    if (!validatePassword(new_password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const [tokens] = await pool.query(
      `SELECT token_id, user_id
       FROM password_reset_tokens
       WHERE reset_token = ? AND used_at IS NULL AND expires_at >= CURRENT_TIMESTAMP`,
      [reset_token]
    );

    if (tokens.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    const passwordHash = await bcrypt.hash(new_password, 10);

    await pool.query('UPDATE users SET password = ? WHERE user_id = ?', [passwordHash, tokens[0].user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token_id = ?', [tokens[0].token_id]);

    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    if (!validatePassword(new_password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const [users] = await pool.query('SELECT user_id, password FROM users WHERE user_id = ?', [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const passwordMatch = await bcrypt.compare(current_password, users[0].password);
    if (!passwordMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE user_id = ?', [passwordHash, req.user.id]);

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  adminLogin,
  requestPasswordReset,
  resetPassword,
  changePassword
};
