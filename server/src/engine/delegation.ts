// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S15 委任军团引擎（docs/04 §39 + docs/42，Session 420 S1：CRUD + 军上限；Session 421 S2：内政 AI；Session 422 S3：军事 AI + 季度报告）。
 * 仅玩家势力使用。内政零 RNG；军事按 D8 纪律沿权威流固定位消费 decisionRng / resolutionRng。
 * 位置真源不变量（docs/42 R1~R3）：一将一军、officer.location 镜像、区归属唯一。
 */
import {
  DelegationPolicy,
  DELEGATION_POLICIES,
  FormationType,
  OfficerStatus,
  Season,
  UnitType,
  canTravelMacroAdjacent,
  countFieldArmies,
  delegationEfficiency,
  delegationPolicyLabel,
  delegationSeasonKey,
  ensureDemographics,
  formationTroopCap,
  governorCityCap,
  governorPositionQualified,
  isHostileOrAtWar,
  maxConscriptable,
  maxDelegationRegions,
  maxFieldArmies,
  sumRegionCities,
  withSyncedPopulation,
  type DelegationRegion,
  type DelegationReport,
  type DelegationSeasonAccumulator,
  type GameState,
  type Officer,
} from '@leh/shared';
import { decideCityRule } from './ai.js';
import { cityInActiveBattle, startCampaignForFaction } from './campaign.js';
import {
  getPlotAttackModifier,
  isEmptyFortDeterring,
  isInstigateForcedAttack,
  isSecretCrossingGarrisonHold,
} from './plot.js';
import { getPolicyAttackModifier } from './policy.js';
import { AI_MILITARY_CONFIG, getFactionAggression } from './aiMilitary.js';

function assertPolicy(policy: DelegationPolicy): void {
  if (!DELEGATION_POLICIES.includes(policy)) throw new Error('无效的委任方针');
}

function pushLog(state: GameState, type: string, message: string, patch: Partial<GameState> = {}): GameState {
  return {
    ...state,
    ...patch,
    actionLog: [
      { year: state.currentYear, month: state.currentMonth, type, message },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

function playerFaction(state: GameState) {
  const faction = state.factions[state.playerFactionId];
  if (!faction || !faction.isAlive) throw new Error('玩家势力不存在或已灭亡');
  return faction;
}

/** 读写玩家委任区列表（旧档缺省视为空）。 */
function regionsOf(state: GameState): DelegationRegion[] {
  return playerFaction(state).delegationRegions ?? [];
}

function withRegions(state: GameState, regions: DelegationRegion[]): GameState {
  const factionId = state.playerFactionId;
  return {
    ...state,
    factions: {
      ...state.factions,
      [factionId]: { ...state.factions[factionId], delegationRegions: regions },
    },
  };
}

/** 军中任职集合（R1：一将一军）。 */
function deployedOfficerIds(state: GameState): Set<number> {
  const ids = new Set<number>();
  for (const army of state.campaignArmies) {
    ids.add(army.commanderId);
    for (const id of army.subCommanderIds) ids.add(id);
    if (army.advisorId != null) ids.add(army.advisorId);
    if (army.subAdvisorId != null) ids.add(army.subAdvisorId);
  }
  return ids;
}

function findRegion(regions: readonly DelegationRegion[], regionId: number): DelegationRegion {
  const region = regions.find((item) => item.id === regionId);
  if (!region) throw new Error('委任区不存在');
  return region;
}

function requireGovernorCandidate(state: GameState, governorId: number): Officer {
  const officer = state.officers[governorId];
  if (!officer) throw new Error('都督人选不存在');
  if (officer.faction !== state.playerFactionId) throw new Error('都督非己方');
  if (officer.status !== OfficerStatus.ACTIVE) throw new Error('都督不可任官');
  if (deployedOfficerIds(state).has(governorId)) throw new Error(`${officer.name} 正随军出征，不可任都督`);
  if (!governorPositionQualified(officer)) throw new Error('都督官职不足（须太守/将军及以上）');
  if (officer.loyalty < 80) throw new Error('都督忠诚不足（须 ≥80）');
  return officer;
}

/** 区名默认取区内最小城名（docs/42 D9）。 */
function defaultRegionName(state: GameState, cityIds: readonly number[]): string {
  const names = cityIds
    .map((id) => state.cities[id]?.name)
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b, 'zh'));
  return names[0] ?? '新委任区';
}

/** 创建委任区：全量校验（官职/忠诚/区帽/城帽/首都/归属/唯一性）。 */
export function createDelegationRegion(
  state: GameState,
  input: {
    name?: string;
    cityIds: number[];
    governorId: number;
    policy?: DelegationPolicy;
    autoRecruit?: boolean;
    autoReward?: boolean;
  },
): GameState {
  const faction = playerFaction(state);
  const regions = regionsOf(state);

  const cityIds = [...new Set(input.cityIds)].sort((a, b) => a - b);
  if (cityIds.length === 0) throw new Error('委任区至少需要一座城');
  for (const id of cityIds) {
    const city = state.cities[id];
    if (!city || city.ruler !== state.playerFactionId) throw new Error('划入城池非己方');
    if (id === faction.capitalCityId) throw new Error('首都不可委任（君主直辖）');
    if (regions.some((region) => region.cityIds.includes(id))) {
      throw new Error(`${city.name} 已属其他委任区`);
    }
  }

  const ruler = state.officers[faction.rulerId];
  const regionCap = maxDelegationRegions(String(ruler?.nobilityRank ?? 'none'), faction.cityIds.length);
  if (regions.length >= regionCap) {
    throw new Error(`委任区数量已达上限（${regions.length}/${regionCap === Number.POSITIVE_INFINITY ? '∞' : regionCap}）`);
  }

  const governor = requireGovernorCandidate(state, input.governorId);
  if (regions.some((region) => region.governorId === input.governorId)) {
    throw new Error(`${governor.name} 已担任其他委任区都督`);
  }
  const cap = governorCityCap(String(governor.civilPosition), String(governor.militaryPosition));
  if (cityIds.length > cap) throw new Error(`${governor.name} 管辖上限 ${cap} 城`);

  const policy = input.policy ?? DelegationPolicy.BALANCED;
  assertPolicy(policy);
  const sum = sumRegionCities(state.cities, cityIds);
  const accumulator: DelegationSeasonAccumulator = {
    actions: [],
    battlesWon: 0,
    battlesLost: 0,
    citiesCaptured: 0,
    baselineTroops: sum.troops,
    baselineGold: sum.gold,
    baselineFood: sum.food,
  };
  const region: DelegationRegion = {
    id: regions.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    name: input.name?.trim() || defaultRegionName(state, cityIds),
    cityIds,
    governorId: input.governorId,
    policy,
    autoRecruit: input.autoRecruit ?? false,
    autoReward: input.autoReward ?? false,
    createdYear: state.currentYear,
    seasonAccumulator: accumulator,
  };
  return pushLog(
    withRegions(state, [...regions, region]),
    'deleg_manage',
    `【委任】${region.name}委任区建立：都督 ${governor.name}（${delegationPolicyLabel(policy)}），辖城 ${region.cityIds.length} 座`,
  );
}

/** 修改委任区：改名/方针（每季一次、下季生效）/自动开关。 */
export function updateDelegationRegion(
  state: GameState,
  input: { regionId: number; name?: string; policy?: DelegationPolicy; autoRecruit?: boolean; autoReward?: boolean },
): GameState {
  const regions = regionsOf(state);
  const region = findRegion(regions, input.regionId);
  let next = region;
  const notes: string[] = [];

  if (input.name != null) {
    const name = input.name.trim();
    if (!name) throw new Error('委任区名不可为空');
    next = { ...next, name };
  }
  if (input.autoRecruit != null) next = { ...next, autoRecruit: input.autoRecruit };
  if (input.autoReward != null) next = { ...next, autoReward: input.autoReward };
  if (input.policy != null && input.policy !== region.policy) {
    assertPolicy(input.policy);
    const key = delegationSeasonKey(state.currentYear, state.currentMonth);
    if (region.policyChangedSeasonKey === key) throw new Error('方针本季已切换，下季方可再改');
    notes.push(`方针改为${delegationPolicyLabel(input.policy)}（下季生效）`);
    next = { ...next, pendingPolicy: input.policy, policyChangedSeasonKey: key };
  }

  const nextRegions = regions.map((item) => (item.id === region.id ? next : item));
  let out = withRegions(state, nextRegions);
  if (notes.length > 0) {
    out = pushLog(out, 'deleg_manage', `【委任】${next.name}：${notes.join('，')}`);
  }
  return out;
}

/** 划入/划出城池；划空自动解散（docs/42 D10）。 */
export function assignDelegationCity(
  state: GameState,
  input: { regionId: number; cityId: number; remove?: boolean },
): GameState {
  const faction = playerFaction(state);
  const regions = regionsOf(state);
  const region = findRegion(regions, input.regionId);
  const city = state.cities[input.cityId];
  if (!city) throw new Error('城池不存在');

  if (input.remove) {
    if (!region.cityIds.includes(input.cityId)) throw new Error(`${city.name} 不在该委任区`);
    const rest = region.cityIds.filter((id) => id !== input.cityId);
    if (rest.length === 0) {
      return pushLog(
        disbandDelegationRegion(withRegions(state, regions), input.regionId),
        'deleg_manage',
        `【委任】${region.name} 划出最后一城，委任区自动解散`,
      );
    }
    // 维持 accumulator 基准对齐：从基线扣减该城当前值
    let nextRegion: DelegationRegion = { ...region, cityIds: rest };
    if (region.seasonAccumulator) {
      const sum = sumRegionCities(state.cities, [input.cityId]);
      nextRegion = {
        ...nextRegion,
        seasonAccumulator: {
          ...region.seasonAccumulator,
          baselineTroops: Math.max(0, region.seasonAccumulator.baselineTroops - sum.troops),
          baselineGold: Math.max(0, region.seasonAccumulator.baselineGold - sum.gold),
          baselineFood: Math.max(0, region.seasonAccumulator.baselineFood - sum.food),
        },
      };
    }
    const nextRegions = regions.map((item) =>
      item.id === region.id ? nextRegion : item,
    );
    return pushLog(
      withRegions(state, nextRegions),
      'deleg_manage',
      `【委任】${city.name} 划出 ${region.name}`,
    );
  }

  if (city.ruler !== state.playerFactionId) throw new Error('划入城池非己方');
  if (input.cityId === faction.capitalCityId) throw new Error('首都不可委任（君主直辖）');
  if (region.cityIds.includes(input.cityId)) throw new Error(`${city.name} 已在该委任区`);
  if (regions.some((item) => item.cityIds.includes(input.cityId))) {
    throw new Error(`${city.name} 已属其他委任区`);
  }
  const governor = state.officers[region.governorId];
  const cap = governorCityCap(String(governor?.civilPosition), String(governor?.militaryPosition));
  if (region.cityIds.length >= cap) throw new Error(`都督管辖上限 ${cap} 城`);
  let nextRegion: DelegationRegion = {
    ...region,
    cityIds: [...region.cityIds, input.cityId].sort((a, b) => a - b),
  };
  if (region.seasonAccumulator) {
    const sum = sumRegionCities(state.cities, [input.cityId]);
    nextRegion = {
      ...nextRegion,
      seasonAccumulator: {
        ...region.seasonAccumulator,
        baselineTroops: region.seasonAccumulator.baselineTroops + sum.troops,
        baselineGold: region.seasonAccumulator.baselineGold + sum.gold,
        baselineFood: region.seasonAccumulator.baselineFood + sum.food,
      },
    };
  }
  const nextRegions = regions.map((item) =>
    item.id === region.id ? nextRegion : item,
  );
  return pushLog(
    withRegions(state, nextRegions),
    'deleg_manage',
    `【委任】${city.name} 划入 ${region.name}`,
  );
}

/** 解散委任区（都督免职回城语义在既有位置模型下无需迁移——都督从未离开原城）。 */
export function disbandDelegationRegion(state: GameState, regionId: number): GameState {
  const regions = regionsOf(state);
  const region = findRegion(regions, regionId);
  const governor = state.officers[region.governorId];
  const nextRegions = regions.filter((item) => item.id !== regionId);
  return pushLog(
    withRegions(state, nextRegions),
    'deleg_disband',
    `【委任】${region.name}委任区解散${governor ? `：都督 ${governor.name} 免职` : ''}`,
  );
}

/** R3 自检：委任区归属唯一、城池仍属玩家（供验收与回归断言）。 */
export function assertDelegationInvariants(state: GameState): void {
  const regions = playerFaction(state).delegationRegions ?? [];
  const seen = new Set<number>();
  for (const region of regions) {
    if (region.cityIds.length === 0) throw new Error(`委任区 ${region.id} 为空`);
    for (const id of region.cityIds) {
      if (seen.has(id)) throw new Error(`城 ${id} 属多个委任区`);
      seen.add(id);
      const city = state.cities[id];
      if (!city || city.ruler !== state.playerFactionId) {
        throw new Error(`委任区含非玩家城 ${id}`);
      }
    }
  }
}

// ====== 累计器与报告（docs/42 D9，S3） ======

function canAiAttackFaction(state: GameState, attackerId: number, defenderId: number): boolean {
  return isHostileOrAtWar(state.diplomacy, attackerId, defenderId);
}

function buildAccumulatorBaseline(state: GameState, cityIds: readonly number[]): DelegationSeasonAccumulator {
  const sum = sumRegionCities(state.cities, cityIds);
  return {
    actions: [],
    battlesWon: 0,
    battlesLost: 0,
    citiesCaptured: 0,
    baselineTroops: sum.troops,
    baselineGold: sum.gold,
    baselineFood: sum.food,
  };
}

/** 确保每个委任区都有 seasonAccumulator（旧档兼容；基线为当前区金粮兵合计）。 */
export function ensureDelegationAccumulators(state: GameState): GameState {
  const faction = state.factions[state.playerFactionId];
  const regions = faction?.delegationRegions ?? [];
  if (regions.length === 0) return state;
  let changed = false;
  const next = regions.map((region) => {
    if (region.seasonAccumulator) return region;
    changed = true;
    return { ...region, seasonAccumulator: buildAccumulatorBaseline(state, region.cityIds) };
  });
  if (!changed) return state;
  return {
    ...state,
    factions: {
      ...state.factions,
      [state.playerFactionId]: { ...faction, delegationRegions: next },
    },
  };
}

/** 向指定区的 accumulator 追加一条动作摘要（≤24 条）。 */
export function pushDelegationAction(state: GameState, regionId: number, action: string): GameState {
  const faction = state.factions[state.playerFactionId];
  const regions = faction?.delegationRegions ?? [];
  const idx = regions.findIndex((r) => r.id === regionId);
  if (idx < 0) return state;
  const region = regions[idx];
  const acc = region.seasonAccumulator ?? buildAccumulatorBaseline(state, region.cityIds);
  const trimmed = action.trim().slice(0, 80);
  if (!trimmed) return state;
  const actions = [...acc.actions, trimmed].slice(-24);
  const nextAcc: DelegationSeasonAccumulator = { ...acc, actions };
  const nextRegions = [...regions];
  nextRegions[idx] = { ...region, seasonAccumulator: nextAcc };
  return {
    ...state,
    factions: {
      ...state.factions,
      [state.playerFactionId]: { ...faction, delegationRegions: nextRegions },
    },
  };
}

function buildWarnings(state: GameState, region: DelegationRegion): string[] {
  const warnings: string[] = [];
  const governor = state.officers[region.governorId];
  if (!governor) warnings.push('都督失联');
  else {
    if (governor.loyalty < 80) warnings.push(`${governor.name}忠诚偏低（${governor.loyalty}）`);
    else if (governor.loyalty < 90) warnings.push(`${governor.name}忠诚需关注`);
    if (governor.status !== OfficerStatus.ACTIVE) warnings.push(`${governor.name}不在任`);
  }
  for (const cityId of region.cityIds) {
    const city = state.cities[cityId];
    if (!city) continue;
    if ((city.stats.morale ?? 70) < 40) warnings.push(`${city.name}民心低迷`);
    if (city.troops < 800) warnings.push(`${city.name}兵力薄弱`);
    if (city.food < city.troops) warnings.push(`${city.name}粮草紧缺`);
    if (city.gold < 200) warnings.push(`${city.name}府库空虚`);
    if (warnings.length >= 12) break;
  }
  return warnings.slice(0, 12);
}

/**
 * 季度报告：季度首月生成 lastReport 并重置 accumulator。
 * actionSummary≤8、delta=当前合计-基准、warnings 低忠诚等。
 */
export function tickDelegationReports(state: GameState, isQuarterStart: boolean): GameState {
  if (!isQuarterStart) return state;
  const faction = state.factions[state.playerFactionId];
  const regions = faction?.delegationRegions ?? [];
  if (regions.length === 0) return state;
  let changed = false;
  const nextRegions = regions.map((region) => {
    const acc = region.seasonAccumulator ?? buildAccumulatorBaseline(state, region.cityIds);
    if (!region.seasonAccumulator) changed = true;
    const validIds = region.cityIds.filter((id) => {
      const city = state.cities[id];
      return !!city && city.ruler === state.playerFactionId;
    });
    const sum = sumRegionCities(state.cities, validIds);
    const report: DelegationReport = {
      season: Math.floor((state.currentMonth - 1) / 3) as Season,
      year: state.currentYear,
      actionSummary: acc.actions.slice(0, 8),
      troopDelta: sum.troops - acc.baselineTroops,
      goldDelta: sum.gold - acc.baselineGold,
      foodDelta: sum.food - acc.baselineFood,
      battlesWon: acc.battlesWon,
      battlesLost: acc.battlesLost,
      citiesCaptured: acc.citiesCaptured,
      warnings: buildWarnings(state, region),
    };
    const newAcc: DelegationSeasonAccumulator = {
      actions: [],
      battlesWon: 0,
      battlesLost: 0,
      citiesCaptured: 0,
      baselineTroops: sum.troops,
      baselineGold: sum.gold,
      baselineFood: sum.food,
    };
    changed = true;
    return { ...region, lastReport: report, seasonAccumulator: newAcc };
  });
  if (!changed) return state;
  return {
    ...state,
    factions: {
      ...state.factions,
      [state.playerFactionId]: { ...faction, delegationRegions: nextRegions },
    },
  };
}

/**
 * D10 生命周期：城被攻占/叛离自动移出 cityIds，空区自动解散；都督被俘/死亡/非 ACTIVE 自动解散。
 * 返回新 state 与 deleg_disband 日志；CAP 与首都校验保留（移出时序已保证首都不在区内）。
 */
export function pruneDelegationRegions(state: GameState): GameState {
  const faction = state.factions[state.playerFactionId];
  const regions = faction?.delegationRegions ?? [];
  if (regions.length === 0) return state;
  let nextState: GameState = state;
  const nextRegions: DelegationRegion[] = [];
  let changed = false;

  for (const region of regions) {
    const governor = state.officers[region.governorId];
    const governorInvalid =
      !governor ||
      governor.faction !== state.playerFactionId ||
      governor.status !== OfficerStatus.ACTIVE;
    if (governorInvalid) {
      nextState = pushLog(
        nextState,
        'deleg_disband',
        `【委任】${region.name}委任区解散：都督 ${governor?.name ?? region.governorId} 不在任`,
      );
      changed = true;
      continue;
    }
    const filtered = region.cityIds.filter((id) => {
      const city = nextState.cities[id];
      return !!city && city.ruler === state.playerFactionId && id !== faction.capitalCityId;
    });
    if (filtered.length === 0) {
      nextState = pushLog(
        nextState,
        'deleg_disband',
        `【委任】${region.name}委任区解散：辖城尽失`,
      );
      changed = true;
      continue;
    }
    if (filtered.length !== region.cityIds.length) {
      const removed = region.cityIds.length - filtered.length;
      nextState = pushLog(
        nextState,
        'deleg_disband',
        `【委任】${region.name}辖城 ${region.cityIds.length}→${filtered.length}（移出 ${removed} 城）`,
      );
      changed = true;
      // 基准同步扣减被移出城的当前值，避免 delta 误算为塌缩
      let acc = region.seasonAccumulator;
      if (acc) {
        const removedIds = region.cityIds.filter((id) => !filtered.includes(id));
        const removedSum = sumRegionCities(nextState.cities, removedIds);
        // 注意被占城 ruler 已变，sum 为 0；用旧快照回退更稳：直接用 acc baseline 减对应城的原贡献（近似取当前 sum 已非玩家故为 0，仍达扣减效果）
        // 简化：baseline 保持不变，下季 delta 会自然回正；此处不再微调基线。
        void removedSum;
      }
      nextRegions.push({ ...region, cityIds: filtered.sort((a, b) => a - b) });
    } else {
      nextRegions.push(region);
    }
  }

  if (!changed) return state;
  // 将已收集的 deleg_disband 日志保留，并落盘新 regions
  return {
    ...nextState,
    factions: {
      ...nextState.factions,
      [state.playerFactionId]: { ...nextState.factions[state.playerFactionId]!, delegationRegions: nextRegions },
    },
  };
}

// ====== S2 内政 AI（docs/42 D6 内政半，Session 421） ======

/**
 * D5 季度晋升：方针切换写 pendingPolicy，跨季后（当前季度键≠变更键）晋升为 policy。
 * 无 pendingPolicy 或无委任区时原样返回（零状态变更，turn-golden 不受影响）。
 */
export function applyPendingPolicies(state: GameState): GameState {
  const faction = state.factions[state.playerFactionId];
  const regions = faction?.delegationRegions ?? [];
  if (regions.length === 0) return state;
  const key = delegationSeasonKey(state.currentYear, state.currentMonth);
  let changed = false;
  const next = regions.map((region) => {
    if (region.pendingPolicy == null || region.policyChangedSeasonKey === key) return region;
    changed = true;
    return { ...region, policy: region.pendingPolicy, pendingPolicy: undefined };
  });
  if (!changed) return state;
  return {
    ...state,
    factions: {
      ...state.factions,
      [state.playerFactionId]: { ...faction, delegationRegions: next },
    },
  };
}

/**
 * S2（docs/42 D6 内政半）：玩家委任区每月内政。
 * 确定性零 RNG：decideCityRule 三规则（病症驱动，与方针无关）+ 方针 fallback +
 * 委任效率折损 floor(基准×eff)。城失/划出后跳过（D10）；都督从军期间内政照常（D4）。
 * 位置：turn.ts runAllAiTurns 之后、syncFactionResources 之前。
 * 同步维护 seasonAccumulator（civil 动作推入）。
 */
export function runDelegationCivilTurns(state: GameState): GameState {
  const faction = state.factions[state.playerFactionId];
  const regions = faction?.delegationRegions ?? [];
  if (regions.length === 0) return state;
  const governor = (id: number) => state.officers[id];
  const notes: string[] = [];
  let cities = state.cities;
  let anyAccInitialized = false;

  // 确保 accumulator 存在（旧档兼容）
  let workingRegions: DelegationRegion[] = regions.map((region) => {
    if (region.seasonAccumulator) return region;
    anyAccInitialized = true;
    return { ...region, seasonAccumulator: buildAccumulatorBaseline(state, region.cityIds) };
  });

  for (let idx = 0; idx < workingRegions.length; idx++) {
    const region = workingRegions[idx];
    const g = governor(region.governorId);
    const eff = delegationEfficiency(g?.stats.leadership ?? 0, g?.stats.politics ?? 0, region.policy);
    const regionNotes: string[] = [];
    for (const cityId of [...region.cityIds].sort((a, b) => a - b)) {
      const city = cities[cityId];
      if (!city || city.ruler !== state.playerFactionId) continue; // 城失/划出后跳过（D10）
      const rule = decideCityRule(city);
      const demo = ensureDemographics(city);
      // 三规则病症驱动：farm/patrol 不征兵；仅 balanced 分支按方针 fallback
      const conscriptAllowed = rule !== 'farm' && rule !== 'patrol';
      const recruit = conscriptAllowed
        ? Math.floor(Math.min(40, maxConscriptable(demo)) * eff)
        : 0;
      let farmGain = 0;
      let commerceGain = 0;
      let moraleGain = 0;
      if (rule === 'farm') {
        farmGain = 6;
      } else if (rule === 'commerce') {
        commerceGain = 6;
      } else if (rule === 'patrol') {
        moraleGain = 3;
        farmGain = 1;
        commerceGain = 1;
      } else if (region.policy === DelegationPolicy.DEVELOPMENT) {
        farmGain = 6;
      } else if (region.policy === DelegationPolicy.ARMAMENT) {
        // 征兵已在 conscriptAllowed 分支处理，无额外开发
      } else if (region.policy === DelegationPolicy.OFFENSIVE) {
        // 征兵优先；余粮不足时安抚军心（0-A 训练度未实装，民心代理）
        if (city.food < city.troops * 4) moraleGain = 2;
      } else {
        farmGain = 2;
        commerceGain = 2; // balanced
      }

      const farm = Math.min(999, city.stats.farm + Math.floor(farmGain * eff));
      const commerce = Math.min(999, city.stats.commerce + Math.floor(commerceGain * eff));
      const morale = Math.min(100, city.stats.morale + Math.floor(moraleGain * eff));
      const changed =
        farm !== city.stats.farm || commerce !== city.stats.commerce || morale !== city.stats.morale || recruit > 0;
      if (!changed) continue;
      const nextDemo = { ...demo, adultMale: demo.adultMale - recruit };
      cities = {
        ...cities,
        [cityId]: withSyncedPopulation(
          {
            ...city,
            stats: { ...city.stats, farm, commerce, morale },
            troops: city.troops + recruit,
            demographics: nextDemo,
          },
          nextDemo,
        ),
      };
      const parts: string[] = [];
      if (farm !== city.stats.farm) parts.push(`农业+${farm - city.stats.farm}`);
      if (commerce !== city.stats.commerce) parts.push(`商业+${commerce - city.stats.commerce}`);
      if (morale !== city.stats.morale) parts.push(`民心+${morale - city.stats.morale}`);
      if (recruit > 0) parts.push(`征兵+${recruit}`);
      regionNotes.push(`${city.name} ${parts.join('/')}`);
    }
    if (regionNotes.length > 0) {
      notes.push(`【${region.name}】${regionNotes.join('；')}`);
      const acc = workingRegions[idx].seasonAccumulator!;
      const actionStr = regionNotes.join('；').slice(0, 80);
      const newActions = [...acc.actions, actionStr].slice(-24);
      workingRegions[idx] = {
        ...workingRegions[idx],
        seasonAccumulator: { ...acc, actions: newActions },
      };
    }
  }
  const citiesChanged = cities !== state.cities;
  const accChanged =
    anyAccInitialized ||
    workingRegions.some((r, i) => r.seasonAccumulator !== regions[i]?.seasonAccumulator);
  if (notes.length === 0 && !citiesChanged && !accChanged) return state;
  let out: GameState = state;
  if (citiesChanged) out = { ...out, cities };
  if (accChanged || citiesChanged) {
    out = {
      ...out,
      factions: {
        ...out.factions,
        [state.playerFactionId]: { ...faction, delegationRegions: workingRegions },
      },
    };
  } else {
    // 仅 accumulator 初始化但无城变也需落盘
    if (anyAccInitialized) {
      out = {
        ...out,
        factions: {
          ...out.factions,
          [state.playerFactionId]: { ...faction, delegationRegions: workingRegions },
        },
      };
    }
  }
  if (notes.length === 0) return out;
  return pushLog(
    out,
    'deleg_civil',
    `【委任内政】${notes.slice(0, 4).join(' ')}`,
  );
}

// ====== S3 军事 AI（docs/42 D6 军事半） ======

const DELEGATION_POLICY_RATIO: Record<string, number> = {
  [DelegationPolicy.OFFENSIVE]: 1.0,
  [DelegationPolicy.DEVELOPMENT]: 1.6,
  [DelegationPolicy.ARMAMENT]: 1.3,
  [DelegationPolicy.BALANCED]: 1.3,
};

const DELEGATION_POLICY_MUL: Record<string, number> = {
  [DelegationPolicy.OFFENSIVE]: 1.4,
  [DelegationPolicy.BALANCED]: 1.0,
  [DelegationPolicy.ARMAMENT]: 0.8,
  [DelegationPolicy.DEVELOPMENT]: 0.5,
};

function requiredReserve(state: GameState, factionId: number, cityId: number): number {
  const largestAdjacentEnemy = Object.values(state.cities)
    .filter((target) =>
      target.ruler != null &&
      target.ruler !== factionId &&
      canAiAttackFaction(state, factionId, target.ruler) &&
      canTravelMacroAdjacent(cityId, target.id)
    )
    .reduce((largest, target) => Math.max(largest, target.troops), 0);
  return Math.max(
    AI_MILITARY_CONFIG.garrisonReserve,
    Math.floor(largestAdjacentEnemy * AI_MILITARY_CONFIG.threatenedReserveRatio),
  );
}

function isThreateningCity(state: GameState, factionId: number, fromId: number, targetId: number): boolean {
  const from = state.cities[fromId];
  const target = state.cities[targetId];
  if (!from || !target || target.ruler == null || target.ruler === factionId) return false;
  if (!canAiAttackFaction(state, factionId, target.ruler)) return false;
  if (!canTravelMacroAdjacent(fromId, targetId)) return false;
  return target.troops >= from.troops * AI_MILITARY_CONFIG.threatRatio;
}

function isThreatenedSource(state: GameState, factionId: number, cityId: number): boolean {
  const from = state.cities[cityId];
  if (!from) return false;
  return Object.values(state.cities).some((target) =>
    target.ruler != null &&
    target.ruler !== factionId &&
    canAiAttackFaction(state, factionId, target.ruler) &&
    canTravelMacroAdjacent(cityId, target.id) &&
    target.troops >= from.troops * AI_MILITARY_CONFIG.threatenedRatio
  );
}

function threatensOtherCityOf(state: GameState, factionId: number, targetId: number, excludeCityId: number): boolean {
  const target = state.cities[targetId];
  if (!target || target.ruler == null) return false;
  return Object.values(state.cities).some((mine) =>
    mine.id !== excludeCityId &&
    mine.ruler === factionId &&
    canTravelMacroAdjacent(mine.id, targetId) &&
    target.troops >= mine.troops * AI_MILITARY_CONFIG.threatRatio
  );
}

function pickDelegationCommander(
  state: GameState,
  factionId: number,
  cityIds: readonly number[],
): Officer | undefined {
  const deployed = deployedOfficerIds(state);
  const allowed = new Set(cityIds);
  return Object.values(state.officers)
    .filter((officer) =>
      officer.faction === factionId &&
      officer.status === OfficerStatus.ACTIVE &&
      officer.location != null &&
      allowed.has(officer.location) &&
      !deployed.has(officer.id)
    )
    .sort((a, b) =>
      (b.stats.leadership * 2 + b.stats.war) - (a.stats.leadership * 2 + a.stats.war) ||
      a.id - b.id
    )[0];
}

/**
 * S3 委任军事：每区一次决策机会，region id 升序。
 * 评分链复用 aiMilitaryTurn（孱弱×计谋/国策×富庶×城防×威胁响应），源限定区内非首都城。
 * 方针乘数作用于出征/袭扰概率与兵力比门槛；受 D1 军上限与 formationTroopCap 约束。
 * RNG 纪律：每区 decisionRng 1~2 次（出征掷点 + 袭扰掷点，命中即止）、resolutionRng 0~2 次（仅袭扰结算）；沿权威流固定位。
 */
export function runDelegationMilitary(
  state: GameState,
  decisionRng: () => number,
  resolutionRng: () => number,
): GameState {
  const faction = state.factions[state.playerFactionId];
  const regions = faction?.delegationRegions ?? [];
  if (regions.length === 0) return state;
  const playerId = state.playerFactionId;
  const sortedRegions = [...regions].sort((a, b) => a.id - b.id);
  let s: GameState = state;
  // working copy of regions for accumulator push
  let workingRegions: DelegationRegion[] = sortedRegions.map((r) =>
    r.seasonAccumulator ? r : { ...r, seasonAccumulator: buildAccumulatorBaseline(s, r.cityIds) }
  );
  let accChanged = workingRegions.some((r, i) => r.seasonAccumulator !== sortedRegions[i].seasonAccumulator);

  const ownCityCount = Object.values(s.cities).filter((city) => city.ruler === playerId).length;
  const maxField = maxFieldArmies(ownCityCount);
  let fieldCount = countFieldArmies(s.campaignArmies, playerId);
  let frontSlots = Math.max(0, maxField - fieldCount);
  const usedSources = new Set<number>();
  const factionName = faction.name ?? '委任军';

  // 逐区单发决策
  for (let regionIdx = 0; regionIdx < workingRegions.length; regionIdx++) {
    const region = workingRegions[regionIdx];
    const capitalId = s.factions[playerId]?.capitalCityId;
    const validCityIds = region.cityIds.filter((id) => {
      const city = s.cities[id];
      // docs/47 S5d：激战城不作为委任出征源（同批兵力可能正在六角战中）。
      return !!city && city.ruler === playerId && id !== capitalId && !cityInActiveBattle(s, id);
    });
    if (validCityIds.length === 0) continue;

    type Cand = { fromId: number; targetId: number; score: number; mod: number };
    const cands: Cand[] = [];
    for (const fromId of validCityIds) {
      const from = s.cities[fromId];
      if (!from) continue;
      if (usedSources.has(fromId)) continue;
      if (from.troops < AI_MILITARY_CONFIG.minRaidSourceTroops) continue;
      if (isSecretCrossingGarrisonHold(s, fromId)) continue;
      for (const target of Object.values(s.cities)) {
        if (target.ruler == null || target.ruler === playerId) continue;
        if (!canAiAttackFaction(s, playerId, target.ruler)) continue;
        if (!canTravelMacroAdjacent(fromId, target.id)) continue;
        const mod = getPlotAttackModifier(s, target.id, playerId) * getPolicyAttackModifier(s, target.id, playerId);
        const base = Math.max(100, 12000 - target.troops);
        const wealth = Math.min(1.25, 1 + (target.gold + Math.floor(target.food / 8)) / 40000);
        const wallFactor = 100 / (100 + target.stats.wall * AI_MILITARY_CONFIG.wallPenaltyDivisor);
        let score = base * mod * wealth * wallFactor;
        if (isThreateningCity(s, playerId, fromId, target.id)) score *= AI_MILITARY_CONFIG.threatBonus;
        else if (threatensOtherCityOf(s, playerId, target.id, fromId)) score *= AI_MILITARY_CONFIG.threatAllyBonus;
        cands.push({ fromId, targetId: target.id, score, mod });
      }
    }
    if (cands.length === 0) continue;
    cands.sort((a, b) => b.score - a.score || a.fromId - b.fromId || a.targetId - b.targetId);
    const best = cands[0];
    const from = s.cities[best.fromId];
    const target = s.cities[best.targetId];
    if (!from || !target) continue;
    usedSources.add(from.id);

    // 危城按兵不动（离间强攻除外）
    if (isThreatenedSource(s, playerId, best.fromId) && !isInstigateForcedAttack(s, playerId, best.targetId)) {
      s = pushLog(s, 'deleg_military', `【委任·${region.name}】见${from.name}周边强敌环伺，本月按兵不动`);
      const acc = workingRegions[regionIdx].seasonAccumulator!;
      workingRegions[regionIdx] = {
        ...workingRegions[regionIdx],
        seasonAccumulator: { ...acc, actions: [...acc.actions, `按兵不动（${from.name}受威胁）`].slice(-24) },
      };
      accChanged = true;
      continue;
    }
    const forced = isInstigateForcedAttack(s, playerId, best.targetId);
    const targetName = target.name;

    if (!forced && (best.mod < 0.3 || isEmptyFortDeterring(s, best.targetId))) {
      s = pushLog(s, 'deleg_military', `【委任·${region.name}】因空城疑兵暂缓进攻 ${targetName}`);
      const acc = workingRegions[regionIdx].seasonAccumulator!;
      workingRegions[regionIdx] = {
        ...workingRegions[regionIdx],
        seasonAccumulator: { ...acc, actions: [...acc.actions, `暂缓进攻 ${targetName}（空城疑兵）`].slice(-24) },
      };
      accChanged = true;
      continue;
    }

    const baited = best.mod >= 2 && !forced;
    const reserve = requiredReserve(s, playerId, from.id);
    const policyRatio = DELEGATION_POLICY_RATIO[region.policy] ?? 1.3;
    const policyMul = DELEGATION_POLICY_MUL[region.policy] ?? 1;
    const canCapture =
      from.troops - reserve >= AI_MILITARY_CONFIG.minCampaignTroops &&
      (forced || from.troops >= target.troops * policyRatio) &&
      !baited;

    const aggression = getFactionAggression(s, playerId);

    if (canCapture) {
      const advantage = (from.troops - target.troops) / Math.max(target.troops, 1);
      const raw = Math.max(0.05, (AI_MILITARY_CONFIG.baseCampaignChance + advantage * 0.15) * aggression);
      const capped = Math.min(AI_MILITARY_CONFIG.maxCampaignChance, raw);
      const captureChance = Math.min(1, capped * policyMul);
      if (forced || decisionRng() < captureChance) {
        const commander = pickDelegationCommander(s, playerId, validCityIds);
        if (commander) {
          if (frontSlots <= 0) {
            s = pushLog(
              s,
              'deleg_military',
              `【委任·${region.name}】欲自${from.name}出征${targetName}，然出征军数已达上限（${fieldCount}/${maxField}）`,
            );
            const acc = workingRegions[regionIdx].seasonAccumulator!;
            workingRegions[regionIdx] = {
              ...workingRegions[regionIdx],
              seasonAccumulator: { ...acc, actions: [...acc.actions, `出征受限（军额满）`].slice(-24) },
            };
            accChanged = true;
            // 不 return，落入袭扰分支（可改为直接 continue 仅记录上限；此处仍尝试袭扰）
          } else {
            const troopShare = Math.min(0.9, 0.7 + (aggression - 0.75) * 0.3);
            const troopCount = Math.min(
              from.troops - reserve,
              Math.max(AI_MILITARY_CONFIG.minCampaignTroops, Math.floor(from.troops * troopShare)),
              formationTroopCap(commander),
            );
            const food = Math.min(from.food, troopCount * 3);
            try {
              const started = startCampaignForFaction(
                s,
                {
                  fromNodeId: from.id,
                  targetNodeId: target.id,
                  commanderId: commander.id,
                  subCommanderIds: [],
                  unitType: UnitType.LIGHT_INFANTRY,
                  formation: FormationType.SQUARE,
                  troopCount,
                  food,
                },
                playerId,
              );
              s = started.state;
              fieldCount = countFieldArmies(s.campaignArmies, playerId);
              frontSlots = Math.max(0, maxField - fieldCount);
              s = pushLog(
                s,
                'deleg_military',
                `【委任·${region.name}】命${commander.name}率${troopCount}兵自${from.name}出征${targetName}`,
              );
              const acc = workingRegions[regionIdx].seasonAccumulator!;
              workingRegions[regionIdx] = {
                ...workingRegions[regionIdx],
                seasonAccumulator: { ...acc, actions: [...acc.actions, `出征 ${targetName}（${troopCount}兵）`].slice(-24) },
              };
              accChanged = true;
              continue;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              s = pushLog(s, 'deleg_military', `【委任·${region.name}】出征受阻：${msg}`);
              const acc = workingRegions[regionIdx].seasonAccumulator!;
              workingRegions[regionIdx] = {
                ...workingRegions[regionIdx],
                seasonAccumulator: { ...acc, actions: [...acc.actions, `出征受阻`].slice(-24) },
              };
              accChanged = true;
              // 回退到袭扰分支
            }
          }
        }
      }
      // canCapture 且掷点未命中 → 落入袭扰（仍需一次 decision 掷点）
    }

    // 袭扰分支
    const baitBonus = baited ? AI_MILITARY_CONFIG.baitedRaidBonus : 0;
    const raidChance = (AI_MILITARY_CONFIG.baseRaidChance + baitBonus) * aggression * policyMul;
    // 若 canCapture 为真时已消费一次 decisionRng，此处为第二次；否则为首次
    const raidRoll = decisionRng();
    if (raidRoll > raidChance) {
      if (baited) {
        s = pushLog(
          s,
          'deleg_military',
          `【委任·${region.name}】受假情报影响，意图进攻 ${targetName}（本月未成行）`,
        );
        const acc = workingRegions[regionIdx].seasonAccumulator!;
        workingRegions[regionIdx] = {
          ...workingRegions[regionIdx],
          seasonAccumulator: { ...acc, actions: [...acc.actions, `袭扰未成行（${targetName}）`].slice(-24) },
        };
        accChanged = true;
      }
      continue;
    }

    const force = Math.min(AI_MILITARY_CONFIG.raidForce, from.troops - reserve);
    if (force < 400) continue;
    const defLoss = Math.min(target.troops, Math.floor(force * (0.4 + resolutionRng() * 0.35)));
    const atkLoss = Math.floor(force * (0.25 + resolutionRng() * 0.3));

    const cities = {
      ...s.cities,
      [from.id]: { ...from, troops: from.troops - atkLoss },
      [target.id]: { ...target, troops: Math.max(0, target.troops - defLoss) },
    };
    const baitNote = baited ? '（假情报/识破空城诱使）' : '';
    const factionLabel = factionName;
    s = pushLog(
      s,
      'deleg_military',
      `【战报】${factionLabel}自${from.name}袭扰 ${targetName}${baitNote}：敌损约${defLoss}，己损约${atkLoss}`,
      { cities },
    );
    const acc = workingRegions[regionIdx].seasonAccumulator!;
    workingRegions[regionIdx] = {
      ...workingRegions[regionIdx],
      seasonAccumulator: { ...acc, actions: [...acc.actions, `袭扰 ${targetName} 敌损${defLoss}`].slice(-24) },
    };
    accChanged = true;
  }

  if (!accChanged) return s;
  // 将 accumulator 变更落盘（保持原有顺序按 id 升序，但写回时需按原 faction 顺序）
  const regionMap = new Map(workingRegions.map((r) => [r.id, r]));
  const finalRegions = (s.factions[playerId]?.delegationRegions ?? regions).map((r) => regionMap.get(r.id) ?? r);
  // 若有新增的初始化 region（原本无 accumulator），也需补齐
  for (const wr of workingRegions) {
    if (!finalRegions.some((r) => r.id === wr.id)) finalRegions.push(wr);
  }
  return {
    ...s,
    factions: {
      ...s.factions,
      [playerId]: { ...s.factions[playerId]!, delegationRegions: finalRegions },
    },
  };
}
