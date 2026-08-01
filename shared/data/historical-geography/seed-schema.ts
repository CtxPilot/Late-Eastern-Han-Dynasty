// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * BF-P5 郡国模板录入 seed schema 与构建器。
 *
 * 设计目标：让录入者用一份人友好的 `CommanderySeed` 表达「南郡级」复杂郡国
 * （水系/侯国/边县/多形态地标/per-edge 路径），构建器补全 Zod 强制字段并自校验。
 *
 * 与 `schema.ts` 的关系：本文件是「录入层」，schema.ts 是「校验层」。构建器产出的
 * `HistoricalGeographyBundle` 必须能通过 `HistoricalGeographyBundleSchema.safeParse`。
 *
 * 年代覆写（BF-P5）：`CountySeed`/`LandmarkSeed`/`RouteSeed`/`CommanderySeed` 均支持
 * `validFromYear`/`validToYear`（缺省 = `scenarioYear`），即「基线模板 + 建安改置覆写」
 * 的最小 Schema（docs/21 Q4 方案 B）。同一条目可声明有效期区间，运行时用
 * `resolveBundleForYear`（见 `year-overrides.ts`）按年份过滤出该年有效的子集。
 *
 * 完整度约 95%：剩余 lon/lat（两郡均留空）、variantOf（年代变体引用）等字段
 * 不经 seed 接入，如需可后续扩展。
 */

import {
  HistoricalGeographyBundleSchema,
  type HistoricalConfidence,
  type HistoricalGeographyBundle,
  type HistoricalSource,
  type LocalGeometry,
} from './schema.js';

/** 县行政角色；缺省 `county`。 */
export type CountyRole = 'seat' | 'county' | 'marquisate' | 'frontier';

/** 地形标签全集，与 `TerrainTagSchema` 同构。 */
export type TerrainTag =
  | 'plain'
  | 'hill'
  | 'mountain'
  | 'forest'
  | 'river'
  | 'lake'
  | 'marsh'
  | 'coast';

/** 地标类型全集，与 `BattlefieldLandmarkDefinition.kind` 同构。 */
export type LandmarkKind =
  | 'river'
  | 'lake'
  | 'marsh'
  | 'mountain'
  | 'pass'
  | 'ferry'
  | 'bridge'
  | 'port';

/** 路径类型全集，与 `HistoricalRouteDefinition.kind` 同构。 */
export type RouteKind = 'road' | 'river' | 'pass' | 'ferry';

/** 季节性，缺省视为 `all`。 */
export type RouteSeasonal = 'all' | 'dry' | 'wet';

/**
 * 录入友好型几何形状。与 `LocalGeometrySchema` 同构，但录入端可直接写裸值。
 * - point：单点
 * - polyline：折线（河流），≥2 点
 * - polygon：多边形（山脉/沼泽），≥3 点
 */
export type SeedGeometry = LocalGeometry;

/**
 * 县 seed。录入者必填 id/name/x/y/adjacent；role/terrain/landmarks 可选。
 * `adjacent` 驱动县间邻接关系（用于六格移动判定），需双向对称。
 */
export interface CountySeed {
  id: string;
  name: string;
  role?: CountyRole;
  x: number;
  y: number;
  terrain?: TerrainTag[];
  adjacent: string[];
  /** 关联地标 id 列表（指向同郡 `LandmarkSeed.id`）。 */
  landmarks?: string[];
  /** 置信度覆盖；缺省 `approximate`。 */
  confidence?: HistoricalConfidence;
  /** 定位说明；非 attested 时必填，缺省使用郡级默认说明。 */
  locationNote?: string;
  /** 文献引用覆盖；缺省使用郡级 `sourceRefs`。 */
  sourceRefs?: string[];
  /**
   * 年代有效期起始（缺省 = `scenarioYear`）。与 `validToYear` 构成
   * 「本县仅在该区间内存在的覆写」；越界年份解析时该县被过滤。
   */
  validFromYear?: number;
  /** 年代有效期截止（缺省 = `scenarioYear`）。须满足 `<= validToYear`。 */
  validToYear?: number;
}

/**
 * 地标 seed（实体嵌入）。录入地标名/kind/geometry/tacticalTags 等。
 * 消灭旧颍川模板「seed 只放 id、实体另写」的半自动假象。
 */
export interface LandmarkSeed {
  id: string;
  name: string;
  kind: LandmarkKind;
  geometry: SeedGeometry;
  tacticalTags?: string[];
  confidence?: HistoricalConfidence;
  locationNote?: string;
  sourceRefs?: string[];
  /** 年代有效期起始（缺省 = `scenarioYear`）。 */
  validFromYear?: number;
  /** 年代有效期截止（缺省 = `scenarioYear`）。 */
  validToYear?: number;
}

/**
 * 路径 seed（显式录入）。用于水路/pass/ferry 或需 per-edge 覆盖的陆路。
 *
 * 端点可引用县 id 或地标 id（如南郡 `nanjun_xiangyang_ferry` 是地标作端点）。
 * 与县 `adjacent` 独立：`adjacent` 描述县间邻接关系（六格移动），`RouteSeed`
 * 描述实际路径实体（行军开销/类型）。纯陆路郡可完全不提供 RouteSeed，
 * 构建器从 `adjacent` 自动派生 road 路径（见 `autoRouteFromAdjacent`）。
 */
export interface RouteSeed {
  /** 稳定 id（如 `route_yangtze_wu_zigui`）。 */
  id: string;
  from: string;
  to: string;
  kind?: RouteKind;
  movementCost?: number;
  seasonal?: RouteSeasonal;
  confidence?: HistoricalConfidence;
  sourceRefs?: string[];
  /** 年代有效期起始（缺省 = `scenarioYear`）。 */
  validFromYear?: number;
  /** 年代有效期截止（缺省 = `scenarioYear`）。 */
  validToYear?: number;
}

/**
 * 郡国 seed。聚合县/地标/路径 seed 与郡级元数据。
 */
export interface CommanderySeed {
  /** 郡稳定 id（如 `jing_nanjun_190`）。 */
  id: string;
  /** bundle sliceId；缺省等于 `id`。 */
  sliceId?: string;
  name: string;
  province: string;
  /** 郡治所县 id，必须对应某个 role='seat' 的县 seed。 */
  seatCountyId: string;
  /** 对应行政大地图 cityId（数字）。 */
  worldCityId: number;
  /** 情景年份。 */
  scenarioYear: number;
  /**
   * 郡国本身的有效期起始（缺省 = `scenarioYear`）。用于「某郡在某年析置/裁撤」，
   * 如建安末分南郡立襄阳郡。越界年份解析时整个郡被过滤。
   */
  validFromYear?: number;
  /** 郡国有效期截止（缺省 = `scenarioYear`）。 */
  validToYear?: number;
  /** 模板版本，缺省 1。 */
  templateVersion?: number;
  /** 本地坐标系包围盒，缺省 {0,0,1,1}。 */
  localBounds?: { minX: number; minY: number; maxX: number; maxY: number };
  /** 郡级默认文献引用（县/地标/路径缺省时回退到此）。 */
  sourceRefs: string[];
  counties: CountySeed[];
  landmarks?: LandmarkSeed[];
  /** 显式路径；缺省时从县邻接自动派生 road。 */
  routes?: RouteSeed[];
  /**
   * 当提供 `routes` 时，是否仍从县邻接自动派生缺失的 road 路径。
   * - true（缺省）：先取显式 routes，再为每对邻接县补一条 road（若该边未被显式覆盖）。
   * - false：只用显式 routes，不自动补全（南郡式：水路为主，陆路显式录入）。
   */
  autoFillRoads?: boolean;
  /** 县级默认 locationNote（非 attested 县缺省时回退到此）。 */
  defaultCountyLocationNote?: string;
  /** 路径默认 locationNote 占位（路径 schema 无 locationNote 字段，预留）。 */
}

/** 构建器选项。 */
export interface BuildBundleOptions {
  /**
   * 校验模式：
   * - 'throw'（缺省）：构建后跑 Zod 校验，失败抛错（带 issue path）。
   * - 'safe'：构建后跑 Zod 校验，返回 { bundle, result }。
   */
  validation?: 'throw' | 'safe';
}

/**
 * 解析 seed 条目的年代有效期，缺省回退 `scenarioYear`。
 * 返回 [validFromYear, validToYear]，保证 `validFromYear <= validToYear`
 * （Zod `hasValidPeriod` 若被违反会在最终校验阶段拦截）。
 */
function resolveValidPeriod(
  seed: { validFromYear?: number; validToYear?: number },
  scenarioYear: number,
): [number, number] {
  return [seed.validFromYear ?? scenarioYear, seed.validToYear ?? scenarioYear];
}

/** 构建结果（safe 模式）。 */
export interface BuildBundleResult {
  bundle: HistoricalGeographyBundle;
  /** Zod 校验结果；success=true 时 issues 为 undefined。 */
  issues?: Array<{ path: Array<string | number>; message: string }>;
}

function normalizeGeometry(geometry: SeedGeometry): LocalGeometry {
  if (geometry.type === 'point') {
    return { type: 'point', x: geometry.x, y: geometry.y };
  }
  return { type: geometry.type, points: geometry.points.map(([x, y]) => [x, y] as [number, number]) };
}

/**
 * 从县邻接自动派生 road 路径。用字典序去重得到无向边，要求 adjacent 双向对称。
 * 自动派生 road 的有效期取两端县有效期的交集，避免越界年份产生悬空端点。
 * 与旧颍川模板的 routePairs 逻辑等价。
 */
function autoRouteFromAdjacent(
  counties: CountySeed[],
  commanderyId: string,
  defaultSourceRefs: string[],
  scenarioYear: number,
): Array<{
  id: string;
  commanderyId: string;
  fromNodeId: string;
  toNodeId: string;
  kind: 'road';
  movementCost: number;
  seasonal: 'all';
  validFromYear: number;
  validToYear: number;
  confidence: 'inferred';
  sourceRefs: string[];
}> {
  const pairs: Array<[string, string]> = [];
  for (const seed of counties) {
    for (const peer of seed.adjacent) {
      if (seed.id < peer) {
        pairs.push([seed.id, peer]);
      }
    }
  }
  const periodByCounty = new Map<string, [number, number]>();
  for (const county of counties) {
    periodByCounty.set(county.id, resolveValidPeriod(county, scenarioYear));
  }
  return pairs.map(([from, to]) => {
    const fromPeriod = periodByCounty.get(from) ?? [scenarioYear, scenarioYear];
    const toPeriod = periodByCounty.get(to) ?? [scenarioYear, scenarioYear];
    const validFromYear = Math.max(fromPeriod[0], toPeriod[0]);
    const validToYear = Math.min(fromPeriod[1], toPeriod[1]);
    return {
      id: `road_${from}__${to}`,
      commanderyId,
      fromNodeId: from,
      toNodeId: to,
      kind: 'road' as const,
      movementCost: 1,
      seasonal: 'all' as const,
      validFromYear,
      validToYear,
      confidence: 'inferred' as const,
      sourceRefs: [...defaultSourceRefs],
    };
  });
}

/**
 * 从 `CommanderySeed` 构建 `HistoricalGeographyBundle` 并自校验。
 *
 * 纯函数：无 IO、无 RNG。补全 schema 强制字段后调用 Zod 校验。
 * @throws 当 validation='throw'（缺省）且 Zod 校验失败时，抛出带 issue path 的 Error。
 */
export function buildHistoricalGeographyBundle(
  seed: CommanderySeed,
  sources: HistoricalSource[],
  options: BuildBundleOptions = {},
): HistoricalGeographyBundle {
  const result = buildHistoricalGeographyBundleSafe(seed, sources);
  if (result.issues && result.issues.length > 0) {
    if (options.validation === 'safe') {
      // safe 模式下调用方自行处理；此处仍返回 bundle（类型层已构造）。
      return result.bundle;
    }
    const lines = result.issues.map(
      (issue) => `  - [${issue.path.join('.')}] ${issue.message}`,
    );
    throw new Error(
      `buildHistoricalGeographyBundle: bundle for "${seed.id}" failed Zod validation:\n${lines.join('\n')}`,
    );
  }
  return result.bundle;
}

/**
 * safe 版本构建器：返回 bundle 与校验 issues（若有）。
 */
export function buildHistoricalGeographyBundleSafe(
  seed: CommanderySeed,
  sources: HistoricalSource[],
): BuildBundleResult {
  const commanderyId = seed.id;
  const sliceId = seed.sliceId ?? seed.id;
  const scenarioYear = seed.scenarioYear;
  const defaultSourceRefs = seed.sourceRefs;
  const defaultCountyLocationNote =
    seed.defaultCountyLocationNote ??
    '县名与隶属有原典明文；坐标仅为郡域战场的人工相对布局。';

  const counties = seed.counties.map((countySeed) => {
    const confidence = countySeed.confidence ?? 'approximate';
    const locationNote =
      countySeed.locationNote ??
      (confidence === 'attested' ? undefined : defaultCountyLocationNote);
    return {
      id: countySeed.id,
      name: countySeed.name,
      commanderyId,
      role: countySeed.role ?? ('county' as const),
      validFromYear: resolveValidPeriod(countySeed, scenarioYear)[0],
      validToYear: resolveValidPeriod(countySeed, scenarioYear)[1],
      localX: countySeed.x,
      localY: countySeed.y,
      confidence,
      ...(locationNote !== undefined ? { locationNote } : {}),
      terrainTags: countySeed.terrain ?? (['plain'] as TerrainTag[]),
      adjacentCountyIds: countySeed.adjacent,
      landmarkIds: countySeed.landmarks ?? [],
      sourceRefs: countySeed.sourceRefs ?? [...defaultSourceRefs],
    };
  });

  const landmarks = (seed.landmarks ?? []).map((landmarkSeed) => {
    const confidence = landmarkSeed.confidence ?? 'approximate';
    const locationNote =
      landmarkSeed.locationNote ??
      (confidence === 'attested' ? undefined : '原典可证地名；几何仅为郡域相对示意。');
    return {
      id: landmarkSeed.id,
      commanderyId,
      name: landmarkSeed.name,
      kind: landmarkSeed.kind,
      validFromYear: resolveValidPeriod(landmarkSeed, scenarioYear)[0],
      validToYear: resolveValidPeriod(landmarkSeed, scenarioYear)[1],
      localGeometry: normalizeGeometry(landmarkSeed.geometry),
      tacticalTags: landmarkSeed.tacticalTags ?? [],
      confidence,
      ...(locationNote !== undefined ? { locationNote } : {}),
      sourceRefs: landmarkSeed.sourceRefs ?? [...defaultSourceRefs],
    };
  });

  // 路径：显式 routes 优先；按 autoFillRoads 决定是否补全。
  const autoFillRoads = seed.autoFillRoads ?? true;
  const explicitRoutes = (seed.routes ?? []).map((routeSeed) => ({
    id: routeSeed.id,
    commanderyId,
    fromNodeId: routeSeed.from,
    toNodeId: routeSeed.to,
    kind: routeSeed.kind ?? ('road' as const),
    movementCost: routeSeed.movementCost ?? 1,
    ...(routeSeed.seasonal ? { seasonal: routeSeed.seasonal } : {}),
    validFromYear: resolveValidPeriod(routeSeed, scenarioYear)[0],
    validToYear: resolveValidPeriod(routeSeed, scenarioYear)[1],
    confidence: routeSeed.confidence ?? ('inferred' as const),
    sourceRefs: routeSeed.sourceRefs ?? [...defaultSourceRefs],
  }));

  let routes = explicitRoutes;
  if (autoFillRoads) {
    // 为每对邻接县补一条 road，若该边未被显式覆盖。
    const coveredEdges = new Set<string>();
    const edgeKey = (a: string, b: string): string => (a < b ? `${a}__${b}` : `${b}__${a}`);
    for (const route of explicitRoutes) {
      coveredEdges.add(edgeKey(route.fromNodeId, route.toNodeId));
    }
    const auto = autoRouteFromAdjacent(
      seed.counties,
      commanderyId,
      defaultSourceRefs,
      scenarioYear,
    ).filter((route) => !coveredEdges.has(edgeKey(route.fromNodeId, route.toNodeId)));
    routes = [...explicitRoutes, ...auto];
  }

  const bundle: HistoricalGeographyBundle = {
    sliceId,
    scenarioYear,
    sources,
    commanderies: [
      {
        id: commanderyId,
        templateVersion: seed.templateVersion ?? 1,
        name: seed.name,
        province: seed.province,
        seatCountyId: seed.seatCountyId,
        worldCityId: seed.worldCityId,
        validFromYear: resolveValidPeriod(seed, scenarioYear)[0],
        validToYear: resolveValidPeriod(seed, scenarioYear)[1],
        countyIds: seed.counties.map((countySeed) => countySeed.id),
        localBounds: seed.localBounds ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        sourceRefs: [...defaultSourceRefs],
      },
    ],
    counties,
    routes,
    landmarks,
  };

  const parseResult = HistoricalGeographyBundleSchema.safeParse(bundle);
  if (parseResult.success) {
    return { bundle: parseResult.data };
  }
  return {
    bundle,
    issues: parseResult.error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    })),
  };
}
