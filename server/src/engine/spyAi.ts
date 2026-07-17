// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * AI 谍报相位：与玩家共用 spy 引擎，规则权重决策
 */
import {
  DipRelation,
  SpyCaptiveAction,
  SpyMissionType,
  SpyStatus,
  emptyIntel,
  findDiplomacy,
  isAllied,
  playerCitiesAdjacentTo,
  type GameState,
} from '@leh/shared';
import {
  dispatchMission,
  recruitSpies,
  resolveCaptive,
  rosterCap,
  stationCounter,
  trainFemaleSpy,
} from './spy.js';
import { seekBeauty } from './beauty.js';

function ensureIntel(state: GameState) {
  return state.intel ?? emptyIntel();
}

function aliveCount(state: GameState, factionId: number): number {
  const intel = ensureIntel(state);
  return Object.values(intel.agents).filter(
    (a) => a.factionId === factionId && a.status !== SpyStatus.DEAD,
  ).length;
}

function idleAgents(state: GameState, factionId: number) {
  const intel = ensureIntel(state);
  return Object.values(intel.agents).filter(
    (a) =>
      a.factionId === factionId &&
      a.status === SpyStatus.IDLE &&
      a.cooldownMonths <= 0,
  );
}

function ownCities(state: GameState, factionId: number) {
  return Object.values(state.cities).filter((c) => c.ruler === factionId);
}

function hostileTo(state: GameState, a: number, b: number): boolean {
  const l = findDiplomacy(state.diplomacy, a, b);
  if (!l) return false;
  const r = l.relation as string;
  return r === DipRelation.WAR || r === 'war' || r === DipRelation.HOSTILE || r === 'hostile';
}

/**
 * 单个非玩家势力的谍报回合（可能修改 state）
 */
export function aiIntelTurn(state: GameState, factionId: number): GameState {
  let s = state;
  const faction = s.factions[factionId];
  if (!faction?.isAlive || faction.isPlayer) return s;

  const intel = ensureIntel(s);
  const myCities = ownCities(s, factionId);
  if (myCities.length === 0) return s;

  // 1) 处置俘虏
  const captives = Object.values(intel.agents).filter(
    (a) => a.status === SpyStatus.CAPTIVE && a.captiveByFactionId === factionId,
  );
  for (const cap of captives) {
    const r = Math.random();
    const action =
      r < 0.4
        ? SpyCaptiveAction.EXECUTE
        : r < 0.8
          ? SpyCaptiveAction.HOLD
          : SpyCaptiveAction.RELEASE;
    if (action === SpyCaptiveAction.HOLD) continue;
    try {
      s = resolveCaptive(s, cap.id, action, factionId);
    } catch {
      /* ignore */
    }
  }

  // 2) 边境/首都反间
  let idles = idleAgents(s, factionId);
  if (idles.length > 0) {
    const capital = s.cities[faction.capitalCityId];
    const border = myCities.find((c) => {
      const neighbors = playerCitiesAdjacentTo(
        Object.values(s.cities).map((x) => x.id),
        c.id,
      );
      // 邻接他方城
      return neighbors.some((nid) => {
        const n = s.cities[nid];
        return n && n.ruler != null && n.ruler !== factionId;
      });
    });
    const defTarget = border ?? capital;
    if (defTarget) {
      const def = ensureIntel(s).cityDefense[defTarget.id];
      if (!def?.stationAgentId) {
        try {
          s = stationCounter(s, idles[0].id, defTarget.id, factionId);
          idles = idleAgents(s, factionId);
        } catch {
          /* ignore */
        }
      }
    }
  }

  // 3) 招募
  const cap = rosterCap(s, factionId);
  if (aliveCount(s, factionId) < Math.max(1, Math.floor(cap / 2))) {
    const rich = myCities
      .filter((c) => c.gold >= 120 && c.food >= 60)
      .sort((a, b) => b.troops + (b.demographics?.adultMale ?? 0) - (a.troops + (a.demographics?.adultMale ?? 0)))[0];
    if (rich) {
      try {
        s = recruitSpies(s, rich.id, factionId);
      } catch {
        /* ignore */
      }
    }
  }

  // 3a) AI 寻访美女：beautyStock < 4 时尝试在有余量的城寻访（解 B-6 死锁）
  const faction2 = s.factions[factionId];
  if (faction2 && (faction2.beautyStock ?? 0) < 4 && Math.random() < 0.5) {
    const seekCity = myCities.find(
      (c) => (c.beautySeekLeft ?? 0) >= 1 && c.gold >= 60,
    );
    if (seekCity) {
      try {
        s = seekBeauty(s, seekCity.id, factionId);
      } catch {
        /* ignore */
      }
    }
  }

  // 3b) AI 训练女间谍：beautyStock ≥ 4 且有空编制时
  if (faction2 && (faction2.beautyStock ?? 0) >= 4 && aliveCount(s, factionId) < cap) {
    const richCity = myCities.find((c) => c.gold >= 100);
    if (richCity && Math.random() < 0.5) {
      try {
        s = trainFemaleSpy(s, richCity.id, factionId);
      } catch {
        /* ignore */
      }
    }
  }

  // 4) 进攻：邻接敌城
  idles = idleAgents(s, factionId);
  if (idles.length === 0) return s;

  const myIds = myCities.map((c) => c.id);
  const targets = Object.values(s.cities).filter((c) => {
    if (c.ruler == null || c.ruler === factionId) return false;
    if (isAllied(s.diplomacy, factionId, c.ruler)) return false;
    if (playerCitiesAdjacentTo(myIds, c.id).length === 0) return false;
    // 优先敌对/玩家
    const foe = c.ruler === s.playerFactionId || hostileTo(s, factionId, c.ruler);
    return foe || Math.random() < 0.3;
  });

  if (targets.length === 0) return s;

  const target = targets[Math.floor(Math.random() * targets.length)];
  const report = ensureIntel(s).cities[target.id];

  // 女间谍优先枕边风/离间；男特工探秘→破坏/刺杀
  const femaleIdle = idles.find((a) => a.agentKind === 'female');
  const maleIdle = idles.find((a) => a.agentKind !== 'female');

  let agent = idles[0];
  let type = SpyMissionType.RECON;
  if (femaleIdle && report?.depth === 'detailed' && Math.random() < 0.6) {
    agent = femaleIdle;
    type = Math.random() < 0.6 ? SpyMissionType.PILLOW_TALK : SpyMissionType.SOW_DISCORD;
  } else {
    agent = maleIdle ?? idles[0];
    if (report?.depth === 'detailed') {
      type =
        Math.random() < 0.7 ? SpyMissionType.SABOTAGE : SpyMissionType.ASSASSINATE;
    }
  }

  try {
    s = dispatchMission(s, {
      agentId: agent.id,
      type,
      targetCityId: target.id,
      factionId,
    });
  } catch {
    /* ignore */
  }

  return s;
}

/** 全部 AI 势力谍报相位 */
export function runAllAiIntel(state: GameState): GameState {
  let s = state;
  for (const f of Object.values(s.factions)) {
    if (!f.isAlive || f.isPlayer) continue;
    s = aiIntelTurn(s, f.id);
  }
  return s;
}
