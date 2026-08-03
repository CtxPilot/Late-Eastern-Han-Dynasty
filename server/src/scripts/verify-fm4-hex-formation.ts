// SPDX-License-Identifier: MIT

/** FM-P4 六角战中变阵状态机验证。 */
import { FormationType, GameStateBattleSchema, UnitType, type MeleeEntryMode } from '@leh/shared';
import {
  battleChangeFormation,
  battleEnemyPhase,
  battleFinishPlayer,
  battlefieldInit,
  campaignStart,
  createGame,
  getBattle,
  getGame,
  meleeSelectMode,
  meleeStart,
} from '../services/game.js';

let passed = 0;
let failed = 0;
function check(condition: boolean, label: string): void {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}

function prepare(): { mainId: string; targetFormation: FormationType } {
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
    unitType: UnitType.LIGHT_INFANTRY, formation: FormationType.WEDGE, troopCount: 1000, food: 500,
  });
  const defenderFactionId = state.cities[target]!.ruler!;
  const defender = {
    ...started.army,
    id: `${started.army.id}-fm4-def`,
    name: '六角守军',
    factionId: defenderFactionId,
    commanderId: Object.values(getGame().officers).find((officer) => officer.faction === defenderFactionId)!.id,
  };
  getGame().campaignArmies.push(defender);
  battlefieldInit(target, from.id);
  meleeStart(started.army.id, defender.id);
  meleeSelectMode('tactical' as MeleeEntryMode);
  const battle = getBattle();
  if (!battle) throw new Error('六角战斗未创建');
  const main = battle.units.find((unit) => unit.side === 'attacker' && unit.commanderId === started.army.commanderId);
  if (!main) throw new Error('六角主将单位未创建');
  return { mainId: main.id, targetFormation: FormationType.SQUARE };
}

console.log('\n=== FM-P4 六角战中变阵状态机 ===');
const { mainId, targetFormation } = prepare();
const before = getBattle()!;
const changed = battleChangeFormation(mainId, targetFormation);
check(changed.phase === 'player', '变阵不调用白刃回合，仍停留在六角玩家阶段');
check(changed.tacticalPoints === (before.tacticalPoints ?? 5) - 1, '变阵消耗 1 TP');
check(changed.tacticalPointsUsed === 1, '本回合变阵门禁写入');
const formationReport = changed.log.at(-1)?.explanation;
check(formationReport?.kind === 'formation' && formationReport.tacticalPointsBefore === (before.tacticalPoints ?? 5) && formationReport.tacticalPointsAfter === (before.tacticalPoints ?? 5) - 1, '战报记录变阵 TP 前后值');
check(formationReport?.kind === 'formation' && formationReport.formationBefore === before.units.find((unit) => unit.id === mainId)?.formation && formationReport.formationAfter === targetFormation, '战报记录变阵前后阵型');
check(changed.units.filter((unit) => unit.side === 'attacker').every((unit) => unit.formation === targetFormation), '攻方多 unit 阵型同步切换');
check(changed.units.find((unit) => unit.id === mainId)?.hasActed === true, '变阵后主将行动结束');

// FM-P4 存档边界：结构化战报与变阵资源必须能经 JSON 往返，不能只在内存对象中成立。
const serializedSlice = JSON.parse(JSON.stringify({
  activeBattles: getGame().activeBattles,
  activeBattlefield: getGame().activeBattlefield,
  activeMelee: getGame().activeMelee,
}));
const restoredSlice = GameStateBattleSchema.parse(serializedSlice);
const restoredBattle = restoredSlice.activeBattles.find((battle) => battle.id === changed.id);
const restoredReport = restoredBattle?.log.at(-1)?.explanation;
check(restoredBattle?.tacticalPoints === changed.tacticalPoints, '变阵后 TP 经 JSON 存档往返保持');
check(restoredReport?.formationBefore === before.units.find((unit) => unit.id === mainId)?.formation && restoredReport?.formationAfter === targetFormation, '变阵前后阵型解释经 JSON 存档往返保持');
check(restoredReport?.tacticalPointsBefore === formationReport?.tacticalPointsBefore && restoredReport?.tacticalPointsAfter === formationReport?.tacticalPointsAfter, '战报 TP 解释经 JSON 存档往返保持');

let duplicateRejected = false;
try { battleChangeFormation(mainId, FormationType.WEDGE); } catch { duplicateRejected = true; }
check(duplicateRejected, '同回合第二次变阵被拒绝');

battleFinishPlayer();
const next = battleEnemyPhase();
check(next.turn === before.turn + 1, '完成敌军阶段后进入下一回合');
check(next.phase === 'player' || next.phase === 'over', '敌军阶段返回玩家或终局');
if (next.phase === 'player') check(next.tacticalPointsUsed === 0, '新回合重置变阵门禁');

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
