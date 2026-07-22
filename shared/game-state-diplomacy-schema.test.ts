// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { DipRelation } from './enums/index.js';
import { GameStateDiplomacySchema } from './game-state-diplomacy-schema.js';

function validDiplomacy() {
  return {
    diplomacy: [
      { factionA: 1, factionB: 2, relation: DipRelation.HOSTILE, favorability: -30 },
      {
        factionA: 1,
        factionB: 3,
        relation: DipRelation.ALLIED,
        favorability: 45,
        marriageBond: true,
      },
    ],
  };
}

describe('GameStateDiplomacySchema', () => {
  it('parses a valid diplomacy slice', () => {
    expect(GameStateDiplomacySchema.parse(validDiplomacy())).toEqual(validDiplomacy());
  });

  it('rejects self-relations and favorability outside the persisted range', () => {
    expect(() =>
      GameStateDiplomacySchema.parse({
        diplomacy: [{ factionA: 1, factionB: 1, relation: DipRelation.NEUTRAL, favorability: 0 }],
      }),
    ).toThrow(/同一势力/);
    expect(() =>
      GameStateDiplomacySchema.parse({
        diplomacy: [{ factionA: 1, factionB: 2, relation: DipRelation.FRIENDLY, favorability: 101 }],
      }),
    ).toThrow();
  });

  it('rejects duplicate unordered faction pairs', () => {
    expect(() =>
      GameStateDiplomacySchema.parse({
        diplomacy: [
          { factionA: 1, factionB: 2, relation: DipRelation.HOSTILE, favorability: -20 },
          { factionA: 2, factionB: 1, relation: DipRelation.NEUTRAL, favorability: 0 },
        ],
      }),
    ).toThrow(/同一势力对/);
  });

  it('rejects invalid enum values and unknown transient fields', () => {
    expect(() =>
      GameStateDiplomacySchema.parse({
        diplomacy: [{ factionA: 1, factionB: 2, relation: 'truce', favorability: 0 }],
      }),
    ).toThrow();
    expect(() =>
      GameStateDiplomacySchema.parse({ ...validDiplomacy(), selectedFactionId: 2 }),
    ).toThrow();
  });
});
