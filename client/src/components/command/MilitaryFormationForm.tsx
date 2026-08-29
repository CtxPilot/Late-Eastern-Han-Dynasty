// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FORMATION_LABEL, FormationType, UnitType, type GameState } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { campaignTargetsFromCity } from '../campaign/CampaignPanel.helpers';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';

const UNIT_LABEL: Record<string, string> = {
  lightInfantry: '轻步',
  heavyInfantry: '重步',
  spearman: '长枪',
  archer: '弓',
  crossbowman: '弩',
  lightCavalry: '轻骑',
  heavyCavalry: '重骑',
  horseArcher: '骑射',
  lightNavy: '走舸',
  mediumNavy: '蒙冲',
  heavyNavy: '楼船',
};

const FORMATIONS = [
  FormationType.WEDGE,
  FormationType.SQUARE,
  FormationType.CRANE_WING,
  FormationType.FISH_SCALE,
  FormationType.ARROWHEAD,
  FormationType.CHARGE,
] as const;

export type MilitaryFormationDraft = {
  fromNodeId: number | '';
  commanderId: number | '';
  subCommanderIds: number[];
  advisorId: number | '';
  targetNodeId: number | '';
  unitType: string;
  formation: number;
  troopCount: number;
  food: number;
};

export function validateMilitaryFormationDraft(
  game: GameState,
  draft: MilitaryFormationDraft,
): string | null {
  if (draft.fromNodeId === '' || draft.commanderId === '' || draft.targetNodeId === '') {
    return '出征编成不完整。';
  }
  const city = game.cities[draft.fromNodeId];
  const commander = game.officers[draft.commanderId];
  const target = game.cities[draft.targetNodeId];
  if (!city || city.ruler !== game.playerFactionId) return '出发城归属已经变化。';
  if (
    !commander
    || commander.faction !== game.playerFactionId
    || commander.location !== draft.fromNodeId
    || commander.status !== 'active'
  ) {
    return '主将已不在出发城或不再可用。';
  }
  const roleIds = [...draft.subCommanderIds, ...(draft.advisorId === '' ? [] : [draft.advisorId])];
  if (new Set([draft.commanderId, ...roleIds]).size !== 1 + roleIds.length) {
    return '主将、副将与参谋不可重复。';
  }
  for (const id of draft.subCommanderIds) {
    const officer = game.officers[id];
    if (
      !officer
      || officer.faction !== game.playerFactionId
      || officer.location !== draft.fromNodeId
      || officer.status !== 'active'
    ) return '副将已不在出发城或不再可用。';
  }
  if (draft.advisorId !== '') {
    const advisor = game.officers[draft.advisorId];
    if (
      !advisor
      || advisor.faction !== game.playerFactionId
      || advisor.location !== draft.fromNodeId
      || advisor.status !== 'active'
      || advisor.stats.intelligence < 85
    ) return '参谋已不在出发城或不再符合智力门槛。';
  }
  if (!target || target.ruler === game.playerFactionId) return '目标城已经失效。';
  if (!campaignTargetsFromCity(game, draft.fromNodeId).some((item) => item.id === target.id)) {
    return `${city.name} 与 ${target.name} 无官道直达，请返回修改目标。`;
  }
  if (draft.troopCount <= 0 || draft.food < 0) return '兵力须大于0，携粮不可为负数。';
  if (city.troops < draft.troopCount || city.food < draft.food) {
    return `出发城资源已变化（现有兵${city.troops}、粮${city.food}）。`;
  }
  return null;
}

export function MilitaryFormationForm() {
  const game = useGameStore((state) => state.game);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const campaignStart = useGameStore((state) => state.campaignStart);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draft, setDraft] = useState<MilitaryFormationDraft>({
    fromNodeId: '',
    commanderId: '',
    subCommanderIds: [],
    advisorId: '',
    targetNodeId: '',
    unitType: UnitType.HEAVY_CAVALRY,
    formation: FormationType.WEDGE,
    troopCount: 5000,
    food: 1500,
  });

  const playerCities = useMemo(
    () => game
      ? Object.values(game.cities)
          .filter((city) => city.ruler === game.playerFactionId)
          .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
      : [],
    [game],
  );
  const availableOfficers = useMemo(
    () => game && draft.fromNodeId !== ''
      ? Object.values(game.officers).filter((officer) =>
          officer.faction === game.playerFactionId
          && officer.location === draft.fromNodeId
          && officer.status === 'active')
      : [],
    [draft.fromNodeId, game],
  );
  const availableSubs = availableOfficers.filter((officer) => officer.id !== draft.commanderId);
  const availableAdvisors = availableSubs.filter(
    (officer) => !draft.subCommanderIds.includes(officer.id) && officer.stats.intelligence >= 85,
  );
  const targets = useMemo(
    () => game ? campaignTargetsFromCity(game, draft.fromNodeId === '' ? null : draft.fromNodeId) : [],
    [draft.fromNodeId, game],
  );

  useEffect(() => {
    if (draft.targetNodeId !== '' && !targets.some((city) => city.id === draft.targetNodeId)) {
      setDraft((current) => ({ ...current, targetNodeId: '' }));
    }
  }, [draft.targetNodeId, targets]);

  if (!game) return null;
  const fromCity = draft.fromNodeId === '' ? null : game.cities[draft.fromNodeId];
  const target = draft.targetNodeId === '' ? null : game.cities[draft.targetNodeId];
  const commander = draft.commanderId === '' ? null : game.officers[draft.commanderId];
  const draftError = validateMilitaryFormationDraft(game, draft);

  const selectFromCity = (value: string) => {
    setDraft((current) => ({
      ...current,
      fromNodeId: value ? Number(value) : '',
      commanderId: '',
      subCommanderIds: [],
      advisorId: '',
      targetNodeId: '',
    }));
  };
  const toggleSub = (id: number) => {
    setDraft((current) => ({
      ...current,
      subCommanderIds: current.subCommanderIds.includes(id)
        ? current.subCommanderIds.filter((item) => item !== id)
        : [...current.subCommanderIds, id],
      advisorId: current.advisorId === id ? '' : current.advisorId,
    }));
  };

  return (
    <div className="space-y-2" data-testid="command-military-formation-form">
      <div className="grid grid-cols-2 gap-2">
        <Field label="出发城">
          <select
            data-testid="command-military-from-city"
            value={draft.fromNodeId}
            onChange={(event) => selectFromCity(event.target.value)}
            className="w-full border border-stone-700 bg-stone-900 px-2 py-1"
          >
            <option value="">选择己方城</option>
            {playerCities.map((city) => (
              <option key={city.id} value={city.id}>{city.name}（兵{city.troops}／粮{city.food}）</option>
            ))}
          </select>
        </Field>
        <Field label="目标城">
          <select
            data-testid="command-military-target-city"
            value={draft.targetNodeId}
            disabled={draft.fromNodeId === ''}
            onChange={(event) => setDraft((current) => ({
              ...current,
              targetNodeId: event.target.value ? Number(event.target.value) : '',
            }))}
            className="w-full border border-stone-700 bg-stone-900 px-2 py-1 disabled:opacity-40"
          >
            <option value="">选择官道直邻目标</option>
            {targets.map((city) => <option key={city.id} value={city.id}>{city.name}（兵{city.troops}）</option>)}
          </select>
        </Field>
      </div>
      <Field label="主将">
        <select
          data-testid="command-military-commander"
          value={draft.commanderId}
          disabled={draft.fromNodeId === ''}
          onChange={(event) => {
            const commanderId = event.target.value ? Number(event.target.value) : '';
            setDraft((current) => ({
              ...current,
              commanderId,
              subCommanderIds: current.subCommanderIds.filter((id) => id !== commanderId),
              advisorId: current.advisorId === commanderId ? '' : current.advisorId,
            }));
          }}
          className="w-full border border-stone-700 bg-stone-900 px-2 py-1 disabled:opacity-40"
        >
          <option value="">选择主将</option>
          {availableOfficers.map((officer) => (
            <option key={officer.id} value={officer.id}>
              {officer.name}（统{officer.stats.leadership} 武{officer.stats.war}）
            </option>
          ))}
        </select>
      </Field>
      <Field label="副将（当前切片至多显示4名候选）">
        <div className="flex flex-wrap gap-1">
          {availableSubs.slice(0, 4).map((officer) => (
            <InkButton
              key={officer.id}
              type="button"
              data-testid={`command-military-sub-${officer.id}`}
              aria-pressed={draft.subCommanderIds.includes(officer.id)}
              onClick={() => toggleSub(officer.id)}
              className={`border px-2 py-1 text-xs ${
                draft.subCommanderIds.includes(officer.id)
                  ? 'border-red-700 bg-red-950/50 text-red-100'
                  : 'border-stone-700 bg-stone-900 text-stone-400'
              }`}
            >
              {officer.name}
            </InkButton>
          ))}
          {availableSubs.length === 0 ? <span className="text-stone-600">无可用副将</span> : null}
        </div>
      </Field>
      <Field label="参谋（智≥85）">
        <select
          data-testid="command-military-advisor"
          value={draft.advisorId}
          disabled={draft.fromNodeId === ''}
          onChange={(event) => setDraft((current) => ({
            ...current,
            advisorId: event.target.value ? Number(event.target.value) : '',
          }))}
          className="w-full border border-stone-700 bg-stone-900 px-2 py-1 disabled:opacity-40"
        >
          <option value="">无参谋</option>
          {availableAdvisors.map((officer) => (
            <option key={officer.id} value={officer.id}>{officer.name}（智{officer.stats.intelligence}）</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="兵种">
          <select
            data-testid="command-military-unit"
            value={draft.unitType}
            onChange={(event) => setDraft((current) => ({ ...current, unitType: event.target.value }))}
            className="w-full border border-stone-700 bg-stone-900 px-2 py-1"
          >
            {Object.entries(UNIT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="阵型">
          <select
            data-testid="command-military-formation-type"
            value={draft.formation}
            onChange={(event) => setDraft((current) => ({ ...current, formation: Number(event.target.value) }))}
            className="w-full border border-stone-700 bg-stone-900 px-2 py-1"
          >
            {FORMATIONS.map((id) => <option key={id} value={id}>{FORMATION_LABEL[id]}</option>)}
          </select>
        </Field>
        <Field label="调拨兵力">
          <input
            data-testid="command-military-troops"
            type="number"
            min={1}
            value={draft.troopCount}
            onChange={(event) => setDraft((current) => ({ ...current, troopCount: Number(event.target.value) }))}
            className="w-full border border-stone-700 bg-stone-900 px-2 py-1"
          />
        </Field>
        <Field label="携带粮草">
          <input
            data-testid="command-military-food"
            type="number"
            min={0}
            value={draft.food}
            onChange={(event) => setDraft((current) => ({ ...current, food: Number(event.target.value) }))}
            className="w-full border border-stone-700 bg-stone-900 px-2 py-1"
          />
        </Field>
      </div>
      <InkButton
        type="button"
        data-testid="command-military-start"
        disabled={loading || draftError != null}
        title={draftError ?? '进入出征终审'}
        onClick={() => setConfirmOpen(true)}
        className="w-full border border-red-800 bg-red-950/40 px-3 py-2 text-red-100 disabled:opacity-40"
      >
        编成出征
      </InkButton>
      <p className="text-xs text-stone-600">
        {draftError ?? '确认后兵力、粮草与参战武将将从出发城转入 Campaign Army。'}
      </p>
      <CommandConfirmDialog
        open={confirmOpen}
        category="军事"
        command={`确认编成出征：${fromCity?.name ?? '未选出发城'}→${target?.name ?? '未选目标'}`}
        summary="Campaign Army 是正式玩家出征路径；确认后将生成战役军队并进入行军阶段。"
        items={[
          { label: '出发城', value: fromCity?.name ?? '—' },
          { label: '目标城', value: target?.name ?? '—' },
          { label: '主将', value: commander?.name ?? '—' },
          { label: '调拨兵力', value: String(draft.troopCount), tone: 'warning' },
          { label: '携带粮草', value: String(draft.food), tone: 'warning' },
        ]}
        loading={loading}
        danger
        error={error}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          return latest ? validateMilitaryFormationDraft(latest, draft) : '出征草稿已失效，请返回修改。';
        }}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          if (draft.fromNodeId === '' || draft.commanderId === '' || draft.targetNodeId === '') return;
          const army = await campaignStart({
            commanderId: draft.commanderId,
            subCommanderIds: draft.subCommanderIds,
            advisorId: draft.advisorId === '' ? undefined : draft.advisorId,
            fromNodeId: draft.fromNodeId,
            targetNodeId: draft.targetNodeId,
            unitType: draft.unitType,
            formation: draft.formation,
            troopCount: draft.troopCount,
            food: draft.food,
          });
          if (army) {
            setConfirmOpen(false);
            setDraft((current) => ({
              ...current,
              commanderId: '',
              subCommanderIds: [],
              advisorId: '',
              targetNodeId: '',
            }));
          }
        }}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs text-stone-500">
      <span className="mb-0.5 block">{label}</span>
      {children}
    </label>
  );
}
