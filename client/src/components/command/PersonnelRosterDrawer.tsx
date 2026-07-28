// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useRef, useState } from 'react';
import type { GameState, Officer } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { OfficerDetail } from '../officer/OfficerDetail';
import { OfficerPortrait } from '../officer/OfficerPortrait';
import { PersonnelRecruitDrawer } from './PersonnelRecruitDrawer';
import { AppointPanel } from '../layout/AppointPanel';
import { BeautyPanel } from '../layout/BeautyPanel';
import type { CommandShellState } from './commandShellState';

export type PersonnelRosterSort = 'name' | 'leadership' | 'war' | 'intelligence' | 'loyalty';
export type PersonnelRosterScope = 'all' | 'active' | 'free';

const STATUS_LABEL: Record<string, string> = {
  free: '在野',
  active: '在职',
  prisoner: '被俘',
  dead: '阵亡',
};

export function selectPersonnelRoster(
  game: GameState,
  query: string,
  scope: PersonnelRosterScope,
  sort: PersonnelRosterSort,
  source = Object.values(game.officers),
): Officer[] {
  const normalizedQuery = query.trim();
  return source
    .filter((officer) => {
      const active = officer.faction === game.playerFactionId;
      const free = officer.faction == null && String(officer.status) === 'free';
      if (scope === 'active' && !active) return false;
      if (scope === 'free' && !free) return false;
      return (active || free) && officer.name.includes(normalizedQuery);
    })
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'zh');
      if (sort === 'loyalty') return b.loyalty - a.loyalty || a.id - b.id;
      return b.stats[sort] - a.stats[sort] || a.id - b.id;
    });
}

/** 仅供 CMD-P7 浏览器性能基准；不写入 GameState，也不代表 0-A 数据规模。 */
export function makeSyntheticRoster(source: readonly Officer[], count: number): Officer[] {
  if (source.length === 0 || count <= 0) return [];
  return Array.from({ length: count }, (_, index) => {
    const template = source[index % source.length];
    return {
      ...template,
      id: 100_000 + index,
      name: `${template.name}·合成${String(index + 1).padStart(4, '0')}`,
      faction: index % 5 === 0 ? null : template.faction,
      status: index % 5 === 0 ? 'free' : 'active',
    } as Officer;
  });
}

function fixtureCount(): number | null {
  if (!import.meta.env.DEV) return null;
  const requested = new URLSearchParams(window.location.search).get('cmdP7RosterFixture');
  return requested === '100' || requested === '1000' ? Number(requested) : null;
}

export function PersonnelRosterDrawer({ shellState }: { shellState: CommandShellState }) {
  const game = useGameStore((state) => state.game);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<PersonnelRosterScope>('all');
  const [sort, setSort] = useState<PersonnelRosterSort>('leadership');
  const [selected, setSelected] = useState<Officer | null>(null);
  const intendedFacet =
    shellState.activeCommand === 'appoint'
      ? 'appointment'
      : shellState.activeCommand === 'reward'
        ? 'reward'
        : null;
  const [facet, setFacet] = useState<'roster' | 'recruitment' | 'appointment' | 'reward'>(
    intendedFacet ?? 'roster',
  );
  const selectedTrigger = useRef<HTMLButtonElement | null>(null);

  const source = useMemo(() => {
    if (!game) return [];
    const actual = Object.values(game.officers).filter(
      (officer) => officer.faction === game.playerFactionId || (officer.faction == null && String(officer.status) === 'free'),
    );
    const count = fixtureCount();
    return count == null ? actual : makeSyntheticRoster(actual, count);
  }, [game]);

  const officers = useMemo(
    () => game ? selectPersonnelRoster(game, query, scope, sort, source) : [],
    [game, query, scope, sort, source],
  );
  const summary = useMemo(() => ({
    active: source.filter((officer) => officer.faction === game?.playerFactionId).length,
    free: source.filter((officer) => officer.faction == null && String(officer.status) === 'free').length,
  }), [game?.playerFactionId, source]);

  if (!game) return <p data-testid="personnel-roster-empty">尚未载入剧本。</p>;

  return (
    <div className="flex h-[min(36rem,calc(100vh-12rem))] min-h-0 flex-1 flex-col" data-testid="command-personnel-drawer">
      <nav className="mb-3 grid grid-cols-4 gap-1" aria-label="人事分面">
        <button type="button" data-testid="command-personnel-facet-roster" aria-current={facet === 'roster' ? 'page' : undefined} onClick={() => setFacet('roster')} className={`border py-1.5 ${facet === 'roster' ? 'border-amber-700 bg-amber-950/50 text-amber-100' : 'border-stone-800 text-stone-400'}`}>名册</button>
        <button type="button" data-testid="command-personnel-facet-recruitment" aria-current={facet === 'recruitment' ? 'page' : undefined} onClick={() => setFacet('recruitment')} className={`border py-1.5 ${facet === 'recruitment' ? 'border-amber-700 bg-amber-950/50 text-amber-100' : 'border-stone-800 text-stone-400'}`}>招贤</button>
        <button type="button" data-testid="command-personnel-facet-appointment" aria-current={facet === 'appointment' ? 'page' : undefined} onClick={() => setFacet('appointment')} className={`border py-1.5 ${facet === 'appointment' ? 'border-amber-700 bg-amber-950/50 text-amber-100' : 'border-stone-800 text-stone-400'}`}>任官</button>
        <button type="button" data-testid="command-personnel-facet-reward" aria-current={facet === 'reward' ? 'page' : undefined} onClick={() => setFacet('reward')} className={`border py-1.5 ${facet === 'reward' ? 'border-amber-700 bg-amber-950/50 text-amber-100' : 'border-stone-800 text-stone-400'}`}>赏罚</button>
      </nav>

      {facet === 'recruitment' ? <PersonnelRecruitDrawer /> : facet === 'appointment' ? (
        <div className="min-h-0 flex-1 overflow-y-auto" data-testid="command-personnel-appointment">
          <AppointPanel
            initialTrack={
              shellState.draftByDomain.personnel?.parameters.track === 'hegemony'
                ? 'hegemony'
                : 'military'
            }
            initialOfficerId={
              typeof shellState.draftByDomain.personnel?.parameters.officerId === 'number'
                ? shellState.draftByDomain.personnel.parameters.officerId
                : undefined
            }
          />
        </div>
      ) : facet === 'reward' ? (
        <div className="min-h-0 flex-1 overflow-y-auto" data-testid="command-personnel-reward">
          <BeautyPanel />
          <p className="px-2 pt-3 text-[10px] text-stone-600">
            没收、俘虏录用尚在设计中，本阶段不提供操作入口。
          </p>
        </div>
      ) : (
      <div className="flex min-h-0 flex-1 flex-col" data-testid="command-personnel-roster">
      <div className="mb-2 grid grid-cols-2 gap-2" data-testid="personnel-roster-summary">
        <div className="border border-stone-800 bg-stone-900/60 px-2 py-1.5"><span className="text-stone-500">在职</span><strong className="float-right text-amber-200">{summary.active}</strong></div>
        <div className="border border-stone-800 bg-stone-900/60 px-2 py-1.5"><span className="text-stone-500">在野</span><strong className="float-right text-amber-200">{summary.free}</strong></div>
      </div>

      <div className="mb-2 grid grid-cols-[1fr_5rem] gap-1">
        <input
          data-testid="personnel-roster-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="筛选姓名…"
          className="min-w-0 border border-stone-700 bg-stone-900 px-2 py-1 text-stone-200 outline-none focus:border-amber-600"
        />
        <select data-testid="personnel-roster-scope" value={scope} onChange={(event) => setScope(event.target.value as PersonnelRosterScope)} className="border border-stone-700 bg-stone-900 px-1 text-stone-300">
          <option value="all">全部</option><option value="active">在职</option><option value="free">在野</option>
        </select>
      </div>
      <select data-testid="personnel-roster-sort" value={sort} onChange={(event) => setSort(event.target.value as PersonnelRosterSort)} className="mb-2 border border-stone-700 bg-stone-900 px-2 py-1 text-stone-300">
        <option value="leadership">统帅排序</option><option value="war">武力排序</option><option value="intelligence">智力排序</option><option value="loyalty">忠诚排序</option><option value="name">姓名排序</option>
      </select>

      <div className="mb-1 flex justify-between text-[10px] text-stone-600"><span>当前 {officers.length} 人</span><span>点击查看人物简册</span></div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" data-testid="personnel-roster-scroll">
        {officers.map((officer) => {
          const ruler = officer.faction != null && game.factions[officer.faction]?.rulerId === officer.id;
          return (
            <button key={officer.id} type="button" data-testid={`command-personnel-officer-${officer.id}`} onClick={(event) => {
              selectedTrigger.current = event.currentTarget;
              setSelected(officer);
            }} className="flex w-full items-center gap-2 border border-stone-800 bg-stone-900/60 px-2 py-1.5 text-left hover:border-amber-800 hover:bg-amber-950/20">
              <OfficerPortrait officer={officer} compact />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between"><strong className="truncate text-stone-100">{officer.name}</strong><span className="text-stone-500">{ruler ? '君主' : STATUS_LABEL[String(officer.status)] ?? String(officer.status)}</span></div>
                <div className="mt-1 flex justify-between text-[10px] text-stone-500"><span>统{officer.stats.leadership} · 武{officer.stats.war} · 智{officer.stats.intelligence}</span><span>{officer.location != null ? game.cities[officer.location]?.name ?? '未知' : '未驻城'}</span></div>
              </div>
            </button>
          );
        })}
        {officers.length === 0 ? <p className="py-8 text-center text-stone-600" data-testid="personnel-roster-no-results">没有符合条件的人物</p> : null}
      </div>

      <OfficerDetail game={game} officer={selected} onClose={() => {
        setSelected(null);
        requestAnimationFrame(() => selectedTrigger.current?.focus());
      }} />
      </div>
      )}
    </div>
  );
}
