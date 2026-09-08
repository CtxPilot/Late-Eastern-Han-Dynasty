// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 434 · docs/43 S2 六角多军（亲统攻城）验证。
 *
 * 断言面（docs/43 §六 S2 行 + D8/D9/D10/D11 + R1~R4）：
 *   1. createBattle 多军编组：单位帽 8/侧、满帽整军不入战 + 「屯于城下策应」日志；
 *   2. 部署偏移（主军锚点现状、第 N 军 r 轴 ±4）与跨军无重叠；
 *   3. 单军路由等价（service 单军走单数 opts，R4）；
 *   4. 胜利 vs 驻军：占城 + Σ残兵（含 15% 伤兵归队）入城 + 各军解散；
 *   5. 败北：各军残兵 15% 回流各自 from 城，极小解散，守军残兵写回城防；
 *   6. 战术撤退全链路：亲统→撤退→exitBattle→50% 回流（service）；
 *   7. 胜利 vs 野战敌军：歼敌 + 维持围城 + 主军进度保留；
 *   8. 激战中卫士：自动战/劝降/撤退拒绝未结算战斗中的军；
 *   9. 按军撤退作用域：仅撤该军、战斗继续；
 *   10. 确定性 + 完整 GameStateSchema（R1 无合成军落库）。
 */
import {
  FormationType,
  GameStateSchema,
  UnitType,
  type BattleState,
  type CampaignArmy,
  type GameState,
  type SiegeState,
  type SquadPosition,
} from '@leh/shared';
import { createBattle, retreatBattle } from '../engine/battle.js';
import {
  armyInActiveBattle,
  assaultForFaction,
  collectSiegeStormGroup,
  resolveStormArmies,
  retreatArmy,
  settleSiegeStormBattle,
  trySiegeSurrender,
} from '../engine/campaign.js';
import {
  battleRetreat,
  campaignStart,
  createGame,
  doCampaignSiegeStorm,
  endTurn,
  exitBattle,
  getGame,
} from '../services/game.js';

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
    return false;
  } catch {
    return true;
  }
}

function freshState(): GameState {
  createGame(1, 2);
  return getGame();
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

/** 取 N 名刘备军现役武将（跨军去重配队）。 */
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

function normBattle(battle: BattleState): unknown {
  return { ...battle, id: 'BATTLE' };
}

function forceOver(battle: BattleState, winner: 'attacker' | 'defender'): BattleState {
  return { ...battle, phase: 'over', winner };
}

console.log('\n=== Session 434 · docs/43 S2 六角多军验证 ===\n');

// ---------------------------------------------------------------------------
console.log('1. 多军编组：单位帽 8/侧 + 满帽整军策应（D8）');
{
  const s = freshState();
  const pool = officerPool(s, 8);
  assert(pool.length >= 8, `取到 8 名刘备军武将（${pool.length}）`);
  const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 5000, squadOfficers: pool.slice(0, 5) });
  const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: pool[5]!, troops: 3000, squadOfficers: pool.slice(5, 8) });
  const full = createBattle(s, 13, { attackerArmies: [a, b] });
  const atkUnits = full.units.filter((u) => u.side === 'attacker');
  assert(atkUnits.length === 8, `5+3 队全入战（8 队）：${atkUnits.length}`);
  assert(!full.log.some((e) => e.message.includes('屯于城下策应')), '未满帽无策应日志');

  const c = siegeArmy({ id: 'm-c', name: '赵云军', commanderId: pool[5]!, troops: 4000, squadOfficers: [pool[5]!, pool[6]!, pool[7]!, pool[0]!] });
  const capped = createBattle(s, 13, { attackerArmies: [a, c] });
  const cappedAtk = capped.units.filter((u) => u.side === 'attacker');
  assert(cappedAtk.length === 5, `5+4 队 → 主军 5 队入战（${cappedAtk.length}）`);
  assert(cappedAtk.every((u) => u.armyId === 'm-a'), '满帽整军不入战（赵云军无单位）');
  assert(capped.log.some((e) => e.message === '赵云军屯于城下策应'), '策应日志「赵云军屯于城下策应」');
  assert(capped.log[0]?.message.includes('等 2 支亲统强攻') ?? false, `开战语主语：${capped.log[0]?.message ?? ''}`);
}

// ---------------------------------------------------------------------------
console.log('\n2. 部署偏移 + 跨军无重叠（D9）');
{
  const s = freshState();
  const pool = officerPool(s, 8);
  const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 5000, squadOfficers: pool.slice(0, 5) });
  const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: pool[5]!, troops: 3000, squadOfficers: pool.slice(5, 8) });
  const full = createBattle(s, 13, { attackerArmies: [a, b] });
  let crossOverlap = false;
  const seen = new Map<string, string>();
  for (const u of full.units) {
    const key = `${u.position.q},${u.position.r}`;
    const holder = seen.get(key);
    if (holder && holder !== u.armyId) crossOverlap = true;
    seen.set(key, u.armyId);
  }
  assert(!crossOverlap, '跨军部署无重叠');
  const avgR = (armyId: string): number => {
    const list = full.units.filter((u) => u.armyId === armyId);
    return list.reduce((n, u) => n + u.position.r, 0) / Math.max(1, list.length);
  };
  assert(avgR('m-b') > avgR('m-a'), `次军 r 轴 +4 偏移（A ${avgR('m-a').toFixed(1)} < B ${avgR('m-b').toFixed(1)}）`);
}

// ---------------------------------------------------------------------------
console.log('\n3. 单军路由等价（R4）：service 单军走单数 opts');
{
  createGame(1, 2);
  const r1 = campaignStart({
    commanderId: 6, subCommanderIds: [], fromNodeId: 15, targetNodeId: 13,
    unitType: UnitType.LIGHT_INFANTRY, formation: FormationType.SQUARE, troopCount: 2000, food: 2000,
  });
  assert(r1.army.phase === 'marching', '单军出征离城（襄阳→宛）');
  for (let i = 0; i < 6 && getGame().campaignArmies.find((a) => a.commanderId === 6)?.phase !== 'sieging'; i++) endTurn();
  const solo = getGame().campaignArmies.find((a) => a.commanderId === 6);
  assert(solo?.phase === 'sieging', '单军抵达进入围城');
  const out = doCampaignSiegeStorm(solo!.id);
  const battle = getGame().activeBattles[0]!;
  assert(out.battleId === battle.id, '端点返回 battleId');
  const direct = createBattle(getGame(), 13, { attackerArmy: solo! });
  assert(stable(normBattle(battle)) === stable(normBattle(direct)), '单军亲统 = 单数 createBattle（逐字节一致，R4）');
  assert(battle.log[0]?.message.includes('等 ') === false, `单军开战语无合流主语：${battle.log[0]?.message ?? ''}`);
  assert(getGame().actionLog[0]?.type === 'siege_storm', '亲统开战日志 siege_storm');
  assert(GameStateSchema.safeParse(getGame()).success, '亲统开战后过完整 GameStateSchema');
}

// ---------------------------------------------------------------------------
console.log('\n4. 胜利 vs 驻军：占城 + 解散入城（D10）');
{
  let s = freshState();
  const pool = officerPool(s, 8);
  for (const oid of pool) s = deployOfficer(s, oid, 15);
  const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 5000, squadOfficers: pool.slice(0, 5), siegeState: siegeStateOf(s, 13, 3) });
  const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: pool[5]!, troops: 3000, squadOfficers: pool.slice(5, 8), fromNodeId: 14 });
  s = { ...s, campaignArmies: [a, b] };
  let battle = createBattle(s, 13, { attackerArmies: [a, b] });
  // 伤一队（1000→600）：伤兵归队 +60
  const victim = battle.units.find((u) => u.armyId === 'm-a')!;
  battle = {
    ...battle,
    units: battle.units.map((u) => (u.id === victim.id ? { ...u, troopCount: 600 } : u)),
  };
  battle = forceOver(
    { ...battle, units: battle.units.map((u) => (u.side === 'defender' ? { ...u, troopCount: 0, isDestroyed: true } : u)) },
    'attacker',
  );
  const out = settleSiegeStormBattle(s, battle, [a, b], () => 0.5);
  const city = out.cities[13];
  // A: 1000×5=5000，伤 400 → 恢复 60 → 4660；B: 1000×3=3000
  assert(city.ruler === 2, '占城：宛归刘备军');
  assert(city.troops === 7660, `Σ残兵入城（含伤兵归队+60）：${city.troops}`);
  assert(!out.campaignArmies.some((x) => x.id === 'm-a' || x.id === 'm-b'), '参战两军解散');
  assert(city.officers.includes(pool[0]!) && city.officers.includes(pool[5]!), '两军主将入城');
  const captureLog = out.actionLog.find((e) => e.type === 'campaign_capture');
  assert(captureLog?.message.startsWith('关羽军等 2 支攻占') ?? false, `战报主语：${captureLog?.message ?? ''}`);
  assert(out.actionLog.some((e) => e.type === 'siege_disband'), '解散日志 siege_disband');
  assert(out.actionLog.some((e) => e.type === 'battle_capture'), '战场生擒日志（守方被歼）');
  assert(GameStateSchema.safeParse(out).success, '占城后过完整 GameStateSchema');
}

// ---------------------------------------------------------------------------
console.log('\n5. 败北：15% 回流 + 极小解散 + 守军写回（D10）');
{
  let s = freshState();
  const pool = officerPool(s, 8);
  for (const oid of pool) s = deployOfficer(s, oid, 15);
  const base15 = s.cities[15].troops;
  const base14 = s.cities[14].troops;
  const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 8000, squadOfficers: pool.slice(0, 5) });
  const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: pool[5]!, troops: 4000, squadOfficers: pool.slice(5, 8), fromNodeId: 14 });
  s = { ...s, campaignArmies: [a, b] };
  let battle = createBattle(s, 13, { attackerArmies: [a, b] });
  // A 留 7000 存活（1600×4 + 600），B 留 1000（334+333+333）
  const aIds = battle.units.filter((u) => u.armyId === 'm-a').map((u) => u.id);
  const bIds = battle.units.filter((u) => u.armyId === 'm-b').map((u) => u.id);
  battle = {
    ...battle,
    units: battle.units.map((u) => {
      if (u.armyId === 'm-a') {
        const idx = aIds.indexOf(u.id);
        return idx < 4 ? u : { ...u, troopCount: 600 };
      }
      if (u.armyId === 'm-b') {
        const idx = bIds.indexOf(u.id);
        return { ...u, troopCount: [334, 333, 333][idx] ?? 0 };
      }
      return u;
    }),
  };
  battle = forceOver(battle, 'defender');
  const defAlive = battle.units.filter((u) => u.side === 'defender' && !u.isDestroyed)
    .reduce((n, u) => n + u.troopCount, 0);
  const out = settleSiegeStormBattle(s, battle, [a, b], () => 0.5);
  const afterA = out.campaignArmies.find((x) => x.id === 'm-a');
  const afterB = out.campaignArmies.find((x) => x.id === 'm-b');
  assert(afterA?.troops === 1050, `A 残 7000×15%=1050 回流（${afterA?.troops}）`);
  assert(afterA?.phase === 'garrison' && afterA?.currentNodeId === 15, 'A 退守襄阳');
  assert(afterB === undefined, 'B 残 1000×15%=150 ≤1000 解散');
  assert(out.cities[15].troops === base15 + 1050, '襄阳回流 +1050');
  assert(out.cities[14].troops === base14 + 150, '江陵回流 +150');
  assert(out.cities[13].troops === defAlive, `守军残兵写回城防（${out.cities[13].troops}）`);
  assert(out.actionLog.some((e) => e.type === 'campaign_defeat'), '战败日志 campaign_defeat');
  assert(GameStateSchema.safeParse(out).success, '败退后过完整 GameStateSchema');
}

// ---------------------------------------------------------------------------
console.log('\n6. 战术撤退全链路：亲统→撤退→exitBattle→50% 回流（D10/service）');
{
  // 注：宛(13) 的官道邻接玩家城仅襄阳(15)，江陵(14) 不直达——本节走单军全链路；
  // 双军 service plural 路由由 UI 冒烟覆盖（双路出征→亲统→军旗条）。
  createGame(1, 2);
  campaignStart({
    commanderId: 6, subCommanderIds: [], fromNodeId: 15, targetNodeId: 13,
    unitType: UnitType.LIGHT_INFANTRY, formation: FormationType.SQUARE, troopCount: 3000, food: 2000,
  });
  for (let i = 0; i < 6 && getGame().campaignArmies.find((a) => a.commanderId === 6)?.phase !== 'sieging'; i++) endTurn();
  const pre = getGame();
  const first = pre.campaignArmies.find((a) => a.commanderId === 6)!;
  assert(first?.phase === 'sieging', '单军抵达围城');
  const base15 = pre.cities[15].troops;
  const storm = doCampaignSiegeStorm(first.id);
  assert(storm.battleId === getGame().activeBattles[0]?.id, '亲统开战入列 activeBattles');
  const retreated = battleRetreat();
  assert(retreated.phase === 'over' && retreated.winner === 'defender', '战术撤退结束战斗');
  const after = exitBattle();
  assert(after.cities[15].troops === base15 + 1500, `襄阳 +1500（3000×50%）：${after.cities[15].troops}`);
  assert(after.campaignArmies.find((a) => a.commanderId === 6)?.phase === 'garrison', '残军退守襄阳');
  assert(after.actionLog.some((e) => e.type === 'campaign_retreat' && e.message.includes('有序撤退')), '有序撤退日志');
  assert(after.activeBattles.length === 0, '结算后战斗出列');
  // 注：service 返回为 S06 脱敏投影（敌方 hidden 置 50），Schema 只断言权威原态。
  assert(GameStateSchema.safeParse(getGame()).success, '撤退结算后过完整 GameStateSchema');
}

// ---------------------------------------------------------------------------
console.log('\n7. 胜利 vs 野战敌军：歼敌 + 维持围城（D3/D10）');
{
  let s = freshState();
  const pool = officerPool(s, 8);
  for (const oid of pool) s = deployOfficer(s, oid, 15);
  const aiOfficers = Object.values(s.officers)
    .filter((o) => o.faction === 1 && o.status === 'active')
    .sort((x, y) => x.id - y.id)
    .slice(0, 2)
    .map((o) => o.id);
  for (const oid of aiOfficers) s = deployOfficer(s, oid, 13);
  const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 5000, squadOfficers: pool.slice(0, 5), siegeState: siegeStateOf(s, 13, 5) });
  const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: pool[5]!, troops: 3000, squadOfficers: pool.slice(5, 8), fromNodeId: 14 });
  const c: CampaignArmy = {
    ...siegeArmy({ id: 'e-c', name: '夏侯军', commanderId: aiOfficers[0]!, troops: 3000, squadOfficers: aiOfficers }),
    factionId: 1, phase: 'engaged', targetNodeId: undefined,
  };
  const rulerBefore = s.cities[13].ruler;
  s = { ...s, campaignArmies: [a, b, c] };
  const battle = createBattle(s, 13, { attackerArmies: [a, b], defenderArmy: c });
  assert(battle.units.some((u) => u.armyId === 'e-c'), '敌军入场');
  const won = forceOver(
    { ...battle, units: battle.units.map((u) => (u.side === 'defender' ? { ...u, troopCount: 0, isDestroyed: true } : u)) },
    'attacker',
  );
  const out = settleSiegeStormBattle(s, won, [a, b], () => 0.5);
  assert(!out.campaignArmies.some((x) => x.id === 'e-c'), '敌军被歼（移出军册）');
  const stayA = out.campaignArmies.find((x) => x.id === 'm-a');
  const stayB = out.campaignArmies.find((x) => x.id === 'm-b');
  assert(stayA?.phase === 'sieging' && stayB?.phase === 'sieging', '我军维持围城（非驻守）');
  assert(stayA?.siegeState?.siegeTurns === 5, '主军围城进度保留（5）');
  assert(stayA?.troops === 5000 && stayB?.troops === 3000, '野胜满编回写');
  assert(out.cities[13].ruler === rulerBefore, '城池未易手（野胜不占城）');
  assert(GameStateSchema.safeParse(out).success, '野胜后过完整 GameStateSchema');
}

// ---------------------------------------------------------------------------
console.log('\n8. 激战中卫士（assault/劝降/撤退拒绝）');
{
  let s = freshState();
  const pool = officerPool(s, 2);
  for (const oid of pool) s = deployOfficer(s, oid, 15);
  const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 4000, squadOfficers: pool.slice(0, 2), siegeState: siegeStateOf(s, 13, 1) });
  s = { ...s, campaignArmies: [a] };
  const battle = createBattle(s, 13, { attackerArmy: a });
  const engaged = { ...s, activeBattles: [battle] };
  assert(armyInActiveBattle(engaged, 'm-a'), '激战识别');
  assert(!armyInActiveBattle(engaged, 'nope'), '无关军不受影响');
  assert(throws(() => assaultForFaction(engaged, 'm-a', 2, () => 0)), '激战中自动强攻拒绝');
  assert(throws(() => trySiegeSurrender(engaged, 'm-a', () => 0)), '激战中劝降拒绝');
  assert(throws(() => retreatArmy(engaged, 'm-a')), '激战中撤退拒绝');
  assert(resolveStormArmies(engaged, battle).length === 1, '参战军可解析（未结束仅识别）');
  assert(collectSiegeStormGroup(engaged, battle).length === 0, '未结束战斗不进结算组');
  const over = forceOver(battle, 'attacker');
  assert(collectSiegeStormGroup({ ...engaged, activeBattles: [over] }, over).length === 1, '结束战斗进结算组');
  assert(GameStateSchema.safeParse(engaged).success, '含战斗快照仍过 Schema');
}

// ---------------------------------------------------------------------------
console.log('\n9. 按军撤退作用域：仅撤该军、战斗继续（D10）');
{
  const s = freshState();
  const pool = officerPool(s, 3);
  const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 4000, squadOfficers: pool.slice(0, 2) });
  const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: pool[2]!, troops: 2000, squadOfficers: pool.slice(2, 3) });
  const battle = createBattle(s, 13, { attackerArmies: [a, b] });
  assert(battle.units.filter((u) => u.side === 'attacker').length === 3, '双军 3 队入场');
  const partial = retreatBattle(battle, 'm-b');
  assert(partial.phase === 'player' && partial.winner === null, '一军撤出后战斗继续');
  assert(partial.units.filter((u) => u.isRetreated).every((u) => u.armyId === 'm-b'), '仅张飞军标记撤退');
  assert(partial.units.filter((u) => u.armyId === 'm-a').every((u) => !u.isRetreated && !u.hasActed), '关羽军不受影响');
  assert(partial.log.some((e) => e.message.startsWith('分军撤退')), '分军撤退日志');
  const finished = retreatBattle(partial);
  assert(finished.phase === 'over' && finished.winner === 'defender', '余部撤出后战斗结束');
  assert(throws(() => retreatBattle(battle, 'nope')), '未知军撤退拒绝');
}

// ---------------------------------------------------------------------------
console.log('\n10. 确定性：同参两次编组一致 + 双局 24 月一致');
{
  const s = freshState();
  const pool = officerPool(s, 8);
  const a = siegeArmy({ id: 'm-a', name: '关羽军', commanderId: pool[0]!, troops: 5000, squadOfficers: pool.slice(0, 5) });
  const b = siegeArmy({ id: 'm-b', name: '张飞军', commanderId: pool[5]!, troops: 3000, squadOfficers: pool.slice(5, 8) });
  const first = createBattle(s, 13, { attackerArmies: [a, b] });
  const second = createBattle(s, 13, { attackerArmies: [a, b] });
  assert(stable(normBattle(first)) === stable(normBattle(second)), '同参两次编组逐字节一致（除 id）');
  const run = (): string => {
    createGame(1, 2);
    for (let i = 0; i < 24; i++) endTurn();
    return stable(getGame());
  };
  assert(run() === run(), '双局 24 月终态逐字节一致');
}

console.log(`\n=== 结果: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
