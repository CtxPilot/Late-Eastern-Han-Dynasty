// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { GameStateEntitiesSchema } from '@leh/shared';
import { createGame, getGame } from '../services/game.js';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

console.log('\n=== S16 实体快照 Schema 验证 ===');

for (const scenario of [
  { id: 1, factionId: 1, label: '英雄集结' },
  { id: 2, factionId: 1, label: '关东义兵' },
]) {
  createGame(scenario.id, scenario.factionId);
  const state = getGame();
  const parsed = GameStateEntitiesSchema.parse({
    officers: state.officers,
    cities: state.cities,
    factions: state.factions,
    females: state.females,
  });

  check(
    `${scenario.label}实体切片通过严格解析`,
    Object.keys(parsed.officers).length > 0 && Object.keys(parsed.cities).length > 0,
  );
  check(`${scenario.label}武将数量保持`, Object.keys(parsed.officers).length === Object.keys(state.officers).length);
  check(`${scenario.label}城市数量保持`, Object.keys(parsed.cities).length === Object.keys(state.cities).length);
  check(`${scenario.label}势力数量保持`, Object.keys(parsed.factions).length === Object.keys(state.factions).length);
  check(`${scenario.label}女性数量保持`, Object.keys(parsed.females).length === Object.keys(state.females).length);
}

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
