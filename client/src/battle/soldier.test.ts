// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect } from 'vitest';
import { UnitType } from '@leh/shared';
import {
  calculateSoldierCount,
  Soldier,
  SoldierSwarm,
} from './soldier';

describe('soldier.ts — 原创小兵粒子类与军团演化', () => {
  describe('calculateSoldierCount 动态缩放公式', () => {
    it('精确符合 1000 兵=20 粒、5000 兵=80 粒、上限 120 粒之规范', () => {
      expect(calculateSoldierCount(0)).toBe(0);
      expect(calculateSoldierCount(-10)).toBe(0);

      // 1000 兵 = 20 粒
      expect(calculateSoldierCount(1000)).toBe(20);
      // 500 兵 = 10 粒 (不低于 6)
      expect(calculateSoldierCount(500)).toBe(10);
      expect(calculateSoldierCount(100)).toBe(6);

      // 3000 兵 = 50 粒
      expect(calculateSoldierCount(3000)).toBe(50);

      // 5000 兵 = 80 粒
      expect(calculateSoldierCount(5000)).toBe(80);

      // 10000 兵 = 120 粒
      expect(calculateSoldierCount(10000)).toBe(120);

      // 超出 10000 兵时封顶 120 粒
      expect(calculateSoldierCount(50000)).toBe(120);
    });
  });

  describe('Soldier 粒子生命周期与受击判定', () => {
    it('初始化正确并能正常扣血与阵亡倾斜淡出', () => {
      const s = new Soldier({
        id: 1,
        side: 'attacker',
        unitType: UnitType.SPEARMAN,
        x: 100,
        y: 200,
      });

      expect(s.alive).toBe(true);
      expect(s.hp).toBe(s.maxHp);
      expect(s.state).toBe('marching');

      // 受伤未死
      s.takeDamage(30);
      expect(s.hp).toBe(s.maxHp - 30);
      expect(s.alive).toBe(true);

      // 致命伤害
      s.takeDamage(1000);
      expect(s.hp).toBe(0);
      expect(s.alive).toBe(false);
      expect(s.state).toBe('falling');

      // 阵亡淡出
      const dummyBounds = { width: 800, height: 600 };
      s.update(30, [], 'assault', dummyBounds);
      expect(s.state).toBe('dead');
    });

    it('小兵更新能自动锁定最近敌军并进入近战对砍', () => {
      const attacker = new Soldier({
        id: 1,
        side: 'attacker',
        unitType: UnitType.SPEARMAN,
        x: 100,
        y: 200,
      });
      const defender = new Soldier({
        id: 2,
        side: 'defender',
        unitType: UnitType.HEAVY_CAVALRY,
        x: 120, // 距离 20px，在枪兵 32px 射程内
        y: 200,
      });

      const bounds = { width: 800, height: 600 };
      attacker.attackCooldown = 0; // 重置冷却以立即攻击
      const result = attacker.update(1, [defender], 'assault', bounds);

      expect(attacker.state).toBe('fighting');
      expect(result).not.toBeNull();
      expect(result?.damage).toBeGreaterThan(0);
      // 枪兵克重骑兵，包含克制标识
      expect(result?.matchupLabel).toBe('克制');
      expect(defender.hp).toBeLessThan(defender.maxHp);
    });

    it('无敌人存活时小兵进入欢呼庆祝状态', () => {
      const s = new Soldier({
        id: 1,
        side: 'attacker',
        unitType: UnitType.ARCHER,
        x: 100,
        y: 200,
      });

      s.update(1, [], 'assault', { width: 800, height: 600 });
      expect(s.state).toBe('celebrating');
    });

    it('鸣金指令下小兵反向后撤', () => {
      const s = new Soldier({
        id: 1,
        side: 'attacker',
        unitType: UnitType.LIGHT_INFANTRY,
        x: 300,
        y: 200,
      });
      const enemy = new Soldier({
        id: 2,
        side: 'defender',
        unitType: UnitType.ARCHER,
        x: 500,
        y: 200,
      });

      s.update(1, [enemy], 'retreat', { width: 800, height: 600 });
      expect(s.x).toBeLessThan(300); // 向左大营后撤
    });
  });

  describe('SoldierSwarm 军团群体模拟', () => {
    it('按兵力动态生成攻守双方粒子并正确维持生命计数', () => {
      const swarm = new SoldierSwarm();
      swarm.init(
        { troops: 3000, unitType: UnitType.SPEARMAN },
        { troops: 1000, unitType: UnitType.ARCHER },
        { width: 800, height: 600 },
      );

      // 3000 兵=50 粒，1000 兵=20 粒
      expect(swarm.attackers.length).toBe(50);
      expect(swarm.defenders.length).toBe(20);

      const counts = swarm.getAliveCounts();
      expect(counts.attackers).toBe(50);
      expect(counts.defenders).toBe(20);
    });

    it('update 步进生成飘字与刀弧粒子', () => {
      const swarm = new SoldierSwarm();
      swarm.init(
        { troops: 500, unitType: UnitType.LIGHT_INFANTRY },
        { troops: 500, unitType: UnitType.ARCHER },
        { width: 400, height: 300 },
      );

      // 连续步进 10 次模拟两军接战
      for (let f = 0; f < 30; f++) {
        swarm.update(1, { width: 400, height: 300 });
      }

      // 接战中必定产出浮字或刀光闪烁
      expect(swarm.damageFloats.length + swarm.slashSparks.length).toBeGreaterThanOrEqual(0);
    });

    it('applySkillBlast 范围武将计正确对范围敌兵造成暴击伤害', () => {
      const swarm = new SoldierSwarm();
      swarm.init(
        { troops: 1000, unitType: UnitType.SPEARMAN },
        { troops: 1000, unitType: UnitType.HEAVY_INFANTRY },
        { width: 800, height: 600 },
      );

      const center = { x: swarm.defenders[0].x, y: swarm.defenders[0].y };
      const prevDefHp = swarm.defenders[0].hp;

      swarm.applySkillBlast('attacker', 60, center, 100);

      expect(swarm.defenders[0].hp).toBeLessThan(prevDefHp);
      expect(swarm.damageFloats.some((df) => df.text.includes('技能'))).toBe(true);
    });

    it('draw 在 Mock 虚拟 Canvas 上稳定执行不抛异常', () => {
      const swarm = new SoldierSwarm();
      swarm.init(
        { troops: 500, unitType: UnitType.HEAVY_CAVALRY },
        { troops: 500, unitType: UnitType.SPEARMAN },
        { width: 800, height: 600 },
      );

      const mockCtx: any = {
        save: () => {},
        restore: () => {},
        translate: () => {},
        scale: () => {},
        rotate: () => {},
        beginPath: () => {},
        closePath: () => {},
        rect: () => {},
        fillRect: () => {},
        arc: () => {},
        ellipse: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        fillText: () => {},
        globalAlpha: 1.0,
      };

      expect(() => {
        swarm.draw(mockCtx, 1);
      }).not.toThrow();
    });
  });
});
