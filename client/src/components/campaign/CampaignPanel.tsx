// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import { FORMATION_LABEL, type CampaignArmy } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { campaignArmyPhaseLabel } from './CampaignPanel.helpers';

const PHASE_LABEL: Record<string, string> = {
  marching: '行军',
  engaged: '野战',
  sieging: '围城',
  assaulting: '强攻',
  retreating: '撤退',
};

const UNIT_LABEL: Record<string, string> = {
  lightInfantry: '轻步',
  heavyInfantry: '重步',
  spearman: '长枪',
  archer: '弓',
  crossbowman: '弩',
  lightCavalry: '轻骑',
  heavyCavalry: '重骑',
  horseArcher: '骑射',
  lightNavy: '走舸',
  mediumNavy: '蒙冲',
  heavyNavy: '楼船',
};

/**
 * 战役层面板（05 §十三~§十七）
 * - Army 只读列表与详情；所有写军令已迁入“军事·军令”
 * - 战斗报告弹窗（自动结算结果）
 */
export function CampaignPanel() {
  const game = useGameStore((s) => s.game);
  const lastBattleResult = useGameStore((s) => s.lastBattleResult);
  const [selectedArmyId, setSelectedArmyId] = useState<string>('');
  const [showBattleReport, setShowBattleReport] = useState(false);

  const myArmies = useMemo<CampaignArmy[]>(() => {
    if (!game) return [];
    return game.campaignArmies.filter((a) => a.factionId === game.playerFactionId);
  }, [game]);

  const selectedArmy = myArmies.find((a) => a.id === selectedArmyId) ?? null;

  if (!game) return null;

  const currentNode = selectedArmy
    ? game.cities[selectedArmy.currentNodeId]
    : null;

  return (
    <div className="text-[11px] text-stone-300 leading-snug">
      <p className="px-3 py-1 text-[10px] text-stone-500 border-b border-stone-900">
        战役层军团只读摘要；编成与全部军令请使用底部命令坞“军事”。
      </p>

      {/* Army 列表 */}
      <div className="px-3 py-2 border-b border-stone-800">
        <div className="text-amber-400/80 font-medium mb-1">
          我军（{myArmies.length}）
        </div>
        {myArmies.length === 0 ? (
          <p className="text-stone-600">尚无出征军队</p>
        ) : (
          <div className="space-y-1">
            {myArmies.map((a) => {
              const cmd = game.officers[a.commanderId];
              const node = game.cities[a.currentNodeId];
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedArmyId(a.id)}
                  className={`w-full text-left px-2 py-1 rounded border text-[10px] ${
                    a.id === selectedArmyId
                      ? 'border-amber-500 bg-amber-950 text-amber-100'
                      : 'border-stone-800 bg-stone-900/80 text-stone-300 hover:border-stone-600'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-stone-500">
                      {campaignArmyPhaseLabel(game, a, PHASE_LABEL)}
                    </span>
                  </div>
                  <div className="text-stone-500 mt-0.5">
                    {node?.name ?? a.currentNodeId} · 兵{a.troops}/{a.maxTroops} · 粮{a.food} · 士{a.morale}
                    {cmd ? ` · ${cmd.name}` : ''}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 选中 Army 详情与操作 */}
      {selectedArmy && (
        <div className="px-3 py-2 border-b border-stone-800 space-y-1.5">
          <div className="text-amber-400/80 font-medium">{selectedArmy.name} 详情</div>
          <div className="text-stone-400">
            <div>主将：{game.officers[selectedArmy.commanderId]?.name}</div>
            {selectedArmy.subCommanderIds.length > 0 && (
              <div>副将：{selectedArmy.subCommanderIds.map((id) => game.officers[id]?.name).filter(Boolean).join('·')}</div>
            )}
            {selectedArmy.advisorId != null && (
              <div>参谋：{game.officers[selectedArmy.advisorId]?.name}</div>
            )}
            <div>
              兵种：{UNIT_LABEL[selectedArmy.unitType] ?? selectedArmy.unitType} · 阵型：{formationLabel(selectedArmy.formation)}
            </div>
            <div>位置：{currentNode?.name ?? selectedArmy.currentNodeId}</div>
            <div>兵力：{selectedArmy.troops}/{selectedArmy.maxTroops}</div>
            <div>粮草：{selectedArmy.food}/{selectedArmy.maxFood}</div>
            <div>
              士气 {bar(selectedArmy.morale, 100)} {selectedArmy.morale}
            </div>
            <div>
              组织 {bar(selectedArmy.organization, 100)} {selectedArmy.organization}
            </div>
            <div>
              疲劳 {bar(selectedArmy.fatigue, 100)} {selectedArmy.fatigue}
            </div>
            {selectedArmy.siegeState && (
              <div className="mt-1 text-rose-400/80">
                围城第 {selectedArmy.siegeState.siegeTurns} 回合
                · 城墙 {selectedArmy.siegeState.wallDurability}/{selectedArmy.siegeState.maxWallDurability}
              </div>
            )}
            {selectedArmy.structures.length > 0 && (
              <div className="mt-0.5 space-y-0.5">
                {selectedArmy.structures.map((s, i) => (
                  <div key={i} className="text-stone-400 text-[10px]">
                    {structLabel(s.type)}
                    {s.buildProgress < 1 ? (
                      <span className="text-amber-400/80 ml-1">
                        建造中 {Math.floor(s.buildProgress * 100)}%
                      </span>
                    ) : (
                      <span className="text-green-400/80 ml-1">已完工</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="pt-1 text-[10px] text-stone-600">此处不再提供状态变更按钮。</p>
        </div>
      )}

      {/* 战斗报告弹窗 */}
      {showBattleReport && lastBattleResult && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowBattleReport(false)}
        >
          <div
            className="bg-stone-950 border border-amber-900 rounded p-4 max-w-md w-full mx-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-amber-400 font-medium text-sm mb-2">
              {lastBattleResult.battlefield} · 自动结算
            </div>
            <div className="space-y-1 text-stone-300">
              <div>结果：<span className={lastBattleResult.winner === 'attacker' ? 'text-emerald-400' : 'text-rose-400'}>
                {lastBattleResult.winner === 'attacker' ? '攻方胜' : '守方胜'}
              </span></div>
              <div>回合数：{lastBattleResult.rounds}</div>
              <div>伤亡：攻 {lastBattleResult.attackerCasualties} / 守 {lastBattleResult.defenderCasualties}</div>
              <div>剩余：攻 {lastBattleResult.attackerRemaining} / 守 {lastBattleResult.defenderRemaining}</div>
              <div>俘获士兵：{lastBattleResult.prisoners}</div>
              {lastBattleResult.spoils.gold > 0 && (
                <div>缴获：金 {lastBattleResult.spoils.gold}，粮 {lastBattleResult.spoils.food}</div>
              )}
              {lastBattleResult.duels.length > 0 && (
                <div className="pt-1 border-t border-stone-800">
                  <div className="text-amber-400/80">单挑记录：</div>
                  {lastBattleResult.duels.map((d, i) => (
                    <div key={i} className="text-stone-400">{d.description}</div>
                  ))}
                </div>
              )}
              {lastBattleResult.events.length > 0 && (
                <div className="pt-1 border-t border-stone-800 max-h-32 overflow-y-auto">
                  <div className="text-amber-400/80">战斗事件：</div>
                  {lastBattleResult.events.map((e, i) => (
                    <div key={i} className="text-stone-500">
                      <span className="text-stone-600">[R{e.round}]</span> {e.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowBattleReport(false)}
              className="mt-3 w-full px-3 py-1.5 rounded border border-amber-700 text-amber-100 bg-amber-950/40 hover:bg-amber-900/40"
            >
              确认
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function bar(value: number, max: number): string {
  const pct = Math.max(0, Math.min(1, value / max));
  const filled = Math.round(pct * 8);
  return '█'.repeat(filled) + '░'.repeat(8 - filled);
}

function formationLabel(f: number): string {
  return FORMATION_LABEL[f] ?? `阵${f}`;
}

function structLabel(t: string): string {
  const labels: Record<string, string> = {
    camp: '营寨',
    ram: '冲车',
    ladder: '云梯',
    siege_tower: '井阑',
    catapult: '投石车',
    supply_depot: '粮仓',
    trap: '陷阱',
    watchtower: '瞭望塔',
    palisade: '栅栏',
    trench: '壕沟',
    pontoon_bridge: '浮桥',
  };
  return labels[t] ?? t;
}
