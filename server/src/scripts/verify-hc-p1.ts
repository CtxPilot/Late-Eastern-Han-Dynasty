// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  GameStateSchema,
  HegemonyPosition,
  NobilityRank,
  controlsEmperor,
  parseCurrentSaveEnvelope,
  playerCitiesAdjacentTo,
  type BattleState,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { appointOfficer } from '../engine/appoint.js';
import { tributeGold } from '../engine/diplomacy.js';
import {
  establishHegemony,
  getKingRequirements,
  proclaimKing,
} from '../engine/hegemony.js';
import { prepareMarch, settleBattle } from '../engine/march.js';
import { grantNobility } from '../engine/nobility.js';
import { advanceTurn } from '../engine/turn.js';
import {
  createGame,
  getGame,
  restoreGameFromEnvelope,
} from '../services/game.js';
import { getRuntimeRngState } from '../runtime-rng.js';

let assertions = 0;
function check(label: string, condition: unknown): asserts condition {
  if (!condition) throw new Error(`FAIL: ${label}`);
  assertions += 1;
  console.log(`✓ ${label}`);
}

function envelopeFor(snapshot: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-28T12:00:00.000Z',
    updatedAt: '2026-07-28T12:00:00.000Z',
    scenarioId: snapshot.scenarioId,
    rng: getRuntimeRngState(),
    snapshot,
  };
}

function passMonths(state: GameState, count: number): GameState {
  let next = state;
  for (let month = 0; month < count; month += 1) {
    next = advanceTurn(next, () => 0.5);
  }
  return next;
}

/**
 * 使用正式出征准备与占城结算，只把六角战斗压缩成确定的“攻方胜”夹具。
 * HC-P1 验收关心领土回写；六角过程本身已有独立确定性测试。
 */
function captureOneReachableCity(state: GameState): GameState {
  const faction = state.factions[state.playerFactionId];
  for (const target of Object.values(state.cities)) {
    if (target.ruler == null || target.ruler === state.playerFactionId) continue;
    const sourceId = playerCitiesAdjacentTo(faction.cityIds, target.id)
      .find((cityId) => (state.cities[cityId]?.troops ?? 0) >= 1_500);
    if (sourceId == null) continue;
    const source = state.cities[sourceId];
    const strengthened = {
      ...state,
      cities: {
        ...state.cities,
        [sourceId]: { ...source, troops: Math.max(source.troops, 10_000), food: Math.max(source.food, 10_000) },
      },
    };
    const prepared = prepareMarch(strengthened, {
      fromCityId: sourceId,
      targetCityId: target.id,
      troopCount: 8_000,
    });
    const won: BattleState = {
      ...prepared.battle,
      phase: 'over',
      winner: 'attacker',
      units: prepared.battle.units.map((unit) =>
        unit.side === 'defender'
          ? { ...unit, troopCount: 0, isDestroyed: true }
          : unit,
      ),
    };
    return settleBattle(prepared.state, won, () => 0.5);
  }
  throw new Error('190 验收夹具找不到可沿官道攻打的相邻敌城');
}

function completeKingPath(initial: GameState, requireConquest: boolean): GameState {
  let state = initial;
  const citiesAtScenarioStart = state.factions[state.playerFactionId].cityIds.length;
  while (!controlsEmperor(state, state.playerFactionId)) {
    state = captureOneReachableCity(state);
  }
  check(
    `剧本${state.scenarioId}：控制汉帝取得开府资格`,
    controlsEmperor(state, state.playerFactionId),
  );
  state = establishHegemony(state, state.playerFactionId);
  check(`剧本${state.scenarioId}：成功开霸府`, state.factions[state.playerFactionId].politicalStage === 'hegemon');

  const threshold = getKingRequirements(state, state.playerFactionId).cityCount.threshold;
  while (state.factions[state.playerFactionId].cityIds.length < threshold) {
    state = captureOneReachableCity(state);
  }
  check(
    `剧本${state.scenarioId}：${requireConquest ? '沿官道攻至' : '开局已满足'}称王规模 ${threshold} 城`,
    state.factions[state.playerFactionId].cityIds.length >= threshold
      && (!requireConquest || state.factions[state.playerFactionId].cityIds.length > citiesAtScenarioStart),
  );

  state = passMonths(state, 12);
  const requirements = getKingRequirements(state, state.playerFactionId);
  check(`剧本${state.scenarioId}：完整推进12个月`, requirements.politicalStageAgeMonths.current === 12);
  check(`剧本${state.scenarioId}：规模/沉淀/皇权全部满足`, requirements.allPassed);
  const kingdomName = requirements.kingdomNameCandidates.find(({ available }) => available)?.name;
  if (!kingdomName) throw new Error('没有可用王号');
  state = proclaimKing(state, state.playerFactionId, kingdomName);
  check(`剧本${state.scenarioId}：称王并固定王号`, state.factions[state.playerFactionId].politicalStage === 'king'
    && state.factions[state.playerFactionId].kingdomName === kingdomName);
  return state;
}

console.log('\n=== HC-P1 称王完整链总验收 ===\n');

createGame(1, 1);
let heroes = completeKingPath(structuredClone(getGame()), false);
const rulerId = heroes.factions[heroes.playerFactionId].rulerId;
heroes.officers[rulerId] = {
  ...heroes.officers[rulerId],
  stats: { leadership: 100, war: 100, intelligence: 100, politics: 100, charisma: 100 },
};
heroes = appointOfficer(heroes, rulerId, 'hegemony', HegemonyPosition.KINGDOM_CHANCELLOR);
check('英雄集结：称王后任命王国相', heroes.officers[rulerId].hegemonyPosition === HegemonyPosition.KINGDOM_CHANCELLOR);

const subject = Object.values(heroes.officers)
  .find((officer) => officer.faction === heroes.playerFactionId && officer.id !== rulerId);
if (!subject) throw new Error('英雄集结缺少可封爵臣属');
heroes.factions[heroes.playerFactionId] = {
  ...heroes.factions[heroes.playerFactionId],
  imperialAuthority: 100,
};
heroes = grantNobility(heroes, heroes.playerFactionId, subject.id, NobilityRank.GUANNEI_MARQUIS);
check('英雄集结：王命封爵逐级晋升并扣10皇权', heroes.officers[subject.id].nobilityRank === NobilityRank.GUANNEI_MARQUIS
  && heroes.factions[heroes.playerFactionId].imperialAuthority === 90);

const targetFactionId = Object.values(heroes.factions)
  .find((faction) => faction.id !== heroes.playerFactionId && faction.isAlive)?.id;
if (targetFactionId == null) throw new Error('英雄集结缺少外交目标');
const relationBefore = heroes.diplomacy.find((link) =>
  (link.factionA === heroes.playerFactionId && link.factionB === targetFactionId)
  || (link.factionB === heroes.playerFactionId && link.factionA === targetFactionId))?.favorability ?? 0;
heroes = tributeGold(heroes, targetFactionId);
const relationAfter = heroes.diplomacy.find((link) =>
  (link.factionA === heroes.playerFactionId && link.factionB === targetFactionId)
  || (link.factionB === heroes.playerFactionId && link.factionA === targetFactionId))?.favorability ?? 0;
check('英雄集结：king 进贡实际路径应用 ×1.2（15→18）', relationAfter - relationBefore === 18);

const roundTrip = parseCurrentSaveEnvelope(envelopeFor(heroes)).snapshot;
check('新档往返保留王号/王国官职/七级爵位', roundTrip.factions[1].kingdomName === heroes.factions[1].kingdomName
  && roundTrip.officers[rulerId].hegemonyPosition === HegemonyPosition.KINGDOM_CHANCELLOR
  && roundTrip.officers[subject.id].nobilityRank === NobilityRank.GUANNEI_MARQUIS);
check('完整链结果通过 GameStateSchema', GameStateSchema.safeParse(roundTrip).success);
restoreGameFromEnvelope(envelopeFor(heroes));
check('服务层恢复完整链存档', getGame().factions[1].politicalStage === 'king');

createGame(2, 1);
const coalition = completeKingPath(structuredClone(getGame()), true);
check('190：称王结果可无损存档往返', parseCurrentSaveEnvelope(envelopeFor(coalition)).snapshot.factions[1].politicalStage === 'king');

const legacy = envelopeFor(coalition) as unknown as {
  snapshot: GameState & { factions: Record<number, GameState['factions'][number] & { politicalStageAgeMonths?: number; kingdomName?: string }> };
};
delete legacy.snapshot.factions[1].politicalStageAgeMonths;
delete legacy.snapshot.factions[1].kingdomName;
legacy.snapshot.factions[1].politicalStage = 'hegemon';
legacy.snapshot.factions[1].politicalTitle = '丞相';
const legacyParsed = parseCurrentSaveEnvelope(legacy);
check('缺少 HC-P1 optional 字段的旧档仍可读取', legacyParsed.snapshot.factions[1].politicalStageAgeMonths == null
  && legacyParsed.snapshot.factions[1].kingdomName == null);

console.log(`\nHC-P1 总验收完成：${assertions}/${assertions} 项断言通过。`);
