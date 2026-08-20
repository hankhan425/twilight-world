// Static site generator. Reads data/*.json (facts) + src/data/glossary.json
// (original prose) and writes dist/. No dependencies, no runtime framework.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const factions = read('data/factions.json');
const units    = read('data/units.json');
const techs    = read('data/techs.json');
const leaders  = read('data/leaders.json');
const glossary = read('src/data/glossary.json');
const objectives  = read('data/objectives.json');
const agendas     = read('data/agendas.json');
const actionCards = read('data/actionCards.json');
const explores    = read('data/explores.json');
const relics      = read('data/relics.json');

const SET_LABEL = { base: 'Base', pok: 'Prophecy of Kings', codex: 'Codex' };
const esc = s => String(s ?? '').replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const titleCase = s => String(s ?? '').replace(/(^|[\s-])\w/g, m => m.toUpperCase());

function write(path, html) {
  const out = join('dist', path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

/** depth = how many ../ to reach site root */
function layout({ title, depth = 0, body, active = '' }) {
  const r = depth ? '../'.repeat(depth) : './';
  const nav = [
    ['', 'Home'], ['factions/', 'Factions'], ['units/', 'Units'],
    ['techs/', 'Tech'], ['leaders/', 'Leaders'], ['objectives/', 'Objectives'],
    ['agendas/', 'Agendas'], ['cards/', 'Cards'], ['explore/', 'Explore'],
    ['glossary/', 'Rules'],
  ].map(([href, label]) =>
    `<a href="${r}${href}"${active === label ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('');

  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${esc(title)} · TI4 Reference</title>
<meta name="description" content="Fast, ad-free Twilight Imperium 4th Edition reference. Faction stats, unit comparison, and the full tech tree.">
<link rel="stylesheet" href="${r}css/style.css">
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="${r}">TI<span>4</span></a>
  <form class="search" role="search" onsubmit="return false">
    <input id="q" type="search" placeholder="Search factions, units, tech…"
           autocomplete="off" aria-label="Search">
  </form>
  <button id="theme" type="button" aria-label="Toggle theme">◐</button>
</header>
<nav class="tabs">${nav}</nav>
<div id="results" hidden></div>
<main id="main">${body}</main>
<footer>
  <p>An unofficial reference for <b>Twilight Imperium: Fourth Edition</b>, covering the
     base game, Prophecy of Kings, and the Codices.</p>
  <p>Game data is factual (costs, combat values, prerequisites). Rules explanations are
     written for this site. Twilight Imperium is © Fantasy Flight Games; this project is
     not affiliated with or endorsed by FFG. For exact card and rules wording, consult the
     official Living Rules Reference.</p>
</footer>
<script src="${r}js/app.js" defer></script>
</html>`;
}

const chip = (t, cls = '') => `<span class="chip ${cls}">${esc(t)}</span>`;
const setChip = s => chip(SET_LABEL[s] || s, `set-${s}`);

// ------------------------------------------------------------------ units
const statCell = st => st == null ? '<td class="num muted">—</td>'
  : `<td class="num">${st.value}${st.dice ? `<sub>×${st.dice}</sub>` : ''}</td>`;

function unitRow(u, showFaction) {
  const ab = u.abilities.map(a =>
    chip(a.value != null ? `${a.name} ${a.value}${a.dice ? `×${a.dice}` : ''}` : a.name)
  ).join('');
  return `<tr>
    <th scope="row">${esc(u.name)}${u.set === 'pok' ? ' <span class="pok" title="Prophecy of Kings">◆</span>' : ''}</th>
    ${showFaction ? `<td class="fac">${u.faction ? esc(titleCase(u.faction)) : '<span class="muted">—</span>'}</td>` : ''}
    ${statCell(u.cost)}${statCell(u.combat)}${statCell(u.move)}${statCell(u.capacity)}
    <td class="abil">${ab || '<span class="muted">—</span>'}</td>
  </tr>`;
}

function unitsTable(list, showFaction = true) {
  return `<div class="tablewrap"><table class="units">
  <thead><tr>
    <th scope="col">Unit</th>${showFaction ? '<th scope="col">Faction</th>' : ''}
    <th scope="col" class="num" title="Resource cost">Cost</th>
    <th scope="col" class="num" title="Hits on this value or higher">Combat</th>
    <th scope="col" class="num">Move</th>
    <th scope="col" class="num">Cap</th>
    <th scope="col">Abilities</th>
  </tr></thead>
  <tbody>${list.map(u => unitRow(u, showFaction)).join('')}</tbody>
</table></div>`;
}

// ------------------------------------------------------------------ pages
const byId = (arr) => Object.fromEntries(arr.map(x => [x.id, x]));
const techById = byId(techs);
const unitById = byId(units);

function pageFactions() {
  const groups = ['base', 'pok', 'codex'];
  const body = `<h1>Factions</h1>
  <p class="lede">${factions.length} playable factions across the base game, Prophecy of
  Kings, and the Codices. Tap any faction for its home system, starting position, and
  unique technology.</p>
  ${groups.map(g => {
    const list = factions.filter(f => f.set === g);
    if (!list.length) return '';
    return `<h2>${SET_LABEL[g]}</h2>
    <ul class="cards">${list.map(f => `<li><a href="${f.id}.html">
      <span class="cname">${esc(f.name)}</span>
      <span class="meta">${f.homeSystem.map(p => esc(p.name)).join(', ') || '—'}</span>
      <span class="meta">${f.commodities != null ? f.commodities + ' commodities' : ''}</span>
    </a></li>`).join('')}</ul>`;
  }).join('')}`;
  write('factions/index.html', layout({ title: 'Factions', depth: 1, body, active: 'Factions' }));
}

function pageFaction(f) {
  const uList = units.filter(u => u.faction === f.id);
  const tList = f.factionTechs.map(id => techById[id]).filter(Boolean);
  const lList = leaders.filter(l => l.faction === f.id);
  const startTech = f.startingTechs.map(id => techById[id]?.name || titleCase(id));
  const unitLine = o => Object.entries(o)
    .map(([k, v]) => `${v}× ${titleCase(k === 'spacedock' ? 'space dock' : k)}`).join(', ') || '—';

  const body = `<p class="crumb"><a href="./">Factions</a></p>
  <h1>${esc(f.name)} ${setChip(f.set)}</h1>

  <section class="panel">
    <h2>Home system</h2>
    <table class="kv"><tbody>
      ${f.homeSystem.map(p => `<tr><th scope="row">${esc(p.name)}</th>
        <td><b>${p.resources}</b> resources · <b>${p.influence}</b> influence</td></tr>`).join('')
        || '<tr><td class="muted">Not a standard home system</td></tr>'}
      <tr><th scope="row">Commodities</th><td><b>${f.commodities ?? '—'}</b></td></tr>
    </tbody></table>
  </section>

  <section class="panel">
    <h2>Starting position</h2>
    <table class="kv"><tbody>
      <tr><th scope="row">Space</th><td>${esc(unitLine(f.startingUnits.space))}</td></tr>
      <tr><th scope="row">Ground</th><td>${esc(unitLine(f.startingUnits.ground))}</td></tr>
      <tr><th scope="row">Technology</th><td>${startTech.map(t => esc(t)).join(', ') || '—'}</td></tr>
    </tbody></table>
  </section>

  ${f.abilities.length ? `<section class="panel">
    <h2>Faction abilities</h2>
    <ul class="plain">${f.abilities.map(a => `<li><b>${esc(a)}</b></li>`).join('')}</ul>
    <p class="note">Ability names only — see the official rules for exact wording.</p>
  </section>` : ''}

  ${uList.length ? `<section class="panel">
    <h2>Unique units</h2>${unitsTable(uList, false)}
  </section>` : ''}

  ${tList.length ? `<section class="panel">
    <h2>Faction technology</h2>
    <ul class="plain">${tList.map(t => `<li><b>${esc(t.name)}</b>
      ${t.colour ? chip(titleCase(t.colour), `c-${t.colour}`) : chip('Unit upgrade', 'c-unit')}
      ${t.prereqs.length ? `<span class="meta">requires ${t.prereqs.map(titleCase).join(' + ')}</span>` : ''}
    </li>`).join('')}</ul>
  </section>` : ''}

  ${lList.length ? `<section class="panel">
    <h2>Leaders</h2>
    <ul class="plain">${lList.map(l =>
      `<li><b>${esc(l.name)}</b> ${chip(titleCase(l.kind || '—'))}</li>`).join('')}</ul>
  </section>` : ''}`;
  write(`factions/${f.id}.html`, layout({ title: f.name, depth: 1, body, active: 'Factions' }));
}

function pageUnits() {
  const generic = units.filter(u => !u.faction);
  const faction = units.filter(u => u.faction)
    .sort((a, b) => a.faction.localeCompare(b.faction) || a.name.localeCompare(b.name));
  const body = `<h1>Units</h1>
  <p class="lede">Every unit side by side. <b>Combat</b> is the value a die must meet or
  beat, so lower is better; <sub>×n</sub> marks extra dice.</p>
  <h2>Standard units</h2>${unitsTable(generic, false)}
  <h2>Faction units</h2>${unitsTable(faction, true)}`;
  write('units/index.html', layout({ title: 'Units', depth: 1, body, active: 'Units' }));
}

function pageTechs() {
  const body = `<h1>Technology</h1>
  <p class="lede">Research costs nothing but prerequisites: to take a technology you must
  already own the technologies shown as its requirements.</p>
  ${glossary.techColours.map(c => {
    const list = techs.filter(t => t.colour === c.id)
      .sort((a, b) => a.prereqs.length - b.prereqs.length || a.name.localeCompare(b.name));
    return `<section class="panel">
      <h2><span class="dot c-${c.id}"></span>${esc(c.name)}</h2>
      <p class="note">${esc(c.text)}</p>
      <ul class="techlist">${list.map(t => `<li>
        <b>${esc(t.name)}</b>
        ${t.faction ? chip(titleCase(t.faction), 'fac') : ''}
        ${setChip(t.set)}
        <span class="prereq">${t.prereqs.length
          ? t.prereqs.map(p => `<i class="dot c-${p}" title="${titleCase(p)}"></i>`).join('')
          : '<span class="muted">no prerequisites</span>'}</span>
      </li>`).join('')}</ul>
    </section>`;
  }).join('')}
  <section class="panel">
    <h2><span class="dot c-unit"></span>Unit upgrades</h2>
    <p class="note">These replace a unit with its improved version for the rest of the game.</p>
    <ul class="techlist">${techs.filter(t => !t.colour).map(t => `<li>
      <b>${esc(t.name)}</b>${t.faction ? chip(titleCase(t.faction), 'fac') : ''}${setChip(t.set)}
      <span class="prereq">${t.prereqs.map(p => `<i class="dot c-${p}" title="${titleCase(p)}"></i>`).join('')
        || '<span class="muted">—</span>'}</span>
    </li>`).join('')}</ul>
  </section>`;
  write('techs/index.html', layout({ title: 'Technology', depth: 1, body, active: 'Tech' }));
}

function pageLeaders() {
  const kinds = ['agent', 'commander', 'hero', 'mech'];
  const body = `<h1>Leaders</h1>
  <p class="lede">Prophecy of Kings gives every faction an agent, a commander, and a hero.
  Agents ready each round, commanders unlock on a condition, heroes are once-per-game.</p>
  ${kinds.map(k => {
    const list = leaders.filter(l => l.kind === k).sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) return '';
    return `<section class="panel"><h2>${titleCase(k)}s <span class="count">${list.length}</span></h2>
    <ul class="techlist">${list.map(l => `<li><b>${esc(l.name)}</b>
      <span class="meta">${esc(titleCase(l.faction || ''))}</span>${setChip(l.set)}</li>`).join('')}</ul>
    </section>`;
  }).join('')}`;
  write('leaders/index.html', layout({ title: 'Leaders', depth: 1, body, active: 'Leaders' }));
}

function pageGlossary() {
  const body = `<h1>Rules reference</h1>
  <p class="lede">The mechanics that come up most, explained plainly.</p>
  <section class="panel"><h2>Unit abilities &amp; stats</h2>
    <dl>${glossary.keywords.map(k => `<dt>${esc(k.name)} <span class="chip">${esc(k.tag)}</span></dt>
      <dd>${esc(k.text)}</dd>`).join('')}</dl>
  </section>
  <section class="panel"><h2>Strategy cards</h2>
    <div class="tablewrap"><table class="units"><thead><tr>
      <th scope="col" class="num">#</th><th scope="col">Card</th>
      <th scope="col">Primary</th><th scope="col">Secondary</th>
    </tr></thead><tbody>${glossary.strategyCards.map(s => `<tr>
      <td class="num">${s.initiative}</td><th scope="row">${esc(s.name)}</th>
      <td>${esc(s.primary)}</td><td>${esc(s.secondary)}</td></tr>`).join('')}
    </tbody></table></div>
  </section>`;
  write('glossary/index.html', layout({ title: 'Rules reference', depth: 1, body, active: 'Rules' }));
}

function pageHome() {
  const counts = [
    [factions.length, 'Factions', 'factions/'], [units.length, 'Units', 'units/'],
    [techs.length, 'Technologies', 'techs/'], [leaders.length, 'Leaders', 'leaders/'],
    [objectives.length, 'Objectives', 'objectives/'], [agendas.length, 'Agendas', 'agendas/'],
    [actionCards.length, 'Action cards', 'cards/'], [explores.length, 'Explore cards', 'explore/'],
  ];
  const body = `<h1 class="hero">Twilight Imperium <span>4th Edition</span></h1>
  <p class="lede">A fast, ad-free reference for the base game, Prophecy of Kings, and the
  Codices. Everything is on one page per topic, works offline, and is built for a phone.</p>
  <ul class="stats">${counts.map(([n, l, h]) =>
    `<li><a href="${h}"><b>${n}</b><span>${l}</span></a></li>`).join('')}</ul>
  <section class="panel"><h2>Strategy cards</h2>
    <ol class="strat">${glossary.strategyCards.map(s =>
      `<li><span class="init">${s.initiative}</span><b>${esc(s.name)}</b></li>`).join('')}</ol>
  </section>`;
  write('index.html', layout({ title: 'Twilight Imperium 4 Reference', depth: 0, body, active: 'Home' }));
}

// ------------------------------------------------------------------ search
function searchIndex() {
  const docs = [
    ...factions.map(f => ({ t: f.name, u: `factions/${f.id}.html`, k: 'Faction' })),
    ...units.map(u => ({ t: u.name, u: 'units/', k: u.faction ? titleCase(u.faction) : 'Unit' })),
    ...techs.map(t => ({ t: t.name, u: 'techs/', k: t.colour ? titleCase(t.colour) : 'Unit upgrade' })),
    ...leaders.map(l => ({ t: l.name, u: 'leaders/', k: titleCase(l.kind || 'Leader') })),
    ...objectives.map(o => ({ t: o.name, u: 'objectives/',
        k: o.kind === 'secret' ? 'Secret objective' : `Stage ${o.stage} objective` })),
    ...agendas.map(a => ({ t: a.name, u: 'agendas/', k: a.type || 'Agenda' })),
    ...actionCards.map(c => ({ t: c.name, u: 'cards/', k: 'Action card' })),
    ...explores.map(e => ({ t: e.name, u: 'explore/', k: `${e.trait} explore` })),
    ...relics.map(r => ({ t: r.name, u: 'explore/', k: 'Relic' })),
    ...glossary.keywords.map(g => ({ t: g.name, u: 'glossary/', k: 'Rules' })),
    ...glossary.strategyCards.map(s => ({ t: s.name, u: 'glossary/', k: 'Strategy card' })),
  ];
  write('js/search-index.json', JSON.stringify(docs));
  return docs.length;
}


// ------------------------------------------------------- objectives / cards
/** filter bar: pure CSS via :has() + a tiny data attribute on each row */
function filterBar(name, values) {
  return `<div class="filters" data-filter="${name}">
    <button class="f on" data-v="">All</button>
    ${values.map(v => `<button class="f" data-v="${esc(v)}">${esc(v)}</button>`).join('')}
  </div>`;
}

function pageObjectives() {
  const cats = [...new Set(objectives.map(o => o.category))].sort();
  const group = (kind, stage) => objectives
    .filter(o => o.kind === kind && (stage == null || o.stage === stage))
    .sort((a, b) => a.name.localeCompare(b.name));
  const list = (rows) => `<ul class="techlist">${rows.map(o => `<li data-cat="${esc(o.category)}">
    <b>${esc(o.name)}</b>${chip(o.category)}${setChip(o.set)}
    <span class="prereq">${chip(`${o.points} VP`, 'vp')}${o.phase ? chip(o.phase) : ''}</span>
  </li>`).join('')}</ul>`;

  const body = `<h1>Objectives</h1>
  <p class="lede">Stage I objectives are worth 1 point and Stage II are worth 2. Secret
  objectives are worth 1 and can only be scored by the player holding them. Categories
  below are our own grouping, to make the deck easier to scan.</p>
  ${filterBar('cat', cats)}
  <section class="panel"><h2>Public · Stage I <span class="count">${group('public', 'I').length}</span></h2>
    ${list(group('public', 'I'))}</section>
  <section class="panel"><h2>Public · Stage II <span class="count">${group('public', 'II').length}</span></h2>
    ${list(group('public', 'II'))}</section>
  <section class="panel"><h2>Secret <span class="count">${group('secret').length}</span></h2>
    ${list(group('secret'))}</section>`;
  write('objectives/index.html', layout({ title: 'Objectives', depth: 1, body, active: 'Objectives' }));
}

function pageAgendas() {
  const body = `<h1>Agendas</h1>
  <p class="lede">Laws stay in play once resolved; directives resolve once and are
  discarded. The outcome column shows what the table actually votes on.</p>
  ${filterBar('cat', ['Law', 'Directive'])}
  ${['Law', 'Directive'].map(t => {
    const list = agendas.filter(a => a.type === t).sort((a, b) => a.name.localeCompare(b.name));
    return `<section class="panel"><h2>${t}s <span class="count">${list.length}</span></h2>
    <ul class="techlist">${list.map(a => `<li data-cat="${t}">
      <b>${esc(a.name)}</b>${setChip(a.set)}
      <span class="prereq">${a.outcome ? chip(a.outcome, 'outcome') : ''}</span>
    </li>`).join('')}</ul></section>`;
  }).join('')}`;
  write('agendas/index.html', layout({ title: 'Agendas', depth: 1, body, active: 'Agendas' }));
}

function pageActionCards() {
  const cats = [...new Set(actionCards.map(c => c.category))].sort();
  const total = actionCards.reduce((n, c) => n + c.copies, 0);
  const body = `<h1>Action cards</h1>
  <p class="lede">${actionCards.length} unique cards, ${total} in the deck across all
  official sets. <b>Copies</b> is how many of that card the deck holds — the reason
  Sabotage keeps appearing. Categories are our own grouping.</p>
  ${filterBar('cat', cats)}
  <section class="panel"><ul class="techlist">${actionCards.map(c => `<li data-cat="${esc(c.category)}">
    <b>${esc(c.name)}</b>${chip(c.category)}${setChip(c.set)}
    <span class="prereq">${c.copies > 1 ? chip(`×${c.copies}`, 'vp') : ''}
      ${chip(c.timing)}</span>
  </li>`).join('')}</ul></section>`;
  write('cards/index.html', layout({ title: 'Action cards', depth: 1, body, active: 'Cards' }));
}

function pageExplore() {
  const traits = ['Cultural', 'Hazardous', 'Industrial', 'Frontier'];
  const body = `<h1>Exploration</h1>
  <p class="lede">Explore a planet and you draw from the deck matching its trait; empty
  space uses the frontier deck. <b>Attach</b> cards stay on the planet, <b>fragment</b>
  cards are relic fragments, and <b>instant</b> cards resolve immediately.</p>
  ${traits.map(t => {
    const list = explores.filter(e => e.trait === t);
    if (!list.length) return '';
    const n = list.reduce((a, e) => a + e.copies, 0);
    return `<section class="panel">
      <h2><span class="dot t-${t.toLowerCase()}"></span>${t}
        <span class="count">${list.length} unique · ${n} cards</span></h2>
      <ul class="techlist">${list.map(e => `<li>
        <b>${esc(e.name)}</b>${e.resolution ? chip(e.resolution) : ''}${setChip(e.set)}
        <span class="prereq">${e.copies > 1 ? chip(`×${e.copies}`, 'vp') : ''}</span>
      </li>`).join('')}</ul></section>`;
  }).join('')}
  <section class="panel"><h2>Relics <span class="count">${relics.length}</span></h2>
    <p class="note">Drawn by trading in three relic fragments.</p>
    <ul class="techlist">${relics.map(r => `<li>
      <b>${esc(r.name)}</b>${setChip(r.set)}</li>`).join('')}</ul>
  </section>`;
  write('explore/index.html', layout({ title: 'Exploration', depth: 1, body, active: 'Explore' }));
}

// ------------------------------------------------------------------ run
if (existsSync('dist')) rmSync('dist', { recursive: true });
pageHome(); pageFactions(); factions.forEach(pageFaction);
pageUnits(); pageTechs(); pageLeaders(); pageGlossary();
pageObjectives(); pageAgendas(); pageActionCards(); pageExplore();
const n = searchIndex();
cpSync('public', 'dist', { recursive: true });
console.log(`built ${factions.length + 10} pages, ${n} search entries`);
