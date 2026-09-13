// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 445 · docs/45 S5b「行军到达自动入场」验证。
 *
 * 断言面（docs/45 §四 D2/D6/D7/D10 + §五 R1~R4）：
 *   1. D6 月结到达注入（攻方：path 空 / path 尾节点两条到达分支）；
 *   2. D6/D2 守方解围军（抵达己方被围城 → 驻守 → 入守方侧）；
 *   3. D7 AI 守方增援上限 2（第三支留屯 + 战报）；
 *   4. D6/F12 单挑暂停门禁：只转围城不入场；
 *   5. D3 容量满：留屯城下 + 战报，资格保留（可补）；
 *   6. D10/F11：`largestEnemyArmyAt` 排除激战中军（不重复结算）；
 *   7. R1 确定性：同状态双次 tick 逐字节一致（零 RNG）；
 *   8. R2 无增援路径不触碰 activeBattles（引用不变）；
 *   9. R3 存档兼容：增援后完整 GameStateSchema 通过；
 *  10. D9 候选：`reinforcementCandidates` 攻守两侧 + 激战中/单挑排除。
 */
import {
  FormationType,
  GameStateSchema,
  UnitType,
  isHostileOrAtWar,
  reinforcementCandidates,
  reinforcementSideFor,
  type BattleState,
  type CampaignArmy,
  type GameState,
  type SquadPosition,
} from '@leh/shared';
import {
  MAX_AI_DEFENDER_REINFORCEMENTS,
  aiDefenderReinforcementBlocked,
  createBattle,
  reinforceActiveBattle,
} from '../engine/battle.js';
import { largestEnemyArmyAt, tickCampaignMarch } from '../engine/campaign.js';
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
function throws(fn: () => void, include: string): boolean {
  try {
    fn();
    return false;
  } catch (e) {
    return (e instanceof Error ? e.message : String(e)).includes(include);
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

/** 玩家势力（2）的敌对城 id。 */
function enemyCityId(state: GameState): number {
  const found = Object.values(state.cities).find(
    (c) => c.ruler != null && c.ruler !== 2 && isHostileOrAtWar(state.diplomacy, 2, c.ruler),
  );
  if (!found) throw new Error('无玩家敌对城');
  return found.id;
}

/** 攻方围城战基座：主军（玩家）围敌城，返回 battle。 */
function stormBase(): { state: GameState; main: CampaignArmy; battle: BattleState } {
  const base = freshState();
  const cityId = enemyCityId(base);
  const pool = officerPool(base, 2, 4);
  const main = army({
    id: 'p-a', name: '关羽军', commanderId: pool[0]!, troops: 5000, squadOfficers: pool.slice(0, 2),
    currentNodeId: cityId, targetNodeId: cityId,
  });
  const state: GameState = { ...base, campaignArmies: [main] };
  const battle = createBattle(state, cityId, { attackerArmies: [main] });
  return { state, main, battle };
}

console.log('\n=== Session 445 · docs/45 S5b 行军到达自动入场验证 ===\n');

// ---------------------------------------------------------------------------
console.log('1. D6 攻方到达注入（path 空分支）');
{
  const { state, main, battle } = stormBase();
  const cid = battle.cityId!;
  const base = { ...state, campaignArmies: [main] };
  const pool = officerPool(base, 2, 4);
  const arrive = army({
    id: 'p-b', name: '张飞军', commanderId: pool[2]!, troops: 3000, squadOfficers: pool.slice(2, 4),
    currentNodeId: 15, targetNodeId: cid, phase: 'marching', path: [],
  });
  const withBattle: GameState = { ...base, activeBattles: [battle], campaignArmies: [main, arrive] };
  const next = tickCampaignMarch(withBattle);
  const entered = next.activeBattles[0]!.units.filter((u) => u.armyId === 'p-b');
  assert(entered.length === 2, `整军 2 队入场（${entered.length}）`);
  assert(entered.every((u) => u.hasActed === true && u.mp === 0), 'D5：入场单位待命（hasActed/mp=0）');
  assert(next.activeBattles[0]!.reinforcedArmyIds?.join(',') === 'p-b', 'R3：reinforcedArmyIds 记录入场军');
  assert(next.activeBattles[0]!.log.at(-1)?.message === '张飞军 赶到战场，增援入场（兵力 3000，本回合待命）', `战报：${next.activeBattles[0]!.log.at(-1)?.message ?? ''}`);
  assert(next.campaignArmies.find((a) => a.id === 'p-b')?.phase === 'sieging', '到达军转围城');
}

// ---------------------------------------------------------------------------
console.log('\n2. D6 攻方到达注入（path 尾节点分支）');
{
  const { state, main, battle } = stormBase();
  const cid = battle.cityId!;
  const base = { ...state, campaignArmies: [main] };
  const pool = officerPool(base, 2, 4);
  const arrive = army({
    id: 'p-c', name: '赵云军', commanderId: pool[2]!, troops: 2600, squadOfficers: pool.slice(2, 4),
    currentNodeId: 15, targetNodeId: cid, phase: 'marching', path: [cid], fromNodeId: 15,
  });
  const withBattle: GameState = { ...base, activeBattles: [battle], campaignArmies: [main, arrive] };
  const next = tickCampaignMarch(withBattle);
  assert(next.activeBattles[0]!.units.filter((u) => u.armyId === 'p-c').length === 2, '尾节点到达分支同样入场 2 队');
  assert(next.campaignArmies.find((a) => a.id === 'p-c')?.path.length === 0, '路径耗尽');
}

// ---------------------------------------------------------------------------
console.log('\n3. D6/D2 守方解围军（抵达己方被围城 → 入守方侧）');
{
  const { state, main, battle } = stormBase();
  const cid = battle.cityId!;
  const defFaction = battle.defenderFaction;
  const base = { ...state, campaignArmies: [main] };
  const pool = officerPool(base, defFaction, 4);
  const relief = army({
    id: 'd-relief', name: '解围军', commanderId: pool[0]!, troops: 2200, squadOfficers: pool.slice(0, 2),
    currentNodeId: 15, targetNodeId: cid, phase: 'marching', path: [], factionId: defFaction,
  });
  const withBattle: GameState = { ...base, activeBattles: [battle], campaignArmies: [main, relief] };
  const next = tickCampaignMarch(withBattle);
  const entered = next.activeBattles[0]!.units.filter((u) => u.armyId === 'd-relief');
  assert(entered.length === 2, `守方解围军入场 2 队（${entered.length}）`);
  assert(entered.every((u) => u.side === 'defender'), '整军入守方侧');
  assert(next.campaignArmies.find((a) => a.id === 'd-relief')?.phase === 'garrison', '解围军驻守己方城');
  // 手动入场限己方军：D2 放宽后须拒敌守方 garrison，防玩家误入敌军
  const reliefGarrison: CampaignArmy = { ...relief, phase: 'garrison' };
  assert(reinforcementSideFor(battle, reliefGarrison) === 'defender', 'D2：守方解围军判为守方侧');
  assert(throws(() => reinforceActiveBattle({ ...base, campaignArmies: [main, reliefGarrison] }, battle, 'd-relief'), '非己方 Army'), '手动入场拒绝非己方军');
}

// ---------------------------------------------------------------------------
console.log('\n4. D7 AI 守方增援上限 2（第三支留屯）');
{
  const { state, main, battle } = stormBase();
  const cid = battle.cityId!;
  const defFaction = battle.defenderFaction;
  const base = { ...state, campaignArmies: [main] };
  const pool = officerPool(base, defFaction, 6);
  const relief = [0, 1, 2].map((n) =>
    army({
      id: `d-r${n}`, name: `解围${n}军`, commanderId: pool[n]!, troops: 1500 + n,
      squadOfficers: [pool[n]!], currentNodeId: 15, targetNodeId: cid,
      phase: 'marching', path: [], factionId: defFaction,
    }),
  );
  const withBattle: GameState = { ...base, activeBattles: [battle], campaignArmies: [main, ...relief] };
  const next = tickCampaignMarch(withBattle);
  const inBattle = (id: string) => next.activeBattles[0]!.units.some((u) => u.armyId === id);
  assert(MAX_AI_DEFENDER_REINFORCEMENTS === 2, 'D7 上限常量 = 2');
  assert(inBattle('d-r0') && inBattle('d-r1'), '前两支 AI 守方增援入场');
  assert(!inBattle('d-r2'), '第三支超限不入场');
  assert(next.activeBattles[0]!.reinforcedArmyIds?.length === 2, 'reinforcedArmyIds 记两支');
  assert(
    next.actionLog.some((l) => l.message.includes('敌军增援已达上限')),
    '超限留屯战报一行',
  );
  assert(next.campaignArmies.find((a) => a.id === 'd-r2')?.phase === 'garrison', '超限军留驻城下');
  // D7 直接判定：AI 守方在场 2 支增援 → 阻断；攻方不受限
  assert(aiDefenderReinforcementBlocked(next, next.activeBattles[0]!, 'defender') === true, 'AI 守方在场 2 支 → 阻断');
  assert(aiDefenderReinforcementBlocked(next, next.activeBattles[0]!, 'attacker') === false, '攻方不受 D7 上限约束');
  const playerDefender: GameState = { ...next, factions: { ...next.factions, [defFaction]: { ...next.factions[defFaction]!, isPlayer: true } } };
  assert(aiDefenderReinforcementBlocked(playerDefender, next.activeBattles[0]!, 'defender') === false, '玩家守方不受 D7 上限约束');
}

// ---------------------------------------------------------------------------
console.log('\n5. D6/F12 单挑暂停门禁：只转围城不入场');
{
  const { state, main, battle } = stormBase();
  const cid = battle.cityId!;
  const base = { ...state, campaignArmies: [main] };
  const pool = officerPool(base, 2, 4);
  const arrive = army({
    id: 'p-duel', name: '暂停军', commanderId: pool[2]!, troops: 2000, squadOfficers: pool.slice(2, 4),
    currentNodeId: 15, targetNodeId: cid, phase: 'marching', path: [],
  });
  const duelBattle: BattleState = { ...battle, duel: { phase: 'active' } as never };
  assert(reinforcementSideFor(duelBattle, arrive) === null, 'D2/F12：单挑暂停不合资格');
  const withBattle: GameState = { ...base, activeBattles: [duelBattle], campaignArmies: [main, arrive] };
  const next = tickCampaignMarch(withBattle);
  assert(next.activeBattles[0]!.units.every((u) => u.armyId !== 'p-duel'), '单挑暂停：未注入单位');
  assert(next.activeBattles === withBattle.activeBattles, '单挑暂停：battle 引用不变（未触碰）');
  assert(next.campaignArmies.find((a) => a.id === 'p-duel')?.phase === 'sieging', 'D6：仍转围城待下月/手动补入');
}

// ---------------------------------------------------------------------------
console.log('\n6. D3 容量满：留屯城下 + 资格保留');
{
  const base0 = freshState();
  const cid = enemyCityId(base0);
  const pool = officerPool(base0, 2, 10);
  // 主军 5 队 → 攻方侧 5 单位；到达军 4 队 → 5+4>8 超帽。
  const main = army({
    id: 'cap-a', name: '主军', commanderId: pool[0]!, troops: 5000, squadOfficers: pool.slice(0, 5),
    currentNodeId: cid, targetNodeId: cid,
  });
  const full = army({
    id: 'cap-b', name: '满援', commanderId: pool[5]!, troops: 4000,
    squadOfficers: pool.slice(5, 8).concat(pool[0]!), currentNodeId: 15, targetNodeId: cid,
    phase: 'marching', path: [],
  });
  const base = { ...base0, campaignArmies: [main] };
  const battle = createBattle(base, cid, { attackerArmies: [main] });
  assert(battle.units.filter((u) => u.side === 'attacker').length === 5, '主军 5 队在场');
  const withBattle: GameState = { ...base, activeBattles: [battle], campaignArmies: [main, full] };
  const next = tickCampaignMarch(withBattle);
  assert(next.activeBattles[0]!.units.every((u) => u.armyId !== 'cap-b'), '5+4>8：整军不入场');
  assert(next.activeBattles[0]!.reinforcedArmyIds == null, '未记录入场军');
  assert(next.actionLog.some((l) => l.message.includes('战场已满')), '满帽留屯战报一行');
  const stay = next.campaignArmies.find((a) => a.id === 'cap-b');
  assert(stay?.phase === 'sieging', '留屯军仍围城');
  assert(reinforcementSideFor(next.activeBattles[0]!, stay!) === 'attacker', '资格保留（容量释放后可补）');
}

// ---------------------------------------------------------------------------
console.log('\n7. D10/F11 largestEnemyArmyAt 排除激战中军');
{
  const { state, battle } = stormBase();
  const cid = battle.cityId!;
  const defFaction = battle.defenderFaction;
  // 敌方（判敌）在城：p-a 正处激战快照中；p-b 未入战。
  const pA = state.campaignArmies[0]!;
  const pool = officerPool(state, 2, 4);
  const pB = army({ id: 'p-b', name: '未战军', commanderId: pool[2]!, troops: 9000, squadOfficers: pool.slice(2, 4), currentNodeId: cid, targetNodeId: cid });
  const aiActor = army({ id: 'ai-act', name: 'AI 军', commanderId: pool[0]!, troops: 3000, squadOfficers: [pool[0]!], factionId: defFaction, currentNodeId: cid, targetNodeId: cid });
  const withBattle: GameState = { ...state, activeBattles: [battle], campaignArmies: [pA, pB, aiActor] };
  const picked = largestEnemyArmyAt(withBattle, aiActor, cid);
  assert(picked?.id === 'p-b', `激战中 p-a 被排除、选中未战 p-b（${picked?.id ?? 'undefined'}）`);
  const onlyInBattle: GameState = { ...state, activeBattles: [battle], campaignArmies: [pA, aiActor] };
  assert(largestEnemyArmyAt(onlyInBattle, aiActor, cid) === undefined, '仅激战军可敌 → 不选（不重复结算）');
}

// ---------------------------------------------------------------------------
console.log('\n8. R1 确定性：双次 tick 逐字节一致（零 RNG）');
{
  const build = (): GameState => {
    const { state, main, battle } = stormBase();
    const base = { ...state, campaignArmies: [main] };
    const pool = officerPool(base, 2, 4);
    const arrive = army({
      id: 'p-b', name: '张飞军', commanderId: pool[2]!, troops: 3000, squadOfficers: pool.slice(2, 4),
      currentNodeId: 15, targetNodeId: battle.cityId!, phase: 'marching', path: [],
    });
    return { ...base, activeBattles: [battle], campaignArmies: [main, arrive] };
  };
  const a = tickCampaignMarch(build());
  const b = tickCampaignMarch(build());
  assert(stable(a.activeBattles[0]!.units) === stable(b.activeBattles[0]!.units), '两局增援单位逐字节一致');
  assert(stable(a.activeBattles[0]!.log) === stable(b.activeBattles[0]!.log), '两局战报逐字节一致');
  assert(stable(a.activeBattles[0]!.reinforcedArmyIds) === stable(b.activeBattles[0]!.reinforcedArmyIds), '两局入场记录一致');
  assert(stable(a.campaignArmies) === stable(b.campaignArmies), '两局 campaignArmies 逐字节一致');
}

// ---------------------------------------------------------------------------
console.log('\n9. R2 无增援路径不触碰 activeBattles');
{
  const { state, main, battle } = stormBase();
  const cid = battle.cityId!;
  const base = { ...state, campaignArmies: [main] };
  const pool = officerPool(base, 2, 4);
  const march = army({
    id: 'p-far', name: '远军', commanderId: pool[2]!, troops: 3000, squadOfficers: pool.slice(2, 4),
    currentNodeId: 15, targetNodeId: 16, phase: 'marching', path: [],
  });
  // 到达非战斗城（同势力据点走 garrison）→ 不应触碰 activeBattles
  const cityId = Object.values(base.cities).find((c) => c.ruler === 2)?.id ?? cid;
  const withBattle: GameState = { ...base, activeBattles: [battle], campaignArmies: [main, { ...march, targetNodeId: cityId }] };
  const next = tickCampaignMarch(withBattle);
  assert(next.activeBattles === withBattle.activeBattles, '无增援到达：activeBattles 引用不变（R2 逐字节不变）');
}

// ---------------------------------------------------------------------------
console.log('\n10. R3 存档兼容 + D9 候选');
{
  const { state, main, battle } = stormBase();
  const cid = battle.cityId!;
  const base = { ...state, campaignArmies: [main] };
  const pool = officerPool(base, 2, 4);
  const arrive = army({
    id: 'p-b', name: '张飞军', commanderId: pool[2]!, troops: 3000, squadOfficers: pool.slice(2, 4),
    currentNodeId: 15, targetNodeId: cid, phase: 'marching', path: [],
  });
  const withBattle: GameState = { ...base, activeBattles: [battle], campaignArmies: [main, arrive] };
  const next = tickCampaignMarch(withBattle);
  const parsed = GameStateSchema.safeParse(next);
  assert(parsed.success, `增援后过完整 GameStateSchema${parsed.success ? '' : `：${parsed.error.issues[0]?.message ?? ''}`}`);
  // 候选：待入场军列出；入战后不再列出
  const before = reinforcementCandidates(withBattle.activeBattles[0]!, [{ ...arrive, phase: 'sieging' }]).map((a) => a.id);
  assert(before.join(',') === 'p-b', `围城中到达军可选（${before.join(',')}）`);
  assert(reinforcementCandidates(withBattle.activeBattles[0]!, withBattle.campaignArmies).length === 0, '行军中/已入战不可选');
  assert(reinforcementCandidates(next.activeBattles[0]!, next.campaignArmies).length === 0, '入战后无候选');
}

console.log(`\nSession 445 S5b 行军到达自动入场: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
