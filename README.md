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

Upstream source is [scottmk/ti4-reference](https://github.com/scottmk/ti4-reference)
(CC-BY-4.0), used as a data source for the factual layer. Fan expansions
(Discordant Stars, Absol's Mod, Twilight's Fall) are filtered out — official content only.

### Parsing notes

The source stat markup has two traps, both handled in `normStats()`:

- Numbers can straddle bold markers — `**Capacity 1**2` means **12**, not 1.
- Extra combat dice are an icon (`:ti4-unit-dice-x2:`), not `(x2)`. This affects
  27 units, including every flagship that rolls two dice.

## Coverage

28 factions · 76 units · 85 technologies · 87 leaders
