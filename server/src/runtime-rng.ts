// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 权威 RNG 已上移至 @leh/shared（离线可玩版 Session 372 Phase 0），
 * 此处仅 re-export 保持既有服务端导入路径不变；Worker/浏览器端直接
 * 从 '@leh/shared' 导入同名函数，各 JS 域持有独立模块级单例。
 */
export {
  getRuntimeRngState,
  resetRuntimeRng,
  restoreRuntimeRng,
  runtimeRandom,
} from '@leh/shared';
