const crypto = require('crypto');
const fs = require('fs/promises');
const https = require('https');
const path = require('path');
const nodemailer = require('nodemailer');
const { env } = require('../config/env');

const DEFAULT_OUTBOX_DIR = path.resolve(__dirname, '../database/mail-outbox');

function getMailDriver() {
  return env.MAIL_DRIVER;
}

function getOutboxDir() {
  return env.MAIL_OUTBOX_DIR || DEFAULT_OUTBOX_DIR;
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

function createMailConfigError(message) {
  const error = new Error(message);
  error.statusCode = 500;
  return error;
}

function getSmtpTransportConfig() {
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASSWORD;
  const config = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
    tls: {
      rejectUnauthorized: env.SMTP_TLS_REJECT_UNAUTHORIZED
    }
  };

  if (user) {
    config.auth = { user, pass: pass || '' };
  }

  return config;
}

async function sendResendMail(message) {
  if (!env.RESEND_API_KEY) {
    throw createMailConfigError('RESEND_API_KEY is required for Resend mail delivery.');
  }

  const from = env.SMTP_FROM || message.from;

  if (!from) {
    throw createMailConfigError('SMTP_FROM is required for Resend mail delivery.');
  }

  const body = {
    from,
    to: Array.isArray(message.to) ? message.to : [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text
  };
  const data = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: 'api.resend.com',
        port: 443,
        path: '/emails',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (response) => {
        let responseData = '';
        response.on('data', (chunk) => {
          responseData += chunk;
        });
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve({ driver: 'resend', response: JSON.parse(responseData) });
            return;
          }

          reject(createMailConfigError(`Resend API error: ${response.statusCode} ${responseData}`));
        });
      }
    );

    request.on('error', reject);
    request.write(data);
    request.end();
  });
}

async function sendSmtpMail(message) {
  const from = env.SMTP_FROM;

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

  if (driver === 'resend') {
    return sendResendMail(message);
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
  sendMail,
  sendEmailVerificationMail,
  sendPasswordResetMail
};
