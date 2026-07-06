const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const APP_ENVS = new Set(['development', 'test', 'staging', 'production']);
const ROLES = new Set(['event', 'store']);
const externalEnv = { ...process.env };

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!Object.prototype.hasOwnProperty.call(externalEnv, key)) {
      process.env[key] = value;
    }
  }
}

function resolveAppEnv() {
  const rawEnv = process.env.APP_ENV || process.env.NODE_ENV || 'development';
  if (rawEnv === 'dev') {
    return 'development';
  }
  if (rawEnv === 'prod') {
    return 'production';
  }
  return rawEnv;
}

const appEnv = resolveAppEnv();
const shouldLoadFiles = process.env.LOAD_ENV_FILES === 'true' || !['production', 'staging'].includes(appEnv);

if (shouldLoadFiles) {
  for (const fileName of ['.env', '.env.local', `.env.${appEnv}`, `.env.${appEnv}.local`]) {
    parseEnvFile(path.join(ROOT_DIR, fileName));
  }
}

function readString(name, defaultValue = '') {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value).trim();
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

function assertUrl(name, value, errors) {
  if (!value) {
    return '';
  }
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      errors.push(`${name} must use http or https.`);
    }
    return url.toString();
  } catch (error) {
    errors.push(`${name} must be a valid URL.`);
    return value;
  }
}

function createEnv() {
  const errors = [];
  const role = readString('PARTNER_APP_ROLE', 'event');

  if (!APP_ENVS.has(appEnv)) {
    errors.push(`APP_ENV must be one of ${Array.from(APP_ENVS).join(', ')}.`);
  }
  if (!ROLES.has(role)) {
    errors.push(`PARTNER_APP_ROLE must be one of ${Array.from(ROLES).join(', ')}.`);
  }

  const defaultPort = role === 'store' ? 5182 : 5181;
  const translationApiUrl = assertUrl('TRANSLATION_API_URL', readString('TRANSLATION_API_URL'), errors);

  const env = {
    APP_ENV: appEnv,
    PARTNER_APP_ROLE: role,
    PORT: readInteger('PORT', defaultPort, 1, 65535, errors),
    PARTNER_DB_PATH: readString('PARTNER_DB_PATH'),
    PARTNER_SQLITE_PATH: readString('PARTNER_SQLITE_PATH'),
    PARTNER_REFRESH_KEY: readString('PARTNER_REFRESH_KEY'),
    TRANSLATION_API_URL: translationApiUrl,
    TRANSLATION_API_TOKEN: readString('TRANSLATION_API_TOKEN'),
    TRANSLATION_PROVIDER: readString('TRANSLATION_PROVIDER', translationApiUrl ? 'translation-api' : 'mock-cache')
  };

  if (errors.length > 0) {
    throw new Error(['Invalid partner portal environment configuration:', ...errors.map((error) => `- ${error}`)].join('\n'));
  }

  return env;
}

const env = createEnv();

module.exports = {
  env
};
