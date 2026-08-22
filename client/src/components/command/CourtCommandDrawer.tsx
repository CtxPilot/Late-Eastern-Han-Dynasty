// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useMemo, useState, type Dispatch } from 'react';
import {
  controlsEmperor,
  findDiplomacy,
  HEGEMONY_LABELS,
  HegemonyPosition,
  NOBILITY_LABELS,
  NobilityRank,
  OfficerStatus,
  nextNobilityRank,
  ALL_POLICY_TYPES,
  POLICY_LABELS,
  POLICY_SUMMARIES,
  PolicyType,
  getActivePolicyType,
  getFactionPolicy,
  isBorderCity,
  policySwitchCooldown,
  type GameState,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { gameApi } from '../../services/gateway';
import type { KingRequirementsDto } from '../../services/api';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';
import type { CommandShellAction, CommandShellState } from './commandShellState';

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
  HegemonyPosition.KINGDOM_CHANCELLOR,
  HegemonyPosition.KINGDOM_INTERIOR_MINISTER,
  HegemonyPosition.KINGDOM_COMMANDANT,
  HegemonyPosition.KINGDOM_GENTLEMAN_STEWARD,
  HegemonyPosition.KINGDOM_AGRICULTURE_MINISTER,
  HegemonyPosition.KINGDOM_COACH_MINISTER,
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
    policy: {
      active: getActivePolicyType(game, factionId),
      record: getFactionPolicy(game, factionId) ?? null,
      cooldown: policySwitchCooldown(game, factionId),
      borderCities: Object.values(game.cities).filter(
        (city) => city.ruler === factionId && isBorderCity(game, city.id),
      ),
    },
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
    nobilityCandidates: Object.values(game.officers)
      .filter(
        (officer) =>
          officer.faction === factionId &&
          officer.id !== faction.rulerId &&
          officer.status === OfficerStatus.ACTIVE,
      )
      .map((officer) => {
        const nextRank = nextNobilityRank(officer.nobilityRank);
        const eligibleRank =
          nextRank != null && nextRank !== NobilityRank.KING && nextRank !== NobilityRank.EMPEROR
            ? nextRank
            : null;
        const cost = eligibleRank === NobilityRank.DUKE ? 20 : 10;
        return {
          officer,
          nextRank: eligibleRank,
          cost,
          disabledReason:
            stage !== 'king' && stage !== 'emperor'
              ? '需先称王'
              : eligibleRank == null
                ? '已达臣属上限“公”'
                : authority < cost
                  ? `皇权不足（需${cost}）`
                  : null,
        };
      }),
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
  const proclaimKing = useGameStore((state) => state.proclaimKing);
  const falseDecreeWar = useGameStore((state) => state.falseDecreeWar);
  const grantNobility = useGameStore((state) => state.grantNobility);
  const setNationalPolicy = useGameStore((state) => state.setNationalPolicy);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const clearError = useGameStore((state) => state.clearError);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [policyReviewOpen, setPolicyReviewOpen] = useState(false);
  const [kingRequirements, setKingRequirements] = useState<KingRequirementsDto | null>(null);
  const [requirementsError, setRequirementsError] = useState<string | null>(null);
  const model = useMemo(() => (game ? buildCourtViewModel(game) : null), [game]);
  const draft = shellState.draftByDomain.court;
  const targetFactionId =
    typeof draft?.parameters.targetFactionId === 'number'
      ? draft.parameters.targetFactionId
      : null;
  const selectedTarget = model?.targets.find(
    ({ faction }) => faction.id === targetFactionId,
  );
  const nobilityOfficerId =
    typeof draft?.parameters.officerId === 'number' ? draft.parameters.officerId : null;
  const selectedNobility = model?.nobilityCandidates.find(
    ({ officer }) => officer.id === nobilityOfficerId,
  );
  const kingdomName =
    typeof draft?.parameters.kingdomName === 'string' ? draft.parameters.kingdomName : '';
  const selectedKingdomName = kingRequirements?.kingdomNameCandidates.find(
    (candidate) => candidate.name === kingdomName,
  );

  useEffect(() => {
    let active = true;
    void gameApi.getKingRequirements()
      .then((requirements) => {
        if (!active) return;
        setKingRequirements(requirements);
        setRequirementsError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setRequirementsError(reason instanceof Error ? reason.message : '称王门槛读取失败');
      });
    return () => {
      active = false;
    };
  }, [game]);

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
          <div className="mt-3 border border-stone-800 bg-stone-950/40 p-2" data-testid="command-court-stage-progress">
            <div className="flex justify-between text-[10px]">
              <span className="text-stone-500">政治进程</span>
              <span className="text-amber-300">
                {STAGE_LABEL[model.stage]} → {model.stage === 'vassal' ? '霸府' : model.stage === 'hegemon' ? '王' : model.stage === 'king' ? '帝' : '天下一统'}
              </span>
            </div>
            {model.stage === 'hegemon' && kingRequirements ? (
              <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px]">
                {[
                  ['城池', kingRequirements.cityCount],
                  ['霸府沉淀', kingRequirements.politicalStageAgeMonths],
                  ['皇权', kingRequirements.imperialAuthority],
                ].map(([label, requirement]) => {
                  const item = requirement as KingRequirementsDto['cityCount'];
                  return (
                    <div key={label as string} className={item.passed ? 'text-emerald-300' : 'text-rose-300'}>
                      <div>{label as string}</div>
                      <div>{item.current}/{item.threshold}{label === '霸府沉淀' ? '月' : ''}</div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {requirementsError ? <p className="mt-1 text-[10px] text-rose-300">{requirementsError}</p> : null}
          </div>
        </section>

        <section className="border-t border-stone-800 pt-3" data-testid="command-court-policy">
          <h3 className="text-[11px] tracking-widest text-amber-300">国策态势</h3>
          <p className="mt-1 text-[10px] leading-relaxed text-stone-600">
            一次只能启用一策；切换立即结束旧策，新策下月生效，冷却 6 月。
          </p>
          <p className="mt-2 text-[11px] text-stone-300">
            当前：
            {model.policy.record && !model.policy.record.active
              ? `待生效「${POLICY_LABELS[model.policy.record.type]}」`
              : model.policy.active
                ? POLICY_LABELS[model.policy.active]
                : '未设'}
            {model.policy.cooldown > 0 ? ` · 冷却 ${model.policy.cooldown} 月` : ''}
          </p>
          <select
            data-testid="command-court-policy-type"
            value={typeof draft?.parameters.policyType === 'string' ? draft.parameters.policyType : ''}
            disabled={loading || model.policy.cooldown > 0}
            onChange={(event) => {
              clearError();
              dispatch({
                type: 'select-command',
                domain: 'court',
                commandId: 'set-policy',
                parameters: {
                  policyType: event.target.value,
                  targetCityId: draft?.parameters.targetCityId,
                },
              });
            }}
            className="mt-2 w-full border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200 disabled:text-stone-600"
          >
            <option value="">选择国策</option>
            {ALL_POLICY_TYPES.map((type) => (
              <option key={type} value={type}>
                {POLICY_LABELS[type]}
              </option>
            ))}
          </select>
          {draft?.parameters.policyType === PolicyType.SCORCHED_EARTH ? (
            <select
              data-testid="command-court-policy-city"
              value={typeof draft.parameters.targetCityId === 'number' ? draft.parameters.targetCityId : ''}
              onChange={(event) => {
                dispatch({
                  type: 'update-draft',
                  domain: 'court',
                  parameters: { targetCityId: Number(event.target.value) },
                });
              }}
              className="mt-2 w-full border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
            >
              <option value="">选择边境城</option>
              {model.policy.borderCities.map((city) => (
                <option key={city.id} value={city.id}>{city.name}</option>
              ))}
            </select>
          ) : null}
          {typeof draft?.parameters.policyType === 'string' && draft.parameters.policyType in POLICY_SUMMARIES ? (
            <p className="mt-1 text-[10px] text-stone-500">
              {POLICY_SUMMARIES[draft.parameters.policyType as PolicyType]}
            </p>
          ) : null}
          <button
            type="button"
            data-testid="command-court-policy-submit"
            data-command-write="true"
            disabled={
              loading
              || model.policy.cooldown > 0
              || typeof draft?.parameters.policyType !== 'string'
              || (draft.parameters.policyType === PolicyType.SCORCHED_EARTH
                && typeof draft.parameters.targetCityId !== 'number')
            }
            onClick={() => {
              clearError();
              setPolicyReviewOpen(true);
            }}
            className="mt-2 w-full border border-amber-800 bg-amber-950/30 px-3 py-2 text-left text-amber-100 disabled:border-stone-800 disabled:bg-transparent disabled:text-stone-600"
          >
            送交终审 · 改行国策
          </button>
        </section>

        <section className="border-t border-stone-800 pt-3">
          <h3 className="text-[11px] tracking-widest text-rose-300">王命 · 封爵</h3>
          <p className="mt-1 text-[10px] leading-relaxed text-stone-600">
            仅限同势力在职臣属；逐级晋升，最高至公，爵位终身不可撤销。
          </p>
          <select
            data-testid="command-court-nobility-officer"
            value={nobilityOfficerId ?? ''}
            disabled={loading || (model.stage !== 'king' && model.stage !== 'emperor')}
            onChange={(event) => {
              clearError();
              dispatch({
                type: 'select-command',
                domain: 'court',
                commandId: 'grant-nobility',
                parameters: { officerId: Number(event.target.value) },
              });
            }}
            className="mt-2 w-full border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200 disabled:text-stone-600"
          >
            <option value="">选择受封者</option>
            {model.nobilityCandidates.map(({ officer, nextRank, disabledReason }) => (
              <option key={officer.id} value={officer.id}>
                {officer.name} · {NOBILITY_LABELS[officer.nobilityRank]} →
                {nextRank ? NOBILITY_LABELS[nextRank] : '已达上限'}
                {disabledReason ? `（${disabledReason}）` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="command-court-nobility-review"
            disabled={loading || !selectedNobility || selectedNobility.disabledReason != null}
            onClick={() => {
              clearError();
              setReviewOpen(true);
            }}
            className="mt-2 w-full border border-red-900 bg-red-950/20 px-3 py-2 text-left text-red-200 hover:bg-red-950/50 disabled:border-stone-800 disabled:bg-transparent disabled:text-stone-600"
          >
            送交重大终审
            <span className="ml-2 text-[10px] text-stone-500">
              {selectedNobility?.disabledReason ??
                (selectedNobility ? `皇权 ${selectedNobility.cost} · 不可撤销` : '尚未选择受封者')}
            </span>
          </button>
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
          ) : model.stage === 'hegemon' ? (
            <div className="mt-2">
              <select
                data-testid="command-court-kingdom-name"
                value={kingdomName}
                disabled={loading || !kingRequirements}
                onChange={(event) => {
                  clearError();
                  dispatch({
                    type: 'select-command',
                    domain: 'court',
                    commandId: 'proclaim-king',
                    parameters: { kingdomName: event.target.value },
                  });
                }}
                className="w-full border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200 disabled:text-stone-600"
              >
                <option value="">选择王号</option>
                {kingRequirements?.kingdomNameCandidates.map((candidate) => (
                  <option key={candidate.name} value={candidate.name} disabled={!candidate.available}>
                    {candidate.name}王{candidate.available ? '' : '（已被占用）'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-testid="command-court-proclaim-king-review"
                disabled={
                  loading ||
                  !kingRequirements?.allPassed ||
                  !selectedKingdomName?.available
                }
                title={
                  !kingRequirements?.allPassed
                    ? '称王门槛尚未全部满足'
                    : !selectedKingdomName?.available
                      ? '请选择可用王号'
                      : '消耗80皇权；政治阶段不可撤销'
                }
                onClick={() => {
                  clearError();
                  setReviewOpen(true);
                }}
                className="mt-2 w-full border border-red-900 bg-red-950/20 px-3 py-2 text-left text-red-200 hover:bg-red-950/50 disabled:border-stone-800 disabled:bg-transparent disabled:text-stone-600"
              >
                称王 · 送交重大终审
                <span className="ml-2 text-[10px] text-stone-500">
                  {kingRequirements?.allPassed ? '皇权80 · 不可撤销' : '门槛未满足'}
                </span>
              </button>
            </div>
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
            {model.offices
              .filter((office) =>
                model.stage === 'king' || model.stage === 'emperor'
                  ? true
                  : HEGEMONY_OFFICES.slice(0, 3).includes(office.position as typeof HEGEMONY_OFFICES[number]),
              )
              .map((office) => (
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
              dispatch({
                type: 'select-command',
                domain: 'personnel',
                commandId: 'appoint',
                parameters: { facet: 'appointment', track: 'hegemony' },
              });
            }}
            className="mt-2 w-full border border-stone-700 px-3 py-2 text-left text-stone-300 hover:border-amber-800"
          >
            前往人事 · 任命
          </button>
        </section>
      </div>

      <CommandConfirmDialog
        open={reviewOpen && draft?.commandId === 'proclaim-king'}
        category="朝廷 · 国之大事"
        command={`确认称${kingdomName || '—'}王`}
        summary="称王将永久推进政治阶段并固定王号；确认前会重新读取权威门槛与王号占用状态。"
        items={[
          { label: '势力', value: model.faction.name },
          { label: '政治阶段', value: `霸府 → ${kingdomName || '—'}王`, tone: 'warning' },
          { label: '领有城池', value: `${kingRequirements?.cityCount.current ?? '—'}/${kingRequirements?.cityCount.threshold ?? '—'}` },
          { label: '霸府沉淀', value: `${kingRequirements?.politicalStageAgeMonths.current ?? '—'}/${kingRequirements?.politicalStageAgeMonths.threshold ?? '—'}月` },
          { label: '立即消耗', value: '皇权 80', tone: 'warning' },
          { label: '解锁', value: '王国六职、王命封爵、外交 +8/×1.2' },
          { label: '可否撤销', value: '不可撤销', tone: 'warning' },
        ]}
        loading={loading}
        danger
        error={error}
        fallbackFocusSelector='[data-testid="command-domain-court"]'
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          const latestFaction = latest?.factions[latest.playerFactionId];
          if (!latest || !latestFaction || !kingRequirements) return '朝廷状态已失效，请返回检查。';
          if ((latestFaction.politicalStage ?? 'vassal') !== 'hegemon') {
            return '政治阶段已经变化，不能继续称王。';
          }
          if (latestFaction.cityIds.length < kingRequirements.cityCount.threshold) {
            return '领有城池已低于称王门槛，请返回检查。';
          }
          if ((latestFaction.politicalStageAgeMonths ?? 0) < kingRequirements.politicalStageAgeMonths.threshold) {
            return '霸府沉淀已低于称王门槛，请返回检查。';
          }
          if ((latestFaction.imperialAuthority ?? 0) < kingRequirements.imperialAuthority.threshold) {
            return '皇权已低于称王门槛，请返回检查。';
          }
          const nameOccupied = Object.values(latest.factions).some(
            (faction) =>
              faction.id !== latest.playerFactionId &&
              faction.isAlive &&
              faction.kingdomName === kingdomName,
          );
          if (!kingdomName || nameOccupied) return '所选王号已失效或被占用，请返回修改。';
          return null;
        }}
        onCancel={() => setReviewOpen(false)}
        onConfirm={async () => {
          if (!selectedKingdomName?.available || !kingRequirements?.allPassed) return;
          await proclaimKing(selectedKingdomName.name);
          if (useGameStore.getState().error) return;
          setReviewOpen(false);
          dispatch({ type: 'submit-succeeded', domain: 'court' });
        }}
      />
      <CommandConfirmDialog
        open={reviewOpen && draft?.commandId === 'grant-nobility'}
        category="朝廷 · 重大王命"
        command={`确认封爵：${selectedNobility?.officer.name ?? '未选受封者'}`}
        summary="爵位为终身制，当前版本没有撤爵或降爵接口；确认后不可撤销。"
        items={[
          { label: '受封者', value: selectedNobility?.officer.name ?? '—' },
          {
            label: '爵位变更',
            value: selectedNobility?.nextRank
              ? `${NOBILITY_LABELS[selectedNobility.officer.nobilityRank]} → ${NOBILITY_LABELS[selectedNobility.nextRank]}`
              : '—',
            tone: 'warning',
          },
          { label: '立即消耗', value: `皇权 ${selectedNobility?.cost ?? '—'}`, tone: 'warning' },
          { label: '可否撤销', value: '不可撤销', tone: 'warning' },
        ]}
        loading={loading}
        danger
        error={error}
        fallbackFocusSelector='[data-testid="command-domain-court"]'
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          const latestModel = latest ? buildCourtViewModel(latest) : null;
          const latestCandidate = latestModel?.nobilityCandidates.find(
            ({ officer }) => officer.id === nobilityOfficerId,
          );
          return latestCandidate?.disabledReason ??
            (!latestCandidate?.nextRank ? '受封者或爵位状态已失效，请返回修改。' : null);
        }}
        onCancel={() => setReviewOpen(false)}
        onConfirm={async () => {
          if (!selectedNobility?.nextRank || selectedNobility.disabledReason) return;
          await grantNobility(selectedNobility.officer.id, selectedNobility.nextRank);
          if (useGameStore.getState().error) return;
          setReviewOpen(false);
          dispatch({ type: 'submit-succeeded', domain: 'court' });
        }}
      />
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
      <CommandConfirmDialog
        open={policyReviewOpen}
        category="朝廷 · 国策"
        command={`确认改行国策「${
          typeof draft?.parameters.policyType === 'string'
            ? POLICY_LABELS[draft.parameters.policyType as PolicyType] ?? draft.parameters.policyType
            : '—'
        }」`}
        summary="当前国策立即结束，新策下月生效；6 月内不可再切。"
        items={[
          {
            label: '国策',
            value:
              typeof draft?.parameters.policyType === 'string'
                ? POLICY_LABELS[draft.parameters.policyType as PolicyType]
                : '—',
          },
          {
            label: '效果',
            value:
              typeof draft?.parameters.policyType === 'string'
                ? POLICY_SUMMARIES[draft.parameters.policyType as PolicyType]
                : '—',
          },
          { label: '冷却', value: '6 月', tone: 'warning' },
        ]}
        loading={loading}
        error={error}
        fallbackFocusSelector='[data-testid="command-domain-court"]'
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          const latestModel = latest ? buildCourtViewModel(latest) : null;
          if (!latestModel) return '朝廷状态已失效，请返回检查。';
          if (latestModel.policy.cooldown > 0) return `国策冷却中（剩余${latestModel.policy.cooldown}月）`;
          if (typeof draft?.parameters.policyType !== 'string') return '请选择国策';
          if (
            draft.parameters.policyType === PolicyType.SCORCHED_EARTH
            && typeof draft.parameters.targetCityId !== 'number'
          ) {
            return '坚壁清野须指定边境城';
          }
          return null;
        }}
        onCancel={() => setPolicyReviewOpen(false)}
        onConfirm={async () => {
          if (typeof draft?.parameters.policyType !== 'string') return;
          await setNationalPolicy(
            draft.parameters.policyType,
            typeof draft.parameters.targetCityId === 'number' ? draft.parameters.targetCityId : undefined,
          );
          if (useGameStore.getState().error) return;
          setPolicyReviewOpen(false);
          dispatch({ type: 'submit-succeeded', domain: 'court' });
        }}
      />
    </>
  );
}
