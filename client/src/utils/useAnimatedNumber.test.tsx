// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useAnimatedNumber } from './useAnimatedNumber';

function NumberTestComponent({ value }: { value: number }) {
  const { displayValue, delta, isAnimating } = useAnimatedNumber(value);
  return (
    <div data-testid="anim-num">
      <span data-testid="display">{String(displayValue)}</span>
      <span data-testid="delta">{String(delta)}</span>
      <span data-testid="animating">{String(isAnimating)}</span>
    </div>
  );
}

describe('useAnimatedNumber 数字跳动 Hook (S20-W2)', () => {
  it('初次渲染即时呈现目标数值', () => {
    const html = renderToStaticMarkup(<NumberTestComponent value={12000} />);
    expect(html).toContain('12000');
    expect(html).toContain('0'); // initial delta = 0
    expect(html).toContain('false'); // isAnimating = false
  });

  it('非有限数值安全降级不崩溃', () => {
    const html = renderToStaticMarkup(<NumberTestComponent value={NaN} />);
    expect(html).toContain('NaN');
  });

  it('能够稳定渲染负数或零', () => {
    const htmlZero = renderToStaticMarkup(<NumberTestComponent value={0} />);
    expect(htmlZero).toContain('0');

    const htmlNeg = renderToStaticMarkup(<NumberTestComponent value={-500} />);
    expect(htmlNeg).toContain('-500');
  });
});
