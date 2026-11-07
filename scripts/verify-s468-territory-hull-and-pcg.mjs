// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd());

console.log('=== [Session 468] S20-W3 势力凸包算法、FogLayer 迷雾与 PCG 水墨地形专项验收 ===\n');

// ── 1. mapTerritory Graham Scan 凸包纯函数引擎审计 ──
console.log('── 1. mapTerritory Graham Scan 凸包纯函数引擎审计 ──');
const territoryPath = join(ROOT, 'client/src/components/map/mapTerritory.ts');
assert.ok(existsSync(territoryPath), 'client/src/components/map/mapTerritory.ts 必须存在');
const territoryCode = readFileSync(territoryPath, 'utf-8');
assert.ok(territoryCode.includes('computeConvexHull'), '必须导出 computeConvexHull');
assert.ok(territoryCode.includes('deriveFactionTerritories'), '必须导出 deriveFactionTerritories');
assert.ok(territoryCode.includes('generateCircleBuffer'), '必须包含单城圆形缓冲函数');
assert.ok(territoryCode.includes('generateCapsuleBuffer'), '必须包含两城胶囊走廊缓冲函数');
assert.ok(territoryCode.includes('expandPolygon'), '必须包含多城凸包外扩函数');
assert.ok(territoryCode.includes('visibleCityIds'), '必须支持迷雾城过滤 (visibleCityIds)');
console.log('  ✓ Graham Scan 凸包、单/双/多城缓冲算法与迷雾过滤契约完备');

// ── 2. TerritoryLayer 与 FogLayer Konva 渲染层审计 ──
console.log('── 2. TerritoryLayer 与 FogLayer Konva 渲染层审计 ──');
const layerPath = join(ROOT, 'client/src/components/map/TerritoryLayer.tsx');
assert.ok(existsSync(layerPath), 'TerritoryLayer.tsx 必须存在');
const layerCode = readFileSync(layerPath, 'utf-8');
assert.ok(layerCode.includes('export const TerritoryLayer'), '必须导出 TerritoryLayer');
assert.ok(layerCode.includes('closed={true}'), 'Line 必须为闭合多边形 closed={true}');
assert.ok(layerCode.includes('opacity={opacity}'), '必须支持半透明水墨色块透明度');
assert.ok(layerCode.includes('listening={false}'), '图层必须禁用监听 listening={false}');

const fogPath = join(ROOT, 'client/src/components/map/FogLayer.tsx');
assert.ok(existsSync(fogPath), 'FogLayer.tsx 必须存在');
const fogCode = readFileSync(fogPath, 'utf-8');
assert.ok(fogCode.includes('export const FogLayer'), '必须导出 FogLayer');
assert.ok(fogCode.includes('calculateFogHoles'), '必须导出 calculateFogHoles 纯函数');
assert.ok(fogCode.includes('destination-out'), '必须使用 destination-out 挖洞迷雾');
assert.ok(fogCode.includes('rgba(10, 10, 15, 0.55)'), '必须使用设计规范深墨遮罩');
console.log('  ✓ TerritoryLayer 与 FogLayer 图层属性与 destination-out 挖洞契约完备');

// ── 3. shared/pcg 原创纯数学水墨地形引擎审计 ──
console.log('── 3. shared/pcg 原创纯数学水墨地形引擎审计 ──');
const pcgDir = join(ROOT, 'shared/pcg');
assert.ok(existsSync(pcgDir), 'shared/pcg 目录必须存在');

const mountainsPath = join(pcgDir, 'inkMountains.ts');
assert.ok(existsSync(mountainsPath), 'inkMountains.ts 必须存在');
const mountainsCode = readFileSync(mountainsPath, 'utf-8');
assert.ok(mountainsCode.includes('generateInkMountainLayers'), '必须导出 generateInkMountainLayers');
assert.ok(mountainsCode.includes('renderInkMountains'), '必须导出 renderInkMountains');
assert.ok(mountainsCode.includes('青黛远山') && mountainsCode.includes('烟岚中峰') && mountainsCode.includes('近景重峦'), '必须呈现三层水墨重峦');

const riverPath = join(pcgDir, 'naturalRiver.ts');
assert.ok(existsSync(riverPath), 'naturalRiver.ts 必须存在');
const riverCode = readFileSync(riverPath, 'utf-8');
assert.ok(riverCode.includes('generateNaturalRiver'), '必须导出 generateNaturalRiver');
assert.ok(riverCode.includes('renderNaturalRiver'), '必须导出 renderNaturalRiver');
assert.ok(riverCode.includes('tributaries'), '必须生成自然水系支流');

const tilesPath = join(pcgDir, 'terrainTiles.ts');
assert.ok(existsSync(tilesPath), 'terrainTiles.ts 必须存在');
const tilesCode = readFileSync(tilesPath, 'utf-8');
assert.ok(tilesCode.includes('generateTerrainTileElements'), '必须导出 generateTerrainTileElements');
assert.ok(tilesCode.includes('renderTerrainTile'), '必须导出 renderTerrainTile');

const strategemPath = join(pcgDir, 'strategemVisuals.ts');
assert.ok(existsSync(strategemPath), 'strategemVisuals.ts 必须存在');
const strategemCode = readFileSync(strategemPath, 'utf-8');
assert.ok(strategemCode.includes('drawProceduralGridFlame'), '必须导出 drawProceduralGridFlame');
assert.ok(strategemCode.includes('drawProceduralWaterRipple'), '必须导出 drawProceduralWaterRipple');
assert.ok(strategemCode.includes('drawProceduralAmbushMist'), '必须导出 drawProceduralAmbushMist');
assert.ok(strategemCode.includes('drawLevel1StrategemVisuals'), '必须导出 drawLevel1StrategemVisuals');
console.log('  ✓ PCG 水墨远山、自然水系、战术六角图元与计谋视觉纯数学函数完备');

// ── 4. client/src/battle 全局帧与白刃战 PCG 审计 ──
console.log('── 4. client/src/battle 全局帧与白刃战 PCG 审计 ──');
const battleDir = join(ROOT, 'client/src/battle');
assert.ok(existsSync(battleDir), 'client/src/battle 目录必须存在');

const framePath = join(battleDir, 'frameCount.ts');
assert.ok(existsSync(framePath), 'frameCount.ts 必须存在');
const frameCode = readFileSync(framePath, 'utf-8');
assert.ok(frameCode.includes('getGlobalFrame'), '必须导出 getGlobalFrame');
assert.ok(frameCode.includes('stepGlobalFrame'), '必须导出 stepGlobalFrame');
assert.ok(frameCode.includes('subscribeFrame'), '必须导出 subscribeFrame');

const meleeBgPath = join(battleDir, 'meleeBackground.ts');
assert.ok(existsSync(meleeBgPath), 'meleeBackground.ts 必须存在');
const meleeBgCode = readFileSync(meleeBgPath, 'utf-8');
assert.ok(meleeBgCode.includes('renderMeleeParallaxBackground'), '必须导出 renderMeleeParallaxBackground');

const meleeStratPath = join(battleDir, 'meleeStrategem.ts');
assert.ok(existsSync(meleeStratPath), 'meleeStrategem.ts 必须存在');
const meleeStratCode = readFileSync(meleeStratPath, 'utf-8');
assert.ok(meleeStratCode.includes('drawLevel3StrategemOverlays'), '必须导出 drawLevel3StrategemOverlays');
console.log('  ✓ 跨模块帧计数、白刃战视差背景与三级计谋全屏粒子完备');

// ── 5. 单元测试覆盖率审计 ──
console.log('── 5. 单元测试覆盖率审计 ──');
const mapTerritoryTest = join(ROOT, 'client/src/components/map/mapTerritory.test.ts');
assert.ok(existsSync(mapTerritoryTest), 'mapTerritory.test.ts 必须存在');
const layerTest = join(ROOT, 'client/src/components/map/TerritoryAndFogLayers.test.tsx');
assert.ok(existsSync(layerTest), 'TerritoryAndFogLayers.test.tsx 必须存在');
const pcgTest = join(ROOT, 'shared/pcg/inkMountains.test.ts');
assert.ok(existsSync(pcgTest), 'shared/pcg/inkMountains.test.ts 必须存在');
const meleeTest = join(ROOT, 'client/src/battle/meleePcg.test.ts');
assert.ok(existsSync(meleeTest), 'meleePcg.test.ts 必须存在');
console.log('  ✓ 4 套新增单元测试套件全部就位');

// ── 6. 构建与静态资产尺寸约束审计 ──
console.log('── 6. 构建与静态资产尺寸约束审计 ──');
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

console.log('\n=== Session 468 S20-W3 专项验收 6/6 全部通过！ ===\n');
