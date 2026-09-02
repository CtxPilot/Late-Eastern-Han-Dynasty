// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 0-B 数据扩容 P0B-14：scenarios.json 2 → 9（首批 7 历史剧本，Session 429）。
 *
 * 新增 id 3~9：184 黄巾之乱 / 190 群雄讨董 / 194 群雄逐鹿 / 200 官渡对峙 /
 * 208 赤壁前夜 / 219 汉中与襄樊 / 234 五丈原对峙。
 *
 * 规则（docs/08 §九 为真源；docs/00 §九红线；切分口径见各 scopeNote）：
 * - 沿 0-A 关东义兵「技术切片」范式：紧凑势力集 + 显式据点城；未声明城 ruler=null（无主），
 *   未布点武将 FREE（在野）——state-pipeline 既定语义。
 * - eventIds=[]：叙事事件挂接留待 P0B-15（剧本白名单双向链接届时补）。
 * - availableOfficerIds = 布点武将（含在野位补入）；脚本硬断言每位登场者
 *   deathYear ≥ startYear 且 startYear - birthYear ≥ 14（时代存活与成年）。
 * - 女性/子女按时代核验；initialDiplomacy 显式覆盖全部 active 势力对（缺省 neutral 0）。
 * - 「约 30 势力 190 全量开局」仍属 0-B，与 P0B-06 officers 1000+ 协调后置（09 既定）。
 * - 剧本 1/2 逐字节保留（金样与既有验收锚点）。
 *
 * 运行：node scripts/gen-0b-scenarios.mjs（幂等：剥掉 id≥3 的生成段重排全表）。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'server', 'src', 'data', 'scenarios.json');
const OFFICERS = join(ROOT, 'server', 'src', 'data', 'officers.json');
const FEMALES = join(ROOT, 'server', 'src', 'data', 'females.json');
const CHILDREN = join(ROOT, 'server', 'src', 'data', 'children.json');

/** 官方 id → 武将（重名者取官方 0-A 原始条目；脚本按此表显式引用并断言存活） */
const O = {
  曹操: 1, 刘备: 2, 孙权: 3, 诸葛亮: 4, 吕布: 5, 关羽: 6, 张飞: 7, 荀彧: 8, 夏侯惇: 9, 赵云: 10,
  周瑜: 11, 司马懿: 12, 典韦: 13, 黄忠: 14, 陆逊: 15, 许褚: 100, 曹仁: 101, 李典: 102, 高顺: 104,
  孙策: 105, 公孙瓒: 106, 甘宁: 107, 徐盛: 108, 周泰: 109, 张嶷: 111, 董卓: 112, 袁绍: 113,
  孙坚: 114, 张辽: 115, 徐晃: 116, 张郃: 117, 于禁: 118, 乐进: 119, 夏侯渊: 120, 曹洪: 121,
  曹真: 122, 荀攸: 123, 贾诩: 124, 郭嘉: 125, 程昱: 126, 庞统: 127, 法正: 128, 姜维: 129,
  魏延: 130, 马超: 131, 王平: 133, 严颜: 135, 蒋琬: 138, 费祎: 139, 鲁肃: 141, 吕蒙: 142,
  程普: 143, 黄盖: 144, 韩当: 145, 太史慈: 146, 凌统: 147, 丁奉: 148, 张昭: 149, 诸葛瑾: 151,
  陆抗: 153, 田丰: 156, 沮授: 157, 颜良: 159, 文丑: 160, 陈宫: 165, 刘表: 167, 马腾: 173,
  韩遂: 174, 张鲁: 175, 李傕: 177, 郭汜: 178, 张济: 179, 樊稠: 180, 袁术: 181, 张角: 183,
  刘晔: 194, 庞德: 192, 朱然: 204, 诸葛恪: 205, 步骘: 206, 司马师: 207, 司马昭: 208, 邓艾: 209,
  钟会: 210, 曹休: 189, 夏侯尚: 190, 文聘: 191, 郝昭: 223, 郭淮: 224, 全琮: 244, 陶谦: 250,
  曹丕: 252, 曹叡: 253, 钟繇: 258, 华歆: 257, 陈群: 259, 刘禅: 262, 张绣: 278, 皇甫嵩: 280,
  卢植: 281, 王允: 282, 马岱: 238, 刘璋: 277, 公孙瓒: 106, 王平: 133, 吴懿: 200, 贺齐: 243,
};

const F = { 貂蝉: 202, 孙尚香: 203, 蔡琰: 204, 甄宓: 207, 步练师: 208, 王元姬: 221, 曹节: 217 };

const ALL_LAYERS = ['official_history', 'annotated_history', 'literature', 'legend', 'gameplay'];
const DEFAULT_LAYERS = ['official_history', 'annotated_history', 'literature', 'legend', 'gameplay'];

/** 7 个新历史剧本。officers 数组：[名, 城, 军职?, 忠诚?]；diplomacy：[A,B,relation,favor]。 */
const NEW_SCENARIOS = [
  {
    id: 3, name: '黄巾之乱（184·0-B 历史切片）', type: 'historical', noLifespan: false,
    startYear: 184, endYear: 186, recommendedFaction: 1,
    description: '中平元年二月，张角以「苍天已死，黄天当立」举事，八州并起。汉室以皇甫嵩、卢植、朱儁分路进讨，凉州边章、韩遂趁乱叛乱。玩家可平定黄巾，或以黄巾倾覆汉室。',
    scopeNote: '技术切片：仅汉军、黄巾、凉州叛军三个指挥集团；南阳黄巾（张曼成）与冀州诸部未单独建模，宛城仍归汉军；关中、中原大部以汉军据点抽象。事件挂接留待 P0B-15。',
    factions: [
      { name: '汉军', color: '#8a6d3b', ruler: '皇甫嵩', capital: 1, mode: 'territorial', hq: '洛阳行台', kingdom: '汉',
        note: '皇甫嵩持节节度诸军，卢植、董卓分路进讨。', cities: [1, 2, 3, 4, 7, 8, 31, 32, 33, 35, 36, 37, 38],
        officers: [['皇甫嵩', 1, 'grandGeneral', 100], ['卢植', 31, 'general'], ['董卓', 33, 'general'], ['曹操', 3, 'captain'], ['刘备', 26, 'captain'], ['关羽', 26, 'captain'], ['张飞', 26, 'captain'], ['孙坚', 13, 'captain']] },
      { name: '黄巾军', color: '#c9a227', ruler: '张角', capital: 40, mode: 'territorial', hq: '广宗大营', kingdom: '黄天',
        note: '张角称天公将军，冀州为腹心；张宝、张梁未单独建模。', cities: [40, 41, 44],
        officers: [['张角', 40, 'grandGeneral', 100]] },
      { name: '凉州叛军', color: '#7a5c9e', ruler: '韩遂', capital: 23, mode: 'territorial', hq: '金城叛军', kingdom: '凉',
        note: '北宫伯玉、边章叛乱，劫韩遂（韩约）主兵事。', cities: [23, 79],
        officers: [['韩遂', 23, 'grandGeneral', 100]] },
    ],
    diplomacy: [[1, 2, 'war', -70], [1, 3, 'war', -60], [2, 3, 'neutral', 0]],
    females: [], children: [],
  },
  {
    id: 4, name: '群雄讨董（190·0-B 历史切片）', type: 'historical', noLifespan: false,
    startYear: 190, endYear: 193, recommendedFaction: 2,
    description: '初平元年正月，关东州郡共推袁绍为盟主讨董卓，董卓挟天子迁都长安，焚烧洛阳。曹操追击荥阳败绩，孙坚自长沙北上，兵锋直指洛阳。',
    scopeNote: '技术切片：董卓、袁绍、曹操、孙坚、袁术、公孙瓒、陶谦、刘表八个指挥集团；河内、鲁阳仍以邻近节点作补给席位（沿关东义兵口径）；韩馥之冀州、孔伷之豫州未建模。与既有「关东义兵」切片并存，本剧本为多势力割据版。事件挂接留待 P0B-15。',
    factions: [
      { name: '董卓政权', color: '#5a5a6e', ruler: '董卓', capital: 1, mode: 'territorial', hq: '相府', kingdom: '凉',
        note: '废立天子，挟迁都之威；吕布、李傕、郭汜、张济、张辽在其麾下。', cities: [1, 2, 23, 33, 77, 79],
        officers: [['董卓', 1, 'grandGeneral', 100], ['吕布', 1, 'general'], ['李傕', 1, 'general'], ['郭汜', 1, 'general'], ['张济', 1, 'general'], ['张辽', 1, 'captain']] },
      { name: '勃海袁绍', color: '#496b88', ruler: '袁绍', capital: 46, mode: 'expeditionary', hq: '勃海起兵', kingdom: '冀',
        note: '关东盟主，车骑将军自领；冀州牧韩馥未建模，勃海为其起兵据点。', cities: [46],
        officers: [['袁绍', 46, 'grandGeneral', 100], ['颜良', 46, 'captain'], ['文丑', 46, 'captain'], ['田丰', 46], ['沮授', 46]] },
      { name: '陈留曹操', color: '#2e6e4e', ruler: '曹操', capital: 7, mode: 'expeditionary', hq: '陈留募兵处', kingdom: '魏',
        note: '散家财合义兵，孤军追董卓败于荥阳。', cities: [7],
        officers: [['曹操', 7, 'grandGeneral', 100], ['夏侯惇', 7, 'general'], ['夏侯渊', 7, 'general'], ['曹仁', 7, 'general'], ['曹洪', 7, 'captain']] },
      { name: '长沙孙坚', color: '#b0483c', ruler: '孙坚', capital: 64, mode: 'territorial', hq: '长沙郡署', kingdom: '吴',
        note: '长沙太守北上讨卓，先登入洛、得传国玺（演义）。', cities: [64],
        officers: [['孙坚', 64, 'grandGeneral', 100], ['程普', 64, 'general'], ['黄盖', 64, 'general'], ['韩当', 64, 'captain']] },
      { name: '南阳袁术', color: '#9e6b2f', ruler: '袁术', capital: 13, mode: 'territorial', hq: '南阳治所', kingdom: '成',
        note: '后将军据南阳，资粮给盟军而观望。', cities: [13],
        officers: [['袁术', 13, 'grandGeneral', 100]] },
      { name: '幽州公孙瓒', color: '#4e7a9e', ruler: '公孙瓒', capital: 27, mode: 'territorial', hq: '蓟城驻所', kingdom: '燕',
        note: '奋武将军镇幽州；赵云此时在常山郡未仕，以在野登场。', cities: [27],
        officers: [['公孙瓒', 27, 'grandGeneral', 100]] },
      { name: '徐州陶谦', color: '#6e8a3d', ruler: '陶谦', capital: 9, mode: 'territorial', hq: '下邳治所', kingdom: '徐',
        note: '徐州牧保境安民。', cities: [9, 53],
        officers: [['陶谦', 9, 'grandGeneral', 100]] },
      { name: '荆州刘表', color: '#8a3d6e', ruler: '刘表', capital: 15, mode: 'territorial', hq: '襄阳州治', kingdom: '楚',
        note: '初平元年单马入宜城，抚定荆州。', cities: [15],
        officers: [['刘表', 15, 'grandGeneral', 100]] },
    ],
    diplomacy: [[1, 2, 'war', -80], [1, 3, 'war', -80], [1, 4, 'war', -80], [1, 5, 'war', -70], [1, 6, 'war', -60], [1, 7, 'war', -60], [1, 8, 'war', -60], [2, 3, 'allied', 45], [2, 4, 'allied', 40], [2, 5, 'hostile', -30], [2, 6, 'neutral', 0], [2, 7, 'neutral', 0], [2, 8, 'neutral', 0], [3, 4, 'allied', 30], [3, 5, 'neutral', 0], [3, 6, 'neutral', 0], [3, 7, 'neutral', 0], [3, 8, 'neutral', 0], [4, 5, 'neutral', 0], [4, 6, 'neutral', 0], [4, 7, 'neutral', 0], [4, 8, 'neutral', 0], [5, 6, 'neutral', 0], [5, 7, 'neutral', 0], [5, 8, 'neutral', 0], [6, 7, 'neutral', 0], [6, 8, 'neutral', 0], [7, 8, 'neutral', 0]],
    females: [['貂蝉', 1, 'single']], children: [],
  },
  {
    id: 5, name: '群雄逐鹿（194·0-B 历史切片）', type: 'historical', noLifespan: false,
    startYear: 194, endYear: 197, recommendedFaction: 2,
    description: '兴平元年，曹操东征徐州为父报仇，陈宫、张邈迎吕布袭兖州，曹操仅余鄄城等数城。李傕、郭汜专权关中，袁绍定冀州，袁术据淮南，刘备援陶谦屯小沛。',
    scopeNote: '技术切片：吕布、曹操、李傕、袁绍、袁术、徐州陶谦、刘表七个指挥集团；曹操兖州据点以昌邑代理鄄城；公孙瓒、马腾等未建模。事件挂接留待 P0B-15。',
    factions: [
      { name: '兖州吕布', color: '#8a3d3d', ruler: '吕布', capital: 8, mode: 'territorial', hq: '濮阳大营', kingdom: '吕',
        note: '陈宫、张邈迎布袭兖州，与曹操相持百余日。', cities: [8, 52],
        officers: [['吕布', 8, 'grandGeneral', 100], ['高顺', 8, 'general'], ['张辽', 8, 'general'], ['陈宫', 8]] },
      { name: '兖州曹操', color: '#2e6e4e', ruler: '曹操', capital: 51, mode: 'territorial', hq: '昌邑行辕（鄄城代理）', kingdom: '魏',
        note: '鄄城不在节点，以山阳昌邑代理其兖州残存据点。', cities: [51],
        officers: [['曹操', 51, 'grandGeneral', 100], ['荀彧', 51], ['程昱', 51], ['夏侯惇', 51, 'general'], ['夏侯渊', 51, 'general'], ['于禁', 51, 'captain'], ['典韦', 51, 'captain'], ['许褚', 51, 'captain']] },
      { name: '关中李傕', color: '#6e5a3d', ruler: '李傕', capital: 2, mode: 'territorial', hq: '长安擅政', kingdom: '雍',
        note: '与郭汜共擅朝政，献帝在长安为质。', cities: [2, 33],
        officers: [['李傕', 2, 'grandGeneral', 100], ['郭汜', 2, 'general'], ['樊稠', 2, 'general'], ['张济', 2, 'general']] },
      { name: '冀州袁绍', color: '#496b88', ruler: '袁绍', capital: 5, mode: 'territorial', hq: '邺城幕府', kingdom: '冀',
        note: '界桥破公孙瓒，尽有冀州。', cities: [5, 40, 41, 42, 43, 44, 45, 46],
        officers: [['袁绍', 5, 'grandGeneral', 100], ['颜良', 5, 'general'], ['文丑', 5, 'general'], ['沮授', 5], ['田丰', 5], ['张郃', 5, 'captain']] },
      { name: '淮南袁术', color: '#9e6b2f', ruler: '袁术', capital: 18, mode: 'territorial', hq: '寿春宫署', kingdom: '成',
        note: '据淮南兼沛国，孙策在其麾下。', cities: [18, 37],
        officers: [['袁术', 18, 'grandGeneral', 100], ['孙策', 18, 'general']] },
      { name: '徐州陶谦', color: '#6e8a3d', ruler: '陶谦', capital: 9, mode: 'territorial', hq: '下邳州治', kingdom: '徐',
        note: '曹操以父仇再征徐州；刘备、关羽、张飞援之。', cities: [9, 10, 53],
        officers: [['陶谦', 9, 'grandGeneral', 100], ['刘备', 9, 'general'], ['关羽', 9, 'captain'], ['张飞', 9, 'captain']] },
      { name: '荆州刘表', color: '#8a3d6e', ruler: '刘表', capital: 15, mode: 'territorial', hq: '襄阳州治', kingdom: '楚',
        note: '跨蹈汉南，地方数千里带甲十余万。', cities: [15, 14],
        officers: [['刘表', 15, 'grandGeneral', 100]] },
    ],
    diplomacy: [[1, 2, 'war', -70], [1, 3, 'neutral', 0], [1, 4, 'neutral', 0], [1, 5, 'neutral', 0], [1, 6, 'friendly', 20], [1, 7, 'neutral', 0], [2, 3, 'hostile', -30], [2, 4, 'friendly', 20], [2, 5, 'neutral', 0], [2, 6, 'war', -70], [2, 7, 'neutral', 0], [3, 4, 'neutral', 0], [3, 5, 'neutral', 0], [3, 6, 'neutral', 0], [3, 7, 'neutral', 0], [4, 5, 'hostile', -40], [4, 6, 'neutral', 0], [4, 7, 'neutral', 0], [5, 6, 'neutral', 0], [5, 7, 'neutral', 0], [6, 7, 'neutral', 0]],
    females: [], children: [960],
  },
  {
    id: 6, name: '官渡对峙（200·0-B 历史切片）', type: 'historical', noLifespan: false,
    startYear: 200, endYear: 202, recommendedFaction: 2,
    description: '建安五年正月，衣带诏事发，曹操东击刘备；刘备北奔袁绍，关羽被擒在许。袁绍简精兵十万、骑万匹，欲南向以争天下。孙策江东新定，四月遇刺。',
    scopeNote: '技术切片：袁绍、曹操、孙策、刘表、刘璋、张鲁、马腾七个指挥集团；曹操治所以颍川阳翟代理许都（许县不在节点）；刘备以袁绍麾下登场（奔绍），关羽在曹操军中（历史实态）；公孙瓒已于建安四年败亡不建模。事件挂接留待 P0B-15。',
    factions: [
      { name: '冀州袁绍', color: '#496b88', ruler: '袁绍', capital: 5, mode: 'territorial', hq: '邺城幕府', kingdom: '冀',
        note: '幽并青冀四州在握，南许而北邺。', cities: [5, 12, 24, 26, 27, 40, 41, 42, 43, 44, 45, 46, 59],
        officers: [['袁绍', 5, 'grandGeneral', 100], ['颜良', 5, 'general'], ['文丑', 5, 'general'], ['沮授', 5], ['田丰', 5], ['张郃', 5, 'captain'], ['刘备', 5, 'general'], ['张飞', 5, 'captain']] },
      { name: '许都曹操', color: '#2e6e4e', ruler: '曹操', capital: 3, mode: 'territorial', hq: '许都司空府（颍川代理）', kingdom: '魏',
        note: '奉天子以令不臣；许县不在节点，以颍川郡治阳翟代理。', cities: [1, 3, 4, 7, 8, 36, 38, 51, 52],
        officers: [['曹操', 3, 'grandGeneral', 100], ['关羽', 3, 'general'], ['张辽', 3, 'general'], ['徐晃', 3, 'general'], ['于禁', 3, 'general'], ['乐进', 3, 'captain'], ['荀彧', 3], ['荀攸', 3], ['郭嘉', 3], ['程昱', 3], ['许褚', 3, 'captain']] },
      { name: '江东孙策', color: '#b0483c', ruler: '孙策', capital: 16, mode: 'territorial', hq: '吴郡将军府', kingdom: '吴',
        note: '小霸王新定江东；四月遇刺，孙权继业由引擎寿元机制自然呈现。', cities: [16, 17, 65, 66],
        officers: [['孙策', 16, 'grandGeneral', 100], ['周瑜', 16, 'general'], ['鲁肃', 16], ['吕蒙', 16, 'captain'], ['黄盖', 16, 'general'], ['韩当', 16, 'captain'], ['周泰', 16, 'captain']] },
      { name: '荆州刘表', color: '#8a3d6e', ruler: '刘表', capital: 15, mode: 'territorial', hq: '襄阳州治', kingdom: '楚',
        note: '持两端不助南北。', cities: [14, 15, 60, 61, 62, 63, 64],
        officers: [['刘表', 15, 'grandGeneral', 100]] },
      { name: '益州刘璋', color: '#3d6e8a', ruler: '刘璋', capital: 19, mode: 'territorial', hq: '成都州治', kingdom: '蜀',
        note: '暗弱守成，汉中已失于张鲁。', cities: [19, 21, 68, 69, 70, 71, 72, 73, 75, 76],
        officers: [['刘璋', 19, 'grandGeneral', 100]] },
      { name: '汉中张鲁', color: '#5a8a3d', ruler: '张鲁', capital: 20, mode: 'territorial', hq: '汉中师君府', kingdom: '汉',
        note: '五斗米道据汉中，以鬼道教民。', cities: [20, 74, 78],
        officers: [['张鲁', 20, 'grandGeneral', 100]] },
      { name: '凉州马腾', color: '#7a5c9e', ruler: '马腾', capital: 23, mode: 'territorial', hq: '凉州诸部', kingdom: '凉',
        note: '与韩遂结为异姓兄弟，共镇凉州。', cities: [23, 79, 80, 83],
        officers: [['马腾', 23, 'grandGeneral', 100], ['韩遂', 79, 'general']] },
    ],
    diplomacy: [[1, 2, 'war', -80], [1, 3, 'neutral', 0], [1, 4, 'neutral', 0], [1, 5, 'neutral', 0], [1, 6, 'neutral', 0], [1, 7, 'friendly', 10], [2, 3, 'neutral', 0], [2, 4, 'friendly', 10], [2, 5, 'neutral', 0], [2, 6, 'neutral', 0], [2, 7, 'neutral', 0], [3, 4, 'neutral', 0], [3, 5, 'neutral', 0], [3, 6, 'neutral', 0], [3, 7, 'neutral', 0], [4, 5, 'neutral', 0], [4, 6, 'neutral', 0], [4, 7, 'neutral', 0], [5, 6, 'hostile', -30], [5, 7, 'neutral', 0], [6, 7, 'neutral', 0]],
    females: [['甄宓', 5, 'single']], children: [960],
  },
  {
    id: 7, name: '赤壁前夜（208·0-B 历史切片）', type: 'historical', noLifespan: false,
    startYear: 208, endYear: 210, recommendedFaction: 3,
    description: '建安十三年正月，孙权破黄祖于江夏，刘备屯樊口一线；曹操定河北、开玄武池练水军，南取荆襄之势已成。大江之上，一场决定三分的会战正在酝酿。',
    scopeNote: '技术切片：曹操、刘备、孙权、刘表、刘璋、马超六个指挥集团；刘备以江夏郡治西陵代理夏口屯驻点（孙权新破黄祖后态势）；刘表八月病亡、荆州降曹由引擎寿元与玩法自然呈现；孙策已亡故。事件挂接留待 P0B-15。',
    factions: [
      { name: '邺都曹操', color: '#2e6e4e', ruler: '曹操', capital: 5, mode: 'territorial', hq: '邺城丞相府', kingdom: '魏',
        note: '罢三公自为丞相，挟北方新定之势南下。', cities: [1, 2, 3, 4, 5, 7, 8, 11, 12, 13, 24, 26, 27, 31, 32, 33, 34, 36, 37, 38, 40, 41, 42, 43, 44, 45, 46, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59],
        officers: [['曹操', 5, 'grandGeneral', 100], ['曹丕', 5], ['司马懿', 5], ['贾诩', 5], ['荀彧', 5], ['荀攸', 5], ['程昱', 5], ['许褚', 5, 'captain'], ['夏侯惇', 5, 'general'], ['夏侯渊', 5, 'general'], ['徐晃', 5, 'general'], ['张郃', 5, 'general'], ['于禁', 5, 'general'], ['曹仁', 33, 'general'], ['张辽', 18, 'general'], ['李典', 18, 'captain']] },
      { name: '屯夏口刘备', color: '#3d6e8a', ruler: '刘备', capital: 60, mode: 'hosted', hq: '夏口屯所（江夏代理）', kingdom: '汉',
        note: '依附刘表屯新野，兵败当阳后进屯夏口一线；以江夏郡治西陵代理。', cities: [60],
        officers: [['刘备', 60, 'grandGeneral', 100], ['诸葛亮', 60], ['关羽', 60, 'general'], ['张飞', 60, 'general'], ['赵云', 60, 'captain']] },
      { name: '江东孙权', color: '#b0483c', ruler: '孙权', capital: 17, mode: 'territorial', hq: '建业将军府', kingdom: '吴',
        note: '新破黄祖，内议战和；周瑜、鲁肃主战。', cities: [16, 17, 65, 66, 67],
        officers: [['孙权', 17, 'grandGeneral', 100], ['周瑜', 17, 'general'], ['鲁肃', 17], ['吕蒙', 17, 'general'], ['甘宁', 17, 'captain'], ['黄盖', 17, 'general'], ['韩当', 17, 'captain'], ['周泰', 17, 'captain'], ['凌统', 17, 'captain'], ['张昭', 17], ['诸葛瑾', 17]] },
      { name: '荆州刘表', color: '#8a3d6e', ruler: '刘表', capital: 15, mode: 'territorial', hq: '襄阳州治', kingdom: '楚',
        note: '病笃之际，二子争立，州事决于蔡氏。', cities: [14, 15, 61, 62, 63, 64],
        officers: [['刘表', 15, 'grandGeneral', 100]] },
      { name: '益州刘璋', color: '#3d6e8a', ruler: '刘璋', capital: 19, mode: 'territorial', hq: '成都州治', kingdom: '蜀',
        note: '遣使通曹操，守益州观望。', cities: [19, 21, 68, 69, 70, 71, 72, 73, 75, 76],
        officers: [['刘璋', 19, 'grandGeneral', 100]] },
      { name: '关西马超', color: '#7a5c9e', ruler: '马超', capital: 23, mode: 'territorial', hq: '凉州部曲', kingdom: '凉',
        note: '马腾入朝后超统其众（本剧本以凉州诸部抽象，关中态势未细分）。', cities: [22, 23, 77, 79, 80, 83],
        officers: [['马超', 23, 'grandGeneral', 100], ['马岱', 23, 'captain'], ['庞德', 23, 'general']] },
    ],
    diplomacy: [[1, 2, 'war', -70], [1, 3, 'war', -70], [1, 4, 'neutral', 0], [1, 5, 'neutral', 0], [1, 6, 'hostile', -30], [2, 3, 'allied', 40], [2, 4, 'friendly', 15], [2, 5, 'neutral', 0], [2, 6, 'neutral', 0], [3, 4, 'hostile', -20], [3, 5, 'neutral', 0], [3, 6, 'neutral', 0], [4, 5, 'neutral', 0], [4, 6, 'neutral', 0], [5, 6, 'neutral', 0]],
    females: [['孙尚香', 17, 'single'], ['甄宓', 5, 'single']],
    children: [958, 961, 962, 963],
  },
  {
    id: 8, name: '汉中与襄樊（219·0-B 历史切片）', type: 'historical', noLifespan: false,
    startYear: 219, endYear: 221, recommendedFaction: 2, month: 9,
    description: '建安二十四年，刘备定汉中、进位汉中王，魏延镇汉中；关羽北围樊城、水淹七军，威震华夏，曹操议徙都以避其锐。而江东吕蒙称病还建业，白衣渡江之谋已动。',
    scopeNote: '技术切片：曹魏、蜀汉、孙吴三个指挥集团；开局取建安二十四年九月态势（汉中已易主、进位已成，关羽犹围樊城）；樊城以宛代理、居巢以寿春代理；夏侯渊正月殁于定军山，不在登场之列；辽东公孙氏、上庸申氏未建模。事件挂接留待 P0B-15。',
    factions: [
      { name: '曹魏', color: '#2e6e4e', ruler: '曹操', capital: 1, mode: 'territorial', hq: '洛阳魏王行台', kingdom: '魏',
        note: '汉中新失，关羽骤起，内忧外患交集。', cities: [1, 2, 3, 4, 5, 7, 8, 11, 12, 13, 15, 18, 22, 23, 24, 26, 27, 31, 32, 33, 34, 35, 36, 37, 38, 40, 41, 42, 43, 44, 45, 46, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 77, 79, 80, 83],
        officers: [['曹操', 1, 'grandGeneral', 100], ['曹丕', 1], ['司马懿', 1], ['贾诩', 1], ['刘晔', 1], ['钟繇', 1], ['曹真', 2, 'general'], ['张郃', 2, 'general'], ['郝昭', 33, 'captain'], ['曹仁', 13, 'general'], ['徐晃', 13, 'general'], ['于禁', 13, 'general'], ['张辽', 18, 'general'], ['夏侯惇', 18, 'general']] },
      { name: '蜀汉', color: '#3d6e8a', ruler: '刘备', capital: 19, mode: 'territorial', hq: '成都汉中王行辕', kingdom: '汉',
        note: '进位汉中王，关羽董督荆州北伐襄樊。', cities: [14, 19, 20, 21, 61, 63, 68, 69, 70, 71, 72, 73, 75, 76],
        officers: [['刘备', 19, 'grandGeneral', 100], ['诸葛亮', 19], ['关羽', 14, 'general'], ['张飞', 21, 'general'], ['赵云', 19, 'general'], ['马超', 19, 'general'], ['黄忠', 19, 'general'], ['魏延', 20, 'general'], ['吴懿', 19, 'captain']] },
      { name: '孙吴', color: '#b0483c', ruler: '孙权', capital: 17, mode: 'territorial', hq: '建业将军府', kingdom: '吴',
        note: '吕蒙称病还建业，陆逊代屯陆口，外交阴结曹操。', cities: [16, 17, 29, 30, 60, 62, 64, 65, 66, 67, 102, 103, 104, 105, 106],
        officers: [['孙权', 17, 'grandGeneral', 100], ['吕蒙', 17, 'general'], ['陆逊', 17], ['韩当', 17, 'general'], ['周泰', 17, 'general'], ['徐盛', 17, 'captain'], ['丁奉', 17, 'captain'], ['诸葛瑾', 17]] },
    ],
    diplomacy: [[1, 2, 'war', -80], [1, 3, 'neutral', 0], [2, 3, 'hostile', -30]],
    females: [['甄宓', 5, 'single'], ['孙尚香', 17, 'single']],
    children: [961, 977],
  },
  {
    id: 9, name: '五丈原对峙（234·0-B 历史切片）', type: 'historical', noLifespan: false,
    startYear: 234, endYear: 240, recommendedFaction: 2,
    description: '建兴十二年春，诸葛亮出斜谷，屯五丈原与司马懿对峙渭南，分兵屯田为久驻之基；孙权应约北上合肥新城，三路并举。天下三分之局，将在此数年间见分晓。',
    scopeNote: '技术切片：曹魏、蜀汉、孙吴三个指挥集团；五丈原渭南对峙以槐里代理魏军前线、诸葛亮自汉中出兵；张郃（231）、曹真（231）已殁不在登场之列；辽东公孙氏未建模。事件挂接留待 P0B-15。',
    factions: [
      { name: '曹魏', color: '#2e6e4e', ruler: '曹叡', capital: 1, mode: 'territorial', hq: '洛阳宫省', kingdom: '魏',
        note: '明帝临朝，东西两线拒诸葛、孙权。', cities: [1, 2, 3, 4, 5, 7, 8, 11, 12, 13, 15, 18, 22, 23, 24, 26, 27, 31, 32, 33, 34, 35, 36, 37, 38, 40, 41, 42, 43, 44, 45, 46, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 77, 79, 80, 81, 82, 83, 84, 85, 86],
        officers: [['曹叡', 1, 'grandGeneral', 100], ['司马懿', 35, 'grandGeneral'], ['司马师', 1, 'general'], ['司马昭', 1, 'general'], ['郭淮', 35, 'general'], ['邓艾', 35, 'captain']] },
      { name: '蜀汉', color: '#3d6e8a', ruler: '刘禅', capital: 19, mode: 'territorial', hq: '成都宫省', kingdom: '汉',
        note: '相父诸葛亮总理军政，北伐以图中原。', cities: [19, 20, 21, 68, 69, 70, 71, 72, 73, 74, 75, 76, 78],
        officers: [['刘禅', 19, 'grandGeneral', 100], ['诸葛亮', 20, 'grandGeneral'], ['魏延', 20, 'general'], ['姜维', 20, 'general'], ['王平', 20, 'general'], ['吴懿', 20, 'general'], ['蒋琬', 19], ['费祎', 19]] },
      { name: '孙吴', color: '#b0483c', ruler: '孙权', capital: 17, mode: 'territorial', hq: '建业宫省', kingdom: '吴',
        note: '应蜀约共举，亲攻合肥新城；荆扬与交州连成一片。', cities: [16, 17, 29, 30, 60, 62, 63, 64, 65, 66, 67, 102, 103, 104, 105, 106],
        officers: [['孙权', 17, 'grandGeneral', 100], ['诸葛恪', 17, 'general'], ['步骘', 17, 'general'], ['朱然', 17, 'general'], ['全琮', 17, 'general']] },
    ],
    diplomacy: [[1, 2, 'war', -80], [1, 3, 'war', -60], [2, 3, 'allied', 30]],
    females: [['王元姬', 5, 'married']],
    children: [975, 977],
  },
];

// ── 展开与校验 ─────────────────────────────────────────────────
const officers = JSON.parse(readFileSync(OFFICERS, 'utf-8'));
const females = JSON.parse(readFileSync(FEMALES, 'utf-8'));
const children = JSON.parse(readFileSync(CHILDREN, 'utf-8'));
const officerById = new Map(officers.map((o) => [o.id, o]));
const femaleById = new Map(females.map((f) => [f.id, f]));
const childIds = new Set(children.map((c) => c.childId));

const raw = JSON.parse(readFileSync(FILE, 'utf-8'));
if (raw.length !== 2 && raw.length !== 9) throw new Error(`unexpected input: ${raw.length} scenarios`);
const base = raw.filter((s) => s.id <= 2);
if (base.length !== 2) throw new Error(`base scenarios found ${base.length}, expect 2`);

const out = [];

for (const sc of NEW_SCENARIOS) {
  const used = new Set();
  const positions = [];
  const availableOfficerIds = [];
  const cityOwnership = {};
  for (const [fi, f] of sc.factions.entries()) {
    const rulerId = O[f.ruler];
    const ruler = officerById.get(rulerId);
    if (!ruler) throw new Error(`S${sc.id} ruler ${f.ruler} missing`);
    if (ruler.deathYear < sc.startYear) throw new Error(`S${sc.id} ruler ${f.ruler} died ${ruler.deathYear}`);
    if (sc.startYear - ruler.birthYear < 14) throw new Error(`S${sc.id} ruler ${f.ruler} underage`);
    if (!f.cities.includes(f.capital)) throw new Error(`S${sc.id} faction ${fi + 1} capital not in cities`);
    for (const c of f.cities) {
      if (cityOwnership[String(c)] != null) throw new Error(`S${sc.id} city ${c} claimed twice`);
      cityOwnership[String(c)] = fi + 1;
    }
    for (const [name, city, mp, loyalty] of f.officers) {
      const oid = O[name];
      if (!oid) throw new Error(`S${sc.id} unknown officer ${name}`);
      if (used.has(oid)) throw new Error(`S${sc.id} officer ${name}(${oid}) already positioned in another scenario`);
      used.add(oid);
      const o = officerById.get(oid);
      if (!o) throw new Error(`S${sc.id} officer id ${oid} missing`);
      if (o.deathYear < sc.startYear) throw new Error(`S${sc.id} ${name} died ${o.deathYear} < ${sc.startYear}`);
      if (sc.startYear - o.birthYear < 14) throw new Error(`S${sc.id} ${name} underage (born ${o.birthYear})`);
      positions.push({
        officerId: oid,
        cityId: city,
        factionId: fi + 1,
        ...(mp ? { militaryPosition: mp } : {}),
        loyalty: loyalty ?? 85,
      });
      availableOfficerIds.push(oid);
    }
    const fCityIds = f.cities;
    if (fCityIds.length !== new Set(fCityIds).size) throw new Error(`S${sc.id} faction ${fi + 1} duplicate cities`);
  }
  const femalePositions = [];
  const availableFemaleIds = [];
  for (const [name, city, status] of sc.females) {
    const fid = F[name];
    const f = femaleById.get(fid);
    if (!f) throw new Error(`S${sc.id} female ${name} missing`);
    if (f.deathYear < sc.startYear) throw new Error(`S${sc.id} female ${name} died ${f.deathYear}`);
    if (sc.startYear - f.birthYear < 14) throw new Error(`S${sc.id} female ${name} underage`);
    if (!status) throw new Error(`S${sc.id} female ${name} needs status`);
    femalePositions.push({ femaleId: fid, cityId: city, status });
    availableFemaleIds.push(fid);
  }
  for (const cid of sc.children) {
    if (!childIds.has(cid)) throw new Error(`S${sc.id} child ${cid} missing`);
  }
  // diplomacy：显式对 → 补齐 neutral 全对
  const active = sc.factions.map((_, i) => i + 1);
  const rel = new Map();
  for (const [a, b, r, v] of sc.diplomacy) {
    rel.set(`${Math.min(a, b)}-${Math.max(a, b)}`, { factionA: Math.min(a, b), factionB: Math.max(a, b), relation: r, favorability: v });
  }
  const initialDiplomacy = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const key = `${active[i]}-${active[j]}`;
      initialDiplomacy.push(rel.get(key) ?? { factionA: active[i], factionB: active[j], relation: 'neutral', favorability: 0 });
      rel.delete(key);
    }
  }
  if (rel.size > 0) throw new Error(`S${sc.id} diplomacy pair outside active set: ${[...rel.keys()].join(',')}`);

  out.push({
    id: sc.id,
    name: sc.name,
    type: sc.type,
    noLifespan: sc.noLifespan,
    description: sc.description,
    scopeNote: sc.scopeNote,
    startYear: sc.startYear,
    endYear: sc.endYear,
    factionSetups: sc.factions.map((f, i) => ({
      id: i + 1,
      name: f.name,
      color: f.color,
      rulerId: O[f.ruler],
      capitalCityId: f.capital,
      mode: f.mode,
      headquartersLabel: f.hq,
      historicalNote: f.note,
      ...(f.kingdom ? { preferredKingdomName: f.kingdom } : {}),
    })),
    eventIds: [],
    availableOfficerIds,
    availableFemaleIds,
    childEventIds: sc.children,
    availableEventLayers: ALL_LAYERS,
    defaultEventLayers: DEFAULT_LAYERS,
    playableFactions: sc.factions.map((_, i) => i + 1),
    recommendedFaction: sc.recommendedFaction,
    startState: {
      year: sc.startYear,
      month: sc.month ?? 1,
      factions: active,
      activeFactionIds: active,
      cityOwnership,
      officerPositions: positions,
      femalePositions,
      initialDiplomacy,
      completedEvents: [],
    },
  });
}

const merged = [...base, ...out].sort((a, b) => a.id - b.id);
if (merged.length !== 9) throw new Error(`expect 9 scenarios (2 base + 7 new), got ${merged.length}`);
// 基线逐字节保留断言
for (const b of base) {
  const before = raw.find((r) => r.id === b.id);
  if (JSON.stringify(before) !== JSON.stringify(b)) throw new Error(`base scenario ${b.id} changed!`);
}
writeFileSync(FILE, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
const counts = merged.map((s) => `#${s.id} ${s.name} (${s.availableOfficerIds.length}将/${Object.keys(s.startState.cityOwnership).length}城/${s.factionSetups.length}势力)`);
console.log(`scenarios.json written: ${merged.length} scenarios\n  ${counts.join('\n  ')}`);
