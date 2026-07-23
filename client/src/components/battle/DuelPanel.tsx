// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useState } from 'react';
import type { DuelState } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

/**
 * 单挑演出面板 (§8.12) — 全自动结算, 玩家只观看.
 * 速度模式: full(逐回合) / fast(快速) / skip(只看结果).
 */
export function DuelPanel({ duel }: { duel: DuelState }) {
  const game = useGameStore((s) => s.game);
  const duelStep = useGameStore((s) => s.duelStep);
  const duelSkip = useGameStore((s) => s.duelSkip);
  const [mode, setMode] = useState<'full' | 'fast' | 'skip'>('full');
  const [idx, setIdx] = useState(0);

  const battle = useGameStore((s) => s.battle);
  const commanderName = (officerId: number) =>
    battle?.units.find((unit) => unit.commanderId === officerId)?.commanderName ??
    game?.officers[officerId]?.name;
  const challengerName = commanderName(duel.challengerId) ?? '挑战方';
  const defenderName = commanderName(duel.defenderId) ?? '应战方';
  const rounds = duel.roundHistory;
  const shownRound = rounds[Math.min(idx, rounds.length - 1)];
  const resolved = duel.phase === 'resolved' && !!duel.result;

  // full 模式: 跟随最新回合; fast/skip: 自动推进/跳过
  useEffect(() => {
    if (duel.phase !== 'dueling') return;
    if (mode === 'skip') {
      void duelSkip();
      return;
    }
    if (mode === 'fast') {
      const t = setTimeout(() => void duelStep(), 600);
      return () => clearTimeout(t);
    }
    // full: 自动推进但慢速
    if (idx >= rounds.length) {
      const t = setTimeout(() => void duelStep(), 1500);
      return () => clearTimeout(t);
    }
  }, [duel.phase, mode, idx, rounds.length, duelStep, duelSkip]);

  // 回合追加时推进游标
  useEffect(() => {
    if (rounds.length > idx) setIdx(rounds.length - 1);
  }, [rounds.length, idx]);

  const atk = duel.combatants[duel.challengerId];
  const def = duel.combatants[duel.defenderId];

  return (
    <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center">
      <div className="w-[680px] max-w-[95%] rounded-xl border-2 border-amber-700 bg-stone-950 p-5 shadow-2xl">
        <div className="text-center text-amber-300 text-lg font-bold mb-3">
          单挑：{challengerName} vs {defenderName}
          <span className="ml-3 text-stone-400 text-sm">
            {resolved ? '已结束' : `回合 ${duel.round}/10`}
          </span>
        </div>

        {/* HP bars */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          <HpBar name={challengerName} hp={atk.hp} maxHp={atk.maxHp} energy={atk.energy} injury={atk.injury} side="atk" />
          <HpBar name={defenderName} hp={def.hp} maxHp={def.maxHp} energy={def.energy} injury={def.injury} side="def" />
        </div>

        {/* 阵前对话 */}
        <div className="mb-3 max-h-24 overflow-y-auto rounded bg-stone-900/70 p-2 text-sm text-stone-300">
          {duel.dialogueLog.map((d, i) => (
            <div key={i} className="mb-1">
              <span className="text-amber-400">{commanderName(d.speakerId) ?? ''}：</span>
              {d.text}
            </div>
          ))}
        </div>

        {/* 回合叙事 */}
        <div className="min-h-[80px] rounded bg-black/40 border border-stone-700 p-3 mb-3">
          {shownRound ? (
            <>
              <div className="text-amber-100 leading-relaxed mb-2">{shownRound.description}</div>
              <details className="text-stone-400 text-xs">
                <summary className="cursor-pointer text-stone-500">本回合详情</summary>
                <div className="mt-1 pl-3">{shownRound.detail}</div>
              </details>
            </>
          ) : (
            <div className="text-stone-500 text-sm">战鼓擂动，单挑即将开始…</div>
          )}
        </div>

        {/* 结局 */}
        {resolved && duel.result && (
          <div className="mb-3 rounded bg-amber-950/60 border border-amber-700 p-3 text-center">
            <div className="text-amber-300 font-bold mb-1">
              {duel.result.outcome === 'killed' && '斩杀！'}
              {duel.result.outcome === 'captured' && '俘获！'}
              {duel.result.outcome === 'escaped' && '逃脱'}
              {duel.result.outcome === 'surrendered' && '投降'}
              {duel.result.outcome === 'draw' && '平局'}
            </div>
            <div className="text-stone-200 text-sm">{duel.result.epilogue}</div>
            <div className="text-stone-500 text-xs mt-1">
              胜方功绩 +{duel.result.meritReward} · 观众士气 {duel.result.audienceMoraleChange > 0 ? '+' : ''}{duel.result.audienceMoraleChange}
            </div>
          </div>
        )}

        {/* 控制 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {(['full', 'fast', 'skip'] as const).map((m) => (
              <button
                key={m}
                disabled={resolved}
                className={`px-2 py-1 rounded border text-xs ${
                  mode === m
                    ? 'bg-amber-700 border-amber-400 text-amber-50'
                    : 'bg-stone-800 border-stone-600 text-stone-300'
                } ${resolved ? 'opacity-40 cursor-not-allowed' : ''}`}
                onClick={() => setMode(m)}
              >
                {m === 'full' ? '观看演出' : m === 'fast' ? '快速结算' : '只看结果'}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {!resolved && (
              <button
                className="px-3 py-1.5 rounded bg-emerald-900 border border-emerald-600 text-sm"
                onClick={() => void duelStep()}
              >
                下一回合 →
              </button>
            )}
            {!resolved && (
              <button
                className="px-3 py-1.5 rounded bg-stone-800 border border-stone-600 text-sm"
                onClick={() => void duelSkip()}
              >
                跳过 ▶▶
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HpBar({
  name,
  hp,
  maxHp,
  energy,
  injury,
  side,
}: {
  name: string;
  hp: number;
  maxHp: number;
  energy: number;
  injury: { part: string } | null;
  side: 'atk' | 'def';
}) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const color = side === 'atk' ? 'bg-emerald-600' : 'bg-red-600';
  const injuryLabel: Record<string, string> = {
    arm: '臂伤', leg: '腿伤', rib: '肋伤', head: '头伤', severe: '重创',
  };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={side === 'atk' ? 'text-emerald-400' : 'text-red-400'}>{name}</span>
        <span className="text-stone-400">
          体力 {hp}/{maxHp}
          {injury && <span className="ml-1 text-orange-400">[{injuryLabel[injury.part] ?? '伤'}]</span>}
        </span>
      </div>
      <div className="h-3 rounded bg-stone-800 overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-stone-500 text-xs mt-0.5">气力 {energy}</div>
    </div>
  );
}
