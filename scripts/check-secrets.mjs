import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const key = process.env.NVIDIA_API_KEY;
if (!key) throw new Error('Load .env.local to check the configured key is absent from source and artifacts.');
const source = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
function files(path) { return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]); }
const candidates = [...source.filter(existsSync), ...files('dist')];
for (const file of candidates) {
  if (readFileSync(file).includes(Buffer.from(key))) throw new Error(`Configured NVIDIA key found in ${file}`);
}
console.log(`PASS: configured NVIDIA key absent from ${candidates.length} source/build files; ignored secrets stay local.`);
