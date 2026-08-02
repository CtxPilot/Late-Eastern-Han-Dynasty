// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  hegemonyAllianceModifier,
  hegemonyFavorMultiplier,
  HegemonyPosition,
  type GameState,
} from '@leh/shared';
import { getKingRequirements, proclaimKing } from '../engine/hegemony.js';
import { createGame, getGame } from '../services/game.js';

let assertions = 0;
function check(label: string, condition: unknown): asserts condition {
  if (!condition) throw new Error(`FAIL: ${label}`);
  assertions += 1;
  console.log(`✓ ${label}`);
}

function readyHegemony(): GameState {
  createGame(2, 1);
  const state = structuredClone(getGame());
  const faction = state.factions[state.playerFactionId];
  state.factions[state.playerFactionId] = {
    ...faction,
    isAlive: true,
    politicalStage: 'hegemon',
    politicalTitle: '丞相',
    politicalStageAgeMonths: 12,
    imperialAuthority: 80,
    cityIds: [1, 2, 3],
  };
  return state;
}

console.log('\n=== HC-P1-5 外交分档与朝廷 UI 权威契约 ===\n');

const ready = readyHegemony();
const requirements = getKingRequirements(ready, ready.playerFactionId);
check('朝廷进度返回城池 3/3', requirements.cityCount.current === 3 && requirements.cityCount.threshold === 3);
check('朝廷进度返回霸府沉淀 12/12 月', requirements.politicalStageAgeMonths.current === 12 && requirements.politicalStageAgeMonths.passed);
check('朝廷进度返回皇权 80/80', requirements.imperialAuthority.current === 80 && requirements.imperialAuthority.passed);
check('全部称王门槛满足', requirements.allPassed);
check('王号候选为有限非空集合', requirements.kingdomNameCandidates.length > 0 && requirements.kingdomNameCandidates.every(({ name }) => name.length <= 4));
const chosen = requirements.kingdomNameCandidates.find(({ available }) => available);
check('至少存在一个未占用王号', chosen != null);

const changed = structuredClone(ready);
changed.factions[changed.playerFactionId].imperialAuthority = 79;
check('终审前权威状态变化会令门槛失效', !getKingRequirements(changed, changed.playerFactionId).allPassed);

const king = proclaimKing(ready, ready.playerFactionId, chosen.name);
check('称王后阶段与头衔即时刷新', king.factions[king.playerFactionId].politicalStage === 'king'
  && king.factions[king.playerFactionId].politicalTitle === `${chosen.name}王`);
check('称王后皇权正确扣除 80', king.factions[king.playerFactionId].imperialAuthority === 0);
check('king 结盟发起方修正为 +8', hegemonyAllianceModifier(king.factions[king.playerFactionId].politicalStage) === 8);
check('king 进贡/宫廷牵线发起方倍率为 ×1.2', hegemonyFavorMultiplier(king.factions[king.playerFactionId].politicalStage) === 1.2);

const officeValues = Object.values(HegemonyPosition);
check('官制总览契约包含霸府三职与王国六职', officeValues.filter((value) => value !== HegemonyPosition.NONE).length === 9);

console.log(`\nHC-P1-5 verification complete: ${assertions}/${assertions} assertions passed.`);
