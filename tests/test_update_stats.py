import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "scripts" / "update_stats.py"
SPEC = importlib.util.spec_from_file_location("update_stats", SCRIPT)
stats = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(stats)


def game(*, modes=None, scoreboard=10, faction="The Arborec"):
    players = [
        {
            "discordUserID": str(index),
            "factionName": faction if index == 0 else other,
        }
        for index, other in enumerate(
            (
                "The Federation of Sol",
                "The Ghosts of Creuss",
                "The Emirates of Hacan",
                "The Universities of Jol-Nar",
                "The Clan of Saar",
                "The Yin Brotherhood",
            )
        )
    ]
    return {
        "completed": True,
        "scoreboard": scoreboard,
        "endedTimestamp": 1_800_000_000,
        "modes": modes or ["Normal", "Prophecy of Kings"],
        "players": players,
        "winners": ["0"],
    }


class UpdateStatsTests(unittest.TestCase):
    def test_streams_large_array_incrementally(self):
        values = [{"id": 1}, {"id": 2, "name": "Naaz-Rokha"}]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "stats.json"
            path.write_text(json.dumps(values), encoding="utf-8")
            self.assertEqual(list(stats.stream_json_array(path, chunk_size=5)), values)

    def test_uses_explicit_ten_point_scoreboard(self):
        self.assertEqual(stats.qualifying_game(game())[0], stats.RULESET_POK)
        self.assertIsNone(stats.qualifying_game(game(scoreboard=12)))

    def test_separates_te_and_excludes_hybrid_pok_games(self):
        te_game = game(modes=["Normal", "Prophecy of Kings", "Thunder's Edge"])
        self.assertEqual(stats.qualifying_game(te_game)[0], stats.RULESET_TE)
        self.assertIsNone(stats.qualifying_game(game(faction="Last Bastion")))
        self.assertIsNone(stats.qualifying_game(game(modes=["Normal", "Base Game"])))

    def test_combines_faction_forms(self):
        self.assertEqual(stats.canonical_faction("The Obsidian")[0], "firmament")
        self.assertEqual(stats.canonical_faction("The Council Keleres - Mentak")[0], "keleres")


if __name__ == "__main__":
    unittest.main()
