// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react';
import { gameApi } from '../../services/gateway';
import type * as api from '../../services/api';
import { useGameStore } from '../../stores/gameStore';

export function FactionOverviewDrawer({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<api.FactionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const buyArms = useGameStore((state) => state.buyArms);
  const storeError = useGameStore((state) => state.error);
  useEffect(() => {
    setLoading(true);
    void gameApi.getFactionOverview().then((d) => { setData(d); setLoading(false); }).catch((e) => { setError(e instanceof Error ? e.message : '加载失败'); setLoading(false); });
  }, [storeError]);
  if (loading) return <div className="p-4 text-stone-500 text-xs">加载势力总览…</div>;
  if (error) return <div className="p-4 text-red-400 text-xs">{error}</div>;
  if (!data) return null;
  const mandateColor = data.mandate >= 61 ? 'text-amber-300' : data.mandate >= 41 ? 'text-amber-500' : data.mandate >= 21 ? 'text-stone-400' : 'text-stone-600';
  const popularColor = data.popularWill >= 61 ? 'text-emerald-300' : data.popularWill >= 41 ? 'text-emerald-500' : data.popularWill >= 21 ? 'text-stone-400' : 'text-stone-600';
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-sm tracking-widest text-amber-400">{data.factionName} · 势力总览</h2>
      <section>
        <h3 className="mb-2 text-xs tracking-widest text-amber-500">天命值</h3>
        <div className="rounded border border-stone-800 bg-stone-900/50 p-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className={`text-lg font-bold ${mandateColor}`}>{data.mandate}</span>
            <span className="text-xs text-stone-400">{data.mandateLabel}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-stone-800">
            <div className="h-full rounded bg-gradient-to-r from-stone-700 via-amber-700 to-amber-400" style={{ width: `${data.mandate}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
            <span className="text-stone-500">外交修正：<span className={data.mandateDiplomacyModifier >= 0 ? 'text-emerald-400' : 'text-red-400'}>{(data.mandateDiplomacyModifier * 100).toFixed(0)}%</span></span>
            <span className="text-stone-500">郡县：{data.commanderyCount}</span>
          </div>
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-xs tracking-widest text-amber-500">人心值</h3>
        <div className="rounded border border-stone-800 bg-stone-900/50 p-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className={`text-lg font-bold ${popularColor}`}>{data.popularWill}</span>
            <span className="text-xs text-stone-400">{data.popularWillLabel}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-stone-800">
            <div className="h-full rounded bg-gradient-to-r from-stone-700 via-emerald-700 to-emerald-400" style={{ width: `${data.popularWill}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
            <span className="text-stone-500">叛逃修正：<span className={data.popularWillDesertionModifier <= 0 ? 'text-emerald-400' : 'text-red-400'}>{(data.popularWillDesertionModifier * 100).toFixed(0)}%</span></span>
            <span className="text-stone-500">募兵修正：<span className={data.popularWillRecruitModifier >= 0 ? 'text-emerald-400' : 'text-red-400'}>{(data.popularWillRecruitModifier * 100).toFixed(0)}%</span></span>
          </div>
        </div>
      </section>
      <section className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="rounded border border-stone-800 bg-stone-900/50 p-2 text-center">
          <div className="text-stone-400">城池</div>
          <div className="text-amber-200 font-bold">{data.cityCount}</div>
        </div>
        <div className="rounded border border-stone-800 bg-stone-900/50 p-2 text-center">
          <div className="text-stone-400">武将</div>
          <div className="text-amber-200 font-bold">{data.officerCount}</div>
        </div>
        <div className="rounded border border-stone-800 bg-stone-900/50 p-2 text-center">
          <div className="text-stone-400">郡县</div>
          <div className="text-amber-200 font-bold">{data.commanderyCount}</div>
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-xs tracking-widest text-amber-500">声望与兵装（S27）</h3>
        <div className="rounded border border-stone-800 bg-stone-900/50 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[10px] text-stone-500">声望</span>
                <span className={`text-sm font-bold ${fameColor(data.fame)}`}>{data.fame}<span className="text-[10px] text-stone-500">/1000</span></span>
              </div>
              <p className="text-[10px] text-stone-400">{data.fameLabel}</p>
              <p className="text-[10px] text-stone-500">≥300/600/900 投奔概率 +10%/+20%/+35%；每季 −2</p>
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[10px] text-stone-500">兵装</span>
                <span className="text-sm font-bold text-stone-200">{data.arms}<span className="text-[10px] text-stone-500">件</span></span>
              </div>
              <p className="text-[10px] text-stone-500">月产首都+8、城防≥150再+2；满配战力+5%、缺口过半−10%</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="faction-buy-arms"
            data-command-write="true"
            onClick={() => buyArms()}
            className="mt-2 w-full border border-amber-900 bg-amber-950/20 px-3 py-2 text-amber-100"
          >
            采购兵装 ×10
            <span className="mt-0.5 block text-[10px] text-stone-500">100金（10金/件）</span>
          </button>
        </div>
      </section>
      <button type="button" onClick={onClose} className="w-full px-3 py-1.5 rounded border border-stone-700 text-stone-400 text-xs hover:text-stone-200">关闭</button>
    </div>
  );
}

function fameColor(fame: number): string {
  if (fame >= 900) return 'text-amber-300';
  if (fame >= 600) return 'text-amber-400';
  if (fame >= 300) return 'text-amber-500';
  return 'text-stone-500';
}
