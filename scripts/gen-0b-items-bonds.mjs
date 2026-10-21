// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const itemsPath = path.resolve(__dirname, '../server/src/data/items.json');
const raw = fs.readFileSync(itemsPath, 'utf8');
const items = JSON.parse(raw);

/**
 * 历史名品专属羁绊配置表
 * officerId 严格对应 officers.json:
 * 1: 曹操, 2: 刘备, 3: 孙权, 4: 诸葛亮, 5: 吕布, 6: 关羽, 7: 张飞, 8: 荀彧, 9: 夏侯惇, 10: 赵云
 * 11: 周瑜, 12: 司马懿, 13: 典韦, 14: 黄忠, 15: 陆逊, 100: 许褚, 105: 孙策, 107: 甘宁, 112: 董卓
 * 113: 袁绍, 114: 孙坚, 115: 张辽, 116: 徐晃, 117: 张郃, 118: 于禁, 119: 乐进, 120: 夏侯渊
 * 124: 贾诩, 125: 郭嘉, 127: 庞统, 128: 法正, 129: 姜维, 130: 魏延, 131: 马超, 141: 鲁肃
 * 142: 吕蒙, 143: 程普, 144: 黄盖, 146: 太史慈, 159: 颜良, 160: 文丑, 183: 张角, 186: 华佗
 * 284: 袁术, 291: 纪灵, 298: 祝融, 358: 刘协, 716: 沙摩柯
 */
const BONDS = {
  1: {
    // 青龙偃月刀
    officerId: 6, // 关羽
    description: '关云长执八十二斤冷艳锯，温酒斩华雄，过五关斩六将，神威盖世。',
    bonusStats: { war: 2 },
    bonusEffect: [
      { type: 'duel_boost', value: 20, description: '【武圣】单挑决斗战意提升20%' },
    ],
  },
  2: {
    // 方天画戟
    officerId: 5, // 吕布
    description: '奉先画戟横绝当世，辕门射戟一箭定和，天下无双。',
    bonusStats: { war: 3 },
    bonusEffect: [
      { type: 'crit_rate', value: 10, description: '【无双】部队暴击率+10%' },
    ],
  },
  3: {
    // 丈八蛇矛
    officerId: 7, // 张飞
    description: '翼德执矛当阳桥头厉声大喝，当阳桥断水倒流。',
    bonusStats: { war: 2 },
    bonusEffect: [
      { type: 'charge_damage', value: 20, description: '【咆哮】突击伤害+20%' },
    ],
  },
  4: {
    // 倚天剑
    officerId: 1, // 曹操
    description: '安得倚天抽宝剑，跨海斩长鲸。孟德镇国佩剑。',
    bonusStats: { leadership: 2 },
    bonusEffect: [
      { type: 'authority', value: 10, description: '【孟德】威望威势提升' },
    ],
  },
  5: {
    // 雌雄双股剑
    officerId: 2, // 刘备
    description: '双刃顾应，仁德照临。玄德凭此拔剑起幽燕。',
    bonusStats: { charisma: 3 },
    bonusEffect: [
      { type: 'recruit_bonus', value: 10, description: '【昭烈】天下人心归附' },
    ],
  },
  6: {
    // 宝雕弓
    officerId: 146, // 太史慈
    description: '子义猿臂善射，射城楼叛将手贯于梁。',
    bonusEffect: [
      { type: 'crit_rate', value: 10, description: '【神射】远程攻击暴击率+10%' },
    ],
  },
  7: {
    // 诸葛连弩
    officerId: 4, // 诸葛亮
    description: '武侯损益连弩，以铁为矢，矢长八寸，一弩十矢俱发。',
    bonusStats: { intelligence: 2 },
    bonusEffect: [
      { type: 'armor_pierce', value: 20, description: '【武侯巧机】破甲威力提升' },
    ],
  },
  9: {
    // 软猬甲
    officerId: 125, // 郭嘉
    description: '奉孝体弱多谋，奇甲御身防箭。',
    bonusEffect: [
      { type: 'defense', value: 10, description: '【谋主护身】伤害减免+10' },
    ],
  },
  10: {
    // 赤兔马
    officerId: 6, // 关羽
    description: '人中吕布，马中赤兔。后归云长，千里单骑如履平地。',
    bonusEffect: [
      { type: 'mobility', value: 1, description: '【千里神行】机动力额外+1' },
    ],
  },
  11: {
    // 的卢
    officerId: 2, // 刘备
    description: '马作的卢飞快，弓如霹雳弦惊。檀溪三丈一跃脱险。',
    bonusEffect: [
      { type: 'escape', value: 30, description: '【跃马檀溪】脱逃与免俘几率大幅提升' },
    ],
  },
  12: {
    // 绝影
    officerId: 1, // 曹操
    description: '顾影不及，绝尘而驰。宛城救主名骏。',
    bonusEffect: [
      { type: 'mobility', value: 1, description: '【绝尘】战场机动力+1' },
    ],
  },
  13: {
    // 孙子兵法
    officerId: 4, // 诸葛亮
    description: '孙武韬略，经天纬地。孔明揣摩通透，甲兵百万藏于胸中。',
    bonusStats: { intelligence: 3 },
    bonusEffect: [
      { type: 'intel_boost', value: 15, description: '【神算】战役谋略智谋上限强化' },
    ],
  },
  14: {
    // 孟德新书
    officerId: 1, // 曹操
    description: '曹公博采众家兵法，撮其要领，指归立见。',
    bonusStats: { leadership: 2 },
    bonusEffect: [
      { type: 'tactic_power', value: 15, description: '【注疏】战法与军令威力提升' },
    ],
  },
  15: {
    // 传国玉玺
    officerId: 358, // 刘协 (汉献帝)
    description: '受命于天，既寿永昌。汉家天子神器。',
    bonusStats: { charisma: 5 },
    bonusEffect: [
      { type: 'legitimacy', value: 50, description: '【天命所归】正统大义人心凝聚' },
    ],
  },
  18: {
    // 兵符
    officerId: 1, // 曹操
    description: '铜虎剖符，军令所出，三军从令如山。',
    bonusEffect: [
      { type: 'authority', value: 5, description: '【军令严明】行军士气衰减减免' },
    ],
  },
  21: {
    // 七星宝刀
    officerId: 1, // 曹操
    description: '司徒王允之宝，孟德借以谋刺董卓。',
    bonusEffect: [
      { type: 'crit_rate', value: 8, description: '【刺贼】暴击率+8%' },
    ],
  },
  22: {
    // 古锭刀
    officerId: 114, // 孙坚
    description: '乌程侯孙文台所佩宝刀，江东猛虎摧锋破敌。',
    bonusStats: { war: 2 },
    bonusEffect: [
      { type: 'crit_rate', value: 10, description: '【江东猛虎】近战暴击率+10%' },
    ],
  },
  23: {
    // 双铁戟
    officerId: 13, // 典韦
    description: '铁戟双提八十斤，威风凛凛镇乾坤。古之恶来当关万夫莫开。',
    bonusStats: { war: 2 },
    bonusEffect: [
      { type: 'counter_rate', value: 20, description: '【恶来】反击概率+20%' },
    ],
  },
  24: {
    // 三尖两刃刀
    officerId: 291, // 纪灵
    description: '重五十斤，山东纪灵所用利刃。',
    bonusEffect: [
      { type: 'charge_damage', value: 12, description: '【大将之威】突击伤害+12%' },
    ],
  },
  26: {
    // 铁蒺藜骨朵
    officerId: 716, // 沙摩柯
    description: '五溪蛮王沙摩柯所使，首缀铁刺，势大力沉。',
    bonusEffect: [
      { type: 'duel_boost', value: 15, description: '【蛮王】单挑杀伤+15%' },
    ],
  },
  38: {
    // 铁鞭
    officerId: 144, // 黄盖
    description: '黄公覆历事三世，摧坚斩将，善用铁鞭。',
    bonusEffect: [
      { type: 'defense', value: 8, description: '【苦肉】防御抗击+8' },
    ],
  },
  46: {
    // 龙胆亮银枪
    officerId: 10, // 赵云
    description: '常山赵子龙亮银枪如灵蛇吐信，长坂坡百万军中如入无人之境。',
    bonusStats: { war: 3 },
    bonusEffect: [
      { type: 'counter_rate', value: 20, description: '【龙胆】全向反击概率+20%' },
    ],
  },
  47: {
    // 虎头湛金枪
    officerId: 131, // 马超
    description: '锦马超长枪吞金，西凉铁骑横扫关陇。',
    bonusStats: { war: 2 },
    bonusEffect: [
      { type: 'charge_damage', value: 25, description: '【西凉威烈】骑兵突击伤害+25%' },
    ],
  },
  48: {
    // 铁脊蛇矛
    officerId: 143, // 程普
    description: '程德谋从孙坚起兵，持铁脊长矛屡建奇功。',
    bonusEffect: [
      { type: 'defense', value: 8, description: '【江表老将】驻守减伤' },
    ],
  },
  51: {
    // 铁胎弓
    officerId: 14, // 黄忠
    description: '汉升开两石硬弓，定军山下刀斩夏侯渊。',
    bonusStats: { war: 2 },
    bonusEffect: [
      { type: 'crit_rate', value: 15, description: '【老当益壮】远程暴击率+15%' },
    ],
  },
  56: {
    // 短戟
    officerId: 13, // 典韦
    description: '贼去五步叫我！典韦十余小戟飞掷，敌军应声坠马。',
    bonusEffect: [
      { type: 'crit_damage', value: 30, description: '【掷戟】暗器暴击伤害+30%' },
    ],
  },
  57: {
    // 飞刀
    officerId: 298, // 祝融
    description: '祝融夫人百步飞刀，背插五口，飞掷极准。',
    bonusEffect: [
      { type: 'range', value: 1, description: '【飞刀绝技】射程额外+1' },
    ],
  },
  67: {
    // 兽面吞头连环铠
    officerId: 5, // 吕布
    description: '金冠玉带，铠甲连环。温侯披挂，三军辟易。',
    bonusStats: { leadership: 2 },
    bonusEffect: [
      { type: 'defense', value: 15, description: '【连环宝铠】部队防御+15' },
    ],
  },
  68: {
    // 白银铠
    officerId: 10, // 赵云
    description: '白马白袍银叶铠，当阳道上护幼主。',
    bonusEffect: [
      { type: 'defense', value: 10, description: '【银甲护身】致命伤免除减免' },
    ],
  },
  73: {
    // 束发金冠（原貔貅甲调整为三叉紫金冠）
    officerId: 5, // 吕布
    description: '三叉束发紫金冠，雉尾双翎。',
    bonusStats: { war: 2 },
    bonusEffect: [
      { type: 'authority', value: 10, description: '【神威】威慑震慑提升' },
    ],
  },
  75: {
    // 红锦战袍
    officerId: 131, // 马超
    description: '锦马超白袍红锦，西凉雄杰气吞万里。',
    bonusEffect: [
      { type: 'morale', value: 10, description: '【锦马超】出征全军士气+10' },
    ],
  },
  80: {
    // 爪黄飞电
    officerId: 1, // 曹操
    description: '蹄裹黄金，通体雪白。许田围猎曹公所乘名驹。',
    bonusStats: { charisma: 2 },
    bonusEffect: [
      { type: 'authority', value: 8, description: '【帝乡乘舆】全军仪仗威肃' },
    ],
  },
  105: {
    // 太平要术
    officerId: 183, // 张角
    description: '大贤良师受天书三卷，呼风唤雨，救济世人。',
    bonusStats: { intelligence: 3 },
    bonusEffect: [
      { type: 'tactic_power', value: 20, description: '【黄天大吉】妖术与火计伤害+20%' },
    ],
  },
  106: {
    // 青囊书
    officerId: 186, // 华佗
    description: '华元化五禽之戏、麻沸之散，天下第一医道圣典。',
    bonusStats: { politics: 2 },
    bonusEffect: [
      { type: 'heal', value: 20, description: '【神医妙手】伤兵恢复效率大幅提升' },
    ],
  },
  109: {
    // 西蜀地形图
    officerId: 127, // 庞统
    description: '张松密图，详记川陕险阻。凤雏得之建功定蜀。',
    bonusStats: { intelligence: 2 },
    bonusEffect: [
      { type: 'tactic_power', value: 15, description: '【蜀道洞明】山地险隘行军免受惩罚' },
    ],
  },
  115: {
    // 玉带诏
    officerId: 2, // 刘备
    description: '天子咬指出血，书密诏于衣带之中，授皇叔匡扶汉室。',
    bonusStats: { charisma: 3 },
    bonusEffect: [
      { type: 'legitimacy', value: 30, description: '【奉诏讨贼】正统大义人心归附' },
    ],
  },
  117: {
    // 假节钺
    officerId: 6, // 关羽
    description: '先主授羽假节钺，都督荆州九郡诸军事，威震华夏。',
    bonusStats: { leadership: 3 },
    bonusEffect: [
      { type: 'authority', value: 15, description: '【专征伐之权】出征前线部队士气恒定坚韧' },
    ],
  },
  118: {
    // 大将军印
    officerId: 113, // 袁绍
    description: '关东联军推本初为车骑将军、领大将军印，四世三公门多故吏。',
    bonusStats: { leadership: 2 },
    bonusEffect: [
      { type: 'authority', value: 20, description: '【四世三公】召集名士门阀支持' },
    ],
  },
  119: {
    // 相国印
    officerId: 112, // 董卓
    description: '董仲颖秉相国之印，独断朝纲，夜宿龙床。',
    bonusStats: { war: 2 },
    bonusEffect: [
      { type: 'intimidate', value: 20, description: '【暴威】对邻近敌势力造成士气压制' },
    ],
  },
  123: {
    // 锦袍金带
    officerId: 1, // 曹操
    description: '铜雀台下百步穿杨，曹公亲赐西川锦袍。',
    bonusEffect: [
      { type: 'authority', value: 8, description: '【魏武荣光】麾下将领忠诚衰减减缓' },
    ],
  },
  126: {
    // 纶巾（原指南车）
    officerId: 4, // 诸葛亮
    description: '羽扇纶巾，谈笑间樯橹灰飞烟灭。武侯名士风仪。',
    bonusStats: { intelligence: 2 },
    bonusEffect: [
      { type: 'intel_boost', value: 10, description: '【谈笑用兵】计策成功率提升' },
    ],
  },
  127: {
    // 木牛流马
    officerId: 4, // 诸葛亮
    description: '人不大劳，牛不饮食，山路转运不竭。',
    bonusEffect: [
      { type: 'logistics', value: 20, description: '【转运不竭】行军粮草消耗降低20%' },
    ],
  },
  128: {
    // 赤罽帻（原火油）
    officerId: 114, // 孙坚
    description: '孙文台被围，命祖茂戴其赤罽帻引敌。忠烈名冠。',
    bonusEffect: [
      { type: 'defense', value: 10, description: '【江东战魂】濒死绝地防御提升' },
    ],
  },
  129: {
    // 进贤冠（原兵法竹简）
    officerId: 8, // 荀彧
    description: '汉制进贤之冠，王佐之才荀令君所戴。',
    bonusStats: { politics: 2 },
    bonusEffect: [
      { type: 'authority', value: 10, description: '【王佐之风】朝廷人脉机会增加' },
    ],
  },
};

/**
 * 品类调整与 8 槽位映射
 */
const CATEGORY_OVERRIDES = {
  // 战袍 (robe)
  75: { category: 'robe', name: '红锦战袍', description: '织金红锦战袍，锦马超征战之所服。' },
  76: { category: 'robe', name: '赤锦战袍', description: '赤锦为面，轻便而耀武。' },
  120: { category: 'robe', name: '金印紫绶', description: '金印紫绶，三公九卿之仪礼袍服与绶带。' },
  123: { category: 'robe', name: '锦袍金带', description: '铜雀台夺袍之彩，君前耀武之战袍金带。' },
  133: { category: 'robe', name: '蜀锦战袍', description: '成都巧手织锦战袍，刀枪不濡。' },

  // 兜鍪/冠 (headwear)
  70: { category: 'headwear', name: '熟铜盔', description: '熟铜打造之兜鍪战盔，将官常备。' },
  73: { category: 'headwear', name: '三叉紫金冠', description: '束发紫金冠，双插雉尾，飞将吕奉先之盔冠。' },
  74: { category: 'headwear', name: '狻猊盔', description: '狻猊首兽纹铁盔，威慑三军。' },
  79: { category: 'headwear', name: '铁兜鍪', description: '精铁打制战兜鍪，顶置铁翎。' },
  126: { category: 'headwear', name: '纶巾', description: '羽扇纶巾，名士雅儒之巾服。' },
  128: { category: 'headwear', name: '赤罽帻', description: '孙坚梁县所戴红罽帻，祖茂戴之引敌脱险。' },
  129: { category: 'headwear', name: '进贤冠', description: '汉代名臣进贤冠，王佐之士所服。' },
  131: { category: 'headwear', name: '鹖冠', description: '武官勇冠，取鹖鸟勇毅不却之意。' },
  132: { category: 'headwear', name: '远游冠', description: '汉家王侯乘舆之远游冠。' },

  // 配饰/印信 (accessory)
  15: { category: 'accessory', name: '传国玉玺', description: '受命于天，既寿永昌。汉家天子正统之印信。' },
  16: { category: 'accessory', name: '玉玺残片', description: '传国玉玺黄金镶玉之遗角。' },
  18: { category: 'accessory', name: '兵符', description: '铜虎剖符，调遣大军之信物。' },
  72: { category: 'accessory', name: '护心镜', description: '当胸精钢宝镜，御箭折刃之奇物。' },
  115: { category: 'accessory', name: '玉带诏', description: '血书衣带之诏，誓诛国贼之血誓。' },
  116: { category: 'accessory', name: '尚方宝剑', description: '先斩后奏之御赐权柄，佩之威震百官。' },
  117: { category: 'accessory', name: '假节钺', description: '专征伐之金钺斧，都督军务之极权。' },
  118: { category: 'accessory', name: '大将军印', description: '武臣之极，统领天下诸军。' },
  119: { category: 'accessory', name: '相国印', description: '相国金印，百官万民之首。' },
  121: { category: 'accessory', name: '丹书铁券', description: '朱砂书券，铁函永固，免死誓信。' },
  122: { category: 'accessory', name: '旌节', description: '使持节旄，代天子出巡传令。' },
  124: { category: 'accessory', name: '隋侯珠', description: '夜光神珠，烛照百步之珍奇。' },
  125: { category: 'accessory', name: '夜光璧', description: '暗夜生辉之良玉名璧。' },
  127: { category: 'accessory', name: '木牛流马', description: '诸葛亮所制运粮木牛流马，不饮不食行山险。' },
  130: { category: 'accessory', name: '玉璧', description: '礼天之六器，聘问重器。' },
  134: { category: 'accessory', name: '铜虎符', description: '汉代发兵铜虎符，左右相合方可动军。' },
  135: { category: 'accessory', name: '越窑青瓷壶', description: '越窑秘色青瓷执壶，千峰翠色。' },
  136: { category: 'accessory', name: '鎏金铜马', description: '宫廷秘藏鎏金铜铸名马。' },
};

let bondCount = 0;
let categoryChangedCount = 0;

const updated = items.map((it) => {
  const item = { ...it };
  // 1. 检查是否有品类覆盖
  if (CATEGORY_OVERRIDES[item.id]) {
    const o = CATEGORY_OVERRIDES[item.id];
    item.category = o.category;
    if (o.name) item.name = o.name;
    if (o.description) item.description = o.description;
    categoryChangedCount++;
  }
  // 2. 检查是否有 Bond 配置
  if (BONDS[item.id]) {
    item.bond = BONDS[item.id];
    bondCount++;
  }
  return item;
});

fs.writeFileSync(itemsPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');

console.log(`Successfully updated items.json:`);
console.log(`- Total items: ${updated.length} (expected 165)`);
console.log(`- Category reclassifications: ${categoryChangedCount}`);
console.log(`- Bond assignments: ${bondCount}`);
