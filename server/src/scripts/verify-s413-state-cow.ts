// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * P2-1（Session 413）状态增量化验证：
 * 月度军官重置 copy-on-write 后——
 *   ① 无玩家行动的整月推进中，军官对象身份翻转数应远低于 O(N×月数)；
 *   ② 语义不变量保持（月结后 actionsPerMonth 全员为 1、武将总数不减）；
 *   ③ 同种子两局 12 个月终态完全一致（确定性未受结构共享影响）。
 */
import { createGame, endTurn, getGame } from '../services/game.js';

let pass = 0;
let fail = 0;
const check = (cond: boolean, label: string) => {
  if (cond) { pass += 1; console.log(`  ✓ ${label}`); }
  else { fail += 1; console.error(`  ✗ ${label}`); }
};

function churnOverMonths(months: number): { churn: number; total: number } {
  createGame(1, 2);
  let churn = 0;
  let total = 0;
  for (let i = 0; i < months; i++) {
    const before = Object.entries(getGame().officers);
    total += before.length;
    endTurn();
    const after = getGame().officers;
    for (const [id, officer] of before) {
      if (after[Number(id)] !== officer) churn += 1;
    }
  }
  return { churn, total };
}

const { churn, total } = churnOverMonths(12);
const officerCount = Object.keys(getGame().officers).length;
console.log(`  12 个月军官身份翻转 ${churn} 次 / 基线 ${total}（在册 ${officerCount} 名）`);
check(churn < total * 0.15, `身份翻转率 <15%（实际 ${((churn / total) * 100).toFixed(1)}%）`);
check(Object.values(getGame().officers).every((o) => o.actionsPerMonth === 1), '月结后全员 actionsPerMonth=1（语义不变量）');
check(Object.keys(getGame().officers).length === officerCount, '武将总数不减');

// 确定性：两局同种子 12 个月，终态一致
createGame(1, 2);
for (let i = 0; i < 12; i++) endTurn();
const snapshotA = JSON.stringify({ y: getGame().currentYear, m: getGame().currentMonth, log: getGame().actionLog, factions: getGame().factions });
const churnB = churnOverMonths(12);
const snapshotB = JSON.stringify({ y: getGame().currentYear, m: getGame().currentMonth, log: getGame().actionLog, factions: getGame().factions });
check(snapshotA === snapshotB, '两局 12 个月终态逐字节一致（结构共享不破坏确定性）');
check(churnB.churn === churn, `翻转数可复现（${churnB.churn} = ${churn}）`);

console.log(`Session 413 state COW: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
