// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 0-B 数据扩容 P0B-15：events.json 24 → 59（为 7 新剧本挂接叙事线，Session 430）。
 *
 * 规则（docs/08 §十 为真源；docs/00 §九红线）：
 * - 新增 id 300~334，每剧本 5 个事件、全部单剧本链接（scenarioIds=[唯一剧本]）——
 *   规避多剧本势力本地 id 的耦合，validate-data 的「active in every linked scenario」
 *   约束天然满足。
 * - 效果实体必须在场（脚本断言 loyalty/recruit 目标 ∈ 该剧本 availableOfficerIds；
 *   troops/gold/develop 目标城 ∈ 1..106 且 controller 条件值 ∈ 该剧本 active 势力）。
 * - 事件引擎（tickEvents）仅按剧本白名单+史料层扫描；dateWindow 全部落在所属剧本
 *   [startYear, endYear] 内；decisionFactionId 全部显式（避免无主事件挂起玩家）。
 * - 史料出处不把演义标成正史：演义名场面标 literature/legend 层。
 * - 剧本 1/2 与既有 24 事件（id 100~123）逐字节保留。
 *
 * 运行：node scripts/gen-0b-events.mjs（幂等：剥掉 id≥124 的生成段重排全表）。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'server', 'src', 'data', 'events.json');
const SCENARIOS = join(ROOT, 'server', 'src', 'data', 'scenarios.json');
const OFFICERS = join(ROOT, 'server', 'src', 'data', 'officers.json');

const OFFICER_IDS = new Set(JSON.parse(readFileSync(OFFICERS, 'utf-8')).map((o) => o.id));

const ev = (id, name, description, scId, decision, window, conditions, dialogues, choices, extra = {}) => ({
  id,
  name,
  description,
  category: 'historical',
  sourceClass: extra.sourceClass ?? 'official_history',
  sources: extra.sources ?? ['《三国志》'],
  scenarioIds: [scId],
  dateWindow: window,
  decisionFactionId: decision,
  conditions,
  dialogues,
  choices,
  ...extra.rest,
});

const condAlive = (fid) => ({ type: 'faction', field: 'isAlive', targetId: fid, operator: 'equals', value: true });
const condCity = (city, fid) => ({ type: 'city', field: 'controllerId', targetId: city, operator: 'equals', value: fid });
const effTroops = (city, v) => ({ type: 'troops', target: 'city', targetId: city, field: 'troops', value: v });
const effGold = (city, v) => ({ type: 'gold', target: 'city', targetId: city, field: 'gold', value: v });
const effDevelop = (city, v) => ({ type: 'develop', target: 'city', targetId: city, field: 'farm', value: v });
const effLoyalty = (officerId, v) => ({ type: 'loyalty', target: 'officer', targetId: officerId, field: 'loyalty', value: v });
const effRelation = (fid, v) => ({ type: 'relation', target: 'faction', targetId: fid, field: 'favorability', value: v });
const effWar = (fid) => ({ type: 'war', target: 'faction', targetId: fid, field: 'relation', value: 'war' });
const effCapital = (fid, city) => ({ type: 'capital', target: 'faction', targetId: fid, field: 'capitalCityId', value: city });
const dlg = (speakerId, speakerName, text) => ({ speakerId, speakerName, text });
const ch = (label, aiWeight, effects, personality, ideal) => ({
  label,
  aiWeight,
  effects,
  ...(personality ? { aiPersonalityWeights: personality } : {}),
  ...(ideal ? { aiIdealWeights: ideal } : {}),
});

const NEW_EVENTS = [
  // ── S3 黄巾之乱（184~186；1汉军 2黄巾 3凉州叛军） ─────────────
  ev(300, '天公将军举义', '张角以「苍天已死，黄天当立」相号召，八州并起，天下响应。', 3, 2,
    { startYear: 184, startMonth: 2, endYear: 184, endMonth: 3 },
    [condAlive(2), condCity(40, 2)],
    [dlg(183, '张角', '苍天已死，黄天当立。岁在甲子，天下大吉！')],
    [ch('传檄八州，同日俱举', 80, [effTroops(40, 2000)], { brave: 20, bold: 15 }, { hegemony: 20 }),
     ch('深沟高垒，蓄势待发', 20, [effGold(44, 800)], { cautious: 40 })],
    { sources: ['《后汉书·皇甫嵩传》'] }),
  ev(301, '汉室驰檄讨贼', '洛阳震动，汉廷解除党锢，发天下精兵分路进讨。', 3, 1,
    { startYear: 184, startMonth: 3, endYear: 184, endMonth: 4 },
    [condAlive(1), condCity(1, 1)],
    [dlg(280, '皇甫嵩', '宜解党锢之禁，发中厩钱马，出兵以讨之。')],
    [ch('解除党锢，悉发精兵', 70, [effTroops(1, 2500)], { bold: 15 }, { hegemony: 15 }),
     ch('遣使赦抚，分化贼众', 30, [effLoyalty(280, 5)], { cautious: 30 })],
    { sources: ['《后汉书·皇甫嵩传》'] }),
  ev(302, '颍川之役', '波才所部黄巾攻略颍川，长社告急，皇甫嵩驰赴前线。', 3, 1,
    { startYear: 184, startMonth: 4, endYear: 184, endMonth: 8 },
    [condAlive(1), condCity(3, 1)],
    [dlg(280, '皇甫嵩', '贼依草结营，当因风纵火，出其不意破之。')],
    [ch('因风纵火，夜袭长社', 65, [effTroops(1, 2000)], { brave: 25 }),
     ch('持重坚壁，俟其自乱', 35, [effGold(1, 1000)], { cautious: 40 })],
    { rest: { prerequisiteEventIds: [301] } }),
  ev(303, '凉州烽火', '北宫伯玉、边章裹挟羌胡叛乱，劫韩遂主兵事，兵锋指向三辅。', 3, 3,
    { startYear: 184, startMonth: 6, endYear: 184, endMonth: 12 },
    [condAlive(3), condCity(23, 3)],
    [dlg(174, '韩遂', '事已至此，唯有举兵自全。')],
    [ch('联羌攻掠三辅', 55, [effWar(1), effTroops(23, 1500)], { brave: 20 }),
     ch('受抚拜将，暂附汉室', 45, [effRelation(1, 25)], { cautious: 30 })],
    { sources: ['《后汉书·董卓传》'] }),
  ev(304, '广宗围城', '张角困守广宗，皇甫嵩筑围凿堑，造云梯以临城。', 3, 1,
    { startYear: 184, startMonth: 8, endYear: 184, endMonth: 12 },
    [condAlive(1), condCity(40, 2)],
    [dlg(280, '皇甫嵩', '贼众困乏，破之必矣。')],
    [ch('筑围凿堑，昼夜急攻', 60, [effTroops(1, 2200)], { bold: 20 }),
     ch('缓困待其内变', 40, [effGold(1, 1500)], { cautious: 35 })],
    { rest: { prerequisiteEventIds: [301] } }),

  // ── S4 群雄讨董（190~193；1董卓 2袁绍 3曹操 4孙坚 5袁术 6公孙瓒 7陶谦 8刘表） ──
  ev(305, '关东举义', '关东州郡同时俱起，众各数万，共推袁绍为盟主讨董卓。', 4, 2,
    { startYear: 190, startMonth: 2, endYear: 190, endMonth: 3 },
    [condAlive(2), condCity(46, 2)],
    [dlg(113, '袁绍', '董卓逆天无道，今举义兵，天下响应。')],
    [ch('自领盟主，移檄讨董', 75, [effWar(1), effRelation(3, 15), effRelation(4, 15)], { bold: 20 }, { fame: 20 }),
     ch('虚张盟主之名，按兵自保', 25, [effGold(46, 1000)], { cautious: 40 })],
    { sources: ['《三国志·魏书·武帝纪》', '《后汉书·袁绍传》'] }),
  ev(306, '焚洛迁都', '关东兵起，董卓胁天子迁都长安，尽徙洛阳人数百万口，焚烧宫庙官府。', 4, 1,
    { startYear: 190, startMonth: 3, endYear: 190, endMonth: 4 },
    [condAlive(1), condCity(1, 1)],
    [dlg(112, '董卓', '关东兵盛，徙都长安以避之。')],
    [ch('徙天子都长安', 70, [effCapital(1, 2), effTroops(2, 2000)], { bold: 15 }),
     ch('留守雒阳，力战关东', 30, [effTroops(1, 2200)], { brave: 20 })],
    { sources: ['《后汉书·董卓传》'] }),
  ev(307, '荥阳追击', '曹操引兵西追董卓，至荥阳汴水，遇卓将徐荣，战不利。', 4, 3,
    { startYear: 190, startMonth: 3, endYear: 190, endMonth: 5 },
    [condAlive(3), condCity(7, 3)],
    [dlg(1, '曹操', '举义兵以诛暴乱，今大众已合，诸君何疑！')],
    [ch('孤军西追，以死继之', 60, [effTroops(7, -600)], { brave: 30 }),
     ch('还屯陈留，养锐图后', 40, [effGold(7, 900)], { cautious: 40 })],
    { rest: { prerequisiteEventIds: [305] } }),
  ev(308, '阳人之捷', '孙坚与董卓军战于阳人，大破之，枭其都督华雄。', 4, 4,
    { startYear: 190, startMonth: 10, endYear: 191, endMonth: 2 },
    [condAlive(4), condCity(64, 4)],
    [dlg(114, '孙坚', '贼势已沮，宜乘胜进兵洛阳。')],
    [ch('乘胜进逼洛阳', 70, [effWar(1), effTroops(64, 1500)], { brave: 25 }),
     ch('整军实，缓进兵', 30, [effGold(64, 800)], { cautious: 30 })],
    { sources: ['《三国志·吴书·孙破虏讨逆传》'], sourceClass: 'annotated_history' }),
  ev(309, '盟散内讧', '义兵既合而各怀异计，袁术扣减军粮，盟约渐解。', 4, 5,
    { startYear: 191, startMonth: 1, endYear: 191, endMonth: 8 },
    [condAlive(5), condCity(13, 5)],
    [dlg(181, '袁术', '盟军各拥部众，粮秣当从权裁节。')],
    [ch('扣粮自肥，阴图南阳', 55, [effTroops(13, 1500)], { bold: 15 }),
     ch('续供军粮，共讨国贼', 45, [effRelation(2, 15)], { cautious: 20 }, { fame: 15 })],
    { sources: ['《三国志·魏书·武帝纪》裴注引《英雄记》'], sourceClass: 'annotated_history' }),

  // ── S5 群雄逐鹿（194~197；1吕布 2曹操 3李傕 4袁绍 5袁术 6陶谦 7刘表） ──
  ev(310, '濮阳鏖兵', '吕布屯濮阳与曹操相持百余日，蝗虫大起，百姓相食，两家粮尽而止。', 5, 2,
    { startYear: 194, startMonth: 3, endYear: 194, endMonth: 9 },
    [condAlive(2), condCity(51, 2), condCity(8, 1)],
    [dlg(1, '曹操', '布得野而不得城，且收麦恤众，再图后举。')],
    [ch('反攻濮阳，力战复兖', 65, [effTroops(51, 1800)], { brave: 20 }),
     ch('收麦坚壁，缓图再举', 35, [effGold(51, 1300)], { cautious: 35 })],
    { sources: ['《三国志·魏书·武帝纪》'] }),
  ev(311, '曹嵩之难', '曹操父曹嵩避难琅琊，过徐州为陶谦部将所杀。', 5, 2,
    { startYear: 194, startMonth: 6, endYear: 194, endMonth: 10 },
    [condAlive(2), condCity(9, 6)],
    [dlg(1, '曹操', '嵩吾父也，此仇不报，何颜立于天下！')],
    [ch('尽起兖州之兵复仇', 80, [effWar(6)], { brave: 30 }, { hegemony: 15 }),
     ch('忍愤兴诉，移檄州郡', 20, [effRelation(6, -15)], { cautious: 30 })],
    { sources: ['《三国志·魏书·武帝纪》裴注'] }),
  ev(312, '三让徐州', '陶谦病笃，谓别驾糜竺曰：非刘备不能安此州，遂以州托之。', 5, 6,
    { startYear: 194, startMonth: 10, endYear: 195, endMonth: 3 },
    [condAlive(6), condCity(9, 6)],
    [dlg(250, '陶谦', '非刘备不能安此州也。')],
    [ch('举州托于刘备', 65, [effLoyalty(2, 15)], { cautious: 20 }, { fame: 20 }),
     ch('传位长子，量力自守', 35, [effTroops(9, 900)], { cautious: 30 })],
    { sources: ['《三国志·蜀书·先主传》'] }),
  ev(313, '关中大乱', '李傕、郭汜相攻于长安，天子为质于营中，公卿百官随从死者不可胜数。', 5, 3,
    { startYear: 195, startMonth: 3, endYear: 195, endMonth: 8 },
    [condAlive(3), condCity(2, 3)],
    [dlg(177, '李傕', '郭阿多叛公矣！')],
    [ch('纵兵相攻，两不相下', 60, [effTroops(2, -1200)], { brave: 20 }),
     ch('讲和罢兵，共奉天子', 40, [effGold(2, 1000)], { cautious: 30 })],
    { sources: ['《后汉书·董卓传》'] }),
  ev(314, '孙郎渡江', '孙策说袁术，愿助平江东以报父仇，术以旧部千余人与之。', 5, 5,
    { startYear: 195, startMonth: 5, endYear: 195, endMonth: 12 },
    [condAlive(5), condCity(18, 5)],
    [dlg(105, '孙策', '愿助将军平定江东，以雪父仇。')],
    [ch('假兵渡江，平定江东', 70, [effTroops(18, 1200)], { brave: 25 }),
     ch('留策自随，不假兵柄', 30, [effLoyalty(105, -10)], { cautious: 35 })],
    { sources: ['《三国志·吴书·孙破虏讨逆传》'] }),

  // ── S6 官渡对峙（200~202；1袁绍 2曹操 3孙策 4刘表 5刘璋 6张鲁 7马腾） ──
  ev(315, '白马延津', '袁绍遣颜良攻东郡太守刘延于白马，曹操北救，官渡之势自此始。', 6, 1,
    { startYear: 200, startMonth: 3, endYear: 200, endMonth: 6 },
    [condAlive(1), condCity(5, 1)],
    [dlg(113, '袁绍', '南向以争天下，先取白马。')],
    [ch('遣良围白马', 60, [effTroops(5, 1500)], { bold: 15 }),
     ch('并力缓进，步步为营', 40, [effGold(5, 1200)], { cautious: 30 })],
    { sources: ['《三国志·魏书·武帝纪》'] }),
  ev(316, '江东变起', '孙策遇刺于丹徒，创甚，呼弟孙权佩以印绶，托以后事。', 6, 3,
    { startYear: 200, startMonth: 4, endYear: 200, endMonth: 6 },
    [condAlive(3), condCity(16, 3)],
    [dlg(105, '孙策', '举江东之众，决机于两陈之间，与天下争衡，卿不如我；举贤任能，各尽其心，以保江东，我不如卿。')],
    [ch('以弟权继领部众', 80, [effLoyalty(11, 10)], { cautious: 20 }, { fame: 15 }),
     ch('内事托张昭，外托周瑜', 20, [effLoyalty(149, 10)], { cautious: 25 })],
    { sources: ['《三国志·吴书·张昭传》', '《三国志·吴书·孙破虏讨逆传》'] }),
  ev(317, '乌巢焚粮', '袁绍谋士许攸来奔，献烧乌巢之策，曹操亲率轻兵夜袭，大破袁军。', 6, 2,
    { startYear: 200, startMonth: 9, endYear: 200, endMonth: 11 },
    [condAlive(2), condCity(3, 2)],
    [dlg(1, '曹操', '袁氏失此天授，破之必矣！')],
    [ch('亲率轻兵，夜袭乌巢', 75, [effTroops(3, 2500)], { brave: 30 }, { hegemony: 20 }),
     ch('坚垒官渡，待其自变', 25, [effGold(3, 1500)], { cautious: 30 })],
    { sources: ['《三国志·魏书·武帝纪》'] }),
  ev(318, '汝南扰局', '刘备奉袁绍命，与刘辟等略汝南，扰曹操后方。', 6, 1,
    { startYear: 200, startMonth: 8, endYear: 201, endMonth: 3 },
    [condAlive(1), condCity(5, 1)],
    [dlg(113, '袁绍', '遣玄德南徇，可分曹氏之势。')],
    [ch('遣备徇汝南，扰曹之后', 60, [effTroops(1, 1200)], { bold: 15 }),
     ch('并力官渡，正面决胜', 40, [effTroops(5, 1000)], { cautious: 25 })],
    { sources: ['《三国志·蜀书·先主传》'] }),
  ev(319, '仓亭余烬', '官渡既败，袁绍郁愤呕血，复收散卒攻曹操于仓亭，再不利。', 6, 1,
    { startYear: 201, startMonth: 8, endYear: 202, endMonth: 4 },
    [condAlive(1), condCity(5, 1)],
    [dlg(113, '袁绍', '吾自军中积累，未尝如官渡之败！')],
    [ch('收残兵，再图南向', 55, [effTroops(5, 1400)], { bold: 15 }),
     ch('平叛安后，训卒养民', 45, [effGold(5, 1400)], { cautious: 30 })],
    { rest: { prerequisiteEventIds: [317] } }),

  // ── S7 赤壁前夜（208~210；1曹操 2刘备 3孙权 4刘表 5刘璋 6马超） ──
  ev(320, '南征之檄', '曹操罢三公自为丞相，大治水军于玄武池，移檄南征荆州。', 7, 1,
    { startYear: 208, startMonth: 6, endYear: 208, endMonth: 9 },
    [condAlive(1), condCity(5, 1)],
    [dlg(1, '曹操', '今治水军八十万众，方与将军会猎于吴。')],
    [ch('大治水军，南征荆州', 70, [effTroops(5, 2500)], { bold: 20 }, { hegemony: 20 }),
     ch('先定关西，缓图江南', 30, [effWar(6)], { cautious: 30 })],
    { sources: ['《三国志·魏书·武帝纪》'] }),
  ev(321, '刘表病笃', '刘表病笃，荆州内二子争立，外惧曹氏之逼。', 7, 4,
    { startYear: 208, startMonth: 7, endYear: 208, endMonth: 9 },
    [condAlive(4), condCity(15, 4)],
    [dlg(167, '刘表', '荆州之地，托付何人方保无虞？')],
    [ch('属琮以州，附曹自保', 55, [effRelation(1, 25)], { cautious: 35 }),
     ch('以州托刘备，共御北敌', 45, [effLoyalty(2, 10)], { cautious: 20 }, { fame: 15 })],
    { sources: ['《三国志·魏书·刘表传》'] }),
  ev(322, '当阳之败', '曹操以轻骑追刘备，一日一夜行三百余里，及于当阳长坂。', 7, 2,
    { startYear: 208, startMonth: 9, endYear: 208, endMonth: 10 },
    [condAlive(2), condCity(60, 2)],
    [dlg(10, '赵云', '主公且上马，云愿死战护送家眷！')],
    [ch('斜趋汉津，进屯夏口', 75, [effTroops(60, 900)], { cautious: 25 }),
     ch('收兵死战，不弃百姓', 25, [effLoyalty(6, 8)], { brave: 25 }, { fame: 20 })],
    { sources: ['《三国志·蜀书·先主传》'], sourceClass: 'annotated_history' }),
  ev(323, '柴桑定盟', '诸葛亮随鲁肃见孙权于柴桑，陈联刘抗曹之势，孙权决计破操。', 7, 2,
    { startYear: 208, startMonth: 10, endYear: 208, endMonth: 11 },
    [condAlive(2), condCity(60, 2), condCity(17, 3)],
    [dlg(4, '诸葛亮', '将军能与豫州协力，破曹军必矣——鼎足之形成矣。')],
    [ch('结孙氏，共抗曹操', 80, [effRelation(3, 40)], { bold: 15 }, { fame: 20 }),
     ch('引兵自图荆南', 20, [effRelation(3, -20)], { cautious: 30 })],
    { sources: ['《三国志·蜀书·诸葛亮传》'] }),
  ev(324, '火烧赤壁', '黄盖献火攻之策，先书诈降，乘东南风纵火，尽烧北军船舰，曹操北还。', 7, 3,
    { startYear: 208, startMonth: 11, endYear: 209, endMonth: 1 },
    [condAlive(3), condCity(17, 3)],
    [dlg(144, '黄盖', '操军方连船舰，首尾相接，可烧而走也。')],
    [ch('用火攻，尽烧北船', 75, [effWar(1), effTroops(17, 2500)], { brave: 25 }),
     ch('阻江为营，持久拒之', 25, [effTroops(17, 1200)], { cautious: 30 })],
    { sources: ['《三国志·吴书·周瑜传》'] }),

  // ── S8 汉中与襄樊（219~221；1曹魏 2蜀汉 3孙吴） ───────────────
  ev(325, '进位汉中王', '群下上表推刘备为汉中王，设坛场于沔阳，陈兵出境，拜关羽为前将军假节钺。', 8, 2,
    { startYear: 219, startMonth: 9, endYear: 219, endMonth: 10 },
    [condAlive(2), condCity(19, 2)],
    [dlg(2, '刘备', '备不得已，顺众议进位，以图讨逆。')],
    [ch('设坛沔水，进位汉中王', 80, [effGold(19, 2000), effLoyalty(6, 5)], { bold: 15 }, { fame: 20 }),
     ch('上表辞让，以卑自守', 20, [effLoyalty(4, 5)], { cautious: 25 })],
    { sources: ['《三国志·蜀书·先主传》'] }),
  ev(326, '水淹七军', '关羽攻樊，汉水泛涨，于禁七军皆没，禁降羽，庞德不屈而死，羽威震华夏。', 8, 2,
    { startYear: 219, startMonth: 9, endYear: 219, endMonth: 11 },
    [condAlive(2), condCity(14, 2)],
    [dlg(6, '关羽', '秋霖大水，天助我也——乘势攻樊！')],
    [ch('乘汉水泛涨，攻樊执禁', 75, [effTroops(14, 2500)], { brave: 25 }),
     ch('顿兵坚城，缓图万全', 25, [effGold(14, 1200)], { cautious: 30 })],
    { sources: ['《三国志·蜀书·关羽传》'] }),
  ev(327, '白衣渡江', '吕蒙称病还建业，陆逊代之卑辞自抑；蒙潜军白衣摇橹，昼夜兼行袭取江陵。', 8, 3,
    { startYear: 219, startMonth: 11, endYear: 220, endMonth: 1 },
    [condAlive(3), condCity(17, 3)],
    [dlg(142, '吕蒙', '羽意已骄，可乘虚而入——将士皆作商人服，昼夜西上。')],
    [ch('白衣摇橹，袭取江陵', 75, [effWar(2), effTroops(17, 2500)], { bold: 20 }),
     ch('罢兵修好，共分荆州', 25, [effRelation(2, 25)], { cautious: 30 })],
    { sources: ['《三国志·吴书·吕蒙传》'] }),
  ev(328, '麦城之困', '江陵既失，关羽进退失据，西还麦城，权遣将断其走道。', 8, 2,
    { startYear: 219, startMonth: 12, endYear: 220, endMonth: 2 },
    [condAlive(2), condCity(14, 3)],
    [dlg(6, '关羽', '虎女焉能再事小人！宁死不降。')],
    [ch('敛兵西保，再图荆州', 55, [effGold(19, 1200)], { cautious: 30 }),
     ch('婴城死守，以待援兵', 45, [effLoyalty(6, 8)], { brave: 20 })],
    { rest: { prerequisiteEventIds: [327] } }),
  ev(329, '受禅台', '曹丕承父基业，汉献帝禅位，丕即皇帝位，国号大魏，汉亡。', 8, 1,
    { startYear: 220, startMonth: 10, endYear: 220, endMonth: 12 },
    [condAlive(1), condCity(1, 1)],
    [dlg(252, '曹丕', '舜禹之事，吾知之矣。')],
    [ch('受禅代汉，建号大魏', 70, [effRelation(2, -40), effRelation(3, -20)], { bold: 15 }, { hegemony: 25 }),
     ch('谨守臣节，奉汉如故', 30, [effTroops(1, 1500)], { cautious: 30 })],
    { sources: ['《三国志·魏书·文帝纪》'] }),

  // ── S9 五丈原对峙（234~240；1曹魏 2蜀汉 3孙吴） ───────────────
  ev(330, '屯田渭滨', '诸葛亮出斜谷屯五丈原，分兵屯田于渭滨与魏民杂处，为久驻之基。', 9, 2,
    { startYear: 234, startMonth: 3, endYear: 234, endMonth: 5 },
    [condAlive(2), condCity(20, 2)],
    [dlg(4, '诸葛亮', '亮欲为久驻之计，耕者杂于渭滨居民之间。')],
    [ch('分兵屯田，为久驻之基', 70, [effDevelop(20, 10)], { cautious: 25 }),
     ch('恃众求战，先声夺人', 30, [effTroops(20, 1800)], { bold: 20 })],
    { sources: ['《三国志·蜀书·诸葛亮传》'] }),
  ev(331, '合肥新城之围', '孙权应蜀之约，亲率大军号称十万攻合肥新城，东西并进。', 9, 3,
    { startYear: 234, startMonth: 5, endYear: 234, endMonth: 8 },
    [condAlive(3), condCity(17, 3)],
    [dlg(3, '孙权', '蜀约既定，兵不可虚出——北上合肥！')],
    [ch('亲率大军，应约北上', 65, [effTroops(17, 2200)], { bold: 15 }),
     ch('声东击西，观衅而止', 35, [effGold(17, 1500)], { cautious: 30 })],
    { sources: ['《三国志·吴书·吴主传》'] }),
  ev(332, '巾帼之遗', '诸葛亮数挑战，司马懿不出，乃遗巾帼妇人之饰以激之。', 9, 2,
    { startYear: 234, startMonth: 6, endYear: 234, endMonth: 9 },
    [condAlive(2), condCity(20, 2)],
    [dlg(4, '诸葛亮', '懿甘受巾帼之辱，其志不可小觑。')],
    [ch('遗巾帼以激其战', 60, [effTroops(20, 900)], { bold: 20 }),
     ch('分兵屯田，坚忍持重', 40, [effGold(19, 900)], { cautious: 25 })],
    { rest: { prerequisiteEventIds: [330] }, sources: ['《三国志·蜀书·诸葛亮传》裴注引《魏氏春秋》'], sourceClass: 'annotated_history' }),
  ev(333, '星陨五丈原', '相持百余日，诸葛亮病笃，卒于军中，年五十四；蜀军秘不发丧，整军而退。', 9, 2,
    { startYear: 234, startMonth: 8, endYear: 234, endMonth: 11 },
    [condAlive(2), condCity(20, 2)],
    [dlg(4, '诸葛亮', '悠悠苍天，曷此其极……愿陛下亲贤臣，远小人，则汉室之隆，犹可计日而待。')],
    [ch('举哀徐退，整军还汉', 70, [effTroops(20, 1200), effLoyalty(130, 5)], { cautious: 25 }),
     ch('秘不发丧，缓退断后', 30, [effGold(19, 1000)], { cautious: 30 })],
    { rest: { prerequisiteEventIds: [330] }, sources: ['《三国志·蜀书·诸葛亮传》'], sourceClass: 'annotated_history' }),
  ev(334, '吴师退屯', '魏将拒守合肥新城，吴军士卒多病，权遂引军退。', 9, 3,
    { startYear: 234, startMonth: 7, endYear: 234, endMonth: 10 },
    [condAlive(3), condCity(17, 3)],
    [dlg(3, '孙权', '新城未拔，士卒多病——全师而退，来年再举。')],
    [ch('全师而退，保境息民', 65, [effTroops(17, 1200)], { cautious: 30 }),
     ch('留兵再举，志在必得', 35, [effTroops(17, 800)], { bold: 15 })],
    { sources: ['《三国志·吴书·吴主传》'] }),
];

// ── 展开与校验 ─────────────────────────────────────────────────
const rawEvents = JSON.parse(readFileSync(FILE, 'utf-8'));
if (rawEvents.length !== 24 && rawEvents.length !== 59) throw new Error(`unexpected input: ${rawEvents.length} events`);
const baseEvents = rawEvents.filter((e) => e.id <= 123);
if (baseEvents.length !== 24) throw new Error(`base events found ${baseEvents.length}, expect 24`);

const scenarios = JSON.parse(readFileSync(SCENARIOS, 'utf-8'));
const scById = new Map(scenarios.map((s) => [s.id, s]));

for (const e of NEW_EVENTS) {
  const sc = scById.get(e.scenarioIds[0]);
  if (!sc) throw new Error(`E${e.id} scenario ${e.scenarioIds[0]} missing`);
  if (sc.startState.year !== sc.startYear) throw new Error(`S${sc.id} startState.year mismatch`);
  if (e.dateWindow.startYear < sc.startYear || e.dateWindow.endYear > sc.endYear) {
    throw new Error(`E${e.id} window outside scenario ${sc.id} range`);
  }
  const active = new Set(sc.startState.activeFactionIds);
  if (!active.has(e.decisionFactionId)) throw new Error(`E${e.id} decision faction ${e.decisionFactionId} not active in S${sc.id}`);
  const available = new Set(sc.availableOfficerIds);
  for (const c of e.conditions) {
    if (c.type === 'city' && !active.has(c.value)) throw new Error(`E${e.id} city condition controller ${c.value} not active in S${sc.id}`);
    if (c.type === 'faction' && !active.has(c.targetId)) throw new Error(`E${e.id} faction condition ${c.targetId} not active in S${sc.id}`);
  }
  for (const choice of e.choices) {
    for (const fx of choice.effects) {
      if (['recruit', 'loyalty'].includes(fx.type) && !available.has(fx.targetId)) {
        throw new Error(`E${e.id} ${fx.type} target ${fx.targetId} not positioned in S${sc.id}`);
      }
      if (['relation', 'war'].includes(fx.type) && !active.has(fx.targetId)) {
        throw new Error(`E${e.id} ${fx.type} target ${fx.targetId} not active in S${sc.id}`);
      }
      if (['troops', 'gold', 'food', 'population', 'develop'].includes(fx.type)) {
        const cid = fx.targetId;
        if (!(cid >= 1 && cid <= 106)) throw new Error(`E${e.id} ${fx.type} invalid city ${cid}`);
      }
      if (fx.type === 'capital' && !active.has(fx.targetId)) {
        throw new Error(`E${e.id} capital target ${fx.targetId} not active in S${sc.id}`);
      }
    }
  }
  if (e.choices.length === 0) throw new Error(`E${e.id} has no choices`);
  if (e.choices.some((c) => c.aiWeight == null)) throw new Error(`E${e.id} choice missing aiWeight`);
  if (e.dialogues.length === 0) throw new Error(`E${e.id} has no dialogues`);
}

// 事件 → 剧本 双向链接：更新 id≥3 剧本的 eventIds
const baseScenarios = scenarios.filter((s) => s.id <= 2);
for (const e of NEW_EVENTS) {
  const sc = scenarios.find((s) => s.id === e.scenarioIds[0]);
  if (!sc.eventIds.includes(e.id)) sc.eventIds.push(e.id);
  sc.eventIds.sort((a, b) => a - b);
}
// 双向一致性断言
for (const sc of scenarios) {
  for (const eid of sc.eventIds) {
    const evt = [...baseEvents, ...NEW_EVENTS].find((x) => x.id === eid);
    if (!evt || !evt.scenarioIds.includes(sc.id)) throw new Error(`S${sc.id} event ${eid} not linked both ways`);
  }
  for (const evt of [...baseEvents, ...NEW_EVENTS]) {
    if (evt.scenarioIds.includes(sc.id) && !sc.eventIds.includes(evt.id)) {
      throw new Error(`E${evt.id} links S${sc.id} but scenario does not list it`);
    }
  }
}

const merged = [...baseEvents, ...NEW_EVENTS].sort((a, b) => a.id - b.id);
if (merged.length !== 59) throw new Error(`expect 59 events (24 base + 35 new), got ${merged.length}`);
for (const b of baseEvents) {
  const before = rawEvents.find((r) => r.id === b.id);
  if (JSON.stringify(before) !== JSON.stringify(b)) throw new Error(`base event ${b.id} changed!`);
}
writeFileSync(FILE, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
writeFileSync(SCENARIOS, JSON.stringify(scenarios, null, 2) + '\n', 'utf-8');
const per = NEW_EVENTS.reduce((acc, e) => {
  acc[e.scenarioIds[0]] = (acc[e.scenarioIds[0]] ?? 0) + 1;
  return acc;
}, {});
console.log(`events.json written: ${merged.length} events (added ${NEW_EVENTS.length}, ids 300~334); scenario eventIds linked: ${Object.entries(per).map(([k, v]) => `S${k}×${v}`).join(' ')}`);
