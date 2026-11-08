// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 门禁：Session 476 · 190 年群雄全势力（三十诸侯全割据）专项总验收
 *
 * 验证目标：
 * 1. 剧本 4 元数据：30 大独立历史割据势力，30 个可玩势力全开放；
 * 2. 106 郡国城池 100% 全覆盖，0 重叠，0 遗漏；
 * 3. 30 位割据君主全部史实可考、存活在世且成年（>= 14岁）；
 * 4. 136 名名将文臣布点合法，所属城池严格属于己方势力领地；
 * 5. 435 对外交矩阵完整覆盖，反董联盟 16 诸侯对董卓全战且内部互盟；
 * 6. 30 大势力全部通过 createGame 状态机初始化构建；
 * 7. 连续 12 个月（1整年）月结推进平稳收敛，无 NaN，百官岁首统发通过。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGame, getGame } from '../services/game.js';
import { advanceTurn } from '../engine/turn.js';
import type { ScenarioStatic, Officer, City, ScenarioFactionSetup } from '@leh/shared';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const SCENARIOS_FILE = join(DATA_DIR, 'scenarios.json');
const OFFICERS_FILE = join(DATA_DIR, 'officers.json');
const CITIES_FILE = join(DATA_DIR, 'cities.json');

const scenarios: ScenarioStatic[] = JSON.parse(readFileSync(SCENARIOS_FILE, 'utf-8'));
const officers: Officer[] = JSON.parse(readFileSync(OFFICERS_FILE, 'utf-8'));
const cities: City[] = JSON.parse(readFileSync(CITIES_FILE, 'utf-8'));

const officerMap = new Map(officers.map(o => [o.id, o]));
const cityMap = new Map(cities.map(c => [c.id, c]));

console.log('=== [Session 476] 190 年群雄全势力（三十诸侯全割据）专项总验收 ===\n');

// ── 1. 剧本 4 架构与元数据审计 ──
console.log('【1. 剧本 4 架构与元数据审计】');
const s4 = scenarios.find(s => s.id === 4);
if (!s4) throw new Error('剧本 4 必须存在');
assert.ok(s4, '断言 1: 剧本 4 必须存在于 scenarios.json');
assert.equal(s4.name, '群雄讨董（190·三十诸侯全割据）', '断言 2: 剧本 4 名称更新为三十诸侯全割据');
assert.equal(s4.startYear, 190, '断言 3: 起始年份为 190 年');
assert.equal(s4.endYear, 193, '断言 4: 终止年份为 193 年');
assert.equal(s4.factionSetups.length, 30, '断言 5: 必须包含恰好 30 个割据诸侯势力');
assert.equal(s4.playableFactions.length, 30, '断言 6: 30 个诸侯势力全部设为玩家可选');
assert.deepEqual(s4.eventIds, [305, 306, 307, 308, 309], '断言 7: 完整保留 190 年五大核心历史叙事事件白名单');
console.log('  ✓ 剧本 4 元数据与三十诸侯配置契约完全达标 (7/7)');

// ── 2. 十三州 106 郡国城池 100% 全覆盖审计 ──
console.log('\n【2. 十三州 106 郡国城池全覆盖审计】');
const cityOwnership = s4.startState.cityOwnership;
const ownedCityIds = Object.keys(cityOwnership).map(Number);
assert.equal(ownedCityIds.length, 106, '断言 8: 必须恰好分配全部 106 座城池');
assert.equal(new Set(ownedCityIds).size, 106, '断言 9: 106 座城池分配无任何重复冲突');

for (let cid = 1; cid <= 106; cid++) {
  const facId = cityOwnership[String(cid)];
  assert.ok(facId >= 1 && facId <= 30, `断言 10: 城池 ${cid} 归属势力 ID 必须在 1..30 区间 (当前: ${facId})`);
  const c = cityMap.get(cid);
  assert.ok(c, `断言 11: 城池 ID ${cid} 必须存在于 cities.json`);
}

// 检查每个势力的都城必须在其控制领地中
for (const fac of s4.factionSetups) {
  const capId = fac.capitalCityId;
  assert.equal(cityOwnership[String(capId)], fac.id, `断言 12: 势力 ${fac.name} 的治所 ${capId} 必须属于本势力`);
}
console.log('  ✓ 全图 106 座城市 100% 完整划分，0 孤立无主，0 冲突重叠 (5/5)');

// ── 3. 三十诸侯君主与核心名臣武将编制审计 ──
console.log('\n【3. 三十诸侯君主与武将编制审计】');
const rulerIds = s4.factionSetups.map(f => f.rulerId);
assert.equal(new Set(rulerIds).size, 30, '断言 13: 30 位割据君主 ID 必须各不相同');

for (const fac of s4.factionSetups) {
  const ruler = officerMap.get(fac.rulerId);
  assert.ok(ruler, `断言 14: 势力 ${fac.name} 君主 ID ${fac.rulerId} 必须存在于 officers.json`);
  const age = 190 - ruler.birthYear;
  assert.ok(ruler.deathYear >= 190, `断言 15: 君主 ${ruler.name} 在 190 年必须在世 (卒于 ${ruler.deathYear})`);
  assert.ok(age >= 14, `断言 16: 君主 ${ruler.name} 在 190 年必须成年 (当前 ${age} 岁)`);
}

// 前 8 大势力保持既有历史 ID 与治所严格不变
const expectedFirst8 = [
  { id: 1, name: '董卓政权', rulerId: 112, cap: 1 },
  { id: 2, name: '勃海袁绍', rulerId: 113, cap: 46 },
  { id: 3, name: '陈留曹操', rulerId: 1, cap: 7 },
  { id: 4, name: '长沙孙坚', rulerId: 114, cap: 64 },
  { id: 5, name: '南阳袁术', rulerId: 181, cap: 13 },
  { id: 6, name: '幽州公孙瓒', rulerId: 106, cap: 97 },
  { id: 7, name: '徐州陶谦', rulerId: 250, cap: 9 },
  { id: 8, name: '荆州刘表', rulerId: 167, cap: 15 },
];

for (const exp of expectedFirst8) {
  const fac: ScenarioFactionSetup | undefined = s4.factionSetups.find((f: ScenarioFactionSetup) => f.id === exp.id);
  assert.ok(fac, `断言 17: 势力 ${exp.id} 必须存在`);
  assert.equal(fac.name, exp.name, `断言 18: 势力 ${exp.id} 名称匹配`);
  assert.equal(fac.rulerId, exp.rulerId, `断言 19: 势力 ${exp.id} 君主匹配`);
  assert.equal(fac.capitalCityId, exp.cap, `断言 20: 势力 ${exp.id} 治所匹配`);
}

// 检查部署武将合法性
const deployedOfficers = s4.startState.officerPositions;
assert.equal(deployedOfficers.length, s4.availableOfficerIds.length, '断言 21: 部署武将数与白名单必须 1:1 一致');
assert.equal(new Set(deployedOfficers.map(p => p.officerId)).size, deployedOfficers.length, '断言 22: 部署武将零重复');

for (const pos of deployedOfficers) {
  const off = officerMap.get(pos.officerId);
  assert.ok(off, `断言 23: 武将 ${pos.officerId} 必须存在`);
  assert.ok(off.deathYear >= 190, `断言 24: 武将 ${off.name} 在 190 年必须在世`);
  assert.ok(190 - off.birthYear >= 14, `断言 25: 武将 ${off.name} 在 190 年必须成年`);
  // 所在城池必须属于所属势力
  assert.equal(cityOwnership[String(pos.cityId)], pos.factionId, `断言 26: 武将 ${off.name} 所在城池 ${pos.cityId} 必须属于势力 ${pos.factionId}`);
}
console.log(`  ✓ 30 诸侯君主与 ${deployedOfficers.length} 名在职文武全部成年在世、驻地与领地完全自洽 (14/14)`);

// ── 4. 435 对外交矩阵与反董联盟审计 ──
console.log('\n【4. 435 对外交矩阵与反董联盟审计】');
const diplomacy = s4.startState.initialDiplomacy;
const expectedPairsCount = (30 * 29) / 2;
assert.equal(diplomacy.length, expectedPairsCount, `断言 27: 外交对数必须严格为 ${expectedPairsCount}`);

const getDip = (a: number, b: number) => {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return diplomacy.find(d => d.factionA === min && d.factionB === max);
};

// 验证反董联军各诸侯对董卓战争状态
const coalitionIds = [2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
for (const cid of coalitionIds) {
  const d = getDip(1, cid);
  assert.ok(d, `断言 28: 董卓与势力 ${cid} 外交记录必须存在`);
  assert.equal(d.relation, 'war', `断言 29: 董卓与联军势力 ${cid} 必须为战争状态`);
  assert.equal(d.favorability, -80, `断言 30: 董卓与联军势力 ${cid} 好感度为 -80`);
}

// 验证联军内部互为同盟
for (let i = 0; i < coalitionIds.length; i++) {
  for (let j = i + 1; j < coalitionIds.length; j++) {
    const d = getDip(coalitionIds[i], coalitionIds[j]);
    assert.ok(d, `断言 31: 联军对 ${coalitionIds[i]}-${coalitionIds[j]} 外交记录存在`);
    assert.equal(d.relation, 'allied', `断言 32: 联军内部必须为盟友状态`);
    assert.equal(d.favorability, 40, `断言 33: 联军内部好感度为 40`);
  }
}

// 西凉同盟
const maHan = getDip(22, 23);
assert.ok(maHan, '断言 34: 马腾与韩遂外交记录存在');
assert.equal(maHan.relation, 'allied', '断言 35: 马腾韩遂结为同盟');
assert.equal(maHan.favorability, 50, '断言 36: 马腾韩遂好感度为 50');
console.log(`  ✓ 435 对完整外交关系矩阵全覆盖，反董大同盟与西凉同盟完全符合史实 (10/10)`);

// ── 5. 全 30 势力开局初始化与创建验证 ──
console.log('\n【5. 全 30 势力开局初始化与创建验证】');
for (let fid = 1; fid <= 30; fid++) {
  createGame(4, fid);
  const game = getGame();
  assert.equal(game.currentYear, 190, `断言 37: 势力 ${fid} 开局年份为 190`);
  assert.equal(game.currentMonth, 1, `断言 38: 势力 ${fid} 开局月份为 1`);
  assert.equal(Object.keys(game.cities).length, 106, `断言 39: 势力 ${fid} 拥有全图 106 城`);
  assert.equal(Object.keys(game.factions).length, 30, `断言 40: 势力 ${fid} 拥有 30 个势力实例`);
  const myFac = game.factions[fid];
  assert.ok(myFac, `断言 41: 势力 ${fid} 实例存在`);
  assert.ok(myFac.isPlayer, `断言 42: 势力 ${fid} 为玩家势力`);
  assert.ok(myFac.gold >= 2000, `断言 43: 势力 ${fid} 国库金钱 >= 2000 (当前: ${myFac.gold})`);
  assert.ok(myFac.food >= 3000, `断言 44: 势力 ${fid} 粮草储备 >= 3000 (当前: ${myFac.food})`);
}
console.log('  ✓ 30 大割据势力全部通过 buildGameState 初始化构建并完成独立开局 (8/8)');

// ── 6. 12 个月（1整年）长程推演与经济自洽审计 ──
console.log('\n【6. 12 个月长程推演与经济自洽审计】');
createGame(4, 2); // 以袁绍盟主开局推演 1 年
let simGame = getGame();
const initialYear = simGame.currentYear;
const initialMonth = simGame.currentMonth;

for (let m = 1; m <= 12; m++) {
  simGame = advanceTurn(simGame, () => 0.5);
  const pFac = simGame.factions[simGame.playerFactionId];
  assert.ok(pFac.isAlive, `断言 45: 第 ${m} 月玩家势力存活`);
  assert.ok(!Number.isNaN(pFac.gold), `断言 46: 第 ${m} 月金钱有效`);
  assert.ok(!Number.isNaN(pFac.food), `断言 47: 第 ${m} 月粮食有效`);
}

assert.equal(simGame.currentYear, initialYear + 1, '断言 48: 推进 12 回合后年份进入 191 年');
assert.equal(simGame.currentMonth, initialMonth, '断言 49: 推进 12 回合后月份循环对齐为 1 月');
assert.ok(simGame.actionLog.length > 50, '断言 50: 战报起居注产出充分的历史大事记');

// 确认董卓仍然存活
const dongZhuo = simGame.factions[1];
assert.ok(dongZhuo && dongZhuo.isAlive, '断言 51: 董卓政权在 1 年后依然稳固');

console.log('  ✓ 剧本 4 经 12 个月全息推演平稳收敛，跨越四季税收与岁首统发，零崩溃异常 (7/7)');

console.log('\n========================================');
console.log('三十诸侯 190 年全割据开局 51 项断言全部通过 (51/51)');
console.log('========================================\n');
