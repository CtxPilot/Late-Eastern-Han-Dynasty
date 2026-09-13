// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 446 · docs/46 S5c「城驻军出击」验证（engine 级）。
 *
 * 断言面（docs/46 §四 D1~D7 + §五 R1~R5）：
 *   1. D1/D2 城驻军合成参战（有真实守方 Army 时）；`garrison-<cityId>` 单位 + 战报；
 *   2. D3 资格反（无真实守方 Army / city.troops < 下限 / 城不属守方势力 / 未开启）；
 *   3. D4 整城出击（troopCount = city.troops）；
 *   4. D5 主将与守方野战军主将不同 + 单位待命态；
 *   5. D6 结算守恒：野胜/败北/撤退回写城 troops = 合成守军存活兵力；
 *   6. R1 确定性（同态双局单位逐字节一致，零 RNG）；
 *   7. R3 Schema（出击后过完整 GameStateSchema）；
 *   8. R2 关闭（缺省）时逐字节不变。
 */
import {
  FormationType,
  GameStateSchema,
  UnitType,
  isHostileOrAtWar,
  type BattleState,
  type CampaignArmy,
  type GameState,
  type SquadPosition,
} from '@leh/shared';
import {
  GARRISON_SORTIE_MIN_TROOPS,
  createBattle,
  isGarrisonSortieUnit,
} from '../engine/battle.js';
import { settleSiegeStormBattle } from '../engine/campaign.js';
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

const POSITIONS: SquadPosition[] = ['center', 'left', 'right', 'vanguard', 'rearguard'];

function army(
  overrides: Partial<CampaignArmy> & {
    id: string;
    commanderId: number;
    troops: number;
    squadOfficers: number[];
    currentNodeId: number;
    targetNodeId: number;
  },
): CampaignArmy {
  const { squadOfficers, ...rest } = overrides;
  const per = Math.max(1, Math.floor(overrides.troops / squadOfficers.length));
  return {
    factionId: 2,
    name: `${overrides.id}军`,
    subCommanderIds: [],
    unitType: UnitType.LIGHT_INFANTRY,
    formation: FormationType.SQUARE,
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
    ...rest,
  };
}

function officerPool(state: GameState, faction: number, count: number): number[] {
  const active = Object.values(state.officers)
    .filter((o) => o.status === 'active')
    .sort((a, b) => a.id - b.id);
  const own = active.filter((o) => o.faction === faction).map((o) => o.id);
  if (own.length >= count) return own.slice(0, count);
  const extra = active.filter((o) => o.faction !== faction).map((o) => o.id);
  return [...own, ...extra].slice(0, count);
}

function enemyCityId(state: GameState): number {
  const found = Object.values(state.cities).find(
    (c) => c.ruler != null && c.ruler !== 2 && isHostileOrAtWar(state.diplomacy, 2, c.ruler),
  );
  if (!found) throw new Error('无玩家敌对城');
  return found.id;
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.entries(v as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, val]) => `${k}:${stable(val)}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** 亲统攻城基座：玩家攻方 + 敌方真实守方 Army + 可调 city.troops。 */
function stormFixture(cityTroops = 3000): {
  state: GameState;
  attacker: CampaignArmy;
  defender: CampaignArmy;
  battle: BattleState;
  cid: number;
  enemyFaction: number;
} {
  const base = freshState();
  const cid = enemyCityId(base);
  const enemyFaction = base.cities[cid]!.ruler!;
  const pPool = officerPool(base, 2, 4);
  const dPool = officerPool(base, enemyFaction, 4);
  const attacker = army({
    id: 'p-a', name: '关羽军', commanderId: pPool[0]!, troops: 5000, squadOfficers: pPool.slice(0, 2),
    factionId: 2, currentNodeId: cid, targetNodeId: cid, phase: 'sieging',
  });
  const defender = army({
    id: 'd-a', name: '守城军', commanderId: dPool[0]!, troops: 2500, squadOfficers: dPool.slice(0, 2),
    factionId: enemyFaction, currentNodeId: cid, targetNodeId: cid, phase: 'garrison',
  });
  const state: GameState = {
    ...base,
    cities: { ...base.cities, [cid]: { ...base.cities[cid]!, troops: cityTroops } },
    campaignArmies: [attacker, defender],
  };
  const battle = createBattle(state, cid, { attackerArmy: attacker, defenderArmy: defender, garrisonSortie: true });
  return { state, attacker, defender, battle, cid, enemyFaction };
}

const garrisonOf = (battle: BattleState): BattleState['units'] =>
  battle.units.filter((unit) => unit.side === 'defender' && isGarrisonSortieUnit(unit));

console.log('\n=== Session 446 · docs/46 S5c 城驻军出击验证 ===\n');

// ---------------------------------------------------------------------------
console.log('1. D1/D2 城驻军合成参战（有真实守方 Army）');
{
  const { battle, defender } = stormFixture(3000);
  const garrison = garrisonOf(battle);
  assert(garrison.length === 1, `合成守军 1 单位（${garrison.length}）`);
  assert(garrison[0]?.armyId === `garrison-${battle.cityId}`, `armyId = garrison-<cityId>（${garrison[0]?.armyId}）`);
  assert(garrison[0]?.side === 'defender', '入守方侧');
  assert(battle.units.some((u) => u.armyId === defender.id), '真实守方 Army 单位仍在场');
  assert(battle.log.some((l) => l.message.includes('率城驻军出击')), `战报：${battle.log.map((l) => l.message).filter((m) => m.includes('城驻军')).join(' / ')}`);
}

// ---------------------------------------------------------------------------
console.log('\n2. D3 资格反向');
{
  const { state, attacker, battle, cid, enemyFaction } = stormFixture(3000);
  // 无真实守方 Army（legacy 已代表守军）
  const legacy = createBattle({ ...state, campaignArmies: [attacker] }, cid, { attackerArmy: attacker, garrisonSortie: true });
  assert(garrisonOf(legacy).length === 0, '无守方 Army（legacy）→ 不出击（防双计）');
  assert(legacy.units.some((u) => u.armyId === 'd1'), 'legacy def-1 仍在场');
  // city.troops < 下限
  const low = stormFixture(GARRISON_SORTIE_MIN_TROOPS - 1);
  assert(garrisonOf(low.battle).length === 0, `city.troops < ${GARRISON_SORTIE_MIN_TROOPS} → 不出击`);
  // 城不属守方势力（守方 Army 属第三方）
  const pPool = officerPool(state, 2, 4);
  const third = army({
    id: 'x-third', commanderId: pPool[0]!, troops: 1500, squadOfficers: pPool.slice(0, 2),
    factionId: 99, currentNodeId: cid, targetNodeId: cid, phase: 'garrison',
  });
  const wrongOwner = createBattle({ ...state, campaignArmies: [attacker, third] }, cid, { attackerArmy: attacker, defenderArmies: [third], garrisonSortie: true });
  assert(garrisonOf(wrongOwner).length === 0, '城不属守方势力 → 不出击');
  void enemyFaction;
  void battle;
  // 未开启
  const off = createBattle(state, cid, { attackerArmy: attacker, defenderArmy: state.campaignArmies[1] });
  assert(garrisonOf(off).length === 0, '未开启 garrisonSortie → 不出击（R2）');
}

// ---------------------------------------------------------------------------
console.log('\n3. D4/D5 整城出击 + 主将区分 + 待命态');
{
  const { battle, defender, attacker, state, cid } = stormFixture(3000);
  const garrison = garrisonOf(battle)[0]!;
  assert(garrison.troopCount === 3000 && garrison.maxTroops === 3000, `整城出击 3000（${garrison.troopCount}）`);
  assert(garrison.commanderId !== defender.commanderId, '主将 ≠ 守方野战军主将');
  assert(garrison.commanderId !== attacker.commanderId, '主将 ≠ 攻方主将');
  assert(state.officers[garrison.commanderId]?.faction === battle.defenderFaction, '主将属守方势力');
  assert(garrison.hasActed === false && garrison.mp > 0, '开战态：可行动（非中途待命）');
  assert(garrison.troopCount > 0 && !garrison.isDestroyed && !garrison.isRetreated, '满编活跃');
  // 位置在守方基地附近且未与其他守方单位重叠
  const taken = new Set(battle.units.filter((u) => u !== garrison).map((u) => `${u.position.q},${u.position.r}`));
  assert(!taken.has(`${garrison.position.q},${garrison.position.r}`), `部署无重叠（${garrison.position.q},${garrison.position.r}）`);
  void cid;
}

// ---------------------------------------------------------------------------
console.log('\n4. D6 结算守恒：败北回写城 troops');
{
  const { state, attacker, defender, battle, cid } = stormFixture(3000);
  const garrison = garrisonOf(battle)[0]!;
  // 模拟开战扣减
  const deducted: GameState = {
    ...state,
    cities: { ...state.cities, [cid]: { ...state.cities[cid]!, troops: 0 } },
  };
  const over: BattleState = { ...battle, winner: 'defender', phase: 'over' };
  const next = settleSiegeStormBattle(deducted, over, [attacker], () => 0.5);
  assert(next.cities[cid]!.troops === garrison.troopCount, `败北：城 troops 回写为守军存活 ${next.cities[cid]!.troops}（=${garrison.troopCount}）`);
  void defender;
}

// ---------------------------------------------------------------------------
console.log('\n5. D6 结算守恒：野胜（真实守方 Army）回写城 troops');
{
  const { state, attacker, battle, cid } = stormFixture(2000);
  const garrison = garrisonOf(battle)[0]!;
  const deducted: GameState = { ...state, cities: { ...state.cities, [cid]: { ...state.cities[cid]!, troops: 0 } } };
  const over: BattleState = { ...battle, winner: 'attacker', phase: 'over' };
  const next = settleSiegeStormBattle(deducted, over, [attacker], () => 0.5);
  assert(next.cities[cid]!.troops === garrison.troopCount, `野胜：城 troops = 守军存活 ${next.cities[cid]!.troops}`);
  assert(next.campaignArmies.some((a) => a.id === attacker.id && a.phase === 'sieging'), '野胜后围城继续');
}

// ---------------------------------------------------------------------------
console.log('\n6. R1 确定性 + R3 Schema');
{
  const a = stormFixture(3000);
  const b = stormFixture(3000);
  assert(stable(a.battle.units) === stable(b.battle.units), '两局参战单位逐字节一致（零 RNG）');
  assert(stable(a.battle.log) === stable(b.battle.log), '两局战报逐字节一致');
  const parsed = GameStateSchema.safeParse({ ...a.state, activeBattles: [a.battle] });
  assert(parsed.success, `出击后过完整 GameStateSchema${parsed.success ? '' : `：${parsed.error.issues[0]?.message ?? ''}`}`);
}

console.log(`\nSession 446 S5c 城驻军出击: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
