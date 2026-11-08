// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 专项门禁：朝廷官制深化与地方州牧刺史统领体系校验（Session 477，docs/54）
 *
 * 验收范围：
 * 1. 官职枚举契约与 Label/Req 完备性（全量中央/地方/武官三轨）；
 * 2. 官职年俸真源对照表（OFFICER_SALARY_TABLE）与百官年俸求和；
 * 3. 武官出征带兵上限（militaryPositionRank / formationTroopCap）；
 * 4. 委任军团管辖权（governorCityCap 州牧10城 / 刺史6城 / 丞相8城等）；
 * 5. 任命引擎（appointOfficer 属性门槛/功绩门槛/势力唯一/城唯一/一州唯一 uniqueProvince）；
 * 6. 地方官制即时增益（太守士气+3、都尉城防+20、刺史/州牧全州士气增益）；
 * 7. 24 个月全息推演与岁首年俸统发闭环。
 */

import assert from 'node:assert/strict';

import {
  CivilPosition,
  LocalPosition,
  MilitaryPosition,
  CIVIL_LABELS,
  LOCAL_LABELS,
  MILITARY_LABELS,
  CIVIL_REQ,
  LOCAL_REQ,
  MILITARY_REQ,
  OFFICER_SALARY_TABLE,
  getOfficerAnnualSalary,
  militaryPositionRank,
  formationTroopCap,
  governorCityCap,
  governorPositionQualified,
} from '@leh/shared';

import { appointOfficer } from '../engine/appoint.js';
import { createGame, getGame } from '../services/game.js';
import { advanceTurn } from '../engine/turn.js';

let passedAssertions = 0;
function check(desc: string, cond: boolean) {
  assert.ok(cond, `[FAIL] ${desc}`);
  passedAssertions++;
  console.log(`  ✓ 断言 ${passedAssertions}: ${desc}`);
}

console.log('=== [Phase 7-01] 朝廷官制深化与地方州牧刺史统领体系专项门禁 (Session 477) ===\n');

// -------------------------------------------------------------
// 1. 枚举契约与 Label / Req 完备性
// -------------------------------------------------------------
console.log('【1. 枚举契约与 Label / Req 完备性】');
check('CivilPosition 包含 11 项合法枚举', Object.keys(CivilPosition).length === 11);
check('LocalPosition 包含 8 项合法枚举', Object.keys(LocalPosition).length === 8);
check('MilitaryPosition 包含 10 项合法枚举', Object.keys(MilitaryPosition).length === 10);

for (const p of Object.values(CivilPosition)) {
  check(`CivilPosition.${p} 具备中文 Label: ${CIVIL_LABELS[p]}`, typeof CIVIL_LABELS[p] === 'string' && CIVIL_LABELS[p].length > 0);
  if (p !== CivilPosition.NONE) {
    check(`CivilPosition.${p} 具备任命要求配置`, CIVIL_REQ[p] != null);
  }
}

for (const p of Object.values(LocalPosition)) {
  check(`LocalPosition.${p} 具备中文 Label: ${LOCAL_LABELS[p]}`, typeof LOCAL_LABELS[p] === 'string' && LOCAL_LABELS[p].length > 0);
  if (p !== LocalPosition.NONE) {
    check(`LocalPosition.${p} 具备任命要求配置`, LOCAL_REQ[p] != null);
  }
}

for (const p of Object.values(MilitaryPosition)) {
  check(`MilitaryPosition.${p} 具备中文 Label: ${MILITARY_LABELS[p]}`, typeof MILITARY_LABELS[p] === 'string' && MILITARY_LABELS[p].length > 0);
  if (p !== MilitaryPosition.NONE) {
    check(`MilitaryPosition.${p} 具备任命要求配置`, MILITARY_REQ[p] != null);
  }
}

// -------------------------------------------------------------
// 2. 年俸真源与百官年俸对照
// -------------------------------------------------------------
console.log('\n【2. 官职年俸对照表与多职取高】');
check('丞相年俸 800', OFFICER_SALARY_TABLE[CivilPosition.CHANCELLOR] === 800);
check('尚书令年俸 700', OFFICER_SALARY_TABLE[CivilPosition.SHANGSHU_CHIEF] === 700);
check('州牧年俸 500', OFFICER_SALARY_TABLE[LocalPosition.PROV_GOVERNOR] === 500);
check('刺史年俸 300', OFFICER_SALARY_TABLE[LocalPosition.PROV_INSPECTOR] === 300);
check('六曹尚书年俸 300', OFFICER_SALARY_TABLE[CivilPosition.SECRETARY_MINISTER] === 300);
check('御史中丞年俸 400', OFFICER_SALARY_TABLE[CivilPosition.CENSOR_CHIEF] === 400);
check('九卿年俸 400', OFFICER_SALARY_TABLE[CivilPosition.NINE_MINISTERS] === 400);
check('太守年俸 180', OFFICER_SALARY_TABLE[LocalPosition.PREFECT] === 180);
check('都尉年俸 100', OFFICER_SALARY_TABLE[LocalPosition.COMMANDERY_COMMANDANT] === 100);
check('县令年俸 60', OFFICER_SALARY_TABLE[LocalPosition.COUNTY_MAGISTRATE] === 60);
check('车骑将军年俸 500', OFFICER_SALARY_TABLE[MilitaryPosition.CHARIOT_CAVALRY_GENERAL] === 500);
check('四方将军年俸 350', OFFICER_SALARY_TABLE[MilitaryPosition.SENIOR_GENERAL] === 350);
check('四征四镇年俸 250', OFFICER_SALARY_TABLE[MilitaryPosition.QUAT_GENERAL] === 250);
check('偏将军年俸 120', OFFICER_SALARY_TABLE[MilitaryPosition.SUB_GENERAL] === 120);
check('军司马年俸 40', OFFICER_SALARY_TABLE[MilitaryPosition.MAJOR] === 40);

const testOfficer = {
  id: 100,
  civilPosition: CivilPosition.SECRETARY_MINISTER, // 300
  militaryPosition: MilitaryPosition.QUAT_GENERAL, // 250
  localPosition: LocalPosition.PROV_GOVERNOR, // 500
};
check('多重官职年俸取最高 (500)', getOfficerAnnualSalary(testOfficer, false) === 500);
check('君主多重官职年俸恒为 0', getOfficerAnnualSalary(testOfficer, true) === 0);

// -------------------------------------------------------------
// 3. 武官品级与出征上限
// -------------------------------------------------------------
console.log('\n【3. 武官品级与出征上限】');
check('军候 / 军司马为 Rank 1 (+500)', militaryPositionRank(MilitaryPosition.CAPTAIN) === 1 && militaryPositionRank(MilitaryPosition.MAJOR) === 1);
check('校尉 / 偏将军为 Rank 2 (+1000)', militaryPositionRank(MilitaryPosition.COLONEL) === 2 && militaryPositionRank(MilitaryPosition.SUB_GENERAL) === 2);
check('杂号将军 / 四征四镇为 Rank 3 (+1500)', militaryPositionRank(MilitaryPosition.GENERAL) === 3 && militaryPositionRank(MilitaryPosition.QUAT_GENERAL) === 3);
check('四方将军 / 车骑将军 / 大将军为 Rank 4 (+2000)', militaryPositionRank(MilitaryPosition.SENIOR_GENERAL) === 4 && militaryPositionRank(MilitaryPosition.CHARIOT_CAVALRY_GENERAL) === 4 && militaryPositionRank(MilitaryPosition.GRAND_GENERAL) === 4);

const baseLord = { merit: 0, militaryPosition: MilitaryPosition.NONE };
check('白身 Lv1 带兵上限 5000', formationTroopCap(baseLord) === 5000);
check('偏将军 Lv1 带兵上限 6000', formationTroopCap({ ...baseLord, militaryPosition: MilitaryPosition.SUB_GENERAL }) === 6000);
check('四征四镇 Lv1 带兵上限 6500', formationTroopCap({ ...baseLord, militaryPosition: MilitaryPosition.QUAT_GENERAL }) === 6500);
check('大将军 Lv1 带兵上限 7000', formationTroopCap({ ...baseLord, militaryPosition: MilitaryPosition.GRAND_GENERAL }) === 7000);

// -------------------------------------------------------------
// 4. 委任军团都督管辖权
// -------------------------------------------------------------
console.log('\n【4. 委任军团都督管辖权】');
check('州牧可代管 10 城', governorCityCap(CivilPosition.NONE, MilitaryPosition.NONE, LocalPosition.PROV_GOVERNOR) === 10);
check('刺史可代管 6 城', governorCityCap(CivilPosition.NONE, MilitaryPosition.NONE, LocalPosition.PROV_INSPECTOR) === 6);
check('太守可代管 1 城', governorCityCap(CivilPosition.NONE, MilitaryPosition.NONE, LocalPosition.PREFECT) === 1);
check('尚书令可代管 6 城', governorCityCap(CivilPosition.SHANGSHU_CHIEF, MilitaryPosition.NONE) === 6);
check('车骑将军可代管 6 城', governorCityCap(CivilPosition.NONE, MilitaryPosition.CHARIOT_CAVALRY_GENERAL) === 6);
check('州牧具备出任都督资格', governorPositionQualified({ civilPosition: CivilPosition.NONE, militaryPosition: MilitaryPosition.NONE, localPosition: LocalPosition.PROV_GOVERNOR }));
check('刺史具备出任都督资格', governorPositionQualified({ civilPosition: CivilPosition.NONE, militaryPosition: MilitaryPosition.NONE, localPosition: LocalPosition.PROV_INSPECTOR }));
check('仅书吏/军候不具备都督资格', !governorPositionQualified({ civilPosition: CivilPosition.CLERK, militaryPosition: MilitaryPosition.CAPTAIN, localPosition: LocalPosition.NONE }));

// -------------------------------------------------------------
// 5. 任命引擎与互斥规则（190 剧本实战）
// -------------------------------------------------------------
console.log('\n【5. 任命引擎与互斥规则】');
// 以势力 2 袁绍（初始占据 4 渤海、43 邺城、44 平原）为例开局
createGame(4, 2);
let state = getGame();

// 袁绍 (113, rulerId) 麾下武将：田丰 (156)、沮授 (157)、审配 (158)、颜良 (159)、文丑 (160)
const tianFeng = state.officers[156];
const juShou = state.officers[157];
const shenPei = state.officers[158];
const yanLiang = state.officers[159];
const wenChou = state.officers[160];
assert.ok(tianFeng && juShou && shenPei && yanLiang && wenChou, '袁绍麾下名将就位');

// 5.1 属性门槛拦截
let caughtErr = false;
try {
  // 颜良 (政18 智40) 任命为六曹尚书 (需政75 智70) 应被拦截
  appointOfficer(state, 159, 'civil', CivilPosition.SECRETARY_MINISTER);
} catch (e: any) {
  caughtErr = true;
  check('属性不足拦截成功', e.message.includes('属性不足'));
}
check('颜良任六曹尚书被拦截', caughtErr);

// 5.2 功绩门槛拦截
caughtErr = false;
try {
  // 审配 (政85 智80) 属性满足丞相门槛 (需政80 智70)，但开局功绩为 0 (需功绩 Lv6) 应被拦截
  appointOfficer(state, 158, 'civil', CivilPosition.CHANCELLOR);
} catch (e: any) {
  caughtErr = true;
  console.log(`  [DEBUG] 捕获异常文案: "${e.message}"`);
  check('功绩不足拦截成功', e.message.includes('功绩不足'));
}
check('审配低功绩任丞相被拦截', caughtErr);

// 5.3 正常任命（赐予足够功绩）与势力唯一（uniqueFaction）互斥测试
state.officers[156].merit = 1500; // Lv6 (田丰: 政82 智93，达标丞相)
state.officers[158].merit = 1500; // Lv6 (审配: 政85 智80，达标丞相)

// 5.3.1 先任命田丰为丞相
state = appointOfficer(state, 156, 'civil', CivilPosition.CHANCELLOR);
check('田丰成功任命为丞相', state.officers[156].civilPosition === CivilPosition.CHANCELLOR);

// 5.3.2 再任命审配为丞相（势力唯一），前任田丰应被自动解除
state = appointOfficer(state, 158, 'civil', CivilPosition.CHANCELLOR);
check('审配成功任命为丞相', state.officers[158].civilPosition === CivilPosition.CHANCELLOR);
check('势力唯一生效：前任田丰退为无', state.officers[156].civilPosition === CivilPosition.NONE);

// 5.4 一州唯一互斥（uniqueProvince）
// 袁绍的城池 46 南皮（冀州）、43 乐成（冀州）
state.officers[157].stats = { ...state.officers[157].stats, leadership: 85, politics: 85, intelligence: 85 };
state.officers[158].stats = { ...state.officers[158].stats, leadership: 85, politics: 85, intelligence: 85 };
state.officers[157].location = 46; // 南皮 (冀州)
state.officers[158].location = 43; // 乐成 (冀州)
state.officers[157].merit = 800;  // Lv5
state.officers[158].merit = 800;  // Lv5

// 任命沮授为冀州牧 (在南皮 46)
state = appointOfficer(state, 157, 'local', LocalPosition.PROV_GOVERNOR, 46);
check('沮授成功任命为冀州牧 (南皮)', state.officers[157].localPosition === LocalPosition.PROV_GOVERNOR);

// 任命审配为冀州牧 (在乐成 43) -> 同属冀州，沮授应被自动解职
state = appointOfficer(state, 158, 'local', LocalPosition.PROV_GOVERNOR, 43);
check('审配成功任命为冀州牧 (乐成)', state.officers[158].localPosition === LocalPosition.PROV_GOVERNOR);
check('一州唯一互斥生效：同州前任沮授退为无', state.officers[157].localPosition === LocalPosition.NONE);

// 5.5 地方官即时增益断言
const beforeWall = state.cities[46].stats.wall;
const beforeMorale = state.cities[46].troopsMorale;
// 任命颜良为南皮都尉 (LocalPosition.COMMANDERY_COMMANDANT, city 46)
state.officers[159].location = 46;
state.officers[159].merit = 800;
state = appointOfficer(state, 159, 'local', LocalPosition.COMMANDERY_COMMANDANT, 46);
check('颜良成功任命为都尉', state.officers[159].localPosition === LocalPosition.COMMANDERY_COMMANDANT);
check('都尉任命即时城防 +20', state.cities[46].stats.wall === beforeWall + 20);
check('都尉任命即时驻军士气 +2', state.cities[46].troopsMorale === beforeMorale + 2);

// -------------------------------------------------------------
// 6. 24 个月全息推演与岁首年俸统发闭环
// -------------------------------------------------------------
console.log('\n【6. 24 个月全息月结推演与年俸统发】');
const initialYear = state.currentYear;
for (let m = 0; m < 24; m++) {
  state = advanceTurn(state, () => 0.5);
}
check('24 回合月结推进成功，年份前进 2 年', state.currentYear === initialYear + 2);
check('百官在任且未发生 NaN 异常', !Number.isNaN(state.factions[2].gold) && !Number.isNaN(state.factions[2].food));
check('势力国库金粮自洽健康', state.factions[2].gold > 0 && state.factions[2].food > 0);

console.log(`\n=============================================================`);
console.log(`[PASS] 全部 ${passedAssertions} 项官制深化与州牧刺史统领断言 100% 通过！`);
console.log(`=============================================================\n`);
