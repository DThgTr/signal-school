import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const local = resolve('.tools/spacetime/spacetimedb-cli.exe');
const executable = process.platform === 'win32' && existsSync(local) ? local : 'spacetime';
const args = process.argv.slice(2);
const result = spawnSync(executable, ['--root-dir', resolve('.runtime/spacetime'), ...args], { stdio: 'inherit', env: process.env });
if (result.error) { console.error('SpacetimeDB CLI is unavailable. Install it from https://spacetimedb.com/install'); process.exit(1); }
process.exit(result.status ?? 1);
