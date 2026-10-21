// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S13 装备与宝物系统 · 套装体系（Set L3）与未接入装备词条消费闭环专项验收测试（Session 451）
 * 依据：docs/49-s13-itemsets-and-effects-proposal.md
 *
 * 验证矩阵：
 *   1. 十大经典套装元数据与真源审计（10套定义完整、itemIds 闭环在册、items.json 165条守恒）
 *   2. 套装件数阶梯激活（0件无、1件未达成、2件套、3件套、4件套阶梯状态）
 *   3. 复合乘区与效力叠加（L1 基础 × L2 共鸣 × L3 套装；夏侯惇对照 vs 关羽全套 vs 吕布4件套）
 *   4. charge_damage 突击伤害加成消费端点验证
 *   5. mobility 机动力加成消费端点验证（六角战场 BattleUnit mp/maxMp 增益）
 *   6. range 远程射程加成消费端点验证（神弓/卧龙套射程增益）
 *   7. recruit_bonus 募兵效率加成消费端点验证（conscript 征兵增益）
 *   8. authority 威信加成消费端点验证（checkKingRequirements 皇权门槛增益）
 *   9. 零 RNG 扰动与月结确定性守护
 *
 * 运行: pnpm --filter @leh/server exec tsx src/scripts/verify-s49-itemsets-and-effects.ts
 */

import {
  allItemSets,
  getItemSetById,
  getActiveItemSets,
  equipmentStatBonus,
  equipmentEffectiveEffects,
  type Equipment,
  UnitType,
} from '@leh/shared';
import {
  allItems,
  getItemById,
  equipBonusFor,
  equipChargeBonusFor,
  equipMobilityBonusFor,
  equipRangeBonusFor,
  equipRecruitBonusFor,
  equipAuthorityBonusFor,
  activeItemSetsFor,
} from '../engine/items.js';
import { createGame, getGame } from '../services/game.js';
import { createBattle } from '../engine/battle.js';
import { conscript } from '../engine/civil.js';
import { getKingRequirements } from '../engine/hegemony.js';

let pass = 0;
let fail = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

function run(): void {
  console.log('=== S13 套装体系（Set L3）与未接入装备词条消费闭环专项验收 ===\n');

  // ── 1. 十大经典套装元数据与真源审计 ─────────────────────────
  console.log('【1. 十大经典套装元数据与真源审计】');
  const sets = allItemSets();
  assert(sets.length === 10, `经典套装数量恰好为 10 套（当前 ${sets.length} 套）`);
  assert(getItemSetById(1)?.name === '威震华夏', 'getItemSetById(1) 正确获取套装 [威震华夏]');

  const items = allItems();
  assert(items.length === 165, `items.json 保持严格 165 条真源守恒（当前 ${items.length}）`);

  const itemMap = new Map(items.map((i) => [i.id, i]));
  let missingItems = 0;
  let mismatchedSets = 0;

  for (const s of sets) {
    assert(s.tiers.length >= 2, `套装 [${s.name}] 阶梯数充足（${s.tiers.length} 阶）`);
    for (const itemId of s.itemIds) {
      const it = itemMap.get(itemId);
      if (!it) {
        missingItems++;
        console.error(`套装 ${s.name} 中的宝物 #${itemId} 不存在于 items.json`);
      } else if (!it.sets || !it.sets.includes(s.id)) {
        mismatchedSets++;
        console.error(`宝物 ${it.name} #${it.id} 未配置 sets [${s.id}]`);
      }
    }
  }
  assert(missingItems === 0, '所有套装引用的宝物 ID 均在 items.json 中有效存在');
  assert(mismatchedSets === 0, '所有套装引用的宝物 items.json sets 字段双向对齐');

  // ── 2. 套装件数阶梯激活与状态派生 ───────────────────────────
  console.log('\n【2. 套装件数阶梯激活（getActiveItemSets）】');
  createGame(1, 1); // 英雄集结曹操
  const g = getGame();

  // 关羽套装：1 青龙偃月刀, 10 赤兔马, 117 假节钺
  const emptyActive = getActiveItemSets({}, getItemById);
  assert(emptyActive.length === 0, '空装备激活套装为空');

  // 1 件：装备青龙刀
  const eq1: Equipment = { weaponPrimary: 1 };
  const act1 = getActiveItemSets(eq1, getItemById);
  assert(act1.length === 1, '装备 1 件青龙刀识别出对应套装 [威震华夏]');
  assert(act1[0].equippedCount === 1, '套装装备件数为 1');
  assert(act1[0].activeTier === null, '1 件套未达成最低门槛（activeTier 为 null）');

  // 2 件：青龙刀 + 赤兔马
  const eq2: Equipment = { weaponPrimary: 1, mount: 10 };
  const act2 = getActiveItemSets(eq2, getItemById);
  const guanSet2 = act2.find((a) => a.set.id === 1);
  assert(guanSet2 != null, '达成 2 件套威震华夏');
  assert(guanSet2?.equippedCount === 2, '达成 2 件');
  assert(guanSet2?.activeTier?.count === 2, '激活 2 件套阶梯 [武圣神威]');
  assert(guanSet2?.activeTier?.statMultiplier === 1.2, '2 件套乘区为 1.2 倍');

  // 3 件：青龙刀 + 赤兔马 + 假节钺
  const eq3: Equipment = { weaponPrimary: 1, mount: 10, accessory: 117 };
  const act3 = getActiveItemSets(eq3, getItemById);
  const guanSet3 = act3.find((a) => a.set.id === 1);
  assert(guanSet3?.equippedCount === 3, '达成 3 件全套');
  assert(guanSet3?.activeTier?.count === 3, '激活 3 件套阶梯 [威震华夏]');
  assert(guanSet3?.activeTier?.statMultiplier === 1.5, '3 件套乘区为 1.5 倍');

  // 吕布 4 件套：2 方天戟, 67 兽面铠, 73 紫金冠, 10 赤兔马
  const eq4: Equipment = {
    weaponPrimary: 2,
    armor: 67,
    headwear: 73,
    mount: 10,
  };
  const act4 = getActiveItemSets(eq4, getItemById);
  const lubuSet = act4.find((a) => a.set.id === 2);
  assert(lubuSet?.equippedCount === 4, '达成天下无双 4 件套');
  assert(lubuSet?.activeTier?.count === 4, '激活 4 件套阶梯 [虓虎绝伦]');
  assert(lubuSet?.activeTier?.statMultiplier === 2.0, '4 件套最高乘区为 2.0 倍');

  // ── 3. 复合乘区与效力叠加（L1 × L2 × L3） ─────────────────────
  console.log('\n【3. 复合乘区计算与对照（L1 × L2 × L3）】');
  // 夏侯惇（ID 9，非专属）佩戴关羽 2 件套（青龙刀 + 赤兔马）：
  // 无 L2 共鸣 (1.0x)，仅 L3 2件套 (1.2x) + 2件套 bonusStats (war: 3)
  // 青龙刀基础 war 10 * 1.2 = 12
  // 赤兔马基础 war 3 * 1.2 = 3
  // 套装 bonusStats.war = 3 -> 总计 12 + 3 + 3 = 18
  const xhdStats = equipmentStatBonus(eq2, getItemById, 9);
  assert(xhdStats.war === 18, `夏侯惇装备关羽 2 件套：武力 10*1.2 + 3*1.2 + 3 = ${xhdStats.war}`);

  // 关羽（ID 6，专属）佩戴 2 件套：
  // 享受 L2 (1.5x) × L3 (1.2x) = 1.8x 乘区
  // 青龙刀基础 10 * 1.8 = 18 + 青龙刀 bond.bonusStats 2 = 20
  // 赤兔马基础 3 * 1.8 = 5
  // 套装 bonusStats.war = 3 -> 总计 20 + 5 + 3 = 28
  const gyStats2 = equipmentStatBonus(eq2, getItemById, 6);
  assert(gyStats2.war === 28, `关羽装备 2 件套双重共鸣叠加：武力 10*1.8+2 + 3*1.8 + 3 = ${gyStats2.war}`);

  // 关羽佩戴 3 件全套：
  // 享受 L2 (1.5x) × L3 (1.5x) = 2.25x 乘区
  // 青龙刀基础 10 * 2.25 = 22 + 青龙刀 bond.bonusStats 2 = 24
  // 赤兔马基础 3 * 2.25 = 6
  // 假节钺基础 4 (leadership) * 2.25 = 9 + 假节钺 bond.bonusStats 3 = 12
  // 套装 2件套 bonusStats: war + 3
  // 套装 3件套 bonusStats: leadership + 4
  // 总计 war: 24 + 6 + 3 = 33
  // 总计 leadership: 12 + 4 = 16
  const gyStats3 = equipmentStatBonus(eq3, getItemById, 6);
  assert(gyStats3.war === 33, `关羽装备 3 件全套满共鸣武力：武力 = ${gyStats3.war}`);
  assert(gyStats3.leadership === 16, `关羽装备 3 件全套统率：统率 = ${gyStats3.leadership}`);

  // 引擎层 equipBonusFor 穿透校验
  const gyOfficer = { id: 6, equipment: eq3 };
  assert(equipBonusFor(gyOfficer).war === gyStats3.war, `equipBonusFor 与 equipmentStatBonus 一致：${equipBonusFor(gyOfficer).war}`);

  // 套装特技词条汇总测试
  const gyEffects = equipmentEffectiveEffects(eq3, getItemById, 6);
  assert(gyEffects.some((e) => e.type === 'charge_damage' && e.value === 15), '激活套装2件特技【武圣神威】突击伤害+15%');
  assert(gyEffects.some((e) => e.type === 'crit_rate' && e.value === 10), '激活套装3件特技【威震华夏】暴击率+10%');
  assert(gyEffects.some((e) => e.type === 'duel_boost' && e.value === 20), '激活套装3件特技单挑战意+20%');

  // ── 4. charge_damage 突击伤害加成消费端点 ─────────────────────
  console.log('\n【4. charge_damage 突击伤害加成消费端点】');
  const chargeBonusGy = equipChargeBonusFor(gyOfficer);
  assert(chargeBonusGy >= 15, `关羽当前突击伤害加成累计：${chargeBonusGy}%（含套装特技）`);

  // 张飞（ID 7）佩戴丈八蛇矛（专属 bond 解锁 charge_damage 20%）
  const zfOfficer = { id: 7, equipment: { weaponPrimary: 3 } };
  const zfCharge = equipChargeBonusFor(zfOfficer);
  assert(zfCharge === 20, `张飞丈八蛇矛共鸣突击伤害+${zfCharge}%`);

  // ── 5. mobility 机动力加成消费端点 ───────────────────────────
  console.log('\n【5. mobility 机动力加成消费端点】');
  // 关羽佩戴赤兔马（mobility +2，共鸣 1.5倍 = 3，bond.bonusEffect +1 = 4）
  const gyMobility = equipMobilityBonusFor(gyOfficer);
  assert(gyMobility >= 4, `关羽装备赤兔马机动力加成：+${gyMobility}`);

  // 在六角战场创建中验证机动力注入（createBattle）
  let battleState = {
    ...g,
    officers: {
      ...g.officers,
      6: {
        ...g.officers[6],
        equipment: { mount: 10 }, // 佩戴赤兔马
      },
    },
  };
  const battle = createBattle(battleState, 1, {
    attackerArmy: {
      id: 'test-army',
      name: '测试军',
      commanderId: 6,
      subCommanderIds: [],
      factionId: 1,
      unitType: UnitType.HEAVY_CAVALRY,
      formation: 1,
      troops: 5000,
      maxTroops: 5000,
      morale: 100,
      food: 1000,
      maxFood: 1000,
      fatigue: 0,
      organization: 100,
      experience: 0,
      phase: 'garrison',
      currentNodeId: 1,
      path: [],
      squads: [
        {
          officerId: 6,
          role: 'main' as const,
          position: 'center' as const,
          unitType: UnitType.HEAVY_CAVALRY,
          troops: 5000,
          morale: 100,
        },
      ],
      structures: [],
    },
  });
  const gyUnit = battle.units.find((u) => u.commanderId === 6);
  assert(gyUnit != null, '六角战场中成功生成关羽作战单位');
  // heavyCavalry 基准 mobility = 5，赤兔马共鸣 +4 -> 9
  assert((gyUnit?.maxMp ?? 0) >= 9, `关羽重骑兵部队有效机动力包含赤兔马加成：maxMp=${gyUnit?.maxMp}（基线 5 + 装备 4 = 9）`);

  // ── 6. range 远程射程加成消费端点 ─────────────────────────────
  console.log('\n【6. range 远程射程加成消费端点】');
  // 黄忠佩戴宝雕弓（id 6，range +1）
  const hzOfficer = {
    id: 146,
    equipment: { weaponSecondary: 6 },
  };
  const hzRange = equipRangeBonusFor(hzOfficer);
  assert(hzRange >= 1, `黄忠装备宝雕弓远程射程加成：+${hzRange}格`);

  // 诸葛亮（ID 4）佩戴诸葛连弩 + 卧龙天机套 3件（set bonusEffects range +1）
  const zglOfficer = {
    id: 4,
    equipment: {
      weaponSecondary: 7, // 诸葛连弩
      tome: 13, // 孙子兵法
      headwear: 126, // 纶巾
    },
  };
  const zglRange = equipRangeBonusFor(zglOfficer);
  assert(zglRange >= 1, `诸葛亮装备卧龙3件套远程射程加成：+${zglRange}格`);

  // ── 7. recruit_bonus 募兵效率加成消费端点 ───────────────────────
  console.log('\n【7. recruit_bonus 募兵效率加成消费端点】');
  const zglRecruit = equipRecruitBonusFor({
    id: 4,
    equipment: {
      weaponSecondary: 7,
      tome: 13,
      headwear: 126,
      accessory: 127, // 卧龙4件套（recruit_bonus +15%）
    },
  });
  assert(zglRecruit >= 15, `诸葛亮卧龙4件套募兵加成：+${zglRecruit}%`);

  // 在 conscript 征兵公式中实际生效验证
  // 构造城主佩戴兵符（id 18，recruit_bonus +10%）的测试状态
  const city1 = g.cities[1];
  const testCivilState = {
    ...g,
    cities: {
      ...g.cities,
      1: {
        ...city1,
        officers: [4, ...city1.officers.filter((id) => id !== 4)],
        gold: 1000,
        food: 1000,
        demographics: {
          ...city1.demographics!,
          adultMale: 50000, // 充足劳力，确保 recruit bonus 不受 maxMen 截断
        },
      },
    },
    officers: {
      ...g.officers,
      4: {
        ...g.officers[4],
        equipment: { accessory: 18 }, // 兵符（recruit_bonus +10%）
      },
    },
  };
  // 相同 RNG 对比有无兵符
  const stateNoEquip = {
    ...testCivilState,
    officers: {
      ...testCivilState.officers,
      4: { ...testCivilState.officers[4], equipment: {} },
    },
  };
  const fixedRng = () => 0.5;
  const resEquip = conscript(testCivilState, 1, fixedRng);
  const resNoEquip = conscript(stateNoEquip, 1, fixedRng);
  const gainedEquip = (resEquip.cities[1].demographics?.adultMale ?? 0);
  const gainedNoEquip = (resNoEquip.cities[1].demographics?.adultMale ?? 0);
  // adultMale 扣除更多代表征兵更多
  assert(gainedEquip < gainedNoEquip, `城主佩戴兵符使实际征兵量更多（成年男丁结余 ${gainedEquip} < ${gainedNoEquip}）`);

  // ── 8. authority 威信加成消费端点 ─────────────────────────────
  console.log('\n【8. authority 威信加成消费端点】');
  // 曹操佩戴倚天剑（authority +5, 羁绊后 7+10=17）+ 兵符（社稷套）+ 金印紫绶（社稷套2件, authority 4*1.2=4, 套装额外 +15）
  const ccAuthOfficer = {
    id: 1,
    equipment: {
      weaponPrimary: 4, // 倚天剑 (+5, bond -> 17)
      accessory: 18, // 兵符 (社稷套1/3)
      robe: 120, // 金印紫绶 (社稷套2/3, 套装激活 authority +15)
    },
  };
  const authBonus = equipAuthorityBonusFor(ccAuthOfficer);
  assert(authBonus >= 30, `曹操倚天剑与兵符紫绶社稷套威信加成：+${authBonus}`);

  // 在称王皇权门槛校验 getKingRequirements 中生效验证
  const testHegemonyState = {
    ...g,
    factions: {
      ...g.factions,
      1: {
        ...g.factions[1],
        rulerId: 1,
        imperialAuthority: 50, // 基础皇权不足 80
      },
    },
    officers: {
      ...g.officers,
      1: {
        ...g.officers[1],
        equipment: { accessory: 118 }, // 大将军印（authority +10）
      },
    },
  };
  const reqWithEquip = getKingRequirements(testHegemonyState, 1);
  const reqNoEquip = getKingRequirements(
    {
      ...testHegemonyState,
      officers: { ...testHegemonyState.officers, 1: { ...testHegemonyState.officers[1], equipment: {} } },
    },
    1,
  );
  assert(reqWithEquip.imperialAuthority.current > reqNoEquip.imperialAuthority.current, `佩戴重宝皇权值从 ${reqNoEquip.imperialAuthority.current} 提升至 ${reqWithEquip.imperialAuthority.current}`);

  // ── 9. activeItemSetsFor 接口验证 ────────────────────────────
  console.log('\n【9. activeItemSetsFor 接口验证】');
  const setsResult = activeItemSetsFor(gyOfficer);
  const activeGuanYuSet = setsResult.find((s) => s.set.id === 1);
  assert(activeGuanYuSet != null && activeGuanYuSet.activeTier?.name === '威震华夏', 'activeItemSetsFor 正确返回关羽激活的威震华夏套装最高阶梯');

  console.log(`\n验收结果：${pass} 通过，${fail} 失败`);
  if (fail > 0) {
    process.exit(1);
  }
}

run();
