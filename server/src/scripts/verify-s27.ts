// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S27 城级派系与门阀系统验证（docs/34-faction-politics-design.md）
 * 覆盖：创建即派生 / 开垦·巡查·兵装采购（RNG 确定性 + 满意度/farm/金粮效果）/
 * 月度结算（回归 / 兵装月产 / 每季声望衰减）/ 战斗修正（民兵 / 世家暗通 / 兵装战力）。
 */

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  armsCombatMultiplier,
  defenderMilitia,
  deriveCityFactions,
  fameJoinBonus,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { getRuntimeRngState, runtimeRandom } from '../runtime-rng.js';
import {
  createGame,
  doBuyArms,
  doPatrolCity,
  doReclaimLand,
  getGame,
  restoreGameFromEnvelope,
} from '../services/game.js';
import { advanceTurn } from '../engine/turn.js';
import {
  ARMS_CAPITAL_MONTHLY,
  FAME_QUARTER_DECAY,
  PATROL_GOLD_COST,
  RECLAIM_GOLD_COST,
  tickFactionPolitics,
  resolveImpeachment,
} from '../engine/factionPolitics.js';
import { selfRecruitTroopGain } from '@leh/shared';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}
const monthStampValue = (year: number, month: number) => year * 12 + month;
/** 顺序 stub RNG：按调用次序返回预设值，超出后返回 1（不触发）。 */
function seqRng(values: number[]): () => number {
  let index = 0;
  return () => (index < values.length ? values[index++]! : 1);
}

// ===== 1. 共享纯函数（与 shared 单测对齐的引擎侧复查） =====

assert(defenderMilitia(10000, 100) === 200, '民兵：1万人满民心 → 200');
assert(defenderMilitia(10000, 59) === 0, '民兵：民心<60 → 0');
assert(defenderMilitia(12345, 60) === 148, '民兵：向下取整');
assert(armsCombatMultiplier(10, 1000) === 0.05, '兵装战力：满配 +5%');
assert(armsCombatMultiplier(5, 1000) === -0.1, '兵装战力：缺口过半 −10%');
assert(armsCombatMultiplier(0, 1000) === 0, '兵装战力：无库存 0');
assert(fameJoinBonus(900) === 0.35 && fameJoinBonus(600) === 0.2 && fameJoinBonus(300) === 0.1, '声望投奔加成三档');

// ===== 2. 创建即派生：试点城市有 cityFactions，非试点为空 =====

createGame(1, 1);
const created = getGame();
const playerFaction = created.factions[created.playerFactionId];
assert(playerFaction?.fame === 100, '势力初始声望 100');
for (const city of Object.values(created.cities)) {
  if ([1, 2, 3, 4, 5, 7].includes(city.id)) {
    assert((city.cityFactions?.length ?? 0) >= 3, `试点城 ${city.name} 已派生派系`);
    const kinds = city.cityFactions?.map((f) => f.kind) ?? [];
    assert(kinds.includes('aristocracy') && kinds.includes('refugees') && kinds.includes('merchants'), `试点城 ${city.name} 含核心三派系`);
  } else {
    assert((city.cityFactions?.length ?? 0) === 0, `非试点城 ${city.name} 派系为空`);
  }
}
assert(created.cities[3]?.cityFactions?.[0]?.name === '颍川荀氏·颍川陈氏', '阳翟名门替换');
assert(created.cities[4]?.cityFactions?.[0]?.name === '汝南袁氏', '汝南名门替换');

// ===== 3. 开垦 / 巡查 / 兵装采购：确定性 + 效果 =====

const pilotCity = Object.values(created.cities).find((c) => c.ruler === created.playerFactionId && [1, 2, 3, 4, 5, 7].includes(c.id));
if (!pilotCity) throw new Error('缺少玩家试点城市');
// 保证开垦/巡查执行人门槛达标（智/武 ≥60）且在本城
const prepareOfficers = (state: GameState): GameState => ({
  ...state,
  officers: Object.fromEntries(
    Object.entries(state.officers).map(([id, o]) => {
      if (o.location !== pilotCity.id) return [id, o];
      return [
        id,
        {
          ...o,
          faction: state.playerFactionId,
          stats: { ...o.stats, intelligence: Math.max(80, o.stats.intelligence), war: Math.max(80, o.stats.war) },
        },
      ];
    }),
  ),
});
const prepared: GameState = {
  ...prepareOfficers(created),
  cities: {
    ...created.cities,
    [pilotCity.id]: {
      ...pilotCity,
      gold: 50_000,
      food: 50_000,
      cityFactions: deriveCityFactions(pilotCity.id),
    },
  },
};
const save: SaveEnvelopeV1 = {
  schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
  createdAt: '2026-08-02T12:00:00.000Z',
  updatedAt: '2026-08-02T12:00:00.000Z',
  scenarioId: prepared.scenarioId,
  rng: getRuntimeRngState(),
  snapshot: prepared,
};
restoreGameFromEnvelope(save);

const officerId = getGame().cities[pilotCity.id]!.officers[0]!;
const beforeReclaim = getGame().cities[pilotCity.id]!;
doReclaimLand(pilotCity.id, officerId);
const afterReclaim = getGame().cities[pilotCity.id]!;
const refugeesBefore = beforeReclaim.cityFactions?.find((f) => f.kind === 'refugees')?.satisfaction ?? 0;
const refugeesAfter = afterReclaim.cityFactions?.find((f) => f.kind === 'refugees')?.satisfaction ?? 0;
const aristocracyBefore = beforeReclaim.cityFactions?.find((f) => f.kind === 'aristocracy')?.satisfaction ?? 0;
const aristocracyAfter = afterReclaim.cityFactions?.find((f) => f.kind === 'aristocracy')?.satisfaction ?? 0;
assert(afterReclaim.gold === beforeReclaim.gold - RECLAIM_GOLD_COST, '开垦扣金 50');
assert(refugeesAfter - refugeesBefore >= 8 && refugeesAfter - refugeesBefore <= 15, '开垦流民 +8~15');
assert(aristocracyBefore - aristocracyAfter >= 10 && aristocracyBefore - aristocracyAfter <= 20, '开垦世家 −10~20');
assert(afterReclaim.stats.farm - beforeReclaim.stats.farm >= 20 && afterReclaim.stats.farm - beforeReclaim.stats.farm <= 40, '开垦 farm +20~40');

const beforePatrol = getGame().cities[pilotCity.id]!;
const merchantsBefore = beforePatrol.cityFactions?.find((f) => f.kind === 'merchants')?.satisfaction ?? 0;
doPatrolCity(pilotCity.id, officerId);
const afterPatrol = getGame().cities[pilotCity.id]!;
const merchantsAfter = afterPatrol.cityFactions?.find((f) => f.kind === 'merchants')?.satisfaction ?? 0;
assert(afterPatrol.gold === beforePatrol.gold - PATROL_GOLD_COST, '巡查扣金 30');
assert(merchantsAfter - merchantsBefore >= 5 && merchantsAfter - merchantsBefore <= 10, '巡查商贾 +5~10');
assert(afterPatrol.factionPatrolStamp === prepared.currentYear * 12 + prepared.currentMonth, '巡查写入当月豁免标记');

const armsBefore = getGame().factions[getGame().playerFactionId]!.arms ?? 0;
const goldBefore = getGame().factions[getGame().playerFactionId]!.gold;
doBuyArms(10);
const armsAfter = getGame().factions[getGame().playerFactionId]!.arms ?? 0;
assert(armsAfter - armsBefore === 10, '兵装采购 +10');
assert(getGame().factions[getGame().playerFactionId]!.gold === goldBefore - 100, '兵装采购扣金 100');

// ===== 4. 月度结算：回归 / 兵装月产 / 每季声望衰减（stub RNG 保证确定性） =====

const monthState = getGame();
const anyPilot = Object.values(monthState.cities).find((c) => [1, 2, 3, 4, 5, 7].includes(c.id))!;
const fabricated = {
  ...anyPilot,
  factionPatrolStamp: -1,
  cityFactions: [
    { kind: 'aristocracy' as const, name: '世家', satisfaction: 70 },
    { kind: 'refugees' as const, name: '流民', satisfaction: 30 },
    { kind: 'merchants' as const, name: '商贾', satisfaction: 50 },
    { kind: 'cult' as const, name: '教团', satisfaction: 20 },
  ],
};
const tickInput: GameState = {
  ...monthState,
  currentYear: 190,
  currentMonth: 1,
  cities: { ...monthState.cities, [anyPilot.id]: fabricated },
};
const ticked = tickFactionPolitics(tickInput, () => 0.5, true);
const tickedCity = ticked.cities[anyPilot.id]!;
const sat = (kind: string) => tickedCity.cityFactions!.find((f) => f.kind === kind)!.satisfaction;
assert(sat('aristocracy') === 69, '回归：>50 每况愈下 −1');
assert(sat('refugees') === 31, '回归：<50 每况愈升 +1');
assert(sat('merchants') === 50, '回归：=50 不动');
assert(sat('cult') === 21, '回归：不稳小势力 +1');
const tickedArms = ticked.factions[ticked.playerFactionId]!.arms ?? 0;
assert(tickedArms >= (armsAfter ?? 0) + ARMS_CAPITAL_MONTHLY, '首都兵装月产 ≥+8');
const fameAfterTick = ticked.factions[ticked.playerFactionId]!.fame ?? 0;
assert(fameAfterTick <= 100 - FAME_QUARTER_DECAY, '季度首月声望 −2');

// ===== 4b. 叛乱强制触发（stub RNG=0.05 < 10%）：兵力−10%、民心−5、不满小势力重置 =====

const revolt = tickFactionPolitics(tickInput, () => 0.05, false);
const revoltCity = revolt.cities[anyPilot.id]!;
assert(revoltCity.troops === Math.floor(fabricated.troops * 0.9), '叛乱兵力 −10%');
assert(revoltCity.stats.morale === fabricated.stats.morale - 5, '叛乱民心 −5');
assert(revoltCity.cityFactions!.find((f) => f.kind === 'cult')!.satisfaction === 50, '叛乱后不满小势力重置 50');
assert((revolt.actionLog.find((l) => l.type === 'faction_revolt')?.message.length ?? 0) > 0, '叛乱写入日志');

// ===== 4c. 派系事件（tick 层）：高池 / 低池 / 不触发 =====

const stamped = monthStampValue(190, 1);
const rulerId = monthState.factions[monthState.playerFactionId]!.rulerId;
const nonRulerId = Object.keys(monthState.officers)
  .map(Number)
  .find((id) => id !== rulerId)!;
assert(nonRulerId != null, '存在非君主武将可用作城主');
/** 构造一个 190/1 的派系测试城：免叛乱、官宦 60 不弹劾、城主为非君主武将。 */
const town = (satisfaction: Record<string, number>): GameState => {
  const city = {
    ...fabricated,
    factionPatrolStamp: stamped,
    cityFactions: [
      { kind: 'aristocracy' as const, name: '世家', satisfaction: satisfaction.aristocracy ?? 50 },
      { kind: 'refugees' as const, name: '流民', satisfaction: satisfaction.refugees ?? 50 },
      { kind: 'merchants' as const, name: '商贾', satisfaction: satisfaction.merchants ?? 50 },
      { kind: 'eunuchs' as const, name: '官宦', satisfaction: satisfaction.eunuchs ?? 60 },
      { kind: 'militia' as const, name: '豪强', satisfaction: satisfaction.militia ?? 50 },
    ],
    officers: [nonRulerId],
  };
  const lord = monthState.officers[nonRulerId]!;
  return {
    ...monthState,
    currentYear: 190,
    currentMonth: 1,
    officers: Object.fromEntries(
      Object.entries(monthState.officers).map(([id, o]) =>
        Number(id) === nonRulerId
          ? [id, { ...lord, status: 'active', faction: monthState.playerFactionId, location: anyPilot.id, loyalty: 60 }]
          : [id, o],
      ),
    ),
    cities: { ...monthState.cities, [anyPilot.id]: city },
  };
};

const highEvent = tickFactionPolitics(town({ aristocracy: 80 }), seqRng([0, 0]), false);
const highEventCity = highEvent.cities[anyPilot.id]!;
assert(highEventCity.gold === fabricated.gold + 30, '高池事件：名门捐纳 gold+30（rng=0 取区间下限）');
assert(highEvent.actionLog.some((l) => l.type === 'faction_event'), '高池事件写入日志');
assert(!highEvent.actionLog.some((l) => l.type === 'faction_self_recruit'), '高池事件触发时自募互斥跳过');

const lowEvent = tickFactionPolitics(town({ refugees: 20 }), seqRng([0.9, 0, 0]), false);
const lowEventCity = lowEvent.cities[anyPilot.id]!;
assert(lowEventCity.stats.farm === fabricated.stats.farm - 5, '低池事件：流民流亡 farm−5（rng=0 取区间下限）');
assert(lowEvent.actionLog.some((l) => l.type === 'faction_event'), '低池事件写入日志');

const noEvent = tickFactionPolitics(town({}), seqRng([0.9, 0.9, 0.9]), false);
assert(noEvent.cities[anyPilot.id]!.gold === fabricated.gold, '无事件：RNG 全未中，数值不变');

// ===== 4d. 自募武装（tick 层）：豪强≥70 → 兵力+gain / 兵装−3 / 豪强−5 =====
// 对照法：同构造下仅自募 RNG 不同（0.9 未中 vs 0 命中），差值即为自募净效果（回归/月产/事件两侧一致）

const noRecruit = tickFactionPolitics(town({ militia: 80 }), seqRng([0.9, 0.9, 0.9]), false);
const recruit = tickFactionPolitics(town({ militia: 80 }), seqRng([0.9, 0.9, 0]), false);
const recruitCity = recruit.cities[anyPilot.id]!;
const noRecruitCity = noRecruit.cities[anyPilot.id]!;
const expectedGain = selfRecruitTroopGain(recruitCity.population);
assert(
  recruitCity.troops === noRecruitCity.troops + expectedGain,
  '自募：兵力 +max(20, 人口0.5%)',
);
assert(
  (recruit.factions[recruit.playerFactionId]!.arms ?? 0) === (noRecruit.factions[noRecruit.playerFactionId]!.arms ?? 0) - 3,
  '自募：兵装 −3',
);
assert(
  recruitCity.cityFactions!.find((f) => f.kind === 'militia')!.satisfaction ===
    noRecruitCity.cityFactions!.find((f) => f.kind === 'militia')!.satisfaction - 5,
  '自募：豪强满意度 −5',
);
assert(recruit.actionLog.some((l) => l.type === 'faction_self_recruit'), '自募写入日志');
assert(!noRecruit.actionLog.some((l) => l.type === 'faction_self_recruit'), 'RNG 未中时不自募');

// ===== 4e. 弹劾（tick 层）：官宦<30 触发 / 逾期落空 =====

const impeachTick = tickFactionPolitics(town({ eunuchs: 20 }), seqRng([0.05]), false);
const impeachCity = impeachTick.cities[anyPilot.id]!;
assert(
  impeachCity.pendingImpeachment?.officerId === nonRulerId && impeachCity.pendingImpeachment?.sinceStamp === stamped,
  '弹劾触发：写入待处理（城主 + 当月戳）',
);
assert(impeachTick.actionLog.some((l) => l.type === 'faction_impeach'), '弹劾触发写入日志');

const expired = {
  ...town({ eunuchs: 20 }).cities[anyPilot.id]!,
  pendingImpeachment: { officerId: nonRulerId, sinceStamp: monthStampValue(189, 11) },
};
const expiredState = tickFactionPolitics(
  { ...town({ eunuchs: 20 }), cities: { ...monthState.cities, [anyPilot.id]: expired } },
  seqRng([0.9, 0.9, 0.9]),
  false,
);
const expiredCity = expiredState.cities[anyPilot.id]!;
const expiredLord = expiredState.officers[nonRulerId]!;
assert(expiredCity.pendingImpeachment == null, '逾期：弹劾消除');
assert(expiredCity.cityFactions!.find((f) => f.kind === 'eunuchs')!.satisfaction === 16, '逾期：官宦满意度 −5（回归后 21−5）');
assert(expiredLord.loyalty === 60 - 2, '逾期：城主忠诚 −2');

// ===== 4f. 弹劾处理（命令层）：安抚 / 撤换 / 君主拒撤 =====

const withPending = (cityId: number): GameState => ({
  ...prepared,
  currentYear: 190,
  currentMonth: 1,
  cities: {
    ...prepared.cities,
    [cityId]: {
      ...prepared.cities[cityId]!,
      gold: 50_000,
      cityFactions: [
        ...(prepared.cities[cityId]!.cityFactions ?? deriveCityFactions(cityId)),
        { kind: 'eunuchs' as const, name: '官宦', satisfaction: 40 },
      ],
      officers: [nonRulerId],
      pendingImpeachment: { officerId: nonRulerId, sinceStamp: stamped },
    },
  },
  officers: Object.fromEntries(
    Object.entries(prepared.officers).map(([id, o]) =>
      Number(id) === nonRulerId
        ? [id, { ...o, status: 'active', faction: prepared.playerFactionId, location: cityId, loyalty: 60 }]
        : [id, o],
    ),
  ),
});
const capitalCityId = prepared.factions[prepared.playerFactionId]!.capitalCityId;
const secondCityId = Object.values(prepared.cities).find(
  (c) => c.ruler === prepared.playerFactionId && c.id !== capitalCityId && [1, 2, 3, 4, 5, 7].includes(c.id),
)?.id;

const appeased = resolveImpeachment(withPending(pilotCity.id), pilotCity.id, 'appease');
const appeasedCity = appeased.cities[pilotCity.id]!;
assert(appeasedCity.gold === 50_000 - 100, '安抚：耗金 100');
assert(appeasedCity.cityFactions!.find((f) => f.kind === 'eunuchs')!.satisfaction === 60, '安抚：官宦满意度 +20');
assert(appeasedCity.pendingImpeachment == null, '安抚：弹劾消除');

const removeCityId = secondCityId ?? pilotCity.id;
const removed = resolveImpeachment(withPending(removeCityId), removeCityId, 'remove');
const removedCity = removed.cities[removeCityId]!;
const removedLord = removed.officers[nonRulerId]!;
assert(removedLord.localPosition === 'none' || removedLord.localPosition == null, '撤换：太守解职');
assert(removedLord.location === capitalCityId, '撤换：移送首都');
assert(removedLord.loyalty === 60 - 10, '撤换：忠诚 −10');
assert(!removedCity.officers.includes(nonRulerId), '撤换：移出本城官员位');
if (removeCityId !== capitalCityId) {
  assert(removed.cities[capitalCityId]!.officers.includes(nonRulerId), '撤换：列入首都官员位');
}
assert(removedCity.cityFactions!.find((f) => f.kind === 'eunuchs')!.satisfaction === 50, '撤换：官宦满意度 +10');
assert(removedCity.pendingImpeachment == null, '撤换：弹劾消除');

const rulerCommand: GameState = {
  ...withPending(pilotCity.id),
  cities: {
    ...withPending(pilotCity.id).cities,
    [pilotCity.id]: {
      ...withPending(pilotCity.id).cities[pilotCity.id]!,
      pendingImpeachment: { officerId: rulerId, sinceStamp: stamped },
    },
  },
};
let rejected = false;
try {
  resolveImpeachment(rulerCommand, pilotCity.id, 'remove');
} catch {
  rejected = true;
}
assert(rejected, '君主不可被撤换');

// ===== 5. 回合推进兼容（advanceTurn 内部含 tickFactionPolitics） =====

restoreGameFromEnvelope(save);
const turned = advanceTurn(getGame(), runtimeRandom);
const turnedFame = turned.factions[turned.playerFactionId]!.fame ?? 0;
assert(turnedFame >= 98, '推进一回合声望仍在 0~1000 内');

console.log(`S27 faction politics verification passed: ${passed} asserts`);
