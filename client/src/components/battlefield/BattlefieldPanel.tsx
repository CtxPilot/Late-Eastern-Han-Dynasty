// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 战场地图面板（05 §二十 Tier I + Tier II）
 *
 * 同时处理两种 screen：
 * - battlefield：战场地图视图（节点子集 + 操作）
 * - melee：白刃战标准模式视图（阵型 + 战术点 + 回合结算）
 */
import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import { useGameStore } from '../../stores/gameStore';
import { BattlefieldMapView } from './BattlefieldMapView';
import { MeleeStage } from '../battle/MeleeStage';

export function BattlefieldPanel() {
  const screen = useGameStore((s) => s.screen);
  const battlefield = useGameStore((s) => s.battlefield);

  if (screen === 'melee') {
    return <MeleeStage />;
  }

  if (!battlefield) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-stone-950 text-stone-400 gap-4">
        <p>没有活跃的战场</p>
        <InkButton
          type="button"
          className="px-4 py-2 rounded bg-amber-900 hover:bg-amber-800 text-amber-200"
          onClick={() => useGameStore.getState().battlefieldExit()}
        >
          返回大地图
        </InkButton>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-stone-950 text-stone-200">
      <div className="flex items-center justify-between px-4 py-2 bg-stone-900 border-b border-stone-700">
        <h2 className="text-lg font-bold text-amber-400">战场地图</h2>
        <div className="flex items-center gap-4 text-sm text-stone-400">
          <span>回合 {battlefield.turn}</span>
          <InkButton
            type="button"
            className="px-3 py-1 rounded bg-stone-700 hover:bg-stone-600"
            onClick={() => useGameStore.getState().battlefieldExit()}
          >
            撤兵
          </InkButton>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <BattlefieldMapView />
      </div>
    </div>
  );
}
