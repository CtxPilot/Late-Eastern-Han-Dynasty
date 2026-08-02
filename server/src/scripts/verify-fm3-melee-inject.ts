// SPDX-License-Identifier: MIT
/**
 * FM-P3a 标准模式点值迁移验证
 *
 * 语义（Session 290 后演进）：runMeleeRound 的唯一数值量纲 = formations.json `tiers[0]` 点值，
 * 经等价性单点换算（MELEE_ATK/DEF/MOB_GAIN）消费；meleePercent 过渡字段已退役
 * （类型/JSON/generate-0a-data 均移除，不再存在第二套阵型数值表）。
 * 同时验证组织度执行档：正面阵型增量按组织度档位缩放，负修正原值保留，旧档缺省 orderly ×1.0 中性。
 *
 * 运行: pnpm --filter @leh/server exec tsx src/scripts/verify-fm3-melee-inject.ts
 */
import { FormationType, type MeleeState } from '@leh/shared';
import { getStaticData } from '../data/loader.js';
import {
  MELEE_ATK_GAIN, MELEE_DEF_GAIN, MELEE_MOB_GAIN, MELEE_MOB_BASE,
  runMeleeRound, setMeleeFormationCatalog, standardMeleeMods,
} from '../engine/meleeRound.js';

let failed = 0;
const assert = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failed += 1; console.error(`  ✗ ${msg}`); }
};

function makeState(atkF: FormationType, defF: FormationType, atkTroops = 3000, defTroops = 2000, atkOrg?: number, defOrg?: number): MeleeState {
  return {
    battlefieldId: 'b', attackerArmyId: 'a', defenderArmyId: 'd',
    attackerFactionId: 2, defenderFactionId: 1, entryMode: 'standard',
    settlementApplied: false, round: 0, maxRounds: 20,
    attackerTroops: atkTroops, defenderTroops: defTroops,
    attackerMorale: 85, defenderMorale: 85, attackerFatigue: 0, defenderFatigue: 0,
    attackerFormation: atkF, defenderFormation: defF,
    attackerOrganization: atkOrg, defenderOrganization: defOrg,
    tacticalPoints: 5, tacticalPointsUsed: 0, phase: 'active', eventLog: [],
  };
}

const EXPECTED_ATK_GAIN = Math.abs(MELEE_ATK_GAIN - 0.1) < 1e-9;
const EXPECTED_DEF_GAIN = Math.abs(MELEE_DEF_GAIN - 0.1) < 1e-9;
const EXPECTED_MOB_GAIN = Math.abs(MELEE_MOB_GAIN - 0.5) < 1e-9;
const EXPECTED_MOB_BASE = Math.abs(MELEE_MOB_BASE - 1.0) < 1e-9;

function main() {
  console.log('\n=== FM-P3a 标准模式点值迁移 ===');
  assert(EXPECTED_ATK_GAIN, `等价性系数常量锚定：MELEE_ATK_GAIN=0.10（实际 ${MELEE_ATK_GAIN}）`);
  assert(EXPECTED_DEF_GAIN, `等价性系数常量锚定：MELEE_DEF_GAIN=0.10（实际 ${MELEE_DEF_GAIN}）`);
  assert(EXPECTED_MOB_GAIN, `等价性系数常量锚定：MELEE_MOB_GAIN=0.50（实际 ${MELEE_MOB_GAIN}）`);
  assert(EXPECTED_MOB_BASE, `等价性系数常量锚定：MELEE_MOB_BASE=1.00（实际 ${MELEE_MOB_BASE}）`);

  // 注入真实静态目录
  setMeleeFormationCatalog(getStaticData().formations);

  // 1. 单一内容源：Formation 不再携带 meleePercent
  const catalog = getStaticData().formations;
  const body = catalog[0] as unknown as Record<string, unknown>;
  assert(body.meleePercent === undefined, 'Formation 已无 meleePercent（过渡字段退役，单一点值源）');

  // 2. 组织度执行档只缩放正面增量；负修正原值保留
  //    锥形 atk=2（正）：intact ×1.2 → 0.24；loose ×0.8 → 0.16；broken ×0 → 0
  const wedgeIntact = standardMeleeMods(FormationType.WEDGE, 100);
  const wedgeLoose = standardMeleeMods(FormationType.WEDGE, 50);
  const wedgeBroken = standardMeleeMods(FormationType.WEDGE, 10);
  assert(Math.abs(wedgeIntact.atk - 0.24) < 1e-9, `组织度严整(intact×1.2)放大正面攻：锥形 atk=${wedgeIntact.atk.toFixed(2)}（预期 0.24）`);
  assert(Math.abs(wedgeLoose.atk - 0.16) < 1e-9, `组织度松散(loose×0.8)削弱正面攻：锥形 atk=${wedgeLoose.atk.toFixed(2)}（预期 0.16）`);
  assert(Math.abs(wedgeBroken.atk - 0.0) < 1e-9, `组织度崩散(broken×0)清零正面攻：锥形 atk=${wedgeBroken.atk.toFixed(2)}（预期 0）`);
  //    圆阵 atk=-2（负）：不做组织度缩放的放大，原值保留
  const circleBroken = standardMeleeMods(FormationType.CIRCLE, 10);
  const circleIntact = standardMeleeMods(FormationType.CIRCLE, 100);
  assert(Math.abs(circleBroken.atk + 0.2) < 1e-9 && Math.abs(circleIntact.atk + 0.2) < 1e-9,
    '圆阵负攻修正原值保留（崩散/严整均为 -0.20，不随组织度放大或归零）');

  // 3. 攻守角色语义（05 §4.5.1 点值）：圆阵高防低攻、锥形高攻低防、锋矢攻防机动具兼
  const square = standardMeleeMods(FormationType.SQUARE, 60);
  const circle = standardMeleeMods(FormationType.CIRCLE, 60);
  const wedge = standardMeleeMods(FormationType.WEDGE, 60);
  const goose = standardMeleeMods(FormationType.GOOSE, 60);
  const crane = standardMeleeMods(FormationType.CRANE_WING, 60);
  const arrow = standardMeleeMods(FormationType.ARROWHEAD, 60);
  assert(circle.def > square.def && circle.atk < square.atk, `圆阵防御特化：def=${circle.def.toFixed(2)}>方阵${square.def.toFixed(2)}、atk=${circle.atk.toFixed(2)}<方阵${square.atk.toFixed(2)}`);
  assert(wedge.atk === 0.2 && wedge.def === -0.2, `锥形强攻弱防：atk=${wedge.atk.toFixed(2)}、def=${wedge.def.toFixed(2)}`);
  assert(arrow.atk === 0.1 && arrow.def === -0.1, `锋矢攻防机动具兼：atk=${arrow.atk.toFixed(2)}、def=${arrow.def.toFixed(2)}`);
  assert(goose.atk === 0 && crane.atk === 0, `雁行/鹤翼攻修正中性（atk=0，靠射程/包抄）`);

  // 4. 先手排序：圆阵(mob=-2)最慢，雁/鹤/锋(mob=1)最快，方/锥(mob=0)中性
  assert(circle.mobility === 0.0 && goose.mobility === 1.5 && arrow.mobility === 1.5 && square.mobility === 1.0,
    `先手排序与点值机动一致：圆=${circle.mobility.toFixed(1)} < 方=锥=${square.mobility.toFixed(1)} < 雁/鹤/锋=${goose.mobility.toFixed(1)}`);

  // 5. 旧档缺省中性：organization undefined ≡ orderly(60)×1.0
  const wedgeDefault = standardMeleeMods(FormationType.WEDGE, undefined);
  const wedgeOrderly = standardMeleeMods(FormationType.WEDGE, 60);
  assert(wedgeDefault.atk === wedgeOrderly.atk && wedgeDefault.def === wedgeOrderly.def && wedgeDefault.mobility === wedgeOrderly.mobility,
    'organization 缺省按 orderly×1.0 中性解析（旧档/未携带不改变行为）');

  // 6. runMeleeRound 注入后可运行（走点值路径，无 meleePercent 依赖）
  const res = runMeleeRound(makeState(FormationType.WEDGE, FormationType.SQUARE, 3000, 2000, 60, 60), { type: 'normal_attack' }, 70);
  assert(res.attackerDamage >= 0 && res.defenderDamage >= 0 && Number.isFinite(res.attackerDamage), `runMeleeRound 点值路径可运行（攻损 ${res.attackerDamage} / 守损 ${res.defenderDamage}）`);

  // 7. 迁移前后对比（诚实登记，非断言拒绝）：点值 vs 旧 meleePercent 基线
  console.log('\n  迁移对比（点值→等价性换算 vs Session 290 meleePercent，orderly 档）：');
  const LEGACY_PERCENT: Record<number, { atk: number; def: number; mobility: number }> = {
    [FormationType.SQUARE]: { atk: 0.0, def: 0.30, mobility: 0.8 },
    [FormationType.CIRCLE]: { atk: -0.1, def: 0.20, mobility: 0.7 },
    [FormationType.WEDGE]: { atk: 0.25, def: -0.10, mobility: 1.3 },
    [FormationType.GOOSE]: { atk: 0.15, def: -0.05, mobility: 1.1 },
    [FormationType.CRANE_WING]: { atk: 0.10, def: 0.15, mobility: 0.9 },
    [FormationType.ARROWHEAD]: { atk: 0.20, def: -0.15, mobility: 1.2 },
  };
  for (const f of [FormationType.SQUARE, FormationType.CIRCLE, FormationType.WEDGE, FormationType.GOOSE, FormationType.CRANE_WING, FormationType.ARROWHEAD]) {
    const record = catalog.find((item) => item.id === f)!;
    const tier = record.tiers[0];
    const now = standardMeleeMods(f, 60);
    const old = LEGACY_PERCENT[f];
    console.log(`    ${record.name.padEnd(4)} 点值(${tier.attack}/${tier.defense}/${tier.mobility}) → 新 atk=${now.atk.toFixed(2)} def=${now.def.toFixed(2)} mob=${now.mobility.toFixed(1)} | 旧 atk=${old.atk} def=${old.def} mob=${old.mobility}`);
  }

  setMeleeFormationCatalog(null);
  console.log(failed === 0 ? '\n=== 全部断言通过 ✓ ===' : `\n=== ${failed} 失败 ===`);
  if (failed > 0) process.exit(1);
}

main();
