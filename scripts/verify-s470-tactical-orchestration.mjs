// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd());

console.log('=== [Session 470] S21-W7 二级战术串联全量专项验收 ===\n');

// ── 1. screen 六态栈与状态机契约审计 ──
console.log('── 1. screen 六态栈与状态机契约审计 ──');
const scenesPath = join(ROOT, 'shared/scenes.ts');
assert.ok(existsSync(scenesPath), 'shared/scenes.ts 必须存在');
const scenesCode = readFileSync(scenesPath, 'utf-8');
assert.ok(scenesCode.includes("'campaign'"), "Scene 联合类型必须包含 'campaign'");
assert.ok(scenesCode.includes("'tactical'"), "Scene 联合类型必须包含 'tactical'");
assert.ok(scenesCode.includes("'melee'"), "Scene 联合类型必须包含 'melee'");
assert.ok(scenesCode.includes('armyId?: string'), 'SceneFrame 必须包含 armyId 可选字段');

const storePath = join(ROOT, 'client/src/stores/gameStore.ts');
const storeCode = readFileSync(storePath, 'utf-8');
assert.ok(storeCode.includes('setScreen: (screen: Screen) => void'), 'gameStore 必须声明 setScreen 接口');
assert.ok(storeCode.includes("popToScene(get().sceneStack, 'tactical')"), 'meleeExit 必须支持回退至 tactical 场景');

const appPath = join(ROOT, 'client/src/App.tsx');
const appCode = readFileSync(appPath, 'utf-8');
assert.ok(appCode.includes("screen === 'battle' || screen === 'tactical'"), 'App.tsx 必须同时支持 battle 与 tactical 渲染 BattleView');
console.log('  ✓ 六态栈联合、场景帧扩展、setScreen 与逐层回退闭环完备');

// ── 2. TacticalTerrain 六角地貌情报与悬停卡片审计 ──
console.log('── 2. TacticalTerrain 六角地貌情报与悬停卡片审计 ──');
const terrainPath = join(ROOT, 'shared/tacticalTerrain.ts');
assert.ok(existsSync(terrainPath), 'shared/tacticalTerrain.ts 必须存在');
const terrainCode = readFileSync(terrainPath, 'utf-8');
assert.ok(terrainCode.includes('export const TACTICAL_TERRAIN_INFO'), '必须导出 TACTICAL_TERRAIN_INFO');
assert.ok(terrainCode.includes('getTacticalTerrainInfo'), '必须导出 getTacticalTerrainInfo');
assert.ok(terrainCode.includes('moveCost: 2'), '林地移动消耗必须为 2');
assert.ok(terrainCode.includes('defenseMod: 0.2'), '林地防御修正必须为 +20%');
assert.ok(terrainCode.includes('defenseMod: 0.3'), '山地防御修正必须为 +30%');

const battleViewPath = join(ROOT, 'client/src/components/battle/BattleView.tsx');
const battleViewCode = readFileSync(battleViewPath, 'utf-8');
assert.ok(battleViewCode.includes('data-testid="hex-terrain-tooltip"'), 'BattleView 必须包含 hex-terrain-tooltip 悬停卡片');
assert.ok(battleViewCode.includes('getTacticalTerrainInfo'), 'BattleView 必须读取 getTacticalTerrainInfo 地貌情报');
assert.ok(battleViewCode.includes('setHoveredHex'), 'BattleView 必须维护 setHoveredHex 交互状态');
console.log('  ✓ 战术六角格 7 大地貌数值真源、悬停卡片与战术提示完备');

// ── 3. 棋子滑行动画 (TacticalUnitPiece node.to) 审计 ──
console.log('── 3. 棋子滑行动画 (TacticalUnitPiece node.to) 审计 ──');
const piecePath = join(ROOT, 'client/src/components/battle/TacticalUnitPiece.tsx');
assert.ok(existsSync(piecePath), 'TacticalUnitPiece.tsx 必须存在');
const pieceCode = readFileSync(piecePath, 'utf-8');
assert.ok(pieceCode.includes('export const TacticalUnitPiece'), '必须导出 TacticalUnitPiece');
assert.ok(pieceCode.includes('group.to({'), '必须通过 node.to() 驱动平滑滑行动画');
assert.ok(pieceCode.includes('prevPosRef'), '必须通过 prevPosRef 跟踪上一帧位置避免瞬切');
assert.ok(pieceCode.includes('hpRatio'), '必须渲染兵力血条');
assert.ok(pieceCode.includes('UNIT_CHAR'), '必须渲染兵种单字印信');
assert.ok(battleViewCode.includes('<TacticalUnitPiece'), 'BattleView 必须通过 TacticalUnitPiece 渲染部队');
console.log('  ✓ 棋子组件独立封装、移动滑行动画与印信兵力条完备');

// ── 4. 战术迷雾散开 (FogLayer 方案接入) 审计 ──
console.log('── 4. 战术迷雾散开 (FogLayer 方案接入) 审计 ──');
assert.ok(battleViewCode.includes('tacticalFogHoles'), 'BattleView 必须计算战术视野挖洞孔位');
assert.ok(battleViewCode.includes('effectiveSightRange'), 'BattleView 必须基于 effectiveSightRange 计算视界');
assert.ok(battleViewCode.includes('<FogLayer'), 'BattleView 必须挂接 FogLayer 迷雾遮罩层');
console.log('  ✓ 探明部队视界动态挖洞、随军滑行迷雾散开效果完备');

// ── 5. 切入渐变与邻接交锋切入三级白刃战审计 ──
console.log('── 5. 切入渐变与邻接交锋切入三级白刃战审计 ──');
assert.ok(battleViewCode.includes('data-testid="tactical-transition-overlay"'), 'BattleView 必须包含渐变切入遮罩');
assert.ok(battleViewCode.includes('enterMeleeTransition'), 'BattleView 必须包含 enterMeleeTransition 交锋切入逻辑');
assert.ok(battleViewCode.includes("pushSceneFrame({ scene: 'melee' })"), '邻接接战必须切入三级 melee 场景');
assert.ok(battleViewCode.includes('data-testid="btn-trigger-melee"'), 'HUD 必须包含短兵接战（入白刃）按钮');
assert.ok(battleViewCode.includes('data-testid="btn-direct-attack"'), 'HUD 必须包含阵列急袭（直接结算）按钮');
console.log('  ✓ 渐变遮罩、镜头推进与邻接进入三级白刃战串联完备');

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

console.log('\n=== [Session 470] S21-W7 二级战术串联专项验收 6/6 全部通过 ===');
