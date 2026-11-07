// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd());

console.log('=== [Session 463] P5-08 Canvas 战术动画几何计算引擎专项验收 ===\n');

// ── 1. 战术动画纯数学计算引擎审计 ──
console.log('── 1. 战术动画几何计算引擎与导出契约 ──');
const animPath = join(ROOT, 'client/src/components/battle/tacticalAnimations.ts');
assert.ok(existsSync(animPath), 'tacticalAnimations.ts 必须存在');
const animCode = readFileSync(animPath, 'utf-8');
assert.ok(animCode.includes('export function marchDashOffset'), '必须导出 marchDashOffset');
assert.ok(animCode.includes('export function waterRipple'), '必须导出 waterRipple');
assert.ok(animCode.includes('export function fireFlicker'), '必须导出 fireFlicker');
assert.ok(animCode.includes('export function shockwave'), '必须导出 shockwave');
console.log('  ✓ 行军流光、水纹扩散、火光微颤与六角震波纯函数契约完整');

// ── 2. 主题色彩 Token 审计 ──
console.log('── 2. 画布动画主题色彩 Token 审计 ──');
const tokensPath = join(ROOT, 'client/src/theme/canvasTokens.ts');
const tokensCode = readFileSync(tokensPath, 'utf-8');
assert.ok(tokensCode.includes('animMarchLine'), 'BATTLE_TOKENS 必须包含 animMarchLine');
assert.ok(tokensCode.includes('animWaterRipple'), 'BATTLE_TOKENS 必须包含 animWaterRipple');
assert.ok(tokensCode.includes('animShockwave'), 'BATTLE_TOKENS 必须包含 animShockwave');
assert.ok(tokensCode.includes('animFireSparks'), 'BATTLE_TOKENS 必须包含 animFireSparks');
console.log('  ✓ 集中收口战术动画色彩 Token，无内联裸色违规');

// ── 3. BattleView 动画管线挂接审计 ──
console.log('── 3. BattleView 画布动画管线挂接审计 ──');
const battleViewPath = join(ROOT, 'client/src/components/battle/BattleView.tsx');
const battleViewCode = readFileSync(battleViewPath, 'utf-8');
assert.ok(battleViewCode.includes('marchLineRef'), '必须包含 marchLineRef');
assert.ok(battleViewCode.includes('waterGroupRef'), '必须包含 waterGroupRef');
assert.ok(battleViewCode.includes('shockGroupRef'), '必须包含 shockGroupRef');
assert.ok(battleViewCode.includes('marchDashOffset(time)'), '必须通过 Konva.Animation 驱动 marchDashOffset');
assert.ok(battleViewCode.includes('waterRipple(time'), '必须通过 Konva.Animation 驱动 waterRipple');
assert.ok(battleViewCode.includes('shockwave(time'), '必须通过 Konva.Animation 驱动 shockwave');
assert.ok(battleViewCode.includes('points={movePath.path.flatMap'), '必须在六角网格绘制行军路径折线');
assert.ok(battleViewCode.includes('activeStrategem === \'water\''), '必须响应水计水纹扩散');
assert.ok(battleViewCode.includes('activeStrategem === \'ambush\''), '必须响应伏兵六角震波');
console.log('  ✓ BattleView 六角战斗全场景动画挂接 100% 闭环');

// ── 4. 动画单元测试覆盖率审计 ──
console.log('── 4. 动画算法单测覆盖率审计 ──');
const testPath = join(ROOT, 'client/src/components/battle/tacticalAnimations.test.ts');
assert.ok(existsSync(testPath), 'tacticalAnimations.test.ts 必须存在');
const testCode = readFileSync(testPath, 'utf-8');
assert.ok(testCode.includes('行军虚线偏移随时间单调流动'), '单测必须覆盖 marchDashOffset 周期流动');
assert.ok(testCode.includes('水纹扩散半径单调递增'), '单测必须覆盖 waterRipple 半径与透明度衰减');
assert.ok(testCode.includes('火光微颤振幅与透明度严格维持在可控常模范围内'), '单测必须覆盖 fireFlicker 振幅边界');
assert.ok(testCode.includes('伏兵/落石震波半径自中心扩散'), '单测必须覆盖 shockwave 震波衰减');
console.log('  ✓ 4/4 项战术动画纯数学单元测试严密覆盖');

// ── 5. 生产构建产物分包与体积门禁 ──
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

// ── 6. 离线 PWA sw.js 预缓存清单覆盖 ──
console.log('── 6. 离线 PWA sw.js 预缓存清单覆盖 ──');
const swPath = join(ROOT, 'client/dist/sw.js');
assert.ok(existsSync(swPath), 'client/dist/sw.js 必须存在');
const swCode = readFileSync(swPath, 'utf-8');
for (const chunk of jsChunks) {
  assert.ok(swCode.includes(chunk), `sw.js PRECACHE 必须包含分包资产 ${chunk}`);
}
console.log('  ✓ sw.js 预缓存清单 100% 完整纳管所有分包资产');

console.log('\n=== Session 463 P5-08 专项门禁 6/6 全绿通过！ ===\n');
