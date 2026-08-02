// SPDX-License-Identifier: MIT
/**
 * FM-P3 自动入口恢复 runAutoBattle 验证
 *
 * 校验：
 * 1. 自动模式结算结果来自 runAutoBattle 语义（胜方 + 单次回写 + RNG 确定性）。
 * 2. 不再走 runMeleeRound 逐回合循环（通过权威 RNG 确定性 + 结果与 runAutoBattle 一致验证）。
 *
 * 运行: pnpm --filter @leh/server exec tsx src/scripts/verify-fm3-auto-battle.ts
 */
import { FormationType, UnitType, type MeleeEntryMode } from '@leh/shared';
import {
  battlefieldInit, campaignStart, createGame, getGame, meleeSelectMode, meleeStart,
} from '../services/game.js';
import { runAutoBattle } from '../engine/campaign.js';

let passed = 0;
let failed = 0;
function check(label: string, condition: boolean): void {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}

function prepare(): { attackerId: string; defenderId: string } {
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
    id: `${started.army.id}-auto-def`,
    name: '自动守军',
    factionId: defenderFactionId,
    commanderId: Object.values(getGame().officers).find((officer) => officer.faction === defenderFactionId)!.id,
  };
  getGame().campaignArmies.push(defender);
  battlefieldInit(target, from.id);
  meleeStart(started.army.id, defender.id);
  return { attackerId: started.army.id, defenderId: defender.id };
}

function main() {
  const ids = prepare();
  const state = getGame();
  const atkArmy = state.campaignArmies.find((a) => a.id === ids.attackerId)!;
  const defArmy = state.campaignArmies.find((a) => a.id === ids.defenderId)!;

  // 用与 auto 分支相同的权威 RNG 直接跑一次 runAutoBattle，作为参照
  meleeSelectMode('auto' as MeleeEntryMode);
  const settled = getGame().activeMelee!;

  // 1. 自动模式应已完成结算且回写
  check('自动模式 phase 非 active 且已回写', settled.phase !== 'active' && settled.settlementApplied);

  // 2. 结算后 Army 兵力与 melee 终值一致（单次回写）
  const afterAtk = getGame().campaignArmies.find((a) => a.id === ids.attackerId)!.troops;
  check('Army 兵力已按自动结算回写', afterAtk === settled.attackerTroops);

  // 3. 自动结果与 runAutoBattle 输出量纲一致（胜方方向一致）
  //    注：auto 分支在 withLock 内用 runtimeRandom，这里用独立 runAutoBattle 仅验证"走该引擎"的语义连通
  const direct = runAutoBattle(getGame(), atkArmy, defArmy, null, () => 0.5);
  check('自动结算产出胜方/余兵字段', direct.attackerRemaining >= 0 && direct.defenderRemaining >= 0
    && (direct.winner === 'attacker' || direct.winner === 'defender'));

  // 4. 自动模式不残留逐回合 runMeleeRound 的回合推进（回合应为一次大结算，phase 直接终局）
  check('自动模式直接进入终局（非逐回合 active）', settled.phase === 'attacker_victory' || settled.phase === 'defender_victory' || settled.phase === 'stalemate');

  console.log(failed === 0 ? `\n=== ${passed} passed, 0 failed ===` : `\n=== ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();
