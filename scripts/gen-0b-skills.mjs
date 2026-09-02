// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 0-B 数据扩容 P0B-13：skills.json 30 → 149（69 通用×5级 + 80 专属，Session 428）。
 *
 * 规则（docs/08 §八 为真源；docs/05 §6.2.3/6.3.3/6.4.3 为引擎专属联动表；docs/30 专属不树化）：
 * - 现有 30 通用：levels 1 条（0-A 简化）补全为 5 级表，L1 逐字节保持不变；
 *   新增 39 通用含 officers.json 已引用的 9 个悬空 id（diplomacy/civilization/wile/
 *   religious/navigation/toughness/throw/intimidate/charm），顺带修复目录缺口。
 * - 引擎只读 officer.skills 的等级数字（skillLevelOf/crit/duel），skills.json levels 表
 *   为设计目录零消费 → 金样/战斗 RNG 零扰动。
 * - 80 专属：史书/演义人物绰号与事迹（docs/00 §六），category=unique、maxLevel=1、不树化；
 *   引擎已实装的 10 个专属 id（wusheng/wushuang/ganglie/paoxiao/longdan/shenjiang/
 *   huchi/elai/qishen/tianyi，crit.ts）必须收录。
 * - 附带产出 client/src/generated/skill-names.ts（id→名映射，单一真源 skills.json 生成），
 *   OfficerDetail 显示层不再手写 30 条映射。
 *
 * 运行：node scripts/gen-0b-skills.mjs（幂等：以原始 30 id 集为基线重排全表）。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'server', 'src', 'data', 'skills.json');
const OFFICERS = join(ROOT, 'server', 'src', 'data', 'officers.json');
const FEMALES = join(ROOT, 'server', 'src', 'data', 'females.json');
const TREES = join(ROOT, 'server', 'src', 'data', 'skill-trees.json');
const CLIENT_OUT = join(ROOT, 'client', 'src', 'generated', 'skill-names.ts');

/** 原始 0-A 30 通用 id（幂等基线） */
const BASE_IDS = new Set([
  'fire', 'water', 'rockfall', 'ambush', 'taunt', 'discord', 'calm', 'inspire', 'sorcery', 'illusion',
  'gallop', 'forcedMarch', 'rapidAttack', 'hold', 'longRange', 'formationChange', 'reorganize', 'raid',
  'farming', 'commerce', 'fortify', 'recruit', 'train', 'discover', 'eloquence', 'medicine',
  'insight', 'bravery', 'riding', 'archery',
]);

const RANKS = ['初', '通', '精', '极', '神'];
const USE_LADDER = [undefined, 3, 8, 20, 50];
const STAT_LADDER = [55, 60, 65, 72, 80];

/** 新增 39 通用（含 9 个 officers 悬空 id）。vals 为 5 级效果值；stat 为养成门槛主属性。 */
const NEW_GENERICS = [
  // ── tactics ─────────────────────────────────────────────────
  { id: 'wile', name: '诡诈', category: 'tactics', stat: 'intelligence', desc: '兵者诡道，佯动惑敌，受伏击与奇袭伤害降低。', vals: [5, 8, 10, 14, 18], unit: '%', fx: (v) => `受伏击/奇袭伤害-${v}%` },
  { id: 'fireArrow', name: '火矢', category: 'tactics', stat: 'intelligence', desc: '火箭齐射，射杀并引燃营栅。', vals: [1.0, 1.2, 1.4, 1.7, 2.0], unit: 'x', fx: (v) => `火箭伤害=智×${v.toFixed(1)}，高阶可引燃` },
  { id: 'poisonSmoke', name: '毒烟', category: 'tactics', stat: 'intelligence', desc: '施放毒烟，削弱敌军战力。', vals: [1, 2, 3, 4, 5], unit: '回合', fx: (v) => `毒烟滞留${v}回合，敌战力下降` },
  { id: 'fanji', name: '反计', category: 'tactics', stat: 'intelligence', desc: '识破敌方计略并反制。', vals: [10, 15, 20, 25, 30], unit: '%', fx: (v) => `识破敌计概率+${v}%` },
  { id: 'xubing', name: '虚兵', category: 'tactics', stat: 'intelligence', desc: '虚张声势，令敌误判兵力。', vals: [10, 15, 20, 25, 30], unit: '%', fx: (v) => `敌情侦判兵力虚增${v}%` },
  { id: 'yunti', name: '云梯', category: 'tactics', stat: 'war', desc: '架梯登城，攻城利器。', vals: [10, 15, 20, 25, 30], unit: '%', fx: (v) => `攻城伤害+${v}%` },
  { id: 'chongche', name: '冲车', category: 'tactics', stat: 'war', desc: '冲车撞城，破門摧堞。', vals: [15, 20, 25, 30, 40], unit: '%', fx: (v) => `城防破坏+${v}%` },
  { id: 'religious', name: '巫祝', category: 'tactics', stat: 'intelligence', desc: '巫祝祈禳，鼓舞部众，符水咒说以疗病。', vals: [5, 8, 10, 14, 18], unit: '', fx: (v) => `所部士气+${v}` },
  // ── command ─────────────────────────────────────────────────
  { id: 'navigation', name: '航海', category: 'command', stat: 'leadership', desc: '熟习水道，水军接舷占优。', vals: [5, 8, 10, 14, 18], unit: '%', fx: (v) => `水战伤害+${v}%` },
  { id: 'shuiyan', name: '水淹', category: 'command', stat: 'intelligence', desc: '决堤灌城，水攻之力。', vals: [1.0, 1.3, 1.6, 2.0, 2.5], unit: 'x', fx: (v) => `水攻伤害=智×${v.toFixed(1)}` },
  { id: 'yexi', name: '夜袭', category: 'command', stat: 'war', desc: '衔枚夜进，掩袭敌营。', vals: [10, 15, 20, 25, 30], unit: '%', fx: (v) => `夜间伤害+${v}%` },
  { id: 'duanliang', name: '劫粮', category: 'command', stat: 'leadership', desc: '断敌粮道，困敌于野。', vals: [10, 15, 20, 25, 30], unit: '%', fx: (v) => `焚敌粮+${v}%` },
  { id: 'chiyuan', name: '驰援', category: 'command', stat: 'leadership', desc: '移军如风，赴援急难。', vals: [5, 8, 10, 14, 18], unit: '%', fx: (v) => `行军/驰援效率+${v}%` },
  { id: 'duanhou', name: '断后', category: 'command', stat: 'leadership', desc: '全军为殿，撤退减损。', vals: [10, 15, 20, 25, 30], unit: '%', fx: (v) => `撤退兵力损耗-${v}%` },
  { id: 'hewei', name: '合围', category: 'command', stat: 'leadership', desc: '分进合击，围而后胜。', vals: [5, 8, 10, 14, 18], unit: '%', fx: (v) => `合围加成+${v}%` },
  { id: 'zhuiji', name: '追击', category: 'command', stat: 'war', desc: '掩杀溃兵，穷寇必追。', vals: [10, 15, 20, 25, 30], unit: '%', fx: (v) => `对溃兵伤害+${v}%` },
  { id: 'juma', name: '拒马', category: 'command', stat: 'intelligence', desc: '拒马鹿角，克制骑突。', vals: [10, 15, 20, 25, 30], unit: '%', fx: (v) => `受骑兵伤害-${v}%` },
  // ── civil ───────────────────────────────────────────────────
  { id: 'diplomacy', name: '外交', category: 'civil', stat: 'charisma', desc: '折冲樽俎，聘问四方。', vals: [2, 3, 4, 5, 7], unit: '', fx: (v) => `外交成功率+${v}百分点` },
  { id: 'civilization', name: '教化', category: 'civil', stat: 'politics', desc: '设庠序之教，移风易俗。', vals: [2, 3, 4, 5, 7], unit: '', fx: (v) => `民心得${v}` },
  { id: 'tuntian', name: '屯田', category: 'civil', stat: 'politics', desc: '且耕且守，积谷固本。', vals: [5, 8, 10, 14, 18], unit: '%', fx: (v) => `粮产+${v}%` },
  { id: 'shuili', name: '水利', category: 'civil', stat: 'politics', desc: '陂塘沟渠，旱涝有备。', vals: [3, 5, 6, 8, 10], unit: '%', fx: (v) => `粮产/防灾+${v}%` },
  { id: 'zhaofu', name: '招抚', category: 'civil', stat: 'charisma', desc: '招抚流亡，附籍劝垦。', vals: [3, 5, 6, 8, 10], unit: '%', fx: (v) => `人口增长+${v}%` },
  { id: 'quanxue', name: '劝学', category: 'civil', stat: 'politics', desc: '兴学劝士，文化日隆。', vals: [2, 3, 4, 5, 7], unit: '', fx: (v) => `文化+${v}` },
  { id: 'gongjiang', name: '工匠', category: 'civil', stat: 'politics', desc: '督造百工，坚城利械。', vals: [5, 8, 10, 14, 18], unit: '%', fx: (v) => `城防/工程效率+${v}%` },
  { id: 'yantie', name: '盐铁', category: 'civil', stat: 'politics', desc: '盐铁专营，国用饶给。', vals: [5, 8, 10, 14, 18], unit: '%', fx: (v) => `金收+${v}%` },
  { id: 'zhenji', name: '赈济', category: 'civil', stat: 'charisma', desc: '开仓赈贷，民心归附。', vals: [3, 5, 6, 8, 10], unit: '', fx: (v) => `民心得${v}` },
  // ── personal ────────────────────────────────────────────────
  { id: 'toughness', name: '坚韧', category: 'personal', stat: 'war', desc: '疮痍遍体而战意不堕。', vals: [5, 8, 10, 14, 18], unit: '%', fx: (v) => `所受伤害-${v}%` },
  { id: 'throw', name: '投掷', category: 'personal', stat: 'war', desc: '飞掷短械，例无虚发。', vals: [1.0, 1.2, 1.4, 1.7, 2.0], unit: 'x', fx: (v) => `投掷伤害=武×${v.toFixed(1)}` },
  { id: 'intimidate', name: '威吓', category: 'personal', stat: 'war', desc: '声若巨雷，慑敌心胆。', vals: [5, 8, 10, 14, 18], unit: '', fx: (v) => `敌军士气-${v}` },
  { id: 'charm', name: '魅力', category: 'personal', stat: 'charisma', desc: '仪容风度，众望所归。', vals: [2, 3, 4, 5, 7], unit: '', fx: (v) => `登用/忠诚+${v}` },
  { id: 'qiangshu', name: '枪术', category: 'personal', stat: 'war', desc: '长枪独出，单挑占先。', vals: [3, 5, 6, 8, 10], unit: '%', fx: (v) => `单挑伤害+${v}%` },
  { id: 'jishu', name: '戟术', category: 'personal', stat: 'war', desc: '持戟纵横，钩啄兼施。', vals: [3, 5, 6, 8, 10], unit: '%', fx: (v) => `单挑伤害+${v}%` },
  { id: 'daoshu', name: '刀术', category: 'personal', stat: 'war', desc: '刀势沉猛，劈斩开路。', vals: [3, 5, 6, 8, 10], unit: '%', fx: (v) => `单挑伤害+${v}%` },
  { id: 'jianshu', name: '剑术', category: 'personal', stat: 'war', desc: '剑走轻灵，短兵相接。', vals: [3, 5, 6, 8, 10], unit: '%', fx: (v) => `单挑伤害+${v}%` },
  { id: 'shuixing', name: '水性', category: 'personal', stat: 'war', desc: '泅渡如履平地，舟战不惧。', vals: [5, 8, 10, 14, 18], unit: '%', fx: (v) => `水战适性加成+${v}%` },
  { id: 'xiangma', name: '相马', category: 'personal', stat: 'intelligence', desc: '伯乐之术，识马于未显。', vals: [5, 8, 10, 14, 18], unit: '%', fx: (v) => `马匹品质加成+${v}%` },
  { id: 'bingfa', name: '兵法', category: 'personal', stat: 'intelligence', desc: '熟读韬略，战法威力增益。', vals: [2, 3, 4, 5, 7], unit: '%', fx: (v) => `战法威力+${v}%` },
  { id: 'tianwen', name: '天文', category: 'personal', stat: 'intelligence', desc: '仰观天象，知风雨之候。', vals: [5, 8, 10, 14, 18], unit: '%', fx: (v) => `观天/气象判定+${v}%` },
  { id: 'dili', name: '地理', category: 'personal', stat: 'intelligence', desc: '深谙山川险易，行军占便。', vals: [5, 8, 10, 14, 18], unit: '%', fx: (v) => `地形加成+${v}%` },
];

/** 80 专属（engine 10 + 名士良将 + 才女方技）。owner 仅作文注；P0B-06 时经 officer.uniqueSkill 绑定。 */
const UNIQUES = [
  // 引擎已实装（05 §6.2.3/6.3.3/6.4.3，crit.ts uniqueOf）
  { id: 'wusheng', name: '武圣', owner: '关羽', desc: '关羽专属。暴击率+15%、倍率×2.5，击败敌将后下回合必连击（《三国志》威震华夏；效果已实装 05 §6.2.3/6.4.3）' },
  { id: 'wushuang', name: '无双', owner: '吕布', desc: '吕布专属。暴击率+20%无视防御，连击不衰减、反击后+5气力（演义「人中吕布」；效果已实装）' },
  { id: 'ganglie', name: '刚烈', owner: '张飞', desc: '张飞专属。暴伤+30%，被攻击必反击且反击必暴、系数×1.0（史评「暴而无恩」之反面，雄壮威猛（《三国志》）；效果已实装）' },
  { id: 'paoxiao', name: '咆哮', owner: '张飞', desc: '张飞专属。首回合连击率+50%，敌混乱时+30%（演义长坂据水断桥喝退曹军；效果已实装）' },
  { id: 'longdan', name: '龙胆', owner: '赵云', desc: '赵云专属。单骑连击率+20%逐回合累加，被围反击率翻倍（一身是胆（《三国志》裴注）；效果已实装）' },
  { id: 'shenjiang', name: '神将', owner: '赵云', desc: '赵云专属。单骑暴击率+15%，体力过半主动攻击后仍可反击（演义常胜将军形象；效果已实装）' },
  { id: 'huchi', name: '虎痴', owner: '许褚', desc: '许褚专属。体力<20%时暴击/连击率+30%，反击必暴（史 裴注「虎痴」之称（《三国志》）；效果已实装）' },
  { id: 'elai', name: '恶来', owner: '典韦', desc: '典韦专属。反击率+30%、系数×1.2，每回合可反击2次（曹操比之古之恶来（《三国志》）；效果已实装）' },
  { id: 'qishen', name: '骑神', owner: '马超', desc: '马超专属。骑兵暴击率+15%，冲锋连击率+20%（演义神威天将军；效果已实装）' },
  { id: 'tianyi', name: '天义', owner: '太史慈', desc: '太史慈专属。攻击必二连击、连击独立暴击判定（演义天义之名与神亭酣斗；效果已实装）' },
  // 谋主军师
  { id: 'wolong', name: '卧龙', owner: '诸葛亮', desc: '诸葛亮专属。隆中对定三分，卧龙之名（《三国志》自比管乐，时人未许）' },
  { id: 'fengchu', name: '凤雏', owner: '庞统', desc: '庞统专属。与卧龙齐名的凤雏（《三国志》庞统传，司马徽语「凤雏」）' },
  { id: 'guicai', name: '鬼才', owner: '郭嘉', desc: '郭嘉专属。十胜十败论、遗计定辽东（《三国志》裴注，民间称「鬼才」）' },
  { id: 'wangzuo', name: '王佐', owner: '荀彧', desc: '荀彧专属。何颙评「王佐才也」，居中持重二十载（《三国志》）' },
  { id: 'mouzhu', name: '谋主', owner: '荀攸', desc: '荀攸专属。曹操军师之长，前后画奇策十二（《三国志》）' },
  { id: 'dushi', name: '毒士', owner: '贾诩', desc: '贾诩专属。算无遗策，一言乱天下（《三国志》，民间称「毒士」）' },
  { id: 'tashang', name: '榻上策', owner: '鲁肃', desc: '鲁肃专属。榻上策对，先定江东再图天下（《三国志·鲁肃传》）' },
  { id: 'guamu', name: '刮目', owner: '吕蒙', desc: '吕蒙专属。士别三日刮目相待，白衣渡江（《三国志》裴注引《江表传》）' },
  { id: 'lianying', name: '连营', owner: '陆逊', desc: '陆逊专属。火烧连营，彝陵破刘备（《三国志》）' },
  { id: 'yinglang', name: '鹰狼', owner: '司马懿', desc: '司马懿专属。鹰视狼顾，内忌而外宽（《晋书》，史称「狼顾之相」）' },
  { id: 'sishi', name: '死士', owner: '司马师', desc: '司马师专属。阴养死士三千，密谋定于朝夕（《晋书·景帝纪》）' },
  { id: 'qihua', name: '奇画', owner: '法正', desc: '法正专属。奇画策算，助刘备定蜀（《三国志》评「奇画策算」）' },
  // 主公
  { id: 'jianxiong', name: '奸雄', owner: '曹操', desc: '曹操专属。许劭评「治世之能臣，乱世之奸雄」（史（《后汉书》/《三国志》裴注））' },
  { id: 'xiaoxiong', name: '枭雄', owner: '刘备', desc: '刘备专属。折而不挠，天下枭雄（《三国志》评「高祖之风，英雄之器」）' },
  { id: 'sangong', name: '三公', owner: '袁绍', desc: '袁绍专属。四世三公，门生故吏遍天下（《三国志》）' },
  { id: 'menghu', name: '猛虎', owner: '孙坚', desc: '孙坚专属。江东猛虎，破虏将军（《三国演义》绰号；史官至破虏将军）' },
  { id: 'ziran', name: '紫髯', owner: '孙权', desc: '孙权专属。碧眼紫髯，紫髯将军（《三国演义》形象；汉使称其「相貌奇伟」）' },
  // 名将
  { id: 'zhiti', name: '止啼', owner: '张辽', desc: '张辽专属。逍遥津之战后，江东小儿闻辽名不敢夜啼（《三国志》裴注引《魏略》）' },
  { id: 'changqu', name: '长驱', owner: '徐晃', desc: '徐晃专属。樊城之围长驱径入，曹操称有「周亚夫之风」（《三国志》）' },
  { id: 'qiaobian', name: '巧变', owner: '张郃', desc: '张郃专属。识变数，善处营陈，料战势地形（《三国志》评「郃识变数」）' },
  { id: 'yizhong', name: '毅重', owner: '于禁', desc: '于禁专属。持军严整，最号毅重（《三国志》评）' },
  { id: 'xiandeng', name: '先登', owner: '乐进', desc: '乐进专属。每战先登，从击吕布张绣（《三国志》评「每战先登」）' },
  { id: 'tianren', name: '天人', owner: '曹仁', desc: '曹仁专属。守樊城偃城，长史陈矫叹「将军真天人也」（《三国志》裴注）' },
  { id: 'manghou', name: '盲侯', owner: '夏侯惇', desc: '夏侯惇专属。拔矢啖睛，军中称「盲夏侯」（裴注引《魏略》，演义浓墨）' },
  { id: 'hubu', name: '虎步', owner: '夏侯渊', desc: '夏侯渊专属。虎步关右，所向无前，三日五百六日一千（曹操语，《三国志》）' },
  { id: 'shenshe', name: '神射', owner: '黄忠', desc: '黄忠专属。百步穿杨，定军山斩夏侯渊（演义「神射」；斩渊事见《三国志》）' },
  { id: 'fangu', name: '反骨', owner: '魏延', desc: '魏延专属。脑后反骨，子午谷奇谋（演义「反骨」说；《三国志》评「延既善养士卒，勇猛过人，又性矜高」）' },
  { id: 'xiaobawang', name: '小霸王', owner: '孙策', desc: '孙策专属。勇猛冠世如项籍，人称小霸王（《三国志》裴注引《吴历》，演义绰号）' },
  { id: 'jinfan', name: '锦帆', owner: '甘宁', desc: '甘宁专属。锦帆贼出身的江表虎臣，百骑劫魏营（《三国志》及裴注引《吴书》）' },
  { id: 'kuru', name: '苦肉', owner: '黄盖', desc: '黄盖专属。苦肉计诈降，赤壁火攻首功（演义名场面；火攻谏策见《三国志》）' },
  { id: 'buqu', name: '不屈', owner: '周泰', desc: '周泰专属。遍体创痍，肤如刻画，救孙权于乱军（《三国志》裴注引《江表传》）' },
  { id: 'duanbing', name: '短兵', owner: '丁奉', desc: '丁奉专属。雪中奋短兵，破魏军于东兴（《三国志》）' },
  { id: 'yicheng', name: '疑城', owner: '徐盛', desc: '徐盛专属。立疑城假楼，一夜退曹丕（《三国志》）' },
  { id: 'taichen', name: '抬榇', owner: '庞德', desc: '庞德专属。抬榇决死战关羽，射羽中额，终不降而死（《三国志》，演义浓墨）' },
  { id: 'chencang', name: '陈仓', owner: '郝昭', desc: '郝昭专属。千人守陈仓，拒诸葛亮数万之众二十余日（《三国志》）' },
  { id: 'xianzhen', name: '陷阵', owner: '高顺', desc: '高顺专属。陷阵营七百兵，攻无不克（裴注引《英雄记》）' },
  { id: 'baima', name: '白马', owner: '公孙瓒', desc: '公孙瓒专属。白马将军，率白马义从镇守北疆（《后汉书》/《三国志》）' },
  { id: 'duantou', name: '断头', owner: '严颜', desc: '严颜专属。「我州但有断头将军，无有降将军」（（《三国志·张飞传》）' },
  { id: 'guoshi', name: '国士', owner: '凌统', desc: '凌统专属。轻财重义，有国士之风（《三国志》）' },
  { id: 'zhangzhe', name: '长者', owner: '李典', desc: '李典专属。不与诸将争功，敬贤士大夫，有长者之风（《三国志》）' },
  { id: 'rangma', name: '让马', owner: '曹昂', desc: '曹昂专属。宛城之变以马授父，孝烈殒身（裴注引《世语》）' },
  { id: 'huangxu', name: '黄须', owner: '曹彰', desc: '曹彰专属。须黄而勇，曹操称「黄须儿」，北征代郡乌丸（《三国志》）' },
  { id: 'fulang', name: '何郎', owner: '何晏', desc: '何晏专属。美姿仪面至白，行步顾影，人称「傅粉何郎」（裴注引《魏略》）' },
  { id: 'qianliju', name: '千里驹', owner: '曹休', desc: '曹休专属。曹操称「此吾家千里驹也」，使与曹真共领虎豹骑（《三国志》）' },
  { id: 'gexi', name: '割席', owner: '华歆', desc: '华歆专属。管宁割席，子鱼优游（世说新语·德行）' },
  { id: 'huaiju', name: '怀橘', owner: '陆绩', desc: '陆绩专属。六岁怀橘遗母，孝行传世（裴注引《吴录》，后入二十四孝）' },
  // 才女方技
  { id: 'biyue', name: '闭月', owner: '貂蝉', desc: '貂蝉专属。连环计中的闭月之姿（民间「四大美女」传说层，《三国演义》浓墨）' },
  { id: 'hujia', name: '胡笳', owner: '蔡琰', desc: '蔡琰专属。博学才辩，感伤乱作《胡笳十八拍》（《后汉书·列女传》，文学层）' },
  { id: 'jiguan', name: '机巧', owner: '黄月英', desc: '黄月英专属。善机巧，传说木牛流马之术相授（裴注引《襄阳记》及民间传说层）' },
  { id: 'feidao', name: '飞刀', owner: '祝融', desc: '祝融专属。飞刀百发百中，擒将如探囊（演义南蛮女王设定层）' },
  { id: 'shenyi', name: '神医', owner: '华佗', desc: '华佗专属。刮骨疗毒，麻沸散之祖（《三国志·方技传》）' },
  { id: 'jiaowei', name: '焦尾', owner: '蔡邕', desc: '蔡邕专属。闻火烈之声识良桐，制焦尾琴（《后汉书·蔡邕传》）' },
  { id: 'guose', name: '国色', owner: '大乔', desc: '大乔专属。二乔国色，桥公之女嫁孙策（《三国志·周瑜传》，演义浓墨）' },
  { id: 'luoshen', name: '洛神', owner: '甄宓', desc: '甄宓专属。翩若惊鸿婉若游龙，洛神之拟（曹植《洛神赋》传说层）' },
  { id: 'gongyaoji', name: '弓腰姬', owner: '孙尚香', desc: '孙尚香专属。才捷刚猛，侍婢百人皆执刀侍立，人称弓腰姬（演义及民间绰号层）' },
  // 异术
  { id: 'huangtian', name: '黄天', owner: '张角', desc: '张角专属。「苍天已死，黄天当立」，太平道举事（《后汉书》）' },
  { id: 'pili', name: '霹雳', owner: '刘晔', desc: '刘晔专属。献发石车号「霹雳车」，破袁绍橹楼（演义官渡名场面层）' },
  // 文治政略
  { id: 'jiupin', name: '九品', owner: '陈群', desc: '陈群专属。立九品官人法，定一代选制（《三国志》）' },
  { id: 'badou', name: '八斗', owner: '曹植', desc: '曹植专属。才高八斗，骨气奇高词采华茂（谢灵运语，后世文学层）' },
  { id: 'duolei', name: '堕泪', owner: '羊祜', desc: '羊祜专属。镇襄阳绥怀有方，百姓立碑堕泪（《晋书》）' },
  { id: 'wuku', name: '武库', owner: '杜预', desc: '杜预专属。博学多通，时人谓之「杜武库」（《晋书》）' },
  { id: 'louchuan', name: '楼船', owner: '王濬', desc: '王濬专属。治舟七年，楼船顺流直取建业（《晋书》）' },
  { id: 'lianhuan', name: '连环', owner: '王允', desc: '王允专属。巧设连环计，除董卓于宫阙（演义名场面层，除卓事见《后汉书》）' },
  // 末期与宿儒
  { id: 'xiling', name: '西陵', owner: '陆抗', desc: '陆抗专属。西陵破步阐，吴国最后的名将之壁（《三国志》）' },
  { id: 'yinping', name: '阴平', owner: '邓艾', desc: '邓艾专属。偷渡阴平七百里无人之地，一战灭蜀（《三国志》）' },
  { id: 'dandou', name: '胆斗', owner: '姜维', desc: '姜维专属。维死时见剖，胆如斗大（裴注引《世语》，演义浓墨）' },
  { id: 'jiecai', name: '捷才', owner: '诸葛恪', desc: '诸葛恪专属。少有才名，辩捷无对（《三国志》）' },
  { id: 'daru', name: '大儒', owner: '卢植', desc: '卢植专属。海内大儒，涿郡名门之师（《后汉书》）' },
  { id: 'weizhen', name: '威震', owner: '皇甫嵩', desc: '皇甫嵩专属。平黄巾首功，威震天下（《后汉书》）' },
  { id: 'zouma', name: '走马', owner: '徐庶', desc: '徐庶专属。走马荐诸葛，身在曹营不献一策（演义层；辞先主事见《三国志》）' },
];

// ── 展开与校验 ─────────────────────────────────────────────────
const raw = JSON.parse(readFileSync(FILE, 'utf-8'));
if (raw.length !== 30 && raw.length !== 149) {
  throw new Error(`unexpected input state: ${raw.length} skills (expect 30 pre-batch or 149 idempotent rerun)`);
}
// 幂等基线：只保留原 30 条，并把每条 levels 截回原始 L1
const base = raw.filter((s) => BASE_IDS.has(s.id));
if (base.length !== 30) throw new Error(`base generics found ${base.length}, expect 30`);

const CATEGORY_STAT = { tactics: 'intelligence', command: 'war', civil: 'politics', personal: 'war' };

function expandGeneric(skill) {
  const stat = CATEGORY_STAT[skill.category] ?? 'war';
  const levels = [skill.levels[0]];
  for (let lv = 2; lv <= 5; lv++) {
    levels.push({
      level: lv,
      name: `${skill.name}·${RANKS[lv - 1]}`,
      effects: [{ type: skill.id, value: lv, description: `${skill.name}等级${lv}` }],
      requirement: { minStats: { [stat]: STAT_LADDER[lv - 1] }, ...(USE_LADDER[lv - 1] != null ? { useCount: USE_LADDER[lv - 1] } : {}) },
    });
  }
  return { ...skill, levels };
}

const out = [];
for (const s of base) out.push(expandGeneric(s));
for (const g of NEW_GENERICS) {
  const levels = [];
  for (let lv = 1; lv <= 5; lv++) {
    const v = g.vals[lv - 1];
    const valueTxt = g.unit === 'x' ? v.toFixed(1) : String(v);
    const descTxt = g.unit === '%' || g.unit === 'x' ? `${g.fx(v)}` : `${g.fx(v)}`;
    levels.push({
      level: lv,
      name: `${g.name}·${RANKS[lv - 1]}`,
      effects: [{ type: g.id, value: v, description: descTxt }],
      requirement: { minStats: { [g.stat]: STAT_LADDER[lv - 1] }, ...(USE_LADDER[lv - 1] != null ? { useCount: USE_LADDER[lv - 1] } : {}) },
    });
  }
  out.push({ id: g.id, name: g.name, category: g.category, description: g.desc, maxLevel: 5, levels });
}
for (const u of UNIQUES) {
  out.push({
    id: u.id,
    name: u.name,
    category: 'unique',
    description: u.desc,
    maxLevel: 1,
    levels: [{ level: 1, name: u.name, effects: [{ type: 'unique', value: 1, description: `${u.owner}专属` }], requirement: {} }],
  });
}

// ── 自检 ───────────────────────────────────────────────────────
const ids = new Set();
const names = new Set();
let genericCount = 0;
let uniqueCount = 0;
for (const s of out) {
  if (ids.has(s.id)) throw new Error(`duplicate skill id ${s.id}`);
  if (names.has(s.name)) throw new Error(`duplicate skill name ${s.name}`);
  if (!['tactics', 'command', 'civil', 'personal', 'unique'].includes(s.category)) throw new Error(`id ${s.id} bad category`);
  if (s.maxLevel !== s.levels.length) throw new Error(`id ${s.id} maxLevel ${s.maxLevel} != levels ${s.levels.length}`);
  if (s.category === 'unique') {
    uniqueCount++;
    if (s.maxLevel !== 1) throw new Error(`unique ${s.id} maxLevel must be 1`);
  } else {
    genericCount++;
    if (s.maxLevel !== 5) throw new Error(`generic ${s.id} maxLevel must be 5`);
    for (const lv of s.levels) {
      for (const st of Object.keys(lv.requirement?.minStats ?? {})) {
        if (!['war', 'leadership', 'intelligence', 'politics', 'charisma'].includes(st)) throw new Error(`id ${s.id} bad req stat ${st}`);
      }
    }
  }
  ids.add(s.id);
  names.add(s.name);
}
if (genericCount !== 69) throw new Error(`expect 69 generics, got ${genericCount}`);
if (uniqueCount !== 80) throw new Error(`expect 80 uniques, got ${uniqueCount}`);
if (out.length !== 149) throw new Error(`expect 149 skills, got ${out.length}`);

const ENGINE_UNIQUES = ['wusheng', 'wushuang', 'ganglie', 'paoxiao', 'longdan', 'shenjiang', 'huchi', 'elai', 'qishen', 'tianyi'];
for (const id of ENGINE_UNIQUES) {
  if (!ids.has(id)) throw new Error(`engine unique ${id} missing from catalog`);
}
// 悬空引用修复断言：officers/females/skill-trees 引用的 skillId 必须全部可解析
const officers = JSON.parse(readFileSync(OFFICERS, 'utf-8'));
const females = JSON.parse(readFileSync(FEMALES, 'utf-8'));
const treeRaw = JSON.parse(readFileSync(TREES, 'utf-8'));
const trees = Array.isArray(treeRaw) ? treeRaw : Object.values(treeRaw);
const refs = new Set();
for (const o of officers) for (const k of o.skills ?? []) refs.add(k.skillId);
for (const f of females) for (const k of f.teachableSkills ?? []) refs.add(k);
for (const t of trees) for (const n of t.nodes ?? []) if (n.skillId) refs.add(n.skillId);
for (const r of refs) {
  if (!ids.has(r)) throw new Error(`dangling skill reference remains: ${r}`);
}
// 现有 30 条 L1 逐字节不变断言
for (const s of base) {
  const before = raw.find((r) => r.id === s.id).levels[0];
  const after = out.find((r) => r.id === s.id).levels[0];
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`L1 of ${s.id} changed!`);
}

writeFileSync(FILE, JSON.stringify(out, null, 2) + '\n', 'utf-8');

// 生成 client 显示层映射（单一真源 skills.json → 生成文件）
mkdirSync(dirname(CLIENT_OUT), { recursive: true });
const lines = out.map((s) => `  ${JSON.stringify(s.id)}: ${JSON.stringify(s.name)},`).join('\n');
const generated = `// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot
// 自动生成：node scripts/gen-0b-skills.mjs —— 请勿手改（真源 server/src/data/skills.json）

/** 技能 id → 中文名（P0B-13 全量 149 条）。 */
export const SKILL_NAME: Record<string, string> = {
${lines}
};
`;
writeFileSync(CLIENT_OUT, generated, 'utf-8');
console.log(`skills.json written: ${out.length} skills (69 generic x5 levels + 80 unique); skill-names.ts regenerated`);
