// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { GameStateIntelSchema, SpyStatus } from '@leh/shared';
import {
  createGame,
  doRecruitSpies,
  doStationCounter,
  doUnstationCounter,
  getGame,
} from '../services/game.js';

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

function parseCurrentIntel() {
  return GameStateIntelSchema.parse({ intel: getGame().intel });
}

console.log('\n=== S16 谍报快照 Schema 验证 ===');

for (const scenario of [
  { id: 1, factionId: 1, label: '英雄集结' },
  { id: 2, factionId: 1, label: '关东义兵' },
]) {
  createGame(scenario.id, scenario.factionId);
  const parsed = parseCurrentIntel();
  check(`${scenario.label}初始谍报切片通过严格解析`, parsed.intel.nextAgentSeq === 1);
  check(`${scenario.label}初始无孤儿反间驻守`, Object.keys(parsed.intel.cityDefense).length === 0);
}

createGame(1, 1);
const homeCity = Object.values(getGame().cities).find(
  (city) => city.ruler === 1 && city.gold >= 120 && city.food >= 60,
);
if (!homeCity) throw new Error('验证夹具未找到可招募密探的玩家城市');

const beforeGold = homeCity.gold;
const beforeFood = homeCity.food;
doRecruitSpies(homeCity.id);
const afterRecruit = parseCurrentIntel().intel;
const recruited = Object.values(afterRecruit.agents)[0];
check('真实招募至少生成一名密探', Object.keys(afterRecruit.agents).length >= 1 && recruited != null);
check('招募推进 nextAgentSeq', afterRecruit.nextAgentSeq > 1);
check(
  '招募真实扣除城市金粮',
  getGame().cities[homeCity.id].gold < beforeGold && getGame().cities[homeCity.id].food < beforeFood,
);

if (!recruited) throw new Error('招募后未生成密探');
doStationCounter(recruited.id, homeCity.id);
const stationed = parseCurrentIntel().intel;
check('驻守后密探进入 counter_duty', stationed.agents[recruited.id].status === SpyStatus.COUNTER_DUTY);
check(
  '驻守后城市反间记录双向指向密探',
  stationed.cityDefense[homeCity.id]?.stationAgentId === recruited.id &&
    stationed.agents[recruited.id].locationCityId === homeCity.id,
);

doUnstationCounter(homeCity.id);
const unstationed = parseCurrentIntel().intel;
check('撤防后城市反间记录被清除', unstationed.cityDefense[homeCity.id] === undefined);
check('撤防后密探返回空闲状态', unstationed.agents[recruited.id].status === SpyStatus.IDLE);
check('招募、驻守、撤防全过程后权威谍报状态仍通过 Schema', true);

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
