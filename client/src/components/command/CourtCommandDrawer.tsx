// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState, type Dispatch } from 'react';
import {
  controlsEmperor,
  findDiplomacy,
  HEGEMONY_LABELS,
  HegemonyPosition,
  type GameState,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';
import type { CommandShellAction, CommandShellState } from './commandShellState';
import { openLegacyPersonnelPanel } from './commandNavigation';

const STAGE_LABEL = {
  vassal: '诸侯',
  hegemon: '霸府',
  king: '王',
  emperor: '帝',
} as const;

const HEGEMONY_OFFICES = [
  HegemonyPosition.GRAND_COMMANDER,
  HegemonyPosition.REGENT_SECRETARY,
  HegemonyPosition.GRAND_CAPTAIN,
] as const;

export type CourtViewModel = ReturnType<typeof buildCourtViewModel>;

/** 只从权威 GameState 派生展示与门槛，供新旧入口对照测试复用。 */
export function buildCourtViewModel(game: GameState) {
  const factionId = game.playerFactionId;
  const faction = game.factions[factionId];
  if (!faction) return null;
  const stage = faction.politicalStage ?? 'vassal';
  const authority = faction.imperialAuthority ?? 0;
  const cooldown = faction.imperialDecreeCooldown ?? 0;
  const emperorCity = game.emperorLocation == null ? null : game.cities[game.emperorLocation];
  const controlsHan = controlsEmperor(game, factionId);
  const commonDecreeReason =
    stage === 'vassal'
      ? '需先开霸府'
      : authority < 40
        ? `皇权不足（需40，当前${authority}）`
        : cooldown > 0
          ? `冷却中（剩余${cooldown}季）`
          : null;

  return {
    factionId,
    faction,
    ruler: game.officers[faction.rulerId],
    stage,
    authority,
    cooldown,
    controlsHan,
    emperorCity,
    emperorController:
      emperorCity?.ruler == null ? null : game.factions[emperorCity.ruler] ?? null,
    targets: Object.values(game.factions)
      .filter((target) => target.id !== factionId && target.isAlive)
      .map((target) => ({
        faction: target,
        disabledReason:
          findDiplomacy(game.diplomacy, factionId, target.id)?.relation === 'war'
            ? '已交战'
            : commonDecreeReason,
      })),
    offices: HEGEMONY_OFFICES.map((position) => ({
      position,
      label: HEGEMONY_LABELS[position],
      holder: Object.values(game.officers).find(
        (officer) =>
          officer.faction === factionId && officer.hegemonyPosition === position,
      ),
    })),
  };
}

export function CourtCommandDrawer({
  shellState,
  dispatch,
}: {
  shellState: CommandShellState;
  dispatch: Dispatch<CommandShellAction>;
}) {
  const game = useGameStore((state) => state.game);
  const establishHegemony = useGameStore((state) => state.establishHegemony);
  const falseDecreeWar = useGameStore((state) => state.falseDecreeWar);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const clearError = useGameStore((state) => state.clearError);
  const [reviewOpen, setReviewOpen] = useState(false);
  const model = useMemo(() => (game ? buildCourtViewModel(game) : null), [game]);
  const draft = shellState.draftByDomain.court;
  const targetFactionId =
    typeof draft?.parameters.targetFactionId === 'number'
      ? draft.parameters.targetFactionId
      : null;
  const selectedTarget = model?.targets.find(
    ({ faction }) => faction.id === targetFactionId,
  );

  if (!game || !model) return <p>尚未载入朝廷状态。</p>;

  const beginEstablish = () => {
    clearError();
    dispatch({ type: 'select-command', domain: 'court', commandId: 'establish-hegemony' });
    setReviewOpen(true);
  };

  const chooseTarget = (nextTargetId: number) => {
    clearError();
    dispatch({
      type: 'select-command',
      domain: 'court',
      commandId: 'false-decree',
      parameters: { targetFactionId: nextTargetId },
    });
  };

  return (
    <>
      <div className="space-y-4" data-testid="court-command-content">
        <section>
          <h3 className="text-[11px] tracking-widest text-amber-300">君主与政统</h3>
          <dl className="mt-2 grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1">
            <dt className="text-stone-600">君主</dt>
            <dd className="text-stone-200">{model.ruler?.name ?? '—'}</dd>
            <dt className="text-stone-600">政治阶段</dt>
            <dd className="text-stone-200">
              {STAGE_LABEL[model.stage]}
              {model.faction.politicalTitle ? ` · ${model.faction.politicalTitle}` : ''}
            </dd>
            <dt className="text-stone-600">汉帝所在</dt>
            <dd className="text-stone-200">
              {model.emperorCity?.name ?? '下落未明'}
              {model.emperorController ? ` · ${model.emperorController.name}控制` : ''}
            </dd>
            <dt className="text-stone-600">本势力控制</dt>
            <dd className={model.controlsHan ? 'text-emerald-300' : 'text-stone-500'}>
              {model.controlsHan ? '是' : '否'}
            </dd>
            <dt className="text-stone-600">皇权</dt>
            <dd className="text-amber-200">{model.authority}/100</dd>
            <dt className="text-stone-600">伪诏冷却</dt>
            <dd className="text-stone-200">
              {model.cooldown > 0 ? `${model.cooldown}季` : '就绪'}
            </dd>
          </dl>
        </section>

        <section className="border-t border-stone-800 pt-3">
          <h3 className="text-[11px] tracking-widest text-amber-300">大事</h3>
          {model.stage === 'vassal' ? (
            <button
              type="button"
              data-testid="command-court-establish-hegemony"
              disabled={loading || !model.controlsHan}
              title={
                model.controlsHan
                  ? '迎奉天子、自领丞相；政治阶段不可撤销'
                  : '未控制汉献帝（需占领汉帝所在城池）'
              }
              onClick={beginEstablish}
              className="mt-2 w-full border border-amber-800 px-3 py-2 text-left text-amber-100 hover:bg-amber-950/50 disabled:border-stone-800 disabled:text-stone-600"
            >
              开霸府
              <span className="ml-2 text-[10px] text-stone-500">
                {model.controlsHan ? '迎奉天子 · 自领丞相' : '未控制汉献帝'}
              </span>
            </button>
          ) : (
            <p className="mt-2 text-stone-600">已进入{STAGE_LABEL[model.stage]}阶段，开府不可重复。</p>
          )}
        </section>

        <section className="border-t border-stone-800 pt-3">
          <h3 className="text-[11px] tracking-widest text-amber-300">诏令 · 伪诏宣战</h3>
          <select
            data-testid="command-court-false-decree-target"
            value={targetFactionId ?? ''}
            disabled={loading || model.stage === 'vassal'}
            onChange={(event) => chooseTarget(Number(event.target.value))}
            className="mt-2 w-full border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200 disabled:text-stone-600"
          >
            <option value="">选择目标势力</option>
            {model.targets.map(({ faction, disabledReason }) => (
              <option key={faction.id} value={faction.id}>
                {faction.name}{disabledReason ? `（${disabledReason}）` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="command-court-false-decree-review"
            disabled={loading || !selectedTarget || selectedTarget.disabledReason != null}
            title={
              selectedTarget?.disabledReason ??
              (selectedTarget ? `消耗40皇权，对${selectedTarget.faction.name}直接宣战；冷却8季` : '请先选择目标势力')
            }
            onClick={() => {
              clearError();
              setReviewOpen(true);
            }}
            className="mt-2 w-full border border-red-900 px-3 py-2 text-left text-red-200 hover:bg-red-950/50 disabled:border-stone-800 disabled:text-stone-600"
          >
            送交终审
            <span className="ml-2 text-[10px] text-stone-500">
              {selectedTarget?.disabledReason ?? (selectedTarget ? '皇权40 · 冷却8季' : '尚未选择目标')}
            </span>
          </button>
        </section>

        <section className="border-t border-stone-800 pt-3">
          <h3 className="text-[11px] tracking-widest text-amber-300">霸府官制 · 只读总览</h3>
          <div className="mt-2 space-y-1">
            {model.offices.map((office) => (
              <div key={office.position} className="flex justify-between border-b border-stone-900 py-1">
                <span className="text-stone-400">{office.label}</span>
                <span className={office.holder ? 'text-stone-200' : 'text-stone-600'}>
                  {office.holder?.name ?? '未任命'}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            data-testid="command-court-open-personnel"
            onClick={() => {
              openLegacyPersonnelPanel();
              dispatch({ type: 'close-drawer' });
            }}
            className="mt-2 w-full border border-stone-700 px-3 py-2 text-left text-stone-300 hover:border-amber-800"
          >
            前往人事 · 任命
          </button>
        </section>
      </div>

      <CommandConfirmDialog
        open={reviewOpen && draft?.commandId === 'establish-hegemony'}
        category="朝廷"
        command={`确认开霸府：${model.faction.name}`}
        summary="开霸府后政治阶段永久改变，当前版本不可撤销。确认迎奉天子、自领丞相？"
        items={[
          { label: '政治阶段', value: '诸侯 → 霸府', tone: 'warning' },
          { label: '政治头衔', value: '丞相' },
          { label: '皇权', value: '获得初始皇权 100' },
          { label: '解锁', value: '霸府官职、伪诏宣战、外交加成' },
          { label: '可否撤销', value: '不可撤销', tone: 'warning' },
        ]}
        loading={loading}
        danger
        error={error}
        fallbackFocusSelector='[data-testid="command-domain-court"]'
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          const latestModel = latest ? buildCourtViewModel(latest) : null;
          if (!latestModel) return '朝廷状态已失效，请返回修改。';
          if (latestModel.stage !== 'vassal') return '政治阶段已经变化，不能重复开霸府。';
          if (!latestModel.controlsHan) return '已不再控制汉献帝，不能开霸府。';
          return null;
        }}
        onCancel={() => setReviewOpen(false)}
        onConfirm={async () => {
          await establishHegemony();
          if (useGameStore.getState().error) return;
          setReviewOpen(false);
          dispatch({ type: 'submit-succeeded', domain: 'court' });
        }}
      />
      <CommandConfirmDialog
        open={reviewOpen && draft?.commandId === 'false-decree'}
        category="朝廷"
        command={`确认伪诏宣战：${selectedTarget?.faction.name ?? '未选目标'}`}
        summary="将绕过常规外交前置，立即与目标势力进入战争状态。"
        items={[
          { label: '目标势力', value: selectedTarget?.faction.name ?? '—' },
          { label: '立即消耗', value: '皇权 40', tone: 'warning' },
          { label: '外交后果', value: '双方关系立即变为战争', tone: 'warning' },
          { label: '冷却', value: '8 季' },
          { label: '额外风险', value: '若目标匡扶汉室，声望 −30' },
        ]}
        loading={loading}
        danger
        error={error}
        fallbackFocusSelector='[data-testid="command-domain-court"]'
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          const latestModel = latest ? buildCourtViewModel(latest) : null;
          const latestTarget = latestModel?.targets.find(
            ({ faction }) => faction.id === targetFactionId,
          );
          return latestTarget?.disabledReason ?? (!latestTarget ? '目标势力已失效，请返回修改。' : null);
        }}
        onCancel={() => setReviewOpen(false)}
        onConfirm={async () => {
          if (!selectedTarget || selectedTarget.disabledReason) return;
          await falseDecreeWar(selectedTarget.faction.id);
          if (useGameStore.getState().error) return;
          setReviewOpen(false);
          dispatch({ type: 'submit-succeeded', domain: 'court' });
        }}
      />
    </>
  );
}
