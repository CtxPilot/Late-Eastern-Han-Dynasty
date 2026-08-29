// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S15 委任军团引擎（docs/04 §39 + docs/42，Session 420 S1：CRUD + 军上限）。
 * 仅玩家势力使用；全部确定性，零 RNG（AI 行为在 S2/S3 切片接入）。
 * 位置真源不变量（docs/42 R1~R3）：一将一军、officer.location 镜像、区归属唯一。
 */
import {
  DelegationPolicy,
  DELEGATION_POLICIES,
  OfficerStatus,
  delegationPolicyLabel,
  delegationSeasonKey,
  governorCityCap,
  governorPositionQualified,
  maxDelegationRegions,
  type DelegationRegion,
  type GameState,
  type Officer,
} from '@leh/shared';

function assertPolicy(policy: DelegationPolicy): void {
  if (!DELEGATION_POLICIES.includes(policy)) throw new Error('无效的委任方针');
}

function pushLog(state: GameState, type: string, message: string): GameState {
  return {
    ...state,
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
  const region: DelegationRegion = {
    id: regions.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    name: input.name?.trim() || defaultRegionName(state, cityIds),
    cityIds,
    governorId: input.governorId,
    policy,
    autoRecruit: input.autoRecruit ?? false,
    autoReward: input.autoReward ?? false,
    createdYear: state.currentYear,
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
    const nextRegions = regions.map((item) =>
      item.id === region.id ? { ...item, cityIds: rest } : item,
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
  const nextRegions = regions.map((item) =>
    item.id === region.id
      ? { ...item, cityIds: [...item.cityIds, input.cityId].sort((a, b) => a - b) }
      : item,
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
