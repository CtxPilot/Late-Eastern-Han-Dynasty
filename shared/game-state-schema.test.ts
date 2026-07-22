// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { Season } from './enums/index.js';
import { GameStateTimelineSchema } from './game-state-schema.js';

function validTimeline() {
  return {
    scenarioId: 1,
    enabledEventLayers: ['official_history', 'gameplay'],
    enabledChildEventIds: [1, 2],
    currentYear: 190,
    currentMonth: 3,
    season: Season.SPRING,
    playerFactionId: 2,
    completedEvents: [1001],
    pendingEvents: [1002],
    invalidatedEvents: [],
    eventChoices: { 1001: 0 },
    actionLog: [{ year: 190, month: 3, type: 'turn', message: '三月' }],
  };
}

describe('GameStateTimelineSchema', () => {
  it('parses a valid persistent timeline slice', () => {
    expect(GameStateTimelineSchema.parse(validTimeline())).toEqual(validTimeline());
  });

  it('rejects invalid calendar and enum values', () => {
    expect(() => GameStateTimelineSchema.parse({ ...validTimeline(), currentMonth: 13 })).toThrow();
    expect(() => GameStateTimelineSchema.parse({ ...validTimeline(), season: 4 })).toThrow();
    expect(() =>
      GameStateTimelineSchema.parse({ ...validTimeline(), currentMonth: 7, season: Season.SPRING }),
    ).toThrow(/季节与月份不一致/);
  });

  it('rejects invalid event ids, choices and unknown transient fields', () => {
    expect(() =>
      GameStateTimelineSchema.parse({ ...validTimeline(), pendingEvents: [0] }),
    ).toThrow();
    expect(() =>
      GameStateTimelineSchema.parse({ ...validTimeline(), eventChoices: { 1001: -1 } }),
    ).toThrow();
    expect(() =>
      GameStateTimelineSchema.parse({ ...validTimeline(), selectedCityId: 4 }),
    ).toThrow();
  });

  it('rejects malformed action log entries', () => {
    expect(() =>
      GameStateTimelineSchema.parse({
        ...validTimeline(),
        actionLog: [{ year: 190, month: 0, type: '', message: 'bad' }],
      }),
    ).toThrow();
  });
});
