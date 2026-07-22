// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { ArmyStatus, FormationType, UnitType } from './enums/index.js';
import {
  CampaignArmyRuntimeSchema,
  CampaignNodeRuntimeSchema,
  GameStateCampaignSchema,
} from './game-state-campaign-schema.js';

function validCampaignArmy() {
  return {
    id: 'army-6-1',
    factionId: 2,
    name: '关羽军',
    commanderId: 6,
    subCommanderIds: [7],
    advisorId: 8,
    unitType: UnitType.HEAVY_CAVALRY,
    formation: FormationType.WEDGE,
    currentNodeId: 15,
    targetNodeId: 13,
    path: [13],
    phase: 'marching' as const,
    troops: 6000,
    maxTroops: 6000,
    food: 1500,
    maxFood: 18000,
    morale: 85,
    organization: 80,
    experience: 0,
    fatigue: 0,
    squads: [
      {
        officerId: 6,
        role: 'main' as const,
        position: 'center' as const,
        unitType: UnitType.HEAVY_CAVALRY,
        troops: 3000,
        morale: 80,
      },
      {
        officerId: 7,
        role: 'sub' as const,
        position: 'vanguard' as const,
        unitType: UnitType.HEAVY_CAVALRY,
        troops: 3000,
        morale: 75,
      },
    ],
    structures: [
      {
        type: 'ram' as const,
        builderId: 6,
        buildProgress: 0.5,
        durability: 500,
        effect: '城墙伤害',
        nodeId: 15,
      },
    ],
    fromNodeId: 15,
  };
}

function validNode() {
  return {
    id: 15,
    name: '襄阳',
    type: 'major_city' as const,
    x: 100,
    y: 200,
    ruler: 2,
    commanderyId: 15,
    adjacentNodeIds: [13],
    garrison: 2000,
    wallDurability: 5000,
    maxWallDurability: 5000,
    farm: 100,
    commerce: 100,
    population: 30000,
    morale: 70,
  };
}

function validSlice() {
  return {
    armys: [
      {
        id: 'legacy-1',
        commanderId: 1,
        subCommanders: [2],
        unitType: UnitType.LIGHT_INFANTRY,
        formation: FormationType.SQUARE,
        troopCount: 1000,
        maxTroopCount: 1200,
        morale: 70,
        food: 500,
        location: 1,
        status: ArmyStatus.IDLE,
      },
    ],
    campaignArmies: [validCampaignArmy()],
    campaignNodes: [validNode()],
    grandStrategists: [
      {
        factionId: 2,
        officerId: 8,
        appointedYear: 190,
        strategy: 'offense' as const,
        lastStrategyChange: 760,
        adviceSuccess: 0,
        insightCount: 0,
        strategyScore: 0,
      },
    ],
  };
}

describe('GameStateCampaignSchema', () => {
  it('parses legacy and campaign runtime state together', () => {
    expect(GameStateCampaignSchema.parse(validSlice())).toEqual(validSlice());
  });

  it('rejects current troops or food above capacity', () => {
    expect(() =>
      CampaignArmyRuntimeSchema.parse({ ...validCampaignArmy(), troops: 6001 }),
    ).toThrow(/当前兵力不能超过兵力上限/);
    expect(() =>
      CampaignArmyRuntimeSchema.parse({ ...validCampaignArmy(), food: 18001 }),
    ).toThrow(/当前军粮不能超过军粮上限/);
  });

  it('rejects duplicate command assignments and squad positions', () => {
    expect(() =>
      CampaignArmyRuntimeSchema.parse({ ...validCampaignArmy(), advisorId: 7 }),
    ).toThrow(/不能重复任职/);
    const army = validCampaignArmy();
    expect(() =>
      CampaignArmyRuntimeSchema.parse({
        ...army,
        squads: [army.squads[0], { ...army.squads[1], position: 'center' }],
      }),
    ).toThrow(/阵位不能重复/);
  });

  it('rejects invalid node adjacency and wall durability', () => {
    expect(() =>
      CampaignNodeRuntimeSchema.parse({ ...validNode(), adjacentNodeIds: [15] }),
    ).toThrow(/不能与自身相邻/);
    expect(() =>
      CampaignNodeRuntimeSchema.parse({ ...validNode(), wallDurability: 5001 }),
    ).toThrow(/不能超过耐久上限/);
  });

  it('rejects duplicate ids and multiple strategists for one faction', () => {
    const slice = validSlice();
    expect(() =>
      GameStateCampaignSchema.parse({
        ...slice,
        campaignArmies: [slice.campaignArmies[0], { ...slice.campaignArmies[0] }],
      }),
    ).toThrow(/战役 Army id/);
    expect(() =>
      GameStateCampaignSchema.parse({
        ...slice,
        grandStrategists: [
          slice.grandStrategists[0],
          { ...slice.grandStrategists[0], officerId: 9 },
        ],
      }),
    ).toThrow(/总军师势力/);
  });
});
