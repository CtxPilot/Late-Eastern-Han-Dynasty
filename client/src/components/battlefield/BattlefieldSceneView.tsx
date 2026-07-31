// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { FIRST_BATCH_COUNTY_IDS, getCommanderyLabelByTemplateId, type DuelStance } from '@leh/shared';
import { DuelPanel } from '../battle/DuelPanel';

export function BattlefieldSceneView() {
  const inst = useGameStore((s) => s.battlefieldInstance);
  const game = useGameStore((s) => s.game);
  const engageJiangling = useGameStore((s) => s.engageJiangling);
  const engageCounty = useGameStore((s) => s.engageCounty);
  const exitNanjunBattlefield = useGameStore((s) => s.exitNanjunBattlefield);
  const loading = useGameStore((s) => s.loading);
  const error = useGameStore((s) => s.error);
  const startBattlefieldDuel = useGameStore((s) => s.startBattlefieldDuel);
  const stepBattlefieldDuel = useGameStore((s) => s.stepBattlefieldDuel);
  const skipBattlefieldDuel = useGameStore((s) => s.skipBattlefieldDuel);
  const closeBattlefieldDuel = useGameStore((s) => s.closeBattlefieldDuel);
  const [duelStance, setDuelStance] = useState<DuelStance>('delegate');
  if (!inst || !game) return null;
  const seat = inst.nodeStates.find((n) => n.nodeId === inst.targetSeatNodeId);
  const commanderyName = getCommanderyLabelByTemplateId(inst.templateId) ?? '未知郡';
  // 江陵席城按钮与首批可攻打县门禁仍为南郡专属（engageCounty 的 FIRST_BATCH_COUNTY_IDS
  // 全局门禁未按郡拆分），先按 templateId 识别；待 BF-P5 郡级可攻打清单落地后随目录迁移。
  const isNanjun = inst.templateId === 'nanjun-190';
  const playerFactionId = game.playerFactionId;
  const firstBatch = FIRST_BATCH_COUNTY_IDS as readonly string[];

  return (
    <div className="h-full flex flex-col bg-[#1a2218]">
      <div className="flex justify-between items-center px-4 py-2 border-b border-amber-900/50">
        <div>
          <div className="text-amber-400 text-sm">{commanderyName}战场 · {inst.targetCommanderyId}</div>
          <div className="text-stone-400 text-xs">
            郡治：{seat?.name}（守方据点 {seat?.garrison ?? 0} 兵 / 城 {seat?.wallDurability ?? 0}）
            {' · '}入口：{inst.entryNodeIds.map((id) => inst.nodeStates.find((node) => node.nodeId === id)?.name ?? id).join('、')}
          </div>
          {inst.dynamicSituation && (
            <div data-testid="bf-dynamic-situation" className="text-sky-200 text-xs">
              战况：{inst.dynamicSituation.weather === 'rain' ? '雨' : inst.dynamicSituation.weather === 'fog' ? '雾' : '晴'}
              {' · '}侦察 {inst.dynamicSituation.attackerScouted ? '有获' : '未获'}
              {' · '}伏击 {inst.dynamicSituation.ambush === 'none' ? '无' : inst.dynamicSituation.ambush === 'attacker' ? '我方' : '敌方'}
              {' · '}部署 {inst.dynamicSituation.deployments.length} 军
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <select
            data-testid="battlefield-duel-stance"
            value={duelStance}
            disabled={loading || !!inst.activeDuel}
            onChange={(event) => setDuelStance(event.target.value as DuelStance)}
            className="rounded border border-amber-800 bg-stone-900 px-2 text-xs text-amber-100"
            aria-label="单挑倾向"
          >
            <option value="delegate">委任</option>
            <option value="assault">强攻</option>
            <option value="steady">持重</option>
            <option value="bait">诱敌</option>
          </select>
          <button
            data-testid="btn-formation-front-duel"
            className="px-3 py-1.5 rounded bg-amber-950 border border-amber-700 text-sm text-amber-100 disabled:opacity-40"
            disabled={loading || !!inst.activeDuel}
            onClick={() => void startBattlefieldDuel('formation_front', inst.entryNodeIds[0], duelStance)}
          >
            阵前挑战
          </button>
          <button
            data-testid="btn-city-front-duel"
            className="px-3 py-1.5 rounded bg-red-950 border border-red-700 text-sm text-red-100 disabled:opacity-40"
            disabled={loading || !!inst.activeDuel}
            onClick={() => void startBattlefieldDuel('city_front', inst.targetSeatNodeId, duelStance)}
          >
            城下挑战
          </button>
          {isNanjun && <button
            data-testid="btn-engage-jiangling"
            className="px-3 py-1.5 rounded bg-red-900 border border-red-600 text-sm text-red-50 hover:bg-red-800 disabled:opacity-40"
            disabled={loading}
            onClick={() => void engageJiangling()}
          >
            围攻江陵（六角接战）
          </button>}
          <button
            data-testid="btn-exit-battlefield"
            className="px-3 py-1.5 rounded bg-stone-800 border border-stone-600 text-sm text-stone-200 hover:bg-stone-700 disabled:opacity-40"
            disabled={loading}
            onClick={() => void exitNanjunBattlefield()}
          >
            退出战场
          </button>
        </div>
      </div>
      {error && <div className="px-4 py-1 text-red-300 text-xs">{error}</div>}
      <div className="flex-1 relative overflow-hidden">
        <svg viewBox="0 0 1 1" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {inst.routeStates.map((r) => {
            const from = inst.nodeStates.find((n) => n.nodeId === r.fromNodeId);
            const to = inst.nodeStates.find((n) => n.nodeId === r.toNodeId);
            if (!from || !to) return null;
            return (
              <line
                key={r.routeId}
                x1={from.localX} y1={from.localY} x2={to.localX} y2={to.localY}
                stroke={r.type === 'river' ? '#3a6a8a' : '#5a4a2a'}
                strokeWidth={0.006}
                opacity={0.6}
              />
            );
          })}
          {inst.nodeStates.map((n) => {
            const isSeat = n.nodeId === inst.targetSeatNodeId;
            const isOwned = n.rulerFactionId === playerFactionId;
            const isEngageable = isNanjun && firstBatch.includes(n.nodeId) && !isOwned;
            const fillColor = isSeat
              ? '#a21d24'
              : isOwned
                ? '#2d5a2d'
                : firstBatch.includes(n.nodeId)
                  ? '#5a4a2a'
                  : '#3a3a32';
            const strokeColor = isSeat ? '#ffd700' : isOwned ? '#4a8a4a' : '#111';
            return (
              <g
                key={n.nodeId}
                data-testid={`bf-node-${n.nodeId}`}
                style={isEngageable ? { cursor: 'pointer' } : undefined}
                onClick={isEngageable ? () => void engageCounty(n.nodeId) : undefined}
              >
                <circle
                  cx={n.localX} cy={n.localY}
                  r={isSeat ? 0.032 : 0.018}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSeat ? 0.005 : isOwned ? 0.004 : 0.002}
                />
                <text
                  x={n.localX} y={n.localY - 0.04}
                  fontSize={0.024}
                  fill={isSeat ? '#ffd700' : isOwned ? '#8aff8a' : '#cfc0a0'}
                  textAnchor="middle"
                  fontFamily="HanDynastySerif"
                >
                  {n.name}
                </text>
                {isOwned && (
                  <text
                    x={n.localX} y={n.localY + 0.035}
                    fontSize={0.014}
                    fill="#8aff8a"
                    textAnchor="middle"
                    fontFamily="HanDynastySerif"
                  >
                    驻{n.garrison}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="px-4 py-1 text-[10px] text-stone-500 border-t border-stone-800">
        模板 {inst.templateId} v{inst.templateVersion} · {inst.nodeStates.length} 县 / {inst.routeStates.length} 路线 · RNG {inst.generationAudit.rngDrawStart}→{inst.generationAudit.rngDrawEnd} · phase={inst.phase}
      </div>
      {inst.activeDuel && (
        <DuelPanel
          duel={inst.activeDuel.duel}
          onStep={stepBattlefieldDuel}
          onSkip={skipBattlefieldDuel}
          onClose={closeBattlefieldDuel}
          resolveName={(officerId) => game.officers[officerId]?.name}
        />
      )}
    </div>
  );
}
