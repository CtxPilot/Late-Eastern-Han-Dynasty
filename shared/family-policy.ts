// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 玩家可执行婚配的统一成年门槛。
 * 历史资料中的婚姻记载不等于玩家可执行规则；运行时必须同时满足年龄与已登场条件。
 */
export const MARRIAGE_ADULT_AGE = 18;

export function ageAtYear(birthYear: number, currentYear: number): number {
  return currentYear - birthYear;
}

export function isAdultForMarriage(birthYear: number, currentYear: number): boolean {
  return birthYear > 0 && ageAtYear(birthYear, currentYear) >= MARRIAGE_ADULT_AGE;
}
