require('./config/loadEnv');
const app = require('./app');
const pool = require('./config/db');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await pool.query('SELECT 1');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`DB client: ${process.env.DB_CLIENT || 'sqlite'}`);
    });
  } catch (error) {
    console.error('Failed to initialize database connection.');
    console.error(error);
    process.exit(1);
  }
}

startServer();
