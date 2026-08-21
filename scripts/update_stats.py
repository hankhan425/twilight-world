#!/usr/bin/env python3
"""Build the small homepage stats payload from an AsyncTI4 statistics export."""

from __future__ import annotations

import argparse
import heapq
import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


SOURCE_URL = "https://asyncti4.com/statistics/statistics.json"
RULESET_TE = "te"
RULESET_POK = "pok"
LIMITS = {RULESET_TE: 1000, RULESET_POK: 500}
NONSTANDARD_FLAGS = (
    "homebrew",
    "frankenGame",
    "allianceMode",
    "absolMode",
    "discordantStarsMode",
)
TE_FACTION_NAMES = {
    "Last Bastion",
    "The Deepwrought Scholarate",
    "The Firmament",
    "The Obsidian",
    "The Ral Nel Consortium",
    "The Crimson Rebellion",
}

# The export uses display labels, while the reference site uses stable faction IDs.
FACTIONS = {
    "The Arborec": ("arborec", "Arborec"),
    "The Ghosts of Creuss": ("creuss", "Ghosts of Creuss"),
    "The Emirates of Hacan": ("hacan", "Emirates of Hacan"),
    "The Universities of Jol-Nar": ("jolnar", "Universities of Jol-Nar"),
    "The L1Z1X Mindnet": ("l1z1x", "L1Z1X Mindnet"),
    "The Barony of Letnev": ("letnev", "Barony of Letnev"),
    "The Mentak Coalition": ("mentak", "Mentak Coalition"),
    "The Embers of Muaat": ("muaat", "Embers of Muaat"),
    "The Naalu Collective": ("naalu", "Naalu Collective"),
    "The Nekro Virus": ("nekro", "Nekro Virus"),
    "Sardakk Norr": ("norr", "Sardakk N'orr"),
    "The Clan of Saar": ("saar", "Clan of Saar"),
    "The Federation of Sol": ("sol", "Federation of Sol"),
    "The Winnu": ("winnu", "Winnu"),
    "The Xxcha Kingdom": ("xxcha", "Xxcha Kingdom"),
    "The Yin Brotherhood": ("yin", "Yin Brotherhood"),
    "The Yssaril Tribes": ("yssaril", "Yssaril Tribes"),
    "The Argent Flight": ("argent", "Argent Flight"),
    "The Vuil'raith Cabal": ("cabal", "Vuil'raith Cabal"),
    "The Empyrean": ("empyrean", "Empyrean"),
    "The Mahact Gene-Sorcerers": ("mahact", "Mahact Gene-Sorcerers"),
    "The Naaz-Rokha Alliance": ("naaz", "Naaz-Rokha Alliance"),
    "The Nomad": ("nomad", "Nomad"),
    "The Titans of Ul": ("titans", "Titans of Ul"),
    "The Council Keleres - Argent": ("keleres", "Council Keleres"),
    "The Council Keleres - Mentak": ("keleres", "Council Keleres"),
    "The Council Keleres - Xxcha": ("keleres", "Council Keleres"),
    "Last Bastion": ("bastion", "Last Bastion"),
    "The Deepwrought Scholarate": ("deepwrought", "The Deepwrought Scholarate"),
    "The Firmament": ("firmament", "The Firmament / The Obsidian"),
    "The Obsidian": ("firmament", "The Firmament / The Obsidian"),
    "The Ral Nel Consortium": ("ralnel", "The Ral Nel Consortium"),
    "The Crimson Rebellion": ("rebellion", "The Crimson Rebellion"),
}


def stream_json_array(path: Path, chunk_size: int = 1024 * 1024) -> Iterator[dict[str, Any]]:
    decoder = json.JSONDecoder()
    with path.open("r", encoding="utf-8") as handle:
        buffer = ""
        position = 0
        started = False
        finished = False
        while not finished:
            chunk = handle.read(chunk_size)
            eof = not chunk
            buffer = buffer[position:] + chunk
            position = 0
            while True:
                while position < len(buffer) and buffer[position].isspace():
                    position += 1
                if not started:
                    if position >= len(buffer):
                        break
                    if buffer[position] != "[":
                        raise ValueError("Expected a top-level JSON array")
                    started = True
                    position += 1
                    continue
                while position < len(buffer) and (
                    buffer[position].isspace() or buffer[position] == ","
                ):
                    position += 1
                if position >= len(buffer):
                    break
                if buffer[position] == "]":
                    finished = True
                    position += 1
                    break
                try:
                    value, next_position = decoder.raw_decode(buffer, position)
                except json.JSONDecodeError:
                    if eof:
                        raise
                    break
                if not isinstance(value, dict):
                    raise ValueError("Every array item must be an object")
                position = next_position
                yield value
            if eof:
                if not finished:
                    raise ValueError("JSON array ended unexpectedly")
                return


def number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) else None


def end_timestamp(game: dict[str, Any]) -> float | None:
    value = number(game.get("endedTimestamp"))
    if value is not None and value > 0:
        return value / 1000 if value > 100_000_000_000 else value
    value = number(game.get("endedEpochMilliseconds"))
    return value / 1000 if value is not None and value > 0 else None


def normalized_id(value: Any) -> str | None:
    if value is None or isinstance(value, bool):
        return None
    result = str(value).strip()
    return result or None


def canonical_faction(raw_name: Any) -> tuple[str, str] | None:
    if not isinstance(raw_name, str):
        return None
    return FACTIONS.get(raw_name.strip())


def ruleset(game: dict[str, Any], modes: set[str]) -> str | None:
    if "Thunder's Edge" in modes:
        return RULESET_TE
    if "Prophecy of Kings" in modes or game.get("isPoK") is True:
        return RULESET_POK
    return None


def qualifying_game(game: dict[str, Any]) -> tuple[str, float] | None:
    if not game.get("completed") or number(game.get("scoreboard")) != 10:
        return None
    timestamp = end_timestamp(game)
    players = game.get("players")
    winners = game.get("winners")
    modes_value = game.get("modes")
    modes = set(modes_value) if isinstance(modes_value, list) else set()
    if (
        timestamp is None
        or not isinstance(players, list)
        or len(players) != 6
        or not isinstance(winners, list)
        or len(winners) != 1
        or "Normal" not in modes
        or any(game.get(flag) is True for flag in NONSTANDARD_FLAGS)
    ):
        return None

    raw_factions = [player.get("factionName") for player in players]
    if any(not isinstance(name, str) or not name.strip() for name in raw_factions):
        return None
    player_factions = [canonical_faction(name) for name in raw_factions]
    if any(faction is None for faction in player_factions):
        unknown = sorted(
            str(player.get("factionName"))
            for player, faction in zip(players, player_factions)
            if faction is None
        )
        raise ValueError(f"Unmapped faction name(s): {', '.join(unknown)}")
    selected_ruleset = ruleset(game, modes)
    if selected_ruleset is None:
        return None
    # A PoK-only cohort should not include hybrid games using TE factions.
    if selected_ruleset == RULESET_POK and any(
        player.get("factionName") in TE_FACTION_NAMES for player in players
    ):
        return None
    player_ids = {normalized_id(player.get("discordUserID")) for player in players}
    if normalized_id(winners[0]) not in player_ids:
        return None
    return selected_ruleset, timestamp


def latest_games(path: Path) -> dict[str, list[dict[str, Any]]]:
    heaps: dict[str, list[tuple[float, str, dict[str, Any]]]] = {
        RULESET_TE: [],
        RULESET_POK: [],
    }
    seen_ids: dict[str, set[str]] = {RULESET_TE: set(), RULESET_POK: set()}
    for row_number, game in enumerate(stream_json_array(path)):
        result = qualifying_game(game)
        if result is None:
            continue
        selected_ruleset, timestamp = result
        exported_game_id = str(game.get("asyncGameID") or "")
        if exported_game_id and exported_game_id in seen_ids[selected_ruleset]:
            continue
        if exported_game_id:
            seen_ids[selected_ruleset].add(exported_game_id)
        game_id = exported_game_id or f"row-{row_number:09d}"
        item = (timestamp, game_id, game)
        heap = heaps[selected_ruleset]
        if len(heap) < LIMITS[selected_ruleset]:
            heapq.heappush(heap, item)
        elif item[:2] > heap[0][:2]:
            heapq.heapreplace(heap, item)
    return {
        key: [item[2] for item in sorted(heap, reverse=True)]
        for key, heap in heaps.items()
    }


def wilson_interval(wins: int, games: int, z: float = 1.959963984540054) -> tuple[float, float]:
    if games == 0:
        return (0.0, 0.0)
    rate = wins / games
    denominator = 1 + z * z / games
    center = (rate + z * z / (2 * games)) / denominator
    margin = z * math.sqrt(rate * (1 - rate) / games + z * z / (4 * games * games)) / denominator
    return max(0.0, center - margin), min(1.0, center + margin)


def report(games: list[dict[str, Any]], key: str) -> dict[str, Any]:
    faction_stats: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"name": "", "appearances": 0, "wins": 0}
    )
    timestamps: list[float] = []
    rounds: list[float] = []
    for game in games:
        timestamp = end_timestamp(game)
        if timestamp is not None:
            timestamps.append(timestamp)
        round_number = number(game.get("round"))
        if round_number is not None:
            rounds.append(round_number)
        winner_id = normalized_id(game["winners"][0])
        for player in game["players"]:
            faction_id, faction_name = canonical_faction(player.get("factionName"))  # type: ignore[misc]
            stats = faction_stats[faction_id]
            stats["name"] = faction_name
            stats["appearances"] += 1
            stats["wins"] += int(normalized_id(player.get("discordUserID")) == winner_id)

    factions = []
    for faction_id, stats in faction_stats.items():
        appearances = stats["appearances"]
        wins = stats["wins"]
        low, high = wilson_interval(wins, appearances)
        rate = wins / appearances
        factions.append(
            {
                "id": faction_id,
                "name": stats["name"],
                "appearances": appearances,
                "wins": wins,
                "winRate": round(rate, 6),
                "aboveExpected": round(rate - 1 / 6, 6),
                "ciLow": round(low, 6),
                "ciHigh": round(high, 6),
            }
        )
    factions.sort(key=lambda row: (-row["winRate"], -row["appearances"], row["name"]))
    for rank, faction in enumerate(factions, start=1):
        faction["rank"] = rank

    if sum(faction["wins"] for faction in factions) != len(games):
        raise ValueError(f"Winner total does not match {key} game count")
    if sum(faction["appearances"] for faction in factions) != len(games) * 6:
        raise ValueError(f"Appearance total does not match {key} game count")

    def iso_date(timestamp: float) -> str:
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat()

    return {
        "key": key,
        "label": "Thunder's Edge" if key == RULESET_TE else "Prophecy of Kings",
        "gameCount": len(games),
        "requestedGames": LIMITS[key],
        "startDate": iso_date(min(timestamps)) if timestamps else None,
        "endDate": iso_date(max(timestamps)) if timestamps else None,
        "averageRounds": round(sum(rounds) / len(rounds), 2) if rounds else None,
        "factions": factions,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/stats.json"))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    games = latest_games(args.input)
    for key, limit in LIMITS.items():
        if len(games[key]) != limit:
            raise SystemExit(
                f"Only found {len(games[key]):,} qualifying {key} games; expected {limit:,}"
            )
    payload = {
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source": SOURCE_URL,
        "criteria": {
            "completed": True,
            "standardMode": True,
            "players": 6,
            "victoryPoints": 10,
            "singleWinner": True,
            "selection": "Most recently completed qualifying games",
        },
        "reports": {
            RULESET_TE: report(games[RULESET_TE], RULESET_TE),
            RULESET_POK: report(games[RULESET_POK], RULESET_POK),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"Wrote {len(games[RULESET_TE]):,} Thunder's Edge and "
        f"{len(games[RULESET_POK]):,} PoK games to {args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
