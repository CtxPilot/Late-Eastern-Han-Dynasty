// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EventLogTerminal } from './EventLogTerminal';
import type { GameAction } from '@leh/shared';

describe('EventLogTerminal 伪 Terminal 文言战报组件', () => {
  const sampleActions: GameAction[] = [
    { year: 190, month: 1, type: 'turn', message: '岁在丙子，春正月，初吉。' },
    { year: 190, month: 1, type: 'civil', message: '下邳屯田完毕，得粮三千石' },
    { year: 190, month: 2, type: 'military', message: '兖州刺史曹操，引兵复袭徐州' },
    { year: 190, month: 3, type: 'event', message: '琅琊郡大疫，生民多伤疾' },
    { year: 190, month: 4, type: 'hegemony', message: '刘备称帝登基，大赦天下' },
  ];

  it('正确渲染 Terminal 题头与经典三色古雅终端灯', () => {
    const html = renderToStaticMarkup(<EventLogTerminal entries={sampleActions} />);
    expect(html).toContain('漢末起居注');
    expect(html).toContain('/tty-annal');
    expect(html).toContain('bg-rose-600/90');
    expect(html).toContain('bg-amber-500/90');
    expect(html).toContain('bg-emerald-500/90');
    expect(html).toContain('[ 5 简 ]');
  });

  it('正确渲染文言标签 [ 旬始 ]、[ 内政 ]、[ 军机 ] 及状态印章 [ 丰 ]、[ 警 ]、[ 凶 ]、[ 喜 ]', () => {
    const html = renderToStaticMarkup(<EventLogTerminal entries={sampleActions} />);
    expect(html).toContain('[ 旬始 ]');
    expect(html).toContain('[ 内政 ]');
    expect(html).toContain('[ 军机 ]');
    expect(html).toContain('[ 天时 ]');
    expect(html).toContain('[ 大典 ]');

    expect(html).toContain('[ 丰 ]');
    expect(html).toContain('[ 警 ]');
    expect(html).toContain('[ 凶 ]');
    expect(html).toContain('[ 喜 ]');
  });

  it('紧凑模式受控截断且保留单行展现', () => {
    const html = renderToStaticMarkup(<EventLogTerminal entries={sampleActions} compact maxEntries={2} />);
    expect(html).toContain('岁在丙子');
    expect(html).toContain('得粮三千石');
    // 第 3 条不应出现
    expect(html).not.toContain('引兵复袭徐州');
  });
});
