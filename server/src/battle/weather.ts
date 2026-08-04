// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { Weather } from '@leh/shared';

/** 05 §3.1：天气对六角战场移动力与一般兵种射程的统一修正。 */
export function weatherMovementPenalty(weather: Weather): number {
  switch (weather) {
    case Weather.SNOW: return 2;
    case Weather.RAIN:
    case Weather.STORM:
    case Weather.FOG: return 1;
    default: return 0;
  }
}

export function effectiveMovement(maxMp: number, weather: Weather): number {
  return Math.max(0, maxMp - weatherMovementPenalty(weather));
}

/** 一般兵种射程不低于1；雾天远程禁射由既有门禁单独处理。 */
export function effectiveUnitRange(baseRange: number, weather: Weather): number {
  if (baseRange <= 1) return baseRange;
  const penalty = weather === Weather.FOG ? 2
    : weather === Weather.RAIN || weather === Weather.STORM || weather === Weather.SNOW ? 1
      : 0;
  return Math.max(1, baseRange - penalty);
}
