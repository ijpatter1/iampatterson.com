#!/usr/bin/env python3
"""Claudish CCLD — Wikipedia negatives pinned to pre-ChatGPT revisions.

Fetches each article's revision AS OF 2022-11-30 via the MediaWiki API
(rvstart + rvlimit=1 walks backward from the cutoff), strips markup
crudely, and emits plain paragraphs. Formal human prose with real em
dashes — the sharpest negative class for a detector that must not call
careful human writers robots.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request

CUTOFF = "2022-11-30T00:00:00Z"
TITLES = [
    "History of timekeeping devices", "Rosetta Stone", "Photosynthesis", "General relativity",
    "Industrial Revolution", "Printing press", "Silk Road", "Great Barrier Reef",
    "Panama Canal", "Nikola Tesla", "Marie Curie", "Ada Lovelace", "Alan Turing",
    "Antibiotic", "Plate tectonics", "Renaissance", "Ottoman Empire", "Byzantine Empire",
    "French Revolution", "Meiji era", "Transistor", "Radio", "Telegraphy",
    "Steam engine", "Aluminium", "Photography", "Impressionism", "Jazz",
    "Cartography", "Astronomy", "Microscope", "Vaccine", "Genetics",
    "Electric light", "Papermaking", "Windmill", "Aqueduct (water supply)", "Concrete",
    "Glass", "Ceramic", "Fermentation", "Cheese", "Bread", "Tea", "Coffee",
    "Whale", "Octopus", "Honey bee", "Coral", "Fungus",
]

def fetch(title: str) -> str:
    params = urllib.parse.urlencode({
        "action": "query", "prop": "revisions", "titles": title,
        "rvprop": "content", "rvslots": "main", "rvlimit": 1,
        "rvstart": CUTOFF, "rvdir": "older", "format": "json", "formatversion": 2,
    })
    req = urllib.request.Request(
        f"https://en.wikipedia.org/w/api.php?{params}",
        headers={"User-Agent": "claudish-ccld-corpus/1.0 (one-time research fetch)"},
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.load(response)
    pages = data.get("query", {}).get("pages", [])
    if not pages or "revisions" not in pages[0]:
        return ""
    return pages[0]["revisions"][0]["slots"]["main"]["content"]

def strip_markup(wikitext: str) -> str:
    text = wikitext
    text = re.sub(r"\{\{[^{}]*\}\}", " ", text)
    text = re.sub(r"\{\{[^{}]*\}\}", " ", text)  # second pass for nesting
    text = re.sub(r"\{\|[\s\S]*?\|\}", " ", text)  # tables
    text = re.sub(r"<ref[^>]*/>", " ", text)
    text = re.sub(r"<ref[\s\S]*?</ref>", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", text)  # links -> label
    text = re.sub(r"\[https?://\S+ ([^\]]*)\]", r"\1", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"^[=\*#;:].*$", " ", text, flags=re.M)  # headings/lists
    text = re.sub(r"'{2,}", "", text)  # bold/italic quotes
    text = re.sub(r"&[a-z]+;", " ", text)
    paragraphs = [p.strip() for p in text.split("\n") if len(p.strip()) > 120]
    return "\n\n".join(paragraphs)

def main() -> None:
    out_path = sys.argv[1]
    total = 0
    with open(out_path, "w", encoding="utf-8") as out:
        for title in TITLES:
            try:
                raw = fetch(title)
            except Exception as err:  # noqa: BLE001 - a flaky title is skippable
                print(f"  skip {title}: {err}", file=sys.stderr)
                continue
            cleaned = strip_markup(raw)
            if cleaned:
                out.write(cleaned + "\n\n")
                total += len(cleaned)
            time.sleep(0.3)  # be polite
    print(f"wikipedia-2022 -> {total} chars")

if __name__ == "__main__":
    main()
