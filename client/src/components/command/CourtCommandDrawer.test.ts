// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { DipRelation, HegemonyPosition, type GameState } from '@leh/shared';
import { buildCourtViewModel } from './CourtCommandDrawer';

function makeGame(overrides?: {
  stage?: 'vassal' | 'hegemon';
  authority?: number;
  cooldown?: number;
  relation?: DipRelation;
  emperorRuler?: number;
}): GameState {
  const stage = overrides?.stage ?? 'vassal';
  return {
    playerFactionId: 1,
    emperorLocation: 10,
    factions: {
      1: {
        id: 1,
        name: '曹操军',
        rulerId: 1,
        politicalStage: stage,
        politicalTitle: stage === 'hegemon' ? '丞相' : undefined,
        imperialAuthority: overrides?.authority ?? (stage === 'hegemon' ? 100 : 0),
        imperialDecreeCooldown: overrides?.cooldown ?? 0,
      },
      2: { id: 2, name: '孙坚军', rulerId: 2, isAlive: true },
    },
    cities: {
      10: { id: 10, name: '洛阳', ruler: overrides?.emperorRuler ?? 1 },
    },
    officers: {
      1: { id: 1, name: '曹操', faction: 1 },
      2: { id: 2, name: '孙坚', faction: 2 },
      3: {
        id: 3,
        name: '夏侯惇',
        faction: 1,
        hegemonyPosition: HegemonyPosition.GRAND_CAPTAIN,
      },
    },
    diplomacy: [
      {
        factionA: 1,
        factionB: 2,
        relation: overrides?.relation ?? DipRelation.NEUTRAL,
        favorability: 0,
      },
    ],
  } as unknown as GameState;
}

describe('buildCourtViewModel (CMD-P2)', () => {
  it('derives ruler, stage and emperor control from the same authoritative state as the legacy entry', () => {
    const model = buildCourtViewModel(makeGame());

    expect(model?.ruler?.name).toBe('曹操');
    expect(model?.stage).toBe('vassal');
    expect(model?.controlsHan).toBe(true);
    expect(model?.emperorCity?.name).toBe('洛阳');
  });

  it('derives false-decree authority/cooldown/relation gates deterministically', () => {
    expect(
      buildCourtViewModel(makeGame({ stage: 'hegemon', authority: 39 }))
        ?.targets[0]?.disabledReason,
    ).toContain('皇权不足');
    expect(
      buildCourtViewModel(makeGame({ stage: 'hegemon', cooldown: 3 }))
        ?.targets[0]?.disabledReason,
    ).toContain('剩余3季');
    expect(
      buildCourtViewModel(makeGame({ stage: 'hegemon', relation: DipRelation.WAR }))
        ?.targets[0]?.disabledReason,
    ).toBe('已交战');
    expect(
      buildCourtViewModel(makeGame({ stage: 'hegemon', authority: 100 }))
        ?.targets[0]?.disabledReason,
    ).toBeNull();
  });

  it('shows all three hegemony offices and their current holders without creating appointment state', () => {
    const offices = buildCourtViewModel(makeGame({ stage: 'hegemon' }))?.offices;

    expect(offices).toHaveLength(3);
    expect(offices?.find((office) => office.position === HegemonyPosition.GRAND_CAPTAIN)?.holder?.name)
      .toBe('夏侯惇');
    expect(offices?.filter((office) => officerIsVacant(office.holder))).toHaveLength(2);
  });
});

function officerIsVacant(holder: unknown): boolean {
  return holder == null;
}
