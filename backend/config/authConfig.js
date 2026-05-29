require('./loadEnv');

const JWT_SECRET = process.env.JWT_SECRET || 'link-town-local-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN
};
