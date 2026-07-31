// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 郡国模板逐郡校验脚本（BF-P5 录入/校勘工具）。
 *
 * 遍历所有已注册的 HistoricalGeographyBundle，对每个跑 Zod schema 校验
 * + preview 一致性检查（两次调用 deep-equal，锁零 RNG）。
 *
 * 用法：pnpm verify-historical-geography
 */

import {
  HistoricalGeographyBundleSchema,
  nanjun190,
  yingchuan190,
} from '@leh/shared';
import { createHistoricalGeographyPreview } from '@leh/shared';
import type { HistoricalGeographyBundle } from '@leh/shared';

/** 所有已注册的郡国模板 bundle。新增模板在此数组追加即可自动纳入校验。 */
const bundles: Array<{ label: string; bundle: HistoricalGeographyBundle }> = [
  { label: '南郡 190', bundle: nanjun190 },
  { label: '颍川 190', bundle: yingchuan190 },
];

let passed = 0;
let failed = 0;

for (const { label, bundle } of bundles) {
  // Zod schema 校验
  const result = HistoricalGeographyBundleSchema.safeParse(bundle);
  if (!result.success) {
    failed++;
    console.log(`FAIL ${label}: ${result.error.issues.length} issue(s)`);
    for (const issue of result.error.issues.slice(0, 10)) {
      console.log(`  [${issue.path.join('.')}] ${issue.message}`);
    }
    if (result.error.issues.length > 10) {
      console.log(`  ... and ${result.error.issues.length - 10} more`);
    }
    continue;
  }

  // preview 一致性（零 RNG、纯函数投影，两次调用必须 deep-equal）
  const preview1 = createHistoricalGeographyPreview(bundle);
  const preview2 = createHistoricalGeographyPreview(bundle);
  if (JSON.stringify(preview1) !== JSON.stringify(preview2)) {
    failed++;
    console.log(`FAIL ${label}: preview not deterministic`);
    continue;
  }

  passed++;
  console.log(
    `OK   ${label} (${bundle.counties.length} counties, ${bundle.routes.length} routes, ${bundle.landmarks.length} landmarks)`,
  );
}

console.log('');
if (failed > 0) {
  console.log(`=== 结果: ${passed} passed, ${failed} failed ===`);
  process.exit(1);
}
console.log(`=== 结果: ${passed} passed, 0 failed ===`);
