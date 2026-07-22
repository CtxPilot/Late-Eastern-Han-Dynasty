// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * AI 计谋相位 S17：低权重尝试美人计/离间/假情报/空城疑兵
 * 设计真源 docs/04 §31
 *
 * 本文件中的 Math.random() 仅决定 S15 AI 是否行动、选择哪类计谋及目标；
 * 计谋的成功/识破/效果结算统一由 plot.ts 接受权威 resolution RNG。
 */
import { PlotType, type GameState } from '@leh/shared';
import { EMPTY_FORT_TROOP_MAX, launchPlot } from './plot.js';

function myActivePlotCount(state: GameState, factionId: number): number {
  return (state.plots ?? []).filter(
    (p) => p.casterFactionId === factionId && p.stage !== 'resolved',
  ).length;
}

export function aiPlotTurn(
  state: GameState,
  factionId: number,
  resolutionRng: () => number,
): GameState {
  let s = state;
  const faction = s.factions[factionId];
  if (!faction?.isAlive || faction.isPlayer) return s;

  if (myActivePlotCount(s, factionId) >= 2) return s;
  if (Math.random() > 0.35) return s;

  const myCities = Object.values(s.cities).filter((c) => c.ruler === factionId);
  if (myCities.length === 0) return s;

  const intel = s.intel;

  // 空城疑兵：寡兵己方城 + 粮≥150
  if (myActivePlotCount(s, factionId) < 2 && Math.random() < 0.4) {
    const weak = myCities.find(
      (c) => c.troops < EMPTY_FORT_TROOP_MAX && c.food >= 150,
    );
    if (weak) {
      try {
        s = launchPlot(s, {
          type: PlotType.EMPTY_FORT,
          factionId,
          targetCityId: weak.id,
        }, resolutionRng);
        return s;
      } catch {
        /* ignore */
      }
    }
  }

  // 假情报：detailed 敌城 + 金≥120
  if (myActivePlotCount(s, factionId) < 2 && Math.random() < 0.35) {
    const rich = myCities.find((c) => c.gold >= 120);
    if (rich) {
      const detailedEnemy = Object.entries(intel?.cities ?? {}).find(
        ([cityIdStr, report]) => {
          const cityId = Number(cityIdStr);
          const c = s.cities[cityId];
          return (
            report.depth === 'detailed' &&
            c?.ruler != null &&
            c.ruler !== factionId
          );
        },
      );
      if (detailedEnemy) {
        try {
          s = launchPlot(s, {
            type: PlotType.FALSE_INTEL,
            factionId,
            targetCityId: Number(detailedEnemy[0]),
          }, resolutionRng);
          return s;
        } catch {
          /* ignore */
        }
      }
    }
  }

  // 美人计
  if ((faction.beautyStock ?? 0) >= 2) {
    const richCity = myCities.find((c) => c.gold >= 150);
    if (richCity) {
      const detailedEnemy = Object.entries(intel?.cities ?? {}).find(
        ([cityIdStr, report]) => {
          const cityId = Number(cityIdStr);
          const c = s.cities[cityId];
          return (
            report.depth === 'detailed' &&
            c?.ruler != null &&
            c.ruler !== factionId
          );
        },
      );
      if (detailedEnemy) {
        try {
          s = launchPlot(s, {
            type: PlotType.HONEY_TRAP,
            factionId,
            targetCityId: Number(detailedEnemy[0]),
          }, resolutionRng);
        } catch {
          /* ignore */
        }
      }
    }
  }

  // 离间计
  const richForDiscord = myCities.find((c) => c.gold >= 200);
  if (richForDiscord && myActivePlotCount(s, factionId) < 2) {
    const enemies = Object.values(s.factions).filter(
      (f) => f.id !== factionId && f.isAlive,
    );
    if (enemies.length > 0) {
      const target = enemies[Math.floor(Math.random() * enemies.length)];
      try {
        s = launchPlot(s, {
          type: PlotType.SOW_DISCORD,
          factionId,
          targetFactionId: target.id,
        }, resolutionRng);
      } catch {
        /* ignore */
      }
    }
  }

  return s;
}

export function runAllAiPlots(state: GameState, resolutionRng: () => number): GameState {
  let s = state;
  for (const f of Object.values(s.factions)) {
    if (!f.isAlive || f.isPlayer) continue;
    s = aiPlotTurn(s, f.id, resolutionRng);
  }
  return s;
}
