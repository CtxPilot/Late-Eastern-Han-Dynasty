// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  buildHistoricalGeographyBundle,
  buildHistoricalGeographyBundleSafe,
  type CommanderySeed,
  type CountySeed,
  type LandmarkSeed,
  type RouteSeed,
} from './seed-schema.js';
import { HistoricalGeographyBundleSchema } from './schema.js';
import { nanjun190 } from './nanjun-190.js';
import { yingchuan190 } from './yingchuan-190.js';
import { createHistoricalGeographyPreview } from './preview.js';

// ---------------------------------------------------------------------------
// 最小 seed 工厂
// ---------------------------------------------------------------------------

function makeMinimalSeed(overrides?: Partial<CommanderySeed>): CommanderySeed {
  const counties: CountySeed[] = [
    { id: 'test_seat', name: '郡治', role: 'seat', x: 0.5, y: 0.5, adjacent: ['test_village'] },
    { id: 'test_village', name: '邻县', x: 0.2, y: 0.3, adjacent: ['test_seat'] },
  ];
  return {
    id: 'test_cmd',
    name: '测试郡',
    province: '测试州',
    seatCountyId: 'test_seat',
    worldCityId: 99,
    scenarioYear: 190,
    sourceRefs: ['src_test'],
    counties,
    ...overrides,
  };
}

/** 与 makeMinimalSeed 相同但 seat 县没有 role='seat'（用于校验错误测试）。 */
function makeMinimalSeedMissingSeatRole(overrides?: Partial<CommanderySeed>): CommanderySeed {
  const counties: CountySeed[] = [
    { id: 'test_seat', name: '郡治', x: 0.5, y: 0.5, adjacent: ['test_village'] },
    { id: 'test_village', name: '邻县', x: 0.2, y: 0.3, adjacent: ['test_seat'] },
  ];
  return {
    id: 'test_cmd',
    name: '测试郡',
    province: '测试州',
    seatCountyId: 'test_seat',
    worldCityId: 99,
    scenarioYear: 190,
    sourceRefs: ['src_test'],
    counties,
    ...overrides,
  };
}

const dummySources = [
  {
    id: 'src_test',
    title: '测试史源',
    volume: 'v1',
    entry: 'e1',
    edition: 'ed1',
    url: 'https://example.com',
    accessedAt: '2026-07-31',
    note: 'test only',
  },
];

// ---------------------------------------------------------------------------
// 合法构建测试
// ---------------------------------------------------------------------------

describe('seed-schema: legal builds', () => {
  it('builds a minimal 2-county commandery and passes Zod', () => {
    const bundle = buildHistoricalGeographyBundle(makeMinimalSeed(), dummySources);
    const result = HistoricalGeographyBundleSchema.safeParse(bundle);
    expect(result.success).toBe(true);
    expect(bundle.counties).toHaveLength(2);
    expect(bundle.routes).toHaveLength(1); // auto road from adjacency
    expect(bundle.routes[0]?.id).toBe('road_test_seat__test_village');
    expect(bundle.routes[0]?.kind).toBe('road');
    expect(bundle.routes[0]?.movementCost).toBe(1);
  });

  it('fills defaults: county role, terrain, confidence', () => {
    // 使用显式 role='seat' 的 seat 县 + 无 role 的 village 来测试 default 回退
    const seed = makeMinimalSeed({
      counties: [
        { id: 'test_seat', name: '郡治', role: 'seat', x: 0.5, y: 0.5, adjacent: ['test_village'], sourceRefs: ['src_test'] },
        { id: 'test_village', name: '邻县', x: 0.2, y: 0.3, adjacent: ['test_seat'] },
      ],
    });
    const bundle = buildHistoricalGeographyBundle(seed, dummySources);
    const village = bundle.counties.find((c) => c.id === 'test_village');
    expect(village?.role).toBe('county'); // 无显式 role → 缺省 county
    expect(village?.terrainTags).toEqual(['plain']);
    expect(village?.confidence).toBe('approximate');
  });

  it('preserves explicit county role, terrain, and confidence', () => {
    const seed = makeMinimalSeed({
      counties: [
        {
          id: 'test_seat', name: '郡治', role: 'seat', x: 0.5, y: 0.5,
          adjacent: ['test_village'], terrain: ['river', 'marsh'],
          confidence: 'attested', sourceRefs: ['src_test'],
        },
        {
          id: 'test_village', name: '邻县', role: 'frontier', x: 0.2, y: 0.3,
          adjacent: ['test_seat'], terrain: ['hill'], confidence: 'approximate',
        },
      ],
    });
    const bundle = buildHistoricalGeographyBundle(seed, dummySources);
    const seat = bundle.counties.find((c) => c.id === 'test_seat');
    expect(seat?.role).toBe('seat');
    expect(seat?.terrainTags).toEqual(['river', 'marsh']);
    expect(seat?.confidence).toBe('attested');
    expect(seat?.sourceRefs).toEqual(['src_test']);

    const village = bundle.counties.find((c) => c.id === 'test_village');
    expect(village?.role).toBe('frontier');
    expect(village?.terrainTags).toEqual(['hill']);
  });

  it('embeds landmarks with all geometry types', () => {
    const landmarks: LandmarkSeed[] = [
      {
        id: 'lm_river', name: '测试河', kind: 'river',
        geometry: { type: 'polyline', points: [[0, 0], [0.5, 0.5], [1, 0]] },
      },
      {
        id: 'lm_mountain', name: '测试山', kind: 'mountain',
        geometry: { type: 'polygon', points: [[0, 0], [1, 0], [0.5, 1]] },
      },
      {
        id: 'lm_ferry', name: '测试渡', kind: 'ferry',
        geometry: { type: 'point', x: 0.3, y: 0.7 },
      },
    ];
    const bundle = buildHistoricalGeographyBundle(
      makeMinimalSeed({ landmarks }),
      dummySources,
    );
    expect(bundle.landmarks).toHaveLength(3);

    const river = bundle.landmarks.find((l) => l.id === 'lm_river');
    expect(river?.localGeometry.type).toBe('polyline');
    if (river?.localGeometry.type === 'polyline') {
      expect(river.localGeometry.points).toHaveLength(3);
    }

    const mountain = bundle.landmarks.find((l) => l.id === 'lm_mountain');
    expect(mountain?.localGeometry.type).toBe('polygon');
    if (mountain?.localGeometry.type === 'polygon') {
      expect(mountain.localGeometry.points).toHaveLength(3);
    }

    const ferry = bundle.landmarks.find((l) => l.id === 'lm_ferry');
    expect(ferry?.localGeometry.type).toBe('point');
    if (ferry?.localGeometry.type === 'point') {
      expect(ferry.localGeometry.x).toBe(0.3);
    }
  });

  it('explicit routes override auto-generated roads', () => {
    const routes: RouteSeed[] = [
      {
        id: 'route_test_river',
        from: 'test_seat',
        to: 'test_village',
        kind: 'river',
        movementCost: 1.3,
        seasonal: 'wet',
        confidence: 'attested',
      },
    ];
    const bundle = buildHistoricalGeographyBundle(
      makeMinimalSeed({ routes, autoFillRoads: false }),
      dummySources,
    );
    expect(bundle.routes).toHaveLength(1);
    expect(bundle.routes[0]?.id).toBe('route_test_river');
    expect(bundle.routes[0]?.kind).toBe('river');
    expect(bundle.routes[0]?.movementCost).toBe(1.3);
  });

  it('autoFillRoads=true merges explicit + auto roads', () => {
    // 2 counties: seat <-> village
    // Add 1 explicit river route for seat-village edge, then autoFillRoads adds
    // nothing because the edge is already covered.
    const routes: RouteSeed[] = [
      { id: 'route_river', from: 'test_seat', to: 'test_village', kind: 'river' },
    ];
    const bundle = buildHistoricalGeographyBundle(
      makeMinimalSeed({ routes, autoFillRoads: true }),
      dummySources,
    );
    // 1 explicit + 0 auto = 1 (edge already covered)
    expect(bundle.routes).toHaveLength(1);
    expect(bundle.routes[0]?.kind).toBe('river');
  });

  it('produces deterministic preview from seed-built bundle', () => {
    const seed = makeMinimalSeed({
      landmarks: [
        {
          id: 'lm_pass', name: '关', kind: 'pass',
          geometry: { type: 'point', x: 0.1, y: 0.9 },
        },
      ],
    });
    const bundle = buildHistoricalGeographyBundle(seed, dummySources);
    const p1 = createHistoricalGeographyPreview(bundle);
    const p2 = createHistoricalGeographyPreview(bundle);
    expect(p2).toEqual(p1);
  });
});

// ---------------------------------------------------------------------------
// 非法构建测试（Zod 校验拦截）
// ---------------------------------------------------------------------------

describe('seed-schema: validation errors', () => {
  it('throws on missing seat county (no role=seat)', () => {
    // seatCountyId points to test_seat, but that county has no role field
    // → defaults to 'county', not 'seat' → Zod superRefine fails seat consistency.
    const seed = makeMinimalSeedMissingSeatRole();
    expect(() => buildHistoricalGeographyBundle(seed, dummySources)).toThrow();
  });

  it('throws on asymmetric adjacency', () => {
    const seed: CommanderySeed = {
      ...makeMinimalSeed(),
      counties: [
        { id: 'a', name: 'A', x: 0.5, y: 0.5, adjacent: ['b'] },
        { id: 'b', name: 'B', x: 0.3, y: 0.3, adjacent: [] }, // missing reverse
      ],
    };
    expect(() => buildHistoricalGeographyBundle(seed, dummySources)).toThrow();
  });

  it('throws on route referencing non-existent county', () => {
    const routes: RouteSeed[] = [
      { id: 'route_bad', from: 'test_seat', to: 'nonexistent' },
    ];
    const seed = makeMinimalSeed({
      routes,
      autoFillRoads: false,
      counties: [
        { id: 'test_seat', name: '郡治', role: 'seat', x: 0.5, y: 0.5, adjacent: [] },
      ],
    });
    expect(() => buildHistoricalGeographyBundle(seed, dummySources)).toThrow();
  });

  it('safe mode returns issues instead of throwing', () => {
    const seed = makeMinimalSeedMissingSeatRole(); // no role='seat' → will fail
    const result = buildHistoricalGeographyBundleSafe(seed, dummySources);
    expect(result.issues).toBeDefined();
    expect(result.issues!.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 等价性测试：seed 构建 vs 原有 bundle 不变量
// ---------------------------------------------------------------------------

describe('seed-schema: equivalence with existing bundles', () => {
  it('yingchuan seed-built bundle matches invariants (county count, route count, all-road)', () => {
    expect(yingchuan190.counties).toHaveLength(17);
    expect(yingchuan190.routes.every((r) => r.kind === 'road')).toBe(true);
    expect(yingchuan190.routes.length).toBeGreaterThan(nanjun190.routes.length);
    expect(
      yingchuan190.counties.filter((c) => c.terrainTags.includes('plain')).length,
    ).toBeGreaterThan(10);
  });

  it('nanjun seed-built bundle matches invariants (counties, routes, landmarks)', () => {
    expect(nanjun190.counties).toHaveLength(16);
    expect(nanjun190.routes).toHaveLength(11);
    expect(nanjun190.landmarks).toHaveLength(10);
    expect(
      nanjun190.landmarks.some((l) => l.tacticalTags.includes('boundary_entry')),
    ).toBe(true);
  });

  it('nanjun preview is deterministic', () => {
    const p1 = createHistoricalGeographyPreview(nanjun190);
    const p2 = createHistoricalGeographyPreview(nanjun190);
    expect(p2).toEqual(p1);
  });

  it('yingchuan preview is deterministic', () => {
    const p1 = createHistoricalGeographyPreview(yingchuan190);
    const p2 = createHistoricalGeographyPreview(yingchuan190);
    expect(p2).toEqual(p1);
  });

  it('nanjun county role distribution is preserved', () => {
    const roles = nanjun190.counties.map((c) => c.role);
    expect(roles.filter((r) => r === 'seat')).toHaveLength(1);
    expect(roles.filter((r) => r === 'marquisate').length).toBeGreaterThanOrEqual(1);
    expect(roles.filter((r) => r === 'frontier').length).toBeGreaterThanOrEqual(1);
  });
});
