// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { nanjun190 } from './nanjun-190.js';
import { createHistoricalGeographyPreview } from './preview.js';
import {
  CountyDefinitionSchema,
  HistoricalGeographyBundleSchema,
} from './schema.js';

describe('BF-P0 historical geography schema', () => {
  it('accepts the complete Nanjun 190 slice and its cross references', () => {
    const result = HistoricalGeographyBundleSchema.safeParse(nanjun190);
    expect(result.error?.issues).toEqual(undefined);
    expect(result.success).toBe(true);
    expect(nanjun190.commanderies).toHaveLength(1);
    expect(nanjun190.counties).toHaveLength(16);
    expect(nanjun190.commanderies[0]?.countyIds).toHaveLength(16);
    expect(nanjun190.counties.some(({ name }) => name === '襄阳')).toBe(false);
    expect(nanjun190.landmarks.find(({ id }) => id === 'nanjun_xiangyang_ferry')?.tacticalTags)
      .toContain('boundary_entry');
  });

  it('rejects out-of-range coordinates and missing source references', () => {
    const county = nanjun190.counties[0];
    expect(county).toBeDefined();
    if (!county) return;

    expect(CountyDefinitionSchema.safeParse({ ...county, localX: 1.01 }).success).toBe(false);
    expect(CountyDefinitionSchema.safeParse({ ...county, sourceRefs: [] }).success).toBe(false);
  });

  it('rejects asymmetric adjacency in a bundle', () => {
    const counties = nanjun190.counties.map((county) =>
      county.id === 'nanjun_jiangling'
        ? { ...county, adjacentCountyIds: county.adjacentCountyIds.slice(1) }
        : county,
    );
    expect(HistoricalGeographyBundleSchema.safeParse({ ...nanjun190, counties }).success).toBe(false);
  });

  it('produces a stable read-only preview without any RNG input', () => {
    const first = createHistoricalGeographyPreview(nanjun190);
    const second = createHistoricalGeographyPreview(nanjun190);
    expect(second).toEqual(first);
    expect(first.counties).toHaveLength(16);
    expect(first.routes).toHaveLength(11);
    expect(first.landmarks).toHaveLength(10);
  });
});
