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
  // BF-P5 郡域迷雾：foggedNodeIds 由服务端 maskGameStateForPlayer 填充（仅下发投影，
  // 不写入存档）；旧档/未接入时无此字段 → 视为无迷雾。
  const foggedNodeIds = inst.foggedNodeIds ?? [];
  const seatFogged = foggedNodeIds.includes(inst.targetSeatNodeId);

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-[#171b14]">
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_16%_22%,rgba(200,181,125,.14),transparent_26%),repeating-linear-gradient(2deg,transparent_0,transparent_37px,rgba(218,200,148,.025)_38px,transparent_40px)]" />
      <div className="relative flex flex-wrap justify-between items-center gap-3 px-5 py-3 border-b border-amber-900/50 bg-[#171710]/90 shadow-[0_8px_25px_rgba(0,0,0,.3)]">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center border-2 border-red-800 font-[HanDynastySeal] text-xl text-red-500 rotate-[-3deg]">军</span>
            <div>
              <div className="text-[10px] tracking-[.35em] text-stone-500">郡域战争沙盘</div>
              <div className="text-amber-300 text-lg tracking-[.16em]">{commanderyName}战场 <span className="text-xs tracking-normal text-stone-500">{inst.targetCommanderyId}</span></div>
            </div>
          </div>
          <div className="text-stone-400 text-xs">
            郡治：{seat?.name}（守方据点 {seatFogged ? '未知' : seat?.garrison ?? 0} 兵 / 城 {seatFogged ? '未知' : seat?.wallDurability ?? 0}）
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
      <div className="relative flex-1 overflow-hidden m-3 border border-amber-950/70 bg-[#22261b] shadow-[inset_0_0_80px_rgba(0,0,0,.75)]">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(184,158,95,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(184,158,95,.08)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute left-3 top-3 z-10 border-l-2 border-amber-700 bg-black/55 px-3 py-2 text-[10px] text-stone-300 backdrop-blur-sm">
          <div className="mb-1 tracking-[.25em] text-amber-400">战场图例</div>
          <div className="flex gap-3"><span className="text-red-400">● 郡治</span><span className="text-green-400">● 已控</span><span className="text-stone-500">● 未明</span></div>
        </div>
        <div className="absolute right-3 bottom-3 z-10 bg-black/50 px-3 py-2 text-[10px] text-stone-400 backdrop-blur-sm">
          <span className="text-sky-400">━ 水道</span><span className="ml-3 text-amber-700">━ 驿路</span>
        </div>
        <svg viewBox="0 0 1 1" className="relative w-full h-full" preserveAspectRatio="xMidYMid meet">
          {inst.routeStates.map((r) => {
            const from = inst.nodeStates.find((n) => n.nodeId === r.fromNodeId);
            const to = inst.nodeStates.find((n) => n.nodeId === r.toNodeId);
            if (!from || !to) return null;
            return (
              <line
                key={r.routeId}
                x1={from.localX} y1={from.localY} x2={to.localX} y2={to.localY}
                stroke={r.type === 'river' ? '#487d92' : '#806a3f'}
                strokeWidth={r.type === 'river' ? 0.009 : 0.005}
                strokeDasharray={r.type === 'river' ? undefined : '0.012 0.009'}
                opacity={0.72}
              />
            );
          })}
          {inst.nodeStates.map((n) => {
            const isSeat = n.nodeId === inst.targetSeatNodeId;
            const isOwned = n.rulerFactionId === playerFactionId;
            const isFogged = foggedNodeIds.includes(n.nodeId);
            // BF-P5 郡域迷雾：未揭示县仅保留地理（可点攻占入口仍生效），
            // 驻军/占领高亮等军情不呈现。已揭示县维持原渲染。
            const isEngageable = !isFogged && isNanjun && firstBatch.includes(n.nodeId) && !isOwned;
            const fillColor = isFogged
              ? '#141a14'
              : isSeat
                ? '#a21d24'
                : isOwned
                  ? '#2d5a2d'
                  : firstBatch.includes(n.nodeId)
                    ? '#5a4a2a'
                    : '#3a3a32';
            const strokeColor = isFogged ? '#000' : isSeat ? '#ffd700' : isOwned ? '#4a8a4a' : '#111';
            return (
              <g
                key={n.nodeId}
                data-testid={`bf-node-${n.nodeId}`}
                style={isEngageable ? { cursor: 'pointer' } : undefined}
                onClick={isEngageable ? () => void engageCounty(n.nodeId) : undefined}
              >
                <circle
                  cx={n.localX} cy={n.localY}
                  r={isSeat ? 0.034 : 0.019}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSeat ? 0.006 : isOwned ? 0.004 : 0.002}
                />
                <text
                  x={n.localX} y={n.localY - 0.04}
                  fontSize={0.024}
                  fill={isFogged ? '#4a554a' : isSeat ? '#ffd700' : isOwned ? '#8aff8a' : '#cfc0a0'}
                  textAnchor="middle"
                  fontFamily="HanDynastySerif"
                >
                  {n.name}
                </text>
                {isOwned && !isFogged && (
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
                {isFogged && (
                  <text
                    x={n.localX} y={n.localY + 0.035}
                    fontSize={0.014}
                    fill="#5a6a5a"
                    textAnchor="middle"
                    fontFamily="HanDynastySerif"
                  >
                    ?
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="relative px-4 py-1 text-[10px] text-stone-500 border-t border-stone-800 bg-black/25">
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
