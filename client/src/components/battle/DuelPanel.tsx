// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import { useEffect, useState } from 'react';
import type { DuelState } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

type Props = { duel: DuelState; onStep?: () => void | Promise<void>; onSkip?: () => void | Promise<void>; onClose?: () => void | Promise<void>; resolveName?: (id: number) => string | undefined };

export function DuelPanel({ duel, onStep, onSkip, onClose, resolveName }: Props) {
  const game = useGameStore((s) => s.game);
  const battle = useGameStore((s) => s.battle);
  const step = onStep ?? useGameStore((s) => s.duelStep);
  const skip = onSkip ?? useGameStore((s) => s.duelSkip);
  const [mode, setMode] = useState<'full' | 'fast' | 'skip'>('full');
  const [idx, setIdx] = useState(0);
  const name = (id: number) => resolveName?.(id) ?? battle?.units.find((u) => u.commanderId === id)?.commanderName ?? game?.officers[id]?.name ?? '无名将';
  const rounds = duel.roundHistory;
  const shown = rounds[Math.min(idx, Math.max(0, rounds.length - 1))];
  const resolved = duel.phase === 'resolved' && !!duel.result;
  const stance = (id: number) => ({ assault: '强攻', steady: '持重', bait: '诱敌', delegate: '委任' }[duel.stances[id] ?? 'delegate']);

  useEffect(() => {
    if (duel.phase !== 'dueling') return;
    if (mode === 'skip') { void skip(); return; }
    const timer = setTimeout(() => void step(), mode === 'fast' ? 600 : 1500);
    return () => clearTimeout(timer);
  }, [duel.phase, mode, step, skip]);
  useEffect(() => { if (rounds.length > idx) setIdx(rounds.length - 1); }, [rounds.length, idx]);

  const atk = duel.combatants[duel.challengerId];
  const def = duel.combatants[duel.defenderId];
  return <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center">
    <div className="w-[680px] max-w-[95%] rounded border-2 border-amber-700 bg-stone-950 p-5 shadow-2xl">
      <div className="text-center text-amber-300 text-lg font-bold mb-3">单挑：{name(duel.challengerId)} vs {name(duel.defenderId)} <span className="ml-3 text-stone-400 text-sm">{resolved ? '已结束' : `回合 ${duel.round}/10`}</span></div>
      <div className="grid grid-cols-2 gap-4 mb-3"><HpBar name={name(duel.challengerId)} {...atk} side="atk" /><HpBar name={name(duel.defenderId)} {...def} side="def" /></div>
      <div data-testid="duel-stance-summary" className="mb-3 grid grid-cols-2 gap-4 text-center text-xs text-yellow-200/80"><div>{name(duel.challengerId)} · {stance(duel.challengerId)}</div><div>{name(duel.defenderId)} · {stance(duel.defenderId)}</div></div>
      <div className="mb-3 max-h-24 overflow-y-auto rounded bg-stone-900/70 p-2 text-sm text-stone-300">{duel.dialogueLog.map((d, i) => <div key={i} className="mb-1"><span className="text-amber-400">{name(d.speakerId)}：</span>{d.text}</div>)}</div>
      <div className="min-h-[80px] rounded bg-black/40 border border-stone-700 p-3 mb-3">{shown ? <><div className="text-amber-100 leading-relaxed mb-2">{shown.description}</div><details className="text-stone-400 text-xs"><summary className="cursor-pointer text-stone-500">本回合详情</summary><div className="mt-1 pl-3">{shown.detail}</div></details></> : <div className="text-stone-500 text-sm">战鼓擂动，单挑即将开始…</div>}</div>
      {resolved && duel.result && <div className="mb-3 rounded bg-amber-950/60 border border-amber-700 p-3 text-center"><div className="text-amber-300 font-bold mb-1">{({ killed: '斩杀！', captured: '俘获！', escaped: '逃脱', surrendered: '投降', draw: '平局' } as Record<string, string>)[duel.result.outcome]}</div><div className="text-stone-200 text-sm">{duel.result.epilogue}</div></div>}
      <div className="flex items-center justify-between gap-2"><div className="flex gap-1">{(['full', 'fast', 'skip'] as const).map((m) => <InkButton key={m} disabled={resolved} className={`px-2 py-1 rounded border text-xs ${mode === m ? 'bg-amber-700 border-amber-400 text-amber-50' : 'bg-stone-800 border-stone-600 text-stone-300'}`} onClick={() => setMode(m)}>{m === 'full' ? '观看演出' : m === 'fast' ? '快速结算' : '只看结果'}</InkButton>)}</div><div className="flex gap-1">{!resolved && <><InkButton data-testid="btn-duel-step" className="px-3 py-1.5 rounded bg-emerald-900 border border-emerald-600 text-sm" onClick={() => void step()}>下一回合 →</InkButton><InkButton data-testid="btn-duel-skip" className="px-3 py-1.5 rounded bg-stone-800 border border-stone-600 text-sm" onClick={() => void skip()}>跳过 ▶▶</InkButton></>}{resolved && onClose && <InkButton data-testid="btn-close-battlefield-duel" className="px-3 py-1.5 rounded bg-amber-900 border border-amber-600 text-sm" onClick={() => void onClose()}>返回战场</InkButton>}</div></div>
    </div>
  </div>;
}

function HpBar({ name, hp, maxHp, energy, injury, side }: { name: string; hp: number; maxHp: number; energy: number; injury: { part: string } | null; side: 'atk' | 'def' }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const labels: Record<string, string> = { arm: '臂伤', leg: '腿伤', rib: '肋伤', head: '头伤', severe: '重创' };
  return <div><div className="flex justify-between text-xs mb-1"><span className={side === 'atk' ? 'text-emerald-400' : 'text-red-400'}>{name}</span><span className="text-stone-400">体力 {hp}/{maxHp}{injury && <span className="ml-1 text-orange-400">[{labels[injury.part] ?? '伤'}]</span>}</span></div><div className="h-3 rounded bg-stone-800 overflow-hidden"><div className={`h-full ${side === 'atk' ? 'bg-emerald-600' : 'bg-red-600'} transition-all duration-500`} style={{ width: `${pct}%` }} /></div><div className="text-stone-500 text-xs mt-0.5">气力 {energy}</div></div>;
}
