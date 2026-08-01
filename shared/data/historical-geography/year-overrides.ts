// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * BF-P5 年代覆写解析（docs/21 Q4 方案 B：「基线模板 + 建安改置覆写」）。
 *
 * 单个 `HistoricalGeographyBundle` 内含多年代条目：县/地标/路径/郡国定义各自带
 * `validFromYear`/`validToYear`（seed 层缺省 = scenarioYear，见 seed-schema.ts）。
 * `resolveBundleForYear` 纯函数按请求年份过滤出该年有效子集，并重新跑 Zod 校验，
 * 保证过滤后的 bundle 仍是引用一致、可通过 schema 的合法模板。
 *
 * 语义要点：
 * - 县/地标/路径按自身有效期过滤；无效条目在该年不参与。
 * - 存活县的 `adjacentCountyIds`/`landmarkIds` 中，指向「存在于此 bundle 但在该年
 *   已过期」的县/地标引用会被剔除（裁撤后不可能仍相邻/关联）；指向 bundle 内
 *   根本不存在 id 的引用**不剔除**，交由 Zod 拦截（防手误静默吞掉）。
 * - `seatCountyId` 对应县在该年已过期 → 抛错（郡治不存在）。
 * - 路径端点已过期：路径自身有效期通常已随构建器交集而同步；若手写路径声明全时段
 *   而端点限时，Zod 校验会拦截（数据须声明一致的逐年代集合）。
 *
 * 严格性：请求年份无有效郡国定义、或过滤后引用断裂时**抛错**，不做静默回退
 * （BF-P5「无静默抽象回退」原则）。
 */

import {
  HistoricalGeographyBundleSchema,
  type CommanderyDefinition,
  type HistoricalGeographyBundle,
} from './schema.js';

/** 实体是否在请求年份内有效（两端缺失视为该条目无年代约束，恒有效）。 */
function isValidInYear(
  entity: { validFromYear?: number; validToYear?: number },
  year: number,
): boolean {
  const from = entity.validFromYear;
  const to = entity.validToYear;
  if (from === undefined && to === undefined) {
    return true;
  }
  const lower = from ?? Number.NEGATIVE_INFINITY;
  const upper = to ?? Number.POSITIVE_INFINITY;
  return year >= lower && year <= upper;
}

/** 过滤出请求年份有效的郡国定义；无有效郡国则抛错。 */
function filterCommanderies(
  commanderies: CommanderyDefinition[],
  year: number,
): CommanderyDefinition[] {
  const active = commanderies.filter((commandery) => isValidInYear(commandery, year));
  if (active.length === 0) {
    const id = commanderies[0]?.id ?? '(unknown)';
    throw new Error(
      `resolveBundleForYear: commandery "${id}" has no valid template for year ${year}`,
    );
  }
  return active;
}

/**
 * 剔除 list 中「存在但该年已过期」的 id；不存在于 knownIds 的 id 原样保留，
 * 由 Zod 后续拦截（避免手误被静默吞掉）。
 */
function pruneExpiredRefs(
  list: string[],
  knownIds: Set<string>,
  activeIds: Set<string>,
): string[] {
  return list.filter((id) => !(knownIds.has(id) && !activeIds.has(id)));
}

/**
 * 按请求年份过滤 bundle 至该年有效子集并重新校验。
 *
 * 纯函数：无 IO、无 RNG；对同一输入多次调用结果 deep-equal，且不改动入参。
 * @throws 当年份无有效郡国定义、或过滤后引用断裂（Zod 校验失败，如 seat 县缺失、
 *         端点/邻接悬空）时抛错，不做静默回退。
 */
export function resolveBundleForYear(
  bundle: HistoricalGeographyBundle,
  year: number,
): HistoricalGeographyBundle {
  const commanderies = filterCommanderies(bundle.commanderies, year);
  const counties = bundle.counties.filter((county) => isValidInYear(county, year));
  const routes = bundle.routes.filter((route) => isValidInYear(route, year));
  const landmarks = bundle.landmarks.filter((landmark) => isValidInYear(landmark, year));

  const allCountyIds = new Set(bundle.counties.map(({ id }) => id));
  const allLandmarkIds = new Set(bundle.landmarks.map(({ id }) => id));
  const activeCountyIds = new Set(counties.map(({ id }) => id));
  const activeLandmarkIds = new Set(landmarks.map(({ id }) => id));

  const prunedCounties = counties.map((county) => ({
    ...county,
    adjacentCountyIds: pruneExpiredRefs(
      county.adjacentCountyIds,
      allCountyIds,
      activeCountyIds,
    ),
    landmarkIds: pruneExpiredRefs(county.landmarkIds, allLandmarkIds, activeLandmarkIds),
  }));

  const prunedCommanderies = commanderies.map((commandery) => {
    if (!activeCountyIds.has(commandery.seatCountyId)) {
      throw new Error(
        `resolveBundleForYear: seat county "${commandery.seatCountyId}" of "${commandery.id}" ` +
          `is not valid in year ${year}`,
      );
    }
    return {
      ...commandery,
      countyIds: pruneExpiredRefs(commandery.countyIds, allCountyIds, activeCountyIds),
    };
  });

  const active: HistoricalGeographyBundle = {
    ...bundle,
    commanderies: prunedCommanderies,
    counties: prunedCounties,
    routes,
    landmarks,
  };

  const result = HistoricalGeographyBundleSchema.safeParse(active);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - [${issue.path.join('.')}] ${issue.message}`)
      .join('\n');
    throw new Error(
      `resolveBundleForYear: filtered bundle for "${bundle.sliceId}" in year ${year} ` +
        `fails Zod validation (data must declare consistent per-year sets):\n${issues}`,
    );
  }
  return result.data;
}
