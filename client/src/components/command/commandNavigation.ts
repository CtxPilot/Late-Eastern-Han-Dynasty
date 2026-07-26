// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

export const OPEN_LEGACY_PERSONNEL_EVENT = 'leh:open-legacy-personnel';

/** CMD-P2 过渡导航：朝廷只读官制跳往仍在旧手风琴的人事任命区。 */
export function openLegacyPersonnelPanel(): void {
  window.dispatchEvent(new CustomEvent(OPEN_LEGACY_PERSONNEL_EVENT));
}
