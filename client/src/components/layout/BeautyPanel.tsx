// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import { useMemo, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';
import { OfficerStatus } from '@leh/shared';

/**
 * S09 宫廷人脉：仅势力库存笼络
 * 历史女角/婚配见命令坞 FamilyOverviewDrawer（S18）
 */
export function BeautyPanel() {
  const game = useGameStore((s) => s.game);
  const rewardBeautyStock = useGameStore((s) => s.rewardBeautyStock);
  const loading = useGameStore((s) => s.loading);
  const [officerId, setOfficerId] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const error = useGameStore((s) => s.error);

  const officers = useMemo(() => {
    if (!game) return [];
    return Object.values(game.officers)
      .filter((o) => o.faction === game.playerFactionId && o.status === OfficerStatus.ACTIVE)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [game]);

  if (!game) return null;

  const stock = game.factions[game.playerFactionId]?.courtNetwork ?? 0;

  return (
    <div className="px-2 space-y-1.5" data-testid="beauty-panel">
      <div className="px-1 py-1 rounded border border-rose-900/40 bg-rose-950/20 text-xs">
        <span className="text-rose-300">宫廷人脉 {stock}</span>
        <span className="text-stone-500 ml-1">（交涉机会；非历史女角）</span>
        <p className="text-stone-600 mt-0.5 leading-snug">
          通过地方结交与战后接管获得；不可生成历史女角。
        </p>
        <div className="mt-1 flex gap-1 items-center">
          <select
            className="flex-1 rounded border border-stone-700 bg-stone-900 text-stone-200 text-xs px-1 py-0.5"
            value={officerId ?? ''}
            onChange={(e) =>
              setOfficerId(e.target.value ? Number(e.target.value) : null)
            }
            data-testid="beauty-stock-officer"
          >
            <option value="">赏赐武将…</option>
            {officers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} 忠{o.loyalty}
              </option>
            ))}
          </select>
          <InkButton
            type="button"
            data-testid="btn-reward-beauty-stock"
            disabled={loading || stock < 1 || officerId == null}
            className="px-2 py-0.5 rounded border border-rose-800 text-rose-100 disabled:opacity-40"
            title="耗 1 宫廷人脉，忠诚+12"
            onClick={() => setConfirmOpen(true)}
          >
            笼络×1
          </InkButton>
        </div>
      </div>
      <CommandConfirmDialog
        open={confirmOpen}
        category="人事"
        command={`确认动用人脉：${officerId != null ? game.officers[officerId]?.name ?? '未选武将' : '未选武将'}`}
        summary="动用宫廷人脉笼络一名武将，以提高忠诚。"
        items={[
          { label: '执行者', value: game.officers[game.factions[game.playerFactionId]?.rulerId]?.name ?? '君主' },
          { label: '目标', value: officerId != null ? game.officers[officerId]?.name ?? '—' : '—' },
          { label: '立即消耗', value: '宫廷人脉 1' },
          { label: '耗时', value: '立即生效' },
          { label: '主要收益', value: '忠诚 +12' },
        ]}
        loading={loading}
        error={error}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          const target = officerId == null ? null : latest?.officers[officerId];
          if (!latest || !target || target.faction !== latest.playerFactionId || target.status !== OfficerStatus.ACTIVE) return '赏赐目标已不处于本势力在职状态。';
          return (latest.factions[latest.playerFactionId]?.courtNetwork ?? 0) < 1
            ? '宫廷人脉不足（需1）。'
            : null;
        }}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          if (officerId == null) return;
          await rewardBeautyStock(officerId, 1);
          if (!useGameStore.getState().error) setConfirmOpen(false);
        }}
      />
    </div>
  );
}
