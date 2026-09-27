// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 州内抽象节点拓扑图（非地理轮廓）：用 WorldGraph layout 表达城际道路。
 * 遵循 DESIGN.md §6.2 官道印信分级规范。
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
    const pad = 32;
    const w = 440;
    const h = 250;
    const positioned = list.map((n) => ({
      ...n,
      px: pad + (n.layoutX ?? 0.5) * (w - pad * 2),
      py: pad + (n.layoutY ?? 0.5) * (h - pad * 2),
    }));
    return { nodes: positioned, edges: graph.edges, w, h };
  }, [graph]);

  const overlayDraw = useMemo(() => {
    if (!overlay) return null;
    const pad = 20;
    const w = 440;
    const h = 210;
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
      {/* 州域官道拓扑主盘 */}
      <div className="rounded border border-amber-900/60 bg-stone-950/95 p-3.5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500/80" aria-hidden />
            <h3 className="text-xs text-amber-300 font-song font-semibold tracking-wider">{title}</h3>
          </div>
          <span className="text-[11px] text-stone-500 font-song">虚线为官道路网 · 方印为治所重镇</span>
        </div>

        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label={`${province}道路拓扑`}
        >
          {/* 水墨古道路线 */}
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
                stroke="#57534E"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.65}
              />
            );
          })}

          {/* 城池印信节点 */}
          {nodes.map((n) => {
            const city = n.worldCityId != null ? cities[n.worldCityId] : undefined;
            const selected = n.worldCityId === selectedCityId;
            const isCapital = city?.adminName && city.adminName === city.name;
            const nodeSize = selected ? 22 : isCapital ? 20 : 16;
            const half = nodeSize / 2;

            return (
              <g
                key={n.id}
                transform={`translate(${n.px},${n.py})`}
                className="cursor-pointer transition-transform hover:scale-110"
                onClick={() => n.worldCityId != null && onSelectCity(n.worldCityId)}
                data-testid={`topo-city-${n.worldCityId}`}
              >
                {/* 选中高亮光环 */}
                {selected && (
                  <rect
                    x={-half - 4}
                    y={-half - 4}
                    width={nodeSize + 8}
                    height={nodeSize + 8}
                    rx={4}
                    fill="none"
                    stroke="#D7AA62"
                    strokeWidth={1}
                    opacity={0.5}
                    strokeDasharray="3 2"
                  />
                )}

                {/* 节点主体：治所为方印，普通城为圆角小印 */}
                <rect
                  x={-half}
                  y={-half}
                  width={nodeSize}
                  height={nodeSize}
                  rx={isCapital ? 2 : 3}
                  fill={selected ? '#78350F' : isCapital ? '#292524' : '#1C1917'}
                  stroke={selected ? '#FDE68A' : isCapital ? '#D7AA62' : '#57534E'}
                  strokeWidth={selected ? 2 : isCapital ? 1.5 : 1}
                />

                {/* 内部小印记 */}
                {isCapital && (
                  <rect
                    x={-half + 3}
                    y={-half + 3}
                    width={nodeSize - 6}
                    height={nodeSize - 6}
                    rx={1}
                    fill="none"
                    stroke={selected ? '#FDE68A' : '#D7AA62'}
                    strokeWidth={0.8}
                    opacity={0.8}
                  />
                )}

                {/* 城名文字 */}
                <text
                  y={half + 13}
                  textAnchor="middle"
                  fill={selected ? '#FDE68A' : '#E8E0CE'}
                  fontSize={selected ? 12 : 11}
                  fontWeight={selected ? 'bold' : 'normal'}
                  fontFamily="HanDynastySerif, serif"
                  className="pointer-events-none drop-shadow"
                >
                  {n.name}
                </text>
              </g>
            );
          })}
        </svg>

        <p className="text-[11px] text-stone-600 mt-1 font-song text-center">
          东汉官道路网抽象拓扑 · 点击城池可选中并查阅政经详情
        </p>
      </div>

      {/* 南郡县域叠加图（荆州试点） */}
      {overlayDraw && overlayDraw.nodes.length > 0 && (
        <div
          className="rounded border border-amber-900/40 bg-stone-950/85 p-3.5 shadow-md"
          data-testid="commandery-topology-overlay"
        >
          <div className="flex items-center justify-between border-b border-stone-800 pb-1.5 mb-2">
            <h3 className="text-xs text-amber-500 font-song font-medium tracking-wider">南郡县域拓扑（荆州试点）</h3>
            <span className="text-[11px] text-stone-500">水陆交错 · 关防要隘</span>
          </div>

          <svg viewBox={`0 0 ${overlayDraw.w} ${overlayDraw.h}`} className="w-full h-auto select-none">
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
                    stroke={water ? '#38BDF8' : '#78716C'}
                    strokeWidth={water ? 1.4 : 1.2}
                    strokeDasharray={water ? undefined : '3 2'}
                    opacity={water ? 0.7 : 0.6}
                  />
                );
              });
            })()}
            {overlayDraw.nodes.map((n: LocationNode & { px: number; py: number }) => {
              const isCapital = n.kind === 'commandery_capital';
              return (
                <g key={n.id} transform={`translate(${n.px},${n.py})`}>
                  <rect
                    x={isCapital ? -6 : -4}
                    y={isCapital ? -6 : -4}
                    width={isCapital ? 12 : 8}
                    height={isCapital ? 12 : 8}
                    rx={1.5}
                    fill={isCapital ? '#7F1D1D' : '#1C1917'}
                    stroke={isCapital ? '#F87171' : '#78716C'}
                    strokeWidth={1}
                  />
                  <text
                    y={isCapital ? 16 : 13}
                    textAnchor="middle"
                    fill="#A8A29E"
                    fontSize={10}
                    fontFamily="HanDynastySerif, serif"
                  >
                    {n.name}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="text-[11px] text-stone-600 mt-1 font-song text-center">
            青实线为水运航道 · 褐虚线为陆路通衢 · 红色方印为郡治江陵
          </p>
        </div>
      )}
    </div>
  );
}
