// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S03∩S11 Session 400 · 文化→登用成功率消费验收。
 * 运行：pnpm verify-culture-recruit
 */
import {
  OfficerStatus,
  cultureRecruitModifier,
  playerCultureForRecruit,
  resolveRecruitChance,
  calculateRecruitChance,
  eloquenceRecruitModifier,
} from '@leh/shared';
import { createGame, getGame } from '../services/game.js';
import { calcRecruitChance, recruitOfficer } from '../engine/personnel.js';

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

console.log('Culture recruit consume verify');

createGame(1, 1);
const initial = getGame();
const fid = initial.playerFactionId;
const city = Object.values(initial.cities).find((c) => c.ruler === fid && c.officers.length > 1);
assert(!!city, '存在己方多将城市');
if (!city) process.exit(1);

const recruiterId = initial.factions[fid]?.rulerId ?? city.officers[0]!;
const recruiter = initial.officers[recruiterId];
assert(!!recruiter, '存在说客');
if (!recruiter) process.exit(1);

const target = Object.values(initial.officers).find(
  (o) =>
    o.faction === fid &&
    o.id !== recruiterId &&
    o.status === OfficerStatus.ACTIVE,
);
assert(!!target, '存在可释放为在野的己方将');
if (!target) process.exit(1);

let state = {
  ...initial,
  cities: Object.fromEntries(
    Object.entries(initial.cities).map(([id, candidate]) => [
      id,
      candidate.id === city.id
        ? {
            ...candidate,
            gold: Math.max(candidate.gold, 500),
            stats: { ...candidate.stats, culture: 500 },
            officers: candidate.officers.filter((officerId) => officerId !== target.id),
          }
        : {
            ...candidate,
            officers: candidate.officers.filter((officerId) => officerId !== target.id),
          },
    ]),
  ),
  factions: Object.fromEntries(
    Object.entries(initial.factions).map(([id, faction]) => [
      id,
      {
        ...faction,
        officerIds: faction.officerIds.filter((officerId) => officerId !== target.id),
      },
    ]),
  ),
  officers: {
    ...initial.officers,
    [target.id]: {
      ...target,
      faction: null,
      status: OfficerStatus.FREE,
      location: city.id,
    },
  },
};

const cultureValue = playerCultureForRecruit(state.cities, fid, city.id);
assert(cultureValue === 500, '读文化值为 500');
assert(cultureRecruitModifier(cultureValue) === 6, 'Lv3 文化登用 +6 百分点');

const free = state.officers[target.id]!;
const withCulture = resolveRecruitChance(recruiter, free, cultureValue);
const withoutCulture = calculateRecruitChance(
  recruiter,
  free,
  eloquenceRecruitModifier(recruiter),
);
const expected = Math.min(90, withoutCulture + 6);
assert(withCulture === expected, `文化加成进入成功率（期望 ${expected}，实得 ${withCulture}）`);
assert(calcRecruitChance(recruiter, free, cultureValue) === withCulture, '引擎 calcRecruitChance 同源');

state = recruitOfficer(state, target.id, () => 0, recruiterId);
assert(state.officers[target.id]?.faction === fid, '文化加成路径下登用可成功入势力');

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
