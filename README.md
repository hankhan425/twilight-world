# TI4 Reference

A fast, ad-free, mobile-first reference for **Twilight Imperium: Fourth Edition** —
base game, Prophecy of Kings, and the Codices.

Static HTML. No frameworks, no trackers, no external requests, no ads.
The whole units table is ~24 KB.

```bash
npm run all      # fetch source, extract facts, build to dist/
npm run serve    # preview at localhost:8080
```

## What this contains, and what it deliberately doesn't

The reference wikis are largely FFG's rulebook and card text pasted in. Re-hosting that
text would just relocate the copyright problem rather than fix it, so this project is
built the other way round:

- **Game data is factual and complete.** Costs, combat values, dice counts, move,
  capacity, tech colours and prerequisites, home-system resource/influence values,
  starting units, faction rosters. Facts like these aren't copyrightable, and they're
  the part that actually benefits from being structured, sortable, and searchable.
- **Rules prose is written for this site.** The glossary in `src/data/glossary.json`
  explains mechanics in its own words. Faction abilities are listed **by name only**.
- **No card or rulebook text is copied.** `scripts/extract.mjs` parses the upstream
  source for numbers and identifiers and discards every line of prose. Nothing in
  `data/` contains rules text.

For exact card wording, use the official Living Rules Reference. This project is
unofficial and not affiliated with or endorsed by Fantasy Flight Games.

## How it works

| Step | Script | Output |
|---|---|---|
| Fetch | `scripts/fetch-source.mjs` | `.cache/` — build input, never published, gitignored |
| Extract | `scripts/extract.mjs` | `data/*.json` — facts only |
| Build | `scripts/build.mjs` | `dist/` — static site |

Two upstream sources are used for the factual layer:

- [scottmk/ti4-reference](https://github.com/scottmk/ti4-reference) (CC-BY-4.0) —
  factions, units, technologies, leaders.
- [AsyncTI4/TI4_map_generator_bot](https://github.com/AsyncTI4/TI4_map_generator_bot) —
  objectives, agendas, action cards, exploration, relics, planets and systems.
  Sparse-checked out to the JSON data directories only.

Fan expansions (Discordant Stars, Absol's Mod, Twilight's Fall, Milty Mod, and the rest)
are filtered out by `source` — official releases only, meaning base, Prophecy of Kings,
and Codices I–IV.

### Card decks

Card effect text is never stored. For the five decks, `scripts/extract-cards.mjs` keeps
the factual metadata — point values, phases, deck copy counts, elect targets, planet
traits — and reads the effect text only to derive a **category**, which is our own
taxonomy, before discarding it. That is what makes the decks filterable: "show me the
combat action cards", "which agendas are laws", "how many copies of this are in the
deck".

### Planets and systems

Planet and system data is almost entirely factual already — resource and influence
values, traits, tech specialties, wormholes, anomalies, tile numbers — so it needs
little processing. `scripts/extract-map.mjs` drops flavour text and keeps the legendary
ability *name* only as a label.

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
| Factions | 28 |
| Units | 76 |
| Technologies | 85 |
| Leaders | 87 |
| Objectives | 80 (20 public + 20 secret per set) |
| Agendas | 63 (40 laws, 23 directives) |
| Action cards | 93 unique / 123 in deck |
| Exploration | 36 unique / 80 cards |
| Relics | 17 |
| Planets | 107 |
| Systems | 87 tiles |
