// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';

/**
 * S09 美女资源：仅势力库存赏赐
 * 历史女角/婚配见 FamilyPanel（S18）
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
      .filter((o) => o.faction === game.playerFactionId)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [game]);

  if (!game) return null;

  const stock = game.factions[game.playerFactionId]?.beautyStock ?? 0;

  return (
    <div className="px-2 space-y-1.5" data-testid="beauty-panel">
      <div className="px-1 py-1 rounded border border-rose-900/40 bg-rose-950/20 text-[10px]">
        <span className="text-rose-300">势力美女库存 {stock}</span>
        <span className="text-stone-500 ml-1">（像金；非历史女角）</span>
        <p className="text-stone-600 mt-0.5 leading-snug">
          右侧内政「寻访」获得；占城可抢夺。不可用于婚姻。
        </p>
        <div className="mt-1 flex gap-1 items-center">
          <select
            className="flex-1 rounded border border-stone-700 bg-stone-900 text-stone-200 text-[10px] px-1 py-0.5"
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
          <button
            type="button"
            data-testid="btn-reward-beauty-stock"
            disabled={loading || stock < 1 || officerId == null}
            className="px-2 py-0.5 rounded border border-rose-800 text-rose-100 disabled:opacity-40"
            title="耗 1 美女库存，忠诚+12"
            onClick={() => setConfirmOpen(true)}
          >
            赏赐×1
          </button>
        </div>
      </div>
      <CommandConfirmDialog
        open={confirmOpen}
        category="人事"
        command="赏赐美人"
        summary="从势力美女库存赏赐一人，以提高武将忠诚。"
        items={[
          { label: '执行者', value: game.officers[game.factions[game.playerFactionId]?.rulerId]?.name ?? '君主' },
          { label: '目标', value: officerId != null ? game.officers[officerId]?.name ?? '—' : '—' },
          { label: '立即消耗', value: '美女库存 1' },
          { label: '耗时', value: '立即生效' },
          { label: '主要收益', value: '忠诚 +12' },
        ]}
        loading={loading}
        error={error}
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
