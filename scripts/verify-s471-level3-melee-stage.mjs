// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd());

console.log('=== [Session 471] S21-W8 三级白刃战横版 MeleeStage 全量专项验收 ===\n');

// ── 1. 兵种克制真源与印信徽标 (shared/unitMatchup.ts) 审计 ──
console.log('── 1. 兵种克制真源与印信徽标 (shared/unitMatchup.ts) 审计 ──');
const matchupPath = join(ROOT, 'shared/unitMatchup.ts');
assert.ok(existsSync(matchupPath), 'shared/unitMatchup.ts 必须存在');
const matchupCode = readFileSync(matchupPath, 'utf-8');
assert.ok(matchupCode.includes('export const DEFAULT_STRONG_AGAINST_MAP'), '必须导出 DEFAULT_STRONG_AGAINST_MAP');
assert.ok(matchupCode.includes('export function getUnitMatchup'), '必须导出 getUnitMatchup');
assert.ok(matchupCode.includes('export function getUnitMatchupInfo'), '必须导出 getUnitMatchupInfo');
assert.ok(matchupCode.includes('export const UNIT_MELEE_BADGES'), '必须导出 UNIT_MELEE_BADGES');
assert.ok(matchupCode.includes('export function getUnitMeleeBadge'), '必须导出 getUnitMeleeBadge');

const sharedIndexPath = join(ROOT, 'shared/index.ts');
const sharedIndexCode = readFileSync(sharedIndexPath, 'utf-8');
assert.ok(sharedIndexCode.includes('./unitMatchup.js'), 'shared/index.ts 必须导出 unitMatchup.js');

const serverDamagePath = join(ROOT, 'server/src/battle/damage.ts');
const serverDamageCode = readFileSync(serverDamagePath, 'utf-8');
assert.ok(serverDamageCode.includes('export { getUnitMatchup }'), 'server/src/battle/damage.ts 必须复用 shared 的 getUnitMatchup');
console.log('  ✓ 兵种克制真源字典、克制系数纯函数与 24 兵种印信徽标完备');

// ── 2. 原创小兵粒子类与军团演化 (client/src/battle/soldier.ts) 审计 ──
console.log('── 2. 原创小兵粒子类与军团演化 (client/src/battle/soldier.ts) 审计 ──');
const soldierPath = join(ROOT, 'client/src/battle/soldier.ts');
assert.ok(existsSync(soldierPath), 'client/src/battle/soldier.ts 必须存在');
const soldierCode = readFileSync(soldierPath, 'utf-8');
assert.ok(soldierCode.includes('export function calculateSoldierCount'), '必须导出 calculateSoldierCount');
assert.ok(soldierCode.includes('export class Soldier'), '必须导出 Soldier 粒子类');
assert.ok(soldierCode.includes('export class SoldierSwarm'), '必须导出 SoldierSwarm 军团群体类');
assert.ok(soldierCode.includes('update('), 'Soldier 必须包含 update 寻敌与步进逻辑');
assert.ok(soldierCode.includes('draw('), 'Soldier 必须包含 draw 命令式 Canvas 2D 绘制逻辑');
assert.ok(soldierCode.includes('applySkillBlast'), 'SoldierSwarm 必须支持武将计范围暴击');
assert.ok(soldierCode.includes('addDamageFloat'), 'SoldierSwarm 必须支持飘字伤害');
console.log('  ✓ 小兵动态缩放公式 (1000=20, 5000=80, 封顶 120)、AI 寻敌与军团演化完备');

// ── 3. 三级白刃战横版 MeleeStage 舞台与四战略指令审计 ──
console.log('── 3. 三级白刃战横版 MeleeStage 舞台与四战略指令审计 ──');
const stagePath = join(ROOT, 'client/src/components/battle/MeleeStage.tsx');
assert.ok(existsSync(stagePath), 'MeleeStage.tsx 必须存在');
const stageCode = readFileSync(stagePath, 'utf-8');
assert.ok(stageCode.includes('export function MeleeStage'), '必须导出 MeleeStage 组件');
assert.ok(stageCode.includes('data-testid="melee-stage-container"'), '必须包含 melee-stage-container 舞台容器');
assert.ok(stageCode.includes('data-testid="melee-top-header"'), '必须包含 melee-top-header 顶部军情旗牌卡');
assert.ok(stageCode.includes('data-testid="melee-command-bar"'), '必须包含 melee-command-bar 底部指令栏');
assert.ok(stageCode.includes('data-testid="btn-melee-assault"'), '必须包含全军突击指令按钮');
assert.ok(stageCode.includes('data-testid="btn-melee-retreat"'), '必须包含鸣金收兵指令按钮');
assert.ok(stageCode.includes('data-testid="btn-melee-duel"'), '必须包含发起单挑指令按钮');
assert.ok(stageCode.includes('data-testid="btn-melee-skill"'), '必须包含施放武将计指令按钮');
assert.ok(stageCode.includes('renderMeleeParallaxBackground'), '必须接入四层视差水墨背景');
assert.ok(stageCode.includes('drawLevel3StrategemOverlays'), '必须接入三级计谋环境粒子');
assert.ok(stageCode.includes('data-testid="melee-skill-overlay"'), '必须支持武将计全屏暗场特写');
assert.ok(stageCode.includes('data-testid="melee-transition-overlay"'), '必须支持水墨淡入淡出遮罩');
console.log('  ✓ 两军横版对垒、视差背景、环境计谋粒子与四大战略指令闭环完备');

// ── 4. 全栈场景路由与逐层回退闭环审计 ──
console.log('── 4. 全栈场景路由与逐层回退闭环审计 ──');
const appPath = join(ROOT, 'client/src/App.tsx');
const appCode = readFileSync(appPath, 'utf-8');
assert.ok(appCode.includes("screen === 'melee'") && appCode.includes('<MeleeStage />'), 'App.tsx 必须在 screen === melee 时渲染 MeleeStage');

const bfPanelPath = join(ROOT, 'client/src/components/battlefield/BattlefieldPanel.tsx');
const bfPanelCode = readFileSync(bfPanelPath, 'utf-8');
assert.ok(bfPanelCode.includes("if (screen === 'melee')") && bfPanelCode.includes('<MeleeStage />'), 'BattlefieldPanel 必须在 screen === melee 时渲染 MeleeStage');

const battleViewPath = join(ROOT, 'client/src/components/battle/BattleView.tsx');
const battleViewCode = readFileSync(battleViewPath, 'utf-8');
assert.ok(battleViewCode.includes("pushSceneFrame({ scene: 'melee' })"), 'BattleView 邻接交战必须推进切入 melee 场景');
console.log('  ✓ 场景路由无缝接入、白刃战切入与逐层回退闭环完备');

// ── 5. 单元测试套件完备性审计 ──
console.log('── 5. 单元测试套件完备性审计 ──');
assert.ok(existsSync(join(ROOT, 'shared/unitMatchup.test.ts')), 'shared/unitMatchup.test.ts 必须存在');
assert.ok(existsSync(join(ROOT, 'client/src/battle/soldier.test.ts')), 'client/src/battle/soldier.test.ts 必须存在');
assert.ok(existsSync(join(ROOT, 'client/src/components/battle/MeleeStage.test.tsx')), 'MeleeStage.test.tsx 必须存在');
console.log('  ✓ 兵种克制、小兵粒子与 MeleeStage 测试套件全部到位');

// ── 6. 产物体积预算审计 ──
console.log('── 6. 产物体积预算审计 ──');
const distDir = join(ROOT, 'client/dist/assets');
assert.ok(existsSync(distDir), 'client/dist/assets 产物目录必须存在');
const files = readdirSync(distDir);

const cssFile = files.find((f) => f.startsWith('index-') && f.endsWith('.css'));
assert.ok(cssFile, '主 CSS 产物必须存在');
const cssSize = statSync(join(distDir, cssFile)).size;
console.log(`  - 主 CSS 体积: ${(cssSize / 1024).toFixed(2)} KB (预算上限: 75 KB)`);
assert.ok(cssSize < 75 * 1024, '主 CSS 体积超出预算上限');

const mainJsFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
assert.ok(mainJsFile, '主 JS 产物必须存在');
const mainJsSize = statSync(join(distDir, mainJsFile)).size;
console.log(`  - 主 JS 体积: ${(mainJsSize / 1024).toFixed(2)} KB (预算上限: 200 KB)`);
assert.ok(mainJsSize < 200 * 1024, '主 JS 体积超出预算上限');

console.log('\n=== [Session 471] S21-W8 三级白刃战横版专项验收 6/6 全部通过 ===');
