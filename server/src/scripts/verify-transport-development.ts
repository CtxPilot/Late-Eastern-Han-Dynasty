// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S03 Session 398 · 交通持续投入专项验收。
 * 运行：pnpm verify-transport-development
 */
import {
  GameStateSchema,
  DEVELOPMENT_PROJECT_CONFIG,
} from '@leh/shared';
import {
  createGame,
  getGame,
} from '../services/game.js';
import { getRuntimeRngState } from '../runtime-rng.js';
import {
  developCity,
  tickDevelopmentProject,
} from '../engine/civil.js';

let pass = 0;
let fail = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    pass++;
    console.log(`  ✓ ${message}`);
  } else {
    fail++;
    console.error(`  ✗ ${message}`);
  }
}

console.log('Transport development verify');

createGame(1, 1);
let state = getGame();
const city = Object.values(state.cities).find((candidate) =>
  candidate.ruler === state.playerFactionId && candidate.officers.length > 0,
);
assert(!!city, '存在有本城武将的己方城市');
if (!city) process.exit(1);

const officerId = city.officers[0]!;
const beforeTransport = city.stats.transport ?? 0;
const beforeGold = city.gold;
const beforeDraws = getRuntimeRngState().draws;
const config = DEVELOPMENT_PROJECT_CONFIG.transport;

state = developCity(state, city.id, 'transport', officerId);
const started = state.cities[city.id]!;
assert(started.activeDevelopment?.kind === 'transport', '启动交通持续项目');
assert(started.activeDevelopment?.remainingMonths === config.totalMonths, '工期写入 6 个月');
assert(started.gold === beforeGold - config.totalGoldCost / 3, '启动扣除首付 120 金');
assert((started.stats.transport ?? 0) === beforeTransport, '启动不提前增加交通');

for (let month = 0; month < config.totalMonths; month++) {
  const result = tickDevelopmentProject(state, state.cities[city.id]!);
  state = {
    ...state,
    cities: { ...state.cities, [city.id]: result.city },
  };
}

const finished = state.cities[city.id]!;
assert(finished.activeDevelopment == null, '六个月后项目清除');
assert((finished.stats.transport ?? 0) === beforeTransport + config.gain, '完成后交通 +60');
assert(finished.gold < beforeGold, '月结持续扣除余款');
assert(getRuntimeRngState().draws === beforeDraws, '交通项目全程不消费 RNG');
assert(GameStateSchema.safeParse(state).success, '完成态可通过完整 GameState Schema');

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
