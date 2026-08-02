// SPDX-License-Identifier: MIT
/**
 * FM-P3 六角战斗阵型贡献验证（唯一量纲 = formations.json tiers[0] 点值）
 *
 * 校验：
 * 1. `hexFormationMods` 纯函数：攻/防点值按六角模式专用投影换算，负修正原值保留，未注入中性。
 * 2. `calcDamage` 层面：formationAtk 增大进攻方伤害、formationDef 增大守方减伤（方向性）。
 * 3. `attackUnit` 端到端：注入 vs 未注入经同一固定 rng 产生不同战损（阵型贡献真实进入六角伤害），
 *    且固定 rng 可复现（确定性）。
 *
 * 运行: pnpm --filter @leh/server exec tsx src/scripts/verify-fm3-hex-formation.ts
 */
import { FormationType, UnitType, type MeleeEntryMode } from '@leh/shared';
import { getStaticData } from '../data/loader.js';
import { calcDamage, type DamageInput } from '../battle/damage.js';
import { HEX_FORM_ATK_GAIN, HEX_FORM_DEF_GAIN, hexFormationMods, setHexFormationCatalog } from '../battle/hex-formation.js';
import { attackUnit } from '../engine/battle.js';
import {
  battlefieldInit, campaignStart, createGame, getGame, meleeSelectMode, meleeStart,
} from '../services/game.js';

let passed = 0;
let failed = 0;
function check(condition: boolean, label: string): void {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}

function makeInput(over: Partial<DamageInput>): DamageInput {
  return {
    unitAttack: 8, unitDefense: 6, officerWar: 70, officerLeadership: 70,
    troops: 5000, maxTroops: 5000, morale: 85, terrain: 'plain' as DamageInput['terrain'], ...over,
  };
}

function prepareTactical(): void {
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
  const subCommanderId = from.officers.find((id) => id !== from.officers[0]);
  const started = campaignStart({
    commanderId: from.officers[0]!, subCommanderIds: subCommanderId ? [subCommanderId] : [], fromNodeId: from.id, targetNodeId: target,
    unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.WEDGE, troopCount: 1000, food: 500,
  });
  const defenderFactionId = state.cities[target]!.ruler!;
  const defenderArmy = {
    ...started.army,
    id: `${started.army.id}-hex-def`,
    name: '六角守军',
    factionId: defenderFactionId,
    commanderId: Object.values(getGame().officers).find((officer) => officer.faction === defenderFactionId)!.id,
    subCommanderIds: [],
    squads: [{
      ...started.army.squads[0],
      officerId: Object.values(getGame().officers).find((officer) => officer.faction === defenderFactionId)!.id,
      role: 'main' as const,
      position: 'center' as const,
    }],
  };
  getGame().campaignArmies.push(defenderArmy);
  battlefieldInit(target, from.id);
  meleeStart(started.army.id, defenderArmy.id);
  meleeSelectMode('tactical' as MeleeEntryMode);
  // 把守方从远处 (16,11) 挪到攻方 (2,3) 正东邻接 (3,3)，让 sword（距离1·正前）可攻击
  const battle = getGame().activeBattles.find((b) => b.id === getGame().activeMelee!.tacticalBattleId)!;
  check(battle.units.filter((u) => u.side === 'attacker').length === started.army.squads.length,
    `六角创建按 Squad 生成单位（${started.army.squads.length}）`);
  const attackerUnits = battle.units.filter((u) => u.side === 'attacker');
  check(new Set(attackerUnits.map((u) => `${u.position.q},${u.position.r}`)).size === attackerUnits.length,
    '同方多 unit 初始站位不重叠');
  const attacker = battle.units.find((u) => u.side === 'attacker')!;
  const defenderUnit = battle.units.find((u) => u.side === 'defender')!;
  defenderUnit.position = { q: attacker.position.q + 1, r: attacker.position.r };
}

function attackOnce(rng: () => number): number {
  const battle = getGame().activeBattles.find((b) => b.id === getGame().activeMelee!.tacticalBattleId)!;
  const attacker = battle.units.find((u) => u.side === 'attacker')!;
  const defender = battle.units.find((u) => u.side === 'defender')!;
  const next = attackUnit({ ...battle }, attacker.id, defender.id, getGame(), rng);
  return next.units.find((u) => u.id === defender.id)?.troopCount ?? 0;
}

function main() {
  console.log('\n=== FM-P3 六角战斗阵型贡献 ===');

  // 4. 未注入 → 中性
  setHexFormationCatalog(null);
  const neutral = hexFormationMods(FormationType.WEDGE);
  check(Math.abs(neutral.atk) < 1e-9 && Math.abs(neutral.def) < 1e-9, '未注入 catalog → 六角阵型修正中性（0）');

  setHexFormationCatalog(getStaticData().formations);

  // 1. 点值 → 六角模式专用投影
  const square = hexFormationMods(FormationType.SQUARE);
  const circle = hexFormationMods(FormationType.CIRCLE);
  const wedge = hexFormationMods(FormationType.WEDGE);
  const goose = hexFormationMods(FormationType.GOOSE);
  const crane = hexFormationMods(FormationType.CRANE_WING);
  const arrow = hexFormationMods(FormationType.ARROWHEAD);
  check(Math.abs(HEX_FORM_ATK_GAIN - 2) < 1e-9 && Math.abs(HEX_FORM_DEF_GAIN - 2.5) < 1e-9, '六角投影系数锚定：ATK×2 / DEF×2.5');
  check(Math.abs(square.atk - 2) < 1e-9 && Math.abs(square.def - 2.5) < 1e-9,
    `方阵(1/1) → atk=${square.atk} def=${square.def}（预期 2 / 2.5）`);
  check(Math.abs(circle.atk + 4) < 1e-9 && Math.abs(circle.def - 7.5) < 1e-9,
    `圆阵(-2/3) → atk=${circle.atk} def=${circle.def}（预期 -4 / 7.5，防御特化）`);
  check(Math.abs(wedge.atk - 4) < 1e-9 && Math.abs(wedge.def + 5) < 1e-9,
    `锥形(2/-2) → atk=${wedge.atk} def=${wedge.def}（预期 4 / -5，强攻弱防）`);
  check(Math.abs(arrow.atk - 2) < 1e-9 && Math.abs(arrow.def + 2.5) < 1e-9,
    `锋矢(1/-1) → atk=${arrow.atk} def=${arrow.def}（预期 2 / -2.5）`);
  check(goose.atk === 0 && crane.atk === 0, `雁行/鹤翼攻无修正（atk=0，防 ${goose.def}/${crane.def}）`);

  // 2. calcDamage 方向性：formationAtk 提升进攻、formationDef 提升守方减伤
  const base = calcDamage(makeInput({}), makeInput({}), () => 0.5);
  const atkUp = calcDamage(makeInput({ formationAtk: 4 }), makeInput({}), () => 0.5);
  const defUp = calcDamage(makeInput({}), makeInput({ formationDef: 7.5 }), () => 0.5);
  check(atkUp > base, `formationAtk>0 提升进攻伤害（${base} → ${atkUp}）`);
  check(defUp < base, `formationDef>0 提升守方减伤（${base} → ${defUp}）`);

  // 3. attackUnit 端到端：注入（锥形攻方 +4 攻）后守方剩余兵更少，且固定 rng 可复现
  prepareTactical();
  setHexFormationCatalog(getStaticData().formations);
  const withCatalog = attackOnce(() => 0.5);
  setHexFormationCatalog(null);
  const withoutCatalog = attackOnce(() => 0.5);
  check(withCatalog < withoutCatalog,
    `注入后攻方阵型贡献生效（守方剩余 ${withCatalog} < 未注入 ${withoutCatalog}）`);
  setHexFormationCatalog(getStaticData().formations);
  const withCatalog2 = attackOnce(() => 0.5);
  setHexFormationCatalog(null);
  const withoutCatalog2 = attackOnce(() => 0.5);
  check(withCatalog === withCatalog2 && withoutCatalog === withoutCatalog2, '固定 rng 下注入/未注入均确定可复现');

  console.log(failed === 0 ? `\n=== ${passed} passed, 0 failed ===` : `\n=== ${passed} passed, ${failed} failed ===`);
  setHexFormationCatalog(null);
  if (failed > 0) process.exit(1);
}

main();
