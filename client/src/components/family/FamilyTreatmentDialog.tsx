// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import type { FamilyTreatmentMode, GameState, PendingFamilyTreatment } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

const MODE_LABEL: Record<FamilyTreatmentMode, string> = {
  kindness: '善待',
  neutral: '中立',
  repression: '镇压',
};

const MODE_DESCRIPTION: Record<FamilyTreatmentMode, string> = {
  kindness: '本城民心 +10；相关旧主部队每季士气 −5，持续三季；叛乱概率 ×0.7。',
  neutral: '不追加处置效果；保留家属所在城失陷时已经发生的士气 −40。',
  repression: '本城民心 −20；相关旧主攻城战力 ×1.1；叛乱概率 ×1.5。',
};

export function FamilyTreatmentDialog() {
  const game = useGameStore((state) => state.game);
  const resolveFamilyTreatment = useGameStore((state) => state.resolveFamilyTreatment);
  const loading = useGameStore((state) => state.loading);
  const pending = game?.pendingFamilyTreatment;

  if (!game || !pending) return null;

  const choose = async (mode: FamilyTreatmentMode) => {
    try {
      await resolveFamilyTreatment(mode);
    } catch {
      // Store 已把服务端错误写入 TopBar；弹窗保持打开，等待修正或刷新。
    }
  };

  return (
    <FamilyTreatmentDialogView
      game={game}
      pending={pending}
      loading={loading}
      onChoose={choose}
    />
  );
}

export interface FamilyTreatmentDialogViewProps {
  game: GameState;
  pending: PendingFamilyTreatment;
  loading: boolean;
  onChoose: (mode: FamilyTreatmentMode) => Promise<void> | void;
}

export function FamilyTreatmentDialogView({
  game,
  pending,
  loading,
  onChoose,
}: FamilyTreatmentDialogViewProps) {
  const city = game.cities[pending.cityId];
  const previousFaction = game.factions[pending.previousFactionId];
  const affectedNames = pending.affectedCityIds
    .map((cityId) => game.cities[cityId]?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      data-testid="family-treatment-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-treatment-dialog-title"
    >
      <div
        className="w-full max-w-lg rounded border border-amber-800/70 bg-stone-900 shadow-xl"
        data-testid="family-treatment-dialog"
      >
        <header className="border-b border-amber-900/50 px-4 py-3">
          <h2 id="family-treatment-dialog-title" className="text-amber-300 font-semibold tracking-wide">
            家属质任 · {city?.name ?? `城${pending.cityId}`}
          </h2>
          <p className="mt-1 text-xs text-stone-400">
            {previousFaction?.name ?? '旧主'}留下的家属共 {pending.familyCount} 口。家属所在城失陷，相关驻军士气已 −40。
          </p>
          {affectedNames.length > 0 && (
            <p className="mt-1 text-xs text-stone-500">
              受牵连城：{affectedNames.join('、')}
            </p>
          )}
        </header>

        <div className="space-y-2 px-4 py-4">
          {(Object.keys(MODE_LABEL) as FamilyTreatmentMode[]).map((mode) => (
            <InkButton
              key={mode}
              type="button"
              data-testid={`family-treatment-${mode}`}
              disabled={loading}
              className="w-full rounded border border-amber-800/70 bg-stone-800/80 px-3 py-3 text-left text-amber-100 hover:border-amber-500 hover:bg-stone-800 disabled:opacity-50"
              onClick={() => void onChoose(mode)}
            >
              <span className="font-semibold">{MODE_LABEL[mode]}</span>
              <span className="mt-1 block text-xs leading-relaxed text-stone-400">
                {MODE_DESCRIPTION[mode]}
              </span>
            </InkButton>
          ))}
        </div>

        <footer className="border-t border-amber-900/40 px-4 py-3 text-xs text-stone-500">
          处置完成前不能结束回合；处置状态会随存档保存。
        </footer>
      </div>
    </div>
  );
}
