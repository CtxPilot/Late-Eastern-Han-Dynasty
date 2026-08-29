// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * P2-5（Session 417）：turn.ts 月结管线 golden tests（server 单测起步）。
 *
 * 与 verify-* 确定性脚本互补：
 *   - 金样文件 `__fixtures__/turn-golden-12.json`：12 个月逐月指纹（年月/资源/武将数/存活势力）
 *     + 终态全量摘要哈希。引擎有意变更时删除金样文件重跑自举再提交。
 *   - 双局确定性：同种子 24 个月终态逐字节一致（零 RNG 漂移守护）。
 *   - 结构不变量：月度节拍、行动次数重置、actionLog 终止项。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createGame, endTurn, getGame } from '../services/game.js';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'turn-golden-12.json');

function sorted(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(sorted).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.entries(v as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, val]) => `${k}:${sorted(val)}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

function digest(v: unknown): string {
  const s = sorted(v);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, '0')}(${s.length})`;
}

interface MonthFingerprint {
  y: number;
  m: number;
  gold: number;
  food: number;
  officers: number;
  alive: number;
}

function playerSnapshot(): MonthFingerprint {
  const g = getGame();
  const faction = g.factions[g.playerFactionId];
  return {
    y: g.currentYear,
    m: g.currentMonth,
    gold: faction.gold,
    food: faction.food,
    officers: Object.keys(g.officers).length,
    alive: Object.values(g.factions).filter((f) => f.isAlive).length,
  };
}

/** 跑 N 个月，返回逐月指纹与终态摘要。 */
function runMonths(n: number): { prints: MonthFingerprint[]; final: string } {
  createGame(1, 2);
  const prints: MonthFingerprint[] = [];
  for (let i = 0; i < n; i++) {
    endTurn();
    prints.push(playerSnapshot());
  }
  return { prints, final: digest(getGame()) };
}

describe('turn.ts 月结管线（P2-5 golden）', () => {
  it('12 个月金样：逐月指纹与终态摘要匹配', () => {
    const { prints, final } = runMonths(12);
    if (!existsSync(FIXTURE)) {
      // 自举：首次运行写入金样（引擎有意变更时删除本文件重跑再提交）
      mkdirSync(dirname(FIXTURE), { recursive: true });
      writeFileSync(FIXTURE, `${JSON.stringify({ months: prints, finalDigest: final }, null, 2)}\n`);
      console.log(`  ℹ 金样自举写入 ${FIXTURE}`);
      return;
    }
    const golden = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
      months: MonthFingerprint[];
      finalDigest: string;
    };
    expect(golden.months).toEqual(prints);
    expect(golden.finalDigest).toBe(final);
  });

  it('双局 24 个月终态确定性（零 RNG 漂移）', () => {
    const a = runMonths(24);
    const b = runMonths(24);
    expect(b.final).toBe(a.final);
  });

  it('结构不变量：月度节拍、行动次数重置、actionLog 终止项', () => {
    createGame(1, 2);
    const officerCount = Object.keys(getGame().officers).length;
    for (let i = 0; i < 6; i++) {
      const before = { y: getGame().currentYear, m: getGame().currentMonth };
      endTurn();
      const g = getGame();
      // 月度节拍：月份 +1（跨年 12→1）
      expect(g.currentMonth).toBe(before.m === 12 ? 1 : before.m + 1);
      if (before.m === 12) expect(g.currentYear).toBe(before.y + 1);
      // 行动次数重置 + 武将数不减
      expect(Object.values(g.officers).every((o) => o.actionsPerMonth === 1)).toBe(true);
      expect(Object.keys(g.officers).length).toBe(officerCount);
      // 月结终止项：end_turn 条目存在（后续 AI 行军/军情日志会前插其上）
      expect(g.actionLog.some((e) => e.type === 'end_turn' && e.month === g.currentMonth)).toBe(true);
    }
  });
});
