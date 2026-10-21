// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from '../ui/buttons';
import { useEffect, useState } from 'react';
import {
  TECH_BRANCHES,
  TECH_BRANCH_CONFIGS,
  type AvailableTechResearchResult,
  type TechBranch,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { gameApi } from '../../services/gateway';

export function TechResearchSection() {
  const game = useGameStore((state) => state.game);
  const loading = useGameStore((state) => state.loading);
  const startTechResearch = useGameStore((state) => state.startTechResearch);
  const cancelTechResearch = useGameStore((state) => state.cancelTechResearch);

  const [data, setData] = useState<AvailableTechResearchResult | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<TechBranch | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reloadData = async () => {
    if (!game) return;
    try {
      const res = await gameApi.getTechResearch(game.playerFactionId);
      setData(res);
      setErrorMsg(null);
      if (res.eligibleOfficers.length > 0 && selectedOfficerId == null) {
        setSelectedOfficerId(res.eligibleOfficers[0].id);
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '获取技艺研发数据失败');
    }
  };

  useEffect(() => {
    void reloadData();
  }, [game]);

  if (!game) return null;

  const handleStart = async (branch: TechBranch) => {
    if (!selectedOfficerId) return;
    await startTechResearch(branch, selectedOfficerId);
    setSelectedBranch(null);
    void reloadData();
  };

  const handleCancel = async () => {
    if (!window.confirm('确认中止当前研发？已付启动金不退，且研发进度将全部清空。')) {
      return;
    }
    await cancelTechResearch();
    void reloadData();
  };

  return (
    <section className="border-t border-stone-800 pt-3" data-testid="command-court-tech-research">
      <div className="flex items-center justify-between">
        <h3 className="text-xs tracking-widest text-amber-300">技艺与制度研发</h3>
        {data ? (
          <span className="text-[11px] text-stone-400">
            最高文化 {data.highestCulture} · 国库 {data.factionGold} 金
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-stone-500">
        依城池最高文化解锁研发门槛；指派学者驻府立项，每月推演并依据智谋政略加速进度。
      </p>

      {errorMsg ? (
        <div className="mt-2 border border-rose-900 bg-rose-950/30 p-2 text-xs text-rose-300">
          {errorMsg}
        </div>
      ) : null}

      {/* 正在研发的项目 */}
      {data?.activeResearch ? (
        <div
          className="mt-3 border border-amber-700/80 bg-amber-950/30 p-3 text-xs"
          data-testid="court-active-research-card"
        >
          <div className="flex items-center justify-between font-bold">
            <span className="text-amber-200">
              【推演中】{TECH_BRANCH_CONFIGS[data.activeResearch.branch]?.name} · Lv{data.activeResearch.targetLevel}
            </span>
            <span className="text-amber-400">
              {data.activeResearch.totalMonths - data.activeResearch.remainingMonths} / {data.activeResearch.totalMonths} 个月
            </span>
          </div>

          {/* 进度条 */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-stone-800">
            <div
              className="h-full bg-gradient-to-r from-amber-700 to-amber-400 transition-all"
              style={{
                width: `${Math.min(100, (((data.activeResearch.totalMonths - data.activeResearch.remainingMonths)) / Math.max(1, data.activeResearch.totalMonths)) * 100)}%`,
              }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-stone-400">
            <span>
              主持学者：
              <strong className="text-stone-200">
                {game.officers[data.activeResearch.assignedOfficerId]?.name ?? `武将#${data.activeResearch.assignedOfficerId}`}
              </strong>
              （智 {game.officers[data.activeResearch.assignedOfficerId]?.stats.intelligence ?? 0} / 政 {game.officers[data.activeResearch.assignedOfficerId]?.stats.politics ?? 0}）
            </span>
            <InkButton
              type="button"
              disabled={loading}
              onClick={handleCancel}
              className="border border-stone-700 bg-stone-900 px-2 py-0.5 text-stone-400 hover:text-stone-200"
            >
              中止研发
            </InkButton>
          </div>
        </div>
      ) : null}

      {/* 五大路线列表 */}
      <div className="mt-3 space-y-2">
        {data &&
          TECH_BRANCHES.map((branchKey) => {
            const opt = data.branches[branchKey];
            const config = TECH_BRANCH_CONFIGS[branchKey];
            const isSelecting = selectedBranch === branchKey;

            return (
              <div
                key={branchKey}
                data-testid={`tech-branch-card-${branchKey}`}
                className="border border-stone-800 bg-stone-900/40 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <strong className="text-stone-200">{config.name}</strong>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] ${
                        opt.currentLevel === opt.maxLevel
                          ? 'bg-amber-900/60 text-amber-200 border border-amber-600/50'
                          : opt.currentLevel > 0
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                            : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      Lv {opt.currentLevel} / {opt.maxLevel}
                    </span>
                  </div>

                  {opt.nextTier && !data.hasActiveResearch && !isSelecting ? (
                    <InkButton
                      type="button"
                      disabled={loading || !opt.canResearch}
                      onClick={() => {
                        setSelectedBranch(branchKey);
                        if (data.eligibleOfficers.length > 0 && selectedOfficerId == null) {
                          setSelectedOfficerId(data.eligibleOfficers[0].id);
                        }
                      }}
                      className="border border-amber-800/80 bg-amber-950/40 px-2.5 py-1 text-amber-200 hover:bg-amber-900/60 disabled:border-stone-800 disabled:text-stone-600 disabled:bg-transparent"
                    >
                      立项研发
                    </InkButton>
                  ) : null}
                </div>

                <p className="mt-1 text-stone-400 leading-tight">{config.description}</p>

                {/* 已激活特权摘要 */}
                {opt.currentLevel > 0 ? (
                  <div className="mt-1.5 text-emerald-400/90 leading-tight">
                    <span className="text-stone-500">已获特权：</span>
                    {config.tiers
                      .slice(0, opt.currentLevel)
                      .map((t) => t.name)
                      .join(' · ')}
                  </div>
                ) : null}

                {/* 下一等级门槛与特权 */}
                {opt.nextTier ? (
                  <div className="mt-2 border-t border-stone-800/60 pt-1.5 text-stone-400">
                    <div className="text-amber-100/90 font-medium">
                      下一阶：Lv{opt.nextTier.level} · {opt.nextTier.name}（{opt.nextTier.effect}）
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                      <span className={opt.culturePassed ? 'text-stone-400' : 'text-rose-400'}>
                        文化门槛：{opt.nextTier.cultureThreshold}
                        {opt.culturePassed ? ' ✓' : ` (差 ${opt.nextTier.cultureThreshold - opt.highestCulture})`}
                      </span>
                      <span className={opt.goldPassed ? 'text-stone-400' : 'text-rose-400'}>
                        首付金：{opt.initialGoldCost} 金
                        {opt.goldPassed ? ' ✓' : ` (差 ${opt.initialGoldCost - data.factionGold})`}
                      </span>
                      <span className="text-stone-400">基础工期：{opt.nextTier.months} 个月</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-stone-500 text-[11px]">此路线研发已达极峰。</div>
                )}

                {/* 立项指派学者内联面板 */}
                {isSelecting ? (
                  <div className="mt-2.5 border-t border-amber-900/50 bg-amber-950/20 p-2">
                    <label className="block text-[11px] text-stone-400 mb-1">
                      指派主持学者（以智略加速工期）：
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedOfficerId ?? ''}
                        onChange={(e) => setSelectedOfficerId(Number(e.target.value))}
                        className="flex-1 border border-stone-700 bg-stone-950 p-1 text-xs text-stone-200"
                      >
                        {data.eligibleOfficers.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}（智 {o.intelligence} / 政 {o.politics}）
                          </option>
                        ))}
                      </select>
                      <InkButton
                        type="button"
                        disabled={loading || !selectedOfficerId}
                        onClick={() => handleStart(branchKey)}
                        className="border border-amber-700 bg-amber-900/80 px-2.5 py-1 text-amber-100"
                      >
                        确认立项
                      </InkButton>
                      <InkButton
                        type="button"
                        disabled={loading}
                        onClick={() => setSelectedBranch(null)}
                        className="border border-stone-700 bg-stone-900 px-2 py-1 text-stone-400"
                      >
                        取消
                      </InkButton>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
      </div>
    </section>
  );
}
