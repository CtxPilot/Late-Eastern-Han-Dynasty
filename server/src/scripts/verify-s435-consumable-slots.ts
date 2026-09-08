// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S13 快捷槽分配/携带验证（Session 435，docs/04 §12.3）。
 * 覆盖：分配入槽（叠加/新种类/上限 2 种/叠加 99）、非法拒绝（非消耗品/在野/
 * 阵亡/数量非法/库存不足/槽满）、卸下（部分/整栈/未携带拒绝）、使用扣槽优先
 * + 槽空回退库存、Schema（含非法槽拒绝）与存档往返。
 */
import { GameStateSchema, OfficerStatus } from '@leh/shared';
import { buildGameState } from '../engine/state-pipeline.js';
import {
  assignConsumableToSlot,
  unassignConsumableFromSlot,
  grantItemToFactionInventory,
  useConsumable,
} from '../engine/items.js';
import { staticData } from '../data/loader.js';

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}
function expectThrow(label: string, fn: () => unknown, keyword?: string): void {
  try {
    fn();
    check(`${label}（应抛错）`, false);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    check(`${label}（${msg}）`, keyword == null || msg.includes(keyword));
  }
}

const sc2 = staticData.scenarios.find((s) => s.id === 2)!;
let s = buildGameState(sc2, 1, sc2.defaultEventLayers);
const FID = 1;
const CAO = 1; // 曹操 @ 陈留(7)

// 布景：行军散(140 stamina) ×3、杜康酒(151 morale) ×1、军粮丸(154 food) ×1、青龙偃月刀(1 非消耗品)
s = grantItemToFactionInventory(s, FID, 140, '行军散入库');
s = grantItemToFactionInventory(s, FID, 140, '行军散入库');
s = grantItemToFactionInventory(s, FID, 140, '行军散入库');
s = grantItemToFactionInventory(s, FID, 151, '杜康酒入库');
s = grantItemToFactionInventory(s, FID, 154, '军粮丸入库');
s = grantItemToFactionInventory(s, FID, 1, '青龙偃月刀入库');
s = { ...s, officers: { ...s.officers, [CAO]: { ...s.officers[CAO], stamina: 10 } } };

// 1. 分配入槽：140×1 → 槽[{140,1}]，库存 3→2
s = assignConsumableToSlot(s, CAO, 140);
check('分配后槽位 [{140,1}]', JSON.stringify(s.officers[CAO].consumableSlots) === JSON.stringify([{ itemId: 140, count: 1 }]));
check('分配后库存 3→2', (s.factions[FID].inventory?.[140] ?? 0) === 2);
check('行动日志 item_assign', s.actionLog[0]?.type === 'item_assign');

// 2. 同类叠加：再分配 140×2 → 槽[{140,3}]，库存 2→0
s = assignConsumableToSlot(s, CAO, 140, 2);
check('同类叠加至 3', s.officers[CAO].consumableSlots?.[0]?.count === 3);
check('库存扣光', (s.factions[FID].inventory?.[140] ?? 0) === 0);

// 3. 第二种：151 入槽 → 2 槽
s = assignConsumableToSlot(s, CAO, 151);
check('第二种入槽（2 槽）', s.officers[CAO].consumableSlots?.length === 2);

// 4. 第三种 → 拒绝（至多 2 种）
expectThrow('第三种消耗品应拒绝', () => assignConsumableToSlot(s, CAO, 154), '至多携带 2 种');

// 5. 非消耗品/数量非法/库存不足 → 拒绝
expectThrow('非消耗品应拒绝', () => assignConsumableToSlot(s, CAO, 1), '不是消耗品');
expectThrow('数量 0 应拒绝', () => assignConsumableToSlot(s, CAO, 151, 0), '正整数');
expectThrow('库存不足应拒绝', () => assignConsumableToSlot(s, CAO, 140), '库存不足');

// 6. 在野/阵亡 → 拒绝
const freeState = { ...s, officers: { ...s.officers, [2]: { ...s.officers[2], faction: null, location: null } } };
expectThrow('在野武将分配应拒绝', () => assignConsumableToSlot(freeState, 2, 151), '在野武将不可分配');
const deadState = { ...s, officers: { ...s.officers, [CAO]: { ...s.officers[CAO], status: OfficerStatus.DEAD } } };
expectThrow('阵亡武将分配应拒绝', () => assignConsumableToSlot(deadState, CAO, 151), '阵亡武将不可分配');

// 7. 叠加上限 99：151 槽 count=1，补 98 → 99；再加 1 → 拒绝
for (let i = 0; i < 98; i++) s = grantItemToFactionInventory(s, FID, 151, '杜康酒入库');
s = assignConsumableToSlot(s, CAO, 151, 98);
check('叠加至上限 99', s.officers[CAO].consumableSlots?.find((x) => x.itemId === 151)?.count === 99);
s = grantItemToFactionInventory(s, FID, 151, '杜康酒入库');
expectThrow('超 99 应拒绝', () => assignConsumableToSlot(s, CAO, 151), '叠加上限');

// 8. 卸下部分：151 卸 4 → 槽 95，库存 +4
s = unassignConsumableFromSlot(s, CAO, 151, 4);
check('卸下部分 99→95', s.officers[CAO].consumableSlots?.find((x) => x.itemId === 151)?.count === 95);
check('卸下回库存 +4', (s.factions[FID].inventory?.[151] ?? 0) === 5);
check('行动日志 item_unassign', s.actionLog[0]?.type === 'item_unassign');

// 9. 卸下整栈：140 整栈卸下 → 槽删除，库存 +3
s = unassignConsumableFromSlot(s, CAO, 140);
check('整栈卸下删格', !(s.officers[CAO].consumableSlots ?? []).some((x) => x.itemId === 140));
check('整栈回库存 +3', (s.factions[FID].inventory?.[140] ?? 0) === 3);
expectThrow('未携带卸下应拒绝', () => unassignConsumableFromSlot(s, CAO, 140), '未携带');
expectThrow('超量卸下应拒绝', () => unassignConsumableFromSlot(s, CAO, 151, 96), '卸下数量非法');

// 10. 使用扣槽优先：151 槽 95 + 库存 4 → 使用 1 次，槽 94，库存不动
const moraleBefore = s.cities[7].troopsMorale;
s = useConsumable(s, CAO, 151);
check('使用扣槽（95→94）', s.officers[CAO].consumableSlots?.find((x) => x.itemId === 151)?.count === 94);
check('扣槽时库存不动', (s.factions[FID].inventory?.[151] ?? 0) === 5);
check('杜康酒士气生效', s.cities[7].troopsMorale === Math.min(100, moraleBefore + 10));

// 11. 槽空回退库存：140 无槽 + 库存 3 → 使用扣库存
const staminaBefore = s.officers[CAO].stamina;
s = useConsumable(s, CAO, 140);
check('回退扣库存（3→2）', (s.factions[FID].inventory?.[140] ?? 0) === 2);
check('行军散体力生效', s.officers[CAO].stamina === staminaBefore + 15);

// 12. 槽空删字段：151 整栈卸下 → consumableSlots 字段清理
s = unassignConsumableFromSlot(s, CAO, 151);
check('全卸后字段清理', s.officers[CAO].consumableSlots == null);

// 13. Schema：合法槽（2 种/99 上限）通过；非法（3 种/count 0/count 100）拒绝
check('合法槽过 Schema', GameStateSchema.safeParse(s).success);
const badKinds = {
  ...s,
  officers: {
    ...s.officers,
    [CAO]: {
      ...s.officers[CAO],
      consumableSlots: [
        { itemId: 140, count: 1 },
        { itemId: 151, count: 1 },
        { itemId: 154, count: 1 },
      ],
    },
  },
};
check('3 种槽 Schema 拒绝', !GameStateSchema.safeParse(badKinds).success);
const badCount = {
  ...s,
  officers: {
    ...s.officers,
    [CAO]: { ...s.officers[CAO], consumableSlots: [{ itemId: 140, count: 100 }] },
  },
};
check('count 100 Schema 拒绝', !GameStateSchema.safeParse(badCount).success);

// 14. 存档往返：JSON 序列化后槽位保持 + Schema 通过
const revived = JSON.parse(JSON.stringify(s)) as typeof s;
check('往返后槽位保持', JSON.stringify(revived.officers[CAO].consumableSlots) === JSON.stringify(s.officers[CAO].consumableSlots));
check('往返后过 Schema', GameStateSchema.safeParse(revived).success);

console.log(`\n结果：${passed} 通过，${failed} 失败`);
if (failed > 0) process.exit(1);
