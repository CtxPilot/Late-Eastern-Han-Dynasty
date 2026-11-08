// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PASSES,
  calculatePassDefenseModifier,
  isRouteBlockedByPass,
  canGarrisonPass,
  calculatePassWallRepairCost,
  PASS_WALL_REPAIR_GOLD,
  PASS_WALL_REPAIR_GAIN,
  MIN_CITY_TROOPS_RESERVE,
} from './pass.js';
import type { PassEntity } from './types/pass.js';

describe('关隘要塞防御要冲体系 (shared/pass.ts)', () => {
  it('DEFAULT_PASSES 包含 25 座历史名关且覆盖七大战略州域', () => {
    expect(DEFAULT_PASSES).toHaveLength(25);
    const ids = new Set(DEFAULT_PASSES.map((p) => p.id));
    expect(ids.size).toBe(25);

    const sili = DEFAULT_PASSES.filter((p) => p.province === '司隶');
    const liang = DEFAULT_PASSES.filter((p) => p.province === '凉州');
    const yi = DEFAULT_PASSES.filter((p) => p.province === '益州');
    const jing = DEFAULT_PASSES.filter((p) => p.province === '荆州');
    const yang = DEFAULT_PASSES.filter((p) => p.province === '扬州');
    const bing = DEFAULT_PASSES.filter((p) => p.province === '并州');
    const ji = DEFAULT_PASSES.filter((p) => p.province === '冀州');

    expect(sili).toHaveLength(7);
    expect(liang).toHaveLength(3);
    expect(yi).toHaveLength(6);
    expect(jing).toHaveLength(2);
    expect(yang).toHaveLength(3);
    expect(bing).toHaveLength(2);
    expect(ji).toHaveLength(2);
  });

  it('雄关与普通关隘防御加成及山地骑兵削弱计算', () => {
    const hulao = DEFAULT_PASSES.find((p) => p.name === '虎牢关')!;
    expect(hulao.isFortressPass).toBe(true);
    const mod1 = calculatePassDefenseModifier(hulao, false);
    expect(mod1.defBonus).toBe(0.50);
    expect(mod1.attackerPenalty).toBe(0);

    const sishui = DEFAULT_PASSES.find((p) => p.name === '汜水关')!;
    expect(sishui.isFortressPass).toBe(false);
    const mod2 = calculatePassDefenseModifier(sishui, false);
    expect(mod2.defBonus).toBe(0.30);

    const jiange = DEFAULT_PASSES.find((p) => p.name === '剑阁')!;
    expect(jiange.isMountainPass).toBe(true);
    const mod3 = calculatePassDefenseModifier(jiange, true);
    expect(mod3.defBonus).toBe(0.50);
    expect(mod3.attackerPenalty).toBe(0.40);

    // 城防为 0 时加成失效
    const broken: PassEntity = { ...hulao, wall: 0 };
    const modBroken = calculatePassDefenseModifier(broken, true);
    expect(modBroken.defBonus).toBe(0);
    expect(modBroken.attackerPenalty).toBe(0);
  });

  it('路线阻截与关隘过所检查', () => {
    const passMap: Record<number, PassEntity> = {
      1: {
        ...DEFAULT_PASSES[0],
        factionId: 2, // 董卓势力控制
        troops: 3000,
        blocksRoutes: [[1, 7], [1, 3]],
      },
    };

    // 敌方(faction 1 曹操)通行 洛阳[1]—陈留[7] 被阻截
    const res1 = isRouteBlockedByPass(1, 7, 1, passMap);
    expect(res1.blocked).toBe(true);
    expect(res1.blockingPass?.name).toBe('虎牢关');

    // 反向通行亦被阻截
    const res1Rev = isRouteBlockedByPass(7, 1, 1, passMap);
    expect(res1Rev.blocked).toBe(true);

    // 己方(faction 2 董卓)通行不受阻
    const res2 = isRouteBlockedByPass(1, 7, 2, passMap);
    expect(res2.blocked).toBe(false);

    // 关隘空虚 (0 驻军) 不阻拦通行
    const emptyMap: Record<number, PassEntity> = {
      1: { ...passMap[1], troops: 0 },
    };
    const res3 = isRouteBlockedByPass(1, 7, 1, emptyMap);
    expect(res3.blocked).toBe(false);

    // 无关隘阻挡之路线不受阻
    const res4 = isRouteBlockedByPass(9, 10, 1, passMap);
    expect(res4.blocked).toBe(false);
  });

  it('驻军调拨 canGarrisonPass 规则校验', () => {
    const pass = { ...DEFAULT_PASSES[0], troops: 2000, maxGarrison: 5000 };

    // 合法调拨 2000 兵力
    const ok = canGarrisonPass(8000, pass, 2000);
    expect(ok.allowed).toBe(true);

    // 负数或 0 兵力拦截
    const zero = canGarrisonPass(8000, pass, 0);
    expect(zero.allowed).toBe(false);

    // 城池守军低于保底储备拦截
    const emptyCity = canGarrisonPass(2500, pass, 2000);
    expect(emptyCity.allowed).toBe(false);
    expect(emptyCity.reason).toContain(`${MIN_CITY_TROOPS_RESERVE}`);

    // 超过关隘上限拦截
    const exceed = canGarrisonPass(10000, pass, 4000);
    expect(exceed.allowed).toBe(false);
    expect(exceed.reason).toContain('超过上限');
  });

  it('关隘城防修缮工本计算', () => {
    const pass = { ...DEFAULT_PASSES[0], wall: 4000, maxWall: 5000 };
    const cost = calculatePassWallRepairCost(pass);
    expect(cost.goldCost).toBe(PASS_WALL_REPAIR_GOLD);
    expect(cost.wallGain).toBe(PASS_WALL_REPAIR_GAIN);

    // 接近满城防时夹紧
    const nearFull = { ...DEFAULT_PASSES[0], wall: 4900, maxWall: 5000 };
    const cost2 = calculatePassWallRepairCost(nearFull);
    expect(cost2.wallGain).toBe(100);
  });
});
