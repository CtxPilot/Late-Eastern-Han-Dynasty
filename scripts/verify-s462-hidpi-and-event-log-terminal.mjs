// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd());

console.log('=== [Session 462] P5-07a HiDPI/Wayland 缩放适配 与 P5-07c 伪 Terminal 文言战报专项验收 ===\n');

// ── 1. HiDPI 工具链存在性与导出契约 ──
console.log('── 1. HiDPI/Wayland 工具链架构审计 ──');
const hidpiPath = join(ROOT, 'client/src/utils/hidpi.ts');
assert.ok(existsSync(hidpiPath), 'client/src/utils/hidpi.ts 必须存在');
const hidpiCode = readFileSync(hidpiPath, 'utf-8');
assert.ok(hidpiCode.includes('export function getEffectiveDpr'), '必须导出 getEffectiveDpr');
assert.ok(hidpiCode.includes('export function observePixelRatio'), '必须导出 observePixelRatio');
assert.ok(hidpiCode.includes('export function setupHiDPIStage'), '必须导出 setupHiDPIStage');
assert.ok(hidpiCode.includes('export function getLayerCacheOptions'), '必须导出 getLayerCacheOptions');
console.log('  ✓ HiDPI/Wayland 缩放适配工具链导出契约完整');

// ── 2. 文言战报解析器与分类印章引擎 ──
console.log('── 2. 伪 Terminal 文言战报解析引擎审计 ──');
const parserPath = join(ROOT, 'client/src/components/common/eventLogParser.ts');
assert.ok(existsSync(parserPath), 'eventLogParser.ts 必须存在');
const parserCode = readFileSync(parserPath, 'utf-8');
assert.ok(parserCode.includes('[ 旬始 ]'), '必须包含 [ 旬始 ] 标签');
assert.ok(parserCode.includes('[ 内政 ]'), '必须包含 [ 内政 ] 标签');
assert.ok(parserCode.includes('[ 军机 ]'), '必须包含 [ 军机 ] 标签');
assert.ok(parserCode.includes('[ 谍变 ]'), '必须包含 [ 谍变 ] 标签');
assert.ok(parserCode.includes('[ 大典 ]'), '必须包含 [ 大典 ] 标签');
assert.ok(parserCode.includes('[ 人伦 ]'), '必须包含 [ 人伦 ] 标签');
assert.ok(parserCode.includes('[ 天时 ]'), '必须包含 [ 天时 ] 标签');
assert.ok(parserCode.includes('char: \'丰\''), '必须包含 [ 丰 ] 状态印章');
assert.ok(parserCode.includes('char: \'警\''), '必须包含 [ 警 ] 状态印章');
assert.ok(parserCode.includes('char: \'凶\''), '必须包含 [ 凶 ] 状态印章');
assert.ok(parserCode.includes('char: \'喜\''), '必须包含 [ 喜 ] 状态印章');
assert.ok(parserCode.includes('char: \'谋\''), '必须包含 [ 谋 ] 状态印章');
assert.ok(parserCode.includes('char: \'战\''), '必须包含 [ 战 ] 状态印章');
console.log('  ✓ 文言分类前缀标签与七色状态印章引擎完备');

// ── 3. Terminal 组件装帧与交互审计 ──
console.log('── 3. EventLogTerminal 组件装帧审计 ──');
const terminalPath = join(ROOT, 'client/src/components/common/EventLogTerminal.tsx');
assert.ok(existsSync(terminalPath), 'EventLogTerminal.tsx 必须存在');
const terminalCode = readFileSync(terminalPath, 'utf-8');
assert.ok(terminalCode.includes('漢末起居注'), '必须包含古籍起居注题名');
assert.ok(terminalCode.includes('/tty-annal'), '必须包含伪终端标识 /tty-annal');
assert.ok(terminalCode.includes('bg-rose-600/90'), '必须包含朱砂红指示灯');
assert.ok(terminalCode.includes('bg-amber-500/90'), '必须包含玄墨/黄指示灯');
assert.ok(terminalCode.includes('bg-emerald-500/90'), '必须包含苍碧/绿指示灯');
assert.ok(terminalCode.includes('展卷'), '必须支持展卷大窗模态');
console.log('  ✓ Linux 终端三灯隐喻、古籍起居注文风与展卷模态层就绪');

// ── 4. 全栈 UI 节点挂接审计 ──
console.log('── 4. 界面挂接与消费闭环审计 ──');
const rightPanelCode = readFileSync(join(ROOT, 'client/src/components/layout/RightPanel.tsx'), 'utf-8');
assert.ok(rightPanelCode.includes('EventLogTerminal'), 'RightPanel 必须挂接 EventLogTerminal');

const turnFeedbackCode = readFileSync(join(ROOT, 'client/src/components/layout/TurnFeedback.tsx'), 'utf-8');
assert.ok(turnFeedbackCode.includes('formatActionLogEntry'), 'TurnFeedback 必须挂接 formatActionLogEntry');

const battleViewCode = readFileSync(join(ROOT, 'client/src/components/battle/BattleView.tsx'), 'utf-8');
assert.ok(battleViewCode.includes('setupHiDPIStage'), 'BattleView 必须调用 setupHiDPIStage');
assert.ok(battleViewCode.includes('observePixelRatio'), 'BattleView 必须监听 observePixelRatio');

const mapCanvasCode = readFileSync(join(ROOT, 'client/src/components/map/legacy/MapCanvas.tsx'), 'utf-8');
assert.ok(mapCanvasCode.includes('setupHiDPIStage'), 'MapCanvas 必须调用 setupHiDPIStage');
assert.ok(mapCanvasCode.includes('observePixelRatio'), 'MapCanvas 必须监听 observePixelRatio');
console.log('  ✓ RightPanel、TurnFeedback、BattleView 与 MapCanvas 100% 挂接闭环');

// ── 5. 构建分包与 Chunk 体积安全门禁 ──
console.log('── 5. 生产构建产物分包与体积门禁 ──');
const distAssetsDir = join(ROOT, 'client/dist/assets');
assert.ok(existsSync(distAssetsDir), 'client/dist/assets 目录必须存在');
const assetFiles = readdirSync(distAssetsDir);
const jsChunks = assetFiles.filter((f) => f.endsWith('.js'));
assert.ok(jsChunks.length >= 8, `JS 分包数量必须 >= 8，实际 ${jsChunks.length}`);

const CHUNK_LIMIT_BYTES = 500 * 1024;
for (const chunk of jsChunks) {
  const stat = statSync(join(distAssetsDir, chunk));
  assert.ok(
    stat.size <= CHUNK_LIMIT_BYTES,
    `Chunk ${chunk} 体积 (${(stat.size / 1024).toFixed(2)} KB) 超过 500 KB 门禁！`,
  );
}
console.log(`  ✓ 全部 ${jsChunks.length} 个生产 JS 分包体积严格受控于 500 KB 门禁以内，零大包警告`);

// ── 6. 离线 PWA 预缓存完整性 ──
console.log('── 6. 离线 PWA sw.js 预缓存清单覆盖 ──');
const swPath = join(ROOT, 'client/dist/sw.js');
assert.ok(existsSync(swPath), 'client/dist/sw.js 必须存在');
const swCode = readFileSync(swPath, 'utf-8');
for (const chunk of jsChunks) {
  assert.ok(swCode.includes(chunk), `sw.js PRECACHE 必须包含分包资产 ${chunk}`);
}
console.log('  ✓ sw.js 预缓存清单 100% 完整纳管所有分包资产');

console.log('\n=== Session 462 P5-07a/c 专项门禁 6/6 全绿通过！ ===\n');
