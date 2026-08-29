// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * P1-3（Session 411）手动战斗激励差验证：
 * 六角微操结算口径 `settleTacticalMeleeTroops`——
 *   撤退 50% 回流与旧内联数学逐字节等价；攻方胜利伤兵归队 15%（确定性零 RNG）；守方胜/满编无回补。
 */
import {
  MANUAL_VICTORY_RECOVERY_RATIO,
  collectAnnihilatedDefenderCommanders,
  settleTacticalMeleeTroops,
} from '../engine/battle.js';
import type { BattleState, BattleUnit } from '@leh/shared';

let pass = 0;
let fail = 0;
const check = (cond: boolean, label: string) => {
  if (cond) { pass += 1; console.log(`  ✓ ${label}`); }
  else { fail += 1; console.error(`  ✗ ${label}`); }
};

const mkUnit = (over: Partial<BattleUnit>): BattleUnit =>
  ({
    side: 'attacker',
    isDestroyed: false,
    isRetreated: false,
    troopCount: 0,
    maxTroops: 0,
    ...over,
  }) as BattleUnit;

const mkBattle = (units: BattleUnit[], winner: 'attacker' | 'defender'): BattleState =>
  ({ units, winner }) as unknown as BattleState;

// ① 攻方胜利：伤兵归队 15%（4000 存活 / 10000 满编 → 伤 6000 → 回补 900 → 4900）
{
  const battle = mkBattle(
    [mkUnit({ side: 'attacker', troopCount: 4000, maxTroops: 10000 }), mkUnit({ side: 'defender', troopCount: 1200, maxTroops: 8000, isDestroyed: true })],
    'attacker',
  );
  const r = settleTacticalMeleeTroops(battle);
  check(r.veteranRecovery === Math.floor(6000 * MANUAL_VICTORY_RECOVERY_RATIO), `胜利回补 = floor(伤兵×15%) = ${r.veteranRecovery}`);
  check(r.attackerTroops === 4900, `回流兵力 4000+900 = ${r.attackerTroops}`);
  check(r.note.includes('伤兵归队'), '战报标注「亲统督战：伤兵归队」');
}

// ② 封顶：回补后不超过满编（小股部队 flooring 正确）
{
  const battle = mkBattle(
    [mkUnit({ troopCount: 999, maxTroops: 1000 }), mkUnit({ troopCount: 0, maxTroops: 1 })],
    'attacker',
  );
  const r = settleTacticalMeleeTroops(battle);
  check(r.attackerTroops === 999, `伤兵 2 回补 floor=0，兵力不变 ${r.attackerTroops}`);
  check(r.veteranRecovery === 0, '零头回补为 0');
}

// ③ 满编胜利：无回补
{
  const battle = mkBattle([mkUnit({ troopCount: 5000, maxTroops: 5000 })], 'attacker');
  const r = settleTacticalMeleeTroops(battle);
  check(r.veteranRecovery === 0 && r.attackerTroops === 5000, '满编胜利无回补');
}

// ④ 守方胜利：不回补
{
  const battle = mkBattle([mkUnit({ troopCount: 3000, maxTroops: 10000 })], 'defender');
  const r = settleTacticalMeleeTroops(battle);
  check(r.veteranRecovery === 0 && r.attackerTroops === 3000, '守方胜无激励');
  check(r.note === '守方胜', '守方胜战报');
}

// ⑤ 战术撤退：50% 回流与旧内联数学逐字节等价（含已撤退+未撤退合计、阵亡不计）
{
  const battle = mkBattle(
    [
      mkUnit({ troopCount: 700, maxTroops: 1000, isRetreated: true }),
      mkUnit({ troopCount: 300, maxTroops: 1000 }),
      mkUnit({ troopCount: 500, maxTroops: 1000, isDestroyed: true }),
      mkUnit({ side: 'defender', troopCount: 900, maxTroops: 900 }),
    ],
    'defender',
  );
  const r = settleTacticalMeleeTroops(battle);
  check(r.attackerTroops === Math.floor((700 + 300) * 0.5), `撤退 50% 回流 = ${r.attackerTroops}（阵亡不计）`);
  check(r.note === '战术撤退（50%回流）', '撤退战报不变');
  check(r.veteranRecovery === 0, '撤退不享受激励');
}

// ⑥ 确定性：同输入两次调用逐字段一致（零 RNG）
{
  const battle = mkBattle([mkUnit({ troopCount: 1234, maxTroops: 5678 })], 'attacker');
  const a = settleTacticalMeleeTroops(battle);
  const b = settleTacticalMeleeTroops(battle);
  check(JSON.stringify(a) === JSON.stringify(b), '同输入确定性一致');
}

// ⑦ 战场生擒：攻方胜利且守方单位被歼 → 主将被俘（确定性，去重排序）；守方胜不俘。
{
  const battle = mkBattle(
    [
      mkUnit({ side: 'attacker', troopCount: 5000, maxTroops: 5000 }),
      mkUnit({ side: 'defender', commanderId: 7, troopCount: 0, maxTroops: 3000, isDestroyed: true }),
      mkUnit({ side: 'defender', commanderId: 7, troopCount: 0, maxTroops: 2000, isDestroyed: true }),
      mkUnit({ side: 'defender', commanderId: 8, troopCount: 500, maxTroops: 2000 }),
    ],
    'attacker',
  );
  const ids = collectAnnihilatedDefenderCommanders(battle);
  check(JSON.stringify(ids) === '[7]', `被歼守方主将去重收集 = ${JSON.stringify(ids)}`);
}
{
  const battle = mkBattle(
    [mkUnit({ side: 'attacker', troopCount: 100, maxTroops: 1000, isDestroyed: true }), mkUnit({ side: 'defender', commanderId: 9, troopCount: 900, maxTroops: 1000 })],
    'attacker',
  );
  check(collectAnnihilatedDefenderCommanders(battle).length === 0, '守方未歼不俘');
}
{
  const battle = mkBattle(
    [mkUnit({ side: 'attacker', commanderId: 3, troopCount: 0, maxTroops: 1000, isDestroyed: true }), mkUnit({ side: 'defender', commanderId: 9, troopCount: 900, maxTroops: 1000 })],
    'defender',
  );
  check(collectAnnihilatedDefenderCommanders(battle).length === 0, '守方胜利不俘攻方');
}

console.log(`Session 411 manual victory bonus: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
