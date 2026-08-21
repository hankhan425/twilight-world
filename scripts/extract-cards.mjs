// Extracts objectives, agendas, action cards, explores, relics, and promissory
// notes. Alongside the structured metadata, concise rules text is retained so
// every entry can explain itself in the generated reference.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA = '.cache/asyncti4/src/main/resources/data';
// official releases only -- every other source value is fan content
const OFFICIAL = { base: 'base', pok: 'pok', codex1: 'codex', codex2: 'codex',
                   codex3: 'codex', codex4: 'codex', thunders_edge: 'te' };
const PROMISSORY_FACTION = {
  ghost: 'creuss', sardakk: 'norr',
  keleresa: 'keleres', keleresm: 'keleres', keleresx: 'keleres',
  crimson: 'rebellion', obsidian: 'firmament',
};

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
const cleanText = (...parts) => parts.flat().filter(Boolean)
  .map(part => String(part).replace(/\*+/g, '').replace(/_+/g, '')
    .replace(/>\s*/g, '').replace(/\s+/g, ' ').trim())
  .filter(Boolean).join(' ');
/** All rules fields joined for the site's broad browsing taxonomy. */
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
      description: cleanText(r.text, r.notes ? `Note: ${r.notes}` : ''),
    });
  }
  for (const r of load('secret_objectives')) {
    out.push({
      id: slug(r.alias || r.name), name: r.name, set: OFFICIAL[r.source],
      kind: 'secret', stage: null, points: r.points ?? 1, phase: r.phase || null,
      category: classify(scan(r), OBJ_RULES),
      description: cleanText(r.text, r.notes ? `Note: ${r.notes}` : ''),
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
    description: cleanText(r.text1, r.text2) || cleanText(r.target),
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
      description: cleanText(r.window ? `${r.window}:` : '', r.text),
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
      description: cleanText(r.text),
    });
  }
  return [...byName.values()]
    .sort((a, b) => (a.trait || '').localeCompare(b.trait || '') || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- relics
const relics = () => load('relics')
  .map(r => ({ id: slug(r.alias || r.name), name: r.name, set: OFFICIAL[r.source],
    description: cleanText(r.text) }))
  .filter((r, i, a) => a.findIndex(x => x.id === r.id) === i)
  .sort((a, b) => a.name.localeCompare(b.name));

// --------------------------------------------------------- promissory notes
function promissoryNotes() {
  const byOwnerAndName = new Map();
  for (const r of load('promissory_notes')) {
    const sourceFaction = r.faction || null;
    const faction = PROMISSORY_FACTION[sourceFaction] || sourceFaction || null;
    const key = `${faction || 'common'}|${r.name}`;
    if (byOwnerAndName.has(key)) continue;
    const note = {
      id: slug(`${faction || 'common'}-${r.name}`),
      name: r.name, set: OFFICIAL[r.source], faction,
      playArea: Boolean(r.playArea),
      playImmediately: Boolean(r.playImmediately),
      description: cleanText(r.text, r.notes ? `Note: ${r.notes}` : '')
        .replace(/<color>/gi, 'owning'),
    };
    if (sourceFaction === 'obsidian') note.form = 'Obsidian';
    else if (sourceFaction === 'firmament') note.form = 'Firmament';
    byOwnerAndName.set(key, note);
  }
  return [...byOwnerAndName.values()].sort((a, b) =>
    Number(Boolean(a.faction)) - Number(Boolean(b.faction))
    || (a.faction || '').localeCompare(b.faction || '')
    || a.name.localeCompare(b.name));
}

// ------------------------------------------------------- Thunder's Edge
const TECH_COLOUR = {
  BIOTIC: 'biotic', CYBERNETIC: 'cybernetic',
  PROPULSION: 'propulsion', WARFARE: 'warfare',
};

function breakthroughs() {
  return load('breakthroughs').map(r => {
    const sourceFaction = r.faction || null;
    const faction = PROMISSORY_FACTION[sourceFaction] || sourceFaction;
    const entry = {
      id: slug(r.alias || r.name), name: r.name, set: OFFICIAL[r.source], faction,
      synergy: (r.synergy || []).map(c => TECH_COLOUR[c]).filter(Boolean),
      description: cleanText(r.text),
    };
    if (sourceFaction === 'obsidian') entry.form = 'Obsidian';
    else if (sourceFaction === 'firmament') entry.form = 'Firmament';
    return entry;
  }).sort((a, b) => (a.faction || '').localeCompare(b.faction || '')
    || a.name.localeCompare(b.name));
}

const galacticEvents = () => load('galactic_events').map(r => ({
  id: slug(r.alias || r.name), name: r.name, set: OFFICIAL[r.source],
  complexity: r.complexity ?? null,
  description: cleanText(r.text),
})).sort((a, b) => a.name.localeCompare(b.name));

const data = { objectives: objectives(), agendas: agendas(),
               actionCards: actionCards(), explores: explores(), relics: relics(),
               promissoryNotes: promissoryNotes(), breakthroughs: breakthroughs(),
               galacticEvents: galacticEvents() };
for (const [k, v] of Object.entries(data)) {
  writeFileSync(`data/${k}.json`, JSON.stringify(v, null, 2) + '\n');
  console.log(`${k}: ${v.length}`);
}
