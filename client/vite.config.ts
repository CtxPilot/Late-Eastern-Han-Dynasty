// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { defineConfig, type Plugin, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

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

/**
 * 离线可玩版（Session 372 Phase 3）：浏览器/Worker 打包时，把服务端引擎对
 * '../data/loader.js'（node:fs 版）的解析重定向到 Vite JSON 导入 shim，
 * 使同一套权威引擎可在 Web Worker 内运行；服务端构建不受影响（本插件仅存在于
 * client/vite.config.ts）。
 */
const BROWSER_LOADER = resolve(__dirname, 'src/workers/browser-loader.ts');

const DATA_FILES = [
  'officers', 'cities', 'formations', 'units', 'items',
  'females', 'children', 'skills', 'scenarios', 'events', 'relations',
] as const;
const VIRTUAL_LEH_DATA = '\0virtual:leh-data';
const NODE_SHIM = '\0leh-node-shim';
const REPO_ROOT = resolve(__dirname, '..');

const NODE_BUILTINS = ['fs', 'path', 'url', 'node:fs', 'node:path', 'node:url'];

/** 离线打包：把引擎残留的 Node 内建导入替换为无害 shim（运行时不应触达；数据经 virtual:leh-data 注入）。 */
function lehNodeShims(): Plugin {
  return {
    name: 'leh-node-shims',
    enforce: 'pre',
    resolveId(id) {
      if (NODE_BUILTINS.includes(id)) return NODE_SHIM;
      return null;
    },
    load(id) {
      if (id !== NODE_SHIM) return null;
      return [
        'export const readFileSync = () => { throw new Error("Node fs 在浏览器不可用（离线数据经 virtual:leh-data 注入）"); };',
        'export const statSync = () => { throw new Error("Node fs 在浏览器不可用"); };',
        'export const existsSync = () => false;',
        'export const mkdirSync = () => undefined;',
        'export const readdirSync = () => [];',
        'export const renameSync = () => undefined;',
        'export const join = (...parts) => parts.join("/");',
        'export const dirname = (p) => p;',
        'export const fileURLToPath = () => "";',
      ].join('\n');
    },
  };
}

function lehDataVirtual(): Plugin {
  return {
    name: 'leh-data-virtual',
    resolveId(id) {
      if (id === 'virtual:leh-data') return VIRTUAL_LEH_DATA;
      return null;
    },
    load(id) {
      if (id !== VIRTUAL_LEH_DATA) return null;
      const readJson = (file: string) =>
        JSON.parse(readFileSync(resolve(REPO_ROOT, file), 'utf-8')) as unknown;
      const lines = DATA_FILES.map(
        (name) => `export const ${name} = ${JSON.stringify(readJson(`server/src/data/${name}.json`))};`,
      );
      lines.push(`export const tacticalSystemV2 = ${JSON.stringify(readJson('shared/data/tactical-system.v2.json'))};`);
      return lines.join('\n');
    },
  };
}

function lehBrowserLoader(): Plugin {
  return {
    name: 'leh-browser-loader',
    enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('data/loader.js')) return BROWSER_LOADER;
      return null;
    },
  };
}

/**
 * 引擎解析插件组：主线程与 Worker 子构建（vite:worker-import-meta-url 独立
 * Rollup 流程）都需要；生产构建下 worker.plugins 不会自动继承顶层插件。
 */
const engineResolvePlugins = (): Plugin[] => [lehBrowserLoader(), lehDataVirtual(), lehNodeShims()];

/** djb2 短哈希：预缓存清单内容变化 → 缓存名随之失效。 */
function shortHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * 离线冷启动（Session 373 Phase 4）：构建期把全部产物写入 sw.js 预缓存清单。
 * - 预缓存：首访安装即抓取所有 chunk/asset/字体/底图，缓存名随清单哈希更迭；
 * - 导航请求网络优先、失败回退缓存 index.html；其余同源 GET 缓存优先并回填；
 * - /api/ 一律放行（联机模式不受影响）；dev 不生成。
 */
function lehPwaPrecache(): Plugin {
  let outDirAbs = '';
  let base = '/';
  return {
    name: 'leh-pwa-precache',
    apply: 'build',
    configResolved(config) {
      outDirAbs = resolve(config.root, config.build.outDir);
      base = config.base;
    },
    // closeBundle：此时 public/ 目录已拷入 outDir，直接磁盘扫描保证全量预缓存
    closeBundle() {
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
          const full = join(dir, entry.name);
          return entry.isDirectory() ? walk(full) : [full];
        });
      const files = walk(outDirAbs)
        .map((full) => full.slice(outDirAbs.length + 1).split(sep).join('/'))
        .filter((rel) => rel !== 'sw.js' && !rel.endsWith('.map'))
        .map((rel) => `${base}${rel}`);
      const manifest = Array.from(new Set([`${base}index.html`, ...files])).sort();
      const version = shortHash(manifest.join('\n'));
      const swSource = `/* Generated by leh-pwa-precache (v${version}) — do not edit. */
const CACHE = 'leh-' + '${version}';
const PRECACHE = ${JSON.stringify(manifest, null, 2)};
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('leh-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('${base}index.html')));
    return;
  }
  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
      return response;
    })),
  );
});
`;
      mkdirSync(dirname(resolve(outDirAbs, 'sw.js')), { recursive: true });
      writeFileSync(resolve(outDirAbs, 'sw.js'), swSource, 'utf-8');
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), rebasePublicFontUrls(), ...engineResolvePlugins(), lehPwaPrecache()],
  worker: {
    format: 'es',
    plugins: engineResolvePlugins,
  },
  server: {
    port: 5173,
    fs: {
      // 允许 dev server 提供仓库级静态数据（browser-loader 的 JSON 相对导入）
      allow: [resolve(__dirname, '..')],
    },
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
} as UserConfig);
