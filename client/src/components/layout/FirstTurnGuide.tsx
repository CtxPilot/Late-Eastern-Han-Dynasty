// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';

/**
 * 首回合引导（P0-2 · Session 407，`docs/40-game-evaluation.md`）：
 * 高亮式任务清单（非弹窗），引导新玩家走完「选城 → 内政指令 → 结束回合」第一圈。
 * 完成状态由 store 现场派生（选中城 / lastActionOk 变化 / 年月推进），
 * 不写存档字段；关闭状态记 localStorage，跨会话不再打扰。
 */

const DISMISS_KEY = 'leh-guide-first-turn-dismissed';

export function FirstTurnGuide() {
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const lastActionOk = useGameStore((s) => s.lastActionOk);
  const game = useGameStore((s) => s.game);

  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1',
  );
  // 基线：挂载时的行动回执与年月，用于判定「已做过一次指令」「已推进过回合」。
  const baselineAction = useRef<string | null>(lastActionOk);
  const baselineTurn = useRef<string>(
    game ? `${game.currentYear}-${game.currentMonth}` : '',
  );

  const stepCity = selectedCityId != null;
  const stepAction = lastActionOk != null && lastActionOk !== baselineAction.current;
  const turnNow = game ? `${game.currentYear}-${game.currentMonth}` : '';
  const stepTurn = turnNow !== '' && turnNow !== baselineTurn.current;
  const allDone = stepCity && stepAction && stepTurn;

  const steps = useMemo(
    () => [
      // 开局会自动选中都城（gameStore.startScenario 写入 capitalCityId），故第一步默认已完成。
      { done: stepCity, label: '查看己方城情：已自动选中都城（中央卡片可改点他城）' },
      { done: stepAction, label: '打开底部命令坞，完成一次内政指令' },
      { done: stepTurn, label: '点顶栏「结束回合」，推进月份' },
    ],
    [stepCity, stepAction, stepTurn],
  );

  useEffect(() => {
    if (allDone) {
      const t = setTimeout(() => localStorage.setItem(DISMISS_KEY, '1'), 1500);
      return () => clearTimeout(t);
    }
  }, [allDone]);

  if (dismissed || allDone) return null;

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,420px)] rounded border border-gold-400/70 bg-stone-950/95 p-3 shadow-xl"
      data-testid="first-turn-guide"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm text-gold-200 font-semibold">初定天下 · 首回合三事</p>
        <InkButton
          type="button"
          className="text-stone-500 hover:text-stone-300 text-sm leading-none"
          data-testid="guide-dismiss"
          aria-label="关闭引导"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1');
            setDismissed(true);
          }}
        >
          ×
        </InkButton>
      </div>
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li
            key={i}
            data-testid={`guide-step-${i + 1}`}
            className={`flex items-center gap-2 text-xs ${s.done ? 'text-emerald-300' : 'text-stone-300'}`}
          >
            <span
              className={`inline-flex w-4 h-4 shrink-0 items-center justify-center rounded-sm border text-xs ${
                s.done ? 'border-emerald-600 bg-emerald-950 text-emerald-300' : 'border-stone-600 text-stone-500'
              }`}
              aria-hidden
            >
              {s.done ? '✓' : i + 1}
            </span>
            {s.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
