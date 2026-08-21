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
const factionGuides = read('src/data/faction-guides.json');
const leaderGuides  = read('src/data/leader-guides.json');
const objectives  = read('data/objectives.json');
const agendas     = read('data/agendas.json');
const actionCards = read('data/actionCards.json');
const explores    = read('data/explores.json');
const relics      = read('data/relics.json');
const promissoryNotes = read('data/promissoryNotes.json');
const breakthroughs = read('data/breakthroughs.json');
const galacticEvents = read('data/galacticEvents.json');
const planets     = read('data/planets.json');
const systems     = read('data/systems.json');
const stats       = read('data/stats.json');

const SET_LABEL = {
  base: 'Base', pok: 'Prophecy of Kings', codex: 'Codex', te: "Thunder's Edge",
};
const esc = s => String(s ?? '').replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const titleCase = s => String(s ?? '').replace(/(^|[\s-])\w/g, m => m.toUpperCase());

const UNIT_TYPES = {
  carrier: ['Carrier', 'carrier'], cruiser: ['Cruiser', 'cruiser'],
  destroyer: ['Destroyer', 'destroyer'], dreadnought: ['Dreadnought', 'dreadnought'],
  fighter: ['Fighter', 'fighter'], flagship: ['Flagship', 'flagship'],
  'decayed-flagship': ['Flagship', 'flagship'],
  infantry: ['Infantry', 'infantry'], mech: ['Mech', 'mech'], pds: ['PDS', 'pds'],
  'decayed-mech': ['Mech', 'mech'],
  space: ['Space Dock', 'spacedock'], 'space-dock': ['Space Dock', 'spacedock'],
  war: ['War Sun', 'warsun'], 'war-sun': ['War Sun', 'warsun'],
  'null-war-sun': ['War Sun', 'warsun'],
};

const unitType = u => UNIT_TYPES[u.type] || [titleCase(u.type), 'flagship'];
const unitIcon = u => {
  const [label, icon] = unitType(u);
  return `<img class="unit-icon" src="../icons/units/${icon}.svg" alt="" width="28" height="28" loading="lazy"><span class="sr-only">${esc(label)}: </span>`;
};
const unitTypeChip = u => chip(unitType(u)[0], 'unit-type');
const unitExpansionMark = u => {
  if (u.set === 'pok') return ` <span class="expansion-unit expansion-pok" title="Prophecy of Kings" aria-label="Prophecy of Kings">
    <svg viewBox="0 0 18 20" aria-hidden="true" focusable="false">
      <path d="M9 1.5 11.3 8.2 14.2 3.8 16.1 12.2 9 18.5 1.9 12.2 3.8 3.8 6.7 8.2 9 1.5Z"/>
      <path d="M6.7 8.2 9 11.6l2.3-3.4M9 11.6v6.9"/>
    </svg>
  </span>`;
  if (u.set === 'te') return ' <span class="expansion-unit expansion-te" title="Thunder\'s Edge" aria-label="Thunder\'s Edge">ϟ</span>';
  return '';
};

function factionGuide(f) {
  const local = factionGuides[f.id] || {};
  const parent = local.inherits ? (factionGuides[local.inherits] || {}) : {};
  const writtenAbilities = local.abilities ?? parent.abilities ?? [];
  const writtenNotes = local.promissoryNotes ?? parent.promissoryNotes ?? [];
  return { ...parent, ...local,
    abilities: writtenAbilities.length ? writtenAbilities : (f.abilityDetails || []),
    promissoryNotes: writtenNotes.length ? writtenNotes
      : promissoryNotes.filter(n => n.faction === f.id).map(n => ({
        name: n.name, form: n.form || null,
        timing: n.playImmediately ? 'Immediately when received.'
          : n.playArea ? 'When this note is put into play.'
          : 'At the timing stated by the note.',
        effect: n.description,
      })),
  };
}

const factionIcon = f => `<img class="faction-icon" src="../icons/factions/${f.id}.svg" alt="" width="56" height="56" loading="lazy">`;
const cleanLeaderName = name => String(name || '')
  .replace(/_/g, '')
  .replace(/^(?:agent|commander|hero)\s*:?\s*/i, '')
  .replace(/\s+/g, ' ')
  .trim();
const leaderKind = l => l.kind || l.id.split('-').find(p => ['agent', 'commander', 'hero'].includes(p)) || null;
const leaderFactionId = l => l.faction || l.id.split('-')[0];
const isDisplayedLeader = l => Boolean(leaderKind(l)) && !/-te$/.test(l.id);
const leadersForFaction = id => leaders.filter(l => isDisplayedLeader(l) && leaderFactionId(l) === id)
  .sort((a, b) => ['agent', 'commander', 'hero'].indexOf(leaderKind(a))
    - ['agent', 'commander', 'hero'].indexOf(leaderKind(b)) || a.name.localeCompare(b.name));

function collapsiblePanel(title, content, { className = '', open = true } = {}) {
  return `<details class="panel collapsible ${className}"${open ? ' open' : ''}>
    <summary><h2>${title}</h2></summary>
    <div class="panel-body">${content}</div>
  </details>`;
}

function write(path, html) {
  const out = join('dist', path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

/** depth = how many ../ to reach site root */
function layout({ title, depth = 0, body, active = '' }) {
  const r = depth ? '../'.repeat(depth) : './';
  const navItems = [
    ['', 'Home'], ['factions/', 'Factions'], ['units/', 'Units'],
    ['techs/', 'Tech'], ['leaders/', 'Leaders'],
    ['promissory/', 'Promissory'], ['cards/', 'Cards'], ['explore/', 'Explore'],
    ['objectives/', 'Objectives'], ['agendas/', 'Agendas'],
    ['planets/', 'Planets'], ['systems/', 'Systems'],
    ['glossary/', 'Rules'],
  ];
  const nav = navItems.map(([href, label]) =>
    `<a href="${r}${href}"${active === label ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('');

  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${esc(title)} · Twilight World</title>
<meta name="description" content="Twilight World is a fast, ad-free Twilight Imperium 4th Edition reference covering factions, units, technology, and rules.">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)} · Twilight World">
<meta property="og:description" content="Current PoK and Thunder's Edge faction win rates from standard six-player AsyncTI4 games.">
<meta property="og:image" content="${r}og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)} · Twilight World">
<meta name="twitter:description" content="Current PoK and Thunder's Edge faction win rates from standard six-player AsyncTI4 games.">
<meta name="twitter:image" content="${r}og.png">
<link rel="stylesheet" href="${r}css/style.css">
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="${r}">Twilight <span>World</span></a>
  <nav class="tabs" aria-label="Primary">${nav}</nav>
  <details class="mobile-menu">
    <summary>Menu <span class="menu-count">${navItems.length}</span></summary>
    <nav class="mobile-links" aria-label="Primary navigation">${nav}</nav>
  </details>
  <button id="theme" type="button" aria-label="Toggle theme">◐</button>
</header>
<main id="main">${body}</main>
<footer>
  <p>An unofficial reference for <b>Twilight Imperium: Fourth Edition</b>, covering the
     base game, Prophecy of Kings, Thunder's Edge, and the Codices.</p>
  <p>Game data is factual (costs, combat values, prerequisites). Rules explanations are
     written for this site. Twilight Imperium is © Fantasy Flight Games; this project is
     not affiliated with or endorsed by FFG. For exact card and rules wording, consult the
     official Living Rules Reference.</p>
  <p>Reference data and symbols are adapted from the CC BY 4.0
     <a href="https://github.com/scottmk/ti4-reference">ti4-reference project</a>.</p>
</footer>
<script src="${r}js/app.js" defer></script>
</html>`;
}

const chip = (t, cls = '') => `<span class="chip ${cls}">${esc(t)}</span>`;
const setChip = s => chip(SET_LABEL[s] || s, `set-${s}`);

// ------------------------------------------------------------------ units
const statCell = st => st == null ? '<td class="num muted">—</td>'
  : `<td class="num">${st.value}${st.dice ? `<sub>×${st.dice}</sub>` : ''}</td>`;

function unitRow(u, showFaction, showType) {
  const ab = u.abilities.map(a =>
    chip(a.value != null ? `${a.name} ${a.value}${a.dice ? `×${a.dice}` : ''}` : a.name)
  ).join('');
  const tags = [
    showType ? unitTypeChip(u) : '',
    u.form ? chip(`${u.form} form`, 'unit-form') : '',
  ].filter(Boolean).join('');
  return `<tr>
    <th scope="row"><span class="unit-name">${unitIcon(u)}<span><span class="unit-title">${esc(u.name)}${u.isUpgrade ? ' (Upgrade)' : ''}${unitExpansionMark(u)}</span>${tags ? `<span class="unit-tags">${tags}</span>` : ''}</span></span></th>
    ${showFaction ? `<td class="fac">${u.faction ? esc(factionById[u.faction]?.name || titleCase(u.faction)) : '<span class="muted">—</span>'}</td>` : ''}
    ${statCell(u.cost)}${statCell(u.combat)}${statCell(u.move)}${statCell(u.capacity)}
    <td class="abil">${ab || '<span class="muted">—</span>'}</td>
  </tr>`;
}

function unitsTable(list, showFaction = true, showType = true) {
  return `<div class="tablewrap"><table class="units">
  <thead><tr>
    <th scope="col">Unit</th>${showFaction ? '<th scope="col">Faction</th>' : ''}
    <th scope="col" class="num" title="Resource cost">Cost</th>
    <th scope="col" class="num" title="Hits on this value or higher">Combat</th>
    <th scope="col" class="num">Move</th>
    <th scope="col" class="num">Cap</th>
    <th scope="col">Abilities</th>
  </tr></thead>
  <tbody>${list.map(u => unitRow(u, showFaction, showType)).join('')}</tbody>
</table></div>`;
}

const unitUpgradeProfile = (t, faction = t.faction) => ({
  id: `${t.id}-profile`, name: t.name, set: t.set, faction, form: t.form || null,
  ...t.unit, isUpgrade: true,
});

const sortUnitProfiles = (a, b) =>
  unitType(a)[0].localeCompare(unitType(b)[0])
  || Number(Boolean(a.isUpgrade)) - Number(Boolean(b.isUpgrade))
  || a.name.localeCompare(b.name);

// ------------------------------------------------------------------ pages
const byId = (arr) => Object.fromEntries(arr.map(x => [x.id, x]));
const techById = byId(techs);
const unitById = byId(units);
const factionById = byId(factions);

function techDescription(t) {
  const parts = [];
  if (t.unit) {
    const stats = [
      ['Cost', t.unit.cost], ['Combat', t.unit.combat],
      ['Move', t.unit.move], ['Capacity', t.unit.capacity],
    ].filter(([, stat]) => stat != null).map(([label, stat]) =>
      `${label} ${stat.value}${stat.dice ? ` ×${stat.dice}` : ''}`);
    if (stats.length) parts.push(`Unit upgrade — ${stats.join(', ')}.`);
  }
  if (t.effect) parts.push(t.effect);
  return parts.join(' ') || 'This unit upgrade changes the unit to the statistics shown.';
}

function entryWithTooltip(entry, description, prefix, className = '') {
  const tipId = `${prefix}-tip-${entry.id}`;
  return `<span class="entry-with-tip ${className}" tabindex="0" aria-describedby="${tipId}">
    <b>${esc(entry.name)}</b><span class="tip-icon" aria-hidden="true">?</span>
    <span class="entry-tooltip" id="${tipId}" role="tooltip">${esc(description)}</span>
  </span>`;
}

function techWithTooltip(t) {
  const tipId = `tech-tip-${t.id}`;
  const description = techDescription(t);
  return `<span class="entry-with-tip tech-with-tip" tabindex="0" aria-describedby="${tipId}">
    <b>${esc(t.name)}</b><span class="tip-icon" aria-hidden="true">?</span>
    <span class="entry-tooltip tech-tooltip" id="${tipId}" role="tooltip">${esc(description)}</span>
  </span>`;
}

function technologyList(list, { showUnitIcons = false } = {}) {
  return `<ul class="techlist">${list.map(t => `<li>
    ${showUnitIcons && t.unit ? unitIcon(t.unit) : ''}
    ${techWithTooltip(t)}
    ${t.faction ? chip(factionById[t.faction]?.name || titleCase(t.faction), 'fac') : ''}
    ${t.form ? chip(`${t.form} form`) : ''}
    ${setChip(t.set)}
    <span class="prereq">${t.prereqs.length
      ? t.prereqs.map(p => `<i class="dot c-${p}" title="${titleCase(p)}"></i>`).join('')
      : '<span class="muted">no prerequisites</span>'}</span>
  </li>`).join('')}</ul>`;
}

function technologyGroups(list, options = {}) {
  const groups = [
    ['Common technologies', list.filter(t => !t.faction)],
    ['Faction-specific technologies', list.filter(t => t.faction)],
  ];
  return groups.filter(([, entries]) => entries.length).map(([title, entries]) =>
    `<div class="tech-group" role="group" aria-label="${title}">${technologyList(entries, options)}</div>`
  ).join('');
}

function pageFactions() {
  const groups = ['base', 'pok', 'te', 'codex'];
  const body = `<h1>Factions</h1>
  <p class="lede">${factions.length} faction entries across the base game, Prophecy of
  Kings, Thunder's Edge, the Codices, and the Liberation of Ordinian scenario. Each
  guide starts with how the faction plays, where it excels, and what gives it trouble.</p>
  ${groups.map(g => {
    const list = factions.filter(f => f.set === g);
    if (!list.length) return '';
    return `<h2>${SET_LABEL[g]}</h2>
    <ul class="cards faction-cards">${list.map(f => `<li><a class="faction-card" href="${f.id}.html">
      ${factionIcon(f)}<span class="faction-card-copy">
      <span class="cname">${esc(f.name)}</span>
      <span class="faction-card-summary">${esc(factionGuide(f).summary || 'Faction reference and setup details.')}</span>
      <span class="meta">${f.homeSystem.map(p => esc(p.name)).join(', ') || 'Scenario setup'}${f.commodities != null ? ` · ${f.commodities} commodities` : ''}</span>
      </span>
    </a></li>`).join('')}</ul>`;
  }).join('')}`;
  write('factions/index.html', layout({ title: 'Factions', depth: 1, body, active: 'Factions' }));
}

function pageFaction(f) {
  const uList = units.filter(u => u.faction === f.id);
  const tList = f.factionTechs.map(id => techById[id]).filter(Boolean);
  const upgradeUnits = tList.filter(t => t.category === 'unit-upgrade' && t.unit)
    .map(t => unitUpgradeProfile(t, f.id));
  const uniqueUnits = [...uList, ...upgradeUnits].sort(sortUnitProfiles);
  const lList = leadersForFaction(f.id);
  const bList = breakthroughs.filter(b => b.faction === f.id);
  const guide = factionGuide(f);
  const startTech = f.startingTechs.map(id => techById[id]?.name || titleCase(id));
  const unitLine = o => Object.entries(o)
    .map(([k, v]) => `${v}× ${titleCase(k === 'spacedock' ? 'space dock' : k)}`).join(', ') || '—';

  const overview = `<p class="faction-summary">${esc(guide.summary || 'Faction overview unavailable.')}</p>
    <dl class="matchups">
      <div><dt>Strengths</dt><dd>${esc(guide.strengths || '—')}</dd></div>
      <div><dt>Weaknesses</dt><dd>${esc(guide.weaknesses || '—')}</dd></div>
      <div><dt>Good against</dt><dd>${esc(guide.goodAgainst || '—')}</dd></div>
      <div><dt>Poor against</dt><dd>${esc(guide.poorAgainst || '—')}</dd></div>
    </dl>`;

  const abilities = guide.abilities.length
    ? `<ul class="explained-list">${guide.abilities.map(a => `<li><div class="leader-heading"><b>${esc(a.name)}</b>${a.form ? chip(`${a.form} form`) : ''}</div><p>${esc(a.text)}</p></li>`).join('')}</ul>`
    : '<p class="muted">This scenario faction has no separate faction abilities.</p>';

  const specialComponents = guide.specialComponents?.length
    ? `<ul class="explained-list">${guide.specialComponents.map(c => `<li><b>${esc(c.name)}</b><p>${esc(c.text)}</p></li>`).join('')}</ul>`
    : '';

  const promissoryNotes = guide.promissoryNotes.length
    ? `<ul class="explained-list">${guide.promissoryNotes.map(n => `<li><div class="leader-heading"><b>${esc(n.name)}</b>${n.form ? chip(`${n.form} form`) : ''}</div>
        <dl class="effect"><dt>When</dt><dd>${esc(n.timing)}</dd><dt>Effect</dt><dd>${esc(n.effect)}</dd></dl>
      </li>`).join('')}</ul>`
    : '<p class="muted">This scenario faction has no faction-specific promissory note.</p>';

  const leaderList = lList.length ? `<ul class="leader-list">${lList.map(l => {
    const kind = leaderKind(l);
    const info = leaderGuides[l.id] || {};
    const unlock = info.unlock || l.unlock || (kind === 'agent' ? 'Always unlocked.'
      : kind === 'hero' ? 'Have 3 scored objectives.' : 'See the leader component.');
    return `<li><div class="leader-heading"><b>${esc(cleanLeaderName(l.name))}</b>${chip(titleCase(kind))}${l.form ? chip(`${l.form} form`) : ''}</div>
      <dl class="effect"><dt>Unlock</dt><dd>${esc(unlock)}</dd>
        <dt>When</dt><dd>${esc(info.timing || l.timing || 'See the leader component.')}</dd>
        <dt>Effect</dt><dd>${esc(info.effect || l.effect || 'See the leader component for this scenario-specific effect.')}</dd>
      </dl></li>`;
  }).join('')}</ul>` : '<p class="muted">No separate leader suite is listed for this scenario faction.</p>';

  const body = `<p class="crumb"><a href="./">Factions</a></p>
  <h1 class="faction-title">${factionIcon(f)}<span>${esc(f.name)} ${setChip(f.set)}</span></h1>

  ${collapsiblePanel('Overview', overview, { className: 'overview-panel' })}

  ${collapsiblePanel('Home system', `<table class="kv"><tbody>
      ${f.homeSystem.map(p => `<tr><th scope="row">${esc(p.name)}</th>
        <td><b>${p.resources}</b> resources · <b>${p.influence}</b> influence</td></tr>`).join('')
        || '<tr><td colspan="2" class="muted">Not a standard home system</td></tr>'}
      <tr><th scope="row">Commodities</th><td><b>${f.commodities ?? '—'}</b></td></tr>
    </tbody></table>`)}

  ${collapsiblePanel('Starting position', `<table class="kv"><tbody>
      <tr><th scope="row">Space</th><td>${esc(unitLine(f.startingUnits.space))}</td></tr>
      <tr><th scope="row">Ground</th><td>${esc(unitLine(f.startingUnits.ground))}</td></tr>
      <tr><th scope="row">Technology</th><td>${startTech.map(t => esc(t)).join(', ') || esc(f.startingTechText) || '—'}</td></tr>
    </tbody></table>`)}

  ${collapsiblePanel('Faction abilities', abilities)}

  ${specialComponents ? collapsiblePanel('Special components', specialComponents) : ''}

  ${bList.length ? collapsiblePanel('Breakthrough', `<ul class="explained-list">${bList.map(b => `<li>
      <div class="leader-heading"><b>${esc(b.name)}</b>${b.form ? chip(`${b.form} form`) : ''}
        ${setChip(b.set)}</div><p>${esc(b.description)}</p>
      ${b.synergy.length ? `<p class="synergy"><b>Synergy:</b> ${b.synergy.map(c => chip(titleCase(c), `c-${c}`)).join('')} <span class="muted">Either color may count as the other for technology requirements and technology objectives.</span></p>` : ''}
    </li>`).join('')}</ul>`) : ''}

  ${collapsiblePanel('Faction promissory notes', promissoryNotes)}

  ${uniqueUnits.length ? collapsiblePanel('Unique units', unitsTable(uniqueUnits, false)) : ''}

  ${tList.length ? collapsiblePanel('Faction technology', `<ul class="explained-list faction-tech-list">${tList.map(t => `<li>
      <div class="tech-heading"><b>${esc(t.name)}</b>
        ${t.colour ? chip(titleCase(t.colour), `c-${t.colour}`) : chip('Unit upgrade', 'c-unit')}
        ${t.form ? chip(`${t.form} form`) : ''}
        ${t.prereqs.length ? `<span class="meta prereq tech-requirements"><span>requires</span>${t.prereqs.map((p, i) => `${i ? '<span class="requirement-plus" aria-hidden="true">+</span>' : ''}${chip(titleCase(p), `c-${p}`)}`).join('')}</span>` : ''}
      </div><p>${esc(techDescription(t))}</p>
    </li>`).join('')}</ul>`) : ''}

  ${collapsiblePanel('Leaders', leaderList)}`;
  write(`factions/${f.id}.html`, layout({ title: f.name, depth: 1, body, active: 'Factions' }));
}

function pageUnits() {
  const upgrades = techs.filter(t => t.category === 'unit-upgrade' && t.unit)
    .map(t => unitUpgradeProfile(t));
  const generic = [...units.filter(u => !u.faction), ...upgrades.filter(u => !u.faction)]
    .sort(sortUnitProfiles);
  const faction = [...units.filter(u => u.faction), ...upgrades.filter(u => u.faction)]
    .sort((a, b) => a.faction.localeCompare(b.faction) || sortUnitProfiles(a, b));
  const body = `<h1>Units</h1>
  <p class="lede">Every base and upgraded unit side by side. <b>Combat</b> is the value a
  die must meet or beat, so lower is better; <sub>×n</sub> marks extra dice.</p>
  <h2>Standard units</h2>${unitsTable(generic, false, false)}
  <h2>Faction units</h2>${unitsTable(faction, true)}`;
  write('units/index.html', layout({ title: 'Units', depth: 1, body, active: 'Units' }));
}

function pageTechs() {
  const unitUpgrades = techs.filter(t => t.category === 'unit-upgrade' && t.unit)
    .sort((a, b) => a.prereqs.length - b.prereqs.length || a.name.localeCompare(b.name));
  const otherTechs = techs.filter(t => !t.colour && t.category !== 'unit-upgrade')
    .sort((a, b) => a.name.localeCompare(b.name));
  const body = `<h1>Technology</h1>
  <p class="lede">Research costs nothing but prerequisites: to take a technology you must
  already own the technologies shown as its requirements.</p>
  ${glossary.techColours.map(c => {
    const list = techs.filter(t => t.colour === c.id)
      .sort((a, b) => a.prereqs.length - b.prereqs.length || a.name.localeCompare(b.name));
    return `<section class="panel">
      <h2><span class="dot c-${c.id}"></span>${esc(c.name)}</h2>
      <p class="note">${esc(c.text)}</p>
      ${technologyGroups(list)}
    </section>`;
  }).join('')}
  <section class="panel">
    <h2><span class="dot c-unit"></span>Unit upgrades</h2>
    <p class="note">These replace a unit with its improved version for the rest of the game.</p>
    ${technologyGroups(unitUpgrades, { showUnitIcons: true })}
  </section>
  ${otherTechs.length ? `<section class="panel">
    <h2>Other technologies</h2>
    <p class="note">Special faction technologies without a color or upgraded unit profile.</p>
    ${technologyGroups(otherTechs)}
  </section>` : ''}`;
  write('techs/index.html', layout({ title: 'Technology', depth: 1, body, active: 'Tech' }));
}

function pageLeaders() {
  const kinds = ['agent', 'commander', 'hero'];
  const body = `<h1>Leaders</h1>
  <p class="lede">Prophecy of Kings gives every faction an agent, a commander, and a hero.
  Agents begin available and ready each round, commanders unlock on a condition, and
  heroes usually unlock after three scored objectives and are used once per game.</p>
  ${kinds.map(k => {
    const list = leaders.filter(l => isDisplayedLeader(l) && leaderKind(l) === k)
      .sort((a, b) => cleanLeaderName(a.name).localeCompare(cleanLeaderName(b.name)));
    if (!list.length) return '';
    const kindLabel = k === 'hero' ? 'Heroes' : `${titleCase(k)}s`;
    return `<section class="panel"><h2>${kindLabel} <span class="count">${list.length}</span></h2>
    <ul class="leader-list compact-leaders">${list.map(l => {
      const info = leaderGuides[l.id] || {};
      const factionName = factionById[leaderFactionId(l)]?.name || titleCase(leaderFactionId(l));
      const unlock = info.unlock || l.unlock
        || (k === 'agent' ? 'Always unlocked.' : 'Have 3 scored objectives.');
      return `<li><div class="leader-heading"><b>${esc(cleanLeaderName(l.name))}</b>
        ${l.form ? chip(`${l.form} form`) : ''}<span class="meta">${esc(factionName)}</span>${setChip(l.set)}</div>
        <dl class="effect"><dt>Unlock</dt><dd>${esc(unlock)}</dd>
          <dt>When</dt><dd>${esc(info.timing || l.timing || 'See the leader component.')}</dd>
          <dt>Effect</dt><dd>${esc(info.effect || l.effect || 'See the leader component.')}</dd></dl></li>`;
    }).join('')}</ul>
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
  </section>
  <section class="panel"><h2>Thunder's Edge mechanics</h2>
    <dl>${(glossary.thundersEdge || []).map(k => `<dt>${esc(k.name)} ${chip(k.tag)}</dt>
      <dd>${esc(k.text)}</dd>`).join('')}</dl>
  </section>`;
  write('glossary/index.html', layout({ title: 'Rules reference', depth: 1, body, active: 'Rules' }));
}

function pageHome() {
  const pct = value => `${(value * 100).toFixed(1)}%`;
  const signedPct = value => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} pp`;
  const displayDate = value => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  const icon = faction => `<img class="winrate-icon" src="./icons/factions/${faction.id}.svg"
    alt="" width="40" height="40" loading="lazy">`;
  const report = (data, hidden = false) => `<section class="winrate-report" id="report-${data.key}"
      role="tabpanel" aria-labelledby="tab-${data.key}"${hidden ? ' hidden' : ''}>
    <div class="report-intro">
      <div>
        <p class="eyebrow">${esc(data.label)} report</p>
        <h2>${data.gameCount.toLocaleString()} recent games</h2>
        <p class="note">Completed ${displayDate(data.startDate)}–${displayDate(data.endDate)} ·
          ${data.averageRounds.toFixed(1)} average rounds</p>
      </div>
      <div class="baseline"><b>16.7%</b><span>Equal-chance baseline</span></div>
    </div>
    <div class="winrate-labels" aria-hidden="true">
      <span>Rank</span><span>Faction</span><span>Win rate</span><span>Record</span>
    </div>
    <ol class="winrate-list">${data.factions.map(faction => `<li>
      <span class="winrate-rank" aria-label="Rank ${faction.rank}">${String(faction.rank).padStart(2, '0')}</span>
      <a class="winrate-faction" href="factions/${faction.id}.html">
        ${icon(faction)}
        <span><b>${esc(faction.name)}</b><small>${signedPct(faction.aboveExpected)} vs baseline</small></span>
      </a>
      <div class="winrate-value">
        <b>${pct(faction.winRate)}</b>
        <span class="winrate-track" aria-hidden="true"><i style="width:${Math.min(100, faction.winRate * 300).toFixed(1)}%"></i></span>
      </div>
      <div class="winrate-record"><b>${faction.wins} / ${faction.appearances}</b>
        <small>${pct(faction.ciLow)}–${pct(faction.ciHigh)} 95% range</small></div>
    </li>`).join('')}</ol>
  </section>`;

  const generatedDate = new Date(stats.generatedAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  const te = stats.reports.te;
  const pok = stats.reports.pok;
  const body = `<section class="stats-hero">
    <p class="eyebrow">AsyncTI4 community data</p>
    <h1>Faction win rates</h1>
    <p class="lede">A current look at six-player, 10-point games. Data are from online/async play only; in-person games may have a significantly different meta.</p>
    <div class="report-tabs" role="tablist" aria-label="Choose a ruleset">
      <button id="tab-te" type="button" role="tab" aria-selected="true"
        aria-controls="report-te" data-stats-tab="te">
        <span>Thunder's Edge</span><small>Latest ${te.requestedGames.toLocaleString()} games</small>
      </button>
      <button id="tab-pok" type="button" role="tab" aria-selected="false" tabindex="-1"
        aria-controls="report-pok" data-stats-tab="pok">
        <span>Prophecy of Kings</span><small>Latest ${pok.requestedGames.toLocaleString()} games</small>
      </button>
    </div>
  </section>
  ${report(te)}
  ${report(pok, true)}
  <section class="stats-notes" aria-label="About these statistics">
    <article class="panel">
      <p class="eyebrow">Method</p><h2>What counts as a game?</h2>
      <p>Each report uses the most recently completed games with exactly six players,
        a 10-point scoreboard, one recorded winner, and the standard <i>Normal</i> mode.
        Homebrew, Franken, Alliance, Absol, Discordant Stars, and Twilight's Fall games
        are excluded. The PoK report also excludes games using Thunder's Edge factions.</p>
    </article>
    <article class="panel">
      <p class="eyebrow">Reading the table</p><h2>Rate, record, and uncertainty</h2>
      <p>Win rate is wins divided by appearances. In a six-player game, equal odds are
        16.7%. The range beneath each record is a 95% Wilson interval: wider ranges mean
        the faction has fewer appearances and more uncertainty.</p>
    </article>
    <article class="panel stats-source">
      <p class="eyebrow">Data</p><h2>Updated monthly</h2>
      <p>Last generated ${generatedDate} from the
        <a href="${esc(stats.source)}">AsyncTI4 statistics export</a>. Results describe
        observed community games; player skill, maps, drafts, and table metagames can all
        influence faction performance.</p>
    </article>
  </section>`;
  write('index.html', layout({ title: 'Faction win rates', depth: 0, body, active: 'Home' }));
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
    ${entryWithTooltip(o, o.description, 'objective')}${chip(o.category)}${setChip(o.set)}
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
      ${entryWithTooltip(a, a.description, 'agenda')}${setChip(a.set)}
      <span class="prereq">${a.outcome ? chip(a.outcome, 'outcome') : ''}</span>
    </li>`).join('')}</ul></section>`;
  }).join('')}`;
  write('agendas/index.html', layout({ title: 'Agendas', depth: 1, body, active: 'Agendas' }));
}

function pageActionCards() {
  const cats = [...new Set(actionCards.map(c => c.category))].sort();
  const total = actionCards.reduce((n, c) => n + c.copies, 0);
  const body = `<h1>Cards</h1>
  <p class="lede">${actionCards.length} unique cards, ${total} in the deck across all
  official sets. <b>Copies</b> is how many of that card the deck holds — the reason
  Sabotage keeps appearing. Categories are our own grouping. Thunder's Edge galactic
  events are optional setup modifiers and are listed separately below.</p>
  <h2>Action cards</h2>
  ${filterBar('cat', cats)}
  <section class="panel"><ul class="techlist">${actionCards.map(c => `<li data-cat="${esc(c.category)}">
    ${entryWithTooltip(c, c.description, 'action-card')}${chip(c.category)}${setChip(c.set)}
    <span class="prereq">${c.copies > 1 ? chip(`×${c.copies}`, 'vp') : ''}
      ${chip(c.timing)}</span>
  </li>`).join('')}</ul></section>
  <h2>Galactic events <span class="count">${galacticEvents.length}</span></h2>
  <section class="panel"><ul class="techlist">${galacticEvents.map(e => `<li>
    ${entryWithTooltip(e, e.description, 'galactic-event')}${setChip(e.set)}
    <span class="prereq">${e.complexity != null ? chip(`Complexity ${e.complexity}`) : ''}</span>
  </li>`).join('')}</ul></section>`;
  write('cards/index.html', layout({ title: 'Cards', depth: 1, body, active: 'Cards' }));
}

function pagePromissoryNotes() {
  const common = promissoryNotes.filter(n => !n.faction);
  const faction = promissoryNotes.filter(n => n.faction).sort((a, b) =>
    (factionById[a.faction]?.name || a.faction).localeCompare(
      factionById[b.faction]?.name || b.faction
    ) || a.name.localeCompare(b.name));
  const list = rows => `<ul class="techlist">${rows.map(n => `<li>
    ${entryWithTooltip(n, n.description, 'promissory')}
    ${n.faction
      ? chip(factionById[n.faction]?.name || titleCase(n.faction), 'fac')
      : chip('Common')}
    ${n.form ? chip(`${n.form} form`) : ''}
    ${setChip(n.set)}
    <span class="prereq">
      ${n.playArea ? chip('Play area') : ''}
      ${n.playImmediately ? chip('Immediate') : ''}
    </span>
  </li>`).join('')}</ul>`;

  const body = `<h1>Promissory notes</h1>
  <p class="lede">Promissory notes can be traded between players and resolve according
  to their printed timing. Common notes are available to every faction; faction notes
  belong to the faction shown. A
  <b>Play area</b> note can remain faceup while its effect applies, and
  <b>Immediate</b> notes are placed there as soon as they are received.</p>
  <section class="panel"><h2>Common notes <span class="count">${common.length}</span></h2>
    ${list(common)}</section>
  <section class="panel"><h2>Faction notes <span class="count">${faction.length}</span></h2>
    ${list(faction)}</section>`;
  write('promissory/index.html', layout({
    title: 'Promissory notes', depth: 1, body, active: 'Promissory',
  }));
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
        ${entryWithTooltip(e, e.description, 'explore')}${e.resolution ? chip(e.resolution) : ''}${setChip(e.set)}
        <span class="prereq">${e.copies > 1 ? chip(`×${e.copies}`, 'vp') : ''}</span>
      </li>`).join('')}</ul></section>`;
  }).join('')}
  <section class="panel"><h2>Relics <span class="count">${relics.length}</span></h2>
    <p class="note">Drawn by trading in three relic fragments.</p>
    <ul class="techlist">${relics.map(r => `<li>
      ${entryWithTooltip(r, r.description, 'relic')}${setChip(r.set)}</li>`).join('')}</ul>
  </section>`;
  write('explore/index.html', layout({ title: 'Exploration', depth: 1, body, active: 'Explore' }));
}

// -------------------------------------------------------------- symbols
// The upstream reference is CC BY 4.0 and already supplies the faction emblems and
// unit silhouettes used by its shortcode system. Copy only the small set published
// by this site; no remote requests are made by generated pages.
function copyIcons() {
  const source = '.cache/ti4-reference/overrides/.icons/ti4';
  const unitDir = 'dist/icons/units';
  const factionDir = 'dist/icons/factions';
  mkdirSync(unitDir, { recursive: true });
  mkdirSync(factionDir, { recursive: true });

  const fallbackSvg = (label, glyph) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${esc(label)}">
  <circle cx="32" cy="32" r="29" fill="#777" opacity=".18"/>
  <text x="32" y="39" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" font-weight="700" fill="#777">${esc(glyph)}</text>
</svg>`;
  const unitGlyph = { carrier: '▰', cruiser: '◆', destroyer: '✦', dreadnought: '⬢',
    fighter: '▲', flagship: '★', infantry: '♟', mech: '♜', pds: '⌁',
    spacedock: '⌂', warsun: '☀' };

  const unitFiles = [...new Set(Object.values(UNIT_TYPES).map(([, icon]) => icon))];
  for (const icon of unitFiles) {
    const src = join(source, 'unit', `${icon}.svg`);
    const dest = join(unitDir, `${icon}.svg`);
    if (existsSync(src)) cpSync(src, dest);
    else {
      const label = Object.values(UNIT_TYPES).find(([, candidate]) => candidate === icon)?.[0]
        || titleCase(icon);
      writeFileSync(dest, fallbackSvg(label, unitGlyph[icon] || '•'));
    }
  }

  for (const f of factions) {
    const guide = factionGuides[f.id] || {};
    const iconSet = guide.iconSet || f.set;
    const iconId = guide.iconId || f.id;
    const src = join(source, 'faction', iconSet, `${iconId}.svg`);
    const dest = join(factionDir, `${f.id}.svg`);
    if (existsSync(src)) {
      // The upstream Mentak SVG (and potentially future exports from the same
      // tool) uses `<$name"` for embedded image definitions, which is invalid
      // XML. Convert that exporter artifact into a normal SVG <image id>.
      const svg = readFileSync(src, 'utf8')
        .replace(/<\$([A-Za-z0-9_]+)"/g, '<image id="$1"');
      writeFileSync(dest, svg);
    }
    else {
      const initials = f.name.split(/\s+/).filter(w => !['of', 'the'].includes(w.toLowerCase()))
        .map(w => w[0]).join('').slice(0, 2).toUpperCase();
      writeFileSync(dest, fallbackSvg(f.name, initials));
    }
  }
}

// ------------------------------------------------------------------ run
if (existsSync('dist')) rmSync('dist', { recursive: true });
pageHome(); pageFactions(); factions.forEach(pageFaction);
pageUnits(); pageTechs(); pageLeaders(); pageGlossary();
pageObjectives(); pageAgendas(); pageActionCards(); pagePromissoryNotes(); pageExplore();
pagePlanets(); pageSystems();
cpSync('public', 'dist', { recursive: true });
copyIcons();
write('server/index.js', `export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};\n`);
console.log(`built ${factions.length + 13} pages`);

// ------------------------------------------------------------- planets/map
function pagePlanets() {
  const real = planets.filter(p => p.kind !== 'home');
  const factionName = p => factionById[p.homeworldOf]?.name
    || (p.homeworldOf ? titleCase(p.homeworldOf) : '—');
  const homes = planets.filter(p => p.kind === 'home').sort((a, b) =>
    factionName(a).localeCompare(factionName(b))
    || String(a.tile || '').localeCompare(String(b.tile || ''), undefined, { numeric: true })
    || a.name.localeCompare(b.name));
  const row = (p, showFaction = false) => `<tr data-cat="${esc(p.trait || 'Other')}">
    <th scope="row">${esc(p.name)}${p.legendary ? ' <span class="pok" title="Legendary">★</span>' : ''} ${setChip(p.set)}${p.form ? chip(`${p.form} form`) : ''}</th>
    ${showFaction ? `<td class="fac">${esc(factionName(p))}</td>` : ''}
    <td class="num">${p.resources}</td><td class="num">${p.influence}</td>
    <td class="num muted">${p.resources + p.influence}</td>
    <td>${p.trait ? chip(p.trait, 't-chip t-' + p.trait.toLowerCase()) : '<span class="muted">—</span>'}</td>
    <td>${p.techSpecialty ? chip(p.techSpecialty, 'c-' + p.techSpecialty.toLowerCase()) : '<span class="muted">—</span>'}</td>
    <td class="num muted">${p.tile ? esc(p.tile) : '—'}</td>
  </tr>`;
  const table = (list, showFaction = false) => `<div class="tablewrap"><table class="units">
    <thead><tr><th scope="col">Planet</th>
      ${showFaction ? '<th scope="col">Faction</th>' : ''}
      <th scope="col" class="num" title="Resources">R</th>
      <th scope="col" class="num" title="Influence">I</th>
      <th scope="col" class="num">Σ</th>
      <th scope="col">Trait</th><th scope="col">Specialty</th>
      <th scope="col" class="num">Tile</th></tr></thead>
    <tbody>${list.map(p => row(p, showFaction)).join('')}</tbody></table></div>`;

  const legendary = planets.filter(p => p.legendary);
  const body = `<h1>Planets</h1>
  <p class="lede">Every planet with its resource and influence values. <b>Σ</b> is the
  two added together, which is the quick way to compare what a system is worth.
  ★ marks a legendary planet.</p>
  ${filterBar('cat', ['Cultural', 'Hazardous', 'Industrial', 'Other'])}
  <section class="panel"><h2>Planets <span class="count">${real.length}</span></h2>
    ${table(real)}</section>
  <section class="panel"><h2>Legendary <span class="count">${legendary.length}</span></h2>
    <ul class="techlist">${legendary.map(p => `<li>
      <b>${esc(p.name)}</b>${chip(p.legendaryName)}${setChip(p.set)}
      <span class="prereq">${chip(`${p.resources}/${p.influence}`, 'vp')}</span></li>`).join('')}</ul>
  </section>
  <section class="panel"><h2>Home systems <span class="count">${homes.length}</span></h2>
    ${table(homes, true)}</section>`;
  write('planets/index.html', layout({ title: 'Planets', depth: 1, body, active: 'Planets' }));
}

function pageSystems() {
  const GROUPS = [
    ['planet', 'Planet systems', 'Ordinary systems holding one or more planets.'],
    ['anomaly', 'Anomalies', 'Asteroid fields, nebulae, gravity rifts, supernovas, entropic scars, and Fracture systems — each changes movement or combat.'],
    ['empty', 'Empty space', 'No planets. Still worth holding for the wormholes some of them carry.'],
    ['mecatol', 'Mecatol Rex', 'The centre of the galaxy and the reason everyone is fighting.'],
    ['home', 'Home systems', 'Each faction starts here.'],
  ];
  const card = s => `<li>
    <b>${esc(s.id)}</b>${setChip(s.set)}
    <span class="meta">${s.planetNames.length ? esc(s.planetNames.join(', ')) : esc(s.name || 'empty')}</span>
    <span class="prereq">
      ${s.resources || s.influence ? chip(`${s.resources}/${s.influence}`, 'vp') : ''}
      ${s.anomalies.map(a => chip(a, 'anom')).join('')}
      ${s.wormholes.map(w => chip(w + ' wormhole', 'worm')).join('')}
    </span></li>`;
  const body = `<h1>Systems</h1>
  <p class="lede">All ${systems.length} system tiles. The number is the tile number printed
  on the back, so you can match a tile in hand to what is on it. Values shown are the
  system's total resources and influence.</p>
  ${GROUPS.map(([k, title, note]) => {
    const list = systems.filter(s => s.kind === k);
    if (!list.length) return '';
    return `<section class="panel"><h2>${title} <span class="count">${list.length}</span></h2>
      <p class="note">${note}</p>
      <ul class="techlist">${list.map(card).join('')}</ul></section>`;
  }).join('')}`;
  write('systems/index.html', layout({ title: 'Systems', depth: 1, body, active: 'Systems' }));
}
