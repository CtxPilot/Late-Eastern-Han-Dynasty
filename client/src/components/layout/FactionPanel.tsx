// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import {
  deriveFactionParties,
  type FactionParty,
} from '../../lib/factionInner';
import { InkButton } from '../ui/buttons';
import { SealIcon } from '../ui/SealBadge';

export interface FactionPanelProps {
  game?: any;
  onSelectOfficer?: (officerId: number) => void;
}

export function FactionPanel({ game: propsGame, onSelectOfficer }: FactionPanelProps) {
  const storeGame = useGameStore((s) => s.game);
  const game = propsGame ?? storeGame;
  const [expandedOrigin, setExpandedOrigin] = useState<string | null>(null);

  const report = useMemo(() => {
    if (!game) return null;
    return deriveFactionParties(game.officers, game.playerFactionId);
  }, [game]);

  if (!game || !report) {
    return (
      <div className="p-3 text-xs text-stone-500 font-song">
        暂无势力派系数据
      </div>
    );
  }

  const { parties, unalignedCount, totalOfficers, cohesionScore, cohesionLevel } = report;

  const toggleExpand = (origin: string) => {
    setExpandedOrigin((prev) => (prev === origin ? null : origin));
  };

  const getCohesionColor = () => {
    if (cohesionScore >= 80) return 'text-emerald-400 bg-emerald-950/70 border-emerald-800';
    if (cohesionScore >= 60) return 'text-amber-300 bg-amber-950/70 border-amber-800';
    if (cohesionScore >= 40) return 'text-orange-400 bg-orange-950/70 border-orange-800';
    return 'text-rose-400 bg-rose-950/70 border-rose-800';
  };

  return (
    <div className="p-2.5 space-y-3 font-song text-xs" data-testid="faction-panel">
      {/* 1. 凝聚力仪表与总览 */}
      <div className="rounded border border-stone-800 bg-stone-900/60 p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-stone-400 flex items-center gap-1.5">
            <SealIcon kind="network" size={13} />
            <span>朝野门阀凝聚力</span>
          </span>
          <span className={`px-2 py-0.5 rounded text-[11px] border font-medium ${getCohesionColor()}`}>
            {cohesionLevel} · {cohesionScore} 分
          </span>
        </div>

        {/* 凝聚力比例条 */}
        <div className="h-1.5 w-full bg-stone-950 rounded overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              cohesionScore >= 80
                ? 'bg-gradient-to-r from-emerald-600 to-teal-400'
                : cohesionScore >= 60
                  ? 'bg-gradient-to-r from-amber-600 to-yellow-400'
                  : 'bg-gradient-to-r from-rose-700 to-amber-600'
            }`}
            style={{ width: `${cohesionScore}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
          <span>共 {totalOfficers} 名在任官员</span>
          <span>
            {parties.length} 大派系 · {unalignedCount} 散员
          </span>
        </div>
      </div>

      {/* 2. 派系卡片列表 */}
      {parties.length === 0 ? (
        <div className="rounded border border-dashed border-stone-800 p-3 text-center text-stone-500 text-xs">
          麾下文武出身均衡分散，尚未形成规模派系（≥3 人成派）。
        </div>
      ) : (
        <div className="space-y-2">
          {parties.map((party) => {
            const isExpanded = expandedOrigin === party.origin;
            return (
              <FactionPartyCard
                key={party.origin}
                party={party}
                isExpanded={isExpanded}
                onToggle={() => toggleExpand(party.origin)}
                onSelectOfficer={onSelectOfficer}
              />
            );
          })}
        </div>
      )}

      {/* 3. 散员提示与古训 */}
      {unalignedCount > 0 && (
        <div className="px-2 py-1.5 rounded bg-stone-950/80 border border-stone-900 text-[11px] text-stone-500 flex items-center justify-between">
          <span>游离散员（暂无门阀归属）</span>
          <span className="font-mono text-stone-400">{unalignedCount} 人</span>
        </div>
      )}

      <p className="text-[11px] text-stone-600 leading-relaxed px-1">
        同派系群臣日常协作亲密加剧；若异派并立内耗，宜颁布崇贤法度平衡朝堂。
      </p>
    </div>
  );
}

function FactionPartyCard({
  party,
  isExpanded,
  onToggle,
  onSelectOfficer,
}: {
  party: FactionParty;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectOfficer?: (officerId: number) => void;
}) {
  return (
    <div
      className={`rounded border bg-stone-900/80 transition-all ${party.borderClass}`}
      data-testid={`faction-card-${party.origin}`}
    >
      {/* 标题行 */}
      <div
        className="px-2.5 py-2 flex items-center justify-between cursor-pointer hover:bg-stone-800/40"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${party.badgeClass}`}>
            {party.tagLabel}
          </span>
          <span className="text-stone-100 font-medium text-xs tracking-wide">
            {party.name}
          </span>
          <span className="text-stone-500 text-[11px]">
            ({party.memberCount} 人)
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-stone-400">
            忠诚 <strong className="font-mono text-amber-300">{party.averageLoyalty}</strong>
          </span>
          <span className="text-stone-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* 领袖与简介 */}
      <div className="px-2.5 pb-2 text-[11px] space-y-1.5 border-t border-stone-800/40 pt-1.5">
        <div className="flex items-center justify-between text-stone-400">
          <span className="flex items-center gap-1.5">
            <span className="text-amber-500 font-serif">[ 魁 ]</span>
            <span>派系领袖：</span>
            <strong className="text-stone-200">{party.leader.name}</strong>
          </span>
          <span className="text-stone-500 font-mono text-[10px]">
            統{party.leader.stats.leadership} 武{party.leader.stats.war} 智{party.leader.stats.intelligence}
          </span>
        </div>
        <p className="text-stone-400 text-[11px] leading-relaxed">
          {party.description}
        </p>
      </div>

      {/* 展开的成员明细 */}
      {isExpanded && (
        <div className="px-2.5 pb-2 pt-1 border-t border-stone-800/50 bg-stone-950/60 space-y-1">
          <div className="text-[10px] text-stone-500 mb-1">派系群英：</div>
          <div className="grid grid-cols-2 gap-1.5">
            {party.members.map((m) => (
              <InkButton
                key={m.id}
                type="button"
                className="flex items-center justify-between px-2 py-1 rounded bg-stone-900 border border-stone-800 hover:border-amber-700 text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectOfficer?.(m.id);
                }}
              >
                <span className="text-stone-200 text-xs truncate max-w-[70px]">
                  {m.name}
                  {m.id === party.leader.id && (
                    <span className="text-amber-400 text-[10px] ml-0.5">★</span>
                  )}
                </span>
                <span className="text-stone-500 text-[10px] font-mono">
                  忠{m.loyalty}
                </span>
              </InkButton>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
