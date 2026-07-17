// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Map LOD by zoom — Total War style, with screen-pixel sizing + label collision.
 *
 * Sizes are defined in **screen pixels**, converted to world via `/ scale`.
 * Labels that would overlap are dropped by priority (selected > player > tier).
 */

export type MapLodLevel = 'strategic' | 'operational' | 'tactical' | 'local';

export const MAP_LOD_META: Record<MapLodLevel, { label: string; hint: string }> = {
  strategic: { label: '战略', hint: '州名 · 大都会' },
  operational: { label: '战役', hint: '大城 · 州名渐隐' },
  tactical: { label: '州郡', hint: '全部城点' },
  local: { label: '城池', hint: '城名 · 详情' },
};

/**
 * LOD by zoom **relative to full-screen cover scale**.
 * cover (rel≈1) = strategic; zoom in → more detail.
 * @param scale current stage scale
 * @param minScale cover scale (map fills viewport); default 0.15
 */
export function getMapLod(scale: number, minScale = 0.15): MapLodLevel {
  const rel = scale / Math.max(minScale, 0.01);
  if (rel < 1.2) return 'strategic';
  if (rel < 2.0) return 'operational';
  if (rel < 3.5) return 'tactical';
  return 'local';
}

/** Screen-pixel design tokens per LOD (what user actually sees). */
const SCREEN = {
  strategic: { r: 5, name: 12, sub: 0, province: 15, stroke: 1.5 },
  operational: { r: 5.5, name: 12, sub: 0, province: 13, stroke: 1.5 },
  tactical: { r: 6, name: 12, sub: 0, province: 11, stroke: 1.5 },
  local: { r: 7, name: 13, sub: 11, province: 0, stroke: 2 },
} as const;

function w(px: number, scale: number): number {
  return px / Math.max(scale, 0.05);
}

export interface CityLodInput {
  id: number;
  name: string;
  adminName?: string;
  x: number;
  y: number;
  tier?: number;
  isCapital?: boolean;
  isPlayer: boolean;
  isSelected: boolean;
  troops?: number;
}

export interface CityRenderPlan {
  id: number;
  showMarker: boolean;
  showName: boolean;
  showAdmin: boolean;
  showTroops: boolean;
  showMineBadge: boolean;
  /** world units */
  drawR: number;
  hitR: number;
  nameFont: number;
  adminFont: number;
  strokeW: number;
  /** label anchor offset from city center (world) */
  labelDx: number;
  labelDy: number;
  /** label stack direction: -1 above, +1 below */
  labelDir: 1 | -1;
}

function priority(c: CityLodInput): number {
  let p = (c.tier ?? 2) * 10;
  if (c.isCapital) p += 15;
  if (c.isPlayer) p += 80;
  if (c.isSelected) p += 200;
  return p;
}

function wantsMarker(lod: MapLodLevel, c: CityLodInput): boolean {
  if (c.isPlayer || c.isSelected) return true;
  const tier = c.tier ?? 2;
  if (lod === 'strategic') return tier >= 4 || !!c.isCapital;
  if (lod === 'operational') return tier >= 3 || !!c.isCapital;
  return true;
}

function wantsNameBase(lod: MapLodLevel, c: CityLodInput): boolean {
  if (c.isPlayer || c.isSelected) return true;
  const tier = c.tier ?? 2;
  if (lod === 'strategic') return tier >= 5;
  if (lod === 'operational') return tier >= 4 || !!c.isCapital;
  // tactical: only higher tier + capital to reduce clutter; local: all
  if (lod === 'tactical') return tier >= 3 || !!c.isCapital;
  return true;
}

/** Approx CJK width factor for label box. */
function textWidthWorld(text: string, fontWorld: number): number {
  return text.length * fontWorld * 0.95;
}

interface LabelBox {
  id: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  pri: number;
}

function boxesOverlap(a: LabelBox, b: LabelBox, pad: number): boolean {
  return !(
    a.right + pad < b.left ||
    a.left - pad > b.right ||
    a.bottom + pad < b.top ||
    a.top - pad > b.bottom
  );
}

/**
 * Build per-city render plans for current scale.
 * Collision: greedy keep highest-priority labels; try above then below.
 */
export function layoutCityMarkers(
  scale: number,
  cities: CityLodInput[],
  minScale = 0.15,
): CityRenderPlan[] {
  const lod = getMapLod(scale, minScale);
  const tok = SCREEN[lod];
  const s = Math.max(scale, 0.05);

  const nameFont = w(tok.name, s);
  const adminFont = tok.sub > 0 ? w(tok.sub, s) : 0;
  const baseR = w(tok.r, s);
  const strokeW = w(tok.stroke, s);
  const pad = w(3, s); // collision padding in world ≈ 3px screen

  type Cand = CityLodInput & {
    showMarker: boolean;
    wantName: boolean;
    drawR: number;
  };

  const cands: Cand[] = cities.map((c) => {
    const showMarker = wantsMarker(lod, c);
    const imp = Math.min(1, ((c.tier ?? 2) / 6) + (c.isCapital ? 0.1 : 0) + (c.isSelected ? 0.15 : 0));
    const drawR = baseR * (1 + imp * 0.25) * (c.isSelected ? 1.2 : 1);
    return {
      ...c,
      showMarker,
      wantName: showMarker && wantsNameBase(lod, c),
      drawR,
    };
  });

  // Sort by priority desc for label assignment
  const withName = cands.filter((c) => c.wantName).sort((a, b) => priority(b) - priority(a));
  const accepted: LabelBox[] = [];
  const namePlacement = new Map<number, { dx: number; dy: number; dir: 1 | -1 }>();

  const tryPlace = (c: Cand, dir: 1 | -1): LabelBox | null => {
    const lines: string[] = [c.name];
    if (lod === 'local' && c.adminName && c.adminName !== c.name) lines.push(c.adminName);
    if (lod === 'local' && c.troops != null) lines.push(`${c.troops}兵`);

    const subH = adminFont > 0 ? adminFont * 1.1 : 0;
    let stackH = nameFont;
    if (lod === 'local' && c.adminName && c.adminName !== c.name) stackH += subH;
    if (lod === 'local' && c.troops != null) stackH += subH;

    const maxW = Math.max(
      ...lines.map((t, i) => textWidthWorld(t, i === 0 ? nameFont : adminFont || nameFont)),
    );
    const gap = c.drawR + w(4, s);
    // dir -1: stack above marker; dir +1: below
    const centerY =
      dir < 0 ? c.y - gap - stackH / 2 : c.y + gap + stackH / 2;
    const box: LabelBox = {
      id: c.id,
      left: c.x - maxW / 2,
      right: c.x + maxW / 2,
      top: centerY - stackH / 2,
      bottom: centerY + stackH / 2,
      pri: priority(c),
    };
    for (const other of accepted) {
      if (boxesOverlap(box, other, pad)) return null;
    }
    // also avoid overlapping other city markers (approx)
    for (const m of cands) {
      if (!m.showMarker || m.id === c.id) continue;
      const mBox: LabelBox = {
        id: m.id,
        left: m.x - m.drawR,
        right: m.x + m.drawR,
        top: m.y - m.drawR,
        bottom: m.y + m.drawR,
        pri: 0,
      };
      if (boxesOverlap(box, mBox, pad * 0.5)) return null;
    }
    return box;
  };

  for (const c of withName) {
    // selected/player: force try harder (above, below, then slight x offsets)
    const dirs: (1 | -1)[] = [-1, 1];
    let placed: LabelBox | null = null;
    let dir: 1 | -1 = -1;
    for (const d of dirs) {
      placed = tryPlace(c, d);
      if (placed) {
        dir = d;
        break;
      }
    }
    if (!placed && (c.isSelected || c.isPlayer)) {
      // force place above even if slight overlap with low-pri — drop conflicting low-pri
      const gap = c.drawR + w(4, s);
      const stackH = nameFont * (lod === 'local' ? 2.4 : 1.15);
      const maxW = textWidthWorld(c.name, nameFont);
      const forced: LabelBox = {
        id: c.id,
        left: c.x - maxW / 2,
        right: c.x + maxW / 2,
        top: c.y - gap - stackH,
        bottom: c.y - gap,
        pri: priority(c),
      };
      // remove overlapping lower-priority labels
      for (let i = accepted.length - 1; i >= 0; i--) {
        if (boxesOverlap(forced, accepted[i], pad) && accepted[i].pri < forced.pri) {
          namePlacement.delete(accepted[i].id);
          accepted.splice(i, 1);
        }
      }
      let still = false;
      for (const other of accepted) {
        if (boxesOverlap(forced, other, pad)) {
          still = true;
          break;
        }
      }
      if (!still) {
        placed = forced;
        dir = -1;
      }
    }
    if (placed) {
      accepted.push(placed);
      const gap = c.drawR + w(4, s);
      namePlacement.set(c.id, {
        dx: 0,
        dy: dir < 0 ? -gap : gap,
        dir,
      });
    }
  }

  // Marker collision: hide lower-priority markers that sit almost on top of higher ones
  const markerKeep = new Set<number>();
  const markerList = cands
    .filter((c) => c.showMarker)
    .sort((a, b) => priority(b) - priority(a));
  const keptMarkers: { x: number; y: number; r: number }[] = [];
  for (const c of markerList) {
    const tooClose = keptMarkers.some((m) => {
      const dx = c.x - m.x;
      const dy = c.y - m.y;
      const minDist = c.drawR + m.r + w(2, s);
      return dx * dx + dy * dy < minDist * minDist;
    });
    // always keep selected/player
    if (tooClose && !c.isSelected && !c.isPlayer) continue;
    markerKeep.add(c.id);
    keptMarkers.push({ x: c.x, y: c.y, r: c.drawR });
  }

  return cands.map((c) => {
    const place = namePlacement.get(c.id);
    const showMarker = markerKeep.has(c.id);
    const showName = showMarker && !!place;
    const showAdmin =
      showName && lod === 'local' && !!c.adminName && c.adminName !== c.name;
    const showTroops = showName && lod === 'local';
    const showMineBadge = showMarker && c.isPlayer && lod !== 'strategic';

    return {
      id: c.id,
      showMarker,
      showName,
      showAdmin,
      showTroops,
      showMineBadge,
      drawR: c.drawR,
      hitR: Math.max(c.drawR * 1.8, w(14, s)),
      nameFont,
      adminFont: adminFont || nameFont * 0.85,
      strokeW: Math.min(c.drawR * 0.35, strokeW * (c.isSelected ? 1.6 : c.isPlayer ? 1.3 : 1)),
      labelDx: place?.dx ?? 0,
      labelDy: place?.dy ?? 0,
      labelDir: place?.dir ?? -1,
    };
  });
}

export interface ProvinceLodView {
  show: boolean;
  fontSize: number;
  opacity: number;
}

export function provinceLodView(scale: number, minScale = 0.15): ProvinceLodView {
  const lod = getMapLod(scale, minScale);
  const s = Math.max(scale, 0.05);
  const tok = SCREEN[lod];
  if (tok.province <= 0) return { show: false, fontSize: 12, opacity: 0 };
  const opacity =
    lod === 'strategic' ? 0.7 : lod === 'operational' ? 0.4 : 0.14;
  return {
    show: true,
    fontSize: w(tok.province, s),
    opacity,
  };
}


