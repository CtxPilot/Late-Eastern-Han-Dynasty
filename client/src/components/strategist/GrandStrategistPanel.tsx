// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 总军师面板（05 §十四 · §二十.2.6）
 *
 * 功能：
 * - 查看当前总军师信息
 * - 任命/解职总军师
 * - 切换态势（进攻/防守/发展/隐忍）
 * - 查看态势加成效果
 * - 查看战绩
 */
import { useEffect, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';

const STRATEGY_NAMES: Record<string, string> = {
  offense: '进攻',
  defense: '防守',
  development: '发展',
  endurance: '隐忍',
};

const STRATEGY_DESCS: Record<string, string> = {
  offense: '士气+5，粮耗-20%，AI出征概率×1.5',
  defense: '驻军效率+20%，建造速度+25%，AI出征×0.5',
  development: '内政效果+15%，征兵金耗-20%',
  endurance: '被宣战-30%，赠礼×1.5，计谋+10%',
};

export function GrandStrategistPanel() {
  const game = useGameStore((s) => s.game);
  const grandStrategist = useGameStore((s) => s.grandStrategist);
  const grandStrategistModifiers = useGameStore((s) => s.grandStrategistModifiers);
  const loading = useGameStore((s) => s.grandStrategistLoading);
  const grandStrategistRefresh = useGameStore((s) => s.grandStrategistRefresh);
  const grandStrategistAppoint = useGameStore((s) => s.grandStrategistAppoint);
  const grandStrategistDismiss = useGameStore((s) => s.grandStrategistDismiss);
  const grandStrategistSwitch = useGameStore((s) => s.grandStrategistSwitch);

  const [showAppoint, setShowAppoint] = useState(false);

  useEffect(() => {
    void grandStrategistRefresh();
  }, [grandStrategistRefresh]);

  if (!game) return null;

  const factionId = game.playerFactionId;
  const candidates = Object.values(game.officers).filter(
    (o) => o.faction === factionId
      && o.id !== grandStrategist?.officerId
      && (o.status as unknown as string) === 'ACTIVE'
      && o.stats.intelligence >= 85,
  );

  const gsOfficer = grandStrategist ? game.officers[grandStrategist.officerId] : null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-amber-400 border-b border-stone-700 pb-1">
        总军师
      </h3>

      {grandStrategist && gsOfficer ? (
        <div className="space-y-3">
          {/* 当前总军师信息 */}
          <div className="bg-stone-800 rounded p-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-amber-300 font-bold">{gsOfficer.name}</span>
              <span className="text-xs text-stone-400">
                智 {gsOfficer.stats.intelligence}
              </span>
            </div>
            <div className="text-xs text-stone-400">
              上任：{grandStrategist.appointedYear}年
            </div>
            <div className="flex gap-2 text-xs text-stone-400">
              <span>献策 {grandStrategist.adviceSuccess}次</span>
              <span>识破 {grandStrategist.insightCount}次</span>
              <span>总评 {grandStrategist.strategyScore}</span>
            </div>
          </div>

          {/* 当前态势 */}
          <div className="bg-stone-800 rounded p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-stone-400">当前态势</span>
              <span className="text-sm font-bold text-amber-300">
                {STRATEGY_NAMES[grandStrategist.strategy] ?? grandStrategist.strategy}
              </span>
            </div>
            <p className="text-xs text-stone-500 mb-2">
              {STRATEGY_DESCS[grandStrategist.strategy] ?? ''}
            </p>

            {/* 态势切换按钮 */}
            <div className="grid grid-cols-2 gap-1">
              {(['offense', 'defense', 'development', 'endurance'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={loading || s === grandStrategist.strategy}
                  className={`text-xs px-2 py-1 rounded ${
                    s === grandStrategist.strategy
                      ? 'bg-amber-900 text-amber-300'
                      : 'bg-stone-700 hover:bg-stone-600 text-stone-300'
                  } disabled:opacity-50`}
                  onClick={() => grandStrategistSwitch(s)}
                >
                  {STRATEGY_NAMES[s]}
                </button>
              ))}
            </div>
          </div>

          {/* 态势加成详情 */}
          {grandStrategistModifiers && (
            <div className="bg-stone-800 rounded p-2 text-xs text-stone-400 space-y-1">
              <div className="text-stone-500 mb-1">当前加成</div>
              {grandStrategistModifiers.moraleBonus > 0 && (
                <div className="flex justify-between"><span>士气加成</span><span className="text-green-400">+{grandStrategistModifiers.moraleBonus}</span></div>
              )}
              {grandStrategistModifiers.foodCostMult < 1 && (
                <div className="flex justify-between"><span>粮耗</span><span className="text-green-400">{Math.round((1 - grandStrategistModifiers.foodCostMult) * 100)}%↓</span></div>
              )}
              {grandStrategistModifiers.buildSpeed > 1 && (
                <div className="flex justify-between"><span>建造速度</span><span className="text-green-400">+{Math.round((grandStrategistModifiers.buildSpeed - 1) * 100)}%</span></div>
              )}
              {grandStrategistModifiers.siegeEfficiency > 1 && (
                <div className="flex justify-between"><span>围城效率</span><span className="text-green-400">+{Math.round((grandStrategistModifiers.siegeEfficiency - 1) * 100)}%</span></div>
              )}
              {grandStrategistModifiers.civilEffectBonus > 1 && (
                <div className="flex justify-between"><span>内政效果</span><span className="text-green-400">+{Math.round((grandStrategistModifiers.civilEffectBonus - 1) * 100)}%</span></div>
              )}
              {grandStrategistModifiers.stratagemChanceBonus > 0 && (
                <div className="flex justify-between"><span>计谋成功率</span><span className="text-green-400">+{Math.round(grandStrategistModifiers.stratagemChanceBonus * 100)}%</span></div>
              )}
            </div>
          )}

          {/* 解职 */}
          <button
            type="button"
            disabled={loading}
            className="w-full px-3 py-1.5 text-xs rounded bg-red-900 hover:bg-red-800 text-red-200 disabled:opacity-50"
            onClick={() => { if (window.confirm(`解职 ${gsOfficer.name}？`)) grandStrategistDismiss(); }}
          >
            解职总军师
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-stone-500">
            未任命总军师（策略效果 ×0.5）
          </div>

          {/* 候选人列表 */}
          <button
            type="button"
            className="w-full px-3 py-1.5 text-xs rounded bg-amber-900 hover:bg-amber-800 text-amber-200"
            onClick={() => setShowAppoint(!showAppoint)}
          >
            {showAppoint ? '收起候选人' : '任命总军师'}
          </button>

          {showAppoint && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {candidates.length === 0 ? (
                <div className="text-xs text-stone-500 py-2">无合适人选（需智力≥85）</div>
              ) : candidates.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={loading}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                  onClick={() => { void grandStrategistAppoint(o.id); setShowAppoint(false); }}
                >
                  <span>{o.name}</span>
                  <span className="text-stone-500">智 {o.stats.intelligence}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
