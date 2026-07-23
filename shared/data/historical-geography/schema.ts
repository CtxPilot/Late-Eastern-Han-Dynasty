// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';

const StableIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/, 'must be a stable snake_case identifier');
const YearSchema = z.number().int().min(-1000).max(3000);
const SourceRefsSchema = z.array(StableIdSchema).min(1);

function hasValidPeriod(value: { validFromYear?: number; validToYear?: number }): boolean {
  return (
    value.validFromYear === undefined ||
    value.validToYear === undefined ||
    value.validFromYear <= value.validToYear
  );
}

export const HistoricalConfidenceSchema = z.enum(['attested', 'approximate', 'inferred']);
export const TerrainTagSchema = z.enum([
  'plain',
  'hill',
  'mountain',
  'forest',
  'river',
  'lake',
  'marsh',
  'coast',
]);

export const HistoricalSourceSchema = z
  .object({
    id: StableIdSchema,
    title: z.string().min(1),
    author: z.string().min(1).optional(),
    volume: z.string().min(1),
    entry: z.string().min(1),
    edition: z.string().min(1),
    url: z.string().url(),
    accessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().min(1).optional(),
  })
  .strict();

export const LocalBoundsSchema = z
  .object({
    minX: z.number().min(0).max(1),
    minY: z.number().min(0).max(1),
    maxX: z.number().min(0).max(1),
    maxY: z.number().min(0).max(1),
  })
  .strict()
  .refine((value) => value.minX < value.maxX && value.minY < value.maxY, {
    message: 'local bounds must have positive width and height',
  });

export const CommanderyDefinitionSchema = z
  .object({
    id: StableIdSchema,
    templateVersion: z.number().int().positive(),
    name: z.string().min(1),
    province: z.string().min(1),
    seatCountyId: StableIdSchema,
    worldCityId: z.number().int().positive(),
    validFromYear: YearSchema.optional(),
    validToYear: YearSchema.optional(),
    variantOf: StableIdSchema.optional(),
    countyIds: z.array(StableIdSchema).min(1),
    localBounds: LocalBoundsSchema,
    sourceRefs: SourceRefsSchema,
  })
  .strict()
  .refine(hasValidPeriod, { message: 'validFromYear must not exceed validToYear' });

export const CountyDefinitionSchema = z
  .object({
    id: StableIdSchema,
    name: z.string().min(1),
    commanderyId: StableIdSchema,
    role: z.enum(['seat', 'county', 'marquisate', 'frontier']),
    validFromYear: YearSchema.optional(),
    validToYear: YearSchema.optional(),
    variantOf: StableIdSchema.optional(),
    lon: z.number().min(-180).max(180).optional(),
    lat: z.number().min(-90).max(90).optional(),
    localX: z.number().min(0).max(1),
    localY: z.number().min(0).max(1),
    confidence: HistoricalConfidenceSchema,
    locationNote: z.string().min(1).optional(),
    terrainTags: z.array(TerrainTagSchema).min(1),
    adjacentCountyIds: z.array(StableIdSchema),
    landmarkIds: z.array(StableIdSchema),
    sourceRefs: SourceRefsSchema,
  })
  .strict()
  .refine(hasValidPeriod, { message: 'validFromYear must not exceed validToYear' })
  .refine((value) => (value.lon === undefined) === (value.lat === undefined), {
    message: 'lon and lat must either both be present or both be absent',
  })
  .refine((value) => value.confidence === 'attested' || value.locationNote !== undefined, {
    message: 'approximate/inferred locations require locationNote',
  });

export const HistoricalRouteDefinitionSchema = z
  .object({
    id: StableIdSchema,
    commanderyId: StableIdSchema,
    fromNodeId: StableIdSchema,
    toNodeId: StableIdSchema,
    kind: z.enum(['road', 'river', 'pass', 'ferry']),
    movementCost: z.number().positive(),
    seasonal: z.enum(['all', 'dry', 'wet']).optional(),
    validFromYear: YearSchema.optional(),
    validToYear: YearSchema.optional(),
    variantOf: StableIdSchema.optional(),
    confidence: HistoricalConfidenceSchema,
    sourceRefs: SourceRefsSchema,
  })
  .strict()
  .refine(hasValidPeriod, { message: 'validFromYear must not exceed validToYear' })
  .refine((value) => value.fromNodeId !== value.toNodeId, {
    message: 'route endpoints must differ',
  });

const LocalPointSchema = z
  .object({
    type: z.literal('point'),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  })
  .strict();
const LocalPolylineSchema = z
  .object({
    type: z.literal('polyline'),
    points: z
      .array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]))
      .min(2),
  })
  .strict();
const LocalPolygonSchema = z
  .object({
    type: z.literal('polygon'),
    points: z
      .array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]))
      .min(3),
  })
  .strict();

export const LocalGeometrySchema = z.discriminatedUnion('type', [
  LocalPointSchema,
  LocalPolylineSchema,
  LocalPolygonSchema,
]);

export const BattlefieldLandmarkDefinitionSchema = z
  .object({
    id: StableIdSchema,
    commanderyId: StableIdSchema,
    name: z.string().min(1),
    kind: z.enum([
      'river',
      'lake',
      'marsh',
      'mountain',
      'pass',
      'ferry',
      'bridge',
      'port',
    ]),
    validFromYear: YearSchema.optional(),
    validToYear: YearSchema.optional(),
    variantOf: StableIdSchema.optional(),
    localGeometry: LocalGeometrySchema,
    tacticalTags: z.array(z.string().min(1)),
    confidence: HistoricalConfidenceSchema,
    locationNote: z.string().min(1).optional(),
    sourceRefs: SourceRefsSchema,
  })
  .strict()
  .refine(hasValidPeriod, { message: 'validFromYear must not exceed validToYear' })
  .refine((value) => value.confidence === 'attested' || value.locationNote !== undefined, {
    message: 'approximate/inferred landmarks require locationNote',
  });

export const HistoricalGeographyBundleSchema = z
  .object({
    sliceId: StableIdSchema,
    scenarioYear: YearSchema,
    sources: z.array(HistoricalSourceSchema).min(1),
    commanderies: z.array(CommanderyDefinitionSchema).min(1),
    counties: z.array(CountyDefinitionSchema).min(1),
    routes: z.array(HistoricalRouteDefinitionSchema),
    landmarks: z.array(BattlefieldLandmarkDefinitionSchema),
  })
  .strict()
  .superRefine((bundle, ctx) => {
    const sourceIds = new Set(bundle.sources.map(({ id }) => id));
    const commanderyIds = new Set(bundle.commanderies.map(({ id }) => id));
    const countyIds = new Set(bundle.counties.map(({ id }) => id));
    const landmarkIds = new Set(bundle.landmarks.map(({ id }) => id));
    const allNodeIds = new Set([...countyIds, ...landmarkIds]);

    const requireUnique = (ids: string[], path: string): void => {
      const seen = new Set<string>();
      ids.forEach((id, index) => {
        if (seen.has(id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path, index, 'id'], message: `duplicate id ${id}` });
        }
        seen.add(id);
      });
    };
    requireUnique(bundle.sources.map(({ id }) => id), 'sources');
    requireUnique(bundle.commanderies.map(({ id }) => id), 'commanderies');
    requireUnique(bundle.counties.map(({ id }) => id), 'counties');
    requireUnique(bundle.routes.map(({ id }) => id), 'routes');
    requireUnique(bundle.landmarks.map(({ id }) => id), 'landmarks');

    const checkSources = (refs: string[], path: (string | number)[]): void => {
      refs.forEach((ref, index) => {
        if (!sourceIds.has(ref)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, index], message: `unknown source ${ref}` });
        }
      });
    };

    bundle.commanderies.forEach((commandery, index) => {
      checkSources(commandery.sourceRefs, ['commanderies', index, 'sourceRefs']);
      if (!countyIds.has(commandery.seatCountyId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['commanderies', index, 'seatCountyId'], message: 'unknown seat county' });
      } else {
        const seat = bundle.counties.find(({ id }) => id === commandery.seatCountyId);
        if (seat?.commanderyId !== commandery.id || seat.role !== 'seat') {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['commanderies', index, 'seatCountyId'], message: 'seat must be a seat-role county in this commandery' });
        }
      }
      if (new Set(commandery.countyIds).size !== commandery.countyIds.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['commanderies', index, 'countyIds'], message: 'duplicate county reference' });
      }
      commandery.countyIds.forEach((id, countyIndex) => {
        if (!countyIds.has(id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['commanderies', index, 'countyIds', countyIndex], message: `unknown county ${id}` });
        }
      });
      if (commandery.variantOf && !commanderyIds.has(commandery.variantOf)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['commanderies', index, 'variantOf'], message: 'unknown commandery variant base' });
      }
    });

    bundle.counties.forEach((county, index) => {
      checkSources(county.sourceRefs, ['counties', index, 'sourceRefs']);
      if (!commanderyIds.has(county.commanderyId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['counties', index, 'commanderyId'], message: 'unknown commandery' });
      } else {
        const owner = bundle.commanderies.find(({ id }) => id === county.commanderyId);
        if (!owner?.countyIds.includes(county.id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['counties', index, 'commanderyId'], message: 'county is missing from its commandery countyIds' });
        }
      }
      if (county.adjacentCountyIds.includes(county.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['counties', index, 'adjacentCountyIds'], message: 'county cannot be adjacent to itself' });
      }
      if (new Set(county.adjacentCountyIds).size !== county.adjacentCountyIds.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['counties', index, 'adjacentCountyIds'], message: 'duplicate adjacency reference' });
      }
      if (new Set(county.landmarkIds).size !== county.landmarkIds.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['counties', index, 'landmarkIds'], message: 'duplicate landmark reference' });
      }
      county.adjacentCountyIds.forEach((id, adjacentIndex) => {
        const peer = bundle.counties.find((candidate) => candidate.id === id);
        if (!peer) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['counties', index, 'adjacentCountyIds', adjacentIndex], message: `unknown county ${id}` });
        } else if (!peer.adjacentCountyIds.includes(county.id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['counties', index, 'adjacentCountyIds', adjacentIndex], message: `adjacency with ${id} is not symmetric` });
        }
      });
      county.landmarkIds.forEach((id, landmarkIndex) => {
        if (!landmarkIds.has(id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['counties', index, 'landmarkIds', landmarkIndex], message: `unknown landmark ${id}` });
        }
      });
      if (county.variantOf && !countyIds.has(county.variantOf)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['counties', index, 'variantOf'], message: 'unknown county variant base' });
      }
    });

    bundle.routes.forEach((route, index) => {
      checkSources(route.sourceRefs, ['routes', index, 'sourceRefs']);
      if (!commanderyIds.has(route.commanderyId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['routes', index, 'commanderyId'], message: 'unknown commandery' });
      }
      for (const [field, id] of [['fromNodeId', route.fromNodeId], ['toNodeId', route.toNodeId]] as const) {
        if (!allNodeIds.has(id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['routes', index, field], message: `unknown node ${id}` });
        }
      }
      if (route.variantOf && !bundle.routes.some(({ id }) => id === route.variantOf)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['routes', index, 'variantOf'], message: 'unknown route variant base' });
      }
    });

    bundle.landmarks.forEach((landmark, index) => {
      checkSources(landmark.sourceRefs, ['landmarks', index, 'sourceRefs']);
      if (!commanderyIds.has(landmark.commanderyId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['landmarks', index, 'commanderyId'], message: 'unknown commandery' });
      }
      if (landmark.variantOf && !landmarkIds.has(landmark.variantOf)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['landmarks', index, 'variantOf'], message: 'unknown landmark variant base' });
      }
    });
  });

export type HistoricalConfidence = z.infer<typeof HistoricalConfidenceSchema>;
export type HistoricalSource = z.infer<typeof HistoricalSourceSchema>;
export type CommanderyDefinition = z.infer<typeof CommanderyDefinitionSchema>;
export type CountyDefinition = z.infer<typeof CountyDefinitionSchema>;
export type HistoricalRouteDefinition = z.infer<typeof HistoricalRouteDefinitionSchema>;
export type BattlefieldLandmarkDefinition = z.infer<typeof BattlefieldLandmarkDefinitionSchema>;
export type HistoricalGeographyBundle = z.infer<typeof HistoricalGeographyBundleSchema>;
