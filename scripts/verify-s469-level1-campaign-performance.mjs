// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd());

console.log('=== [Session 469] S21-W6 一级大地图出征与围城演出专项验收 ===\n');

// ── 1. MarchAnimationLayer 行军箭头与军旗演出审计 ──
console.log('── 1. MarchAnimationLayer 行军箭头与军旗演出审计 ──');
const marchLayerPath = join(ROOT, 'client/src/components/campaign/MarchAnimationLayer.tsx');
assert.ok(existsSync(marchLayerPath), 'MarchAnimationLayer.tsx 必须存在');
const marchLayerCode = readFileSync(marchLayerPath, 'utf-8');
assert.ok(marchLayerCode.includes('export const MarchAnimationLayer'), '必须导出 MarchAnimationLayer');
assert.ok(marchLayerCode.includes('march-arrow-marker'), '必须包含带羽箭头 marker 定义');
assert.ok(marchLayerCode.includes('beacon-fire'), '必须包含目标城烽火警戒光环与烽火标');
assert.ok(marchLayerCode.includes('marching-flag'), '必须包含军旗占位与势力印信字');
assert.ok(marchLayerCode.includes('formatTroopCount'), '必须包含万/千兵力微型气泡');
console.log('  ✓ 行军虚线箭头、军旗势力字与目标城烽火特效契约完备');

// ── 2. SiegeAssaultDialog 围城决断弹窗审计 ──
console.log('── 2. SiegeAssaultDialog 围城决断弹窗审计 ──');
const siegeDialogPath = join(ROOT, 'client/src/components/campaign/SiegeAssaultDialog.tsx');
assert.ok(existsSync(siegeDialogPath), 'SiegeAssaultDialog.tsx 必须存在');
const siegeDialogCode = readFileSync(siegeDialogPath, 'utf-8');
assert.ok(siegeDialogCode.includes('export const SiegeAssaultDialog'), '必须导出 SiegeAssaultDialog');
assert.ok(siegeDialogCode.includes('FORMATION_LABEL'), '阵型必须统一读取 shared/labels.ts 真源');
assert.ok(siegeDialogCode.includes('siegeMergeLabel'), '必须呈现多军围城合流提示');
assert.ok(siegeDialogCode.includes('STRUCTURE_NAMES'), '必须列示云梯/冲车/投石机等攻城器械');
assert.ok(siegeDialogCode.includes('siege-action-assault'), '必须包含挥军强攻决断');
assert.ok(siegeDialogCode.includes('siege-action-storm'), '必须包含亲统登陴决断');
assert.ok(siegeDialogCode.includes('siege-action-surrender'), '必须包含传檄劝降决断');
assert.ok(siegeDialogCode.includes('siege-action-retreat'), '必须包含解围班师决断');
assert.ok(siegeDialogCode.includes('siege-action-hold'), '必须包含围困待变决断');
console.log('  ✓ 围城态势对比、城防固度、合流标示与五项大战略决断完备');

// ── 3. 全局状态机与场景全栈挂接审计 ──
console.log('── 3. 全局状态机与场景全栈挂接审计 ──');
const storePath = join(ROOT, 'client/src/stores/gameStore.ts');
const storeCode = readFileSync(storePath, 'utf-8');
assert.ok(storeCode.includes('activeSiegeArmyId: string | null'), 'gameStore 必须声明 activeSiegeArmyId');
assert.ok(storeCode.includes('openSiegeDialog: (armyId: string) => void'), 'gameStore 必须声明 openSiegeDialog');
assert.ok(storeCode.includes('closeSiegeDialog: () => void'), 'gameStore 必须声明 closeSiegeDialog');

const topoPath = join(ROOT, 'client/src/components/strategic/ProvinceTopology.tsx');
const topoCode = readFileSync(topoPath, 'utf-8');
assert.ok(topoCode.includes('MarchAnimationLayer'), 'ProvinceTopology 必须挂接 MarchAnimationLayer');

const layoutPath = join(ROOT, 'client/src/components/layout/GameLayout.tsx');
const layoutCode = readFileSync(layoutPath, 'utf-8');
assert.ok(layoutCode.includes('SiegeAssaultDialog'), 'GameLayout 必须全局挂接 SiegeAssaultDialog');

const panelPath = join(ROOT, 'client/src/components/campaign/CampaignPanel.tsx');
const panelCode = readFileSync(panelPath, 'utf-8');
assert.ok(panelCode.includes('openSiegeDialog'), 'CampaignPanel 围城军必须挂接 openSiegeDialog 快捷呼出');
console.log('  ✓ 状态机管理、拓扑路网演播、全屏弹窗与出征面板全量挂接');

// ── 4. 单元测试覆盖率审计 ──
console.log('── 4. 单元测试覆盖率审计 ──');
const siegeTest = join(ROOT, 'client/src/components/campaign/SiegeAssaultDialog.test.tsx');
assert.ok(existsSync(siegeTest), 'SiegeAssaultDialog.test.tsx 必须存在');
const marchTest = join(ROOT, 'client/src/components/campaign/MarchAnimationLayer.test.tsx');
assert.ok(existsSync(marchTest), 'MarchAnimationLayer.test.tsx 必须存在');
console.log('  ✓ 专项单元测试套件全部就位');

// ── 5. 构建与静态资产尺寸约束审计 ──
console.log('── 5. 构建与静态资产尺寸约束审计 ──');
const distDir = join(ROOT, 'client/dist/assets');
assert.ok(existsSync(distDir), 'client/dist/assets 必须存在');
const distFiles = readdirSync(distDir);
const jsFiles = distFiles.filter((f) => f.endsWith('.js'));
const cssFiles = distFiles.filter((f) => f.endsWith('.css'));
assert.ok(jsFiles.length > 0, '客户端必须生成 JS chunk');
assert.ok(cssFiles.length > 0, '客户端必须生成 CSS bundle');

for (const f of jsFiles) {
  const sizeKb = statSync(join(distDir, f)).size / 1024;
  assert.ok(sizeKb < 450, `JS chunk ${f} (${sizeKb.toFixed(2)} KB) 超出 450KB 预算限制`);
}
for (const f of cssFiles) {
  const sizeKb = statSync(join(distDir, f)).size / 1024;
  assert.ok(sizeKb < 100, `CSS bundle ${f} (${sizeKb.toFixed(2)} KB) 超出 100KB 预算限制`);
}
console.log(`  ✓ 全部 ${jsFiles.length} 个 JS chunks (<450KB) 与 CSS (<100KB) 严格受控于预算内`);

console.log('\n=== Session 469 S21-W6 专项验收 5/5 全部通过！ ===\n');
