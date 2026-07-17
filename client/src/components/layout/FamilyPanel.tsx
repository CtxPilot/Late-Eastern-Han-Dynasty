// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import { MaritalStatus, OfficerStatus, panelStatsDisplay, type ChildBirthDef } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

type ChildBrief = Pick<
  ChildBirthDef,
  'childId' | 'childName' | 'fatherId' | 'motherId' | 'birthYear' | 'appearYear' | 'source'
>;

const INFLUENCE_LABEL: Record<string, string> = {
  household: '治家',
  counsel: '参谋',
  martial: '习武',
  prestige: '德望',
  fortitude: '韧性',
  scholarship: '学识',
};

/**
 * S18 家族面板：历史女角 + 姻亲 + 子女表
 * 不可寻访/人事搜索获得女角；除祝融外不可任职出战
 */
export function FamilyPanel() {
  const game = useGameStore((s) => s.game);
  const childrenCatalog = useGameStore((s) => s.childrenCatalog);
  const marry = useGameStore((s) => s.marry);
  const followCheck = useGameStore((s) => s.followCheck);
  const loading = useGameStore((s) => s.loading);
  const [selectedFemaleId, setSelectedFemaleId] = useState<number | null>(null);
  const [officerId, setOfficerId] = useState<number | null>(null);
  const [tab, setTab] = useState<'roster' | 'branches' | 'marry'>('roster');

  const females = useMemo(() => {
    if (!game) return [];
    return Object.values(game.females)
      .filter((f) => f.factionId === game.playerFactionId)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [game]);

  const officers = useMemo(() => {
    if (!game) return [];
    return Object.values(game.officers)
      .filter((o) => o.faction === game.playerFactionId)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [game]);

  /** 男将为中心的姻亲支 */
  const branches = useMemo(() => {
    if (!game) return [];
    return officers.map((o) => {
      const wives = females.filter(
        (f) => f.husbandId === o.id || o.wifeId === f.id,
      );
      const kids = childrenCatalog.filter(
        (c) => c.fatherId === o.id || wives.some((w) => w.id === c.motherId),
      );
      return { officer: o, wives, kids };
    }).filter((b) => b.wives.length > 0 || b.kids.length > 0);
  }, [game, officers, females, childrenCatalog]);

  if (!game) return null;

  const selected = selectedFemaleId != null ? game.females[selectedFemaleId] : null;
  const isAvailable = (status: MaritalStatus | string) =>
    status === MaritalStatus.SINGLE ||
    status === MaritalStatus.WIDOW ||
    status === 'single' ||
    status === 'widow';

  const canMarry =
    selected != null &&
    officerId != null &&
    !loading &&
    isAvailable(selected.status) &&
    !selected.husbandId;

  const roleLabel = (f: (typeof females)[0]) => {
    if (f.canCommand) return '可出战';
    if (f.husbandId != null) {
      const h = game.officers[f.husbandId];
      return `正室·${h?.name ?? f.husbandId}`;
    }
    if (f.giftedToOfficerId != null) {
      const o = game.officers[f.giftedToOfficerId];
      return `随侍·${o?.name ?? f.giftedToOfficerId}`;
    }
    if (String(f.status) === 'widow' || f.status === MaritalStatus.WIDOW) return '寡居';
    return '待字';
  };

  const topInfluence = (f: (typeof females)[0]) => {
    const entries = Object.entries(f.influence ?? {}).sort((a, b) => b[1] - a[1]);
    return entries
      .slice(0, 3)
      .map(([k, v]) => `${INFLUENCE_LABEL[k] ?? k}${v}`)
      .join(' ');
  };

  return (
    <div className="px-2 space-y-2 text-[11px]" data-testid="family-panel">
      <p className="text-stone-500 px-1 leading-snug">
        家族·历史女角（非美女库存）。经相关男性/事件/剧本入族；
        <strong className="text-amber-600/90">仅祝融</strong>
        可出战任职。
      </p>

      <div className="flex gap-1 px-0.5">
        {(
          [
            ['roster', '女眷'],
            ['branches', '姻亲'],
            ['marry', '婚配'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`flex-1 py-1 rounded border text-[10px] ${
              tab === k
                ? 'border-amber-600 bg-amber-950/40 text-amber-100'
                : 'border-stone-800 text-stone-400'
            }`}
            onClick={() => setTab(k)}
          >
            {label}
            {k === 'roster' ? ` ${females.length}` : ''}
          </button>
        ))}
      </div>

      {tab === 'roster' && (
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {females.length === 0 && (
            <p className="text-stone-600 px-1 py-2 border border-stone-800 rounded">
              本势力暂无历史女角。不可寻访/人事搜索获得。
            </p>
          )}
          {females.map((f) => (
            <button
              key={f.id}
              type="button"
              data-testid={`family-female-${f.id}`}
              className={`w-full text-left px-2 py-1.5 rounded border ${
                selectedFemaleId === f.id
                  ? 'border-amber-500 bg-amber-950/30 text-amber-50'
                  : 'border-stone-800 text-stone-300'
              }`}
              onClick={() => {
                setSelectedFemaleId(f.id);
                setTab('marry');
              }}
            >
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-medium">{f.name}</span>
                <span className="text-stone-500">{f.clanName}氏</span>
                {f.canCommand && (
                  <span className="text-[9px] px-1 rounded bg-red-950 border border-red-800 text-red-200">
                    可出战
                  </span>
                )}
                {!f.canCommand && (
                  <span className="text-[9px] px-1 rounded bg-stone-900 border border-stone-700 text-stone-500">
                    不任职
                  </span>
                )}
              </div>
              <div className="text-stone-500 text-[10px]">
                {roleLabel(f)} · {game.cities[f.locationId]?.name ?? '—'}
              </div>
              <div className="text-stone-600 text-[9px] truncate">{topInfluence(f)}</div>
            </button>
          ))}
        </div>
      )}

      {tab === 'branches' && (
        <div className="max-h-52 overflow-y-auto space-y-1.5">
          {branches.length === 0 && (
            <p className="text-stone-600 px-1">尚无姻亲支（武将娶妻或有子女表后显示）。</p>
          )}
          {branches.map(({ officer, wives, kids }) => (
            <div
              key={officer.id}
              className="rounded border border-stone-800 bg-stone-900/50 px-2 py-1.5"
              data-testid={`family-branch-${officer.id}`}
            >
              <div className="text-amber-200/90 font-medium">
                {officer.name}
                <span className="text-stone-500 font-normal ml-1">
                  武{panelStatsDisplay(officer.stats).war} 忠{officer.loyalty}
                </span>
              </div>
              {wives.map((w) => (
                <div key={w.id} className="text-stone-400 pl-2 text-[10px]">
                  └ 妻 {w.name}
                  {w.canCommand ? '（可出战）' : ''}
                </div>
              ))}
              {kids.map((k) => {
                const live = game.officers[k.childId];
                return (
                  <div key={k.childId} className="text-stone-500 pl-2 text-[10px]">
                    └ 子 {k.childName}
                    <span className="text-stone-600">
                      （{k.birthYear}生 · {k.appearYear}登场 · {k.source}）
                    </span>
                    {live ? (
                      <span className="text-emerald-600/90 ml-1">
                        已登场
                        {live.faction === game.playerFactionId
                          ? '·本势力'
                          : live.faction == null
                            ? '·在野'
                            : '·他势力'}
                      </span>
                    ) : (
                      <span className="text-stone-600 ml-1">待登场</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <p className="text-[9px] text-stone-600 px-1">
            子女于登场年正月入将领库；正妻婚配时叠母教。父辈/族谱后置。
          </p>
        </div>
      )}

      {tab === 'marry' && (
        <div className="space-y-1.5 border-t border-stone-800 pt-1.5">
          <p className="text-[10px] text-stone-500 px-0.5">
            仅历史女角可婚配；不消耗美女库存。
          </p>
          <select
            className="w-full rounded border border-stone-700 bg-stone-900 px-1 py-1 text-stone-200"
            value={selectedFemaleId ?? ''}
            onChange={(e) =>
              setSelectedFemaleId(e.target.value ? Number(e.target.value) : null)
            }
            data-testid="family-female-select"
          >
            <option value="">选择女眷…</option>
            {females.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {roleLabel(f)}
              </option>
            ))}
          </select>
          {selected && (
            <div className="text-[10px] text-stone-500 px-0.5 leading-snug line-clamp-4">
              {selected.description}
              {!selected.canCommand && (
                <span className="block text-stone-600 mt-0.5">
                  不可任职出战（家族影响力经丈夫/事件间接生效）。
                </span>
              )}
              {selected.canCommand && (
                <span className="block text-amber-700/80 mt-0.5">祝融特例：可出战。</span>
              )}
            </div>
          )}
          <select
            className="w-full rounded border border-stone-700 bg-stone-900 px-1 py-1 text-stone-200"
            value={officerId ?? ''}
            onChange={(e) =>
              setOfficerId(e.target.value ? Number(e.target.value) : null)
            }
            data-testid="family-officer-select"
          >
            <option value="">选择夫君（己方武将）…</option>
            {officers.map((o) => {
              const st = panelStatsDisplay(o.stats);
              const wife = o.wifeId != null ? game.females[o.wifeId]?.name : null;
              return (
                <option key={o.id} value={o.id}>
                  {o.name} 武{st.war}/魅{st.charisma}
                  {wife ? ` ·已有正室${wife}` : ''}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            data-testid="btn-family-marry"
            disabled={!canMarry}
            title="300金 → 正妻；忠诚+18"
            className={`w-full px-2 py-1.5 rounded border text-[11px] ${
              canMarry
                ? 'bg-amber-950 border-amber-700 text-amber-100 hover:bg-amber-900'
                : 'bg-stone-900 border-stone-700 text-stone-600 cursor-not-allowed'
            }`}
            onClick={() => {
              if (selectedFemaleId != null && officerId != null) {
                void marry(selectedFemaleId, officerId);
              }
            }}
          >
            赐婚 / 婚配
          </button>
        </div>
      )}

      {/* 在野武将 / 跟随检查 */}
      <div className="border-t border-stone-800 pt-2 mt-2 space-y-1">
        <div className="text-emerald-400/80 px-0.5 text-[11px]">在野武将 · 跟随</div>
        {(() => {
          if (!game) return null;
          const freeOfficers = Object.values(game.officers).filter(
            (o) => o.faction == null && o.status === OfficerStatus.FREE,
          );
          return (
            <>
              <p className="text-stone-600 text-[10px] px-0.5">
                在野武将{freeOfficers.length > 0 ? `（${freeOfficers.length}人）` : '：无'}。
                满足相性差&lt;20 / 理想一致 / 血亲召唤的在野武将可主动投奔（月度自动检定或手动检查）。
              </p>
              {freeOfficers.length > 0 && (
                <div className="max-h-20 overflow-y-auto space-y-0.5">
                  {freeOfficers.map((o) => {
                    const ruler = game.officers[game.factions[game.playerFactionId]?.rulerId];
                    const compatDiff = ruler
                      ? Math.abs(o.hidden.compatibility - ruler.hidden.compatibility)
                      : 99;
                    return (
                      <div key={o.id} className="px-1 py-0.5 text-[10px] text-stone-400 border border-stone-800 rounded">
                        {o.name} · 相性{o.hidden.compatibility} · 理想{o.hidden.ideal}
                        {compatDiff < 20 && (
                          <span className="text-emerald-400 ml-1">差{compatDiff}可投奔</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                data-testid="btn-follow-check"
                disabled={loading || freeOfficers.length === 0}
                className="w-full px-2 py-1 rounded border border-emerald-800 bg-emerald-950/30 text-emerald-100 disabled:opacity-40 text-[11px]"
                onClick={() => void followCheck()}
              >
                手动跟随检查
              </button>
            </>
          );
        })()}
      </div>
    </div>
  );
}

export type { ChildBrief };
