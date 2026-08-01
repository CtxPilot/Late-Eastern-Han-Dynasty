// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect } from 'vitest';
import {
  applyMeritDecay,
  deriveMeritPath,
  formationTroopCap,
  grantMerit,
  meritAttrBonusFor,
  meritEffects,
  meritEntry,
  meritLevelFor,
  meritNextThreshold,
  meritTitle,
  meritTroopBonus,
  militaryPositionRank,
  syncMerit,
  MAX_MERIT_LEVEL,
  MERIT_DECAY_FLOOR_LEVEL,
} from './merit.js';
import type { Officer } from './types/officer.js';
import { MilitaryPosition } from './enums/index.js';

function mkOfficer(partial: Partial<Officer> = {}): Officer {
  return {
    id: 1,
    name: 'test',
    birthYear: 160,
    deathYear: 220,
    stats: { leadership: 70, war: 70, intelligence: 70, politics: 70, charisma: 70 },
    hidden: {
      compatibility: 50, righteousness: 5, ambition: 5, valor: 3, composure: 3,
      lifespan: 60, growth: 'B', personality: 'brave', ideal: 'power', bloodline: [],
      ceilingBonus: null, power: 50, burst: 50, agility: 50, luck: 50, intuition: 50,
      awe: 50, strategy: 50, tactics: 50,
    },
    unitProficiency: {},
    formationMastery: [],
    skills: [],
    tags: [],
    faction: 1,
    location: 1,
    loyalty: 70,
    experience: 0,
    status: 'active',
    civilPosition: 'none',
    localPosition: 'none',
    militaryPosition: 'none',
    nobilityRank: 'none',
    merit: 0,
    stamina: 100,
    beauties: [],
    ...partial,
  } as Officer;
}

describe('meritLevelFor（20 级阈值反查）', () => {
  it('阈值边界与钳制', () => {
    expect(meritLevelFor(0)).toBe(1);
    expect(meritLevelFor(49)).toBe(1);
    expect(meritLevelFor(50)).toBe(2);
    expect(meritLevelFor(149)).toBe(2);
    expect(meritLevelFor(150)).toBe(3);
    expect(meritLevelFor(700)).toBe(5);
    expect(meritLevelFor(209999)).toBe(19);
    expect(meritLevelFor(210000)).toBe(20);
    expect(meritLevelFor(-5)).toBe(1);
  });

  it('等级表单调递增且末级为 20', () => {
    let prev = -1;
    for (const entry of meritEntry(1) && []) {
      void entry;
    }
    for (let lv = 1; lv <= MAX_MERIT_LEVEL; lv += 1) {
      const e = meritEntry(lv);
      expect(e.level).toBe(lv);
      expect(e.threshold).toBeGreaterThan(prev);
      prev = e.threshold;
    }
    expect(meritEntry(MAX_MERIT_LEVEL).threshold).toBe(210000);
  });
});

describe('称号 / 带兵 / 下一级', () => {
  it('文武称号与 neutral 回退', () => {
    expect(meritTitle(1, 'warrior')).toBe('白身');
    expect(meritTitle(2, 'warrior')).toBe('新锐');
    expect(meritTitle(3, 'scholar')).toBe('文吏');
    expect(meritTitle(10, 'warrior')).toBe('英雄');
    expect(meritTitle(10, 'scholar')).toBe('国士');
    expect(meritTitle(20, 'warrior')).toBe('天下第一');
    // neutral 且文武称号不同 → 白身（未分岔）
    expect(meritTitle(10, 'neutral')).toBe('白身');
    // neutral 且文武相同 → 取之（Lv1/2/20）
    expect(meritTitle(20, 'neutral')).toBe('天下第一');
  });

  it('带兵+ 随等级递增', () => {
    expect(meritTroopBonus(1)).toBe(0);
    expect(meritTroopBonus(2)).toBe(200);
    expect(meritTroopBonus(20)).toBe(15000);
    expect(meritTroopBonus(20)).toBeGreaterThan(meritTroopBonus(15));
  });

  it('meritNextThreshold：未满级给出下一级阈值，满级为 null', () => {
    expect(meritNextThreshold(0)).toEqual({ level: 2, threshold: 50 });
    expect(meritNextThreshold(49)).toEqual({ level: 2, threshold: 50 });
    expect(meritNextThreshold(50)).toEqual({ level: 3, threshold: 150 });
    expect(meritNextThreshold(210000)).toBeNull();
  });
});

describe('applyMeritDecay（docs/04 §十 6.3）', () => {
  it('70 岁以下不衰减', () => {
    expect(applyMeritDecay(5000, 12, 69, 4)).toBe(5000);
  });

  it('70+/75+/80+ 每季 0.3%/0.5%/1.0% 向下取整', () => {
    expect(applyMeritDecay(10000, 12, 70, 1)).toBe(9970);
    expect(applyMeritDecay(10000, 12, 75, 1)).toBe(9950);
    expect(applyMeritDecay(10000, 12, 80, 1)).toBe(9900);
  });

  it('多季连乘', () => {
    // 4 季 80+：10000 × 0.99^4 ≈ 9605.96 → 9605
    expect(applyMeritDecay(10000, 12, 80, 4)).toBe(9605);
  });

  it('保底 = min(10, peakMeritLevel)：到过 Lv10 的老将不跌破 Lv10 阈值', () => {
    const floor = meritEntry(MERIT_DECAY_FLOOR_LEVEL).threshold; // 7500
    expect(applyMeritDecay(7600, 12, 85, 100)).toBeGreaterThanOrEqual(floor);
    expect(applyMeritDecay(7600, 12, 85, 100)).toBe(floor);
  });

  it('生涯峰值低于 Lv10 时保底按峰值', () => {
    const floor3 = meritEntry(3).threshold; // 150
    // 4000 × 0.99^1000 ≈ 0.15 ≪ 150 → 保底生效
    expect(applyMeritDecay(4000, 3, 85, 1000)).toBe(floor3);
  });

  it('quarters<=0 不衰减', () => {
    expect(applyMeritDecay(10000, 12, 85, 0)).toBe(10000);
  });
});

describe('deriveMeritPath（Lv6 文武分岔：按官职轨道派生）', () => {
  it('武官 → warrior', () => {
    expect(deriveMeritPath(mkOfficer({ militaryPosition: 'general' as Officer['militaryPosition'] }))).toBe('warrior');
  });
  it('文官 / 地方文职 → scholar', () => {
    expect(deriveMeritPath(mkOfficer({ civilPosition: 'chancellor' as Officer['civilPosition'] }))).toBe('scholar');
    expect(deriveMeritPath(mkOfficer({ localPosition: 'prefect' as Officer['localPosition'] }))).toBe('scholar');
  });
  it('无官职 → neutral', () => {
    expect(deriveMeritPath(mkOfficer())).toBe('neutral');
  });
});

describe('grantMerit / syncMerit（发放与三字段同步）', () => {
  it('发放后 merit/meritLevel/peakMeritLevel 同步', () => {
    const base = mkOfficer({ merit: 700 }); // Lv5
    const synced = syncMerit(base);
    expect(synced.meritLevel).toBe(5);
    expect(synced.peakMeritLevel).toBe(5);
    expect(synced.meritPath).toBe('neutral');

    const granted = grantMerit(synced, 500); // 1200 → Lv6
    expect(granted.merit).toBe(1200);
    expect(granted.meritLevel).toBe(6);
    expect(granted.peakMeritLevel).toBe(6);
  });

  it('peakMeritLevel 只升不降（衰减后保级）', () => {
    const base = mkOfficer({ merit: 5000 }); // Lv9
    const synced = syncMerit(base);
    const decayed = syncMerit({ ...synced, merit: 3200 }); // 回落到 Lv8
    expect(decayed.meritLevel).toBe(8);
    expect(decayed.peakMeritLevel).toBe(9);
  });

  it('发放负数按 0 处理', () => {
    const base = mkOfficer({ merit: 100 });
    expect(grantMerit(base, -10).merit).toBe(100);
  });
});

describe('meritAttrBonusFor（等级表属性加成累计，Session 265）', () => {
  const at = (merit: number, path: Officer['meritPath'] = 'neutral', meritLevel?: number) =>
    meritAttrBonusFor({ merit, meritLevel, meritPath: path });

  it('Lv1~4 无属性加成', () => {
    expect(at(0)).toEqual({});
    expect(at(350)).toEqual({}); // Lv4
  });

  it('Lv5 体上限+3', () => {
    expect(at(700, 'neutral')).toEqual({ stamina: 3 });
  });

  it('Lv15 全属性+3（含 Lv5 体力，累计）', () => {
    const bonus = at(45000, 'neutral');
    expect(bonus.war).toBe(3);
    expect(bonus.leadership).toBe(3);
    expect(bonus.intelligence).toBe(3);
    expect(bonus.politics).toBe(3);
    expect(bonus.charisma).toBe(3);
    expect(bonus.stamina).toBe(3);
  });

  it('Lv16 文武分岔：武→统+5 / 文→政+5 / neutral→三属性+5', () => {
    const warrior = at(62000, 'warrior');
    expect(warrior.leadership).toBe(8); // Lv15 全+3 + Lv16 统+5
    expect(warrior.politics).toBe(3); // 文政不受 Lv16 影响
    expect(warrior.war).toBe(3);
    const scholar = at(62000, 'scholar');
    expect(scholar.politics).toBe(8);
    expect(scholar.leadership).toBe(3);
    const neutral = at(62000, 'neutral');
    expect(neutral.leadership).toBe(8);
    expect(neutral.war).toBe(8);
    expect(neutral.politics).toBe(8);
  });

  it('Lv17 全属性+5 / Lv20 全属性+8（累计）', () => {
    const lv17 = at(85000, 'neutral');
    expect(lv17.war).toBe(13); // Lv15 的 3 + Lv16 neutral 的 5 + Lv17 的 5
    const lv20 = at(210000, 'neutral');
    expect(lv20.war).toBe(21); // 3 + 5 + 5 + 8
    expect(lv20.stamina).toBe(3);
  });

  it('显式 meritLevel 优先于 merit 反查', () => {
    expect(at(0, 'neutral', 20).war).toBe(21);
  });
});

describe('meritEffects（等级表特殊效果数值，Session 265）', () => {
  it('武 Lv3/4/6 单挑 +5%/+10%/+15%；文不触发', () => {
    expect(meritEffects(2, 'warrior').duelBonus).toBe(0);
    expect(meritEffects(3, 'warrior').duelBonus).toBe(0.05);
    expect(meritEffects(4, 'warrior').duelBonus).toBe(0.1);
    expect(meritEffects(6, 'warrior').duelBonus).toBe(0.15);
    expect(meritEffects(6, 'scholar').duelBonus).toBe(0);
  });

  it('文 Lv3/4 开发 +5%/+10%；文 Lv6/9 内政效率 +10%', () => {
    expect(meritEffects(3, 'scholar').developBonus).toBe(0.05);
    expect(meritEffects(4, 'scholar').developBonus).toBe(0.1);
    expect(meritEffects(6, 'scholar').developBonus).toBe(0.1);
    expect(meritEffects(9, 'scholar').civilEfficiency).toBe(0.1);
    expect(meritEffects(6, 'scholar').civilEfficiency).toBe(0.1);
    expect(meritEffects(9, 'warrior').developBonus).toBe(0);
  });

  it('武 Lv9 暴率 +5%；Lv12 被俘 -20%；Lv14 适性+1；Lv20 体力恢复+5', () => {
    expect(meritEffects(9, 'warrior').critBonus).toBe(0.05);
    expect(meritEffects(8, 'warrior').critBonus).toBe(0);
    expect(meritEffects(12, 'neutral').captureResist).toBe(0.2);
    expect(meritEffects(11, 'neutral').captureResist).toBe(0);
    expect(meritEffects(14, 'neutral').proficiencyBoost).toBe(1);
    expect(meritEffects(13, 'neutral').proficiencyBoost).toBe(0);
    expect(meritEffects(20, 'neutral').staminaRecovery).toBe(5);
    expect(meritEffects(19, 'neutral').staminaRecovery).toBe(0);
  });
});

describe('formationTroopCap / militaryPositionRank（出征上限，Session 265）', () => {
  it('武官等级 rank：军候 1 → 大将军 4', () => {
    expect(militaryPositionRank(MilitaryPosition.NONE)).toBe(0);
    expect(militaryPositionRank(MilitaryPosition.CAPTAIN)).toBe(1);
    expect(militaryPositionRank(MilitaryPosition.COLONEL)).toBe(2);
    expect(militaryPositionRank(MilitaryPosition.GENERAL)).toBe(3);
    expect(militaryPositionRank(MilitaryPosition.GRAND_GENERAL)).toBe(4);
  });

  it('cap = 5000 + 武官×500 + 功绩带兵+', () => {
    const base = mkOfficer({ militaryPosition: MilitaryPosition.NONE as Officer['militaryPosition'] });
    expect(formationTroopCap({ ...base, merit: 0 })).toBe(5000);
    // 白身 Lv1 大将军：5000 + 2000 = 7000
    expect(formationTroopCap({ ...base, militaryPosition: MilitaryPosition.GRAND_GENERAL as Officer['militaryPosition'] })).toBe(7000);
    // Lv10 带兵+2200 + 大将军 rank×500 = 5000+2000+2200
    expect(formationTroopCap({ ...base, militaryPosition: MilitaryPosition.GRAND_GENERAL as Officer['militaryPosition'], merit: 7500 })).toBe(9200);
    // Lv20 带兵+15000 + 白身 rank0
    expect(formationTroopCap({ ...base, merit: 210000 })).toBe(20000);
  });

  it('显式 meritLevel 优先', () => {
    const base = mkOfficer({ merit: 0, meritLevel: 20 });
    expect(formationTroopCap(base)).toBe(20000);
  });
});
