const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const APP_ENVS = new Set(['development', 'test', 'staging', 'production']);
const DB_CLIENTS = new Set(['sqlite', 'mysql']);
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
  const databaseUrl = readString('PARTNER_DATABASE_URL', readString('DATABASE_URL'));
  const dbClient = readString('PARTNER_DB_CLIENT', readString('DB_CLIENT', databaseUrl ? 'mysql' : 'sqlite')).toLowerCase();
  const isDeployed = appEnv === 'production' || appEnv === 'staging';

  if (!APP_ENVS.has(appEnv)) {
    errors.push(`APP_ENV must be one of ${Array.from(APP_ENVS).join(', ')}.`);
  }
  if (!DB_CLIENTS.has(dbClient)) {
    errors.push(`PARTNER_DB_CLIENT must be one of ${Array.from(DB_CLIENTS).join(', ')}.`);
  }
  if (!ROLES.has(role)) {
    errors.push(`PARTNER_APP_ROLE must be one of ${Array.from(ROLES).join(', ')}.`);
  }
  if (isDeployed && dbClient !== 'mysql') {
    errors.push('PARTNER_DB_CLIENT=mysql is required in staging and production.');
  }
  if (dbClient === 'mysql' && databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      if (parsed.protocol !== 'mysql:' && parsed.protocol !== 'mysql2:') {
        errors.push('PARTNER_DATABASE_URL or DATABASE_URL must start with mysql:// or mysql2:// when PARTNER_DB_CLIENT=mysql.');
      }
    } catch (error) {
      errors.push('PARTNER_DATABASE_URL or DATABASE_URL must be a valid MySQL URL.');
    }
  }
  if (isDeployed && dbClient === 'mysql' && !databaseUrl) {
    errors.push('PARTNER_DATABASE_URL or DATABASE_URL is required in staging and production.');
  }

  const defaultPort = role === 'store' ? 5182 : 5181;
  const translationApiUrl = assertUrl('TRANSLATION_API_URL', readString('TRANSLATION_API_URL'), errors);

  const env = {
    APP_ENV: appEnv,
    PARTNER_APP_ROLE: role,
    PORT: readInteger('PORT', defaultPort, 1, 65535, errors),
    PARTNER_DB_CLIENT: dbClient,
    PARTNER_DATABASE_URL: databaseUrl,
    PARTNER_DB_HOST: readString('PARTNER_DB_HOST', readString('DB_HOST', '127.0.0.1')),
    PARTNER_DB_PORT: readInteger('PARTNER_DB_PORT', Number(readString('DB_PORT', '3306')), 1, 65535, errors),
    PARTNER_DB_USER: readString('PARTNER_DB_USER', readString('DB_USER', 'root')),
    PARTNER_DB_PASSWORD: readString('PARTNER_DB_PASSWORD', readString('DB_PASSWORD')),
    PARTNER_DB_NAME: readString('PARTNER_DB_NAME', readString('DB_NAME', 'linktown')),
    PARTNER_DB_CONNECTION_LIMIT: readInteger(
      'PARTNER_DB_CONNECTION_LIMIT',
      Number(readString('DB_CONNECTION_LIMIT', '10')),
      1,
      100,
      errors
    ),
    PARTNER_DB_PATH: readString('PARTNER_DB_PATH'),
    PARTNER_SQLITE_PATH: readString('PARTNER_SQLITE_PATH'),
    PARTNER_SEED_DEMO_DATA: readBoolean('PARTNER_SEED_DEMO_DATA'),
    PARTNER_REFRESH_KEY: readString('PARTNER_REFRESH_KEY'),
    MYSQL_SSL: readBoolean('MYSQL_SSL'),
    MYSQL_SSL_REJECT_UNAUTHORIZED: readBoolean('MYSQL_SSL_REJECT_UNAUTHORIZED', true),
    MYSQL_SSL_CA: readString('MYSQL_SSL_CA'),
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
