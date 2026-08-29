// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// 工程字体唯一声明处（批次①去重：index.css 内联块已删除）。
// 用 JS import 而非 CSS @import：@import 必须置顶，在 @tailwind 之后会被忽略。
import './styles/fonts.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 离线冷启动（Session 373 Phase 4）：生产构建注册 Service Worker 预缓存。
// dev 不注册（避免干扰 HMR）；注册失败静默降级为普通在线/离线网关行为。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {});
  });
}
