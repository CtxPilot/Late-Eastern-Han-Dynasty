// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommandConfirmDialog, getFocusTrapDestination } from './CommandConfirmDialog';

describe('CommandConfirmDialog unified final review', () => {
  it('cycles focus at both dialog boundaries', () => {
    expect(getFocusTrapDestination(0, 2, true)).toBe(1);
    expect(getFocusTrapDestination(1, 2, false)).toBe(0);
    expect(getFocusTrapDestination(0, 2, false)).toBeNull();
  });

  it('renders a uniquely labelled dialog and blocks stale submission', () => {
    const html = renderToStaticMarkup(
      <CommandConfirmDialog
        open
        category="朝廷"
        command="确认伪诏宣战：董卓政权"
        summary="状态再校验测试"
        items={[]}
        validateBeforeConfirm={() => '皇权不足（需40，当前20）。'}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    const labelledBy = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(html).toContain(`id="${labelledBy}"`);
    expect(html).toContain('确认伪诏宣战：董卓政权');
    expect(html).toContain('皇权不足（需40，当前20）。');
    expect(html).toMatch(/data-testid="command-confirm-submit"[^>]*disabled/);
  });
});
