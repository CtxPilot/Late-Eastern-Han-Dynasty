// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  canEquipItem,
  equipmentStatBonus,
  equipSlotFor,
  type EquipStatBonus,
  type Equipment,
  type ItemInventory,
  type ItemStatic,
  AcquisitionMethod,
  OfficerStatus,
  calcStaminaMax,
  meritLevelFor,
} from '@leh/shared';
import type { GameState, Officer } from '@leh/shared';
import { getStaticData } from '../data/loader.js';
import type { DuelEquipBonus } from '../battle/duel.js';

/**
 * S13 宝物系统服务端引擎（Session 266 实装，0-A 5 槽）。
 * 共享纯函数见 shared/items.ts；效果接入见 battle/crit/duel/campaign/stamina。
 *
 * 设计（docs/04 §十二·§十五 11.1，0-A 精简）：
 * - Faction.inventory：宝物 id → 数量（势力未分配库存）
 * - Officer.equipment：5 槽（主武器/副武器/铠甲/坐骑/兵书）
 * - 装备/卸下：库存 ↔ 武将槽位
 * - 赏赐宝物：忠诚+5~20（按品质），赐下后武将自行装备（槽空时）；§3.8 君主特例跳过
 * - 搜索宝物（personnel.ts 集成）：稀有分支入势力库存，不再纯功绩模拟
 */

function pushLog(
  state: GameState,
  type: string,
  message: string,
  patch: Partial<GameState> = {},
): GameState {
  return {
    ...state,
    ...patch,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type,
        message,
      },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

/** 装备属性加成（baseStats 六维累计；用于 effectiveStat 系函数）。 */
export function equipBonusFor(officer: Pick<Officer, 'equipment'>): EquipStatBonus {
  return equipmentStatBonus(officer.equipment, itemById);
}

/** 装备防御效果累计（baseEffect type='defense'，如黑铁甲/革甲；S13 Session 266 接入 damage.ts）。 */
export function equipArmorDefenseFor(officer: Pick<Officer, 'equipment'>): number {
  if (!officer.equipment) return 0;
  let sum = 0;
  for (const itemId of new Set(Object.values(officer.equipment))) {
    if (itemId == null) continue;
    const item = itemById(itemId);
    if (!item) continue;
    for (const e of item.baseEffect) {
      if (e.type === 'defense') sum += e.value;
    }
  }
  return sum;
}

/** 装备暴率加成（baseEffect type='crit_rate'，百分比点；S13 Session 266 接入 crit.ts）。 */
export function equipCritRateFor(officer: Pick<Officer, 'equipment'>): number {
  if (!officer.equipment) return 0;
  let sum = 0;
  for (const itemId of new Set(Object.values(officer.equipment))) {
    if (itemId == null) continue;
    const item = itemById(itemId);
    if (!item) continue;
    for (const e of item.baseEffect) {
      if (e.type === 'crit_rate') sum += e.value;
    }
  }
  return sum;
}

/** 装备单挑加成（武力 + duel_boost；S13 Session 266 接入 duel.ts）。 */
export function duelEquipBonusFor(officer: Pick<Officer, 'equipment'>): DuelEquipBonus {
  const bonus: DuelEquipBonus = { war: 0, duelPct: 0 };
  if (!officer.equipment) return bonus;
  for (const itemId of new Set(Object.values(officer.equipment))) {
    if (itemId == null) continue;
    const item = itemById(itemId);
    if (!item) continue;
    bonus.war += item.baseStats.war ?? 0;
    for (const e of item.baseEffect) {
      if (e.type === 'duel_boost') bonus.duelPct += e.value;
    }
  }
  return bonus;
}

/** items 静态查询（按 id）。 */
let itemIndex: Map<number, ItemStatic> | null = null;
function itemById(id: number): ItemStatic | undefined {
  if (!itemIndex) {
    itemIndex = new Map(getStaticData().items.map((i) => [i.id, i]));
  }
  return itemIndex.get(id);
}

export function getItemById(id: number): ItemStatic | undefined {
  return itemById(id);
}

/** 全部宝物（静态，供 UI/验证）。 */
export function allItems(): ItemStatic[] {
  return getStaticData().items;
}

/** 宝物品质 → 赏赐忠诚增量（04 §11.1：忠诚+5~20 按品质）。 */
export function loyaltyGainForQuality(quality: ItemStatic['quality']): number {
  switch (quality) {
    case 'legendary':
      return 20;
    case 'epic':
      return 15;
    case 'rare':
      return 10;
    case 'common':
      return 5;
    default:
      return 5;
  }
}

/** 势力库存加一件（不存在则建）。 */
function addToInventory(s: GameState, fid: number, itemId: number, count = 1): GameState {
  const faction = s.factions[fid];
  if (!faction) return s;
  const inv = { ...(faction.inventory ?? {}) };
  inv[itemId] = (inv[itemId] ?? 0) + count;
  return { ...s, factions: { ...s.factions, [fid]: { ...faction, inventory: inv } } };
}

/**
 * 大会/事件等奖品直接入势力库存（不自动装备、不改忠诚）。
 * Session 394：武魁大会冠亚奖励。
 */
export function grantItemToFactionInventory(
  state: GameState,
  factionId: number,
  itemId: number,
  logMessage: string,
): GameState {
  const item = itemById(itemId);
  if (!item || !state.factions[factionId]) return state;
  const s = addToInventory(state, factionId, itemId);
  return pushLog(s, 'item_tournament', logMessage);
}

/**
 * 尝试从势力库存扣 1 件；不足或势力不存在返回 null（不抛错）。
 * Session 396：大会轮间用药。
 */
export function tryConsumeFactionInventoryItem(
  state: GameState,
  factionId: number,
  itemId: number,
): GameState | null {
  if (!state.factions[factionId]) return null;
  if ((state.factions[factionId].inventory?.[itemId] ?? 0) < 1) return null;
  return removeFromInventory(state, factionId, itemId, 1);
}

/** 势力库存扣一件；不足抛错。 */
function removeFromInventory(s: GameState, fid: number, itemId: number, count = 1): GameState {
  const faction = s.factions[fid];
  const inv = { ...(faction.inventory ?? {}) };
  const have = inv[itemId] ?? 0;
  if (have < count) throw new Error('势力库存宝物不足');
  if (have === count) delete inv[itemId];
  else inv[itemId] = have - count;
  return { ...s, factions: { ...s.factions, [fid]: { ...faction, inventory: inv } } };
}

/** 武将装备宝物（须先在势力库存中；槽位匹配 + 门槛校验）。 */
export function equipItem(state: GameState, officerId: number, itemId: number): GameState {
  const officer = state.officers[officerId];
  if (!officer) throw new Error('武将不存在');
  if (officer.faction == null) throw new Error('在野武将不可装备');
  const item = itemById(itemId);
  if (!item) throw new Error('宝物不存在');
  const slot = equipSlotFor(item.category);
  if (!slot) throw new Error('该宝物品类不入装备槽（存势力库存）');
  const fid = officer.faction;
  if ((state.factions[fid].inventory?.[itemId] ?? 0) < 1) {
    throw new Error(`${item.name} 不在势力库存中`);
  }
  const check = canEquipItem(officer, item);
  if (!check.ok) throw new Error(`${item.name} 无法装备：${check.reason}`);
  const equipment = { ...(officer.equipment ?? {}) };
  if (equipment[slot] != null) {
    throw new Error(`该槽位已装备其他宝物（${itemById(equipment[slot]!)?.name ?? '未知'}）`);
  }
  equipment[slot] = itemId;
  const officers = {
    ...state.officers,
    [officerId]: { ...officer, equipment },
  };
  let s: GameState = { ...state, officers };
  s = removeFromInventory(s, fid, itemId);
  return pushLog(
    s,
    'item_equip',
    `${officer.name} 装备 ${item.name}`,
  );
}

/** 卸下宝物回势力库存。 */
export function unequipItem(state: GameState, officerId: number, itemId: number): GameState {
  const officer = state.officers[officerId];
  if (!officer) throw new Error('武将不存在');
  if (officer.faction == null) throw new Error('在野武将不可卸下');
  const equipment = { ...(officer.equipment ?? {}) };
  const slot = (Object.keys(equipment) as Array<keyof typeof equipment>).find(
    (k) => equipment[k] === itemId,
  );
  if (slot == null) throw new Error('该宝物未装备在此武将身上');
  const item = itemById(itemId);
  delete equipment[slot];
  const officers = {
    ...state.officers,
    [officerId]: { ...officer, equipment },
  };
  let s: GameState = { ...state, officers };
  s = addToInventory(s, officer.faction, itemId);
  return pushLog(
    s,
    'item_unequip',
    `${officer.name} 卸下 ${item?.name ?? '宝物'}`,
  );
}

/**
 * docs/05 §11.2 战利品：胜者缴获败者阵亡/被俘主将单件装备概率
 *（Session 436 实装，S4c 被俘没收沿用；六角单挑/亲统生擒共用）。
 */
export const LOOT_EQUIPMENT_CHANCE = 0.3;

/**
 * docs/05 §11.2（Session 440 S4c，沿 436 口径）：被俘没收掷点——装备按件独立
 * `chance` 整件入库，未中件保留；纯函数（调用方守卫无装备不调用 → 零 RNG 消耗）。
 * 槽序固定（军序由调用方保证），与 `seizeKilledEquipment` 同口径。
 */
export function rollCaptiveEquipmentLoot(
  equipment: Equipment | undefined,
  inventory: ItemInventory | undefined,
  chance: number,
  rng: () => number,
): { equipment: Equipment; inventory: ItemInventory; names: string[] } {
  const order = ['weaponPrimary', 'weaponSecondary', 'armor', 'mount', 'tome'] as const;
  const kept: Equipment = { ...(equipment ?? {}) };
  const stock: ItemInventory = { ...(inventory ?? {}) };
  const names: string[] = [];
  for (const slot of order) {
    const id = kept[slot];
    if (id == null) continue;
    if (rng() < chance) {
      stock[id] = (stock[id] ?? 0) + 1;
      delete kept[slot];
      names.push(itemById(id)?.name ?? `宝物${id}`);
    }
  }
  return { equipment: kept, inventory: stock, names };
}

/** 快捷槽上限（docs/04 §12.3）：至多 2 种，每种叠加 ≤99。 */
export const CONSUMABLE_SLOT_KINDS = 2;
export const CONSUMABLE_SLOT_COUNT_MAX = 99;

/**
 * docs/04 §12.3（Session 435）：从势力库存分配 N 件消耗品至武将快捷槽。
 * 同类叠加（总量 ≤99），新种类需空槽（至多 2 种）；count 缺省 1。
 * 在野/阵亡拒绝；非消耗品、数量非法、库存不足拒绝。零 RNG，日志 `item_assign`。
 */
export function assignConsumableToSlot(
  state: GameState,
  officerId: number,
  itemId: number,
  count = 1,
): GameState {
  const officer = state.officers[officerId];
  if (!officer) throw new Error('武将不存在');
  if (officer.faction == null) throw new Error('在野武将不可分配消耗品');
  if (officer.status === OfficerStatus.DEAD) throw new Error('阵亡武将不可分配消耗品');
  const item = itemById(itemId);
  if (!item) throw new Error('宝物不存在');
  if (item.category !== 'consumable' || !item.consumable) {
    throw new Error(`${item.name} 不是消耗品`);
  }
  if (!Number.isInteger(count) || count < 1) throw new Error('分配数量须为正整数');
  const fid = officer.faction;
  if ((state.factions[fid].inventory?.[itemId] ?? 0) < count) {
    throw new Error(`${item.name} 势力库存不足`);
  }
  const slots = [...(officer.consumableSlots ?? [])];
  const existing = slots.find((slot) => slot.itemId === itemId);
  if (existing) {
    if (existing.count + count > CONSUMABLE_SLOT_COUNT_MAX) {
      throw new Error(`${item.name} 快捷槽已达叠加上限（99）`);
    }
    existing.count += count;
  } else {
    if (slots.length >= CONSUMABLE_SLOT_KINDS) {
      throw new Error('快捷槽已满（至多携带 2 种消耗品）');
    }
    slots.push({ itemId, count });
  }
  let s: GameState = {
    ...state,
    officers: { ...state.officers, [officerId]: { ...officer, consumableSlots: slots } },
  };
  s = removeFromInventory(s, fid, itemId, count);
  return pushLog(s, 'item_assign', `${officer.name} 携带 ${item.name}×${count}`);
}

/**
 * docs/04 §12.3（Session 435）：从武将快捷槽卸下 N 件消耗品回势力库存。
 * count 缺省整栈（全部卸下）。未携带/数量不足拒绝。零 RNG，日志 `item_unassign`。
 */
export function unassignConsumableFromSlot(
  state: GameState,
  officerId: number,
  itemId: number,
  count?: number,
): GameState {
  const officer = state.officers[officerId];
  if (!officer) throw new Error('武将不存在');
  if (officer.faction == null) throw new Error('在野武将不可卸下消耗品');
  const slots = [...(officer.consumableSlots ?? [])];
  const index = slots.findIndex((slot) => slot.itemId === itemId);
  if (index < 0) throw new Error('该武将快捷槽未携带此消耗品');
  const slot = slots[index]!;
  const take = count ?? slot.count;
  if (!Number.isInteger(take) || take < 1 || take > slot.count) {
    throw new Error('卸下数量非法');
  }
  if (take === slot.count) slots.splice(index, 1);
  else slots[index] = { itemId, count: slot.count - take };
  const nextOfficer: Officer = { ...officer };
  if (slots.length > 0) nextOfficer.consumableSlots = slots;
  else delete nextOfficer.consumableSlots;
  let s: GameState = { ...state, officers: { ...state.officers, [officerId]: nextOfficer } };
  s = addToInventory(s, officer.faction, itemId, take);
  const item = itemById(itemId);
  return pushLog(s, 'item_unassign', `${officer.name} 卸下 ${item?.name ?? '消耗品'}×${take}`);
}

/**
 * 赏赐宝物（04 §11.1）：势力库存出 → 武将自行装备；忠诚+5~20 按品质。
 * §3.8 君主特例：目标为君主时拒绝（君主不参与宝物赏赐记录）。
 */
export function grantTreasure(state: GameState, officerId: number, itemId: number): GameState {
  const officer = state.officers[officerId];
  if (!officer) throw new Error('武将不存在');
  if (officer.faction == null) throw new Error('在野武将不可赏赐宝物');
  const fid = officer.faction;
  const faction = state.factions[fid];
  if (faction.rulerId === officer.id) {
    throw new Error(`${officer.name} 是君主，不参与赏赐宝物（§3.8 君主特例）`);
  }
  const item = itemById(itemId);
  if (!item) throw new Error('宝物不存在');
  const slot = equipSlotFor(item.category);
  if (!slot) throw new Error('该宝物品类不入装备槽（存势力库存）');
  if ((faction.inventory?.[itemId] ?? 0) < 1) {
    throw new Error(`${item.name} 不在势力库存中`);
  }
  const check = canEquipItem(officer, item);
  if (!check.ok) throw new Error(`${item.name} 无法装备：${check.reason}`);
  const equipment = { ...(officer.equipment ?? {}) };
  if (equipment[slot] != null) {
    throw new Error(`该槽位已装备其他宝物（${itemById(equipment[slot]!)?.name ?? '未知'}），请先卸下`);
  }
  const gain = loyaltyGainForQuality(item.quality);
  const loyalty = Math.min(100, officer.loyalty + gain);
  equipment[slot] = itemId;
  const officers = {
    ...state.officers,
    [officerId]: { ...officer, equipment, loyalty },
  };
  let s: GameState = { ...state, officers };
  s = removeFromInventory(s, fid, itemId);
  return pushLog(
    s,
    'item_grant',
    `赏赐 ${item.name} → ${officer.name}（忠诚+${gain}，自动装备）`,
  );
}

/** 搜索宝物入库：从 acquisition 含 'search' 的宝物中确定性挑选一件（不新增 RNG 消费，用既有 roll 派生）。 */
export function searchTreasureIntoInventory(
  state: GameState,
  fid: number,
  roll: number,
): GameState {
  const pool = allItems().filter((i) => i.acquisition.includes(AcquisitionMethod.SEARCH));
  if (pool.length === 0) return state;
  // roll ∈ [0,1) 已由调用方消费；用其小数位派生索引，确定性且不扰动 RNG 流
  const idx = Math.floor(((roll * 1000) % pool.length + pool.length) % pool.length);
  const item = pool[idx];
  let s = addToInventory(state, fid, item.id);
  return pushLog(
    s,
    'item_search',
    `寻得宝物：${item.name}（入势力库存）`,
  );
}

/** 初始宝配（createGame 时调用）：按剧本武将装备签名宝物，其余 acquisition 含 'initial' 的宝物入库存。 */
export function applyInitialItems(state: GameState): GameState {
  let s = state;
  const items = allItems();
  const initialPool = items.filter((i) => i.acquisition.includes(AcquisitionMethod.INITIAL));
  // 签名装备映射：武将 id → 宝物 id（0-A 30 将核心签名）
  const signature: Record<number, number> = {
    5: 2,   // 吕布 方天画戟
    6: 1,   // 关羽 青龙偃月刀
    7: 3,   // 张飞 丈八蛇矛
    1: 4,   // 曹操 倚天剑
    2: 5,   // 刘备 雌雄双股剑
    10: 6,  // 赵云 宝雕弓（银枪未入 0-A 数据，弓兜底）
    4: 13,  // 诸葛亮 孙子兵法
  };
  const equippedIds = new Set<number>();
  for (const [officerId, itemId] of Object.entries(signature)) {
    const officer = s.officers[Number(officerId)];
    const item = itemById(itemId);
    if (!officer || officer.faction == null || !item) continue;
    const slot = equipSlotFor(item.category);
    if (!slot) continue;
    const check = canEquipItem(officer, item);
    if (!check.ok) continue;
    const equipment = { ...(officer.equipment ?? {}), [slot]: itemId };
    s = {
      ...s,
      officers: { ...s.officers, [officer.id]: { ...officer, equipment } },
    };
    equippedIds.add(itemId);
  }
  // 剩余 initial 宝物入势力库存（该势力）
  for (const item of initialPool) {
    if (equippedIds.has(item.id)) continue;
    for (const fid of Object.keys(s.factions)) {
      const f = s.factions[Number(fid)];
      if (!f.isAlive) continue;
      s = addToInventory(s, f.id, item.id);
    }
  }
  return s;
}

/** 可搜索宝物池（供验证断言）。 */
export function searchableItems(): ItemStatic[] {
  return allItems().filter((i) => i.acquisition.includes(AcquisitionMethod.SEARCH));
}

/** 供验证/测试使用的内部导出。 */
export const itemsTestHooks = {
  addToInventory,
  removeFromInventory,
  itemById,
};

/**
 * S13 消耗品运行时（Session 432）：使用势力库存中的消耗品。
 * docs/08 §四 consumable 配置；效果映射：
 * - stamina / heal → 武将体力恢复（heal 以体力代理伤势，0-A 口径；上限 calcStaminaMax）
 * - morale → 武将所在城部队士气 +value（0~100）
 * - food → 武将所在城军粮 +value
 * - 其余类型（cure/poison_weapon/stun/war_boost/intel_boost/calm）依赖未实装系统，
 *   明确报错后置。零 RNG、零新存档字段。
 */
export function useConsumable(state: GameState, officerId: number, itemId: number): GameState {
  const officer = state.officers[officerId];
  if (!officer) throw new Error('武将不存在');
  if (officer.faction == null) throw new Error('在野武将不可使用势力库存消耗品');
  const item = itemById(itemId);
  if (!item) throw new Error('宝物不存在');
  if (item.category !== 'consumable' || !item.consumable) {
    throw new Error(`${item.name} 不是消耗品`);
  }
  const fid = officer.faction;
  // Session 435：快捷槽优先，槽与库存合计不足才拒绝（报错沿 432 口径，不断言）。
  const slotCount = (officer.consumableSlots ?? []).find((slot) => slot.itemId === itemId)?.count ?? 0;
  if (slotCount + (state.factions[fid].inventory?.[itemId] ?? 0) < 1) {
    throw new Error(`${item.name} 不在势力库存中`);
  }
  if (officer.status === OfficerStatus.DEAD) throw new Error('阵亡武将不可使用消耗品');

  const effect = item.consumable.effect;
  const applyStamina = (target: Officer): Officer => {
    const max = calcStaminaMax(target, meritLevelFor(target.merit ?? 0), state.currentYear - target.birthYear);
    if ((target.stamina ?? 0) >= max) throw new Error(`${target.name} 体力已满，无需使用${item.name}`);
    return { ...target, stamina: Math.min(max, (target.stamina ?? 0) + effect.value) };
  };

  let officers = state.officers;
  let cities = state.cities;
  let used = false;

  switch (effect.type) {
    case 'stamina':
    case 'heal': {
      officers = { ...officers, [officerId]: applyStamina(officer) };
      used = true;
      break;
    }
    case 'morale': {
      const cityId = officer.location;
      const city = cityId != null ? cities[cityId] : undefined;
      if (!city) throw new Error('武将不在城中，无法使用士气类消耗品');
      cities = {
        ...cities,
        [city.id]: { ...city, troopsMorale: Math.max(0, Math.min(100, city.troopsMorale + effect.value)) },
      };
      used = true;
      break;
    }
    case 'food': {
      const cityId = officer.location;
      const city = cityId != null ? cities[cityId] : undefined;
      if (!city) throw new Error('武将不在城中，无法使用军粮类消耗品');
      cities = { ...cities, [city.id]: { ...city, food: city.food + effect.value } };
      used = true;
      break;
    }
    default:
      throw new Error(`消耗品效果「${effect.type}」暂未接入运行时`);
  }
  if (!used) throw new Error('消耗品使用失败');

  let s: GameState = { ...state, officers, cities };
  // Session 435：优先扣快捷槽（归零删格），槽空回退扣势力库存。
  const afterOfficer = s.officers[officerId]!;
  const afterSlots = [...(afterOfficer.consumableSlots ?? [])];
  const afterIndex = afterSlots.findIndex((slot) => slot.itemId === itemId);
  if (afterIndex >= 0) {
    const slot = afterSlots[afterIndex]!;
    if (slot.count > 1) afterSlots[afterIndex] = { itemId, count: slot.count - 1 };
    else afterSlots.splice(afterIndex, 1);
    const updated: Officer = { ...afterOfficer };
    if (afterSlots.length > 0) updated.consumableSlots = afterSlots;
    else delete updated.consumableSlots;
    s = { ...s, officers: { ...s.officers, [officerId]: updated } };
  } else {
    s = tryConsumeFactionInventoryItem(s, fid, itemId) ?? s;
  }
  return pushLog(s, 'item_use', `${officer.name} 使用 ${item.name}`);
}
