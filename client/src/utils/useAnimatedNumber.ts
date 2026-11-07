// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useRef, useState } from 'react';

/**
 * S20-W2: useAnimatedNumber 数字跳动 Hook
 *
 * 规格：
 * - 纯 rAF + easeOutCubic 缓动计算；
 * - 耗时默认 500ms（或指定 durationMs）；
 * - 输入非有限数或在非浏览器环境安全降级直出；
 * - 快速连续变更时以 currentValueRef 为基准平滑过渡到新目标值；
 * - 导出 delta 变化量与 isAnimating 状态供 UI 闪烁高亮（绿涨红跌）。
 */

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

export interface AnimatedNumberResult {
  value: number;
  displayValue: number;
  delta: number;
  isAnimating: boolean;
}

export function useAnimatedNumber(
  target: number,
  durationMs = 500,
): AnimatedNumberResult {
  const [displayValue, setDisplayValue] = useState(target);
  const [isAnimating, setIsAnimating] = useState(false);
  const [delta, setDelta] = useState(0);

  const currentValueRef = useRef(target);
  const startValueRef = useRef(target);
  const targetValueRef = useRef(target);
  const startTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      currentValueRef.current = target;
      setDisplayValue(target);
      setIsAnimating(false);
      return;
    }

    if (target === targetValueRef.current) {
      return;
    }

    const startVal = currentValueRef.current;
    const diff = target - startVal;
    setDelta(diff);
    startValueRef.current = startVal;
    targetValueRef.current = target;
    startTimeRef.current = null;
    setIsAnimating(true);

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      currentValueRef.current = target;
      setDisplayValue(target);
      setIsAnimating(false);
      return;
    }

    const tick = (now: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = now;
      }

      const elapsed = now - startTimeRef.current;
      const progress = Math.min(1, Math.max(0, elapsed / durationMs));
      const eased = easeOutCubic(progress);

      const nextVal = Math.round(
        startValueRef.current + (targetValueRef.current - startValueRef.current) * eased,
      );

      currentValueRef.current = nextVal;
      setDisplayValue(nextVal);

      if (progress < 1) {
        rafIdRef.current = window.requestAnimationFrame(tick);
      } else {
        currentValueRef.current = targetValueRef.current;
        setDisplayValue(targetValueRef.current);
        setIsAnimating(false);
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [target, durationMs]);

  return {
    value: target,
    displayValue,
    delta,
    isAnimating,
  };
}
