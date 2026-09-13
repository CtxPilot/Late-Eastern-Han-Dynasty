// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 447 · docs/47 S5d「AI/委任对六角激战的感知与避让」验证（engine 级）。
 *
 * 断言面（docs/47 §四 D1~D3 + §五 R1~R3）：
 *   1. D3 判据 `cityInActiveBattle`（未结算/未结束/同城）；
 *   2. D2① AI 激战城不作为出征源（强对照：无激战则出征）；
 *   3. D2② `runAiMilitary` engaged 循环跳过激战军（不抛错、不重复结算）；
 *   4. D2① 委任 `runDelegationMilitary` 激战城不作为出征源（强对照）；
 *   5. R1 确定性；R2 无激战路径零变化。
 */
import {
  DelegationPolicy,
  macroAdjacentCityIds,
  type BattleState,
  type CampaignArmy,
  type GameState,
} from '@leh/shared';
import { canAiAttackFaction, runAiMilitary } from '../engine/aiMilitary.js';
import { cityInActiveBattle } from '../engine/campaign.js';
import { runDelegationMilitary } from '../engine/delegation.js';
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

/** 仅供门禁判读的最简战斗视图。 */
function fakeBattle(cityId: number, units: { armyId: string; side: 'attacker' | 'defender' }[]): BattleState {
  return {
    id: `fake-${cityId}`,
    settled: false,
    phase: 'player',
    cityId,
    fromCityId: undefined,
    units,
  } as unknown as BattleState;
}

/** 把某势力所有城兵力压到下限以下，仅保留唯一强源城。 */
function isolateSource(state: GameState, factionId: number, sourceCityId: number): GameState {
  const cities = Object.fromEntries(
    Object.entries(state.cities).map(([id, city]) => {
      const numId = Number(id);
      if (city.ruler !== factionId) return [id, city];
      return [id, { ...city, troops: numId === sourceCityId ? 12_000 : 100 }];
    }),
  );
  return { ...state, cities };
}

/** 保证某城有该势力可用的 ACTIVE 主将。 */
function ensureCommander(state: GameState, factionId: number, cityId: number): GameState {
  const officers = Object.values(state.officers);
  const already = officers.find((o) => o.faction === factionId && o.status === 'active' && o.location === cityId);
  if (already) return state;
  const pick = officers
    .filter((o) => o.faction === factionId && o.status === 'active')
    .sort((a, b) => a.id - b.id)[0];
  if (!pick) return state;
  return { ...state, officers: { ...state.officers, [pick.id]: { ...pick, location: cityId } } };
}

function campaignsFrom(state: GameState, factionId: number, fromNodeId: number): CampaignArmy[] {
  return state.campaignArmies.filter((a) => a.factionId === factionId && a.fromNodeId === fromNodeId);
}

console.log('\n=== Session 447 · docs/47 S5d AI/委任 六角激战避让验证 ===\n');

// ---------------------------------------------------------------------------
console.log('1. D3 判据 cityInActiveBattle');
{
  const base = freshState();
  const active = fakeBattle(13, []);
  assert(cityInActiveBattle({ ...base, activeBattles: [active] }, 13) === true, '未结算同城 → true');
  assert(cityInActiveBattle({ ...base, activeBattles: [active] }, 14) === false, '异城 → false');
  assert(cityInActiveBattle({ ...base, activeBattles: [{ ...active, settled: true } as BattleState] }, 13) === false, '已结算 → false');
  assert(cityInActiveBattle({ ...base, activeBattles: [{ ...active, phase: 'over' } as BattleState] }, 13) === false, '已结束 → false');
  assert(cityInActiveBattle(base, 13) === false, '无战斗 → false');
}

// ---------------------------------------------------------------------------
console.log('\n2. D2① AI 激战城不作为出征源（强对照）');
{
  const base = ensureCommander(freshState(), 1, 13);
  const state0 = isolateSource(base, 1, 13);
  assert(macroAdjacentCityIds(13).includes(15) && canAiAttackFaction(state0, 1, 2), '城 13 邻敌 15（势力 2）');
  // 对照：无激战 → 从 13 出征
  const control = runAiMilitary(state0, () => 0, () => 0);
  assert(campaignsFrom(control, 1, 13).length === 1, `无激战：13 出征 1 支（${campaignsFrom(control, 1, 13).length}）`);
  // 激战：13 不再出征
  const withBattle: GameState = { ...state0, activeBattles: [fakeBattle(13, [])] };
  const guarded = runAiMilitary(withBattle, () => 0, () => 0);
  assert(campaignsFrom(guarded, 1, 13).length === 0, `激战：13 不出征（${campaignsFrom(guarded, 1, 13).length}）`);
}

// ---------------------------------------------------------------------------
console.log('\n3. D2② runAiMilitary engaged 循环跳过激战军（防抛错中断）');
{
  const base = ensureCommander(freshState(), 1, 13);
  const state0 = isolateSource(base, 1, 13);
  const aiArmy = {
    id: 'ai-x', factionId: 1, name: 'AI 围城军',
    commanderId: state0.cities[13]!.officers[0] ?? Object.values(state0.officers).find((o) => o.faction === 1)!.id,
    subCommanderIds: [], unitType: 'lightInfantry', formation: 0,
    currentNodeId: 15, targetNodeId: 15, path: [], phase: 'sieging',
    troops: 8_000, maxTroops: 8_000, food: 9_000, maxFood: 24_000,
    morale: 80, organization: 80, experience: 0, fatigue: 0,
    squads: [], structures: [], fromNodeId: 13,
  } as unknown as CampaignArmy;
  const withBattle: GameState = {
    ...state0,
    campaignArmies: [...state0.campaignArmies, aiArmy],
    activeBattles: [fakeBattle(15, [{ armyId: 'ai-x', side: 'attacker' }])],
  };
  let threw = false;
  let out: GameState | undefined;
  try {
    out = runAiMilitary(withBattle, () => 0, () => 0);
  } catch (e) {
    threw = true;
    console.error(`    (throw: ${e instanceof Error ? e.message : String(e)})`);
  }
  assert(!threw, '激战军在场：runAiMilitary 不抛错（无守卫将撞 assaultForFaction 抛错）');
  assert(out?.campaignArmies.find((a) => a.id === 'ai-x')?.phase === 'sieging', '激战军被跳过、保持围城不变');
  assert(!(out?.actionLog ?? []).some((l) => l.message.includes('【战报】') && l.message.includes('AI 围城军')), '激战军未产生自动战战报');
}

// ---------------------------------------------------------------------------
console.log('\n4. D2① 委任激战城不作为出征源（强对照）');
{
  const base = ensureCommander(freshState(), 2, 15);
  const withRegion: GameState = {
    ...base,
    cities: { ...base.cities, 15: { ...base.cities[15]!, troops: 12_000 } },
    factions: {
      ...base.factions,
      2: {
        ...base.factions[2]!,
        delegationRegions: [{
          id: 1, name: '荆州委任区', cityIds: [15],
          governorId: Object.values(base.officers).find((o) => o.faction === 2 && o.status === 'active')!.id,
          policy: DelegationPolicy.OFFENSIVE, autoRecruit: false, autoReward: false, createdYear: base.currentYear,
        }],
      },
    },
  };
  const control = runDelegationMilitary(withRegion, () => 0, () => 0);
  assert(campaignsFrom(control, 2, 15).length === 1, `无激战：委任从 15 出征 1 支（${campaignsFrom(control, 2, 15).length}）`);
  const guarded = runDelegationMilitary({ ...withRegion, activeBattles: [fakeBattle(15, [])] }, () => 0, () => 0);
  assert(campaignsFrom(guarded, 2, 15).length === 0, `激战：委任 15 不出征（${campaignsFrom(guarded, 2, 15).length}）`);
}

// ---------------------------------------------------------------------------
console.log('\n5. R1 确定性 + R2 无激战零变化');
{
  const base = ensureCommander(freshState(), 1, 13);
  const state0 = isolateSource(base, 1, 13);
  const a = runAiMilitary({ ...state0, activeBattles: [fakeBattle(13, [])] }, () => 0, () => 0);
  const b = runAiMilitary({ ...state0, activeBattles: [fakeBattle(13, [])] }, () => 0, () => 0);
  assert(stable(a.campaignArmies) === stable(b.campaignArmies), '双局 campaignArmies 逐字节一致（零 RNG）');
  assert(cityInActiveBattle(state0, 13) === false, 'R2：无激战状态判据为 false（门禁不触发）');
}

console.log(`\nSession 447 S5d AI/委任激战避让: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
