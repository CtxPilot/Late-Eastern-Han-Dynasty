// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { FormationType, UnitType, type MeleeEntryMode } from '@leh/shared';
import {
  battlefieldInit, campaignStart, createGame, exitBattle, getBattle, getGame,
  meleeRound, meleeSelectMode, meleeStart,
} from '../services/game.js';

let passed = 0;
let failed = 0;
function check(label: string, condition: boolean): void {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}

function prepareEncounter(): { attackerId: string; defenderId: string } {
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
    commanderId: from.officers[0]!, subCommanderIds: [], fromNodeId: from.id, targetNodeId: target,
    unitType: UnitType.LIGHT_INFANTRY, formation: FormationType.SQUARE, troopCount: 1000, food: 500,
  });
  const defenderFactionId = state.cities[target]!.ruler!;
  const defender = {
    ...started.army,
    id: `${started.army.id}-r4-def`,
    name: 'R4 守军',
    factionId: defenderFactionId,
    commanderId: Object.values(getGame().officers).find((officer) => officer.faction === defenderFactionId)!.id,
  };
  getGame().campaignArmies.push(defender);
  battlefieldInit(target, from.id);
  meleeStart(started.army.id, defender.id);
  return { attackerId: started.army.id, defenderId: defender.id };
}

console.log('\n=== R4 三种交战结算模式 ===');

for (const mode of ['auto', 'standard', 'tactical'] as const satisfies readonly MeleeEntryMode[]) {
  const ids = prepareEncounter();
  const beforeAtk = getGame().campaignArmies.find((army) => army.id === ids.attackerId)!.troops;
  const selected = meleeSelectMode(mode);
  check(`${mode} 写入唯一权威模式`, selected.melee.entryMode === mode);

  if (mode === 'standard') {
    while (getGame().activeMelee?.phase === 'active') meleeRound('normal_attack');
  } else if (mode === 'tactical') {
    const battle = getBattle();
    if (!battle) throw new Error('六角微操未创建 BattleState');
    battle.phase = 'over';
    battle.winner = 'attacker';
    battle.units.find((unit) => unit.side === 'attacker')!.troopCount = 777;
    battle.units.find((unit) => unit.side === 'defender')!.troopCount = 0;
    battle.units.find((unit) => unit.side === 'defender')!.isDestroyed = true;
    exitBattle();
  }

  const resolved = getGame().activeMelee!;
  const afterAtk = getGame().campaignArmies.find((army) => army.id === ids.attackerId)!.troops;
  check(`${mode} 恰好完成一次结算回写`, resolved.phase !== 'active' && resolved.settlementApplied && afterAtk === resolved.attackerTroops);
  const repeat = meleeSelectMode(mode);
  check(`${mode} 重复提交幂等`, repeat.melee.settlementApplied
    && getGame().campaignArmies.find((army) => army.id === ids.attackerId)!.troops === afterAtk
    && beforeAtk >= afterAtk);
}

const ids = prepareEncounter();
meleeSelectMode('standard');
let changeRejected = false;
try { meleeSelectMode('auto'); } catch { changeRejected = true; }
check('选定模式后拒绝改选', changeRejected && getGame().activeMelee?.entryMode === 'standard'
  && getGame().campaignArmies.some((army) => army.id === ids.attackerId));

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
