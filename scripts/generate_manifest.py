#!/usr/bin/env python3
"""Generate a manifest of course workshops as JSON.

The script scans the course directory for workshop HTML files (e.g.,
`workshop-1-vectors.html`), extracts a title and summary, and writes
`course/course-manifest.json` that can be consumed by the static site.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


WORKSHOP_PATTERN = re.compile(r"^workshop-(\d+)-", re.IGNORECASE)
TITLE_PATTERN = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)
PARAGRAPH_PATTERN = re.compile(r"<p[^>]*>(.*?)</p>", re.IGNORECASE | re.DOTALL)
TAG_PATTERN = re.compile(r"<[^>]+>")


@dataclass
class Workshop:
    order: int
    stem: str
    path: Path
    title: str
    summary: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("course"),
        help="Directory containing workshop HTML files (default: %(default)s)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("course/course-manifest.json"),
        help="Where to write the manifest JSON (default: %(default)s)",
    )
    return parser.parse_args()


def iter_workshops(source: Path) -> Iterable[Workshop]:
    for html_path in sorted(source.glob("workshop-*.html"), key=order_key):
        html = html_path.read_text(encoding="utf-8")
        title = extract_title(html) or prettify_stem(html_path.stem)
        summary = extract_summary(html)
        yield Workshop(
            order=order_from_stem(html_path.stem),
            stem=html_path.stem,
            path=html_path,
            title=title,
            summary=summary,
        )


def order_key(path: Path) -> tuple[int, str]:
    return (order_from_stem(path.stem), path.stem)


def order_from_stem(stem: str) -> int:
    match = WORKSHOP_PATTERN.match(stem)
    if match:
        return int(match.group(1))
    digits = re.search(r"(\d+)", stem)
    return int(digits.group(1)) if digits else 10_000


def extract_title(html: str) -> str:
    match = TITLE_PATTERN.search(html)
    if not match:
        return ""
    title = TAG_PATTERN.sub("", match.group(1))
    return " ".join(title.split())


def extract_summary(html: str) -> str:
    for raw_paragraph in PARAGRAPH_PATTERN.findall(html):
        text = TAG_PATTERN.sub("", raw_paragraph)
        summary = " ".join(text.split())
        if summary:
            return summary
    return ""


def prettify_stem(stem: str) -> str:
    words = stem.replace("-", " ").split()
    return " ".join(word.capitalize() for word in words)


def write_manifest(workshops: Iterable[Workshop], output: Path) -> None:
    data = [
        {
            "id": w.stem,
            "title": w.title,
            "summary": w.summary,
            "path": w.path.as_posix(),
            "order": w.order,
        }
        for w in workshops
    ]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    workshops = list(iter_workshops(args.source))
    write_manifest(workshops, args.output)


if __name__ == "__main__":
    main()
