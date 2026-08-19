// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 家属质任冒烟（Session 348 · docs/05 §5.8.2）
 * 运行: pnpm verify-hostage-families
 */
import {
  FAMILY_CAPTURE_MORALE_HIT,
  FAMILY_RELOCATE_GOLD,
  citiesShockedByFamilyCapture,
} from '@leh/shared';
import { conscript, relocateGarrisonFamilies } from '../engine/civil.js';
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

console.log('Hostage families verify');

createGame(1, 1);
let state = getGame();
const cities = Object.values(state.cities).filter((c) => c.ruler === state.playerFactionId);
const from = cities[0];
const dest = cities[1];
assert(!!from && !!dest, '至少两座己方城');
if (!from || !dest) process.exit(1);

const rich = {
  ...state,
  cities: {
    ...state.cities,
    [from.id]: { ...from, gold: Math.max(from.gold, FAMILY_RELOCATE_GOLD + 80), food: Math.max(from.food, 200) },
  },
};

let afterConscript = conscript(rich, from.id, () => 0.5);
const gained = afterConscript.cities[from.id]!.garrisonFamilies ?? 0;
assert(gained > 0, `征兵绑定家属（${gained}）`);

let relocated = relocateGarrisonFamilies(afterConscript, from.id, dest.id);
assert(relocated.cities[from.id]!.garrisonFamilies === 0, '出发城家属清零');
assert(
  (relocated.cities[dest.id]!.garrisonFamilies ?? 0) >= gained,
  '后方城接收家属',
);
assert(relocated.cities[from.id]!.familyBackupCityId === dest.id, '写入质任城');
assert(relocated.cities[from.id]!.gold === afterConscript.cities[from.id]!.gold - FAMILY_RELOCATE_GOLD, '扣金 500');

let blocked = false;
try {
  relocateGarrisonFamilies(relocated, from.id, dest.id);
} catch {
  blocked = true;
}
assert(blocked, '同季或无家属时拒绝再迁');

const shocked = citiesShockedByFamilyCapture(
  {
    ...relocated,
    cities: {
      ...relocated.cities,
      [dest.id]: { ...relocated.cities[dest.id]!, ruler: 99 },
    },
    factions: {
      ...relocated.factions,
      [relocated.playerFactionId]: {
        ...relocated.factions[relocated.playerFactionId]!,
        capitalCityId: dest.id,
      },
    },
  },
  dest.id,
  relocated.playerFactionId,
);
assert(shocked.includes(from.id), '治所质任失陷冲击出发城');
assert(FAMILY_CAPTURE_MORALE_HIT === 40, '士气冲击 −40');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
