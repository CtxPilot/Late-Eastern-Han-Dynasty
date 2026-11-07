// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { deriveStamp, formatActionLogEntry } from './eventLogParser';
import type { GameAction } from '@leh/shared';

describe('伪 Terminal 文言战报解析器 (eventLogParser.ts)', () => {
  it('正确解析各类别文言前缀标签', () => {
    const turnAction: GameAction = { year: 190, month: 1, type: 'turn', message: '岁在丙子，春正月，初吉。' };
    const civilAction: GameAction = { year: 190, month: 1, type: 'civil', message: '下邳屯田完毕，得粮三千石' };
    const militaryAction: GameAction = { year: 190, month: 2, type: 'battlefield', message: '曹仁领兵五千进抵新野城下' };
    const plotAction: GameAction = { year: 190, month: 3, type: 'plot', message: '水计顺流冲决，敌众惊骇' };
    const hegemonyAction: GameAction = { year: 195, month: 10, type: 'hegemony', message: '曹操受命开府，总领百揆' };
    const relationsAction: GameAction = { year: 190, month: 4, type: 'relations', message: '刘备与关羽、张飞义结金兰' };
    const eventAction: GameAction = { year: 190, month: 5, type: 'event', message: '琅琊郡大风拔树，飞沙走石' };

    expect(formatActionLogEntry(turnAction, 0).categoryTag).toBe('[ 旬始 ]');
    expect(formatActionLogEntry(civilAction, 1).categoryTag).toBe('[ 内政 ]');
    expect(formatActionLogEntry(militaryAction, 2).categoryTag).toBe('[ 军机 ]');
    expect(formatActionLogEntry(plotAction, 3).categoryTag).toBe('[ 谍变 ]');
    expect(formatActionLogEntry(hegemonyAction, 4).categoryTag).toBe('[ 大典 ]');
    expect(formatActionLogEntry(relationsAction, 5).categoryTag).toBe('[ 人伦 ]');
    expect(formatActionLogEntry(eventAction, 6).categoryTag).toBe('[ 天时 ]');
  });

  it('依据战报语义准确判定 [ 丰 / 警 / 凶 / 喜 / 谋 / 战 / 平 ] 状态印章', () => {
    expect(deriveStamp('下邳屯田完毕，得粮三千石', 'civil')).toBe('feng');
    expect(deriveStamp('兖州刺史曹操，引兵复袭徐州，兵临城下', 'military')).toBe('jing');
    expect(deriveStamp('琅琊郡大疫，生民多伤殁，大风拔树', 'event')).toBe('xiong');
    expect(deriveStamp('刘备受禅代汉，称帝登基，大赦天下', 'hegemony')).toBe('xi');
    expect(deriveStamp('孔明顺风施放水攻与伏兵之策', 'battle')).toBe('mou');
    expect(deriveStamp('张辽引铁骑出征突围，与敌鏖战', 'battlefield')).toBe('zhan');
    expect(deriveStamp('例行修整城防与巡检市邑', 'civil')).toBe('ping');
  });

  it('产出的格式化条目包含完整展示数据与古典徽章样式', () => {
    const action: GameAction = { year: 190, month: 4, type: 'civil', message: '襄阳开垦大成，获益丰厚' };
    const item = formatActionLogEntry(action, 42);

    expect(item.id).toBe('log-190-4-42-civil');
    expect(item.dateLabel).toBe('190年4月');
    expect(item.category).toBe('civil');
    expect(item.categoryTag).toBe('[ 内政 ]');
    expect(item.stamp).toBe('feng');
    expect(item.stampChar).toBe('丰');
    expect(item.stampBadgeStyle.color).toBe('#4ade80');
    expect(item.displayMessage).toBe('襄阳开垦大成，获益丰厚');
  });
});
