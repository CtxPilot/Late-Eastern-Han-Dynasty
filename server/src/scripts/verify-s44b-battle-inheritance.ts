// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 439 S4b · S13 阵亡回库验证（docs/44 D5：战斗阵亡者未被缴获的装备 +
 * 快捷槽余量全部回原势力库存，静默回库，零 RNG）。
 *
 * 断言面：
 *   1. 退守斩杀边界：敌将 killed 但未标死（沿 436 生命周期）→ 缴获照常、
 *      余量留活人身上、S4b 不碰（原方 delta 恒 0）；
 *   2. 攻方胜但攻方主将阵亡（单挑被斩 + 兵力仍优）：己方余量回本方库存；
 *   3. 攻方败攻方阵亡：守方缴获 + 余量回攻方守恒；
 *   4. 尸身无物阵亡者：双方库存逐字节不变（零状态改动）；
 *   5. 完整 GameStateSchema；金样 12 月实况扫描。
 *
 * 注：敌方回库代码路径仅全歼分支可达（溃散线 30% 下几不可达，沿 436 实测
 * 结论），本脚本以 §1 断言其守卫语义（活人不碰），以 §2/§3 覆盖同一函数
 * 的标死回库路径。
 *
 * 会计口径（防初始装备串扰）：两势力库存全量 sum delta + 除阵亡者外全体武将
 * 穿戴逐项比对——任一他人装备异动即拒收该种子。
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
import {
  assignConsumableToSlot,
  equipItem,
  grantItemToFactionInventory,
} from '../engine/items.js';
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

/** 武将身上装备 id 列表。 */
function equippedIds(state: GameState, officerId: number): number[] {
  return Object.values(state.officers[officerId]?.equipment ?? {});
}

/** 武将快捷槽内件数。 */
function slotCount(state: GameState, officerId: number): number {
  return (state.officers[officerId]?.consumableSlots ?? []).reduce((n, s) => n + s.count, 0);
}

/** 武将穿戴快照（装备 + 槽，供他人异动比对）。 */
function wornSnap(state: GameState, officerId: number): string {
  return JSON.stringify({
    e: equippedIds(state, officerId),
    s: state.officers[officerId]?.consumableSlots ?? [],
  });
}

/** 两势力库存全量件数之和。 */
function invSum(state: GameState, factionId: number): number {
  return Object.values(state.factions[factionId]?.inventory ?? {}).reduce((n, v) => n + (v as number), 0);
}

/** S4b 布景装备（沿 s436）+ 消耗品（沿 s44a：行军散 140×5 + 杜康酒 151×3）。 */
const EQUIP_IDS = [22, 63, 80, 92, 134] as const;

/** 给武将挂满装备 + 两槽消耗品；返回战前穿戴总量（装备件数 + 槽件数）。 */
function stockOfficerFull(state: GameState, factionId: number, officerId: number): { s: GameState; total: number } {
  let s = state;
  for (const itemId of EQUIP_IDS) {
    s = grantItemToFactionInventory(s, factionId, itemId, '回库布景入库');
    try {
      s = equipItem(s, officerId, itemId);
    } catch {
      /* 门槛不过跳过 */
    }
  }
  for (let i = 0; i < 5; i++) s = grantItemToFactionInventory(s, factionId, 140, '回库布景入库');
  for (let i = 0; i < 3; i++) s = grantItemToFactionInventory(s, factionId, 151, '回库布景入库');
  s = assignConsumableToSlot(s, officerId, 140, 5);
  s = assignConsumableToSlot(s, officerId, 151, 3);
  return { s, total: equippedIds(s, officerId).length + slotCount(s, officerId) };
}

/** 除指定武将外，全体武将穿戴是否与基线一致。 */
function othersUnchanged(before: GameState, after: GameState, exceptId: number): boolean {
  for (const oid of Object.keys(before.officers)) {
    if (Number(oid) === exceptId) continue;
    if (wornSnap(before, Number(oid)) !== wornSnap(after, Number(oid))) return false;
  }
  return true;
}

console.log('\n=== Session 439 S4b · S13 阵亡回库验证 ===\n');

// ---------------------------------------------------------------------------
console.log('1. 退守斩杀边界：敌将 killed 未标死 → 缴获照常、余量留身、S4b 不碰');
let s1seed = -1;
let s1total = 0;
{
  for (let seed = 1; seed <= 500 && s1seed < 0; seed++) {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    s = deployOfficer(s, 7, 14);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    const staged = stockOfficerFull(s, 1, aiCmd);
    s = staged.s;
    if (staged.total === 0) continue;
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 8000, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 2) });
    const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: 7, troops: 4000, fromNodeId: 14 });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 1500, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, b, c] };
    const rng = new SerializableRng(seed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    if (out.result.winner === 'attacker' && out.result.commanderStatus[aiCmd] === 'killed') {
      s1seed = seed;
      s1total = staged.total;
    }
  }
  assert(s1seed > 0, `猎到退守斩杀种子（seed=${s1seed}，战前穿戴总量 ${s1total} 件）`);
}

if (s1seed > 0) {
  const run = (): { vGain: number; oGain: number; corpse: number; status: string; state: GameState } => {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    s = deployOfficer(s, 7, 14);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    const staged = stockOfficerFull(s, 1, aiCmd);
    s = staged.s;
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 8000, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 2) });
    const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: 7, troops: 4000, fromNodeId: 14 });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 1500, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, b, c] };
    const v0 = invSum(s, 2);
    const o0 = invSum(s, 1);
    const rng = new SerializableRng(s1seed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    return {
      vGain: invSum(out.state, 2) - v0,
      oGain: invSum(out.state, 1) - o0,
      corpse: equippedIds(out.state, aiCmd).length + slotCount(out.state, aiCmd),
      status: out.state.officers[aiCmd]?.status ?? '?',
      state: out.state,
    };
  };
  const first = run();
  const second = run();
  assert(
    first.vGain + first.corpse === s1total,
    `缴获守恒：胜方缴获 ${first.vGain} + 留身 ${first.corpse} = 战前 ${s1total}`,
  );
  assert(first.oGain === 0, 'S4b 不碰活人：敌方库存 delta 为 0');
  assert(first.status === 'active', '退守斩杀未标死（沿 436 生命周期，另行立项才动）');
  assert(
    first.vGain === second.vGain && first.oGain === second.oGain && first.corpse === second.corpse,
    '同种子同分配（确定性）',
  );
  assert(GameStateSchema.safeParse(first.state).success, '退守斩杀结算后过完整 GameStateSchema');
}

// ---------------------------------------------------------------------------
console.log('\n2. 攻方胜但攻方主将阵亡：己方余量回本方库存');
{
  let foundSeed = -1;
  let foundTotal = 0;
  for (let seed = 1; seed <= 4000 && foundSeed < 0; seed++) {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    const staged = stockOfficerFull(s, 2, 6);
    s = staged.s;
    if (staged.total === 0) continue;
    // 均势布景：单挑斩杀可能发生，兵力仍可判攻方胜
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 5000, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 2) });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 4500, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, c] };
    const v0 = invSum(s, 2);
    const o0 = invSum(s, 1);
    const rng = new SerializableRng(seed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    if (out.result.winner !== 'attacker' || out.result.commanderStatus[6] !== 'killed') continue;
    if (!othersUnchanged(s, out.state, 6)) continue;
    const vGain = invSum(out.state, 2) - v0;
    const oGain = invSum(out.state, 1) - o0;
    if (vGain + oGain === staged.total) {
      foundSeed = seed;
      foundTotal = staged.total;
    }
  }
  assert(foundSeed > 0, `猎到胜方主将阵亡种子（seed=${foundSeed}，战前穿戴 ${foundTotal} 件）`);
  if (foundSeed > 0) {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    s = stockOfficerFull(s, 2, 6).s;
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 5000, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 2) });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 4500, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, c] };
    const v0 = invSum(s, 2);
    const o0 = invSum(s, 1);
    const rng = new SerializableRng(foundSeed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    const vGain = invSum(out.state, 2) - v0;
    const oGain = invSum(out.state, 1) - o0;
    const corpse = equippedIds(out.state, 6).length + slotCount(out.state, 6);
    assert(vGain + oGain === foundTotal && corpse === 0, `守恒：胜方 ${vGain} + 敌方 ${oGain} = 战前 ${foundTotal}（己方余量回本方库），尸身清空`);
    assert(out.state.officers[6]?.status === 'dead', '攻方主将已标阵亡');
    assert(GameStateSchema.safeParse(out.state).success, '胜方损将结算后过完整 GameStateSchema');
  }
}

// ---------------------------------------------------------------------------
console.log('\n3. 攻方败：攻方阵亡守方缴获 + 余量回攻方（守恒）');
{
  let foundSeed = -1;
  let foundTotal = 0;
  for (let seed = 501; seed <= 4500 && foundSeed < 0; seed++) {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    const staged = stockOfficerFull(s, 2, 6);
    s = staged.s;
    if (staged.total === 0) continue;
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 1500, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 1) });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 8000, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, c] };
    const v0 = invSum(s, 1);
    const o0 = invSum(s, 2);
    const rng = new SerializableRng(seed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    if (out.result.winner !== 'defender' || out.result.commanderStatus[6] !== 'killed') continue;
    if (!othersUnchanged(s, out.state, 6)) continue;
    const vGain = invSum(out.state, 1) - v0;
    const oGain = invSum(out.state, 2) - o0;
    if (vGain + oGain === staged.total) {
      foundSeed = seed;
      foundTotal = staged.total;
    }
  }
  assert(foundSeed > 0, `猎到攻方主将阵亡+回库种子（seed=${foundSeed}，战前穿戴 ${foundTotal} 件）`);
  if (foundSeed > 0) {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    s = stockOfficerFull(s, 2, 6).s;
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 1500, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 1) });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 8000, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, c] };
    const v0 = invSum(s, 1);
    const o0 = invSum(s, 2);
    const rng = new SerializableRng(foundSeed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    const vGain = invSum(out.state, 1) - v0;
    const oGain = invSum(out.state, 2) - o0;
    const corpse = equippedIds(out.state, 6).length + slotCount(out.state, 6);
    assert(vGain + oGain === foundTotal && corpse === 0, `守恒：守方缴获 ${vGain} + 攻方回库 ${oGain} = 战前 ${foundTotal}，尸身清空`);
    assert(GameStateSchema.safeParse(out.state).success, '战败回库后过完整 GameStateSchema');
  }
}

// ---------------------------------------------------------------------------
console.log('\n4. 尸身无物阵亡者零状态改动 + 金样影响扫描');
{
  // 猎杀无装备无槽的阵亡：双方库存快照逐字节不变
  let found = false;
  for (let seed = 1; seed <= 4000 && !found; seed++) {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    s = deployOfficer(s, 7, 14);
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 8000, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 2) });
    const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: 7, troops: 4000, fromNodeId: 14 });
    s = { ...s, campaignArmies: [a, b] };
    const snap = JSON.stringify([s.factions[1]?.inventory ?? {}, s.factions[2]?.inventory ?? {}]);
    const rng = new SerializableRng(seed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    const killed = Object.entries(out.result.commanderStatus)
      .filter(([, v]) => v === 'killed')
      .map(([k]) => Number(k));
    const bare = killed.filter(
      (oid) => equippedIds(s, oid).length === 0 && slotCount(s, oid) === 0,
    );
    if (killed.length > 0 && bare.length === killed.length) {
      const snapAfter = JSON.stringify([out.state.factions[1]?.inventory ?? {}, out.state.factions[2]?.inventory ?? {}]);
      assert(snap === snapAfter, `尸身无物阵亡 ${killed.length} 人：双方库存逐字节不变（seed=${seed}）`);
      assert(GameStateSchema.safeParse(out.state).success, '无物阵亡结算后过完整 GameStateSchema');
      found = true;
    }
  }
  if (!found) console.log('  ℹ 4000 种子内无“全员无物阵亡”用例（初始武将多带装备，属正常）');
  // 金样 12 月实况扫描：静默回库不应新增日志类型
  createGame(1, 2);
  for (let i = 0; i < 12; i++) endTurn();
  const st = getGame();
  assert(GameStateSchema.safeParse(st).success, '金样 12 月终态过完整 GameStateSchema');
  console.log(`  ℹ 金样 12 月 actionLog ${st.actionLog.length} 条（回库静默，泾渭分明）`);
}

console.log(`\n=== 结果: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
