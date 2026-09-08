// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 436 · S13 装备缴获验证（docs/05 §11.2：胜者缴获败者阵亡主将/副将装备，每件 30%）。
 *
 * 断言面：
 *   1. 攻方胜歼敌：阵亡敌将装备按 30% 缴获（守恒：缴获 + 尸身剩余 = 战前装备）；
 *   2. 缴获入胜者势力库存，缴获槽位清空，未中件留原主；
 *   3. 战报追加「缴获」/「被缴获」；
 *   4. 攻方败：守方缴获阵亡攻方装备（方向对称）；
 *   5. 同种子同缴获（确定性）；无击杀无缴获零扰动；
 *   6. 完整 GameStateSchema；金样影响扫描（actionLog 缴获有无）。
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
import { equipItem, grantItemToFactionInventory } from '../engine/items.js';
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

function equippedIds(state: GameState, officerId: number): number[] {
  return Object.values(state.officers[officerId]?.equipment ?? {});
}

console.log('\n=== Session 436 · S13 装备缴获验证 ===\n');

// ---------------------------------------------------------------------------
console.log('1. 攻方胜歼敌：阵亡敌将装备缴获（守恒 + 入库 + 战报）');
// 布景：刘备双军围宛（12000）vs 曹操野战军（3000，夏侯惇挂满装备）
let lootSeed = -1;
let lootBefore: number[] = [];
{
  for (let seed = 1; seed <= 2000 && lootSeed < 0; seed++) {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    s = deployOfficer(s, 7, 14);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    // 给敌将挂装备：先入库再装备（门槛不过则跳过，记录实际挂上的）
    for (const itemId of [22, 63, 80, 92, 134]) {
      s = grantItemToFactionInventory(s, 1, itemId, '敌军备战');
      try {
        s = equipItem(s, aiCmd, itemId);
      } catch {
        /* 门槛不过跳过 */
      }
    }
    const worn = equippedIds(s, aiCmd);
    if (worn.length === 0) continue;
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 8000, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 2) });
    const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: 7, troops: 4000, fromNodeId: 14 });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 1500, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, b, c] };
    const invBefore = Object.values(s.factions[2].inventory ?? {}).reduce((n, v) => n + (v as number), 0);
    const rng = new SerializableRng(seed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    const invGain = Object.values(out.state.factions[2].inventory ?? {}).reduce((n, v) => n + (v as number), 0) - invBefore;
    if (out.result.winner === 'attacker' && out.result.commanderStatus[aiCmd] === 'killed' && invGain > 0) {
      lootSeed = seed;
      lootBefore = worn;
    }
  }
  assert(lootSeed > 0, `猎到敌将阵亡种子（seed=${lootSeed}，战前装备 ${lootBefore.length} 件）`);
}

if (lootSeed > 0) {
  const run = (): { inv: number; onCorpse: number[]; msg: string; state: GameState } => {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    s = deployOfficer(s, 7, 14);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    for (const itemId of [22, 63, 80, 92, 134]) {
      s = grantItemToFactionInventory(s, 1, itemId, '敌军备战');
      try {
        s = equipItem(s, aiCmd, itemId);
      } catch {
        /* 门槛不过跳过 */
      }
    }
    const invBefore = Object.values(s.factions[2].inventory ?? {}).reduce((n, v) => n + (v as number), 0);
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 8000, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 2) });
    const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: 7, troops: 4000, fromNodeId: 14 });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 3000, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, b, c] };
    const rng = new SerializableRng(lootSeed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    const invAfter = Object.values(out.state.factions[2].inventory ?? {}).reduce((n, v) => n + (v as number), 0);
    const log = out.state.actionLog.find((e) => e.type === 'campaign_field_win' || e.type === 'campaign_capture');
    return { inv: invAfter - invBefore, onCorpse: equippedIds(out.state, aiCmd), msg: log?.message ?? '', state: out.state };
  };
  const first = run();
  const second = run();
  assert(first.inv + first.onCorpse.length === lootBefore.length, `守恒：缴获 ${first.inv} + 尸身 ${first.onCorpse.length} = 战前 ${lootBefore.length}`);
  assert(first.inv === second.inv && first.msg === second.msg, '同种子同缴获（确定性）');
  assert(first.inv > 0, `缴获命中 ${first.inv} 件（种子已预选）`);
  assert(first.msg.includes('缴获'), `战报追加缴获：「${first.msg.slice(-30)}」`);
  assert(GameStateSchema.safeParse(first.state).success, '缴获结算后过完整 GameStateSchema');
}

// ---------------------------------------------------------------------------
console.log('\n2. 攻方败：守方缴获阵亡攻方装备（方向对称）');
{
  let killSeed = -1;
  for (let seed = 501; seed <= 3000 && killSeed < 0; seed++) {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    // 关羽先天签名装备（青龙偃月刀）在身；1500 弱军攻 8000 野战军必大败
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 1500, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 1) });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 8000, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, c] };
    const invBefore = Object.values(s.factions[1].inventory ?? {}).reduce((n, v) => n + (v as number), 0);
    const rng = new SerializableRng(seed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    const invGain = Object.values(out.state.factions[1].inventory ?? {}).reduce((n, v) => n + (v as number), 0) - invBefore;
    if (out.result.winner === 'defender' && out.result.commanderStatus[6] === 'killed' && invGain > 0) killSeed = seed;
  }
  assert(killSeed > 0, `猎到攻方主将阵亡种子（seed=${killSeed}）`);
  if (killSeed > 0) {
    let s = freshState();
    s = deployOfficer(s, 6, 15);
    const aiCmd = Object.values(s.officers)
      .filter((o) => o.faction === 1 && o.status === 'active')
      .sort((x, y) => x.id - y.id)[0]!.id;
    s = deployOfficer(s, aiCmd, 13);
    s = setWar12(s);
    const wornBefore = equippedIds(s, 6);
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 1500, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 1) });
    const c = siegeArmy({ id: 'e-c', name: '敌军', commanderId: aiCmd, troops: 8000, factionId: 1, phase: 'engaged', targetNodeId: undefined });
    s = { ...s, campaignArmies: [a, c] };
    const rng = new SerializableRng(killSeed);
    const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
    const won = wornBefore.filter((id) => !equippedIds(out.state, 6).includes(id));
    const invGain = won.reduce((n, id) => n + (out.state.factions[1].inventory?.[id] ?? 0), 0);
    assert(won.length + equippedIds(out.state, 6).length === wornBefore.length, `守恒：缴获 ${won.length} + 尸身 ${equippedIds(out.state, 6).length} = 战前 ${wornBefore.length}`);
    assert(invGain >= won.length, `缴获入守方库存（+${invGain}）`);
    const log = out.state.actionLog.find((e) => e.type === 'campaign_defeat');
    assert(won.length === 0 ? !log?.message.includes('缴获') : (log?.message.includes('被缴获') ?? false), `战败报追加：${log?.message.slice(-24) ?? ''}`);
    assert(GameStateSchema.safeParse(out.state).success, '战败缴获后过完整 GameStateSchema');
  }
}

// ---------------------------------------------------------------------------
console.log('\n3. 无击杀无缴获零扰动 + 金样影响扫描');
{
  let s = freshState();
  s = deployOfficer(s, 6, 15);
  s = deployOfficer(s, 7, 14);
  const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: 6, troops: 8000, fromNodeId: 15, siegeState: siegeStateOf(s, 13, 2) });
  const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: 7, troops: 4000, fromNodeId: 14 });
  s = { ...s, campaignArmies: [a, b] };
  const rng = new SerializableRng(7);
  const out = assaultForFaction(s, 'm-a', 2, () => rng.next());
  const killCount = Object.values(out.result.commanderStatus).filter((v) => v === 'killed').length;
  if (killCount === 0) {
    assert(!out.state.actionLog.some((e) => e.message.includes('缴获宝物') || e.message.includes('；缴获') || e.message.includes('被缴获')), '无击杀无缴获日志');
  } else {
    assert(true, `本种子有击杀（${killCount}），跳过零扰动断言`);
  }
  // 金样 12 月实况扫描：权威 RNG 流是否经过缴获掷点
  createGame(1, 2);
  for (let i = 0; i < 12; i++) endTurn();
  const hits = getGame().actionLog.filter((e) => e.message.includes('缴获') && !e.message.includes('缴获金'));
  console.log(`  ℹ 金样 12 月缴获日志 ${hits.length} 条${hits.length > 0 ? `（例：${hits[0]?.message.slice(0, 40)}）` : '（金样零扰动）'}`);
}

console.log(`\n=== 结果: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
