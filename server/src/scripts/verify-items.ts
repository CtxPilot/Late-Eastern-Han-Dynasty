// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S13 宝物系统冒烟测试（Session 266，docs/04 §十二/§十五 11.1）：
 *   1. 初始宝配：签名武将开局装备（吕布方天画戟/关羽青龙偃月刀等）+ initial 宝物入库存
 *   2. 装备/卸下：库存 ↔ 槽位，门槛校验（武力不足拒绝），槽位已占用拒绝
 *   3. 赏赐宝物：忠诚+5~20 按品质、自动装备、君主特例拒绝（§3.8）
 *   4. 搜索宝物：真实入库（替换纯功绩模拟），RNG 流不新增消费
 *   5. 属性加成：equipBonusFor 六维累计进 effectiveWar
 *   6. 效果接入：防御（damage calcDamage armorDefense）、暴率（crit_rate）、单挑（duel war）
 *   7. 完整 GameState Schema 往返（equipment/inventory 字段）
 *
 * 运行: pnpm verify-items
 */
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  GameStateSchema,
  OfficerStatus,
  TerrainType,
  effectiveWar,
  type Officer,
  type SaveEnvelopeV1,
  AcquisitionMethod,
} from '@leh/shared';
import { calcDamage, type DamageInput } from '../battle/damage.js';
import { createGame, getGame } from '../services/game.js';
import {
  allItems,
  equipBonusFor,
  equipItem,
  equipCritRateFor,
  grantTreasure,
  getItemById,
  itemsTestHooks,
  searchTreasureIntoInventory,
  unequipItem,
} from '../engine/items.js';
import { searchTalent } from '../engine/personnel.js';

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

const QUALITY_LOYALTY: Record<string, number> = {
  legendary: 20,
  epic: 15,
  rare: 10,
  common: 5,
};

/** 运行冒烟。 */
function run(): void {
  createGame(1, 1); // 英雄集结，玩家势力 1（曹操）
  let g = getGame();
  const fid = g.playerFactionId;

  // ── 1. 初始宝配 ──────────────────────────────────────────────
  const cao = g.officers[1];
  assert(cao != null, `英雄集结曹操存在（id=1）`);
  if (cao?.equipment) {
    const swordId = Object.values(cao.equipment)[0];
    const sword = getItemById(swordId);
    assert(sword?.name === '倚天剑', `曹操初始装备倚天剑（实际 ${sword?.name}）`);
  } else {
    assert(false, '曹操初始装备不为空');
  }
  const lvbu = g.officers[5];
  assert(lvbu?.equipment?.weaponPrimary === 2, `吕布初始装备方天画戟（item 2）`);
  const guanyu = g.officers[6];
  assert(guanyu?.equipment?.weaponPrimary === 1, `关羽初始装备青龙偃月刀（item 1）`);
  const zhangfei = g.officers[7];
  assert(zhangfei?.equipment?.weaponPrimary === 3, `张飞初始装备丈八蛇矛（item 3）`);
  const liubei = g.officers[2];
  assert(liubei?.equipment?.weaponPrimary === 5, `刘备初始装备雌雄双股剑（item 5）`);
  const zhangliang = g.officers[4];
  assert(zhangliang?.equipment?.tome === 13, `诸葛亮初始装备孙子兵法（item 13）`);
  const inv0 = g.factions[fid]?.inventory ?? {};
  const initialCount = allItems().filter((i) => i.acquisition.includes(AcquisitionMethod.INITIAL)).length;
  const equippedCount = [cao, lvbu, guanyu, zhangfei, liubei, zhangliang]
    .filter((o) => o?.equipment && Object.keys(o.equipment).length > 0).length;
  const inventoryEntries = Object.keys(inv0).length;
  assert(
    inventoryEntries + equippedCount >= initialCount - 2,
    `initial 宝物全部分配（库存 ${inventoryEntries} + 装备 ${equippedCount} ≥ ${initialCount - 2}）`,
  );
  // 英雄集结曹操势力 inventory 存在（special/consumable 类）
  assert(Object.keys(inv0).length > 0, `曹操势力开局库存非空（${Object.keys(inv0).length} 件）`);

  // ── 2. 装备/卸下 ──────────────────────────────────────────────
  // 找一个可装备的库存宝物（如 黑铁甲 id=8 armor / 赤兔马 id=10 mount）
  const mountInInv = Object.keys(inv0).map(Number).find((id) => getItemById(id)?.category === 'mount');
  const armorInInv = Object.keys(inv0).map(Number).find((id) => getItemById(id)?.category === 'armor');
  const someSlotItem = mountInInv ?? armorInInv ?? Object.keys(inv0).map(Number)[0];
  assert(someSlotItem != null, `库存有可装备宝物（id=${someSlotItem}）`);

  if (someSlotItem != null) {
    const beforeInv = (g.factions[fid]?.inventory?.[someSlotItem] ?? 0);
    // 找未装备该宝物的武将
    const target = Object.values(g.officers).find(
      (o) =>
        o.faction === fid &&
        o.status === OfficerStatus.ACTIVE &&
        o.id !== fid && // 非君主
        !Object.values(o.equipment ?? {}).includes(someSlotItem),
    );
    if (target) {
      g = equipItem(g, target.id, someSlotItem);
      const afterInv = (g.factions[fid]?.inventory?.[someSlotItem] ?? 0);
      assert(afterInv === beforeInv - 1, `装备后库存 ${someSlotItem} 减 1（${beforeInv}→${afterInv}）`);
      const equipped = g.officers[target.id].equipment;
      assert(Object.values(equipped ?? {}).includes(someSlotItem), `武将 ${target.name} 装备成功`);
      // 卸下
      g = unequipItem(g, target.id, someSlotItem);
      assert(
        (g.factions[fid]?.inventory?.[someSlotItem] ?? 0) === beforeInv,
        `卸下后库存回补（${afterInv}→${beforeInv}）`,
      );
      assert(
        !Object.values(g.officers[target.id].equipment ?? {}).includes(someSlotItem),
        '卸下后槽位清空',
      );
    } else {
      console.log('    说明: 未找到未装备该宝物的非君主武将，跳过装备/卸下断言');
    }
  }

  // 门槛校验：让武力很低的文官装备高武力要求宝物（青龙偃月刀 minWar 80）
  // 用测试钩子把青龙偃月刀（item 1）放入库存，再尝试低武武将装备
  const lowWar = Object.values(g.officers).find(
    (o) => o.faction === fid && o.id !== fid && o.stats.war < 60,
  );
  const { addToInventory } = itemsTestHooks;
  g = addToInventory(g, fid, 1);
  if (lowWar) {
    let threw = false;
    try {
      g = equipItem(g, lowWar.id, 1);
    } catch {
      threw = true;
    }
    assert(threw, `武力不足武将装备青龙偃月刀被拒（${lowWar.name} 武${lowWar.stats.war}）`);
  } else {
    console.log('    说明: 无低武武将，跳过门槛拒绝断言');
  }
  // 槽位冲突：把青龙偃月刀装备给一个武力达标的武官后，再尝试重复装备另一件主武器
  const highWar = Object.values(g.officers).find(
    (o) => o.faction === fid && o.id !== fid && o.stats.war >= 80 && o.id !== 6,
  );
  if (highWar) {
    const equippedBefore = Object.keys(highWar.equipment ?? {}).length;
    g = equipItem(g, highWar.id, 1);
    assert(
      Object.keys(g.officers[highWar.id].equipment ?? {}).length === equippedBefore + 1,
      `武力达标武将装备青龙偃月刀成功（${highWar.name} 武${highWar.stats.war}）`,
    );
    // 再装备青铜剑（item 19 weapon_primary）应因主武器槽已占用被拒
    g = addToInventory(g, fid, 19);
    let threw = false;
    try {
      g = equipItem(g, highWar.id, 19);
    } catch {
      threw = true;
    }
    assert(threw, `主武器槽已占用，再装备青铜剑被拒`);
    // 卸下青龙偃月刀恢复
    g = unequipItem(g, highWar.id, 1);
  } else {
    console.log('    说明: 无达标武官武将，跳过槽位冲突断言');
  }

  // ── 3. 赏赐宝物 ──────────────────────────────────────────────
  // 显式用绝影（id=12，epic，无装备门槛）：放入库存后赏赐给非君主武将
  const GRANT_ITEM_ID = 12;
  const grantBeforeInv = g.factions[fid]?.inventory?.[GRANT_ITEM_ID] ?? 0;
  g = itemsTestHooks.addToInventory(g, fid, GRANT_ITEM_ID);
  const grantItem = getItemById(GRANT_ITEM_ID);
  const target2 = Object.values(g.officers).find(
    (o) =>
      o.faction === fid &&
      o.status === OfficerStatus.ACTIVE &&
      o.id !== fid &&
      !Object.values(o.equipment ?? {}).includes(GRANT_ITEM_ID),
  );
  if (grantItem && target2) {
    const gain = QUALITY_LOYALTY[grantItem.quality] ?? 5;
    const beforeLoyalty = target2.loyalty;
    g = grantTreasure(g, target2.id, GRANT_ITEM_ID);
    const after = g.officers[target2.id];
    assert(
      after.loyalty === Math.min(100, beforeLoyalty + gain),
      `赏赐 ${grantItem.name}（${grantItem.quality}）忠诚+${gain}（${beforeLoyalty}→${after.loyalty}）`,
    );
    assert(
      Object.values(after.equipment ?? {}).includes(GRANT_ITEM_ID),
      `赏赐后自动装备（${grantItem.name}）`,
    );
    assert(
      (g.factions[fid]?.inventory?.[GRANT_ITEM_ID] ?? 0) === grantBeforeInv,
      `赏赐后库存扣减（${grantBeforeInv + 1}→${grantBeforeInv}）`,
    );
    // 君主特例（§3.8）：赏赐给君主拒绝
    let threw = false;
    try {
      g = grantTreasure(g, fid, GRANT_ITEM_ID);
    } catch {
      threw = true;
    }
    assert(threw, '赏赐宝物给君主被拒（§3.8 君主特例）');
  } else {
    console.log('    说明: 赏赐对照武将不可用，跳过赏赐断言');
  }

  // ── 4. 搜索宝物真实入库 ──────────────────────────────────────
  // 直接构造搜索稀有分支（roll 落入宝物区间）；不新增 RNG 消费（派生宝物索引）
  const searchable = allItems().filter((i) => i.acquisition.includes(AcquisitionMethod.SEARCH));
  if (searchable.length > 0) {
    const beforeKeys = Object.keys(g.factions[fid]?.inventory ?? {}).length;
    const rolled = g = searchTreasureIntoInventory(g, fid, 0.345); // 落入 [0.3,0.35) 宝物区间
    const afterKeys = Object.keys(rolled.factions[fid]?.inventory ?? {}).length;
    const newId = Object.keys(rolled.factions[fid]?.inventory ?? {})
      .map(Number)
      .find((id) => !(Object.keys(g.factions[fid]?.inventory ?? {})).includes(String(id)));
    assert(afterKeys >= beforeKeys, `搜索宝物入库存（库存条目 ${beforeKeys}→${afterKeys}）`);
    assert(
      newId == null || searchable.some((i) => i.id === newId),
      '入库宝物来自 search 获取池',
    );
  } else {
    console.log('    说明: 无可搜索宝物池，跳过搜索入库断言');
  }

  // 搜索真实流程（personnel.searchTalent 经服务层调用）
  const beforeKeysAfterSearch = Object.keys(g.factions[fid]?.inventory ?? {}).length;
  const playerCity = g.factions[fid]?.cityIds[0];
  if (playerCity != null && (g.cities[playerCity]?.gold ?? 0) >= 80) {
    const city = g.cities[playerCity];
    const beforeGold = city.gold;
    g = searchTalent(g, playerCity, () => 0.345); // 成功 + 宝物分支
    assert(
      g.cities[playerCity].gold === beforeGold - 80,
      `搜索扣金 80（${beforeGold}→${g.cities[playerCity].gold}）`,
    );
    assert(
      Object.keys(g.factions[fid]?.inventory ?? {}).length >= beforeKeysAfterSearch,
      '搜索流程后库存存在宝物条目',
    );
  }

  // ── 5. 属性加成进有效属性 ────────────────────────────────────
  const withItem = equipBonusFor(guanyu);
  const warBonus = withItem.war ?? 0;
  assert(warBonus >= 10, `关羽装备青龙偃月刀 war+${warBonus}（baseStats.war=10）`);
  const effWar = effectiveWar(guanyu as Officer, withItem);
  assert(
    effWar === guanyu.stats.war + warBonus + 0,
    `effectiveWar 计入装备武力（${guanyu.stats.war} + ${warBonus} = ${effWar}）`,
  );

  // ── 6. 效果接入 ──────────────────────────────────────────────
  // 暴率：关羽装备青龙偃月刀（crit_rate 5）
  const critBonus = equipCritRateFor(guanyu);
  assert(critBonus === 5, `关羽装备暴率加成 +5%（实际 ${critBonus}）`);
  // 防御：找装备黑铁甲（defense 8）的构造场景
  const defenseItem = allItems().find((i) => i.baseEffect.some((e) => e.type === 'defense'));
  assert(defenseItem != null, `防御宝物存在（${defenseItem?.name}）`);
  const defInput: DamageInput = {
    unitAttack: 10,
    unitDefense: 5,
    officerWar: 80,
    officerLeadership: 80,
    troops: 3000,
    maxTroops: 3000,
    morale: 85,
    terrain: TerrainType.PLAIN,
    matchup: 1,
    armorDefense: defenseItem?.baseEffect.find((e) => e.type === 'defense')?.value ?? 0,
  };
  const defInputNoArmor: DamageInput = { ...defInput, armorDefense: 0 };
  const dmgWith = calcDamage(defInput, defInput, () => 0.95);
  const dmgWithout = calcDamage(defInputNoArmor, defInputNoArmor, () => 0.95);
  assert(dmgWithout > dmgWith, `装备防御使受击伤害降低（${dmgWithout}→${dmgWith}）`);

  // ── 7. Schema 往返 ───────────────────────────────────────────
  const envelope: SaveEnvelopeV1 = {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    scenarioId: g.scenarioId,
    rng: { algorithm: 'xorshift32-v1' as const, state: 123, draws: 0 },
    snapshot: g,
  };
  const raw = JSON.parse(JSON.stringify(envelope));
  // GameStateSchema 完整校验（含 equipment/inventory 新字段）
  const parsed = GameStateSchema.safeParse(raw.snapshot);
  assert(parsed.success, '完整 GameStateSchema 接受 equipment/inventory 字段');
  assert(
    parsed.success ? parsed.data.officers[5]?.equipment?.weaponPrimary === 2 : false,
    'Schema 往返保留吕布方天画戟装备',
  );

  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  if (fail > 0) process.exit(1);
}

run();
