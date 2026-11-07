// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  UnitType,
  getUnitMatchupInfo,
  getUnitMeleeBadge,
  type CanvasContextLike,
} from '@leh/shared';
import { BATTLE_TOKENS as BT } from '../theme/canvasTokens';

export type SoldierSide = 'attacker' | 'defender';
export type SoldierState = 'marching' | 'fighting' | 'celebrating' | 'falling' | 'dead';
export type SwarmCommand = 'assault' | 'hold' | 'retreat';

export interface DamageFloat {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  vy: number;
}

export interface SlashSpark {
  x: number;
  y: number;
  angle: number;
  len: number;
  alpha: number;
  color: string;
}

export interface AttackResult {
  sourceId: number;
  targetId: number;
  damage: number;
  x: number;
  y: number;
  isCrit: boolean;
  matchupLabel?: string;
  matchupColor?: string;
}

/**
 * S21-W8 小兵数量动态缩放公式
 * 规格：1000 兵=20 粒，5000 兵=80 粒，上限 120 粒，1 粒=20-50 兵。
 * 保证在 Konva 2D 下稳定 60 FPS 运行。
 */
export function calculateSoldierCount(troops: number): number {
  if (troops <= 0) return 0;
  if (troops <= 1000) {
    return Math.max(6, Math.round(troops / 50));
  }
  if (troops <= 5000) {
    // 1000 兵时 20 粒，5000 兵时 80 粒
    return Math.round(20 + ((troops - 1000) / 4000) * 60);
  }
  // > 5000 兵时，按比例累加至上限 120 粒
  const extra = Math.round(((troops - 5000) / 5000) * 40);
  return Math.min(120, 80 + extra);
}

export interface SoldierConfig {
  id: number;
  side: SoldierSide;
  unitType: UnitType | string;
  x: number;
  y: number;
  color?: string;
  maxHp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  facing?: 1 | -1;
  seed?: number;
}

/**
 * 原创小兵粒子类 (client/src/battle/soldier.ts)
 * 纯 TS 数据结构 + 命令式 draw 绘制。
 */
export class Soldier {
  public id: number;
  public side: SoldierSide;
  public unitType: UnitType | string;
  public x: number;
  public y: number;
  public vx = 0;
  public vy = 0;
  public targetX = 0;
  public targetY = 0;
  public initialX: number;
  public initialY: number;
  public hp: number;
  public maxHp: number;
  public alive = true;
  public state: SoldierState = 'marching';
  public facing: 1 | -1;
  public attackCooldown = 0;
  public attackInterval = 32;
  public attackRange = 24;
  public baseSpeed = 1.6;
  public currentSpeed = 1.6;
  public color: string;
  public radius = 5;
  public seed: number;
  public deathTimer = 30; // 死亡倾斜淡出帧数

  constructor(cfg: SoldierConfig) {
    this.id = cfg.id;
    this.side = cfg.side;
    this.unitType = cfg.unitType;
    this.x = cfg.x;
    this.y = cfg.y;
    this.initialX = cfg.x;
    this.initialY = cfg.y;
    this.seed = cfg.seed ?? Math.round(cfg.id * 37 + cfg.x);
    this.facing = cfg.facing ?? (cfg.side === 'attacker' ? 1 : -1);

    const badge = getUnitMeleeBadge(this.unitType);
    this.color = cfg.color ?? (this.side === 'attacker' ? (BT.unitAttacker ?? '#c2410c') : (BT.unitDefender ?? '#2563eb'));

    // 根据兵种范畴微调属性
    if (badge.category === 'cavalry') {
      this.baseSpeed = 2.4;
      this.attackRange = 36;
      this.maxHp = cfg.maxHp ?? 130;
      this.radius = 6;
    } else if (badge.category === 'archer') {
      this.baseSpeed = 1.2;
      this.attackRange = 110;
      this.maxHp = cfg.maxHp ?? 85;
      this.attackInterval = 44;
      this.radius = 4.5;
    } else if (badge.char === '枪') {
      this.baseSpeed = 1.5;
      this.attackRange = 32;
      this.maxHp = cfg.maxHp ?? 110;
      this.radius = 5;
    } else {
      // 步兵与通用
      this.baseSpeed = cfg.speed ?? 1.6;
      this.attackRange = 24;
      this.maxHp = cfg.maxHp ?? 100;
      this.radius = 5;
    }
    this.currentSpeed = this.baseSpeed;
    this.hp = this.maxHp;
    this.attackCooldown = Math.round((this.seed % this.attackInterval) * 0.7);
  }

  public takeDamage(dmg: number): void {
    if (!this.alive) return;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.state = 'falling';
    }
  }

  /**
   * 粒子单步 AI 寻敌、推进与攻击判定
   */
  public update(
    dt: number,
    enemies: Soldier[],
    command: SwarmCommand,
    bounds: { width: number; height: number },
  ): AttackResult | null {
    if (this.state === 'dead') return null;

    if (this.state === 'falling') {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.state = 'dead';
      }
      return null;
    }

    // 筛选活着的敌人
    const livingEnemies = enemies.filter((e) => e.alive);
    if (livingEnemies.length === 0) {
      this.state = 'celebrating';
      this.vx = 0;
      this.vy = 0;
      return null;
    }

    // 寻找最近的活敌
    let nearest: Soldier | null = null;
    let minDist = Infinity;
    for (const enemy of livingEnemies) {
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = enemy;
      }
    }

    if (!nearest) return null;

    const dx = nearest.x - this.x;
    const dy = nearest.y - this.y;

    // 鸣金撤退指令
    if (command === 'retreat') {
      const retreatTargetX = this.side === 'attacker' ? 40 : bounds.width - 40;
      const rdx = retreatTargetX - this.x;
      this.facing = rdx >= 0 ? 1 : -1;
      this.vx = (rdx >= 0 ? 1 : -1) * this.baseSpeed * 1.8;
      this.vy = 0;
      this.x += this.vx * dt;
      this.state = 'marching';
      return null;
    }

    // 攻击判定范围
    if (minDist <= this.attackRange) {
      this.state = 'fighting';
      this.facing = dx >= 0 ? 1 : -1;
      this.vx = 0;
      this.vy = 0;

      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0) {
        this.attackCooldown = this.attackInterval;
        // 计算基础与克制伤害
        const matchupInfo = getUnitMatchupInfo(this.unitType, nearest.unitType);
        const isCrit = (this.seed + Math.round(this.x + this.y)) % 10 === 0;
        const critMultiplier = isCrit ? 1.6 : 1.0;
        const baseDmg = 18 + (this.seed % 8);
        const finalDmg = Math.round(baseDmg * matchupInfo.modifier * critMultiplier);

        nearest.takeDamage(finalDmg);

        return {
          sourceId: this.id,
          targetId: nearest.id,
          damage: finalDmg,
          x: nearest.x,
          y: nearest.y - 10,
          isCrit,
          matchupLabel: matchupInfo.label !== '均衡' ? matchupInfo.label : undefined,
          matchupColor: matchupInfo.color,
        };
      }
      return null;
    }

    // 移向敌军
    this.state = 'marching';
    this.facing = dx >= 0 ? 1 : -1;

    let speedMul = 1.0;
    if (command === 'assault') speedMul = 1.55;
    else if (command === 'hold') speedMul = 0.65;

    this.currentSpeed = this.baseSpeed * speedMul;
    this.vx = (dx / minDist) * this.currentSpeed;
    this.vy = (dy / minDist) * this.currentSpeed * 0.45; // 缓和垂直跑动

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 限制在横版战场地表区域
    const minY = bounds.height * 0.52;
    const maxY = bounds.height * 0.90;
    if (this.y < minY) this.y = minY;
    if (this.y > maxY) this.y = maxY;

    return null;
  }

  /**
   * 纯命令式 Canvas 2D 高性能几何绘制
   */
  public draw(ctx: CanvasContextLike | any, frame: number): void {
    if (this.state === 'dead') return;

    ctx.save?.();
    ctx.translate?.(this.x, this.y);

    if (this.state === 'falling') {
      const alpha = Math.max(0, this.deathTimer / 30);
      ctx.globalAlpha = alpha;
      ctx.rotate?.((this.facing * Math.PI) / 6);
    } else {
      ctx.globalAlpha = 1.0;
    }

    // 镜像翻转朝向
    if (this.facing === -1) {
      ctx.scale?.(-1, 1);
    }

    // 行军起伏
    const bob = this.state === 'marching' ? Math.sin(frame * 0.22 + this.seed) * 2.2 : 0;
    const strike = this.state === 'fighting' ? Math.sin(frame * 0.45 + this.seed) * 5 : 0;
    const celeb = this.state === 'celebrating' ? -Math.abs(Math.sin(frame * 0.25 + this.seed)) * 6 : 0;
    const offsetY = bob + celeb;

    const badge = getUnitMeleeBadge(this.unitType);

    // 1. 战马轮廓（骑兵专享）
    if (badge.category === 'cavalry') {
      ctx.fillStyle = '#44403c';
      ctx.beginPath();
      ctx.ellipse?.(0, 5 + offsetY, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill?.();
      // 战马头部
      ctx.beginPath();
      ctx.ellipse?.(8, 2 + offsetY, 4, 3, -0.4, 0, Math.PI * 2);
      ctx.fill?.();
    }

    // 2. 战士身躯躯干（甲胄矩形）
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.rect?.(-this.radius, -this.radius + offsetY, this.radius * 2, this.radius * 2);
    ctx.fill?.();

    // 3. 头盔与赤缨
    ctx.fillStyle = '#78716c';
    ctx.beginPath();
    ctx.arc?.(0, -this.radius - 2 + offsetY, this.radius * 0.75, 0, Math.PI * 2);
    ctx.fill?.();

    ctx.fillStyle = '#ef4444'; // 赤红盔缨
    ctx.beginPath();
    ctx.arc?.(0, -this.radius - 5 + offsetY, 1.5, 0, Math.PI * 2);
    ctx.fill?.();

    // 4. 兵器几何绘制
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;

    if (badge.char === '枪') {
      // 长枪：枪杆 + 枪头
      ctx.strokeStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo?.(0, offsetY);
      ctx.lineTo?.(14 + strike, -2 + offsetY);
      ctx.stroke?.();

      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo?.(14 + strike, -4 + offsetY);
      ctx.lineTo?.(19 + strike, -2 + offsetY);
      ctx.lineTo?.(14 + strike, offsetY);
      ctx.closePath?.();
      ctx.fill?.();
    } else if (badge.category === 'archer') {
      // 弓弩：弓弧
      ctx.strokeStyle = '#a16207';
      ctx.beginPath();
      ctx.arc?.(4 + strike * 0.4, offsetY, 6, -Math.PI / 2, Math.PI / 2);
      ctx.stroke?.();
    } else {
      // 步兵与通用：环首刀与盾牌
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc?.(-2, offsetY, 3.5, 0, Math.PI * 2);
      ctx.fill?.();

      ctx.strokeStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo?.(2, 2 + offsetY);
      ctx.lineTo?.(8 + strike, -4 + offsetY);
      ctx.stroke?.();
    }

    // 5. 扣血后显示微型血条
    if (this.hp < this.maxHp && this.hp > 0) {
      const hpPct = Math.max(0, this.hp / this.maxHp);
      const barW = 12;
      const barH = 2;
      const barY = -this.radius - 9 + offsetY;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect?.(-barW / 2, barY, barW, barH);
      ctx.fillStyle = this.side === 'attacker' ? '#22c55e' : '#38bdf8';
      ctx.fillRect?.(-barW / 2, barY, barW * hpPct, barH);
    }

    ctx.restore?.();
  }
}

/**
 * 战阵军团粒子管理器 (SoldierSwarm)
 */
export class SoldierSwarm {
  public attackers: Soldier[] = [];
  public defenders: Soldier[] = [];
  public damageFloats: DamageFloat[] = [];
  public slashSparks: SlashSpark[] = [];
  public command: SwarmCommand = 'assault';
  private floatIdSeq = 0;

  /**
   * 初始化两军方阵粒子
   */
  public init(
    attackerConfig: { troops: number; unitType: UnitType | string; color?: string; name?: string },
    defenderConfig: { troops: number; unitType: UnitType | string; color?: string; name?: string },
    bounds: { width: number; height: number },
  ): void {
    this.attackers = [];
    this.defenders = [];
    this.damageFloats = [];
    this.slashSparks = [];

    const atkCount = calculateSoldierCount(attackerConfig.troops);
    const defCount = calculateSoldierCount(defenderConfig.troops);

    const groundTop = bounds.height * 0.54;
    const groundBottom = bounds.height * 0.88;

    // 攻方小兵散布（左翼方阵 60 ~ width * 0.38）
    for (let i = 0; i < atkCount; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = 60 + col * 26 + (Math.sin(i * 13) * 12);
      const y = groundTop + (row * 16) + (Math.cos(i * 7) * 8);
      this.attackers.push(
        new Soldier({
          id: i + 1,
          side: 'attacker',
          unitType: attackerConfig.unitType,
          x: Math.min(bounds.width * 0.42, Math.max(40, x)),
          y: Math.min(groundBottom, Math.max(groundTop, y)),
          color: attackerConfig.color,
          seed: i * 17 + 101,
          facing: 1,
        }),
      );
    }

    // 守方小兵散布（右翼方阵 width * 0.62 ~ width - 60）
    for (let j = 0; j < defCount; j++) {
      const col = j % 5;
      const row = Math.floor(j / 5);
      const x = bounds.width - 60 - col * 26 - (Math.sin(j * 11) * 12);
      const y = groundTop + (row * 16) + (Math.cos(j * 9) * 8);
      this.defenders.push(
        new Soldier({
          id: 1000 + j + 1,
          side: 'defender',
          unitType: defenderConfig.unitType,
          x: Math.max(bounds.width * 0.58, Math.min(bounds.width - 40, x)),
          y: Math.min(groundBottom, Math.max(groundTop, y)),
          color: defenderConfig.color,
          seed: j * 19 + 503,
          facing: -1,
        }),
      );
    }
  }

  /**
   * 触发战略指令（全军突击 / 坚守 / 鸣金收兵）
   */
  public setCommand(cmd: SwarmCommand): void {
    this.command = cmd;
  }

  /**
   * 施放武将计冲击波：对敌方阵型造成范围巨额震波与暴击飘字
   */
  public applySkillBlast(
    side: SoldierSide,
    damage: number,
    center: { x: number; y: number },
    radius = 160,
  ): void {
    const targets = side === 'attacker' ? this.defenders : this.attackers;
    for (const soldier of targets) {
      if (!soldier.alive) continue;
      const dist = Math.hypot(soldier.x - center.x, soldier.y - center.y);
      if (dist <= radius) {
        soldier.takeDamage(damage);
        this.addDamageFloat(`技能! -${damage}`, soldier.x, soldier.y - 12, '#fde047');
        this.addSlashSpark(soldier.x, soldier.y, Math.PI / 4, 22, '#f59e0b');
      }
    }
  }

  public addDamageFloat(text: string, x: number, y: number, color = '#fef08a'): void {
    this.damageFloats.push({
      id: ++this.floatIdSeq,
      text,
      x,
      y,
      color,
      alpha: 1.0,
      vy: 1.2,
    });
  }

  public addSlashSpark(x: number, y: number, angle: number, len = 16, color = '#fef08a'): void {
    this.slashSparks.push({
      x,
      y,
      angle,
      len,
      alpha: 1.0,
      color,
    });
  }

  /**
   * 物理与状态步进
   */
  public update(dt: number, bounds: { width: number; height: number }): void {
    // 攻方更新
    for (const atk of this.attackers) {
      const res = atk.update(dt, this.defenders, this.command, bounds);
      if (res) {
        const text = res.isCrit
          ? `暴击! -${res.damage}`
          : res.matchupLabel
            ? `${res.matchupLabel}! -${res.damage}`
            : `-${res.damage}`;
        const color = res.isCrit ? '#ef4444' : res.matchupColor ?? '#fef08a';
        this.addDamageFloat(text, res.x, res.y, color);
        this.addSlashSpark(res.x, res.y, (res.sourceId % 4) * (Math.PI / 4), 14, color);
      }
    }

    // 守方更新（守方始终迎击）
    for (const def of this.defenders) {
      const res = def.update(dt, this.attackers, 'assault', bounds);
      if (res) {
        const text = res.isCrit
          ? `暴击! -${res.damage}`
          : res.matchupLabel
            ? `${res.matchupLabel}! -${res.damage}`
            : `-${res.damage}`;
        const color = res.isCrit ? '#ef4444' : res.matchupColor ?? '#fef08a';
        this.addDamageFloat(text, res.x, res.y, color);
        this.addSlashSpark(res.x, res.y, -(res.sourceId % 4) * (Math.PI / 4), 14, color);
      }
    }

    // 更新飘字
    for (let i = this.damageFloats.length - 1; i >= 0; i--) {
      const df = this.damageFloats[i];
      df.y -= df.vy;
      df.alpha -= 0.024;
      if (df.alpha <= 0) {
        this.damageFloats.splice(i, 1);
      }
    }

    // 更新闪光刀弧
    for (let j = this.slashSparks.length - 1; j >= 0; j--) {
      const sp = this.slashSparks[j];
      sp.alpha -= 0.08;
      if (sp.alpha <= 0) {
        this.slashSparks.splice(j, 1);
      }
    }
  }

  /**
   * 纯命令式 Canvas 2D 综合渲染（小兵纵深 Y 轴排序 + 飘字 + 刀弧）
   */
  public draw(ctx: CanvasContextLike | any, frame: number): void {
    // 纵深 Y 轴排序，形成真实透视遮挡
    const all = [...this.attackers, ...this.defenders].sort((a, b) => a.y - b.y);
    for (const soldier of all) {
      soldier.draw(ctx, frame);
    }

    // 绘制刀光闪光
    for (const sp of this.slashSparks) {
      ctx.save?.();
      ctx.globalAlpha = sp.alpha;
      ctx.strokeStyle = sp.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo?.(sp.x - Math.cos(sp.angle) * sp.len, sp.y - Math.sin(sp.angle) * sp.len);
      ctx.lineTo?.(sp.x + Math.cos(sp.angle) * sp.len, sp.y + Math.sin(sp.angle) * sp.len);
      ctx.stroke?.();
      ctx.restore?.();
    }

    // 绘制浮字
    for (const df of this.damageFloats) {
      ctx.save?.();
      ctx.globalAlpha = df.alpha;
      ctx.font = 'bold 12px "Source Han Serif CN", "Songti SC", serif';
      ctx.fillStyle = df.color;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText?.(df.text, df.x - 16, df.y);
      ctx.restore?.();
    }
  }

  public getAliveCounts(): { attackers: number; defenders: number } {
    return {
      attackers: this.attackers.filter((a) => a.alive).length,
      defenders: this.defenders.filter((d) => d.alive).length,
    };
  }
}
