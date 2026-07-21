// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import { type Officer } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { OfficerDetail } from '../officer/OfficerDetail';
import { OfficerPortrait } from '../officer/OfficerPortrait';

type SortKey = 'name' | 'leadership' | 'war' | 'intelligence' | 'loyalty';

const STATUS_LABEL: Record<string, string> = {
  free: '在野',
  active: '在职',
  prisoner: '被俘',
  dead: '阵亡',
};

export function OfficerRosterPanel() {
  const game = useGameStore((s) => s.game);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('leadership');
  const [selected, setSelected] = useState<Officer | null>(null);

  const officers = useMemo(() => {
    if (!game) return [];
    const list = Object.values(game.officers).filter((o) => o.faction === game.playerFactionId && o.name.includes(query.trim()));
    return list.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'zh') : sort === 'loyalty' ? b.loyalty - a.loyalty : b.stats[sort] - a.stats[sort]);
  }, [game, query, sort]);

  const featured = useMemo(() => {
    if (!game) return [];
    return [5, 6, 4, 1].map((id) => game.officers[id]).filter((officer): officer is Officer => officer != null);
  }, [game]);

  if (!game) return null;

  return (
    <div className="px-2 pb-2 text-[11px]" data-testid="officer-roster-panel">
      {featured.length > 0 && <div className="mb-2 rounded border border-amber-900/50 bg-amber-950/10 p-1.5">
        <div className="mb-1 flex items-center justify-between px-0.5 text-[9px] tracking-[0.2em] text-amber-700"><span>名将试册</span><span>代表人物</span></div>
        <div className="grid grid-cols-4 gap-1">{featured.map((officer) => <button key={officer.id} type="button" data-testid={`featured-officer-${officer.id}`} onClick={() => setSelected(officer)} className="flex min-w-0 flex-col items-center gap-0.5 rounded border border-stone-800 bg-stone-950/60 py-1 text-stone-400 hover:border-amber-700 hover:text-amber-100"><OfficerPortrait officer={officer} compact /><span>{officer.name}</span></button>)}</div>
      </div>}
      <div className="mb-2 grid grid-cols-[1fr_5.5rem] gap-1">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="检索姓名…" className="min-w-0 rounded border border-stone-700 bg-stone-900 px-2 py-1 text-stone-200 outline-none focus:border-amber-700" />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded border border-stone-700 bg-stone-900 px-1 text-stone-300"><option value="leadership">统帅排序</option><option value="war">武力排序</option><option value="intelligence">智力排序</option><option value="loyalty">忠诚排序</option><option value="name">姓名排序</option></select>
      </div>
      <div className="mb-1 flex justify-between px-1 text-[10px] text-stone-600"><span>在职武将 {officers.length}</span><span>点击查看简册</span></div>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {officers.map((officer) => {
          const lowLoyalty = officer.loyalty < 60;
          return <button key={officer.id} type="button" data-testid={`officer-row-${officer.id}`} onClick={() => setSelected(officer)} className={`flex w-full items-center gap-2 rounded border bg-stone-900/60 px-2 py-1.5 text-left hover:bg-amber-950/20 ${lowLoyalty ? 'border-red-600' : 'border-stone-800 hover:border-amber-800'}`}>
            <OfficerPortrait officer={officer} compact />
            <div className="min-w-0 flex-1"><div className="flex items-center justify-between"><strong className="text-stone-100">{officer.name}</strong><span className={lowLoyalty ? 'text-red-300' : 'text-stone-500'}>忠 {officer.loyalty}</span></div>
            <div className="mt-1 flex justify-between text-[10px] text-stone-500"><span>统{officer.stats.leadership} · 武{officer.stats.war} · 智{officer.stats.intelligence}</span><span>{officer.location != null ? game.cities[officer.location]?.name ?? '未知' : '未驻城'} · {STATUS_LABEL[officer.status] ?? STATUS_LABEL[String(officer.status)] ?? String(officer.status)}</span></div></div>
          </button>;
        })}
      </div>
      <OfficerDetail game={game} officer={selected ? game.officers[selected.id] ?? null : null} onClose={() => setSelected(null)} />
    </div>
  );
}
