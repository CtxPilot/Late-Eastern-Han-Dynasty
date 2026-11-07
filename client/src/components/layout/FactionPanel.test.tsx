// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../../stores/gameStore';
import { FactionPanel } from './FactionPanel';
import { OfficerStatus, type GameState, type Officer } from '@leh/shared';

function mockOfficer(partial: Partial<Officer>): Officer {
  return {
    id: 1,
    name: '曹操',
    faction: 1,
    status: OfficerStatus.ACTIVE,
    location: 1,
    loyalty: 100,
    stamina: 100,
    civilPosition: 'none' as any,
    militaryPosition: 'none' as any,
    localPosition: 'none' as any,
    nobilityRank: 'none' as any,
    hegemonyPosition: 'none' as any,
    stats: {
      leadership: 96,
      war: 72,
      intelligence: 91,
      politics: 94,
      charisma: 96,
    },
    hidden: {
      compatibility: 25,
      personality: 'cautious' as any,
      ideal: 'hegemon' as any,
    } as any,
    merit: 1000,
    experience: 0,
    tags: [],
    unitProficiency: {},
    formationMastery: [],
    skills: [],
    birthYear: 160,
    deathYear: 220,
    beauties: [],
    ...partial,
  } as Officer;
}

describe('FactionPanel 势力派系门阀面板 (S20-W4)', () => {
  beforeEach(() => {
    const mockGame: Partial<GameState> = {
      playerFactionId: 1,
      factions: {
        1: { id: 1, name: '曹操', color: '#dc2626', rulerId: 1 } as any,
      },
      officers: {
        // 士族 3 人
        1: mockOfficer({ id: 1, name: '荀彧', tags: ['士族'], civilPosition: 'chancellor' as any }),
        2: mockOfficer({ id: 2, name: '陈群', tags: ['士族'], civilPosition: 'prefect' as any }),
        3: mockOfficer({ id: 3, name: '钟繇', tags: ['士族'], civilPosition: 'clerk' as any }),
        // 豪强 2 人
        4: mockOfficer({ id: 4, name: '李典', tags: ['豪族'], militaryPosition: 'general' as any }),
        5: mockOfficer({ id: 5, name: '乐进', tags: ['豪强'], militaryPosition: 'colonel' as any }),
        // 寒门 1 人 (散员)
        6: mockOfficer({ id: 6, name: '郭嘉', tags: ['寒门'] }),
      },
      cities: {},
    };

    useGameStore.setState({ game: mockGame as GameState });
  });

  it('正确渲染凝聚力读数与派系卡片', () => {
    const html = renderToStaticMarkup(<FactionPanel game={useGameStore.getState().game} />);

    expect(html).toContain('data-testid="faction-panel"');
    expect(html).toContain('朝野门阀凝聚力');
    expect(html).toContain('士族派');
    expect(html).toContain('豪强派');
    expect(html).toContain('荀彧');
    expect(html).toContain('李典');
    expect(html).toContain('游离散员');
    expect(html).toContain('1 人');
  });
});
