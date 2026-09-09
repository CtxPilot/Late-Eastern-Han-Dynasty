// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 440 S4c · S13 被俘没收验证（docs/44 D6：被俘主将/副将装备按件独立
 * 30% 归俘获方库存，沿 436 口径；未中件被俘者保留）。
 *
 * 前置实勘（Session 440，`probe-s44c`）：自动战野战 1200 场被俘 0 次——溃散线
 * 30% 使全歼分支不可达（`defenderRemaining<=0` 恒不成立），`commanderStatus`
 * 亦无攻方 `captured` 来源；真实被俘来源是六角（亲统生擒 + 单挑被俘）。故：
 *   1. 掷点 helper 纯测（固定 RNG 序列精确分账 + 无装备零 RNG 消耗）；
 *   2. 亲统 storm 生擒没收（被歼守方单位主将 → 俘获方库存守恒 + 战报缴获 + 确定性）；
 *   3. 单挑被俘没收（crafted resolved duel + `skipBattleDuel`：全中/全不中两档）；
 *   4. 无装备生擒零扰动（库存逐字节不变 + 战报无缴获 + 照常标俘）；
 *   5. 自动战结算两处挂接（全歼敌俘/战败攻俘）复用 `seizeKilledEquipment`，零新语义，
 *      由 s436/s44a/s44b 矩阵背书零扰动（本脚本不断言不可达分支）。
 */
import {
  FormationType,
  GameStateSchema,
  SerializableRng,
  UnitType,
  type BattleState,
  type CampaignArmy,
  type DuelStance,
  type GameState,
  type SiegeState,
  type SquadPosition,
} from '@leh/shared';
import { createBattle, skipBattleDuel } from '../engine/battle.js';
import { settleSiegeStormBattle } from '../engine/campaign.js';
import {
  equipItem,
  grantItemToFactionInventory,
  rollCaptiveEquipmentLoot,
  unequipItem,
} from '../engine/items.js';
import { createGame, getGame } from '../services/game.js';

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

/** 取 N 名刘备军现役武将（沿 s434）。 */
function officerPool(state: GameState, count: number): number[] {
  return Object.values(state.officers)
    .filter((o) => o.faction === 2 && o.status === 'active')
    .sort((a, b) => a.id - b.id)
    .slice(0, count)
    .map((o) => o.id);
}

/** 取 N 名曹操军现役武将。 */
function enemyPool(state: GameState, count: number): number[] {
  return Object.values(state.officers)
    .filter((o) => o.faction === 1 && o.status === 'active')
    .sort((a, b) => a.id - b.id)
    .slice(0, count)
    .map((o) => o.id);
}

/** 把武将调到前线（沿 s434）。 */
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

const POSITIONS: SquadPosition[] = ['center', 'left', 'right', 'vanguard', 'rearguard'];

function siegeArmy(
  overrides: Partial<CampaignArmy> & { id: string; commanderId: number; troops: number; squadOfficers: number[] },
): CampaignArmy {
  const { squadOfficers, ...rest } = overrides;
  const per = Math.floor(overrides.troops / squadOfficers.length);
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
    squads: squadOfficers.map((officerId, index) => ({
      officerId,
      role: index === 0 ? ('main' as const) : ('sub' as const),
      position: POSITIONS[index % POSITIONS.length]!,
      unitType: UnitType.LIGHT_INFANTRY,
      troops: per,
      morale: 80,
    })),
    structures: [],
    fromNodeId: 15,
    ...rest,
  };
}

function forceOver(battle: BattleState, winner: 'attacker' | 'defender'): BattleState {
  return { ...battle, phase: 'over', winner };
}

/** 两势力库存全量件数之和。 */
function invSum(state: GameState, factionId: number): number {
  return Object.values(state.factions[factionId]?.inventory ?? {}).reduce((n, v) => n + (v as number), 0);
}

/** S4c 布景装备（沿 s436）。 */
const EQUIP_IDS = [22, 63, 80, 92, 134] as const;

/** 给武将挂装备（先入库再装备，门槛不过跳过）；返回实际挂上件数。 */
function stageGear(state: GameState, factionId: number, officerId: number): { s: GameState; worn: number } {
  let s = state;
  for (const itemId of EQUIP_IDS) {
    s = grantItemToFactionInventory(s, factionId, itemId, '没收布景入库');
    try {
      s = equipItem(s, officerId, itemId);
    } catch {
      /* 门槛不过跳过 */
    }
  }
  return { s, worn: Object.values(s.officers[officerId]?.equipment ?? {}).length };
}

console.log('\n=== Session 440 S4c · S13 被俘没收验证 ===\n');

// ---------------------------------------------------------------------------
console.log('1. 掷点 helper 纯测（精确分账 + 无装备零 RNG）');
{
  let calls = 0;
  const counting = (): number => {
    calls++;
    return 0.05;
  };
  const out = rollCaptiveEquipmentLoot({ weaponPrimary: 22, armor: 80 }, { 22: 1 }, 0.3, counting);
  assert(calls === 2, `有 2 件掷 2 次（calls=${calls}）`);
  assert(out.names.length === 2 && out.inventory[22] === 2 && out.inventory[80] === 1, '全中：入库 + 名单');
  assert(Object.keys(out.equipment).length === 0, '全中：尸身清空');
  const out2 = rollCaptiveEquipmentLoot({ weaponPrimary: 22, armor: 80 }, {}, 0.3, () => 0.95);
  assert(out2.names.length === 0 && Object.keys(out2.equipment).length === 2, '全不中：原主保留');
  calls = 0;
  rollCaptiveEquipmentLoot({}, { 22: 1 }, 0.3, counting);
  rollCaptiveEquipmentLoot(undefined, undefined, 0.3, counting);
  assert(calls === 0, '无装备零 RNG 消耗');
  const a = rollCaptiveEquipmentLoot({ mount: 92 }, {}, 0.3, () => 0.1);
  const b = rollCaptiveEquipmentLoot({ mount: 92 }, {}, 0.3, () => 0.1);
  assert(JSON.stringify(a) === JSON.stringify(b), '纯函数确定性');
}

// ---------------------------------------------------------------------------
console.log('\n2. 亲统 storm 生擒没收（守恒 + 标俘 + 战报 + 确定性）');
let stormSeed = -1;
let stormWorn = 0;
let stormCaptive = -1;
{
  for (let seed = 1; seed <= 500 && stormSeed < 0; seed++) {
    let s = freshState();
    const pool = officerPool(s, 3);
    const foes = enemyPool(s, 2);
    for (const oid of pool) s = deployOfficer(s, oid, 15);
    for (const oid of foes) s = deployOfficer(s, oid, 13);
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 5000, squadOfficers: pool, siegeState: siegeStateOf(s, 13, 3) });
    const c: CampaignArmy = {
      ...siegeArmy({ id: 'e-c', name: '敌军', commanderId: foes[0]!, troops: 3000, squadOfficers: foes }),
      factionId: 1,
      phase: 'engaged',
      targetNodeId: undefined,
    };
    s = { ...s, campaignArmies: [a, c] };
    const battle = createBattle(s, 13, { attackerArmies: [a], defenderArmy: c });
    // 歼灭首个守方单位：其主将即待没收被俘者（布景挂在其身上）
    const victim = battle.units.find((u) => u.side === 'defender');
    if (!victim) continue;
    const staged = stageGear(s, 1, victim.commanderId);
    s = staged.s;
    if (staged.worn === 0) continue;
    const won = forceOver(
      { ...battle, units: battle.units.map((u) => (u.id === victim.id ? { ...u, troopCount: 0, isDestroyed: true } : u)) },
      'attacker',
    );
    const v0 = invSum(s, 2);
    const rng = new SerializableRng(seed);
    const out = settleSiegeStormBattle(s, won, [a], () => rng.next());
    const gain = invSum(out, 2) - v0;
    if (gain > 0) {
      stormSeed = seed;
      stormWorn = staged.worn;
      stormCaptive = victim.commanderId;
    }
  }
  assert(stormSeed > 0, `猎到生擒没收种子（seed=${stormSeed}，被俘者 ${stormCaptive} 穿戴 ${stormWorn} 件）`);
}

if (stormSeed > 0) {
  const run = (): { gain: number; onCaptive: number; status: string; msg: string; state: GameState } => {
    let s = freshState();
    const pool = officerPool(s, 3);
    const foes = enemyPool(s, 2);
    for (const oid of pool) s = deployOfficer(s, oid, 15);
    for (const oid of foes) s = deployOfficer(s, oid, 13);
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 5000, squadOfficers: pool, siegeState: siegeStateOf(s, 13, 3) });
    const c: CampaignArmy = {
      ...siegeArmy({ id: 'e-c', name: '敌军', commanderId: foes[0]!, troops: 3000, squadOfficers: foes }),
      factionId: 1,
      phase: 'engaged',
      targetNodeId: undefined,
    };
    s = { ...s, campaignArmies: [a, c] };
    const battle = createBattle(s, 13, { attackerArmies: [a], defenderArmy: c });
    const victim = battle.units.find((u) => u.side === 'defender')!;
    s = stageGear(s, 1, victim.commanderId).s;
    const won = forceOver(
      { ...battle, units: battle.units.map((u) => (u.id === victim.id ? { ...u, troopCount: 0, isDestroyed: true } : u)) },
      'attacker',
    );
    const v0 = invSum(s, 2);
    const rng = new SerializableRng(stormSeed);
    const out = settleSiegeStormBattle(s, won, [a], () => rng.next());
    const log = out.actionLog.find((e) => e.type === 'battle_capture');
    return {
      gain: invSum(out, 2) - v0,
      onCaptive: Object.values(out.officers[stormCaptive]?.equipment ?? {}).length,
      status: out.officers[stormCaptive]?.status ?? '?',
      msg: log?.message ?? '',
      state: out,
    };
  };
  const first = run();
  const second = run();
  assert(first.gain + first.onCaptive === stormWorn, `守恒：俘获方 ${first.gain} + 被俘者保留 ${first.onCaptive} = 战前 ${stormWorn}`);
  assert(first.status === 'prisoner', '被歼单位主将标俘');
  assert(first.msg.includes('生擒') && first.msg.includes('缴获'), `生擒战报追加缴获：「${first.msg.slice(-30)}」`);
  assert(first.gain === second.gain && first.msg === second.msg, '同种子同没收（确定性）');
  assert(GameStateSchema.safeParse(first.state).success, '生擒没收后过完整 GameStateSchema');
}

// ---------------------------------------------------------------------------
console.log('\n3. 单挑被俘没收（全中/全不中两档）');
{
  const setup = (): { s: GameState; battle: BattleState; loser: number; worn: number } => {
    let s = freshState();
    const pool = officerPool(s, 1);
    const foes = enemyPool(s, 1);
    for (const oid of pool) s = deployOfficer(s, oid, 15);
    for (const oid of foes) s = deployOfficer(s, oid, 13);
    const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 4000, squadOfficers: pool });
    const c: CampaignArmy = {
      ...siegeArmy({ id: 'e-c', name: '敌军', commanderId: foes[0]!, troops: 3000, squadOfficers: foes }),
      factionId: 1,
      phase: 'engaged',
      targetNodeId: undefined,
    };
    s = { ...s, campaignArmies: [a, c] };
    const created = createBattle(s, 13, { attackerArmies: [a], defenderArmy: c });
    const wUnit = created.units.find((u) => u.side === 'attacker')!;
    const lUnit = created.units.find((u) => u.side === 'defender')!;
    const staged = stageGear(s, 1, lUnit.commanderId);
    s = staged.s;
    const battle: BattleState = {
      ...created,
      duel: {
        battleId: created.id,
        phase: 'resolved',
        challengerId: wUnit.commanderId,
        defenderId: lUnit.commanderId,
        round: 1,
        combatants: {},
        turnOrder: [wUnit.commanderId, lUnit.commanderId],
        preDuelDone: true,
        dialogueLog: [],
        roundHistory: [],
        stances: { [wUnit.commanderId]: 'delegate', [lUnit.commanderId]: 'delegate' } as Record<number, DuelStance>,
        autoResolve: true,
        speedMode: 'skip',
        result: {
          winnerId: wUnit.commanderId,
          loserId: lUnit.commanderId,
          outcome: 'captured',
          rounds: [],
          moraleChange: { winner: 15, loser: -10 },
          audienceMoraleChange: -10,
          meritReward: 0,
          epilogue: `${s.officers[wUnit.commanderId]?.name} 俘获 ${s.officers[lUnit.commanderId]?.name}`,
        },
      },
    };
    return { s, battle, loser: lUnit.commanderId, worn: staged.worn };
  };
  // 全中档（rng 恒 0.05）
  {
    const { s, battle, loser, worn } = setup();
    assert(worn > 0, `单挑布景挂上 ${worn} 件`);
    const v0 = invSum(s, 2);
    const out = skipBattleDuel(battle, s, () => 0.05);
    const gain = invSum(s, 2) - v0;
    const onCaptive = Object.values(s.officers[loser]?.equipment ?? {}).length;
    assert(gain === worn && onCaptive === 0, `全中：俘获方 +${gain} = 战前 ${worn}，被俘者清空`);
    assert(s.officers[loser]?.status === 'prisoner', '败者标俘');
    assert(out.message.includes('俘获') && out.message.includes('缴获'), `单挑战报追加缴获：「${out.message.slice(-30)}」`);
    assert(GameStateSchema.safeParse(s).success, '单挑没收后过完整 GameStateSchema');
  }
  // 全不中档（rng 恒 0.95）
  {
    const { s, battle, loser, worn } = setup();
    const v0 = invSum(s, 2);
    const out = skipBattleDuel(battle, s, () => 0.95);
    const gain = invSum(s, 2) - v0;
    const onCaptive = Object.values(s.officers[loser]?.equipment ?? {}).length;
    assert(gain === 0 && onCaptive === worn, `全不中：俘获方 +0，被俘者保留 ${onCaptive} 件`);
    assert(s.officers[loser]?.status === 'prisoner', '未没收照样标俘');
    assert(out.message.includes('俘获') && !out.message.includes('缴获'), '无没收不追加缴获');
    assert(GameStateSchema.safeParse(s).success, '单挑无没收后过完整 GameStateSchema');
  }
}

// ---------------------------------------------------------------------------
console.log('\n4. 无装备生擒零扰动（库存逐字节不变 + 照常标俘）');
{
  let s = freshState();
  const pool = officerPool(s, 2);
  const foes = enemyPool(s, 1);
  for (const oid of pool) s = deployOfficer(s, oid, 15);
  for (const oid of foes) s = deployOfficer(s, oid, 13);
  const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 5000, squadOfficers: pool, siegeState: siegeStateOf(s, 13, 3) });
  const c: CampaignArmy = {
    ...siegeArmy({ id: 'e-c', name: '敌军', commanderId: foes[0]!, troops: 3000, squadOfficers: foes }),
    factionId: 1,
    phase: 'engaged',
    targetNodeId: undefined,
  };
  s = { ...s, campaignArmies: [a, c] };
  const battle = createBattle(s, 13, { attackerArmies: [a], defenderArmy: c });
  const victim = battle.units.find((u) => u.side === 'defender')!;
  // 主动剥光该主将初始装备（卸下回库）：保证无装备被俘，验证零扰动
  for (const itemId of Object.values(s.officers[victim.commanderId]?.equipment ?? {})) {
    s = unequipItem(s, victim.commanderId, itemId);
  }
  assert(Object.values(s.officers[victim.commanderId]?.equipment ?? {}).length === 0, '布景剥光被俘者装备');
  const snap = JSON.stringify([s.factions[1]?.inventory ?? {}, s.factions[2]?.inventory ?? {}]);
  const won = forceOver(
    { ...battle, units: battle.units.map((u) => (u.id === victim.id ? { ...u, troopCount: 0, isDestroyed: true } : u)) },
    'attacker',
  );
  const rng = new SerializableRng(11);
  const out = settleSiegeStormBattle(s, won, [a], () => rng.next());
  const snapAfter = JSON.stringify([out.factions[1]?.inventory ?? {}, out.factions[2]?.inventory ?? {}]);
  const log = out.actionLog.find((e) => e.type === 'battle_capture');
  assert(snap === snapAfter, '无装备生擒：双方库存逐字节不变');
  assert(!(log?.message.includes('缴获') ?? false), '无没收不追加缴获');
  assert(out.officers[victim.commanderId]?.status === 'prisoner', '照常标俘');
  assert(GameStateSchema.safeParse(out).success, '无装备生擒后过完整 GameStateSchema');
}

console.log(`\n=== 结果: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
