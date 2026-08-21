// Extracts planet and system (tile) data. This set is almost entirely factual
// already -- resource/influence values, planet traits, tech specialties,
// wormholes, anomalies, tile numbers. Flavour text and legendary ability text
// are dropped; only the legendary ability *name* is kept as a label.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RES = '.cache/asyncti4/src/main/resources';
const OFFICIAL = { base: 'base', pok: 'pok', codex1: 'codex', codex2: 'codex',
                   codex3: 'codex', codex4: 'codex', thunders_edge: 'te' };

function loadDir(dir) {
  const full = join(RES, dir);
  if (!existsSync(full)) return [];
  const out = [];
  for (const f of readdirSync(full).filter(f => f.endsWith('.json'))) {
    try { out.push(JSON.parse(readFileSync(join(full, f), 'utf8'))); } catch {}
  }
  return out;
}

const TRAIT = { CULTURAL: 'Cultural', HAZARDOUS: 'Hazardous', INDUSTRIAL: 'Industrial' };
// only these four are real tech specialties; the rest are internal sentinels
const SPEC = { BIOTIC: 'Biotic', CYBERNETIC: 'Cybernetic',
               PROPULSION: 'Propulsion', WARFARE: 'Warfare' };
// AsyncTI4 appends "new" to the three Codex Keleres tile IDs to avoid an
// internal collision with Thunder's Edge. That expansion is outside this
// site's official-source set, so display the numbers printed on the tiles.
const tileId = id => id == null ? null : String(id).replace(/^(\d+)new$/i, '$1');
const HOMEWORLD_FACTION = {
  ghost: 'creuss', sardakk: 'norr',
  keleresa: 'keleres', keleresm: 'keleres', keleresx: 'keleres',
  crimson: 'rebellion', obsidian: 'firmament',
};
const homeworldFaction = p => p.id === 'custodiavigilia'
  ? 'keleres'
  : (HOMEWORLD_FACTION[p.factionHomeworld] || p.factionHomeworld || null);

// Bot-internal entries that are not real planets. Note we deliberately do NOT
// filter on "has no tile": Mirage is placed by a frontier exploration card and
// Custodia Vigilia sits on Mecatol Rex, so both are real but tile-less.
// Illusion and Phantasm are stat-identical clones of Mirage used for variant
// setups; Lost Station is a space station; Locked Mallice is Mallice face-down.
const NOT_REAL = new Set([
  'illusion', 'phantasm', 'loststation', 'lockedmallice',
  'ocean1', 'ocean2', 'ocean3', 'ocean4', 'ocean5', 'triad',
]);

// ---------------------------------------------------------------- planets
const planets = loadDir('planets')
  .filter(p => OFFICIAL[p.source] && p.name && !NOT_REAL.has(p.id))
  .map(p => {
    const types = p.planetTypes || (p.planetType ? [p.planetType] : []);
    const traitType = types.find(type => TRAIT[type]);
    const specs = (p.techSpecialties || []).map(s => SPEC[s]).filter(Boolean);
    const homeworldOf = homeworldFaction(p);
    const kind = homeworldOf ? 'home'
               : types.includes('MR') ? 'mecatol'
               : traitType || types.includes('LIGHTNING') ? 'normal' : 'other';
    return {
      id: p.id, name: p.name, set: OFFICIAL[p.source],
      resources: p.resources ?? 0, influence: p.influence ?? 0,
      trait: TRAIT[traitType] || null,
      kind,
      techSpecialty: specs[0] || null,
      legendary: Boolean(p.legendaryAbilityName),
      legendaryName: p.legendaryAbilityName || null,
      homeworldOf,
      form: p.factionHomeworld === 'obsidian' ? 'Obsidian'
        : p.factionHomeworld === 'firmament' ? 'Firmament' : null,
      tile: tileId(p.tileId),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// ---------------------------------------------------------------- systems
const planetById = Object.fromEntries(planets.map(p => [p.id, p]));

const systems = loadDir('systems')
  .filter(s => OFFICIAL[s.source] && !s.isHyperlane)
  .map(s => {
    const ids = (s.planets || []).filter(id => planetById[id]);
    const ps = ids.map(id => planetById[id]);
    const anomalies = [
      s.isAsteroidField && 'Asteroid field', s.isNebula && 'Nebula',
      s.isGravityRift && 'Gravity rift', s.isSupernova && 'Supernova',
      s.isScar && 'Entropic scar', s.isFracture && 'The Fracture',
    ].filter(Boolean);
    const home = ps.some(p => p.kind === 'home');
    return {
      id: tileId(s.id), name: s.name || null, set: OFFICIAL[s.source],
      planets: ids,
      planetNames: ps.map(p => p.name),
      resources: ps.reduce((n, p) => n + p.resources, 0),
      influence: ps.reduce((n, p) => n + p.influence, 0),
      anomalies,
      wormholes: (s.wormholes || []).map(w => w[0] + w.slice(1).toLowerCase()),
      kind: home ? 'home'
          : ps.some(p => p.kind === 'mecatol') ? 'mecatol'
          : anomalies.length ? 'anomaly'
          : ids.length ? 'planet' : 'empty',
    };
  })
  .sort((a, b) => (Number(a.id) || 1e9) - (Number(b.id) || 1e9) || a.id.localeCompare(b.id));

writeFileSync('data/planets.json', JSON.stringify(planets, null, 2) + '\n');
writeFileSync('data/systems.json', JSON.stringify(systems, null, 2) + '\n');
console.log(`planets: ${planets.length}`);
console.log(`systems: ${systems.length}`);
