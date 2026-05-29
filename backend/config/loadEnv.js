const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envCandidates = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env')
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}
