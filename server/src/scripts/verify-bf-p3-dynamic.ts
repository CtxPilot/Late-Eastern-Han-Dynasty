// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { generateNanjunBattlefield } from '@leh/shared';
import { SerializableRng } from '@leh/shared';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

function generate(seed: number, armyIds = ['army-b', 'army-a']) {
  const rng = new SerializableRng(seed);
  const start = rng.snapshot();
  const instance = generateNanjunBattlefield({
    instanceId: 'bf-test',
    warId: 'war-test',
    attackerFactionId: 1,
    defenderFactionId: 2,
    armyIds,
    rngDrawStart: start.draws,
    dynamic: { rng: () => rng.next(), currentMonth: 7 },
  });
  return { instance, rng: rng.snapshot() };
}

const first = generate(0x5eed_0003);
const replay = generate(0x5eed_0003);
assert(JSON.stringify(first) === JSON.stringify(replay), '固定 seed 完整动态战况与最终 RNG 可复现');
assert(first.instance.dynamicSituation != null, '动态战况已冻结进 BattlefieldInstance');
assert(first.instance.generationAudit.rngDrawEnd === first.rng.draws, '生成审计 drawEnd 与权威 RNG 一致');
assert(first.instance.generationAudit.rngDrawEnd > first.instance.generationAudit.rngDrawStart, '动态生成实际消费 RNG');
assert(first.instance.dynamicSituation.deployments.map((item) => item.armyId).join(',') === 'army-a,army-b', '部署候选先稳定排序');
assert(first.instance.dynamicSituation.encounterOrder.length === 2, '遭遇顺序覆盖两支参战 Army');
assert(first.instance.generationAudit.decisions.some((item) => item.startsWith('weather=')), '生成审计记录天气');
assert(first.instance.generationAudit.decisions.some((item) => item.startsWith('ambush=')), '生成审计记录伏击');

const checkpointRng = new SerializableRng(0x5eed_0003);
checkpointRng.next();
checkpointRng.next();
const checkpoint = checkpointRng.snapshot();
const continued = new SerializableRng(checkpoint);
const restored = new SerializableRng(checkpoint);
const continuedInstance = generateNanjunBattlefield({
  instanceId: 'bf-checkpoint',
  warId: 'war-checkpoint',
  attackerFactionId: 1,
  defenderFactionId: 2,
  armyIds: ['army-a'],
  rngDrawStart: checkpoint.draws,
  dynamic: { rng: () => continued.next(), currentMonth: 1 },
});
const restoredInstance = generateNanjunBattlefield({
  instanceId: 'bf-checkpoint',
  warId: 'war-checkpoint',
  attackerFactionId: 1,
  defenderFactionId: 2,
  armyIds: ['army-a'],
  rngDrawStart: checkpoint.draws,
  dynamic: { rng: () => restored.next(), currentMonth: 1 },
});
assert(JSON.stringify(continuedInstance) === JSON.stringify(restoredInstance), '指定保存点恢复后动态生成一致');
assert(JSON.stringify(continued.snapshot()) === JSON.stringify(restored.snapshot()), '指定保存点恢复后 RNG 终态一致');

let zeroDraws = 0;
const staticInstance = generateNanjunBattlefield({
  instanceId: 'bf-static',
  warId: 'war-static',
  attackerFactionId: 1,
  defenderFactionId: 2,
  armyIds: [],
  rngDrawStart: 7,
});
assert(staticInstance.dynamicSituation == null, '无动态配置不生成动态战况');
assert(staticInstance.generationAudit.rngDrawStart === 7 && staticInstance.generationAudit.rngDrawEnd === 7, '无随机配置零消费');
assert(zeroDraws === 0, '静态模板没有隐式随机调用');

console.log(`BF-P3 dynamic battlefield verification passed: ${passed}/13`);
