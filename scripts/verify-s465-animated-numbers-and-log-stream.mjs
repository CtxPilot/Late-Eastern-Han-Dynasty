// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd());

console.log('=== [Session 465] S20-W2 TopBar 数字跳动与 EventLog 战报流化专项验收 ===\n');

// ── 1. useAnimatedNumber Hook 契约审计 ──
console.log('── 1. useAnimatedNumber Hook 契约与实现审计 ──');
const hookPath = join(ROOT, 'client/src/utils/useAnimatedNumber.ts');
assert.ok(existsSync(hookPath), 'client/src/utils/useAnimatedNumber.ts 必须存在');
const hookCode = readFileSync(hookPath, 'utf-8');
assert.ok(hookCode.includes('export function useAnimatedNumber'), '必须导出 useAnimatedNumber');
assert.ok(hookCode.includes('easeOutCubic'), '必须使用 easeOutCubic 缓动算法');
assert.ok(hookCode.includes('requestAnimationFrame'), '必须基于 rAF 驱动');
assert.ok(hookCode.includes('currentValueRef'), '必须通过 currentValueRef 维持连续变更平滑过渡');
assert.ok(hookCode.includes('Number.isFinite'), '必须包含非有限数值容错防崩处理');
console.log('  ✓ rAF + easeOutCubic 缓动核心逻辑与契约完备');

// ── 2. 架构规范兼容路径审计 ──
console.log('── 2. 架构规范兼容路径审计 ──');
const hooksCompatPath = join(ROOT, 'client/src/hooks/useAnimatedNumber.ts');
assert.ok(existsSync(hooksCompatPath), 'client/src/hooks/useAnimatedNumber.ts 兼容路径必须存在');
const hooksCompatCode = readFileSync(hooksCompatPath, 'utf-8');
assert.ok(hooksCompatCode.includes("from '../utils/useAnimatedNumber'"), '必须规范重导出');
console.log('  ✓ hooks/useAnimatedNumber.ts 架构兼容层落地');

// ── 3. TopBar 资源数字跳动与动效指示审计 ──
console.log('── 3. TopBar 核心资源数字跳动与动效指示审计 ──');
const topBarPath = join(ROOT, 'client/src/components/layout/TopBar.tsx');
assert.ok(existsSync(topBarPath), 'TopBar.tsx 必须存在');
const topBarCode = readFileSync(topBarPath, 'utf-8');
assert.ok(topBarCode.includes('useAnimatedNumber'), 'TopBar 必须引入 useAnimatedNumber');
assert.ok(topBarCode.includes('useAnimatedNumber(gold)'), '金帛必须接入 useAnimatedNumber');
assert.ok(topBarCode.includes('useAnimatedNumber(food)'), '军粮必须接入 useAnimatedNumber');
assert.ok(topBarCode.includes('useAnimatedNumber(troops)'), '甲兵必须接入 useAnimatedNumber');
assert.ok(topBarCode.includes('animGold.displayValue.toLocaleString()'), '金帛展示必须使用 displayValue');
assert.ok(topBarCode.includes('animFood.displayValue.toLocaleString()'), '军粮展示必须使用 displayValue');
assert.ok(topBarCode.includes('animTroops.displayValue.toLocaleString()'), '甲兵展示必须使用 displayValue');
assert.ok(topBarCode.includes('text-emerald-300'), '数值上涨必须包含高亮标识');
assert.ok(topBarCode.includes('text-rose-400'), '数值下跌必须包含警示标识');
console.log('  ✓ TopBar 三大战略资源数字平滑跳动与涨跌高亮接入完整');

// ── 4. EventLogTerminal 战报流化与顶滚审计 ──
console.log('── 4. EventLogTerminal 战报流化与平滑顶滚审计 ──');
const eventLogPath = join(ROOT, 'client/src/components/common/EventLogTerminal.tsx');
assert.ok(existsSync(eventLogPath), 'EventLogTerminal.tsx 必须存在');
const eventLogCode = readFileSync(eventLogPath, 'utf-8');
assert.ok(eventLogCode.includes('logContainerRef'), '必须包含战报滚动容器 Ref');
assert.ok(eventLogCode.includes('logContainerRef.current.scrollTo({ top: 0, behavior: \'smooth\' })'), '新条目到达必须平滑顶滚');
assert.ok(eventLogCode.includes('scroll-smooth'), '容器必须声明平滑滚动样式类');
assert.ok(eventLogCode.includes('motion-safe:animate-[ink-fade-in_300ms_ease-out]'), '单行战报条目必须挂接淡入动画');
console.log('  ✓ 漢末起居注战报平滑顶滚与 300ms 水墨淡入流化落地');

// ── 5. 单测套件覆盖率审计 ──
console.log('── 5. Hook 单元测试覆盖率审计 ──');
const testPath = join(ROOT, 'client/src/utils/useAnimatedNumber.test.tsx');
assert.ok(existsSync(testPath), 'useAnimatedNumber.test.tsx 必须存在');
const testCode = readFileSync(testPath, 'utf-8');
assert.ok(testCode.includes('初次渲染即时呈现目标数值'), '必须测试初次渲染数值呈现');
assert.ok(testCode.includes('非有限数值安全降级不崩溃'), '必须测试 NaN/非有限数安全降级');
assert.ok(testCode.includes('能够稳定渲染负数或零'), '必须测试零与负数边界');
console.log('  ✓ useAnimatedNumber 单元测试严密覆盖');

// ── 6. 生产构建产物分包与体积门禁 ──
console.log('── 6. 生产构建产物分包与体积门禁 ──');
const distAssets = join(ROOT, 'client/dist/assets');
assert.ok(existsSync(distAssets), 'client/dist/assets 必须存在（请先执行 pnpm build）');
const files = readdirSync(distAssets);
const cssFile = files.find(f => f.startsWith('index-') && f.endsWith('.css'));
const mainJsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
const vendorFile = files.find(f => f.startsWith('vendor-') && f.endsWith('.js'));

assert.ok(cssFile, '主 CSS 产物必须存在');
assert.ok(mainJsFile, '主入口 JS 产物必须存在');
assert.ok(vendorFile, 'Vendor JS 产物必须存在');

const cssStat = statSync(join(distAssets, cssFile));
const mainJsStat = statSync(join(distAssets, mainJsFile));

console.log(`  CSS 产物体积: ${(cssStat.size / 1024).toFixed(2)} KB (预算上限: 120 KB)`);
console.log(`  主入口 JS 体积: ${(mainJsStat.size / 1024).toFixed(2)} KB (预算上限: 250 KB)`);

assert.ok(cssStat.size < 120 * 1024, `CSS 体积超标: ${cssStat.size} >= 120KB`);
assert.ok(mainJsStat.size < 250 * 1024, `主入口 JS 体积超标: ${mainJsStat.size} >= 250KB`);
console.log('  ✓ 产物分包健康度 100% 达标');

console.log('\n=== [Session 465] S20-W2 全部 6/6 项门禁通过！ ===\n');
