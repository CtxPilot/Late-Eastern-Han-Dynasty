// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S21 四层串联引擎链冒烟（Session 338）
 * 行政出征 → 战场地图 → 三种局部结算模式 → Army 回写
 * （演出级 W6~W9 UI 打磨后置；本脚本验收权威状态机闭环）
 *
 * 运行: pnpm verify-s21-layers
 */
import { FormationType, UnitType, pushScene, replaceStack, screenOf, type MeleeEntryMode } from '@leh/shared';
import {
  battlefieldInit,
  campaignStart,
  createGame,
  exitBattle,
  getBattle,
  getGame,
  meleeRound,
  meleeSelectMode,
  meleeStart,
} from '../services/game.js';

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

function prepareEncounter(): { attackerId: string; defenderId: string; targetId: number } {
  createGame(1, 2);
  const state = getGame();
  const from = Object.values(state.cities).find((city) => {
    const node = state.campaignNodes.find((item) => item.id === city.id);
    return city.ruler === state.playerFactionId && city.officers.length > 0
      && city.troops >= 1000 && city.food >= 500
      && node?.adjacentNodeIds.some((id) => state.cities[id]?.ruler !== state.playerFactionId);
  });
  if (!from) throw new Error('缺少前线城市');
  const target = state.campaignNodes.find((node) => node.id === from.id)!.adjacentNodeIds
    .find((id) => state.cities[id]?.ruler !== state.playerFactionId)!;
  const started = campaignStart({
    commanderId: from.officers[0]!,
    subCommanderIds: [],
    fromNodeId: from.id,
    targetNodeId: target,
    unitType: UnitType.LIGHT_INFANTRY,
    formation: FormationType.SQUARE,
    troopCount: 1000,
    food: 500,
  });
  const defenderFactionId = state.cities[target]!.ruler!;
  const defender = {
    ...started.army,
    id: `${started.army.id}-s21-def`,
    name: 'S21 守军',
    factionId: defenderFactionId,
    commanderId: Object.values(getGame().officers).find((officer) => officer.faction === defenderFactionId)!.id,
  };
  getGame().campaignArmies.push(defender);
  battlefieldInit(target, from.id);
  meleeStart(started.army.id, defender.id);
  return { attackerId: started.army.id, defenderId: defender.id, targetId: target };
}

console.log('S21 four-layer chain verify');

// 场景栈语义：world → battlefield → battle → 回 world
let stack = replaceStack({ scene: 'world' });
assert(screenOf(stack) === 'world', 'L1 行政大地图 screen=world');
stack = pushScene(stack, { scene: 'battlefield', battlefieldId: 'bf-demo' });
assert(screenOf(stack) === 'battlefield', 'L2 郡域/战场 screen=battlefield');
stack = pushScene(stack, { scene: 'battle', battleId: 'b1' });
assert(screenOf(stack) === 'battle', 'L3 六角微操 screen=battle');
stack = pushScene(stack, { scene: 'duel' });
assert(screenOf(stack) === 'duel', 'L4 单挑 screen=duel');

for (const mode of ['auto', 'standard', 'tactical'] as const satisfies readonly MeleeEntryMode[]) {
  const ids = prepareEncounter();
  assert(!!getGame().activeBattlefield, `${mode}: L2 战场地图已进入`);
  assert(!!getGame().activeMelee, `${mode}: 局部交战 MeleeState 已创建`);
  const selected = meleeSelectMode(mode);
  assert(selected.melee.entryMode === mode, `${mode}: 唯一权威模式写入`);

  if (mode === 'standard') {
    while (getGame().activeMelee?.phase === 'active') meleeRound('normal_attack');
  } else if (mode === 'tactical') {
    const battle = getBattle();
    assert(!!battle, 'tactical: 六角 BattleState 已创建');
    battle!.phase = 'over';
    battle!.winner = 'attacker';
    const atk = battle!.units.find((unit) => unit.side === 'attacker');
    const def = battle!.units.find((unit) => unit.side === 'defender');
    if (atk) atk.troopCount = 700;
    if (def) {
      def.troopCount = 0;
      def.isDestroyed = true;
    }
    exitBattle();
  }

  const resolved = getGame().activeMelee!;
  assert(resolved.phase !== 'active' && resolved.settlementApplied, `${mode}: 结算回写完成`);
  assert(
    getGame().campaignArmies.some((a) => a.id === ids.attackerId),
    `${mode}: 攻方 Army 仍在权威列表`,
  );
}

console.log(`结果: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
