// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useGameStore } from '../../stores/gameStore';

export function BattlefieldSceneView() {
  const inst = useGameStore((s) => s.battlefieldInstance);
  const engageJiangling = useGameStore((s) => s.engageJiangling);
  const popTo = useGameStore((s) => s.popToSceneFrame);
  const loading = useGameStore((s) => s.loading);
  const error = useGameStore((s) => s.error);
  if (!inst) return null;
  const jiangling = inst.nodeStates.find((n) => n.nodeId === inst.targetSeatNodeId);

  return (
    <div className="h-full flex flex-col bg-[#1a2218]">
      <div className="flex justify-between items-center px-4 py-2 border-b border-amber-900/50">
        <div>
          <div className="text-amber-400 text-sm">南郡战场 · {inst.targetCommanderyId}</div>
          <div className="text-stone-400 text-xs">郡治：江陵（守方据点 {jiangling?.garrison ?? 0} 兵 / 城 {jiangling?.wallDurability ?? 0}）· 入口：当阳、枝江</div>
        </div>
        <div className="flex gap-2">
          <button
            data-testid="btn-engage-jiangling"
            className="px-3 py-1.5 rounded bg-red-900 border border-red-600 text-sm text-red-50 hover:bg-red-800 disabled:opacity-40"
            disabled={loading}
            onClick={() => void engageJiangling()}
          >
            围攻江陵（六角接战）
          </button>
          <button
            data-testid="btn-exit-battlefield"
            className="px-3 py-1.5 rounded bg-stone-800 border border-stone-600 text-sm text-stone-200 hover:bg-stone-700"
            onClick={() => popTo('world')}
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
            return (
              <g key={n.nodeId} data-testid={`bf-node-${n.nodeId}`}>
                <circle
                  cx={n.localX} cy={n.localY}
                  r={isSeat ? 0.032 : 0.018}
                  fill={isSeat ? '#a21d24' : '#3a3a32'}
                  stroke={isSeat ? '#ffd700' : '#111'}
                  strokeWidth={isSeat ? 0.005 : 0.002}
                />
                <text
                  x={n.localX} y={n.localY - 0.04}
                  fontSize={0.024}
                  fill={isSeat ? '#ffd700' : '#cfc0a0'}
                  textAnchor="middle"
                  fontFamily="HanDynastySerif"
                >
                  {n.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="px-4 py-1 text-[10px] text-stone-500 border-t border-stone-800">
        模板 {inst.templateId} v{inst.templateVersion} · {inst.nodeStates.length} 县 / {inst.routeStates.length} 路线 · phase={inst.phase}
      </div>
    </div>
  );
}
