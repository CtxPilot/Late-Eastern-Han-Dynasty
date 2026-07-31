// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import type { CampaignPhase, GameState } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { MilitaryFormationForm } from './MilitaryFormationForm';
import { MilitaryOrdersPanel } from './MilitaryOrdersPanel';
import { MilitaryReadinessPanel } from './MilitaryReadinessPanel';

const PHASE_LABEL: Record<CampaignPhase, string> = {
  garrison: '驻守',
  marching: '行军',
  engaged: '接战',
  sieging: '围城',
  assaulting: '强攻',
  retreating: '撤退',
};

export type MilitaryCitySummary = {
  cityId: number;
  name: string;
  troops: number;
  morale: number;
  food: number;
  gold: number;
  officerCount: number;
};

export type MilitaryArmySummary = {
  armyId: string;
  name: string;
  commanderName: string;
  phase: CampaignPhase;
  phaseLabel: string;
  currentNodeName: string;
  targetNodeName: string | null;
  troops: number;
  morale: number;
  organization: number;
  fatigue: number;
  food: number;
};

export type MilitaryOverview = {
  cities: MilitaryCitySummary[];
  armies: MilitaryArmySummary[];
  totalTroops: number;
  totalFood: number;
  averageMorale: number;
};

export function buildMilitaryOverview(game: GameState): MilitaryOverview {
  const cities = Object.values(game.cities)
    .filter((city) => city.ruler === game.playerFactionId)
    .map((city) => ({
      cityId: city.id,
      name: city.name,
      troops: city.troops,
      morale: city.troopsMorale,
      food: city.food,
      gold: city.gold,
      officerCount: city.officers.filter(
        (id) => game.officers[id]?.faction === game.playerFactionId,
      ).length,
    }))
    .sort((a, b) => b.troops - a.troops || a.cityId - b.cityId);
  const armies = game.campaignArmies
    .filter((army) => army.factionId === game.playerFactionId)
    .map((army) => ({
      armyId: army.id,
      name: army.name,
      commanderName: game.officers[army.commanderId]?.name ?? '未知',
      phase: army.phase,
      phaseLabel: PHASE_LABEL[army.phase],
      currentNodeName: game.cities[army.currentNodeId]?.name ?? `节点${army.currentNodeId}`,
      targetNodeName: army.targetNodeId != null
        ? game.cities[army.targetNodeId]?.name ?? `节点${army.targetNodeId}`
        : null,
      troops: army.troops,
      morale: army.morale,
      organization: army.organization,
      fatigue: army.fatigue,
      food: army.food,
    }))
    .sort((a, b) => a.armyId.localeCompare(b.armyId));
  const totalTroops = cities.reduce((sum, city) => sum + city.troops, 0)
    + armies.reduce((sum, army) => sum + army.troops, 0);
  const totalFood = cities.reduce((sum, city) => sum + city.food, 0)
    + armies.reduce((sum, army) => sum + army.food, 0);
  const averageMorale = cities.length === 0
    ? 0
    : Math.round(cities.reduce((sum, city) => sum + city.morale, 0) / cities.length);
  return { cities, armies, totalTroops, totalFood, averageMorale };
}

type MilitaryFacet = 'readiness' | 'formation' | 'orders' | 'reports';

const FACETS: readonly { id: MilitaryFacet; label: string }[] = [
  { id: 'readiness', label: '军团战备' },
  { id: 'formation', label: '编成' },
  { id: 'orders', label: '军令' },
  { id: 'reports', label: '战报' },
];

export function MilitaryOverviewDrawer() {
  const game = useGameStore((state) => state.game);
  const lastBattleResult = useGameStore((state) => state.lastBattleResult);
  const [facet, setFacet] = useState<MilitaryFacet>('readiness');
  const overview = useMemo(() => game ? buildMilitaryOverview(game) : null, [game]);

  if (!game || !overview) {
    return <p data-testid="command-military-empty">尚未载入剧本。</p>;
  }
  const militaryLogs = game.actionLog.filter((entry) =>
    /campaign|battle|march|conscript|train/.test(entry.type),
  ).slice(0, 12);

  return (
    <div
      className="flex h-[min(34rem,calc(100vh-12rem))] min-h-0 flex-1 flex-col"
      data-testid="command-military-drawer"
    >
      <nav className="mb-3 grid grid-cols-4 gap-1" aria-label="军事分面">
        {FACETS.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`command-military-facet-${item.id}`}
            aria-current={facet === item.id ? 'page' : undefined}
            onClick={() => setFacet(item.id)}
            className={`border py-1.5 ${
              facet === item.id
                ? 'border-red-800 bg-red-950/40 text-red-100'
                : 'border-stone-800 text-stone-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <p className="mb-3 text-[10px] leading-relaxed text-stone-500">
        军团战备汇总驻军与资源；编成出征与军团军令均以本抽屉为唯一写入口。
      </p>

      {facet === 'readiness' ? (
        <MilitaryReadinessPanel overview={overview} />
      ) : facet === 'formation' ? (
        <section className="min-h-0 space-y-3 overflow-y-auto" data-testid="command-military-formation">
          <MilitaryFormationForm />
          <h3 className="text-stone-200">现役战役军队（{overview.armies.length}）</h3>
          {overview.armies.length === 0 ? (
            <p className="border border-stone-800 bg-stone-900/50 px-3 py-3 text-stone-500">
              尚无 Campaign Army。
            </p>
          ) : overview.armies.map((army) => <ArmyCard key={army.armyId} army={army} />)}
        </section>
      ) : facet === 'orders' ? (
        <MilitaryOrdersPanel />
      ) : (
        <section className="min-h-0 space-y-2 overflow-y-auto" data-testid="command-military-reports">
          {lastBattleResult ? (
            <article className="border border-red-900/60 bg-red-950/20 px-3 py-2">
              <strong className="text-red-100">{lastBattleResult.battlefield}</strong>
              <p className="mt-1 text-[10px] text-stone-400">
                {lastBattleResult.winner === 'attacker' ? '攻方胜' : '守方胜'}
                {' · '}攻损 {lastBattleResult.attackerCasualties}
                {' · '}守损 {lastBattleResult.defenderCasualties}
              </p>
            </article>
          ) : (
            <p className="border border-stone-800 bg-stone-900/50 px-3 py-2 text-stone-500">
              本次客户端会话尚无自动战斗结果。
            </p>
          )}
          {militaryLogs.map((entry, index) => (
            <div key={`${entry.year}-${entry.month}-${index}`} className="border-b border-stone-900 py-1 text-[10px]">
              <span className="mr-2 text-stone-600">{entry.year}年{entry.month}月</span>
              <span className="text-stone-400">{entry.message}</span>
            </div>
          ))}
          {militaryLogs.length === 0 ? <p className="text-stone-600">暂无军事行动日志。</p> : null}
        </section>
      )}
    </div>
  );
}

function ArmyCard({ army }: { army: MilitaryArmySummary }) {
  return (
    <article
      data-testid={`command-military-army-${army.armyId}`}
      className="border border-stone-800 bg-stone-900/60 px-3 py-2"
    >
      <div className="flex items-center justify-between">
        <strong className="text-stone-100">{army.name}</strong>
        <span className="text-[10px] text-red-200">{army.phaseLabel}</span>
      </div>
      <p className="mt-1 text-[10px] text-stone-500">
        主将 {army.commanderName} · {army.currentNodeName}
        {army.targetNodeName ? ` → ${army.targetNodeName}` : ''}
      </p>
      <p className="text-[10px] text-stone-400">
        兵 {army.troops} · 粮 {army.food} · 士气 {army.morale} · 组织 {army.organization} · 疲劳 {army.fatigue}
      </p>
    </article>
  );
}
