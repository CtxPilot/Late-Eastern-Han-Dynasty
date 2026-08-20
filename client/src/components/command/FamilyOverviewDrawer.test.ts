// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { OfficerStatus, type GameState } from '@leh/shared';
import {
  buildFamilyGenealogy,
  buildFamilyOverview,
  validateFollowCheck,
  validateMarriageDraft,
  type FamilyChildEntry,
} from './FamilyOverviewDrawer';

describe('family read-only overview model', () => {
  it('derives player women, kinship, fixed children, marriage and follow candidates', () => {
    const game = {
      currentYear: 220,
      playerFactionId: 1,
      enabledChildEventIds: [950],
      factions: {
        1: { id: 1, rulerId: 1 },
        2: { id: 2, rulerId: 9 },
      },
      cities: {
        1: { id: 1, name: '洛阳' },
        2: { id: 2, name: '许昌' },
      },
      females: {
        201: {
          id: 201, name: '甄氏', clanName: '甄', factionId: 1, locationId: 1,
          birthYear: 183, status: 'married', husbandId: 2, canCommand: false,
        },
        202: {
          id: 202, name: '蔡琰', clanName: '蔡', factionId: 1, locationId: 1,
          birthYear: 177, status: 'widow', canCommand: false,
        },
        203: {
          id: 203, name: '敌女', clanName: '孙', factionId: 2, locationId: 2,
          birthYear: 189, status: 'single', canCommand: false,
        },
      },
      officers: {
        1: {
          id: 1, name: '曹操', faction: 1, wifeId: null, loyalty: 100,
          birthYear: 155,
          stats: { leadership: 90, war: 70, intelligence: 90, politics: 90, charisma: 95 },
          hidden: { compatibility: 20, ideal: 'fame', bloodline: [] },
        },
        2: {
          id: 2, name: '曹丕', faction: 1, wifeId: 201, loyalty: 90,
          birthYear: 187,
          stats: { leadership: 70, war: 55, intelligence: 82, politics: 85, charisma: 75 },
          hidden: { compatibility: 25, ideal: 'fame', bloodline: [] },
        },
        3: {
          id: 3, name: '陈到', faction: null, location: 2, status: OfficerStatus.FREE,
          hidden: { compatibility: 30, ideal: 'fame', bloodline: [] },
        },
        9: {
          id: 9, name: '敌君', faction: 2, wifeId: null, loyalty: 100,
          birthYear: 160,
          stats: { leadership: 70, war: 70, intelligence: 70, politics: 70, charisma: 70 },
          hidden: { compatibility: 100, ideal: 'order', bloodline: [] },
        },
      },
    } as unknown as GameState;
    const children: FamilyChildEntry[] = [{
      childId: 950, childName: '曹叡', fatherId: 2, motherId: 201,
      birthYear: 204, appearYear: 220, source: 'history',
    }];

    const overview = buildFamilyOverview(game, children);

    expect(overview.females.map((female) => female.name)).toEqual(['蔡琰', '甄氏']);
    expect(overview.branches).toHaveLength(1);
    expect(overview.branches[0]).toMatchObject({
      officerName: '曹丕',
      wives: [{ name: '甄氏', canCommand: false }],
      children: [{ childName: '曹叡', status: '待登场' }],
    });
    expect(overview.genealogy).toEqual([{
      childId: 950,
      childName: '曹叡',
      birthYear: 204,
      appearYear: 220,
      source: 'history',
      father: { id: 2, name: '曹丕' },
      mother: { id: 201, name: '甄氏' },
      status: '待登场',
    }]);
    expect(overview.marriageFemales).toEqual([{ id: 202, name: '蔡琰' }]);
    expect(overview.marriageOfficers).toEqual([{ id: 1, name: '曹操' }]);
    expect(overview.freeOfficers[0]).toMatchObject({
      name: '陈到',
      compatibilityDiff: 10,
      hasTrigger: true,
    });
    expect(JSON.stringify(overview)).not.toContain('敌女');
  });

  it('keeps the genealogy projection scenario-scoped and does not leak enemy branches', () => {
    const game = {
      currentYear: 220,
      playerFactionId: 1,
      enabledChildEventIds: [950, 951],
      females: {
        201: { id: 201, name: '甄氏', factionId: 1, locationId: 1 },
        202: { id: 202, name: '敌女', factionId: 2, locationId: 2 },
      },
      officers: {
        1: { id: 1, name: '曹操', faction: 1 },
        2: { id: 2, name: '曹丕', faction: 1 },
        9: { id: 9, name: '敌将', faction: 2 },
      },
    } as unknown as GameState;
    const children: FamilyChildEntry[] = [
      { childId: 950, childName: '曹叡', fatherId: 2, motherId: 201, birthYear: 204, appearYear: 220, source: 'history' },
      { childId: 951, childName: '敌将子', fatherId: 9, motherId: 202, birthYear: 205, appearYear: 221, source: 'history' },
      { childId: 952, childName: '未启用子', fatherId: 2, motherId: 201, birthYear: 206, appearYear: 222, source: 'history' },
    ];

    expect(buildFamilyGenealogy(game, children).map((entry) => entry.childName)).toEqual(['曹叡']);
  });

  it('revalidates marriage and manual follow drafts against the latest state', () => {
    const game = {
      currentYear: 190,
      playerFactionId: 1,
      cities: { 1: { id: 1, ruler: 1, gold: 300 } },
      females: {
        201: {
          id: 201, birthYear: 170, factionId: 1, status: 'single', husbandId: null,
          giftedToOfficerId: null,
        },
      },
      officers: {
        1: { id: 1, birthYear: 150, faction: 1, wifeId: null },
        2: { id: 2, faction: null, status: OfficerStatus.FREE },
      },
    } as unknown as GameState;

    expect(validateMarriageDraft(game, { femaleId: 201, officerId: 1 })).toBeNull();
    expect(validateFollowCheck(game)).toBeNull();

    const underage = {
      ...game,
      females: {
        ...game.females,
        201: { ...game.females[201], birthYear: 189 },
      },
    };
    expect(validateMarriageDraft(underage, { femaleId: 201, officerId: 1 }))
      .toBe('女角未达到玩家婚配成年门槛（18岁）。');

    const noFreeOfficer = {
      ...game,
      officers: {
        ...game.officers,
        2: { ...game.officers[2], faction: 2 },
      },
    };
    expect(validateFollowCheck(noFreeOfficer)).toBe('当前没有可检定的在野武将。');
  });
});
