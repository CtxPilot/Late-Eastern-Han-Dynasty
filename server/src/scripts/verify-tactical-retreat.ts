// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S10 六角协同包围/战术撤退专项验证。
 * 包围是坐标与朝向派生态势，撤退不消费 RNG，结算层再按 isRetreated 回写残兵。
 */
import {
  FormationType,
  TerrainType,
  UnitType,
  Weather,
  resolveHexSurround,
  type BattleState,
  type BattleUnit,
} from '@leh/shared';
import { retreatBattle } from '../engine/battle.js';

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

function unit(
  id: string,
  side: 'attacker' | 'defender',
  position: { q: number; r: number },
  facing: 0 | 1 | 2 | 3 | 4 | 5,
): BattleUnit {
  return {
    id,
    armyId: `${side}-army`,
    commanderId: Number(id.replace(/\D/g, '')) || 1,
    commanderName: id,
    factionId: side === 'attacker' ? 1 : 2,
    side,
    unitType: UnitType.HEAVY_INFANTRY,
    formation: FormationType.SQUARE,
    troopCount: 1000,
    maxTroops: 1000,
    morale: 80,
    food: 100,
    position,
    facing,
    mp: 5,
    maxMp: 5,
    energy: 100,
    maxEnergy: 100,
    hasActed: false,
    isRetreated: false,
    isDestroyed: false,
    statusEffects: [],
  };
}

function battle(units: BattleUnit[]): BattleState {
  return {
    id: 'verify-retreat',
    turn: 1,
    weather: Weather.CLEAR,
    attackerFaction: 1,
    defenderFaction: 2,
    isSiege: true,
    cityId: 1,
    fromCityId: 2,
    settled: false,
    units,
    phase: 'player',
    winner: null,
    hexGrid: {
      width: 8,
      height: 8,
      terrain: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => TerrainType.PLAIN)),
    },
    log: [],
    message: 'verify',
  };
}

console.log('verify-tactical-retreat');

const safeBattle = battle([
  unit('a1', 'attacker', { q: 2, r: 2 }, 0),
  unit('d1', 'defender', { q: 6, r: 6 }, 3),
]);
check('安全态势未形成包围', !resolveHexSurround(safeBattle.units, 'a1').isSurrounded);
const retreated = retreatBattle(safeBattle);
check('战术撤退进入结束态', retreated.phase === 'over' && retreated.winner === 'defender');
check('撤退标记攻方存活单位', retreated.units.find((unit) => unit.id === 'a1')?.isRetreated === true);
check('撤退不改变守军单位', retreated.units.find((unit) => unit.id === 'd1')?.isRetreated === false);
check('撤退保留可审计战报', retreated.log.at(-1)?.message.includes('战术撤退') === true);

const surroundedBattle = battle([
  unit('a1', 'attacker', { q: 3, r: 3 }, 0),
  unit('d1', 'defender', { q: 4, r: 3 }, 3),
  unit('d2', 'defender', { q: 3, r: 4 }, 2),
]);
check('两翼朝向相邻敌军构成包围', resolveHexSurround(surroundedBattle.units, 'a1').isSurrounded);
let rejection = '';
try {
  retreatBattle(surroundedBattle);
} catch (error) {
  rejection = error instanceof Error ? error.message : String(error);
}
check('被协同包围时拒绝撤退', rejection.startsWith('RETREAT_SURROUNDED:'));
check('拒绝不改写原战斗状态', surroundedBattle.phase === 'player' && surroundedBattle.units.every((unit) => !unit.isRetreated));

const oneSide = battle([
  unit('a1', 'attacker', { q: 3, r: 3 }, 0),
  unit('d1', 'defender', { q: 4, r: 3 }, 3),
]);
check('单支贴身敌军仍可撤退', retreatBattle(oneSide).phase === 'over');
const pursued = retreatBattle(oneSide);
check('相邻守军对撤退追加追击', pursued.message.includes('追击'));
check('追击削减退兵兵力', (pursued.units.find((unit) => unit.id === 'a1')?.troopCount ?? 1000) < 1000);
check('追击后仍标记撤退', pursued.units.find((unit) => unit.id === 'a1')?.isRetreated === true);
check('追击后士气 -2', (pursued.units.find((unit) => unit.id === 'a1')?.morale ?? 80) === 78);

const distant = battle([
  unit('a1', 'attacker', { q: 1, r: 1 }, 0),
  unit('d1', 'defender', { q: 6, r: 6 }, 3),
]);
const distantRetreat = retreatBattle(distant);
check('无相邻守军时撤退不触发追击', !distantRetreat.message.includes('追击'));
check('无追击时兵力保持', distantRetreat.units.find((unit) => unit.id === 'a1')?.troopCount === 1000);

const edgeSurrounded = battle([
  unit('a1', 'attacker', { q: 0, r: 0 }, 0),
  unit('d1', 'defender', { q: 1, r: 0 }, 3),
  unit('d2', 'defender', { q: 0, r: 1 }, 2),
]);
check('边缘受围由 isSiege 城门放宽仍可撤退', retreatBattle(edgeSurrounded).phase === 'over');
check('边缘突围仍承受追击', retreatBattle(edgeSurrounded).message.includes('追击'));
const nonSiegeEdge = { ...edgeSurrounded, isSiege: false } as BattleState;
let edgeRejection = '';
try {
  retreatBattle(nonSiegeEdge);
} catch (e) {
  edgeRejection = e instanceof Error ? e.message : String(e);
}
check('非攻城时边缘仍按受围阻断', edgeRejection.startsWith('RETREAT_SURROUNDED'));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
