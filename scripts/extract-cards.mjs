// Extracts the five card decks: objectives, agendas, action cards, explores,
// relics. As with extract.mjs, only the FACTUAL layer survives -- names, point
// values, phases, deck copy counts, elect targets, planet traits. Card effect
// text is read to derive a category and is then discarded; it is never stored.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA = '.cache/asyncti4/src/main/resources/data';
// official releases only -- every other source value is fan content
const OFFICIAL = { base: 'base', pok: 'pok', codex1: 'codex', codex2: 'codex',
                   codex3: 'codex', codex4: 'codex' };

function load(deck) {
  const dir = join(DATA, deck);
  if (!existsSync(dir)) return [];
  const rows = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    let parsed;
    try { parsed = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    for (const r of Array.isArray(parsed) ? parsed : [parsed]) {
      if (r && OFFICIAL[r.source]) rows.push(r);
    }
  }
  return rows;
}

const slug = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** all text fields joined, used ONLY to pick a category, then thrown away */
const scan = r => [r.text, r.text1, r.text2, r.window, r.resolution]
  .filter(Boolean).join(' ').toLowerCase();

/** first matching rule wins; these buckets are our own taxonomy */
function classify(hay, rules, fallback = 'Other') {
  for (const [label, re] of rules) if (re.test(hay)) return label;
  return fallback;
}

const OBJ_RULES = [
  ['Technology',  /technolog/],
  ['Planets',     /\bplanets?\b|\bcontrol\b/],
  ['Military',    /\bship|\bunit|structure|space dock|\bpds\b|fleet|combat|destroy|invasion|flagship|war sun|mech\b/],
  ['Economy',     /resource|influence|trade good|commodit|spend/],
  ['Politics',    /agenda|vote|law\b|secret objective/],
];
const AC_RULES = [
  ['Combat',      /combat|hit\b|hits\b|sustain|space cannon|bombard|anti-fighter/],
  ['Movement',    /move|movement|retreat|activate|transport/],
  ['Agenda',      /agenda|vote|elect|rider/],
  ['Strategy',    /strategy card|strategic action|secondary|primary/],
  ['Production',  /produce|production|build/],
  ['Status',      /status phase|score|objective/],
  ['Reaction',    /action card/],
];

// ---------------------------------------------------------------- objectives
function objectives() {
  const out = [];
  for (const r of load('public_objectives')) {
    out.push({
      id: slug(r.alias || r.name), name: r.name, set: OFFICIAL[r.source],
      kind: 'public', stage: r.points === 2 ? 'II' : 'I',
      points: r.points, phase: r.phase || null,
      category: classify(scan(r), OBJ_RULES),
    });
  }
  for (const r of load('secret_objectives')) {
    out.push({
      id: slug(r.alias || r.name), name: r.name, set: OFFICIAL[r.source],
      kind: 'secret', stage: null, points: r.points ?? 1, phase: r.phase || null,
      category: classify(scan(r), OBJ_RULES),
    });
  }
  return out;
}

// ---------------------------------------------------------------- agendas
function agendas() {
  return load('agendas').map(r => ({
    id: slug(r.alias || r.name), name: r.name, set: OFFICIAL[r.source],
    // Law or Directive
    type: r.type || null,
    // "Elect Player" / "For/Against" -- trailing rules text in parentheses is
    // card text, so keep only the short outcome label before it
    outcome: (r.target || '').split('(')[0].trim().replace(/\s+/g, ' ') || null,
  })).map(a => (a.outcome && a.outcome.length > 48 ? { ...a, outcome: null } : a));
}

// ---------------------------------------------------------------- action cards
function actionCards() {
  const byName = new Map();
  for (const r of load('action_cards')) {
    const key = r.name;
    if (byName.has(key)) { byName.get(key).copies++; continue; }
    byName.set(key, {
      id: slug(r.alias || r.name), name: r.name, set: OFFICIAL[r.source],
      copies: 1,
      // exact "Action" window is a component action; everything else is a
      // timing trigger, bucketed into our own categories
      timing: /^action$/i.test(r.window || '') ? 'Component action' : 'Triggered',
      category: classify(scan(r), AC_RULES),
    });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- explores
function explores() {
  const byName = new Map();
  for (const r of load('explores')) {
    const key = `${r.name}|${r.type}`;
    if (byName.has(key)) { byName.get(key).copies++; continue; }
    byName.set(key, {
      id: slug(r.id || r.name), name: r.name, set: OFFICIAL[r.source],
      trait: r.type || null,             // Cultural / Hazardous / Industrial / Frontier
      resolution: r.resolution || null,  // Attach / Fragment / Instant / Token
      attaches: Boolean(r.attachmentId), copies: 1,
    });
  }
  return [...byName.values()]
    .sort((a, b) => (a.trait || '').localeCompare(b.trait || '') || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- relics
const relics = () => load('relics')
  .map(r => ({ id: slug(r.alias || r.name), name: r.name, set: OFFICIAL[r.source] }))
  .filter((r, i, a) => a.findIndex(x => x.id === r.id) === i)
  .sort((a, b) => a.name.localeCompare(b.name));

const data = { objectives: objectives(), agendas: agendas(),
               actionCards: actionCards(), explores: explores(), relics: relics() };
for (const [k, v] of Object.entries(data)) {
  writeFileSync(`data/${k}.json`, JSON.stringify(v, null, 2) + '\n');
  console.log(`${k}: ${v.length}`);
}
