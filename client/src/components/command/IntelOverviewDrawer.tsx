// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import {
  SpyMissionType,
  SpyStatus,
  isAllied,
  playerCitiesAdjacentTo,
  type GameState,
  type SpyMissionLog,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';
import type { CommandShellState } from './commandShellState';

const MAX_ROSTER = 8;

const STATUS_LABEL: Record<SpyStatus, string> = {
  [SpyStatus.IDLE]: '空闲',
  [SpyStatus.DEPLOYED]: '出动',
  [SpyStatus.CAPTIVE]: '被捕',
  [SpyStatus.DEAD]: '阵亡',
  [SpyStatus.RECOVERING]: '休整',
  [SpyStatus.COUNTER_DUTY]: '反间驻守',
};

const MISSION_LABEL: Record<string, string> = {
  recon: '探秘',
  sabotage: '破坏',
  assassinate: '刺杀',
  incite: '煽动',
  steal: '窃取',
  rescue: '营救',
  pillowTalk: '枕边风',
  sowDiscord: '离间',
  station: '驻守反间',
  unstation: '撤回反间',
  recruit: '招募',
  captive: '俘虏处置',
};

const MISSION_GOLD: Partial<Record<SpyMissionType, number>> = {
  [SpyMissionType.RECON]: 40,
  [SpyMissionType.SABOTAGE]: 80,
  [SpyMissionType.ASSASSINATE]: 120,
  [SpyMissionType.PILLOW_TALK]: 60,
  [SpyMissionType.SOW_DISCORD]: 80,
};

export type IntelOverview = {
  rosterCount: number;
  rosterCap: number;
  statusCounts: Record<SpyStatus, number>;
  agents: Array<{
    id: string;
    name: string;
    rank: number;
    kind: 'male' | 'female';
    status: SpyStatus;
    cooldownMonths: number;
    location: string;
  }>;
  reports: Array<{ cityId: number; city: string; depth: string; source: string; expires: string }>;
  missions: Array<SpyMissionLog & { target: string }>;
  defenses: Array<{ cityId: number; city: string; level: number; station: string; until: string }>;
  captives: Array<{ id: string; name: string; faction: string }>;
  plantable: Array<{ factionId: number; faction: string; count: number }>;
};

export function buildIntelOverview(game: GameState): IntelOverview {
  const ownCityCount = Object.values(game.cities)
    .filter((city) => city.ruler === game.playerFactionId).length;
  const visibleAgents = Object.values(game.intel?.agents ?? {});
  const ownAgents = visibleAgents
    .filter((agent) =>
      agent.factionId === game.playerFactionId && agent.status !== SpyStatus.DEAD)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const statusCounts = Object.values(SpyStatus).reduce(
    (counts, status) => ({ ...counts, [status]: 0 }),
    {} as Record<SpyStatus, number>,
  );
  ownAgents.forEach((agent) => {
    statusCounts[agent.status] += 1;
  });

  return {
    rosterCount: ownAgents.length,
    rosterCap: Math.min(MAX_ROSTER, 1 + Math.floor(ownCityCount / 3)),
    statusCounts,
    agents: ownAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      rank: agent.rank,
      kind: agent.agentKind ?? 'male',
      status: agent.status,
      cooldownMonths: agent.cooldownMonths,
      location: agent.locationCityId == null
        ? '未在城中'
        : game.cities[agent.locationCityId]?.name ?? '未知城池',
    })),
    reports: Object.entries(game.intel?.cities ?? {})
      .map(([cityId, report]) => ({
        cityId: Number(cityId),
        city: game.cities[Number(cityId)]?.name ?? '未知城池',
        depth: report.depth,
        source: report.source,
        expires: `${report.expireYear}年${report.expireMonth}月`,
      }))
      .sort((a, b) => a.cityId - b.cityId),
    missions: (game.intel?.recentMissions ?? [])
      .filter((mission) => mission.factionId === game.playerFactionId)
      .map((mission) => ({
        ...mission,
        target: mission.targetCityId == null
          ? '—'
          : game.cities[mission.targetCityId]?.name ?? '未知城池',
      })),
    defenses: Object.entries(game.intel?.cityDefense ?? {})
      .filter(([cityId]) => game.cities[Number(cityId)]?.ruler === game.playerFactionId)
      .map(([cityId, defense]) => ({
        cityId: Number(cityId),
        city: game.cities[Number(cityId)]?.name ?? '未知城池',
        level: defense.level,
        station: defense.stationAgentId
          ? game.intel?.agents?.[defense.stationAgentId]?.name ?? '未知密探'
          : '无驻守密探',
        until: `${defense.untilYear}年${defense.untilMonth}月`,
      }))
      .sort((a, b) => a.cityId - b.cityId),
    captives: visibleAgents
      .filter((agent) =>
        agent.factionId !== game.playerFactionId
        && agent.status === SpyStatus.CAPTIVE
        && agent.captiveByFactionId === game.playerFactionId)
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        faction: game.factions[agent.factionId]?.name ?? '未知势力',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh')),
    plantable: Object.entries(game.intel?.plantableBeauty ?? {})
      .filter(([, count]) => count > 0)
      .map(([factionId, count]) => ({
        factionId: Number(factionId),
        faction: game.factions[Number(factionId)]?.name ?? '未知势力',
        count,
      }))
      .sort((a, b) => a.factionId - b.factionId),
  };
}

export type IntelPersonnelOrder =
  | { type: 'recruit'; cityId: number }
  | { type: 'train-female'; cityId: number }
  | { type: 'plant-female'; targetFactionId: number };

export type IntelOperationOrder =
  | { type: 'mission'; agentId: string; missionType: SpyMissionType; targetCityId: number }
  | { type: 'station'; agentId: string; cityId: number }
  | { type: 'unstation'; cityId: number }
  | { type: 'captive'; agentId: string; action: 'execute' | 'release' };

function aliveRosterCount(game: GameState): number {
  return Object.values(game.intel?.agents ?? {}).filter(
    (agent) => agent.factionId === game.playerFactionId && agent.status !== SpyStatus.DEAD,
  ).length;
}

function rosterCap(game: GameState): number {
  const ownCities = Object.values(game.cities)
    .filter((city) => city.ruler === game.playerFactionId).length;
  return Math.min(MAX_ROSTER, 1 + Math.floor(ownCities / 3));
}

function recruitBatch(game: GameState, cityId: number): number {
  const city = game.cities[cityId];
  if (!city) return 0;
  const laborPool = Math.max(0, city.demographics.adultMale) + Math.max(0, city.troops);
  const rawBatch = laborPool < 8000
    ? 1
    : Math.max(1, Math.min(3, Math.floor(laborPool / 8000) || 1));
  return Math.min(rawBatch, Math.max(0, rosterCap(game) - aliveRosterCount(game)));
}

export function validateIntelPersonnelOrder(
  game: GameState,
  order: IntelPersonnelOrder,
): string | null {
  const free = rosterCap(game) - aliveRosterCount(game);
  if (free <= 0) return `密探编制已满（上限 ${rosterCap(game)}）。`;

  if (order.type === 'plant-female') {
    const target = game.factions[order.targetFactionId];
    if (!target?.isAlive || target.id === game.playerFactionId) return '目标势力已不存在或已经灭亡。';
    if ((game.intel?.plantableBeauty?.[target.id] ?? 0) < 1) return '掩护额度已经失效（需先外交牵线）。';
    // 敌方 courtNetwork 受迷雾裁剪，库存充足性只能由服务端权威复验。
    return Object.values(game.cities).some(
      (city) => city.ruler === game.playerFactionId && city.gold >= 80,
    ) ? null : '没有己方城池能够支付金 80。';
  }

  const city = game.cities[order.cityId];
  if (!city || city.ruler !== game.playerFactionId) return '执行城池已失效，请返回修改。';
  if (order.type === 'train-female') {
    if ((game.factions[game.playerFactionId]?.courtNetwork ?? 0) < 2) return '宫廷人脉不足（需 2）。';
    return city.gold >= 100 ? null : `城中金钱不足（需 100，当前 ${city.gold}）。`;
  }
  const batch = recruitBatch(game, city.id);
  if (batch <= 0) return `密探编制已满（上限 ${rosterCap(game)}）。`;
  const goldCost = batch * 120;
  const foodCost = batch * 60;
  if (city.gold < goldCost) return `城中金钱不足（需 ${goldCost}，当前 ${city.gold}）。`;
  return city.food >= foodCost ? null : `城中粮食不足（需 ${foodCost}，当前 ${city.food}）。`;
}

export function validateIntelOperationOrder(
  game: GameState,
  order: IntelOperationOrder,
): string | null {
  if (order.type === 'captive') {
    const captive = game.intel?.agents?.[order.agentId];
    return captive?.status === SpyStatus.CAPTIVE
      && captive.captiveByFactionId === game.playerFactionId
      ? null
      : '该密探已不在本势力俘虏名单中。';
  }

  if (order.type === 'unstation') {
    const city = game.cities[order.cityId];
    if (!city || city.ruler !== game.playerFactionId) return '反间城池已失效，请返回修改。';
    return game.intel?.cityDefense?.[city.id]?.stationAgentId
      ? null
      : '该城当前没有驻守密探。';
  }

  const agent = game.intel?.agents?.[order.agentId];
  if (!agent || agent.factionId !== game.playerFactionId) return '所选密探已失效。';
  if (agent.status !== SpyStatus.IDLE || agent.cooldownMonths > 0) {
    return `密探当前不可用（状态${STATUS_LABEL[agent.status]}，冷却${agent.cooldownMonths}月）。`;
  }
  if (order.type === 'station') {
    const city = game.cities[order.cityId];
    return city?.ruler === game.playerFactionId ? null : '反间城池已失效，请返回修改。';
  }

  const target = game.cities[order.targetCityId];
  if (!target || target.ruler === game.playerFactionId) return '任务目标已失效。';
  const femaleOnly = order.missionType === SpyMissionType.PILLOW_TALK
    || order.missionType === SpyMissionType.SOW_DISCORD;
  if (femaleOnly && agent.agentKind !== 'female') return '该任务仅限女间谍执行。';
  if (
    target.ruler != null
    && order.missionType !== SpyMissionType.RECON
    && isAllied(game.diplomacy, game.playerFactionId, target.ruler)
  ) return '非探秘任务不能对同盟城池执行。';
  const adjacent = playerCitiesAdjacentTo(
    Object.values(game.cities)
      .filter((entry) => entry.ruler === game.playerFactionId)
      .map((entry) => entry.id),
    target.id,
  );
  if (adjacent.length === 0) return '目标与己方城无官道邻接，无法潜入。';
  const cost = MISSION_GOLD[order.missionType];
  if (cost == null) return '当前 Demo 不支持该类谍报任务。';
  return adjacent.some((id) => game.cities[id]?.gold >= cost)
    ? null
    : `邻接城金钱不足（需 ${cost}）。`;
}

type IntelFacet = 'situation' | 'personnel' | 'tasks' | 'counter';

const FACETS: readonly { id: IntelFacet; label: string }[] = [
  { id: 'situation', label: '态势' },
  { id: 'personnel', label: '人员' },
  { id: 'tasks', label: '任务' },
  { id: 'counter', label: '反间' },
];

export function IntelOverviewDrawer({ shellState }: { shellState: CommandShellState }) {
  const game = useGameStore((state) => state.game);
  const selectedCityId = useGameStore((state) => state.selectedCityId);
  const selectCity = useGameStore((state) => state.selectCity);
  const recruitSpies = useGameStore((state) => state.recruitSpies);
  const trainFemaleSpy = useGameStore((state) => state.trainFemaleSpy);
  const plantFemale = useGameStore((state) => state.plantFemale);
  const spyMission = useGameStore((state) => state.spyMission);
  const stationCounter = useGameStore((state) => state.stationCounter);
  const unstationCounter = useGameStore((state) => state.unstationCounter);
  const resolveCaptive = useGameStore((state) => state.resolveCaptive);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const initialFacet: IntelFacet = shellState.activeCommand === 'recon' ? 'tasks' : 'situation';
  const [facet, setFacet] = useState<IntelFacet>(initialFacet);
  const [order, setOrder] = useState<IntelPersonnelOrder | null>(null);
  const [operation, setOperation] = useState<IntelOperationOrder | null>(null);
  const [plantTargetId, setPlantTargetId] = useState<number | ''>('');
  const [agentId, setAgentId] = useState('');
  const [missionType, setMissionType] = useState<SpyMissionType>(SpyMissionType.RECON);
  const [targetCityId, setTargetCityId] = useState<number | ''>('');
  const [counterCityId, setCounterCityId] = useState<number | ''>('');
  const overview = useMemo(() => game ? buildIntelOverview(game) : null, [game]);

  if (!game || !overview) return <p data-testid="command-intel-empty">尚未载入剧本。</p>;
  const ownCities = Object.values(game.cities)
    .filter((city) => city.ruler === game.playerFactionId)
    .sort((a, b) => a.id - b.id);
  const effectiveCityId = ownCities.some((city) => city.id === selectedCityId)
    ? selectedCityId
    : ownCities[0]?.id ?? null;
  const personnelCity = effectiveCityId == null ? null : game.cities[effectiveCityId];
  const plantTargets = overview.plantable
    .filter((target) => game.factions[target.factionId]?.isAlive);
  const recruitCount = personnelCity ? recruitBatch(game, personnelCity.id) : 0;
  const idleAgents = overview.agents.filter(
    (agent) => agent.status === SpyStatus.IDLE && agent.cooldownMonths <= 0,
  );
  const selectedAgent = overview.agents.find((agent) => agent.id === agentId);
  const enemyCities = Object.values(game.cities)
    .filter((city) => city.ruler !== game.playerFactionId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const effectiveCounterCityId = ownCities.some((city) => city.id === counterCityId)
    ? counterCityId
    : ownCities[0]?.id ?? '';
  const missionDraft = agentId && targetCityId !== ''
    ? { type: 'mission' as const, agentId, missionType, targetCityId: Number(targetCityId) }
    : null;
  const missionReason = missionDraft
    ? validateIntelOperationOrder(game, missionDraft)
    : idleAgents.length === 0 ? '暂无可派遣密探。' : !agentId ? '请选择空闲密探。' : '请选择目标城。';

  return (
    <div
      className="flex h-[min(34rem,calc(100vh-12rem))] min-h-0 flex-1 flex-col"
      data-testid="command-intel-drawer"
    >
      <nav className="mb-3 grid grid-cols-4 gap-1" aria-label="情报分面">
        {FACETS.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`command-intel-facet-${item.id}`}
            aria-current={facet === item.id ? 'page' : undefined}
            onClick={() => setFacet(item.id)}
            className={`border py-1.5 ${
              facet === item.id
                ? 'border-violet-700 bg-violet-950/40 text-violet-100'
                : 'border-stone-800 text-stone-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <p className="mb-3 text-[10px] leading-relaxed text-stone-500">
        S07 人员建设、任务派遣、反间与俘虏处置均由此统一终审提交。
      </p>

      <section className="min-h-0 space-y-2 overflow-y-auto" data-testid={`command-intel-panel-${facet}`}>
        {facet === 'situation' ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="密探名册" value={`${overview.rosterCount}/${overview.rosterCap}`} />
              <Metric label="可派遣" value={overview.statusCounts[SpyStatus.IDLE]} />
              <Metric label="情报城池" value={overview.reports.length} />
            </div>
            <InfoList
              title="已获城池情报"
              items={overview.reports.map((report) =>
                `${report.city} · ${report.depth} · ${report.source} · 至${report.expires}`)}
              empty="暂无城池情报；可从任务分面查看探秘落点说明。"
            />
            <InfoList
              title="人脉掩护额度"
              items={overview.plantable.map((target) => `${target.faction} · ${target.count}`)}
              empty="暂无掩护额度；额度由外交牵线产生。"
            />
          </>
        ) : facet === 'personnel' ? (
          <>
            <label className="block text-[10px] text-stone-500">
              人员建设城市
              <select
                data-testid="command-intel-personnel-city"
                value={effectiveCityId ?? ''}
                onChange={(event) => selectCity(Number(event.target.value))}
                className="mt-1 w-full border border-stone-700 bg-stone-900 px-2 py-1.5 text-xs text-stone-200"
              >
                {ownCities.map((city) => (
                  <option key={city.id} value={city.id}>{city.name} · 金{city.gold} · 粮{city.food}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="command-intel-recruit"
                data-command-write="true"
                disabled={loading || !personnelCity || validateIntelPersonnelOrder(game, { type: 'recruit', cityId: personnelCity.id }) != null}
                title={personnelCity ? validateIntelPersonnelOrder(game, { type: 'recruit', cityId: personnelCity.id }) ?? undefined : '当前没有己方城池'}
                onClick={() => personnelCity && setOrder({ type: 'recruit', cityId: personnelCity.id })}
                className="border border-violet-800 bg-violet-950/35 px-2 py-2 text-violet-100 disabled:opacity-40"
              >
                招募密探 · {recruitCount}名
              </button>
              <button
                type="button"
                data-testid="command-intel-train-female"
                data-command-write="true"
                disabled={loading || !personnelCity || validateIntelPersonnelOrder(game, { type: 'train-female', cityId: personnelCity.id }) != null}
                title={personnelCity ? validateIntelPersonnelOrder(game, { type: 'train-female', cityId: personnelCity.id }) ?? undefined : '当前没有己方城池'}
                onClick={() => personnelCity && setOrder({ type: 'train-female', cityId: personnelCity.id })}
                className="border border-pink-800 bg-pink-950/30 px-2 py-2 text-pink-100 disabled:opacity-40"
              >
                训练女间谍
              </button>
            </div>
            <div className="border border-pink-950/80 bg-pink-950/15 px-3 py-2">
              <label className="block text-[10px] text-stone-500">
                人脉掩护目标
                <select
                  data-testid="command-intel-plant-target"
                  value={plantTargetId}
                  onChange={(event) => setPlantTargetId(event.target.value ? Number(event.target.value) : '')}
                  className="mt-1 w-full border border-stone-700 bg-stone-900 px-2 py-1.5 text-xs text-stone-200"
                >
                  <option value="">选择有点化额度的存续势力…</option>
                  {plantTargets.map((target) => (
                    <option key={target.factionId} value={target.factionId}>
                      {target.faction} · 额度{target.count}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                data-testid="command-intel-plant-female"
                data-command-write="true"
                disabled={loading || plantTargetId === '' || validateIntelPersonnelOrder(game, { type: 'plant-female', targetFactionId: Number(plantTargetId) }) != null}
                title={plantTargetId === '' ? '需先从外交向目标牵线' : validateIntelPersonnelOrder(game, { type: 'plant-female', targetFactionId: Number(plantTargetId) }) ?? undefined}
                onClick={() => plantTargetId !== '' && setOrder({ type: 'plant-female', targetFactionId: Number(plantTargetId) })}
                className="mt-2 w-full border border-pink-800 bg-pink-950/30 px-2 py-2 text-pink-100 disabled:opacity-40"
              >
                点化女间谍 · 金80
              </button>
            </div>
            <InfoList
              title="己方密探"
              items={overview.agents.map((agent) =>
                `${agent.kind === 'female' ? '♀ ' : ''}${agent.name} · Lv${agent.rank} · ${STATUS_LABEL[agent.status]} · ${agent.location}${agent.cooldownMonths > 0 ? ` · 休整${agent.cooldownMonths}月` : ''}`)}
              empty="尚无密探。"
            />
          </>
        ) : facet === 'tasks' ? (
          <>
            {shellState.activeCommand === 'recon' ? (
              <p className="border border-violet-900/70 bg-violet-950/20 px-3 py-2 text-[10px] text-violet-200" data-testid="command-intel-recon-intent">
                已从计略抵达“探秘”落点；可在此选择密探与目标城正式派遣。
              </p>
            ) : null}
            <div className="space-y-2 border border-amber-950/80 bg-amber-950/15 px-3 py-2">
              <label className="block text-[10px] text-stone-500">
                空闲密探
                <select data-testid="command-intel-mission-agent" value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                  className="mt-1 w-full border border-stone-700 bg-stone-900 px-2 py-1.5 text-xs text-stone-200">
                  <option value="">选择密探…</option>
                  {idleAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.kind === 'female' ? '♀ ' : ''}{agent.name} · Lv{agent.rank}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-stone-500">
                  任务
                  <select data-testid="command-intel-mission-type" value={missionType}
                    onChange={(event) => setMissionType(event.target.value as SpyMissionType)}
                    className="mt-1 w-full border border-stone-700 bg-stone-900 px-2 py-1.5 text-xs text-stone-200">
                    <option value={SpyMissionType.RECON}>探秘 · 金40</option>
                    <option value={SpyMissionType.SABOTAGE}>破坏 · 金80</option>
                    <option value={SpyMissionType.ASSASSINATE}>刺杀 · 金120</option>
                    {selectedAgent?.kind === 'female' ? (
                      <>
                        <option value={SpyMissionType.PILLOW_TALK}>枕边风 · 金60</option>
                        <option value={SpyMissionType.SOW_DISCORD}>离间 · 金80</option>
                      </>
                    ) : null}
                  </select>
                </label>
                <label className="text-[10px] text-stone-500">
                  目标城
                  <select data-testid="command-intel-mission-target" value={targetCityId}
                    onChange={(event) => setTargetCityId(event.target.value ? Number(event.target.value) : '')}
                    className="mt-1 w-full border border-stone-700 bg-stone-900 px-2 py-1.5 text-xs text-stone-200">
                    <option value="">选择目标…</option>
                    {enemyCities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" data-testid="command-intel-mission" data-command-write="true"
                disabled={loading || missionReason != null}
                title={missionReason ?? undefined}
                onClick={() => missionDraft && setOperation(missionDraft)}
                className="w-full border border-amber-800 bg-amber-950/35 px-2 py-2 text-amber-100 disabled:opacity-40">
                派出执行{MISSION_LABEL[missionType]} · 金{MISSION_GOLD[missionType] ?? '—'}
              </button>
              {missionReason ? <p className="text-[10px] text-stone-500">{missionReason}</p> : null}
            </div>
            <InfoList
              title="最近任务"
              items={overview.missions.map((mission) =>
                `${mission.year}年${mission.month}月 · ${mission.agentName} · ${MISSION_LABEL[mission.type] ?? mission.type} · ${mission.target} · ${mission.message}`)}
              empty="暂无己方任务记录。"
            />
          </>
        ) : (
          <>
            <div className="space-y-2 border border-sky-950/80 bg-sky-950/15 px-3 py-2">
              <label className="block text-[10px] text-stone-500">
                己方城池
                <select data-testid="command-intel-counter-city" value={effectiveCounterCityId}
                  onChange={(event) => setCounterCityId(Number(event.target.value))}
                  className="mt-1 w-full border border-stone-700 bg-stone-900 px-2 py-1.5 text-xs text-stone-200">
                  {ownCities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                </select>
              </label>
              <label className="block text-[10px] text-stone-500">
                空闲密探
                <select data-testid="command-intel-counter-agent" value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                  className="mt-1 w-full border border-stone-700 bg-stone-900 px-2 py-1.5 text-xs text-stone-200">
                  <option value="">选择密探…</option>
                  {idleAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · Lv{agent.rank}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" data-testid="command-intel-station" data-command-write="true"
                  disabled={loading || !agentId || effectiveCounterCityId === ''}
                  onClick={() => agentId && effectiveCounterCityId !== '' && setOperation({
                    type: 'station', agentId, cityId: Number(effectiveCounterCityId),
                  })}
                  className="border border-sky-800 px-2 py-2 text-sky-100 disabled:opacity-40">
                  驻守反间
                </button>
                <button type="button" data-testid="command-intel-unstation" data-command-write="true"
                  disabled={loading || effectiveCounterCityId === '' || validateIntelOperationOrder(game, {
                    type: 'unstation', cityId: Number(effectiveCounterCityId),
                  }) != null}
                  onClick={() => effectiveCounterCityId !== '' && setOperation({
                    type: 'unstation', cityId: Number(effectiveCounterCityId),
                  })}
                  className="border border-stone-700 px-2 py-2 text-stone-300 disabled:opacity-40">
                  撤回反间
                </button>
              </div>
            </div>
            <InfoList
              title="己方城池反间"
              items={overview.defenses.map((defense) =>
                `${defense.city} · Lv${defense.level} · ${defense.station} · 至${defense.until}`)}
              empty="暂无反间布防。"
            />
            <InfoList
              title="己方扣押敌谍"
              items={overview.captives.map((captive) => `${captive.name} · ${captive.faction}`)}
              empty="暂无扣押敌谍。"
            />
            {overview.captives.map((captive) => (
              <div key={captive.id} className="flex items-center justify-between border border-red-950/70 px-3 py-2">
                <span className="text-xs text-stone-300">{captive.name} · {captive.faction}</span>
                <span className="flex gap-1">
                  <button type="button" data-testid="command-intel-captive-execute" data-command-write="true"
                    onClick={() => setOperation({ type: 'captive', agentId: captive.id, action: 'execute' })}
                    className="border border-red-900 px-2 py-1 text-[10px] text-red-200">处决</button>
                  <button type="button" data-testid="command-intel-captive-release" data-command-write="true"
                    onClick={() => setOperation({ type: 'captive', agentId: captive.id, action: 'release' })}
                    className="border border-stone-700 px-2 py-1 text-[10px] text-stone-300">释放</button>
                </span>
              </div>
            ))}
          </>
        )}
      </section>
      <CommandConfirmDialog
        open={order != null}
        category="谍报"
        command={
          order?.type === 'recruit'
            ? `确认招募密探：${game.cities[order.cityId]?.name ?? '未知城池'}`
            : order?.type === 'train-female'
              ? `确认训练女间谍：${game.cities[order.cityId]?.name ?? '未知城池'}`
              : `确认点化女间谍：${order ? game.factions[order.targetFactionId]?.name ?? '未知势力' : '未知势力'}`
        }
        summary="人员建设会立即扣除对应资源并生成新的谍报人员。"
        items={order ? [
          {
            label: order.type === 'plant-female' ? '目标势力' : '执行地',
            value: order.type === 'plant-female'
              ? game.factions[order.targetFactionId]?.name ?? '—'
              : game.cities[order.cityId]?.name ?? '—',
          },
          {
            label: '立即消耗',
            value: order.type === 'recruit'
              ? `金 ${recruitBatch(game, order.cityId) * 120}、粮 ${recruitBatch(game, order.cityId) * 60}`
              : order.type === 'train-female'
                ? '宫廷人脉 2、金 100'
                : '金 80、点化额度 1、目标宫廷人脉 1',
            tone: 'warning',
          },
          { label: '编制', value: `${overview.rosterCount}/${overview.rosterCap}` },
        ] : []}
        loading={loading}
        error={error}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          return !latest || !order
            ? '人员建设草稿已失效，请返回修改。'
            : validateIntelPersonnelOrder(latest, order);
        }}
        onCancel={() => setOrder(null)}
        onConfirm={async () => {
          if (!order) return;
          if (order.type === 'recruit') await recruitSpies(order.cityId);
          if (order.type === 'train-female') await trainFemaleSpy(order.cityId);
          if (order.type === 'plant-female') await plantFemale(order.targetFactionId);
          if (!useGameStore.getState().error) {
            setOrder(null);
            if (order.type === 'plant-female') setPlantTargetId('');
          }
        }}
      />
      <CommandConfirmDialog
        open={operation != null}
        category="谍报"
        command={operation?.type === 'mission'
          ? `确认派出${MISSION_LABEL[operation.missionType]}：${game.intel.agents[operation.agentId]?.name ?? '未知密探'}→${game.cities[operation.targetCityId]?.name ?? '未知城池'}`
          : operation?.type === 'station'
            ? `确认驻守反间：${game.intel.agents[operation.agentId]?.name ?? '未知密探'}→${game.cities[operation.cityId]?.name ?? '未知城池'}`
            : operation?.type === 'unstation'
              ? `确认撤回反间：${game.cities[operation.cityId]?.name ?? '未知城池'}`
              : `${operation?.action === 'execute' ? '确认处决俘虏' : '确认释放俘虏'}：${operation ? game.intel.agents[operation.agentId]?.name ?? '未知俘虏' : '未知俘虏'}`}
        summary={operation?.type === 'mission'
          ? '任务立即结算，密探可能暴露、被捕或阵亡。'
          : operation?.type === 'captive'
            ? operation.action === 'execute' ? '处决永久生效，并使双方友好下降。' : '释放后密探返回原势力，并使双方友好上升。'
            : '反间驻防调整会立即生效；驻守同城会替换原驻守者。'}
        items={operation ? [
          { label: '命令', value: operation.type === 'mission' ? MISSION_LABEL[operation.missionType] : operation.type === 'station' ? '驻守反间' : operation.type === 'unstation' ? '撤回反间' : operation.action === 'execute' ? '永久处决' : '释放并交还' },
          { label: '影响', value: operation.type === 'mission' ? `耗金 ${MISSION_GOLD[operation.missionType] ?? '—'}，承担任务风险` : operation.type === 'captive' ? operation.action === 'execute' ? '友好 −10，不可撤销' : '友好 +5，目标休整2月' : '立即改变城池反间驻守', tone: 'warning' },
        ] : []}
        loading={loading}
        danger={operation?.type === 'mission' || (operation?.type === 'captive' && operation.action === 'execute')}
        error={error}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          return !latest || !operation
            ? '谍报命令草稿已失效，请返回修改。'
            : validateIntelOperationOrder(latest, operation);
        }}
        onCancel={() => setOperation(null)}
        onConfirm={async () => {
          if (!operation) return;
          if (operation.type === 'mission') await spyMission(operation.agentId, operation.missionType, operation.targetCityId);
          if (operation.type === 'station') await stationCounter(operation.agentId, operation.cityId);
          if (operation.type === 'unstation') await unstationCounter(operation.cityId);
          if (operation.type === 'captive') await resolveCaptive(operation.agentId, operation.action);
          if (!useGameStore.getState().error) {
            setOperation(null);
            if (operation.type === 'mission' || operation.type === 'station') setAgentId('');
          }
        }}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-stone-800 bg-stone-900/55 px-2 py-2 text-center">
      <div className="text-[9px] text-stone-500">{label}</div>
      <strong className="mt-1 block text-sm text-violet-100">{value}</strong>
    </div>
  );
}

function InfoList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="border border-stone-800 bg-stone-900/45 px-3 py-2">
      <h3 className="text-xs text-violet-200">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-1 space-y-1 text-[10px] leading-relaxed text-stone-300">
          {items.map((item, index) => <li key={`${item}-${index}`}>· {item}</li>)}
        </ul>
      ) : <p className="mt-1 text-[10px] text-stone-600">{empty}</p>}
    </div>
  );
}
