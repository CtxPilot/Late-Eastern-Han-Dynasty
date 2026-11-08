// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-09 百城地缘战略卡片与宏观沙盘联动深化 (Session 485)
 *
 * 纯只读派生层：从 GameState（城池、官道、关隘、异族、商路）聚合地缘战略画像，
 * 不新增存档字段、不修改状态、不消费 RNG。
 *
 * 设计要点（docs/62-geo-strategy-cards-proposal.md）：
 * 1. 106 郡国逐城地缘画像（战略层级、临敌态势、地缘标签、战略评分）；
 * 2. 关隘防御联动（关隘归属、守备、险阻加成、所扼官道与敌关封锁）；
 * 3. 异族边患与商路联动（关联州部张力、活跃/封锁商路数）；
 * 4. 州部与天下两级宏观聚合，供世界屏战略卡片与右侧地缘分面消费。
 */

import { CityTier } from './enums/index.js';
import type { GameState } from './types/game.js';
import type { City } from './types/city.js';
import type { PassEntity } from './types/pass.js';
import { DEFAULT_PASSES, calculatePassDefenseModifier } from './pass.js';
import { roadNeighbors } from './city-roads.js';
import { DEFAULT_MINORITY_TRIBES, getTribeThreatLevel } from './minority.js';
import { TribeThreatLevel } from './types/minority.js';
import type { TradeRoute } from './trade.js';

/** 城池在地缘沙盘上的战略层级。 */
export type GeoStrategicTier =
  | 'capital'
  | 'chokepoint'
  | 'hub'
  | 'frontier'
  | 'heartland'
  | 'remote';

/** 城池临敌态势。 */
export type GeoExposure = 'safe' | 'watch' | 'frontline';

/** 关隘相对玩家势力的控制状态。 */
export type PassControl = 'friendly' | 'hostile' | 'neutral' | 'empty';

/** 关隘与城池的联动画像。 */
export interface GeoPassLink {
  passId: number;
  name: string;
  province: string;
  factionId: number;
  factionName: string | null;
  control: PassControl;
  controlLabel: string;
  troops: number;
  morale: number;
  wall: number;
  maxWall: number;
  /** 关防耐久百分比 0~100。 */
  wallPct: number;
  /** 守军防御加成百分比（雄关 50 / 普通关隘 30 / 破关 0）。 */
  defenseBonusPct: number;
  /** 山地关隘对骑兵攻坚的削弱百分比（40 / 0）。 */
  cavalryPenaltyPct: number;
  isFortressPass: boolean;
  isMountainPass: boolean;
  isRiverPass: boolean;
  commanderName: string | null;
}

/** 被敌控关隘封锁的城际官道。 */
export interface GeoBlockedRoute {
  passId: number;
  passName: string;
  fromCityId: number;
  toCityId: number;
  fromName: string;
  toName: string;
}

/** 关联州部的异族边患画像。 */
export interface GeoTribalThreat {
  tribeId: string;
  name: string;
  regionName: string;
  tension: number;
  threatLevel: TribeThreatLevel;
  threatLabel: string;
}

/** 单城地缘战略画像。 */
export interface CityGeoProfile {
  cityId: number;
  name: string;
  province: string;
  terrain: string;
  terrainLabel: string;
  tier: GeoStrategicTier;
  tierLabel: string;
  exposure: GeoExposure;
  exposureLabel: string;
  /** 0~100 战略评分（确定性派生）。 */
  score: number;
  tags: string[];
  neighborCityIds: number[];
  neighborNames: string[];
  friendlyNeighborCount: number;
  hostileNeighborCount: number;
  neutralNeighborCount: number;
  linkedPasses: GeoPassLink[];
  hostileLinkedPassCount: number;
  blockedRoutes: GeoBlockedRoute[];
  tribalThreats: GeoTribalThreat[];
  activeTradeRouteCount: number;
  blockadedTradeRouteCount: number;
  specialties: string[];
}

/** 州部地缘聚合。 */
export interface ProvinceGeoSummary {
  province: string;
  cityCount: number;
  averageScore: number;
  strategicNodes: CityGeoProfile[];
  passCount: number;
  hostilePassCount: number;
  blockedRouteCount: number;
  frontlineCityCount: number;
  tierCounts: Record<GeoStrategicTier, number>;
  tribalThreats: GeoTribalThreat[];
  /** 州内最高战略层级；无城池时为 null。 */
  topTier: GeoStrategicTier | null;
}

/** 天下关隘总体态势。 */
export interface GeoPassStats {
  total: number;
  friendly: number;
  hostile: number;
  neutral: number;
  empty: number;
  fortress: number;
  mountain: number;
  river: number;
  wallDamaged: number;
}

/** 天下地缘总览（世界屏「天下形势」消费）。 */
export interface RealmGeoOverview {
  totalCityCount: number;
  provinces: ProvinceGeoSummary[];
  /** 按战略评分降序的天下战略节点（全量）。 */
  strategicNodes: CityGeoProfile[];
  passStats: GeoPassStats;
  blockedRoutes: GeoBlockedRoute[];
  frontlineCityCount: number;
  watchCityCount: number;
  safeCityCount: number;
  tribalThreats: GeoTribalThreat[];
}

/** 地缘评分权重（docs/04 §六-A）。 */
export const GEO_SCORE_WEIGHTS = {
  capital: 20,
  chokepoint: 10,
  hub: 8,
  frontier: 6,
  heartland: 2,
  remote: 0,
  perNeighbor: 2,
  perFriendlyNeighbor: 1,
  perHostileNeighbor: 6,
  perLinkedPass: 8,
  perHostilePass: 5,
  perFortressPass: 4,
  perActiveTradeRoute: 3,
  perSpecialty: 2,
  tierProvinceOrAbove: 6,
  tierCommandery: 3,
  tribalUnsettled: 4,
  tribalRaiding: 8,
  tribalInvasion: 12,
  maxScore: 100,
} as const;

const TIER_ORDER: readonly GeoStrategicTier[] = [
  'capital',
  'chokepoint',
  'hub',
  'frontier',
  'heartland',
  'remote',
] as const;

const TIER_LABELS: Record<GeoStrategicTier, string> = {
  capital: '京畿重镇',
  chokepoint: '锁钥要冲',
  hub: '通衢枢纽',
  frontier: '边陲前线',
  heartland: '腹地安稳',
  remote: '偏远僻壤',
};

const EXPOSURE_LABELS: Record<GeoExposure, string> = {
  safe: '安宁',
  watch: '警讯',
  frontline: '临敌',
};

const PASS_CONTROL_LABELS: Record<PassControl, string> = {
  friendly: '己方掌控',
  hostile: '敌控锁关',
  neutral: '中立',
  empty: '空关',
};

const TERRAIN_LABELS: Record<string, string> = {
  plain: '平原',
  forest: '林薮',
  mountain: '山地',
  water: '川泽',
  wall: '关垣',
  city: '城郭',
  swamp: '泽薮',
};

const TRIBE_THREAT_LABELS: Record<TribeThreatLevel, string> = {
  [TribeThreatLevel.PACIFIED]: '顺服',
  [TribeThreatLevel.UNSETTLED]: '骚动',
  [TribeThreatLevel.RAIDING]: '劫掠',
  [TribeThreatLevel.INVASION]: '入侵',
};

export function getPassControlLabel(control: PassControl): string {
  return PASS_CONTROL_LABELS[control];
}

export function getTribeThreatLabel(level: TribeThreatLevel): string {
  return TRIBE_THREAT_LABELS[level];
}

export function getGeoTierLabel(tier: GeoStrategicTier): string {
  return TIER_LABELS[tier];
}

/** 解析当前局关隘字典；旧档缺省时回落到 25 座名关静态基准表。 */
export function resolveGamePasses(game: GameState): Record<number, PassEntity> {
  if (game.passes && Object.keys(game.passes).length > 0) {
    return game.passes;
  }
  const fallback: Record<number, PassEntity> = {};
  for (const pass of DEFAULT_PASSES) {
    fallback[pass.id] = pass;
  }
  return fallback;
}

/** 判定关隘相对玩家势力的控制状态（空关优先于归属）。 */
export function getPassControl(pass: PassEntity, playerFactionId: number): PassControl {
  if (pass.troops <= 0) return 'empty';
  if (pass.factionId === playerFactionId) return 'friendly';
  if (pass.factionId <= 0) return 'neutral';
  return 'hostile';
}

function cityName(game: GameState, cityId: number): string | null {
  return game.cities[cityId]?.name ?? null;
}

function resolveTradeRoutes(game: GameState): TradeRoute[] {
  return game.tradeRoutes ?? [];
}

function collectTribalThreats(game: GameState, province: string): GeoTribalThreat[] {
  const tribes = Object.values(game.minorityTribes ?? DEFAULT_MINORITY_TRIBES);
  return tribes
    .filter((tribe) => tribe.relatedProvinces.includes(province))
    .map((tribe) => {
      const threatLevel = getTribeThreatLevel(tribe.tension);
      return {
        tribeId: tribe.id,
        name: tribe.name,
        regionName: tribe.regionName,
        tension: Math.max(0, Math.min(100, Math.round(tribe.tension))),
        threatLevel,
        threatLabel: getTribeThreatLabel(threatLevel),
      };
    })
    .sort((a, b) => b.tension - a.tension || a.tribeId.localeCompare(b.tribeId));
}

function buildPassLink(game: GameState, pass: PassEntity): GeoPassLink {
  const control = getPassControl(pass, game.playerFactionId);
  const defense = calculatePassDefenseModifier(pass, false);
  const cavalry = calculatePassDefenseModifier(pass, true);
  return {
    passId: pass.id,
    name: pass.name,
    province: pass.province,
    factionId: pass.factionId,
    factionName: pass.factionId > 0 ? (game.factions[pass.factionId]?.name ?? null) : null,
    control,
    controlLabel: getPassControlLabel(control),
    troops: pass.troops,
    morale: pass.morale,
    wall: pass.wall,
    maxWall: pass.maxWall,
    wallPct: pass.maxWall > 0 ? Math.max(0, Math.min(100, Math.round((pass.wall / pass.maxWall) * 100))) : 0,
    defenseBonusPct: Math.round(defense.defBonus * 100),
    cavalryPenaltyPct: Math.round(cavalry.attackerPenalty * 100),
    isFortressPass: pass.isFortressPass,
    isMountainPass: pass.isMountainPass,
    isRiverPass: pass.isRiverPass,
    commanderName:
      pass.commanderId != null ? (game.officers[pass.commanderId]?.name ?? null) : null,
  };
}

function isPassLinkedToCity(pass: PassEntity, cityId: number): boolean {
  return (
    pass.providesIntel.includes(cityId) ||
    pass.blocksRoutes.some(([a, b]) => a === cityId || b === cityId)
  );
}

function collectBlockedRoutesForCity(
  game: GameState,
  cityId: number,
  passes: Record<number, PassEntity>,
): GeoBlockedRoute[] {
  const blocked: GeoBlockedRoute[] = [];
  const seen = new Set<string>();
  for (const pass of Object.values(passes)) {
    if (getPassControl(pass, game.playerFactionId) !== 'hostile') continue;
    for (const [a, b] of pass.blocksRoutes) {
      if (a !== cityId && b !== cityId) continue;
      const other = a === cityId ? b : a;
      const fromName = cityName(game, cityId);
      const toName = cityName(game, other);
      if (!fromName || !toName) continue;
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      blocked.push({
        passId: pass.id,
        passName: pass.name,
        fromCityId: cityId,
        toCityId: other,
        fromName,
        toName,
      });
    }
  }
  return blocked.sort(
    (a, b) => a.passId - b.passId || a.toCityId - b.toCityId || a.fromCityId - b.fromCityId,
  );
}

function collectBlockedRoutesForPasses(
  game: GameState,
  passes: Record<number, PassEntity>,
): GeoBlockedRoute[] {
  const blocked: GeoBlockedRoute[] = [];
  const seen = new Set<string>();
  for (const pass of Object.values(passes)) {
    if (getPassControl(pass, game.playerFactionId) !== 'hostile') continue;
    for (const [a, b] of pass.blocksRoutes) {
      const fromName = cityName(game, a);
      const toName = cityName(game, b);
      if (!fromName || !toName) continue;
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      blocked.push({
        passId: pass.id,
        passName: pass.name,
        fromCityId: a,
        toCityId: b,
        fromName,
        toName,
      });
    }
  }
  return blocked.sort(
    (a, b) => a.passId - b.passId || a.fromCityId - b.fromCityId || a.toCityId - b.toCityId,
  );
}

function resolveTier(
  city: City,
  neighborCount: number,
  friendlyNeighborCount: number,
  hostileNeighborCount: number,
  linkedPasses: GeoPassLink[],
): GeoStrategicTier {
  if (city.isCapital) return 'capital';
  if (city.isPass || linkedPasses.some((pass) => pass.isFortressPass)) return 'chokepoint';
  if (neighborCount >= 5 || linkedPasses.length >= 2) return 'hub';
  if (hostileNeighborCount > 0) return 'frontier';
  if (neighborCount > 0 && friendlyNeighborCount === neighborCount) return 'heartland';
  return 'remote';
}

function resolveExposure(
  hostileNeighborCount: number,
  hostileLinkedPassCount: number,
  tribalThreats: GeoTribalThreat[],
): GeoExposure {
  if (hostileNeighborCount > 0) return 'frontline';
  const raidingThreat = tribalThreats.some(
    (threat) => threat.threatLevel >= TribeThreatLevel.RAIDING,
  );
  if (hostileLinkedPassCount > 0 || raidingThreat) return 'watch';
  return 'safe';
}

function buildTags(
  city: City,
  tier: GeoStrategicTier,
  exposure: GeoExposure,
  linkedPasses: GeoPassLink[],
  blockedRoutes: GeoBlockedRoute[],
  tribalThreats: GeoTribalThreat[],
  activeTradeRouteCount: number,
  specialties: string[],
): string[] {
  const tags: string[] = [TIER_LABELS[tier]];
  if (city.isPass) tags.push('城池要隘');
  if (exposure === 'frontline') tags.push('接壤敌境');
  else if (exposure === 'watch') tags.push('警讯频传');
  if (blockedRoutes.length > 0) tags.push(`敌关锁道${blockedRoutes.length}`);
  if (linkedPasses.some((pass) => pass.control === 'hostile')) tags.push('敌踞关隘');
  if (linkedPasses.some((pass) => pass.isFortressPass)) tags.push('雄关拱卫');
  const worstThreat = tribalThreats[0];
  if (worstThreat && worstThreat.threatLevel >= TribeThreatLevel.RAIDING) {
    tags.push(`${worstThreat.name}${worstThreat.threatLabel}`);
  }
  if (activeTradeRouteCount > 0) tags.push(`商路${activeTradeRouteCount}`);
  if (specialties.length > 0) tags.push(`特产${specialties[0]}`);
  return tags;
}

function computeScore(
  city: City,
  tier: GeoStrategicTier,
  neighborCount: number,
  friendlyNeighborCount: number,
  hostileNeighborCount: number,
  linkedPasses: GeoPassLink[],
  hostileLinkedPassCount: number,
  activeTradeRouteCount: number,
  specialties: string[],
  tribalThreats: GeoTribalThreat[],
): number {
  let score = GEO_SCORE_WEIGHTS[tier];
  score += neighborCount * GEO_SCORE_WEIGHTS.perNeighbor;
  score += friendlyNeighborCount * GEO_SCORE_WEIGHTS.perFriendlyNeighbor;
  score += hostileNeighborCount * GEO_SCORE_WEIGHTS.perHostileNeighbor;
  score += linkedPasses.length * GEO_SCORE_WEIGHTS.perLinkedPass;
  score += hostileLinkedPassCount * GEO_SCORE_WEIGHTS.perHostilePass;
  score +=
    linkedPasses.filter((pass) => pass.isFortressPass).length *
    GEO_SCORE_WEIGHTS.perFortressPass;
  score += activeTradeRouteCount * GEO_SCORE_WEIGHTS.perActiveTradeRoute;
  score += specialties.length * GEO_SCORE_WEIGHTS.perSpecialty;
  if (city.tier != null) {
    if (city.tier >= CityTier.PROVINCE) score += GEO_SCORE_WEIGHTS.tierProvinceOrAbove;
    else if (city.tier === CityTier.COMMANDERY) score += GEO_SCORE_WEIGHTS.tierCommandery;
  }
  const worstThreat = tribalThreats[0];
  if (worstThreat) {
    if (worstThreat.threatLevel === TribeThreatLevel.INVASION) {
      score += GEO_SCORE_WEIGHTS.tribalInvasion;
    } else if (worstThreat.threatLevel === TribeThreatLevel.RAIDING) {
      score += GEO_SCORE_WEIGHTS.tribalRaiding;
    } else if (worstThreat.threatLevel === TribeThreatLevel.UNSETTLED) {
      score += GEO_SCORE_WEIGHTS.tribalUnsettled;
    }
  }
  return Math.max(0, Math.min(GEO_SCORE_WEIGHTS.maxScore, Math.round(score)));
}

/** 计算单城地缘战略画像；城池不存在时返回 null。 */
export function evaluateCityGeopolitics(
  game: GameState,
  cityId: number,
): CityGeoProfile | null {
  const city = game.cities[cityId];
  if (!city) return null;

  const passes = resolveGamePasses(game);
  const neighborCityIds = roadNeighbors(cityId).filter((id) => game.cities[id] != null);
  const neighborNames = neighborCityIds
    .map((id) => game.cities[id]?.name)
    .filter((name): name is string => Boolean(name));
  let friendlyNeighborCount = 0;
  let hostileNeighborCount = 0;
  for (const id of neighborCityIds) {
    const neighbor = game.cities[id];
    if (!neighbor) continue;
    if (neighbor.ruler == null) continue;
    if (neighbor.ruler === game.playerFactionId) friendlyNeighborCount += 1;
    else hostileNeighborCount += 1;
  }
  const neutralNeighborCount = Math.max(
    0,
    neighborCityIds.length - friendlyNeighborCount - hostileNeighborCount,
  );

  const linkedPasses = Object.values(passes)
    .filter((pass) => isPassLinkedToCity(pass, cityId))
    .map((pass) => buildPassLink(game, pass))
    .sort((a, b) => a.passId - b.passId);
  const hostileLinkedPassCount = linkedPasses.filter(
    (pass) => pass.control === 'hostile',
  ).length;

  const blockedRoutes = collectBlockedRoutesForCity(game, cityId, passes);

  const tribalThreats = collectTribalThreats(game, city.province);

  let activeTradeRouteCount = 0;
  let blockadedTradeRouteCount = 0;
  for (const route of resolveTradeRoutes(game)) {
    if (route.fromCityId !== cityId && route.toCityId !== cityId) continue;
    if (route.status === 'active') activeTradeRouteCount += 1;
    else if (route.status === 'blockaded') blockadedTradeRouteCount += 1;
  }

  const specialties = city.specialties ?? [];
  const tier = resolveTier(
    city,
    neighborCityIds.length,
    friendlyNeighborCount,
    hostileNeighborCount,
    linkedPasses,
  );
  const exposure = resolveExposure(
    hostileNeighborCount,
    hostileLinkedPassCount,
    tribalThreats,
  );
  const score = computeScore(
    city,
    tier,
    neighborCityIds.length,
    friendlyNeighborCount,
    hostileNeighborCount,
    linkedPasses,
    hostileLinkedPassCount,
    activeTradeRouteCount,
    specialties,
    tribalThreats,
  );

  return {
    cityId,
    name: city.name,
    province: city.province,
    terrain: city.terrain ?? 'plain',
    terrainLabel: TERRAIN_LABELS[city.terrain] ?? '未详',
    tier,
    tierLabel: TIER_LABELS[tier],
    exposure,
    exposureLabel: EXPOSURE_LABELS[exposure],
    score,
    tags: buildTags(
      city,
      tier,
      exposure,
      linkedPasses,
      blockedRoutes,
      tribalThreats,
      activeTradeRouteCount,
      specialties,
    ),
    neighborCityIds,
    neighborNames,
    friendlyNeighborCount,
    hostileNeighborCount,
    neutralNeighborCount,
    linkedPasses,
    hostileLinkedPassCount,
    blockedRoutes,
    tribalThreats,
    activeTradeRouteCount,
    blockadedTradeRouteCount,
    specialties,
  };
}

function sortProfiles(profiles: CityGeoProfile[]): CityGeoProfile[] {
  return [...profiles].sort(
    (a, b) => b.score - a.score || TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.cityId - b.cityId,
  );
}

function buildProvinceSummary(
  game: GameState,
  province: string,
  profiles: CityGeoProfile[],
  passes: Record<number, PassEntity>,
): ProvinceGeoSummary {
  const provinceProfiles = profiles.filter((profile) => profile.province === province);
  const provincePasses = Object.values(passes).filter((pass) => pass.province === province);
  const tierCounts: Record<GeoStrategicTier, number> = {
    capital: 0,
    chokepoint: 0,
    hub: 0,
    frontier: 0,
    heartland: 0,
    remote: 0,
  };
  for (const profile of provinceProfiles) {
    tierCounts[profile.tier] += 1;
  }
  const topTier =
    TIER_ORDER.find((tier) => tierCounts[tier] > 0) ?? null;
  const blockedRoutes = collectBlockedRoutesForPasses(game, passes).filter((route) => {
    const fromProvince = game.cities[route.fromCityId]?.province;
    const toProvince = game.cities[route.toCityId]?.province;
    return fromProvince === province || toProvince === province;
  });
  return {
    province,
    cityCount: provinceProfiles.length,
    averageScore:
      provinceProfiles.length > 0
        ? Math.round(
            provinceProfiles.reduce((sum, profile) => sum + profile.score, 0) /
              provinceProfiles.length,
          )
        : 0,
    strategicNodes: sortProfiles(provinceProfiles),
    passCount: provincePasses.length,
    hostilePassCount: provincePasses.filter(
      (pass) => getPassControl(pass, game.playerFactionId) === 'hostile',
    ).length,
    blockedRouteCount: blockedRoutes.length,
    frontlineCityCount: provinceProfiles.filter((profile) => profile.exposure === 'frontline')
      .length,
    tierCounts,
    tribalThreats: collectTribalThreats(game, province),
    topTier,
  };
}

/** 计算州部地缘聚合；无城池时返回 null。 */
export function buildProvinceGeoSummary(
  game: GameState,
  province: string,
): ProvinceGeoSummary | null {
  const profiles = Object.keys(game.cities)
    .map((id) => evaluateCityGeopolitics(game, Number(id)))
    .filter((profile): profile is CityGeoProfile => profile != null);
  if (!profiles.some((profile) => profile.province === province)) return null;
  return buildProvinceSummary(game, province, profiles, resolveGamePasses(game));
}

/** 计算天下地缘总览；纯只读、确定性、零 RNG。 */
export function buildRealmGeoOverview(game: GameState): RealmGeoOverview {
  const passes = resolveGamePasses(game);
  const profiles = Object.keys(game.cities)
    .map((id) => evaluateCityGeopolitics(game, Number(id)))
    .filter((profile): profile is CityGeoProfile => profile != null);

  const provinceNames = [...new Set(profiles.map((profile) => profile.province))];
  const provinces = provinceNames.map((province) =>
    buildProvinceSummary(game, province, profiles, passes),
  );

  const passStats: GeoPassStats = {
    total: Object.keys(passes).length,
    friendly: 0,
    hostile: 0,
    neutral: 0,
    empty: 0,
    fortress: 0,
    mountain: 0,
    river: 0,
    wallDamaged: 0,
  };
  for (const pass of Object.values(passes)) {
    passStats[getPassControl(pass, game.playerFactionId)] += 1;
    if (pass.isFortressPass) passStats.fortress += 1;
    if (pass.isMountainPass) passStats.mountain += 1;
    if (pass.isRiverPass) passStats.river += 1;
    if (pass.wall < pass.maxWall) passStats.wallDamaged += 1;
  }

  return {
    totalCityCount: profiles.length,
    provinces,
    strategicNodes: sortProfiles(profiles),
    passStats,
    blockedRoutes: collectBlockedRoutesForPasses(game, passes),
    frontlineCityCount: profiles.filter((profile) => profile.exposure === 'frontline').length,
    watchCityCount: profiles.filter((profile) => profile.exposure === 'watch').length,
    safeCityCount: profiles.filter((profile) => profile.exposure === 'safe').length,
    tribalThreats: Object.values(game.minorityTribes ?? DEFAULT_MINORITY_TRIBES)
      .map((tribe) => {
        const threatLevel = getTribeThreatLevel(tribe.tension);
        return {
          tribeId: tribe.id,
          name: tribe.name,
          regionName: tribe.regionName,
          tension: Math.max(0, Math.min(100, Math.round(tribe.tension))),
          threatLevel,
          threatLabel: getTribeThreatLabel(threatLevel),
        };
      })
      .sort((a, b) => b.tension - a.tension || a.tribeId.localeCompare(b.tribeId)),
  };
}
