// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * P2-4（Session 416）worker 生成化第一支柱：服务 ↔ worker handler 奇偶校验。
 *
 * 以 `server/src/services/game.ts` 导出为单一真源，校验 `client/src/workers/game.worker.ts`
 * 的 handler 注册表覆盖。历史上漏改 worker 只会表现为运行时「离线版暂未实装指令」；
 * 本校验把它变成 CI 即红的确定性门禁。允许清单需显式维护（带缘由注释）。
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const servicesSrc = readFileSync(join(root, 'server/src/services/game.ts'), 'utf8');
const workerSrc = readFileSync(join(root, 'client/src/workers/game.worker.ts'), 'utf8');
const offlineApiSrc = readFileSync(join(root, 'client/src/services/offline/offline-api.ts'), 'utf8');

/** 离线 RPC 真源：offline-api 中 call/callWithMeta 的方法名字面量。 */
const offlineRpcNames = new Set();
for (const m of offlineApiSrc.matchAll(/call(?:WithMeta)?(?:<[^>]*>)?\('([\w]+)'/g)) offlineRpcNames.add(m[1]);

const servicesExports = new Set();
for (const m of servicesSrc.matchAll(/^export (?:async )?function (\w+)/gm)) servicesExports.add(m[1]);
for (const m of servicesSrc.matchAll(/^export const (\w+) =/gm)) servicesExports.add(m[1]);

// worker handlers 对象范围
const start = workerSrc.indexOf('const handlers');
const end = workerSrc.indexOf('\n};', start);
const handlersBody = workerSrc.slice(start, end);
const workerHandlers = new Set();
for (const m of handlersBody.matchAll(/^ {2}(\w+)\((?:[^)])*\)/gm)) workerHandlers.add(m[1]);

/** 服务端专属（依赖 fs/SQLite/绝对路径等 Worker 不可达面），不要求离线覆盖。 */
const SERVER_ONLY_ALLOWLIST = new Set([
  'listDiskSaveSlots',
  'writeSaveSlot',
  'getGame',                    // worker 内部权威态访问
  'getClientGame',              // worker 内部客户端投影（getGameState handler 消费）
  'applyLootBeauty',            // 战利品结算内部步（战役/白刃流程内消费）
  'loadGameFromDisk',
  'restoreGameFromEnvelope',
  'saveGameToDisk',
  'skillTreeTestHooks',
]);

/**
 * P2-4 别名契约：worker handler 名 → services 真源导出名（改名映射的单一清单）。
 * 未在此表且不同名的服务导出必须由 worker 同名 handler 覆盖。
 */
const ALIAS_MAP = {
  exportSave: 'exportSaveEnvelope',
  canReach: 'canMarchTo',
  kingRequirements: 'getCurrentKingRequirements',
  march: 'startMarch',
  attack: 'battleAttack',
  ability: 'battleAbility',
  move: 'battleMove',
  movePath: 'battleMovePath',
  moveRange: 'battleMoveRange',
  retreat: 'battleRetreat',
  undo: 'battleUndo',
  usableAbilities: 'battleUsableAbilities',
  weather: 'battleWeather',
  fire: 'battleFire',
  formation: 'battleChangeFormation',
  enemyPhase: 'battleEnemyPhase',
  finishPlayer: 'battleFinishPlayer',
  duelChallenge: 'battleChallengeDuel',
  duelSkip: 'battleDuelSkip',
  duelStep: 'battleDuelStep',
  alliance: 'doAlliance',
  appoint: 'doAppoint',
  buyArms: 'doBuyArms',
  campaignAssault: 'doCampaignAssault',
  cancelPlot: 'doCancelPlot',
  clearTournamentChampionBet: 'doClearTournamentChampionBet',
  conscript: 'doConscript',
  develop: 'doDevelop',
  developFarm: 'doDevelopFarm',
  equipItem: 'doEquipItem',
  establishHegemony: 'doEstablishHegemony',
  chooseEvent: 'doEventChoice',
  falseDecreeWar: 'doFalseDecreeWar',
  followCheck: 'doFollowCheck',
  grantNobility: 'doGrantNobility',
  grantTreasure: 'doGrantTreasure',
  joinFaction: 'doJoinFaction',
  launchPlot: 'doLaunchPlot',
  marry: 'doMarry',
  patrolCity: 'doPatrolCity',
  placeTournamentChampionBet: 'doPlaceTournamentChampionBet',
  plantFemale: 'doPlantFemale',
  proclaimKing: 'doProclaimKing',
  reclaimLand: 'doReclaimLand',
  recruitOfficer: 'doRecruitOfficer',
  recruitSpies: 'doRecruitSpies',
  releaseOfficer: 'doReleaseOfficer',
  relief: 'doRelief',
  relocateGarrisonFamilies: 'doRelocateGarrisonFamilies',
  captive: 'doResolveCaptive',
  resolveFamilyTreatment: 'doResolveFamilyTreatment',
  resolveImpeachment: 'doResolveImpeachment',
  // 委任军团（docs/42，Session 420）
  createDelegationRegion: 'doCreateDelegationRegion',
  updateDelegationRegion: 'doUpdateDelegationRegion',
  assignDelegationCity: 'doAssignDelegationCity',
  disbandDelegationRegion: 'doDisbandDelegationRegion',
  rewardBeautyStock: 'doRewardBeautyStock',
  searchTalent: 'doSearchTalent',
  seekBeauty: 'doSeekBeauty',
  setCivilianFarming: 'doSetCivilianFarming',
  setMilitaryFarming: 'doSetMilitaryFarming',
  setNationalPolicy: 'doSetNationalPolicy',
  setTournamentPlayerEntries: 'doSetTournamentPlayerEntries',
  setTournamentPreferredMode: 'doSetTournamentPreferredMode',
  spyMission: 'doSpyMission',
  stationCounter: 'doStationCounter',
  train: 'doTrain',
  trainFemaleSpy: 'doTrainFemaleSpy',
  transferCourtNetwork: 'doTransferCourtNetwork',
  tribute: 'doTribute',
  unequipItem: 'doUnequipItem',
  unstationCounter: 'doUnstationCounter',
};

/** 服务导出的离线可达解析：同名 handler 或别名映射。 */
function resolvedByWorker(name) {
  if (workerHandlers.has(name)) return true;
  for (const handler of workerHandlers) {
    if (ALIAS_MAP[handler] === name) return true;
  }
  return false;
}

const missing = [...servicesExports]
  .filter((name) => !SERVER_ONLY_ALLOWLIST.has(name))
  .filter((name) => !resolvedByWorker(name))
  .sort();

const extra = [...workerHandlers]
  .filter((name) => !servicesExports.has(name))
  .filter((name) => !(ALIAS_MAP[name] && servicesExports.has(ALIAS_MAP[name])))
  .sort();

let pass = 0;
let fail = 0;
const check = (cond, label) => {
  if (cond) { pass += 1; console.log(`  ✓ ${label}`); }
  else { fail += 1; console.error(`  ✗ ${label}`); }
};

check(offlineRpcNames.size > 90, `离线 RPC 面解析充足（${offlineRpcNames.size} 个）`);
const rpcMissing = [...offlineRpcNames].filter((name) => !workerHandlers.has(name)).sort();
check(rpcMissing.length === 0, rpcMissing.length === 0 ? `worker 覆盖全部离线 RPC（缺 ${rpcMissing.length}）` : `RPC 缺失 handler: ${rpcMissing.join(', ')}`);
check(servicesExports.size > 90, `services 导出解析面充足（${servicesExports.size} 个）`);
check(workerHandlers.size > 90, `worker handler 解析面充足（${workerHandlers.size} 个）`);
check(missing.length === 0, missing.length === 0 ? `worker 覆盖全部离线可达服务导出（缺 ${missing.length}）` : `worker 缺失 handler: ${missing.join(', ')}`);
if (extra.length > 0) console.log(`  ℹ worker 独有 handler（别名/内部）：${extra.join(', ')}`);

console.log(`Session 416 worker parity: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
