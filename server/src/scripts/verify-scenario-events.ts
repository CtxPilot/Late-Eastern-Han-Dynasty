// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import assert from 'node:assert/strict';
import { tickEvents, resolveEventChoice } from '../engine/event.js';
import { catchUpChildren } from '../engine/child.js';
import { createGame, getGame } from '../services/game.js';

function at(year: number, month: number) {
  return { ...getGame(), currentYear: year, currentMonth: month };
}

const hero = createGame(1, 2);
assert.equal(Object.keys(getGame().officers).length, 30, '英雄集结应加载全部30名武将');
assert.equal(hero.factions[2].name, '刘备军');
assert.deepEqual(tickEvents({ ...getGame(), currentYear: 190, currentMonth: 6 }).pendingEvents, []);

const historicalNames = ['曹操义兵', '袁绍河内军', '孙坚鲁阳军', '董卓政权'];
for (const factionId of [1, 2, 3, 4]) {
  const game = createGame(2, factionId);
  assert.equal(game.scenarioId, 2);
  assert.equal(game.factions[factionId].name, historicalNames[factionId - 1]);
  assert.equal(Object.keys(getGame().officers).length, 11, '历史切片只加载剧本白名单武将');
  assert.equal(Object.keys(getGame().females).length, 0, '历史切片不应泄漏英雄集结女性数据');
}

createGame(2, 1);
const playerOpening = tickEvents(at(190, 2));
assert.deepEqual(playerOpening.pendingEvents, [100], '曹操玩家应收到陈留起兵抉择');
const resolvedOpening = resolveEventChoice(playerOpening, 100, 0);
assert.deepEqual(resolvedOpening.pendingEvents, []);
assert.equal(resolvedOpening.eventChoices[100], 0);
assert.ok(resolvedOpening.completedEvents.includes(100));

createGame(2, 2);
const aiOpening = tickEvents(at(190, 2));
assert.ok(aiOpening.completedEvents.includes(100), '曹操AI应自动处理起兵事件');
assert.equal(aiOpening.eventChoices[100], 0, '曹操AI应按历史/性格权重选择起兵');
assert.deepEqual(aiOpening.pendingEvents, []);

createGame(2, 1);
const blockedLeader = tickEvents(at(190, 3));
assert.ok(!blockedLeader.completedEvents.includes(101), '前置事件未完成时不得推举盟主');
const aiLeader = tickEvents({ ...at(190, 3), completedEvents: [100] });
assert.ok(aiLeader.completedEvents.includes(101), '前置完成后袁绍AI应处理盟主事件');
assert.equal(aiLeader.eventChoices[101], 0);

createGame(2, 2);
const playerLeader = tickEvents({ ...at(190, 3), completedEvents: [100] });
assert.deepEqual(playerLeader.pendingEvents, [101], '袁绍玩家应亲自决定是否承任盟主');

createGame(2, 1);
const migration = tickEvents({ ...at(190, 4), completedEvents: [100, 101] });
assert.equal(migration.factions[4].capitalCityId, 2, '董卓AI应按权重迁都长安');
assert.equal(migration.eventChoices[102], 0);

createGame(2, 1);
const cautiousOpening = resolveEventChoice(tickEvents(at(190, 2)), 100, 1);
const noPursuitAfterCaution = tickEvents({
  ...cautiousOpening,
  currentMonth: 5,
  completedEvents: [100, 101, 102],
  eventChoices: { ...cautiousOpening.eventChoices, 102: 0 },
});
assert.ok(!noPursuitAfterCaution.completedEvents.includes(103), '曹操选择观望后不得触发汴水追击');

createGame(2, 1);
const noPursuitWithoutMigration = tickEvents({
  ...at(190, 5),
  completedEvents: [100, 101, 102],
  eventChoices: { 100: 0, 102: 1 },
});
assert.ok(!noPursuitWithoutMigration.completedEvents.includes(103), '董卓固守洛阳后不得触发迁都后的追击');

createGame(2, 1);
const noPursuitWithoutChenliu = tickEvents({
  ...at(190, 5),
  completedEvents: [100, 101, 102],
  eventChoices: { 100: 0, 102: 0 },
  cities: { ...getGame().cities, 7: { ...getGame().cities[7], ruler: 4 } },
});
assert.ok(!noPursuitWithoutChenliu.completedEvents.includes(103), '陈留失守后不得修改该城兵力');

createGame(2, 1);
const isolatedChildren = catchUpChildren({ ...getGame(), currentYear: 220 });
assert.ok(!isolatedChildren.officers[953], '历史切片不得补登未列入场景的曹丕子女事件');

createGame(2, 1, ['official_history', 'annotated_history', 'gameplay']);
const noLiterature = tickEvents({ ...at(190, 5), completedEvents: [100, 101, 102, 103] });
assert.ok(!noLiterature.completedEvents.includes(104), '关闭文学层后不得触发三英战吕布');

createGame(2, 1);
const withLiterature = tickEvents({ ...at(190, 5), completedEvents: [100, 101, 102, 103] });
assert.ok(withLiterature.completedEvents.includes(104), '默认文学层应触发并标记传奇演出');

createGame(2, 1);
const expired = tickEvents(at(191, 1));
assert.deepEqual(expired.pendingEvents, []);
assert.equal(expired.invalidatedEvents.length, 10, '190年结束时，190年时间窗内的事件应失效');

assert.throws(
  () => resolveEventChoice({ ...playerOpening, pendingEvents: [100, 101] }, 101, 0),
  /首个事件/,
  '服务端必须强制按待决队列顺序处理',
);

console.log('Scenario/event verification passed (32 assertions).');
