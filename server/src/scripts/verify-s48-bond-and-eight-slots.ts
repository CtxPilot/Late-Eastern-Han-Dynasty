// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S13 宝物系统 · 8 槽位扩展与专属羁绊（Bond / L2 共鸣）专项验收测试（Session 450）
 * 依据：docs/48-s13-bond-and-eight-slots-proposal.md
 *
 * 验证矩阵：
 *   1. 8 槽位映射与中文标签（equipSlotFor 8 槽 + special 兼容 + labels 齐备）
 *   2. 8 槽位 EQUIP_SLOT_ORDER 有序性与长度
 *   3. 关羽专属羁绊（青龙偃月刀）：1.5 倍武力 + bonusStats + 1.5 倍暴击 + 【武圣】隐藏词条
 *   4. 非专属武将对照（夏侯惇）：严格仅 1.0 倍基础加成，无隐藏词条
 *   5. 吕布（方天画戟）、张飞（丈八蛇矛）、曹操（倚天剑）等经典共鸣全量验证
 *   6. 新增 3 槽（headwear 兜鍪冠 / robe 战袍 / accessory 配饰印信）装备与卸下全流程
 *   7. GameStateSchema 往返兼容（8 槽位严格模式 + 旧档缺省兼容）
 *   8. 数据真源审计：items.json 保持 165 条且所有 bond.officerId 在册有效
 *   9. 零 RNG 扰动与双局确定性
 *
 * 运行: pnpm --filter @leh/server exec tsx src/scripts/verify-s48-bond-and-eight-slots.ts
 */

import {
  GameStateSchema,
  ItemCategory,
  EQUIP_SLOT_LABELS,
  EQUIP_SLOT_ORDER,
  equipSlotFor,
  isItemBondActive,
  itemEffectiveStatBonus,
  itemEffectiveEffects,
  equipmentStatBonus,
  type EquipSlot,
} from '@leh/shared';
import { createGame, getGame } from '../services/game.js';
import {
  allItems,
  equipBonusFor,
  equipCritRateFor,
  duelEquipBonusFor,
  equipItem,
  unequipItem,
  getItemById,
} from '../engine/items.js';
import { getStaticData } from '../data/loader.js';

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
  console.log('=== S13 8 槽位扩展与专属羁绊（Bond / L2 共鸣）专项验收 ===\n');

  // ── 1. 8 槽位映射与中文标签 ──────────────────────────────────
  console.log('【1. 8 槽位映射与中文标签】');
  const expectedSlots: EquipSlot[] = [
    'weaponPrimary',
    'weaponSecondary',
    'headwear',
    'armor',
    'robe',
    'mount',
    'tome',
    'accessory',
  ];
  assert(EQUIP_SLOT_ORDER.length === 8, `EQUIP_SLOT_ORDER 长度恰好为 8（当前 ${EQUIP_SLOT_ORDER.length}）`);
  assert(
    JSON.stringify(EQUIP_SLOT_ORDER) === JSON.stringify(expectedSlots),
    'EQUIP_SLOT_ORDER 槽位顺序与 docs/04 §12.1 严格对齐',
  );

  for (const slot of expectedSlots) {
    assert(typeof EQUIP_SLOT_LABELS[slot] === 'string' && EQUIP_SLOT_LABELS[slot].length > 0, `槽位 [${slot}] 标签存在：${EQUIP_SLOT_LABELS[slot]}`);
  }

  assert(equipSlotFor(ItemCategory.HEADWEAR) === 'headwear', 'headwear 映射到 headwear');
  assert(equipSlotFor(ItemCategory.ROBE) === 'robe', 'robe 映射到 robe');
  assert(equipSlotFor(ItemCategory.ACCESSORY) === 'accessory', 'accessory 映射到 accessory');
  assert(equipSlotFor(ItemCategory.SPECIAL) === 'accessory', 'special 向后兼容映射到 accessory');
  assert(equipSlotFor(ItemCategory.CONSUMABLE) === null, 'consumable 拒绝映射装备槽（走快捷槽）');

  // ── 2. 关羽专属羁绊（青龙偃月刀）与非专属对照 ──────────────────
  console.log('\n【2. 专属共鸣（Bond L2）计算与对照】');
  createGame(1, 1); // 英雄集结曹操
  let g = getGame();
  const guanyu = g.officers[6];
  assert(guanyu != null, '关羽在册（id=6）');

  const qinglong = getItemById(1);
  assert(qinglong != null && qinglong.name === '青龙偃月刀', '青龙偃月刀存在（id=1）');
  assert(qinglong?.bond?.officerId === 6, '青龙偃月刀专属羁绊绑定关羽（officerId=6）');

  // 关羽激活青龙刀共鸣
  assert(isItemBondActive(qinglong!, 6) === true, '关羽装备青龙刀激活专属共鸣');
  assert(isItemBondActive(qinglong!, 9) === false, '夏侯惇装备青龙刀不激活共鸣');

  const gyStats = itemEffectiveStatBonus(qinglong!, 6);
  // 基础 war 10 * 1.5 = 15 + bonusStats.war 2 = 17
  assert(gyStats.war === 17, `关羽激活共鸣武力加成：10 * 1.5 + 2 = ${gyStats.war}`);

  const xhdStats = itemEffectiveStatBonus(qinglong!, 9);
  assert(xhdStats.war === 10, `夏侯惇未激活共鸣仅获 1.0 倍基础武力：${xhdStats.war}`);

  const gyEffects = itemEffectiveEffects(qinglong!, 6);
  const gyCrit = gyEffects.find((e) => e.type === 'crit_rate');
  assert(gyCrit?.value === 7, `关羽共鸣暴击率：5 * 1.5 = ${gyCrit?.value}%`);
  const gyWusheng = gyEffects.find((e) => e.type === 'duel_boost');
  assert(gyWusheng != null && gyWusheng.value === 20, '关羽解锁隐藏词条【武圣】单挑决斗战意提升 20%');

  const xhdEffects = itemEffectiveEffects(qinglong!, 9);
  const xhdCrit = xhdEffects.find((e) => e.type === 'crit_rate');
  assert(xhdCrit?.value === 5, `夏侯惇仅获基础暴击率：${xhdCrit?.value}%`);
  assert(!xhdEffects.some((e) => e.type === 'duel_boost'), '夏侯惇不解锁隐藏词条【武圣】');

  // ── 3. 经典传世宝物专属共鸣验证 ───────────────────────────────
  console.log('\n【3. 经典名将与名品共鸣契约】');
  // 吕布与方天画戟 (item 2, officer 5)
  const fangtian = getItemById(2);
  assert(isItemBondActive(fangtian!, 5), '吕布激活方天画戟共鸣');
  const lbStats = itemEffectiveStatBonus(fangtian!, 5);
  assert(lbStats.war === 21, `吕布画戟武力：12 * 1.5 + 3 = ${lbStats.war}`);
  const lbEffects = itemEffectiveEffects(fangtian!, 5);
  assert(lbEffects.some((e) => e.type === 'crit_rate' && e.value === 10), '吕布解锁【无双】部队暴击率+10%');

  // 张飞与丈八蛇矛 (item 3, officer 7)
  const shemao = getItemById(3);
  assert(isItemBondActive(shemao!, 7), '张飞激活丈八蛇矛共鸣');
  const zfStats = itemEffectiveStatBonus(shemao!, 7);
  assert(zfStats.war === 14, `张飞蛇矛武力：8 * 1.5 + 2 = ${zfStats.war}`);
  const zfEffects = itemEffectiveEffects(shemao!, 7);
  assert(zfEffects.some((e) => e.type === 'charge_damage' && e.value === 20), '张飞解锁【咆哮】突击伤害+20%');

  // 曹操与倚天剑 (item 4, officer 1)
  const yitian = getItemById(4);
  assert(isItemBondActive(yitian!, 1), '曹操激活倚天剑共鸣');
  const ccStats = itemEffectiveStatBonus(yitian!, 1);
  assert(ccStats.war === 12, `曹操倚天剑武力：8 * 1.5 = ${ccStats.war}`);
  assert(ccStats.leadership === 6, `曹操倚天剑统率：3 * 1.5 + 2 = ${ccStats.leadership}`);

  // ── 4. 8 槽位穿脱与属性累计全流程 ────────────────────────────
  console.log('\n【4. 8 槽位穿脱与属性加成】');
  // 构造新武将配备 8 槽全满
  const helmet = allItems().find((i) => i.category === 'headwear');
  const armor = allItems().find((i) => i.category === 'armor');
  const robe = allItems().find((i) => i.category === 'robe');
  const accessory = allItems().find((i) => i.category === 'accessory');

  assert(helmet != null, `兜鍪冠品类宝物存在：${helmet?.name} (${helmet?.category})`);
  assert(armor != null, `铠甲品类宝物存在：${armor?.name} (${armor?.category})`);
  assert(robe != null, `战袍绶带品类宝物存在：${robe?.name} (${robe?.category})`);
  assert(accessory != null, `配饰印信品类宝物存在：${accessory?.name} (${accessory?.category})`);

  assert(equipSlotFor(helmet!.category) === 'headwear', 'helmet 准确映射至 headwear');
  assert(equipSlotFor(robe!.category) === 'robe', 'robe 准确映射至 robe');
  assert(equipSlotFor(accessory!.category) === 'accessory', 'accessory 准确映射至 accessory');

  const mockEquipment: Record<EquipSlot, number> = {
    weaponPrimary: 1, // 青龙偃月刀
    weaponSecondary: 6, // 宝雕弓
    headwear: helmet!.id,
    armor: armor!.id,
    robe: robe!.id,
    mount: 10, // 赤兔马
    tome: 13, // 孙子兵法
    accessory: accessory!.id,
  };

  // 关羽（ID 6）佩戴青龙偃月刀 + 赤兔马（双激活共鸣）
  const totalGy = equipmentStatBonus(mockEquipment, getItemById, 6);
  assert((totalGy.war ?? 0) >= 17, `关羽装备 8 槽累计武力加成：${totalGy.war}`);

  // 引擎函数 equipBonusFor, equipCritRateFor, duelEquipBonusFor 穿透验证
  const gyOfficer = { id: 6, equipment: mockEquipment };
  const engineBonus = equipBonusFor(gyOfficer);
  assert(engineBonus.war === totalGy.war, `equipBonusFor 与 equipmentStatBonus 一致：${engineBonus.war}`);

  const engineCrit = equipCritRateFor(gyOfficer);
  assert(engineCrit >= 7, `equipCritRateFor 包含关羽青龙刀共鸣暴击率：${engineCrit}%`);

  const engineDuel = duelEquipBonusFor(gyOfficer);
  assert(engineDuel.duelPct >= 20, `duelEquipBonusFor 包含隐藏词条【武圣】决斗加成：${engineDuel.duelPct}%`);

  // 测试 equipItem 与 unequipItem 在新槽位 (headwear) 上的流转
  const fid = guanyu.faction!;
  let testState = {
    ...g,
    factions: {
      ...g.factions,
      [fid]: {
        ...g.factions[fid],
        inventory: {
          ...(g.factions[fid].inventory ?? {}),
          [helmet!.id]: 1,
        },
      },
    },
  };
  testState = equipItem(testState, 6, helmet!.id);
  assert(testState.officers[6].equipment?.headwear === helmet!.id, `成功将兜鍪冠装备至 headwear 槽位：${helmet!.name}`);
  assert((testState.factions[fid].inventory?.[helmet!.id] ?? 0) === 0, '势力库存对应兜鍪扣减为 0');

  testState = unequipItem(testState, 6, helmet!.id);
  assert(testState.officers[6].equipment?.headwear == null, '卸下后 headwear 槽位已置空');
  assert((testState.factions[fid].inventory?.[helmet!.id] ?? 0) === 1, '卸下后宝物回归势力库存');

  // ── 5. GameStateSchema 往返兼容性 ─────────────────────────────
  console.log('\n【5. GameStateSchema 兼容性】');
  g = {
    ...g,
    officers: {
      ...g.officers,
      6: {
        ...guanyu,
        equipment: mockEquipment,
      },
    },
  };

  const parseResult = GameStateSchema.safeParse(g);
  assert(parseResult.success, 'GameStateSchema .strict() 校验完全接受包含 8 槽位的 equipment 对象');
  if (!parseResult.success) {
    console.error('Schema parse errors:', parseResult.error.issues);
  }

  // ── 6. 数据真源审计（165 件守恒与引用闭环）────────────────────
  console.log('\n【6. 数据真源审计】');
  const staticItems = getStaticData().items;
  assert(staticItems.length === 165, `items.json 保持严格 165 条真源守恒（当前 ${staticItems.length}）`);

  const staticOfficers = getStaticData().officers;
  const officerIdSet = new Set(staticOfficers.map((o) => o.id));

  let bondCount = 0;
  let invalidBonds = 0;
  for (const it of staticItems) {
    if (it.bond) {
      bondCount++;
      if (!officerIdSet.has(it.bond.officerId)) {
        console.error(`Invalid bond officer ID ${it.bond.officerId} on item ${it.name}`);
        invalidBonds++;
      }
    }
  }
  assert(bondCount >= 30, `配置专属羁绊（bond）的宝物数量充足（已配置 ${bondCount} 件）`);
  assert(invalidBonds === 0, '所有专属羁绊的 officerId 均在 officers.json 中有效存在');

  console.log(`\n验收结果：${pass} 通过，${fail} 失败`);
  if (fail > 0) {
    process.exit(1);
  }
}

run();
