// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 总军师系统引擎（05 §十四 · 04 §三十七）
 *
 * 职责：
 * - 总军师任命/解职
 * - 态势切换（进攻/防守/发展/隐忍，冷却 1 季）
 * - 战略献策（每回合概率触发）
 * - 总军师对决（隐性对抗）
 * - 态势加成计算（接入战场地图层 §20.2.6）
 *
 * 0-A 简化：
 * - AI 自动切换暂用简单规则（按兵力比判断）
 * - 献策效果直接返回文字建议（玩家手动采纳）
 * - 无完整献策效果数值引擎
 */
import {
  OfficerStatus,
  type GameState,
  type GrandStrategist,
  type StrategyType,
} from '@leh/shared';

// ====== 常量 ======

/** 任命智力门槛 */
const APPOINT_INT_REQUIRED = 85;
/** 相性差上限 */
const COMPATIBILITY_MAX_DIFF = 50;
/** 态势切换冷却（季） */
const STRATEGY_COOLDOWN_SEASONS = 1;
/** 忠诚≤50 辞职概率（每月） */
const LOYALTY_RESIGN_CHANCE = 0.1;
/** 献策基础概率 */
const ADVICE_BASE_CHANCE = 0.15;
/** 献策智力系数 */
const ADVICE_INT_FACTOR = 0.005;
/** 对决识破智力差 */
const DUEL_DETECT_THRESHOLD = 15;
/** 对决反制智力差 */
const DUEL_COUNTER_THRESHOLD = 30;

// ====== 态势加成系数 ======

/** 总军师智力对态势加成的影响基数 */
function strategyPotency(int: number): number {
  return Math.max(0.7, 1 + (int - 85) / 50);
}

/**
 * 计算态势对 Army 的修正（用于战场地图层 §20.2.6）
 * 返回 { moraleBonus, foodCostMult, siegeEfficiency, buildSpeed, stratagemBonus }
 */
export function calcStrategyModifiers(
  strategy: StrategyType,
  int: number,
): {
  moraleBonus: number;
  foodCostMult: number;
  siegeEfficiency: number;
  buildSpeed: number;
  stratagemChanceBonus: number;
  civilEffectBonus: number;
  conscriptCostReduction: number;
  warDeclineReduction: number;
  diplomacyBonus: number;
} {
  const potency = strategyPotency(int);
  const defaults = {
    moraleBonus: 0,
    foodCostMult: 1.0,
    siegeEfficiency: 1.0,
    buildSpeed: 1.0,
    stratagemChanceBonus: 0,
    civilEffectBonus: 1.0,
    conscriptCostReduction: 0,
    warDeclineReduction: 0,
    diplomacyBonus: 1.0,
  };

  switch (strategy) {
    case 'offense':
      return {
        ...defaults,
        moraleBonus: Math.round(5 * potency),
        foodCostMult: 1 - 0.2 * potency,
        siegeEfficiency: 1 + 0.1 * potency,
      };
    case 'defense':
      return {
        ...defaults,
        siegeEfficiency: 1 + 0.2 * potency,
        buildSpeed: 1 + 0.25 * potency,
      };
    case 'development':
      return {
        ...defaults,
        civilEffectBonus: 1 + 0.15 * potency,
        conscriptCostReduction: 0.2 * potency,
      };
    case 'endurance':
      return {
        ...defaults,
        warDeclineReduction: 0.3 * potency,
        diplomacyBonus: 1 + 0.5 * potency,
        stratagemChanceBonus: 0.1 * potency,
      };
    default:
      return defaults;
  }
}

// ====== 任命与解职 ======

interface AppointResult {
  state: GameState;
  strategist: GrandStrategist;
  log: string;
}

/** 任命总军师 */
export function appointGrandStrategist(
  state: GameState,
  factionId: number,
  officerId: number,
): AppointResult {
  const officer = state.officers[officerId];
  if (!officer) throw new Error('武将不存在');
  if (officer.faction !== factionId) throw new Error('武将非本方势力');
  if (officer.status !== OfficerStatus.ACTIVE) throw new Error('武将状态异常');

  const faction = state.factions[factionId];
  if (!faction) throw new Error('势力不存在');

  // 检查智力门槛
  if (officer.stats.intelligence < APPOINT_INT_REQUIRED) {
    throw new Error(`智力 ${officer.stats.intelligence} 不足 ${APPOINT_INT_REQUIRED}`);
  }

  // 检查已有总军师
  const existing = state.grandStrategists.find((gs) => gs.factionId === factionId);
  if (existing) throw new Error(`已有总军师（${state.officers[existing.officerId]?.name}）`);

  // 检查相性
  const ruler = state.officers[faction.rulerId];
  if (ruler && Math.abs((officer.hidden?.compatibility ?? 50) - (ruler.hidden?.compatibility ?? 50)) > COMPATIBILITY_MAX_DIFF) {
    throw new Error(`相性差过大（${Math.abs((officer.hidden?.compatibility ?? 50) - (ruler.hidden?.compatibility ?? 50))} > ${COMPATIBILITY_MAX_DIFF}）`);
  }

  // 检查是否兼任军中参谋
  const isAdvisor = state.campaignArmies.some(
    (a) => a.factionId === factionId && (a.advisorId === officerId || a.subAdvisorId === officerId),
  );
  if (isAdvisor) throw new Error('该武将已是军中参谋，不可兼任总军师');

  const currentSeason = getSeasonQuarter(state);
  const strategist: GrandStrategist = {
    factionId,
    officerId,
    appointedYear: state.currentYear,
    strategy: 'offense',
    lastStrategyChange: currentSeason,
    adviceSuccess: 0,
    insightCount: 0,
    strategyScore: 0,
  };

  return {
    state: {
      ...state,
      grandStrategists: [...state.grandStrategists, strategist],
      actionLog: [
        { year: state.currentYear, month: state.currentMonth, type: 'appoint_strategist', message: `拜 ${officer.name} 为总军师` },
        ...state.actionLog,
      ].slice(0, 80),
    },
    strategist,
    log: `拜 ${officer.name} 为总军师`,
  };
}

/** 解职总军师 */
export function dismissGrandStrategist(
  state: GameState,
  factionId: number,
): { state: GameState; log: string } {
  const idx = state.grandStrategists.findIndex((gs) => gs.factionId === factionId);
  if (idx === -1) throw new Error('该势力没有总军师');

  const gs = state.grandStrategists[idx];
  const officerName = state.officers[gs.officerId]?.name ?? '未知';
  const newList = state.grandStrategists.filter((_, i) => i !== idx);

  return {
    state: {
      ...state,
      grandStrategists: newList,
      actionLog: [
        { year: state.currentYear, month: state.currentMonth, type: 'dismiss_strategist', message: `免去 ${officerName} 总军师之职` },
        ...state.actionLog,
      ].slice(0, 80),
    },
    log: `免去 ${officerName} 总军师之职`,
  };
}

// ====== 态势切换 ======

/** 获取当前季度（年×4+季度索引 0~3） */
function getSeasonQuarter(state: GameState): number {
  return state.currentYear * 4 + Math.floor((state.currentMonth - 1) / 3);
}

/** 切换总军师态势 */
export function switchStrategy(
  state: GameState,
  factionId: number,
  newStrategy: StrategyType,
): { state: GameState; log: string } {
  const idx = state.grandStrategists.findIndex((gs) => gs.factionId === factionId);
  if (idx === -1) throw new Error('该势力没有总军师');

  const gs = state.grandStrategists[idx];
  const currentSeason = getSeasonQuarter(state);

  // 检查冷却
  if (currentSeason - gs.lastStrategyChange < STRATEGY_COOLDOWN_SEASONS) {
    throw new Error('态势切换冷却中（每季仅可切换一次）');
  }

  const newList = [...state.grandStrategists];
  newList[idx] = { ...gs, strategy: newStrategy, lastStrategyChange: currentSeason };
  const officerName = state.officers[gs.officerId]?.name ?? '未知';
  const strategyNames: Record<string, string> = {
    offense: '进攻', defense: '防守', development: '发展', endurance: '隐忍',
  };

  return {
    state: {
      ...state,
      grandStrategists: newList,
      actionLog: [
        { year: state.currentYear, month: state.currentMonth, type: 'switch_strategy', message: `${officerName} 将态势转为「${strategyNames[newStrategy] ?? newStrategy}」` },
        ...state.actionLog,
      ].slice(0, 80),
    },
    log: `态势转为「${strategyNames[newStrategy] ?? newStrategy}」`,
  };
}

// ====== 战略献策 ======

const ADVICE_TYPES = [
  'military',
  'civil',
  'diplomacy',
  'detect',
  'personnel',
] as const;

type AdviceType = typeof ADVICE_TYPES[number];

interface AdviceResult {
  triggered: boolean;
  type?: AdviceType;
  message?: string;
  targetId?: number;
  description?: string;
}

/** 检查本回合是否触发献策 */
export function checkStrategyAdvice(
  state: GameState,
  factionId: number,
): AdviceResult {
  const gs = state.grandStrategists.find((gs) => gs.factionId === factionId);
  if (!gs) return { triggered: false };

  const officer = state.officers[gs.officerId];
  if (!officer) return { triggered: false };

  // 触发概率
  const chance = ADVICE_BASE_CHANCE + (officer.stats.intelligence - 80) * ADVICE_INT_FACTOR;
  if (Math.random() > chance) return { triggered: false };

  // 随机选献策类型
  const type = ADVICE_TYPES[Math.floor(Math.random() * ADVICE_TYPES.length)];

  switch (type) {
    case 'military': {
      // 找一个敌城建议出征
      const enemyCity = Object.values(state.cities).find((c) => c.ruler !== factionId && c.ruler != null);
      if (enemyCity) {
        return {
          triggered: true,
          type,
          message: `臣料 ${enemyCity.name} 可取，宜速发兵攻之`,
          targetId: enemyCity.id,
          description: `出征建议：攻打 ${enemyCity.name}`,
        };
      }
      return { triggered: true, type, message: '今宜整军备武，以待天时', description: '军事建议：整军备战' };
    }
    case 'civil': {
      // 找一个己方城建议发展
      const ownCity = Object.values(state.cities).find((c) => c.ruler === factionId);
      if (ownCity) {
        return {
          triggered: true,
          type,
          message: `宜修 ${ownCity.name} 之农，以备来年军资`,
          targetId: ownCity.id,
          description: `内政建议：发展 ${ownCity.name} 农业`,
        };
      }
      return { triggered: true, type, message: '今宜休养生息，劝课农桑', description: '内政建议：发展农业' };
    }
    case 'diplomacy': {
      // 找一个非敌对势力建议结好
      const otherFaction = Object.values(state.factions).find(
        (f) => f.id !== factionId && f.isAlive,
      );
      if (otherFaction) {
        return {
          triggered: true,
          type,
          message: `可遣使结好 ${otherFaction.name}，共御外侮`,
          targetId: otherFaction.id,
          description: `外交建议：与 ${otherFaction.name} 结盟`,
        };
      }
      return { triggered: true, type, message: '今宜广结外援，以壮声势', description: '外交建议' };
    }
    case 'detect': {
      // 侦测到一个敌方计谋
      const enemyGs = state.grandStrategists.find((gs2) => gs2.factionId !== factionId);
      if (enemyGs) {
        const enemyOfficer = state.officers[enemyGs.officerId];
        return {
          triggered: true,
          type,
          message: `臣观敌势，恐 ${enemyOfficer?.name ?? '敌方'} 有计，宜早备之`,
          description: '识破预警：抵消敌方一次战略计谋',
        };
      }
      return { triggered: true, type, message: '臣观敌势，暂无异常', description: '情报分析' };
    }
    case 'personnel': {
      // 建议招揽人才
      const freeOfficer = Object.values(state.officers).find(
        (o) => o.faction == null && o.status === OfficerStatus.ACTIVE,
      );
      if (freeOfficer) {
        return {
          triggered: true,
          type,
          message: `${freeOfficer.name} 乃大才，现流落在外，宜速招之`,
          targetId: freeOfficer.id,
          description: `人事建议：招揽 ${freeOfficer.name}`,
        };
      }
      return { triggered: true, type, message: '宜广开贤路，招纳英才', description: '人事建议' };
    }
    default:
      return { triggered: false };
  }
}

// ====== 总军师对决 ======

interface DuelResult {
  triggered: boolean;
  attackerFactionId: number;
  defenderFactionId: number;
  detected: boolean;
  countered: boolean;
  attackerInt: number;
  defenderInt: number;
}

/** 执行总军师对决（每季度触发） */
export function grandStrategistDuel(
  state: GameState,
  attackerFactionId: number,
  defenderFactionId: number,
): DuelResult {
  const atkGs = state.grandStrategists.find((gs) => gs.factionId === attackerFactionId);
  const defGs = state.grandStrategists.find((gs) => gs.factionId === defenderFactionId);
  if (!atkGs || !defGs) return { triggered: false, attackerFactionId, defenderFactionId, detected: false, countered: false, attackerInt: 0, defenderInt: 0 };

  const atkInt = state.officers[atkGs.officerId]?.stats.intelligence ?? 0;
  const defInt = state.officers[defGs.officerId]?.stats.intelligence ?? 0;

  const intDiff = defInt - atkInt; // 防守方识破进攻方

  let detected = false;
  let countered = false;

  if (Math.abs(intDiff) >= DUEL_COUNTER_THRESHOLD) {
    // 反制
    if (intDiff >= DUEL_COUNTER_THRESHOLD) {
      detected = true;
      countered = true;
    }
  } else if (Math.abs(intDiff) >= DUEL_DETECT_THRESHOLD) {
    // 识破
    if (intDiff >= DUEL_DETECT_THRESHOLD) {
      detected = true;
    }
  }

  return {
    triggered: true,
    attackerFactionId,
    defenderFactionId,
    detected,
    countered,
    attackerInt: atkInt,
    defenderInt: defInt,
  };
}

// ====== 回合推进 ======

/** 每回合更新总军师系统 */
export function tickGrandStrategists(state: GameState): GameState {
  let grandStrategists = [...state.grandStrategists];
  let officers = { ...state.officers };
  const logs: GameState['actionLog'] = [];

  for (const gs of grandStrategists) {
    // 检查总军师是否被俘/死亡
    const officer = officers[gs.officerId];
    if (!officer || officer.status === OfficerStatus.DEAD || officer.status === OfficerStatus.PRISONER) {
      // 自动空缺
      const name = officer?.name ?? '未知';
      grandStrategists = grandStrategists.filter((g) => g.officerId !== gs.officerId);
      logs.push({ year: state.currentYear, month: state.currentMonth, type: 'strategist_lost', message: `${name} 无法继续担任总军师` });
      continue;
    }

    // 检查忠诚 ≤ 50 自动辞职
    if (officer.loyalty != null && officer.loyalty <= 50 && Math.random() < LOYALTY_RESIGN_CHANCE) {
      grandStrategists = grandStrategists.filter((g) => g.officerId !== gs.officerId);
      logs.push({ year: state.currentYear, month: state.currentMonth, type: 'strategist_resign', message: `${officer.name} 因忠诚不足辞去总军师之职` });
    }
  }

  if (logs.length === 0) return state;

  return {
    ...state,
    grandStrategists,
    officers,
    actionLog: [...logs, ...state.actionLog].slice(0, 80),
  };
}

/** 获取势力当前态势（若无总军师，返回默认进攻且效果 ×0.5） */
export function getFactionStrategy(
  state: GameState,
  factionId: number,
): { strategy: StrategyType; hasStrategist: boolean; potency: number } {
  const gs = state.grandStrategists.find((gs) => gs.factionId === factionId);
  if (!gs) {
    return { strategy: 'offense', hasStrategist: false, potency: 0.5 };
  }
  const int = state.officers[gs.officerId]?.stats.intelligence ?? 85;
  return { strategy: gs.strategy, hasStrategist: true, potency: strategyPotency(int) };
}

/** AI 自动切换态势的简单策略 */
export function aiAutoStrategy(
  state: GameState,
  factionId: number,
): StrategyType | null {
  const gs = state.grandStrategists.find((gs) => gs.factionId === factionId);
  if (!gs) return null;

  const currentSeason = getSeasonQuarter(state);
  if (currentSeason - gs.lastStrategyChange < STRATEGY_COOLDOWN_SEASONS) return null;

  const faction = state.factions[factionId];
  if (!faction) return null;

  // 简单规则：按兵力比判断
  const totalTroops = faction.cityIds.reduce((sum, cid) => sum + (state.cities[cid]?.troops ?? 0), 0);
  const maxEnemyTroops = Object.values(state.factions)
    .filter((f) => f.id !== factionId && f.isAlive)
    .reduce((max, f) => {
      const ft = f.cityIds.reduce((s, cid) => s + (state.cities[cid]?.troops ?? 0), 0);
      return Math.max(max, ft);
    }, 0);

  if (maxEnemyTroops === 0) return 'development';
  if (totalTroops > maxEnemyTroops * 1.5) return 'offense';
  if (totalTroops < maxEnemyTroops * 0.7) return 'endurance';
  return 'defense';
}
