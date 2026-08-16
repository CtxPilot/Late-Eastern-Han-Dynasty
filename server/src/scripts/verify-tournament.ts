// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S19 单挑大会最小闭环冒烟（Session 338）
 * 运行: pnpm verify-tournament
 */
import { OfficerStatus } from '@leh/shared';
import { runAnnualTournament } from '../engine/tournament.js';
import { createGame, getGame } from '../services/game.js';

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

console.log('S19 tournament verify');

createGame(1, 1);
let state = getGame();
// 抬高体力与武力，保证够 16 人
state = {
  ...state,
  officers: Object.fromEntries(
    Object.entries(state.officers).map(([id, o]) => [
      id,
      {
        ...o,
        stamina: Math.max(o.stamina, 100),
        stats: { ...o.stats, war: Math.max(o.stats.war, 70) },
        status: o.status === OfficerStatus.DEAD ? OfficerStatus.DEAD : OfficerStatus.ACTIVE,
      },
    ]),
  ),
};

const beforeStatuses = Object.fromEntries(
  Object.entries(state.officers).map(([id, o]) => [id, o.status]),
);
const after = runAnnualTournament(state, () => 0.5);

assert(after.tournament?.phase === 'finished', '大会 phase=finished');
assert(typeof after.tournament?.championId === 'number', '产生冠军');
assert(typeof after.tournament?.runnerUpId === 'number', '产生亚军');
assert((after.tournament?.bracket.length ?? 0) >= 4, '至少 4 轮对阵（16→8→4→2→1）');
assert(
  after.actionLog.some((l) => l.type === 'tournament' && l.message.includes('武魁')),
  'actionLog 含武魁叙事',
);

let statusIntact = true;
for (const [id, status] of Object.entries(beforeStatuses)) {
  if (after.officers[Number(id)]?.status !== status) {
    statusIntact = false;
    break;
  }
}
assert(statusIntact, '大会不改变武将 status（唯伤不杀）');
assert((after.tournament?.history.length ?? 0) >= 1, 'history 写入历届记录');

console.log(`结果: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
