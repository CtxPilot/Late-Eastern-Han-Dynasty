// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-06 专项验收门禁：战阵创伤、伤兵营收治与杏林医馆体系全栈集成 (Session 482)
 *
 * 验证矩阵：
 * 1. 战损 40%/60% 分流纯函数精度与边界防御（calculateCasualtySplit）
 * 2. 武将创伤等级与行动惩罚（0~4 级战力削弱、中伤禁单挑、重伤禁出征行军）
 * 3. 伤兵营月度回流模型（基础 10%、医馆拨款、城池卫生、驻城医官、药材特产）
 * 4. 引擎层医馆拨款注资与派医施救事务闭环（资金扣减、状态时效、创伤降级、异常拦截）
 * 5. 月度演化管线闭环（无伤局严格 COW 零分配零 RNG、月度伤兵回流入驻军、武将自然康复消解）
 * 6. 24 个月全息推演闭环（真实 Scenario 1 推进 24 回合、伤员稳定回流、创伤平稳痊愈）
 * 7. 服务层与 HTTP/Worker 接口完备性校验
 */

import assert from 'node:assert';
import {
  InjuryLevel,
  calculateCasualtySplit,
  calculateMonthlyWoundedRecoveryRate,
  calculateInjuryCombatPenalty,
  getHealingMonthsRequired,
  isOfficerInjured,
  hasMedicalSkill,
  HOSPITAL_FUNDING_COST,
  HOSPITAL_FUNDING_DURATION,
  CURE_COST_BY_INJURY,
  type GameState,
  type City,
  type Officer,
} from '@leh/shared';
import {
  createGame,
  getGame,
  doFundCityHospital,
  doCureOfficerInjury,
  doRecordBattleCasualties,
  doGetHospitalSummary,
} from '../services/game.js';
import {
  fundCityHospital,
  cureOfficerInjury,
  recordBattleCasualties,
  tickCasualtiesAndHospitalMonth,
} from '../engine/hospital.js';
import { advanceTurn } from '../engine/turn.js';

let step = 0;
function check(description: string, condition: boolean) {
  step++;
  assert.ok(condition, `[FAIL] 断言 ${step}: ${description}`);
  console.log(`  ✓ 断言 ${step}: ${description}`);
}

console.log('=== [Phase 7-06] 战阵创伤、伤兵营收治与杏林医馆体系全栈验收门禁 (Session 482) ===\n');

// -------------------------------------------------------------
// 1. 战损 40%/60% 分流纯函数精度与边界防御
// -------------------------------------------------------------
console.log('【1. 战损 40%/60% 分流纯函数精度与边界防御】');

const split1000 = calculateCasualtySplit(1000);
check('1000 战损精确分流为 400 永久阵亡与 600 伤兵', split1000.dead === 400 && split1000.wounded === 600);
check('阵亡与伤兵总和恒等于总战损', split1000.dead + split1000.wounded === 1000);

const split3500 = calculateCasualtySplit(3500);
check('3500 战损分流为 1400 阵亡与 2100 伤兵', split3500.dead === 1400 && split3500.wounded === 2100);

const splitOdd = calculateCasualtySplit(333);
check('奇数战损分流保持总和守恒', splitOdd.dead + splitOdd.wounded === 333);

const splitZero = calculateCasualtySplit(0);
check('0 战损安全返回 0/0', splitZero.dead === 0 && splitZero.wounded === 0);

const splitNeg = calculateCasualtySplit(-100);
check('负数战损安全返回 0/0', splitNeg.dead === 0 && splitNeg.wounded === 0);

// -------------------------------------------------------------
// 2. 武将创伤等级与行动惩罚模型
// -------------------------------------------------------------
console.log('\n【2. 武将创伤等级与战力削弱行动惩罚】');

// 0 - 健康
const p0 = calculateInjuryCombatPenalty(InjuryLevel.HEALTHY);
check('健康武将武力统帅无折损 (1.0x)', p0.forceModifier === 1.0 && p0.commandModifier === 1.0);
check('健康武将允许单挑且允许行军出征', p0.canDuel === true && p0.canMarch === true);
check('健康标签为「健康」', p0.label === '健康');

// 1 - 轻伤
const p1 = calculateInjuryCombatPenalty(InjuryLevel.MILD);
check('轻伤武将武力统帅微削 5% (0.95x)', p1.forceModifier === 0.95 && p1.commandModifier === 0.95);
check('轻伤武将仍允许出征与单挑', p1.canDuel === true && p1.canMarch === true);
check('轻伤标签为「轻伤」', p1.label === '轻伤');

// 2 - 中伤
const p2 = calculateInjuryCombatPenalty(InjuryLevel.MODERATE);
check('中伤武将武力削减 15% (0.85x)', p2.forceModifier === 0.85);
check('中伤武将严格禁止单挑 (canDuel === false)', p2.canDuel === false);
check('中伤武将仍可随军行军 (canMarch === true)', p2.canMarch === true);
check('中伤标签为「中伤」', p2.label === '中伤');

// 3 - 重伤
const p3 = calculateInjuryCombatPenalty(InjuryLevel.SEVERE);
check('重伤武将全属性削减 20% (0.80x)', p3.allModifier === 0.80);
check('重伤武将禁止单挑 (canDuel === false)', p3.canDuel === false);
check('重伤武将禁止出征与行军 (canMarch === false)', p3.canMarch === false);
check('重伤标签为「重伤」', p3.label === '重伤');

// 4 - 濒死
const p4 = calculateInjuryCombatPenalty(InjuryLevel.CRITICAL);
check('濒死武将全属性削减 40% (0.60x)', p4.allModifier === 0.60);
check('濒死武将禁止单挑与行军', p4.canDuel === false && p4.canMarch === false);
check('濒死标签为「濒死」', p4.label === '濒死');

// 康复月数与费用映射
check('轻伤自然康复门槛为 2 个月', getHealingMonthsRequired(InjuryLevel.MILD) === 2);
check('中伤自然康复门槛为 4 个月', getHealingMonthsRequired(InjuryLevel.MODERATE) === 4);
check('重伤自然康复门槛为 6 个月', getHealingMonthsRequired(InjuryLevel.SEVERE) === 6);
check('濒死自然康复门槛为 12 个月', getHealingMonthsRequired(InjuryLevel.CRITICAL) === 12);

check('医馆注资基准工本费为 100 贯', HOSPITAL_FUNDING_COST === 100);
check('医馆注资时效为 3 个月', HOSPITAL_FUNDING_DURATION === 3);
check('中伤派医施治费用为 100 金', CURE_COST_BY_INJURY[InjuryLevel.MODERATE] === 100);
check('重伤派医施治费用为 200 金', CURE_COST_BY_INJURY[InjuryLevel.SEVERE] === 200);

// -------------------------------------------------------------
// 3. 伤兵营月度回流模型
// -------------------------------------------------------------
console.log('\n【3. 伤兵营月度回流与医疗加速模型】');

const mockCityA: City = {
  id: 1,
  name: '许昌',
  province: '豫州',
  x: 100,
  y: 100,
  population: 50000,
  troops: 5000,
  troopsMorale: 80,
  stats: {
    farm: 200,
    commerce: 200,
    wall: 100,
    morale: 80,
    sanitation: 50,
  },
  ruler: 1,
  officers: [],
} as unknown as City;

const rateBase = calculateMonthlyWoundedRecoveryRate({ city: mockCityA });
check('普通城池基础伤兵回流率为 10%', Math.abs(rateBase - 0.10) < 1e-4);

const cityFunded: City = {
  ...mockCityA,
  hospitalFundedMonths: 3,
};
const rateFunded = calculateMonthlyWoundedRecoveryRate({ city: cityFunded });
check('官办医馆拨款注资享有 +10% 恢复加速 (达 20%)', Math.abs(rateFunded - 0.20) < 1e-4);

const citySanitation: City = {
  ...mockCityA,
  stats: {
    ...mockCityA.stats,
    sanitation: 85,
  },
};
const rateSanitation = calculateMonthlyWoundedRecoveryRate({ city: citySanitation });
check('城市卫生达标 (>=80) 享有 +5% 治愈加成 (达 15%)', Math.abs(rateSanitation - 0.15) < 1e-4);

const doctorOfficer: Officer = {
  id: 101,
  name: '华佗',
  skills: [{ skillId: 'medicine', level: 1, useCount: 0 }],
} as unknown as Officer;
check('华佗被准确识别具备医术特性', hasMedicalSkill(doctorOfficer) === true);

const rateDoctor = calculateMonthlyWoundedRecoveryRate({
  city: mockCityA,
  officersInCity: [doctorOfficer],
});
check('驻城名医提供 +10% 医疗加速 (达 20%)', Math.abs(rateDoctor - 0.20) < 1e-4);

const rateAllBuffs = calculateMonthlyWoundedRecoveryRate({
  city: cityFunded,
  officersInCity: [doctorOfficer],
  hasHerbSupply: true,
});
// 0.10 + 0.10(fund) + 0.10(doc) + 0.05(herb) = 0.35
check('多重医疗增益叠加回流率达 35%', Math.abs(rateAllBuffs - 0.35) < 1e-4);

// -------------------------------------------------------------
// 4. 引擎层医馆拨款注资与派医施救事务闭环
// -------------------------------------------------------------
console.log('\n【4. 引擎层医馆拨款注资与派医施救事务闭环】');

let game = createGame(1, 1); // 190年反董卓同盟 曹操
const xuchang = Object.values(game.cities).find((c) => c.name === '许昌') ?? game.cities[1];
assert.ok(xuchang, '初始剧本必须包含许昌');

// 1) 战损分流入册 recordBattleCasualties
const initTroops = xuchang.troops;
const recordState = recordBattleCasualties(game, xuchang.id, 1000);
check('战损分流正确为许昌伤兵营增加 600 伤兵', recordState.cities[xuchang.id].woundedTroops === 600);
check('战损分流不直接破坏城池驻军基数', recordState.cities[xuchang.id].troops === initTroops);

// 2) 官办医馆注资 fundCityHospital
const oldGold = recordState.cities[xuchang.id].gold;
const fundedState = fundCityHospital(recordState, xuchang.id);
check('医馆拨款正确扣减发起城池 100 贯工本费', fundedState.cities[xuchang.id].gold === oldGold - HOSPITAL_FUNDING_COST);
check('医馆获得 3 个月强化时效', fundedState.cities[xuchang.id].hospitalFundedMonths === HOSPITAL_FUNDING_DURATION);
check('生成了医馆拨款的政令日志', fundedState.actionLog.some((l) => l.type === 'hospital_funded'));

// 资金不足拦截
const poorState: GameState = {
  ...fundedState,
  cities: {
    ...fundedState.cities,
    [xuchang.id]: {
      ...fundedState.cities[xuchang.id],
      gold: 10,
    },
  },
};
let fundError = '';
try {
  fundCityHospital(poorState, xuchang.id);
} catch (e) {
  fundError = e instanceof Error ? e.message : String(e);
}
check('金钱不足 100 贯时注资医馆被合法拦截', fundError.includes('城中资金不足'));

// 3) 派医施救武将创伤 cureOfficerInjury
const caocao = fundedState.officers[1];
assert.ok(caocao, '武将 1 曹操必须存在');

// 无伤武将施治拦截
let healthyCureError = '';
try {
  cureOfficerInjury(fundedState, caocao.id, fundedState.playerFactionId);
} catch (e) {
  healthyCureError = e instanceof Error ? e.message : String(e);
}
check('对健康无伤武将施治被拦截', healthyCureError.includes('未受任何战伤'));

// 模拟曹操受重伤 (Lv3)
const injuredState: GameState = {
  ...fundedState,
  officers: {
    ...fundedState.officers,
    [caocao.id]: {
      ...caocao,
      injury: InjuryLevel.SEVERE,
      injuryMonths: 3,
      location: xuchang.id,
    },
  },
};
check('准确识别曹操处于负伤状态', isOfficerInjured(injuredState.officers[caocao.id]) === true);

const goldBeforeCure = injuredState.cities[xuchang.id].gold;
const curedState = cureOfficerInjury(injuredState, caocao.id, injuredState.playerFactionId);
check('派医施治重伤扣除 200 金诊费', curedState.cities[xuchang.id].gold === goldBeforeCure - CURE_COST_BY_INJURY[InjuryLevel.SEVERE]);
check('派医施治后曹操重伤降级为中伤 (Lv2)', curedState.officers[caocao.id].injury === InjuryLevel.MODERATE);
check('生成了名医诊治行动日志', curedState.actionLog.some((l) => l.type === 'officer_injury_cured'));

// 再次施治中伤降级为轻伤
const cured2State = cureOfficerInjury(curedState, caocao.id, curedState.playerFactionId);
check('再次施治中伤降级为轻伤 (Lv1)', cured2State.officers[caocao.id].injury === InjuryLevel.MILD);

// 第三次施治彻底痊愈
const curedFinalState = cureOfficerInjury(cured2State, caocao.id, cured2State.playerFactionId);
check('第三次施治轻伤降级为健康 (Lv0)', curedFinalState.officers[caocao.id].injury === InjuryLevel.HEALTHY);
check('痊愈后负伤月数彻底清零', curedFinalState.officers[caocao.id].injuryMonths === 0);

// -------------------------------------------------------------
// 5. 月度演化管线闭环 (tickCasualtiesAndHospitalMonth)
// -------------------------------------------------------------
console.log('\n【5. 月度演化管线闭环与零漂移验证】');

// 1) 无伤员局严格 COW 零分配与零漂移
const pristineState = createGame(1, 1);
const tickPristine = tickCasualtiesAndHospitalMonth(pristineState);
check('无伤员局 tickCasualtiesAndHospitalMonth 返回完全相同的原引用 (严格 COW)', tickPristine === pristineState);

// 2) 伤兵回流与医馆月份流逝
const monthTestState: GameState = {
  ...pristineState,
  cities: {
    ...pristineState.cities,
    [xuchang.id]: {
      ...pristineState.cities[xuchang.id],
      troops: 5000,
      woundedTroops: 600,
      hospitalFundedMonths: 3,
    },
  },
  officers: {
    ...pristineState.officers,
    [caocao.id]: {
      ...caocao,
      injury: InjuryLevel.MILD,
      injuryMonths: 1, // 已负伤 1 个月，门槛为 2 个月
    },
  },
};

const tick1 = tickCasualtiesAndHospitalMonth(monthTestState);
check('月结后许昌驻军获得伤兵康复回流增长', tick1.cities[xuchang.id].troops > 5000);
check('月结后伤兵营在册伤兵数显著减少', (tick1.cities[xuchang.id].woundedTroops ?? 0) < 600);
check('医馆注资剩余月份递减为 2 个月', tick1.cities[xuchang.id].hospitalFundedMonths === 2);
check('曹操负伤月数自增为 2 个月并达到轻伤痊愈门槛', tick1.officers[caocao.id].injury === InjuryLevel.HEALTHY);
check('轻伤满期自然痊愈生成喜报日志', tick1.actionLog.some((l) => l.type === 'officer_injury_healed'));

// -------------------------------------------------------------
// 6. 24 个月全息推演闭环
// -------------------------------------------------------------
console.log('\n【6. 24 个月全息推演闭环】');

let simState = createGame(1, 1);
const simCity = Object.values(simState.cities).find((c) => c.name === '许昌') ?? simState.cities[1];
const simOfficer = simState.officers[1];

// 注入 1200 伤兵并为曹操附加中伤 (Lv2, 门槛 4 个月)
simState = {
  ...simState,
  cities: {
    ...simState.cities,
    [simCity.id]: {
      ...simState.cities[simCity.id],
      woundedTroops: 1200,
      hospitalFundedMonths: 3,
    },
  },
  officers: {
    ...simState.officers,
    [simOfficer.id]: {
      ...simOfficer,
      injury: InjuryLevel.MODERATE,
      injuryMonths: 0,
    },
  },
};

const startY = simState.currentYear;
const startM = simState.currentMonth;
let current = simState;

for (let m = 0; m < 24; m++) {
  current = advanceTurn(current, () => 0.5);
}

check('24 个月全息推进后年份增长 2 年', current.currentYear === startY + 2 && current.currentMonth === startM);
check('24 个月推演中伤兵营 1200 伤兵已全部康复归队', (current.cities[simCity.id].woundedTroops ?? 0) === 0);
check('24 个月推演中中伤曹操已自然痊愈 (Lv0)', (current.officers[simOfficer.id].injury ?? 0) === InjuryLevel.HEALTHY);
check('推演终态全图城池驻军无 NaN 异常', !isNaN(current.cities[simCity.id].troops));

// -------------------------------------------------------------
// 7. 服务层与 HTTP/Worker 接口完备性
// -------------------------------------------------------------
console.log('\n【7. 服务层与 HTTP/Worker 接口完备性校验】');

// 重新建立当前服务全局游戏
createGame(1, 1);
const sGame = getGame();
const sCity = Object.values(sGame.cities).find((c) => c.name === '许昌') ?? sGame.cities[1];

// 初始摘要
const initSummary = doGetHospitalSummary(sCity.id);
check('初始许昌伤兵营伤兵为 0', initSummary.cities[0]?.woundedTroops === 0);

// 登记战损入册
doRecordBattleCasualties(sCity.id, 500);
const afterLossSummary = doGetHospitalSummary(sCity.id);
check('doRecordBattleCasualties 成功将 500 战损中的 300 伤兵入册', afterLossSummary.cities[0]?.woundedTroops === 300);

// 拨款注资
doFundCityHospital(sCity.id);
const afterFundSummary = doGetHospitalSummary(sCity.id);
check('doFundCityHospital 成功建立 3 个月医馆注资', afterFundSummary.cities[0]?.hospitalFundedMonths === 3);

// 派医施救
getGame().officers[1].injury = InjuryLevel.MILD;
const beforeCureSummary = doGetHospitalSummary();
check('摘要准确识别势力内负伤武将', beforeCureSummary.injuredOfficers.length === 1);

doCureOfficerInjury(1);
const afterCureSummary = doGetHospitalSummary();
check('doCureOfficerInjury 成功治愈武将创伤', afterCureSummary.injuredOfficers.length === 0);

console.log(`\n=============================================================`);
console.log(`  Phase 7-06 专案验收门禁全部通过！累计通过 ${step} 项断言！`);
console.log(`=============================================================\n`);
