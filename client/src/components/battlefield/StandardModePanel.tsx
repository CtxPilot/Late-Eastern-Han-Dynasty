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
import { FORMATION_LABEL, FormationType } from '@leh/shared';
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

/** 可用战术动作列表（0-A 简化） */
const AVAILABLE_ACTIONS = [
  'normal_attack',
  'all_out_assault',
  'hold_firm',
  'reorganize',
] as const;

const ACTION_DETAILS: Record<(typeof AVAILABLE_ACTIONS)[number], { cost: number; note: string; seal: string }> = {
  normal_attack: { cost: 0, note: '稳步推进，保留战术点', seal: '击' },
  all_out_assault: { cost: 4, note: '攻势大增，阵脚易乱', seal: '突' },
  hold_firm: { cost: 2, note: '结阵御敌，稳住士气', seal: '守' },
  reorganize: { cost: 2, note: '整顿队列，恢复士气', seal: '整' },
};

const BASIC_FORMATIONS = [FormationType.SQUARE, FormationType.CIRCLE, FormationType.WEDGE, FormationType.GOOSE, FormationType.CRANE_WING, FormationType.ARROWHEAD] as const;
// FM-P3a 点值迁移后展示按 tiers[0] 点值 × 等价性换算（orderly ×1.0 基准）；组织度执行档运行时仅作用于正面增量。
// 数值不再来自 meleePercent；单一内容源 = formations.json。UI 阵型卡动态化留 FM-P4。
const FORMATION_NOTES: Partial<Record<FormationType, string>> = {
  [FormationType.SQUARE]: '攻+10% · 防+10% · 均衡', [FormationType.CIRCLE]: '攻-20% · 防+30% · 防御特化',
  [FormationType.WEDGE]: '攻+20% · 防-20% · 突破', [FormationType.GOOSE]: '防-10% · 远程展开',
  [FormationType.CRANE_WING]: '攻防持中 · 机动快', [FormationType.ARROWHEAD]: '攻+10% · 防-10% · 机动快',
};

// FM-P3 战术协同矩阵：战术名/克制的展示文案（数值唯一真源 = shared/data/tactical-system.v2.json，
// 战报 events 已输出数值，UI 不重复数值以避免第二来源）
const TACTICS: { id: import('@leh/shared').TacticalTacticId; name: string; desc: string }[] = [
  { id: 'assault', name: '强攻', desc: '克 方/圆/雁' },
  { id: 'hold', name: '固守', desc: '克 锋矢' },
  { id: 'ambush', name: '奇袭', desc: '克 鹤翼' },
];

export function StandardModePanel() {
  const melee = useGameStore((s) => s.melee);
  const meleeLastResult = useGameStore((s) => s.meleeLastResult);
  const loading = useGameStore((s) => s.loading);
  const meleeRound = useGameStore((s) => s.meleeRound);
  const meleeExit = useGameStore((s) => s.meleeExit);
  const meleeSetTactic = useGameStore((s) => s.meleeSetTactic);
  const game = useGameStore((s) => s.game);

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

  const attackerArmy = game?.campaignArmies.find((army) => army.id === melee.attackerArmyId);
  const defenderArmy = game?.campaignArmies.find((army) => army.id === melee.defenderArmyId);
  const selectedDetail = ACTION_DETAILS[selectedAction as keyof typeof ACTION_DETAILS] ?? ACTION_DETAILS.normal_attack;
  const canAfford = melee.tacticalPoints >= selectedDetail.cost;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="relative h-44 overflow-hidden border border-amber-950 bg-[#292116] shadow-[inset_0_0_60px_rgba(0,0,0,.8)]">
        <div className="absolute inset-0 opacity-70 [background:linear-gradient(176deg,transparent_0_38%,rgba(33,41,25,.9)_39%_55%,rgba(18,17,13,.95)_56%),radial-gradient(ellipse_at_50%_10%,rgba(208,174,100,.25),transparent_48%)]" />
        <div className="absolute left-[8%] bottom-5 flex gap-2 opacity-80">
          {[0, 1, 2, 3, 4].map((n) => <span key={n} className="block h-16 w-2 bg-stone-950 shadow-[12px_9px_0_#17120e]" />)}
        </div>
        <div className="absolute right-[8%] bottom-5 flex gap-2 opacity-80">
          {[0, 1, 2, 3, 4].map((n) => <span key={n} className="block h-16 w-2 bg-stone-950 shadow-[-12px_9px_0_#17120e]" />)}
        </div>
        <div className="absolute inset-x-0 top-8 flex items-center justify-center gap-5">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-emerald-800" />
          <span className="text-xs tracking-[.45em] text-amber-100/60">鼓角争鸣</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-red-800" />
        </div>
        <div className="absolute inset-x-8 bottom-7 flex items-end justify-between">
          <div className="border-l-4 border-emerald-700 pl-3">
            <div className="text-2xl text-emerald-200">{attackerArmy?.name ?? '进攻军'}</div>
            <div className="text-xs text-stone-400">列阵 · {FORMATION_LABEL[melee.attackerFormation] ?? melee.attackerFormation}</div>
          </div>
          <div className="font-[HanDynastySeal] text-5xl text-red-700/80">战</div>
          <div className="border-r-4 border-red-800 pr-3 text-right">
            <div className="text-2xl text-red-200">{defenderArmy?.name ?? '防守军'}</div>
            <div className="text-xs text-stone-400">据守 · {FORMATION_LABEL[melee.defenderFormation] ?? melee.defenderFormation}</div>
          </div>
        </div>
      </div>

      {/* 双方状态对比 */}
      <div className="grid grid-cols-2 gap-3 lg:gap-6">
        <div className="bg-emerald-950/30 border-l-4 border-emerald-800 p-4">
          <h4 className="font-bold text-emerald-300 mb-2">进攻方 · 前军</h4>
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
              <span>{FORMATION_LABEL[melee.attackerFormation] ?? melee.attackerFormation}</span>
            </div>
          </div>
        </div>
        <div className="bg-red-950/30 border-r-4 border-red-900 p-4">
          <h4 className="font-bold text-red-300 mb-2 text-right">后军 · 防守方</h4>
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
              <span>{FORMATION_LABEL[melee.defenderFormation] ?? melee.defenderFormation}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 战术点信息 */}
      <div className="border border-amber-900/50 bg-black/25 p-3">
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

      {/* 战术姿态（FM-P3：持久协同矩阵，不耗战术点） */}
      <div>
        <h4 className="text-sm font-medium text-stone-400 mb-2">战术姿态 <span className="text-[10px] text-amber-600">不耗战术点 · 克制敌方阵型时 ×1.1</span></h4>
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            disabled={loading || !melee.tactic}
            className={`border px-2 py-1.5 text-center text-xs ${!melee.tactic ? 'border-amber-500 bg-amber-950 text-amber-200' : 'border-stone-700 bg-stone-900/70 text-stone-400 hover:border-amber-800'}`}
            onClick={() => void meleeSetTactic(null)}
          >
            无
          </button>
          {TACTICS.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={loading || melee.tactic === t.id}
              className={`border px-2 py-1.5 text-left text-xs ${melee.tactic === t.id ? 'border-amber-500 bg-amber-950 text-amber-200' : 'border-stone-700 bg-stone-900/70 text-stone-300 hover:border-amber-800'}`}
              onClick={() => void meleeSetTactic(t.id)}
            >
              <span className="block font-medium">{t.name}</span>
              <span className="mt-0.5 block text-[9px] text-stone-500">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 战术动作选择 */}
      <div>
        <h4 className="text-sm font-medium text-stone-400 mb-2">阵型切换 <span className="text-[10px] text-amber-600">消耗 1 战术点并执行本回合</span></h4>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
          {BASIC_FORMATIONS.map((formation) => (
            <button
              key={formation}
              type="button"
              disabled={loading || melee.tacticalPoints < 1 || melee.attackerFormation === formation}
              className={`border p-2 text-left text-xs ${melee.attackerFormation === formation ? 'border-amber-500 bg-amber-950 text-amber-200' : 'border-stone-700 bg-stone-900/70 text-stone-300 hover:border-amber-800 disabled:opacity-40'}`}
              onClick={() => void meleeRound('change_formation', formation)}
            >
              <span className="block font-medium">{FORMATION_LABEL[formation]}</span>
              <span className="mt-1 block text-[9px] text-stone-500">{FORMATION_NOTES[formation]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 战术动作选择 */}
      <div>
        <h4 className="text-sm font-medium text-stone-400 mb-2">战术动作</h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {AVAILABLE_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              className={`group px-3 py-3 border text-sm text-left transition-colors ${
                selectedAction === action
                  ? 'bg-amber-950/80 border-amber-600 text-amber-100'
                  : 'bg-stone-900/70 border-stone-700 hover:border-stone-500 text-stone-300'
              }`}
              onClick={() => setSelectedAction(action)}
            >
              <span className="flex items-center justify-between">
                <span><b className="mr-2 font-[HanDynastySeal] text-red-500">{ACTION_DETAILS[action].seal}</b>{ACTION_NAMES[action] ?? action}</span>
                <span className="text-[10px] text-amber-500">{ACTION_DETAILS[action].cost} 点</span>
              </span>
              <span className="mt-1 block text-[10px] text-stone-500">{ACTION_DETAILS[action].note}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 执行按钮 */}
      <button
        type="button"
        disabled={loading || !canAfford}
        className="w-full px-4 py-3 border border-amber-600 font-bold tracking-[.2em] text-base bg-gradient-to-b from-amber-800 to-amber-950 hover:from-amber-700 disabled:border-stone-700 disabled:from-stone-800 disabled:to-stone-900 disabled:text-stone-500 text-amber-100"
        onClick={() => {
          void meleeRound(selectedAction);
        }}
      >
        {loading ? '军令传递中…' : canAfford ? `传令 · ${ACTION_NAMES[selectedAction] ?? selectedAction}（${selectedDetail.cost} 点）` : '战术点不足'}
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
