// Fetches the upstream community reference into .cache/ as *build input only*.
// Nothing from .cache/ is ever published: extract.mjs pulls out the factual
// layer (names, costs, combat values, prerequisites) and discards the prose.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';

const SOURCE = 'https://github.com/scottmk/ti4-reference.git';
const DEST = '.cache/ti4-reference';

if (existsSync(DEST)) {
  console.log('source already cached, pulling latest');
  execFileSync('git', ['-C', DEST, 'pull', '--quiet'], { stdio: 'inherit' });
} else {
  mkdirSync('.cache', { recursive: true });
  console.log('cloning source');
  execFileSync('git', ['clone', '--depth', '1', '--quiet', SOURCE, DEST], { stdio: 'inherit' });
}
console.log('source ready at', DEST);
