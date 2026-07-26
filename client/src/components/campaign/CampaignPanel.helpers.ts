// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  DipRelation,
  areCitiesRoadAdjacent,
  findDiplomacy,
  type CampaignArmy,
  type City,
  type GameState,
} from '@leh/shared';

/** 出征候选只取当前出发城的官道直邻节点；旧存档无节点表时回退至道路真源。 */
export function campaignTargetsFromCity(game: GameState, fromCityId: number | null): City[] {
  if (fromCityId == null) return [];
  const node = game.campaignNodes?.find((item) => item.id === fromCityId);
  const adjacentIds = node
    ? new Set(node.adjacentNodeIds)
    : new Set(
        Object.values(game.cities)
          .filter((city) => areCitiesRoadAdjacent(fromCityId, city.id))
          .map((city) => city.id),
      );

  return Object.values(game.cities)
    .filter((city) => adjacentIds.has(city.id) && city.ruler !== game.playerFactionId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
}

export function campaignArmyPhaseLabel(
  game: GameState,
  army: CampaignArmy,
  phaseLabels: Readonly<Record<string, string>> = {},
): string {
  if (army.phase !== 'garrison') return phaseLabels[army.phase] ?? army.phase;
  const nodeRuler = game.cities[army.currentNodeId]?.ruler;
  if (nodeRuler === army.factionId) return '驻守（己方城池）';
  if (nodeRuler == null) return '暂驻（非己方城池）';
  const relation = findDiplomacy(game.diplomacy, army.factionId, nodeRuler)?.relation;
  if (relation === DipRelation.FRIENDLY || relation === DipRelation.ALLIED) {
    return '暂驻（友方城池）';
  }
  return '暂驻（中立城池）';
}
