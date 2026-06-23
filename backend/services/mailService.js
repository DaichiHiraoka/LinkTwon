const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const nodemailer = require('nodemailer');

const DEFAULT_OUTBOX_DIR = path.resolve(__dirname, '../database/mail-outbox');

function getMailDriver() {
  return process.env.MAIL_DRIVER || 'smtp';
}

function getOutboxDir() {
  return process.env.MAIL_OUTBOX_DIR || DEFAULT_OUTBOX_DIR;
}

async function writeOutboxMail(message) {
  const outboxDir = getOutboxDir();
  await fs.mkdir(outboxDir, { recursive: true });
  const suffix = crypto.randomBytes(4).toString('hex');
  const fileName = `${Date.now()}-${suffix}.json`;
  const filePath = path.join(outboxDir, fileName);
  await fs.writeFile(filePath, JSON.stringify(message, null, 2), 'utf8');
  return { driver: 'outbox', filePath };
}

function boolFromEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return value === 'true' || value === '1';
}

function createMailConfigError(message) {
  const error = new Error(message);
  error.statusCode = 500;
  return error;
}

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw createMailConfigError(`${name} is required for SMTP mail delivery.`);
  }

  return value;
}

function getSmtpTransportConfig() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = boolFromEnv(process.env.SMTP_SECURE, port === 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const config = {
    host: getRequiredEnv('SMTP_HOST'),
    port,
    secure,
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
    }
  };

  if (user) {
    config.auth = { user, pass: pass || '' };
  }

  return config;
}

async function sendSmtpMail(message) {
  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.SMTP_USER;

  if (!from) {
    throw createMailConfigError('SMTP_FROM or SMTP_USER is required for SMTP mail delivery.');
  }

  const transporter = nodemailer.createTransport(getSmtpTransportConfig());
  const result = await transporter.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html
  });

  return {
    driver: 'smtp',
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected
  };
}

async function sendMail(message) {
  const driver = getMailDriver();

  if (driver === 'none') {
    return { driver };
  }

  if (driver === 'console') {
    console.log('[mail]', JSON.stringify(message, null, 2));
    return { driver };
  }

  if (driver === 'outbox') {
    return writeOutboxMail(message);
  }

  if (driver === 'smtp') {
    return sendSmtpMail(message);
  }

  throw createMailConfigError(`Unsupported MAIL_DRIVER: ${driver}`);
}

function buildEmailVerificationHtml(verificationUrl, expiresAt) {
  const escapedUrl = escapeHtml(verificationUrl);
  const escapedExpiresAt = escapeHtml(expiresAt);

  return [
    '<p>Link Townへの登録ありがとうございます。</p>',
    '<p>以下のリンクを開いてメールアドレス認証を完了してください。</p>',
    `<p><a href="${escapedUrl}">メールアドレスを認証する</a></p>`,
    `<p>有効期限: ${escapedExpiresAt}</p>`
  ].join('\n');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendEmailVerificationMail({ to, verificationUrl, expiresAt }) {
  return sendMail({
    to,
    subject: 'Link Town 登録確認メール',
    text: [
      'Link Townへの登録ありがとうございます。',
      '以下のURLを開いてメールアドレス認証を完了してください。',
      verificationUrl,
      `有効期限: ${expiresAt}`
    ].join('\n'),
    html: buildEmailVerificationHtml(verificationUrl, expiresAt),
    verificationUrl,
    expiresAt,
    createdAt: new Date().toISOString()
  });
}

function buildPasswordResetHtml(resetUrl, expiresAt) {
  const escapedUrl = escapeHtml(resetUrl);
  const escapedExpiresAt = escapeHtml(expiresAt);

  return [
    '<p>Link Town のパスワード再設定リクエストを受け付けました。</p>',
    '<p>以下のリンクを開いて新しいパスワードを設定してください。</p>',
    `<p><a href="${escapedUrl}">パスワードを再設定する</a></p>`,
    `<p>有効期限: ${escapedExpiresAt}</p>`,
    '<p>お心当たりがない場合は、このメールを破棄してください。</p>'
  ].join('\n');
}

async function sendPasswordResetMail({ to, resetUrl, expiresAt }) {
  return sendMail({
    to,
    subject: 'Link Town パスワード再設定のご案内',
    text: [
      'Link Town のパスワード再設定リクエストを受け付けました。',
      '以下のURLを開いて新しいパスワードを設定してください。',
      resetUrl,
      `有効期限: ${expiresAt}`,
      '',
      'お心当たりがない場合は、このメールを破棄してください。'
    ].join('\n'),
    html: buildPasswordResetHtml(resetUrl, expiresAt),
    resetUrl,
    expiresAt,
    createdAt: new Date().toISOString()
  });
}

module.exports = {
  sendEmailVerificationMail,
  sendPasswordResetMail
};
