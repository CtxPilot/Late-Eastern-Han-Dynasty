// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import {
  CIVIL_LABELS,
  FORMATION_LABEL,
  HEGEMONY_LABELS,
  HegemonyPosition,
  IDEAL_LABEL,
  LOCAL_LABELS,
  MILITARY_LABELS,
  PERSONALITY_LABEL,
  type GameState,
  type Officer,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { getFactionResourceTotals } from '../../utils/factionResources';
import { getOfficerProfile } from './OfficerPortrait';
import { ExpressionPortrait } from './ExpressionPortrait';

const STAT_ROWS = [
  ['统帅', 'leadership', false],
  ['武力', 'war', false],
  ['智力', 'intelligence', false],
  ['政治', 'politics', false],
  ['魅力', 'charisma', false],
  ['体力', 'stamina', true],
] as const;

const PROFICIENCY_LABEL: Record<string, string> = { S: 'S', A: 'A', B: 'B', C: 'C', NONE: '—' };

const STATUS_LABEL: Record<string, string> = {
  free: '在野',
  active: '在职',
  prisoner: '被俘',
  dead: '阵亡',
};

const NOBILITY_LABEL: Record<string, string> = {
  none: '无',
  marquis: '侯',
  duke: '公',
  prince: '王',
  king: '皇帝',
};

const SKILL_NAME: Record<string, string> = {
  fire: '火计', water: '水计', rockfall: '落石', ambush: '伏兵',
  taunt: '挑拨', discord: '离间', calm: '沉着', inspire: '激励',
  sorcery: '妖术', illusion: '幻术', gallop: '疾驰',
  forcedMarch: '强行军', rapidAttack: '急攻', hold: '固守',
  longRange: '远射', formationChange: '布阵', reorganize: '重整',
  raid: '奇袭', farming: '农政', commerce: '商政', fortify: '筑城',
  recruit: '征兵', train: '训练', discover: '寻访', eloquence: '辩才',
  medicine: '医术', insight: '洞察', bravery: '勇武', riding: '骑术',
  archery: '弓术',
};

const UNIT_NAME: Record<string, string> = {
  lightInfantry: '轻步', heavyInfantry: '重步', spearman: '长枪',
  archer: '弓兵', crossbowman: '弩兵', lightCavalry: '轻骑',
  heavyCavalry: '重骑', horseArcher: '骑射', lightNavy: '走舸',
  mediumNavy: '蒙冲', heavyNavy: '楼船', siege: '攻城',
  tigerLeopard: '虎豹骑', qingzhouTroops: '青州兵',
  trappedCamp: '陷阵营', whiteHorse: '白马骑', xiliangIron: '西凉铁骑',
  danyangTroops: '丹阳军', jiefanTroops: '解烦军', whiteEar: '白耳兵',
  wudangFlying: '无当飞军', rattanArmor: '藤甲兵', elephant: '象兵',
  yellowTurban: '黄巾兵',
};

/** 装备 5 槽（07-ui-design:195 规划，Officer.equipped 代码未实装，占位展示） */
const EQUIP_SLOTS = [
  { key: 'weaponPrimary', label: '主武器' },
  { key: 'weaponSecondary', label: '副武器' },
  { key: 'armor', label: '盔甲' },
  { key: 'mount', label: '坐骑' },
  { key: 'auxiliary', label: '辅助' },
] as const;

type Tab = 'stats' | 'family' | 'equipment' | 'biography';

const TABS: readonly [Tab, string][] = [
  ['stats', '属性'],
  ['family', '家族'],
  ['equipment', '装备'],
  ['biography', '列传'],
];

interface Props {
  game: GameState;
  officer: Officer | null;
  onClose: () => void;
}

export function OfficerDetail({ game, officer, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('stats');
  const childrenCatalog = useGameStore((s) => s.childrenCatalog);

  const children = useMemo(() => {
    if (!officer) return [];
    const enabledIds = new Set(game.enabledChildEventIds);
    return childrenCatalog.filter(
      (c) =>
        enabledIds.has(c.childId) &&
        (c.fatherId === officer.id ||
          (officer.wifeId != null && c.motherId === officer.wifeId)),
    );
  }, [game, childrenCatalog, officer]);

  // 君主身份特例（04 §3.8）：君主不参与忠诚度/拉拢记录/功绩系统，UI 隐藏相关区块，
  // 功绩位置改显势力综合国力派生指标（城池数/总兵力/总金/总粮，从已有数据派生）。
  const realmStats = useMemo(() => {
    if (!officer || officer.faction == null) return null;
    const fid = officer.faction;
    if (game.factions[fid]?.rulerId !== officer.id) return null;
    const totals = getFactionResourceTotals(game, fid);
    return {
      cityCount: totals.cityCount,
      totalTroops: totals.troops,
      totalGold: totals.gold,
      totalFood: totals.food,
    };
  }, [game.cities, game.factions, officer]);

  if (!officer) return null;
  const location = officer.location != null ? game.cities[officer.location]?.name ?? '未知' : '未驻城';
  const age = officer.birthYear > 0 ? Math.max(0, game.currentYear - officer.birthYear) : null;
  const wife = officer.wifeId != null ? game.females[officer.wifeId]?.name : null;
  const profile = getOfficerProfile(officer);
  const armyMorale = game.campaignArmies.find((a) => a.commanderId === officer.id)?.morale;
  const signatureStat = STAT_ROWS.filter(r => !r[2]).reduce((best, row) => officer.stats[row[1]] > officer.stats[best[1]] ? row : best, STAT_ROWS[0]);
  const factionName = officer.faction != null ? game.factions[officer.faction]?.name ?? '未知势力' : null;
  const isRuler = realmStats != null;
  // 政治头衔（HC-P0-3）：君主且势力 politicalStage !== 'vassal' 时展示
  const politicalTitle = isRuler && officer.faction != null
    ? game.factions[officer.faction]?.politicalTitle
    : undefined;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-950/80 px-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="officer-detail-title" className="officer-scroll max-h-[92vh] w-full max-w-4xl overflow-y-auto border border-amber-800/60 shadow-2xl" data-testid="officer-detail">
        <header className="officer-detail-hero sticky top-0 z-10 flex items-start justify-between border-b border-amber-900/50 px-5 py-4">
          <div className="flex items-end gap-3">
            <div><div className="text-[10px] tracking-[0.35em] text-amber-700">汉末人物志 · {profile.role}</div><h2 id="officer-detail-title" className="mt-1 text-3xl font-bold tracking-[0.22em] text-amber-100">{officer.name}<small className="ml-3 text-sm font-normal tracking-widest text-stone-400">{profile.courtesy ? `字 ${profile.courtesy}` : ''}</small></h2>
            <p className="mt-1 text-xs tracking-wider text-stone-500">{profile.title} · {age != null ? `${age}岁 · ` : ''}{location}{politicalTitle ? ` · ${politicalTitle}` : ''}</p></div>
          </div>
          <button type="button" className="rounded border border-stone-700 px-2 py-1 text-stone-400 hover:text-stone-100" onClick={onClose} aria-label="关闭">×</button>
        </header>

        <div className="grid gap-6 p-5 md:grid-cols-[220px_1fr]">
          <aside className="space-y-3">
            <ExpressionPortrait officer={officer} armyMorale={armyMorale} />
            <blockquote className="border-l-2 border-red-900/80 pl-3 text-sm leading-6 text-stone-300">{profile.quote}</blockquote>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {isRuler ? (
                <>
                  <Info label="城池" value={realmStats ? String(realmStats.cityCount) : '—'} />
                  <Info label="总兵力" value={realmStats ? String(realmStats.totalTroops) : '—'} />
                  <Info label="总金" value={realmStats ? String(realmStats.totalGold) : '—'} />
                  <Info label="总粮" value={realmStats ? String(realmStats.totalFood) : '—'} />
                </>
              ) : (
                <>
                  <Info label="忠诚" value={String(officer.loyalty)} />
                  <Info label="功绩" value={String(officer.merit)} />
                </>
              )}
              <Info label="行动" value={`${officer.actionsPerMonth ?? 1}/月`} />
              <Info label="经验" value={String(officer.experience)} />
            </div>
            <div className="rounded border border-amber-900/40 bg-black/20 p-3"><div className="text-[10px] tracking-widest text-amber-700">最胜所长</div><div className="mt-1 flex items-baseline justify-between"><strong className="text-lg text-amber-100">{signatureStat[0]}</strong><span className="text-3xl font-bold text-amber-400">{officer.stats[signatureStat[1]]}</span></div></div>
          </aside>
          <div>
            <div className="flex gap-1 mb-3 px-0.5" role="tablist" aria-label="武将详情页签">
              {TABS.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  data-testid={`officer-tab-${k}`}
                  className={`flex-1 py-1.5 rounded border text-[11px] tracking-widest ${tab === k ? 'border-amber-600 bg-amber-950/40 text-amber-100' : 'border-stone-800 text-stone-400 hover:text-stone-200'}`}
                  onClick={() => setTab(k)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'stats' && (
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-4">
                  <section>
                    <h3 className="mb-2 text-xs tracking-widest text-amber-500">六维</h3>
                    <div className="space-y-2">
                      {STAT_ROWS.map(([label, key, isStamina]) => {
                        const raw = isStamina ? (officer.stamina ?? 0) : officer.stats[key];
                        const capped = Math.min(raw, 100);
                        const overflow = raw > 100 ? raw - 100 : 0;
                        const display = overflow > 0 ? `${capped} (+${overflow})` : String(capped);
                        return <div key={key} className="grid grid-cols-[2rem_3rem_1fr] items-center gap-2 text-xs"><span className="text-stone-400">{label}</span><strong className={raw >= 95 ? 'text-amber-300' : 'text-stone-100'}>{display}</strong><div className="h-1.5 overflow-hidden rounded bg-stone-800"><div className="h-full bg-gradient-to-r from-red-950 via-amber-800 to-amber-400" style={{ width: `${capped}%` }} /></div></div>;
                      })}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-xs tracking-widest text-amber-500">官职</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Info label="文官" value={CIVIL_LABELS[officer.civilPosition]} />
                      <Info label="地方" value={LOCAL_LABELS[officer.localPosition]} />
                      <Info label="武官" value={MILITARY_LABELS[officer.militaryPosition]} />
                      <Info label="爵位" value={NOBILITY_LABEL[officer.nobilityRank] ?? String(officer.nobilityRank)} />
                      {officer.hegemonyPosition && officer.hegemonyPosition !== HegemonyPosition.NONE && (
                        <Info label="朝职" value={HEGEMONY_LABELS[officer.hegemonyPosition]} />
                      )}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-xs tracking-widest text-amber-500">技能</h3>
                    <div className="flex flex-wrap gap-1.5 text-[11px] max-h-32 overflow-y-auto">
                      {officer.uniqueSkill && <Chip text={`${SKILL_NAME[officer.uniqueSkill] ?? officer.uniqueSkill} · 专属`} accent />}
                      {officer.skills.map((skill) => <Chip key={skill.skillId} text={`${SKILL_NAME[skill.skillId] ?? skill.skillId} Lv${skill.level}`} />)}
                      {officer.skills.length === 0 && !officer.uniqueSkill && <span className="text-stone-600">暂无技能</span>}
                    </div>
                    <p className="mt-1.5 text-[10px] text-stone-600">技能升级系统待实装，当前仅展示已有技能等级</p>
                  </section>

                  <section>
                    <h3 className="mb-2 text-xs tracking-widest text-amber-500">性格与理想</h3>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <Chip text={`性 · ${PERSONALITY_LABEL[officer.hidden.personality] ?? officer.hidden.personality}`} />
                      <Chip text={`理 · ${IDEAL_LABEL[officer.hidden.ideal] ?? officer.hidden.ideal}`} accent />
                    </div>
                  </section>
                </div>

                <div className="space-y-4">
                  <section>
                    <h3 className="mb-2 text-xs tracking-widest text-amber-500">兵种适性</h3>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      {Object.entries(officer.unitProficiency).map(([unit, grade]) => <div key={unit} className="flex justify-between rounded border border-stone-800 bg-stone-900/50 px-2 py-1"><span className="text-stone-500">{UNIT_NAME[unit] ?? unit}</span><strong className="text-amber-200">{PROFICIENCY_LABEL[String(grade)] ?? String(grade)}</strong></div>)}
                    </div>
                  </section>
                  <section>
                    <h3 className="mb-2 text-xs tracking-widest text-amber-500">出身标签</h3>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">{officer.tags.map((tag) => <Chip key={tag} text={tag} />)}{officer.tags.length === 0 && <span className="text-stone-600">暂无标签</span>}</div>
                    <p className="mt-1.5 text-[10px] text-stone-600">出身分类（社会·地域·职业·政治·特殊），非家族关系数据</p>
                  </section>
                  <section>
                    <h3 className="mb-2 text-xs tracking-widest text-amber-500">阵型</h3>
                    <div className="flex flex-wrap gap-1.5 text-[11px] max-h-32 overflow-y-auto">
                      {officer.formationMastery.map((fid) => <Chip key={fid} text={FORMATION_LABEL[fid] ?? `未知·${fid}`} />)}
                      {officer.formationMastery.length === 0 && <span className="text-stone-600">暂无阵型</span>}
                    </div>
                    <p className="mt-1.5 text-[10px] text-stone-600">阵型精通成长系统待实装，当前仅展示已掌握阵型</p>
                  </section>
                  <section>
                    <h3 className="mb-2 text-xs tracking-widest text-amber-500">状态</h3>
                    <Info label="状态" value={STATUS_LABEL[officer.status] ?? String(officer.status)} />
                  </section>
                  {!isRuler && (
                    <section>
                      <h3 className="mb-2 text-xs tracking-widest text-amber-500">拉拢记录</h3>
                      <Info label="赏赐美人" value={String(officer.beauties.length)} />
                      <p className="mt-1.5 text-[10px] text-stone-600">S09 势力资源赏赐记录，用于提升该武将忠诚度，与婚姻/家族身份无关</p>
                    </section>
                  )}
                </div>
              </div>
            )}

            {tab === 'biography' && (
              <section>
                <h3 className="mb-2 text-xs tracking-widest text-amber-500">列传</h3>
                {officer.biography ? (
                  <p className="text-xs leading-6 text-stone-300 whitespace-pre-line">{officer.biography}</p>
                ) : (
                  <p className="text-stone-600 text-xs">暂无列传记载</p>
                )}
              </section>
            )}

            {tab === 'family' && (
              <div className="space-y-4">
                <section>
                  <h3 className="mb-2 text-xs tracking-widest text-amber-500">婚姻</h3>
                  <Info label="正妻" value={wife ?? '—'} />
                </section>

                <section>
                  <h3 className="mb-2 text-xs tracking-widest text-amber-500">子女</h3>
                  {children.length === 0 ? (
                    <p className="text-stone-600 text-xs">无子女记录</p>
                  ) : (
                    <div className="space-y-1">
                      {children.map((c) => {
                        const live = game.officers[c.childId];
                        return (
                          <div key={c.childId} className="rounded border border-stone-800 bg-stone-900/50 px-2 py-1.5 text-xs">
                            <div className="text-stone-200">{c.childName}</div>
                            <div className="text-stone-500 text-[10px] mt-0.5">
                              {c.birthYear}生 · {c.appearYear}登场 · {c.source}
                            </div>
                            {live ? (
                              <div className="text-emerald-600/90 text-[10px] mt-0.5">
                                已登场
                                {live.faction === officer.faction ? '·本势力' : live.faction == null ? '·在野' : '·他势力'}
                              </div>
                            ) : (
                              <div className="text-stone-600 text-[10px] mt-0.5">待登场</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-xs tracking-widest text-amber-500">效力</h3>
                  <Info label="当前状态" value={STATUS_LABEL[officer.status] ?? String(officer.status)} />
                  {factionName && <Info label="所属势力" value={factionName} />}
                  {officer.faction == null && officer.status === 'free' && (
                    <p className="mt-1.5 text-[10px] text-stone-600">在野武将，满足相性/理想/血亲条件可投奔势力</p>
                  )}
                </section>
              </div>
            )}

            {tab === 'equipment' && (
              <div className="space-y-4">
                <p className="text-[10px] text-stone-600">装备系统待实装（Officer.equipped 5 槽代码未实装，0-B 技术债 D-0B-7），当前仅展示占位槽位</p>
                <div className="grid grid-cols-2 gap-2">
                  {EQUIP_SLOTS.map((slot) => (
                    <div key={slot.key} className="rounded border border-stone-800 bg-stone-900/50 px-3 py-2">
                      <div className="text-[10px] text-stone-500">{slot.label}</div>
                      <div className="text-stone-600 text-xs mt-1">未装备</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded border border-stone-800 bg-stone-900/50 px-2 py-1.5"><span className="text-stone-500">{label}</span><span className="float-right text-stone-200">{value || '—'}</span></div>; }
function Chip({ text, accent = false }: { text: string; accent?: boolean }) { return <span className={`rounded border px-2 py-1 ${accent ? 'border-rose-800 bg-rose-950/40 text-rose-200' : 'border-stone-700 bg-stone-900 text-stone-300'}`}>{text}</span>; }
