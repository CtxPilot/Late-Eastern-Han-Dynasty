// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 441 S4d · S13 战斗中使用验证（docs/44 D1~D3：仅 stamina/heal，
 * 耗整次行动，扣槽优先回退库存，零 RNG，AI 不用）。
 *
 * 断言面（引擎 `useBattleConsumable` 直测，合成 storm 战场）：
 *   1. 成功路径：体力恢复（行军散 +15）+ 槽扣减 + 单位 hasActed/mp=0 +
 *      战报消息与日志 + 确定性 + GameStateSchema；
 *   2. 上限夹紧：近满时恢复量截断至 `calcStaminaMax`；
 *   3. 分队主将可用：非军主将单位按自身 commanderId 扣槽（逐单位语义）；
 *   4. 拒绝：morale/food/cure/非消耗品类型、已行动、敌方单位、非玩家回合、
 *      体力已满、无库存（8 拒）；
 *   5. 服务/路由/离线五镜像由 parity（别名）+ 类型检查 + CDP 全链路背书，
 *      本脚本不断言 live 锁（沿 s434 体例）。
 */
import {
  calcStaminaMax,
  FormationType,
  GameStateSchema,
  meritLevelFor,
  UnitType,
  type BattleState,
  type CampaignArmy,
  type GameState,
  type SiegeState,
  type SquadPosition,
} from '@leh/shared';
import { createBattle, useBattleConsumable } from '../engine/battle.js';
import {
  assignConsumableToSlot,
  grantItemToFactionInventory,
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
function throws(fn: () => void): boolean {
  try {
    fn();
  } catch {
    return true;
  }
  return false;
}

function freshState(): GameState {
  createGame(1, 2);
  return getGame();
}

function officerPool(state: GameState, count: number): number[] {
  return Object.values(state.officers)
    .filter((o) => o.faction === 2 && o.status === 'active')
    .sort((a, b) => a.id - b.id)
    .slice(0, count)
    .map((o) => o.id);
}

function enemyPool(state: GameState, count: number): number[] {
  return Object.values(state.officers)
    .filter((o) => o.faction === 1 && o.status === 'active')
    .sort((a, b) => a.id - b.id)
    .slice(0, count)
    .map((o) => o.id);
}

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

/** storm 布景：关羽军（3 队）vs 敌军（2 队），返回 state + battle + 任一攻方单位。 */
function stormSetup(): { s: GameState; battle: BattleState; unitId: string; commanderId: number } {
  let s = freshState();
  const pool = officerPool(s, 3);
  const foes = enemyPool(s, 2);
  for (const oid of pool) s = deployOfficer(s, oid, 15);
  for (const oid of foes) s = deployOfficer(s, oid, 13);
  const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 6000, squadOfficers: pool, siegeState: siegeStateOf(s, 13, 3) });
  const c: CampaignArmy = {
    ...siegeArmy({ id: 'e-c', name: '敌军', commanderId: foes[0]!, troops: 4000, squadOfficers: foes }),
    factionId: 1,
    phase: 'engaged',
    targetNodeId: undefined,
  };
  s = { ...s, campaignArmies: [a, c] };
  const battle = createBattle(s, 13, { attackerArmies: [a], defenderArmy: c });
  const unit = battle.units.find((u) => u.side === 'attacker')!;
  return { s, battle, unitId: unit.id, commanderId: unit.commanderId };
}

/** 给武将设体力 + 备行军散(140)快捷槽；返回处理后 state。 */
function woundAndStock(s: GameState, officerId: number, stamina: number, count = 3): GameState {
  let out = s;
  const o = out.officers[officerId]!;
  out = { ...out, officers: { ...out.officers, [officerId]: { ...o, stamina } } };
  for (let i = 0; i < count; i++) out = grantItemToFactionInventory(out, 2, 140, '战中使用布景');
  out = assignConsumableToSlot(out, officerId, 140, count);
  return out;
}

function staminaMaxOf(s: GameState, officerId: number): number {
  const o = s.officers[officerId]!;
  return calcStaminaMax(o, meritLevelFor(o.merit ?? 0), s.currentYear - o.birthYear);
}

console.log('\n=== Session 441 S4d · S13 战斗中使用验证 ===\n');

// ---------------------------------------------------------------------------
console.log('1. 成功路径：恢复 + 扣槽 + 行动结束 + 战报 + 确定性 + Schema');
{
  const { s, battle, unitId, commanderId } = stormSetup();
  const logLen = battle.log.length;
  const staged = woundAndStock(s, commanderId, 5, 3);
  const run = (): { battle: BattleState; state: GameState } => useBattleConsumable(battle, unitId, 140, staged);
  const first = run();
  const second = run();
  const after = first.state.officers[commanderId]!;
  assert(after.stamina === 20, `体力 5→20（行军散 +15），实得 ${after.stamina}`);
  assert((after.consumableSlots ?? []).find((x) => x.itemId === 140)?.count === 2, '快捷槽 3→2（扣槽优先）');
  const unit = first.battle.units.find((u) => u.id === unitId)!;
  assert(unit.hasActed === true && unit.mp === 0, '单位行动结束（hasActed + mp=0）');
  assert(first.battle.message.includes('使用') && first.battle.message.includes('+15'), `战报消息：「${first.battle.message}」`);
  assert(first.battle.log.length === logLen + 1, '战斗日志追加 1 条');
  assert(JSON.stringify(first) === JSON.stringify(second), '同输入同输出（零 RNG 确定性）');
  assert(GameStateSchema.safeParse(first.state).success, '使用后过完整 GameStateSchema');
}

// ---------------------------------------------------------------------------
console.log('\n2. 上限夹紧：近满恢复截断');
{
  const { s, battle, unitId, commanderId } = stormSetup();
  const max = staminaMaxOf(s, commanderId);
  assert(max > 20, `体力上限 ${max}（可测截断）`);
  const staged = woundAndStock(s, commanderId, max - 5, 3);
  const out = useBattleConsumable(battle, unitId, 140, staged);
  assert(out.state.officers[commanderId]?.stamina === max, `体力截断至上限 ${max}`);
  assert(out.battle.message.includes('+5'), `战报记实恢复 +5：「${out.battle.message}」`);
}

// ---------------------------------------------------------------------------
console.log('\n3. 分队主将：按单位自身 commanderId 扣槽');
{
  const { s, battle } = stormSetup();
  // 取非首队攻方单位（分队主将非军主将）
  const units = battle.units.filter((u) => u.side === 'attacker');
  assert(units.length >= 2, `攻方 ${units.length} 队可测分队`);
  const sub = units[1]!;
  const staged = woundAndStock(s, sub.commanderId, 5, 2);
  const beforeMain = staged.officers[units[0]!.commanderId]?.consumableSlots ?? [];
  const out = useBattleConsumable(battle, sub.id, 140, staged);
  assert(out.state.officers[sub.commanderId]?.stamina === 20, '分队主将体力恢复');
  assert(JSON.stringify(out.state.officers[units[0]!.commanderId]?.consumableSlots ?? []) === JSON.stringify(beforeMain), '军主将槽不受影响');
  assert(out.battle.units.find((u) => u.id === sub.id)?.hasActed === true, '分队单位行动结束');
  assert(out.battle.units.find((u) => u.id === units[0]!.id)?.hasActed !== true, '他队未动');
}

// ---------------------------------------------------------------------------
console.log('\n4. 八拒绝：类型×4 + 已行动 + 敌方 + 非玩家回合 + 体满 + 无库存');
{
  const { s, battle, unitId, commanderId } = stormSetup();
  const staged = woundAndStock(s, commanderId, 5, 3);
  const enemy = battle.units.find((u) => u.side === 'defender')!;
  assert(throws(() => useBattleConsumable(battle, unitId, 151, staged)), '拒 morale（杜康酒六角无着落）');
  assert(throws(() => useBattleConsumable(battle, unitId, 154, staged)), '拒 food（军粮丸六角无着落）');
  assert(throws(() => useBattleConsumable(battle, unitId, 141, staged)), '拒 cure（沿 432 未接入）');
  assert(throws(() => useBattleConsumable(battle, unitId, 22, staged)), '拒非消耗品（装备）');
  const acted = useBattleConsumable(battle, unitId, 140, staged);
  assert(throws(() => useBattleConsumable(acted.battle, unitId, 140, acted.state)), '拒已行动单位');
  assert(throws(() => useBattleConsumable(battle, enemy.id, 140, staged)), '拒敌方单位');
  assert(throws(() => useBattleConsumable({ ...battle, phase: 'enemy' }, unitId, 140, staged)), '拒非玩家回合');
  const max = staminaMaxOf(s, commanderId);
  const full = woundAndStock(s, commanderId, max, 3);
  assert(throws(() => useBattleConsumable(battle, unitId, 140, full)), '拒体力已满');
  // 无库存：另取未布景武将（槽/库存均无行军散）
  const other = battle.units.filter((u) => u.side === 'attacker').map((u) => u.commanderId).find((id) => id !== commanderId)!;
  assert(throws(() => useBattleConsumable(battle, battle.units.find((u) => u.commanderId === other)!.id, 140, s)), '拒无库存');
}

console.log(`\n=== 结果: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
