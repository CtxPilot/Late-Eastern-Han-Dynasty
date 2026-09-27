// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { Season } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { getFactionResourceTotals } from '../../utils/factionResources';
import { gameApi } from '../../services/gateway';
import type { SaveSlotMeta } from '../../services/api';
import { InkButton, SealButton } from '../ui/buttons';
import { SealIcon } from '../ui/SealBadge';
import { StonePanel } from '../ui/StonePanel';
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
      className="flex items-center gap-3 px-4 py-2 border-b border-amber-900/50 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 shrink-0 text-sm select-none shadow-md relative z-30"
      data-testid="top-bar"
    >
      {/* 势力与卷首标题 */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="w-5 h-5 rounded grid place-items-center bg-seal-600 text-gold-200 font-seal text-xs border border-gold-400/60 shadow-sm"
          aria-hidden
        >
          漢
        </span>
        <h1 className="text-amber-400 font-bold tracking-wider font-song text-sm">晚东汉末</h1>
      </div>

      <span className="text-stone-600">|</span>

      {/* 当前阵营与纪年 */}
      <div className="flex items-center gap-2">
        <span className="text-emerald-300 font-medium px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 font-song text-xs">
          {faction?.name ?? '—'}
        </span>
        <span className="text-amber-100 font-song text-xs tracking-wide">
          {game.currentYear}年 · {season}{game.currentMonth}月
        </span>
      </div>

      <span className="text-stone-600">|</span>

      {/* 核心资源组 */}
      <div className="flex items-center gap-3 font-song text-xs">
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-900/80 border border-stone-800 text-amber-200" title="金帛府库">
          <SealIcon kind="gold" size={15} /> <span>{gold.toLocaleString()}</span>
        </span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-900/80 border border-stone-800 text-amber-100" title="军粮粟谷">
          <SealIcon kind="food" size={15} /> <span>{food.toLocaleString()}</span>
        </span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-900/80 border border-stone-800 text-rose-200" title="麾下甲兵">
          <SealIcon kind="troops" size={15} /> <span>{troops.toLocaleString()}</span>
        </span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-900/80 border border-stone-800 text-stone-300" title="宫廷人脉（势力库存）">
          <SealIcon kind="network" size={15} /> <span>{faction?.courtNetwork ?? 0}</span>
        </span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-900/80 border border-stone-800 text-stone-400" title="领辖城池">
          <SealIcon kind="city" size={15} /> <span>{cityCount}</span>
        </span>
      </div>

      <span className="flex-1" />

      {/* 操作按钮区 */}
      <div className="flex items-center gap-2">
        <SfxToggle />
        {error && <span className="text-red-400 text-xs px-2 py-0.5 rounded bg-red-950/60 border border-red-900">{error}</span>}
        <InkButton
          type="button"
          className="px-2 py-1 text-xs rounded border border-stone-700 bg-stone-900/80 text-stone-300 hover:border-amber-700 hover:text-amber-200"
          onClick={openScenarioSelect}
        >
          更换剧本
        </InkButton>
        <InkButton
          type="button"
          data-testid="btn-save-export"
          className="px-2 py-1 text-xs rounded border border-stone-700 bg-stone-900/80 text-stone-300 hover:border-amber-700 hover:text-amber-200"
          onClick={() => void handleExport()}
        >
          导出存档
        </InkButton>
        <InkButton
          type="button"
          data-testid="btn-save-import"
          className="px-2 py-1 text-xs rounded border border-stone-700 bg-stone-900/80 text-stone-300 hover:border-amber-700 hover:text-amber-200"
          onClick={() => fileInput.current?.click()}
        >
          导入存档
        </InkButton>
        <InkButton
          type="button"
          data-testid="btn-save-slots"
          className={`px-2 py-1 text-xs rounded border transition-colors ${
            slotsOpen
              ? 'border-amber-500 bg-amber-950 text-amber-100'
              : 'border-amber-800/80 bg-stone-900/80 text-amber-200 hover:border-amber-500'
          }`}
          onClick={() => setSlotsOpen((open) => !open)}
        >
          槽位存档
        </InkButton>
      </div>

      <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />

      {/* 槽位存档面板（升级为 StonePanel 装帧） */}
      {slotsOpen && (
        <div data-testid="save-slots-panel" className="absolute right-3 top-12 z-50 w-88 shadow-2xl ink-fade-in">
          <StonePanel
            title="内阁档案 · 槽位存档"
            goldBorder
            headerAction={
              <InkButton
                type="button"
                className="text-stone-400 hover:text-stone-200 text-sm px-1.5 py-0.5"
                onClick={() => setSlotsOpen(false)}
              >
                ✕
              </InkButton>
            }
          >
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  data-testid="save-slot-name"
                  value={slotName}
                  onChange={(e) => setSlotName(e.target.value)}
                  maxLength={32}
                  placeholder="输入槽位名称"
                  className="min-w-0 flex-1 rounded border border-stone-700 bg-stone-950 px-2.5 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-600"
                />
                <InkButton
                  type="button"
                  data-testid="btn-save-slot"
                  onClick={() => void handleSlotSave()}
                  className="rounded bg-amber-900 px-3 py-1 text-xs text-amber-100 hover:bg-amber-800 border border-amber-600 font-medium"
                >
                  保存
                </InkButton>
              </div>

              <div className="max-h-56 overflow-y-auto pr-0.5 space-y-1">
                {slotsLoading ? (
                  <p className="text-xs text-stone-500 py-2 text-center">读取槽位中…</p>
                ) : slots.length === 0 ? (
                  <p className="text-xs text-stone-500 py-2 text-center">暂无服务端槽位存档</p>
                ) : (
                  slots.map((slot) => (
                    <div
                      key={slot.slot}
                      className="flex items-center gap-2 rounded border border-stone-800 bg-stone-950/60 px-2.5 py-1.5 hover:border-amber-800/60"
                    >
                      <div className="min-w-0 flex-1 truncate">
                        <span className="text-xs text-stone-200 font-medium">{slot.slot}</span>
                        <span className="block text-[11px] text-stone-500">{new Date(slot.updatedAt).toLocaleString()}</span>
                      </div>
                      <InkButton
                        type="button"
                        data-testid={`btn-load-slot-${slot.slot}`}
                        onClick={() => void handleSlotLoad(slot.slot)}
                        className="text-xs text-amber-300 hover:text-amber-100 border border-amber-800/80 px-2 py-0.5 rounded bg-amber-950/40"
                      >
                        读取
                      </InkButton>
                    </div>
                  ))
                )}
              </div>

              <p className="text-[11px] text-stone-500 border-t border-stone-800 pt-2">
                服务端保存至 XDG 数据目录；覆盖与读取均需弹窗确认。
              </p>
            </div>
          </StonePanel>
        </div>
      )}

      {/* 结束回合主令按钮 */}
      {screen === 'world' && (
        <SealButton
          data-testid="btn-end-turn"
          className="text-sm px-3.5 py-1.5 ml-1"
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
    <InkButton
      type="button"
      data-testid="btn-sfx-volume"
      title="循环切换音效音量"
      className="px-2 py-1 text-xs rounded border border-stone-700 bg-stone-900/80 text-stone-300 hover:border-amber-700"
      onClick={() => setVol(cycleSfxVolume())}
    >
      {label}
    </InkButton>
  );
}
