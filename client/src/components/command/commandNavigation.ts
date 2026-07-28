// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

export const OPEN_LEGACY_PERSONNEL_EVENT = 'leh:open-legacy-personnel';

/** @deprecated CMD-P9 后仅为旧手风琴兼容；正式跨抽屉导航使用 commandShell action。 */
export function openLegacyPersonnelPanel(): void {
  window.dispatchEvent(new CustomEvent(OPEN_LEGACY_PERSONNEL_EVENT));
}
