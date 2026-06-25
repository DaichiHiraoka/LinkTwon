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
    const err = new Error(message);
    err.statusCode = 500;
    return err;
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

  if (!user) throw createMailConfigError('SMTP_FROM or SMTP_USER is required for SMTP mail delivery.');
    if (!pass) throw createMailConfigError('SMTP_PASSWORD is required for SMTP mail delivery.');

  return {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port,
        secure,
        auth: { user, pass },
        tls: {
                rejectUnauthorized: boolFromEnv(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true),
        },
  };
}

async function sendResendMail(message) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw createMailConfigError('RESEND_API_KEY is required for Resend mail delivery.');

  const from = process.env.SMTP_FROM || message.from;

  const body = {
        from,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
  };

  const https = require('https');
    const data = JSON.stringify(body);

  return new Promise((resolve, reject) => {
        const options = {
                hostname: 'api.resend.com',
                port: 443,
                path: '/emails',
                method: 'POST',
                headers: {
                          'Authorization': `Bearer ${apiKey}`,
                          'Content-Type': 'application/json',
                          'Content-Length': Buffer.byteLength(data),
                },
        };

                         const req = https.request(options, (res) => {
                                 let responseData = '';
                                 res.on('data', (chunk) => { responseData += chunk; });
                                 res.on('end', () => {
                                           if (res.statusCode >= 200 && res.statusCode < 300) {
                                                       resolve({ driver: 'resend', response: JSON.parse(responseData) });
                                           } else {
                                                       reject(createMailConfigError(`Resend API error: ${res.statusCode} ${responseData}`));
                                           }
                                 });
                         });

                         req.on('error', reject);
        req.write(data);
        req.end();
  });
}

async function sendSmtpMail(message) {
    const config = getSmtpTransportConfig();
    const transporter = nodemailer.createTransport(config);
    const from = process.env.SMTP_FROM || message.from;
    const info = await transporter.sendMail({ ...message, from });
    return { driver: 'smtp', messageId: info.messageId };
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

  return sendSmtpMail(message);
}

function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
}

function buildEmailVerificationHtml(verificationUrl, expiresAt) {
    return `<!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Link Townへの登録ありがとうございます。</h2>
        <p>以下のURLを開いてメールアドレス認証を完了してください。</p>
          <p><a href="${escapeHtml(verificationUrl)}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">メールアドレスを認証する</a></p>
            <p style="color:#666;font-size:14px;">有効期限: ${escapeHtml(expiresAt)}</p>
              <p style="color:#999;font-size:12px;">このURLは第三者に共有しないでください。</p>
              </body>
              </html>`;
}

async function sendEmailVerificationMail({ to, verificationUrl, expiresAt }) {
    return sendMail({
          to,
          subject: 'Link Town メールアドレス認証',
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
    return `<!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>パスワードリセットのご案内</h2>
        <p>以下のURLを開いてパスワードをリセットしてください。</p>
          <p><a href="${escapeHtml(resetUrl)}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">パスワードをリセットする</a></p>
            <p style="color:#666;font-size:14px;">有効期限: ${escapeHtml(expiresAt)}</p>
              <p style="color:#999;font-size:12px;">このURLは第三者に共有しないでください。</p>
              </body>
              </html>`;
}

async function sendPasswordResetMail({ to, resetUrl, expiresAt }) {
    return sendMail({
          to,
          subject: 'Link Town パスワードリセット',
          text: [
                  'パスワードリセットのご案内です。',
                  '以下のURLを開いてパスワードをリセットしてください。',
                  resetUrl,
                  `有効期限: ${expiresAt}`
                ].join('\n'),
          html: buildPasswordResetHtml(resetUrl, expiresAt),
    });
}

module.exports = {
    sendMail,
    sendEmailVerificationMail,
    sendPasswordResetMail,
};
