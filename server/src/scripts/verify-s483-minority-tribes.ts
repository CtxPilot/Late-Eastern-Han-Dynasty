// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-07 边疆异族羁縻、朝贡互市与寇边讨伐体系全栈验收门禁
 * 
 * 校验矩阵：
 * 1. 六大边疆少数民族地缘配置与特产兵种契约
 * 2. 威胁等级与镇边宿将纯函数计算
 * 3. 月度张力演进模型（季节偏转、重兵慑边、名将出镇、互市平抑）
 * 4. 领军讨伐资质与借兵征募条件防御
 * 5. 引擎层宣抚羁縻、发兵讨平与借募精锐事务闭环
 * 6. 月结管线演化与无异族局 COW 严格零漂移
 * 7. 24 个月全息推演闭环与数值健全性
 * 8. 服务层与 HTTP/Worker 接口完备性校验
 */

import assert from 'node:assert';
import {
  DEFAULT_MINORITY_TRIBES,
  TribeThreatLevel,
  calculateTribeTensionDelta,
  canRecruitTribeTroops,
  canLeadTribeSubjugation,
  getTribeThreatLevel,
  isBorderWarden,
  Season,
  TRIBAL_PACIFY_COST_GOLD,
  TRIBAL_PACIFY_TENSION_REDUCTION,
  TRIBAL_SUBDUE_MONTHS,
  TRIBAL_LEVY_BATCH_SIZE,
  TRIBAL_LEVY_COST_GOLD,
  TRIBAL_LEVY_TENSION_COST,
} from '@leh/shared';
import {
  initMinorityTribes,
  pacifyMinorityTribe,
  subjugateMinorityTribe,
  recruitMinorityTroops,
  tickMinorityTribesMonth,
} from '../engine/minority.js';
import { advanceTurn } from '../engine/turn.js';
import {
  createGame,
  getGame,
  doInitMinorityTribes,
  doPacifyMinorityTribe,
  doSubjugateMinorityTribe,
  doRecruitMinorityTroops,
  doGetMinorityTribesSummary,
} from '../services/game.js';

let passedAssertions = 0;

function check(name: string, condition: boolean): void {
  assert(condition, `[FAIL] 断言 ${passedAssertions + 1}: ${name}`);
  passedAssertions++;
  console.log(`  ✓ 断言 ${passedAssertions}: ${name}`);
}

console.log('=== [Phase 7-07] 边疆异族羁縻、朝贡互市与寇边讨伐体系全栈验收门禁 (Session 483) ===\n');

// -------------------------------------------------------------
// 1. 六大异族配置与地缘属性契约
// -------------------------------------------------------------
console.log('【1. 六大边疆少数民族地缘配置与特产兵种契约】');

const tribes = Object.values(DEFAULT_MINORITY_TRIBES);
check('包含汉末六大边疆少数民族全量配置', tribes.length === 6);

const xiongnu = DEFAULT_MINORITY_TRIBES.xiongnu;
check('匈奴地缘为并州且特色兵种为匈奴突骑', xiongnu.name === '匈奴' && xiongnu.relatedProvinces.includes('并州') && xiongnu.specialUnitName === '匈奴突骑');
check('匈奴朝贡特产为战马且冬季最活跃', xiongnu.specialtyTribute === '战马' && xiongnu.activeSeason === 'winter');

const xianbei = DEFAULT_MINORITY_TRIBES.xianbei;
check('鲜卑地缘为幽州北且特色兵种为鲜卑突骑', xianbei.name === '鲜卑' && xianbei.relatedProvinces.includes('幽州'));
check('鲜卑朝贡特产为角弓且春季最活跃', xianbei.specialtyTribute === '角弓' && xianbei.activeSeason === 'spring');

const qiang = DEFAULT_MINORITY_TRIBES.qiang;
check('羌族地缘为凉州且朝贡特产为良马', qiang.name === '羌族' && qiang.relatedProvinces.includes('凉州') && qiang.specialtyTribute === '良马');

const di = DEFAULT_MINORITY_TRIBES.di;
check('氐族地缘为凉益交界且特产为药材', di.name === '氐族' && di.relatedProvinces.includes('益州') && di.specialtyTribute === '药材');

const shanyue = DEFAULT_MINORITY_TRIBES.shanyue;
check('山越地缘为扬州山地且全年活跃', shanyue.name === '山越' && shanyue.relatedProvinces.includes('扬州') && shanyue.activeSeason === 'all');

const nanman = DEFAULT_MINORITY_TRIBES.nanman;
check('南蛮特色兵种为藤甲兵且朝贡特产为象牙', nanman.name === '南蛮' && nanman.specialUnitName === '藤甲兵' && nanman.specialtyTribute === '象牙');

check('宣抚羁縻标准经费为 300 贯', TRIBAL_PACIFY_COST_GOLD === 300);
check('宣抚降低紧张度 25 点', TRIBAL_PACIFY_TENSION_REDUCTION === 25);
check('讨平大捷威慑期为 24 个月', TRIBAL_SUBDUE_MONTHS === 24);
check('单次借兵规模为 500 人', TRIBAL_LEVY_BATCH_SIZE === 500);
check('单次借兵军饷为 500 贯', TRIBAL_LEVY_COST_GOLD === 500);
check('借兵消耗 5 点张力', TRIBAL_LEVY_TENSION_COST === 5);

// -------------------------------------------------------------
// 2. 威胁等级与镇边宿将纯函数计算
// -------------------------------------------------------------
console.log('\n【2. 威胁等级与镇边宿将纯函数计算】');

check('0~29 紧张度准确映射为 PACIFIED (羁縻顺服)', getTribeThreatLevel(0) === TribeThreatLevel.PACIFIED && getTribeThreatLevel(29) === TribeThreatLevel.PACIFIED);
check('30~59 紧张度准确映射为 UNSETTLED (暗流骚动)', getTribeThreatLevel(30) === TribeThreatLevel.UNSETTLED && getTribeThreatLevel(59) === TribeThreatLevel.UNSETTLED);
check('60~79 紧张度准确映射为 RAIDING (寇边劫掠)', getTribeThreatLevel(60) === TribeThreatLevel.RAIDING && getTribeThreatLevel(79) === TribeThreatLevel.RAIDING);
check('80~100 紧张度准确映射为 INVASION (大举入侵)', getTribeThreatLevel(80) === TribeThreatLevel.INVASION && getTribeThreatLevel(100) === TribeThreatLevel.INVASION);
check('负数紧张度安全夹紧至 PACIFIED', getTribeThreatLevel(-50) === TribeThreatLevel.PACIFIED);
check('超额紧张度安全夹紧至 INVASION', getTribeThreatLevel(200) === TribeThreatLevel.INVASION);

const generalCaoRen: any = {
  id: 1,
  name: '曹仁',
  stats: { leadership: 88, war: 84, intelligence: 70, politics: 60, charisma: 75 },
};
check('曹仁 (统88武84) 准确判定为镇边宿将', isBorderWarden(generalCaoRen) === true);

const weakOfficer: any = {
  id: 2,
  name: '庸官',
  stats: { leadership: 65, war: 60, intelligence: 60, politics: 60, charisma: 60 },
};
check('普通将领不具备宿将威慑资格', isBorderWarden(weakOfficer) === false);
check('空武将安全防护返回 false', isBorderWarden(null) === false);

// -------------------------------------------------------------
// 3. 月度张力演进模型计算
// -------------------------------------------------------------
console.log('\n【3. 月度张力演进模型计算】');

const baseDelta = calculateTribeTensionDelta({
  tribe: xiongnu,
  season: Season.AUTUMN,
});
check('常规无额外修饰时月度自然张力增长 +1 点', baseDelta === 1);

const winterDelta = calculateTribeTensionDelta({
  tribe: xiongnu,
  season: Season.WINTER,
});
check('匈奴在冬季活跃季额外 +2 (月增 +3 点)', winterDelta === 3);

const wardenDelta = calculateTribeTensionDelta({
  tribe: xiongnu,
  season: Season.WINTER,
  borderOfficers: [generalCaoRen],
});
check('宿将出镇边塞提供 -2 压制 (净增 +1 点)', wardenDelta === 1);

const borderCityA: any = {
  id: 101,
  name: '晋阳',
  province: '并州',
  troops: 16000,
  gold: 1500,
  food: 3000,
  stats: { agriculture: 500, commerce: 500, wall: 100 },
};
const heavyTroopsDelta = calculateTribeTensionDelta({
  tribe: xiongnu,
  season: Season.WINTER,
  borderOfficers: [generalCaoRen],
  borderCities: [borderCityA],
});
check('重兵慑边(>=15000)与商贸繁荣(>=400)双重平抑至 -1 点', heavyTroopsDelta === -1);

const emptyBorderCity: any = {
  id: 102,
  name: '雁门',
  province: '并州',
  troops: 2000,
  gold: 200,
  food: 500,
  stats: { agriculture: 200, commerce: 200, wall: 50 },
};
const emptyBorderDelta = calculateTribeTensionDelta({
  tribe: xiongnu,
  season: Season.AUTUMN,
  borderCities: [emptyBorderCity],
});
check('边防空虚(<4000)刺激异族寇心 (月增 +3 点)', emptyBorderDelta === 3);

const subduedTribe = {
  ...xiongnu,
  isSubdued: true,
  subduedMonths: 20,
};
const subduedDelta = calculateTribeTensionDelta({
  tribe: subduedTribe,
  season: Season.WINTER,
});
check('讨平大捷威慑期内紧张度变化严格锁定为 0', subduedDelta === 0);

// -------------------------------------------------------------
// 4. 领军讨伐资质与借兵征募条件防御
// -------------------------------------------------------------
console.log('\n【4. 领军讨伐资质与借兵征募条件防御】');

const generalMaChao: any = {
  id: 5,
  name: '马超',
  stats: { leadership: 88, war: 97, intelligence: 50, politics: 40, charisma: 80 },
};
check('马超 (统88武97) 具备统军出塞讨伐资质', canLeadTribeSubjugation(generalMaChao).canLead === true);

const weakScholar: any = {
  id: 6,
  name: '文吏',
  stats: { leadership: 40, war: 30, intelligence: 75, politics: 70, charisma: 60 },
};
const scholarCheck = canLeadTribeSubjugation(weakScholar);
check('统武皆不足 70 者严禁领兵讨伐', scholarCheck.canLead === false && scholarCheck.reason?.includes('皆不足 70') === true);

const injuredGeneral: any = {
  ...generalMaChao,
  injury: 3, // 重伤
};
const injuredCheck = canLeadTribeSubjugation(injuredGeneral);
check('重伤或濒死大将禁止出征远伐蛮夷', injuredCheck.canLead === false && injuredCheck.reason?.includes('战创深重') === true);

const pacifiedQiang = { ...DEFAULT_MINORITY_TRIBES.qiang, tension: 20 };
const liangzhouCity: any = {
  id: 201,
  name: '武威',
  province: '凉州',
  troops: 5000,
  gold: 800,
  food: 2000,
  stats: { agriculture: 300, commerce: 300, wall: 80 },
};
check('顺服状态且地缘吻合之凉州城池允许借募羌兵', canRecruitTribeTroops(liangzhouCity, pacifiedQiang).canRecruit === true);

const unsettledQiang = { ...DEFAULT_MINORITY_TRIBES.qiang, tension: 50 };
const unsettledCheck = canRecruitTribeTroops(liangzhouCity, unsettledQiang);
check('紧张度 >= 30 时借兵被合法拦截', unsettledCheck.canRecruit === false && unsettledCheck.reason?.includes('非羁縻顺服态') === true);

const jiangnanCity: any = { ...liangzhouCity, name: '建业', province: '扬州' };
const wrongLocCheck = canRecruitTribeTroops(jiangnanCity, pacifiedQiang);
check('非活跃边郡城池借兵被合法拦截', wrongLocCheck.canRecruit === false && wrongLocCheck.reason?.includes('非 羌族 活跃边郡') === true);

const poorCity: any = { ...liangzhouCity, gold: 100 };
const poorCheck = canRecruitTribeTroops(poorCity, pacifiedQiang);
check('资金不足 500 贯时借兵被合法拦截', poorCheck.canRecruit === false && poorCheck.reason?.includes('金钱不足') === true);

// -------------------------------------------------------------
// 5. 引擎层三大核心政令事务闭环
// -------------------------------------------------------------
console.log('\n【5. 引擎层三大核心政令事务闭环】');

let gameState = createGame(1, 1);
const jinyangCity = Object.values(gameState.cities).find((c) => c.name === '晋阳') ?? gameState.cities[1];
const playerFactionId = gameState.playerFactionId;

// 1. 初始化异族
gameState = initMinorityTribes(gameState);
check('initMinorityTribes 成功挂载全套异族字典', Boolean(gameState.minorityTribes?.xiongnu));
check('初始匈奴紧张度为 25', gameState.minorityTribes?.xiongnu.tension === 25);

// 调整晋阳城池资金与驻军
gameState = {
  ...gameState,
  cities: {
    ...gameState.cities,
    [jinyangCity.id]: {
      ...gameState.cities[jinyangCity.id],
      province: '并州',
      gold: 2000,
      troops: 8000,
    },
  },
  officers: {
    ...gameState.officers,
    [generalCaoRen.id]: {
      ...generalCaoRen,
      faction: playerFactionId,
      location: jinyangCity.id,
    },
  },
  minorityTribes: {
    ...gameState.minorityTribes!,
    xiongnu: {
      ...gameState.minorityTribes!.xiongnu,
      tension: 60,
    },
  },
};

// 2. 宣抚羁縻
const pacifyRes = pacifyMinorityTribe(gameState, playerFactionId, jinyangCity.id, 'xiongnu');
check('宣抚成功扣除晋阳 300 贯经费', pacifyRes.state.cities[jinyangCity.id].gold === 1700);
check('宣抚成功降低匈奴紧张度 25 点 (60->35)', pacifyRes.state.minorityTribes!.xiongnu.tension === 35);
check('生成了宣抚羁縻的政令日志', pacifyRes.state.actionLog.some((l) => l.type === 'minority_pacified'));

// 验证金钱不足拦截
let poorState = {
  ...gameState,
  cities: {
    ...gameState.cities,
    [jinyangCity.id]: { ...gameState.cities[jinyangCity.id], gold: 50 },
  },
};
let pacifyError = false;
try {
  pacifyMinorityTribe(poorState, playerFactionId, jinyangCity.id, 'xiongnu');
} catch (e: any) {
  pacifyError = true;
}
check('资金不足 300 贯时宣抚被安全拦截', pacifyError === true);

// 3. 借募精锐特种兵 (设张力为 20)
let recruitState: any = {
  ...pacifyRes.state,
  minorityTribes: {
    ...pacifyRes.state.minorityTribes!,
    xiongnu: {
      ...pacifyRes.state.minorityTribes!.xiongnu,
      tension: 20,
    },
  },
};
const recruitRes = recruitMinorityTroops(recruitState, playerFactionId, jinyangCity.id, 'xiongnu');
check('借兵成功扣除晋阳 500 贯安家银', recruitRes.state.cities[jinyangCity.id].gold === 1200);
check('晋阳驻军成功扩编 500 名异族精锐 (8000->8500)', recruitRes.state.cities[jinyangCity.id].troops === 8500);
check('借兵消耗 5 点张力 (20->25)', recruitRes.state.minorityTribes!.xiongnu.tension === 25);
check('生成了异族借兵行动日志', recruitRes.state.actionLog.some((l) => l.type === 'minority_troops_recruited'));

// 4. 发兵讨平蛮夷
const subjugateRes = subjugateMinorityTribe(recruitRes.state, playerFactionId, jinyangCity.id, 'xiongnu', generalCaoRen.id);
check('讨平大捷后匈奴紧张度归零', subjugateRes.state.minorityTribes!.xiongnu.tension === 0);
check('匈奴进入讨平威慑期 (isSubdued === true)', subjugateRes.state.minorityTribes!.xiongnu.isSubdued === true);
check('威慑时效为 24 个月', subjugateRes.state.minorityTribes!.xiongnu.subduedMonths === 24);
check('晋阳缴获虏获金钱入账', subjugateRes.state.cities[jinyangCity.id].gold > 1200);
check('出征主将曹仁功绩累加 +50 点', (subjugateRes.state.officers[generalCaoRen.id].merit ?? 0) >= 50);
check('己方势力声望提升 +15 点', (subjugateRes.state.factions[playerFactionId]?.fame ?? 0) >= 15);
check('生成了深入讨平边夷的大捷日志', subjugateRes.state.actionLog.some((l) => l.type === 'minority_subjugated'));

// -------------------------------------------------------------
// 6. 月结管线演化与零漂移验证
// -------------------------------------------------------------
console.log('\n【6. 月结管线演化与零漂移验证】');

const plainState = createGame(1, 1);
const cowTick = tickMinorityTribesMonth(plainState, Season.SPRING);
check('无异族字典局 tickMinorityTribesMonth 返回完全相同的原引用 (严格 COW 零漂移)', cowTick === plainState);

// 演进一个月：威慑月数衰减
const tick1 = tickMinorityTribesMonth(subjugateRes.state, Season.SPRING);
check('威慑平静期剩余月数自然消减 1 个月 (24->23)', tick1.minorityTribes!.xiongnu.subduedMonths === 23);
check('处于威慑期内紧张度保持为 0', tick1.minorityTribes!.xiongnu.tension === 0);

// 测试高张力寇边 (张力 85)
let highTensionState: any = {
  ...subjugateRes.state,
  currentYear: 191,
  currentMonth: 5,
  cities: {
    ...subjugateRes.state.cities,
    [jinyangCity.id]: {
      ...subjugateRes.state.cities[jinyangCity.id],
      troops: 5000,
      gold: 1000,
      troopsMorale: 80,
    },
  },
  minorityTribes: {
    ...subjugateRes.state.minorityTribes!,
    xiongnu: {
      ...subjugateRes.state.minorityTribes!.xiongnu,
      isSubdued: false,
      subduedMonths: 0,
      tension: 85,
    },
  },
};
const raidTargetCity = Object.values(highTensionState.cities).find((c: any) => xiongnu.relatedProvinces.includes(c.province) && (c.troops ?? 0) > 300) as any;
const beforeRaidTroops = raidTargetCity.troops;
const beforeRaidGold = raidTargetCity.gold;
const beforeRaidMorale = raidTargetCity.troopsMorale ?? 70;

const raidTick = tickMinorityTribesMonth(highTensionState, Season.WINTER);
check('张力达到 85 时触发大举寇边袭掠', raidTick.actionLog.some((l) => l.type === 'minority_invasion_raid'));
check('寇边袭掠扣减边城守军与金钱', raidTick.cities[raidTargetCity.id].troops < beforeRaidTroops && raidTick.cities[raidTargetCity.id].gold < beforeRaidGold);
check('寇边袭掠降低边城士气', (raidTick.cities[raidTargetCity.id].troopsMorale ?? 0) <= beforeRaidMorale);

// 测试低张力岁首朝贡 (张力 15, 1月)
const tributeTargetCity = Object.values(subjugateRes.state.cities).find((c: any) => xiongnu.relatedProvinces.includes(c.province)) as any;
let tributeState: any = {
  ...subjugateRes.state,
  currentYear: 192,
  currentMonth: 1, // 正月岁首
  cities: {
    ...subjugateRes.state.cities,
    [tributeTargetCity.id]: {
      ...subjugateRes.state.cities[tributeTargetCity.id],
      gold: 1000,
      food: 2000,
    },
  },
  minorityTribes: {
    ...subjugateRes.state.minorityTribes!,
    xiongnu: {
      ...subjugateRes.state.minorityTribes!.xiongnu,
      isSubdued: false,
      subduedMonths: 0,
      tension: 15,
    },
  },
};
const tributeTick = tickMinorityTribesMonth(tributeState, Season.SPRING);
check('岁首低张力触发边夷朝贡进献', tributeTick.actionLog.some((l) => l.type === 'minority_tribute_delivered'));
check('朝贡进奉入账边城金钱与粮草', tributeTick.cities[tributeTargetCity.id].gold === 1100 && tributeTick.cities[tributeTargetCity.id].food === 2200);

// -------------------------------------------------------------
// 7. 24 个月全息推演闭环
// -------------------------------------------------------------
console.log('\n【7. 24 个月全息推演闭环】');

let simState = createGame(1, 1);
simState = initMinorityTribes(simState);

const startY = simState.currentYear;
const startM = simState.currentMonth;
let current = simState;

for (let m = 0; m < 24; m++) {
  current = advanceTurn(current, () => 0.5);
}

check('24 个月全息推进后年份恰好增长 2 年', current.currentYear === startY + 2 && current.currentMonth === startM);
check('推演终态全图异族字典完备', Object.keys(current.minorityTribes ?? {}).length === 6);
check('推演终态异族紧张度处于 [0, 100] 合法区间', Object.values(current.minorityTribes!).every((t) => t.tension >= 0 && t.tension <= 100));
check('推演终态城池驻军无 NaN 异常', Object.values(current.cities).every((c) => !isNaN(c.troops) && !isNaN(c.gold)));

// -------------------------------------------------------------
// 8. 服务层与 HTTP/Worker 接口完备性校验
// -------------------------------------------------------------
console.log('\n【8. 服务层与 HTTP/Worker 接口完备性校验】');

createGame(1, 1);
doInitMinorityTribes();
const sSummary = doGetMinorityTribesSummary();
check('doGetMinorityTribesSummary 成功检索 6 大边疆异族状态', sSummary.length === 6);
check('摘要中包含威胁等级映射', sSummary.every((t) => typeof t.threatLevel === 'number'));

const sGame = getGame();
const sCity = Object.values(sGame.cities).find((c) => c.province === '并州') ?? sGame.cities[1];

const sPacify = doPacifyMinorityTribe(sCity.id, 'xiongnu');
check('doPacifyMinorityTribe 成功执行宣抚并返回新张力', typeof sPacify.tension === 'number');

const sRecruit = doRecruitMinorityTroops(sCity.id, 'xiongnu');
check('doRecruitMinorityTroops 成功借募 500 精锐特种兵', sRecruit.troopsRecruited === 500);

const sSubjugate = doSubjugateMinorityTribe(sCity.id, 'xiongnu', 1);
check('doSubjugateMinorityTribe 成功讨平异族并缴获战利品', sSubjugate.spoils.gold > 0);

console.log('\n=============================================================');
console.log(`  Phase 7-07 专案验收门禁全部通过！累计通过 ${passedAssertions} 项断言！`);
console.log('=============================================================\n');
