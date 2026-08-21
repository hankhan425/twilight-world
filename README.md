# Twilight World

A fast, ad-free, mobile-first reference for **Twilight Imperium: Fourth Edition** —
base game, Prophecy of Kings, Thunder's Edge, and the Codices.

Static HTML. No frameworks, no trackers, no external requests, no ads.
The generated Units page is about 83 KiB uncompressed.

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

## Parsing notes

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
