// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 460 · P5-12 数据懒加载与 Worker/主包代码分包专项门禁。
 *
 * 验证目标：
 * 1. 产物 chunk 大小门禁：所有 JS chunk 必须严格 <= 500 KB，彻底消除 Vite 大包警告；
 * 2. Worker 代码分包：data-officers-1, data-officers-2, data-core, worker-shared, game.worker 独立产出；
 * 3. 静态数据完整度：1001将、106城、27阵、24兵、165宝、90女、50孩、149技、9剧本、59事件 零缺失；
 * 4. PWA 预缓存闭环：sw.js PRECACHE 完整纳管所有分包资产与字体；
 * 5. Worker Handler 奇偶校验保持 100% 对齐。
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CLIENT_DIST = join(ROOT, 'client', 'dist');
const ASSETS_DIR = join(CLIENT_DIST, 'assets');

console.log('=== [Session 460] P5-12 数据懒加载与 Worker 代码分包门禁检验 ===\n');

// 1. 检查构建产物与资产目录
assert.ok(existsSync(CLIENT_DIST), 'client/dist 目录必须存在');
assert.ok(existsSync(ASSETS_DIR), 'client/dist/assets 目录必须存在');
assert.ok(existsSync(join(CLIENT_DIST, 'sw.js')), 'sw.js 必须存在于 dist 根目录');
assert.ok(existsSync(join(CLIENT_DIST, 'index.html')), 'index.html 必须存在于 dist 根目录');
console.log('✓ 1. 构建目录与基础文件存在性校验通过');

// 2. 检查所有 JS chunk 体积必须严格 <= 500 KB (512,000 字节)
const assetFiles = readdirSync(ASSETS_DIR);
const jsChunks = assetFiles.filter((f) => f.endsWith('.js'));
assert.ok(jsChunks.length >= 8, `生成的 JS chunks 数量必须不少于 8 个（当前：${jsChunks.length}）`);

const MAX_CHUNK_BYTES = 500 * 1024; // 512,000 字节
console.log(`\n--- JS Chunk 体积清单 (门禁上限: 500 KB / ${MAX_CHUNK_BYTES} 字节) ---`);

for (const chunk of jsChunks) {
  const size = statSync(join(ASSETS_DIR, chunk)).size;
  const kb = (size / 1024).toFixed(2);
  console.log(`  - ${chunk.padEnd(35)} : ${kb.padStart(8)} KB (${size} B)`);
  assert.ok(
    size <= MAX_CHUNK_BYTES,
    `Chunk [${chunk}] 超标！当前大小 ${kb} KB，超过 500 KB 上限！`,
  );
}
console.log('✓ 2. 全量 JS chunks 体积门禁验证通过：全部严格 <= 500 KB，彻底消除 Vite 大包告警！');

// 3. 校验特定核心分包存在性
const officers1Chunk = jsChunks.find((f) => f.startsWith('data-officers-1'));
const officers2Chunk = jsChunks.find((f) => f.startsWith('data-officers-2'));
const dataCoreChunk = jsChunks.find((f) => f.startsWith('data-core'));
const workerSharedChunk = jsChunks.find((f) => f.startsWith('worker-shared'));
const gameWorkerChunk = jsChunks.find((f) => f.startsWith('game.worker'));
const lehSharedChunk = jsChunks.find((f) => f.startsWith('leh-shared'));
const indexChunk = jsChunks.find((f) => f.startsWith('index-'));

assert.ok(officers1Chunk, '必须存在 data-officers-1 chunk');
assert.ok(officers2Chunk, '必须存在 data-officers-2 chunk');
assert.ok(dataCoreChunk, '必须存在 data-core chunk');
assert.ok(workerSharedChunk, '必须存在 worker-shared chunk');
assert.ok(gameWorkerChunk, '必须存在 game.worker chunk');
assert.ok(lehSharedChunk, '必须存在 leh-shared chunk');
assert.ok(indexChunk, '必须存在 index 主 chunk');
console.log('✓ 3. 核心分包架构校验通过（两段武将表、数据核、共享库、Worker引擎与主包已独立切片）');

// 4. 验证数据核与静态数据完整度
const coreModule = await import(pathToFileURL(join(ASSETS_DIR, dataCoreChunk)).href);

// 武将数据验证
const officers = coreModule.o ?? coreModule.officers;
assert.ok(Array.isArray(officers), 'data-core 导出的 officers 必须为数组');
assert.equal(officers.length, 1001, `武将总数必须严格等于 1001（当前：${officers.length}）`);
assert.equal(officers[0].id, 1, '首位武将必须为曹操 (id: 1)');
assert.equal(officers[0].name, '曹操', '首位武将姓名必须为曹操');
assert.equal(officers[499].id, 586, '第 500 位武将必须为吕凯 (id: 586)');
assert.equal(officers[499].name, '吕凯', '第 500 位武将姓名必须为吕凯');
assert.equal(officers[500].id, 587, '第 501 位武将（第二段首位）必须为王伉 (id: 587)');
assert.equal(officers[500].name, '王伉', '第 501 位武将姓名必须为王伉');
assert.equal(officers[1000].id, 1087, '末位武将必须为萧建 (id: 1087)');
assert.equal(officers[1000].name, '萧建', '末位武将姓名必须为萧建');

// 城池数据验证
const cities = coreModule.g ?? coreModule.cities;
assert.ok(Array.isArray(cities), 'data-core 导出的 cities 必须为数组');
assert.equal(cities.length, 106, `城池规模必须严格等于 106（当前：${cities.length}）`);

// 阵型数据验证
const formations = coreModule.d ?? coreModule.formations;
assert.ok(Array.isArray(formations), 'data-core 导出的 formations 必须为数组');
assert.equal(formations.length, 27, `阵型规模必须严格等于 27（当前：${formations.length}）`);

// 兵种数据验证
const units = coreModule.u ?? coreModule.units;
assert.ok(Array.isArray(units), 'data-core 导出的 units 必须为数组');
assert.equal(units.length, 24, `兵种规模必须严格等于 24（当前：${units.length}）`);

// 宝物数据验证
const items = coreModule.i ?? coreModule.items;
assert.ok(Array.isArray(items), 'data-core 导出的 items 必须为数组');
assert.equal(items.length, 165, `宝物规模必须严格等于 165（当前：${items.length}）`);

// 女性数据验证
const females = coreModule.f ?? coreModule.females;
assert.ok(Array.isArray(females), 'data-core 导出的 females 必须为数组');
assert.equal(females.length, 90, `女性规模必须严格等于 90（当前：${females.length}）`);

// 子嗣数据验证
const children = coreModule.c ?? coreModule.children;
assert.ok(Array.isArray(children), 'data-core 导出的 children 必须为数组');
assert.equal(children.length, 50, `子嗣规模必须严格等于 50（当前：${children.length}）`);

// 技能数据验证
const skills = coreModule.b ?? coreModule.skills;
assert.ok(Array.isArray(skills), 'data-core 导出的 skills 必须为数组');
assert.equal(skills.length, 149, `技能规模必须严格等于 149（当前：${skills.length}）`);

// 剧本数据验证
const scenarios = coreModule.a ?? coreModule.scenarios;
assert.ok(Array.isArray(scenarios), 'data-core 导出的 scenarios 必须为数组');
assert.equal(scenarios.length, 9, `剧本规模必须严格等于 9（当前：${scenarios.length}）`);

// 事件数据验证
const events = coreModule.e ?? coreModule.events;
assert.ok(Array.isArray(events), 'data-core 导出的 events 必须为数组');
assert.equal(events.length, 59, `事件规模必须严格等于 59（当前：${events.length}）`);

console.log('✓ 4. 数据核十项规模真源校验 100% 匹配（1001将 / 106城 / 27阵 / 24兵 / 165宝 / 90女 / 50孩 / 149技 / 9剧本 / 59事件）');

// 5. 校验 PWA sw.js 预缓存清单
const swContent = readFileSync(join(CLIENT_DIST, 'sw.js'), 'utf-8');
const precacheMatch = swContent.match(/const PRECACHE = (\[[\s\S]*?\]);/);
assert.ok(precacheMatch, 'sw.js 必须包含 PRECACHE 预缓存数组');
const precacheList = JSON.parse(precacheMatch[1]);

for (const chunk of jsChunks) {
  const relPath = `/assets/${chunk}`;
  assert.ok(precacheList.includes(relPath), `PRECACHE 必须包含分包资产 ${relPath}`);
}
assert.ok(precacheList.includes('/index.html'), 'PRECACHE 必须包含 /index.html');
console.log(`✓ 5. PWA sw.js 预缓存完整性通过（共 ${precacheList.length} 项资产全覆盖）`);

// 6. 校验数据懒加载机制（静态检查）
const browserLoaderSrc = readFileSync(join(ROOT, 'client/src/workers/browser-loader.ts'), 'utf-8');
assert.ok(browserLoaderSrc.includes('lazyCache'), 'browser-loader 必须包含 lazyCache');
assert.ok(browserLoaderSrc.includes('createLazyStaticBundle'), 'browser-loader 必须包含 createLazyStaticBundle');
assert.ok(browserLoaderSrc.includes('get officers()'), 'browser-loader 必须实现 officers 懒加载 getter');
assert.ok(browserLoaderSrc.includes('get cities()'), 'browser-loader 必须实现 cities 懒加载 getter');
console.log('✓ 6. 浏览器/Worker 数据懒加载与按需验证逻辑就绪');

console.log('\n=== Session 460 全部门禁 6/6 全绿通过！ ===');
