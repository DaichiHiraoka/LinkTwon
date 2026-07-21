const path = require('path');
require('./loadEnv');

const APP_ENVS = new Set(['development', 'test', 'staging', 'production']);
const DB_CLIENTS = new Set(['sqlite', 'mysql']);
const MAIL_DRIVERS = new Set(['smtp', 'resend', 'outbox', 'console', 'none']);
const TRANSLATION_PROVIDERS = new Set(['deepl', 'mock']);
const DEFAULT_SQLITE_PATH = path.resolve(__dirname, '../database/dev.sqlite');
const DEFAULT_OUTBOX_DIR = path.resolve(__dirname, '../database/mail-outbox');
const DEFAULT_DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

function fail(errors) {
  const message = ['Invalid backend environment configuration:', ...errors.map((error) => `- ${error}`)].join('\n');
  throw new Error(message);
}

function readString(name, defaultValue = '') {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value).trim();
}

function readBoolean(name, defaultValue = false) {
  const value = readString(name);
  if (!value) {
    return defaultValue;
  }
  if (['true', '1', 'yes'].includes(value.toLowerCase())) {
    return true;
  }
  if (['false', '0', 'no'].includes(value.toLowerCase())) {
    return false;
  }
  return defaultValue;
}

function readInteger(name, defaultValue, min, max, errors) {
  const raw = readString(name);
  const value = raw ? Number(raw) : defaultValue;
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${name} must be an integer between ${min} and ${max}.`);
    return defaultValue;
  }
  return value;
}

function normalizeOrigin(origin) {
  try {
    return new URL(origin).origin;
  } catch (error) {
    return null;
  }
}

function readOriginList(name, errors) {
  return readString(name)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      if (origin === '*') {
        errors.push(`${name} must not contain "*".`);
        return null;
      }
      const normalized = normalizeOrigin(origin);
      if (!normalized) {
        errors.push(`${name} contains an invalid URL origin: ${origin}`);
      }
      return normalized;
    })
    .filter(Boolean);
}

function readRegexList(name, errors) {
  return readString(name)
    .split(',')
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .map((pattern) => {
      if (!pattern.startsWith('^') || !pattern.endsWith('$')) {
        errors.push(`${name} entries must be anchored with ^ and $: ${pattern}`);
        return null;
      }
      try {
        return new RegExp(pattern);
      } catch (error) {
        errors.push(`${name} contains an invalid regular expression: ${pattern}`);
        return null;
      }
    })
    .filter(Boolean);
}

function assertUrl(name, value, errors, required = false) {
  if (!value) {
    if (required) {
      errors.push(`${name} is required.`);
    }
    return '';
  }
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      errors.push(`${name} must use http or https.`);
    }
    return url.toString().replace(/\/$/, '');
  } catch (error) {
    errors.push(`${name} must be a valid URL.`);
    return value;
  }
}

function createEnv() {
  const errors = [];
  const appEnv = readString('APP_ENV', process.env.NODE_ENV || 'development');

  if (!APP_ENVS.has(appEnv)) {
    errors.push(`APP_ENV must be one of ${Array.from(APP_ENVS).join(', ')}.`);
  }

  const isDeployed = appEnv === 'production' || appEnv === 'staging';
  const nodeEnv = readString('NODE_ENV', appEnv === 'production' ? 'production' : appEnv === 'test' ? 'test' : 'development');
  const dbClient = readString('DB_CLIENT', readString('DATABASE_URL') ? 'mysql' : 'sqlite').toLowerCase();
  const mailDriver = readString('MAIL_DRIVER', isDeployed ? 'smtp' : 'outbox').toLowerCase();
  const jwtSecret = readString('JWT_SECRET', isDeployed ? '' : 'link-town-local-secret');
  const deeplApiKey = readString('DEEPL_API_KEY');
  const translationProvider = readString('TRANSLATION_PROVIDER', deeplApiKey ? 'deepl' : 'mock').toLowerCase();
  const smtpFrom =
    readString('SMTP_FROM') ||
    readString('MAIL_FROM') ||
    (mailDriver === 'smtp' ? readString('SMTP_USER') : '');
  const frontendOrigins = readOriginList('FRONTEND_ORIGIN', errors);
  const frontendOriginPatterns = readRegexList('FRONTEND_ORIGIN_PATTERNS', errors);
  const frontendBaseUrl = assertUrl(
    'FRONTEND_BASE_URL',
    readString('FRONTEND_BASE_URL', frontendOrigins[0] || 'http://localhost:5173'),
    errors,
    isDeployed
  );

  if (!DB_CLIENTS.has(dbClient)) {
    errors.push(`DB_CLIENT must be one of ${Array.from(DB_CLIENTS).join(', ')}.`);
  }

  if (!MAIL_DRIVERS.has(mailDriver)) {
    errors.push(`MAIL_DRIVER must be one of ${Array.from(MAIL_DRIVERS).join(', ')}.`);
  }

  if (!TRANSLATION_PROVIDERS.has(translationProvider)) {
    errors.push(`TRANSLATION_PROVIDER must be one of ${Array.from(TRANSLATION_PROVIDERS).join(', ')}.`);
  }

  if (translationProvider === 'deepl' && !deeplApiKey) {
    errors.push('DEEPL_API_KEY is required when TRANSLATION_PROVIDER=deepl.');
  }

  if (jwtSecret.length < (isDeployed ? 32 : 8)) {
    errors.push(`JWT_SECRET must be at least ${isDeployed ? 32 : 8} characters.`);
  }

  if (isDeployed && frontendOrigins.length === 0 && frontendOriginPatterns.length === 0) {
    errors.push('FRONTEND_ORIGIN or FRONTEND_ORIGIN_PATTERNS is required in staging and production.');
  }

  const databaseUrl = readString('DATABASE_URL');
  if (dbClient === 'mysql') {
    if (!databaseUrl && isDeployed) {
      errors.push('DATABASE_URL is required when DB_CLIENT=mysql in staging or production.');
    }
    if (databaseUrl) {
      try {
        const parsed = new URL(databaseUrl);
        if (parsed.protocol !== 'mysql:' && parsed.protocol !== 'mysql2:') {
          errors.push('DATABASE_URL must start with mysql:// or mysql2:// when DB_CLIENT=mysql.');
        }
      } catch (error) {
        errors.push('DATABASE_URL must be a valid MySQL URL.');
      }
    }
  }

  if (mailDriver === 'smtp' && isDeployed) {
    for (const name of ['SMTP_HOST', 'SMTP_FROM']) {
      if (!readString(name)) {
        errors.push(`${name} is required when MAIL_DRIVER=smtp in staging or production.`);
      }
    }
  }

  if (mailDriver === 'resend' && isDeployed) {
    if (!readString('RESEND_API_KEY')) {
      errors.push('RESEND_API_KEY is required when MAIL_DRIVER=resend in staging or production.');
    }
    if (!smtpFrom) {
      errors.push('SMTP_FROM is required when MAIL_DRIVER=resend in staging or production.');
    }
  }

  const env = {
    APP_ENV: appEnv,
    NODE_ENV: nodeEnv,
    PORT: readInteger('PORT', 3000, 1, 65535, errors),
    DB_CLIENT: dbClient,
    DATABASE_URL: databaseUrl,
    DB_HOST: readString('DB_HOST', '127.0.0.1'),
    DB_PORT: readInteger('DB_PORT', 3306, 1, 65535, errors),
    DB_USER: readString('DB_USER', 'root'),
    DB_PASSWORD: readString('DB_PASSWORD'),
    DB_NAME: readString('DB_NAME', 'linktown'),
    DB_CONNECTION_LIMIT: readInteger('DB_CONNECTION_LIMIT', 10, 1, 100, errors),
    SQLITE_PATH: readString('SQLITE_PATH', DEFAULT_SQLITE_PATH),
    MYSQL_SSL: readBoolean('MYSQL_SSL'),
    MYSQL_SSL_REJECT_UNAUTHORIZED: readBoolean('MYSQL_SSL_REJECT_UNAUTHORIZED', true),
    MYSQL_SSL_CA: readString('MYSQL_SSL_CA'),
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: readString('JWT_EXPIRES_IN', '1d'),
    FRONTEND_ORIGINS: frontendOrigins,
    FRONTEND_ORIGIN_PATTERNS: frontendOriginPatterns,
    FRONTEND_BASE_URL: frontendBaseUrl,
    AUTO_SEED_DEMO_DATA: readBoolean('AUTO_SEED_DEMO_DATA'),
    DEFAULT_ADMIN_ID: readString('DEFAULT_ADMIN_ID', 'admin'),
    DEFAULT_ADMIN_PASSWORD: readString('DEFAULT_ADMIN_PASSWORD', 'admin123'),
    DEMO_USER_EMAIL: readString('DEMO_USER_EMAIL', 'demo@example.com'),
    DEMO_USER_PASSWORD: readString('DEMO_USER_PASSWORD', 'password123'),
    MAIL_DRIVER: mailDriver,
    MAIL_OUTBOX_DIR: readString('MAIL_OUTBOX_DIR', DEFAULT_OUTBOX_DIR),
    MAIL_EXPOSE_VERIFICATION_TOKEN: readBoolean('MAIL_EXPOSE_VERIFICATION_TOKEN'),
    MAIL_EXPOSE_RESET_TOKEN: readBoolean('MAIL_EXPOSE_RESET_TOKEN'),
    EMAIL_VERIFICATION_EXPIRES_MINUTES: readInteger('EMAIL_VERIFICATION_EXPIRES_MINUTES', 1440, 1, 10080, errors),
    PASSWORD_RESET_EXPIRES_MINUTES: readInteger('PASSWORD_RESET_EXPIRES_MINUTES', 30, 1, 1440, errors),
    TRANSLATION_PROVIDER: translationProvider,
    DEEPL_API_KEY: deeplApiKey,
    DEEPL_API_URL: assertUrl('DEEPL_API_URL', readString('DEEPL_API_URL', DEFAULT_DEEPL_API_URL), errors, false),
    TRANSLATION_REFRESH_KEY: readString('TRANSLATION_REFRESH_KEY'),
    SMTP_HOST: readString('SMTP_HOST'),
    SMTP_PORT: readInteger('SMTP_PORT', 587, 1, 65535, errors),
    SMTP_SECURE: readBoolean('SMTP_SECURE'),
    SMTP_USER: readString('SMTP_USER'),
    SMTP_PASSWORD: readString('SMTP_PASSWORD'),
    SMTP_FROM: smtpFrom,
    SMTP_TLS_REJECT_UNAUTHORIZED: readBoolean('SMTP_TLS_REJECT_UNAUTHORIZED', true),
    RESEND_API_KEY: readString('RESEND_API_KEY')
  };

  if (errors.length > 0) {
    fail(errors);
  }

  return env;
}

const env = createEnv();

module.exports = {
  env
};
