// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 0-B 剧本 4 深度化扩容：190 年群雄全势力（三十诸侯全割据）生成脚本
 *
 * 遵循 docs/53-scenario-190-warlords-expansion-proposal.md 与 docs/08-data-dictionary.md §九。
 * 1. 扩容剧本 4（群雄讨董）为 30 大历史割据势力；
 * 2. 领地 100% 覆盖东汉十三州 106 郡国全量城池；
 * 3. 部署 136 名历史名将与文臣，严格校验时代成年与存活；
 * 4. 435 对完整外交矩阵全覆盖（关东联军互盟且对董卓全战）；
 * 5. 严格保持既有 5 大历史事件白名单（305~309）与前 8 势力 ID 不变；
 * 6. 剧本 1、2 及其他剧本逐字节保持基线不变。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCENARIOS_FILE = join(ROOT, 'server', 'src', 'data', 'scenarios.json');
const OFFICERS_FILE = join(ROOT, 'server', 'src', 'data', 'officers.json');
const CITIES_FILE = join(ROOT, 'server', 'src', 'data', 'cities.json');

const rawScenarios = JSON.parse(readFileSync(SCENARIOS_FILE, 'utf-8'));
const officers = JSON.parse(readFileSync(OFFICERS_FILE, 'utf-8'));
const cities = JSON.parse(readFileSync(CITIES_FILE, 'utf-8'));

const officerById = new Map(officers.map(o => [o.id, o]));
const cityById = new Map(cities.map(c => [c.id, c]));

// 30 大势力定义
const FACTION_DEFINITIONS = [
  {
    id: 1, name: '董卓政权', color: '#5a5a6e', rulerId: 112, capitalCityId: 1,
    mode: 'territorial', headquartersLabel: '相府', preferredKingdomName: '凉',
    historicalNote: '废立天子，挟迁都之威；吕布、李傕、郭汜、张济、张辽在其麾下。',
    cities: [1, 2, 32, 33, 34, 35],
    officers: [
      { id: 112, cityId: 1, mp: 'grandGeneral', loyalty: 100 },
      { id: 5, cityId: 1, mp: 'general', loyalty: 85 },
      { id: 1049, cityId: 1, loyalty: 100 },
      { id: 463, cityId: 2, mp: 'general', loyalty: 90 },
      { id: 467, cityId: 33, mp: 'general', loyalty: 80 },
      { id: 466, cityId: 1, mp: 'general', loyalty: 75 },
      { id: 933, cityId: 33, mp: 'general', loyalty: 85 },
      { id: 177, cityId: 34, mp: 'general', loyalty: 85 },
      { id: 178, cityId: 35, mp: 'general', loyalty: 85 },
      { id: 179, cityId: 32, mp: 'captain', loyalty: 80 },
      { id: 180, cityId: 2, mp: 'captain', loyalty: 80 },
      { id: 115, cityId: 1, mp: 'captain', loyalty: 80 },
      { id: 465, cityId: 33, mp: 'captain', loyalty: 85 },
      { id: 472, cityId: 1, loyalty: 95 }
    ]
  },
  {
    id: 2, name: '勃海袁绍', color: '#496b88', rulerId: 113, capitalCityId: 46,
    mode: 'territorial', headquartersLabel: '勃海大营', preferredKingdomName: '冀',
    historicalNote: '关东盟主，车骑将军自领，统摄河北群英。',
    cities: [46, 43, 44],
    officers: [
      { id: 113, cityId: 46, mp: 'grandGeneral', loyalty: 100 },
      { id: 159, cityId: 46, mp: 'general', loyalty: 95 },
      { id: 160, cityId: 46, mp: 'general', loyalty: 95 },
      { id: 157, cityId: 46, loyalty: 90 },
      { id: 156, cityId: 46, loyalty: 88 },
      { id: 158, cityId: 43, loyalty: 85 },
      { id: 163, cityId: 46, loyalty: 85 },
      { id: 162, cityId: 44, loyalty: 80 }
    ]
  },
  {
    id: 3, name: '陈留曹操', color: '#2e6e4e', rulerId: 1, capitalCityId: 7,
    mode: 'territorial', headquartersLabel: '陈留募兵处', preferredKingdomName: '魏',
    historicalNote: '散家财合义兵，倡义讨董，孤军西向。',
    cities: [7],
    officers: [
      { id: 1, cityId: 7, mp: 'grandGeneral', loyalty: 100 },
      { id: 9, cityId: 7, mp: 'general', loyalty: 98 },
      { id: 120, cityId: 7, mp: 'general', loyalty: 95 },
      { id: 101, cityId: 7, mp: 'general', loyalty: 95 },
      { id: 121, cityId: 7, mp: 'captain', loyalty: 95 },
      { id: 102, cityId: 7, mp: 'captain', loyalty: 85 },
      { id: 119, cityId: 7, mp: 'captain', loyalty: 85 }
    ]
  },
  {
    id: 4, name: '长沙孙坚', color: '#b0483c', rulerId: 114, capitalCityId: 64,
    mode: 'territorial', headquartersLabel: '长沙郡署', preferredKingdomName: '吴',
    historicalNote: '长沙太守北上讨卓，勇冠诸军，前锋直逼洛阳。',
    cities: [64, 61, 62, 63],
    officers: [
      { id: 114, cityId: 64, mp: 'grandGeneral', loyalty: 100 },
      { id: 143, cityId: 64, mp: 'general', loyalty: 95 },
      { id: 144, cityId: 64, mp: 'general', loyalty: 95 },
      { id: 145, cityId: 64, mp: 'captain', loyalty: 90 },
      { id: 613, cityId: 64, loyalty: 90 }
    ]
  },
  {
    id: 5, name: '南阳袁术', color: '#9e6b2f', rulerId: 181, capitalCityId: 13,
    mode: 'territorial', headquartersLabel: '后将军府', preferredKingdomName: '成',
    historicalNote: '后将军据南阳大郡兼跨豫州腹地，粮赋充足。',
    cities: [13, 4, 36, 37, 38],
    officers: [
      { id: 181, cityId: 13, mp: 'grandGeneral', loyalty: 100 },
      { id: 182, cityId: 13, mp: 'general', loyalty: 90 },
      { id: 318, cityId: 13, mp: 'general', loyalty: 85 },
      { id: 319, cityId: 4, mp: 'captain', loyalty: 80 },
      { id: 518, cityId: 36, mp: 'general', loyalty: 80 },
      { id: 522, cityId: 37, loyalty: 75 },
      { id: 519, cityId: 38, mp: 'captain', loyalty: 75 }
    ]
  },
  {
    id: 6, name: '幽州公孙瓒', color: '#4e7a9e', rulerId: 106, capitalCityId: 97,
    mode: 'territorial', headquartersLabel: '右北平幕府', preferredKingdomName: '燕',
    historicalNote: '降虏校尉白马义从，威震北方胡狄。',
    cities: [97, 26, 98],
    officers: [
      { id: 106, cityId: 97, mp: 'grandGeneral', loyalty: 100 },
      { id: 383, cityId: 97, loyalty: 90 },
      { id: 384, cityId: 26, mp: 'captain', loyalty: 85 },
      { id: 385, cityId: 98, mp: 'captain', loyalty: 85 },
      { id: 660, cityId: 97, loyalty: 80 }
    ]
  },
  {
    id: 7, name: '徐州陶谦', color: '#6e8a3d', rulerId: 250, capitalCityId: 9,
    mode: 'territorial', headquartersLabel: '下邳治所', preferredKingdomName: '徐',
    historicalNote: '徐州刺史，招抚流民，保境安民，有丹阳精兵。',
    cities: [9, 53, 54, 55],
    officers: [
      { id: 250, cityId: 9, mp: 'grandGeneral', loyalty: 100 },
      { id: 1084, cityId: 9, mp: 'general', loyalty: 85 },
      { id: 110, cityId: 54, mp: 'general', loyalty: 80 },
      { id: 217, cityId: 9, loyalty: 85 },
      { id: 1065, cityId: 53, loyalty: 85 },
      { id: 283, cityId: 53, loyalty: 85 },
      { id: 1086, cityId: 55, mp: 'captain', loyalty: 75 },
      { id: 460, cityId: 54, mp: 'captain', loyalty: 75 }
    ]
  },
  {
    id: 8, name: '荆州刘表', color: '#8a3d6e', rulerId: 167, capitalCityId: 15,
    mode: 'territorial', headquartersLabel: '襄阳州治', preferredKingdomName: '楚',
    historicalNote: '单马入宜城，抚定荆州，跨蹈汉南地方数千里。',
    cities: [15, 14, 60],
    officers: [
      { id: 167, cityId: 15, mp: 'grandGeneral', loyalty: 100 },
      { id: 601, cityId: 15, loyalty: 95 },
      { id: 169, cityId: 15, loyalty: 95 },
      { id: 168, cityId: 14, mp: 'general', loyalty: 85 },
      { id: 170, cityId: 60, mp: 'general', loyalty: 85 }
    ]
  },
  {
    id: 9, name: '幽州牧刘虞', color: '#887050', rulerId: 359, capitalCityId: 27,
    mode: 'territorial', headquartersLabel: '蓟城幕府', preferredKingdomName: '燕',
    historicalNote: '汉室宗亲，大司马幽州牧，爱民抚胡，德被北方。',
    cities: [27, 94, 95, 96],
    officers: [
      { id: 359, cityId: 27, mp: 'grandGeneral', loyalty: 100 },
      { id: 820, cityId: 27, mp: 'general', loyalty: 90 },
      { id: 822, cityId: 96, mp: 'general', loyalty: 90 },
      { id: 386, cityId: 27, loyalty: 95 }
    ]
  },
  {
    id: 10, name: '辽东公孙度', color: '#556677', rulerId: 251, capitalCityId: 28,
    mode: 'territorial', headquartersLabel: '襄平府署', preferredKingdomName: '燕',
    historicalNote: '辽东太守，裂土自分，威服东夷高句丽诸国。',
    cities: [28, 99, 100, 101],
    officers: [
      { id: 251, cityId: 28, mp: 'grandGeneral', loyalty: 100 },
      { id: 755, cityId: 28, mp: 'general', loyalty: 90 },
      { id: 756, cityId: 28, mp: 'general', loyalty: 90 }
    ]
  },
  {
    id: 11, name: '冀州牧韩馥', color: '#778899', rulerId: 375, capitalCityId: 5,
    mode: 'territorial', headquartersLabel: '邺城幕府', preferredKingdomName: '冀',
    historicalNote: '冀州牧，统冀州诸府大郡，带甲十万，谷支十年。',
    cities: [5, 40, 41, 42, 45],
    officers: [
      { id: 375, cityId: 5, mp: 'grandGeneral', loyalty: 100 },
      { id: 381, cityId: 5, loyalty: 90 },
      { id: 382, cityId: 5, loyalty: 90 },
      { id: 117, cityId: 5, mp: 'general', loyalty: 80 },
      { id: 161, cityId: 45, mp: 'general', loyalty: 80 },
      { id: 496, cityId: 5, mp: 'general', loyalty: 75 },
      { id: 947, cityId: 42, loyalty: 80 },
      { id: 946, cityId: 5, loyalty: 80 }
    ]
  },
  {
    id: 12, name: '兖州刺史刘岱', color: '#8b4513', rulerId: 361, capitalCityId: 51,
    mode: 'territorial', headquartersLabel: '昌邑治所', preferredKingdomName: '齐',
    historicalNote: '汉室宗亲，兖州刺史，受诏领诸郡共讨董卓。',
    cities: [51, 52],
    officers: [
      { id: 361, cityId: 51, mp: 'grandGeneral', loyalty: 100 }
    ]
  },
  {
    id: 13, name: '东郡桥瑁', color: '#6b8e23', rulerId: 371, capitalCityId: 8,
    mode: 'territorial', headquartersLabel: '濮阳郡署', preferredKingdomName: '卫',
    historicalNote: '东郡太守，桥玄族子，移檄诸州郡号召讨董。',
    cities: [8],
    officers: [
      { id: 371, cityId: 8, mp: 'grandGeneral', loyalty: 100 }
    ]
  },
  {
    id: 14, name: '济北相鲍信', color: '#4682b4', rulerId: 373, capitalCityId: 50,
    mode: 'territorial', headquartersLabel: '卢县国相署', preferredKingdomName: '鲁',
    historicalNote: '济北相，泰山名门，深通兵略，与曹操莫逆相交。',
    cities: [50, 48, 49],
    officers: [
      { id: 373, cityId: 50, mp: 'grandGeneral', loyalty: 100 },
      { id: 118, cityId: 50, mp: 'general', loyalty: 85 }
    ]
  },
  {
    id: 15, name: '陈留太守张邈', color: '#9370db', rulerId: 369, capitalCityId: 47,
    mode: 'territorial', headquartersLabel: '东平驻节所', preferredKingdomName: '兖',
    historicalNote: '八厨之一，广施财物，八方名士竞相归赴。',
    cities: [47],
    officers: [
      { id: 369, cityId: 47, mp: 'grandGeneral', loyalty: 100 },
      { id: 165, cityId: 47, loyalty: 90 }
    ]
  },
  {
    id: 16, name: '广陵太守张超', color: '#ba55d3', rulerId: 370, capitalCityId: 10,
    mode: 'territorial', headquartersLabel: '广陵郡署', preferredKingdomName: '吴',
    historicalNote: '张邈之弟，广陵太守，共举义兵支援前线盟军。',
    cities: [10],
    officers: [
      { id: 370, cityId: 10, mp: 'grandGeneral', loyalty: 100 }
    ]
  },
  {
    id: 17, name: '豫州刺史孔伷', color: '#3cb371', rulerId: 367, capitalCityId: 3,
    mode: 'territorial', headquartersLabel: '阳翟州治', preferredKingdomName: '豫',
    historicalNote: '豫州刺史，清谈高雅，能坐谈使枯木生花。',
    cities: [3, 39],
    officers: [
      { id: 367, cityId: 3, mp: 'grandGeneral', loyalty: 100 }
    ]
  },
  {
    id: 18, name: '北海相孔融', color: '#48d1cc', rulerId: 249, capitalCityId: 12,
    mode: 'territorial', headquartersLabel: '剧县国相署', preferredKingdomName: '鲁',
    historicalNote: '孔子二十世孙，建安七子，好客纳贤，抗御黄巾。',
    cities: [12, 58],
    officers: [
      { id: 249, cityId: 12, mp: 'grandGeneral', loyalty: 100 },
      { id: 978, cityId: 12, mp: 'general', loyalty: 85 },
      { id: 146, cityId: 58, mp: 'general', loyalty: 80 },
      { id: 417, cityId: 12, loyalty: 88 },
      { id: 419, cityId: 12, loyalty: 85 }
    ]
  },
  {
    id: 19, name: '青州刺史焦和', color: '#87ceeb', rulerId: 374, capitalCityId: 59,
    mode: 'territorial', headquartersLabel: '临淄州治', preferredKingdomName: '齐',
    historicalNote: '青州刺史，虽坐拥临淄雄镇而军政尚虚谈。',
    cities: [59, 57],
    officers: [
      { id: 374, cityId: 59, mp: 'grandGeneral', loyalty: 100 }
    ]
  },
  {
    id: 20, name: '平原刘备', color: '#d4af37', rulerId: 2, capitalCityId: 11,
    mode: 'territorial', headquartersLabel: '平原县衙', preferredKingdomName: '蜀',
    historicalNote: '汉室苗裔，与关张领平原义军，仁德显著四海。',
    cities: [11, 56],
    officers: [
      { id: 2, cityId: 11, mp: 'grandGeneral', loyalty: 100 },
      { id: 6, cityId: 11, mp: 'general', loyalty: 100 },
      { id: 7, cityId: 11, mp: 'general', loyalty: 100 },
      { id: 216, cityId: 11, loyalty: 90 }
    ]
  },
  {
    id: 21, name: '河内张杨', color: '#708090', rulerId: 279, capitalCityId: 31,
    mode: 'territorial', headquartersLabel: '怀县郡署', preferredKingdomName: '赵',
    historicalNote: '河内太守，武勇过人，控扼并州与司隶要道。',
    cities: [31, 25],
    officers: [
      { id: 279, cityId: 31, mp: 'grandGeneral', loyalty: 100 },
      { id: 455, cityId: 25, mp: 'general', loyalty: 80 }
    ]
  },
  {
    id: 22, name: '西凉马腾', color: '#a0522d', rulerId: 173, capitalCityId: 23,
    mode: 'territorial', headquartersLabel: '姑臧将军府', preferredKingdomName: '凉',
    historicalNote: '伏波将军马援之后，雄霸西凉，部众骁勇善战。',
    cities: [23, 22, 77, 78, 80, 81],
    officers: [
      { id: 173, cityId: 23, mp: 'grandGeneral', loyalty: 100 },
      { id: 192, cityId: 23, mp: 'general', loyalty: 90 }
    ]
  },
  {
    id: 23, name: '金城韩遂', color: '#b22222', rulerId: 174, capitalCityId: 79,
    mode: 'territorial', headquartersLabel: '允吾大营', preferredKingdomName: '凉',
    historicalNote: '凉州豪族名士，威震陇右，与马腾结为异姓兄弟。',
    cities: [79, 82, 83, 84, 85, 86],
    officers: [
      { id: 174, cityId: 79, mp: 'grandGeneral', loyalty: 100 },
      { id: 484, cityId: 79, mp: 'general', loyalty: 90 },
      { id: 483, cityId: 79, loyalty: 90 },
      { id: 479, cityId: 82, mp: 'captain', loyalty: 80 },
      { id: 478, cityId: 83, mp: 'captain', loyalty: 80 },
      { id: 481, cityId: 84, mp: 'captain', loyalty: 80 },
      { id: 476, cityId: 79, mp: 'captain', loyalty: 80 },
      { id: 482, cityId: 85, mp: 'captain', loyalty: 80 },
      { id: 480, cityId: 86, mp: 'captain', loyalty: 80 },
      { id: 477, cityId: 79, mp: 'captain', loyalty: 80 }
    ]
  },
  {
    id: 24, name: '益州牧刘焉', color: '#2f4f4f', rulerId: 360, capitalCityId: 68,
    mode: 'territorial', headquartersLabel: '雒县幕府', preferredKingdomName: '蜀',
    historicalNote: '汉室宗亲，首倡立州牧，据天府之国险隘割据。',
    cities: [68, 19, 21, 69, 70, 71, 72, 73, 74, 75, 76],
    officers: [
      { id: 360, cityId: 68, mp: 'grandGeneral', loyalty: 100 },
      { id: 135, cityId: 19, mp: 'general', loyalty: 90 },
      { id: 171, cityId: 68, mp: 'general', loyalty: 90 },
      { id: 200, cityId: 68, mp: 'general', loyalty: 85 },
      { id: 938, cityId: 68, mp: 'captain', loyalty: 80 },
      { id: 939, cityId: 68, mp: 'captain', loyalty: 80 },
      { id: 940, cityId: 68, mp: 'captain', loyalty: 80 },
      { id: 582, cityId: 19, loyalty: 85 },
      { id: 1008, cityId: 21, loyalty: 85 },
      { id: 172, cityId: 19, loyalty: 75 },
      { id: 688, cityId: 19, loyalty: 80 },
      { id: 1066, cityId: 74, mp: 'captain', loyalty: 80 },
      { id: 1067, cityId: 74, mp: 'captain', loyalty: 80 }
    ]
  },
  {
    id: 25, name: '汉中张鲁', color: '#d2691e', rulerId: 175, capitalCityId: 20,
    mode: 'territorial', headquartersLabel: '汉中治所', preferredKingdomName: '汉',
    historicalNote: '创五斗米道，设义舍宽政爱民，雄踞汉水险关。',
    cities: [20],
    officers: [
      { id: 175, cityId: 20, mp: 'grandGeneral', loyalty: 100 },
      { id: 324, cityId: 20, mp: 'general', loyalty: 90 },
      { id: 176, cityId: 20, loyalty: 90 },
      { id: 1006, cityId: 20, mp: 'general', loyalty: 80 }
    ]
  },
  {
    id: 26, name: '交趾士燮', color: '#556b2f', rulerId: 187, capitalCityId: 30,
    mode: 'territorial', headquartersLabel: '龙编太守府', preferredKingdomName: '越',
    historicalNote: '世为南州名门，威重岭南，兄弟并领诸郡。',
    cities: [30, 29, 102, 103, 104, 105, 106],
    officers: [
      { id: 187, cityId: 30, mp: 'grandGeneral', loyalty: 100 },
      { id: 747, cityId: 30, loyalty: 90 },
      { id: 1060, cityId: 29, loyalty: 85 }
    ]
  },
  {
    id: 27, name: '黑山军张燕', color: '#8b0000', rulerId: 449, capitalCityId: 6,
    mode: 'territorial', headquartersLabel: '常山大营', preferredKingdomName: '燕',
    historicalNote: '黑山义军首领，捷走如飞称「飞燕」，众至百万。',
    cities: [6],
    officers: [
      { id: 449, cityId: 6, mp: 'grandGeneral', loyalty: 100 }
    ]
  },
  {
    id: 28, name: '白波军杨奉', color: '#800000', rulerId: 450, capitalCityId: 24,
    mode: 'territorial', headquartersLabel: '晋阳大营', preferredKingdomName: '赵',
    historicalNote: '白波黄巾渠帅，转战并州关中，骁将徐晃在麾下。',
    cities: [24, 87, 88, 89, 90, 91, 92, 93],
    officers: [
      { id: 450, cityId: 24, mp: 'grandGeneral', loyalty: 100 },
      { id: 116, cityId: 24, mp: 'general', loyalty: 85 },
      { id: 451, cityId: 24, mp: 'captain', loyalty: 85 }
    ]
  },
  {
    id: 29, name: '吴郡太守许贡', color: '#191970', rulerId: 814, capitalCityId: 16,
    mode: 'territorial', headquartersLabel: '吴县郡署', preferredKingdomName: '扬',
    historicalNote: '吴郡太守，总摄江表名士与沿江重镇。',
    cities: [16, 17, 18, 65, 67],
    officers: [
      { id: 814, cityId: 16, mp: 'grandGeneral', loyalty: 100 },
      { id: 392, cityId: 17, mp: 'general', loyalty: 85 },
      { id: 256, cityId: 16, loyalty: 85 },
      { id: 257, cityId: 67, loyalty: 85 }
    ]
  },
  {
    id: 30, name: '会稽严白虎', color: '#4a0e17', rulerId: 812, capitalCityId: 66,
    mode: 'territorial', headquartersLabel: '山阴大营', preferredKingdomName: '吴',
    historicalNote: '江东豪帅聚众万余，依凭太湖山水称东吴德王。',
    cities: [66],
    officers: [
      { id: 812, cityId: 66, mp: 'grandGeneral', loyalty: 100 },
      { id: 813, cityId: 66, mp: 'captain', loyalty: 90 }
    ]
  }
];

// 外交关系矩阵生成
const coalition = [2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const dipMap = new Map();

function setDip(a, b, relation, favorability) {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  dipMap.set(`${min}-${max}`, { factionA: min, factionB: max, relation, favorability });
}

// 1. 关东联军对董卓全战
coalition.forEach(fid => {
  setDip(1, fid, 'war', -80);
});

// 2. 关东联军内部互为同盟
for (let i = 0; i < coalition.length; i++) {
  for (let j = i + 1; j < coalition.length; j++) {
    setDip(coalition[i], coalition[j], 'allied', 40);
  }
}

// 3. 西凉同盟（马腾 22 + 韩遂 23）
setDip(22, 23, 'allied', 50);

// 4. 刘焉与张鲁开局臣属友好
setDip(24, 25, 'friendly', 30);

// 5. 刘虞与公孙瓒暗中敌对
setDip(6, 9, 'hostile', -30);

// 6. 扬州许贡与严白虎敌对
setDip(29, 30, 'hostile', -30);

// 7. 起义军敌对
[1, 2, 11].forEach(fid => setDip(27, fid, 'hostile', -40));
[1, 21].forEach(fid => setDip(28, fid, 'hostile', -40));

const initialDiplomacy = [];
for (let i = 1; i <= 30; i++) {
  for (let j = i + 1; j <= 30; j++) {
    const key = `${i}-${j}`;
    initialDiplomacy.push(dipMap.get(key) || { factionA: i, factionB: j, relation: 'neutral', favorability: 0 });
  }
}

// 组装剧本 4 数据
const cityOwnership = {};
const officerPositions = [];
const availableOfficerIds = [];

const usedCities = new Set();
const usedOfficers = new Set();

for (const f of FACTION_DEFINITIONS) {
  // 领地
  for (const cid of f.cities) {
    if (usedCities.has(cid)) throw new Error(`City ${cid} assigned multiple times`);
    usedCities.add(cid);
    cityOwnership[String(cid)] = f.id;
  }
  // 武将
  for (const off of f.officers) {
    if (usedOfficers.has(off.id)) throw new Error(`Officer ${off.id} deployed multiple times`);
    usedOfficers.add(off.id);
    const o = officerById.get(off.id);
    if (!o) throw new Error(`Officer ${off.id} not found in officers.json`);
    const age = 190 - o.birthYear;
    if (o.deathYear < 190 || age < 14) throw new Error(`Officer ${off.id} ${o.name} not eligible in 190`);
    officerPositions.push({
      officerId: off.id,
      cityId: off.cityId,
      factionId: f.id,
      ...(off.mp ? { militaryPosition: off.mp } : {}),
      loyalty: off.loyalty ?? 85,
    });
    availableOfficerIds.push(off.id);
  }
}

if (usedCities.size !== 106) throw new Error(`Expected 106 cities, assigned ${usedCities.size}`);
console.log(`✓ 106 城 100% 分配完毕，0 冲突 0 遗漏`);
console.log(`✓ 30 诸侯部署 ${availableOfficerIds.length} 名武将，0 冲突全部成年在世`);

// 组建 FactionSetups
const factionSetups = FACTION_DEFINITIONS.map(f => ({
  id: f.id,
  name: f.name,
  color: f.color,
  rulerId: f.rulerId,
  capitalCityId: f.capitalCityId,
  mode: f.mode,
  headquartersLabel: f.headquartersLabel,
  historicalNote: f.historicalNote,
  preferredKingdomName: f.preferredKingdomName
}));

const activeFactionIds = FACTION_DEFINITIONS.map(f => f.id);

// 提取既有剧本 4 的 eventIds
const prevS4 = rawScenarios.find(s => s.id === 4);
const eventIds = prevS4?.eventIds ?? [305, 306, 307, 308, 309];

const updatedS4 = {
  id: 4,
  name: '群雄讨董（190·三十诸侯全割据）',
  type: 'historical',
  noLifespan: false,
  description: '初平元年正月，关东州郡共推袁绍为盟主讨董卓，董卓挟天子迁都长安，焚烧洛阳。天下十三州郡国并起，三十诸侯逐鹿中原。',
  scopeNote: '全量三十诸侯版：东汉十三州 106 郡国全覆盖，包含董卓、关东联军诸部、幽燕刘虞公孙度、西凉马腾韩遂、巴蜀刘焉张鲁、岭南士燮、黑山白波等三十大独立割据势力。',
  startYear: 190,
  endYear: 193,
  factionSetups,
  eventIds,
  availableOfficerIds,
  availableFemaleIds: [202],
  childEventIds: [],
  availableEventLayers: prevS4?.availableEventLayers ?? ['official_history', 'annotated_history', 'literature', 'legend', 'gameplay'],
  defaultEventLayers: prevS4?.defaultEventLayers ?? ['official_history', 'annotated_history', 'literature', 'legend', 'gameplay'],
  playableFactions: activeFactionIds,
  recommendedFaction: 2,
  startState: {
    year: 190,
    month: 1,
    factions: activeFactionIds,
    activeFactionIds,
    cityOwnership,
    officerPositions,
    femalePositions: [
      { femaleId: 202, cityId: 1, status: 'single' }
    ],
    initialDiplomacy,
    completedEvents: []
  }
};

// 替换 rawScenarios 中的剧本 4
const newScenarios = rawScenarios.map(s => s.id === 4 ? updatedS4 : s);

writeFileSync(SCENARIOS_FILE, JSON.stringify(newScenarios, null, 2) + '\n', 'utf-8');
console.log(`✓ 成功将三十诸侯全割据写入 scenarios.json (剧本 4)`);
