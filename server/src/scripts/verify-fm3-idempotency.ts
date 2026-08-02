// SPDX-License-Identifier: MIT
/**
 * FM-P3 变阵/回合动作级幂等验证（§7.5 commandId + expectedRound）
 *
 * 运行: pnpm --filter @leh/server exec tsx src/scripts/verify-fm3-idempotency.ts
 */
import { FormationType, UnitType, type MeleeEntryMode } from '@leh/shared';
import {
  battlefieldInit, campaignStart, createGame, getGame, meleeRound, meleeSelectMode, meleeStart,
} from '../services/game.js';

let passed = 0;
let failed = 0;
function check(label: string, condition: boolean): void {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}

function prepareStandard(): { attackerId: string; defenderId: string } {
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
    id: `${started.army.id}-idem-def`,
    name: '幂等守军',
    factionId: defenderFactionId,
    commanderId: Object.values(getGame().officers).find((officer) => officer.faction === defenderFactionId)!.id,
  };
  getGame().campaignArmies.push(defender);
  battlefieldInit(target, from.id);
  meleeStart(started.army.id, defender.id);
  meleeSelectMode('standard' as MeleeEntryMode);
  return { attackerId: started.army.id, defenderId: defender.id };
}

function main() {
  // 用例 1：同 commandId + 同 expectedRound 重试 → 返回首次结果，不二次扣 TP/推进
  prepareStandard();
  const roundBefore = getGame().activeMelee!.round;
  meleeRound('change_formation', FormationType.WEDGE, 'cmd-a', roundBefore);
  const tpAfterFirst = getGame().activeMelee!.tacticalPoints;
  const roundAfterFirst = getGame().activeMelee!.round;
  const retry = meleeRound('change_formation', FormationType.WEDGE, 'cmd-a', roundBefore);
  check('同 commandId + 同 expectedRound 重试返回首次结果',
    retry.melee.tacticalPoints === tpAfterFirst && retry.melee.round === roundAfterFirst);
  check('重试不二次扣 TP', getGame().activeMelee!.tacticalPoints === tpAfterFirst);
  check('重试不二次推进回合', getGame().activeMelee!.round === roundAfterFirst);

  // 用例 2：同 commandId 但 expectedRound 过期 → 拒绝
  prepareStandard();
  const r0 = getGame().activeMelee!.round;
  meleeRound('normal_attack', undefined, 'cmd-b', r0);
  const rejected = (() => {
    try { meleeRound('normal_attack', undefined, 'cmd-b', r0 + 99); return false; }
    catch { return true; }
  })();
  check('同 commandId 但 expectedRound 过期 → 拒绝', rejected);

  // 用例 3：不同 commandId → 各自执行（正常推进）
  prepareStandard();
  const r1 = getGame().activeMelee!.round;
  const a1 = meleeRound('change_formation', FormationType.CIRCLE, 'cmd-c', r1);
  const a2 = meleeRound('normal_attack', undefined, 'cmd-d', a1.melee.round);
  check('不同 commandId 各自正常推进', a2.melee.round === a1.melee.round + 1);

  console.log(failed === 0 ? `\n=== ${passed} passed, 0 failed ===` : `\n=== ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();
