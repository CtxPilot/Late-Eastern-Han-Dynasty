// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import { Season } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { getFactionResourceTotals } from '../../utils/factionResources';
// 离线可玩版（Session 372）：槽位/信封走网关，离线时落 IndexedDB 与 Worker。
import { gameApi } from '../../services/gateway';
import type { SaveSlotMeta } from '../../services/api';
import { SealButton } from '../ui/buttons';
import { SealIcon } from '../ui/SealBadge';
import { cycleSfxVolume, getSfxVolume } from '../../utils/sfx';
import { useEffect, useRef, useState } from 'react';

const SEASON_LABEL: Record<number, string> = {
  [Season.SPRING]: '春',
  [Season.SUMMER]: '夏',
  [Season.AUTUMN]: '秋',
  [Season.WINTER]: '冬',
};

export function TopBar() {
  const game = useGameStore((s) => s.game);
  const loading = useGameStore((s) => s.loading);
  const error = useGameStore((s) => s.error);
  const endTurn = useGameStore((s) => s.endTurn);
  const screen = useGameStore((s) => s.screen);
  const openScenarioSelect = useGameStore((s) => s.openScenarioSelect);
  const importSave = useGameStore((s) => s.importSave);
  const saveToSlot = useGameStore((s) => s.saveToSlot);
  const loadFromSlot = useGameStore((s) => s.loadFromSlot);
  const fileInput = useRef<HTMLInputElement>(null);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [slotName, setSlotName] = useState('manual-1');
  const [slots, setSlots] = useState<SaveSlotMeta[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    if (!slotsOpen) return;
    setSlotsLoading(true);
    void gameApi.listSaveSlots().then(setSlots).catch(() => useGameStore.setState({ error: '读取存档槽位列表失败' })).finally(() => setSlotsLoading(false));
  }, [slotsOpen]);

  const refreshSlots = async () => {
    setSlots(await gameApi.listSaveSlots());
  };

  const handleSlotSave = async () => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/.test(slotName)) {
      useGameStore.setState({ error: '槽位名须为 1~32 位字母、数字、下划线或短横线' });
      return;
    }
    if (slots.some((slot) => slot.slot === slotName) && !window.confirm(`覆盖存档槽位「${slotName}」？`)) return;
    await saveToSlot(slotName);
    await refreshSlots();
  };

  const handleSlotLoad = async (slot: string) => {
    if (!window.confirm(`读取存档槽位「${slot}」？当前未保存进度将被替换。`)) return;
    await loadFromSlot(slot);
    setSlotsOpen(false);
  };

  if (!game) return null;

  const hasPendingEvent = (game.pendingEvents?.length ?? 0) > 0;
  const hasPendingFamilyTreatment = game.pendingFamilyTreatment != null;
  const hasBlockingDecision = hasPendingEvent || hasPendingFamilyTreatment;
  const faction = game.factions[game.playerFactionId];
  const { gold, food, troops, cityCount } = getFactionResourceTotals(
    game,
    game.playerFactionId,
  );

  const season = SEASON_LABEL[game.season] ?? '';

  const handleExport = async () => {
    try {
      const envelope = await gameApi.exportSave();
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `leh-${game.currentYear}-${String(game.currentMonth).padStart(2, '0')}.leh-save.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      useGameStore.setState({ error: '导出存档失败' });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await importSave(JSON.parse(await file.text()));
    } catch {
      useGameStore.setState({ error: '存档文件不是有效 JSON' });
    }
  };

  return (
    <header
      className="flex items-center gap-3 px-4 py-2 border-b border-amber-900/40 bg-gradient-to-b from-stone-900 to-stone-950 shrink-0 text-sm"
      data-testid="top-bar"
    >
      <h1 className="text-amber-400 font-semibold tracking-wide shrink-0">晚东汉末 · Demo</h1>
      <span className="text-stone-500">|</span>
      <span className="text-emerald-300/90 font-medium">{faction?.name ?? '—'}</span>
      <span className="text-stone-300">
        {game.currentYear}年 {season}
        {game.currentMonth}月
      </span>
      <span className="text-stone-500">|</span>
      <span className="flex items-center gap-1 text-amber-200/90" title="金">
        <SealIcon kind="gold" size={15} /> {gold.toLocaleString()}
      </span>
      <span className="flex items-center gap-1 text-lime-200/80" title="粮">
        <SealIcon kind="food" size={15} /> {food.toLocaleString()}
      </span>
      <span className="flex items-center gap-1 text-sky-200/80" title="兵力">
        <SealIcon kind="troops" size={15} /> {troops.toLocaleString()}
      </span>
      <span className="flex items-center gap-1 text-rose-200/80" title="宫廷人脉（势力库存）">
        <SealIcon kind="network" size={15} /> {faction?.courtNetwork ?? 0}
      </span>
      <span className="flex items-center gap-1 text-stone-500" title="城池数">
        <SealIcon kind="city" size={15} /> {cityCount}
      </span>
      <span className="flex-1" />
      <SfxToggle />
      {error && <span className="text-red-400 text-xs mr-2">{error}</span>}
      <InkButton
        type="button"
        className="px-2 py-1 rounded border border-stone-700 text-stone-300 hover:border-amber-700"
        onClick={openScenarioSelect}
      >
        更换剧本
      </InkButton>
      <InkButton
        type="button"
        data-testid="btn-save-export"
        className="px-2 py-1 rounded border border-stone-700 text-stone-300 hover:border-amber-700"
        onClick={() => void handleExport()}
      >
        导出存档
      </InkButton>
      <InkButton
        type="button"
        data-testid="btn-save-import"
        className="px-2 py-1 rounded border border-stone-700 text-stone-300 hover:border-amber-700"
        onClick={() => fileInput.current?.click()}
      >
        导入存档
      </InkButton>
      <InkButton
        type="button"
        data-testid="btn-save-slots"
        className="px-2 py-1 rounded border border-amber-800 text-amber-200 hover:border-amber-500"
        onClick={() => setSlotsOpen((open) => !open)}
      >
        槽位存档
      </InkButton>
      <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
      {slotsOpen && <div data-testid="save-slots-panel" className="absolute right-3 top-12 z-50 w-80 rounded border border-amber-800 bg-stone-950 p-3 shadow-xl">
        <div className="flex items-center justify-between mb-2"><span className="text-amber-300 font-semibold">系统存档槽位</span><InkButton type="button" className="text-stone-400" onClick={() => setSlotsOpen(false)}>×</InkButton></div>
        <div className="flex gap-2 mb-3"><input data-testid="save-slot-name" value={slotName} onChange={(e) => setSlotName(e.target.value)} maxLength={32} className="min-w-0 flex-1 rounded border border-stone-700 bg-stone-900 px-2 py-1 text-stone-200" /><InkButton type="button" data-testid="btn-save-slot" onClick={() => void handleSlotSave()} className="rounded bg-amber-900 px-2 py-1 text-amber-100">保存</InkButton></div>
        {slotsLoading ? <p className="text-xs text-stone-500">读取槽位…</p> : slots.length === 0 ? <p className="text-xs text-stone-500">暂无服务端槽位存档</p> : <div className="space-y-1">{slots.map((slot) => <div key={slot.slot} className="flex items-center gap-2 rounded border border-stone-800 px-2 py-1"><span className="min-w-0 flex-1 truncate text-sm text-stone-200">{slot.slot}<span className="ml-1 text-xs text-stone-500">{new Date(slot.updatedAt).toLocaleString()}</span></span><InkButton type="button" data-testid={`btn-load-slot-${slot.slot}`} onClick={() => void handleSlotLoad(slot.slot)} className="text-xs text-amber-300 hover:text-amber-100">读取</InkButton></div>)}</div>}
        <p className="mt-3 text-xs text-stone-600">服务端保存至 XDG 数据目录；覆盖与读取均需确认。</p>
      </div>}
      {screen === 'world' && (
        <SealButton
          data-testid="btn-end-turn"
          className="text-sm px-3 py-1.5"
          disabled={loading || hasBlockingDecision}
          reason={hasPendingEvent ? '请先处理待决事件' : hasPendingFamilyTreatment ? '请先处理家属处置' : undefined}
          onClick={() => void endTurn()}
        >
          {hasPendingEvent ? '待决事件…' : hasPendingFamilyTreatment ? '待处置家属…' : '结束回合'}
        </SealButton>
      )}
    </header>
  );
}


/** 音效音量循环开关（批次⑤余项 · Session 418）：静音→25%→60%→100%。 */
function SfxToggle() {
  const [vol, setVol] = useState(getSfxVolume());
  const label = vol === 0 ? '音效:静' : `音效:${Math.round(vol * 100)}%`;
  return (
    <button
      type="button"
      data-testid="btn-sfx-volume"
      title="循环切换音效音量"
      className="px-2 py-1 rounded border border-stone-700 text-stone-300 hover:border-amber-700"
      onClick={() => setVol(cycleSfxVolume())}
    >
      {label}
    </button>
  );
}
