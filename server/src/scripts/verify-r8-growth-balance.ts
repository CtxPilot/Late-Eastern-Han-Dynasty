// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  FormationType,
  OfficerStatus,
  UnitType,
  type CampaignArmy,
  type GameState,
} from '@leh/shared';
import { advanceTurn } from '../engine/turn.js';
import { conscript, developCity, relief, trainTroops } from '../engine/civil.js';
import { runAutoBattle } from '../engine/campaign.js';
import { createGame, getGame } from '../services/game.js';

type Choice = '开发' | '征兵' | '训练' | '赈济' | '蓄势';

let passed = 0;
function check(label: string, condition: unknown): asserts condition {
  if (!condition) throw new Error(`FAIL: ${label}`);
  passed += 1;
  console.log(`PASS ${passed}: ${label}`);
}

function availableChoices(state: GameState, cityId: number): Choice[] {
  const city = state.cities[cityId]!;
  const choices: Choice[] = ['蓄势'];
  if (!city.activeDevelopment && city.gold >= 100) choices.push('开发');
  if (city.gold >= 80 && city.food >= 120) choices.push('征兵');
  if (city.food >= 60 && city.troops >= 100) choices.push('训练');
  if (city.food >= 150 && city.stats.morale < 100) choices.push('赈济');
  return choices;
}

function makeArmy(state: GameState, commanderId: number, cityId: number, serial: number): CampaignArmy {
  return {
    id: `r8-war-${serial}`,
    factionId: state.playerFactionId,
    name: `${state.officers[commanderId]!.name}军`,
    commanderId,
    subCommanderIds: [],
    unitType: UnitType.LIGHT_INFANTRY,
    formation: FormationType.SQUARE,
    currentNodeId: cityId,
    targetNodeId: cityId,
    path: [],
    phase: 'engaged',
    troops: 3_000,
    maxTroops: 3_000,
    food: 6_000,
    maxFood: 9_000,
    morale: 82,
    organization: 78,
    experience: serial === 1 ? 0 : 50,
    fatigue: serial === 1 ? 0 : 20,
    squads: [],
    structures: [],
    fromNodeId: cityId,
  };
}

createGame(1, 1);
const base = getGame();
const allCities = Object.values(base.cities).sort((a, b) => a.id - b.id);
const sampleCities = allCities.slice(0, 3);
const sampleCityIds = new Set(sampleCities.map((city) => city.id));
const sampleOfficers = Object.values(base.officers).sort((a, b) => a.id - b.id).slice(0, 10);
const sampleOfficerIds = new Set(sampleOfficers.map((officer) => officer.id));
let state: GameState = {
  ...base,
  cities: Object.fromEntries(allCities.map((city) => [
    city.id,
    {
      ...city,
      ruler: sampleCityIds.has(city.id)
        ? base.playerFactionId
        : city.ruler === base.playerFactionId ? null : city.ruler,
      officers: sampleCityIds.has(city.id)
        ? sampleOfficers.filter((_, index) => index % 3 === sampleCities.findIndex((item) => item.id === city.id)).map((officer) => officer.id)
        : city.officers.filter((id) => !sampleOfficerIds.has(id)),
      gold: sampleCityIds.has(city.id) ? 1_200 : city.gold,
      food: sampleCityIds.has(city.id) ? 8_000 : city.food,
      troops: sampleCityIds.has(city.id) ? 4_000 : city.troops,
      troopsMorale: sampleCityIds.has(city.id) ? 70 : city.troopsMorale,
      activeDevelopment: undefined,
    },
  ])),
  officers: Object.fromEntries(Object.values(base.officers).map((officer, index) => [
    officer.id,
    sampleOfficerIds.has(officer.id)
      ? {
          ...officer,
          faction: base.playerFactionId,
          location: sampleCities[index % 3]!.id,
          status: OfficerStatus.ACTIVE,
        }
      : officer.faction === base.playerFactionId
        ? { ...officer, faction: null, location: null, status: OfficerStatus.FREE }
        : officer,
  ])),
  campaignArmies: [],
};

check('情景固定为3座玩家城市', Object.values(state.cities).filter((city) => city.ruler === state.playerFactionId).length === 3);
check('情景固定为10名玩家武将', Object.values(state.officers).filter((officer) => officer.faction === state.playerFactionId).length === 10);

const decisions: Array<{ turn: number; chosen: Choice; forgone: string; options: Choice[] }> = [];
const warResults: string[] = [];
for (let turn = 1; turn <= 24; turn += 1) {
  const cityId = sampleCities[(turn - 1) % 3]!.id;
  const options = availableChoices(state, cityId);
  check(`第${turn}回合至少有两项可行取舍`, options.length >= 2);

  let chosen: Choice;
  if ((turn === 1 || turn === 13) && options.includes('开发')) chosen = '开发';
  else if (turn % 4 === 2 && options.includes('征兵')) chosen = '征兵';
  else if (turn % 4 === 3 && options.includes('训练')) chosen = '训练';
  else if (turn % 4 === 0 && options.includes('赈济')) chosen = '赈济';
  else chosen = '蓄势';
  const forgone = options.filter((option) => option !== chosen).join('、');
  check(`第${turn}回合记录所选与放弃项`, forgone.length > 0);

  if (chosen === '开发') {
    const officerId = state.cities[cityId]!.officers[0]!;
    state = developCity(state, cityId, turn === 1 ? 'farm' : 'commerce', officerId);
  } else if (chosen === '征兵') state = conscript(state, cityId, () => 0.5);
  else if (chosen === '训练') state = trainTroops(state, cityId, () => 0.5);
  else if (chosen === '赈济') state = relief(state, cityId, () => 0.5);

  if (turn === 8 || turn === 18) {
    const defender = allCities.find((city) => city.ruler != null && city.ruler !== state.playerFactionId);
    if (!defender) throw new Error('缺少战争守方城市');
    const army = makeArmy(state, sampleOfficers[warResults.length]!.id, defender.id, warResults.length + 1);
    const result = runAutoBattle(
      state,
      army,
      null,
      { cityId: defender.id, garrison: Math.max(1_500, defender.troops), wall: defender.stats.wall ?? 0 },
      () => 0.5,
    );
    warResults.push(`${defender.name}:${result.winner}:${result.attackerCasualties}/${result.defenderCasualties}`);
  }
  decisions.push({ turn, chosen, forgone, options });
  state = advanceTurn(state, () => 0.5);
}

check('完整推进24个月', state.currentYear === base.currentYear + 2 && state.currentMonth === base.currentMonth);
check('两场战争均调用权威自动战斗并产出伤亡', warResults.length === 2 && warResults.every((item) => !item.endsWith('0/0')));
check('24回合均留下明确取舍记录', decisions.length === 24 && decisions.every((item) => item.forgone.length > 0));
check('取舍覆盖建设、军备与蓄势', new Set(decisions.map((item) => item.chosen)).size >= 4);

console.log(`R8 growth convergence / 24-turn balance verification passed: ${passed}/${passed}`);
console.log(`wars=${warResults.join(' | ')}`);
console.log(decisions.map((item) => `T${item.turn}:${item.chosen}<-${item.forgone}`).join(' | '));
