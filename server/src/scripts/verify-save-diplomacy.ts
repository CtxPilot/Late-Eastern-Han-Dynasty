// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { DipRelation, GameStateDiplomacySchema, findDiplomacy } from '@leh/shared';
import { createGame, doAlliance, doTribute, getGame } from '../services/game.js';

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

function parseCurrentDiplomacy() {
  const state = getGame();
  return GameStateDiplomacySchema.parse({ diplomacy: state.diplomacy });
}

console.log('\n=== S16 外交快照 Schema 验证 ===');

for (const scenario of [
  { id: 1, factionId: 1, label: '英雄集结', expectedLinks: 6 },
  { id: 2, factionId: 1, label: '关东义兵', expectedLinks: 6 },
]) {
  createGame(scenario.id, scenario.factionId);
  const parsed = parseCurrentDiplomacy();
  check(`${scenario.label}外交切片通过严格解析`, parsed.diplomacy.length === scenario.expectedLinks);
  check(
    `${scenario.label}不存在自外交或重复势力对`,
    parsed.diplomacy.every((link) => link.factionA !== link.factionB),
  );
}

createGame(1, 1);
const before = findDiplomacy(getGame().diplomacy, 1, 3);
doTribute(3);
doTribute(3);
const afterTribute = findDiplomacy(getGame().diplomacy, 1, 3);
check('两次进贡将友好度从 0 提升到 30', before?.favorability === 0 && afterTribute?.favorability === 30);
check('友好度达标后关系升为 friendly', afterTribute?.relation === DipRelation.FRIENDLY);
check(
  '进贡后仍只有一条 1↔3 外交关系',
  getGame().diplomacy.filter(
    (link) =>
      (link.factionA === 1 && link.factionB === 3) ||
      (link.factionA === 3 && link.factionB === 1),
  ).length === 1,
);
parseCurrentDiplomacy();
check('进贡后权威外交状态仍通过 Schema', true);

doAlliance(3);
const afterAlliance = findDiplomacy(getGame().diplomacy, 1, 3);
check('缔结盟约后关系为 allied', afterAlliance?.relation === DipRelation.ALLIED);
check('缔盟保持友好度不低于 40', (afterAlliance?.favorability ?? 0) >= 40);
parseCurrentDiplomacy();
check('缔盟后权威外交状态仍通过 Schema', true);

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
