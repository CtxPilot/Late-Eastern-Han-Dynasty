// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo } from 'react';
import type { DiplomacyLink, Officer } from '@leh/shared';

/**
 * S20-W4: 纯 SVG 手写多维雷达图（RadarChart）
 *
 * 规格：
 * - 纯 SVG 手写，零外部图表库依赖，完全响应 HiDPI 视网膜渲染；
 * - 默认 5 维多边形（外交五维：友好/信任/姻亲/盟约/戒备，或武将五维：统帅/武力/智谋/政治/魅力）；
 * - 同心等比例多边形网格（25%、50%、75%、100%）+ 径向辐射轴线；
 * - 半透明金石水墨多边形填充 + 边缘高亮描边 + 各顶点圆球指示与文言标签；
 * - 内置 buildDiplomacyRadarItems 与 buildOfficerRadarItems 便捷构建器。
 */

export interface RadarChartItem {
  label: string;
  value: number; // 0 ~ 100
  color?: string;
  description?: string;
}

export interface RadarChartProps {
  items: RadarChartItem[];
  size?: number; // 宽/高（默认 180）
  fillColor?: string; // 填充色
  strokeColor?: string; // 描边色
  gridLevels?: number; // 网格阶数（默认 4）
  showValues?: boolean; // 是否在标签旁展现具体数值
  className?: string;
}

export function RadarChart({
  items,
  size = 180,
  fillColor = 'rgba(217, 119, 6, 0.22)',
  strokeColor = '#d97706',
  gridLevels = 4,
  showValues = true,
  className = '',
}: RadarChartProps) {
  const n = items.length;
  const center = size / 2;
  const radius = Math.max(10, size / 2 - 32);

  // 计算各维度角坐标 (以正上方为 0 度)
  const angles = useMemo(() => {
    if (n === 0) return [];
    return items.map((_, i) => (i * 2 * Math.PI) / n - Math.PI / 2);
  }, [n, items]);

  if (n < 3) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-stone-500 font-mono ${className}`}
        style={{ width: size, height: size }}
      >
        需至少 3 项维度数据
      </div>
    );
  }

  // 1. 同心多边形背景网格
  const gridPolygons = [];
  for (let level = 1; level <= gridLevels; level++) {
    const levelRatio = level / gridLevels;
    const levelRadius = radius * levelRatio;
    const points = angles
      .map((a) => {
        const x = center + levelRadius * Math.cos(a);
        const y = center + levelRadius * Math.sin(a);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    gridPolygons.push(points);
  }

  // 2. 真实数据多边形顶点
  const dataPoints = items.map((item, i) => {
    const a = angles[i];
    const val = Math.max(0, Math.min(100, Number.isFinite(item.value) ? item.value : 0));
    const r = (val / 100) * radius;
    const x = center + r * Math.cos(a);
    const y = center + r * Math.sin(a);
    return { x, y, val, item };
  });

  const dataPolygonPoints = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`select-none overflow-visible ${className}`}
      data-testid="radar-chart"
    >
      {/* 1. 背景同心多边形网格 */}
      <g className="radar-grid" opacity={0.6}>
        {gridPolygons.map((pts, idx) => (
          <polygon
            key={`grid-${idx}`}
            points={pts}
            fill="none"
            stroke="#44403c"
            strokeWidth={idx === gridLevels - 1 ? 1.2 : 0.8}
            strokeDasharray={idx === gridLevels - 1 ? undefined : '2 2'}
          />
        ))}
      </g>

      {/* 2. 径向辐射轴线 */}
      <g className="radar-spokes" opacity={0.4}>
        {angles.map((a, i) => {
          const x2 = center + radius * Math.cos(a);
          const y2 = center + radius * Math.sin(a);
          return (
            <line
              key={`spoke-${i}`}
              x1={center}
              y1={center}
              x2={x2}
              y2={y2}
              stroke="#57534e"
              strokeWidth={0.8}
            />
          );
        })}
      </g>

      {/* 3. 数据实体填充多边形 */}
      <polygon
        points={dataPolygonPoints}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
        className="transition-all duration-300"
      />

      {/* 4. 数据顶点指示圆点 */}
      <g className="radar-nodes">
        {dataPoints.map((p, i) => (
          <circle
            key={`node-${i}`}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={p.item.color ?? strokeColor}
            stroke="#1c1917"
            strokeWidth={1}
          />
        ))}
      </g>

      {/* 5. 维度文言标签与读数 */}
      <g className="radar-labels font-song">
        {items.map((item, i) => {
          const a = angles[i];
          const labelDist = radius + 15;
          const lx = center + labelDist * Math.cos(a);
          const ly = center + labelDist * Math.sin(a);

          const cos = Math.cos(a);
          let textAnchor: 'start' | 'middle' | 'end' = 'middle';
          if (cos < -0.2) textAnchor = 'end';
          else if (cos > 0.2) textAnchor = 'start';

          const val = Math.round(
            Math.max(0, Math.min(100, Number.isFinite(item.value) ? item.value : 0)),
          );

          return (
            <text
              key={`label-${i}`}
              x={lx}
              y={ly}
              textAnchor={textAnchor}
              dominantBaseline="central"
              className="text-[10px] fill-stone-300 select-none"
            >
              <tspan className="fill-stone-300 font-medium">{item.label}</tspan>
              {showValues && (
                <tspan dx={3} className="fill-amber-400/90 font-mono text-[9px]">
                  {val}
                </tspan>
              )}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

/**
 * 构建外交关系 5 维雷达图数据项
 */
export function buildDiplomacyRadarItems(link: DiplomacyLink | null): RadarChartItem[] {
  const rawFav = link?.favorability ?? 0;
  // 友好度 (-100 ~ +100) 线性映射为 0 ~ 100
  const favorability = Math.round(Math.max(0, Math.min(100, (rawFav + 100) / 2)));

  const rel = String(link?.relation ?? 'neutral');
  // 信任度由外交状态派生
  let trust = 50;
  if (rel === 'allied') trust = 100;
  else if (rel === 'friendly') trust = 75;
  else if (rel === 'neutral') trust = 50;
  else if (rel === 'hostile') trust = 25;
  else if (rel === 'war') trust = 5;

  const marriageBond = link?.marriageBond ? 100 : 0;
  const alliedTreaty = rel === 'allied' ? 100 : 0;

  // 戒备度 (战争 100，敌对 75，中立 40，友好 15，同盟 0)
  let alertness = 40;
  if (rel === 'war') alertness = 100;
  else if (rel === 'hostile') alertness = 75;
  else if (rel === 'neutral') alertness = 40;
  else if (rel === 'friendly') alertness = 15;
  else if (rel === 'allied') alertness = 0;

  return [
    { label: '友好', value: favorability, description: `双边友好度 (${rawFav})` },
    { label: '信任', value: trust, description: '外交互信评级' },
    { label: '姻亲', value: marriageBond, description: link?.marriageBond ? '联姻世交' : '未缔结姻亲' },
    { label: '盟约', value: alliedTreaty, description: rel === 'allied' ? '誓盟守望' : '无同盟约誓' },
    { label: '戒备', value: alertness, description: '军事戒备与敌意防御' },
  ];
}

/**
 * 构建武将五维属性雷达图数据项
 */
export function buildOfficerRadarItems(officer: Officer): RadarChartItem[] {
  const stats = officer.stats ?? {
    leadership: 50,
    war: 50,
    intelligence: 50,
    politics: 50,
    charisma: 50,
  };

  return [
    { label: '统帅', value: stats.leadership ?? 50 },
    { label: '武力', value: stats.war ?? 50 },
    { label: '智谋', value: stats.intelligence ?? 50 },
    { label: '政治', value: stats.politics ?? 50 },
    { label: '魅力', value: stats.charisma ?? 50 },
  ];
}
