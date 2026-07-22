// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { SpyMissionType, SpyStatus } from './enums/index.js';
import { GameStateIntelSchema } from './game-state-intel-schema.js';
import { pruneExpiredIntel } from './intel.js';
import type { GameState } from './types/game.js';

function validIntel() {
  return {
    intel: {
      cities: {
        8: { depth: 'detailed' as const, expireYear: 191, expireMonth: 4, source: 'recon' as const },
      },
      agents: {
        'spy-1-1': {
          id: 'spy-1-1',
          factionId: 1,
          name: '墨鸦·17',
          rank: 2 as const,
          exp: 40,
          skills: { recon: 55, sabotage: 44, lethal: 42, tradecraft: 60 },
          status: SpyStatus.COUNTER_DUTY,
          homeCityId: 1,
          locationCityId: 1,
          captiveByFactionId: null,
          cooldownMonths: 0,
          missionsDone: 1,
          agentKind: 'male' as const,
        },
      },
      cityDefense: {
        1: { level: 1 as const, untilYear: 9999, untilMonth: 12, stationAgentId: 'spy-1-1' },
      },
      nextAgentSeq: 2,
      recentMissions: [
        {
          year: 190,
          month: 1,
          type: SpyMissionType.RECON,
          agentId: 'spy-1-1',
          agentName: '墨鸦·17',
          factionId: 1,
          targetCityId: 8,
          success: true,
          captured: false,
          dead: false,
          message: '探得敌城虚实',
        },
      ],
      plantableBeauty: { 2: 1 },
    },
  };
}

describe('GameStateIntelSchema', () => {
  it('parses a valid intel slice', () => {
    expect(GameStateIntelSchema.parse(validIntel())).toEqual(validIntel());
  });

  it('rejects invalid dates, ranks, skills and unknown fields', () => {
    const invalid = validIntel();
    invalid.intel.cities[8].expireMonth = 13;
    invalid.intel.agents['spy-1-1'].skills.recon = 101;
    expect(() => GameStateIntelSchema.parse(invalid)).toThrow();
    expect(() => GameStateIntelSchema.parse({ ...validIntel(), selectedAgentId: 'spy-1-1' })).toThrow();
  });

  it('rejects mismatched agent record keys and captive state', () => {
    const mismatched = validIntel();
    mismatched.intel.agents['wrong-key'] = mismatched.intel.agents['spy-1-1'];
    delete mismatched.intel.agents['spy-1-1'];
    expect(() => GameStateIntelSchema.parse(mismatched)).toThrow(/记录键/);

    const captive = validIntel();
    captive.intel.agents['spy-1-1'].status = SpyStatus.CAPTIVE;
    expect(() => GameStateIntelSchema.parse(captive)).toThrow(/被俘状态/);
  });

  it('rejects orphaned or contradictory counter-intelligence assignments', () => {
    const orphaned = validIntel();
    orphaned.intel.cityDefense[1].stationAgentId = 'spy-missing';
    expect(() => GameStateIntelSchema.parse(orphaned)).toThrow(/不存在/);

    const contradictory = validIntel();
    contradictory.intel.agents['spy-1-1'].locationCityId = 2;
    expect(() => GameStateIntelSchema.parse(contradictory)).toThrow(/所在城市一致/);

    const missingDefense = validIntel();
    missingDefense.intel.cityDefense = {};
    expect(() => GameStateIntelSchema.parse(missingDefense)).toThrow(/城市驻守记录/);
  });

  it('preserves plantable beauty quotas while pruning expired reports', () => {
    const slice = validIntel();
    const intel = pruneExpiredIntel({
      currentYear: 192,
      currentMonth: 1,
      intel: slice.intel,
    } as GameState);
    expect(intel.cities[8]).toBeUndefined();
    expect(intel.plantableBeauty).toEqual({ 2: 1 });
    expect(() => GameStateIntelSchema.parse({ intel })).not.toThrow();
  });
});
