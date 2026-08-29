// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 420 S1：委任军团 CRUD + 军上限（docs/04 §39 + docs/42 D1~D5/D9/D10）。
 * 引擎级确定性验收：门禁拒绝路径、方针季度冷却、划城/解散生命周期、D1 军上限、Schema 链。
 */
import {
  CivilPosition,
  DelegationPolicy,
  FormationType,
  GameStateSchema,
  MilitaryPosition,
  NobilityRank,
  OfficerStatus,
  UnitType,
  countFieldArmies,
  delegationSeasonKey,
  formationTroopCap,
  governorCityCap,
  maxDelegationRegions,
  maxFieldArmies,
  type GameState,
} from '@leh/shared';
import {
  assignDelegationCity,
  createDelegationRegion,
  disbandDelegationRegion,
  updateDelegationRegion,
} from '../engine/delegation.js';
import { startCampaignForFaction } from '../engine/campaign.js';
import { createGame, getGame } from '../services/game.js';

let pass = 0;
let fail = 0;
function assert(condition: boolean, message: string): void {
  if (condition) {
    pass++;
    console.log(`  ✓ ${message}`);
  } else {
    fail++;
    console.error(`  ✗ ${message}`);
  }
}
function expectThrow(fn: () => unknown, needle: string, message: string): void {
  try {
    fn();
    fail++;
    console.error(`  ✗ ${message}（未抛错）`);
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    if (text.includes(needle)) {
      pass++;
      console.log(`  ✓ ${message}`);
    } else {
      fail++;
      console.error(`  ✗ ${message}（抛错不匹配：${text}）`);
    }
  }
}

console.log('Delegation CRUD & army cap verify (S1)');

// ====== 共享纯函数（docs/42 D1/D2/D3） ======
assert(maxFieldArmies(1) === 2 && maxFieldArmies(5) === 3 && maxFieldArmies(10) === 4 && maxFieldArmies(30) === 6,
  'D1 军上限公式 clamp(2+floor(城/5),2,6) 各档正确');
assert(governorCityCap(CivilPosition.PREFECT, MilitaryPosition.NONE) === 1, 'D2 太守=1 城');
assert(governorCityCap(CivilPosition.GOVERNOR, MilitaryPosition.NONE) === 4, 'D2 州牧（都督位）=4 城');
assert(governorCityCap(CivilPosition.NONE, MilitaryPosition.GENERAL) === 4, 'D2 将军（都督位）=4 城');
assert(governorCityCap(CivilPosition.NONE, MilitaryPosition.GRAND_GENERAL) === 6, 'D2 大将军=6 城');
assert(governorCityCap(CivilPosition.CHANCELLOR, MilitaryPosition.NONE) === 8, 'D2 丞相=8 城');
assert(governorCityCap(CivilPosition.MAGISTRATE, MilitaryPosition.COLONEL) === 0, 'D2 令/校尉不可任都督');
assert(maxDelegationRegions(NobilityRank.GUANNEI_MARQUIS, 20) === 5, 'D3 关内侯 1+floor(20/5)=5 区');
assert(maxDelegationRegions(NobilityRank.XIAN_MARQUIS, 20) === 8, 'D3 县侯 4+4=8 区');
assert(maxDelegationRegions(NobilityRank.EMPEROR, 99) === Number.POSITIVE_INFINITY, 'D3 皇帝无区数上限');
assert(delegationSeasonKey(190, 1) === 'y190q0' && delegationSeasonKey(190, 12) === 'y190q3', 'D5 季度键正确');

// ====== 开局与布景 ======
createGame(1, 1);
const base = getGame();
const faction = base.factions[base.playerFactionId];
assert(faction.delegationRegions == null, '旧档兼容：开局无 delegationRegions 字段也合法');

const ownCities = Object.values(base.cities).filter((city) => city.ruler === base.playerFactionId);
assert(ownCities.length >= 2, '剧本1 玩家至少两城可划区');
const capitalId = faction.capitalCityId;
const nonCapital = ownCities.filter((city) => city.id !== capitalId).map((city) => city.id);
/** 建区布景用前两城（都督帽内），非首都城全量仍供军上限测试。 */
const regionCityIds = nonCapital.slice(0, 2);

/** 造一名合格都督：州牧（帽 4 城）+忠诚95+在城；同步城池武将清单（Schema 一致性）。 */
function promoteGovernor(state: GameState, officerId: number, cityId: number): GameState {
  const officer = state.officers[officerId];
  const oldCityId = officer.location;
  const cities = { ...state.cities };
  if (oldCityId != null && cities[oldCityId]) {
    cities[oldCityId] = {
      ...cities[oldCityId]!,
      officers: cities[oldCityId]!.officers.filter((id) => id !== officerId),
    };
  }
  if (cities[cityId]) {
    cities[cityId] = {
      ...cities[cityId]!,
      officers: cities[cityId]!.officers.includes(officerId)
        ? cities[cityId]!.officers
        : [...cities[cityId]!.officers, officerId],
    };
  }
  return {
    ...state,
    cities,
    officers: {
      ...state.officers,
      [officerId]: {
        ...officer,
        status: OfficerStatus.ACTIVE,
        loyalty: 95,
        civilPosition: CivilPosition.GOVERNOR,
        location: cityId,
      },
    },
  };
}

const candidates = Object.values(base.officers)
  .filter((officer) => officer.faction === base.playerFactionId && officer.id !== faction.rulerId)
  .sort((a, b) => a.id - b.id);
assert(candidates.length >= 2, '有候选武将可任都督');
const governorA = candidates[0]!.id;
const governorB = candidates[1]!.id;

let state: GameState = promoteGovernor(base, governorA, nonCapital[0]!);
state = promoteGovernor(state, governorB, nonCapital[0]!);

// ====== 创建门禁 ======
expectThrow(
  () => createDelegationRegion(state, { cityIds: [capitalId], governorId: governorA }),
  '首都不可委任',
  '首都划区被拒',
);
expectThrow(
  () => createDelegationRegion(state, { cityIds: regionCityIds, governorId: 999 }),
  '都督人选不存在',
  '不存在的都督被拒',
);
const disloyal = state.officers[governorB]!;
state = {
  ...state,
  officers: { ...state.officers, [governorB]: { ...disloyal, loyalty: 60 } },
};
expectThrow(
  () => createDelegationRegion(state, { cityIds: regionCityIds, governorId: governorB }),
  '都督忠诚不足',
  '忠诚<80 被拒',
);
state = { ...state, officers: { ...state.officers, [governorB]: { ...state.officers[governorB]!, loyalty: 95 } } };
const unqualified = state.officers[governorB]!;
state = {
  ...state,
  officers: {
    ...state.officers,
    [governorB]: { ...unqualified, civilPosition: CivilPosition.CLERK, militaryPosition: MilitaryPosition.CAPTAIN },
  },
};
expectThrow(
  () => createDelegationRegion(state, { cityIds: regionCityIds, governorId: governorB }),
  '都督官职不足',
  '官职不足被拒',
);
state = promoteGovernor(state, governorB, nonCapital[0]!);

// ====== 创建与 Schema 链 ======
const created = createDelegationRegion(state, {
  cityIds: regionCityIds,
  governorId: governorA,
  policy: DelegationPolicy.DEVELOPMENT,
});
assert(GameStateSchema.safeParse(created).success, '建区后完整 GameState Schema 通过');
const regions = created.factions[created.playerFactionId]!.delegationRegions ?? [];
assert(regions.length === 1, '委任区已建立');
const region = regions[0]!;
assert(region.id === 1 && region.policy === DelegationPolicy.DEVELOPMENT, '区 id 自增且方针落库');
const expectedName = regionCityIds
  .map((id) => created.cities[id]!.name)
  .sort((a, b) => a.localeCompare(b, 'zh'))[0]!;
assert(region.name === expectedName, '区名默认取区内名序第一城');

// 一将一区 + 都督随军拦截在创建时
expectThrow(
  () =>
    createDelegationRegion(created, {
      cityIds: nonCapital.slice(2, 4),
      governorId: governorA,
    }),
  '已担任其他委任区都督',
  '跨区兼职被拒',
);

// 区帽：关内侯基准 1 + floor(own/5) —— 玩家城少时第二区即拒
const regionCap = maxDelegationRegions(
  String(created.officers[faction.rulerId]!.nobilityRank),
  faction.cityIds.length,
);
if (Number.isFinite(regionCap) && regionCap < 2) {
  expectThrow(
    () =>
      createDelegationRegion(
        promoteGovernor(created, governorB, regionCityIds[0]!),
        { cityIds: regionCityIds, governorId: governorB },
      ),
    '委任区数量已达上限',
    '区数超爵位帽被拒',
  );
} else {
  assert(true, '当前爵位/城数下第二区合法（跳过区帽拒绝断言）');
}

// ====== 方针季度冷却（D5） ======
const withPolicy = updateDelegationRegion(created, { regionId: region.id, policy: DelegationPolicy.OFFENSIVE });
const regionAfterPolicy = withPolicy.factions[withPolicy.playerFactionId]!.delegationRegions![0]!;
assert(
  regionAfterPolicy.pendingPolicy === DelegationPolicy.OFFENSIVE &&
    regionAfterPolicy.policyChangedSeasonKey === delegationSeasonKey(withPolicy.currentYear, withPolicy.currentMonth),
  '方针切换写入 pendingPolicy 与季度键（下季生效）',
);
expectThrow(
  () => updateDelegationRegion(withPolicy, { regionId: region.id, policy: DelegationPolicy.BALANCED }),
  '方针本季已切换',
  '同季二次改方针被拒',
);
const nextSeason: GameState = { ...withPolicy, currentMonth: withPolicy.currentMonth + 3 };
const reChanged = updateDelegationRegion(nextSeason, { regionId: region.id, policy: DelegationPolicy.ARMAMENT });
assert(
  reChanged.factions[reChanged.playerFactionId]!.delegationRegions![0]!.pendingPolicy === DelegationPolicy.ARMAMENT,
  '下一季度可再改方针',
);

// ====== 划城 / 划空自动解散（D10） ======
expectThrow(
  () => assignDelegationCity(created, { regionId: region.id, cityId: capitalId }),
  '首都不可委任',
  '划入首都被拒',
);
if (nonCapital.length >= 3) {
  const added = assignDelegationCity(created, { regionId: region.id, cityId: nonCapital[2]! });
  assert(
    added.factions[added.playerFactionId]!.delegationRegions![0]!.cityIds.includes(nonCapital[2]!),
    '划入新城',
  );
  const removed = assignDelegationCity(added, { regionId: region.id, cityId: nonCapital[2]!, remove: true });
  assert(
    !removed.factions[removed.playerFactionId]!.delegationRegions![0]!.cityIds.includes(nonCapital[2]!),
    '划出城池',
  );
}
const emptied = assignDelegationRegionRemoveAll();
function assignDelegationRegionRemoveAll(): GameState {
  let cursor: GameState = created;
  for (const id of [...region.cityIds]) {
    cursor = assignDelegationCity(cursor, { regionId: region.id, cityId: id, remove: true });
  }
  return cursor;
}
assert(
  (emptied.factions[emptied.playerFactionId]!.delegationRegions ?? []).length === 0,
  '划出最后一城自动解散',
);

// ====== D1 军上限 ======
const cappedState = promoteGovernor(base, governorA, nonCapital[0]!);
const smallState: GameState = {
  ...cappedState,
  cities: Object.fromEntries(
    Object.entries(cappedState.cities).map(([id, city]) => [
      id,
      city.ruler === base.playerFactionId ? { ...city, troops: Math.max(city.troops, 100000), food: Math.max(city.food, 300000) } : city,
    ]),
  ),
};
// 每支军主将唯一（一将一军），先全员晋升为合格主将
let fieldState = smallState;
for (const officer of candidates) {
  fieldState = promoteGovernor(fieldState, officer.id, nonCapital[0]!);
}
const cap = maxFieldArmies(ownCities.length);
const launchable = Math.min(cap, candidates.length);
const garrisonCity = () => fieldState.cities[nonCapital[0]!]!;
let launched = 0;
while (launched < launchable) {
  const commander = fieldState.officers[candidates[launched]!.id]!;
  const troops = Math.min(garrisonCity().troops, formationTroopCap(commander), 4000);
  if (troops < 1000) throw new Error('布景兵力不足');
  const food = Math.min(garrisonCity().food, troops * 3);
  const result = startCampaignForFaction(
    fieldState,
    {
      fromNodeId: nonCapital[0]!,
      targetNodeId: nonCapital[0]!,
      commanderId: candidates[launched]!.id,
      subCommanderIds: [],
      unitType: UnitType.LIGHT_INFANTRY,
      formation: FormationType.SQUARE,
      troopCount: troops,
      food,
    },
    base.playerFactionId,
    { skipTargetValidation: true },
  );
  fieldState = result.state;
  launched += 1;
}
assert(
  countFieldArmies(fieldState.campaignArmies, base.playerFactionId) === launched,
  `连开 ${launched} 支出征军成功（一将一军下取 军上限/候选数 较小者）`,
);
if (candidates.length > cap) {
  const extraCommander = candidates[cap]!.id;
  const preparedExtra = promoteGovernor(fieldState, extraCommander, nonCapital[0]!);
  expectThrow(
    () =>
      startCampaignForFaction(
        preparedExtra,
        {
          fromNodeId: nonCapital[0]!,
          targetNodeId: nonCapital[0]!,
          commanderId: extraCommander,
          subCommanderIds: [],
          unitType: UnitType.LIGHT_INFANTRY,
          formation: FormationType.SQUARE,
          troopCount: 1000,
          food: 3000,
        },
        base.playerFactionId,
        { skipTargetValidation: true },
      ),
    '出征军数已达上限',
    'D1：超出军上限被拒',
  );
  // garrison 增援不占额也不受限
  const garrison = startCampaignForFaction(
    preparedExtra,
    {
      fromNodeId: nonCapital[0]!,
      targetNodeId: nonCapital[0]!,
      commanderId: extraCommander,
      subCommanderIds: [],
      unitType: UnitType.LIGHT_INFANTRY,
      formation: FormationType.SQUARE,
      troopCount: 1000,
      food: 3000,
    },
    base.playerFactionId,
    { skipTargetValidation: true, phase: 'garrison' },
  );
  assert(
    garrison.army.phase === 'garrison' &&
      countFieldArmies(garrison.state.campaignArmies, base.playerFactionId) === launched,
    'garrison 增援军不占 D1 名额',
  );
} else {
  assert(true, '候选主将不足军上限（跳过超限拒绝断言）');
}

// ====== 解散 ======
const rebuilt = createDelegationRegion(promoteGovernor(base, governorA, regionCityIds[0]!), { cityIds: regionCityIds, governorId: governorA });
const disbanded = disbandDelegationRegion(rebuilt, 1);
assert(
  (disbanded.factions[disbanded.playerFactionId]!.delegationRegions ?? []).length === 0,
  '解散后区清空',
);
assert(GameStateSchema.safeParse(disbanded).success, '解散后完整 GameState Schema 通过');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
