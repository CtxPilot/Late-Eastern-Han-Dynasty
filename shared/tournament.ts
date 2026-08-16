// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S19 单挑大会纯函数（选人 / 种子 / 对阵表）
 * 结算引擎在 server/engine/tournament.ts，复用 duel 全自动规则。
 */
import { OfficerStatus } from './enums/index.js';
import type { GameState } from './types/game.js';
import type { Officer } from './types/officer.js';
import type { TournamentFighter, TournamentMatch } from './types/tournament.js';

export const TOURNAMENT_SIZE = 16;
export const TOURNAMENT_MIN_WAR = 70;

/** 势力名额：大≥8→5 / 中4~7→3 / 小≤3→2；在野合计最多 1 */
export function tournamentQuotaForFaction(cityCount: number): number {
  if (cityCount >= 8) return 5;
  if (cityCount >= 4) return 3;
  return 2;
}

export function eligibleTournamentOfficers(state: GameState): Officer[] {
  return Object.values(state.officers).filter((o) => {
    if (o.status !== OfficerStatus.ACTIVE && o.status !== OfficerStatus.FREE) return false;
    if (o.stats.war < TOURNAMENT_MIN_WAR) return false;
    const maxStamina = Math.max(1, o.stamina); // 0-A：无独立 max 字段时用当前体力代理
    // 设计要求体力≥80%；若体力上限未知，以 stamina≥80 近似
    if (o.stamina < 80) return false;
    void maxStamina;
    return true;
  });
}

/**
 * 按势力名额抽选至多 16 人；不足时用全池武力补齐；超出截断。
 * 在野合计至多 1 人。
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

  for (const [key, list] of byFaction) {
    if (key === 'free') {
      const freePick = list[0];
      if (freePick && picked.length < TOURNAMENT_SIZE) {
        picked.push(freePick);
        pickedIds.add(freePick.id);
      }
      continue;
    }
    const cityCount = state.factions[key]?.cityIds?.length
      ?? Object.values(state.cities).filter((c) => c.ruler === key).length;
    const quota = tournamentQuotaForFaction(cityCount);
    for (const o of list.slice(0, quota)) {
      if (picked.length >= TOURNAMENT_SIZE) break;
      if (pickedIds.has(o.id)) continue;
      picked.push(o);
      pickedIds.add(o.id);
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

/** 种子：1=武力最高 …；返回带 seed 的 fighter 列表（已按种子位排序到 bracket 槽） */
export function seedTournamentFighters(officers: Officer[]): TournamentFighter[] {
  const ranked = [...officers].sort((a, b) => b.stats.war - a.stats.war || a.id - b.id);
  return ranked.map((o, index) => ({
    officerId: o.id,
    seed: index + 1,
    eliminated: false,
  }));
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
