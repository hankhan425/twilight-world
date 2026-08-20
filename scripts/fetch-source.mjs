// Fetches upstream community sources into .cache/ as *build input only*.
// Nothing from .cache/ is published: the extract step pulls out the factual
// layer (names, costs, points, prerequisites, categories) and discards prose.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

const SOURCES = [
  { name: 'ti4-reference', url: 'https://github.com/scottmk/ti4-reference.git' },
  // Full card decks (objectives, agendas, action cards, explores, relics).
  // Sparse-checked out: we only need the JSON data directory.
  { name: 'asyncti4', url: 'https://github.com/AsyncTI4/TI4_map_generator_bot.git',
    sparse: ['src/main/resources/data', 'src/main/resources/planets',
             'src/main/resources/systems'] },
];

mkdirSync('.cache', { recursive: true });
for (const s of SOURCES) {
  const dest = `.cache/${s.name}`;
  if (existsSync(dest)) {
    console.log(`${s.name}: cached, pulling`);
    execFileSync('git', ['-C', dest, 'pull', '--quiet'], { stdio: 'inherit' });
    continue;
  }
  console.log(`${s.name}: cloning`);
  const args = ['clone', '--depth', '1', '--quiet'];
  if (s.sparse) args.push('--filter=blob:none', '--sparse');
  execFileSync('git', [...args, s.url, dest], { stdio: 'inherit' });
  if (s.sparse) {
    execFileSync('git', ['-C', dest, 'sparse-checkout', 'set', ...[].concat(s.sparse)],
                 { stdio: 'inherit' });
  }
}
console.log('sources ready');
