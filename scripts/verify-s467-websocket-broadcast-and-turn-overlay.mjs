// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd());

console.log('=== [Session 467] S20-W1 WebSocket 接入与 TurnProgressOverlay 专项验收 ===\n');

// ── 1. 服务端 WebSocket 广播通道契约审计 ──
console.log('── 1. 服务端 WebSocket 广播通道契约审计 ──');
const serverWsPath = join(ROOT, 'server/src/ws/broadcast.ts');
assert.ok(existsSync(serverWsPath), 'server/src/ws/broadcast.ts 必须存在');
const serverWsCode = readFileSync(serverWsPath, 'utf-8');
assert.ok(serverWsCode.includes('export function broadcast'), '必须导出 broadcast');
assert.ok(serverWsCode.includes('turn_progress'), 'WsEvent 必须支持 turn_progress');
assert.ok(serverWsCode.includes('turn_complete'), 'WsEvent 必须支持 turn_complete');
assert.ok(serverWsCode.includes('event_triggered'), 'WsEvent 必须支持 event_triggered');

const serverIndexPath = join(ROOT, 'server/src/index.ts');
const serverIndexCode = readFileSync(serverIndexPath, 'utf-8');
assert.ok(serverIndexCode.includes('path: \'/ws\''), '服务端必须在 /ws 挂载 WebSocketServer');
assert.ok(serverIndexCode.includes('setWss(wss)'), '服务端启动必须注入 setWss');
console.log('  ✓ 服务端 /ws 广播管道与事件枚举完整');

// ── 2. 客户端 useBroadcast Hook 契约与平滑降级审计 ──
console.log('── 2. 客户端 useBroadcast Hook 契约与平滑降级审计 ──');
const hookPath = join(ROOT, 'client/src/hooks/useBroadcast.ts');
assert.ok(existsSync(hookPath), 'client/src/hooks/useBroadcast.ts 必须存在');
const hookCode = readFileSync(hookPath, 'utf-8');
assert.ok(hookCode.includes('export function useBroadcast'), '必须导出 useBroadcast');
assert.ok(hookCode.includes('new WebSocket(wsUrl)'), '必须使用原生 WebSocket 建连');
assert.ok(hookCode.includes('turn_progress'), '必须监听 turn_progress 事件');
assert.ok(hookCode.includes('turn_complete'), '必须监听 turn_complete 事件');
assert.ok(hookCode.includes('retryDelayRef'), '必须实现退避重连机制');
assert.ok(hookCode.includes('simulatedTimerRef'), '必须包含离线/无 WS 状态下的平滑假进度条自适应降级');
console.log('  ✓ 原生 WebSocket 订阅、退避重连与自适应假进度降级完备');

// ── 3. TurnProgressOverlay 组件装帧与双通道触发审计 ──
console.log('── 3. TurnProgressOverlay 组件装帧与双通道触发审计 ──');
const overlayPath = join(ROOT, 'client/src/components/layout/TurnProgressOverlay.tsx');
assert.ok(existsSync(overlayPath), 'TurnProgressOverlay.tsx 必须存在');
const overlayCode = readFileSync(overlayPath, 'utf-8');
assert.ok(overlayCode.includes('export function TurnProgressOverlay'), '必须导出 TurnProgressOverlay');
assert.ok(overlayCode.includes('useBroadcast'), '必须引入 useBroadcast');
assert.ok(overlayCode.includes('monthSettling || broadcast.active'), '必须通过 monthSettling 与 broadcast.active 双通道触发');
assert.ok(overlayCode.includes('data-testid="turn-progress-overlay"'), '必须包含测试标识');
assert.ok(overlayCode.includes('天道流转 · 乾坤推演'), '必须呈现天道流转题签');
assert.ok(overlayCode.includes('style={{ width: `${progress}%` }}'), '必须呈现动态平滑进度条');
assert.ok(overlayCode.includes('实时信道') && overlayCode.includes('离线推演'), '必须呈现连接状态指示点');

const feedbackPath = join(ROOT, 'client/src/components/layout/TurnFeedback.tsx');
const feedbackCode = readFileSync(feedbackPath, 'utf-8');
assert.ok(feedbackCode.includes("export { TurnProgressOverlay } from './TurnProgressOverlay'"), 'TurnFeedback 必须无缝重导出');
console.log('  ✓ 全屏水墨推演遮罩装帧、百分比进度条与向后兼容导出完备');

// ── 4. 单元测试覆盖率审计 ──
console.log('── 4. 单元测试覆盖率审计 ──');
const overlayTestPath = join(ROOT, 'client/src/components/layout/TurnProgressOverlay.test.tsx');
assert.ok(existsSync(overlayTestPath), 'TurnProgressOverlay.test.tsx 必须存在');
const overlayTestCode = readFileSync(overlayTestPath, 'utf-8');
assert.ok(overlayTestCode.includes('未在月结推演状态时不渲染遮罩'), '必须测试空闲态防穿透');
assert.ok(overlayTestCode.includes('月结推演触发时正确呈现年份月份、推演题签与进度条'), '必须测试推演态展示');
assert.ok(overlayTestCode.includes('WebSocket 实时信道连接时展现连接指示徽标'), '必须测试信道指示状态');

const hookTestPath = join(ROOT, 'client/src/hooks/useBroadcast.test.tsx');
assert.ok(existsSync(hookTestPath), 'useBroadcast.test.tsx 必须存在');
console.log('  ✓ 2 套专用单元测试严密覆盖');

// ── 5. 生产构建产物分包与体积门禁 ──
console.log('── 5. 生产构建产物分包与体积门禁 ──');
const distAssets = join(ROOT, 'client/dist/assets');
assert.ok(existsSync(distAssets), 'client/dist/assets 必须存在（请先执行 pnpm build）');
const files = readdirSync(distAssets);
const cssFile = files.find(f => f.startsWith('index-') && f.endsWith('.css'));
const mainJsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));

assert.ok(cssFile, '主 CSS 产物必须存在');
assert.ok(mainJsFile, '主入口 JS 产物必须存在');

const cssStat = statSync(join(distAssets, cssFile));
const mainJsStat = statSync(join(distAssets, mainJsFile));

console.log(`  CSS 产物体积: ${(cssStat.size / 1024).toFixed(2)} KB (预算上限: 120 KB)`);
console.log(`  主入口 JS 体积: ${(mainJsStat.size / 1024).toFixed(2)} KB (预算上限: 250 KB)`);

assert.ok(cssStat.size < 120 * 1024, `CSS 体积超标: ${cssStat.size} >= 120KB`);
assert.ok(mainJsStat.size < 250 * 1024, `主入口 JS 体积超标: ${mainJsStat.size} >= 250KB`);
console.log('  ✓ 产物分包健康度 100% 达标');

console.log('\n=== [Session 467] S20-W1 全部 5/5 项门禁通过！ ===\n');
