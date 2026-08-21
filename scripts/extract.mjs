// Extracts the structured reference layer: names, numeric stats, tech colours,
// prerequisites, faction/expansion membership, and technology effects. Original
// faction strategy and leader summaries live in src/data/faction-guides.json and
// src/data/leader-guides.json; prose for other card decks is discarded.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const SRC = '.cache/ti4-reference/snippets';
const OFFICIAL = ['base', 'pok', 'codex', 'te']; // fan sets (ds/tf/absol) excluded
const factionId = id => id === 'obsidian' ? 'firmament' : id;

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titleCase = s => String(s ?? '').replace(/(^|[\s-])\w/g, m => m.toUpperCase());
const icons = s => [...s.matchAll(/:ti4-tech-([a-z]+):/g)].map(m => m[1]);
// unwrap <span ...>X</span> -> X, strip bold/emoji-shortcodes, collapse space
const plain = s => s.replace(/\\_/g, '\0').replace(/<[^>]+>/g, '')
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                    .replace(/:[a-z0-9-]+:/g, '').replace(/[\*_]/g, '')
                    .replace(/\0/g, '_').replace(/\s+/g, ' ').trim();
const cleanRulesText = s => plain(s)
  .replace(/\bcoexistance\b/gi, 'coexistence')
  .replace(/\bdelcare\b/gi, 'declare')
  .replace(/\bplanets Then,/g, 'planets. Then,');
const TE_NAME = {
  deepwrought: 'The Deepwrought Scholarate',
  firmament: 'The Firmament',
  ralnel: 'The Ral Nel Consortium',
  rebellion: 'The Crimson Rebellion',
};

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
    const typeM = body.match(/Unit Type:\s*([^:\n]+)/i);
    const upM = body.match(/Upgrade<\/span>:(.*)$/m);
    const rec = {
      id: (faction ? faction + '-' : '') + slug(basename(file, '.md')),
      name, set, faction: faction || null,
      type: typeM ? slug(typeM[1])
                  : slug(basename(file, '.md')).replace(/-i+$/, ''),
      cost: stat(body, 'Cost'),
      combat: stat(body, 'Combat'),
      move: stat(body, 'Move'),
      capacity: stat(body, 'Capacity'),
      abilities: keywords(body),
    };
    if (upM) rec.upgradePrereqs = icons(upM[1]);
    if (set !== 'te' && /:ti4-pok:/.test(head)) rec.set = 'pok';
    out.push(rec);
  };
  for (const f of files(join(SRC, 'units'))) push(f, 'base', null);
  for (const set of OFFICIAL) {
    const dir = join(SRC, 'units', 'faction', set);
    if (!existsSync(dir)) continue;
    for (const f of files(dir)) {
      const sourceFac = slug(basename(f, '.md')).split('-')[0];
      if (set === 'te' && sourceFac === 'keleres') continue; // physical Codex reprint
      const fac = factionId(sourceFac);
      push(f, set, fac);
      if (sourceFac === 'obsidian') out.at(-1).form = 'Obsidian';
      else if (sourceFac === 'firmament') out.at(-1).form = 'Firmament';
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

/** Card effect without heading, prerequisites, stat table, or include markup. */
function techEffect(body) {
  const lines = normStats(body).split('\n').filter(line => {
    const t = line.trim();
    return t && !t.startsWith('### ') && !/^Requirements?:/i.test(t)
      && !/^Unit Type:/i.test(t) && t !== '---' && !t.startsWith('__|__')
      && !t.startsWith('{ .') && !t.startsWith('--8<--');
  }).map(line => {
    const isBullet = /^\*\s+/.test(line);
    const text = plain(line.replace(/^\*\s+/, ''));
    return isBullet && text && !/[.!?]$/.test(text) ? `${text}.` : text;
  }).filter(Boolean);
  return lines.join(' ');
}

function techs() {
  const out = [];
  for (const set of OFFICIAL) {
    const setDir = join(SRC, 'techs', set);
    if (!existsSync(setDir)) continue;
    for (const bucket of readdirSync(setDir)) {
      for (const f of files(join(setDir, bucket))) {
        if (set === 'te' && basename(f).startsWith('keleres-')) continue;
        const body = readFileSync(f, 'utf8');
        const head = firstHeading(body);
        const name = plain(head);
        if (!name) continue;
        const facM = head.match(/:ti4-faction-[a-z]+-([a-z0-9]+):/);
        const reqM = body.match(/Requirements?:(.*)$/m);
        const sourceFac = facM ? facM[1] : null;
        const rec = {
          id: slug(basename(f, '.md')),
          name, set,
          colour: COLOUR[bucket] ?? null,
          category: bucket === 'unit' ? 'unit-upgrade'
                  : bucket === 'other' ? 'other' : 'standard',
          faction: factionId(sourceFac),
          prereqs: reqM ? icons(reqM[1]) : [],
          effect: techEffect(body),
        };
        if (sourceFac === 'obsidian') rec.form = 'Obsidian';
        else if (sourceFac === 'firmament') rec.form = 'Firmament';
        if (bucket === 'unit') {
          const typeM = body.match(/Unit Type:\s*([^:\n]+)/i);
          rec.unit = {
            type: typeM ? slug(typeM[1]) : slug(basename(f, '.md')).replace(/-ii?$/, ''),
            cost: stat(body, 'Cost'), combat: stat(body, 'Combat'),
            move: stat(body, 'Move'), capacity: stat(body, 'Capacity'),
            abilities: keywords(body),
          };
        }
        out.push(rec);
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
      if (set === 'te' && basename(f).startsWith('keleres-')) continue;
      const body = readFileSync(f, 'utf8');
      const name = plain(firstHeading(body));
      if (!name) continue;
      const parts = slug(basename(f, '.md')).split('-');
      // Most files end in the leader kind, but Nomad's agents and Keleres's
      // selectable heroes add a name after it (for example, agent-artuno).
      const kindAt = parts.findIndex(p => ['agent', 'commander', 'hero', 'mech'].includes(p));
      const kind = kindAt >= 0 ? parts[kindAt] : null;
      const sourceFac = kindAt >= 0 ? parts.slice(0, kindAt).join('-') || null : null;
      const ruleM = body.match(/<\/span>:\s*([^\n]+)\s*\n([\s\S]*?)(?:\n---|$)/i);
      const ruleLines = (ruleM?.[2] || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (ruleLines.length > 1 && /^\*\*.+\*\*$/.test(ruleLines[0])) ruleLines.shift();
      const firstRule = ruleLines[0] || '';
      const hasTiming = /:$/.test(firstRule) || /^(?:action|when|after|before|at |during )/i.test(plain(firstRule));
      const rec = {
        id: slug(basename(f, '.md')), name, set,
        kind,
        faction: factionId(sourceFac),
      };
      if (ruleM) {
        rec.unlock = cleanRulesText(ruleM[1]);
        const firstPlain = cleanRulesText(firstRule);
        const colonAt = hasTiming ? firstPlain.indexOf(':') : -1;
        rec.timing = hasTiming
          ? (colonAt >= 0 ? firstPlain.slice(0, colonAt) : firstPlain).replace(/:\s*$/, '')
          : 'Passive while unlocked';
        rec.effect = cleanRulesText((hasTiming
          ? [colonAt >= 0 ? firstPlain.slice(colonAt + 1) : '', ...ruleLines.slice(1)]
          : ruleLines).join(' '));
      }
      if (sourceFac === 'obsidian') rec.form = 'Obsidian';
      else if (sourceFac === 'firmament') rec.form = 'Firmament';
      out.push(rec);
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

function includedHomePlanets(section, id) {
  const home = [];
  for (const m of section.matchAll(INCLUDE)) {
    if (!m[1].includes('/planets/')) continue;
    if (id === 'firmament' && m[1].includes('/obsidian-')) continue;
    const path = join('.cache/ti4-reference', m[1]);
    if (!existsSync(path)) continue;
    const body = readFileSync(path, 'utf8');
    const stats = body.match(/:ti4-planets-resources-(\d+):[^\n]*?:ti4-planets-influence-(\d+):/);
    const name = plain(firstHeading(body));
    if (name && stats) home.push({
      name, resources: Number(stats[1]), influence: Number(stats[2]),
    });
  }
  return home;
}

function factionAbilityDetails(section) {
  const matches = [...section.matchAll(/^\s*###\s+(?::ti4-faction-[^:]+:)?\s*\*\*(.+?)\*\*/gm)];
  return matches.map((m, i) => {
    let text = section.slice(m.index + m[0].length, matches[i + 1]?.index ?? section.length);
    text = text.split(/\n\s*\?\?\?/)[0].split(/\n\s*===/)[0].split(/\n<\/div>/)[0];
    const icon = m[0].match(/:ti4-faction-te-(firmament|obsidian):/);
    const detail = { name: plain(m[1]), text: plain(text) };
    if (icon) detail.form = titleCase(icon[1]);
    return detail;
  }).filter(a => a.name && a.text);
}

function startingTechText(section) {
  return plain(section
    .replace(/^\s*-\s+##\s+__[^\n]+/m, '')
    .replace(/--8<--\s+"[^"]+"/g, '')
    .replace(/:ti4-tech-(propulsion|biotic|warfare|cybernetic):/g, (_, c) => titleCase(c))
    .replace(/^\s*(?:---|===.+)$/gm, ''));
}

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
      const titleM = body.match(/^\s*#\s+(.*)$/m);
      if (!titleM) continue;
      const id = slug(basename(f, '.md'));
      if (set === 'te' && id === 'keleres') continue; // already published as Codex

      // home system: * \[Name\] :ti4-planets-resources-N: :ti4-planets-influence-M:
      const home = [];
      const homeCard = card(body, 'Home System');
      for (const m of homeCard.matchAll(
        /\*\s+\\?\[?\s*([^\n:\]]+?)\s*\\?\]?\s*:ti4-planets-resources-(\d+):[^\n]*?influence-(\d+):/g)) {
        home.push({ name: m[1].replace(/\\/g, ''),
                    resources: Number(m[2]), influence: Number(m[3]) });
      }
      home.push(...includedHomePlanets(homeCard, id));
      const commM = homeCard.match(/Commodities:\s*(\d+)/i);
      const techCard = card(body, 'Starting Technologies')
        || card(body, 'Starting Technologies/Components');
      const abilities = factionAbilityDetails(card(body, 'Faction Abilities'));

      out.push({
        id, name: TE_NAME[id] || plain(titleM[1]), set,
        homeSystem: home,
        commodities: commM ? Number(commM[1]) : null,
        startingUnits: {
          space: unitCounts(card(body, 'Starting Space Units')),
          ground: unitCounts(card(body, 'Starting Ground Units')),
        },
        startingTechs: includeIds(techCard, 'techs'),
        startingTechText: set === 'te' ? startingTechText(techCard) : null,
        factionTechs: includeIds(card(body, 'Faction Technologies'), 'techs'),
        abilities: abilities.map(a => TYPO[a.name] ?? a.name),
        abilityDetails: abilities,
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
