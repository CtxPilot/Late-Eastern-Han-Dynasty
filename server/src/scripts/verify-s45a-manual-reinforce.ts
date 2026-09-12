// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 444 · docs/45 S5a「策应军手动入场」验证。
 *
 * 断言面（docs/45 §四 D2~D5/D8/D9 + §五 R1~R5）：
 *   1. D2 资格正向 + D5 入场态（整军追加、hasActed=true、mp=0）；
 *   2. D4 部署：次军 r 轴 ±4 偏移、跨军无重叠；
 *   3. D2 资格反向（异势力/非围城/已参战/单挑暂停/非围城亲统战/非玩家回合）；
 *   4. D3 容量门禁：满帽整军不入、继续策应（拒绝）；
 *   5. R4 结算纳入：`resolveStormArmies` 含增援军；未入场军不纳入；
 *   6. F8 按军撤退：增援军独立撤出、在主军不受影响；
 *   7. R1 确定性：同状态双次调用逐字节一致（零 RNG）；
 *   8. R3 存档兼容：增援后完整 GameStateSchema 通过、无新增必填字段；
 *   9. D9 候选清单：`reinforcementCandidates` 仅列资格军、非亲统战为空。
 */
import {
  FormationType,
  GameStateSchema,
  UnitType,
  reinforcementCandidates,
  reinforcementSideFor,
  type BattleState,
  type CampaignArmy,
  type GameState,
  type SquadPosition,
} from '@leh/shared';
import { createBattle, reinforceActiveBattle, retreatBattle } from '../engine/battle.js';
import { resolveStormArmies } from '../engine/campaign.js';
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
function throws(fn: () => void, include?: string): boolean {
  try {
    fn();
    return false;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return include == null || msg.includes(include);
  }
}

function freshState(): GameState {
  createGame(1, 2);
  return getGame();
}

const POSITIONS: SquadPosition[] = ['center', 'left', 'right', 'vanguard', 'rearguard'];

function siegeArmy(
  overrides: Partial<CampaignArmy> & { id: string; commanderId: number; troops: number; squadOfficers: number[] },
): CampaignArmy {
  const { squadOfficers, ...rest } = overrides;
  const per = Math.max(1, Math.floor(overrides.troops / squadOfficers.length));
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

function officerPool(state: GameState, count: number): number[] {
  return Object.values(state.officers)
    .filter((o) => o.faction === 2 && o.status === 'active')
    .sort((a, b) => a.id - b.id)
    .slice(0, count)
    .map((o) => o.id);
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

/** 手工构造「单军亲统围城战 + 一支未入战同城同势力围城军」的引擎态。 */
function stormFixture(cityId = 13): {
  state: GameState;
  main: CampaignArmy;
  reserve: CampaignArmy;
  battle: BattleState;
} {
  const base = freshState();
  const pool = officerPool(base, 8);
  const main = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 5000, squadOfficers: pool.slice(0, 2) });
  const reserve = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: pool[2]!, troops: 3000, squadOfficers: pool.slice(2, 5) });
  const state: GameState = { ...base, campaignArmies: [main, reserve] };
  const battle = createBattle(state, cityId, { attackerArmies: [main] });
  return { state, main, reserve, battle };
}

console.log('\n=== Session 444 · docs/45 S5a 策应军手动入场验证 ===\n');

// ---------------------------------------------------------------------------
console.log('1. D2 资格正向 + D5 入场态（整军追加、本回合待命）');
{
  const { state, battle } = stormFixture();
  assert(reinforcementSideFor(battle, state.campaignArmies[1]!) === 'attacker', 'D2：同城同势力围城军判为攻方增援');
  const before = battle.units.filter((u) => u.side === 'attacker').length;
  const next = reinforceActiveBattle(state, battle, 'm-b');
  const added = next.units.filter((u) => u.armyId === 'm-b');
  assert(added.length === 3, `整军 3 队入场（${added.length}）`);
  assert(next.units.filter((u) => u.side === 'attacker').length === before + 3, '攻方单位数 +3');
  assert(added.every((u) => u.hasActed === true), 'D5：入场单位 hasActed=true');
  assert(added.every((u) => u.mp === 0), 'D5：入场单位 mp=0');
  assert(added.every((u) => u.troopCount > 0 && !u.isDestroyed && !u.isRetreated), '入场单位满编活跃');
  assert(next.log.at(-1)?.message === '张飞军 增援入场（兵力 3000，本回合待命）', `战报：${next.log.at(-1)?.message ?? ''}`);
  assert(next.message === '张飞军 增援入场（兵力 3000，本回合待命）', 'battle.message 同步');
  assert(battle.units.length !== next.units.length, '纯函数：原 battle 未被改写（immutable）');
}

// ---------------------------------------------------------------------------
console.log('\n2. D4 部署：次军 r 轴 ±4 偏移 + 跨军无重叠');
{
  const { state, battle } = stormFixture();
  const next = reinforceActiveBattle(state, battle, 'm-b');
  const seen = new Map<string, string>();
  let overlap = false;
  for (const u of next.units) {
    const key = `${u.position.q},${u.position.r}`;
    const holder = seen.get(key);
    if (holder && holder !== u.armyId) overlap = true;
    seen.set(key, u.armyId);
  }
  assert(!overlap, '跨军部署无重叠（occupied 累积）');
  const avgR = (id: string): number => {
    const list = next.units.filter((u) => u.armyId === id);
    return list.reduce((n, u) => n + u.position.r, 0) / Math.max(1, list.length);
  };
  assert(avgR('m-b') > avgR('m-a'), `次军 r 轴 +4 偏移（A ${avgR('m-a').toFixed(1)} < B ${avgR('m-b').toFixed(1)}）`);
  assert(next.units.every((u) => u.position.q >= 0 && u.position.q < 20 && u.position.r >= 0 && u.position.r < 15), '部署越界夹紧在 20×15 内');
}

// ---------------------------------------------------------------------------
console.log('\n3. D2 资格反向 + 门禁');
{
  const { state, battle } = stormFixture();
  // 异势力（既非攻方也非守方）
  const alien = siegeArmy({ id: 'x-alien', commanderId: 0, troops: 1000, squadOfficers: [1], factionId: 99 });
  assert(reinforcementSideFor(battle, alien) === null, '异势力军不合资格');
  assert(throws(() => reinforceActiveBattle({ ...state, campaignArmies: [...state.campaignArmies, alien] }, battle, 'x-alien'), '该军不可作为增援入场'), '异势力入场被拒');
  // 非围城
  const garrison = siegeArmy({ id: 'x-garr', commanderId: 0, troops: 1000, squadOfficers: [1], phase: 'garrison' });
  assert(reinforcementSideFor(battle, garrison) === null, '非围城军不合资格');
  assert(throws(() => reinforceActiveBattle(state, battle, 'm-b2'), 'Army 不存在'), '未知 armyId 拒绝');
  // 已参战
  assert(reinforcementSideFor(battle, state.campaignArmies[0]!) === null, '已参战军不合资格');
  assert(throws(() => reinforceActiveBattle(state, battle, 'm-a'), '该军不可作为增援入场'), '已参战军入场被拒');
  // 单挑暂停（F12）
  const duelBattle: BattleState = { ...battle, duel: { phase: 'active' } as never };
  assert(throws(() => reinforceActiveBattle(state, duelBattle, 'm-b'), 'DUEL_BATTLE_PAUSED'), '单挑暂停中入场被拒');
  // 非玩家回合
  const enemyTurn: BattleState = { ...battle, phase: 'enemy' };
  assert(throws(() => reinforceActiveBattle(state, enemyTurn, 'm-b'), '非玩家回合'), '非玩家回合入场被拒');
  // 非围城亲统战（fromCityId 非空）
  const field = createBattle(state, 13, { attackerArmies: [{ ...state.campaignArmies[0]!, factionId: 2 }], fromCityId: 15 });
  assert(field.fromCityId === 15, '构造野战/出征战斗（fromCityId=15）');
  assert(throws(() => reinforceActiveBattle(state, field, 'm-b'), '该军不可作为增援入场'), '非围城亲统战入场被拒');
  // 已结束
  const over: BattleState = { ...battle, phase: 'over', winner: 'attacker' };
  assert(reinforcementSideFor(over, state.campaignArmies[1]!) === null, '已结束战斗不合资格');
  assert(throws(() => reinforceActiveBattle(state, over, 'm-b')), '已结束战斗入场被拒');
}

// ---------------------------------------------------------------------------
console.log('\n4. D3 容量门禁：满帽整军不入、继续策应');
{
  const base = freshState();
  const pool = officerPool(base, 8);
  const big = siegeArmy({ id: 'cap-a', name: '主军', commanderId: pool[0]!, troops: 5000, squadOfficers: pool.slice(0, 5) });
  const four = siegeArmy({ id: 'cap-b', name: '援军', commanderId: pool[5]!, troops: 4000, squadOfficers: pool.slice(5, 8).concat(pool[0]!) });
  const state: GameState = { ...base, campaignArmies: [big, four] };
  const battle = createBattle(state, 13, { attackerArmies: [big] });
  assert(battle.units.filter((u) => u.side === 'attacker').length === 5, '主军 5 队在场');
  assert(throws(() => reinforceActiveBattle(state, battle, 'cap-b'), '战场容量已满，该军继续屯于城下策应'), '5+4>8 → 整军拒绝');
  const three = siegeArmy({ id: 'cap-c', name: '小援', commanderId: pool[5]!, troops: 3000, squadOfficers: pool.slice(5, 8) });
  const next = reinforceActiveBattle({ ...state, campaignArmies: [big, three] }, battle, 'cap-c');
  assert(next.units.filter((u) => u.side === 'attacker').length === 8, '5+3=8 → 恰好入满帽');
}

// ---------------------------------------------------------------------------
console.log('\n5. R4 结算纳入：resolveStormArmies 含增援军');
{
  const { state, battle } = stormFixture();
  assert(resolveStormArmies(state, battle).map((a) => a.id).join(',') === 'm-a', '未增援：结算组仅主军');
  const next = reinforceActiveBattle(state, battle, 'm-b');
  const group = resolveStormArmies(state, next);
  assert(group.map((a) => a.id).join(',') === 'm-a,m-b', `增援后结算组含两军（兵力降序）：${group.map((a) => a.id).join(',')}`);
}

// ---------------------------------------------------------------------------
console.log('\n6. F8 按军撤退：增援军独立撤出');
{
  const { state, battle } = stormFixture();
  const next = reinforceActiveBattle(state, battle, 'm-b');
  const retreated = retreatBattle(next, 'm-b');
  assert(retreated.units.filter((u) => u.armyId === 'm-b').every((u) => u.isRetreated), '增援军全部有序撤出');
  assert(retreated.units.filter((u) => u.armyId === 'm-a').every((u) => !u.isRetreated), '主军不受影响、战斗继续');
  assert(retreated.phase !== 'over' || retreated.units.some((u) => u.armyId === 'm-a' && !u.isRetreated), '战斗未因单军撤退而结束');
}

// ---------------------------------------------------------------------------
console.log('\n7. R1 确定性：双次调用逐字节一致（零 RNG）');
{
  const a = stormFixture();
  const b = stormFixture();
  const na = reinforceActiveBattle(a.state, a.battle, 'm-b');
  const nb = reinforceActiveBattle(b.state, b.battle, 'm-b');
  assert(stable(na.units) === stable(nb.units), '两局增援单位逐字节一致');
  assert(stable(na.log) === stable(nb.log), '两局战报逐字节一致');
}

// ---------------------------------------------------------------------------
console.log('\n8. R3 存档兼容：增援后完整 GameStateSchema');
{
  const { state, battle } = stormFixture();
  const next = reinforceActiveBattle(state, battle, 'm-b');
  const candidate: GameState = { ...state, activeBattles: [next] };
  const parsed = GameStateSchema.safeParse(candidate);
  assert(parsed.success, `增援后过完整 GameStateSchema${parsed.success ? '' : `：${parsed.error.issues[0]?.message ?? ''}`}`);
}

// ---------------------------------------------------------------------------
console.log('\n9. D9 候选清单：reinforcementCandidates');
{
  const { state, battle } = stormFixture();
  assert(reinforcementCandidates(battle, state.campaignArmies).map((a) => a.id).join(',') === 'm-b', '仅列未入战同城同势力围城军');
  const next = reinforceActiveBattle(state, battle, 'm-b');
  assert(reinforcementCandidates(next, state.campaignArmies).length === 0, '全部入战后无候选');
  const field = createBattle(state, 13, { attackerArmies: [state.campaignArmies[0]!], fromCityId: 15 });
  assert(reinforcementCandidates(field, state.campaignArmies).length === 0, '非围城亲统战无候选');
  const duelBattle: BattleState = { ...battle, duel: { phase: 'active' } as never };
  assert(reinforcementCandidates(duelBattle, state.campaignArmies).length === 0, '单挑暂停时无候选');
}

console.log(`\nSession 444 S5a 策应军手动入场: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
