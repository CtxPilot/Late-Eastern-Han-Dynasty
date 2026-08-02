// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { computeTacticalRange, findTacticalPath, parseTacticalHexKey, tacticalHexDistance, tacticalHexToPixel, tacticalMoveCost, tacticalPixelToHex, validateTacticalGrid, type TacticalGrid } from './tactical-grid.js';

const grid = (w: number, h: number): TacticalGrid => ({ width: w, height: h, cells: Array.from({ length: h }, () => Array.from({ length: w }, () => ({ terrain: 'plain' as const }))) });
const foot = { mobility: 'foot' as const };

describe('tactical-grid', () => {
  it('轴向坐标、像素互转与 key 严格解析', () => {
    expect(tacticalHexDistance({ q: 0, r: 0 }, { q: 3, r: 2 })).toBe(5);
    const p = tacticalHexToPixel({ q: 7, r: 4 }, 28, { x: 50, y: 50 });
    expect(tacticalPixelToHex(p.x, p.y, 28, { x: 50, y: 50 })).toEqual({ q: 7, r: 4 });
    expect(parseTacticalHexKey('7,4')).toEqual({ q: 7, r: 4 });
    expect(() => parseTacticalHexKey('x,4')).toThrow('INVALID_HEX_KEY');
  });
  it('拒绝超过100×100或行宽漂移', () => {
    expect(() => validateTacticalGrid(grid(100, 100))).not.toThrow();
    expect(() => validateTacticalGrid({ ...grid(1, 1), width: 101 })).toThrow('INVALID_GRID');
  });
  it('通行矩阵区分水军、步军和实体障碍', () => {
    expect(tacticalMoveCost({ terrain: 'forest' }, foot)).toBe(2);
    expect(tacticalMoveCost({ terrain: 'water' }, foot)).toBe(Infinity);
    expect(tacticalMoveCost({ terrain: 'water' }, { mobility: 'naval' })).toBe(4);
    expect(tacticalMoveCost({ terrain: 'plain', obstacle: 'building' }, foot)).toBe(Infinity);
  });
  it('A* 绕开障碍并计算逐步消耗和剩余移动力', () => {
    const g = grid(8, 8); g.cells[0][1] = { terrain: 'plain', obstacle: 'barricade' }; g.cells[0][3] = { terrain: 'mountain', elevation: 1 };
    const result = findTacticalPath(g, { q: 0, r: 0 }, { q: 3, r: 0 }, 10, foot);
    expect(result.found).toBe(true); expect(result.path.some((s) => s.coord.q === 1 && s.coord.r === 0)).toBe(false);
    expect(result.path.at(-1)?.remaining).toBe(10 - result.totalCost);
    expect(result.path.some((s) => s.animation === 'climb')).toBe(true);
  });
  it('边界、阻挡与移动力不足返回可追踪错误码', () => {
    const g = grid(3, 3); g.cells[0][2] = { terrain: 'wall' };
    expect(findTacticalPath(g, { q: 0, r: 0 }, { q: 4, r: 0 }, 9, foot).reason).toBe('OUT_OF_BOUNDS');
    expect(findTacticalPath(g, { q: 0, r: 0 }, { q: 2, r: 0 }, 9, foot).reason).toBe('BLOCKED');
    expect(findTacticalPath(g, { q: 0, r: 0 }, { q: 1, r: 1 }, 1, foot).reason).toBe('UNREACHABLE');
  });
  it('范围按真实地形成本给出剩余点数', () => {
    const g = grid(4, 4); g.cells[0][1] = { terrain: 'forest' };
    const range = computeTacticalRange(g, { q: 0, r: 0 }, 3, foot);
    expect(range.get('1,0')).toBe(1); expect(range.get('0,1')).toBe(2); expect(range.has('2,0')).toBe(true); expect(range.has('3,0')).toBe(false);
  });
  it('100×100 A* 性能门禁低于100ms', () => {
    const g = grid(100, 100); const started = performance.now();
    const result = findTacticalPath(g, { q: 0, r: 0 }, { q: 99, r: 99 }, 220, foot);
    const elapsed = performance.now() - started;
    expect(result.found).toBe(true); expect(elapsed).toBeLessThan(100);
  });
});
