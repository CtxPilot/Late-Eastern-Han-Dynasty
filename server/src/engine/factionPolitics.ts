// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S27 城级派系与门阀系统（docs/34-faction-politics-design.md）
 * 数字真源：docs/08-data-dictionary.md §十七（改数值必须先改真源）。
 *
 * 本引擎只负责「命令结算 + 月度结算」两层：
 * - 命令：开垦（reclaimLand）/ 巡查（patrolCity）/ 兵装采购（buyArms）；
 * - 月度：满意度回归、兵装月产、叛乱判定、每季声望衰减。
 * 派生/效果纯函数在 shared/city-factions.ts；fame 增减统一走 grantFame。
 */

import {
  deriveCityFactions,
  hasUnrestMinorFaction,
  regressSatisfaction,
  pickFactionEvent,
  canSelfRecruit,
  canImpeach,
  selfRecruitTroopGain,
  SELF_RECRUIT_SAT_MIN,
  SELF_RECRUIT_CHANCE,
  SELF_RECRUIT_ARMS_COST,
  SELF_RECRUIT_SAT_DROP,
  IMPEACH_CHANCE,
  IMPEACH_APPEASE_COST,
  IMPEACH_APPEASE_SAT_GAIN,
  IMPEACH_REMOVE_LOYALTY_DROP,
  IMPEACH_REMOVE_SAT_GAIN,
  IMPEACH_MONTHS_LIMIT,
  IMPEACH_EXPIRE_SAT_DROP,
  IMPEACH_EXPIRE_LOYALTY_DROP,
  type City,
  type CityFactionEntry,
  type GameState,
  type Officer,
  type PendingImpeachment,
  familyTreatmentRevoltMultiplier,
} from '@leh/shared';
import { grantMeritTo } from './meritGrant.js';
import { appointOfficer } from './appoint.js';

// ===== 数字真源（docs/08 §十七；0-A 待平衡） =====

/** 开垦：费用 50 金；流民 +8~15；世家 −10~20；farm +20~40；功绩 +4 */
export const RECLAIM_GOLD_COST = 50;
export const RECLAIM_MERIT = 4;
/** 开垦执行人门槛：智谋型（谋士/文官），智 ≥60 */
export const RECLAIM_INTELLIGENCE_MIN = 60;

/** 巡查：费用 30 金；商贾 +5~10；各随机池小势力 −8~15；功绩 +4 */
export const PATROL_GOLD_COST = 30;
export const PATROL_MERIT = 4;
/** 巡查执行人门槛：武官，武 ≥60 */
export const PATROL_WAR_MIN = 60;

/** 兵装采购：10 金/件 */
export const ARMS_BUY_GOLD_PER = 10;
/** 兵装月产：首都 +8/月；每座城防 ≥150 的城再 +2/月 */
export const ARMS_CAPITAL_MONTHLY = 8;
export const ARMS_WALL_THRESHOLD = 150;
export const ARMS_WALL_MONTHLY = 2;
/** 征兵每 100 兵消耗 1 件兵装；训练每次消耗 5 件；战斗损失按 0.5× 消耗 */
export const ARMS_CONSCRIPT_PER_HUNDRED = 1;
export const ARMS_TRAIN_COST = 5;
export const ARMS_LOSS_RATE = 0.5;

/** 小势力叛乱：每城每月 10%（docs/08 §十七，待平衡） */
export const REVOLT_CHANCE_PER_MONTH = 0.1;
/** 叛乱代价：兵力 −10%、民心 −5、不稳小势力满意度重置至回归基准 */
export const REVOLT_TROOPS_LOSS_RATE = 0.1;
export const REVOLT_MORALE_LOSS = 5;

/** 声望增减（docs/08 §十七）：破城 +20 / 占城 +10 / 灭国 +50 / 结盟 +10 / 施米 +2 / 每季 −2 */
export const FAME_CAPTURE_CITY = 20;
export const FAME_OCCUPY_CITY = 10;
export const FAME_ANNIHILATE_FACTION = 50;
export const FAME_ALLIANCE = 10;
export const FAME_RELIEF = 2;
export const FAME_QUARTER_DECAY = 2;

/** 月度时间戳（年×12+月），用于巡查"当月免叛乱判定"标记 */
function monthStamp(year: number, month: number): number {
  return year * 12 + month;
}

/** 给势力增减声望（0~1000 夹紧）；不改动其他字段。 */
export function grantFame(state: GameState, factionId: number, delta: number): GameState {
  const faction = state.factions[factionId];
  if (!faction || !faction.isAlive) return state;
  return {
    ...state,
    factions: {
      ...state.factions,
      [factionId]: {
        ...faction,
        fame: Math.max(0, Math.min(1000, (faction.fame ?? 0) + delta)),
      },
    },
  };
}

function requirePlayerCity(state: GameState, cityId: number): City {
  const city = state.cities[cityId];
  if (!city) throw new Error('城市不存在');
  if (city.ruler !== state.playerFactionId) throw new Error('非己方城市');
  return city;
}

/** 校验命令执行武将：本城、己方、可行动。 */
function requireCityOfficer(
  state: GameState,
  cityId: number,
  officerId: number,
): Officer {
  const officer = state.officers[officerId];
  if (!officer || officer.faction !== state.playerFactionId || officer.location !== cityId) {
    throw new Error('执行武将不在本城或不属己方');
  }
  if (officer.status !== 'active') throw new Error('执行武将当前不可行动');
  return officer;
}

function pushLog(
  state: GameState,
  type: string,
  message: string,
  patch: Partial<Pick<GameState, 'cities' | 'factions' | 'officers'>> = {},
): GameState {
  return {
    ...state,
    ...patch,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type,
        message,
      },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

/** 调整某一类派系满意度（0~100 夹紧）；该派系不存在则原样返回。 */
function adjustSatisfaction(
  entries: CityFactionEntry[],
  kind: CityFactionEntry['kind'],
  delta: number,
): CityFactionEntry[] {
  return entries.map((entry) =>
    entry.kind === kind
      ? { ...entry, satisfaction: Math.max(0, Math.min(100, entry.satisfaction + delta)) }
      : entry,
  );
}

/** 调整全部随机池小势力满意度（0~100 夹紧）。 */
function adjustMinorSatisfaction(entries: CityFactionEntry[], delta: number): CityFactionEntry[] {
  return entries.map((entry) =>
    entry.kind === 'aristocracy' || entry.kind === 'refugees' || entry.kind === 'merchants'
      ? entry
      : { ...entry, satisfaction: Math.max(0, Math.min(100, entry.satisfaction + delta)) },
  );
}

/**
 * 开垦（docs/34 §四 1）：耗金 50，流民满意度 +8~15、世家 −10~20、
 * farm +20~40，执行人功绩 +4。执行人须为智谋型（智 ≥60）。
 * 消费 3 次权威 RNG（流民 / 世家 / farm 各一次）。
 */
export function reclaimLand(
  state: GameState,
  cityId: number,
  officerId: number,
  rng: () => number,
): GameState {
  const city = requirePlayerCity(state, cityId);
  if (city.gold < RECLAIM_GOLD_COST) throw new Error('金钱不足');
  const officer = requireCityOfficer(state, cityId, officerId);
  if (officer.stats.intelligence < RECLAIM_INTELLIGENCE_MIN) {
    throw new Error('开垦需智谋型武将（智≥60）');
  }
  const entries = city.cityFactions ?? deriveCityFactions(cityId);
  const refugeeGain = 8 + Math.floor(rng() * 8);
  const aristocracyLoss = 10 + Math.floor(rng() * 11);
  const farmGain = 20 + Math.floor(rng() * 21);
  const nextCity: City = {
    ...city,
    gold: city.gold - RECLAIM_GOLD_COST,
    cityFactions: adjustSatisfaction(
      adjustSatisfaction(entries, 'refugees', refugeeGain),
      'aristocracy',
      -aristocracyLoss,
    ),
    stats: { ...city.stats, farm: Math.min(999, city.stats.farm + farmGain) },
  };
  return pushLog(
    grantMeritTo(state, officerId, RECLAIM_MERIT),
    'reclaim',
    `${city.name} 开垦荒地（${officer.name}）：farm+${farmGain}，流民+${refugeeGain}，世家−${aristocracyLoss}（耗金${RECLAIM_GOLD_COST}）`,
    { cities: { ...state.cities, [cityId]: nextCity } },
  );
}

/**
 * 巡查（docs/34 §四 2）：耗金 30，商贾满意度 +5~10、各随机池小势力 −8~15，
 * 当月该城豁免叛乱判定（factionPatrolStamp），执行人功绩 +4。
 * 执行人须为武官（武 ≥60）。消费 (1+小势力数) 次权威 RNG。
 */
export function patrolCity(
  state: GameState,
  cityId: number,
  officerId: number,
  rng: () => number,
): GameState {
  const city = requirePlayerCity(state, cityId);
  if (city.gold < PATROL_GOLD_COST) throw new Error('金钱不足');
  const officer = requireCityOfficer(state, cityId, officerId);
  if (officer.stats.war < PATROL_WAR_MIN) {
    throw new Error('巡查需武官（武≥60）');
  }
  const entries = city.cityFactions ?? deriveCityFactions(cityId);
  const merchantGain = 5 + Math.floor(rng() * 6);
  const minors = entries.filter(
    (entry) =>
      entry.kind !== 'aristocracy' && entry.kind !== 'refugees' && entry.kind !== 'merchants',
  );
  const minorLoss = minors.length > 0 ? 8 + Math.floor(rng() * 8) : 0;
  const nextCity: City = {
    ...city,
    gold: city.gold - PATROL_GOLD_COST,
    cityFactions: adjustMinorSatisfaction(
      adjustSatisfaction(entries, 'merchants', merchantGain),
      -minorLoss,
    ),
    factionPatrolStamp: monthStamp(state.currentYear, state.currentMonth),
  };
  return pushLog(
    grantMeritTo(state, officerId, PATROL_MERIT),
    'patrol',
    `${city.name} 巡查缉捕（${officer.name}）：商贾+${merchantGain}${minorLoss > 0 ? `，小势力−${minorLoss}` : '，无小势力可缉'}（耗金${PATROL_GOLD_COST}；本月免叛乱）`,
    { cities: { ...state.cities, [cityId]: nextCity } },
  );
}

/** 兵装采购：10 金/件，入势力兵装库存。 */
export function buyArms(state: GameState, amount: number): GameState {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('采购数量须为正整数');
  const faction = state.factions[state.playerFactionId];
  if (!faction || !faction.isAlive) throw new Error('势力不存在或已灭亡');
  const cost = amount * ARMS_BUY_GOLD_PER;
  if (faction.gold < cost) throw new Error('金钱不足');
  const nextFaction = {
    ...faction,
    gold: faction.gold - cost,
    arms: (faction.arms ?? 0) + amount,
  };
  return pushLog(
    { ...state, factions: { ...state.factions, [state.playerFactionId]: nextFaction } },
    'buy_arms',
    `采购兵装 +${amount}（${cost}金，库存 ${nextFaction.arms}）`,
  );
}

/**
 * 月度结算（在 turn.ts advanceTurn 城市结算后调用）：
 * 1. 补种 cityFactions（旧存档缺省时按 deriveCityFactions 派生）；
 * 2. 全城满意度向 50 回归；
 * 3. 叛乱判定：存在满意度 <30 的小势力且当月未巡查 → 10% 叛乱；
 * 4. 弹劾（S27 深化）：官宦不满 → 城主被弹劾（仅当未叛乱）；已有弹劾 → 逾期落空；
 * 5. 派系事件（S27 深化）：高/低满意度池事件；
 * 6. 自募武装（S27 深化）：豪强/宗族 ≥70 自募私兵（与高满意度事件互斥）；
 * 7. 兵装月产：首都 +8、每座城防≥150 的城 +2；
 * 8. 每季首月全势力声望 −2。
 */
export function tickFactionPolitics(
  state: GameState,
  rng: () => number,
  isQuarterStart: boolean,
): GameState {
  let cities = { ...state.cities };
  let officers = state.officers;
  let factions = { ...state.factions };
  const revoltNotes: string[] = [];
  const eventNotes: string[] = [];
  const recruitNotes: string[] = [];
  const impeachNotes: string[] = [];

  for (const [cityIdStr, city] of Object.entries(cities)) {
    const cityId = Number(cityIdStr);
    if (city.ruler == null) continue;
    const entries = city.cityFactions ?? deriveCityFactions(cityId);
    if (entries.length === 0) continue;
    const regressed = regressSatisfaction(entries);
    let nextCity: City = { ...city, cityFactions: regressed };
    const stamp = monthStamp(state.currentYear, state.currentMonth);

    // 3. 叛乱判定
    const patrolled = city.factionPatrolStamp === stamp;
    const revoltFired =
      !patrolled &&
      hasUnrestMinorFaction(regressed) &&
      rng() < REVOLT_CHANCE_PER_MONTH * familyTreatmentRevoltMultiplier(city.familyTreatment?.mode);
    if (revoltFired) {
      const troops = Math.floor(city.troops * (1 - REVOLT_TROOPS_LOSS_RATE));
      const morale = Math.max(0, (city.stats.morale ?? 70) - REVOLT_MORALE_LOSS);
      nextCity = {
        ...nextCity,
        troops,
        stats: { ...nextCity.stats, morale },
        cityFactions: regressed.map((entry) =>
          entry.kind !== 'aristocracy' && entry.kind !== 'refugees' && entry.kind !== 'merchants'
            ? { ...entry, satisfaction: 50 }
            : entry,
        ),
      };
      revoltNotes.push(`${city.name}发生民变（小势力不满）：兵力−${city.troops - troops}，民心−${REVOLT_MORALE_LOSS}`);
    }

    // 4. 弹劾：仅当本月未叛乱；已有弹劾则先检查逾期
    if (!revoltFired) {
      const pending = nextCity.pendingImpeachment;
      if (pending) {
        const monthsElapsed = stamp - pending.sinceStamp;
        if (monthsElapsed >= IMPEACH_MONTHS_LIMIT) {
          const target = officers[pending.officerId];
          if (target) {
            officers = {
              ...officers,
              [pending.officerId]: {
                ...target,
                loyalty: Math.max(0, (target.loyalty ?? 50) - IMPEACH_EXPIRE_LOYALTY_DROP),
              },
            };
          }
          nextCity = {
            ...nextCity,
            pendingImpeachment: undefined,
            cityFactions: adjustSatisfaction(nextCity.cityFactions!, 'eunuchs', -IMPEACH_EXPIRE_SAT_DROP),
          };
          impeachNotes.push(`${city.name}弹劾风波落空：官宦满意度−${IMPEACH_EXPIRE_SAT_DROP}，城主忠诚−${IMPEACH_EXPIRE_LOYALTY_DROP}`);
        }
      } else if (canImpeach(regressed)) {
        const lordId = nextCity.officers[0];
        const lord = lordId != null ? officers[lordId] : null;
        const isRuler = lord != null && factions[city.ruler]?.rulerId === lordId;
        if (lord && lord.status === 'active' && !isRuler && rng() < IMPEACH_CHANCE) {
          nextCity = {
            ...nextCity,
            pendingImpeachment: { officerId: lordId, sinceStamp: stamp },
          };
          impeachNotes.push(`${city.name}官宦弹劾城主 ${lord.name}（2个月内需安抚或撤换）`);
        }
      }
    }

    // 5. 派系事件
    const outcome = pickFactionEvent(nextCity.cityFactions!, rng);
    if (outcome) {
      const patches: Partial<City> = {};
      if (outcome.goldDelta != null) patches.gold = nextCity.gold + outcome.goldDelta;
      if (outcome.farmDelta != null) patches.stats = { ...nextCity.stats, farm: Math.max(0, nextCity.stats.farm + outcome.farmDelta) };
      if (outcome.foodDelta != null) patches.food = nextCity.food + outcome.foodDelta;
      if (outcome.troopsDelta != null) patches.troops = nextCity.troops + (outcome.troopsDelta === 0 ? selfRecruitTroopGain(nextCity.population) : outcome.troopsDelta);
      if (outcome.moraleDelta != null) patches.stats = { ...(patches.stats ?? nextCity.stats), morale: Math.max(0, Math.min(100, (patches.stats ?? nextCity.stats).morale + outcome.moraleDelta)) };
      nextCity = { ...nextCity, ...patches };
      eventNotes.push(`${city.name}${outcome.name}生效`);
    }

    // 6. 自募武装（与高满意度事件互斥：高池事件已触发则跳过）
    if (!outcome?.high && canSelfRecruit(nextCity.cityFactions!) && rng() < SELF_RECRUIT_CHANCE) {
      const gain = selfRecruitTroopGain(nextCity.population);
      const faction = factions[city.ruler];
      const armsLeft = (faction?.arms ?? 0) - SELF_RECRUIT_ARMS_COST;
      if (faction && armsLeft >= 0) {
        factions = {
          ...factions,
          [city.ruler]: { ...faction, arms: armsLeft },
        };
        nextCity = {
          ...nextCity,
          troops: nextCity.troops + gain,
          cityFactions: nextCity.cityFactions!.map((entry) =>
            (entry.kind === 'militia' || entry.kind === 'clan') && entry.satisfaction >= SELF_RECRUIT_SAT_MIN
              ? { ...entry, satisfaction: entry.satisfaction - SELF_RECRUIT_SAT_DROP }
              : entry,
          ),
        };
        recruitNotes.push(`${city.name}豪强自募私兵 +${gain}（兵装−${SELF_RECRUIT_ARMS_COST}）`);
      }
    }

    cities[cityId] = nextCity;
  }

  // 兵装月产（按势力聚合）
  const armsByFaction = new Map<number, number>();
  for (const city of Object.values(cities)) {
    if (city.ruler == null) continue;
    const production = city.id === factions[city.ruler]?.capitalCityId
      ? ARMS_CAPITAL_MONTHLY
      : 0;
    const wallBonus =
      city.stats.wall >= ARMS_WALL_THRESHOLD ? ARMS_WALL_MONTHLY : 0;
    armsByFaction.set(city.ruler, (armsByFaction.get(city.ruler) ?? 0) + production + wallBonus);
  }
  for (const [fid, production] of armsByFaction) {
    const faction = factions[fid];
    if (!faction || !faction.isAlive) continue;
    factions[fid] = { ...faction, arms: (faction.arms ?? 0) + production };
  }

  // 每季首月声望 −2
  if (isQuarterStart) {
    for (const [fid, faction] of Object.entries(factions)) {
      if (!faction.isAlive) continue;
      factions[Number(fid)] = {
        ...faction,
        fame: Math.max(0, (faction.fame ?? 0) - FAME_QUARTER_DECAY),
      };
    }
  }

  let next: GameState = { ...state, cities, officers, factions };
  for (const note of revoltNotes) next = pushLog(next, 'faction_revolt', note);
  for (const note of eventNotes) next = pushLog(next, 'faction_event', note);
  for (const note of recruitNotes) next = pushLog(next, 'faction_self_recruit', note);
  for (const note of impeachNotes) next = pushLog(next, 'faction_impeach', note);
  return next;
}

/**
 * 弹劾处理（docs/34 §十一 / 08 §二十四）：
 * - appease：耗金 100 → 官宦满意度 +20，弹劾消除；
 * - remove：城主解职（太守解职 + 移出本城官员位至首都），忠诚 −10，官宦满意度 +10，弹劾消除。
 * 仅玩家城市可处理；撤换不支持君主。
 */
export function resolveImpeachment(
  state: GameState,
  cityId: number,
  action: 'appease' | 'remove',
): GameState {
  const city = requirePlayerCity(state, cityId);
  const pending: PendingImpeachment | undefined = city.pendingImpeachment;
  if (!pending) throw new Error('本城当前无弹劾事件');
  const lordId = pending.officerId;
  const lord = state.officers[lordId];
  if (!lord) throw new Error('被弹劾武将不存在');
  const isRuler = state.factions[state.playerFactionId]?.rulerId === lordId;
  if (isRuler) throw new Error('君主不可被撤换');

  if (action === 'appease') {
    if (city.gold < IMPEACH_APPEASE_COST) throw new Error('金钱不足');
    const entries = city.cityFactions ?? deriveCityFactions(cityId);
    const nextCity: City = {
      ...city,
      gold: city.gold - IMPEACH_APPEASE_COST,
      pendingImpeachment: undefined,
      cityFactions: adjustSatisfaction(entries, 'eunuchs', IMPEACH_APPEASE_SAT_GAIN),
    };
    return pushLog(
      { ...state, cities: { ...state.cities, [cityId]: nextCity } },
      'faction_impeach',
      `${city.name}弹劾安抚：${lord.name}留任（耗金${IMPEACH_APPEASE_COST}，官宦满意度+${IMPEACH_APPEASE_SAT_GAIN}）`,
    );
  }

  // remove：解职太守（若任地方官）+ 移送首都 + 移出本城官员位
  let nextOfficers = { ...state.officers };
  let nextCities = { ...state.cities };
  if (lord.localPosition && lord.localPosition !== 'none') {
    const dismissed = appointOfficer(
      { ...state, officers: nextOfficers },
      lordId,
      'local',
      'none',
      cityId,
    );
    nextOfficers = dismissed.officers;
    nextCities = dismissed.cities;
  }
  const capitalId = state.factions[state.playerFactionId]?.capitalCityId;
  const target: Officer = nextOfficers[lordId];
  nextOfficers = {
    ...nextOfficers,
    [lordId]: {
      ...target,
      loyalty: Math.max(0, (target.loyalty ?? 50) - IMPEACH_REMOVE_LOYALTY_DROP),
      location: capitalId ?? null,
    },
  };
  const fromCity = nextCities[cityId];
  nextCities = {
    ...nextCities,
    [cityId]: {
      ...fromCity,
      officers: fromCity.officers.filter((id) => id !== lordId),
      pendingImpeachment: undefined,
      cityFactions: adjustSatisfaction(
        fromCity.cityFactions ?? deriveCityFactions(cityId),
        'eunuchs',
        IMPEACH_REMOVE_SAT_GAIN,
      ),
    },
  };
  if (capitalId != null && capitalId !== cityId) {
    const capital = nextCities[capitalId];
    if (capital) {
      nextCities = {
        ...nextCities,
        [capitalId]: { ...capital, officers: [...capital.officers, lordId] },
      };
    }
  }
  return pushLog(
    { ...state, officers: nextOfficers, cities: nextCities },
    'faction_impeach',
    `${city.name}弹劾撤换：${lord.name}解职移送${capitalId != null ? nextCities[capitalId]?.name ?? '首都' : '未定'}（忠诚−${IMPEACH_REMOVE_LOYALTY_DROP}，官宦满意度+${IMPEACH_REMOVE_SAT_GAIN}）`,
  );
}
