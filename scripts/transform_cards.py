#!/usr/bin/env python3
"""
Distort card SVGs so their artwork conforms to a target silhouette.

Matches the approach from the ChatGPT session that produced an exact-shape
result: projective (perspective) warp of artwork + exact target outer/inner
paths for the card frame.

Usage (batch):
  python3 scripts/transform_cards.py \\
    --target target-shape.svg \\
    --input  path/to/input-cards/ \\
    --output path/to/output/

Usage (single file):
  python3 scripts/transform_cards.py \\
    --target target-shape.svg \\
    --input  card_AH.svg \\
    --output warped_AH.svg

The target SVG should contain the warped card silhouette as <path> elements.
By default the script uses the two largest paths as outer + inner frame.
Override with --outer-index / --inner-index (0-based among <path> tags).

Requires Python 3.9+. No third-party packages.
"""

from __future__ import annotations

import argparse
import math
import re
import sys
from pathlib import Path
from typing import Iterable, List, Optional, Sequence, Tuple

Point = Tuple[float, float]
PathCmd = Tuple[str, List[float]]

PATH_TOKEN_RE = re.compile(
    r"([MmLlHhVvCcSsQqTtAaZz])|"
    r"([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)"
)
VIEWBOX_RE = re.compile(
    r'viewBox\s*=\s*"([^"]+)"', re.IGNORECASE
)
PATH_TAG_RE = re.compile(r"<path\b([^>]*)/?>", re.IGNORECASE)
ATTR_RE = re.compile(r'([:\w-]+)\s*=\s*"([^"]*)"')
STYLE_BLOCK_RE = re.compile(r"<defs>.*?</defs>", re.IGNORECASE | re.DOTALL)
SVG_OPEN_RE = re.compile(r"<svg\b[^>]*>", re.IGNORECASE)
NARGS = {
    "M": 2, "L": 2, "H": 1, "V": 1, "C": 6, "S": 4,
    "Q": 4, "T": 2, "A": 7, "Z": 0,
}


# ---------------------------------------------------------------------------
# Linear algebra (pure Python — no numpy)
# ---------------------------------------------------------------------------

def solve_linear(A: List[List[float]], b: List[float]) -> List[float]:
    """Gaussian elimination with partial pivoting. A is n×n, b length n."""
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(M[r][col]))
        if abs(M[pivot][col]) < 1e-12:
            raise ValueError("Singular matrix while solving homography")
        M[col], M[pivot] = M[pivot], M[col]
        piv = M[col][col]
        for j in range(col, n + 1):
            M[col][j] /= piv
        for r in range(n):
            if r == col:
                continue
            factor = M[r][col]
            for j in range(col, n + 1):
                M[r][j] -= factor * M[col][j]
    return [M[i][n] for i in range(n)]


def compute_homography(
    src: Sequence[Point], dst: Sequence[Point]
) -> List[List[float]]:
    """3×3 homography mapping src quad → dst quad (last entry fixed to 1)."""
    if len(src) != 4 or len(dst) != 4:
        raise ValueError("Need exactly 4 source and 4 destination corners")
    A: List[List[float]] = []
    b: List[float] = []
    for (x, y), (X, Y) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -X * x, -X * y])
        A.append([0, 0, 0, x, y, 1, -Y * x, -Y * y])
        b.extend([X, Y])
    h = solve_linear(A, b)
    return [
        [h[0], h[1], h[2]],
        [h[3], h[4], h[5]],
        [h[6], h[7], 1.0],
    ]


def transform_point(H: List[List[float]], x: float, y: float) -> Point:
    X = H[0][0] * x + H[0][1] * y + H[0][2]
    Y = H[1][0] * x + H[1][1] * y + H[1][2]
    W = H[2][0] * x + H[2][1] * y + H[2][2]
    if abs(W) < 1e-12:
        raise ValueError(f"Degenerate homography at ({x}, {y})")
    return X / W, Y / W


# ---------------------------------------------------------------------------
# SVG path parsing / transforming
# ---------------------------------------------------------------------------

def parse_path(d: str) -> List[PathCmd]:
    toks = [m.group(1) or m.group(2) for m in PATH_TOKEN_RE.finditer(d)]
    out: List[PathCmd] = []
    i = 0
    cmd: Optional[str] = None
    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]
            i += 1
            if cmd.upper() == "Z":
                out.append((cmd, []))
                cmd = None
                continue
        if cmd is None:
            raise ValueError(f"Invalid path data near: {toks[i:i+5]}")
        n = NARGS[cmd.upper()]
        if i + n > len(toks):
            break
        vals = list(map(float, toks[i : i + n]))
        i += n
        out.append((cmd, vals))
        if cmd in ("M", "m"):
            cmd = "L" if cmd == "M" else "l"
    return out


def fmt(n: float) -> str:
    s = f"{n:.5f}".rstrip("0").rstrip(".")
    return s if s not in ("", "-") else "0"


def fmt_pair(p: Point) -> str:
    return f"{fmt(p[0])},{fmt(p[1])}"


def first_subpath_d(d: str) -> str:
    """Keep only the first subpath (outer ring). Compound paths confuse corners."""
    cmds = parse_path(d)
    if not cmds:
        return d
    out: List[str] = []
    started = False
    for cmd, v in cmds:
        C = cmd.upper()
        if C == "M":
            if started:
                break
            started = True
        if C == "Z":
            out.append("Z")
            break
        if C in ("H", "V"):
            out.append(f"{cmd}{fmt(v[0])}")
        elif C == "A":
            out.append(
                f"{cmd}{fmt(v[0])},{fmt(v[1])} {fmt(v[2])} {int(v[3])} {int(v[4])} "
                f"{fmt(v[5])},{fmt(v[6])}"
            )
        else:
            pairs = [fmt_pair((v[j], v[j + 1])) for j in range(0, len(v), 2)]
            out.append(cmd + " ".join(pairs))
    return "".join(out) if out else d


def endpoint_samples(d: str) -> List[Point]:
    """Collect absolute segment endpoints (for corner detection)."""
    pts: List[Point] = []
    cx = cy = 0.0
    start: Optional[Point] = None
    for cmd, v in parse_path(d):
        C = cmd.upper()
        rel = cmd.islower()
        if C == "Z":
            if start is not None:
                cx, cy = start
            continue
        if C in ("M", "L", "T"):
            x, y = v
            if rel:
                x += cx
                y += cy
            cx, cy = x, y
            pts.append((cx, cy))
            if C == "M":
                start = (cx, cy)
        elif C == "H":
            x = v[0] + (cx if rel else 0.0)
            cx = x
            pts.append((cx, cy))
        elif C == "V":
            y = v[0] + (cy if rel else 0.0)
            cy = y
            pts.append((cx, cy))
        elif C in ("C", "S", "Q"):
            pts_abs: List[Point] = []
            for j in range(0, len(v), 2):
                x, y = v[j], v[j + 1]
                if rel:
                    x += cx
                    y += cy
                pts_abs.append((x, y))
            cx, cy = pts_abs[-1]
            pts.append((cx, cy))
        elif C == "A":
            x, y = v[5], v[6]
            if rel:
                x += cx
                y += cy
            cx, cy = x, y
            pts.append((cx, cy))
    return pts


def order_quad_tl_tr_br_bl(corners: Sequence[Point]) -> List[Point]:
    """
    Reorder 4 silhouette corners to geometric TL → TR → BR → BL.

    Right-side board spots are often drawn starting at the top-right, so path
    order alone would mirror the artwork. Sorting by position keeps cards
    upright regardless of Illustrator draw direction.
    """
    if len(corners) != 4:
        raise ValueError(f"Need 4 corners, got {len(corners)}")
    by_y = sorted(corners, key=lambda p: (p[1], p[0]))
    top = sorted(by_y[:2], key=lambda p: p[0])
    bottom = sorted(by_y[2:], key=lambda p: p[0])
    return [top[0], top[1], bottom[1], bottom[0]]


def corners_from_path(d: str) -> List[Point]:
    """
    Find TL → TR → BR → BL for a card silhouette.

    Illustrator card outlines are typically:
      M (corner) → long side → corner curve → long side → …
    so the four corners are the start point plus the ends of the three long
    straight sides. Short corner curves are skipped. Uses only the first
    subpath so compound border rings don't pollute the result.

    Corners are then sorted geometrically (TL TR BR BL) so mirrored path
    drawing order on right-side seats does not flip the card art.
    """
    ring = first_subpath_d(d)
    cmds = parse_path(ring)
    if not cmds:
        raise ValueError("Target path is empty")

    xs_all = [p[0] for p in endpoint_samples(ring)]
    ys_all = [p[1] for p in endpoint_samples(ring)]
    diag = math.hypot(max(xs_all) - min(xs_all), max(ys_all) - min(ys_all))
    min_len = max(diag * 0.15, 1e-6)

    corners: List[Point] = []
    cx = cy = 0.0
    start: Optional[Point] = None

    for cmd, v in cmds:
        C = cmd.upper()
        rel = cmd.islower()
        if C == "Z":
            break
        if C == "M":
            x, y = v
            if rel and start is not None:
                x += cx
                y += cy
            cx, cy = x, y
            start = (cx, cy)
            corners = [(cx, cy)]
            continue

        prev = (cx, cy)
        if C in ("L", "T"):
            x, y = v
            if rel:
                x += cx
                y += cy
            cx, cy = x, y
        elif C == "H":
            x = v[0] + (cx if rel else 0.0)
            cx = x
        elif C == "V":
            y = v[0] + (cy if rel else 0.0)
            cy = y
        elif C in ("C", "S", "Q"):
            pts_abs: List[Point] = []
            for j in range(0, len(v), 2):
                x, y = v[j], v[j + 1]
                if rel:
                    x += cx
                    y += cy
                pts_abs.append((x, y))
            cx, cy = pts_abs[-1]
            # Corner fillets — update position only.
            continue
        elif C == "A":
            x, y = v[5], v[6]
            if rel:
                x += cx
                y += cy
            cx, cy = x, y
        else:
            continue

        dist = math.hypot(cx - prev[0], cy - prev[1])
        if dist >= min_len:
            corners.append((cx, cy))
        if len(corners) >= 4:
            break

    if len(corners) < 4:
        # Fallback: first subpath endpoints nearest to bbox corners.
        pts = endpoint_samples(ring)
        if len(pts) < 4:
            raise ValueError("Target path does not have enough points for corners")
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        targets = [
            (min(xs), min(ys)),
            (max(xs), min(ys)),
            (max(xs), max(ys)),
            (min(xs), max(ys)),
        ]
        used = set()
        corners = []
        for tx, ty in targets:
            best_i = min(
                (i for i in range(len(pts)) if i not in used),
                key=lambda i: (pts[i][0] - tx) ** 2 + (pts[i][1] - ty) ** 2,
            )
            used.add(best_i)
            corners.append(pts[best_i])
    return order_quad_tl_tr_br_bl(corners[:4])


def transform_path(d: str, H: List[List[float]]) -> str:
    """Projective-transform every coordinate in a path; emit absolute commands."""
    out: List[str] = []
    cx = cy = 0.0
    for cmd, v in parse_path(d):
        C = cmd.upper()
        rel = cmd.islower()
        if C == "Z":
            out.append("Z")
            continue
        if C in ("M", "L", "T"):
            x, y = v
            if rel:
                x += cx
                y += cy
            X, Y = transform_point(H, x, y)
            out.append(f"{C}{fmt_pair((X, Y))}")
            cx, cy = x, y
        elif C == "H":
            x = v[0] + (cx if rel else 0.0)
            X, Y = transform_point(H, x, cy)
            out.append(f"L{fmt_pair((X, Y))}")
            cx = x
        elif C == "V":
            y = v[0] + (cy if rel else 0.0)
            X, Y = transform_point(H, cx, y)
            out.append(f"L{fmt_pair((X, Y))}")
            cy = y
        elif C in ("C", "S", "Q"):
            pts_abs: List[Point] = []
            for j in range(0, len(v), 2):
                x, y = v[j], v[j + 1]
                if rel:
                    x += cx
                    y += cy
                pts_abs.append((x, y))
            tpts = [transform_point(H, *p) for p in pts_abs]
            out.append(C + " ".join(fmt_pair(p) for p in tpts))
            cx, cy = pts_abs[-1]
        elif C == "A":
            # Projective maps do not preserve elliptical arcs → line to endpoint.
            rx, ry, rot, laf, sf, x, y = v
            if rel:
                x += cx
                y += cy
            X, Y = transform_point(H, x, y)
            out.append(f"L{fmt_pair((X, Y))}")
            cx, cy = x, y
        else:
            raise ValueError(f"Unsupported path command: {cmd}")
    return "".join(out)


# ---------------------------------------------------------------------------
# SVG helpers
# ---------------------------------------------------------------------------

def parse_attrs(attr_str: str) -> dict:
    return {m.group(1): m.group(2) for m in ATTR_RE.finditer(attr_str)}


def attrs_to_str(attrs: dict, skip: Iterable[str] = ()) -> str:
    skip_set = set(skip)
    parts = []
    for k, v in attrs.items():
        if k in skip_set:
            continue
        parts.append(f'{k}="{v}"')
    return (" " + " ".join(parts)) if parts else ""


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parse_viewbox(svg: str) -> Tuple[float, float, float, float]:
    m = VIEWBOX_RE.search(svg)
    if not m:
        raise ValueError("SVG has no viewBox")
    parts = [float(x) for x in re.split(r"[\s,]+", m.group(1).strip())]
    if len(parts) != 4:
        raise ValueError(f"Bad viewBox: {m.group(1)}")
    return parts[0], parts[1], parts[2], parts[3]


def extract_paths(svg: str) -> List[Tuple[dict, str]]:
    """Return list of (attrs, d) for every <path>."""
    result = []
    for m in PATH_TAG_RE.finditer(svg):
        attrs = parse_attrs(m.group(1))
        d = attrs.get("d")
        if d:
            result.append((attrs, d))
    return result


def path_bbox_area(d: str) -> float:
    pts = endpoint_samples(d)
    if not pts:
        return 0.0
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return (max(xs) - min(xs)) * (max(ys) - min(ys))


def pick_frame_paths(
    paths: Sequence[Tuple[dict, str]],
    outer_index: Optional[int],
    inner_index: Optional[int],
) -> Tuple[str, Optional[str]]:
    """
    Choose exact outer (and optional inner) silhouette paths from the target.
    Default: two largest paths by bbox area = outer, then inner.
    """
    if not paths:
        raise ValueError("Target SVG has no <path> elements")

    if outer_index is not None:
        outer = paths[outer_index][1]
        inner = paths[inner_index][1] if inner_index is not None else None
        return outer, inner

    ranked = sorted(
        range(len(paths)),
        key=lambda i: path_bbox_area(paths[i][1]),
        reverse=True,
    )
    outer = paths[ranked[0]][1]
    inner = paths[ranked[1]][1] if len(ranked) > 1 else None
    return outer, inner


def source_quad_from_viewbox(vb: Tuple[float, float, float, float]) -> List[Point]:
    x, y, w, h = vb
    return [
        (x, y),
        (x + w, y),
        (x + w, y + h),
        (x, y + h),
    ]


def source_quad_from_svg(svg: str, vb: Tuple[float, float, float, float]) -> List[Point]:
    """
    Prefer the card face rect (DigitalDeck cards are inset in the viewBox)
    as the source quad so artwork maps onto the silhouette correctly.
    """
    _, _, vw, vh = vb
    vb_area = max(vw * vh, 1e-9)
    best = None
    best_area = 0.0
    for m in RECT_TAG_RE.finditer(svg):
        attrs = parse_attrs(m.group(1))
        try:
            x = float(attrs.get("x", "0"))
            y = float(attrs.get("y", "0"))
            w = float(attrs["width"])
            h = float(attrs["height"])
        except (KeyError, ValueError):
            continue
        area = w * h
        if area / vb_area >= 0.5 and area > best_area:
            best_area = area
            best = (x, y, w, h)
    if best is not None:
        x, y, w, h = best
        return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    return source_quad_from_viewbox(vb)


def scale_factor_for_viewboxes(
    src_vb: Tuple[float, float, float, float],
    tgt_vb: Tuple[float, float, float, float],
) -> float:
    """Uniform-ish scale so strokes survive the viewBox shrink."""
    sw, sh = max(src_vb[2], 1e-9), max(src_vb[3], 1e-9)
    tw, th = max(tgt_vb[2], 1e-9), max(tgt_vb[3], 1e-9)
    return math.sqrt((tw / sw) * (th / sh))


STROKE_WIDTH_CSS_RE = re.compile(
    r"(stroke-width\s*:\s*)([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)(px)?",
    re.IGNORECASE,
)
STROKE_WIDTH_ATTR_RE = re.compile(
    r'(stroke-width\s*=\s*")([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)(px)?(")',
    re.IGNORECASE,
)


def scale_stroke_widths(svg: str, factor: float) -> str:
    if abs(factor - 1.0) < 1e-9:
        return svg

    def css_repl(m: re.Match) -> str:
        val = float(m.group(2)) * factor
        unit = m.group(3) or ""
        return f"{m.group(1)}{fmt(val)}{unit}"

    def attr_repl(m: re.Match) -> str:
        val = float(m.group(2)) * factor
        unit = m.group(3) or ""
        return f'{m.group(1)}{fmt(val)}{unit}{m.group(4)}'

    svg = STROKE_WIDTH_CSS_RE.sub(css_repl, svg)
    svg = STROKE_WIDTH_ATTR_RE.sub(attr_repl, svg)
    return svg


def inject_frame_styles(svg: str) -> str:
    """
    Frame paths from the target are often compound filled rings. Give them
    dedicated classes so they don't inherit huge source stroke-widths / wrong fills.
    """
    css = (
        ".card-frame-outer{fill:#231f20;stroke:none;}"
        ".card-frame-inner{fill:#fff;stroke:none;}"
    )
    style_open = re.search(r"<style\b[^>]*>", svg, re.IGNORECASE)
    if style_open:
        i = style_open.end()
        return svg[:i] + "\n      " + css + svg[i:]
    defs = STYLE_BLOCK_RE.search(svg)
    if defs:
        i = defs.start() + len("<defs>")
        # fragile if whitespace differs — insert a style block after <defs>
        return (
            svg[: defs.start()]
            + "<defs>\n    <style>\n      "
            + css
            + "\n    </style>"
            + svg[defs.start() + len(defs.group(0).split(">")[0]) + 1 :]
        )
    open_tag = SVG_OPEN_RE.search(svg)
    if not open_tag:
        return svg
    i = open_tag.end()
    return (
        svg[:i]
        + f"\n  <defs><style>{css}</style></defs>"
        + svg[i:]
    )


def rounded_rect_to_path(
    x: float, y: float, w: float, h: float, rx: float, ry: float
) -> str:
    rx = min(rx, w / 2)
    ry = min(ry, h / 2)
    # Approximate rounded rect with cubic Béziers (kappa ≈ 0.5522847498)
    k = 0.5522847498
    ox, oy = rx * k, ry * k
    return (
        f"M{fmt(x + rx)},{fmt(y)}"
        f"H{fmt(x + w - rx)}"
        f"C{fmt(x + w - rx + ox)},{fmt(y)} {fmt(x + w)},{fmt(y + ry - oy)} {fmt(x + w)},{fmt(y + ry)}"
        f"V{fmt(y + h - ry)}"
        f"C{fmt(x + w)},{fmt(y + h - ry + oy)} {fmt(x + w - rx + ox)},{fmt(y + h)} {fmt(x + w - rx)},{fmt(y + h)}"
        f"H{fmt(x + rx)}"
        f"C{fmt(x + rx - ox)},{fmt(y + h)} {fmt(x)},{fmt(y + h - ry + oy)} {fmt(x)},{fmt(y + h - ry)}"
        f"V{fmt(y + ry)}"
        f"C{fmt(x)},{fmt(y + ry - oy)} {fmt(x + rx - ox)},{fmt(y)} {fmt(x + rx)},{fmt(y)}Z"
    )


RECT_TAG_RE = re.compile(r"<rect\b([^>]*)/?>", re.IGNORECASE)
POLYGON_TAG_RE = re.compile(r"<polygon\b([^>]*)/?>", re.IGNORECASE)
POLYLINE_TAG_RE = re.compile(r"<polyline\b([^>]*)/?>", re.IGNORECASE)


def replace_rects_with_paths(svg: str) -> str:
    """Convert <rect> to <path> so they can be projectively warped."""

    def repl(m: re.Match) -> str:
        attrs = parse_attrs(m.group(1))
        try:
            x = float(attrs.get("x", "0"))
            y = float(attrs.get("y", "0"))
            w = float(attrs["width"])
            h = float(attrs["height"])
        except (KeyError, ValueError):
            return m.group(0)
        rx = float(attrs.get("rx", attrs.get("ry", "0")))
        ry = float(attrs.get("ry", attrs.get("rx", "0")))
        d = rounded_rect_to_path(x, y, w, h, rx, ry)
        new_attrs = {k: v for k, v in attrs.items() if k not in ("x", "y", "width", "height", "rx", "ry")}
        new_attrs["d"] = d
        return f"<path{attrs_to_str(new_attrs)}/>"

    return RECT_TAG_RE.sub(repl, svg)


def parse_points_attr(points: str) -> List[Point]:
    nums = [float(x) for x in re.split(r"[\s,]+", points.strip()) if x]
    if len(nums) < 2 or len(nums) % 2:
        raise ValueError(f"Bad points attribute: {points[:80]}")
    return [(nums[i], nums[i + 1]) for i in range(0, len(nums), 2)]


def transform_points_attr(points: str, H: List[List[float]]) -> str:
    pts = [transform_point(H, x, y) for x, y in parse_points_attr(points)]
    return " ".join(fmt_pair(p) for p in pts)


def transform_polygons_and_polylines(svg: str, H: List[List[float]]) -> str:
    """
    Corner letters on 7/10/K/Joker cards are <polygon>s in Illustrator exports.
    Warp their points with the same homography as paths.
    """

    def make_repl(tag: str):
        def repl(m: re.Match) -> str:
            attrs = parse_attrs(m.group(1))
            pts = attrs.get("points")
            if not pts:
                return m.group(0)
            attrs["points"] = transform_points_attr(pts, H)
            return f"<{tag}{attrs_to_str(attrs)}/>"

        return repl

    svg = POLYGON_TAG_RE.sub(make_repl("polygon"), svg)
    svg = POLYLINE_TAG_RE.sub(make_repl("polyline"), svg)
    return svg


def transform_all_paths(svg: str, H: List[List[float]]) -> str:
    def repl(m: re.Match) -> str:
        attrs = parse_attrs(m.group(1))
        d = attrs.get("d")
        if not d:
            return m.group(0)
        attrs["d"] = transform_path(d, H)
        return f"<path{attrs_to_str(attrs)}/>"

    return PATH_TAG_RE.sub(repl, svg)


def extract_style_defs(svg: str) -> str:
    m = STYLE_BLOCK_RE.search(svg)
    return m.group(0) if m else ""


def remove_spans(svg: str, spans: Sequence[Tuple[int, int]]) -> str:
    """Remove [start, end) spans from svg, processing from the end forward."""
    out = svg
    for start, end in sorted(spans, key=lambda t: t[0], reverse=True):
        out = out[:start] + out[end:]
    return out


def strip_source_frame(svg: str, max_remove: int = 2) -> str:
    """
    Remove the original card border before warping artwork.

    Prefers near-full-bleed <rect> elements (DigitalDeck card-states use stroked
    rects as the frame). If there are no such rects, falls back to the largest
    path(s).
    """
    try:
        _, _, vw, vh = parse_viewbox(svg)
        vb_area = max(vw * vh, 1e-9)
    except ValueError:
        vw = vh = vb_area = None

    rects = list(RECT_TAG_RE.finditer(svg))
    frame_rects = []
    for m in rects:
        attrs = parse_attrs(m.group(1))
        try:
            w = float(attrs["width"])
            h = float(attrs["height"])
        except (KeyError, ValueError):
            continue
        if vb_area is None or (w * h) / vb_area >= 0.5:
            frame_rects.append(m)

    if frame_rects:
        spans = [(m.start(), m.end()) for m in frame_rects]
        return remove_spans(svg, spans)

    paths = list(PATH_TAG_RE.finditer(svg))
    if not paths:
        return svg
    scored = []
    for m in paths:
        attrs = parse_attrs(m.group(1))
        d = attrs.get("d", "")
        scored.append((path_bbox_area(d), m.start(), m.end()))
    scored.sort(reverse=True)
    spans = [(s, e) for _, s, e in scored[:max_remove]]
    return remove_spans(svg, spans)


def inject_frame_styles(svg: str) -> str:
    """
    Frame paths from the target are often compound filled rings. Give them
    dedicated classes so they don't inherit huge source stroke-widths / wrong fills.
    """
    css = (
        ".card-frame-outer{fill:#231f20;stroke:none;}"
        ".card-frame-inner{fill:#fff;stroke:none;}"
    )
    style_open = re.search(r"<style\b[^>]*>", svg, re.IGNORECASE)
    if style_open:
        i = style_open.end()
        return svg[:i] + "\n      " + css + svg[i:]
    open_tag = SVG_OPEN_RE.search(svg)
    if not open_tag:
        return svg
    i = open_tag.end()
    return svg[:i] + f"\n  <defs>\n    <style>\n      {css}\n    </style>\n  </defs>" + svg[i:]


def build_frame_markup(
    outer_d: str,
    inner_d: Optional[str],
    outer_class: str = "card-frame-outer",
    inner_class: str = "card-frame-inner",
) -> str:
    # Outer first (behind), then inner face, so artwork can sit on top.
    parts = [f'<path class="{outer_class}" d="{outer_d}"/>']
    if inner_d:
        parts.append(f'<path class="{inner_class}" d="{inner_d}"/>')
    return "\n  ".join(parts)


def set_viewbox(svg: str, vb: Tuple[float, float, float, float]) -> str:
    vb_str = f'viewBox="{fmt(vb[0])} {fmt(vb[1])} {fmt(vb[2])} {fmt(vb[3])}"'

    def repl(m: re.Match) -> str:
        tag = m.group(0)
        if "viewBox" in tag:
            return VIEWBOX_RE.sub(vb_str, tag)
        return tag[:-1] + f" {vb_str}>"

    return SVG_OPEN_RE.sub(repl, svg, count=1)


def insert_after_defs_or_open(svg: str, markup: str) -> str:
    defs = STYLE_BLOCK_RE.search(svg)
    if defs:
        i = defs.end()
        return svg[:i] + "\n  " + markup + svg[i:]
    open_tag = SVG_OPEN_RE.search(svg)
    if not open_tag:
        raise ValueError("No <svg> open tag")
    i = open_tag.end()
    return svg[:i] + "\n  " + markup + svg[i:]


def rotate_point_cw(x: float, y: float, cx: float, cy: float, degrees: int) -> Point:
    """Rotate (x, y) around (cx, cy) by degrees clockwise (SVG/CSS convention)."""
    d = degrees % 360
    dx, dy = x - cx, y - cy
    if d == 0:
        return x, y
    if d == 90:
        return cx - dy, cy + dx
    if d == 180:
        return cx - dx, cy - dy
    if d == 270:
        return cx + dy, cy - dx
    rad = math.radians(d)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    # Clockwise in y-down coords
    return cx + dx * cos_a + dy * sin_a, cy - dx * sin_a + dy * cos_a


def rotate_path(d: str, cx: float, cy: float, degrees: int) -> str:
    """Rotate every coordinate in a path; emit absolute commands."""
    out: List[str] = []
    curx = cury = 0.0
    for cmd, v in parse_path(d):
        C = cmd.upper()
        rel = cmd.islower()
        if C == "Z":
            out.append("Z")
            continue
        if C in ("M", "L", "T"):
            x, y = v
            if rel:
                x += curx
                y += cury
            X, Y = rotate_point_cw(x, y, cx, cy, degrees)
            out.append(f"{C}{fmt_pair((X, Y))}")
            curx, cury = x, y
        elif C == "H":
            x = v[0] + (curx if rel else 0.0)
            X, Y = rotate_point_cw(x, cury, cx, cy, degrees)
            out.append(f"L{fmt_pair((X, Y))}")
            curx = x
        elif C == "V":
            y = v[0] + (cury if rel else 0.0)
            X, Y = rotate_point_cw(curx, y, cx, cy, degrees)
            out.append(f"L{fmt_pair((X, Y))}")
            cury = y
        elif C in ("C", "S", "Q"):
            pts_abs: List[Point] = []
            for j in range(0, len(v), 2):
                x, y = v[j], v[j + 1]
                if rel:
                    x += curx
                    y += cury
                pts_abs.append((x, y))
            tpts = [rotate_point_cw(x, y, cx, cy, degrees) for x, y in pts_abs]
            out.append(C + " ".join(fmt_pair(p) for p in tpts))
            curx, cury = pts_abs[-1]
        elif C == "A":
            x, y = v[5], v[6]
            if rel:
                x += curx
                y += cury
            X, Y = rotate_point_cw(x, y, cx, cy, degrees)
            out.append(f"L{fmt_pair((X, Y))}")
            curx, cury = x, y
        else:
            raise ValueError(f"Unsupported path command: {cmd}")
    return "".join(out)


def rotate_svg(svg: str, degrees: int) -> str:
    """
    Rotate all geometry clockwise around the viewBox center and update viewBox.
    Intended for 90 / 180 / 270 (side-seat landscape cards).
    """
    degrees = int(degrees) % 360
    if degrees == 0:
        return svg
    if degrees not in (90, 180, 270):
        raise ValueError("--rotate only supports 0, 90, 180, or 270")

    vx, vy, vw, vh = parse_viewbox(svg)
    cx, cy = vx + vw / 2.0, vy + vh / 2.0

    # Rotated AABB of the original viewBox
    vb_corners = [
        (vx, vy),
        (vx + vw, vy),
        (vx + vw, vy + vh),
        (vx, vy + vh),
    ]
    rot_vb = [rotate_point_cw(x, y, cx, cy, degrees) for x, y in vb_corners]
    xs = [p[0] for p in rot_vb]
    ys = [p[1] for p in rot_vb]
    new_vb = (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))

    def path_repl(m: re.Match) -> str:
        attrs = parse_attrs(m.group(1))
        d = attrs.get("d")
        if not d:
            return m.group(0)
        attrs["d"] = rotate_path(d, cx, cy, degrees)
        return f"<path{attrs_to_str(attrs)}/>"

    def poly_repl(tag: str):
        def repl(m: re.Match) -> str:
            attrs = parse_attrs(m.group(1))
            pts = attrs.get("points")
            if not pts:
                return m.group(0)
            nums = parse_points_attr(pts)
            rot = [rotate_point_cw(x, y, cx, cy, degrees) for x, y in nums]
            attrs["points"] = " ".join(fmt_pair(p) for p in rot)
            return f"<{tag}{attrs_to_str(attrs)}/>"

        return repl

    def rect_repl(m: re.Match) -> str:
        attrs = parse_attrs(m.group(1))
        try:
            x = float(attrs.get("x", "0"))
            y = float(attrs.get("y", "0"))
            w = float(attrs["width"])
            h = float(attrs["height"])
        except (KeyError, ValueError):
            return m.group(0)
        corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        rot = [rotate_point_cw(px, py, cx, cy, degrees) for px, py in corners]
        rxs = [p[0] for p in rot]
        rys = [p[1] for p in rot]
        attrs["x"] = fmt(min(rxs))
        attrs["y"] = fmt(min(rys))
        attrs["width"] = fmt(max(rxs) - min(rxs))
        attrs["height"] = fmt(max(rys) - min(rys))
        if degrees % 180 == 90:
            rx = attrs.get("rx")
            ry = attrs.get("ry")
            if rx is not None or ry is not None:
                attrs["rx"] = ry if ry is not None else rx
                attrs["ry"] = rx if rx is not None else ry
        return f"<rect{attrs_to_str(attrs)}/>"

    out = PATH_TAG_RE.sub(path_repl, svg)
    out = POLYGON_TAG_RE.sub(poly_repl("polygon"), out)
    out = POLYLINE_TAG_RE.sub(poly_repl("polyline"), out)
    out = RECT_TAG_RE.sub(rect_repl, out)
    out = set_viewbox(out, new_vb)
    return out


# ---------------------------------------------------------------------------
# Core transform
# ---------------------------------------------------------------------------

def transform_card_svg(
    source_svg: str,
    target_svg: str,
    *,
    outer_index: Optional[int] = None,
    inner_index: Optional[int] = None,
    replace_frame: bool = True,
    outer_class: str = "card-frame-outer",
    inner_class: str = "card-frame-inner",
    src_corners: Optional[Sequence[Point]] = None,
    dst_corners: Optional[Sequence[Point]] = None,
    keep_group: Optional[str] = None,
    rotate: int = 0,
) -> str:
    target_paths = extract_paths(target_svg)
    outer_d, inner_d = pick_frame_paths(target_paths, outer_index, inner_index)

    if keep_group:
        source_svg = keep_only_group(source_svg, keep_group)

    if rotate:
        source_svg = rotate_svg(source_svg, rotate)

    src_vb = parse_viewbox(source_svg)
    tgt_vb = parse_viewbox(target_svg)

    # Prefer the simple (usually inner) face path for corner detection — compound
    # border rings have extra points that threw off the old AABB heuristic.
    corner_path = inner_d or outer_d
    src = list(src_corners) if src_corners else source_quad_from_svg(source_svg, src_vb)
    dst = list(dst_corners) if dst_corners else corners_from_path(corner_path)
    H = compute_homography(src, dst)
    stroke_scale = scale_factor_for_viewboxes(src_vb, tgt_vb)

    working = source_svg
    if replace_frame:
        # Source cards usually have one border path/rect (even if the target
        # supplies outer+inner). Prefer stripping near-full-bleed frames;
        # path fallback removes only the single largest path.
        working = strip_source_frame(working, max_remove=1)

    # Convert remaining rects (rare) to paths, then warp every path / polygon.
    out = replace_rects_with_paths(working)
    out = transform_all_paths(out, H)
    out = transform_polygons_and_polylines(out, H)
    out = set_viewbox(out, tgt_vb)
    out = scale_stroke_widths(out, stroke_scale)

    if replace_frame:
        out = inject_frame_styles(out)
        frame = build_frame_markup(outer_d, inner_d, outer_class, inner_class)
        out = insert_after_defs_or_open(out, frame)

    return out


def infer_keep_group(path: Optional[Path]) -> Optional[str]:
    """
    DigitalDeck default_*.svg files embed both <g id="drawn-last"> and
    <g id="default">. Infer which one to keep from the filename / folder.
    """
    if path is None:
        return None
    name = path.name.lower()
    parent = path.parent.name.lower()
    if name.startswith("default_") or parent == "default":
        return "default"
    if name.startswith("drawn-last_") or parent == "drawn-last":
        return "drawn-last"
    return None


def _find_group_span(svg: str, group_id: str) -> Optional[Tuple[int, int]]:
    """Return [start, end) of <g id="{group_id}">…</g>, handling nesting."""
    open_re = re.compile(
        rf'<g\b[^>]*\bid="{re.escape(group_id)}"[^>]*>',
        re.IGNORECASE,
    )
    m = open_re.search(svg)
    if not m:
        return None
    start = m.start()
    i = m.end()
    depth = 1
    token_re = re.compile(r"</?g\b[^>]*>", re.IGNORECASE)
    for tok in token_re.finditer(svg, i):
        tag = tok.group(0)
        if tag.startswith("</"):
            depth -= 1
            if depth == 0:
                return start, tok.end()
        elif tag.endswith("/>"):
            continue
        else:
            depth += 1
    return None


KNOWN_STATE_GROUPS = ("default", "drawn-last")


def keep_only_group(svg: str, group_id: str) -> str:
    """
    Drop sibling state groups so only the requested artwork remains.
    If the group id is absent, return svg unchanged.
    """
    keep = _find_group_span(svg, group_id)
    if keep is None:
        return svg
    spans_to_remove: List[Tuple[int, int]] = []
    for other in KNOWN_STATE_GROUPS:
        if other.lower() == group_id.lower():
            continue
        span = _find_group_span(svg, other)
        if span is not None:
            spans_to_remove.append(span)
    if not spans_to_remove:
        return svg
    return remove_spans(svg, spans_to_remove)


def collect_inputs(input_path: Path) -> List[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.is_dir():
        raise FileNotFoundError(f"Input not found: {input_path}")
    files = sorted(input_path.rglob("*.svg"))
    if not files:
        raise FileNotFoundError(f"No .svg files under {input_path}")
    return files


def output_path_for(
    src: Path, input_root: Path, output: Path, input_is_file: bool
) -> Path:
    if input_is_file:
        if output.suffix.lower() == ".svg":
            return output
        return output / src.name
    rel = src.relative_to(input_root)
    return output / rel


def parse_corners_arg(s: Optional[str]) -> Optional[List[Point]]:
    if not s:
        return None
    nums = [float(x) for x in re.split(r"[\s,]+", s.strip()) if x]
    if len(nums) != 8:
        raise argparse.ArgumentTypeError(
            "corners must be 8 numbers: x1,y1 x2,y2 x3,y3 x4,y4 (TL TR BR BL)"
        )
    return [(nums[i], nums[i + 1]) for i in range(0, 8, 2)]


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser(
        description="Warp card SVGs onto a target silhouette (exact outer path)."
    )
    p.add_argument("--target", "-t", required=True, type=Path,
                   help="SVG containing the target card silhouette")
    p.add_argument("--input", "-i", required=True, type=Path,
                   help="Source card SVG file or directory")
    p.add_argument("--output", "-o", required=True, type=Path,
                   help="Output SVG file or directory")
    p.add_argument("--outer-index", type=int, default=None,
                   help="0-based index of outer path in target (default: largest)")
    p.add_argument("--inner-index", type=int, default=None,
                   help="0-based index of inner path in target (default: 2nd largest)")
    p.add_argument("--no-replace-frame", action="store_true",
                   help="Only warp paths; do not splice exact target silhouette")
    p.add_argument("--outer-class", default="card-frame-outer",
                   help="class for spliced outer path (default: card-frame-outer)")
    p.add_argument("--inner-class", default="card-frame-inner",
                   help="class for spliced inner path (default: card-frame-inner)")
    p.add_argument("--src-corners", type=parse_corners_arg, default=None,
                   help='Override source quad: "x1,y1 x2,y2 x3,y3 x4,y4" TL TR BR BL')
    p.add_argument("--dst-corners", type=parse_corners_arg, default=None,
                   help='Override destination quad: "x1,y1 x2,y2 x3,y3 x4,y4" TL TR BR BL')
    p.add_argument(
        "--keep-group",
        default=None,
        help='Keep only this <g id="..."> (default/drawn-last). '
             "Inferred from filename when omitted.",
    )
    p.add_argument(
        "--rotate",
        type=int,
        default=0,
        choices=(0, 90, 180, 270),
        help="Rotate source card clockwise before warping (SVG/CSS degrees). "
             "Use 270 for side-seat landscape silhouettes.",
    )
    p.add_argument("--dry-run", action="store_true",
                   help="List files that would be written without writing")
    args = p.parse_args(argv)

    if not args.target.is_file():
        print(f"error: target not found: {args.target}", file=sys.stderr)
        return 1

    target_svg = read_text(args.target)
    inputs = collect_inputs(args.input)
    input_is_file = args.input.is_file()
    input_root = args.input if args.input.is_dir() else args.input.parent

    if not args.dry_run:
        if input_is_file and args.output.suffix.lower() == ".svg":
            args.output.parent.mkdir(parents=True, exist_ok=True)
        else:
            args.output.mkdir(parents=True, exist_ok=True)

    ok = 0
    for src in inputs:
        dest = output_path_for(src, input_root, args.output, input_is_file)
        keep_group = args.keep_group or infer_keep_group(src)
        extras = []
        if keep_group:
            extras.append(f"keep {keep_group}")
        if args.rotate:
            extras.append(f"rotate {args.rotate}")
        print(f"{src}  →  {dest}" + (f"  [{', '.join(extras)}]" if extras else ""))
        if args.dry_run:
            continue
        try:
            result = transform_card_svg(
                read_text(src),
                target_svg,
                outer_index=args.outer_index,
                inner_index=args.inner_index,
                replace_frame=not args.no_replace_frame,
                outer_class=args.outer_class,
                inner_class=args.inner_class,
                src_corners=args.src_corners,
                dst_corners=args.dst_corners,
                keep_group=keep_group,
                rotate=args.rotate,
            )
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(result, encoding="utf-8")
            ok += 1
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)

    if not args.dry_run:
        print(f"Done. Wrote {ok}/{len(inputs)} file(s).")
    return 0 if ok == len(inputs) or args.dry_run else 1


if __name__ == "__main__":
    sys.exit(main())
