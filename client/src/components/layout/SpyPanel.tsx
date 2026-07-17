// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useMemo, useState } from 'react';
import { SpyMissionType, SpyStatus } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

const STATUS_LABEL: Record<string, string> = {
  idle: '空闲',
  deployed: '出动',
  captive: '被捕',
  dead: '阵亡',
  recovering: '休整',
  counter_duty: '反间驻守',
};

const MISSION_LABEL: Record<string, string> = {
  recon: '探秘',
  sabotage: '破坏',
  assassinate: '刺杀',
  pillowTalk: '枕边风',
  sowDiscord: '离间',
};

/**
 * 谍报：招募 / 派遣 / 驻守反间 / 俘虏处置
 */
export function SpyPanel() {
  const game = useGameStore((s) => s.game);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const recruitSpies = useGameStore((s) => s.recruitSpies);
  const trainFemaleSpy = useGameStore((s) => s.trainFemaleSpy);
  const spyMission = useGameStore((s) => s.spyMission);
  const stationCounter = useGameStore((s) => s.stationCounter);
  const unstationCounter = useGameStore((s) => s.unstationCounter);
  const resolveCaptive = useGameStore((s) => s.resolveCaptive);
  const loading = useGameStore((s) => s.loading);

  const [agentId, setAgentId] = useState<string>('');
  const [missionType, setMissionType] = useState<string>(SpyMissionType.RECON);
  const [targetCityId, setTargetCityId] = useState<number | ''>('');

  const myAgents = useMemo(() => {
    if (!game?.intel?.agents) return [];
    return Object.values(game.intel.agents)
      .filter((a) => a.factionId === game.playerFactionId)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [game]);

  const captives = useMemo(
    () =>
      myAgents.length && game
        ? Object.values(game.intel.agents).filter(
            (a) =>
              a.status === SpyStatus.CAPTIVE &&
              a.captiveByFactionId === game.playerFactionId,
          )
        : [],
    [game, myAgents.length],
  );

  const enemyCities = useMemo(() => {
    if (!game) return [];
    return Object.values(game.cities)
      .filter((c) => c.ruler !== game.playerFactionId)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [game]);

  if (!game) return null;

  const recruitCityId =
    selectedCityId != null &&
    game.cities[selectedCityId]?.ruler === game.playerFactionId
      ? selectedCityId
      : game.factions[game.playerFactionId]?.capitalCityId;

  const beautyStock = game.factions[game.playerFactionId]?.beautyStock ?? 0;
  const recruitCityGold = recruitCityId != null ? game.cities[recruitCityId]?.gold ?? 0 : 0;
  const canTrainFemale = beautyStock >= 2 && recruitCityGold >= 100;

  const idleAgents = myAgents.filter(
    (a) => a.status === SpyStatus.IDLE && a.cooldownMonths <= 0,
  );

  const selectedAgent = agentId ? game.intel?.agents?.[agentId] : undefined;

  // Reset missionType to RECON when switching agents or if current type is invalid for the selected agent
  useEffect(() => {
    const femaleOnly = [SpyMissionType.PILLOW_TALK, SpyMissionType.SOW_DISCORD];
    if (femaleOnly.includes(missionType as SpyMissionType) && selectedAgent?.agentKind !== 'female') {
      setMissionType(SpyMissionType.RECON);
    }
  }, [agentId, selectedAgent?.agentKind, missionType]);

  return (
    <div className="px-2 space-y-2 text-[11px]" data-testid="spy-panel">
      <p className="text-stone-500 px-1 leading-snug">
        招募人数/等级由城内<strong className="text-stone-400">成年男+驻军</strong>
        决定。进攻须官道邻接。
      </p>

      <button
        type="button"
        data-testid="btn-spy-recruit"
        disabled={loading || recruitCityId == null}
        className="w-full px-2 py-1.5 rounded border border-violet-800 bg-violet-950/50 text-violet-100 disabled:opacity-40"
        onClick={() => recruitCityId != null && void recruitSpies(recruitCityId)}
      >
        在
        {recruitCityId != null ? game.cities[recruitCityId]?.name : '—'}
        招募密探
      </button>

      <button
        type="button"
        data-testid="btn-spy-train-female"
        disabled={loading || recruitCityId == null || !canTrainFemale}
        className="w-full px-2 py-1.5 rounded border border-pink-800 bg-pink-950/40 text-pink-100 disabled:opacity-40"
        title={`需美女≥2 + 金≥100（当前美女 ${beautyStock}）`}
        onClick={() => recruitCityId != null && void trainFemaleSpy(recruitCityId)}
      >
        训练女间谍（美女2+金100）
      </button>

      <div className="max-h-32 overflow-y-auto space-y-0.5">
        {myAgents.length === 0 && (
          <p className="text-stone-600 px-1">尚无密探，请先招募。</p>
        )}
        {myAgents.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`w-full text-left px-2 py-1 rounded border ${
              agentId === a.id
                ? 'border-violet-500 bg-violet-950/40 text-violet-100'
                : 'border-stone-800 text-stone-300'
            }`}
            onClick={() => setAgentId(a.id)}
          >
            <span className="font-medium">
              {a.agentKind === 'female' && <span className="text-pink-400">♀</span>}{' '}
              {a.name}
            </span>
            <span className="text-stone-500 ml-1">
              Lv{a.rank} · {STATUS_LABEL[a.status] ?? a.status}
              {a.cooldownMonths > 0 ? ` ·冷${a.cooldownMonths}` : ''}
            </span>
          </button>
        ))}
      </div>

      <div className="border-t border-stone-800 pt-1.5 space-y-1">
        <div className="text-violet-400/80 px-0.5">派遣任务</div>
        <select
          className="w-full rounded border border-stone-700 bg-stone-900 px-1 py-1 text-stone-200"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
        >
          <option value="">选择特工…</option>
          {idleAgents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.agentKind === 'female' ? '♀ ' : ''}{a.name} Lv{a.rank}
            </option>
          ))}
        </select>
        <select
          className="w-full rounded border border-stone-700 bg-stone-900 px-1 py-1 text-stone-200"
          value={missionType}
          onChange={(e) => setMissionType(e.target.value)}
        >
          <option value={SpyMissionType.RECON}>探秘</option>
          <option value={SpyMissionType.SABOTAGE}>破坏</option>
          <option value={SpyMissionType.ASSASSINATE}>刺杀</option>
          {selectedAgent?.agentKind === 'female' && (
            <>
              <option value={SpyMissionType.PILLOW_TALK}>枕边风（女间谍）</option>
              <option value={SpyMissionType.SOW_DISCORD}>离间（女间谍）</option>
            </>
          )}
        </select>
        <select
          className="w-full rounded border border-stone-700 bg-stone-900 px-1 py-1 text-stone-200"
          value={targetCityId}
          onChange={(e) =>
            setTargetCityId(e.target.value ? Number(e.target.value) : '')
          }
        >
          <option value="">目标城…</option>
          {enemyCities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-testid="btn-spy-mission"
          disabled={loading || !agentId || targetCityId === ''}
          className="w-full px-2 py-1.5 rounded border border-amber-800 bg-amber-950/40 text-amber-100 disabled:opacity-40"
          onClick={() => {
            if (agentId && targetCityId !== '') {
              void spyMission(agentId, missionType, Number(targetCityId));
            }
          }}
        >
          派出（{MISSION_LABEL[missionType] ?? missionType}）
        </button>
      </div>

      <div className="border-t border-stone-800 pt-1.5 space-y-1">
        <div className="text-sky-400/80 px-0.5">反间驻守</div>
        <button
          type="button"
          disabled={loading || !agentId || recruitCityId == null}
          className="w-full px-2 py-1 rounded border border-sky-900 text-sky-100 disabled:opacity-40"
          onClick={() => {
            if (agentId && recruitCityId != null) {
              void stationCounter(agentId, recruitCityId);
            }
          }}
        >
          驻守当前己方城反间
        </button>
        <button
          type="button"
          disabled={loading || recruitCityId == null}
          className="w-full px-2 py-1 rounded border border-stone-700 text-stone-300 disabled:opacity-40"
          onClick={() => recruitCityId != null && void unstationCounter(recruitCityId)}
        >
          撤回当前城反间
        </button>
      </div>

      {captives.length > 0 && (
        <div className="border-t border-stone-800 pt-1.5 space-y-1">
          <div className="text-red-400/80 px-0.5">俘虏处置</div>
          {captives.map((c) => (
            <div key={c.id} className="flex flex-wrap gap-1 items-center">
              <span className="text-stone-300">{c.name}</span>
              <button
                type="button"
                className="px-1.5 py-0.5 rounded border border-red-900 text-red-200 text-[10px]"
                onClick={() => void resolveCaptive(c.id, 'execute')}
              >
                处决
              </button>
              <button
                type="button"
                className="px-1.5 py-0.5 rounded border border-stone-600 text-stone-300 text-[10px]"
                onClick={() => void resolveCaptive(c.id, 'release')}
              >
                释放
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
