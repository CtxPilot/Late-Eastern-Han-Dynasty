// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  FormationType,
  GameStateCampaignSchema,
  UnitType,
  type GameState,
} from '@leh/shared';
import {
  campaignStart,
  createGame,
  getGame,
  grandStrategistAppoint,
} from '../services/game.js';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function parseCampaignSlice(state: GameState) {
  return GameStateCampaignSchema.parse({
    armys: state.armys,
    campaignArmies: state.campaignArmies,
    campaignNodes: state.campaignNodes,
    grandStrategists: state.grandStrategists,
  });
}

console.log('\n=== S16 战役快照 Schema 验证 ===');

createGame(1, 2);
const initialHeroState = getGame();
const initialHeroSlice = parseCampaignSlice(initialHeroState);
check('英雄集结初始战役切片通过严格解析', initialHeroSlice.campaignNodes.length === 30);
check('英雄集结节点数量与权威状态一致', initialHeroSlice.campaignNodes.length === initialHeroState.campaignNodes.length);

const fromCity = Object.values(initialHeroState.cities).find((city) =>
  city.ruler === initialHeroState.playerFactionId &&
  city.troops >= 1000 &&
  city.food >= 500 &&
  initialHeroState.campaignNodes
    .find((node) => node.id === city.id)
    ?.adjacentNodeIds.some((id) => {
      const target = initialHeroState.cities[id];
      return target?.ruler != null && target.ruler !== initialHeroState.playerFactionId;
    }),
);
if (!fromCity) throw new Error('英雄集结没有可用于真实编成验证的己方前线城市');
const targetNodeId = initialHeroState.campaignNodes
  .find((node) => node.id === fromCity.id)!
  .adjacentNodeIds.find((id) => {
    const target = initialHeroState.cities[id];
    return target?.ruler != null && target.ruler !== initialHeroState.playerFactionId;
  })!;
const availableOfficers = fromCity.officers
  .map((id) => initialHeroState.officers[id])
  .filter((officer) => officer?.faction === initialHeroState.playerFactionId);
const commander = availableOfficers[0];
if (!commander) throw new Error(`${fromCity.name} 没有可用于真实编成验证的己方武将`);
const subCommander = availableOfficers.find((officer) => officer.id !== commander.id);
const advisor = availableOfficers.find(
  (officer) =>
    officer.id !== commander.id &&
    officer.id !== subCommander?.id &&
    officer.stats.intelligence >= 85,
);

const campaignResult = campaignStart({
  commanderId: commander.id,
  subCommanderIds: subCommander ? [subCommander.id] : [],
  advisorId: advisor?.id,
  fromNodeId: fromCity.id,
  targetNodeId,
  unitType: UnitType.HEAVY_CAVALRY,
  formation: FormationType.WEDGE,
  troopCount: 1000,
  food: 500,
});
const activeCampaignSlice = parseCampaignSlice(campaignResult.game);
check('真实编成后的战役 Army 通过严格解析', activeCampaignSlice.campaignArmies.length === 1);
check('真实编成保留主将与同城副将阵位', activeCampaignSlice.campaignArmies[0]?.squads.length === (subCommander ? 2 : 1));
check('真实编成兵力与军粮仍在容量内',
  activeCampaignSlice.campaignArmies[0]!.troops <= activeCampaignSlice.campaignArmies[0]!.maxTroops &&
  activeCampaignSlice.campaignArmies[0]!.food <= activeCampaignSlice.campaignArmies[0]!.maxFood,
);

createGame(1, 1);
const strategistBaseState = getGame();
const strategistFaction = strategistBaseState.factions[strategistBaseState.playerFactionId];
const rulerCompatibility = strategistBaseState.officers[strategistFaction.rulerId]?.hidden.compatibility ?? 50;
const strategistCandidate = Object.values(strategistBaseState.officers).find(
  (officer) =>
    officer.faction === strategistBaseState.playerFactionId &&
    officer.stats.intelligence >= 85 &&
    Math.abs(officer.hidden.compatibility - rulerCompatibility) <= 40,
);
if (!strategistCandidate) throw new Error('英雄集结没有可用于真实总军师任命验证的候选武将');
const strategistResult = grandStrategistAppoint(strategistCandidate.id);
const strategistSlice = parseCampaignSlice(strategistResult.game);
check('真实任命后的总军师状态通过严格解析', strategistSlice.grandStrategists.length === 1);
check('每势力总军师唯一且任命对象正确', strategistSlice.grandStrategists[0]?.officerId === strategistCandidate.id);

createGame(2, 1);
const coalitionState = getGame();
const coalitionSlice = parseCampaignSlice(coalitionState);
check('关东义兵初始战役切片通过严格解析', coalitionSlice.campaignNodes.length === 30);
check('关东义兵节点数量与权威状态一致', coalitionSlice.campaignNodes.length === coalitionState.campaignNodes.length);

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
