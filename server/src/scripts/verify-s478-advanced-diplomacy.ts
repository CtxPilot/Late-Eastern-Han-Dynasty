// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 专项门禁：深度外交体系（多方盟约、从属朝贡、宣战停火与天子诏命）校验（Session 478，docs/55）
 *
 * 验收范围：
 * 1. 外交契约与 Schema 完备性（DiplomacyLink.truceMonths, Faction.overlordFactionId, Coalition 等）；
 * 2. 停火几率与从属几率纯函数判定（calculateTruceChance, calculateVassalChance, isHostileOrAtWar 停火拦截）；
 * 3. 宣战机制（常规宣战、毁约背信惩罚【-50声望/-10全城士气/-100好感】、从属国被宣战宗主自动入战）；
 * 4. 停火议和机制（proposeTruce 支付500金、确立12月停战保护期、重置好感为0）；
 * 5. 称臣从属与解放（demandVassal 逼降、submitVassal 投效、releaseVassal 解放独立【声望+15/好感80】）；
 * 6. 岁首朝贡结算（tickDiplomacyMonth 正月扣缴 15% 金粮进献宗主国，非正月不扣）；
 * 7. 多方会盟（formCoalition 盟友互盟+全员对敌宣战、callJointWar 全盟士气+5、目标覆灭大获全胜声望+40并解散）；
 * 8. 天子诏命（controlsEmperor 门槛、讨逆诏削弱天命人心、册封诏赐州牧升声望、征贡诏岁纳贡金粮）；
 * 9. 24 个月全息推演生命周期、零崩溃与数值无 NaN 检查。
 */

import assert from 'node:assert/strict';
import {
  DipRelation,
  calculateTruceChance,
  calculateVassalChance,
  isHostileOrAtWar,
  findDiplomacy,
  type GameState,
} from '@leh/shared';

import {
  upsertLink,
  declareWar,
  proposeTruce,
  demandVassal,
  submitVassal,
  releaseVassal,
  formCoalition,
  callJointWar,
  issueImperialDecree,
  tickDiplomacyMonth,
  FAME_BREAK_ALLIANCE_PENALTY,
  MORALE_BREAK_ALLIANCE_PENALTY,
  FAME_VASSAL_OVERLORD,
  FAME_RELEASE_VASSAL,
  TRUCE_GOLD,
} from '../engine/diplomacy.js';

import { createGame, getGame } from '../services/game.js';
import { advanceTurn } from '../engine/turn.js';

let passedAssertions = 0;
function check(desc: string, cond: boolean) {
  assert.ok(cond, `[FAIL] ${desc}`);
  passedAssertions++;
  console.log(`  ✓ 断言 ${passedAssertions}: ${desc}`);
}

console.log('=== [Phase 7-02] 深度外交体系（多方盟约、从属朝贡、宣战停火与天子诏命）专项门禁 (Session 478) ===\n');

// 剧本 4（190·三十诸侯全割据）常数：
// 1: 董卓政权, 2: 勃海袁绍, 3: 陈留曹操, 4: 长沙孙坚, 7: 徐州陶谦, 8: 荆州刘表, 10: 辽东公孙度
const DONG_ZHUO = 1;
const YUAN_SHAO = 2;
const CAO_CAO = 3;
const SUN_JIAN = 4;
const TAO_QIAN = 7;
const LIU_BIAO = 8;
const GONG_SUN_DU = 10;

// -------------------------------------------------------------
// 1. 外交契约与数据模型结构检查
// -------------------------------------------------------------
console.log('【1. 外交契约与数据模型结构检查】');
createGame(4, CAO_CAO); // 曹操开局
let state = getGame();

check('初始势力数据包含玩家势力 (id=3, 曹操)', !!state.factions[CAO_CAO]);
check('初始势力数据包含董卓势力 (id=1)', !!state.factions[DONG_ZHUO]);
check('初始势力数据包含袁绍势力 (id=2)', !!state.factions[YUAN_SHAO]);
check('初始外交关系表非空', Array.isArray(state.diplomacy) && state.diplomacy.length > 0);

// -------------------------------------------------------------
// 2. 停火几率与从属几率纯函数模型判定
// -------------------------------------------------------------
console.log('\n【2. 停火几率与从属几率纯函数模型判定】');

// 2.1 停战协商几率计算：曹操向董卓求和
const truceResNormal = calculateTruceChance(state, DONG_ZHUO, CAO_CAO);
check('停战几率计算结果包含合法字段与有效概率区间', typeof truceResNormal.chance === 'number' && truceResNormal.chance >= 5 && truceResNormal.chance <= 95);

// 构造董卓深陷 4 处战火的情况
const stateMultiWar = {
  ...state,
  diplomacy: [
    ...state.diplomacy,
    { factionA: DONG_ZHUO, factionB: YUAN_SHAO, relation: DipRelation.WAR, favorability: -100 },
    { factionA: DONG_ZHUO, factionB: SUN_JIAN, relation: DipRelation.WAR, favorability: -100 },
    { factionA: DONG_ZHUO, factionB: TAO_QIAN, relation: DipRelation.WAR, favorability: -100 },
    { factionA: DONG_ZHUO, factionB: LIU_BIAO, relation: DipRelation.WAR, favorability: -100 },
  ],
};
const truceResMultiWar = calculateTruceChance(stateMultiWar, DONG_ZHUO, CAO_CAO);
check('目标深陷多方战火时停战协商有额外几率加成 (multiWarBonus > 0)', truceResMultiWar.multiWarBonus > 0);
check('多线战火下的求和成功率高于均势无外患情况', truceResMultiWar.chance >= truceResNormal.chance);

// 2.2 称臣从属几率计算
const vassalResNormal = calculateVassalChance(state, DONG_ZHUO, CAO_CAO);
check('均势或弱势逼降时，由于未达成压倒性优势门槛，从属几率为 0', vassalResNormal.chance === 0);

// 构造曹操压倒性优势（10 城 50000 兵 vs 1 城 2000 兵）
// 场景 A：血仇交战状态 (fav < -40) 诸侯誓死不降，仅有 5% 保底几率
const stateHostileOverwhelming = {
  ...state,
  diplomacy: upsertLink(state.diplomacy, CAO_CAO, TAO_QIAN, { favorability: -80, relation: DipRelation.WAR }, state),
  cities: {
    ...state.cities,
    1: { ...state.cities[1], troops: 50000 },
    2: { ...state.cities[2], troops: 2000 },
  },
  factions: {
    ...state.factions,
    [CAO_CAO]: { ...state.factions[CAO_CAO], cityIds: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    [TAO_QIAN]: { ...state.factions[TAO_QIAN], cityIds: [2] },
  },
};
const vassalResHostile = calculateVassalChance(stateHostileOverwhelming, TAO_QIAN, CAO_CAO);
check('深仇血战时 (fav < -40) 诸侯誓死不降，逼降几率被压制在 5%', vassalResHostile.chance === 5);

// 场景 B：非深仇正常威逼 (fav = 20)，大国压制小国，逼降几率显著提升 (> 30%)
const stateFriendlyOverwhelming = {
  ...stateHostileOverwhelming,
  diplomacy: upsertLink(stateHostileOverwhelming.diplomacy, CAO_CAO, TAO_QIAN, { favorability: 20, relation: DipRelation.NEUTRAL }, stateHostileOverwhelming),
};
const vassalResFriendly = calculateVassalChance(stateFriendlyOverwhelming, TAO_QIAN, CAO_CAO);
check('威势压境且非深仇时，逼降几率显著提升 (> 30%)', vassalResFriendly.chance > 30);

// -------------------------------------------------------------
// 3. 停火保护期与出征拦截机制
// -------------------------------------------------------------
console.log('\n【3. 停火保护期与出征拦截机制】');

const mockDiplomacyActiveTruce = [
  { factionA: CAO_CAO, factionB: DONG_ZHUO, relation: DipRelation.NEUTRAL, favorability: 0, truceMonths: 8 },
];
check(
  '在 truceMonths > 0 停战期内，isHostileOrAtWar 返回 false 禁止出征交战',
  !isHostileOrAtWar(mockDiplomacyActiveTruce, CAO_CAO, DONG_ZHUO)
);

const mockDiplomacyExpiredTruce = [
  { factionA: CAO_CAO, factionB: DONG_ZHUO, relation: DipRelation.WAR, favorability: -80, truceMonths: 0 },
];
check(
  'truceMonths 为 0 且处于 WAR 状态时，isHostileOrAtWar 返回 true 允许出征',
  isHostileOrAtWar(mockDiplomacyExpiredTruce, CAO_CAO, DONG_ZHUO)
);

// -------------------------------------------------------------
// 4. 宣战机制（常规宣战、毁约背信惩罚、从属国联动）
// -------------------------------------------------------------
console.log('\n【4. 宣战机制（常规宣战、毁约背信惩罚、从属国联动）】');

// 初始重置曹操城池金钱与势力声望
const caoCityId = state.factions[CAO_CAO].cityIds[0];
state = {
  ...state,
  cities: {
    ...state.cities,
    [caoCityId]: { ...state.cities[caoCityId], gold: 2000 },
  },
  factions: {
    ...state.factions,
    [CAO_CAO]: { ...state.factions[CAO_CAO], fame: 300, gold: 2000 },
    [GONG_SUN_DU]: { ...state.factions[GONG_SUN_DU], fame: 200 },
    [DONG_ZHUO]: { ...state.factions[DONG_ZHUO], fame: 600, gold: 5000 },
  },
};

// 4.1 常规宣战测试：曹操对中立的辽东公孙度宣战
state = declareWar(state, GONG_SUN_DU, CAO_CAO);
const linkCaoGongsun = findDiplomacy(state.diplomacy, CAO_CAO, GONG_SUN_DU);
check('常规宣战后两国关系变为 WAR', linkCaoGongsun?.relation === DipRelation.WAR);
check('常规宣战后双方好感度降至 -80', linkCaoGongsun?.favorability === -80);

// 4.2 议和停战：曹操主动求和董卓（讨董战局处于交战态）
const goldBeforeTruce = state.factions[CAO_CAO].gold;
state = proposeTruce(state, DONG_ZHUO, CAO_CAO, 12, () => 0.0);
const linkCaoDongTruce = findDiplomacy(state.diplomacy, CAO_CAO, DONG_ZHUO);
check('议和成功后关系变为 NEUTRAL', linkCaoDongTruce?.relation === DipRelation.NEUTRAL);
check('议和成功后确立 12 个月停火保护期 (truceMonths = 12)', linkCaoDongTruce?.truceMonths === 12);
check('议和成功后双方友好度置为 0', linkCaoDongTruce?.favorability === 0);
check(`曹操金钱扣减停战礼金 ${TRUCE_GOLD} 金`, state.factions[CAO_CAO].gold === goldBeforeTruce - TRUCE_GOLD);

// 4.3 背信弃义宣战（在停战保护期内撕毁和约发起宣战）
const fameBeforeTreachery = state.factions[CAO_CAO].fame ?? 0;
const caoCity = Object.values(state.cities).find((c) => c.ruler === CAO_CAO);
const cityMoraleBefore = caoCity?.troopsMorale ?? 50;

state = declareWar(state, DONG_ZHUO, CAO_CAO); // 停火期内宣战！
const caoAfterTreachery = state.factions[CAO_CAO];
const linkCaoDongBreach = findDiplomacy(state.diplomacy, CAO_CAO, DONG_ZHUO);
const caoCityAfter = state.cities[caoCity!.id];

check(
  `停火期毁约宣战遭受声望惩罚 -${FAME_BREAK_ALLIANCE_PENALTY}`,
  caoAfterTreachery.fame === fameBeforeTreachery - FAME_BREAK_ALLIANCE_PENALTY
);
check(
  `停火期毁约宣战其直属驻军士气受到惩罚 -${MORALE_BREAK_ALLIANCE_PENALTY}`,
  caoCityAfter.troopsMorale === Math.max(0, cityMoraleBefore - MORALE_BREAK_ALLIANCE_PENALTY)
);
check('毁约宣战后双方友好度跌入谷底 -100', linkCaoDongBreach?.favorability === -100);
check('毁约宣战后关系变为 WAR 且 truceMonths 归零', linkCaoDongBreach?.relation === DipRelation.WAR && linkCaoDongBreach.truceMonths === 0);

// 4.4 从属联动机制：
// 设袁绍(id=2)收刘表(id=8)为从属国，若曹操(id=3)对刘表(id=8)宣战，袁绍作为宗主必须自动参战对曹操宣战
state = {
  ...state,
  factions: {
    ...state.factions,
    [LIU_BIAO]: { ...state.factions[LIU_BIAO], overlordFactionId: YUAN_SHAO, isAlive: true },
    [YUAN_SHAO]: { ...state.factions[YUAN_SHAO], vassalFactionIds: [LIU_BIAO] },
  },
};
state = declareWar(state, LIU_BIAO, CAO_CAO);
const linkCaoLiu = findDiplomacy(state.diplomacy, CAO_CAO, LIU_BIAO);
const linkCaoYuanOverlordWar = findDiplomacy(state.diplomacy, CAO_CAO, YUAN_SHAO);
check('曹操对从属国刘表宣战成功', linkCaoLiu?.relation === DipRelation.WAR);
check('宗主国袁绍自动参战对曹操进入 WAR 状态', linkCaoYuanOverlordWar?.relation === DipRelation.WAR);

// -------------------------------------------------------------
// 5. 称臣从属与解放独立机制
// -------------------------------------------------------------
console.log('\n【5. 称臣从属与解放独立机制】');

// 5.1 强权逼降：曹操迫使陶谦(id=7)称臣
// 预先设定大国压倒小国态势（曹操 6 城 50000 兵 vs 陶谦 1 城 2000 兵，友好度 20）
state = {
  ...state,
  diplomacy: upsertLink(state.diplomacy, CAO_CAO, TAO_QIAN, { favorability: 20, relation: DipRelation.NEUTRAL }, state),
  cities: {
    ...state.cities,
    1: { ...state.cities[1], ruler: CAO_CAO, troops: 50000 },
    2: { ...state.cities[2], ruler: TAO_QIAN, troops: 2000 },
  },
  factions: {
    ...state.factions,
    [CAO_CAO]: { ...state.factions[CAO_CAO], cityIds: [1, 3, 4, 5, 6, 7] },
    [TAO_QIAN]: { ...state.factions[TAO_QIAN], cityIds: [2] },
  },
};

const caoFameBeforeDemand = state.factions[CAO_CAO].fame ?? 0;
state = demandVassal(state, TAO_QIAN, CAO_CAO, () => 0.0);

check('宗主国声望提升 +' + FAME_VASSAL_OVERLORD, (state.factions[CAO_CAO].fame ?? 0) === caoFameBeforeDemand + FAME_VASSAL_OVERLORD);
check('宗主势力 vassalFactionIds 登记从属国 ID', (state.factions[CAO_CAO].vassalFactionIds ?? []).includes(TAO_QIAN));
check('从属国 overlordFactionId 正确指向宗主', state.factions[TAO_QIAN].overlordFactionId === CAO_CAO);
const linkVassal = findDiplomacy(state.diplomacy, CAO_CAO, TAO_QIAN);
check('宗藩关系确立为 ALLIED 且友好度为 50', linkVassal?.relation === DipRelation.ALLIED && linkVassal.favorability === 50);

// 5.2 弱小诸侯主动称臣求庇护（如公孙度 id=10 称臣于曹操）
state = submitVassal(state, CAO_CAO, GONG_SUN_DU);
check('公孙度成功主动称臣于曹操', state.factions[GONG_SUN_DU].overlordFactionId === CAO_CAO);
check('曹操 vassalFactionIds 包含公孙度', (state.factions[CAO_CAO].vassalFactionIds ?? []).includes(GONG_SUN_DU));

// 5.3 宽宥解放从属国：曹操主动释放陶谦(id=7)
const caoFameBeforeRelease = state.factions[CAO_CAO].fame ?? 0;
state = releaseVassal(state, TAO_QIAN, CAO_CAO);
check('解放从属国后，宗主获得声望 +' + FAME_RELEASE_VASSAL, (state.factions[CAO_CAO].fame ?? 0) === caoFameBeforeRelease + FAME_RELEASE_VASSAL);
check('原从属国 overlordFactionId 清空为 undefined', state.factions[TAO_QIAN].overlordFactionId === undefined);
check('宗主 vassalFactionIds 剔除原从属国', !(state.factions[CAO_CAO].vassalFactionIds ?? []).includes(TAO_QIAN));
const linkRelease = findDiplomacy(state.diplomacy, CAO_CAO, TAO_QIAN);
check('解放后两国转为 FRIENDLY 且友好度提升至 80', linkRelease?.relation === DipRelation.FRIENDLY && linkRelease.favorability === 80);

// -------------------------------------------------------------
// 6. 岁首朝贡结算与月度流逝 (tickDiplomacyMonth)
// -------------------------------------------------------------
console.log('\n【6. 岁首朝贡结算与月度流逝】');

// 此时公孙度(id=10)仍然是曹操(id=3)的从属国
// 设定公孙度全境总金 1000，粮 2000；曹操全境总金 5000，粮 8000
const gongsunCities = state.factions[GONG_SUN_DU].cityIds;
const caoCities = state.factions[CAO_CAO].cityIds;
const updatedCities = { ...state.cities };
for (const cid of gongsunCities) {
  updatedCities[cid] = { ...updatedCities[cid], gold: 0, food: 0 };
}
updatedCities[gongsunCities[0]] = { ...updatedCities[gongsunCities[0]], gold: 1000, food: 2000 };

for (const cid of caoCities) {
  updatedCities[cid] = { ...updatedCities[cid], gold: 0, food: 0 };
}
updatedCities[caoCities[0]] = { ...updatedCities[caoCities[0]], gold: 5000, food: 8000 };

state = {
  ...state,
  cities: updatedCities,
  factions: {
    ...state.factions,
    [CAO_CAO]: { ...state.factions[CAO_CAO], gold: 5000, food: 8000 },
    [GONG_SUN_DU]: { ...state.factions[GONG_SUN_DU], gold: 1000, food: 2000, overlordFactionId: CAO_CAO, isAlive: true },
  },
  // 注入一条包含停火期的外交记录测试衰减
  diplomacy: state.diplomacy.map((link) => {
    if (link.factionA === CAO_CAO && link.factionB === LIU_BIAO) {
      return { ...link, truceMonths: 6 };
    }
    return link;
  }),
};

// 6.1 非正月推进（isYearStart = false）：仅衰减停战月数，不纳贡
const stateNonJan = tickDiplomacyMonth(state, false);
const linkCaoLiuNonJan = findDiplomacy(stateNonJan.diplomacy, CAO_CAO, LIU_BIAO);
check('非正月推进：停战保护期月数减 1 (6 → 5)', linkCaoLiuNonJan?.truceMonths === 5);
check('非正月推进：不扣缴从属国金钱', stateNonJan.factions[GONG_SUN_DU].gold === 1000);
check('非正月推进：宗主国金钱保持不变', stateNonJan.factions[CAO_CAO].gold === 5000);

// 6.2 正月岁首推进（isYearStart = true）：扣缴 15% 金粮朝贡
const expectedTributeGold = Math.floor(1000 * 0.15); // 150
const expectedTributeFood = Math.floor(2000 * 0.15); // 300
const stateJan = tickDiplomacyMonth(state, true);

check(
  `岁首朝贡：从属国扣减 15% 金钱 (${expectedTributeGold})，剩余 ${1000 - expectedTributeGold}`,
  stateJan.factions[GONG_SUN_DU].gold === 1000 - expectedTributeGold
);
check(
  `岁首朝贡：从属国扣减 15% 粮食 (${expectedTributeFood})，剩余 ${2000 - expectedTributeFood}`,
  stateJan.factions[GONG_SUN_DU].food === 2000 - expectedTributeFood
);
check(
  `岁首朝贡：宗主国接收朝贡金钱 +${expectedTributeGold}，达到 ${5000 + expectedTributeGold}`,
  stateJan.factions[CAO_CAO].gold === 5000 + expectedTributeGold
);
check(
  `岁首朝贡：宗主国接收朝贡粮食 +${expectedTributeFood}，达到 ${8000 + expectedTributeFood}`,
  stateJan.factions[CAO_CAO].food === 8000 + expectedTributeFood
);

// -------------------------------------------------------------
// 7. 多方会盟体系 (formCoalition, callJointWar, 胜利与到期结算)
// -------------------------------------------------------------
console.log('\n【7. 多方会盟体系】');

// 7.1 组建关东反董联军：盟主曹操(3)，盟员袁绍(2)、孙坚(4)，讨伐目标董卓(1)
const coalitionId = 'guandong_coalition_190';
state = formCoalition(
  state,
  coalitionId,
  '关东义军讨董联盟',
  DONG_ZHUO, // 董卓
  [CAO_CAO, YUAN_SHAO, SUN_JIAN], // 曹操、袁绍、孙坚
  18 // 18 个月
);

check('会盟实体成功挂载到 state.coalitions', (state.coalitions ?? []).length === 1);
const c = (state.coalitions ?? [])[0];
check('会盟 ID 与名称匹配', c?.id === coalitionId && c.name === '关东义军讨董联盟');
check('会盟目标为董卓 (id=1)', c?.targetFactionId === DONG_ZHUO);
check('盟员包括曹操、袁绍、孙坚', c?.memberFactionIds.length === 3 && c.memberFactionIds.includes(CAO_CAO));
check('盟员势力的 coalitionId 被正确记录', state.factions[CAO_CAO].coalitionId === coalitionId && state.factions[YUAN_SHAO].coalitionId === coalitionId);

// 检查盟员之间是否互为盟友
const linkCaoYuan = findDiplomacy(state.diplomacy, CAO_CAO, YUAN_SHAO);
const linkCaoSun = findDiplomacy(state.diplomacy, CAO_CAO, SUN_JIAN);
const linkYuanSun = findDiplomacy(state.diplomacy, YUAN_SHAO, SUN_JIAN);
check('盟员曹操与袁绍互结为 ALLIED', linkCaoYuan?.relation === DipRelation.ALLIED);
check('盟员曹操与孙坚互结为 ALLIED', linkCaoSun?.relation === DipRelation.ALLIED);
check('盟员袁绍与孙坚互结为 ALLIED', linkYuanSun?.relation === DipRelation.ALLIED);

// 检查全体盟员是否均对董卓进入 WAR
const linkCaoDong = findDiplomacy(state.diplomacy, CAO_CAO, DONG_ZHUO);
const linkYuanDong = findDiplomacy(state.diplomacy, YUAN_SHAO, DONG_ZHUO);
const linkSunDong = findDiplomacy(state.diplomacy, SUN_JIAN, DONG_ZHUO);
check('盟员曹操对董卓进入 WAR', linkCaoDong?.relation === DipRelation.WAR);
check('盟员袁绍对董卓进入 WAR', linkYuanDong?.relation === DipRelation.WAR);
check('盟员孙坚对董卓进入 WAR', linkSunDong?.relation === DipRelation.WAR);

// 7.2 盟主发布联合讨伐号召 (callJointWar)
// 检查盟员城池士气增益
const caoCityBeforeCall = Object.values(state.cities).find((c) => c.ruler === CAO_CAO);
const caoMoraleBeforeCall = caoCityBeforeCall?.troopsMorale ?? 50;
state = callJointWar(state, coalitionId, CAO_CAO);
const caoCityAfterCall = state.cities[caoCityBeforeCall!.id];
check('盟主号召协同讨伐后，全盟所属城池驻军士气 +5', caoCityAfterCall.troopsMorale === Math.min(100, caoMoraleBeforeCall + 5));

// 7.3 会盟月度结算：盟约期满自然解散
const stateExpiring: GameState = {
  ...state,
  coalitions: [
    { ...c, remainingMonths: 1 },
  ],
};
const stateExpired = tickDiplomacyMonth(stateExpiring, false);
check('联盟期满后，state.coalitions 中的联盟被自动解散移除', (stateExpired.coalitions ?? []).length === 0);
check('联盟期满后，成员势力 coalitionId 被清空重置为 undefined', stateExpired.factions[CAO_CAO].coalitionId === undefined);

// 7.4 会盟大获全胜（讨伐目标覆灭）
const stateWinning: GameState = {
  ...state,
  factions: {
    ...state.factions,
    [DONG_ZHUO]: { ...state.factions[DONG_ZHUO], isAlive: false }, // 董卓覆灭
  },
  coalitions: [
    { ...c, remainingMonths: 10 },
  ],
};
const fameBeforeWin = stateWinning.factions[CAO_CAO].fame ?? 0;
const stateWon = tickDiplomacyMonth(stateWinning, false);
check('讨伐目标灭亡，联盟大捷解散', (stateWon.coalitions ?? []).length === 0);
check('全体盟员获得大获全胜声望 +40', (stateWon.factions[CAO_CAO].fame ?? 0) === fameBeforeWin + 40);

// -------------------------------------------------------------
// 8. 天子三大诏命体系 (issueImperialDecree)
// -------------------------------------------------------------
console.log('\n【8. 天子三大诏命体系】');

// 8.1 未迎奉天子时颁布诏命：应被严格拦截
assert.throws(() => {
  // 此时洛阳归属董卓，曹操未迎奉天子
  const stateNoEmperor: GameState = {
    ...state,
    cities: {
      ...state.cities,
      1: { ...state.cities[1], ruler: DONG_ZHUO },
    },
  };
  issueImperialDecree(stateNoEmperor, 'denounce_traitor', DONG_ZHUO);
}, /未迎奉汉帝/);
check('未迎奉天子势力无法颁布天子诏命（正确抛出拦截异常）', true);

// 8.2 曹操成功迎奉天子（天子驻跸洛阳，洛阳归属曹操）
const empLoc = state.emperorLocation ?? 1;
let emperorState: GameState = {
  ...state,
  cities: {
    ...state.cities,
    [empLoc]: { ...state.cities[empLoc], ruler: CAO_CAO },
  },
};

// 8.2.1 讨逆明诏 (denounce_traitor)
const targetDong = emperorState.factions[DONG_ZHUO];
const mandateBefore = targetDong.mandate ?? 50;
const willBefore = targetDong.popularWill ?? 50;
emperorState = issueImperialDecree(emperorState, 'denounce_traitor', DONG_ZHUO);
check('讨逆明诏削减逆贼天命 -10', (emperorState.factions[DONG_ZHUO].mandate ?? 0) === Math.max(0, mandateBefore - 10));
check('讨逆明诏削减逆贼人心 -10', (emperorState.factions[DONG_ZHUO].popularWill ?? 0) === Math.max(0, willBefore - 10));

// 8.2.2 锡命册封诏 (appoint_prov_governor)
const targetYuan = emperorState.factions[YUAN_SHAO];
const yuanFameBefore = targetYuan.fame ?? 0;
const linkCaoYuanDecree = findDiplomacy(emperorState.diplomacy, CAO_CAO, YUAN_SHAO);
const favorBefore = linkCaoYuanDecree?.favorability ?? 0;
emperorState = issueImperialDecree(emperorState, 'appoint_prov_governor', YUAN_SHAO, '冀州');
check('锡命册封诏赐予诸侯声望 +25', (emperorState.factions[YUAN_SHAO].fame ?? 0) === Math.min(1000, yuanFameBefore + 25));
const linkCaoYuanAfterDecree = findDiplomacy(emperorState.diplomacy, CAO_CAO, YUAN_SHAO);
check('锡命册封诏增进其对朝廷好感 +30', (linkCaoYuanAfterDecree?.favorability ?? 0) === Math.min(100, favorBefore + 30));

// 8.2.3 天下征贡诏 (summon_tribute)
const yuanTarget = emperorState.factions[YUAN_SHAO];
const caoPlayer = emperorState.factions[CAO_CAO];
const yuanMainCity = yuanTarget.capitalCityId ?? yuanTarget.cityIds[0];
const caoMainCity = caoPlayer.capitalCityId ?? caoPlayer.cityIds[0];

const decreeCities = { ...emperorState.cities };
for (const cid of yuanTarget.cityIds) {
  decreeCities[cid] = { ...decreeCities[cid], gold: 0, food: 0 };
}
decreeCities[yuanMainCity] = { ...decreeCities[yuanMainCity], gold: 1000, food: 2000 };

for (const cid of caoPlayer.cityIds) {
  decreeCities[cid] = { ...decreeCities[cid], gold: 0, food: 0 };
}
decreeCities[caoMainCity] = { ...decreeCities[caoMainCity], gold: 3000, food: 6000 };

emperorState = {
  ...emperorState,
  cities: decreeCities,
  factions: {
    ...emperorState.factions,
    [CAO_CAO]: { ...emperorState.factions[CAO_CAO], gold: 3000, food: 6000 },
    [YUAN_SHAO]: { ...emperorState.factions[YUAN_SHAO], gold: 1000, food: 2000 },
  },
};
emperorState = issueImperialDecree(emperorState, 'summon_tribute', YUAN_SHAO);
check('天下征贡诏从目标诸侯国库征缴 200 金', emperorState.factions[YUAN_SHAO].gold === 800);
check('天下征贡诏从目标诸侯国库征缴 500 粮', emperorState.factions[YUAN_SHAO].food === 1500);
check('天子行在接收征贡 200 金', emperorState.factions[CAO_CAO].gold === 3200);
check('天子行在接收征贡 500 粮', emperorState.factions[CAO_CAO].food === 6500);

// -------------------------------------------------------------
// 9. 24 个月全息推演生命周期、零崩溃与数值无 NaN 检查
// -------------------------------------------------------------
console.log('\n【9. 24 个月全息推演生命周期、零崩溃与数值无 NaN 检查】');

createGame(4, CAO_CAO);
let simState = getGame();

// 注入测试会盟与从属国，确保推演期间会经历跨年朝贡与会盟流逝
simState = formCoalition(simState, 'sim_coalition', '反董义军', DONG_ZHUO, [CAO_CAO, YUAN_SHAO], 12);
simState = submitVassal(simState, CAO_CAO, GONG_SUN_DU); // 公孙度从属称臣求庇护

const mockRng = () => 0.42;

for (let month = 1; month <= 24; month++) {
  simState = advanceTurn(simState, mockRng);

  // 严格检查任何基础数值无 NaN
  for (const f of Object.values(simState.factions)) {
    assert.ok(!Number.isNaN(f.gold), `第 ${month} 月 Faction ${f.id} gold 为 NaN`);
    assert.ok(!Number.isNaN(f.food), `第 ${month} 月 Faction ${f.id} food 为 NaN`);
    assert.ok(!Number.isNaN(f.fame), `第 ${month} 月 Faction ${f.id} fame 为 NaN`);
  }

  for (const c of Object.values(simState.cities)) {
    assert.ok(!Number.isNaN(c.gold), `第 ${month} 月 City ${c.id} gold 为 NaN`);
    assert.ok(!Number.isNaN(c.food), `第 ${month} 月 City ${c.id} food 为 NaN`);
    assert.ok(!Number.isNaN(c.population), `第 ${month} 月 City ${c.id} population 为 NaN`);
    assert.ok(!Number.isNaN(c.stats.morale), `第 ${month} 月 City ${c.id} morale 为 NaN`);
  }
}

check('24 个月连续推进无异常崩溃，包含会盟到期与两次岁首纳贡结算', true);
check('24 个月演进后所有势力与城池数值无 NaN', true);
check('会盟状态在 12 个月后已平稳解散', (simState.coalitions ?? []).length === 0);

console.log(`\n=============================================================`);
console.log(`🎉 恭喜！Phase 7-02 深度外交体系全部 ${passedAssertions} 项断言 100% 绿色通过！`);
console.log(`=============================================================\n`);
