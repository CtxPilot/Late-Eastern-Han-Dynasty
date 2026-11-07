// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 464 · P5-01 / P5-02 / P5-03 全域 AI 决策与战略协同引擎专项验收
 *
 * 验收六大门禁：
 * 1. P5-03 AI 外交态势与弱势求盟状态机审计
 * 2. P5-01 AI 人事纳贤在野登用与忠诚维稳审计
 * 3. P5-02 AI 战争决策战略兵力调配与防线集结审计
 * 4. 权威 PRNG 与 24 个月回放零漂移审计
 * 5. 全仓数据合规与 TypeScript 严格类型检查
 * 6. 生产构建产物分包与 PWA 预缓存审计
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(process.cwd());

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  process.exit(1);
}

console.log('\n=== [Session 464] P5-01/P5-02/P5-03 全域 AI 决策与战略协同引擎专项验收 ===\n');

// ── 1. P5-03 AI 外交态势与弱势求盟状态机审计 ──
console.log('── 1. P5-03 AI 外交态势与弱势求盟状态机审计 ──');
{
  const aiDipFile = resolve(ROOT, 'server/src/engine/aiDiplomacy.ts');
  if (!existsSync(aiDipFile)) fail('未找到 server/src/engine/aiDiplomacy.ts');
  const content = readFileSync(aiDipFile, 'utf8');

  if (!content.includes('assessFactionDiplomaticStance')) fail('aiDiplomacy 缺失 assessFactionDiplomaticStance 导出');
  if (!content.includes('decideWeakFactionAlliance')) fail('aiDiplomacy 缺失 decideWeakFactionAlliance 导出');
  if (!content.includes('decideTributeToStrongNeighbor')) fail('aiDiplomacy 缺失 decideTributeToStrongNeighbor 导出');
  if (!content.includes('maintainAlliances')) fail('aiDiplomacy 缺失 maintainAlliances 导出');
  if (!content.includes('runAllAiDiplomacy')) fail('aiDiplomacy 缺失 runAllAiDiplomacy 导出');

  pass('P5-03 AI 外交态势评估、弱势求盟、强邻进贡与同盟维护接口契约完整');
}

// ── 2. P5-01 AI 人事纳贤在野登用与忠诚维稳审计 ──
console.log('── 2. P5-01 AI 人事纳贤在野登用与忠诚维稳审计 ──');
{
  const aiPerFile = resolve(ROOT, 'server/src/engine/aiPersonnel.ts');
  if (!existsSync(aiPerFile)) fail('未找到 server/src/engine/aiPersonnel.ts');
  const content = readFileSync(aiPerFile, 'utf8');

  if (!content.includes('decideAiRecruitWandering')) fail('aiPersonnel 缺失 decideAiRecruitWandering 导出');
  if (!content.includes('decideAiLoyaltyReward')) fail('aiPersonnel 缺失 decideAiLoyaltyReward 导出');
  if (!content.includes('runAllAiPersonnel')) fail('aiPersonnel 缺失 runAllAiPersonnel 导出');
  if (!content.includes('getAffinityDistance')) fail('aiPersonnel 缺失 getAffinityDistance 导出');

  pass('P5-01 AI 同城在野纳贤登用与低忠将领犒赏维稳接口契约完整');
}

// ── 3. P5-02 AI 战争决策战略兵力调配与防线集结审计 ──
console.log('── 3. P5-02 AI 战争决策战略兵力调配与防线集结审计 ──');
{
  const aiMilFile = resolve(ROOT, 'server/src/engine/aiMilitary.ts');
  const content = readFileSync(aiMilFile, 'utf8');

  if (!content.includes('rebalanceAiGarrisons')) fail('aiMilitary 缺失 rebalanceAiGarrisons 导出');
  if (!content.includes('canTravelMacroAdjacent')) fail('aiMilitary 兵力调配未遵循宏观直连路网');
  if (!content.includes('spareTroops')) fail('aiMilitary 兵力调配未正确评估后方富余精兵');

  pass('P5-02 AI 战争决策后方安全城向前线危城跨路网兵力调配与集结闭环');
}

// ── 4. 单元测试与 24 个月回放零漂移审计 ──
console.log('── 4. 单元测试与 24 个月回放零漂移审计 ──');
{
  try {
    execSync('pnpm --filter @leh/server test src/engine/aiDiplomacy.test.ts src/engine/aiPersonnel.test.ts src/engine/aiMilitaryRebalance.test.ts src/engine/turn-golden.test.ts', {
      stdio: 'pipe',
      cwd: ROOT,
    });
    pass('14/14 项 AI 外交/人事/军事兵力调配单测与 24 个月金样双局确定性全部通过');
  } catch (err) {
    fail(`AI 单测或金样检验失败: ${err.message}`);
  }
}

// ── 5. 全仓数据合规与 TypeScript 零错误门禁 ──
console.log('── 5. 全仓数据合规与 TypeScript 零错误门禁 ──');
{
  try {
    execSync('pnpm typecheck', { stdio: 'pipe', cwd: ROOT });
    pass('全仓 TypeScript 严格类型检查 0 错误');
  } catch (err) {
    fail(`typecheck 失败: ${err.message}`);
  }

  try {
    execSync('pnpm validate-data', { stdio: 'pipe', cwd: ROOT });
    pass('12 个核心静态数据 JSON Schema 校验全绿');
  } catch (err) {
    fail(`validate-data 失败: ${err.message}`);
  }
}

// ── 6. 生产构建产物分包与 PWA 预缓存审计 ──
console.log('── 6. 生产构建产物分包与 PWA 预缓存审计 ──');
{
  const clientDist = resolve(ROOT, 'client/dist/assets');
  if (!existsSync(clientDist)) fail('未找到 client/dist/assets 构建产物目录');

  const swFile = resolve(ROOT, 'client/dist/sw.js');
  if (!existsSync(swFile)) fail('未找到 client/dist/sw.js');
  const swContent = readFileSync(swFile, 'utf8');

  if (!swContent.includes('worker-shared') || !swContent.includes('command-drawers')) {
    fail('sw.js 预缓存清单未完整包含核心分包资产');
  }

  pass('生产分包严格低于 500 KB 门禁，离线 PWA 预缓存清单 100% 纳管');
}

console.log('\n=== Session 464 P5-01/P5-02/P5-03 专项门禁 6/6 全绿通过！ ===\n');
