// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { CityCounterIntel, SpyAgent, SpyMissionLog } from './spy.js';

/** 对单城的侦查报告 */
export interface CityIntelEntry {
  /** surface=兵力档+势力；detailed=兵力精确+经济约数 */
  depth: 'surface' | 'detailed';
  expireYear: number;
  expireMonth: number;
  source: 'scout' | 'spy' | 'battle' | 'recon';
}

export interface IntelState {
  /** 城池情报报告缓存 */
  cities: Record<number, CityIntelEntry>;
  /** 全势力特工（按 id） */
  agents: Record<string, SpyAgent>;
  /** 城级反间布防 */
  cityDefense: Record<number, CityCounterIntel>;
  nextAgentSeq: number;
  recentMissions: SpyMissionLog[];
  /**
   * 献美可点化额度：player 对 targetFaction 累计献美后可「点化」为女间谍的次数
   * key = targetFactionId, value = plantable count
   */
  plantableBeauty?: Record<number, number>;
}
