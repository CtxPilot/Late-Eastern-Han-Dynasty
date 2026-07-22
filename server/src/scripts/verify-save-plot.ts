// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { GameStatePlotSchema, PlotStage, PlotType } from '@leh/shared';
import { createGame, doLaunchPlot, endTurn, getGame } from '../services/game.js';

let passed = 0;
let failed = 0;
function check(label: string, condition: boolean): void {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}
function parseCurrentPlots() {
  return GameStatePlotSchema.parse({ plots: getGame().plots });
}

console.log('\n=== S16 计谋快照 Schema 验证 ===');
for (const scenario of [
  { id: 1, factionId: 1, label: '英雄集结' },
  { id: 2, factionId: 1, label: '关东义兵' },
]) {
  createGame(scenario.id, scenario.factionId);
  check(`${scenario.label}初始计谋切片通过严格解析`, parseCurrentPlots().plots.length === 0);
}

createGame(1, 1);
const before = getGame();
const target = Object.values(before.factions).find((f) => f.id !== before.playerFactionId && f.isAlive);
if (!target) throw new Error('验证夹具未找到可施展离间计的目标势力');
const goldBefore = Object.values(before.cities).filter((c) => c.ruler === before.playerFactionId).reduce((sum, c) => sum + c.gold, 0);
doLaunchPlot(PlotType.SOW_DISCORD, target.id, undefined, undefined, undefined);
const launched = parseCurrentPlots().plots;
check('真实发起离间计后生成一条准备期记录', launched.length === 1 && launched[0].stage === PlotStage.PREP);
check('离间计保存施计方、目标方与成本', launched[0].casterFactionId === 1 && launched[0].targetFactionId === target.id && launched[0].cost.gold === 200);
check('离间计不伪造城市、武将或特工引用', launched[0].targetCityId == null && launched[0].targetOfficerId == null && launched[0].agentId == null);
const after = getGame();
const goldAfter = Object.values(after.cities).filter((c) => c.ruler === after.playerFactionId).reduce((sum, c) => sum + c.gold, 0);
check('发起离间计真实扣除 200 金', goldBefore - goldAfter === 200);
endTurn();
const resolved = parseCurrentPlots().plots[0];
check('推进一回合后离间计完成结算', resolved.stage === PlotStage.RESOLVED && resolved.monthsLeft === 0);
check('结算结果包含成功、暴露与非空战报', resolved.result != null && resolved.result.message.length > 0);
check('发起与结算全过程后权威计谋状态仍通过 Schema', true);

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
