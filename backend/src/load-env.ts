import { config as loadDotEnv } from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const cwd = process.cwd();

// Load more specific files first so their values win when override=false.
const candidateFiles = [
  `.env.${nodeEnv}.local`,
  '.env.local',
  `.env.${nodeEnv}`,
  '.env',
];

for (const fileName of candidateFiles) {
  loadDotEnv({
    path: path.join(cwd, fileName),
    override: false,
    quiet: true,
  });
}
