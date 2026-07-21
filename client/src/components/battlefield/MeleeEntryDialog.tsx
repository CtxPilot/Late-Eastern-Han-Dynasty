// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 白刃战入口三选弹窗（05 §20.3.1）
 * 两军同节点时弹出：自动结算 / 标准模式 / 微操
 *
 * 0-A：
 * - 微操模式受限（仅猛将对决/兵力差<20%/设置开启）
 */
import { useGameStore } from '../../stores/gameStore';

export function MeleeEntryDialog() {
  const melee = useGameStore((s) => s.melee);
  const game = useGameStore((s) => s.game);

  // 不在白刃战模式时不显示
  if (!melee || melee.phase !== 'active') return null;

  const atkArmy = game?.campaignArmies.find((a) => a.id === melee.attackerArmyId);
  const defArmy = game?.campaignArmies.find((a) => a.id === melee.defenderArmyId);
  const atkName = atkArmy?.name ?? '进攻方';
  const defName = defArmy?.name ?? '防守方';

  // 0-A 微操条件
  const atkTotalWar = atkArmy ? (game?.officers[atkArmy.commanderId]?.stats.war ?? 0) : 0;
  const defTotalWar = defArmy ? (game?.officers[defArmy.commanderId]?.stats.war ?? 0) : 0;
  const canMicro = (atkTotalWar + defTotalWar) >= 180
    || Math.abs((atkArmy?.troops ?? 0) - (defArmy?.troops ?? 0)) / Math.max(atkArmy?.troops ?? 1, defArmy?.troops ?? 1) < 0.2;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-stone-800 rounded-lg border border-stone-600 p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-bold text-amber-400 mb-2">白刃战</h3>
        <p className="text-sm text-stone-300 mb-4">
          {atkName} vs {defName}
        </p>

        <div className="space-y-3">
          <button
            type="button"
            className="w-full px-4 py-3 rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-left"
            onClick={() => {
              // 自动结算 → 直接 runMeleeRound 直到结束
              const store = useGameStore.getState();
              const autoResolve = async () => {
                for (let i = 0; i < 20; i++) {
                  await store.meleeRound('normal_attack');
                  const s = useGameStore.getState();
                  if (s.melee?.phase !== 'active') break;
                }
              };
              void autoResolve();
            }}
          >
            <div className="font-medium">⚡ 自动结算</div>
            <div className="text-xs text-stone-400">系统自动推演至分出胜负</div>
          </button>

          <button
            type="button"
            className="w-full px-4 py-3 rounded bg-amber-900 hover:bg-amber-800 text-amber-200 text-left"
            onClick={() => {
              // 标准模式 → 直接进入，已经在 melee screen
            }}
          >
            <div className="font-medium">⚔️ 标准模式</div>
            <div className="text-xs text-stone-400">选阵型 + 战术点决策，每回合手动操作</div>
          </button>

          {canMicro && (
            <button
              type="button"
              className="w-full px-4 py-3 rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-left"
              onClick={() => {
                // 微操模式 - 0-A 受限入口
              }}
            >
              <div className="font-medium">🎮 微操模式</div>
              <div className="text-xs text-stone-400">六角网格手动控制（仅特定条件开放）</div>
            </button>
          )}
        </div>

        <button
          type="button"
          className="mt-4 w-full px-3 py-2 text-sm rounded bg-stone-700 hover:bg-stone-600 text-stone-400"
          onClick={() => useGameStore.getState().meleeExit()}
        >
          暂不交战
        </button>
      </div>
    </div>
  );
}
