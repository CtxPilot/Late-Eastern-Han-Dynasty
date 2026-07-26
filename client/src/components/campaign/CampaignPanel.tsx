// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import { FORMATION_LABEL, FormationType, UnitType, type CampaignArmy } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';

const PHASE_LABEL: Record<string, string> = {
  garrison: '驻守',
  marching: '行军',
  engaged: '野战',
  sieging: '围城',
  assaulting: '强攻',
  retreating: '撤退',
};

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

const STRUCTURE_OPTIONS: Array<{ value: string; label: string; cost: number; turns: number }> = [
  { value: 'camp', label: '营寨', cost: 100, turns: 1 },
  { value: 'ram', label: '冲车', cost: 300, turns: 2 },
  { value: 'ladder', label: '云梯', cost: 200, turns: 2 },
  { value: 'siege_tower', label: '井阑', cost: 400, turns: 3 },
  { value: 'catapult', label: '投石车', cost: 500, turns: 3 },
  { value: 'supply_depot', label: '粮仓', cost: 150, turns: 1 },
  { value: 'palisade', label: '栅栏', cost: 80, turns: 1 },
  { value: 'trench', label: '壕沟', cost: 60, turns: 1 },
];

/**
 * 战役层面板（05 §十三~§十七）
 * - 编成出征（主将+副将+参谋+Squad 五部阵位）
 * - Army 列表与操作（行军/扎营/建造/强攻/劝降/撤退/参谋行动）
 * - 战斗报告弹窗（自动结算结果）
 */
export function CampaignPanel() {
  const game = useGameStore((s) => s.game);
  const loading = useGameStore((s) => s.loading);
  const error = useGameStore((s) => s.error);
  const lastBattleResult = useGameStore((s) => s.lastBattleResult);
  const campaignStart = useGameStore((s) => s.campaignStart);
  const campaignBuild = useGameStore((s) => s.campaignBuild);
  const campaignAssault = useGameStore((s) => s.campaignAssault);
  const campaignSiegeSurrender = useGameStore((s) => s.campaignSiegeSurrender);
  const campaignRetreat = useGameStore((s) => s.campaignRetreat);
  const campaignAdvisorAction = useGameStore((s) => s.campaignAdvisorAction);
  const selectedCityId = useGameStore((s) => s.selectedCityId);

  const [commanderId, setCommanderId] = useState<number | ''>('');
  const [targetNodeId, setTargetNodeId] = useState<number | ''>('');
  const [troopCount, setTroopCount] = useState<number>(5000);
  const [food, setFood] = useState<number>(1500);
  const [unitType, setUnitType] = useState<string>(UnitType.HEAVY_CAVALRY);
  const [formation, setFormation] = useState<number>(FormationType.WEDGE);
  const [selectedArmyId, setSelectedArmyId] = useState<string>('');
  const [showBattleReport, setShowBattleReport] = useState(false);
  const [confirm, setConfirm] = useState<'start' | 'assault' | 'surrender' | 'retreat' | null>(null);

  const myArmies = useMemo<CampaignArmy[]>(() => {
    if (!game) return [];
    return game.campaignArmies.filter((a) => a.factionId === game.playerFactionId);
  }, [game]);

  const enemyCities = useMemo(() => {
    if (!game) return [];
    // 目标候选：与任意己方城道路邻接的非己方城（含迷雾城 ruler=null）
    // 服务端用真源校验 ruler==null 会拒绝，UI 仍列出供玩家尝试
    const myIds = Object.values(game.cities)
      .filter((c) => c.ruler === game.playerFactionId)
      .map((c) => c.id);
    const adjacentEnemyIds = new Set<number>();
    const nodes = game.campaignNodes ?? [];
    for (const node of nodes) {
      if (myIds.includes(node.id)) {
        for (const adj of node.adjacentNodeIds) {
          if (!myIds.includes(adj)) adjacentEnemyIds.add(adj);
        }
      }
    }
    // 若节点表为空（旧缓存），退化为列出所有非己方城
    if (nodes.length === 0) {
      return Object.values(game.cities)
        .filter((c) => c.ruler !== game.playerFactionId)
        .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    }
    return Object.values(game.cities)
      .filter((c) => adjacentEnemyIds.has(c.id) && c.ruler !== game.playerFactionId)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [game]);

  /** 当前选中城市的可出征武将 */
  const availableOfficers = useMemo(() => {
    if (!game || selectedCityId == null) return [];
    return Object.values(game.officers).filter(
      (o) =>
        o.faction === game.playerFactionId &&
        o.location === selectedCityId &&
        o.status === 'active',
    );
  }, [game, selectedCityId]);

  /** 选中城市中可作为副将的武将（排除主将） */
  const availableSubs = useMemo(() => {
    if (!game || selectedCityId == null) return [];
    return availableOfficers.filter((o) => o.id !== commanderId);
  }, [game, selectedCityId, availableOfficers, commanderId]);

  /** 可作参谋的武将（智力≥85） */
  const availableAdvisors = useMemo(() => {
    return availableSubs.filter((o) => o.stats.intelligence >= 85);
  }, [availableSubs]);

  const [subIds, setSubIds] = useState<number[]>([]);
  const [advisorId, setAdvisorId] = useState<number | ''>('');

  const selectedArmy = myArmies.find((a) => a.id === selectedArmyId) ?? null;

  if (!game) return null;

  const toggleSub = (id: number) => {
    setSubIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleStart = async () => {
    if (selectedCityId == null || !commanderId || !targetNodeId) return;
    const army = await campaignStart({
      commanderId: Number(commanderId),
      subCommanderIds: subIds,
      advisorId: advisorId !== '' ? Number(advisorId) : undefined,
      fromNodeId: selectedCityId,
      targetNodeId: Number(targetNodeId),
      unitType,
      formation,
      troopCount,
      food,
    });
    if (army) {
      setSelectedArmyId(army.id);
      setCommanderId('');
      setSubIds([]);
      setAdvisorId('');
      setTargetNodeId('');
    }
  };

  const handleAssault = async () => {
    if (!selectedArmyId) return;
    await campaignAssault(selectedArmyId);
    setShowBattleReport(true);
  };

  const handleSurrender = async () => {
    if (!selectedArmyId) return;
    await campaignSiegeSurrender(selectedArmyId);
  };

  const currentNode = selectedArmy
    ? game.cities[selectedArmy.currentNodeId]
    : null;

  return (
    <div className="text-[11px] text-stone-300 leading-snug">
      <p className="px-3 py-1 text-[10px] text-stone-500 border-b border-stone-900">
        战役层：编成 → 行军 → 自动战斗结算。先选己方城，再选主将/副将/参谋。
      </p>

      {/* 编成表单 */}
      <div className="px-3 py-2 border-b border-stone-800 space-y-1.5">
        <div className="text-amber-400/80 font-medium">出征编成</div>
        {selectedCityId == null ? (
          <p className="text-stone-600">请先在地图或下方选择己方城</p>
        ) : (
          <>
            <div>
              <label className="text-stone-500">出发城：</label>
              <span className="text-stone-200">{game.cities[selectedCityId]?.name}</span>
              <span className="text-stone-600 ml-1">
                （兵 {game.cities[selectedCityId]?.troops}，粮 {game.cities[selectedCityId]?.food}）
              </span>
            </div>
            <Field label="主将">
              <select
                value={commanderId}
                onChange={(e) => setCommanderId(e.target.value ? Number(e.target.value) : '')}
                className="bg-stone-900 border border-stone-700 rounded px-1 py-0.5 w-full"
              >
                <option value="">选择主将</option>
                {availableOfficers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}（统{o.stats.leadership} 武{o.stats.war}）
                  </option>
                ))}
              </select>
            </Field>
            <Field label="副将">
              <div className="flex flex-wrap gap-1">
                {availableSubs.slice(0, 4).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleSub(o.id)}
                    className={`px-1.5 py-0.5 rounded border text-[10px] ${
                      subIds.includes(o.id)
                        ? 'border-amber-500 bg-amber-950 text-amber-100'
                        : 'border-stone-700 bg-stone-900 text-stone-400'
                    }`}
                  >
                    {o.name}
                  </button>
                ))}
                {availableSubs.length === 0 && (
                  <span className="text-stone-600">无可用副将</span>
                )}
              </div>
            </Field>
            <Field label="参谋（智≥85）">
              <select
                value={advisorId}
                onChange={(e) => setAdvisorId(e.target.value ? Number(e.target.value) : '')}
                className="bg-stone-900 border border-stone-700 rounded px-1 py-0.5 w-full"
              >
                <option value="">无参谋</option>
                {availableAdvisors.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}（智{o.stats.intelligence}）
                  </option>
                ))}
              </select>
            </Field>
            <Field label="目标城">
              <select
                value={targetNodeId}
                onChange={(e) => setTargetNodeId(e.target.value ? Number(e.target.value) : '')}
                className="bg-stone-900 border border-stone-700 rounded px-1 py-0.5 w-full"
              >
                <option value="">选择目标</option>
                {enemyCities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}（兵{c.troops}）
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-1">
              <Field label="兵种">
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                  className="bg-stone-900 border border-stone-700 rounded px-1 py-0.5 w-full"
                >
                  {Object.entries(UNIT_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="阵型">
                <select
                  value={formation}
                  onChange={(e) => setFormation(Number(e.target.value))}
                  className="bg-stone-900 border border-stone-700 rounded px-1 py-0.5 w-full"
                >
                  {[
                    FormationType.WEDGE,
                    FormationType.SQUARE,
                    FormationType.CRANE_WING,
                    FormationType.FISH_SCALE,
                    FormationType.ARROWHEAD,
                    FormationType.CHARGE,
                  ].map((id) => (
                    <option key={id} value={id}>{FORMATION_LABEL[id]}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <Field label="兵力">
                <input
                  type="number"
                  value={troopCount}
                  onChange={(e) => setTroopCount(Number(e.target.value))}
                  className="bg-stone-900 border border-stone-700 rounded px-1 py-0.5 w-full"
                />
              </Field>
              <Field label="携粮">
                <input
                  type="number"
                  value={food}
                  onChange={(e) => setFood(Number(e.target.value))}
                  className="bg-stone-900 border border-stone-700 rounded px-1 py-0.5 w-full"
                />
              </Field>
            </div>
            <button
              type="button"
              disabled={loading || !commanderId || !targetNodeId}
              onClick={() => setConfirm('start')}
              className="w-full px-2 py-1 rounded border border-amber-700 text-amber-100 bg-amber-950/40 hover:bg-amber-900/40 disabled:opacity-40"
            >
              出征
            </button>
          </>
        )}
      </div>

      {/* Army 列表 */}
      <div className="px-3 py-2 border-b border-stone-800">
        <div className="text-amber-400/80 font-medium mb-1">
          我军（{myArmies.length}）
        </div>
        {myArmies.length === 0 ? (
          <p className="text-stone-600">尚无出征军队</p>
        ) : (
          <div className="space-y-1">
            {myArmies.map((a) => {
              const cmd = game.officers[a.commanderId];
              const node = game.cities[a.currentNodeId];
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedArmyId(a.id)}
                  className={`w-full text-left px-2 py-1 rounded border text-[10px] ${
                    a.id === selectedArmyId
                      ? 'border-amber-500 bg-amber-950 text-amber-100'
                      : 'border-stone-800 bg-stone-900/80 text-stone-300 hover:border-stone-600'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-stone-500">{PHASE_LABEL[a.phase] ?? a.phase}</span>
                  </div>
                  <div className="text-stone-500 mt-0.5">
                    {node?.name ?? a.currentNodeId} · 兵{a.troops}/{a.maxTroops} · 粮{a.food} · 士{a.morale}
                    {cmd ? ` · ${cmd.name}` : ''}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 选中 Army 详情与操作 */}
      {selectedArmy && (
        <div className="px-3 py-2 border-b border-stone-800 space-y-1.5">
          <div className="text-amber-400/80 font-medium">{selectedArmy.name} 详情</div>
          <div className="text-stone-400">
            <div>主将：{game.officers[selectedArmy.commanderId]?.name}</div>
            {selectedArmy.subCommanderIds.length > 0 && (
              <div>副将：{selectedArmy.subCommanderIds.map((id) => game.officers[id]?.name).filter(Boolean).join('·')}</div>
            )}
            {selectedArmy.advisorId != null && (
              <div>参谋：{game.officers[selectedArmy.advisorId]?.name}</div>
            )}
            <div>
              兵种：{UNIT_LABEL[selectedArmy.unitType] ?? selectedArmy.unitType} · 阵型：{formationLabel(selectedArmy.formation)}
            </div>
            <div>位置：{currentNode?.name ?? selectedArmy.currentNodeId}</div>
            <div>兵力：{selectedArmy.troops}/{selectedArmy.maxTroops}</div>
            <div>粮草：{selectedArmy.food}/{selectedArmy.maxFood}</div>
            <div>
              士气 {bar(selectedArmy.morale, 100)} {selectedArmy.morale}
            </div>
            <div>
              组织 {bar(selectedArmy.organization, 100)} {selectedArmy.organization}
            </div>
            <div>
              疲劳 {bar(selectedArmy.fatigue, 100)} {selectedArmy.fatigue}
            </div>
            {selectedArmy.siegeState && (
              <div className="mt-1 text-rose-400/80">
                围城第 {selectedArmy.siegeState.siegeTurns} 回合
                · 城墙 {selectedArmy.siegeState.wallDurability}/{selectedArmy.siegeState.maxWallDurability}
              </div>
            )}
            {selectedArmy.structures.length > 0 && (
              <div className="mt-0.5 space-y-0.5">
                {selectedArmy.structures.map((s, i) => (
                  <div key={i} className="text-stone-400 text-[10px]">
                    {structLabel(s.type)}
                    {s.buildProgress < 1 ? (
                      <span className="text-amber-400/80 ml-1">
                        建造中 {Math.floor(s.buildProgress * 100)}%
                      </span>
                    ) : (
                      <span className="text-green-400/80 ml-1">已完工</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="grid grid-cols-2 gap-1 pt-1">
            {selectedArmy.phase === 'sieging' && (
              <>
                <OpBtn label="强攻" hint="自动战斗结算" onClick={() => setConfirm('assault')} disabled={loading} />
                <OpBtn label="劝降" hint="概率投降" onClick={() => setConfirm('surrender')} disabled={loading} />
              </>
            )}
            {selectedArmy.phase === 'engaged' && (
              <OpBtn label="强攻" hint="野战结算" onClick={() => setConfirm('assault')} disabled={loading} />
            )}
            {(selectedArmy.phase === 'marching' || selectedArmy.phase === 'garrison') && (
              <OpBtn
                label="撤退"
                hint="士气-10"
                onClick={() => setConfirm('retreat')}
                disabled={loading}
              />
            )}
            {selectedArmy.advisorId != null && (
              <>
                <OpBtn label="激励" hint="士气+15" onClick={() => void campaignAdvisorAction(selectedArmy.id, 'inspire')} disabled={loading} />
                <OpBtn label="陷阱" hint="智力≥90" onClick={() => void campaignAdvisorAction(selectedArmy.id, 'trap')} disabled={loading} />
                <OpBtn label="休整" hint="疲劳-30" onClick={() => void campaignAdvisorAction(selectedArmy.id, 'retreat')} disabled={loading} />
                <OpBtn label="斥候" hint="视野+1" onClick={() => void campaignAdvisorAction(selectedArmy.id, 'scout')} disabled={loading} />
              </>
            )}
          </div>

          {/* 建造设施 */}
          {(selectedArmy.phase === 'sieging' || selectedArmy.phase === 'garrison') && (
            <div className="pt-1">
              <div className="text-stone-500 mb-0.5">建造设施：</div>
              <div className="flex flex-wrap gap-1">
                {STRUCTURE_OPTIONS.map((s) => {
                  const isBuilding = selectedArmy.structures.some((st) => st.buildProgress < 1);
                  const disabled = loading || isBuilding;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      disabled={disabled}
                      title={`${s.label}：金${s.cost}，${s.turns}回合`}
                      onClick={() => void campaignBuild(selectedArmy.id, s.value)}
                      className="px-1.5 py-0.5 rounded border border-stone-700 bg-stone-900 text-stone-300 text-[10px] hover:bg-stone-800 disabled:opacity-40"
                    >
                      {s.label} ({s.cost}金/{s.turns}t)
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 战斗报告弹窗 */}
      {showBattleReport && lastBattleResult && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowBattleReport(false)}
        >
          <div
            className="bg-stone-950 border border-amber-900 rounded p-4 max-w-md w-full mx-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-amber-400 font-medium text-sm mb-2">
              {lastBattleResult.battlefield} · 自动结算
            </div>
            <div className="space-y-1 text-stone-300">
              <div>结果：<span className={lastBattleResult.winner === 'attacker' ? 'text-emerald-400' : 'text-rose-400'}>
                {lastBattleResult.winner === 'attacker' ? '攻方胜' : '守方胜'}
              </span></div>
              <div>回合数：{lastBattleResult.rounds}</div>
              <div>伤亡：攻 {lastBattleResult.attackerCasualties} / 守 {lastBattleResult.defenderCasualties}</div>
              <div>剩余：攻 {lastBattleResult.attackerRemaining} / 守 {lastBattleResult.defenderRemaining}</div>
              <div>俘获士兵：{lastBattleResult.prisoners}</div>
              {lastBattleResult.spoils.gold > 0 && (
                <div>缴获：金 {lastBattleResult.spoils.gold}，粮 {lastBattleResult.spoils.food}</div>
              )}
              {lastBattleResult.duels.length > 0 && (
                <div className="pt-1 border-t border-stone-800">
                  <div className="text-amber-400/80">单挑记录：</div>
                  {lastBattleResult.duels.map((d, i) => (
                    <div key={i} className="text-stone-400">{d.description}</div>
                  ))}
                </div>
              )}
              {lastBattleResult.events.length > 0 && (
                <div className="pt-1 border-t border-stone-800 max-h-32 overflow-y-auto">
                  <div className="text-amber-400/80">战斗事件：</div>
                  {lastBattleResult.events.map((e, i) => (
                    <div key={i} className="text-stone-500">
                      <span className="text-stone-600">[R{e.round}]</span> {e.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowBattleReport(false)}
              className="mt-3 w-full px-3 py-1.5 rounded border border-amber-700 text-amber-100 bg-amber-950/40 hover:bg-amber-900/40"
            >
              确认
            </button>
          </div>
        </div>
      )}
      <CommandConfirmDialog
        open={confirm != null}
        category="战役"
        command={
          confirm === 'start'
            ? `确认编成出征：${selectedCityId != null ? game.cities[selectedCityId]?.name ?? '未选出发城' : '未选出发城'}→${targetNodeId !== '' ? game.cities[Number(targetNodeId)]?.name ?? '未选目标' : '未选目标'}`
            : confirm === 'assault'
              ? `确认发动强攻：${selectedArmy?.name ?? '未选军队'}`
              : confirm === 'surrender'
                ? `确认劝降守军：${selectedArmy?.name ?? '未选军队'}`
                : `确认撤退：${selectedArmy?.name ?? '未选军队'}`
        }
        summary={
          confirm === 'start'
            ? '兵力、粮草与参战武将将从出发城转入战役军队。'
            : confirm === 'assault'
              ? '将立即进行自动战斗结算，可能造成大量伤亡或改变城池归属。'
              : confirm === 'surrender'
                ? '将立即进行劝降判定；成功会改变目标城归属。'
                : '军队将撤回最近己方节点并损失士气。'
        }
        items={
          confirm === 'start'
            ? [
                { label: '出发城', value: selectedCityId != null ? game.cities[selectedCityId]?.name ?? '—' : '—' },
                { label: '目标城', value: targetNodeId !== '' ? game.cities[Number(targetNodeId)]?.name ?? '—' : '—' },
                { label: '主将', value: commanderId !== '' ? game.officers[Number(commanderId)]?.name ?? '—' : '—' },
                { label: '调拨兵力', value: String(troopCount), tone: 'warning' },
                { label: '携带粮草', value: String(food), tone: 'warning' },
              ]
            : [
                { label: '军队', value: selectedArmy?.name ?? '—' },
                { label: '当前位置', value: currentNode?.name ?? '—' },
                { label: '当前兵力', value: String(selectedArmy?.troops ?? 0) },
                {
                  label: '立即后果',
                  value:
                    confirm === 'assault'
                      ? '自动战斗结算，可能伤亡或易主'
                      : confirm === 'surrender'
                        ? '消费一次劝降判定，成功则目标城易主'
                        : '撤回己方节点，士气 −10',
                  tone: 'warning',
                },
              ]
        }
        loading={loading}
        danger={confirm === 'assault' || confirm === 'start'}
        error={error}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          if (!latest || !confirm) return '战役草稿已失效，请返回修改。';
          if (confirm === 'start') {
            if (selectedCityId == null || commanderId === '' || targetNodeId === '') return '出征编成不完整。';
            const city = latest.cities[selectedCityId];
            const commander = latest.officers[Number(commanderId)];
            const target = latest.cities[Number(targetNodeId)];
            if (!city || city.ruler !== latest.playerFactionId) return '出发城归属已经变化。';
            if (!commander || commander.faction !== latest.playerFactionId || commander.location !== selectedCityId || commander.status !== 'active') {
              return '主将已不在出发城或不再可用。';
            }
            if (!target || target.ruler === latest.playerFactionId) return '目标城已经失效。';
            if (city.troops < troopCount || city.food < food) return `出发城资源已变化（现有兵${city.troops}、粮${city.food}）。`;
            return null;
          }
          const army = latest.campaignArmies.find((item) => item.id === selectedArmyId);
          if (!army || army.factionId !== latest.playerFactionId) return '所选军队已不存在或归属已经变化。';
          if (confirm === 'assault' && army.phase !== 'sieging' && army.phase !== 'engaged') return `军队阶段已变为${PHASE_LABEL[army.phase] ?? army.phase}，不能强攻。`;
          if (confirm === 'surrender' && army.phase !== 'sieging') return `军队阶段已变为${PHASE_LABEL[army.phase] ?? army.phase}，不能劝降。`;
          if (confirm === 'retreat' && army.phase !== 'marching' && army.phase !== 'garrison') return `军队阶段已变为${PHASE_LABEL[army.phase] ?? army.phase}，不能撤退。`;
          return null;
        }}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm === 'start') await handleStart();
          if (confirm === 'assault') await handleAssault();
          if (confirm === 'surrender') await handleSurrender();
          if (confirm === 'retreat' && selectedArmy) await campaignRetreat(selectedArmy.id);
          if (!useGameStore.getState().error) setConfirm(null);
        }}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-stone-500 text-[10px]">{label}</label>
      {children}
    </div>
  );
}

function OpBtn({ label, hint, onClick, disabled }: { label: string; hint?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="px-1.5 py-1 rounded border border-amber-900/60 text-amber-100 bg-stone-900 hover:bg-amber-950/40 disabled:opacity-40 text-[10px]"
      title={hint}
    >
      {label}
    </button>
  );
}

function bar(value: number, max: number): string {
  const pct = Math.max(0, Math.min(1, value / max));
  const filled = Math.round(pct * 8);
  return '█'.repeat(filled) + '░'.repeat(8 - filled);
}

function formationLabel(f: number): string {
  return FORMATION_LABEL[f] ?? `阵${f}`;
}

function structLabel(t: string): string {
  const labels: Record<string, string> = {
    camp: '营寨',
    ram: '冲车',
    ladder: '云梯',
    siege_tower: '井阑',
    catapult: '投石车',
    supply_depot: '粮仓',
    trap: '陷阱',
    watchtower: '瞭望塔',
    palisade: '栅栏',
    trench: '壕沟',
    pontoon_bridge: '浮桥',
  };
  return labels[t] ?? t;
}
