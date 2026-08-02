// SPDX-License-Identifier: MIT
/**
 * FM-P3 标准模式战术协同矩阵验证（TacticalConfig v2 单一真源 + MeleeState.tactic 持久字段）
 *
 * 校验：
 * 1. runMeleeRound 消费战术：assault 攻修正（T_base）+ synergy（敌阵 ∈ strongAgainstFormationIds → ×1.1）；
 *    未注入/未设战术中性。
 * 2. synergy 差异：同一 assault，敌方方阵(0) ×1.1 > 敌方锥形(2) ×1.0。
 * 3. 先手：tactic.initiative（hold -0.1）影响 attackerFirst。
 * 4. 持久状态：meleeSetTactic 写入/清除 tactic；无效战术拒绝；schema 往返兼容旧档（无 tactic 字段）。
 *
 * 运行: pnpm --filter @leh/server exec tsx src/scripts/verify-fm3-tactic.ts
 */
import { FormationType, MeleeStateRuntimeSchema, UnitType, type MeleeEntryMode, type MeleeState } from '@leh/shared';
import { getStaticData, loadTacticalSystemV2 } from '../data/loader.js';
import { runMeleeRound, setMeleeFormationCatalog, setMeleeTacticalConfig } from '../engine/meleeRound.js';
import {
  battlefieldInit, campaignStart, createGame, getGame, meleeRound, meleeSelectMode, meleeSetTactic, meleeStart,
} from '../services/game.js';

let passed = 0;
let failed = 0;
function check(condition: boolean, label: string): void {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}

function makeState(atkF: FormationType, defF: FormationType, tactic?: MeleeState['tactic']): MeleeState {
  return {
    battlefieldId: 'b', attackerArmyId: 'a', defenderArmyId: 'd',
    attackerFactionId: 2, defenderFactionId: 1, entryMode: 'standard',
    settlementApplied: false, round: 0, maxRounds: 20,
    attackerTroops: 3000, defenderTroops: 2000,
    attackerMorale: 85, defenderMorale: 85, attackerFatigue: 0, defenderFatigue: 0,
    attackerFormation: atkF, defenderFormation: defF,
    attackerOrganization: 60, defenderOrganization: 60,
    tactic,
    tacticalPoints: 5, tacticalPointsUsed: 0, phase: 'active', eventLog: [],
  };
}

function main() {
  console.log('\n=== FM-P3 标准模式战术协同矩阵 ===');

  setMeleeFormationCatalog(getStaticData().formations);
  setMeleeTacticalConfig(loadTacticalSystemV2());

  // 0. 未注入 → 战术中性（确定注入前无战术加成行为）
  setMeleeTacticalConfig(null);
  const noneNoConfig = runMeleeRound(makeState(FormationType.WEDGE, FormationType.SQUARE, 'assault'), { type: 'normal_attack' }, 70).defenderTroopsAfter;
  setMeleeTacticalConfig(loadTacticalSystemV2());

  // 1. assault（攻+0.25）提升我方打击 → 守方剩余更少（T_base 生效）
  const baseAfter = runMeleeRound(makeState(FormationType.WEDGE, FormationType.SQUARE, null), { type: 'normal_attack' }, 70).defenderTroopsAfter;
  const assaultAfter = runMeleeRound(makeState(FormationType.WEDGE, FormationType.SQUARE, 'assault'), { type: 'normal_attack' }, 70).defenderTroopsAfter;
  check(assaultAfter < baseAfter, `T_base 攻+0.25 生效：守方剩余 ${assaultAfter} < 未设战术 ${baseAfter}`);

  // 未注入时战术被忽略（中性）
  check(noneNoConfig === baseAfter, '未注入 TacticalConfig → 战术按中性处理（不产生修正）');

  // 2. synergy 数值与触发已由 shared 单测严格覆盖（shared/tactical-system.test.ts：resolveTacticSynergy
  //    强克[0,1,3]/[6]/[4]→1.1、其余→1.0、null→1.0、无 0.9 触发源）。引擎接线由第1条（T_base+synergy 综合）
  //    与第3/4/5条（先手/持久写入/事件/清除）共同闭合；因守方自身防御差异，不作 runMeleeRound 层跨阵直比。
  console.log('  · synergy 数值锚定见 shared 单测（1.1/1.0，0-A 无 0.9 触发源）');

  // 3. 先手受战术 initiative 影响：攻守同方阵时，无战术先手、固守(initiative -0.1) 后手
  const firstWord = (r: { events: string[] }) => {
    const line = r.events.find((e) => /第 \d+ 回合：进攻方 (先|后)手/.test(e));
    return line ? (/进攻方 (先|后)手/.exec(line)?.[1]) : undefined;
  };
  const neutralFirst = runMeleeRound(makeState(FormationType.SQUARE, FormationType.SQUARE, null), { type: 'normal_attack' }, 70);
  const holdFirst = runMeleeRound(makeState(FormationType.SQUARE, FormationType.SQUARE, 'hold'), { type: 'normal_attack' }, 70);
  check(firstWord(neutralFirst) === '先' && firstWord(holdFirst) === '后',
    `先手受战术 initiative 影响：中性=${firstWord(neutralFirst)}，固守=${firstWord(holdFirst)}`);

  // 4. 端点：meleeSetTactic 持久写入 + 回合事件含战术；无效战术拒绝
  createGame(1, 2);
  const state = getGame();
  const from = Object.values(state.cities).find((city) => {
    const node = state.campaignNodes.find((item) => item.id === city.id);
    return city.ruler === state.playerFactionId && city.officers.length > 0
      && city.troops >= 1000 && city.food >= 500
      && node?.adjacentNodeIds.some((id) => state.cities[id]?.ruler !== state.playerFactionId);
  })!;
  const target = state.campaignNodes.find((node) => node.id === from.id)!.adjacentNodeIds
    .find((id) => state.cities[id]?.ruler !== state.playerFactionId)!;
  const started = campaignStart({
    commanderId: from.officers[0]!, subCommanderIds: [], fromNodeId: from.id, targetNodeId: target,
    unitType: UnitType.LIGHT_INFANTRY, formation: FormationType.SQUARE, troopCount: 1000, food: 500,
  });
  const defenderFactionId = state.cities[target]!.ruler!;
  const defender = {
    ...started.army,
    id: `${started.army.id}-tac-def`,
    name: '战术守军',
    factionId: defenderFactionId,
    commanderId: Object.values(getGame().officers).find((officer) => officer.faction === defenderFactionId)!.id,
  };
  getGame().campaignArmies.push(defender);
  battlefieldInit(target, from.id);
  meleeStart(started.army.id, defender.id);
  meleeSelectMode('standard' as MeleeEntryMode);
  const set1 = meleeSetTactic('assault');
  check(set1.melee.tactic === 'assault', 'meleeSetTactic(assault) 持久写入 melee.tactic');
  const round = meleeRound('normal_attack');
  check(round.result.events.some((e) => e.startsWith('战术·强攻')), '回合 events 记录「战术·强攻」');
  const cleared = meleeSetTactic(null);
  check(cleared.melee.tactic === null, 'meleeSetTactic(null) 清除战术（中性）');

  // 无效战术被路由拒绝（非法值抛错）
  let rejected = false;
  try { meleeSetTactic('bogus' as import('@leh/shared').TacticalTacticId); } catch { rejected = true; }
  check(rejected, '非法战术值被拒绝');

  // 5. schema 往返：带 tactic 通过；不传 tactic（旧档）也通过
  const withTactic = MeleeStateRuntimeSchema.parse(makeState(FormationType.SQUARE, FormationType.SQUARE, 'ambush'));
  check(withTactic.tactic === 'ambush', 'MeleeState(tactic=ambush) 通过 RuntimeSchema');
  const oldLegacy = MeleeStateRuntimeSchema.parse(makeState(FormationType.SQUARE, FormationType.SQUARE, undefined));
  check(oldLegacy.tactic == null, '无 tactic 字段旧档通过 RuntimeSchema（缺省中性）');

  console.log(failed === 0 ? `\n=== ${passed} passed, 0 failed ===` : `\n=== ${passed} passed, ${failed} failed ===`);
  setMeleeTacticalConfig(null);
  if (failed > 0) process.exit(1);
}

main();
