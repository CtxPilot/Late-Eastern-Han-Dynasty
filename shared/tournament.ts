// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S19 单挑大会纯函数（选人 / 种子 / 对阵表）
 * 结算引擎在 server/engine/tournament.ts，复用 duel 全自动规则。
 */
import { OfficerStatus } from './enums/index.js';
import type { GameState } from './types/game.js';
import type { Officer } from './types/officer.js';
import type {
  TournamentChampionBet,
  TournamentChampionBetResult,
  TournamentFighter,
  TournamentMatch,
  TournamentMode,
} from './types/tournament.js';

export const TOURNAMENT_SIZE = 16;
export const TOURNAMENT_MIN_WAR = 70;
/** 武魁称号：与持有者势力新建外交链路时初始友好 */
export const WUKUI_DIPLOMACY_INITIAL_FAVOR = 10;
/** 武魁称号：进入战场单挑时对方部队士气 */
export const WUKUI_DUEL_OPPONENT_MORALE_DELTA = -5;
/** 武魁称号：冠军所属城市民心 */
export const WUKUI_CITY_MORALE_BONUS = 3;
/** 0-A 吕布武将 id（crit.ts 同源） */
export const LV_BU_OFFICER_ID = 5;
/** 破军：对吕布势力新建外交初始友好 */
export const POJUN_DIPLOMACY_INITIAL_FAVOR = 5;
/** 破军：与吕布单挑时己方部队士气 */
export const POJUN_DUEL_VS_LVBU_MORALE_DELTA = 5;
/** 下届大会默认模式（05 §8.17.2 建议首次公平竞技） */
export const DEFAULT_TOURNAMENT_PREFERRED_MODE: TournamentMode = 'fair';
/** 拒绝参赛：忠诚低于此值 */
export const TOURNAMENT_REFUSE_LOYALTY_THRESHOLD = 80;
/** 拒绝参赛：与君主相性差大于此值（与总军师任命同源量级） */
export const TOURNAMENT_REFUSE_COMPAT_DIFF = 50;
/** 拒绝参赛时忠诚惩罚 */
export const TOURNAMENT_REFUSE_LOYALTY_PENALTY = 15;
/** 赛前押武魁：限额 = 势力金 × 此比例（05 §8.17.6） */
export const TOURNAMENT_BET_GOLD_CAP_RATIO = 0.2;
/** 爆冷：武力差 ≥ 此值且低武力夺魁 → 赔率 ×3 */
export const TOURNAMENT_BET_UPSET_WAR_GAP = 15;
export const TOURNAMENT_BET_UPSET_MULT = 3;
export const TOURNAMENT_BET_MIN_ODDS = 1.05;
export const TOURNAMENT_BET_MAX_ODDS = 8;
/** 朝廷快捷注额 */
export const TOURNAMENT_BET_PRESETS = [100, 500, 1000] as const;
/** 05 §8.17.5 名次名声（势力 fame） */
export const TOURNAMENT_FAME_CHAMPION = 50;
export const TOURNAMENT_FAME_RUNNER_UP = 30;
export const TOURNAMENT_FAME_SEMIFINAL = 15;
export const TOURNAMENT_FAME_QUARTERFINAL = 5;
export const TOURNAMENT_FAME_POJUN = 30;
/** 冠军所属势力部队士气 +N（Army / CampaignArmy） */
export const TOURNAMENT_CHAMPION_FACTION_MORALE = 10;
/** 05 §8.17.9 大会功绩（武将 merit；君主不发，见 grantMeritTo） */
export const TOURNAMENT_MERIT_CHAMPION = 30;
export const TOURNAMENT_MERIT_RUNNER_UP = 20;
export const TOURNAMENT_MERIT_SEMIFINAL = 10;
/**
 * 0-A 轮间「体力丸」：以金疮药（items id=17）为消耗品占位；
 * 瞬时结算下晋级残血自动耗 1 件回血（05 §8.17.4）。
 */
export const TOURNAMENT_HEAL_ITEM_ID = 17;
export const TOURNAMENT_HEAL_HP = 30;
/**
 * 0-A 冠军神兵池（05：方天/青龙/青釭/倚天；0-A 无青釭，用现有 legendary 主武）。
 * id 对齐 server/src/data/items.json
 */
export const TOURNAMENT_CHAMPION_PRIZE_POOL = [1, 2, 4] as const; // 青龙偃月刀 / 方天画戟 / 倚天剑
/** 0-A 亚军普通宝物池（武器/消耗/护甲 common） */
export const TOURNAMENT_RUNNER_PRIZE_POOL = [19, 20, 17] as const; // 青铜剑 / 革甲 / 金疮药

/** 从奖池按 RNG 抽一件；空池返回 null */
export function pickTournamentPrizeItemId(
  pool: readonly number[],
  rng: () => number,
): number | null {
  if (pool.length === 0) return null;
  const r = rng();
  const idx = Math.min(pool.length - 1, Math.max(0, Math.floor(r * pool.length)));
  return pool[idx] ?? null;
}

/**
 * 轮间用药回血（Session 396）。已满血或 heal≤0 则不变；结果夹在 [0, maxHp]。
 */
export function applyTournamentBetweenRoundHeal(
  currentHp: number,
  maxHp: number,
  healAmount: number = TOURNAMENT_HEAL_HP,
): number {
  if (healAmount <= 0 || currentHp >= maxHp) return currentHp;
  return Math.min(maxHp, Math.max(0, currentHp) + healAmount);
}

/** 解析下届大会模式偏好；缺省/非法 → fair */
export function resolveTournamentPreferredMode(state: GameState): TournamentMode {
  return state.tournamentPreferredMode === 'unrestricted' ? 'unrestricted' : DEFAULT_TOURNAMENT_PREFERRED_MODE;
}

/**
 * 设置下届大会模式（Session 388）。
 * 仅影响下一届正月结算；本届已落幕赛果的 `tournament.mode` 不变。
 */
export function setTournamentPreferredMode(
  state: GameState,
  mode: TournamentMode,
): GameState {
  if (mode !== 'fair' && mode !== 'unrestricted') {
    throw new Error('无效的大会模式');
  }
  if (resolveTournamentPreferredMode(state) === mode) {
    return state.tournamentPreferredMode === mode
      ? state
      : { ...state, tournamentPreferredMode: mode };
  }
  return {
    ...state,
    tournamentPreferredMode: mode,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type: 'tournament',
        message: mode === 'fair'
          ? '下届武魁大会定为公平竞技（吕布无双降级）'
          : '下届武魁大会定为无特殊保护（吕布保留无双）',
      },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

/** 势力名额：大≥8→5 / 中4~7→3 / 小≤3→2；在野合计最多 1 */
export function tournamentQuotaForFaction(cityCount: number): number {
  if (cityCount >= 8) return 5;
  if (cityCount >= 4) return 3;
  return 2;
}

export function factionCityCount(state: GameState, factionId: number): number {
  return state.factions[factionId]?.cityIds?.length
    ?? Object.values(state.cities).filter((c) => c.ruler === factionId).length;
}

/** 玩家势力当前名额 */
export function playerTournamentQuota(state: GameState): number {
  return tournamentQuotaForFaction(factionCityCount(state, state.playerFactionId));
}

function isEligibleOfficer(o: Officer): boolean {
  if (o.status !== OfficerStatus.ACTIVE && o.status !== OfficerStatus.FREE) return false;
  if (o.stats.war < TOURNAMENT_MIN_WAR) return false;
  if (o.stamina < 80) return false;
  return true;
}

export function eligibleTournamentOfficers(state: GameState): Officer[] {
  return Object.values(state.officers).filter(isEligibleOfficer);
}

/** 玩家势力合格报名候选人（按武力降序） */
export function eligiblePlayerTournamentOfficers(state: GameState): Officer[] {
  const fid = state.playerFactionId;
  return eligibleTournamentOfficers(state)
    .filter((o) => o.faction === fid)
    .sort((a, b) => b.stats.war - a.stats.war || a.id - b.id);
}

/** 武将是否可能拒绝参赛（05 §8.17.3） */
export function mayRefuseTournamentEntry(
  officer: Officer,
  ruler: Officer | null | undefined,
): boolean {
  if (officer.loyalty < TOURNAMENT_REFUSE_LOYALTY_THRESHOLD) return true;
  if (ruler != null) {
    const diff = Math.abs(
      (officer.hidden?.compatibility ?? 50) - (ruler.hidden?.compatibility ?? 50),
    );
    if (diff > TOURNAMENT_REFUSE_COMPAT_DIFF) return true;
  }
  return false;
}

export type SetTournamentEntriesResult = {
  state: GameState;
  acceptedIds: number[];
  refusedNames: string[];
};

/**
 * 设置玩家势力下届报名名单（Session 389）。
 * 超名额/非己方/不合格 → 抛错；拒绝者扣忠诚并剔除，其余写入。
 */
export function setTournamentPlayerEntries(
  state: GameState,
  officerIds: readonly number[],
): SetTournamentEntriesResult {
  const quota = playerTournamentQuota(state);
  const unique = [...new Set(officerIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
  if (unique.length > quota) {
    throw new Error(`玩家势力名额至多 ${quota} 人`);
  }

  const fid = state.playerFactionId;
  const faction = state.factions[fid];
  const ruler = faction != null ? state.officers[faction.rulerId] : undefined;
  const officers = { ...state.officers };
  const acceptedIds: number[] = [];
  const refusedNames: string[] = [];

  for (const id of unique) {
    const o = officers[id];
    if (!o || o.faction !== fid) {
      throw new Error('只能报名己方在职武将');
    }
    if (!isEligibleOfficer(o)) {
      throw new Error(`${o.name} 不符合参赛资格（武力≥70 且体力≥80）`);
    }
    if (mayRefuseTournamentEntry(o, ruler)) {
      officers[id] = {
        ...o,
        loyalty: Math.max(0, o.loyalty - TOURNAMENT_REFUSE_LOYALTY_PENALTY),
      };
      refusedNames.push(o.name);
      continue;
    }
    acceptedIds.push(id);
  }

  const same =
    (state.tournamentPlayerEntryIds?.length ?? 0) === acceptedIds.length
    && acceptedIds.every((id, i) => state.tournamentPlayerEntryIds![i] === id)
    && refusedNames.length === 0;
  if (same) {
    return { state, acceptedIds, refusedNames };
  }

  const acceptLabel = acceptedIds.length > 0
    ? acceptedIds.map((id) => officers[id]?.name ?? `#${id}`).join('、')
    : '无人';
  const refuseNote = refusedNames.length > 0
    ? `；${refusedNames.join('、')}拒绝参赛（忠诚−${TOURNAMENT_REFUSE_LOYALTY_PENALTY}）`
    : '';

  const next: GameState = {
    ...state,
    officers,
    tournamentPlayerEntryIds: acceptedIds,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type: 'tournament',
        message: `下届武魁大会报名：${acceptLabel}${refuseNote}`,
      },
      ...state.actionLog,
    ].slice(0, 80),
  };
  return { state: next, acceptedIds, refusedNames };
}

/** 合格池最高武力（赔率/爆冷锚点） */
export function tournamentFieldTopWar(state: GameState): number {
  const eligible = eligibleTournamentOfficers(state);
  if (eligible.length === 0) return TOURNAMENT_MIN_WAR;
  return Math.max(...eligible.map((o) => o.stats.war));
}

/** 押注限额（势力金 × 20%，至少 0） */
export function tournamentBetGoldCap(factionGold: number): number {
  return Math.max(0, Math.floor(Math.max(0, factionGold) * TOURNAMENT_BET_GOLD_CAP_RATIO));
}

/**
 * 武魁赔率：场上最高武力 / 被押武力，夹在 [1.05, 8]。
 * 热门近下限，冷门抬高。
 */
export function tournamentChampionOdds(officerWar: number, fieldTopWar: number): number {
  const top = Math.max(1, fieldTopWar);
  const war = Math.max(1, officerWar);
  const raw = top / war;
  return Math.min(
    TOURNAMENT_BET_MAX_ODDS,
    Math.max(TOURNAMENT_BET_MIN_ODDS, Math.round(raw * 100) / 100),
  );
}

export function computeTournamentChampionBetPayout(
  bet: TournamentChampionBet,
  championId: number,
): TournamentChampionBetResult {
  const won = bet.officerId === championId;
  const upset =
    won && bet.fieldTopWar - bet.officerWar >= TOURNAMENT_BET_UPSET_WAR_GAP;
  const effectiveOdds = upset ? bet.odds * TOURNAMENT_BET_UPSET_MULT : bet.odds;
  const payout = won ? Math.floor(bet.amount * effectiveOdds) : 0;
  return {
    officerId: bet.officerId,
    amount: bet.amount,
    odds: bet.odds,
    won,
    payout,
    upset,
  };
}

function withFactionGold(state: GameState, gold: number): GameState {
  const fid = state.playerFactionId;
  const faction = state.factions[fid];
  if (!faction) throw new Error('玩家势力不存在');
  return {
    ...state,
    factions: {
      ...state.factions,
      [fid]: { ...faction, gold },
    },
  };
}

/**
 * 撤销赛前押注并退还本金（无挂单则原样返回）。
 */
export function clearTournamentChampionBet(state: GameState): GameState {
  const bet = state.tournamentChampionBet;
  if (bet == null) return state;
  const faction = state.factions[state.playerFactionId];
  if (!faction) throw new Error('玩家势力不存在');
  const refunded = withFactionGold(state, faction.gold + bet.amount);
  return {
    ...refunded,
    tournamentChampionBet: null,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type: 'tournament',
        message: `撤销武魁押注，退还 ${bet.amount} 金`,
      },
      ...refunded.actionLog,
    ].slice(0, 80),
  };
}

/**
 * 赛前押武魁（Session 391）。替换旧单时先退旧本金再扣新额。
 * 限额 = 当前可用金（含退还旧单后）× 20%。
 */
export function placeTournamentChampionBet(
  state: GameState,
  officerId: number,
  amount: number,
): GameState {
  const id = Number(officerId);
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(id) || !Number.isFinite(amt) || amt <= 0) {
    throw new Error('押注金额须为正整数');
  }

  const officer = state.officers[id];
  if (!officer || !isEligibleOfficer(officer)) {
    throw new Error('只能押合格武将（武力≥70 且体力≥80）');
  }

  let working = state;
  const prev = working.tournamentChampionBet;
  if (prev != null) {
    const faction = working.factions[working.playerFactionId];
    if (!faction) throw new Error('玩家势力不存在');
    working = {
      ...withFactionGold(working, faction.gold + prev.amount),
      tournamentChampionBet: null,
    };
  }

  const faction = working.factions[working.playerFactionId];
  if (!faction) throw new Error('玩家势力不存在');
  const cap = tournamentBetGoldCap(faction.gold);
  if (amt > cap) {
    throw new Error(`押注不得超过势力金的 ${TOURNAMENT_BET_GOLD_CAP_RATIO * 100}%（上限 ${cap}）`);
  }
  if (faction.gold < amt) {
    throw new Error(`金不足（需 ${amt}，当前 ${faction.gold}）`);
  }

  const fieldTopWar = tournamentFieldTopWar(working);
  const officerWar = officer.stats.war;
  const odds = tournamentChampionOdds(officerWar, fieldTopWar);
  const bet: TournamentChampionBet = {
    officerId: id,
    amount: amt,
    odds,
    officerWar,
    fieldTopWar,
  };

  return {
    ...withFactionGold(working, faction.gold - amt),
    tournamentChampionBet: bet,
    actionLog: [
      {
        year: working.currentYear,
        month: working.currentMonth,
        type: 'tournament',
        message: `押武魁：${officer.name} ${amt} 金（赔率 ${odds.toFixed(2)}）`,
      },
      ...working.actionLog,
    ].slice(0, 80),
  };
}

/**
 * 正月兑付赛前押注：对照冠军；清空挂单；返回金变动与纪要。
 * 无挂单时原样返回。
 */
export function settleTournamentChampionBet(
  state: GameState,
  championId: number,
): {
  state: GameState;
  result: TournamentChampionBetResult | null;
} {
  const bet = state.tournamentChampionBet;
  if (bet == null) {
    return { state: { ...state, tournamentChampionBet: null }, result: null };
  }

  const result = computeTournamentChampionBetPayout(bet, championId);
  const faction = state.factions[state.playerFactionId];
  if (!faction) throw new Error('玩家势力不存在');

  let next: GameState = {
    ...state,
    tournamentChampionBet: null,
  };
  if (result.payout > 0) {
    next = withFactionGold(next, faction.gold + result.payout);
  }

  const name = state.officers[bet.officerId]?.name ?? `#${bet.officerId}`;
  const message = result.won
    ? result.upset
      ? `武魁押注爆冷兑付：${name} ${result.payout} 金（赔率×${TOURNAMENT_BET_UPSET_MULT}）`
      : `武魁押注兑付：${name} ${result.payout} 金`
    : `武魁押注落空：${name} −${bet.amount} 金`;

  next = {
    ...next,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type: 'tournament',
        message,
      },
      ...next.actionLog,
    ].slice(0, 80),
  };

  return { state: next, result };
}

/**
 * 按势力名额抽选至多 16 人；不足时用全池武力补齐；超出截断。
 * 在野合计至多 1 人。
 * Session 389：玩家势力优先采用 tournamentPlayerEntryIds（仍有效者），再用武力补满名额。
 */
export function selectTournamentParticipants(state: GameState): Officer[] {
  const eligible = eligibleTournamentOfficers(state).sort(
    (a, b) => b.stats.war - a.stats.war || a.id - b.id,
  );
  const picked: Officer[] = [];
  const pickedIds = new Set<number>();

  const byFaction = new Map<number | 'free', Officer[]>();
  for (const o of eligible) {
    const key = o.faction ?? 'free';
    const list = byFaction.get(key) ?? [];
    list.push(o);
    byFaction.set(key, list);
  }

  const playerFid = state.playerFactionId;
  const playerNominations = (state.tournamentPlayerEntryIds ?? [])
    .map((id) => state.officers[id])
    .filter((o): o is Officer => o != null && o.faction === playerFid && isEligibleOfficer(o));

  for (const [key, list] of byFaction) {
    if (key === 'free') {
      const freePick = list[0];
      if (freePick && picked.length < TOURNAMENT_SIZE) {
        picked.push(freePick);
        pickedIds.add(freePick.id);
      }
      continue;
    }
    const quota = tournamentQuotaForFaction(factionCityCount(state, key));
    const preferred = key === playerFid ? playerNominations : [];
    let taken = 0;
    for (const o of preferred) {
      if (picked.length >= TOURNAMENT_SIZE || taken >= quota) break;
      if (pickedIds.has(o.id)) continue;
      picked.push(o);
      pickedIds.add(o.id);
      taken += 1;
    }
    for (const o of list) {
      if (picked.length >= TOURNAMENT_SIZE || taken >= quota) break;
      if (pickedIds.has(o.id)) continue;
      picked.push(o);
      pickedIds.add(o.id);
      taken += 1;
    }
  }

  for (const o of eligible) {
    if (picked.length >= TOURNAMENT_SIZE) break;
    if (pickedIds.has(o.id)) continue;
    picked.push(o);
    pickedIds.add(o.id);
  }

  return picked.slice(0, TOURNAMENT_SIZE);
}

/** 种子：1=上届冠军（若仍参赛）否则武力最高；其余按武力高低排 2…N */
export function seedTournamentFighters(
  officers: Officer[],
  previousChampionId?: number | null,
): TournamentFighter[] {
  const ranked = [...officers].sort((a, b) => b.stats.war - a.stats.war || a.id - b.id);
  const champ =
    previousChampionId != null
      ? ranked.find((o) => o.id === previousChampionId)
      : undefined;
  const rest = champ ? ranked.filter((o) => o.id !== champ.id) : ranked;
  const ordered = champ ? [champ, ...rest] : ranked;
  return ordered.map((o, index) => ({
    officerId: o.id,
    seed: index + 1,
    eliminated: false,
  }));
}

/** 当前届武魁武将 id（finished 的 championId；否则最近一届 history） */
export function currentWukuiOfficerId(state: GameState): number | null {
  const t = state.tournament;
  if (!t) return null;
  if (t.phase === 'finished' && t.championId != null) return t.championId;
  const last = t.history[t.history.length - 1];
  return last?.championId ?? null;
}

export function isCurrentWukui(state: GameState, officerId: number): boolean {
  return currentWukuiOfficerId(state) === officerId;
}

export function currentWukuiFactionId(state: GameState): number | null {
  const id = currentWukuiOfficerId(state);
  if (id == null) return null;
  return state.officers[id]?.faction ?? null;
}

/** 新建外交链路时，若任一方为武魁所属势力则初始友好取该值，否则 0。 */
export function initialDiplomacyFavorForWukui(
  state: GameState,
  factionA: number,
  factionB: number,
): number {
  const wukuiFaction = currentWukuiFactionId(state);
  if (wukuiFaction == null) return 0;
  if (factionA === wukuiFaction || factionB === wukuiFaction) {
    return WUKUI_DIPLOMACY_INITIAL_FAVOR;
  }
  return 0;
}

export function isLvBuOfficerId(officerId: number): boolean {
  return officerId === LV_BU_OFFICER_ID;
}

/** 公平模式对阵中击败吕布者（取最后一局胜者） */
export function findPojunOfficerId(
  bracket: readonly (readonly TournamentMatch[])[],
  mode: 'unrestricted' | 'fair',
): number | null {
  if (mode !== 'fair') return null;
  let pojun: number | null = null;
  for (const round of bracket) {
    for (const match of round) {
      if (match.winnerId == null) continue;
      if (isLvBuOfficerId(match.fighterAId) && match.winnerId === match.fighterBId) {
        pojun = match.fighterBId;
      } else if (isLvBuOfficerId(match.fighterBId) && match.winnerId === match.fighterAId) {
        pojun = match.fighterAId;
      }
    }
  }
  return pojun;
}

export function currentPojunOfficerId(state: GameState): number | null {
  return state.tournament?.pojunOfficerId ?? null;
}

export function isCurrentPojun(state: GameState, officerId: number): boolean {
  return currentPojunOfficerId(state) === officerId;
}

export function currentPojunFactionId(state: GameState): number | null {
  const id = currentPojunOfficerId(state);
  if (id == null) return null;
  return state.officers[id]?.faction ?? null;
}

export function lvBuFactionId(state: GameState): number | null {
  return state.officers[LV_BU_OFFICER_ID]?.faction ?? null;
}

/** 破军 vs 吕布势力：新建外交初始友好 +5 */
export function initialDiplomacyFavorForPojun(
  state: GameState,
  factionA: number,
  factionB: number,
): number {
  const pojunFaction = currentPojunFactionId(state);
  const lvBuFaction = lvBuFactionId(state);
  if (pojunFaction == null || lvBuFaction == null) return 0;
  const pair = new Set([factionA, factionB]);
  if (pair.has(pojunFaction) && pair.has(lvBuFaction) && pojunFaction !== lvBuFaction) {
    return POJUN_DIPLOMACY_INITIAL_FAVOR;
  }
  return 0;
}

/** 新建外交链路初始友好：武魁/破军取较大值 */
export function initialDiplomacyFavorBonus(
  state: GameState,
  factionA: number,
  factionB: number,
): number {
  return Math.max(
    initialDiplomacyFavorForWukui(state, factionA, factionB),
    initialDiplomacyFavorForPojun(state, factionA, factionB),
  );
}

/**
 * 标准 16 人单败对阵（首轮）：
 * 1v16, 8v9, 5v12, 4v13, 3v14, 6v11, 7v10, 2v15
 */
export function buildOpeningBracket(fighters: TournamentFighter[]): TournamentMatch[] {
  const bySeed = new Map(fighters.map((f) => [f.seed, f]));
  const pairs: [number, number][] = [
    [1, 16], [8, 9], [5, 12], [4, 13],
    [3, 14], [6, 11], [7, 10], [2, 15],
  ];
  const matches: TournamentMatch[] = [];
  pairs.forEach(([sa, sb], matchIndex) => {
    const a = bySeed.get(sa);
    const b = bySeed.get(sb);
    if (!a || !b) return;
    matches.push({
      round: 0,
      matchIndex,
      fighterAId: a.officerId,
      fighterBId: b.officerId,
      narrativeLog: [],
    });
  });
  return matches;
}

/** 由上一轮胜者两两配对生成本轮对阵 */
export function buildNextRound(
  round: number,
  winnersInOrder: number[],
): TournamentMatch[] {
  const matches: TournamentMatch[] = [];
  for (let i = 0; i + 1 < winnersInOrder.length; i += 2) {
    matches.push({
      round,
      matchIndex: Math.floor(i / 2),
      fighterAId: winnersInOrder[i],
      fighterBId: winnersInOrder[i + 1],
      narrativeLog: [],
    });
  }
  return matches;
}

/**
 * 名次分层（不含冠亚）：四强败者 / 八强败者（05 §8.17.5）。
 * 标准 16 人：bracket[1]=八进四，bracket[2]=半决赛。
 */
export function tournamentPlacementLosers(
  bracket: readonly (readonly TournamentMatch[])[],
  championId: number,
  runnerUpId: number,
): { semifinalLosers: number[]; quarterfinalLosers: number[] } {
  const finalsExcluded = new Set([championId, runnerUpId]);
  const losersOf = (roundIdx: number): number[] => {
    const round = bracket[roundIdx];
    if (!round) return [];
    const out: number[] = [];
    for (const m of round) {
      if (m.winnerId == null) continue;
      const loser = m.fighterAId === m.winnerId ? m.fighterBId : m.fighterAId;
      if (!finalsExcluded.has(loser)) out.push(loser);
    }
    return out;
  };
  // 半决赛败者 = 四强（非冠亚）
  const semifinalLosers = losersOf(bracket.length >= 3 ? bracket.length - 2 : 2)
    .filter((id) => !finalsExcluded.has(id));
  // 八进四败者 = 止步八强
  const quarterfinalLosers = losersOf(1).filter(
    (id) => !finalsExcluded.has(id) && !semifinalLosers.includes(id),
  );
  return { semifinalLosers, quarterfinalLosers };
}

/**
 * 冠军所属势力部队士气 +delta（Army 按主将势力；CampaignArmy 按 factionId）。
 * 上限 100。
 */
export function boostFactionArmyMorale(
  state: GameState,
  factionId: number,
  delta: number,
): GameState {
  let changed = false;
  const armys = state.armys.map((army) => {
    const cmdFaction = state.officers[army.commanderId]?.faction;
    if (cmdFaction !== factionId) return army;
    changed = true;
    return {
      ...army,
      morale: Math.min(100, (army.morale ?? 50) + delta),
    };
  });
  const campaignArmies = state.campaignArmies.map((army) => {
    if (army.factionId !== factionId) return army;
    changed = true;
    return {
      ...army,
      morale: Math.min(100, (army.morale ?? 50) + delta),
    };
  });
  return changed ? { ...state, armys, campaignArmies } : state;
}
