// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OfficerStatus, type DiplomacyLink, type Officer } from '@leh/shared';
import {
  RadarChart,
  buildDiplomacyRadarItems,
  buildOfficerRadarItems,
} from './RadarChart';

describe('RadarChart 纯 SVG 手写雷达图 (S20-W4)', () => {
  it('正确渲染 5 维多边形与文言标签', () => {
    const items = [
      { label: '统帅', value: 92 },
      { label: '武力', value: 98 },
      { label: '智谋', value: 70 },
      { label: '政治', value: 65 },
      { label: '魅力', value: 85 },
    ];

    const html = renderToStaticMarkup(<RadarChart items={items} size={160} />);

    expect(html).toContain('data-testid="radar-chart"');
    expect(html).toContain('viewBox="0 0 160 160"');
    expect(html).toContain('统帅');
    expect(html).toContain('武力');
    expect(html).toContain('智谋');
    expect(html).toContain('政治');
    expect(html).toContain('魅力');
    expect(html).toContain('98');
    expect(html).toContain('radar-grid');
    expect(html).toContain('radar-spokes');
    expect(html).toContain('radar-nodes');
  });

  it('buildDiplomacyRadarItems 正确派生外交五维数据', () => {
    const link: DiplomacyLink = {
      factionA: 1,
      factionB: 2,
      relation: 'allied' as any,
      favorability: 60,
      marriageBond: true,
    };

    const items = buildDiplomacyRadarItems(link);
    expect(items.length).toBe(5);

    const favItem = items.find((i) => i.label === '友好');
    expect(favItem?.value).toBe(80); // (60 + 100) / 2 = 80

    const trustItem = items.find((i) => i.label === '信任');
    expect(trustItem?.value).toBe(100); // allied = 100

    const marriageItem = items.find((i) => i.label === '姻亲');
    expect(marriageItem?.value).toBe(100);

    const treatyItem = items.find((i) => i.label === '盟约');
    expect(treatyItem?.value).toBe(100);

    const alertItem = items.find((i) => i.label === '戒备');
    expect(alertItem?.value).toBe(0); // allied = 0
  });

  it('buildOfficerRadarItems 正确映射武将五维数据', () => {
    const mockOfficer: Officer = {
      id: 1,
      name: '关羽',
      faction: 1,
      status: OfficerStatus.ACTIVE,
      location: 1,
      loyalty: 100,
      stamina: 100,
      civilPosition: 'none' as any,
      militaryPosition: 'general' as any,
      localPosition: 'none' as any,
      nobilityRank: 'none' as any,
      hegemonyPosition: 'none' as any,
      stats: {
        leadership: 96,
        war: 98,
        intelligence: 76,
        politics: 64,
        charisma: 93,
      },
      hidden: {
        compatibility: 75,
        personality: 'brave' as any,
        ideal: 'royalist' as any,
      } as any,
      merit: 500,
      experience: 1000,
      tags: ['名将', '蜀汉'],
      unitProficiency: {},
      formationMastery: [],
      skills: [],
      birthYear: 160,
      deathYear: 220,
      beauties: [],
    } as Officer;

    const items = buildOfficerRadarItems(mockOfficer);
    expect(items.find((i) => i.label === '统帅')?.value).toBe(96);
    expect(items.find((i) => i.label === '武力')?.value).toBe(98);
    expect(items.find((i) => i.label === '智谋')?.value).toBe(76);
  });

  it('维度少于 3 项时安全降级提示', () => {
    const html = renderToStaticMarkup(
      <RadarChart items={[{ label: '单一', value: 50 }]} size={120} />,
    );
    expect(html).toContain('需至少 3 项维度数据');
  });
});
