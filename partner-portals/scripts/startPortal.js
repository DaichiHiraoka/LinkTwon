const role = process.argv[2] === 'store' ? 'store' : 'event';
const defaultPort = role === 'store' ? '5182' : '5181';

process.env.PARTNER_APP_ROLE = role;
process.env.PORT = process.argv[3] || process.env.PORT || defaultPort;

const { startServer } = require('../server');

startServer();
