// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  DipRelation,
  OfficerStatus,
  canMarchAlongRoad,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import {
  canAiAttackFaction,
  getFactionAggression,
  runAiMilitary,
} from '../engine/aiMilitary.js';
import { tickCampaignMarch } from '../engine/campaign.js';
import { getRuntimeRngState, resetRuntimeRng, runtimeRandom } from '../runtime-rng.js';
import { createGame, getGame, restoreGameFromEnvelope } from '../services/game.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

function envelopeFor(snapshot: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-23T12:00:00.000Z',
    updatedAt: '2026-07-23T12:00:00.000Z',
    scenarioId: snapshot.scenarioId,
    rng: getRuntimeRngState(),
    snapshot,
  };
}

function makeBorderState(fromTroops: number, targetTroops: number): {
  state: GameState;
  fromId: number;
  targetId: number;
  aiFactionId: number;
  targetFactionId: number;
} {
  createGame(1, 1);
  const initial = getGame();
  const pair = Object.values(initial.cities).flatMap((from) =>
    Object.values(initial.cities)
      .filter((target) =>
        from.ruler != null &&
        target.ruler != null &&
        from.ruler !== target.ruler &&
        canMarchAlongRoad(from.id, target.id),
      )
      .map((target) => ({ from, target })),
  )[0];
  if (!pair) throw new Error('AI 军事验证缺少分属两势力的相邻城池');

  const aiFactionId = pair.from.ruler!;
  const targetFactionId = pair.target.ruler!;
  const aiFaction = initial.factions[aiFactionId];
  const targetFaction = initial.factions[targetFactionId];
  if (!aiFaction || !targetFaction) throw new Error('AI 军事验证缺少双方势力');

  const commander = Object.values(initial.officers).find(
    (officer) => officer.faction === aiFactionId && officer.status === OfficerStatus.ACTIVE,
  );
  if (!commander) throw new Error('AI 军事验证缺少攻方主将');

  const factions = Object.fromEntries(Object.values(initial.factions).map((faction) => [
    faction.id,
    faction.id === aiFactionId
      ? {
          ...faction,
          isAlive: true,
          isPlayer: false,
          capitalCityId: pair.from.id,
          officerIds: Array.from(new Set([...faction.officerIds, commander.id])),
        }
      : faction.id === targetFactionId
        ? { ...faction, isAlive: true, isPlayer: true }
        : { ...faction, isAlive: false, isPlayer: false },
  ]));
  const cities = Object.fromEntries(Object.values(initial.cities).map((city) => [
    city.id,
    city.id === pair.from.id
      ? {
          ...city,
          ruler: aiFactionId,
          troops: fromTroops,
          food: Math.max(city.food, 30_000),
          officers: Array.from(new Set([...city.officers, commander.id])),
        }
      : city.id === pair.target.id
        ? { ...city, ruler: targetFactionId, troops: targetTroops }
        : city.ruler === aiFactionId
          ? { ...city, troops: 0, officers: city.officers.filter((id) => id !== commander.id) }
          : city.ruler === targetFactionId
            ? { ...city, troops: 100_000, officers: city.officers.filter((id) => id !== commander.id) }
            : { ...city, officers: city.officers.filter((id) => id !== commander.id) },
  ]));
  const officers = {
    ...initial.officers,
    [commander.id]: { ...commander, faction: aiFactionId, location: pair.from.id },
  };
  const diplomacy = [
    {
      factionA: aiFactionId,
      factionB: targetFactionId,
      relation: DipRelation.HOSTILE,
      favorability: -40,
    },
  ];

  return {
    state: {
      ...initial,
      playerFactionId: targetFactionId,
      factions,
      cities,
      officers,
      diplomacy,
      plots: [],
      campaignArmies: [],
      actionLog: [],
    },
    fromId: pair.from.id,
    targetId: pair.target.id,
    aiFactionId,
    targetFactionId,
  };
}

// 外交排除：只有战争/敌对可选，中立/友好/同盟均不可攻击。
const diplomacyFixture = makeBorderState(5_000, 5_000);
assert(
  canAiAttackFaction(diplomacyFixture.state, diplomacyFixture.aiFactionId, diplomacyFixture.targetFactionId),
  '敌对关系必须允许 AI 军事行动',
);
for (const relation of [DipRelation.NEUTRAL, DipRelation.FRIENDLY, DipRelation.ALLIED]) {
  const state = {
    ...diplomacyFixture.state,
    diplomacy: [{ ...diplomacyFixture.state.diplomacy[0], relation }],
  };
  assert(
    !canAiAttackFaction(state, diplomacyFixture.aiFactionId, diplomacyFixture.targetFactionId),
    `${relation} 关系必须排除 AI 军事行动`,
  );
  const after = runAiMilitary(state, () => 0, () => 0);
  assert(after.campaignArmies.length === 0, `${relation} 关系不得创建 CampaignArmy`);
  assert(after.cities[diplomacyFixture.targetId].troops === 5_000, `${relation} 关系不得产生袭扰伤亡`);
}

// 激进度：同一势力由君主野心为主、统率为辅派生，且有稳定上下界。
const faction = diplomacyFixture.state.factions[diplomacyFixture.aiFactionId];
const ruler = diplomacyFixture.state.officers[faction.rulerId];
if (!ruler) throw new Error('AI 军事验证缺少君主');
const cautiousState = {
  ...diplomacyFixture.state,
  officers: {
    ...diplomacyFixture.state.officers,
    [ruler.id]: {
      ...ruler,
      hidden: { ...ruler.hidden, ambition: 0 },
      stats: { ...ruler.stats, leadership: 40 },
    },
  },
};
const aggressiveState = {
  ...diplomacyFixture.state,
  officers: {
    ...diplomacyFixture.state.officers,
    [ruler.id]: {
      ...ruler,
      hidden: { ...ruler.hidden, ambition: 15 },
      stats: { ...ruler.stats, leadership: 100 },
    },
  },
};
assert(
  getFactionAggression(aggressiveState, diplomacyFixture.aiFactionId) >
    getFactionAggression(cautiousState, diplomacyFixture.aiFactionId),
  '高野心/高统率君主必须产生更高军事激进度',
);
assert(getFactionAggression(cautiousState, diplomacyFixture.aiFactionId) >= 0.75, '激进度不得低于配置下界');
assert(getFactionAggression(aggressiveState, diplomacyFixture.aiFactionId) <= 1.35, '激进度不得高于配置上界');

// CampaignArmy 主路径：决策通过后真实扣城兵粮、生成 Army、行军、交战与战报。
const campaignFixture = makeBorderState(5_000, 5_000);
const started = runAiMilitary(campaignFixture.state, () => 0.5, () => 0);
const army = started.campaignArmies.find((item) => item.factionId === campaignFixture.aiFactionId);
assert(army != null, 'AI 占城决策通过后必须创建真实 CampaignArmy');
assert(army.phase === 'marching', 'AI CampaignArmy 初始阶段必须为 marching');
assert(started.cities[campaignFixture.fromId].troops < 5_000, 'AI 出征必须从出发城扣除真实兵力');
assert(started.actionLog.some((log) => log.type === 'ai_war_report'), 'AI 出征必须生成玩家可见军情');
const arrived = tickCampaignMarch(started);
const arrivedArmy = arrived.campaignArmies.find((item) => item.id === army.id);
assert(arrivedArmy?.phase === 'sieging', 'AI Army 沿邻接道路推进后必须进入围城');
const resolved = runAiMilitary(arrived, () => 0.5, () => 1);
assert(resolved.actionLog.some((log) => log.type === 'ai_battle_report'), 'AI 自动战斗必须生成胜败战报');

// 袭扰仍是轻量行动，但其决策与两次伤亡抽样均接权威 xorshift32-v1。
const raidFixture = makeBorderState(3_000, 1_500);
resetRuntimeRng(0x15_0001);
const save = envelopeFor(raidFixture.state);
restoreGameFromEnvelope(save);
const expected = runAiMilitary(getGame(), runtimeRandom, () => 0);
const expectedRng = getRuntimeRngState();
assert(expectedRng.draws === save.rng.draws + 2, '袭扰伤亡必须固定消费两次权威 RNG');
assert(expected.cities[raidFixture.fromId].troops < raidFixture.state.cities[raidFixture.fromId].troops, '袭扰必须结算攻方损失');
assert(expected.cities[raidFixture.targetId].troops < raidFixture.state.cities[raidFixture.targetId].troops, '袭扰必须结算守方损失');
assert(expected.actionLog.some((log) => log.type === 'ai_war_report'), '袭扰必须写入玩家可见战报');

restoreGameFromEnvelope(save);
const actual = runAiMilitary(getGame(), runtimeRandom, () => 0);
const actualRng = getRuntimeRngState();
assert(JSON.stringify(actual) === JSON.stringify(expected), '读档后的 AI 袭扰完整结算必须一致');
assert(JSON.stringify(actualRng) === JSON.stringify(expectedRng), '读档后的 AI 袭扰 RNG 状态与消费次数必须一致');

restoreGameFromEnvelope(save);
const fullyAuthoritative = runAiMilitary(getGame(), runtimeRandom);
const fullyAuthoritativeRng = getRuntimeRngState();
assert(
  fullyAuthoritativeRng.draws === save.rng.draws + 1 ||
    fullyAuthoritativeRng.draws === save.rng.draws + 3,
  '默认路径必须由同一权威 RNG 消费 1 次决策，并仅在成行时追加 2 次袭扰结算',
);
restoreGameFromEnvelope(save);
const fullyAuthoritativeReplay = runAiMilitary(getGame(), runtimeRandom);
assert(
  JSON.stringify(fullyAuthoritativeReplay) === JSON.stringify(fullyAuthoritative),
  '默认权威决策路径在同一保存点恢复后必须完整复现',
);

restoreGameFromEnvelope(save);
const noAction = runAiMilitary(getGame(), runtimeRandom, () => 1);
assert(getRuntimeRngState().draws === save.rng.draws, 'AI 决定不行动时不得消费权威结算流');
assert(JSON.stringify(noAction.cities) === JSON.stringify(raidFixture.state.cities), 'AI 不行动时不得产生伤亡结算');

console.log(`AI military diplomacy/campaign/determinism verification passed: ${passed}/29`);
