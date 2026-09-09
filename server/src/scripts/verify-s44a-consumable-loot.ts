// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 438 S4a · S13 消耗品缴获验证（docs/44 D4：阵亡者快捷槽每种独立
 * 30% 整叠转移，`LOOT_CONSUMABLE_CHANCE`，复用 436 模式）。
 *
 * 断言面：
 *   1. 攻方胜歼敌：阵亡敌将快捷槽消耗品按 30%/种整叠缴获
 *      （守恒：胜者库存增量 + 原方回库 + 尸身槽余量 = 战前槽总量；
 *      Session 439 S4b 起标死者尸身恒空，余量计入原方回库）；
 *   2. 缴获入胜者势力库存，未中种留原主尸身槽；战报追加「缴获…×N」；
 *   3. 攻方败：守方缴获阵亡攻方快捷槽消耗品（方向对称，战败报「被缴获」）；
 *   4. 同种子同缴获（确定性）；无槽阵亡者无「×N」缴获标记（零 RNG 扰动）；
 *   5. 完整 GameStateSchema；金样影响扫描（actionLog 缴获有无）。
 */
import {
  DipRelation,
  FormationType,
  GameStateSchema,
  SerializableRng,
  UnitType,
  type CampaignArmy,
  type GameState,
  type SiegeState,
} from '@leh/shared';
import { assaultForFaction } from '../engine/campaign.js';
import { assignConsumableToSlot, grantItemToFactionInventory } from '../engine/items.js';
import { createGame, endTurn, getGame } from '../services/game.js';

let pass = 0;
let fail = 0;
function assert(cond: unknown, msg: string): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

function freshState(): GameState {
  createGame(1, 2);
  return getGame();
}

/** 外交：曹操(1) 对刘备(2) 置 war（野战敌军可被检索）。 */
function setWar12(state: GameState): GameState {
  const link = state.diplomacy.find(
    (d) => (d.factionA === 1 && d.factionB === 2) || (d.factionA === 2 && d.factionB === 1),
  );
  return {
    ...state,
    diplomacy: link
      ? state.diplomacy.map((d) => (d === link ? { ...d, relation: DipRelation.WAR } : d))
      : [...state.diplomacy, { factionA: 1, factionB: 2, relation: DipRelation.WAR, favorability: -80 }],
  };
}

/** 把武将调到前线（location 指向出发城并移出名册，仿 startCampaign 语义）。 */
function deployOfficer(state: GameState, officerId: number, fromNodeId: number): GameState {
  const officer = state.officers[officerId];
  if (!officer) throw new Error(`武将 ${officerId} 不存在`);
  const cities = { ...state.cities };
  for (const city of Object.values(state.cities)) {
    if (!city.officers.includes(officerId)) continue;
    cities[city.id] = { ...city, officers: city.officers.filter((id) => id !== officerId) };
  }
  return {
    ...state,
    cities,
    officers: { ...state.officers, [officerId]: { ...officer, location: fromNodeId } },
  };
}

function siegeStateOf(state: GameState, cityId: number, siegeTurns = 0): SiegeState {
  const wall = (state.cities[cityId]?.stats.wall ?? 0) * 100;
  return {
    wallDurability: wall,
    maxWallDurability: wall,
    gateDurability: 100,
    siegeTurns,
    attackerStructures: [],
    defenderBonus: 0,
    surrenderChance: 10,
  };
}

function siegeArmy(
  overrides: Partial<CampaignArmy> & { id: string; commanderId: number; troops: number; factionId?: number },
): CampaignArmy {
  return {
    factionId: 2,
    name: `${overrides.id}军`,
    subCommanderIds: [],
    unitType: UnitType.LIGHT_INFANTRY,
    formation: FormationType.SQUARE,
    currentNodeId: 13,
    targetNodeId: 13,
    path: [],
    phase: 'sieging',
    maxTroops: overrides.troops,
    food: 3000,
    maxFood: 9000,
    morale: 80,
    organization: 80,
    experience: 0,
    fatigue: 0,
    squads: [],
    structures: [],
    fromNodeId: 15,
    ...overrides,
  };
}

/** 快捷槽总量（指定若干消耗品 id 在槽内的件数之和）。 */
function slotTotal(state: GameState, officerId: number, itemIds: readonly number[]): number {
  const slots = state.officers[officerId]?.consumableSlots ?? [];
  return slots.filter((s) => itemIds.includes(s.itemId)).reduce((n, s) => n + s.count, 0);
}

/** 势力库存中指定若干消耗品的件数之和。 */
function inventoryTotal(state: GameState, factionId: number, itemIds: readonly number[]): number {
  const inv = state.factions[factionId]?.inventory ?? {};
  return itemIds.reduce((n, id) => n + (inv[id] ?? 0), 0);
}

/** S4a 布景消耗品：行军散(140 stamina) + 杜康酒(151 morale)，均为真实消耗品。 */
const LOOT_IDS = [140, 151] as const;

/** 给武将配满两槽消耗品：势力入库 → 快捷槽（140×5，151×3）。 */
function stockOfficerSlots(state: GameState, factionId: number, officerId: number): GameState {
  let s = state;
  s = grantItemToFactionInventory(s, factionId, 140, '缴获布景入库');
  s = grantItemToFactionInventory(s, factionId, 140, '缴获布景入库');
  s = grantItemToFactionInventory(s, factionId, 140, '缴获布景入库');
  s = grantItemToFactionInventory(s, factionId, 140, '缴获布景入库');
  s = grantItemToFactionInventory(s, factionId, 140, '缴获布景入库');
  s = grantItemToFactionInventory(s, factionId, 151, '缴获布景入库');
  s = grantItemToFactionInventory(s, factionId, 151, '缴获布景入库');
  s = grantItemToFactionInventory(s, factionId, 151, '缴获布景入库');
  s = assignConsumableToSlot(s, officerId, 140, 5);
  s = assignConsumableToSlot(s, officerId, 151, 3);
  return s;
}

console.log('\n=== Session 438 S4a · S13 消耗品缴获验证 ===\n');

// ---------------------------------------------------------------------------
console.log('1. 攻方胜歼敌：阵亡敌将快捷槽消耗品缴获（守恒 + 入库 + 战报）');
let lootSeed = -1;
let lootBefore = 0;
{
  for (let seed = 1; seed <= 3000 && lootSeed < 0; seed++) {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    s = deployOfficer(s, 7, 14);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    s = stockOfficerSlots(s, 1, aiCmd);
    const worn = slotTotal(s, aiCmd, LOOT_IDS);
    if (worn === 0) continue;
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 8000, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 2) });
    const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: 7, troops: 4000, fromNodeId: 14 });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 1500, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, b, c] };
    const invBefore = inventoryTotal(s, 2, LOOT_IDS);
    const rng = new SerializableRng(seed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    const invGain = inventoryTotal(out.state, 2, LOOT_IDS) - invBefore;
    if (out.result.winner === 'attacker' && out.result.commanderStatus[aiCmd] === 'killed' && invGain > 0) {
      lootSeed = seed;
      lootBefore = worn;
    }
  }
  assert(lootSeed > 0, `猎到敌将阵亡+缴获种子（seed=${lootSeed}，战前槽总量 ${lootBefore} 件）`);
}

if (lootSeed > 0) {
  const run = (): { gain: number; returned: number; onCorpse: number; msg: string; state: GameState } => {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    s = deployOfficer(s, 7, 14);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    s = stockOfficerSlots(s, 1, aiCmd);
    const invBefore = inventoryTotal(s, 2, LOOT_IDS);
    const originBefore = inventoryTotal(s, 1, LOOT_IDS);
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 8000, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 2) });
    const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: 7, troops: 4000, fromNodeId: 14 });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 3000, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, b, c] };
    const rng = new SerializableRng(lootSeed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    const log = out.state.actionLog.find((e) => e.type === 'campaign_field_win' || e.type === 'campaign_capture');
    return {
      gain: inventoryTotal(out.state, 2, LOOT_IDS) - invBefore,
      // Session 439 S4b：标死者余量回原势力库存（退守未标死则留身，恒为 0）
      returned: inventoryTotal(out.state, 1, LOOT_IDS) - originBefore,
      onCorpse: slotTotal(out.state, aiCmd, LOOT_IDS),
      msg: log?.message ?? '',
      state: out.state,
    };
  };
  const first = run();
  const second = run();
  assert(first.gain + first.returned + first.onCorpse === lootBefore, `守恒：缴获 ${first.gain} + 回库 ${first.returned} + 尸身槽 ${first.onCorpse} = 战前 ${lootBefore}`);
  assert(first.gain === second.gain && first.returned === second.returned && first.msg === second.msg, '同种子同缴获（确定性）');
  assert(first.gain > 0, `缴获命中 ${first.gain} 件（种子已预选）`);
  assert(first.msg.includes('缴获') && first.msg.includes('×'), `战报追加缴获（整叠×N）：「${first.msg.slice(-40)}」`);
  assert(GameStateSchema.safeParse(first.state).success, '缴获结算后过完整 GameStateSchema');
}

// ---------------------------------------------------------------------------
console.log('\n2. 攻方败：守方缴获阵亡攻方快捷槽消耗品（方向对称）');
{
  let killSeed = -1;
  let killBefore = 0;
  for (let seed = 501; seed <= 4000 && killSeed < 0; seed++) {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    s = stockOfficerSlots(s, 2, 6);
    const worn = slotTotal(s, 6, LOOT_IDS);
    if (worn === 0) continue;
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 1500, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 1) });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 8000, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, c] };
    const invBefore = inventoryTotal(s, 1, LOOT_IDS);
    const rng = new SerializableRng(seed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    const invGain = inventoryTotal(out.state, 1, LOOT_IDS) - invBefore;
    if (out.result.winner === 'defender' && out.result.commanderStatus[6] === 'killed' && invGain > 0) {
      killSeed = seed;
      killBefore = worn;
    }
  }
  assert(killSeed > 0, `猎到攻方主将阵亡+缴获种子（seed=${killSeed}，战前槽总量 ${killBefore} 件）`);
  if (killSeed > 0) {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    s = stockOfficerSlots(s, 2, 6);
    const invBefore = inventoryTotal(s, 1, LOOT_IDS);
    const originBefore = inventoryTotal(s, 2, LOOT_IDS);
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 1500, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 1) });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 8000, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, c] };
    const rng = new SerializableRng(killSeed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    const gain = inventoryTotal(out.state, 1, LOOT_IDS) - invBefore;
    // Session 439 S4b：攻方主将标死，余量回攻方库存
    const returned = inventoryTotal(out.state, 2, LOOT_IDS) - originBefore;
    const onCorpse = slotTotal(out.state, 6, LOOT_IDS);
    assert(gain + returned + onCorpse === killBefore, `守恒：缴获 ${gain} + 回库 ${returned} + 尸身槽 ${onCorpse} = 战前 ${killBefore}`);
    const log = out.state.actionLog.find((e) => e.type === 'campaign_defeat');
    assert((log?.message.includes('被缴获') ?? false) && (log?.message.includes('×') ?? false), `战败报追加被缴获：${log?.message.slice(-30) ?? ''}`);
    assert(GameStateSchema.safeParse(out.state).success, '战败缴获后过完整 GameStateSchema');
  }
}

// ---------------------------------------------------------------------------
console.log('\n3. 无槽阵亡者零扰动 + 金样影响扫描');
{
  // 阵亡者无槽：即使装备缴获掷点 fire，战报也不应出现消耗品「×N」标记
  let s = freshState();
  s = deployOfficer(s, 6, 15);
  s = deployOfficer(s, 7, 14);
  const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 8000, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 2) });
  const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: 7, troops: 4000, fromNodeId: 14 });
  s = { ...s, campaignArmies: [a, b] };
  const rng = new SerializableRng(7);
  const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
  const killCount = Object.values(out.result.commanderStatus).filter((v) => v === 'killed').length;
  const lootLogs = out.state.actionLog.filter((e) => e.message.includes('；缴获') || e.message.includes('被缴获'));
  if (killCount === 0) {
    assert(lootLogs.length === 0, '无击杀无缴获日志');
  } else {
    assert(lootLogs.every((e) => !e.message.includes('×')), '无槽之战的缴获战报无整叠×N标记（消耗品零掷点）');
  }
  assert(GameStateSchema.safeParse(out.state).success, '无槽结算后过完整 GameStateSchema');
  // 金样 12 月实况扫描：权威 RNG 流是否经过消耗品缴获掷点
  createGame(1, 2);
  for (let i = 0; i < 12; i++) endTurn();
  const hits = getGame().actionLog.filter((e) => e.message.includes('×') && e.message.includes('缴获'));
  console.log(`  ℹ 金样 12 月消耗品缴获日志 ${hits.length} 条${hits.length > 0 ? `（例：${hits[0]?.message.slice(0, 40)}）` : '（金样零扰动）'}`);
}

console.log(`\n=== 结果: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
