require('./config/loadEnv');
const app = require('./app');
const pool = require('./config/db');
const { seedDemoData } = require('./scripts/seedDemoData');

const PORT = Number(process.env.PORT || 3000);

function getDbClientLabel() {
  if (process.env.DB_CLIENT) {
    return process.env.DB_CLIENT;
  }

  if (process.env.DATABASE_URL?.startsWith('mysql://') || process.env.DATABASE_URL?.startsWith('mysql2://')) {
    return 'mysql';
  }

  return 'sqlite';
}

async function startServer() {
  try {
    await pool.query('SELECT 1');

    if (process.env.AUTO_SEED_DEMO_DATA === 'true') {
      const result = await seedDemoData();
      console.log(`Demo data ready for ${result.demoEmail}`);
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`DB client: ${getDbClientLabel()}`);
    });
  } catch (error) {
    console.error('Failed to initialize database connection.');
    console.error(error);
    process.exit(1);
  }
}

startServer();
