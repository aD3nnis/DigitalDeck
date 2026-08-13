#!/usr/bin/env python3
"""
Run transform_cards.py for every target-shape-*.svg under a played-card-spots tree.

Example:
  python3 scripts/batch_transform_spots.py \\
    --spots frontend/public/played-card-spots/plyr-bottom-center \\
    --input frontend/public/card-states/default
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def find_targets(spots_root: Path) -> list[Path]:
    targets = sorted(spots_root.rglob("target-shape*.svg"))
    return [t for t in targets if t.is_file()]


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Batch-warp cards onto every spot target shape in a folder tree."
    )
    p.add_argument(
        "--spots",
        required=True,
        type=Path,
        help="Root folder containing spot subfolders with target-shape-*.svg",
    )
    p.add_argument(
        "--input",
        required=True,
        type=Path,
        help="Source card SVG file or directory (e.g. card-states/default)",
    )
    p.add_argument(
        "--transform-script",
        type=Path,
        default=Path(__file__).resolve().parent / "transform_cards.py",
        help="Path to transform_cards.py",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print commands without running them",
    )
    p.add_argument(
        "--rotate",
        type=int,
        default=0,
        choices=(0, 90, 180, 270),
        help="Forwarded to transform_cards.py (clockwise degrees)",
    )
    p.add_argument(
        "extra",
        nargs=argparse.REMAINDER,
        help="Extra args forwarded to transform_cards.py (use -- …)",
    )
    args = p.parse_args(argv)

    if not args.spots.is_dir():
        print(f"error: spots root not found: {args.spots}", file=sys.stderr)
        return 1
    if not args.input.exists():
        print(f"error: input not found: {args.input}", file=sys.stderr)
        return 1
    if not args.transform_script.is_file():
        print(f"error: transform script not found: {args.transform_script}", file=sys.stderr)
        return 1

    targets = find_targets(args.spots)
    if not targets:
        print(f"error: no target-shape*.svg under {args.spots}", file=sys.stderr)
        return 1

    extra = list(args.extra)
    if extra and extra[0] == "--":
        extra = extra[1:]
    if args.rotate and "--rotate" not in extra:
        extra = ["--rotate", str(args.rotate), *extra]

    print(f"Found {len(targets)} target shape(s) under {args.spots}")
    failures = 0
    for i, target in enumerate(targets, 1):
        out_dir = target.parent
        print(f"\n=== [{i}/{len(targets)}] {target.relative_to(args.spots)} → {out_dir} ===")
        cmd = [
            sys.executable,
            str(args.transform_script),
            "--target",
            str(target),
            "--input",
            str(args.input),
            "--output",
            str(out_dir),
            *extra,
        ]
        if args.dry_run:
            print(" ", " ".join(cmd))
            continue
        result = subprocess.run(cmd)
        if result.returncode != 0:
            failures += 1
            print(f"  FAILED ({result.returncode})", file=sys.stderr)

    if args.dry_run:
        print(f"\nDry run only. Would process {len(targets)} spot(s).")
        return 0

    ok = len(targets) - failures
    print(f"\nBatch done. {ok}/{len(targets)} spot(s) succeeded.")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
