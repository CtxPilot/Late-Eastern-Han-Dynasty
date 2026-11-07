// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import React, { useMemo } from 'react';
import type { CampaignArmy, City, Faction } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

export interface NodePoint {
  id: number;
  x: number;
  y: number;
  name?: string;
}

export interface MarchAnimationLayerProps {
  armies?: CampaignArmy[];
  nodePositions?: Map<number, { x: number; y: number }> | Record<number, { x: number; y: number }>;
  cities?: Record<number, City> | City[];
  factions?: Record<number, Faction> | Faction[];
  width?: number;
  height?: number;
  onArmyClick?: (armyId: string) => void;
  visible?: boolean;
}

function formatTroopCount(troops: number): string {
  if (troops >= 10000) return `${(troops / 10000).toFixed(1)}万`;
  if (troops >= 1000) return `${(troops / 1000).toFixed(1)}千`;
  return String(troops);
}

/**
 * S21-W6: 一级大地图战役层演出图层 (MarchAnimationLayer.tsx)
 *
 * 规格：
 * - 纯 SVG 矢量演出层，支持高分屏与任意缩放；
 * - 行军箭头：带羽虚线流光箭头，连接当前节点与目标节点；
 * - 军旗标记：矩形势力旗帜 + 印信官防字 + 兵力气泡，标识军团当前位置；
 * - 烽火特效：受攻城池周围脉冲烽火环与升腾烽火粒子；
 * - 点击军旗或围城指示，唤起围城决断弹窗 (SiegeAssaultDialog)。
 */
export const MarchAnimationLayer: React.FC<MarchAnimationLayerProps> = ({
  armies: propArmies,
  nodePositions: propNodePositions,
  cities: propCities,
  factions: propFactions,
  onArmyClick,
  visible = true,
}) => {
  const storeGame = useGameStore((s) => s.game);
  const storeOpenSiege = useGameStore((s) => s.openSiegeDialog);

  const game = storeGame;
  const activeArmies = propArmies ?? game?.campaignArmies ?? [];
  const cityMap = useMemo(() => {
    if (propCities) {
      return Array.isArray(propCities)
        ? Object.fromEntries(propCities.map((c) => [c.id, c]))
        : propCities;
    }
    return game?.cities ?? {};
  }, [propCities, game]);

  const factionMap = useMemo(() => {
    if (propFactions) {
      return Array.isArray(propFactions)
        ? Object.fromEntries(propFactions.map((f) => [f.id, f]))
        : propFactions;
    }
    return game?.factions ?? {};
  }, [propFactions, game]);

  // 解析节点像素坐标
  const posMap = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>();
    if (propNodePositions) {
      if (propNodePositions instanceof Map) {
        for (const [k, v] of propNodePositions.entries()) map.set(k, v);
      } else {
        for (const [k, v] of Object.entries(propNodePositions)) map.set(Number(k), v);
      }
    } else {
      // 默认尝试从 cities 中读取
      for (const [k, c] of Object.entries(cityMap)) {
        if (c.x != null && c.y != null) {
          map.set(Number(k), { x: c.x, y: c.y });
        }
      }
    }
    return map;
  }, [propNodePositions, cityMap]);

  if (!visible || activeArmies.length === 0) return null;

  // 1. 过滤行军与围城军队
  const marchingArmies = activeArmies.filter(
    (a) => (a.phase === 'marching' || a.phase === 'retreating') && a.targetNodeId != null,
  );
  const siegingArmies = activeArmies.filter((a) => a.phase === 'sieging' || a.phase === 'assaulting');

  // 2. 识别受围烽火城池
  const siegeCityIds = new Set<number>();
  for (const s of siegingArmies) {
    siegeCityIds.add(s.currentNodeId);
    if (s.targetNodeId != null) siegeCityIds.add(s.targetNodeId);
  }

  const handleFlagClick = (army: CampaignArmy) => {
    if (onArmyClick) {
      onArmyClick(army.id);
    } else if (army.phase === 'sieging' || army.phase === 'assaulting') {
      storeOpenSiege(army.id);
    }
  };

  return (
    <g className="march-animation-layer" data-testid="march-animation-layer">
      <defs>
        {/* 动态带羽箭头标记 */}
        <marker
          id="march-arrow-marker"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
        </marker>
        <marker
          id="march-arrow-marker-danger"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
        </marker>
      </defs>

      {/* 1. 烽火特效环与粒子 (被围目标城) */}
      {[...siegeCityIds].map((cityId) => {
        const pt = posMap.get(cityId);
        if (!pt) return null;
        return (
          <g key={`beacon-${cityId}`} data-testid={`beacon-fire-${cityId}`}>
            {/* 烽火外扩散警戒圈 */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={24}
              fill="none"
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              className="animate-spin opacity-80"
              style={{ animationDuration: '6s' }}
            />
            <circle
              cx={pt.x}
              cy={pt.y}
              r={18}
              fill="rgba(239, 68, 68, 0.2)"
              stroke="#f97316"
              strokeWidth={1}
              className="animate-pulse"
            />
            {/* 烽烟提示标 */}
            <g transform={`translate(${pt.x}, ${pt.y - 20})`}>
              <rect
                x={-18}
                y={-8}
                width={36}
                height={16}
                rx={3}
                fill="#450a0a"
                stroke="#dc2626"
                strokeWidth={1}
              />
              <text
                x={0}
                y={3}
                textAnchor="middle"
                fill="#fca5a5"
                fontSize={9}
                fontFamily="serif"
                className="font-bold select-none"
              >
                烽火
              </text>
            </g>
          </g>
        );
      })}

      {/* 2. 行军路线与流光带羽箭头 */}
      {marchingArmies.map((army) => {
        const p1 = posMap.get(army.currentNodeId);
        const p2 = army.targetNodeId ? posMap.get(army.targetNodeId) : null;
        if (!p1 || !p2) return null;

        const faction = factionMap[army.factionId];
        const color = faction?.color ?? '#f59e0b';

        return (
          <g key={`march-line-${army.id}`} data-testid={`march-arrow-${army.id}`}>
            {/* 底层阴影 */}
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#0c0a09"
              strokeWidth={3}
              opacity={0.6}
            />
            {/* 行军主路线 */}
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={color}
              strokeWidth={2}
              strokeDasharray="6 4"
              markerEnd="url(#march-arrow-marker)"
              className="motion-safe:animate-pulse"
              opacity={0.85}
            />
          </g>
        );
      })}

      {/* 3. 军旗占位与兵力气泡 */}
      {activeArmies.map((army) => {
        const isSiege = army.phase === 'sieging' || army.phase === 'assaulting';
        const isMarch = army.phase === 'marching' || army.phase === 'retreating';
        const p1 = posMap.get(army.currentNodeId);
        const p2 = army.targetNodeId ? posMap.get(army.targetNodeId) : null;
        if (!p1) return null;

        // 若处于行军中，位置插值取道路中点偏始发端
        let fx = p1.x;
        let fy = p1.y;
        if (isMarch && p2) {
          fx = p1.x * 0.55 + p2.x * 0.45;
          fy = p1.y * 0.55 + p2.y * 0.45;
        } else if (isSiege) {
          // 围城军位移在城池右上偏置
          fx = p1.x + 14;
          fy = p1.y - 12;
        }

        const faction = factionMap[army.factionId];
        const color = faction?.color ?? '#eab308';
        const factionChar = faction?.name?.[0] ?? '军';

        return (
          <g
            key={`flag-${army.id}`}
            transform={`translate(${Math.round(fx)}, ${Math.round(fy)})`}
            className="cursor-pointer transition-transform hover:scale-125"
            onClick={() => handleFlagClick(army)}
            data-testid={`marching-flag-${army.id}`}
          >
            {/* 旗杆 */}
            <line x1={-8} y1={-12} x2={-8} y2={6} stroke="#78716c" strokeWidth={1.5} />

            {/* 军旗旗面 */}
            <path
              d="M -8 -12 L 8 -12 L 5 -5 L 8 2 L -8 2 Z"
              fill={color}
              stroke="#1c1917"
              strokeWidth={0.8}
            />

            {/* 旗心势力字 */}
            <text
              x={-1}
              y={-3}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={8}
              fontFamily="serif"
              fontWeight="bold"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
            >
              {factionChar}
            </text>

            {/* 兵力数值微型徽章 */}
            <g transform="translate(0, 8)">
              <rect
                x={-12}
                y={-4}
                width={24}
                height={9}
                rx={2}
                fill="#1c1917"
                stroke="#44403c"
                strokeWidth={0.6}
              />
              <text
                x={0}
                y={3}
                textAnchor="middle"
                fill="#fde047"
                fontSize={7}
                fontFamily="sans-serif"
              >
                {formatTroopCount(army.troops)}
              </text>
            </g>

            {/* 围城状态小火花 */}
            {isSiege && (
              <circle
                cx={-8}
                cy={-14}
                r={2}
                fill="#ef4444"
                className="animate-ping"
              />
            )}
          </g>
        );
      })}
    </g>
  );
};
