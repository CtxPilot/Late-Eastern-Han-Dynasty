// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect } from 'vitest';
import {
  UnitType,
  getUnitMatchup,
  getUnitMatchupInfo,
  getUnitMeleeBadge,
  DEFAULT_STRONG_AGAINST_MAP,
  UNIT_MELEE_BADGES,
} from './index.js';

describe('unitMatchup — 兵种克制与印信徽标', () => {
  it('DEFAULT_STRONG_AGAINST_MAP 涵盖 24 种合法兵种', () => {
    const keys = Object.keys(DEFAULT_STRONG_AGAINST_MAP);
    expect(keys.length).toBe(24);
    expect(DEFAULT_STRONG_AGAINST_MAP[UnitType.LIGHT_INFANTRY]).toContain(UnitType.ARCHER);
    expect(DEFAULT_STRONG_AGAINST_MAP[UnitType.SPEARMAN]).toContain(UnitType.HEAVY_CAVALRY);
    expect(DEFAULT_STRONG_AGAINST_MAP[UnitType.SPEARMAN]).toContain(UnitType.LIGHT_CAVALRY);
    expect(DEFAULT_STRONG_AGAINST_MAP[UnitType.ARCHER]).toContain(UnitType.HEAVY_INFANTRY);
  });

  it('getUnitMatchup 正确测算克制 (1.3)、被克 (0.7) 与中性 (1.0)', () => {
    // 步兵克弓兵
    expect(getUnitMatchup(UnitType.LIGHT_INFANTRY, UnitType.ARCHER)).toBe(1.3);
    // 弓兵被步兵克
    expect(getUnitMatchup(UnitType.ARCHER, UnitType.LIGHT_INFANTRY)).toBe(0.7);

    // 枪兵克重骑兵
    expect(getUnitMatchup(UnitType.SPEARMAN, UnitType.HEAVY_CAVALRY)).toBe(1.3);
    // 重骑兵被枪兵克
    expect(getUnitMatchup(UnitType.HEAVY_CAVALRY, UnitType.SPEARMAN)).toBe(0.7);

    // 弓兵克重步兵
    expect(getUnitMatchup(UnitType.ARCHER, UnitType.HEAVY_INFANTRY)).toBe(1.3);
    // 重步兵被弓兵克
    expect(getUnitMatchup(UnitType.HEAVY_INFANTRY, UnitType.ARCHER)).toBe(0.7);

    // 步兵对步兵：中性 1.0
    expect(getUnitMatchup(UnitType.LIGHT_INFANTRY, UnitType.LIGHT_INFANTRY)).toBe(1.0);
    // 黄巾军对攻城器：无直接克制关系 1.0
    expect(getUnitMatchup(UnitType.YELLOW_TURBAN, UnitType.SIEGE)).toBe(1.0);
  });

  it('getUnitMatchupInfo 给出直观文言徽标与高亮色彩', () => {
    const adv = getUnitMatchupInfo(UnitType.SPEARMAN, UnitType.LIGHT_CAVALRY);
    expect(adv.modifier).toBe(1.3);
    expect(adv.label).toBe('克制');
    expect(adv.isAdvantage).toBe(true);
    expect(adv.isDisadvantage).toBe(false);

    const dis = getUnitMatchupInfo(UnitType.LIGHT_CAVALRY, UnitType.SPEARMAN);
    expect(dis.modifier).toBe(0.7);
    expect(dis.label).toBe('被克');
    expect(dis.isAdvantage).toBe(false);
    expect(dis.isDisadvantage).toBe(true);

    const neu = getUnitMatchupInfo(UnitType.SPEARMAN, UnitType.SPEARMAN);
    expect(neu.modifier).toBe(1.0);
    expect(neu.label).toBe('均衡');
    expect(neu.isAdvantage).toBe(false);
    expect(neu.isDisadvantage).toBe(false);
  });

  it('getUnitMeleeBadge 正确返回 24 兵种单字篆印与几何方阵形状', () => {
    const spear = getUnitMeleeBadge(UnitType.SPEARMAN);
    expect(spear.char).toBe('枪');
    expect(spear.category).toBe('infantry');
    expect(spear.shape).toBe('square');

    const hCav = getUnitMeleeBadge(UnitType.HEAVY_CAVALRY);
    expect(hCav.char).toBe('重');
    expect(hCav.category).toBe('cavalry');
    expect(hCav.shape).toBe('diamond');

    const archer = getUnitMeleeBadge(UnitType.ARCHER);
    expect(archer.char).toBe('弓');
    expect(archer.category).toBe('archer');
    expect(archer.shape).toBe('circle');

    const navy = getUnitMeleeBadge(UnitType.HEAVY_NAVY);
    expect(navy.char).toBe('楼');
    expect(navy.category).toBe('navy');

    // 未知兜底
    const fallback = getUnitMeleeBadge('unknown_soldier');
    expect(fallback.char).toBe('卒');
    expect(fallback.name).toBe('行伍士卒');
  });
});
