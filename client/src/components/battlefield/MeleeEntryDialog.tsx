// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 白刃战入口三选弹窗（05 §20.3.1）
 * 两军同节点时弹出：自动结算 / 标准模式 / 六角微操。
 * 三者从同一权威交战快照选一，选定后不可切换。
 */
import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import { useGameStore } from '../../stores/gameStore';

export function MeleeEntryDialog() {
  const melee = useGameStore((s) => s.melee);
  const game = useGameStore((s) => s.game);

  // 不在白刃战模式时不显示
  if (!melee || melee.phase !== 'active' || melee.entryMode) return null;

  const atkArmy = game?.campaignArmies.find((a) => a.id === melee.attackerArmyId);
  const defArmy = game?.campaignArmies.find((a) => a.id === melee.defenderArmyId);
  const atkName = atkArmy?.name ?? '进攻方';
  const defName = defArmy?.name ?? '防守方';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-stone-800 rounded border border-stone-600 p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-bold text-amber-400 mb-2">白刃战</h3>
        <p className="text-sm text-stone-300 mb-4">
          {atkName} vs {defName}
        </p>

        <div className="space-y-3">
          <InkButton
            type="button"
            className="w-full px-4 py-3 rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-left"
            data-testid="melee-mode-auto"
            onClick={() => void useGameStore.getState().meleeSelectMode('auto')}
          >
            <div className="font-medium">⚡ 自动结算</div>
            <div className="text-xs text-stone-400">系统自动推演至分出胜负</div>
          </InkButton>

          <InkButton
            type="button"
            className="w-full px-4 py-3 rounded bg-amber-900 hover:bg-amber-800 text-amber-200 text-left"
            data-testid="melee-mode-standard"
            onClick={() => void useGameStore.getState().meleeSelectMode('standard')}
          >
            <div className="font-medium">⚔️ 标准模式</div>
            <div className="text-xs text-stone-400">选阵型 + 战术点决策，每回合手动操作</div>
          </InkButton>

          <InkButton
            type="button"
            className="w-full px-4 py-3 rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-left"
            data-testid="melee-mode-tactical"
            onClick={() => void useGameStore.getState().meleeSelectMode('tactical')}
          >
            <div className="font-medium">🎮 六角微操</div>
            <div className="text-xs text-stone-400">进入六角网格，移动、攻击、用计与单挑</div>
          </InkButton>
        </div>

        <InkButton
          type="button"
          className="mt-4 w-full px-3 py-2 text-sm rounded bg-stone-700 hover:bg-stone-600 text-stone-400"
          onClick={() => useGameStore.getState().meleeExit()}
        >
          暂不交战
        </InkButton>
      </div>
    </div>
  );
}
