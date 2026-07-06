const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const externalEnv = { ...process.env };

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
const roots = [
  path.resolve(__dirname, '../../'),
  path.resolve(__dirname, '../')
];

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const parsed = dotenv.parse(fs.readFileSync(envPath));
  for (const [key, value] of Object.entries(parsed)) {
    if (Object.prototype.hasOwnProperty.call(externalEnv, key)) {
      continue;
    }
    process.env[key] = value;
  }
}

if (shouldLoadFiles) {
  for (const root of roots) {
    loadEnvFile(path.join(root, '.env'));
    loadEnvFile(path.join(root, '.env.local'));
    loadEnvFile(path.join(root, `.env.${appEnv}`));
    loadEnvFile(path.join(root, `.env.${appEnv}.local`));
  }
}

process.env.APP_ENV = appEnv;

module.exports = {
  appEnv,
  shouldLoadFiles
};
