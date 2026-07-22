// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { GameStateSchema, PlotType } from '@leh/shared';
import { createGame, doLaunchPlot, getGame } from '../services/game.js';

let passed = 0;
let failed = 0;
function check(label: string, condition: boolean): void {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}
function rejects(label: string, mutate: (state: ReturnType<typeof getGame>) => void, pattern: RegExp): void {
  const clone = structuredClone(getGame());
  mutate(clone);
  const result = GameStateSchema.safeParse(clone);
  check(label, !result.success && pattern.test(result.error.message));
}

console.log('\n=== S16 完整 GameState Schema 验证 ===');
for (const scenario of [
  { id: 1, factionId: 1, label: '英雄集结' },
  { id: 2, factionId: 1, label: '关东义兵' },
]) {
  createGame(scenario.id, scenario.factionId);
  const result = GameStateSchema.safeParse(getGame());
  if (!result.success) console.error(result.error.issues.slice(0, 8));
  check(`${scenario.label}完整权威状态通过组合 Schema`, result.success);
}

createGame(1, 1);
const state = getGame();
const targetFaction = Object.values(state.factions).find((faction) => faction.id !== state.playerFactionId && faction.isAlive);
if (!targetFaction) throw new Error('验证夹具未找到计谋目标势力');
doLaunchPlot(PlotType.SOW_DISCORD, targetFaction.id, undefined, undefined, undefined);
check('真实发起计谋后的完整权威状态仍可解析', GameStateSchema.safeParse(getGame()).success);

rejects('拒绝不存在的玩家势力引用', (draft) => { draft.playerFactionId = 999999; }, /玩家势力不存在/);
rejects('拒绝势力引用不存在的城市', (draft) => { draft.factions[1].cityIds.push(999999); }, /势力引用的城市不存在/);
rejects('拒绝城市与武将所在地不一致', (draft) => { draft.cities[1].officers.push(2); }, /城市武将清单与武将所在地不一致/);
rejects('拒绝不存在的战役节点邻接引用', (draft) => { draft.campaignNodes[0].adjacentNodeIds.push(999999); }, /相邻战役节点不存在/);
rejects('拒绝外交关系引用不存在的势力', (draft) => { draft.diplomacy[0].factionB = 999999; }, /外交势力 B 不存在/);
rejects('拒绝计谋引用不存在的目标势力', (draft) => { draft.plots[0].targetFactionId = 999999; }, /计谋目标势力不存在/);
rejects('拒绝完整快照根部未知字段', (draft) => { (draft as typeof draft & { transientSelection?: number }).transientSelection = 1; }, /Unrecognized key/);

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
