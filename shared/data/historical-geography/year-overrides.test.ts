// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { buildHistoricalGeographyBundle, type CommanderySeed } from './seed-schema.js';
import { HistoricalGeographyBundleSchema } from './schema.js';
import { resolveBundleForYear } from './year-overrides.js';
import { nanjun190 } from './nanjun-190.js';
import { yingchuan190 } from './yingchuan-190.js';

const dummySources = [
  {
    id: 'src_test',
    title: '测试史源',
    volume: 'v1',
    entry: 'e1',
    edition: 'ed1',
    url: 'https://example.com',
    accessedAt: '2026-07-31',
    note: '年代覆写演示夹具，非历史校勘结论',
  },
];

/**
 * 多年代演示夹具：基线 190 有 4 县，208 年起析置新县、裁撤旧县。
 * 全部为机制演示数据（inferred），不主张任何真实行政区划变更。
 */
function makeMultiYearSeed(overrides?: Partial<CommanderySeed>): CommanderySeed {
  return {
    id: 'demo_cmd',
    name: '演示郡',
    province: '测试州',
    seatCountyId: 'demo_seat',
    worldCityId: 99,
    scenarioYear: 190,
    validFromYear: 190,
    validToYear: 215,
    sourceRefs: ['src_test'],
    // 纯陆路，autoFillRoads 从邻接自动派生，并取两端县有效期交集。
    counties: [
      {
        id: 'demo_seat', name: '治所', role: 'seat', x: 0.5, y: 0.5,
        adjacent: ['demo_a', 'demo_b', 'demo_c'],
        validFromYear: 190, validToYear: 215,
      },
      {
        id: 'demo_a', name: '甲县', x: 0.2, y: 0.3,
        adjacent: ['demo_seat'],
        validFromYear: 190, validToYear: 215,
      },
      {
        // 208 年裁撤：此后年份该县与相关引用被过滤。
        id: 'demo_b', name: '乙县', x: 0.8, y: 0.2,
        adjacent: ['demo_seat'],
        validFromYear: 190, validToYear: 207,
      },
      {
        // 208 年析置：此前年份该县不存在。
        id: 'demo_c', name: '丙县', x: 0.8, y: 0.8,
        adjacent: ['demo_seat'],
        validFromYear: 208, validToYear: 215,
      },
    ],
    ...overrides,
  };
}

describe('seed-schema: valid period passthrough', () => {
  it('threads validFromYear/validToYear from seed into bundle entries', () => {
    const bundle = buildHistoricalGeographyBundle(makeMultiYearSeed(), dummySources);
    const commandery = bundle.commanderies[0];
    expect(commandery.validFromYear).toBe(190);
    expect(commandery.validToYear).toBe(215);

    const seat = bundle.counties.find((c) => c.id === 'demo_seat');
    expect(seat?.validFromYear).toBe(190);
    expect(seat?.validToYear).toBe(215);

    const b = bundle.counties.find((c) => c.id === 'demo_b');
    expect(b?.validFromYear).toBe(190);
    expect(b?.validToYear).toBe(207);
  });

  it('auto-derived road valid period is the intersection of its endpoints', () => {
    const bundle = buildHistoricalGeographyBundle(makeMultiYearSeed(), dummySources);
    const roadToB = bundle.routes.find((r) => r.id === 'road_demo_b__demo_seat');
    expect(roadToB).toBeDefined();
    expect(roadToB?.validFromYear).toBe(190);
    expect(roadToB?.validToYear).toBe(207);

    const roadToC = bundle.routes.find((r) => r.id === 'road_demo_c__demo_seat');
    expect(roadToC).toBeDefined();
    expect(roadToC?.validFromYear).toBe(208);
    expect(roadToC?.validToYear).toBe(215);
  });

  it('throws when a county declares validFromYear > validToYear', () => {
    const seed = makeMultiYearSeed({
      counties: [
        {
          id: 'demo_seat', name: '治所', role: 'seat', x: 0.5, y: 0.5,
          adjacent: [], validFromYear: 210, validToYear: 190,
        },
      ],
    });
    expect(() => buildHistoricalGeographyBundle(seed, dummySources)).toThrow();
  });
});

describe('resolveBundleForYear: multi-year filtering', () => {
  it('year 190 keeps baseline counties and prunes the future county', () => {
    const bundle = buildHistoricalGeographyBundle(makeMultiYearSeed(), dummySources);
    const active = resolveBundleForYear(bundle, 190);
    const ids = active.counties.map((c) => c.id).sort();
    expect(ids).toEqual(['demo_a', 'demo_b', 'demo_seat']);
    expect(HistoricalGeographyBundleSchema.safeParse(active).success).toBe(true);

    const seat = active.counties.find((c) => c.id === 'demo_seat');
    // demo_c 尚未析置：引用被剔除；demo_a/demo_b 保留。
    expect(seat?.adjacentCountyIds).toEqual(['demo_a', 'demo_b']);
  });

  it('year 208 swaps: county B retired, county C created', () => {
    const bundle = buildHistoricalGeographyBundle(makeMultiYearSeed(), dummySources);
    const active = resolveBundleForYear(bundle, 208);
    const ids = active.counties.map((c) => c.id).sort();
    expect(ids).toEqual(['demo_a', 'demo_c', 'demo_seat']);
    expect(HistoricalGeographyBundleSchema.safeParse(active).success).toBe(true);

    const seat = active.counties.find((c) => c.id === 'demo_seat');
    expect(seat?.adjacentCountyIds).toEqual(['demo_a', 'demo_c']);
  });

  it('year 215 is the commandery deadline (inclusive)', () => {
    const bundle = buildHistoricalGeographyBundle(makeMultiYearSeed(), dummySources);
    const active = resolveBundleForYear(bundle, 215);
    expect(active.counties.length).toBeGreaterThan(0);
    expect(active.commanderies[0]?.validToYear).toBe(215);
  });

  it('throws when year is outside the commandery valid period (strict)', () => {
    const bundle = buildHistoricalGeographyBundle(makeMultiYearSeed(), dummySources);
    expect(() => resolveBundleForYear(bundle, 216)).toThrow(
      /no valid template for year 216/,
    );
    expect(() => resolveBundleForYear(bundle, 189)).toThrow(/no valid template for year 189/);
  });

  it('throws when the seat county is not valid in the requested year', () => {
    const seed = makeMultiYearSeed({
      validFromYear: 190,
      validToYear: 215,
      counties: [
        {
          id: 'demo_seat', name: '治所', role: 'seat', x: 0.5, y: 0.5,
          adjacent: ['demo_a'], validFromYear: 190, validToYear: 199,
        },
        {
          id: 'demo_a', name: '甲县', x: 0.2, y: 0.3,
          adjacent: ['demo_seat'], validFromYear: 190, validToYear: 215,
        },
      ],
    });
    const bundle = buildHistoricalGeographyBundle(seed, dummySources);
    expect(() => resolveBundleForYear(bundle, 205)).toThrow(/seat county "demo_seat"/);
  });

  it('is deterministic (no RNG) and does not mutate the input', () => {
    const bundle = buildHistoricalGeographyBundle(makeMultiYearSeed(), dummySources);
    const snapshot = JSON.stringify(bundle);
    const r1 = resolveBundleForYear(bundle, 208);
    const r2 = resolveBundleForYear(bundle, 208);
    expect(r2).toEqual(r1);
    expect(JSON.stringify(bundle)).toBe(snapshot);
  });
});

describe('resolveBundleForYear: existing 190 bundles regression', () => {
  it('nanjun190 resolves at 190 unchanged', () => {
    const active = resolveBundleForYear(nanjun190, 190);
    expect(active.counties).toHaveLength(16);
    expect(active.routes).toHaveLength(11);
    expect(active.landmarks).toHaveLength(10);
    expect(active.commanderies[0]?.id).toBe('jing_nanjun_190');
  });

  it('nanjun190 throws at any other year (all entries are single-year)', () => {
    expect(() => resolveBundleForYear(nanjun190, 191)).toThrow();
    expect(() => resolveBundleForYear(nanjun190, 189)).toThrow();
  });

  it('yingchuan190 resolves at 190 unchanged', () => {
    const active = resolveBundleForYear(yingchuan190, 190);
    expect(active.counties).toHaveLength(17);
    expect(active.routes).toHaveLength(29);
  });
});
