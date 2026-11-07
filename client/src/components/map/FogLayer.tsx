// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import React, { useMemo } from 'react';
import { Group, Rect, Circle } from 'react-konva';
import type { City } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

export interface FogHole {
  id: number | string;
  x: number;
  y: number;
  radius: number;
}

export interface FogLayerProps {
  width?: number;
  height?: number;
  fogColor?: string;
  cities?: Record<number, City> | City[];
  visibleCityIds?: Set<number> | number[];
  baseRadius?: number;
  lodScale?: number;
  visible?: boolean;
  holes?: FogHole[];
}

/**
 * 纯数学计算迷雾挖洞视界坐标与半径
 */
export function calculateFogHoles(
  cities: Record<number, City> | City[],
  visibleCityIds?: Set<number> | number[],
  baseRadius = 120,
  lodScale = 1.0,
): FogHole[] {
  const cityList = Array.isArray(cities) ? cities : Object.values(cities);
  const visibleSet = visibleCityIds
    ? visibleCityIds instanceof Set
      ? visibleCityIds
      : new Set(visibleCityIds)
    : null;

  const radius = Math.max(30, Math.round(baseRadius * lodScale));

  const holes: FogHole[] = [];
  for (const c of cityList) {
    if (visibleSet && !visibleSet.has(c.id)) {
      continue;
    }
    holes.push({
      id: c.id,
      x: c.x,
      y: c.y,
      radius,
    });
  }

  return holes;
}

/**
 * S20-W3: 迷雾探查与挖洞遮罩图层 (FogLayer.tsx)
 *
 * 规格：
 * - 整图覆盖石墨水墨遮罩（Rect fill rgba(10, 10, 15, 0.55)）；
 * - 对己方与已侦查城池，以 globalCompositeOperation='destination-out' 绘制高亮开视野挖洞；
 * - 视野半径随 LOD 动态缩放；
 * - 不响应鼠标事件 (listening={false})。
 */
export const FogLayer: React.FC<FogLayerProps> = ({
  width = 2560,
  height = 1600,
  fogColor = 'rgba(10, 10, 15, 0.55)',
  cities: propsCities,
  visibleCityIds,
  baseRadius = 120,
  lodScale = 1.0,
  visible = true,
  holes: propsHoles,
}) => {
  const storeGame = useGameStore((s) => s.game);
  const storePlayerFactionId = useGameStore((s) => s.game?.playerFactionId);

  const activeHoles = useMemo(() => {
    if (propsHoles) return propsHoles;

    const cities = propsCities ?? storeGame?.cities;
    if (!cities) return [];

    let effectiveVisibleSet = visibleCityIds;
    // 若未显式传入可见列表，默认将玩家势力所属城池作为可见基线
    if (!effectiveVisibleSet && storeGame && storePlayerFactionId != null) {
      const playerCities = Object.values(storeGame.cities).filter(
        (c) => c.ruler === storePlayerFactionId,
      );
      effectiveVisibleSet = new Set(playerCities.map((c) => c.id));
    }

    return calculateFogHoles(cities, effectiveVisibleSet, baseRadius, lodScale);
  }, [
    propsHoles,
    propsCities,
    storeGame,
    storePlayerFactionId,
    visibleCityIds,
    baseRadius,
    lodScale,
  ]);

  if (!visible) {
    return null;
  }

  return (
    <Group name="fog-layer" listening={false}>
      {/* 1. 全局水墨迷雾底罩 */}
      <Rect
        name="fog-background"
        x={0}
        y={0}
        width={width}
        height={height}
        fill={fogColor}
        listening={false}
      />

      {/* 2. 探明城池视界挖洞 (destination-out 裁切) */}
      {activeHoles.map((hole) => (
        <Circle
          key={hole.id}
          name={`fog-hole-${hole.id}`}
          x={hole.x}
          y={hole.y}
          radius={hole.radius}
          fill="#ffffff"
          globalCompositeOperation="destination-out"
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  );
};
