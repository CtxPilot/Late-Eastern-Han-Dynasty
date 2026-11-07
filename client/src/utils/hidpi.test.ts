// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it, vi } from 'vitest';
import { getEffectiveDpr, getLayerCacheOptions, observePixelRatio, setupHiDPIStage, type StageLike } from './hidpi';

describe('HiDPI / Wayland 工具链 (hidpi.ts)', () => {
  it('正确提取并夹紧 DPR 范围在 [1, 3] 内', () => {
    expect(getEffectiveDpr({ devicePixelRatio: 1.25 } as unknown as Window)).toBe(1.25);
    expect(getEffectiveDpr({ devicePixelRatio: 1.75 } as unknown as Window)).toBe(1.75);
    expect(getEffectiveDpr({ devicePixelRatio: 2 } as unknown as Window)).toBe(2);
    expect(getEffectiveDpr({ devicePixelRatio: 0.5 } as unknown as Window)).toBe(1); // 夹紧下限
    expect(getEffectiveDpr({ devicePixelRatio: 4.5 } as unknown as Window)).toBe(3); // 夹紧上限
    expect(getEffectiveDpr(undefined)).toBe(1);
  });

  it('获取图层烘焙选项包含正确的 pixelRatio', () => {
    const opts = getLayerCacheOptions(1.5);
    expect(opts.pixelRatio).toBe(1.5);
  });

  it('setupHiDPIStage 正确同步 Stage 逻辑尺寸与容器样式', () => {
    const styleObj: Record<string, string> = {};
    const containerDiv = { style: styleObj } as unknown as HTMLElement;

    let currentW = 800;
    let currentH = 600;

    const mockStage: StageLike = {
      width: (val?: number) => {
        if (typeof val === 'number') currentW = val;
        return currentW;
      },
      height: (val?: number) => {
        if (typeof val === 'number') currentH = val;
        return currentH;
      },
      container: () => containerDiv,
    };

    const dpr = setupHiDPIStage(mockStage, 1024, 768, 1.5);
    expect(dpr).toBe(1.5);
    expect(currentW).toBe(1024);
    expect(currentH).toBe(768);
    expect(styleObj.width).toBe('1024px');
    expect(styleObj.height).toBe('768px');
  });

  it('observePixelRatio 能监听分辨率变化并在注销时清理', () => {
    let changeHandler: (() => void) | null = null;
    const fakeWindow = {
      devicePixelRatio: 1.25,
      matchMedia: vi.fn().mockImplementation((_query: string) => ({
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'change') changeHandler = handler;
        }),
        removeEventListener: vi.fn(),
      })),
    } as unknown as Window;

    const onChange = vi.fn();
    const cleanup = observePixelRatio(onChange, fakeWindow);

    expect(fakeWindow.matchMedia).toHaveBeenCalledWith('(resolution: 1.25dppx)');

    // 模拟分辨率改变
    (fakeWindow as unknown as { devicePixelRatio: number }).devicePixelRatio = 2.0;
    if (changeHandler) {
      (changeHandler as () => void)();
    }
    expect(onChange).toHaveBeenCalledWith(2.0);

    cleanup();
  });
});
