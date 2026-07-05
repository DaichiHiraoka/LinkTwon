const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { env } = require('../config/env');
const { generateToken } = require('../utils/jwt');
const { sendEmailVerificationMail, sendPasswordResetMail } = require('../services/mailService');

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

function shouldExposeVerificationToken() {
  return env.MAIL_EXPOSE_VERIFICATION_TOKEN;
}

function toSqlDate(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function getEmailVerificationExpiresAt() {
  return toSqlDate(new Date(Date.now() + env.EMAIL_VERIFICATION_EXPIRES_MINUTES * 60 * 1000));
}

function getPublicFrontendBaseUrl() {
  return env.FRONTEND_BASE_URL;
}

function buildEmailVerificationUrl(token) {
  const baseUrl = getPublicFrontendBaseUrl();
  const url = new URL(baseUrl);
  url.searchParams.set('email_verification_token', token);
  return url.toString();
}

function buildPasswordResetUrl(token) {
  const baseUrl = getPublicFrontendBaseUrl();
  const url = new URL(baseUrl);
  url.searchParams.set('password_reset_token', token);
  return url.toString();
}

function getPasswordResetExpiresAt() {
  return toSqlDate(new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000));
}

function shouldExposeResetToken() {
  return env.MAIL_EXPOSE_RESET_TOKEN;
}

async function issueEmailVerificationToken(queryable, userId) {
  const verificationToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = getEmailVerificationExpiresAt();

  await queryable.query(
    `UPDATE email_verification_tokens
     SET used_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND used_at IS NULL`,
    [userId]
  );

  await queryable.query(
    `INSERT INTO email_verification_tokens (user_id, verification_token, expires_at)
     VALUES (?, ?, ?)`,
    [userId, verificationToken, expiresAt]
  );

  return {
    token: verificationToken,
    expiresAt,
    verificationUrl: buildEmailVerificationUrl(verificationToken)
  };
}

function buildEmailVerificationResponse(message, verification) {
  const response = {
    message,
    requires_email_verification: true,
    verification_expires_at: verification.expiresAt
  };

  if (shouldExposeVerificationToken()) {
    response.verification_token = verification.token;
    response.verification_url = verification.verificationUrl;
  }

  return response;
}

async function createVerificationNotification(queryable, userId) {
  await queryable.query(
    `INSERT INTO notifications (user_id, title, body)
     VALUES (?, ?, ?)`,
    [
      userId,
      'メールアドレス認証を完了してください',
      '登録確認メールのURLから認証を完了してください。'
    ]
  );
}

async function sendVerificationEmail(email, verification) {
  await sendEmailVerificationMail({
    to: email,
    verificationUrl: verification.verificationUrl,
    expiresAt: verification.expiresAt
  });
}

async function register(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const { name, email: rawEmail, password, age_group, user_type } = req.body;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    await connection.beginTransaction();

    const [existingUsers] = await connection.query(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await connection.query(
      `INSERT INTO users (name, email, password, login_password_plaintext, age_group, user_type, points)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [name, email, hashedPassword, password, age_group || null, user_type || 'general']
    );

    await connection.query(
      `INSERT INTO user_settings (user_id, notification_enabled, language, font_size)
       VALUES (?, 1, 'ja', 'medium')`,
      [result.insertId]
    );

    const verification = await issueEmailVerificationToken(connection, result.insertId);
    await createVerificationNotification(connection, result.insertId);
    await sendVerificationEmail(email, verification);
    await connection.commit();

    res.status(201).json({
      ...buildEmailVerificationResponse('User registered successfully. Please verify your email address before logging in.', verification),
      user_id: result.insertId,
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

async function login(req, res, next) {
  try {
    const { email: rawEmail, password } = req.body;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail;

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

    if (!user.email_verified_at) {
      return res.status(403).json({ message: 'Email address is not verified. Please verify your email before logging in.' });
    }

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
        email_verified_at: user.email_verified_at,
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

async function verifyEmail(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const { verification_token } = req.body;

    if (!verification_token) {
      return res.status(400).json({ message: 'Verification token is required.' });
    }

    await connection.beginTransaction();

    const [tokens] = await connection.query(
      `SELECT token_id, user_id
       FROM email_verification_tokens
       WHERE verification_token = ? AND used_at IS NULL AND expires_at >= CURRENT_TIMESTAMP`,
      [verification_token]
    );

    if (tokens.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Invalid or expired verification token.' });
    }

    await connection.query(
      `UPDATE users
       SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP)
       WHERE user_id = ?`,
      [tokens[0].user_id]
    );

    await connection.query(
      `UPDATE email_verification_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE token_id = ?`,
      [tokens[0].token_id]
    );

    await connection.query(
      `INSERT INTO notifications (user_id, title, body)
       VALUES (?, ?, ?)`,
      [tokens[0].user_id, 'メールアドレス認証が完了しました', 'ログインしてLink Townを利用できます。']
    );

    await connection.commit();

    res.json({
      message: 'Email verified successfully.',
      user_id: tokens[0].user_id
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

async function resendEmailVerification(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const { email: rawEmail } = req.body;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const genericMessage = 'If the email exists and is not verified, a verification email has been issued.';

    await connection.beginTransaction();

    const [users] = await connection.query(
      'SELECT user_id, email_verified_at FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0 || users[0].email_verified_at) {
      await connection.commit();
      return res.json({ message: genericMessage });
    }

    const verification = await issueEmailVerificationToken(connection, users[0].user_id);
    await createVerificationNotification(connection, users[0].user_id);
    await sendVerificationEmail(email, verification);
    await connection.commit();

    res.json(buildEmailVerificationResponse(genericMessage, verification));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const { email: rawEmail } = req.body;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const genericMessage = 'If the email exists, a reset token has been issued.';
    const [users] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.json({ message: genericMessage });
    }

    await pool.query(
      `UPDATE password_reset_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND used_at IS NULL`,
      [users[0].user_id]
    );

    const resetToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = getPasswordResetExpiresAt();
    const resetUrl = buildPasswordResetUrl(resetToken);

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, reset_token, expires_at)
       VALUES (?, ?, ?)`,
      [users[0].user_id, resetToken, expiresAt]
    );

    await sendPasswordResetMail({ to: email, resetUrl, expiresAt });

    const response = { message: genericMessage, reset_expires_at: expiresAt };
    if (shouldExposeResetToken()) {
      response.reset_token = resetToken;
      response.reset_url = resetUrl;
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

    await pool.query('UPDATE users SET password = ?, login_password_plaintext = ? WHERE user_id = ?', [
      passwordHash,
      new_password,
      tokens[0].user_id
    ]);
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
    await pool.query('UPDATE users SET password = ?, login_password_plaintext = ? WHERE user_id = ?', [
      passwordHash,
      new_password,
      req.user.id
    ]);

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  adminLogin,
  verifyEmail,
  resendEmailVerification,
  requestPasswordReset,
  resetPassword,
  changePassword
};
