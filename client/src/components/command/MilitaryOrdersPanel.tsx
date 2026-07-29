// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import type { CampaignArmy, CampaignPhase, GameState, StructureType } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';
import { campaignArmyPhaseLabel } from '../campaign/CampaignPanel.helpers';

const PHASE_LABEL: Record<CampaignPhase, string> = {
  garrison: '驻守',
  marching: '行军',
  engaged: '接战',
  sieging: '围城',
  assaulting: '强攻',
  retreating: '撤退',
};

const STRUCTURES: readonly { value: StructureType; label: string; cost: number; turns: number }[] = [
  { value: 'camp', label: '营寨', cost: 100, turns: 1 },
  { value: 'ram', label: '冲车', cost: 300, turns: 2 },
  { value: 'ladder', label: '云梯', cost: 200, turns: 2 },
  { value: 'siege_tower', label: '井阑', cost: 400, turns: 3 },
  { value: 'catapult', label: '投石车', cost: 500, turns: 3 },
  { value: 'supply_depot', label: '粮仓', cost: 150, turns: 1 },
  { value: 'palisade', label: '栅栏', cost: 80, turns: 1 },
  { value: 'trench', label: '壕沟', cost: 60, turns: 1 },
];

type AdvisorAction = 'inspire' | 'trap' | 'retreat' | 'scout';

const ADVISOR_ACTIONS: readonly { value: AdvisorAction; label: string; effect: string }[] = [
  { value: 'inspire', label: '激励', effect: '士气 +15，参谋体力 −15' },
  { value: 'trap', label: '布陷阱', effect: '需智力≥90、体力≥40，参谋体力 −20' },
  { value: 'retreat', label: '休整', effect: '疲劳 −30，参谋体力 −10' },
  { value: 'scout', label: '斥候', effect: '扩大视野（0-A 简化为日志）' },
];

type OrderDraft =
  | { kind: 'assault'; armyId: string }
  | { kind: 'surrender'; armyId: string }
  | { kind: 'retreat'; armyId: string }
  | { kind: 'build'; armyId: string; structureType: StructureType }
  | { kind: 'advisor'; armyId: string; action: AdvisorAction };

export function validateMilitaryOrder(game: GameState, draft: OrderDraft): string | null {
  const army = game.campaignArmies.find((item) => item.id === draft.armyId);
  if (!army || army.factionId !== game.playerFactionId) return '所选军队已不存在或归属已经变化。';
  if (draft.kind === 'assault' && !['sieging', 'engaged'].includes(army.phase)) return `军队阶段已变为${PHASE_LABEL[army.phase]}，不能强攻。`;
  if (draft.kind === 'surrender' && army.phase !== 'sieging') return `军队阶段已变为${PHASE_LABEL[army.phase]}，不能劝降。`;
  if (draft.kind === 'retreat' && !['marching', 'garrison'].includes(army.phase)) return `军队阶段已变为${PHASE_LABEL[army.phase]}，不能撤退。`;
  if (draft.kind === 'build') {
    const structure = STRUCTURES.find((item) => item.value === draft.structureType);
    if (!structure) return '所选设施不存在。';
    if (!['marching', 'sieging', 'garrison'].includes(army.phase)) return `军队阶段已变为${PHASE_LABEL[army.phase]}，不能营建。`;
    if (army.structures.some((item) => item.buildProgress < 1)) return '已有设施在建中，请等待完成。';
    const gold = game.factions[army.factionId]?.gold ?? 0;
    if (gold < structure.cost) return `势力金不足（需 ${structure.cost}，当前 ${gold}）。`;
  }
  if (draft.kind === 'advisor') {
    if (army.advisorId == null) return '该军队已无参谋。';
    const advisor = game.officers[army.advisorId];
    if (!advisor) return '参谋已不存在。';
    if (draft.action === 'inspire' && advisor.stamina < 30) return '参谋体力不足（需≥30）。';
    if (draft.action === 'trap' && advisor.stats.intelligence < 90) return '参谋智力须≥90方可布陷阱。';
    if (draft.action === 'trap' && advisor.stamina < 40) return '参谋体力不足（需≥40）。';
    if (draft.action === 'retreat' && advisor.stamina < 20) return '参谋体力不足（需≥20）。';
  }
  return null;
}

export function MilitaryOrdersPanel() {
  const game = useGameStore((state) => state.game);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const campaignBuild = useGameStore((state) => state.campaignBuild);
  const campaignAssault = useGameStore((state) => state.campaignAssault);
  const campaignSiegeSurrender = useGameStore((state) => state.campaignSiegeSurrender);
  const campaignRetreat = useGameStore((state) => state.campaignRetreat);
  const campaignAdvisorAction = useGameStore((state) => state.campaignAdvisorAction);
  const [selectedArmyId, setSelectedArmyId] = useState('');
  const [draft, setDraft] = useState<OrderDraft | null>(null);

  const armies = useMemo(
    () => game?.campaignArmies.filter((army) => army.factionId === game.playerFactionId) ?? [],
    [game],
  );
  const selectedArmy = armies.find((army) => army.id === selectedArmyId) ?? armies[0] ?? null;
  if (!game) return null;

  const effectiveArmyId = selectedArmy?.id ?? '';
  const advisor = selectedArmy?.advisorId != null ? game.officers[selectedArmy.advisorId] : null;

  return (
    <section className="min-h-0 space-y-3 overflow-y-auto" data-testid="command-military-orders">
      <p className="text-[10px] text-stone-500">军令在终审确认后才提交；左栏战役仅保留只读军情与战报。</p>
      {armies.length === 0 ? (
        <p className="border border-stone-800 bg-stone-900/50 px-3 py-3 text-stone-500">无可下令的战役军队。</p>
      ) : (
        <>
          <label className="block text-[10px] text-stone-500">
            选择军队
            <select
              data-testid="command-military-orders-army"
              value={effectiveArmyId}
              onChange={(event) => setSelectedArmyId(event.target.value)}
              className="mt-1 w-full border border-stone-700 bg-stone-950 px-2 py-1.5 text-stone-200"
            >
              {armies.map((army) => <option key={army.id} value={army.id}>{army.name}</option>)}
            </select>
          </label>
          {selectedArmy ? (
            <>
              <ArmyStatus game={game} army={selectedArmy} />
              <div className="grid grid-cols-3 gap-1">
                {selectedArmy.phase === 'sieging' || selectedArmy.phase === 'engaged' ? (
                  <OrderButton testId="military-order-assault" label="强攻" danger onClick={() => setDraft({ kind: 'assault', armyId: selectedArmy.id })} />
                ) : null}
                {selectedArmy.phase === 'sieging' ? (
                  <OrderButton testId="military-order-surrender" label="劝降" onClick={() => setDraft({ kind: 'surrender', armyId: selectedArmy.id })} />
                ) : null}
                {selectedArmy.phase === 'marching' || selectedArmy.phase === 'garrison' ? (
                  <OrderButton testId="military-order-retreat" label="撤退" onClick={() => setDraft({ kind: 'retreat', armyId: selectedArmy.id })} />
                ) : null}
              </div>
              {advisor ? (
                <div>
                  <h4 className="mb-1 text-[10px] text-stone-500">参谋行动 · {advisor.name}（体力 {advisor.stamina}）</h4>
                  <div className="grid grid-cols-2 gap-1">
                    {ADVISOR_ACTIONS.map((action) => (
                      <OrderButton key={action.value} testId={`military-order-advisor-${action.value}`} label={action.label} onClick={() => setDraft({ kind: 'advisor', armyId: selectedArmy.id, action: action.value })} />
                    ))}
                  </div>
                </div>
              ) : null}
              {['marching', 'sieging', 'garrison'].includes(selectedArmy.phase) ? (
                <div>
                  <h4 className="mb-1 text-[10px] text-stone-500">营建设施 · 势力金 {game.factions[game.playerFactionId]?.gold ?? 0}</h4>
                  <div className="grid grid-cols-2 gap-1">
                    {STRUCTURES.map((structure) => (
                      <OrderButton key={structure.value} testId={`military-order-build-${structure.value}`} label={`${structure.label} ${structure.cost}金/${structure.turns}回合`} onClick={() => setDraft({ kind: 'build', armyId: selectedArmy.id, structureType: structure.value })} />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
      <CommandConfirmDialog
        open={draft != null}
        category="军事"
        command={draft ? orderTitle(draft) : '确认军令'}
        summary={draft ? orderSummary(draft) : ''}
        items={draft ? orderItems(game, draft) : []}
        loading={loading}
        danger={draft?.kind === 'assault'}
        error={error}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          return !latest || !draft ? '军令草稿已失效，请返回修改。' : validateMilitaryOrder(latest, draft);
        }}
        onCancel={() => setDraft(null)}
        onConfirm={async () => {
          if (!draft) return;
          if (draft.kind === 'assault') await campaignAssault(draft.armyId);
          if (draft.kind === 'surrender') await campaignSiegeSurrender(draft.armyId);
          if (draft.kind === 'retreat') await campaignRetreat(draft.armyId);
          if (draft.kind === 'build') await campaignBuild(draft.armyId, draft.structureType);
          if (draft.kind === 'advisor') await campaignAdvisorAction(draft.armyId, draft.action);
          if (!useGameStore.getState().error) setDraft(null);
        }}
      />
    </section>
  );
}

function ArmyStatus({ game, army }: { game: GameState; army: CampaignArmy }) {
  return (
    <article className="border border-stone-800 bg-stone-900/60 px-3 py-2">
      <div className="flex justify-between"><strong className="text-stone-100">{army.name}</strong><span className="text-red-200">{campaignArmyPhaseLabel(game, army, PHASE_LABEL)}</span></div>
      <p className="mt-1 text-[10px] text-stone-500">{game.cities[army.currentNodeId]?.name ?? `节点${army.currentNodeId}`} · 兵 {army.troops} · 粮 {army.food} · 士气 {army.morale}</p>
      <p className="text-[10px] text-stone-600">组织 {army.organization} · 疲劳 {army.fatigue}</p>
    </article>
  );
}

function OrderButton({ testId, label, danger = false, onClick }: { testId: string; label: string; danger?: boolean; onClick: () => void }) {
  return <button type="button" data-testid={testId} onClick={onClick} className={`border px-2 py-1.5 text-[10px] ${danger ? 'border-red-800 bg-red-950/30 text-red-100' : 'border-amber-900/60 bg-stone-900 text-amber-100'}`}>{label}</button>;
}

function orderTitle(draft: OrderDraft): string {
  if (draft.kind === 'assault') return '确认发动强攻';
  if (draft.kind === 'surrender') return '确认劝降守军';
  if (draft.kind === 'retreat') return '确认撤退';
  if (draft.kind === 'build') return `确认营建${STRUCTURES.find((item) => item.value === draft.structureType)?.label ?? draft.structureType}`;
  return `确认参谋${ADVISOR_ACTIONS.find((item) => item.value === draft.action)?.label ?? draft.action}`;
}

function orderSummary(draft: OrderDraft): string {
  if (draft.kind === 'assault') return '将立即进行自动战斗结算，可能造成大量伤亡或改变城池归属。';
  if (draft.kind === 'surrender') return '将立即进行劝降判定；成功会改变目标城归属。';
  if (draft.kind === 'retreat') return '军队将撤回最近己方节点并损失士气。';
  if (draft.kind === 'build') return '将立即扣除势力金并开始回合化建造；大型设施会中止行军。';
  return ADVISOR_ACTIONS.find((item) => item.value === draft.action)?.effect ?? '';
}

function orderItems(game: GameState, draft: OrderDraft) {
  const army = game.campaignArmies.find((item) => item.id === draft.armyId);
  const items = [
    { label: '军队', value: army?.name ?? '—' },
    { label: '当前位置', value: army ? game.cities[army.currentNodeId]?.name ?? String(army.currentNodeId) : '—' },
  ];
  if (draft.kind === 'build') {
    const structure = STRUCTURES.find((item) => item.value === draft.structureType);
    items.push({ label: '消耗与工期', value: `${structure?.cost ?? 0}金 / ${structure?.turns ?? 0}回合` });
  } else if (draft.kind === 'advisor') {
    items.push({ label: '立即后果', value: ADVISOR_ACTIONS.find((item) => item.value === draft.action)?.effect ?? draft.action });
  } else {
    items.push({ label: '立即后果', value: orderSummary(draft) });
  }
  return items;
}
