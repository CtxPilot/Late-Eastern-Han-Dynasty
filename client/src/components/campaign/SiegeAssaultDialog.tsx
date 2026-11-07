// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import React from 'react';
import {
  FORMATION_LABEL,
  troopLevelLabel,
  type GameState,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { siegeMergeLabel } from './CampaignPanel.helpers';
import { InkButton } from '../ui/buttons';
import { SealBadge } from '../ui/SealBadge';

export interface SiegeAssaultDialogProps {
  armyId?: string | null;
  game?: GameState;
  onClose?: () => void;
  onAssault?: (armyId: string) => Promise<void> | void;
  onStorm?: (armyId: string) => Promise<void> | void;
  onSurrender?: (armyId: string) => Promise<void> | void;
  onRetreat?: (armyId: string) => Promise<void> | void;
}

const STRUCTURE_NAMES: Record<string, string> = {
  camp: '营寨',
  ram: '冲车',
  ladder: '云梯',
  siege_tower: '井阑',
  catapult: '投石车',
  supply_depot: '粮仓',
  palisade: '栅栏',
  trench: '壕沟',
};

/**
 * S21-W6: 一级大地图围城决断弹窗（"是否攻城" modal）
 *
 * 规格：
 * - 仿 EventDialog 古籍奏报风格，围城状态触发；
 * - 详尽列示围城攻方与守方城池态势、攻城器械与守备耐久；
 * - 提供自动强攻、亲统登陴、劝降守军、围困待变与解围撤退五项大战略决断。
 */
export const SiegeAssaultDialog: React.FC<SiegeAssaultDialogProps> = ({
  armyId: propArmyId,
  game: propGame,
  onClose: propOnClose,
  onAssault: propOnAssault,
  onStorm: propOnStorm,
  onSurrender: propOnSurrender,
  onRetreat: propOnRetreat,
}) => {
  const storeGame = useGameStore((s) => s.game);
  const storeActiveArmyId = useGameStore((s) => s.activeSiegeArmyId);
  const storeClose = useGameStore((s) => s.closeSiegeDialog);
  const storeAssault = useGameStore((s) => s.campaignAssault);
  const storeStorm = useGameStore((s) => s.campaignSiegeStorm);
  const storeSurrender = useGameStore((s) => s.campaignSiegeSurrender);
  const storeRetreat = useGameStore((s) => s.campaignRetreat);
  const loading = useGameStore((s) => s.loading);

  const game = propGame ?? storeGame;
  const armyId = propArmyId !== undefined ? propArmyId : storeActiveArmyId;
  const onClose = propOnClose ?? storeClose;
  const onAssault = propOnAssault ?? storeAssault;
  const onStorm = propOnStorm ?? storeStorm;
  const onSurrender = propOnSurrender ?? storeSurrender;
  const onRetreat = propOnRetreat ?? storeRetreat;

  if (!game || !armyId) return null;

  const army = game.campaignArmies.find((a) => a.id === armyId);
  if (!army) return null;

  const targetCity = game.cities[army.currentNodeId] ?? (army.targetNodeId ? game.cities[army.targetNodeId] : null);
  const atkFaction = game.factions[army.factionId];
  const defFaction = targetCity?.ruler != null ? game.factions[targetCity.ruler] : null;
  const commander = game.officers[army.commanderId];
  const advisor = army.advisorId ? game.officers[army.advisorId] : null;
  const mergeInfo = siegeMergeLabel(game, army);
  const formationName = FORMATION_LABEL[army.formation] ?? '军阵';

  const wallVal = targetCity?.stats?.wall ?? 100;
  const wallMax = Math.max(100, targetCity?.initialStats?.wall ?? 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
      data-testid="siege-assault-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="siege-dialog-title"
    >
      <div
        className="w-full max-w-2xl rounded border border-amber-800/80 bg-stone-950/98 shadow-[0_16px_48px_rgba(0,0,0,0.85)] overflow-hidden motion-safe:animate-[ink-fade-in_180ms_ease-out]"
        data-testid="siege-assault-dialog"
      >
        {/* 顶部标题与关防印信 */}
        <header className="border-b border-amber-900/60 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 px-5 py-3.5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-xs text-amber-500 font-song tracking-widest">
                军机急报 · 围城决断
              </span>
            </div>
            <h2
              id="siege-dialog-title"
              className="text-lg md:text-xl text-amber-200 font-semibold tracking-wider font-seal flex items-center gap-2"
            >
              兵临城下 · {targetCity?.name ?? '敌城'}之围
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <SealBadge char="围" color="military" size={22} title="围困中" />
            <span className="text-xs text-rose-400 font-song font-medium">围困中</span>
            <button
              type="button"
              data-testid="siege-dialog-close"
              className="text-stone-500 hover:text-amber-300 p-1 rounded hover:bg-stone-800/60 transition-colors"
              onClick={onClose}
              aria-label="关闭弹窗"
            >
              ✕
            </button>
          </div>
        </header>

        {/* 军事情报对比面 */}
        <div className="p-5 space-y-4 text-xs font-song">
          {/* 合流提示 */}
          {mergeInfo && (
            <div className="rounded bg-amber-950/40 border border-amber-800/50 p-2.5 text-amber-300 flex items-center gap-2">
              <span className="text-amber-500 font-bold">【合流】</span>
              <span>{mergeInfo}，势如破竹！</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 攻方军团情报 */}
            <div className="rounded border border-stone-800 bg-stone-900/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <span className="text-amber-400 font-semibold tracking-wider flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded"
                    style={{ backgroundColor: atkFaction?.color ?? '#eab308' }}
                  />
                  攻城军：{army.name}
                </span>
                <span className="text-stone-400">
                  {commander?.name ?? '主帅'} 统领
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-stone-300">
                <div>兵力：<span className="text-amber-300 font-medium">{army.troops.toLocaleString()}</span> / {army.maxTroops.toLocaleString()}</div>
                <div>军粮：<span className="text-stone-300">{army.food.toLocaleString()}</span></div>
                <div>士气：<span className="text-amber-300">{army.morale}</span></div>
                <div>战阵：<span className="text-stone-300">{formationName}</span></div>
                <div>军阶：<span className="text-stone-300">{troopLevelLabel(army.experience ?? 0)}</span></div>
                <div>参谋：<span className="text-stone-300">{advisor?.name ?? '无'}</span></div>
              </div>

              {/* 攻城设施 */}
              <div className="pt-1.5 border-t border-stone-800/60 text-stone-400">
                <span>攻具构筑：</span>
                {army.structures.length > 0 ? (
                  <span className="text-amber-300 ml-1">
                    {army.structures.map((s) => STRUCTURE_NAMES[s.type] ?? s.type).join('、')}
                  </span>
                ) : (
                  <span className="text-stone-500 ml-1">暂无大型攻城重器（可扎营构筑）</span>
                )}
              </div>
            </div>

            {/* 守方城池情报 */}
            <div className="rounded border border-stone-800 bg-stone-900/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                <span className="text-rose-400 font-semibold tracking-wider flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded"
                    style={{ backgroundColor: defFaction?.color ?? '#ef4444' }}
                  />
                  守备城：{targetCity?.name ?? '目标治所'}
                </span>
                <span className="text-stone-400">
                  {defFaction?.name ?? '防守方'}
                </span>
              </div>
              {targetCity ? (
                <div className="grid grid-cols-2 gap-2 text-stone-300">
                  <div>常备军：<span className="text-rose-300 font-medium">{targetCity.troops.toLocaleString()}</span></div>
                  <div>储备粮：<span className="text-stone-300">{targetCity.food.toLocaleString()}</span></div>
                  <div>城防固度：<span className="text-amber-300 font-medium">{wallVal}</span> / {wallMax}</div>
                  <div>驻军士气：<span className="text-stone-300">{targetCity.troopsMorale ?? 70}</span></div>
                </div>
              ) : (
                <div className="text-stone-500 py-4 text-center">城池处于重重战雾中，详况未明</div>
              )}

              {/* 城防血条 */}
              {targetCity && (
                <div className="pt-1.5 border-t border-stone-800/60 space-y-1">
                  <div className="flex justify-between text-[11px] text-stone-400">
                    <span>城垛堞堞防线</span>
                    <span>{Math.round((wallVal / wallMax) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-600 to-rose-600 rounded-full"
                      style={{ width: `${Math.min(100, Math.round((wallVal / wallMax) * 100))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-stone-500 italic text-center">
            围城日久，敌城军心民气日削；若强登女墙，恐伤亡枕藉。请主帅明察秋毫，善度行止。
          </p>
        </div>

        {/* 战略决策按钮栏 */}
        <footer className="border-t border-amber-900/60 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {/* 自动强攻 */}
            <InkButton
              type="button"
              className="px-3.5 py-1.5 text-xs bg-rose-950/80 border border-rose-800 text-rose-200 hover:bg-rose-900"
              data-testid="siege-action-assault"
              disabled={loading}
              onClick={() => onAssault(army.id)}
            >
              挥军强攻
            </InkButton>

            {/* 亲统登陴 (六角沙盘) */}
            <InkButton
              type="button"
              className="px-3.5 py-1.5 text-xs bg-stone-900/90 border border-amber-800/80 text-amber-300 hover:bg-amber-950/60"
              data-testid="siege-action-storm"
              disabled={loading}
              onClick={() => onStorm(army.id)}
            >
              亲统登陴（战术攻城）
            </InkButton>

            {/* 劝降守将 */}
            <InkButton
              type="button"
              className="px-3.5 py-1.5 text-xs bg-stone-900/90 border border-stone-700 text-stone-300 hover:bg-stone-800"
              data-testid="siege-action-surrender"
              disabled={loading}
              onClick={() => onSurrender(army.id)}
            >
              传檄劝降
            </InkButton>
          </div>

          <div className="flex items-center gap-2">
            {/* 解围撤退 */}
            <InkButton
              type="button"
              className="px-3.5 py-1.5 text-xs bg-stone-900/90 border border-stone-700 text-stone-300 hover:bg-stone-800"
              data-testid="siege-action-retreat"
              disabled={loading}
              onClick={() => onRetreat(army.id)}
            >
              解围班师
            </InkButton>

            {/* 保持围困待变 */}
            <InkButton
              type="button"
              className="px-3.5 py-1.5 text-xs bg-amber-950/80 border border-amber-700 text-amber-200 hover:bg-amber-900"
              data-testid="siege-action-hold"
              onClick={onClose}
            >
              围困待变
            </InkButton>
          </div>
        </footer>
      </div>
    </div>
  );
};
