// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { Season, type GameState } from '@leh/shared';
import { advanceCalendar, advanceTurn } from '../engine/turn.js';
import { createGame, getGame } from '../services/game.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

const expected = [
  [190, 2, Season.SPRING],
  [190, 3, Season.SPRING],
  [190, 4, Season.SUMMER],
  [190, 5, Season.SUMMER],
  [190, 6, Season.SUMMER],
  [190, 7, Season.AUTUMN],
  [190, 8, Season.AUTUMN],
  [190, 9, Season.AUTUMN],
  [190, 10, Season.WINTER],
  [190, 11, Season.WINTER],
  [190, 12, Season.WINTER],
  [191, 1, Season.SPRING],
] as const;

let calendarYear = 190;
let calendarMonth = 1;
for (const [year, month, season] of expected) {
  const next = advanceCalendar(calendarYear, calendarMonth);
  assert(next.year === year && next.month === month, `日历必须推进至 ${year}年${month}月`);
  assert(next.season === season, `${year}年${month}月季节映射错误`);
  calendarYear = next.year;
  calendarMonth = next.month;
}

createGame(1, 1);
let state: GameState = getGame();
const monthDates: string[] = [];
const quarterDates: string[] = [];
const yearDates: string[] = [];

// 固定 RNG 走真实 advanceTurn 编排；每一步只统计本月新写入的节拍日志。
for (let turn = 0; turn < 12; turn += 1) {
  state = advanceTurn(state, () => 0.99);
  const date = `${state.currentYear}-${state.currentMonth}`;
  const currentLogs = state.actionLog.filter(
    (log) => log.year === state.currentYear && log.month === state.currentMonth,
  );
  if (currentLogs.some((log) => log.type === 'end_turn')) monthDates.push(date);
  if (currentLogs.some((log) => log.type === 'quarter_start')) quarterDates.push(date);
  if (currentLogs.some((log) => log.type === 'year_start')) yearDates.push(date);
}

assert(monthDates.length === 12, `12 回合必须产生 12 次月度结算，实际 ${monthDates.length}`);
assert(
  quarterDates.join(',') === '190-4,190-7,190-10,191-1',
  `季度触发必须位于 4/7/10/1 月，实际 ${quarterDates.join(',')}`,
);
assert(yearDates.join(',') === '191-1', `12 回合必须只跨年一次，实际 ${yearDates.join(',')}`);
assert(state.currentYear === 191 && state.currentMonth === 1, '从 190 年 1 月推进 12 回合必须到 191 年 1 月');

console.log(`S01 回合节拍验证通过：${passed}/${passed}`);
console.log(`月度=${monthDates.length}，季度=${quarterDates.join('、')}，年度=${yearDates.join('、')}`);
