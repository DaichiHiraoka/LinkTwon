const path = require('path');
require(path.resolve(__dirname, '../config/loadEnv'));

const pool = require('../config/db');

async function main() {
  const [users] = await pool.query(
    `SELECT user_id, name, email, points, age_group, user_type
     FROM users
     ORDER BY user_id ASC`
  );
  const [participations] = await pool.query(
    `SELECT participation_id, user_id, event_id, granted_points, participated_at
     FROM participations
     ORDER BY participation_id ASC`
  );
  const [transactions] = await pool.query(
    `SELECT transaction_id, user_id, service_id, type, points, description, created_at
     FROM point_transactions
     ORDER BY transaction_id ASC`
  );

  console.log('=== USERS ===');
  console.table(users);
  console.log('=== PARTICIPATIONS ===');
  console.table(participations);
  console.log('=== POINT TRANSACTIONS ===');
  console.table(transactions);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
