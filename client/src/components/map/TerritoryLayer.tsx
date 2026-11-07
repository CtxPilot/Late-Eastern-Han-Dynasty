// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import React, { useMemo } from 'react';
import { Group, Line } from 'react-konva';
import type { City, Faction } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { deriveFactionTerritories, type FactionTerritory } from './mapTerritory';

export interface TerritoryLayerProps {
  territories?: FactionTerritory[];
  cities?: Record<number, City> | City[];
  factions?: Record<number, Faction> | Faction[];
  visibleCityIds?: Set<number> | number[];
  opacity?: number;
  padding?: number;
  visible?: boolean;
}

/**
 * S20-W3: 势力领土凸包涂色图层 (TerritoryLayer.tsx)
 *
 * 在 GeoBaseLayer 之上、官道与城池之下。
 * 每势力一条 Konva Line closed，半透明金石水墨势力色块 (opacity 0.18)。
 * 不响应鼠标事件 (listening={false})，高效批处理。
 */
export const TerritoryLayer: React.FC<TerritoryLayerProps> = ({
  territories: propsTerritories,
  cities: propsCities,
  factions: propsFactions,
  visibleCityIds,
  opacity = 0.18,
  padding = 35,
  visible = true,
}) => {
  const storeGame = useGameStore((s) => s.game);

  const activeTerritories = useMemo(() => {
    if (propsTerritories) return propsTerritories;

    const cities = propsCities ?? storeGame?.cities;
    const factions = propsFactions ?? storeGame?.factions;
    if (!cities || !factions) return [];

    return deriveFactionTerritories(cities, factions, padding, visibleCityIds);
  }, [propsTerritories, propsCities, propsFactions, storeGame, padding, visibleCityIds]);

  if (!visible || activeTerritories.length === 0) {
    return null;
  }

  return (
    <Group name="territory-layer" listening={false}>
      {activeTerritories.map((t) => (
        <Line
          key={t.factionId}
          name={`territory-faction-${t.factionId}`}
          points={t.points}
          closed={true}
          fill={t.color}
          opacity={opacity}
          stroke={t.color}
          strokeWidth={1}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </Group>
  );
};
