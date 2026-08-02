// SPDX-License-Identifier: MIT
/**
 * FM-P3 crit 注入等价性验证
 *
 * 校验：注入真实 formations.json catalog 后，crit.ts 的暴击/反击/连击贡献与
 * 旧 §4.2 硬编码表完全一致（行为等价，单一内容源）。同时校验 catalog 缺省回退。
 *
 * 运行: pnpm --filter @leh/server exec tsx src/scripts/verify-fm3-crit-inject.ts
 */
import { FormationType, UnitProficiency, UnitType } from '@leh/shared';
import { getStaticData } from '../data/loader.js';
import {
  computeChainRate,
  computeCounterCoeff,
  computeCounterRate,
  computeCritRate,
  setFormationCatalog,
  type ChainContext,
  type CounterContext,
  type CritContext,
} from '../battle/crit.js';

let failed = 0;
const assert = (cond: boolean, msg: string) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failed += 1; console.error(`  ✗ ${msg}`); }
};

// 通用武将（无专属/无技能，保证只测阵型贡献）
const generic = {
  id: 999, name: '泛用', stats: { leadership: 70, war: 70, intelligence: 70, politics: 70, charisma: 70 },
  hidden: {}, skills: [], uniqueSkill: '', formationMastery: [],
} as unknown as Parameters<typeof computeCritRate>[0]['officer'];

const critCtx = (f: FormationType): CritContext => ({
  officer: generic, unitType: UnitType.HEAVY_CAVALRY, formation: f,
  proficiency: UnitProficiency.A, terrain: 'plain' as never, matchup: 1.0,
});
const counterCtx = (f: FormationType): CounterContext => ({
  officer: generic, unitType: UnitType.HEAVY_INFANTRY, formation: f,
  distance: 1, morale: 90, hasActed: false, confused: false,
});
const chainCtx = (f: FormationType): ChainContext => ({
  officer: generic, unitType: UnitType.HEAVY_CAVALRY, formation: f,
  proficiency: UnitProficiency.A, morale: 90, staminaRatio: 1,
});

const FORMATIONS: FormationType[] = [
  FormationType.SQUARE, FormationType.CIRCLE, FormationType.WEDGE, FormationType.GOOSE,
  FormationType.CRANE_WING, FormationType.ARROWHEAD, FormationType.CHARGE,
];

function snapshot(): Record<number, { crit: number; counter: number; coeff: number; chain: number }> {
  const out: Record<number, { crit: number; counter: number; coeff: number; chain: number }> = {};
  for (const f of FORMATIONS) {
    out[f] = {
      crit: computeCritRate(critCtx(f)),
      counter: computeCounterRate(counterCtx(f), 0.1),
      coeff: computeCounterCoeff(counterCtx(f)),
      chain: computeChainRate(chainCtx(f)),
    };
  }
  return out;
}

function main() {
  // 1. 回退（未注入）基线
  setFormationCatalog(null);
  const baseline = snapshot();

  // 2. 注入真实 catalog
  setFormationCatalog(getStaticData().formations);
  const injected = snapshot();

  // 3. 等价断言（浮点容差 1e-9）
  let allEqual = true;
  for (const f of FORMATIONS) {
    const b = baseline[f]; const i = injected[f];
    const ok = Math.abs(b.crit - i.crit) < 1e-9
      && Math.abs(b.counter - i.counter) < 1e-9
      && Math.abs(b.coeff - i.coeff) < 1e-9
      && Math.abs(b.chain - i.chain) < 1e-9;
    if (!ok) { allEqual = false; console.error(`  阵型 ${f} 注入不等价: base=${JSON.stringify(b)} inj=${JSON.stringify(i)}`); }
  }
  assert(allEqual, '注入 formations.json effects 后 crit 暴击/反击/连击贡献与硬编码表等价');

  // 4. 单一内容源：鹤翼 crit+20%、冲阵 crit+10% 实际生效
  const catalog = getStaticData().formations;
  const craneRec = catalog.find((x) => x.id === FormationType.CRANE_WING);
  const chargeRec = catalog.find((x) => x.id === FormationType.CHARGE);
  assert(craneRec?.effects.some((e) => e.modifier.type === 'crit_rate' && e.modifier.value === 20) === true, '鹤翼 effects 含 crit_rate +20');
  assert(chargeRec?.effects.some((e) => e.modifier.type === 'crit_rate' && e.modifier.value === 10) === true, '冲阵 effects 含 crit_rate +10');

  // 5. 注入 vs 回退：鹤翼/冲阵暴击率应高于方阵
  assert(injected[FormationType.CRANE_WING].crit > injected[FormationType.SQUARE].crit, '注入后鹤翼暴击率 > 方阵');
  assert(injected[FormationType.CHARGE].crit > injected[FormationType.SQUARE].crit, '注入后冲阵暴击率 > 方阵');

  // 清理：恢复回退
  setFormationCatalog(null);

  console.log(failed === 0 ? '\n=== 全部断言通过 ✓ ===' : `\n=== ${failed} 失败 ===`);
  if (failed > 0) process.exit(1);
}

main();
