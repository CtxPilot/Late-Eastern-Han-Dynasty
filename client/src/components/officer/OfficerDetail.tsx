// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CIVIL_LABELS,
  LOCAL_LABELS,
  MILITARY_LABELS,
  type GameState,
  type Officer,
} from '@leh/shared';
import { getOfficerProfile, OfficerPortrait } from './OfficerPortrait';

const STAT_ROWS = [
  ['统帅', 'leadership'],
  ['武力', 'war'],
  ['智力', 'intelligence'],
  ['政治', 'politics'],
  ['魅力', 'charisma'],
] as const;

const PROFICIENCY_LABEL: Record<string, string> = { S: 'S', A: 'A', B: 'B', C: 'C', NONE: '—' };

interface Props {
  game: GameState;
  officer: Officer | null;
  onClose: () => void;
}

export function OfficerDetail({ game, officer, onClose }: Props) {
  if (!officer) return null;
  const location = officer.location != null ? game.cities[officer.location]?.name ?? '未知' : '未驻城';
  const age = officer.birthYear > 0 ? Math.max(0, game.currentYear - officer.birthYear) : null;
  const wife = officer.wifeId != null ? game.females[officer.wifeId]?.name : null;
  const profile = getOfficerProfile(officer);
  const signatureStat = STAT_ROWS.reduce((best, row) => officer.stats[row[1]] > officer.stats[best[1]] ? row : best, STAT_ROWS[0]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-950/80 px-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="officer-detail-title" className="officer-scroll max-h-[92vh] w-full max-w-4xl overflow-y-auto border border-amber-800/60 shadow-2xl" data-testid="officer-detail">
        <header className="officer-detail-hero sticky top-0 z-10 flex items-start justify-between border-b border-amber-900/50 px-5 py-4">
          <div className="flex items-end gap-3">
            <div><div className="text-[10px] tracking-[0.35em] text-amber-700">汉末人物志 · {profile.role}</div><h2 id="officer-detail-title" className="mt-1 text-3xl font-bold tracking-[0.22em] text-amber-100">{officer.name}<small className="ml-3 text-sm font-normal tracking-widest text-stone-400">{profile.courtesy ? `字 ${profile.courtesy}` : ''}</small></h2>
            <p className="mt-1 text-xs tracking-wider text-stone-500">{profile.title} · {age != null ? `${age}岁 · ` : ''}{location}</p></div>
          </div>
          <button type="button" className="rounded border border-stone-700 px-2 py-1 text-stone-400 hover:text-stone-100" onClick={onClose} aria-label="关闭">×</button>
        </header>

        <div className="grid gap-6 p-5 md:grid-cols-[220px_1fr]">
          <aside className="space-y-3">
            <OfficerPortrait officer={officer} />
            <blockquote className="border-l-2 border-red-900/80 pl-3 text-sm leading-6 text-stone-300">{profile.quote}</blockquote>
            <div className="grid grid-cols-2 gap-2 text-xs"><Info label="忠诚" value={String(officer.loyalty)} /><Info label="功绩" value={String(officer.merit)} /><Info label="体力" value={String(officer.stamina)} /><Info label="经验" value={String(officer.experience)} /></div>
            <div className="rounded border border-amber-900/40 bg-black/20 p-3"><div className="text-[10px] tracking-widest text-amber-700">最胜所长</div><div className="mt-1 flex items-baseline justify-between"><strong className="text-lg text-amber-100">{signatureStat[0]}</strong><span className="text-3xl font-bold text-amber-400">{officer.stats[signatureStat[1]]}</span></div></div>
          </aside>
          <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <section>
              <h3 className="mb-2 text-xs tracking-widest text-amber-500">五维</h3>
              <div className="space-y-2">
                {STAT_ROWS.map(([label, key]) => {
                  const value = officer.stats[key];
                  return <div key={key} className="grid grid-cols-[2rem_2rem_1fr] items-center gap-2 text-xs"><span className="text-stone-400">{label}</span><strong className={value >= 95 ? 'text-amber-300' : 'text-stone-100'}>{value}</strong><div className="h-1.5 overflow-hidden rounded bg-stone-800"><div className="h-full bg-gradient-to-r from-red-950 via-amber-800 to-amber-400" style={{ width: `${value}%` }} /></div></div>;
                })}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs tracking-widest text-amber-500">官职</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Info label="文官" value={CIVIL_LABELS[officer.civilPosition]} />
                <Info label="地方" value={LOCAL_LABELS[officer.localPosition]} />
                <Info label="武官" value={MILITARY_LABELS[officer.militaryPosition]} />
                <Info label="爵位" value={String(officer.nobilityRank)} />
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs tracking-widest text-amber-500">技能与特性</h3>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {officer.uniqueSkill && <Chip text={`${officer.uniqueSkill} · 专属`} accent />}
                {officer.skills.map((skill) => <Chip key={skill.skillId} text={`${skill.skillId} Lv${skill.level}`} />)}
                {officer.skills.length === 0 && !officer.uniqueSkill && <span className="text-stone-600">暂无技能</span>}
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <section>
              <h3 className="mb-2 text-xs tracking-widest text-amber-500">兵种适性</h3>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                {Object.entries(officer.unitProficiency).map(([unit, grade]) => <div key={unit} className="flex justify-between rounded border border-stone-800 bg-stone-900/50 px-2 py-1"><span className="text-stone-500">{unit}</span><strong className="text-amber-200">{PROFICIENCY_LABEL[String(grade)] ?? String(grade)}</strong></div>)}
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-xs tracking-widest text-amber-500">身份与家族</h3>
              <div className="flex flex-wrap gap-1.5 text-[11px]">{officer.tags.map((tag) => <Chip key={tag} text={tag} />)}{officer.tags.length === 0 && <span className="text-stone-600">暂无标签</span>}</div>
              <p className="mt-2 text-xs text-stone-500">正妻：{wife ?? '—'} · 赏赐美人：{officer.beauties.length}</p>
            </section>
            <section>
              <h3 className="mb-2 text-xs tracking-widest text-amber-500">状态</h3>
              <div className="grid grid-cols-2 gap-2 text-xs"><Info label="经验" value={String(officer.experience)} /><Info label="体力" value={String(officer.stamina)} /><Info label="阵型" value={`${officer.formationMastery.length} 项`} /><Info label="状态" value={String(officer.status)} /></div>
            </section>
          </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded border border-stone-800 bg-stone-900/50 px-2 py-1.5"><span className="text-stone-500">{label}</span><span className="float-right text-stone-200">{value || '—'}</span></div>; }
function Chip({ text, accent = false }: { text: string; accent?: boolean }) { return <span className={`rounded border px-2 py-1 ${accent ? 'border-rose-800 bg-rose-950/40 text-rose-200' : 'border-stone-700 bg-stone-900 text-stone-300'}`}>{text}</span>; }
