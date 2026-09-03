// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S13 消耗品运行时验证（Session 432）。
 * 覆盖：stamina/heal 体力恢复、morale 城士气、food 军粮、未接入类型拒绝、
 * 非消耗品拒绝、库存不足拒绝、在野武将拒绝、Schema 往返。
 */
import { GameStateSchema, calcStaminaMax, meritLevelFor } from '@leh/shared';
import { buildGameState } from '../engine/state-pipeline.js';
import { useConsumable, grantItemToFactionInventory, getItemById } from '../engine/items.js';
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

// 布景：库存注入消耗品 + 曹操体力压到 10
s = grantItemToFactionInventory(s, FID, 140, '行军散入库'); // stamina +15
s = grantItemToFactionInventory(s, FID, 151, '杜康酒入库'); // morale +10
s = grantItemToFactionInventory(s, FID, 154, '军粮丸入库'); // food +200
s = grantItemToFactionInventory(s, FID, 141, '避瘟散入库'); // cure（未接入）
s = grantItemToFactionInventory(s, FID, 1, '青龙偃月刀入库'); // 非消耗品
s = { ...s, officers: { ...s.officers, [CAO]: { ...s.officers[CAO], stamina: 10 } } };

const caoMax = calcStaminaMax(s.officers[CAO], meritLevelFor(s.officers[CAO].merit ?? 0), s.currentYear - s.officers[CAO].birthYear);
const foodBefore = s.cities[7].food;
const moraleBefore = s.cities[7].troopsMorale;

// 1. 行军散：体力 10 → 25，库存扣减
s = useConsumable(s, CAO, 140);
check('行军散恢复体力 10→25', s.officers[CAO].stamina === 25);
check('行军散库存已扣减', (s.factions[FID].inventory?.[140] ?? 0) === 0);
check('行动日志 item_use', s.actionLog[0]?.type === 'item_use');
check('体力不超过上限', s.officers[CAO].stamina <= caoMax);

// 2. 杜康酒：陈留士气 +10
s = useConsumable(s, CAO, 151);
check('杜康酒提升城防士气', s.cities[7].troopsMorale === Math.min(100, moraleBefore + 10));

// 3. 军粮丸：陈留军粮 +200
s = useConsumable(s, CAO, 154);
check('军粮丸补充军粮', s.cities[7].food === foodBefore + 200);

// 4. 避瘟散（cure）未接入 → 拒绝
expectThrow('避瘟散（cure）未接入应拒绝', () => useConsumable(s, CAO, 141), '暂未接入运行时');

// 5. 非消耗品（青龙偃月刀）→ 拒绝
expectThrow('非消耗品应拒绝', () => useConsumable(s, CAO, 1), '不是消耗品');

// 6. 库存不足 → 拒绝
expectThrow('库存不足应拒绝', () => useConsumable(s, CAO, 140), '不在势力库存中');

// 7. 在野武将 → 拒绝（构造在野：直接改 faction）
const freeState = { ...s, officers: { ...s.officers, [2]: { ...s.officers[2], faction: null, location: null } } };
expectThrow('在野武将应拒绝', () => useConsumable(freeState, 2, 151), '在野武将不可使用');

// 8. 体力已满 → 拒绝
const fullState = { ...s, officers: { ...s.officers, [CAO]: { ...s.officers[CAO], stamina: caoMax } } };
const fullStateWithItem = grantItemToFactionInventory(fullState, FID, 140, '再入一枚');
expectThrow('体力已满应拒绝', () => useConsumable(fullStateWithItem, CAO, 140), '体力已满');

// 9. Schema 往返
check('完整 GameStateSchema 接受', GameStateSchema.safeParse(s).success);

// 10. 目录核对：140/151/154 均为 consumable 配置
check('目录 consumable 配置存在', [140, 151, 154].every((id) => getItemById(id)?.category === 'consumable' && getItemById(id)?.consumable != null));

console.log(`\n结果：${passed} 通过，${failed} 失败`);
if (failed > 0) process.exit(1);
