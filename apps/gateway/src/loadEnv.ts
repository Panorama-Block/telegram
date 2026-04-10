import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

/**
 * Load .env from the nearest parent directory.
 * Must be imported BEFORE any module that calls parseEnv().
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const candidates = [
  resolve(process.cwd(), '.env'),           // cwd (gateway/)
  resolve(__dirname, '../.env'),             // gateway/.env (from src/)
  resolve(__dirname, '../../.env'),          // apps/.env
  resolve(__dirname, '../../../.env'),       // telegram/.env
];

for (const path of candidates) {
  if (existsSync(path)) {
    config({ path });
    break;
  }
}
