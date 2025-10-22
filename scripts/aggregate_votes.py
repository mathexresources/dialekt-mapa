"""Aggregate dialect votes per district and export a JSON summary.

Running this script reads the raw ``users_votes_clean.csv`` file, groups votes by
district (okres) and normalises spelling variants of the answers. The resulting
JSON file is consumed by the interactive map on the front-end.
"""

import csv
import json
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
CSV_PATH = Path(__file__).resolve().parents[1] / "users_votes_clean.csv"
OUTPUT_PATH = DATA_DIR / "votes.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_WORDS = {"dyl": "dýl", "dýl": "dýl", "pozdeji": "později", "později": "později"}

def normalize_text(value: str) -> str:
    return unicodedata.normalize("NFC", value.strip())

def strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def main() -> None:
    counts: dict[str, Counter] = defaultdict(Counter)

    with CSV_PATH.open("r", encoding="utf-8", newline="") as csv_file:
        reader = csv.reader(csv_file)
        for raw_word, raw_district, *rest in reader:
            word = normalize_text(raw_word).lower()
            normalized_word = strip_accents(word)
            dominant_key = ALLOWED_WORDS.get(normalized_word)
            if not dominant_key:
                # Skip responses we cannot classify (e.g. typos or malformed rows)
                continue

            district = normalize_text(raw_district)
            if not district:
                continue

            counts[district][dominant_key] += 1

    result = {}
    for district, counter in sorted(counts.items()):
        total = sum(counter.values())
        if total == 0:
            continue

        dominant_word, dominant_count = counter.most_common(1)[0]
        percentages = {
            word: round((count / total) * 100, 2)
            for word, count in counter.items()
        }

        result[district] = {
            "total": total,
            "counts": dict(counter),
            "percentages": percentages,
            "dominant": dominant_word,
            "dominantShare": round((dominant_count / total) * 100, 2),
        }

    with OUTPUT_PATH.open("w", encoding="utf-8") as json_file:
        json.dump(result, json_file, ensure_ascii=False, indent=2)

    print(f"Aggregated data for {len(result)} districts written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
