// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 州内抽象节点拓扑图（非地理轮廓）：用 WorldGraph layout 表达城际道路。
 */

import { useMemo } from 'react';
import {
  buildMacroWorldGraph,
  type LocationNode,
  type RouteEdge,
  type WorldGraph,
} from '@leh/shared';
import type { City } from '@leh/shared';

interface Props {
  cities: Record<number, City>;
  province: string;
  selectedCityId: number | null;
  onSelectCity: (id: number) => void;
  /** 可选叠加子图（如南郡县节点） */
  overlay?: WorldGraph | null;
  title?: string;
}

function provinceSubgraph(
  cities: Record<number, City>,
  province: string,
): WorldGraph {
  const subset = Object.fromEntries(
    Object.values(cities)
      .filter((c) => c.province === province)
      .map((c) => [c.id, c]),
  );
  return buildMacroWorldGraph(subset);
}

export function ProvinceTopology({
  cities,
  province,
  selectedCityId,
  onSelectCity,
  overlay = null,
  title = '道路拓扑',
}: Props) {
  const graph = useMemo(() => provinceSubgraph(cities, province), [cities, province]);

  const { nodes, edges, w, h } = useMemo(() => {
    const list = [...graph.nodes.values()].filter((n) => n.worldCityId != null);
    const pad = 28;
    const w = 420;
    const h = 240;
    const positioned = list.map((n) => ({
      ...n,
      px: pad + (n.layoutX ?? 0.5) * (w - pad * 2),
      py: pad + (n.layoutY ?? 0.5) * (h - pad * 2),
    }));
    return { nodes: positioned, edges: graph.edges, w, h };
  }, [graph]);

  const overlayDraw = useMemo(() => {
    if (!overlay) return null;
    const pad = 16;
    const w = 420;
    const h = 200;
    const list = [...overlay.nodes.values()].filter(
      (n) => n.kind === 'county' || n.kind === 'commandery_capital' || n.kind === 'fort',
    );
    const positioned = list.map((n) => ({
      ...n,
      px: pad + (n.layoutX ?? 0.5) * (w - pad * 2),
      py: pad + (n.layoutY ?? 0.5) * (h - pad * 2),
    }));
    const nodeSet = new Set(positioned.map((n) => n.id));
    const edges = overlay.edges.filter((e) => nodeSet.has(e.from) && nodeSet.has(e.to));
    return { nodes: positioned, edges, w, h };
  }, [overlay]);

  if (nodes.length === 0) return null;

  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="space-y-3" data-testid="province-topology">
      <div className="rounded border border-stone-700/80 bg-stone-950/80 p-3">
        <h3 className="text-xs text-amber-600/90 tracking-wider mb-2">{title}</h3>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full h-auto"
          role="img"
          aria-label={`${province}道路拓扑`}
        >
          {edges.map((e: RouteEdge) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) return null;
            return (
              <line
                key={e.id}
                x1={a.px}
                y1={a.py}
                x2={b.px}
                y2={b.py}
                stroke="#78716c"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.7}
              />
            );
          })}
          {nodes.map((n) => {
            const selected = n.worldCityId === selectedCityId;
            return (
              <g
                key={n.id}
                transform={`translate(${n.px},${n.py})`}
                className="cursor-pointer"
                onClick={() => n.worldCityId != null && onSelectCity(n.worldCityId)}
                data-testid={`topo-city-${n.worldCityId}`}
              >
                <circle
                  r={selected ? 11 : 9}
                  fill={selected ? '#b45309' : '#292524'}
                  stroke={selected ? '#fbbf24' : '#a8a29e'}
                  strokeWidth={selected ? 2 : 1}
                />
                <text
                  y={22}
                  textAnchor="middle"
                  fill="#e7e5e4"
                  fontSize={11}
                  fontFamily="HanDynastySerif, serif"
                >
                  {n.name}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="text-[10px] text-stone-600 mt-1">抽象拓扑 · 非地理疆界 · 虚线为官道</p>
      </div>

      {overlayDraw && overlayDraw.nodes.length > 0 && (
        <div
          className="rounded border border-amber-900/40 bg-stone-950/80 p-3"
          data-testid="commandery-topology-overlay"
        >
          <h3 className="text-xs text-amber-600/90 tracking-wider mb-2">南郡县域拓扑（荆州试点）</h3>
          <svg viewBox={`0 0 ${overlayDraw.w} ${overlayDraw.h}`} className="w-full h-auto">
            {(() => {
              const map = new Map(overlayDraw.nodes.map((n) => [n.id, n]));
              return overlayDraw.edges.map((e) => {
                const a = map.get(e.from);
                const b = map.get(e.to);
                if (!a || !b) return null;
                const water = e.routeType === 'waterway' || e.routeType === 'ferry';
                return (
                  <line
                    key={e.id}
                    x1={a.px}
                    y1={a.py}
                    x2={b.px}
                    y2={b.py}
                    stroke={water ? '#487d92' : '#806a3f'}
                    strokeWidth={1.2}
                    strokeDasharray={water ? undefined : '3 2'}
                    opacity={0.75}
                  />
                );
              });
            })()}
            {overlayDraw.nodes.map((n: LocationNode & { px: number; py: number }) => (
              <g key={n.id} transform={`translate(${n.px},${n.py})`}>
                <circle
                  r={n.kind === 'commandery_capital' ? 8 : 5}
                  fill={n.kind === 'commandery_capital' ? '#7f1d1d' : '#1c1917'}
                  stroke="#a8a29e"
                  strokeWidth={1}
                />
                <text
                  y={14}
                  textAnchor="middle"
                  fill="#a8a29e"
                  fontSize={9}
                  fontFamily="HanDynastySerif, serif"
                >
                  {n.name}
                </text>
              </g>
            ))}
          </svg>
          <p className="text-[10px] text-stone-600 mt-1">蓝/实线偏水路 · 褐虚线偏陆路 · 只读示意</p>
        </div>
      )}
    </div>
  );
}
