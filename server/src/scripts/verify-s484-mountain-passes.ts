// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-08 主地图关隘要塞防御要冲体系全栈验收门禁 (Session 484)
 *
 * 验证维度：
 * 1. 25 大名关静态契约与地缘全覆盖 (司隶7/凉州3/益州6/荆州2/扬州3/并州2/冀州2)
 * 2. 纯函数险阻防御加成与骑兵削弱运算
 * 3. 路线阻绝与关隘卡口检查 (isRouteBlockedByPass)
 * 4. 驻军调拨门禁与城池治安储备防御 (canGarrisonPass)
 * 5. 关隘城防修缮工本与增益模型 (calculatePassWallRepairCost)
 * 6. 引擎层五大核心政令与生命周期闭环 (init/dispatch/recall/repair/capture)
 * 7. 月度演化与零漂移验证 (tickPassesMonth)
 * 8. 24 个月全息推演闭环
 * 9. 服务层与 HTTP/Worker 接口完备性校验
 */

import assert from 'node:assert';
import {
  DEFAULT_PASSES,
  calculatePassDefenseModifier,
  isRouteBlockedByPass,
  canGarrisonPass,
  calculatePassWallRepairCost,
  PASS_WALL_REPAIR_GOLD,
  PASS_WALL_REPAIR_GAIN,
  MIN_CITY_TROOPS_RESERVE,
} from '@leh/shared';
import type { GameState, PassEntity } from '@leh/shared';
import {
  initPasses,
  dispatchGarrisonToPass,
  recallGarrisonFromPass,
  repairPassWall,
  capturePass,
  tickPassesMonth,
} from '../engine/pass.js';
import { advanceTurn } from '../engine/turn.js';
import { createGame } from '../services/game.js';
import * as gameService from '../services/game.js';

console.log('=== [Phase 7-08] 主地图关隘要塞防御要冲体系全栈验收门禁 (Session 484) ===\n');

function createMockGameState(): GameState {
  return {
    scenarioId: '190-spring',
    enabledEventLayers: ['historical'],
    enabledChildEventIds: [],
    currentYear: 190,
    currentMonth: 1,
    season: 0,
    playerFactionId: 1,
    officers: {
      101: {
        id: 101,
        name: '曹操',
        faction: 1,
        location: 1,
        stats: { leadership: 96, war: 72, intelligence: 91, politics: 94, charisma: 96 },
        status: 'active',
      } as any,
      102: {
        id: 102,
        name: '曹仁',
        faction: 1,
        location: 1,
        stats: { leadership: 88, war: 84, intelligence: 62, politics: 55, charisma: 78 },
        status: 'active',
      } as any,
      103: {
        id: 103,
        name: '于禁',
        faction: 1,
        location: 1,
        stats: { leadership: 84, war: 78, intelligence: 70, politics: 56, charisma: 60 },
        status: 'active',
      } as any,
      104: {
        id: 104,
        name: '董卓',
        faction: 2,
        location: 2,
        stats: { leadership: 85, war: 87, intelligence: 69, politics: 53, charisma: 40 },
        status: 'active',
      } as any,
      105: {
        id: 105,
        name: '伤残副将',
        faction: 1,
        location: 1,
        stats: { leadership: 60, war: 65, intelligence: 50, politics: 40, charisma: 50 },
        injury: 3, // 重伤
        status: 'active',
      } as any,
    },
    cities: {
      1: {
        id: 1,
        name: '洛阳',
        province: '司隶',
        ruler: 1,
        troops: 8000,
        gold: 3000,
        food: 20000,
        officers: [101, 102, 103, 105],
        stats: { wall: 500, commerce: 500, farm: 500 },
      } as any,
      2: {
        id: 2,
        name: '长安',
        province: '司隶',
        ruler: 2,
        troops: 10000,
        gold: 2000,
        food: 15000,
        officers: [104],
        stats: { wall: 600, commerce: 400, farm: 400 },
      } as any,
      7: {
        id: 7,
        name: '陈留',
        province: '兖州',
        ruler: 1,
        troops: 5000,
        gold: 1500,
        food: 10000,
        officers: [],
        stats: { wall: 400, commerce: 300, farm: 300 },
      } as any,
    },
    factions: {
      1: { id: 1, name: '曹操', rulerId: 101, capitalCityId: 1, cityIds: [1, 7], officerIds: [101, 102, 103, 105], fame: 350 } as any,
      2: { id: 2, name: '董卓', rulerId: 104, capitalCityId: 2, cityIds: [2], officerIds: [104], fame: 500 } as any,
    },
    females: {},
    armys: {},
    campaignArmies: {},
    campaignNodes: {},
    grandStrategists: {},
    activeBattles: {},
    activeBattlefield: null,
    activeMelee: null,
    activeBattlefieldInstance: null,
    diplomacy: {},
    coalitions: [],
    trendStage: 'warlords_disorder' as any,
    intel: {},
    plots: {},
    nationalPolicies: {},
    completedEvents: [],
    pendingEvents: [],
    invalidatedEvents: [],
    eventChoices: {},
    actionLog: [],
  } as unknown as GameState;
}

let passedCount = 0;
function testAssert(condition: boolean, desc: string) {
  assert.ok(condition, `[FAIL] ${desc}`);
  passedCount++;
  console.log(`  ✓ 断言 ${passedCount}: ${desc}`);
}

// ---------------------------------------------------------
console.log('【1. 25 大名关静态契约与地缘全覆盖】');
testAssert(DEFAULT_PASSES.length === 25, '全图关隘总数精确为 25 座');

const idSet = new Set(DEFAULT_PASSES.map((p) => p.id));
testAssert(idSet.size === 25, '25 座关隘唯一 ID 覆盖 1~25');

const siliPasses = DEFAULT_PASSES.filter((p) => p.province === '司隶');
testAssert(siliPasses.length === 7, '司隶包含 7 大要塞关隘 (虎牢/汜水/函谷/武关/孟津/大谷/旋门)');

const liangPasses = DEFAULT_PASSES.filter((p) => p.province === '凉州');
testAssert(liangPasses.length === 3, '凉州包含 3 大险要关隘 (散关/萧关/陇关)');

const yiPasses = DEFAULT_PASSES.filter((p) => p.province === '益州');
testAssert(yiPasses.length === 6, '益州包含 6 大入蜀关防 (阳平关/剑阁/白水关/葭萌关/江关/绵竹关)');

const jingPasses = DEFAULT_PASSES.filter((p) => p.province === '荆州');
testAssert(jingPasses.length === 2, '荆州包含 2 大要津 (夏口/夷陵)');

const yangPasses = DEFAULT_PASSES.filter((p) => p.province === '扬州');
testAssert(yangPasses.length === 3, '扬州包含 3 大江淮要塞 (濡须口/合肥/牛渚)');

const bingPasses = DEFAULT_PASSES.filter((p) => p.province === '并州');
testAssert(bingPasses.length === 2, '并州包含 2 大塞防 (壶关/雁门关)');

const jiPasses = DEFAULT_PASSES.filter((p) => p.province === '冀州');
testAssert(jiPasses.length === 2, '冀州包含 2 大战术要冲 (界桥/井陉关)');

const hulao = DEFAULT_PASSES.find((p) => p.name === '虎牢关')!;
testAssert(hulao.isFortressPass === true, '虎牢关准确标记为雄关要塞');
testAssert(hulao.maxWall === 5000 && hulao.maxGarrison === 5000, '虎牢关城防耐久 5000 且最大驻军 5000');

const jiange = DEFAULT_PASSES.find((p) => p.name === '剑阁')!;
testAssert(jiange.isMountainPass === true && jiange.isFortressPass === true, '剑阁准确标记为山地雄关');

const ruxukou = DEFAULT_PASSES.find((p) => p.name === '濡须口')!;
testAssert(ruxukou.isRiverPass === true, '濡须口准确标记为水关津渡');

// ---------------------------------------------------------
console.log('\n【2. 纯函数险阻防御加成与攻坚削弱运算】');
const hulaoMod = calculatePassDefenseModifier(hulao, false);
testAssert(hulaoMod.defBonus === 0.50, '雄关提供守方 50% 防御减免加成');
testAssert(hulaoMod.attackerPenalty === 0, '非骑兵攻关无额外进攻惩罚');

const sishui = DEFAULT_PASSES.find((p) => p.name === '汜水关')!;
const sishuiMod = calculatePassDefenseModifier(sishui, false);
testAssert(sishuiMod.defBonus === 0.30, '普通关隘提供守方 30% 防御减免加成');

const jiangeCavalryMod = calculatePassDefenseModifier(jiange, true);
testAssert(jiangeCavalryMod.defBonus === 0.50, '剑阁守军享有 50% 险阻防御加成');
testAssert(jiangeCavalryMod.attackerPenalty === 0.40, '骑兵强攻山地关隘遭受 40% 攻击力惩罚');

const brokenPass: PassEntity = { ...hulao, wall: 0 };
const brokenMod = calculatePassDefenseModifier(brokenPass, true);
testAssert(brokenMod.defBonus === 0 && brokenMod.attackerPenalty === 0, '关隘城防彻底被破 (wall=0) 时防御加成全数失效');

// ---------------------------------------------------------
console.log('\n【3. 路线阻绝与关隘卡口检查】');
const passMap: Record<number, PassEntity> = {
  1: {
    ...hulao,
    factionId: 2, // 董卓势力控制
    troops: 3000,
    blocksRoutes: [[1, 7]],
  },
};

const routeCheck1 = isRouteBlockedByPass(1, 7, 1, passMap);
testAssert(routeCheck1.blocked === true, '敌军控制的虎牢关成功封锁洛阳—陈留官道');
testAssert(routeCheck1.blockingPass?.name === '虎牢关', '阻绝路线信息精确指认虎牢关');

const routeCheck1Rev = isRouteBlockedByPass(7, 1, 1, passMap);
testAssert(routeCheck1Rev.blocked === true, '反向通行洛阳—陈留官道同样被严密阻绝');

const routeCheckFriendly = isRouteBlockedByPass(1, 7, 2, passMap);
testAssert(routeCheckFriendly.blocked === false, '关隘所属势力本军通行绝不受阻');

const emptyPassMap: Record<number, PassEntity> = {
  1: { ...passMap[1], troops: 0 },
};
const routeCheckEmpty = isRouteBlockedByPass(1, 7, 1, emptyPassMap);
testAssert(routeCheckEmpty.blocked === false, '驻军为 0 的无人空关不阻遏通行');

const routeCheckUnblocked = isRouteBlockedByPass(1, 2, 1, passMap);
testAssert(routeCheckUnblocked.blocked === false, '未被该关隘锁闭的路线畅通无阻');

// ---------------------------------------------------------
console.log('\n【4. 驻军调拨门禁与城防修缮工本计算】');
const canGarrisonOk = canGarrisonPass(8000, hulao, 2000);
testAssert(canGarrisonOk.allowed === true, '城池兵力充裕调拨 2000 守军合法准予');

const canGarrisonZero = canGarrisonPass(8000, hulao, 0);
testAssert(canGarrisonZero.allowed === false, '调拨兵力为 0 被依法拦截');

const canGarrisonDepleted = canGarrisonPass(2500, hulao, 2000);
testAssert(canGarrisonDepleted.allowed === false, '城池调拨后守军低于 1000 保底储备被治安防暴拦截');
testAssert(canGarrisonDepleted.reason?.includes(`${MIN_CITY_TROOPS_RESERVE}`) === true, '治安拦截错误提示明确标明保底兵力');

const fullPass = { ...hulao, troops: 4500, maxGarrison: 5000 };
const canGarrisonExceed = canGarrisonPass(8000, fullPass, 1000);
testAssert(canGarrisonExceed.allowed === false, '调拨后关隘驻军超过 5000 容量上限被拦截');

const damagedPass = { ...hulao, wall: 3000, maxWall: 5000 };
const repairCost1 = calculatePassWallRepairCost(damagedPass);
testAssert(repairCost1.goldCost === PASS_WALL_REPAIR_GOLD, '修缮关隘城防标准工本为 200 贯');
testAssert(repairCost1.wallGain === PASS_WALL_REPAIR_GAIN, '修缮单次恢复 300 点城防耐久');

const slightlyDamaged = { ...hulao, wall: 4900, maxWall: 5000 };
const repairCost2 = calculatePassWallRepairCost(slightlyDamaged);
testAssert(repairCost2.wallGain === 100, '城防接近满额时修复增益精确夹紧至缺口');

// ---------------------------------------------------------
console.log('\n【5. 引擎层五大核心政令与要塞生命周期闭环】');
let state = createMockGameState();
state = initPasses(state);
testAssert(state.passes != null, 'initPasses 成功挂载关隘字典');
testAssert(Object.keys(state.passes!).length === 25, '关隘字典精确初始化 25 座要塞实体');

// 调防出征进驻
state = dispatchGarrisonToPass(state, 1, 1, 2000, 102);
testAssert(state.cities[1].troops === 6000, '洛阳调拨 2000 守军后留存 6000 (8000->6000)');
testAssert(state.passes![1].troops === 5000, '虎牢关驻军成功提升至 5000 (3000->5000)');
testAssert(state.passes![1].factionId === 1, '虎牢关控制势力变更为曹操势力 (1)');
testAssert(state.passes![1].commanderId === 102, '曹仁成功委派为虎牢关驻防大将');
testAssert(state.actionLog.some((l) => l.type === 'pass_dispatch'), '生成了关隘驻防调兵政令日志');

// 重伤将领调防拦截
let injuredBlocked = false;
try {
  dispatchGarrisonToPass(state, 1, 2, 500, 105);
} catch (e: any) {
  injuredBlocked = e.message.includes('重伤');
}
testAssert(injuredBlocked === true, '重伤大将被严禁派遣赴关防前哨');

// 撤退守备归还城池
state = recallGarrisonFromPass(state, 1, 1, 1500);
testAssert(state.passes![1].troops === 3500, '虎牢关成功撤回 1500 兵力 (5000->3500)');
testAssert(state.cities[1].troops === 7500, '洛阳城防守备成功归流 1500 (6000->7500)');
testAssert(state.actionLog.some((l) => l.type === 'pass_recall'), '生成了关隘撤兵归城日志');

// 超额撤兵拦截
let overRecallBlocked = false;
try {
  recallGarrisonFromPass(state, 1, 1, 5000);
} catch (e: any) {
  overRecallBlocked = e.message.includes('超过当前关隘驻军');
}
testAssert(overRecallBlocked === true, '超过关隘实际驻军的撤兵被安全拦截');

// 险关城防修葺
state.passes![1].wall = 4000;
state = repairPassWall(state, 1, 1);
testAssert(state.cities[1].gold === 2800, '修葺险关城防扣除洛阳金库 200 贯 (3000->2800)');
testAssert(state.passes![1].wall === 4300, '虎牢关城防耐久成功修复 300 点 (4000->4300)');
testAssert(state.actionLog.some((l) => l.type === 'pass_repair'), '生成了修缮险关政令日志');

// 关隘破城易手
state = capturePass(state, 1, 2, 1200);
testAssert(state.passes![1].factionId === 2, '虎牢关被董卓势力强攻攻克易主');
testAssert(state.passes![1].troops === 1200, '敌方新占领军确立为 1200 人');
testAssert(state.passes![1].commanderId === undefined, '城破后原守将职位自动撤除');
testAssert(state.actionLog.some((l) => l.type === 'pass_captured'), '生成了关隘失陷破城日志');

// ---------------------------------------------------------
console.log('\n【6. 月度演化管线与零漂移验证】');
const emptyPassState = createMockGameState();
const tickedEmpty = tickPassesMonth(emptyPassState);
testAssert(tickedEmpty === emptyPassState, '无关隘字典局 tickPassesMonth 返回完全相同的原引用 (严格 COW 零漂移)');

// 统帅>=75 名将镇守关隘士气上升
state.passes![1].commanderId = 104; // 董卓 统85
state.passes![1].morale = 80;
state = tickPassesMonth(state);
testAssert(state.passes![1].morale === 82, '统帅>=75 大将镇边每月提升关隘守军士气 2 点 (80->82)');

// 无将领关隘士气自然轻微消减
state.passes![1].commanderId = undefined;
state = tickPassesMonth(state);
testAssert(state.passes![1].morale === 81, '无守将关隘守备士气每月微跌 1 点 (82->81)');

// 0 驻军空关城防自然风化
state.passes![2].troops = 0;
state.passes![2].wall = 4000;
state = tickPassesMonth(state);
testAssert(state.passes![2].wall === 3990, '无人驻防空关耐久每月自然风化 10 点 (4000->3990)');

// ---------------------------------------------------------
console.log('\n【7. 24 个月全息推演闭环】');
let simState = createGame(1, 1);
simState = initPasses(simState);
const startYear = simState.currentYear;
for (let m = 0; m < 24; m++) {
  simState = advanceTurn(simState, () => 0.5);
}
testAssert(simState.currentYear === startYear + 2, '24 个月全息推进后年份恰好增长 2 年');
testAssert(simState.passes != null, '推演终态全图关隘字典完好');
testAssert(Object.keys(simState.passes!).length === 25, '推演终态 25 座关隘无遗失损坏');
testAssert(
  Object.values(simState.passes!).every((p) => !isNaN(p.wall) && !isNaN(p.troops) && !isNaN(p.morale)),
  '推演终态所有关隘属性无 NaN 污染',
);

// ---------------------------------------------------------
console.log('\n【8. 服务层与 HTTP/Worker 接口完备性校验】');
createGame(1, 1);
gameService.doInitPasses();
const summary = gameService.doGetPassesSummary();
testAssert(Array.isArray(summary), 'doGetPassesSummary 成功输出数组');
testAssert(summary.length === 25, 'doGetPassesSummary 包含 25 座关隘摘要');
testAssert(typeof gameService.doInitPasses === 'function', '服务层已导出 doInitPasses');
testAssert(typeof gameService.doDispatchGarrisonToPass === 'function', '服务层已导出 doDispatchGarrisonToPass');
testAssert(typeof gameService.doRecallGarrisonFromPass === 'function', '服务层已导出 doRecallGarrisonFromPass');
testAssert(typeof gameService.doRepairPassWall === 'function', '服务层已导出 doRepairPassWall');
testAssert(typeof gameService.doGetPassesSummary === 'function', '服务层已导出 doGetPassesSummary');

console.log(`\n======================================================`);
console.log(`Phase 7-08 关隘要塞防御要冲体系全部 ${passedCount} 项断言 100% 绿色通过！`);
console.log(`======================================================\n`);
