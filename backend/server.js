const app = require('./app');
const pool = require('./config/db');
const { seedDemoData } = require('./scripts/seedDemoData');
const { env } = require('./config/env');
const { ensureRuntimeSchema } = require('./database/runtimeMigrations');

const PORT = env.PORT;

async function startServer() {
  try {
    await pool.query('SELECT 1');
    await ensureRuntimeSchema(pool);

    if (env.AUTO_SEED_DEMO_DATA) {
      const result = await seedDemoData();
      console.log(`Demo data ready for ${result.demoEmail}`);
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`DB client: ${env.DB_CLIENT}`);
    });
  } catch (error) {
    console.error('Failed to initialize database connection.');
    console.error(error);
    process.exit(1);
  }
}

startServer();
