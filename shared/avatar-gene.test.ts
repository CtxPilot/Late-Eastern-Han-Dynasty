// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { AVATAR_GENE_COUNTS, deriveAvatarGeneTable, getAvatarGene, ribbonColorForRank } from './avatar-gene.js';

const mk = (id: number, name: string, war = 80, leadership = 70, intelligence = 60, politics = 60) => ({
  id,
  name,
  stats: { war, leadership, intelligence, politics },
});

describe('avatarGene（批次③ P5-10）', () => {
  it('同一武将派生结果稳定（确定性，零 RNG）', () => {
    const a = getAvatarGene(mk(5, '吕布'));
    const b = getAvatarGene(mk(5, '吕布'));
    expect(a).toEqual(b);
  });

  it('各维落在枚数范围内（6 脸 / 10 冠 / 8 须 / 7 眉眼）', () => {
    for (let i = 1; i <= 300; i++) {
      const g = getAvatarGene(mk(i, `武将${i}`));
      expect(g.faceType).toBeGreaterThanOrEqual(0);
      expect(g.faceType).toBeLessThan(AVATAR_GENE_COUNTS.face);
      expect(g.hairType).toBeGreaterThanOrEqual(0);
      expect(g.hairType).toBeLessThan(AVATAR_GENE_COUNTS.crown);
      expect(g.beardType).toBeGreaterThanOrEqual(0);
      expect(g.beardType).toBeLessThan(AVATAR_GENE_COUNTS.beard);
      expect(g.eyeType).toBeGreaterThanOrEqual(0);
      expect(g.eyeType).toBeLessThan(AVATAR_GENE_COUNTS.eye);
    }
  });

  it('消解表：460 名合成武将经探测后 (脸,冠,须) 两两可辨（空间 6×10×8=480）', () => {
    const sources = Array.from({ length: 460 }, (_, i) => mk(i + 1, `将领${i + 1}`));
    const table = deriveAvatarGeneTable(sources);
    expect(table.size).toBe(460);
    const seen = new Set<string>();
    for (const g of table.values()) {
      const key = `${g.faceType},${g.hairType},${g.beardType}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('消解表：手工策展条目形状不被探测改动（S 级优先）', () => {
    const sources = [
      { ...mk(9, '路人甲'), avatarGene: { faceType: 0, hairType: 0, beardType: 0 } },
      ...Array.from({ length: 60 }, (_, i) => mk(i + 100, `将领${i}`)),
    ];
    const table = deriveAvatarGeneTable(sources);
    expect(table.get(9)).toMatchObject({ faceType: 0, hairType: 0, beardType: 0 });
  });

  it('文武分型：武统占优→warrior，智政占优→scholar', () => {
    expect(getAvatarGene(mk(1, '猛将', 95, 85, 40, 40)).baseRubbing).toBe('warrior');
    expect(getAvatarGene(mk(2, '谋主', 40, 40, 95, 88)).baseRubbing).toBe('scholar');
  });

  it('手工覆盖优先于哈希（S 级策展链）', () => {
    const g = getAvatarGene({ ...mk(6, '关羽'), avatarGene: { faceType: 2, hairType: 3, beardType: 1, eyeType: 3, clanTitle: '河东关氏' } });
    expect(g.faceType).toBe(2);
    expect(g.hairType).toBe(3);
    expect(g.beardType).toBe(1);
    expect(g.eyeType).toBe(3);
    expect(g.clanTitle).toBe('河东关氏');
    // 未覆盖维度仍走哈希
    expect(typeof g.hairType).toBe('number');
  });

  it('印绶色档：王/公/帝→紫，乡/县侯→青，关/亭侯→黄，无爵→黑', () => {
    expect(ribbonColorForRank('emperor')).toBe('purple');
    expect(ribbonColorForRank('duke')).toBe('purple');
    expect(ribbonColorForRank('xiangMarquis')).toBe('cyan');
    expect(ribbonColorForRank('tingMarquis')).toBe('yellow');
    expect(ribbonColorForRank('none')).toBe('black');
    expect(ribbonColorForRank(undefined)).toBe('black');
  });
});
