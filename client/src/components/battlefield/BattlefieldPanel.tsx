// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 战场地图面板（05 §二十 Tier I + Tier II）
 *
 * 同时处理两种 screen：
 * - battlefield：战场地图视图（节点子集 + 操作）
 * - melee：白刃战标准模式视图（阵型 + 战术点 + 回合结算）
 */
import { useGameStore } from '../../stores/gameStore';
import { BattlefieldMapView } from './BattlefieldMapView';
import { StandardModePanel } from './StandardModePanel';

export function BattlefieldPanel() {
  const screen = useGameStore((s) => s.screen);
  const battlefield = useGameStore((s) => s.battlefield);

  if (screen === 'melee') {
    return (
      <div className="relative h-full flex flex-col overflow-hidden bg-[#15120d] text-stone-200">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_50%_15%,rgba(190,146,67,.28),transparent_32%),repeating-linear-gradient(93deg,transparent_0,transparent_48px,rgba(238,218,170,.035)_49px,transparent_51px)]" />
        <div className="relative flex items-center justify-between px-5 py-3 bg-[#211a11]/95 border-b border-amber-900/70 shadow-[0_8px_30px_rgba(0,0,0,.35)]">
          <div>
            <div className="text-[10px] tracking-[0.36em] text-stone-500">两军接阵 · 短兵相接</div>
            <h2 className="text-xl font-bold tracking-[0.18em] text-amber-300">
              白刃战 <span className="ml-2 text-xs tracking-normal text-amber-100/60">{useGameStore.getState().melee?.entryMode === 'auto' ? '自动结算' : '标准指挥'}</span>
            </h2>
          </div>
          <button
            type="button"
            className="px-4 py-1.5 text-sm border border-stone-600 bg-stone-900/80 hover:border-amber-700 hover:text-amber-200"
            onClick={() => useGameStore.getState().meleeExit()}
          >
            鸣金收兵
          </button>
        </div>
        <div className="relative flex-1 overflow-y-auto p-4 lg:p-6">
          <StandardModePanel />
        </div>
      </div>
    );
  }

  if (!battlefield) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-stone-950 text-stone-400 gap-4">
        <p>没有活跃的战场</p>
        <button
          type="button"
          className="px-4 py-2 rounded bg-amber-900 hover:bg-amber-800 text-amber-200"
          onClick={() => useGameStore.getState().battlefieldExit()}
        >
          返回大地图
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-stone-950 text-stone-200">
      <div className="flex items-center justify-between px-4 py-2 bg-stone-900 border-b border-stone-700">
        <h2 className="text-lg font-bold text-amber-400">战场地图</h2>
        <div className="flex items-center gap-4 text-sm text-stone-400">
          <span>回合 {battlefield.turn}</span>
          <button
            type="button"
            className="px-3 py-1 rounded bg-stone-700 hover:bg-stone-600"
            onClick={() => useGameStore.getState().battlefieldExit()}
          >
            撤兵
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <BattlefieldMapView />
      </div>
    </div>
  );
}
