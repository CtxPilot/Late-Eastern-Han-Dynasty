// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useMemo, useState } from 'react';
import {
  CIVIL_LABELS,
  EQUIP_SLOT_LABELS,
  EQUIP_SLOT_ORDER,
  FORMATION_LABEL,
  HEGEMONY_LABELS,
  HegemonyPosition,
  IDEAL_LABEL,
  LOCAL_LABELS,
  MILITARY_LABELS,
  PERSONALITY_LABEL,
  equipmentStatBonus,
  meritAttrBonusFor,
  meritEntry,
  meritLevelFor,
  meritNextThreshold,
  meritTitle,
  meritTroopBonus,
  type GameState,
  type Officer,
  type OfficerRelation,
  type SkillTreeDef,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { getFactionResourceTotals } from '../../utils/factionResources';
import { getOfficerProfile } from './OfficerPortrait';
import { ExpressionPortrait } from './ExpressionPortrait';
import * as api from '../../services/api';

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
  guanneiMarquis: '关内侯',
  tingMarquis: '亭侯',
  xiangMarquis: '乡侯',
  xianMarquis: '县侯',
  duke: '公',
  king: '王',
  emperor: '皇帝',
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

type Tab = 'stats' | 'relations' | 'equipment' | 'biography' | 'skills';

const TABS: readonly [Tab, string][] = [
  ['stats', '属性'],
  ['relations', '关系'],
  ['equipment', '装备'],
  ['biography', '列传'],
  ['skills', '技能'],
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

  // 装备属性加成（S13 Session 266：baseStats 六维累计，从 itemsCatalog 计算）
  const itemsCatalog = useGameStore((s) => s.itemsCatalog);
  const equipAttr = useMemo(() => {
    if (!officer) return {};
    return equipmentStatBonus(officer.equipment, (id) => itemsCatalog.find((i) => i.id === id));
  }, [itemsCatalog, officer]);

  if (!officer) return null;
  const location = officer.location != null ? game.cities[officer.location]?.name ?? '未知' : '未驻城';
  const age = officer.birthYear > 0 ? Math.max(0, game.currentYear - officer.birthYear) : null;
  const wife = officer.wifeId != null ? game.females[officer.wifeId]?.name : null;
  const profile = getOfficerProfile(officer);
  const armyMorale = game.campaignArmies.find((a) => a.commanderId === officer.id)?.morale;
  const signatureStat = STAT_ROWS.filter(r => !r[2]).reduce((best, row) => officer.stats[row[1]] > officer.stats[best[1]] ? row : best, STAT_ROWS[0]);
  const factionName = officer.faction != null ? game.factions[officer.faction]?.name ?? '未知势力' : null;
  const isRuler = realmStats != null;
  // S12 功绩等级展示（docs/04 §十）：由 merit 派生等级/称号/进度；君主不参与
  const meritLevel = meritLevelFor(officer.merit);
  const meritTitleText = meritTitle(meritLevel, officer.meritPath ?? 'neutral');
  const meritNext = meritNextThreshold(officer.merit);
  const meritCurrentThreshold = meritEntry(meritLevel).threshold;
  const meritPct = meritNext
    ? Math.min(100, Math.round(((officer.merit - meritCurrentThreshold) / Math.max(1, meritNext.threshold - meritCurrentThreshold)) * 100))
    : 100;
  const meritTroop = meritTroopBonus(meritLevel);
  // 等级表属性加成（Session 265 数值消费；君主不参与）
  const meritAttr = meritAttrBonusFor(officer);
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
                  <Info label="功绩" value={`Lv${meritLevel} · ${meritTitleText}`} />
                </>
              )}
              <Info label="行动" value={`${officer.actionsPerMonth ?? 1}/月`} />
              <Info label="人物成长" value={`经验 ${officer.experience}`} />
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
                  {k === 'equipment'
                    ? `${label} ${Object.keys(officer.equipment ?? {}).length}/${EQUIP_SLOT_ORDER.length}`
                    : label}
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
                        // 功绩属性加成展示（等级表 Lv5/15/16/17/20，Session 265）
                        const meritBonus = isRuler ? 0 : (isStamina ? (meritAttr.stamina ?? 0) : (meritAttr[key] ?? 0));
                        // 装备属性加成（S13 Session 266：baseStats 六维累计）
                        const equipBonus = isStamina ? 0 : (equipAttr[key] ?? 0);
                        const capped = Math.min(raw, 100);
                        const overflow = raw > 100 ? raw - 100 : 0;
                        const display = overflow > 0 ? `${capped} (+${overflow})` : String(capped);
                        return <div key={key} className="grid grid-cols-[2rem_3.5rem_1fr] items-center gap-2 text-xs"><span className="text-stone-400">{label}</span><strong className={raw >= 95 ? 'text-amber-300' : 'text-stone-100'}>{display}{meritBonus > 0 ? <span className="ml-0.5 text-emerald-400">+{meritBonus}</span> : null}{equipBonus > 0 ? <span className="ml-0.5 text-sky-300">装+{equipBonus}</span> : null}</strong><div className="h-1.5 overflow-hidden rounded bg-stone-800"><div className="h-full bg-gradient-to-r from-red-950 via-amber-800 to-amber-400" style={{ width: `${capped}%` }} /></div></div>;
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
                    <h3 className="mb-2 text-xs tracking-widest text-amber-500">人物成长</h3>
                    <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
                      <Info label="经验" value={String(officer.experience)} />
                      <Info label="功绩" value={isRuler ? '君主不计' : `${officer.merit} / ${meritNext ? meritNext.threshold : 'MAX'}`} />
                    </div>
                    {!isRuler && (
                      <div className="mb-2">
                        <div className="flex items-baseline justify-between text-[10px] text-stone-500">
                          <span>功绩 Lv{meritLevel} {meritTitleText}{meritTroop > 0 ? ` · 带兵+${meritTroop}` : ''}</span>
                          <span>{meritNext ? `距 Lv${meritNext.level}` : '已至巅峰'}</span>
                        </div>
                        <div className="mt-0.5 h-1 overflow-hidden rounded bg-stone-800">
                          <div className="h-full bg-gradient-to-r from-amber-950 via-amber-700 to-amber-400" style={{ width: `${meritPct}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 text-[11px] max-h-32 overflow-y-auto">
                      {officer.uniqueSkill && <Chip text={`${SKILL_NAME[officer.uniqueSkill] ?? officer.uniqueSkill} · 专属`} accent />}
                      {officer.skills.map((skill) => <Chip key={skill.skillId} text={`${SKILL_NAME[skill.skillId] ?? skill.skillId} Lv${skill.level} · 用${skill.useCount}`} />)}
                      {officer.skills.length === 0 && !officer.uniqueSkill && <span className="text-stone-600">暂无技能</span>}
                    </div>
                    <p className="mt-1.5 text-[10px] text-stone-600">经验、功绩与技能使用次数统一在此解释；属性/技能自动升级规则待实装。</p>
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
                    <h3 className="mb-2 text-xs tracking-widest text-amber-500">阵型精通</h3>
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

            {tab === 'relations' && (
              <RelationshipsTab
                officer={officer}
                game={game}
                wife={wife}
                children={children}
                factionName={factionName}
              />
            )}

            {tab === 'skills' && <SkillsTab officer={officer} game={game} />}

            {tab === 'equipment' && <EquipmentTab game={game} officer={officer} isRuler={isRuler} />}
          </div>
        </div>
      </section>
    </div>
  );
}

/** S13 装备 tab（Session 266，0-A 5 槽）：展示武将装备 + 势力库存，支持装备/卸下/赏赐。 */
function EquipmentTab({
  game,
  officer,
  isRuler,
}: {
  game: GameState;
  officer: Officer;
  isRuler: boolean;
}) {
  const itemsCatalog = useGameStore((s) => s.itemsCatalog);
  const unequipItem = useGameStore((s) => s.unequipItem);
  const grantTreasure = useGameStore((s) => s.grantTreasure);
  const loading = useGameStore((s) => s.loading);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const itemById = (id: number) => itemsCatalog.find((i) => i.id === id);
  const inventory = officer.faction != null ? game.factions[officer.faction]?.inventory ?? {} : {};

  const equippedIds = new Set(Object.values(officer.equipment ?? {}));
  const inventoryEntries = Object.entries(inventory).filter(([id]) => !equippedIds.has(Number(id)));

  return (
    <div className="space-y-4">
      {itemsCatalog.length === 0 && (
        <p className="text-[10px] text-amber-700" data-testid="equipment-catalog-status">
          宝物目录加载中；装备槽与已绑定的宝物编号仍可查看。
        </p>
      )}
      <p className="text-[10px] text-stone-600">
        S13 宝物系统（0-A 5 槽：主武器/副武器/铠甲/坐骑/兵书）。装备/卸下对武将自由操作；赏赐需宝物在势力库存。
      </p>

      <h3 className="text-xs tracking-widest text-amber-500">装备（5槽）</h3>
      <div className="grid grid-cols-2 gap-2">
        {EQUIP_SLOT_ORDER.map((slotKey) => {
          const itemId = officer.equipment?.[slotKey];
          const item = itemId != null ? itemById(itemId) : null;
          const slotLabel = EQUIP_SLOT_LABELS[slotKey];
          return (
            <div key={slotKey} className="rounded border border-stone-800 bg-stone-900/50 px-3 py-2" data-testid={`equip-slot-${slotKey}`}>
              <div className="text-[10px] text-stone-500">{slotLabel}</div>
              {item ? (
                <div className="mt-1">
                  <div className="text-xs text-amber-200">{item.name}</div>
                  <div className="text-[10px] text-stone-500">{QUALITY_LABEL[item.quality]} · {item.description}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(item.baseStats).map(([k, v]) => (
                      <span key={k} className="rounded bg-stone-800 px-1 text-[10px] text-emerald-300">{STAT_LABEL[k]} +{v}</span>
                    ))}
                    {item.baseEffect.map((e, i) => (
                      <span key={i} className="rounded bg-stone-800 px-1 text-[10px] text-amber-300">{e.description ?? `${EFFECT_LABEL[e.type] ?? e.type} +${e.value}`}</span>
                    ))}
                  </div>
                  {!isRuler && (
                    <button
                      type="button"
                      data-testid={`btn-unequip-${itemId}`}
                      disabled={loading}
                      onClick={() => unequipItem(officer.id, itemId!)}
                      className="mt-1.5 px-2 py-0.5 rounded border border-stone-700 text-stone-300 text-[10px] disabled:opacity-40"
                    >
                      卸下
                    </button>
                  )}
                </div>
              ) : itemId != null ? (
                <div className="mt-1 text-xs text-amber-700">宝物 #{itemId}（目录加载中）</div>
              ) : (
                <div className="text-stone-600 text-xs mt-1">未装备</div>
              )}
            </div>
          );
        })}
      </div>

      {!isRuler && (
        <>
          <h3 className="mt-4 text-xs tracking-widest text-amber-500">装备/赏赐宝物</h3>
          <div className="flex items-center gap-2">
            <select
              data-testid="item-inventory-select"
              className="flex-1 rounded border border-stone-700 bg-stone-900 text-stone-200 text-[10px] px-1 py-0.5"
              value={selectedItemId ?? ''}
              onChange={(e) => setSelectedItemId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">选择库存宝物…</option>
              {inventoryEntries.map(([id, count]) => {
                const it = itemById(Number(id));
                if (!it) return null;
                return (
                  <option key={id} value={id}>
                    {it.name} ×{count}（{QUALITY_LABEL[it.quality]}）
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              data-testid="btn-grant-item"
              disabled={loading || selectedItemId == null}
              onClick={() => grantTreasure(officer.id, selectedItemId!)}
              className="px-2 py-0.5 rounded border border-amber-800 text-amber-100 disabled:opacity-40"
            >
              赏赐并装备
            </button>
          </div>
          {inventoryEntries.length === 0 && (
            <p className="text-[10px] text-stone-600">势力库存暂无宝物（搜索寻访或开局宝配获取）。</p>
          )}
        </>
      )}

      <h3 className="mt-4 text-xs tracking-widest text-amber-500">势力库存</h3>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(inventory).map(([id, count]) => {
          const it = itemById(Number(id));
          if (!it) return null;
          return (
            <span key={id} className="rounded border border-stone-800 bg-stone-900/60 px-2 py-1 text-[10px] text-stone-300">
              {it.name} ×{count}
            </span>
          );
        })}
        {Object.keys(inventory).length === 0 && (
          <span className="text-[10px] text-stone-600">空</span>
        )}
      </div>
    </div>
  );
}

const QUALITY_LABEL: Record<string, string> = {
  common: '普通',
  rare: '稀有',
  epic: '精良',
  legendary: '传说',
};

const STAT_LABEL: Record<string, string> = {
  war: '武',
  leadership: '统',
  intelligence: '智',
  politics: '政',
  charisma: '魅',
};

const EFFECT_LABEL: Record<string, string> = {
  crit_rate: '暴击率',
  charge_damage: '突击伤害',
  vs_cavalry: '对骑',
  authority: '权威',
  range: '射程',
  armor_pierce: '破甲',
  defense: '防御',
  arrow_resist: '防箭',
  mobility: '机动力',
  escape: '逃脱',
  tactic_power: '计策威力',
  legitimacy: '正统',
  recruit_bonus: '征兵',
  duel_boost: '单挑伤害',
};

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded border border-stone-800 bg-stone-900/50 px-2 py-1.5"><span className="text-stone-500">{label}</span><span className="float-right text-stone-200">{value || '—'}</span></div>; }
function Chip({ text, accent = false }: { text: string; accent?: boolean }) { return <span className={`rounded border px-2 py-1 ${accent ? 'border-rose-800 bg-rose-950/40 text-rose-200' : 'border-stone-700 bg-stone-900 text-stone-300'}`}>{text}</span>; }

const RELATION_TYPE_LABEL: Record<string, string> = {
  sworn: '义兄弟', master_disciple: '师徒', parent_child: '父子',
  siblings: '兄弟', spouse: '夫妻', best_friend: '挚友',
  enemy: '宿敌', lord_retainer: '君臣',
};

const RELATION_STATE_LABEL: Record<string, string> = {
  intimate: '亲密', friendly: '友好', neutral: '普通',
  dislike: '嫌恶', hostile: '仇敌',
};

const RELATION_STATE_COLOR: Record<string, string> = {
  intimate: 'text-emerald-400', friendly: 'text-sky-300', neutral: 'text-stone-400',
  dislike: 'text-orange-300', hostile: 'text-red-400',
};

function RelationshipsTab({
  officer,
  game,
  wife,
  children,
  factionName,
}: {
  officer: Officer;
  game: GameState;
  wife: string | null;
  children: api.ChildCatalogEntry[];
  factionName: string | null;
}) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-xs tracking-widest text-amber-500">婚姻</h3>
        <Info label="正妻" value={wife ?? '—'} />
        {officer.consortIds && officer.consortIds.length > 0 && (
          <div className="mt-2 space-y-1">
            {officer.consortIds.map((c, i) => {
              const female = game.females[c.id];
              return (
                <div key={i} className="rounded border border-stone-800 bg-stone-900/50 px-2 py-1 text-xs">
                  <span className="text-stone-200">{female?.name ?? `#${c.id}`}</span>
                  <span className="ml-2 text-[10px] text-stone-500">{c.rank === 'concubine' ? '妾' : '姬'}</span>
                </div>
              );
            })}
          </div>
        )}
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
                  <div className="text-stone-500 text-[10px] mt-0.5">{c.birthYear}生 · {c.appearYear}登场 · {c.source}</div>
                  {live ? (
                    <div className="text-emerald-600/90 text-[10px] mt-0.5">
                      已登场{live.faction === officer.faction ? '·本势力' : live.faction == null ? '·在野' : '·他势力'}
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

      <RelationsTab officer={officer} game={game} />
    </div>
  );
}

function RelationsTab({ officer, game }: { officer: Officer; game: GameState }) {
  const [relations, setRelations] = useState<OfficerRelation[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    void api.getOfficerRelations(officer.id).then((r) => { setRelations(r); setLoading(false); });
  }, [officer.id]);
  if (loading) return <p className="text-stone-500 text-xs">加载社交关系…</p>;
  if (relations.length === 0) return <p className="text-stone-600 text-xs">暂无社交关系记录</p>;
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-xs tracking-widest text-amber-500">社交关系</h3>
        <div className="space-y-1.5">
          {relations.map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded border border-stone-800 bg-stone-900/50 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-stone-200">{r.targetName}</span>
                <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] text-stone-400">{RELATION_TYPE_LABEL[r.type] ?? r.type}</span>
                <span className={`text-[10px] ${r.source === 'official' ? 'text-emerald-500' : 'text-amber-500'}`}>{r.source === 'official' ? '正史' : '演义'}</span>
              </div>
              <span className={`text-[10px] ${RELATION_STATE_COLOR[r.state] ?? 'text-stone-400'}`}>{RELATION_STATE_LABEL[r.state] ?? r.state}（{r.affinity}）</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-xs tracking-widest text-amber-500">关系图谱</h3>
        <RelationGraph officerId={officer.id} relations={relations} game={game} />
      </section>
    </div>
  );
}

function RelationGraph({ officerId, relations, game }: { officerId: number; relations: OfficerRelation[]; game: GameState }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = 80;
  const self = game.officers[officerId];
  if (!self || relations.length === 0) return <p className="text-stone-600 text-[10px]">无关系数据</p>;
  const typeColors: Record<string, string> = {
    sworn: '#f59e0b', master_disciple: '#10b981', parent_child: '#3b82f6',
    siblings: '#6366f1', spouse: '#ec4899', best_friend: '#14b8a6',
    enemy: '#ef4444', lord_retainer: '#8b5cf6',
  };
  return (
    <svg width={size} height={size} className="mx-auto">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#333" strokeWidth={0.5} strokeDasharray="4 2" />
      {relations.map((rel, i) => {
        const angle = (2 * Math.PI * i) / relations.length - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={typeColors[rel.type] ?? '#666'} strokeWidth={1.5} opacity={0.6} />
            <circle cx={x} cy={y} r={10} fill={typeColors[rel.type] ?? '#555'} stroke="#222" strokeWidth={1} />
            <text x={x} y={y + 3} textAnchor="middle" fill="#fff" fontSize={8} fontFamily="HanDynastySerif">{rel.targetName.slice(0, 1)}</text>
            <text x={x} y={y + 18} textAnchor="middle" fill="#999" fontSize={7} fontFamily="HanDynastySerif">{rel.targetName.slice(0, 2)}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={16} fill="#d97706" stroke="#222" strokeWidth={2} />
      <text x={cx} y={cy + 4} textAnchor="middle" fill="#fff" fontSize={12} fontFamily="HanDynastySerif" fontWeight="bold">{self.name.slice(0, 1)}</text>
    </svg>
  );
}

function SkillsTab({ officer, game: _game }: { officer: Officer; game: GameState }) {
  const [trees, setTrees] = useState<SkillTreeDef[]>([]);
  const [skillState, setSkillState] = useState<api.OfficerSkillState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTree, setSelectedTree] = useState<string>('strategy');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true);
    void Promise.all([
      api.getSkillTrees(),
      api.getOfficerSkillState(officer.id),
    ]).then(([t, s]) => { setTrees(t); setSkillState(s); setLoading(false); });
  }, [officer.id]);
  if (loading) return <p className="text-stone-500 text-xs">加载技能树…</p>;
  if (!skillState) return <p className="text-stone-600 text-xs">技能数据不可用</p>;
  const currentTree = trees.find((t) => t.id === selectedTree);
  const totalPoints = skillState.totalSkillPoints;
  const usedPoints = skillState.skillPointsSpent;
  const remaining = totalPoints - usedPoints;
  const traitTotal = skillState.totalTraitPoints;
  const traitUsed = skillState.traitPointsSpent;
  const traitRemaining = traitTotal - traitUsed;
  const handleUpgrade = async (nodeId: string) => {
    try {
      const next = await api.upgradeSkillNode(officer.id, nodeId);
      setSkillState(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加点失败');
    }
  };
  const handleReset = async () => {
    try {
      const next = await api.resetSkillTree(officer.id);
      setSkillState(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '重置失败');
    }
  };
  return (
    <div className="space-y-4">
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <section>
        <h3 className="mb-2 text-xs tracking-widest text-amber-500">技能点</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-stone-300">剩余 <strong className="text-amber-300">{remaining}</strong> / {totalPoints}</span>
          <span className="text-stone-500">已用 {usedPoints}</span>
          <button type="button" onClick={handleReset} className="px-2 py-0.5 rounded border border-stone-700 text-stone-400 text-[10px] hover:text-stone-200">重置</button>
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-xs tracking-widest text-amber-500">技能树</h3>
        <div className="flex gap-1 mb-2">
          {trees.map((t) => (
            <button key={t.id} type="button" onClick={() => setSelectedTree(t.id)}
              className={`px-2 py-1 rounded text-[10px] border ${selectedTree === t.id ? 'border-amber-600 bg-amber-950/40 text-amber-100' : 'border-stone-800 text-stone-400'}`}
            >{t.name}</button>
          ))}
        </div>
        {currentTree && (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {currentTree.nodes.map((node) => {
              const lv = skillState.skillTreeState[node.id] ?? 0;
              const unlocked = node.prerequisites.every((p) => (skillState.skillTreeState[p] ?? 0) > 0);
              const maxed = lv >= node.maxLevel;
              const canUp = unlocked && !maxed && remaining >= node.costPerLevel;
              return (
                <div key={node.id} className={`flex items-center justify-between rounded border px-3 py-1.5 text-xs ${lv > 0 ? 'border-amber-800/60 bg-amber-950/20' : unlocked ? 'border-stone-800 bg-stone-900/50' : 'border-stone-900 bg-stone-950/50 opacity-50'}`}>
                  <div>
                    <span className="text-stone-200">{node.name}</span>
                    <span className="ml-2 text-[10px] text-stone-500">{node.domains.map((d) => ({ battlefield: '战场', melee: '白刃', duel: '单挑', campaign: '战役', civil: '内政' })[d] ?? d).join('/')}</span>
                    {lv > 0 && <span className="ml-2 text-amber-400">Lv{lv}/{node.maxLevel}</span>}
                  </div>
                  {canUp && (
                    <button type="button" onClick={() => handleUpgrade(node.id)} className="px-2 py-0.5 rounded border border-amber-800 text-amber-200 text-[10px]">+{node.costPerLevel}</button>
                  )}
                  {maxed && <span className="text-emerald-500 text-[10px]">已满</span>}
                  {!unlocked && !maxed && <span className="text-stone-600 text-[10px]">锁定</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-xs tracking-widest text-amber-500">特性点</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-stone-300">剩余 <strong className="text-amber-300">{traitRemaining}</strong> / {traitTotal}</span>
          <span className="text-stone-500">已用 {traitUsed}</span>
        </div>
        <p className="text-[10px] text-stone-600 mt-1">特性（被动天赋）点数化：每 5 级 merit 获得 1 特性点，用于购买特性等级。特性全量 42 项待 0-B 实装。</p>
      </section>
    </div>
  );
}
