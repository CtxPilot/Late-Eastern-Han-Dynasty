// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { GameStateSchema } from '@leh/shared';
import {
  closeBattlefieldDuel,
  createGame,
  enterNanjunBattlefield,
  getGame,
  skipBattlefieldDuel,
  startBattlefieldDuel,
  stepBattlefieldDuel,
} from '../services/game.js';

let passed = 0;
function check(label: string, condition: boolean): void {
  if (!condition) throw new Error(`✗ ${label}`);
  passed += 1;
  console.log(`✓ ${label}`);
}

function runContext(kind: 'formation_front' | 'city_front'): void {
  createGame(1, 1);
  enterNanjunBattlefield('yingchuan');
  const before = getGame();
  const inst = before.activeBattlefieldInstance!;
  const nodeId = kind === 'city_front' ? inst.targetSeatNodeId : inst.entryNodeIds[0];
  const nodeBefore = inst.nodeStates.find((node) => node.nodeId === nodeId)!;
  startBattlefieldDuel(kind, nodeId, kind === 'city_front' ? 'steady' : 'assault');
  const started = getGame().activeBattlefieldInstance!.activeDuel!;
  check(`${kind} 创建可存档 DuelState`, started.duel.battleId.includes(kind) && GameStateSchema.safeParse(getGame()).success);
  check(`${kind} 上下文双方与 DuelState 同源`, started.challengerId === started.duel.challengerId && started.defenderId === started.duel.defenderId);
  check(`${kind} 使用选择的挑战方倾向`, started.duel.stances[started.challengerId] === (kind === 'city_front' ? 'steady' : 'assault'));

  stepBattlefieldDuel();
  check(`${kind} 逐回合端点调用既有引擎`, getGame().activeBattlefieldInstance!.activeDuel!.duel.round === 1);
  skipBattlefieldDuel();
  const settled = getGame();
  const context = settled.activeBattlefieldInstance!.activeDuel!;
  const result = context.duel.result!;
  check(`${kind} 跳过后得到完整 DuelResult`, context.duel.phase === 'resolved' && result.rounds.length >= 1);
  check(`${kind} 结果只回写一次`, context.settlementApplied && settled.actionLog[0].type === 'battlefield_duel');
  const parsed = GameStateSchema.safeParse(settled);
  if (!parsed.success) console.error(parsed.error.issues.slice(0, 3));
  check(`${kind} 结算后完整 GameState 仍可存档`, parsed.success);
  const snapshot = JSON.stringify({
    armies: settled.campaignArmies,
    node: settled.activeBattlefieldInstance!.nodeStates.find((node) => node.nodeId === nodeId),
    officers: settled.officers,
    log: settled.actionLog,
  });
  skipBattlefieldDuel();
  check(`${kind} 重复 skip 幂等`, JSON.stringify({
    armies: getGame().campaignArmies,
    node: getGame().activeBattlefieldInstance!.nodeStates.find((node) => node.nodeId === nodeId),
    officers: getGame().officers,
    log: getGame().actionLog,
  }) === snapshot);
  const challengerWon = result.winnerId === context.challengerId && result.outcome !== 'draw';
  const nodeAfter = getGame().activeBattlefieldInstance!.nodeStates.find((node) => node.nodeId === nodeId)!;
  check(`${kind} 守军回写符合胜负`, nodeAfter.garrison === (challengerWon ? Math.floor(nodeBefore.garrison * 0.85) : nodeBefore.garrison));
  closeBattlefieldDuel();
  check(`${kind} 结算后可返回郡域战场`, getGame().activeBattlefieldInstance?.activeDuel === undefined);
}

console.log('\n=== BF-P4 阵前/城下单挑共享引擎与回写 ===\n');
runContext('formation_front');
runContext('city_front');
console.log(`\nBF-P4 duel: ${passed}/${passed} passed`);
