// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 白刃战标准模式面板（05 §20.3 Tier II）
 *
 * 功能：
 * - 显示双方兵力/士气/阵型
 * - 阵型选择（回合内变阵消耗战术点）
 * - 战术点分配
 * - 回合执行与结果展示
 */
import { useState } from 'react';
import { FormationType } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

/** 战术动作中文名 */
const ACTION_NAMES: Record<string, string> = {
  normal_attack: '普通攻击',
  all_out_assault: '全军突击',
  hold_firm: '坚守',
  reorganize: '整顿',
  change_formation: '变阵',
  use_stratagem: '用计',
  initiate_duel: '发起单挑',
  retreat_prep: '撤退准备',
  counter_stratagem: '计略防御',
};

/** 阵型中文名 */
const FORMATION_NAMES: Record<number, string> = {
  [FormationType.SQUARE]: '方阵',
  [FormationType.CIRCLE]: '圆阵',
  [FormationType.WEDGE]: '锋矢',
  [FormationType.GOOSE]: '雁行',
  [FormationType.CRANE_WING]: '鹤翼',
  [FormationType.FISH_SCALE]: '鱼鳞',
  [FormationType.ARROWHEAD]: '冲阵',
  [FormationType.CRESCENT]: '偃月',
  [FormationType.LONG_SNAKE]: '长蛇',
  [FormationType.YOKE]: '衡轭',
  [FormationType.SPARSE]: '疏阵',
  [FormationType.DENSE]: '数阵',
  [FormationType.HOOK]: '钩形',
  [FormationType.MYSTERIOUS]: '玄襄',
  [FormationType.CHARIOT_WHEEL]: '车悬',
};

/** 可用战术动作列表（0-A 简化） */
const AVAILABLE_ACTIONS = [
  'normal_attack',
  'all_out_assault',
  'hold_firm',
  'reorganize',
] as const;

export function StandardModePanel() {
  const melee = useGameStore((s) => s.melee);
  const meleeLastResult = useGameStore((s) => s.meleeLastResult);
  const loading = useGameStore((s) => s.loading);
  const meleeRound = useGameStore((s) => s.meleeRound);
  const meleeExit = useGameStore((s) => s.meleeExit);

  const [selectedAction, setSelectedAction] = useState<string>('normal_attack');

  if (!melee) {
    return (
      <div className="text-stone-400 text-center py-8">
        没有活跃的白刃战
        <button
          type="button"
          className="block mx-auto mt-4 px-4 py-2 rounded bg-amber-900 hover:bg-amber-800 text-amber-200"
          onClick={() => meleeExit()}
        >
          返回战场地图
        </button>
      </div>
    );
  }

  if (melee.phase !== 'active') {
    const winner = melee.phase === 'attacker_victory' ? '进攻方' :
      melee.phase === 'defender_victory' ? '防守方' : '无';
    return (
      <div className="text-center py-8 space-y-4">
        <h3 className="text-2xl font-bold text-amber-400">战斗结束</h3>
        <p className="text-stone-300">
          {winner === '无' ? '双方僵持，各自收兵' : `${winner}胜利！`}
        </p>
        <p className="text-sm text-stone-400">
          共进行 {melee.round} 回合
        </p>
        <button
          type="button"
          className="px-4 py-2 rounded bg-amber-900 hover:bg-amber-800 text-amber-200"
          onClick={() => meleeExit()}
        >
          返回战场地图
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* 双方状态对比 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-950 border border-blue-800 rounded p-3">
          <h4 className="font-bold text-blue-300 mb-1">进攻方</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-400">兵力</span>
              <span>{melee.attackerTroops.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">士气</span>
              <span>{melee.attackerMorale}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">阵型</span>
              <span>{FORMATION_NAMES[melee.attackerFormation] ?? melee.attackerFormation}</span>
            </div>
          </div>
        </div>
        <div className="bg-red-950 border border-red-800 rounded p-3">
          <h4 className="font-bold text-red-300 mb-1">防守方</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-stone-400">兵力</span>
              <span>{melee.defenderTroops.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">士气</span>
              <span>{melee.defenderMorale}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">阵型</span>
              <span>{FORMATION_NAMES[melee.defenderFormation] ?? melee.defenderFormation}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 战术点信息 */}
      <div className="bg-stone-800 rounded p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-400">战术点</span>
          <span className="text-lg font-bold text-amber-400">
            {melee.tacticalPoints} / 10
          </span>
        </div>
        <div className="text-xs text-stone-500 mt-1">
          回合 {melee.round}/{melee.maxRounds}
        </div>
      </div>

      {/* 战术动作选择 */}
      <div>
        <h4 className="text-sm font-medium text-stone-400 mb-2">战术动作</h4>
        <div className="grid grid-cols-2 gap-2">
          {AVAILABLE_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              className={`px-3 py-2 rounded text-sm text-left ${
                selectedAction === action
                  ? 'bg-amber-900 border border-amber-600 text-amber-200'
                  : 'bg-stone-700 hover:bg-stone-600 text-stone-300'
              }`}
              onClick={() => setSelectedAction(action)}
            >
              {ACTION_NAMES[action] ?? action}
            </button>
          ))}
        </div>
      </div>

      {/* 执行按钮 */}
      <button
        type="button"
        disabled={loading || melee.tacticalPoints <= 0}
        className="w-full px-4 py-3 rounded font-bold text-base bg-amber-800 hover:bg-amber-700 disabled:bg-stone-700 disabled:text-stone-500 text-amber-200"
        onClick={() => {
          void meleeRound(selectedAction);
        }}
      >
        {loading ? '执行中…' : `执行回合（消耗3战术点）`}
      </button>

      {/* 回合结果展示 */}
      {meleeLastResult && (
        <div className="bg-stone-800 rounded p-3 space-y-2">
          <h4 className="font-bold text-amber-400 text-sm">第 {meleeLastResult.round} 回合结果</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-stone-400">进攻方损失：</span>
              <span className="text-red-300">{meleeLastResult.defenderDamage}</span>
            </div>
            <div>
              <span className="text-stone-400">防守方损失：</span>
              <span className="text-red-300">{meleeLastResult.attackerDamage}</span>
            </div>
          </div>
          <div className="text-xs text-stone-400 space-y-1">
            {meleeLastResult.events.map((ev, i) => (
              <p key={i}>{ev}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
