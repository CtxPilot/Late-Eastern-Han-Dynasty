// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { BattleStateRuntimeSchema, FormationType, GameStateBattleSchema, GameStateSchema, UnitType, Weather } from '@leh/shared';
import {
  battleEnemyPhase, battleFinishPlayer, battleMove, battleMoveRange, battleUndo, battlefieldExit, battlefieldInit, campaignStart, createGame, exitBattle, startBattle,
  getBattle, getBattlefield, getGame, getMelee, meleeExit, meleeRound, meleeSelectMode, meleeStart, startMarch,
} from '../services/game.js';
import { attackUnit, finishPlayerAction, runEnemyPhase, undoLastBattleAction } from '../engine/battle.js';

let passed = 0;
let failed = 0;
function check(label: string, condition: boolean): void {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}
function fullStatePasses(): boolean {
  const result = GameStateSchema.safeParse(getGame());
  if (!result.success) console.error(result.error.issues.slice(0, 5));
  return result.success;
}

console.log('\n=== S16 战斗快照 Schema 验证 ===');
createGame(1, 2);
const initial = getGame();
const combatSlice = () => {
  const state = getGame();
  return { activeBattles: state.activeBattles, activeBattlefield: state.activeBattlefield, activeMelee: state.activeMelee };
};
check('初始 GameState 战斗切片通过严格解析', GameStateBattleSchema.parse(combatSlice()).activeBattles.length === 0);

const fromCity = Object.values(initial.cities).find((city) => {
  const node = initial.campaignNodes.find((candidate) => candidate.id === city.id);
  return city.ruler === initial.playerFactionId && city.troops >= 1000 && city.food >= 500 &&
    node?.adjacentNodeIds.some((id) => initial.cities[id]?.ruler !== initial.playerFactionId);
});
if (!fromCity) throw new Error('没有可用于真实战斗验证的己方前线城市');
const targetCityId = initial.campaignNodes.find((node) => node.id === fromCity.id)!.adjacentNodeIds
  .find((id) => initial.cities[id]?.ruler !== initial.playerFactionId);
if (!targetCityId) throw new Error('没有可用于真实战斗验证的相邻敌城');

const result = startMarch(targetCityId, fromCity.id, 1000);
const parsedBattle = BattleStateRuntimeSchema.parse(result.battle);
check('真实出征生成的 BattleState 通过严格解析', parsedBattle.units.length === 2);
check('真实出征初始化天气切换倒计时', parsedBattle.weatherChangeTimer === 3);
check('真实战斗攻守势力与单位归属一致', parsedBattle.units.every((unit) => unit.factionId === (unit.side === 'attacker' ? parsedBattle.attackerFaction : parsedBattle.defenderFaction)));
check('真实战场尺寸与二维地形一致', parsedBattle.hexGrid.terrain.length === parsedBattle.hexGrid.height && parsedBattle.hexGrid.terrain.every((row) => row.length === parsedBattle.hexGrid.width));
check('服务层当前战斗与出征结果一致', getBattle()?.id === parsedBattle.id);
const mover = parsedBattle.units.find((unit) => unit.side === 'attacker')!;
const previewKey = battleMoveRange(mover.id)[0]!;
const [previewQ, previewR] = previewKey.split(',').map(Number);
const moved = battleMove(mover.id, previewQ, previewR);
check('A* 可达格执行后写入可撤销审计记录', moved.actionHistory?.at(-1)?.kind === 'move' && moved.units.find((unit) => unit.id === mover.id)?.position.q === previewQ);
const undone = battleUndo();
check('攻击前可撤销移动并恢复位置/移动力', undone.units.find((unit) => unit.id === mover.id)?.position.q === mover.position.q && undone.units.find((unit) => unit.id === mover.id)?.mp === mover.mp);

// Session 334：移动撤销权只属于创建它的玩家回合，交权后不能跨敌军回合回滚。
const boundaryMove = battleMove(mover.id, previewQ, previewR);
const mismatchedAction = boundaryMove.actionHistory!.at(-1)!;
const mismatchedSnapshot = BattleStateRuntimeSchema.parse({
  ...boundaryMove,
  actionHistory: [...boundaryMove.actionHistory!.slice(0, -1), { ...mismatchedAction, afterPosition: mismatchedAction.beforePosition }],
});
const mismatchedBefore = JSON.stringify(mismatchedSnapshot);
let mismatchError = '';
try { undoLastBattleAction(mismatchedSnapshot); } catch (error) { mismatchError = error instanceof Error ? error.message : String(error); }
check('撤销拒绝与当前落点不符的伪造记录且不改状态', mismatchError === 'UNDO_STATE_MISMATCH' && JSON.stringify(mismatchedSnapshot) === mismatchedBefore);
const handedOff = battleFinishPlayer();
check('交权进入敌军阶段时封闭本回合移动记录', handedOff.actionHistory?.at(-1)?.kind === 'move' && handedOff.actionHistory.at(-1)?.reversible === false);
const nextPlayerTurn = battleEnemyPhase();
check('敌军阶段结束后进入下一玩家回合', nextPlayerTurn.phase === 'player' && nextPlayerTurn.turn === parsedBattle.turn + 1);
const beforeLateUndo = nextPlayerTurn.units.find((unit) => unit.id === mover.id)!;
const beforeLateUndoSnapshot = JSON.stringify(nextPlayerTurn);
let lateUndoError = '';
try { battleUndo(); } catch (error) { lateUndoError = error instanceof Error ? error.message : String(error); }
const afterLateUndo = getBattle()!;
check('跨回合撤销返回专用错误码且不改写权威状态', lateUndoError === 'UNDO_TURN_LOCKED' && JSON.stringify(afterLateUndo) === beforeLateUndoSnapshot && afterLateUndo.units.find((unit) => unit.id === mover.id)?.position.q === beforeLateUndo.position.q && afterLateUndo.units.find((unit) => unit.id === mover.id)?.position.r === beforeLateUndo.position.r && afterLateUndo.units.find((unit) => unit.id === mover.id)?.mp === beforeLateUndo.mp);
const legacyStaleSnapshot = BattleStateRuntimeSchema.parse({
  ...nextPlayerTurn,
  actionHistory: nextPlayerTurn.actionHistory?.map((action, index, history) => index === history.length - 1 ? { ...action, reversible: true } : action),
});
const legacyBefore = JSON.stringify(legacyStaleSnapshot);
let legacyError = '';
try { undoLastBattleAction(legacyStaleSnapshot); } catch (error) { legacyError = error instanceof Error ? error.message : String(error); }
check('旧档 stale reversible 记录仍可解析但不可跨回合撤销', legacyError === 'UNDO_TURN_LOCKED' && JSON.stringify(legacyStaleSnapshot) === legacyBefore);

const current = getGame();
check('真实战斗已进入权威 GameState.activeBattles', current.activeBattles[0]?.id === parsedBattle.id);
check('权威战斗切片通过严格解析', GameStateBattleSchema.parse(combatSlice()).activeBattles[0]?.id === parsedBattle.id);
check('六角战斗进行中完整 GameState 通过跨切片校验', fullStatePasses());

const advancedBattle = battleFinishPlayer();
check('战斗操作后权威快照同步更新', getGame().activeBattles[0]?.phase === advancedBattle.phase);
exitBattle();
check('退出并结算后权威战斗快照清空', getGame().activeBattles.length === 0 && getBattle() === null);

// S10 Session 307：敌军相邻主将主动单挑，沿用 DuelState/RNG 入口。
createGame(1, 2);
const duelCity = Object.values(getGame().cities).find((city) => city.ruler !== getGame().playerFactionId);
if (!duelCity) throw new Error('没有可用于敌军主动单挑验证的敌城');
const duelBattle = startBattle(duelCity.id);
const duelAttacker = duelBattle.units.find((unit) => unit.side === 'attacker')!;
const duelDefender = duelBattle.units.find((unit) => unit.side === 'defender')!;
const challengerOfficer = getGame().officers[duelDefender.commanderId];
const defenderOfficer = getGame().officers[duelAttacker.commanderId];
if (!challengerOfficer || !defenderOfficer) throw new Error('缺少敌军主动单挑验证武将');
// 让验证聚焦主动入口而非特定 0-A 剧本的武力差；正式运行不修改武将数据。
defenderOfficer.stats.war = challengerOfficer.stats.war;
const enemyDuel = runEnemyPhase({
  ...duelBattle,
  phase: 'enemy',
  units: duelBattle.units.map((unit) => unit.id === duelDefender.id
    ? { ...unit, position: { q: duelAttacker.position.q + 1, r: duelAttacker.position.r } }
    : unit),
}, getGame(), () => 0);
check('敌军相邻主将可按触发判定进入 DuelState', Boolean(enemyDuel.duel));
check('敌军主动单挑先推进一回合且战斗保持可恢复阶段', enemyDuel.duel?.round === 1 && enemyDuel.phase === 'enemy');
check('敌军主动单挑扣除20气力', enemyDuel.units.find((unit) => unit.id === duelDefender.id)?.energy === 80);
check('敌军主动单挑快照通过严格解析', BattleStateRuntimeSchema.parse(enemyDuel).duel?.challengerId === challengerOfficer.id);
const actedEnemyPhase = {
  ...duelBattle,
  phase: 'enemy' as const,
  duel: undefined,
  units: duelBattle.units.map((unit) => unit.id === duelDefender.id
    ? { ...unit, position: { q: duelAttacker.position.q + 1, r: duelAttacker.position.r }, hasActed: true, mp: 0 }
    : unit),
};
const actedEnemyResult = runEnemyPhase(actedEnemyPhase, getGame(), () => {
  throw new Error('已行动敌军不应再次消费主动单挑 RNG');
});
check('已行动敌军不会重入主动单挑候选', !actedEnemyResult.duel && actedEnemyResult.message.includes('敌军待机'));
const weatherChanged = runEnemyPhase({ ...actedEnemyPhase, weather: Weather.CLEAR, weatherChangeTimer: 1 }, getGame(), (() => {
  const rolls = [0, 0.5];
  return () => rolls.shift() ?? 0.5;
})());
check('天气倒计时归零后按权威 RNG 切换天气', weatherChanged.weather === Weather.CLOUDY);
check('天气切换后重置 3~8 回合倒计时', weatherChanged.weatherChangeTimer === 6);

// Session 333：同一敌军阶段仍禁止重入，但玩家交回回合后必须恢复敌军行动资格。
const twoRoundBattle = {
  ...duelBattle,
  phase: 'enemy' as const,
  weather: Weather.SNOW,
  weatherChangeTimer: undefined,
  duel: undefined,
  units: duelBattle.units.map((unit) => unit.side === 'attacker'
    ? { ...unit, position: { q: 3, r: 2 }, troopCount: 5000, maxTroops: 5000, hasActed: true, mp: 0 }
    : { ...unit, position: { q: 2, r: 2 }, troopCount: 5000, maxTroops: 5000, energy: 0, hasActed: false, mp: unit.maxMp }),
};
let firstRoundAttackRolls = 0;
const firstEnemyRound = runEnemyPhase(twoRoundBattle, getGame(), () => {
  firstRoundAttackRolls += 1;
  return 0.5;
});
const troopsAfterFirstEnemyRound = firstEnemyRound.units.find((unit) => unit.side === 'attacker')!.troopCount;
check('首个敌军阶段正常攻击并消费权威 RNG', troopsAfterFirstEnemyRound < 5000 && firstRoundAttackRolls > 0);
const secondEnemyReady = finishPlayerAction(firstEnemyRound);
const readyDefender = secondEnemyReady.units.find((unit) => unit.side === 'defender')!;
check('玩家交回回合后恢复敌军行动资格', secondEnemyReady.phase === 'enemy' && !readyDefender.hasActed);
check('新敌军阶段按当前天气恢复有效移动力', readyDefender.mp === Math.max(0, readyDefender.maxMp - 2));
let secondRoundAttackRolls = 0;
const secondEnemyRound = runEnemyPhase(secondEnemyReady, getGame(), () => {
  secondRoundAttackRolls += 1;
  return 0.5;
});
check('第二个敌军阶段会再次攻击而非永久待机', secondEnemyRound.units.find((unit) => unit.side === 'attacker')!.troopCount < troopsAfterFirstEnemyRound);
check('跨回合恢复不绕过权威攻击 RNG', secondRoundAttackRolls > 0 && !secondEnemyRound.message.includes('敌军待机'));
exitBattle();

// Session 327：玩家普通攻击与敌军 AI 共用 UnitTemplate.range；远程兵种不走白刃朝向判定。
createGame(1, 2);
const rangedCity = Object.values(getGame().cities).find((city) => city.ruler !== getGame().playerFactionId);
if (!rangedCity) throw new Error('没有可用于玩家远程普通攻击验证的敌城');
const rangedBattle = startBattle(rangedCity.id);
const rangedAttacker = rangedBattle.units.find((unit) => unit.side === 'attacker')!;
const rangedDefender = rangedBattle.units.find((unit) => unit.side === 'defender')!;
const rangedReady = {
  ...rangedBattle,
  weather: Weather.CLEAR,
  phase: 'player' as const,
  units: rangedBattle.units.map((unit) => unit.id === rangedAttacker.id
    ? { ...unit, unitType: UnitType.ARCHER, position: { q: 2, r: 2 }, facing: 0 as const }
    : { ...unit, position: { q: 4, r: 2 }, hasActed: true, mp: 0 }),
};
const rangedAfter = attackUnit(rangedReady, rangedAttacker.id, rangedDefender.id, getGame(), () => 0.5);
check('玩家远程普通攻击可在兵种射程内命中', rangedAfter.units.find((unit) => unit.id === rangedDefender.id)!.troopCount < rangedDefender.troopCount);
check('玩家攻击交回回合时同样恢复敌军行动资格', !rangedAfter.units.find((unit) => unit.id === rangedDefender.id)!.hasActed);
const fogRanged = { ...rangedReady, weather: Weather.FOG };
let fogRangedRejected = false;
try { attackUnit(fogRanged, rangedAttacker.id, rangedDefender.id, getGame(), () => { throw new Error('雾天远程攻击不应消费 RNG'); }); }
catch (error) { fogRangedRejected = error instanceof Error && error.message.includes('雾天远程兵种不可射击'); }
check('玩家普通远程攻击与雾天禁射门禁一致', fogRangedRejected);
exitBattle();

// Tier I / Tier II：使用真实 service 流程，并仅在测试准备阶段注入一支敌军，
// 因为 0-A AI 尚不会创建 CampaignArmy。
createGame(1, 2);
const campaignState = getGame();
const campaignFrom = Object.values(campaignState.cities).find((city) => {
  const node = campaignState.campaignNodes.find((candidate) => candidate.id === city.id);
  return city.ruler === campaignState.playerFactionId && city.troops >= 1000 && city.food >= 500 && city.officers.length > 0 &&
    node?.adjacentNodeIds.some((id) => campaignState.cities[id]?.ruler !== campaignState.playerFactionId);
});
if (!campaignFrom) throw new Error('没有可用于战场地图验证的己方前线城市');
const campaignTarget = campaignState.campaignNodes.find((node) => node.id === campaignFrom.id)!.adjacentNodeIds
  .find((id) => campaignState.cities[id]?.ruler !== campaignState.playerFactionId)!;
const commanderId = campaignFrom.officers[0]!;
const started = campaignStart({
  commanderId, subCommanderIds: [], fromNodeId: campaignFrom.id, targetNodeId: campaignTarget,
  unitType: UnitType.LIGHT_INFANTRY, formation: FormationType.SQUARE, troopCount: 1000, food: 500,
});
const defenderFactionId = campaignState.cities[campaignTarget]!.ruler!;
const defender = {
  ...started.army,
  id: `${started.army.id}-def`, name: '边界验证守军', factionId: defenderFactionId,
  commanderId: Object.values(getGame().officers).find((officer) => officer.faction === defenderFactionId)?.id ?? started.army.commanderId,
};
getGame().campaignArmies.push(defender);

let ownTargetRejected = false;
try { battlefieldInit(campaignFrom.id, campaignFrom.id); } catch { ownTargetRejected = true; }
check('战场初始化拒绝攻击己方城市', ownTargetRejected && getGame().activeBattlefield === null);
let enemyOriginRejected = false;
try { battlefieldInit(campaignFrom.id, campaignTarget); } catch { enemyOriginRejected = true; }
check('战场初始化拒绝非己方出发城市', enemyOriginRejected && getGame().activeBattlefield === null);

const battlefield = battlefieldInit(campaignTarget, campaignFrom.id);
check('真实战场地图已进入权威 GameState', getGame().activeBattlefield?.id === battlefield.id && getBattlefield()?.id === battlefield.id);
check('战场地图收录双方 CampaignArmy', battlefield.armyIds.includes(started.army.id) && battlefield.armyIds.includes(defender.id));
check('战场地图快照通过严格解析', GameStateBattleSchema.parse(combatSlice()).activeBattlefield?.id === battlefield.id);
check('战场地图进行中完整 GameState 通过跨切片校验', fullStatePasses());

const melee = meleeStart(started.army.id, defender.id).melee;
check('真实白刃战已进入权威 GameState', getGame().activeMelee?.battlefieldId === battlefield.id && getMelee() === getGame().activeMelee);
check('白刃战父子边界通过严格解析', GameStateBattleSchema.parse(combatSlice()).activeMelee?.battlefieldId === battlefield.id);
check('白刃战进行中完整 GameState 通过跨切片校验', fullStatePasses());
meleeSelectMode('standard');
const advancedMelee = meleeRound('normal_attack').melee;
check('白刃战操作后权威快照同步更新', getGame().activeMelee?.round === melee.round + 1 && advancedMelee.round === getGame().activeMelee?.round);
let invalidActionRejected = false;
try { meleeRound('not-an-action'); } catch { invalidActionRejected = true; }
check('未知白刃战行动在状态变更前被拒绝', invalidActionRejected && getGame().activeMelee?.round === advancedMelee.round);
meleeExit();
check('退出白刃战仅清理子状态', getMelee() === null && getGame().activeMelee === null && getBattlefield()?.id === battlefield.id);

meleeStart(started.army.id, defender.id);
battlefieldExit();
check('退出战场级联清理白刃战', getBattlefield() === null && getMelee() === null);

battlefieldInit(campaignTarget, campaignFrom.id);
createGame(1, 2);
check('新建游戏不会继承上一局战场或白刃战', getGame().activeBattlefield === null && getGame().activeMelee === null);

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
