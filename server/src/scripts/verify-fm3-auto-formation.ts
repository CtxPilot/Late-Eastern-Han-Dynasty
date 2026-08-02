// SPDX-License-Identifier: MIT
/**
 * FM-P3 自动战斗阵型贡献验证（唯一量纲 = formations.json tiers[0] 点值）
 *
 * 校验：
 * 1. `autoFormationMods` 纯函数：攻防点值合并战力修正、组织度执行档只缩放正面增量、
 *    负修正原值保留、五部侧击 +10%、未注入中性。mobility/range 点值不参与自动战力。
 * 2. `runAutoBattle` 端到端：注入 catalog 后可运行且阵型贡献真实进入战力（注入 vs 未注入
 *    产生不同 result 或可复现）。
 *
 * 运行: pnpm --filter @leh/server exec tsx src/scripts/verify-fm3-auto-formation.ts
 */
import { FormationType, UnitType, type CampaignSquad } from '@leh/shared';
import { battlefieldInit, campaignStart, createGame, getGame, meleeStart } from '../services/game.js';
import { autoFormationMods, runAutoBattle, setAutoFormationCatalog, squadFlankBonus } from '../engine/campaign.js';
import { getStaticData } from '../data/loader.js';

let failed = 0;
const assert = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failed += 1; console.error(`  ✗ ${msg}`); }
};

// 构造五部 Squad（center 恒在，翼部可选）
function squads(withWing: boolean, withVanguard = false): CampaignSquad[] {
  const list: CampaignSquad[] = [
    { officerId: 1, role: 'main', position: 'center', unitType: UnitType.HEAVY_INFANTRY, troops: 5000, morale: 80 },
  ];
  if (withWing) {
    list.push({ officerId: 2, role: 'sub', position: 'left', unitType: UnitType.HEAVY_INFANTRY, troops: 2500, morale: 75 });
    list.push({ officerId: 3, role: 'sub', position: 'right', unitType: UnitType.HEAVY_INFANTRY, troops: 2500, morale: 75 });
  }
  if (withVanguard) {
    list.push({ officerId: 4, role: 'sub', position: 'vanguard', unitType: UnitType.HEAVY_INFANTRY, troops: 3000, morale: 80 });
  }
  return list;
}

function main() {
  console.log('\n=== FM-P3 自动战斗阵型贡献 ===');

  // 4. 未注入 → 中性（0，无阵型修正）
  setAutoFormationCatalog(null);
  const neutral = autoFormationMods(FormationType.SQUARE, 60, squads(true));
  assert(Math.abs(neutral) < 1e-9, '未注入 catalog → 自动阵型修正中性（0）');

  // 注入真实目录
  setAutoFormationCatalog(getStaticData().formations);

  // 1. 攻防点值合并战力修正（orderly ×1.0 基准，无翼）
  const square = autoFormationMods(FormationType.SQUARE, 60, squads(false));
  const circle = autoFormationMods(FormationType.CIRCLE, 60, squads(false));
  const wedge = autoFormationMods(FormationType.WEDGE, 60, squads(false));
  const arrow = autoFormationMods(FormationType.ARROWHEAD, 60, squads(false));
  assert(Math.abs(square - 0.2) < 1e-9, `方阵(1/1) 自动战力修正 = 0.20（实际 ${square.toFixed(2)}）`);
  assert(Math.abs(circle - 0.1) < 1e-9, `圆阵(-2/3) 自动战力修正 = 0.10（实际 ${circle.toFixed(2)}）`);
  assert(Math.abs(wedge - 0.0) < 1e-9, `锥形(2/-2) 自动战力修正 = 0.00（实际 ${wedge.toFixed(2)}）`);
  assert(Math.abs(arrow - 0.0) < 1e-9, `锋矢(1/-1) 自动战力修正 = 0.00（实际 ${arrow.toFixed(2)}）`);

  // 2. 组织度执行档只缩放正面增量，负修正原值保留
  const wedgeIntact = autoFormationMods(FormationType.WEDGE, 100, squads(false));
  const wedgeBroken = autoFormationMods(FormationType.WEDGE, 10, squads(false));
  assert(Math.abs(wedgeIntact - 0.04) < 1e-9, `组织度严整：锥形 atk 2×1.2→0.24、def -2 原值→-0.20，合计=${wedgeIntact.toFixed(2)}（预期 0.04）`);
  assert(Math.abs(wedgeBroken + 0.2) < 1e-9, `组织度崩散：锥形 atk 归零、def -2 原值保留，合计=${wedgeBroken.toFixed(2)}（预期 -0.20）`);
  const circleBroken = autoFormationMods(FormationType.CIRCLE, 10, squads(false));
  assert(Math.abs(circleBroken + 0.2) < 1e-9, `圆阵崩散：atk -2 原值保留、def 3 归零，合计=${circleBroken.toFixed(2)}（预期 -0.20）`);

  // 3. 五部侧击 +10%
  const squareWing = autoFormationMods(FormationType.SQUARE, 60, squads(true));
  const squareNoWing = autoFormationMods(FormationType.SQUARE, 60, squads(false));
  assert(Math.abs((squareWing - squareNoWing) - 0.1) < 1e-9, `五部侧击：翼部存在 → +10%（差值 ${(squareWing - squareNoWing).toFixed(2)}）`);
  assert(Math.abs(squadFlankBonus(squads(false)) - 0) < 1e-9 && Math.abs(squadFlankBonus(squads(true)) - 0.1) < 1e-9, 'squadFlankBonus：无翼 0 / 有翼 0.1');

  // 5. runAutoBattle 端到端：注入生效（固定 rng，注入 vs 未注入战力不同）
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
    id: `${started.army.id}-autoform-def`,
    name: '阵型自动守军',
    factionId: defenderFactionId,
    commanderId: Object.values(getGame().officers).find((officer) => officer.faction === defenderFactionId)!.id,
  };
  getGame().campaignArmies.push(defender);
  battlefieldInit(target, from.id);
  meleeStart(started.army.id, defender.id);
  const atkArmy = getGame().campaignArmies.find((a) => a.id === started.army.id)!;
  const defArmy = getGame().campaignArmies.find((a) => a.id === defender.id)!;

  const directInjected = runAutoBattle(getGame(), atkArmy, defArmy, null, () => 0.5);
  assert(directInjected.attackerRemaining >= 0 && directInjected.defenderRemaining >= 0
    && (directInjected.winner === 'attacker' || directInjected.winner === 'defender'),
    '注入 catalog 后 runAutoBattle 可运行（含阵型贡献，无异常）');

  setAutoFormationCatalog(null);
  const directNeutral = runAutoBattle(getGame(), atkArmy, defArmy, null, () => 0.5);
  assert(JSON.stringify(directInjected) !== JSON.stringify(directNeutral),
    '自动战斗阵型贡献真实进入战力（注入 vs 未注入结果不同）');

  setAutoFormationCatalog(getStaticData().formations);
  const directRepro = runAutoBattle(getGame(), atkArmy, defArmy, null, () => 0.5);
  assert(JSON.stringify(directInjected) === JSON.stringify(directRepro), '固定 rng 下阵型贡献可复现（确定性）');

  console.log(failed === 0 ? '\n=== 全部断言通过 ✓ ===' : `\n=== ${failed} 失败 ===`);
  // 恢复注入状态避免污染其他脚本进程内全局
  setAutoFormationCatalog(null);
  if (failed > 0) process.exit(1);
}

main();
