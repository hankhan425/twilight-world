// Extracts the FACTUAL layer only: names, numeric stats, tech colours,
// prerequisites, faction/expansion membership. All descriptive prose from the
// source is deliberately discarded here -- rules text is FFG's copyright and is
// never carried into data/. Original summaries live in src/data/summaries.json.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const SRC = '.cache/ti4-reference/snippets';
const OFFICIAL = ['base', 'pok', 'codex'];   // fan sets (ds/te/tf/absol) excluded

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const icons = s => [...s.matchAll(/:ti4-tech-([a-z]+):/g)].map(m => m[1]);
// unwrap <span ...>X</span> -> X, strip bold/emoji-shortcodes, collapse space
const plain = s => s.replace(/<[^>]+>/g, '').replace(/:[a-z0-9-]+:/g, '')
                    .replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

// Stat markup is irregular: numbers can straddle bold markers (`**Capacity 1**2`
// means 12) and extra dice are an icon (`:ti4-unit-dice-x2:`). Normalise both
// before any numeric parsing, or values get silently truncated.
const normStats = s => s
  .replace(/:ti4-unit-dice-x(\d+):/g, '(x$1)')
  .replace(/\*\*/g, '');

const files = (dir) => existsSync(dir)
  ? readdirSync(dir).filter(f => f.endsWith('.md')).map(f => join(dir, f)) : [];

/** "Combat 7(x2)" -> { value: 7, dice: 2 } */
function stat(body, label) {
  const re = new RegExp(`${label}\\s+([0-9]+)(?:\\s*\\(x([0-9]+)\\))?`, 'i');
  const m = normStats(body).match(re);
  if (!m) return null;
  const out = { value: Number(m[1]) };
  if (m[2]) out.dice = Number(m[2]);
  return out;
}

/** bullet list of keyword abilities -> [{ name, value, dice }] */
function keywords(body) {
  const out = [];
  for (const m of body.matchAll(/^\*\s+(.+)$/gm)) {
    const t = plain(normStats(m[1]));
    if (!t) continue;
    const km = t.match(/^([A-Za-z\- ]+?)\s*([0-9]+)?(?:\s*\(x([0-9]+)\))?$/);
    if (!km) { out.push({ name: t }); continue; }
    const k = { name: km[1].trim() };
    if (km[2]) k.value = Number(km[2]);
    if (km[3]) k.dice = Number(km[3]);
    out.push(k);
  }
  return out;
}

const firstHeading = body => {
  const m = body.match(/^###\s+(.*)$/m);
  return m ? m[1] : '';
};

// ---------------------------------------------------------------- units
function units() {
  const out = [];
  const push = (file, set, faction) => {
    const body = readFileSync(file, 'utf8');
    const head = firstHeading(body);
    const name = plain(head);
    if (!name) return;
    const typeM = body.match(/Unit Type:\s*(\w+)/i);
    const upM = body.match(/Upgrade<\/span>:(.*)$/m);
    const rec = {
      id: (faction ? faction + '-' : '') + slug(basename(file, '.md')),
      name, set, faction: faction || null,
      type: typeM ? typeM[1].toLowerCase()
                  : slug(basename(file, '.md')).replace(/-i+$/, ''),
      cost: stat(body, 'Cost'),
      combat: stat(body, 'Combat'),
      move: stat(body, 'Move'),
      capacity: stat(body, 'Capacity'),
      abilities: keywords(body),
    };
    if (upM) rec.upgradePrereqs = icons(upM[1]);
    if (/:ti4-pok:/.test(head)) rec.set = 'pok';
    out.push(rec);
  };
  for (const f of files(join(SRC, 'units'))) push(f, 'base', null);
  for (const set of OFFICIAL) {
    const dir = join(SRC, 'units', 'faction', set);
    if (!existsSync(dir)) continue;
    for (const f of files(dir)) {
      const fac = slug(basename(f, '.md')).split('-')[0];
      push(f, set, fac);
    }
  }
  return out;
}

// ---------------------------------------------------------------- techs
// techs/<set>/<colour>/<name>.md  -- the directory gives the colour
// authoritatively, so we take it from the path rather than the icon shortcode.
const COLOUR = {
  blue: 'propulsion', green: 'biotic', red: 'warfare', yellow: 'cybernetic',
  unit: null, other: null,
};
function techs() {
  const out = [];
  for (const set of OFFICIAL) {
    const setDir = join(SRC, 'techs', set);
    if (!existsSync(setDir)) continue;
    for (const bucket of readdirSync(setDir)) {
      for (const f of files(join(setDir, bucket))) {
        const body = readFileSync(f, 'utf8');
        const head = firstHeading(body);
        const name = plain(head);
        if (!name) continue;
        const facM = head.match(/:ti4-faction-[a-z]+-([a-z0-9]+):/);
        const reqM = body.match(/Requirements?:(.*)$/m);
        out.push({
          id: slug(basename(f, '.md')),
          name, set,
          colour: COLOUR[bucket] ?? null,
          category: bucket === 'unit' ? 'unit-upgrade'
                  : bucket === 'other' ? 'other' : 'standard',
          faction: facM ? facM[1] : null,
          prereqs: reqM ? icons(reqM[1]) : [],
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- leaders
// leaders/<set>/<faction>-<kind>.md
function leaders() {
  const out = [];
  for (const set of OFFICIAL) {
    for (const f of files(join(SRC, 'leaders', set))) {
      const body = readFileSync(f, 'utf8');
      const name = plain(firstHeading(body));
      if (!name) continue;
      const parts = slug(basename(f, '.md')).split('-');
      const kind = parts[parts.length - 1];
      out.push({
        id: slug(basename(f, '.md')), name, set,
        kind: ['agent', 'commander', 'hero', 'mech'].includes(kind) ? kind : null,
        faction: parts.slice(0, -1).join('-') || null,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- factions
// Parses docs/factions/<set>/<slug>.md. Takes the factual layer only:
// home-system values, commodities, starting units/tech, and the *names* of
// faction abilities. Ability prose is discarded; summaries are written by hand.
const DOCS = '.cache/ti4-reference/docs/factions';
// upstream spelling slips
const TYPO = { 'Orbtial Drop': 'Orbital Drop' };

const UNIT_ICON = /:ti4-unit-([a-z]+):/g;
const INCLUDE = /--8<--\s+"([^"]+)"/g;

/** section body between a `-   ## __Title__` card and the next card */
function card(body, title) {
  const re = new RegExp(`-\\s+##\\s+__${title}__[\\s\\S]*?(?=\\n-\\s+##\\s+__|\\n</div>)`, 'i');
  const m = body.match(re);
  return m ? m[0] : '';
}

/** icon repetition encodes quantity: 3x fighter icon => { fighter: 3 } */
function unitCounts(section) {
  const counts = {};
  for (const m of section.matchAll(UNIT_ICON)) {
    counts[m[1]] = (counts[m[1]] || 0) + 1;
  }
  return counts;
}

/** snippet include paths -> ids, skipping fan-mod (absol) variants */
function includeIds(section, kind) {
  const ids = [];
  for (const m of section.matchAll(INCLUDE)) {
    const p = m[1];
    if (p.includes('/absol/')) continue;          // fan mod, not official
    if (kind && !p.includes(`/${kind}/`)) continue;
    const id = p.split('/').pop().replace(/\.md$/, '');
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

function factions() {
  const out = [];
  for (const set of OFFICIAL) {
    const dir = join(DOCS, set);
    if (!existsSync(dir)) continue;
    for (const f of files(dir)) {
      const body = readFileSync(f, 'utf8');
      const titleM = body.match(/^#\s+(.*)$/m);
      if (!titleM) continue;
      const id = slug(basename(f, '.md'));

      // home system: * \[Name\] :ti4-planets-resources-N: :ti4-planets-influence-M:
      const home = [];
      const homeCard = card(body, 'Home System');
      for (const m of homeCard.matchAll(
        /\*\s+\\?\[?\s*([^\n:\]]+?)\s*\\?\]?\s*:ti4-planets-resources-(\d+):[^\n]*?influence-(\d+):/g)) {
        home.push({ name: m[1].replace(/\\/g, ''),
                    resources: Number(m[2]), influence: Number(m[3]) });
      }
      const commM = homeCard.match(/Commodities:\s*(\d+)/i);

      out.push({
        id, name: plain(titleM[1]), set,
        homeSystem: home,
        commodities: commM ? Number(commM[1]) : null,
        startingUnits: {
          space: unitCounts(card(body, 'Starting Space Units')),
          ground: unitCounts(card(body, 'Starting Ground Units')),
        },
        startingTechs: includeIds(card(body, 'Starting Technologies'), 'techs'),
        factionTechs: includeIds(card(body, 'Faction Technologies'), 'techs'),
        abilities: [...card(body, 'Faction Abilities')
          .matchAll(/^\s*###\s+\*\*(.+?)\*\*/gm)]
          .map(m => TYPO[plain(m[1])] ?? plain(m[1])),
        flagship: includeIds(card(body, 'Flagship'), 'units')[0] || null,
        mech: includeIds(card(body, 'Mech'), 'units')[0] || null,
      });
    }
  }
  return out;
}

const data = {
  factions: factions(), units: units(), techs: techs(), leaders: leaders(),
};
for (const [k, v] of Object.entries(data)) {
  writeFileSync(`data/${k}.json`, JSON.stringify(v, null, 2) + '\n');
  console.log(`${k}: ${v.length}`);
}
