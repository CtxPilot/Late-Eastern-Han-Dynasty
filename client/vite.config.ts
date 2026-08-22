// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 子路径部署：CI 传入 GITHUB_PAGES_BASE=/Late-Eastern-Han-Dynasty/，
// 本地 dev/preview 不设置时保持默认根路径，行为不变。
const base = process.env.GITHUB_PAGES_BASE ?? '/';

// public 目录资产（工程字体）不参与 Vite 构建期的 base 重写；
// 此插件在产物 CSS 内把 /fonts/ 绝对引用统一加上 base 前缀。dev 不受影响。
function rebasePublicFontUrls(): Plugin {
  return {
    name: 'leh-rebase-public-font-urls',
    apply: 'build',
    generateBundle(_options, bundle) {
      if (base === '/') return;
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.css')) {
          const source = String(file.source);
          file.source = source.replace(
            /url\((['"]?)\/fonts\//g,
            `url($1${base}fonts/`,
          );
        }
      }
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), rebasePublicFontUrls()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
});
