// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { canAttemptMarchTo } from '@leh/shared';
import {
  createGame,
  getClientGame,
  getGame,
  startMarch,
} from '../services/game.js';

let passed = 0;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  passed += 1;
  console.log(`PASS ${passed}: ${message}`);
}

createGame(1, 2);

const targetCityId = 13; // 宛：与刘备军襄阳(15)官道邻接
const fromCityId = 15;
const maskedBefore = getClientGame();
const authoritativeBefore = getGame();

check(maskedBefore.cities[targetCityId]?.ruler === null, '未侦察敌城归属保持脱敏');
check(maskedBefore.cities[targetCityId]?.troops === 0, '未侦察敌城兵力保持脱敏');
check(
  authoritativeBefore.cities[targetCityId]?.ruler === 1 &&
    authoritativeBefore.cities[targetCityId]?.troops === 5000,
  '权威状态仍保存目标真实归属与驻军',
);
check(
  canAttemptMarchTo(
    maskedBefore.cities,
    maskedBefore.playerFactionId,
    targetCityId,
  ),
  '客户端仅凭己方兵力与道路邻接允许尝试出征',
);

const sourceTroopsBefore = authoritativeBefore.cities[fromCityId]!.troops;
const { game: maskedAfter, battle } = startMarch(targetCityId, fromCityId, 1000);
const authoritativeAfter = getGame();

check(
  authoritativeAfter.cities[fromCityId]!.troops === sourceTroopsBefore - 1000,
  '服务端按权威状态扣除真实出发兵力',
);
check(
  battle.cityId === targetCityId &&
    battle.units.some((unit) => unit.side === 'attacker') &&
    battle.units.some((unit) => unit.side === 'defender'),
  '服务端为真实敌城创建双方战斗并返回结算状态',
);
check(
  maskedAfter.cities[targetCityId]?.ruler === 1 &&
    maskedAfter.cities[targetCityId]?.troops !== 5000,
  '出征只授予表面战地情报，未泄露精确驻军',
);

console.log(`\n迷雾出征集成验证通过：${passed}/7`);
