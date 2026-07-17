#!/usr/bin/env python3
"""
Render client/public/geo-basemap.png from Natural Earth 50m GeoJSON.

Natural Earth is **public domain** (no copyright restrictions for game use).
  https://www.naturalearthdata.com/about/terms-of-use/

Projection MUST match shared MAP_GEO (equirectangular):
  lon 95–130°E, lat 18–45°N → 8192×6320 (~8K, degree-aspect)

Usage:
  # GeoJSON in NE_DIR (default /tmp/ne-geo)
  python3 scripts/render-geo-basemap.py

  mkdir -p /tmp/ne-geo && cd /tmp/ne-geo
  curl -sL -o ne_50m_land.geojson \\
    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson
  curl -sL -o ne_50m_rivers.geojson \\
    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson
  curl -sL -o ne_110m_lakes.geojson \\
    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_lakes.geojson
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
NE_DIR = Path(os.environ.get("NE_DIR", "/tmp/ne-geo"))
OUT = ROOT / "client/public/geo-basemap.png"

# Keep in sync with shared/data/cities-geo-reference.ts MAP_GEO
W, H = 8192, 6320
LON_MIN, LON_MAX = 95.0, 130.0
LAT_MIN, LAT_MAX = 18.0, 45.0


def lonlat_to_xy(lon: float, lat: float) -> tuple[float, float]:
    x = (lon - LON_MIN) / (LON_MAX - LON_MIN) * W
    y = (LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * H
    return x, y


def ring_in_bbox(ring: list, margin: float = 2.0) -> bool:
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    if max(lons) < LON_MIN - margin or min(lons) > LON_MAX + margin:
        return False
    if max(lats) < LAT_MIN - margin or min(lats) > LAT_MAX + margin:
        return False
    return True


def project_ring(ring: list) -> list[tuple[float, float]]:
    return [lonlat_to_xy(lon, lat) for lon, lat in ring]


def iter_polygons(geom: dict):
    t = geom["type"]
    coords = geom["coordinates"]
    if t == "Polygon":
        yield coords
    elif t == "MultiPolygon":
        for poly in coords:
            yield poly


def iter_lines(geom: dict):
    t = geom["type"]
    coords = geom["coordinates"]
    if t == "LineString":
        yield coords
    elif t == "MultiLineString":
        for line in coords:
            yield line


def main() -> None:
    land_path = NE_DIR / "ne_50m_land.geojson"
    river_path = NE_DIR / "ne_50m_rivers.geojson"
    lake_path = NE_DIR / "ne_110m_lakes.geojson"
    for p in (land_path, river_path, lake_path):
        if not p.exists():
            raise SystemExit(f"Missing {p}; see script docstring for download URLs")

    land = json.loads(land_path.read_text())
    rivers = json.loads(river_path.read_text())
    lakes = json.loads(lake_path.read_text())

    print(f"Rendering {W}x{H} equirect basemap…")
    img = Image.new("RGB", (W, H), (18, 28, 42))
    draw = ImageDraw.Draw(img)

    # subtle horizontal banding
    for i in range(0, H, 12):
        t = i / H
        shade = int(18 + 8 * (1 - abs(t - 0.45)))
        draw.line([(0, i), (W, i)], fill=(shade, shade + 6, shade + 14))

    land_fill = (52, 72, 48)
    n_poly = 0
    for feat in land["features"]:
        geom = feat.get("geometry")
        if not geom:
            continue
        for poly in iter_polygons(geom):
            if not poly or not ring_in_bbox(poly[0]):
                continue
            exterior = project_ring(poly[0])
            if len(exterior) < 3:
                continue
            draw.polygon(exterior, fill=land_fill)
            n_poly += 1
            for hole in poly[1:]:
                if len(hole) >= 3 and ring_in_bbox(hole):
                    draw.polygon(project_ring(hole), fill=(18, 28, 42))
    print(f"  land polys: {n_poly}")

    for feat in lakes["features"]:
        geom = feat.get("geometry")
        if not geom:
            continue
        for poly in iter_polygons(geom):
            if not poly or not ring_in_bbox(poly[0]):
                continue
            exterior = project_ring(poly[0])
            if len(exterior) >= 3:
                draw.polygon(exterior, fill=(30, 55, 78))

    n_riv = 0
    for feat in rivers["features"]:
        geom = feat.get("geometry")
        if not geom:
            continue
        props = feat.get("properties") or {}
        scale = props.get("scalerank", 5)
        # thicker strokes at 8K
        width = 8 if scale <= 2 else (5 if scale <= 4 else 3)
        for line in iter_lines(geom):
            if not line or not ring_in_bbox(line):
                continue
            pts = project_ring(line)
            if len(pts) >= 2:
                draw.line(pts, fill=(70, 130, 170), width=width)
                n_riv += 1
    print(f"  river segs: {n_riv}")

    # grid every 5°
    for lon in range(int(LON_MIN), int(LON_MAX) + 1, 5):
        x, _ = lonlat_to_xy(lon, LAT_MIN)
        draw.line([(x, 0), (x, H)], fill=(40, 55, 70), width=2)
    for lat in range(int(LAT_MIN), int(LAT_MAX) + 1, 5):
        _, y = lonlat_to_xy(LON_MIN, lat)
        draw.line([(0, y), (W, y)], fill=(40, 55, 70), width=2)

    draw.rectangle([2, 2, W - 3, H - 3], outline=(90, 100, 80), width=4)

    try:
        font_sm = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40
        )
    except OSError:
        font_sm = ImageFont.load_default()

    draw.rectangle([40, H - 200, 1600, H - 40], fill=(12, 18, 26), outline=(80, 90, 70))
    draw.text(
        (60, H - 175),
        "Natural Earth 50m (public domain) · equirectangular 8K",
        fill=(180, 190, 160),
        font=font_sm,
    )
    draw.text(
        (60, H - 115),
        f"bounds {LON_MIN}–{LON_MAX}E, {LAT_MIN}–{LAT_MAX}N · {W}x{H} · same lon/lat as cities",
        fill=(140, 150, 130),
        font=font_sm,
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # compress without quality loss for line art
    img.save(OUT, "PNG", optimize=True, compress_level=6)
    mb = OUT.stat().st_size / (1024 * 1024)
    print(f"Wrote {OUT} ({mb:.1f} MiB)")


if __name__ == "__main__":
    main()
