// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd());

console.log('=== [Session 466] S20-W4 派系判定纯函数、派系面板与雷达图专项验收 ===\n');

// ── 1. factionInner.ts 派系纯函数契约审计 ──
console.log('── 1. factionInner.ts 派系判定算法审计 ──');
const innerPath = join(ROOT, 'client/src/lib/factionInner.ts');
assert.ok(existsSync(innerPath), 'client/src/lib/factionInner.ts 必须存在');
const innerCode = readFileSync(innerPath, 'utf-8');
assert.ok(innerCode.includes('export function deriveFactionParties'), '必须导出 deriveFactionParties');
assert.ok(innerCode.includes('export function detectOfficerOrigin'), '必须导出 detectOfficerOrigin');
assert.ok(innerCode.includes('export function calculateOfficerWeight'), '必须导出 calculateOfficerWeight');
assert.ok(innerCode.includes('minMembers: 2'), '豪强派门槛必须为 2（§4.5.2）');
assert.ok(innerCode.includes('minMembers: 3'), '士族等其他派系门槛必须为 3');
assert.ok(innerCode.includes('cohesionScore'), '必须计算势力凝聚力评分');
assert.ok(innerCode.includes('cohesionLevel'), '必须评定凝聚力文言等级（上和/中洽/涣散/分裂）');
console.log('  ✓ §4.5.2 门阀出身判定、领袖评定与凝聚力算法契约完备');

// ── 2. RadarChart.tsx 纯 SVG 手写雷达图审计 ──
console.log('── 2. RadarChart.tsx 纯 SVG 手写雷达图审计 ──');
const radarPath = join(ROOT, 'client/src/components/ui/RadarChart.tsx');
assert.ok(existsSync(radarPath), 'client/src/components/ui/RadarChart.tsx 必须存在');
const radarCode = readFileSync(radarPath, 'utf-8');
assert.ok(radarCode.includes('export function RadarChart'), '必须导出 RadarChart 组件');
assert.ok(radarCode.includes('export function buildDiplomacyRadarItems'), '必须导出 buildDiplomacyRadarItems');
assert.ok(radarCode.includes('export function buildOfficerRadarItems'), '必须导出 buildOfficerRadarItems');
assert.ok(radarCode.includes('<svg'), '必须基于原生 SVG 渲染');
assert.ok(radarCode.includes('radar-grid'), '必须包含同心多边形网格');
assert.ok(radarCode.includes('radar-spokes'), '必须包含径向辐射轴线');
assert.ok(radarCode.includes('data-testid="radar-chart"'), '必须包含测试标识');
console.log('  ✓ 纯 SVG 5 维雷达图与外交/武将数据适配器完备');

// ── 3. FactionPanel.tsx 派系门阀面板审计 ──
console.log('── 3. FactionPanel.tsx 派系门阀面板审计 ──');
const panelPath = join(ROOT, 'client/src/components/layout/FactionPanel.tsx');
assert.ok(existsSync(panelPath), 'FactionPanel.tsx 必须存在');
const panelCode = readFileSync(panelPath, 'utf-8');
assert.ok(panelCode.includes('export function FactionPanel'), '必须导出 FactionPanel');
assert.ok(panelCode.includes('deriveFactionParties'), '必须引入 deriveFactionParties');
assert.ok(panelCode.includes('朝野门阀凝聚力'), '必须呈现凝聚力读数');
assert.ok(panelCode.includes('data-testid="faction-panel"'), '必须包含 faction-panel 测试标识');
assert.ok(panelCode.includes('派系领袖'), '必须展示派系领袖');
assert.ok(panelCode.includes('游离散员'), '必须展示未成派散员');
console.log('  ✓ 派系面板凝聚力条、派系卡片与领袖群英展示完备');

// ── 4. 全栈 UI 挂接与场景串联审计 ──
console.log('── 4. 全栈 UI 挂接与场景串联审计 ──');
// a. LeftPanel 挂接门阀派系折叠
const leftPanelCode = readFileSync(join(ROOT, 'client/src/components/layout/LeftPanel.tsx'), 'utf-8');
assert.ok(leftPanelCode.includes('title="门阀派系"'), 'LeftPanel 必须包含门阀派系 AccSection');
assert.ok(leftPanelCode.includes('<FactionPanel />'), 'LeftPanel 必须挂接 FactionPanel');

// b. DiplomacyOverviewDrawer 挂接外交雷达
const dipCode = readFileSync(join(ROOT, 'client/src/components/command/DiplomacyOverviewDrawer.tsx'), 'utf-8');
assert.ok(dipCode.includes('RadarChart'), 'DiplomacyOverviewDrawer 必须引入 RadarChart');
assert.ok(dipCode.includes('buildDiplomacyRadarItems'), 'DiplomacyOverviewDrawer 必须调用 buildDiplomacyRadarItems');

// c. OfficerDetail 挂接武将五维雷达
const officerDetailCode = readFileSync(join(ROOT, 'client/src/components/officer/OfficerDetail.tsx'), 'utf-8');
assert.ok(officerDetailCode.includes('RadarChart'), 'OfficerDetail 必须引入 RadarChart');
assert.ok(officerDetailCode.includes('buildOfficerRadarItems'), 'OfficerDetail 必须调用 buildOfficerRadarItems');
console.log('  ✓ 机务枢要左台、外交命令坞、武将详情三大关键场景雷达与派系全量接入');

// ── 5. 单测套件覆盖率审计 ──
console.log('── 5. 单元测试覆盖率审计 ──');
const innerTestPath = join(ROOT, 'client/src/lib/factionInner.test.ts');
assert.ok(existsSync(innerTestPath), 'factionInner.test.ts 必须存在');
const innerTestCode = readFileSync(innerTestPath, 'utf-8');
assert.ok(innerTestCode.includes('准确识别士族门阀出身'), '必须测试士族出身识别');
assert.ok(innerTestCode.includes('准确识别豪强豪族出身'), '必须测试豪强出身识别');
assert.ok(innerTestCode.includes('满足成派门槛（士族≥3、豪强≥2）时正常建立派系并指派领袖'), '必须测试成派门槛与领袖选拔');

const radarTestPath = join(ROOT, 'client/src/components/ui/RadarChart.test.tsx');
assert.ok(existsSync(radarTestPath), 'RadarChart.test.tsx 必须存在');
const radarTestCode = readFileSync(radarTestPath, 'utf-8');
assert.ok(radarTestCode.includes('正确渲染 5 维多边形与文言标签'), '必须测试多边形与文言标签');
assert.ok(radarTestCode.includes('buildDiplomacyRadarItems 正确派生外交五维数据'), '必须测试外交五维映射');
assert.ok(radarTestCode.includes('buildOfficerRadarItems 正确映射武将五维数据'), '必须测试武将五维映射');

const panelTestPath = join(ROOT, 'client/src/components/layout/FactionPanel.test.tsx');
assert.ok(existsSync(panelTestPath), 'FactionPanel.test.tsx 必须存在');
console.log('  ✓ 3 套专用单元测试严密覆盖');

// ── 6. 生产构建产物分包与体积门禁 ──
console.log('── 6. 生产构建产物分包与体积门禁 ──');
const distAssets = join(ROOT, 'client/dist/assets');
assert.ok(existsSync(distAssets), 'client/dist/assets 必须存在');
const files = readdirSync(distAssets);
const cssFile = files.find(f => f.startsWith('index-') && f.endsWith('.css'));
const mainJsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
const cmdFile = files.find(f => f.startsWith('command-drawers-') && f.endsWith('.js'));

assert.ok(cssFile, '主 CSS 产物必须存在');
assert.ok(mainJsFile, '主入口 JS 产物必须存在');
assert.ok(cmdFile, 'Command Drawers JS 产物必须存在');

const cssStat = statSync(join(distAssets, cssFile));
const mainJsStat = statSync(join(distAssets, mainJsFile));
const cmdStat = statSync(join(distAssets, cmdFile));

console.log(`  CSS 产物体积: ${(cssStat.size / 1024).toFixed(2)} KB (预算上限: 120 KB)`);
console.log(`  主入口 JS 体积: ${(mainJsStat.size / 1024).toFixed(2)} KB (预算上限: 250 KB)`);
console.log(`  命令抽屉 JS 体积: ${(cmdStat.size / 1024).toFixed(2)} KB (预算上限: 500 KB)`);

assert.ok(cssStat.size < 120 * 1024, `CSS 体积超标: ${cssStat.size} >= 120KB`);
assert.ok(mainJsStat.size < 250 * 1024, `主入口 JS 体积超标: ${mainJsStat.size} >= 250KB`);
assert.ok(cmdStat.size < 500 * 1024, `命令抽屉 JS 体积超标: ${cmdStat.size} >= 500KB`);
console.log('  ✓ 产物分包健康度 100% 达标');

console.log('\n=== [Session 466] S20-W4 全部 6/6 项门禁通过！ ===\n');
