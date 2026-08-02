// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S27 城级派系与门阀系统（docs/34-faction-politics-design.md）
 * 数字真源：docs/08-data-dictionary.md §十七（改数值必须先改真源）。
 *
 * 全部派生/回归/效果均为纯函数：派生用 xorshift32-v1（seed=cityId），
 * 不消费存档权威随机流；月度回归与效果修正无随机性。
 */

import { SerializableRng } from './rng.js';

/** 城级派系种类全量（同时作为 Zod enum 常量，见 game-state-entity-schema） */
export const CITY_FACTION_KINDS = [
  'aristocracy', // 世家
  'refugees', // 流民
  'merchants', // 商贾
  'militia', // 豪强
  'clan', // 宗族
  'cult', // 教团
  'eunuchs', // 官宦
  'wanderers', // 游侠
] as const;

/** 城级派系种类：核心三派系必有，随机池每城派生 0~2 个 */
export type CityFactionKind = (typeof CITY_FACTION_KINDS)[number];

export interface CityFactionEntry {
  kind: CityFactionKind;
  /** 派系名称；名门特例用郡望（颍川荀氏等），其余用通称 */
  name: string;
  /** 满意度 0~100；月度向 50 回归 */
  satisfaction: number;
}

export const CORE_FACTION_KINDS: CityFactionKind[] = ['aristocracy', 'refugees', 'merchants'];
export const MINOR_FACTION_KINDS: CityFactionKind[] = ['militia', 'clan', 'cult', 'eunuchs', 'wanderers'];

export const FACTION_KIND_LABELS: Record<CityFactionKind, string> = {
  aristocracy: '世家',
  refugees: '流民',
  merchants: '商贾',
  militia: '豪强',
  clan: '宗族',
  cult: '教团',
  eunuchs: '官宦',
  wanderers: '游侠',
};

/** 满意度回归基准（docs/08 §十七） */
export const SATISFACTION_REGRESSION_TARGET = 50;
/** 每月向回归基准移动的点数 */
export const SATISFACTION_REGRESSION_STEP = 1;

/** 效果阈值（docs/08 §十七） */
export const SATISFACTION_HIGH = 70;
export const SATISFACTION_LOW = 30;

/** 0-A 试点城市（洛阳/长安/阳翟/汝南/邺/陈留）；其余城市 cityFactions 为空数组 */
export const PILOT_FACTION_CITY_IDS: readonly number[] = [1, 2, 3, 4, 5, 7];

/** 历史名门特例（仅出现在其郡望城市，见 docs/34 §二） */
export const PRESTIGE_HOUSEHOLDS: Record<number, string[]> = {
  3: ['颍川荀氏', '颍川陈氏'], // 阳翟（颍川郡治）
  4: ['汝南袁氏'], // 汝南
};

/** 初始满意度区间（权威 RNG 在区间内取整） */
const CORE_SAT_RANGE: [number, number] = [40, 60];
const MINOR_SAT_RANGE: [number, number] = [45, 65];
/** 官宦特例区间（Session 286 实测校准：均值 30，约半数城开局即 <30 可弹劾） */
const EUNUCH_SAT_RANGE: [number, number] = [15, 45];
/** 豪强/宗族特例区间（Session 286 实测校准：均值 65，多数城开局即 ≥60 可自募） */
const MILITIA_CLAN_SAT_RANGE: [number, number] = [55, 75];
const PRESTIGE_SAT_RANGE: [number, number] = [60, 75];

function between(rng: SerializableRng, [lo, hi]: [number, number]): number {
  return lo + Math.floor(rng.next() * (hi - lo + 1));
}

function pickKind(rng: SerializableRng, pool: CityFactionKind[]): CityFactionKind {
  return pool[Math.floor(rng.next() * pool.length)];
}

/**
 * 确定性派生城市派系（seed=cityId，xorshift32-v1，零存档随机流消费）。
 * 核心三派系必有；名门特例替换世家派系并提升满意度；
 * 随机池派生 0~2 个（45% 0 个 / 35% 1 个 / 20% 2 个）。
 * 非试点城市返回空数组（0-A 边界，docs/34 §六）。
 */
export function deriveCityFactions(cityId: number): CityFactionEntry[] {
  if (!PILOT_FACTION_CITY_IDS.includes(cityId)) return [];
  const rng = new SerializableRng(cityId);

  const prestige = PRESTIGE_HOUSEHOLDS[cityId] ?? null;
  const core: CityFactionEntry[] = CORE_FACTION_KINDS.map((kind) => ({
    kind,
    name: kind === 'aristocracy' && prestige ? prestige[0] : FACTION_KIND_LABELS[kind],
    satisfaction: between(rng, kind === 'aristocracy' && prestige ? PRESTIGE_SAT_RANGE : CORE_SAT_RANGE),
  }));
  if (prestige && prestige.length > 1) {
    core[0] = { ...core[0], name: `${core[0].name}·${prestige[1]}` };
  }

  const roll = rng.next();
  const minorCount = roll < 0.45 ? 0 : roll < 0.8 ? 1 : 2;
  const pool = [...MINOR_FACTION_KINDS];
  const minors: CityFactionEntry[] = [];
  for (let i = 0; i < minorCount; i += 1) {
    const kind = pickKind(rng, pool);
    pool.splice(pool.indexOf(kind), 1);
    const range =
      kind === 'eunuchs'
        ? EUNUCH_SAT_RANGE
        : kind === 'militia' || kind === 'clan'
          ? MILITIA_CLAN_SAT_RANGE
          : MINOR_SAT_RANGE;
    minors.push({ kind, name: FACTION_KIND_LABELS[kind], satisfaction: between(rng, range) });
  }
  return [...core, ...minors];
}

/** 满意度月度回归：<50 +1、>50 −1（名门同规则，不设保底） */
export function regressSatisfaction(entries: CityFactionEntry[]): CityFactionEntry[] {
  return entries.map((entry) => {
    if (entry.satisfaction === SATISFACTION_REGRESSION_TARGET) return entry;
    const delta = entry.satisfaction < SATISFACTION_REGRESSION_TARGET ? SATISFACTION_REGRESSION_STEP : -SATISFACTION_REGRESSION_STEP;
    return { ...entry, satisfaction: entry.satisfaction + delta };
  });
}

function satisfactionOf(entries: CityFactionEntry[], kind: CityFactionKind): number | null {
  const entry = entries.find((candidate) => candidate.kind === kind);
  return entry ? entry.satisfaction : null;
}

/** 商贾满意度 → 商业产出修正：≥70 +15%、<30 −15%、否则 0 */
export function merchantCommerceMultiplier(entries: CityFactionEntry[]): number {
  const satisfaction = satisfactionOf(entries, 'merchants');
  if (satisfaction == null) return 0;
  if (satisfaction >= SATISFACTION_HIGH) return 0.15;
  if (satisfaction < SATISFACTION_LOW) return -0.15;
  return 0;
}

/** 流民满意度 → 征兵上限修正：≥70 +20%、否则 0 */
export function refugeeConscriptMultiplier(entries: CityFactionEntry[]): number {
  const satisfaction = satisfactionOf(entries, 'refugees');
  if (satisfaction == null || satisfaction < SATISFACTION_HIGH) return 0;
  return 0.2;
}

/** 世家满意度 → 守军士气修正：<30 −15%（暗中通敌），否则 0 */
export function aristocracyDefenderMoralePenalty(entries: CityFactionEntry[]): number {
  const satisfaction = satisfactionOf(entries, 'aristocracy');
  if (satisfaction == null || satisfaction >= SATISFACTION_LOW) return 0;
  return 0.15;
}

/** 是否存在满意度 <30 的小势力（随机池派系）→ 月度叛乱判定条件 */
export function hasUnrestMinorFaction(entries: CityFactionEntry[]): boolean {
  return entries.some(
    (entry) => MINOR_FACTION_KINDS.includes(entry.kind) && entry.satisfaction < SATISFACTION_LOW,
  );
}

/**
 * 声望投奔加成（docs/08 §十七）：≥900 +35%、≥600 +20%、≥300 +10%、否则 0。
 * 接入 server/engine/family.ts checkFollowConditions。
 */
export function fameJoinBonus(fame: number): number {
  if (fame >= 900) return 0.35;
  if (fame >= 600) return 0.2;
  if (fame >= 300) return 0.1;
  return 0;
}

/**
 * 声望叙事化标签（docs/34 §5.1 / 08 §四）：与 S26 天命人心 label 同风格 5 档，
 * 档位边界与投奔阈值 300/600/900 对齐。fame 0~1000。
 */
export function fameLabel(fame: number): string {
  if (fame >= 900) return '威震天下';
  if (fame >= 600) return '名扬海内';
  if (fame >= 300) return '声名鹊起';
  if (fame >= 100) return '崭露头角';
  return '名不见经传';
}

/**
 * 守方民兵（docs/08 §十七）：民心 ≥60 时 floor(人口 × 0.02 × 民心/100)。
 * 接入 server/engine/battle.ts 守军与 campaign.ts 自动战斗守方兵力。
 */
export function defenderMilitia(population: number, morale: number): number {
  if (morale < 60) return 0;
  return Math.floor(population * 0.02 * (morale / 100));
}

/** 兵装战力修正（docs/08 §十七）：arms×100 ≥ 兵力 +5%；缺口过半且已装备 −10%；否则 0 */
export function armsCombatMultiplier(arms: number, troops: number): number {
  if (arms <= 0) return 0;
  const ratio = (arms * 100) / Math.max(1, troops);
  if (ratio >= 1) return 0.05;
  if (ratio <= 0.5) return -0.1;
  return 0;
}

// ===== S27 深化：派系事件（docs/34 §十 / 08 §二十三） =====

/** 高满意度事件触发概率（每城每月） */
export const EVENT_HIGH_CHANCE = 0.25;
/** 低满意度事件触发概率（每城每月） */
export const EVENT_LOW_CHANCE = 0.2;

/** 派系事件结果（数值任意组合，全为可选） */
export interface FactionEventOutcome {
  eventId: string;
  name: string;
  /** 是否来自高满意度池（≥70）；自募武装仅与高池事件互斥 */
  high: boolean;
  goldDelta?: number;
  farmDelta?: number;
  foodDelta?: number;
  troopsDelta?: number;
  moraleDelta?: number;
}

/** 高满意度事件定义（docs/08 §二十三） */
interface FactionEventDef {
  id: string;
  name: string;
  high: boolean;
  condition: (entry: CityFactionEntry) => boolean;
  roll: (rng: () => number) => FactionEventOutcome;
}

const HIGH_EVENTS: FactionEventDef[] = [
  {
    id: 'noble_donation',
    name: '名门献金',
    high: true,
    condition: (e) => e.kind === 'aristocracy' && e.satisfaction >= SATISFACTION_HIGH,
    roll: (rng) => ({ eventId: 'noble_donation', name: '名门献金', high: true, goldDelta: 30 + Math.floor(rng() * 31) }),
  },
  {
    id: 'refugee_farming',
    name: '流民垦荒',
    high: true,
    condition: (e) => e.kind === 'refugees' && e.satisfaction >= SATISFACTION_HIGH,
    roll: (rng) => ({ eventId: 'refugee_farming', name: '流民垦荒', high: true, farmDelta: 10 + Math.floor(rng() * 16) }),
  },
  {
    id: 'trade_boom',
    name: '货路繁盛',
    high: true,
    condition: (e) => e.kind === 'merchants' && e.satisfaction >= SATISFACTION_HIGH,
    roll: (rng) => ({ eventId: 'trade_boom', name: '货路繁盛', high: true, goldDelta: 40 + Math.floor(rng() * 41) }),
  },
  {
    id: 'militia_enlist',
    name: '豪强应募',
    high: true,
    condition: (e) => e.kind === 'militia' && e.satisfaction >= SATISFACTION_HIGH,
    roll: () => ({ eventId: 'militia_enlist', name: '豪强应募', high: true, troopsDelta: 0 }), // 公式在引擎侧按人口
  },
  {
    id: 'clan_grain',
    name: '宗族输粮',
    high: true,
    condition: (e) => e.kind === 'clan' && e.satisfaction >= SATISFACTION_HIGH,
    roll: (rng) => ({ eventId: 'clan_grain', name: '宗族输粮', high: true, foodDelta: 50 + Math.floor(rng() * 51) }),
  },
  {
    id: 'cult_blessing',
    name: '教团祈福',
    high: true,
    condition: (e) => e.kind === 'cult' && e.satisfaction >= SATISFACTION_HIGH,
    roll: () => ({ eventId: 'cult_blessing', name: '教团祈福', high: true, moraleDelta: 2 }),
  },
  {
    id: 'eunuch_recommend',
    name: '官宦引荐',
    high: true,
    condition: (e) => e.kind === 'eunuchs' && e.satisfaction >= SATISFACTION_HIGH,
    roll: (rng) => ({ eventId: 'eunuch_recommend', name: '官宦引荐', high: true, goldDelta: 20 + Math.floor(rng() * 21) }),
  },
  {
    id: 'wanderer_patrol',
    name: '游侠缉盗',
    high: true,
    condition: (e) => e.kind === 'wanderers' && e.satisfaction >= SATISFACTION_HIGH,
    roll: () => ({ eventId: 'wanderer_patrol', name: '游侠缉盗', high: true, moraleDelta: 2 }),
  },
];

/** 低满意度事件定义（核心三派系；随机池小势力由叛乱判定覆盖） */
const LOW_EVENTS: FactionEventDef[] = [
  {
    id: 'noble_drain',
    name: '世家抽逃',
    high: false,
    condition: (e) => e.kind === 'aristocracy' && e.satisfaction < SATISFACTION_LOW,
    roll: (rng) => ({ eventId: 'noble_drain', name: '世家抽逃', high: false, goldDelta: -(20 + Math.floor(rng() * 21)) }),
  },
  {
    id: 'refugee_flee',
    name: '流民流亡',
    high: false,
    condition: (e) => e.kind === 'refugees' && e.satisfaction < SATISFACTION_LOW,
    roll: (rng) => ({ eventId: 'refugee_flee', name: '流民流亡', high: false, farmDelta: -(5 + Math.floor(rng() * 11)) }),
  },
  {
    id: 'merchant_withdraw',
    name: '商贾撤资',
    high: false,
    condition: (e) => e.kind === 'merchants' && e.satisfaction < SATISFACTION_LOW,
    roll: (rng) => ({ eventId: 'merchant_withdraw', name: '商贾撤资', high: false, goldDelta: -(30 + Math.floor(rng() * 31)) }),
  },
];

/**
 * 月度派系事件（docs/34 §十 / 08 §二十三）：
 * 先高满意度池（任一 ≥70，25%），未中则低满意度池（核心三派系任一 <30，20%）；
 * 命中取 entries 顺序首个满足条件的派系。RNG 消费：高池判定 1（未中时低池判定 1）+ 数值 1。
 * 非试点城（entries 为空）返回 null。
 */
export function pickFactionEvent(entries: CityFactionEntry[], rng: () => number): FactionEventOutcome | null {
  if (entries.length === 0) return null;
  const pickByEntries = (defs: FactionEventDef[]): FactionEventDef | null => {
    for (const entry of entries) {
      const def = defs.find((candidate) => candidate.condition(entry));
      if (def) return def;
    }
    return null;
  };
  if (rng() < EVENT_HIGH_CHANCE) {
    const hit = pickByEntries(HIGH_EVENTS);
    if (hit) return hit.roll(rng);
  }
  if (rng() < EVENT_LOW_CHANCE) {
    const hit = pickByEntries(LOW_EVENTS);
    if (hit) return hit.roll(rng);
  }
  return null;
}

/** 高满意度事件（豪强应募）兵力增量公式：max(20, floor(人口×0.005)) */
export function selfRecruitTroopGain(population: number): number {
  return Math.max(20, Math.floor(population * 0.005));
}

// ===== S27 深化：自募武装（docs/34 §十二 / 08 §二十五） =====

/** 自募武装触发概率（每月 15%） */
export const SELF_RECRUIT_CHANCE = 0.15;
/** 自募武装触发满意度阈值（豪强/宗族 ≥60，Session 286 实测校准） */
export const SELF_RECRUIT_SAT_MIN = 60;
/** 自募武装兵装消耗 */
export const SELF_RECRUIT_ARMS_COST = 3;
/** 自募武装满意度回吐 */
export const SELF_RECRUIT_SAT_DROP = 5;

/** 该城是否有可自募武装的派系（豪强/宗族 ≥60） */
export function canSelfRecruit(entries: CityFactionEntry[]): boolean {
  return entries.some(
    (entry) =>
      (entry.kind === 'militia' || entry.kind === 'clan') && entry.satisfaction >= SELF_RECRUIT_SAT_MIN,
  );
}

// ===== S27 深化：弹劾（docs/34 §十一 / 08 §二十四） =====

/** 弹劾触发概率（每月 20%） */
export const IMPEACH_CHANCE = 0.2;
/** 安抚花费 100 金 */
export const IMPEACH_APPEASE_COST = 100;
/** 安抚效果：官宦满意度 +20 */
export const IMPEACH_APPEASE_SAT_GAIN = 20;
/** 撤换效果：城主忠诚 −10、官宦满意度 +10 */
export const IMPEACH_REMOVE_LOYALTY_DROP = 10;
export const IMPEACH_REMOVE_SAT_GAIN = 10;
/** 逾期 2 个月 */
export const IMPEACH_MONTHS_LIMIT = 2;
/** 逾期效果：官宦满意度 −5、城主忠诚 −2 */
export const IMPEACH_EXPIRE_SAT_DROP = 5;
export const IMPEACH_EXPIRE_LOYALTY_DROP = 2;

/** 弹劾事件载体（City.pendingImpeachment，optional 旧档兼容） */
export interface PendingImpeachment {
  /** 被弹劾城主 */
  officerId: number;
  /** 弹劾开始月戳（年×12+月） */
  sinceStamp: number;
}

/** 弹劾触发条件：有官宦派系 <30 且城有城主（由引擎侧校验城主在位） */
export function canImpeach(entries: CityFactionEntry[]): boolean {
  const eunuchs = entries.find((entry) => entry.kind === 'eunuchs');
  return eunuchs != null && eunuchs.satisfaction < SATISFACTION_LOW;
}
