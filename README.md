# Twilight World

A fast, ad-free, mobile-first reference for **Twilight Imperium: Fourth Edition** —
base game, Prophecy of Kings, Thunder's Edge, and the Codices.

Static HTML. No frameworks, no trackers, no external requests, no ads.
The whole units page is about 67 KB.

```bash
npm run all      # fetch source, extract facts, build to dist/
npm run serve    # preview at localhost:8080
```

## Faction win-rate homepage

The homepage compares two deliberately separate recent-game cohorts from the
[AsyncTI4 statistics export](https://asyncti4.com/statistics/statistics.json):

- Thunder's Edge: the latest 1,000 qualifying games
- Prophecy of Kings without Thunder's Edge: the latest 500 qualifying games

Both cohorts require a completed standard game with exactly six players, a 10-point
scoreboard, and one recorded winner. Homebrew, Franken, Alliance, Absol, Discordant
Stars, and Twilight's Fall are excluded. PoK also excludes hybrid games containing a
Thunder's Edge faction. Firmament/Obsidian and the three Keleres configurations are
combined into their canonical faction.

Regenerate the small checked-in homepage payload from a local export:

```bash
python3 scripts/update_stats.py /path/to/statistics.json --output data/stats.json
npm run build
```

`.github/workflows/update-stats.yml` downloads a fresh export on the first day of each
month, rebuilds and validates the site, and commits `data/stats.json` when it changes.

## What this contains

- **Game data is factual and complete.** Costs, combat values, dice counts, move,
  capacity, tech colours and prerequisites, home-system resource/influence values,
  starting units, faction rosters. Facts like these aren't copyrightable, and they're
  the part that actually benefits from being structured and sortable.
- **Guide prose is written for this site.** The glossary in `src/data/glossary.json`
  explains mechanics in its own words. `src/data/faction-guides.json` and
  `src/data/leader-guides.json` add original plain-language strategy, ability,
  promissory-note, and leader explanations.
- **Reference entries explain themselves.** Technology effects, objective conditions,
  agenda outcomes, action-card effects, exploration results, relic effects, and
  promissory-note effects are extracted alongside their structured metadata and shown
  in accessible hover/focus explanations. Flavour text and card artwork are omitted.

For exact card wording, use the official Living Rules Reference. This project is
unofficial and not affiliated with or endorsed by Fantasy Flight Games.

## How it works

| Step | Script | Output |
|---|---|---|
| Fetch | `scripts/fetch-source.mjs` | `.cache/` — build input, never published, gitignored |
| Extract | `scripts/extract.mjs` | `data/*.json` — structured reference data |
| Build | `scripts/build.mjs` | `dist/` — static site |

Two upstream sources are used for the factual layer:

- [scottmk/ti4-reference](https://github.com/scottmk/ti4-reference) (CC-BY-4.0) —
  factions, units, technologies, leaders, and the faction/unit SVG symbols used by
  the generated pages.
- [AsyncTI4/TI4_map_generator_bot](https://github.com/AsyncTI4/TI4_map_generator_bot) —
  objectives, agendas, action cards, exploration, relics, promissory notes, planets,
  systems, breakthroughs, and galactic events.
  Sparse-checked out to the JSON data directories only.

Fan expansions (Discordant Stars, Absol's Mod, Milty Mod, and the rest) and the
alternate Twilight's Fall mode are filtered out by `source` — the standard-game data
set contains the base game, Prophecy of Kings, Codices I–IV, and Thunder's Edge.

### Card decks

For the reference card groups, `scripts/extract-cards.mjs` keeps point values, phases,
deck copy counts, elect targets, planet traits, synergy colors, complexity, and the rules
text needed to explain each entry.
It also derives broad browsing categories from the rules text; those categories are
the site's own taxonomy. Flavour text is not stored.

### Planets and systems

Planet and system data is almost entirely factual already — resource and influence
values, traits, tech specialties, wormholes, anomalies, tile numbers — so it needs
little processing. `scripts/extract-map.mjs` drops flavour text and keeps the legendary
ability *name* only as a label.

The upstream app calls the Codex Keleres tiles `92new`, `93new`, and `94new` to
avoid internal collisions with expansion data. The extractor removes that implementation
suffix and publishes their printed tile numbers: 92, 93, and 94.

One trap worth recording: **a planet having no tile does not mean it isn't real.**
Mirage is placed by a frontier exploration card and Custodia Vigilia sits on top of
Mecatol Rex, so both are genuine planets with `tileId: null`. Filtering on "has a tile"
would silently delete them. The bot-internal entries are excluded by an explicit list
instead — `Illusion` and `Phantasm` are stat-identical clones of Mirage used for variant
setups, `Lost Station` is a space station, and `Locked Mallice` is Mallice face-down.

### Parsing notes

The source stat markup has two traps, both handled in `normStats()`:

- Numbers can straddle bold markers — `**Capacity 1**2` means **12**, not 1.
- Extra combat dice are an icon (`:ti4-unit-dice-x2:`), not `(x2)`. This affects
  27 units, including every flagship that rolls two dice.

## Coverage

| | |
|---|---|
| Factions | 33 entries (30 standard factions + 3 scenario factions) |
| Units | 117 displayed profiles (91 base/unique + 26 upgrades) |
| Technologies | 97, all with effect or upgraded-unit details |
| Leaders | 101 |
| Objectives | 80 (20 public + 20 secret per set) |
| Agendas | 63 (40 laws, 23 directives) |
| Action cards | 107 unique / 143 in deck |
| Exploration | 36 unique / 80 cards |
| Relics | 24 |
| Promissory notes | 37 (5 common + 32 faction/form-specific) |
| Breakthroughs | 31 (including both Firmament forms) |
| Galactic events | 20 |
| Planets | 150 |
| Systems | 123 tiles |
