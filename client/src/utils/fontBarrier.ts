// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Canvas 渲染屏障（Font Loading Barrier）
 *
 * 详见 docs/00-dev-constitution.md §11.7、AGENTS.md 核心规则 9、
 *      client/public/fonts/README.md
 *
 * 为什么要 FontBarrier：
 * - Canvas 绘文字不经过 DOM 树，直接读字形数据
 * - 若字体未加载完就画第一帧，会用宿主默认字体绘制（Linux 极简发行版可能无 CJK → 豆腐块 □□□）
 * - Konva 无自动字体变更监听，画错第一帧后不会自动重绘
 * - 因此必须在游戏初始化阶段建立阻塞屏障，等字体写入内存后才放行渲染
 *
 * 超时兜底（Session 102 修复）：
 * - document.fonts.load() 在 woff2 缺失时可能永不 resolve 也永不 reject
 *   （FontFace API 网络请求失败前一直 pending），导致游戏永远卡在加载屏
 * - 加 4s 超时（与 font-display: block 的 3s 回退期对齐 + 1s 余量），
 *   超时后仍放行渲染，让浏览器 fallback 字体生效（优于永久卡死）
 */

const FONT_LOAD_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(`⚠️ 字体加载超时 [${label}]，${ms}ms 未就绪，放行渲染（浏览器 fallback 生效）`);
      resolve(undefined as T);
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export async function waitForGameFonts(): Promise<boolean> {
  if (!('fonts' in document)) {
    console.warn('当前容器不支持 FontFace API，尝试回退渲染。');
    return true;
  }

  try {
    // 显式声明需要检测的工程内部别名和字号
    // 用 12px 是因为 MapCanvas 城市名最小字号接近此值，确保该字号字形已就绪
    const serifHook = document.fonts.load('12px HanDynastySerif');
    const sealHook = document.fonts.load('12px HanDynastySeal');

    // 阻塞等待，直到浏览器内核向操作系统/内存确认字形可用
    // 超时兜底：woff2 缺失时 document.fonts.load 可能永不 resolve，4s 后强制放行
    await Promise.all([
      withTimeout(serifHook, FONT_LOAD_TIMEOUT_MS, 'HanDynastySerif'),
      withTimeout(sealHook, FONT_LOAD_TIMEOUT_MS, 'HanDynastySeal'),
    ]);
    console.log('✔ 东汉工程字体资产在当前平台（Win/Mac/Linux）加载成功，内核准予渲染。');
    return true;
  } catch (error) {
    // document.fonts.load 仅在字体名非法时 reject，网络/缺失超时已由 withTimeout 兜底
    console.error('⚠️ 字体资产加载失败，为防止乱码，游戏拒绝启动:', error);
    return false;
  }
}