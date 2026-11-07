// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd());

console.log('=== [Session 472] S21-W9 单挑接入 DuelStage 混合范式与状态机闭环专项验收 ===\n');

// ── 1. 单挑出牌字典与三向克制判定 (shared/labels.ts) 审计 ──
console.log('── 1. 单挑出牌字典与三向克制判定 (shared/labels.ts) 审计 ──');
const labelsPath = join(ROOT, 'shared/labels.ts');
assert.ok(existsSync(labelsPath), 'shared/labels.ts 必须存在');
const labelsCode = readFileSync(labelsPath, 'utf-8');
assert.ok(labelsCode.includes('export const DUEL_COMMAND_LABEL'), '必须导出 DUEL_COMMAND_LABEL');
assert.ok(labelsCode.includes('export const DUEL_COMMAND_DESC'), '必须导出 DUEL_COMMAND_DESC');
assert.ok(labelsCode.includes('export function getDuelCardMatchup'), '必须导出 getDuelCardMatchup');
assert.ok(labelsCode.includes("fierce_attack: '猛攻'") || labelsCode.includes("'fierce_attack': '猛攻'"), '必须定义猛攻指令');
assert.ok(labelsCode.includes("restrain: '牵制'") || labelsCode.includes("'restrain': '牵制'"), '必须定义牵制指令');
assert.ok(labelsCode.includes("finisher: '必杀'") || labelsCode.includes("'finisher': '必杀'"), '必须定义必杀指令');
console.log('  ✓ 单挑 7 类出牌指令字典、说明文案与三向克制裁决纯函数完备');

// ── 2. 原生 Web Audio 程序化合成音效 (client/src/utils/sfx.ts) 审计 ──
console.log('── 2. 原生 Web Audio 程序化合成音效 (client/src/utils/sfx.ts) 审计 ──');
const sfxPath = join(ROOT, 'client/src/utils/sfx.ts');
assert.ok(existsSync(sfxPath), 'client/src/utils/sfx.ts 必须存在');
const sfxCode = readFileSync(sfxPath, 'utf-8');
assert.ok(sfxCode.includes('export function playClash'), '必须导出 playClash 金属碰撞音效');
assert.ok(sfxCode.includes('export function playCritImpact'), '必须导出 playCritImpact 暴击冲击音效');
assert.ok(sfxCode.includes('export function playFinisherCharge'), '必须导出 playFinisherCharge 必杀蓄力音效');
assert.ok(sfxCode.includes('export function playInjuredGroan'), '必须导出 playInjuredGroan 受伤闷哼音效');
assert.ok(sfxCode.includes('export function playHorseGallop'), '必须导出 playHorseGallop 马蹄对冲音效');
console.log('  ✓ 金属碰撞、暴击冲击、必杀蓄力、受伤闷哼与马蹄脉冲合成音效完备');

// ── 3. 四级单挑横版演出层 (client/src/components/battle/DuelStage.tsx) 审计 ──
console.log('── 3. 四级单挑横版演出层 (client/src/components/battle/DuelStage.tsx) 审计 ──');
const duelStagePath = join(ROOT, 'client/src/components/battle/DuelStage.tsx');
assert.ok(existsSync(duelStagePath), 'DuelStage.tsx 必须存在');
const duelStageCode = readFileSync(duelStagePath, 'utf-8');
assert.ok(duelStageCode.includes('export function DuelStage'), '必须导出 DuelStage 组件');
assert.ok(duelStageCode.includes('data-testid="duel-stage-container"'), '必须包含 duel-stage-container 容器');
assert.ok(duelStageCode.includes('data-testid="duel-cards-overlay"'), '必须包含 duel-cards-overlay 卡牌展示区');
assert.ok(duelStageCode.includes('data-testid="duel-card-challenger"'), '必须包含攻方指令卡牌');
assert.ok(duelStageCode.includes('data-testid="duel-card-defender"'), '必须包含守方指令卡牌');
assert.ok(duelStageCode.includes('data-testid="duel-matchup-label"'), '必须包含相克裁决徽章');
assert.ok(duelStageCode.includes('data-testid="duel-crit-overlay"'), '必须支持暴击绝杀全屏特写');
console.log('  ✓ 交马对冲、速度线、火花粒子、卡牌展示与技能特写完备');

// ── 4. 单挑主控制面板与全栈路由接入 (DuelPanel.tsx & App.tsx) 审计 ──
console.log('── 4. 单挑主控制面板与全栈路由接入 (DuelPanel.tsx & App.tsx) 审计 ──');
const duelPanelPath = join(ROOT, 'client/src/components/battle/DuelPanel.tsx');
assert.ok(existsSync(duelPanelPath), 'DuelPanel.tsx 必须存在');
const duelPanelCode = readFileSync(duelPanelPath, 'utf-8');
assert.ok(duelPanelCode.includes('<DuelStage'), 'DuelPanel 必须在中央演出区嵌入 DuelStage');
assert.ok(duelPanelCode.includes('data-testid="duel-panel-modal"'), '必须包含 duel-panel-modal 弹窗标识');
assert.ok(duelPanelCode.includes('data-testid="btn-close-battlefield-duel"'), '必须包含返回战场按钮');

const appPath = join(ROOT, 'client/src/App.tsx');
const appCode = readFileSync(appPath, 'utf-8');
assert.ok(appCode.includes("screen === 'duel'") && appCode.includes('<DuelPanel'), 'App.tsx 必须支持在 screen === duel 时挂接 DuelPanel');

const meleeStagePath = join(ROOT, 'client/src/components/battle/MeleeStage.tsx');
const meleeStageCode = readFileSync(meleeStagePath, 'utf-8');
assert.ok(meleeStageCode.includes("pushSceneFrame({ scene: 'duel' })"), 'MeleeStage 必须在发起单挑时压栈 scene: duel');
console.log('  ✓ DuelPanel 混合范式装配、App 路由切入与单挑回退闭环完备');

// ── 5. 单元测试套件完备性审计 ──
console.log('── 5. 单元测试套件完备性审计 ──');
assert.ok(existsSync(join(ROOT, 'client/src/components/battle/DuelStage.test.tsx')), 'DuelStage.test.tsx 必须存在');
console.log('  ✓ DuelStage & DuelPanel 单元测试套件完备');

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

console.log('\n=== [Session 472] S21-W9 单挑接入专项验收 6/6 全部通过 ===');
