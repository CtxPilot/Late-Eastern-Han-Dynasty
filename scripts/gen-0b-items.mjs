// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 0-B 数据扩容 P0B-10：items.json 20 → 165 宝物（新增 id 21~165，Session 426）。
 *
 * 规则（docs/08 §四 为真源）：
 * - 新增条目一律不带 `initial` 采集途径：开局宝配（applyInitialItems）与 turn-golden
 *   金样指纹不能被扩容扰动；名刀名马走 search/shop/event/loot/craft/inherit。
 * - baseEffect 复用运行时已消费的词汇（defense/crit_rate/duel_boost/charge_damage/
 *   vs_cavalry/range/armor_pierce/authority/mobility）+ 少量风味类型（引擎未知类型
 *   按无效果处理，schema 为 z.string() 合法）。
 * - equipRequirement 键名对齐 shared/items.ts：minWar/minLeadership/minIntelligence/
 *   minPolitics/minCharisma。
 * - 与 0-A 20 条不同处：商店货与消耗品走 common/rare 为主，shopPrice 按品质 50~2500。
 *
 * 运行：`node scripts/gen-0b-items.mjs`（幂等：重复运行覆盖生成段并重排全表）。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'server', 'src', 'data', 'items.json');

const WP = 'weapon_primary';
const WS = 'weapon_secondary';
const AR = 'armor';
const MO = 'mount';
const BK = 'book';
const SP = 'special';
const CO = 'consumable';

/** 145 条新增宝物（id 21~165）。字段顺序与 0-A 现有文件一致。 */
const NEW_ITEMS = [
  // ── 主武器 21~49 ────────────────────────────────────────────────
  { id: 21, name: '七星宝刀', category: WP, quality: 'legendary', primaryWeaponSubType: 'sword', baseStats: { war: 6, intelligence: 4 }, baseEffect: [{ type: 'duel_boost', value: 20, description: '单挑伤害+20%' }], equipRequirement: { minWar: 60 }, acquisition: ['event', 'search'], description: '王允所铸宝刀，曹操曾持之谋刺董卓。' },
  { id: 22, name: '古锭刀', category: WP, quality: 'epic', primaryWeaponSubType: 'blade', baseStats: { war: 7 }, baseEffect: [{ type: 'crit_rate', value: 4, description: '暴击+4%' }], equipRequirement: { minWar: 65 }, acquisition: ['event', 'loot'], description: '孙坚所持宝刀，赤如朱砂，寒光逼人。' },
  { id: 23, name: '双铁戟', category: WP, quality: 'epic', primaryWeaponSubType: 'halberd', baseStats: { war: 8 }, baseEffect: [{ type: 'vs_cavalry', value: 8 }], equipRequirement: { minWar: 75 }, acquisition: ['search', 'loot'], description: '典韦所持短戟八十斤，马上步下皆可。' },
  { id: 24, name: '三尖两刃刀', category: WP, quality: 'rare', primaryWeaponSubType: 'blade', baseStats: { war: 6 }, baseEffect: [], equipRequirement: { minWar: 60 }, acquisition: ['shop', 'loot'], shopPrice: 2200, description: '纪灵所用大刀，五十斤开外。' },
  { id: 25, name: '开山大斧', category: WP, quality: 'rare', primaryWeaponSubType: 'blunt', baseStats: { war: 7, leadership: 1 }, baseEffect: [{ type: 'charge_damage', value: 8 }], equipRequirement: { minWar: 65 }, acquisition: ['shop', 'loot'], shopPrice: 2000, description: '斧重势沉，劈山开路之器。' },
  { id: 26, name: '铁蒺藜骨朵', category: WP, quality: 'rare', primaryWeaponSubType: 'blunt', baseStats: { war: 6 }, baseEffect: [], equipRequirement: { minWar: 60 }, acquisition: ['loot'], description: '南蛮沙摩柯所使锤击兵器，首缀铁刺。' },
  { id: 27, name: '龙鳞刀', category: WP, quality: 'epic', primaryWeaponSubType: 'blade', baseStats: { war: 6, leadership: 2 }, baseEffect: [{ type: 'crit_rate', value: 3 }], equipRequirement: { minWar: 70 }, acquisition: ['search', 'loot'], description: '百炼钢刀，纹如龙鳞。' },
  { id: 28, name: '环首刀', category: WP, quality: 'common', primaryWeaponSubType: 'blade', baseStats: { war: 3 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 350, description: '汉军制式长刀，直刃厚背。' },
  { id: 29, name: '熟铜刀', category: WP, quality: 'common', primaryWeaponSubType: 'blade', baseStats: { war: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop'], shopPrice: 250, description: '铜质战刀，耐用而不锋。' },
  { id: 30, name: '松纹剑', category: WP, quality: 'rare', primaryWeaponSubType: 'sword', baseStats: { war: 4, intelligence: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 1500, description: '剑身现松纹，良匠所锻。' },
  { id: 31, name: '龙泉剑', category: WP, quality: 'epic', primaryWeaponSubType: 'sword', baseStats: { war: 6 }, baseEffect: [{ type: 'duel_boost', value: 8 }], equipRequirement: { minWar: 60 }, acquisition: ['search', 'loot'], description: '欧冶子所铸名剑，龙渊避讳改称龙泉。' },
  { id: 32, name: '太阿剑', category: WP, quality: 'legendary', primaryWeaponSubType: 'sword', baseStats: { war: 7, leadership: 3 }, baseEffect: [{ type: 'authority', value: 5 }, { type: 'duel_boost', value: 10 }], equipRequirement: { minLeadership: 65 }, acquisition: ['event', 'search'], description: '威道之剑，威则太阿倒持亦可为柄。' },
  { id: 33, name: '湛卢剑', category: WP, quality: 'legendary', primaryWeaponSubType: 'sword', baseStats: { war: 5, charisma: 4 }, baseEffect: [{ type: 'duel_boost', value: 12 }], equipRequirement: { minCharisma: 60 }, acquisition: ['event', 'search'], description: '仁者之剑，君有道则剑在侧。' },
  { id: 34, name: '鱼肠剑', category: WP, quality: 'rare', primaryWeaponSubType: 'sword', baseStats: { war: 3 }, baseEffect: [{ type: 'duel_boost', value: 15, description: '短剑匿锋，先手+15%' }], equipRequirement: {}, acquisition: ['search'], description: '专诸炙鱼所藏短剑，勇绝之心。' },
  { id: 35, name: '巨阙剑', category: WP, quality: 'epic', primaryWeaponSubType: 'sword', baseStats: { war: 7 }, baseEffect: [], equipRequirement: { minWar: 65 }, acquisition: ['search', 'loot'], description: '钝而厚重之名剑，阙穿铜锡。' },
  { id: 36, name: '干将剑', category: WP, quality: 'epic', primaryWeaponSubType: 'sword', baseStats: { war: 6, leadership: 2 }, baseEffect: [], equipRequirement: { minWar: 65 }, acquisition: ['search'], description: '干将所铸雄剑，金铁乃濡。' },
  { id: 37, name: '莫邪剑', category: WP, quality: 'epic', primaryWeaponSubType: 'sword', baseStats: { war: 5, intelligence: 3 }, baseEffect: [], equipRequirement: { minIntelligence: 60 }, acquisition: ['search'], description: '莫邪所铸雌剑，断发剪爪投炉而成。' },
  { id: 38, name: '铁鞭', category: WP, quality: 'rare', primaryWeaponSubType: 'blunt', baseStats: { war: 5 }, baseEffect: [{ type: 'vs_cavalry', value: 5 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 1600, description: '黄盖惯用兵刃，击甲破阵。' },
  { id: 39, name: '钢鞭', category: WP, quality: 'rare', primaryWeaponSubType: 'blunt', baseStats: { war: 5 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 1600, description: '节鞭类兵器，可击重甲。' },
  { id: 40, name: '流星锤', category: WP, quality: 'common', primaryWeaponSubType: 'blunt', baseStats: { war: 3 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop'], shopPrice: 400, description: '索系铁锤，甩击之器。' },
  { id: 41, name: '铜锤', category: WP, quality: 'common', primaryWeaponSubType: 'blunt', baseStats: { war: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop'], shopPrice: 300, description: '短柄铜锤，市井常见。' },
  { id: 42, name: '长戟', category: WP, quality: 'common', primaryWeaponSubType: 'halberd', baseStats: { war: 3 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 300, description: '汉代长戟，步骑通用。' },
  { id: 43, name: '卜字铁戟', category: WP, quality: 'common', primaryWeaponSubType: 'halberd', baseStats: { war: 3 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 320, description: '戟头如卜字，钩啄并用。' },
  { id: 44, name: '马槊', category: WP, quality: 'rare', primaryWeaponSubType: 'spear', baseStats: { war: 5 }, baseEffect: [{ type: 'charge_damage', value: 10 }], equipRequirement: { minWar: 60 }, acquisition: ['shop', 'loot'], shopPrice: 2400, description: '骑兵冲阵长槊，破甲之利。' },
  { id: 45, name: '浑铁点钢枪', category: WP, quality: 'rare', primaryWeaponSubType: 'spear', baseStats: { war: 5 }, baseEffect: [], equipRequirement: { minWar: 55 }, acquisition: ['shop', 'loot'], shopPrice: 1800, description: '浑铁枪杆，点钢枪头。' },
  { id: 46, name: '龙胆亮银枪', category: WP, quality: 'legendary', primaryWeaponSubType: 'spear', baseStats: { war: 9 }, baseEffect: [{ type: 'charge_damage', value: 12 }, { type: 'crit_rate', value: 5 }], equipRequirement: { minWar: 80 }, acquisition: ['event', 'search'], description: '亮银枪身寒光似胆，将军七进七出之所持。' },
  { id: 47, name: '虎头湛金枪', category: WP, quality: 'epic', primaryWeaponSubType: 'spear', baseStats: { war: 8 }, baseEffect: [{ type: 'charge_damage', value: 10 }], equipRequirement: { minWar: 75 }, acquisition: ['event', 'loot'], description: '锦马超所用长枪，虎头吞金。' },
  { id: 48, name: '铁脊蛇矛', category: WP, quality: 'common', primaryWeaponSubType: 'spear', baseStats: { war: 3 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 380, description: '程普所用蛇形长矛。' },
  { id: 49, name: '长刀', category: WP, quality: 'common', primaryWeaponSubType: 'blade', baseStats: { war: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop'], shopPrice: 260, description: '寻常长刀，士卒用兵。' },

  // ── 副武器 50~62 ────────────────────────────────────────────────
  { id: 50, name: '李广弓', category: WS, quality: 'legendary', secondaryWeaponSubType: 'bow', baseStats: { war: 6 }, baseEffect: [{ type: 'range', value: 2 }, { type: 'crit_rate', value: 5 }], equipRequirement: { minWar: 70 }, acquisition: ['event', 'search'], description: '飞将军遗弓，没石饮羽之力。' },
  { id: 51, name: '铁胎弓', category: WS, quality: 'epic', secondaryWeaponSubType: 'bow', baseStats: { war: 5 }, baseEffect: [{ type: 'range', value: 1 }], equipRequirement: { minWar: 60 }, acquisition: ['search', 'loot'], description: '弓臂衬铁，弦劲而射远。' },
  { id: 52, name: '大黄弓', category: WS, quality: 'rare', secondaryWeaponSubType: 'bow', baseStats: { war: 4 }, baseEffect: [{ type: 'range', value: 1 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 1600, description: '汉边郡大黄参连弩之名所化，射远利器。' },
  { id: 53, name: '猿臂弓', category: WS, quality: 'rare', secondaryWeaponSubType: 'bow', baseStats: { war: 4 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 1400, description: '弓形如猿臂，轻巧便于驰射。' },
  { id: 54, name: '连环弩', category: WS, quality: 'rare', secondaryWeaponSubType: 'crossbow', baseStats: { war: 4 }, baseEffect: [{ type: 'armor_pierce', value: 8 }], equipRequirement: {}, acquisition: ['shop', 'craft'], shopPrice: 2200, description: '可连发数矢之弩，工官所制。' },
  { id: 55, name: '毒箭', category: WS, quality: 'common', secondaryWeaponSubType: 'bow', baseStats: { war: 2 }, baseEffect: [{ type: 'poison', value: 10, description: '命中附加毒创' }], equipRequirement: {}, acquisition: ['shop'], shopPrice: 120, description: '淬毒箭矢，见血封创。' },
  { id: 56, name: '短戟', category: WS, quality: 'common', secondaryWeaponSubType: 'throwing', baseStats: { war: 3 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 260, description: '手掷短戟，典韦飞戟退敌之器。' },
  { id: 57, name: '飞刀', category: WS, quality: 'common', secondaryWeaponSubType: 'throwing', baseStats: { war: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop'], shopPrice: 150, description: '祝融夫人惯使飞刀，百步伤人。' },
  { id: 58, name: '袖箭', category: WS, quality: 'common', secondaryWeaponSubType: 'throwing', baseStats: { war: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop'], shopPrice: 140, description: '藏于袖中机括小箭。' },
  { id: 59, name: '标枪', category: WS, quality: 'common', secondaryWeaponSubType: 'throwing', baseStats: { war: 3 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop'], shopPrice: 180, description: '投掷长枪，南军惯用。' },
  { id: 60, name: '飞锤', category: WS, quality: 'common', secondaryWeaponSubType: 'throwing', baseStats: { war: 3 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop'], shopPrice: 200, description: '系索飞锤，掠阵用。' },
  { id: 61, name: '竹弓', category: WS, quality: 'common', secondaryWeaponSubType: 'bow', baseStats: { war: 1 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop'], shopPrice: 90, description: '竹制猎弓，力弱易得。' },
  { id: 62, name: '猎弓', category: WS, quality: 'common', secondaryWeaponSubType: 'bow', baseStats: { war: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop'], shopPrice: 160, description: '围猎常用之弓。' },

  // ── 盔甲 63~79 ─────────────────────────────────────────────────
  { id: 63, name: '明光铠', category: AR, quality: 'epic', armorSubType: 'metal', baseStats: { leadership: 3 }, baseEffect: [{ type: 'defense', value: 14 }], equipRequirement: { minLeadership: 60 }, acquisition: ['search', 'loot'], description: '胸背明光如镜，汉末渐兴之名甲。' },
  { id: 64, name: '两当铠', category: AR, quality: 'rare', armorSubType: 'metal', baseStats: { leadership: 2 }, baseEffect: [{ type: 'defense', value: 10 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 2000, description: '前后两片当胸当背，便于驰射。' },
  { id: 65, name: '玄铁重甲', category: AR, quality: 'epic', armorSubType: 'metal', baseStats: { leadership: 3, war: 1 }, baseEffect: [{ type: 'defense', value: 16 }], equipRequirement: { minLeadership: 65 }, acquisition: ['search', 'loot'], description: '玄铁锻造，重逾常甲。' },
  { id: 66, name: '锁子甲', category: AR, quality: 'rare', armorSubType: 'metal', baseStats: {}, baseEffect: [{ type: 'defense', value: 9 }, { type: 'arrow_resist', value: 10 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 2400, description: '西凉传入环环相扣之甲。' },
  { id: 67, name: '兽面吞头连环铠', category: AR, quality: 'legendary', armorSubType: 'metal', baseStats: { leadership: 4, war: 2 }, baseEffect: [{ type: 'defense', value: 18 }], equipRequirement: { minLeadership: 70 }, acquisition: ['event', 'loot'], description: '吕布所披宝铠，兽面吞头，连环锁扣。' },
  { id: 68, name: '白银铠', category: AR, quality: 'epic', armorSubType: 'metal', baseStats: { leadership: 2, charisma: 2 }, baseEffect: [{ type: 'defense', value: 13 }], equipRequirement: { minLeadership: 55 }, acquisition: ['search', 'loot'], description: '白银甲叶映雪，白袍将军之所服。' },
  { id: 69, name: '龙鳞甲', category: AR, quality: 'legendary', armorSubType: 'metal', baseStats: { leadership: 5 }, baseEffect: [{ type: 'defense', value: 17 }, { type: 'arrow_resist', value: 15 }], equipRequirement: { minLeadership: 75 }, acquisition: ['event', 'search'], description: '甲叶层叠如龙鳞，御箭御锋。' },
  { id: 70, name: '熟铜铠', category: AR, quality: 'common', armorSubType: 'metal', baseStats: {}, baseEffect: [{ type: 'defense', value: 5 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 600, description: '熟铜甲片，寻常军校之用。' },
  { id: 71, name: '乌金铠', category: AR, quality: 'rare', armorSubType: 'metal', baseStats: { leadership: 2 }, baseEffect: [{ type: 'defense', value: 11 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 2200, description: '乌金色泽，沉而不炫。' },
  { id: 72, name: '护心镜', category: AR, quality: 'rare', armorSubType: 'metal', baseStats: {}, baseEffect: [{ type: 'defense', value: 6 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 1200, description: '当胸一镜，可挡要害一击。' },
  { id: 73, name: '貔貅甲', category: AR, quality: 'rare', armorSubType: 'specialArmor', baseStats: { war: 2 }, baseEffect: [{ type: 'defense', value: 9 }], equipRequirement: {}, acquisition: ['search'], description: '兽纹皮甲，取貔貅勇猛之意。' },
  { id: 74, name: '狻猊铠', category: AR, quality: 'epic', armorSubType: 'specialArmor', baseStats: { leadership: 2, war: 2 }, baseEffect: [{ type: 'defense', value: 12 }], equipRequirement: { minLeadership: 60 }, acquisition: ['search', 'loot'], description: '狻猊首缀于肩，威慑三军。' },
  { id: 75, name: '红锦战袍', category: AR, quality: 'rare', armorSubType: 'cloth', baseStats: { charisma: 3 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'event'], description: '红锦织金战袍，铜雀台射柳之赏。' },
  { id: 76, name: '赤锦战袍', category: AR, quality: 'rare', armorSubType: 'cloth', baseStats: { charisma: 2, war: 1 }, baseEffect: [], equipRequirement: {}, acquisition: ['search'], description: '赤锦为面，轻便而耀武。' },
  { id: 77, name: '猊皮甲', category: AR, quality: 'rare', armorSubType: 'leather', baseStats: {}, baseEffect: [{ type: 'defense', value: 7 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 1400, description: '猛兽皮革所制，轻韧兼备。' },
  { id: 78, name: '双层牛皮甲', category: AR, quality: 'common', armorSubType: 'leather', baseStats: {}, baseEffect: [{ type: 'defense', value: 4 }], equipRequirement: {}, acquisition: ['shop'], shopPrice: 280, description: '双层生牛皮，士卒常用。' },
  { id: 79, name: '玄甲', category: AR, quality: 'common', armorSubType: 'metal', baseStats: {}, baseEffect: [{ type: 'defense', value: 5 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 520, description: '玄色铁甲，军中制式。' },

  // ── 坐骑 80~91 ─────────────────────────────────────────────────
  { id: 80, name: '爪黄飞电', category: MO, quality: 'epic', baseStats: { charisma: 3 }, baseEffect: [{ type: 'mobility', value: 2, description: '机动力+2' }], equipRequirement: {}, acquisition: ['event', 'search'], description: '曹操所乘名马，通体雪白四蹄金黄。' },
  { id: 81, name: '大宛良马', category: MO, quality: 'rare', baseStats: { war: 1 }, baseEffect: [{ type: 'mobility', value: 1 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 2000, description: '西域大宛所产良驹。' },
  { id: 82, name: '汗血宝马', category: MO, quality: 'epic', baseStats: { war: 2 }, baseEffect: [{ type: 'mobility', value: 2 }], equipRequirement: {}, acquisition: ['search', 'event'], description: '汗出如赭血，日行千里之种。' },
  { id: 83, name: '凉州铁骑马', category: MO, quality: 'rare', baseStats: { war: 2 }, baseEffect: [{ type: 'mobility', value: 1 }, { type: 'charge_damage', value: 5 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 1800, description: '凉州大马，横行朔野。' },
  { id: 84, name: '幽州突骑马', category: MO, quality: 'rare', baseStats: { war: 2 }, baseEffect: [{ type: 'mobility', value: 1 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 1700, description: '幽州突骑所乘，耐苦善驰。' },
  { id: 85, name: '塞外名驹', category: MO, quality: 'rare', baseStats: { war: 1, charisma: 1 }, baseEffect: [{ type: 'mobility', value: 1 }], equipRequirement: {}, acquisition: ['event', 'loot'], description: '胡商所献塞外名种。' },
  { id: 86, name: '河曲马', category: MO, quality: 'common', baseStats: {}, baseEffect: [{ type: 'mobility', value: 1 }], equipRequirement: {}, acquisition: ['shop'], shopPrice: 900, description: '河曲产马，性稳善走。' },
  { id: 87, name: '蜀中骏马', category: MO, quality: 'common', baseStats: {}, baseEffect: [{ type: 'mobility', value: 1 }], equipRequirement: {}, acquisition: ['shop'], shopPrice: 850, description: '蜀地山地马，稳健耐涉。' },
  { id: 88, name: '铁蹄马', category: MO, quality: 'common', baseStats: { war: 1 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 700, description: '蹄坚如铁，不惧石路。' },
  { id: 89, name: '枣红马', category: MO, quality: 'common', baseStats: {}, baseEffect: [], equipRequirement: {}, acquisition: ['shop'], shopPrice: 600, description: '毛色枣红，寻常军马。' },
  { id: 90, name: '青骢马', category: MO, quality: 'common', baseStats: { charisma: 1 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop'], shopPrice: 650, description: '青白杂毛，观之可喜。' },
  { id: 91, name: '桃花骢', category: MO, quality: 'rare', baseStats: { charisma: 2 }, baseEffect: [{ type: 'mobility', value: 1 }], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 1500, description: '毛色斑驳如落英，贵家所爱。' },

  // ── 兵书典籍 92~114 ────────────────────────────────────────────
  { id: 92, name: '六韬', category: BK, quality: 'epic', baseStats: { intelligence: 5, leadership: 4 }, baseEffect: [{ type: 'tactic_power', value: 8 }], equipRequirement: { minIntelligence: 55 }, acquisition: ['search', 'event'], description: '托名太公之兵书，文韬武韬兼备。' },
  { id: 93, name: '三略', category: BK, quality: 'epic', baseStats: { leadership: 5, intelligence: 3 }, baseEffect: [], equipRequirement: { minLeadership: 55 }, acquisition: ['search', 'event'], description: '黄石公三略，张良所受。' },
  { id: 94, name: '太公阴符', category: BK, quality: 'rare', baseStats: { intelligence: 3 }, baseEffect: [], equipRequirement: {}, acquisition: ['search'], description: '阴符之谋，机变之术。' },
  { id: 95, name: '管子', category: BK, quality: 'rare', baseStats: { politics: 4, intelligence: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 1200, description: '管仲经世之学，仓廪实而知礼节。' },
  { id: 96, name: '韩非子', category: BK, quality: 'rare', baseStats: { politics: 4 }, baseEffect: [{ type: 'authority', value: 3 }], equipRequirement: {}, acquisition: ['search'], description: '刑名法术之学，君人南面之术。' },
  { id: 97, name: '淮南子', category: BK, quality: 'rare', baseStats: { intelligence: 3, politics: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['search'], description: '淮南王刘安集宾客所撰，博杂宏富。' },
  { id: 98, name: '春秋左传', category: BK, quality: 'rare', baseStats: { politics: 3, intelligence: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 1000, description: '左丘明传春秋，甲兵之事备焉。' },
  { id: 99, name: '尚书', category: BK, quality: 'common', baseStats: { politics: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 400, description: '上古政典之书。' },
  { id: 100, name: '诗经', category: BK, quality: 'common', baseStats: { charisma: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 380, description: '风雅颂三百篇。' },
  { id: 101, name: '论语', category: BK, quality: 'common', baseStats: { politics: 2, charisma: 1 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 360, description: '孔子弟子所记，修身治平之言。' },
  { id: 102, name: '孝经', category: BK, quality: 'common', baseStats: { charisma: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 320, description: '以孝治天下之经。' },
  { id: 103, name: '史记', category: BK, quality: 'epic', baseStats: { intelligence: 4, politics: 3 }, baseEffect: [], equipRequirement: { minIntelligence: 55 }, acquisition: ['search', 'event'], description: '太史公书，究天人之际通古今之变。' },
  { id: 104, name: '汉书', category: BK, quality: 'epic', baseStats: { politics: 4, intelligence: 3 }, baseEffect: [], equipRequirement: { minIntelligence: 55 }, acquisition: ['search', 'event'], description: '班固所撰前汉一朝之史。' },
  { id: 105, name: '太平要术', category: BK, quality: 'legendary', baseStats: { intelligence: 6, charisma: 3 }, baseEffect: [{ type: 'morale', value: 10, description: '所部士气+10（南华老仙授书之传说）' }], equipRequirement: { minIntelligence: 65 }, acquisition: ['event'], description: '张角所受天书，太平道之本源（传说层）。' },
  { id: 106, name: '青囊书', category: BK, quality: 'legendary', baseStats: { intelligence: 3, charisma: 3 }, baseEffect: [{ type: 'medicine', value: 30, description: '随军伤兵恢复大增' }], equipRequirement: {}, acquisition: ['event', 'search'], description: '华佗狱中所付医书，可惜焚于狱。' },
  { id: 107, name: '太平清领道', category: BK, quality: 'rare', baseStats: { intelligence: 3, charisma: 2 }, baseEffect: [{ type: 'morale', value: 5 }], equipRequirement: {}, acquisition: ['event', 'search'], description: '于吉所奉之书，以符水治病之名行世。' },
  { id: 108, name: '遁甲天书', category: BK, quality: 'epic', baseStats: { intelligence: 4 }, baseEffect: [{ type: 'illusion', value: 10, description: '奇门遁甲之惑敌术' }], equipRequirement: { minIntelligence: 60 }, acquisition: ['event', 'search'], description: '左慈所习奇门遁甲之书（传说层）。' },
  { id: 109, name: '西蜀地形图', category: BK, quality: 'epic', baseStats: { intelligence: 2, leadership: 3 }, baseEffect: [{ type: 'terrain_sight', value: 20, description: '西蜀行军地形了然于心' }], equipRequirement: {}, acquisition: ['event'], description: '张松怀中所献益州山川险要之图。' },
  { id: 110, name: '平蛮指掌图', category: BK, quality: 'rare', baseStats: { intelligence: 2, leadership: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['event', 'search'], description: '吕凯所绘南中地图，南征指掌。' },
  { id: 111, name: '周易', category: BK, quality: 'epic', baseStats: { intelligence: 4, charisma: 2 }, baseEffect: [{ type: 'divination', value: 10, description: '观象知变' }], equipRequirement: { minIntelligence: 60 }, acquisition: ['search', 'event'], description: '群经之首，卜筮观变之源。' },
  { id: 112, name: '孟子', category: BK, quality: 'common', baseStats: { politics: 2, charisma: 1 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 350, description: '仁政王道之学。' },
  { id: 113, name: '荀子', category: BK, quality: 'common', baseStats: { politics: 2, intelligence: 1 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 340, description: '礼法并重，隆礼重法之学。' },
  { id: 114, name: '老子', category: BK, quality: 'epic', baseStats: { intelligence: 4 }, baseEffect: [{ type: 'calm', value: 10, description: '致虚守静' }], equipRequirement: {}, acquisition: ['search', 'event'], description: '五千言道德之经。' },

  // ── 特殊 115~136 ───────────────────────────────────────────────
  { id: 115, name: '玉带诏', category: SP, quality: 'legendary', baseStats: { charisma: 5, politics: 3 }, baseEffect: [{ type: 'legitimacy', value: 20, description: '奉诏讨贼，大义名分' }], equipRequirement: {}, acquisition: ['event'], description: '血书衣带之诏，董承受之誓除国贼。' },
  { id: 116, name: '尚方宝剑', category: SP, quality: 'epic', baseStats: { leadership: 3 }, baseEffect: [{ type: 'authority', value: 8 }], equipRequirement: { minLeadership: 60 }, acquisition: ['event'], description: '先斩后奏之权柄。' },
  { id: 117, name: '假节钺', category: SP, quality: 'epic', baseStats: { leadership: 4 }, baseEffect: [{ type: 'authority', value: 10 }], equipRequirement: { minLeadership: 70 }, acquisition: ['event'], description: '得假节钺者，专征伐之权。' },
  { id: 118, name: '大将军印', category: SP, quality: 'epic', baseStats: { leadership: 3, politics: 2 }, baseEffect: [{ type: 'authority', value: 8 }], equipRequirement: {}, acquisition: ['event'], description: '大将军金印，武臣之极。' },
  { id: 119, name: '相国印', category: SP, quality: 'epic', baseStats: { politics: 4 }, baseEffect: [{ type: 'authority', value: 8 }], equipRequirement: {}, acquisition: ['event'], description: '相国之印，百僚之首。' },
  { id: 120, name: '金印紫绶', category: SP, quality: 'rare', baseStats: { politics: 2, charisma: 2 }, baseEffect: [{ type: 'authority', value: 4 }], equipRequirement: {}, acquisition: ['event', 'search'], description: '金印紫绶，三公九卿之秩。' },
  { id: 121, name: '丹书铁券', category: SP, quality: 'epic', baseStats: { politics: 2, charisma: 2 }, baseEffect: [{ type: 'legitimacy', value: 15 }], equipRequirement: {}, acquisition: ['event'], description: '朱砂书券铁为函，世袭免罪之诺。' },
  { id: 122, name: '旌节', category: SP, quality: 'rare', baseStats: { charisma: 2 }, baseEffect: [{ type: 'authority', value: 3 }], equipRequirement: {}, acquisition: ['event'], description: '使持节旄，代天子传命。' },
  { id: 123, name: '锦袍金带', category: SP, quality: 'rare', baseStats: { charisma: 3 }, baseEffect: [], equipRequirement: {}, acquisition: ['event', 'search'], description: '铜雀台夺袍之彩，君前之荣。' },
  { id: 124, name: '隋侯珠', category: SP, quality: 'epic', baseStats: { charisma: 4 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'event'], description: '侯珠照乘，光可烛夜。' },
  { id: 125, name: '夜光璧', category: SP, quality: 'rare', baseStats: { charisma: 3 }, baseEffect: [], equipRequirement: {}, acquisition: ['search'], description: '暗夜生辉之名璧。' },
  { id: 126, name: '指南车', category: SP, quality: 'epic', baseStats: { leadership: 2, intelligence: 2 }, baseEffect: [{ type: 'mobility', value: 1, description: '雾行不迷' }], equipRequirement: {}, acquisition: ['event', 'craft'], description: '司南之车，雾中不失方向。' },
  { id: 127, name: '木牛流马', category: SP, quality: 'legendary', baseStats: { politics: 5, leadership: 2 }, baseEffect: [{ type: 'logistics', value: 30, description: '粮秣转运大减损耗' }], equipRequirement: {}, acquisition: ['event', 'craft'], description: '诸葛亮所制运粮之器，人不大劳牛不饮食。' },
  { id: 128, name: '火油', category: SP, quality: 'rare', baseStats: {}, baseEffect: [{ type: 'fire_damage', value: 10, description: '火攻之资' }], equipRequirement: {}, acquisition: ['shop', 'craft'], shopPrice: 800, description: '膏油猛火，烧营焚舟之资。' },
  { id: 129, name: '兵法竹简', category: SP, quality: 'common', baseStats: { intelligence: 1 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 300, description: '先秦兵家残简。' },
  { id: 130, name: '玉璧', category: SP, quality: 'common', baseStats: { charisma: 1 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 500, description: '礼玉之璧，聘问之礼。' },
  { id: 131, name: '金杯', category: SP, quality: 'common', baseStats: { charisma: 1 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 450, description: '錾金酒杯，宴飨之器。' },
  { id: 132, name: '银壶', category: SP, quality: 'common', baseStats: { charisma: 1 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 400, description: '银制执壶。' },
  { id: 133, name: '蜀锦', category: SP, quality: 'rare', baseStats: { charisma: 2 }, baseEffect: [{ type: 'commerce', value: 10, description: '行商奇货' }], equipRequirement: {}, acquisition: ['shop', 'event'], shopPrice: 1600, description: '成都织锦，一端数金。' },
  { id: 134, name: '铜虎符', category: SP, quality: 'epic', baseStats: { leadership: 3 }, baseEffect: [{ type: 'recruit_bonus', value: 15 }], equipRequirement: {}, acquisition: ['event'], description: '剖符为信，发兵之凭。' },
  { id: 135, name: '青瓷壶', category: SP, quality: 'common', baseStats: { charisma: 1 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 320, description: '越窑青瓷，色如春水。' },
  { id: 136, name: '鎏金铜马', category: SP, quality: 'rare', baseStats: { charisma: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['search', 'event'], description: '金铜铸马，宫廷旧藏。' },

  // ── 消耗品 137~165 ─────────────────────────────────────────────
  { id: 137, name: '上等金疮药', category: CO, quality: 'rare', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'heal', value: 60, description: '恢复伤势60' }, maxStack: 10 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 150, description: '良药铺所制金疮圣药。' },
  { id: 138, name: '止血散', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'heal', value: 15, description: '恢复伤势15' }, maxStack: 20 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 40, description: '立止血流之散剂。' },
  { id: 139, name: '跌打膏', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'heal', value: 20, description: '恢复伤势20' }, maxStack: 15 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 45, description: '跌打损伤外敷之膏。' },
  { id: 140, name: '行军散', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'stamina', value: 15, description: '恢复体力15' }, maxStack: 15 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 50, description: '暑月行军辟秽之散。' },
  { id: 141, name: '避瘟散', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'cure', value: 1, description: '祛除疫病' }, maxStack: 10 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 60, description: '时疫流行之必备。' },
  { id: 142, name: '清凉丹', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'stamina', value: 10, description: '恢复体力10' }, maxStack: 20 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 35, description: '夏日解暑小丸。' },
  { id: 143, name: '解毒散', category: CO, quality: 'rare', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'cure', value: 2, description: '解百毒' }, maxStack: 8 }, equipRequirement: {}, acquisition: ['shop', 'search'], shopPrice: 180, description: '中毒垂危可救之散。' },
  { id: 144, name: '乌头毒', category: CO, quality: 'rare', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'poison_weapon', value: 20, description: '淬毒兵刃（行险之着）' }, maxStack: 5 }, equipRequirement: {}, acquisition: ['search'], description: '乌头之毒，用之有损阴骘。' },
  { id: 145, name: '蒙汗药', category: CO, quality: 'rare', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'stun', value: 1, description: '迷晕目标（计略用）' }, maxStack: 5 }, equipRequirement: {}, acquisition: ['search'], description: '下于酒中，人饮即昏。' },
  { id: 146, name: '人参', category: CO, quality: 'rare', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'stamina', value: 40, description: '恢复体力40' }, maxStack: 6 }, equipRequirement: {}, acquisition: ['shop', 'search'], shopPrice: 400, description: '上党参王，补气固本。' },
  { id: 147, name: '老山参', category: CO, quality: 'epic', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'stamina', value: 80, description: '恢复体力80' }, maxStack: 3 }, equipRequirement: {}, acquisition: ['event', 'search'], description: '百年老参，起沉疴之效。' },
  { id: 148, name: '灵芝', category: CO, quality: 'rare', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'stamina', value: 30, description: '恢复体力30' }, maxStack: 6 }, equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 350, description: '山中灵芝，服之轻身。' },
  { id: 149, name: '何首乌', category: CO, quality: 'rare', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'heal', value: 40, description: '恢复伤势40' }, maxStack: 6 }, equipRequirement: {}, acquisition: ['search'], description: '块根类药，乌须黑发。' },
  { id: 150, name: '鹿茸', category: CO, quality: 'rare', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'stamina', value: 35, description: '恢复体力35' }, maxStack: 6 }, equipRequirement: {}, acquisition: ['shop', 'search'], shopPrice: 320, description: '梅花鹿初角，补血壮阳。' },
  { id: 151, name: '杜康酒', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'morale', value: 10, description: '士气+10' }, maxStack: 10 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 80, description: '何以解忧，唯有杜康。' },
  { id: 152, name: '竹叶青', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'morale', value: 8, description: '士气+8' }, maxStack: 10 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 70, description: '色如竹叶之佳酿。' },
  { id: 153, name: '醴酒', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'morale', value: 6, description: '士气+6' }, maxStack: 15 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 50, description: '甜酒一醴，礼轻情重。' },
  { id: 154, name: '军粮丸', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'food', value: 200, description: '补充军粮200' }, maxStack: 10 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 100, description: '行军便携干粮之丸。' },
  { id: 155, name: '干粮', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'food', value: 100, description: '补充军粮100' }, maxStack: 20 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 45, description: '炒米干粮一袋。' },
  { id: 156, name: '资粮', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'food', value: 300, description: '补充军粮300' }, maxStack: 10 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 130, description: '资装粮秣一车。' },
  { id: 157, name: '强身散', category: CO, quality: 'rare', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'war_boost', value: 5, description: '临时武力+5（一战）' }, maxStack: 5 }, equipRequirement: {}, acquisition: ['shop', 'search'], shopPrice: 260, description: '习武之人壮力之药。' },
  { id: 158, name: '铁骨散', category: CO, quality: 'rare', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'war_boost', value: 3, description: '临时武力+3（一战）' }, maxStack: 8 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 180, description: '坚骨壮体之散。' },
  { id: 159, name: '凝神汤', category: CO, quality: 'rare', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'intel_boost', value: 5, description: '临时智力+5（一战）' }, maxStack: 5 }, equipRequirement: {}, acquisition: ['search', 'shop'], shopPrice: 260, description: '宁心凝神之汤剂。' },
  { id: 160, name: '安神汤', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'calm', value: 2, description: '心神安宁' }, maxStack: 10 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 60, description: '安眠定惊之汤。' },
  { id: 161, name: '五石散', category: CO, quality: 'rare', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'stamina', value: 50, description: '提神振气，久服伤身' }, maxStack: 4 }, equipRequirement: {}, acquisition: ['search'], description: '紫石英等五石所炼，名士所尚（史实行世）。' },
  { id: 162, name: '香药', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'morale', value: 5, description: '士气+5' }, maxStack: 15 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 55, description: '合香药粉，熏衣除秽。' },
  { id: 163, name: '苏合香', category: CO, quality: 'rare', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'stamina', value: 20, description: '恢复体力20' }, maxStack: 8 }, equipRequirement: {}, acquisition: ['shop', 'search'], shopPrice: 240, description: '大秦舶来苏合香，焚之通窍。' },
  { id: 164, name: '沉香', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'morale', value: 6, description: '士气+6' }, maxStack: 12 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 90, description: '沉水之香，焚之神清。' },
  { id: 165, name: '檀香', category: CO, quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'morale', value: 5, description: '士气+5' }, maxStack: 12 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 70, description: '檀木之香，礼佛敬祖之用。' },
];

// ── 校验与合并 ─────────────────────────────────────────────────────
const existing = JSON.parse(readFileSync(FILE, 'utf-8'));
// 幂等：剥掉上一轮生成的 21~165 段（以 NEW_ITEMS 的 id 集为准），只保留 0-A 基线段
const genIds = new Set(NEW_ITEMS.map((i) => i.id));
const base = existing.filter((i) => !genIds.has(i.id));
const baseIds = new Set(base.map((i) => i.id));
if (baseIds.size !== base.length) throw new Error('base items has duplicate ids');
const seen = new Set();
const names = new Set(base.map((i) => i.name));
for (const item of NEW_ITEMS) {
  if (baseIds.has(item.id)) throw new Error(`id ${item.id} already exists in 0-A base`);
  if (seen.has(item.id)) throw new Error(`duplicate generated id ${item.id}`);
  if (names.has(item.name)) throw new Error(`duplicate name ${item.name}`);
  if (item.acquisition.includes('initial')) throw new Error(`id ${item.id} uses initial (forbidden for 0-B)`);
  if (item.acquisition.includes('shop') && item.shopPrice == null && item.category !== CO) {
    throw new Error(`shop item ${item.id} missing shopPrice`);
  }
  if (item.category === CO && !item.consumable) throw new Error(`consumable ${item.id} missing consumable config`);
  if (item.category === WP && !item.primaryWeaponSubType) throw new Error(`weapon_primary ${item.id} missing subType`);
  if (item.category === WS && !item.secondaryWeaponSubType) throw new Error(`weapon_secondary ${item.id} missing subType`);
  if (item.category === AR && !item.armorSubType) throw new Error(`armor ${item.id} missing subType`);
  seen.add(item.id);
  names.add(item.name);
}

const merged = [...base, ...NEW_ITEMS].sort((a, b) => a.id - b.id);
if (merged.length !== 165) throw new Error(`expected 165 items, got ${merged.length}`);
writeFileSync(FILE, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`items.json written: ${merged.length} items (added ${NEW_ITEMS.length}, ids 21~165)`);
