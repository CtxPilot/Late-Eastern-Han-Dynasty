// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S10 战斗主将表现契约：
 * - 每座可交战 AI 城池生成的守军都关联权威武将；
 * - 姓名仅随正式战斗单位揭示，不放宽 S06 全局 officers 投影。
 */
import assert from 'node:assert/strict';
import { staticData } from '../data/loader.js';
import { createBattle } from '../engine/battle.js';
import {
  createGame,
  getClientGame,
  getGame,
  startMarch,
} from '../services/game.js';

let checkedCities = 0;
let localDefenders = 0;
let factionFallbackDefenders = 0;

for (const scenario of staticData.scenarios) {
  for (const playerFactionId of scenario.startState.activeFactionIds) {
    createGame(scenario.id, playerFactionId);
    const authority = getGame();

    for (const city of Object.values(authority.cities)) {
      if (city.ruler == null || city.ruler === playerFactionId) continue;

      const battle = createBattle(authority, city.id);
      const defender = battle.units.find((unit) => unit.side === 'defender');
      assert.ok(defender, `${scenario.name}/${city.name} 缺少守军战斗单位`);

      const officer = authority.officers[defender.commanderId];
      assert.ok(officer, `${scenario.name}/${city.name} 守将 ID 未关联权威武将`);
      assert.equal(officer.faction, city.ruler, `${scenario.name}/${city.name} 守将不属于守方势力`);
      assert.equal(defender.commanderName, officer.name, `${scenario.name}/${city.name} 守将姓名快照不一致`);
      if (officer.location === city.id) localDefenders += 1;
      else factionFallbackDefenders += 1;
      checkedCities += 1;
    }
  }
}

createGame(1, 2);
const fogTargetId = 13;
const maskedBefore = getClientGame();
assert.equal(maskedBefore.officers[13], undefined, '未交战前不得通过全局投影揭示宛城敌将');

const { battle } = startMarch(fogTargetId, 15, 1000);
const defender = battle.units.find((unit) => unit.side === 'defender');
assert.ok(defender, '攻打宛城后应生成守军');
assert.ok(defender.commanderName.length > 0, '正式交战后战斗单位必须揭示守将姓名');
assert.equal(
  getClientGame().officers[defender.commanderId],
  undefined,
  '战斗揭示不得反向放宽大地图全局 officers 迷雾',
);
assert.equal(
  defender.commanderName,
  getGame().officers[defender.commanderId]?.name,
  '战斗姓名快照必须来自权威武将数据',
);

console.log(
  `战斗守将表现验证通过：覆盖 ${checkedCities} 个剧本/玩家视角下的 AI 城池` +
  `（本城守将 ${localDefenders}，同势力后备守将 ${factionFallbackDefenders}）`,
);
