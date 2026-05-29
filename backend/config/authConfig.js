require('./loadEnv');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'link-town-local-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN
};
