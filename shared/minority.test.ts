// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { Season } from './enums/index.js';
import {
  DEFAULT_MINORITY_TRIBES,
  MinorityTribeId,
  TribeThreatLevel,
  calculateTribeTensionDelta,
  canRecruitTribeTroops,
  canLeadTribeSubjugation,
  getTribeThreatLevel,
  isBorderWarden,
  TRIBAL_PACIFY_COST_GOLD,
  TRIBAL_PACIFY_TENSION_REDUCTION,
  TRIBAL_SUBDUE_MONTHS,
  TRIBAL_LEVY_BATCH_SIZE,
  TRIBAL_LEVY_COST_GOLD,
} from './minority.js';
import type { City } from './types/city.js';
import type { Officer } from './types/officer.js';

describe('Phase 7-07 边疆异族羁縻与朝贡互市纯函数契约 (shared/minority.ts)', () => {
  it('六大异族初始配置健全且各具地缘特色', () => {
    const tribes = Object.values(DEFAULT_MINORITY_TRIBES);
    expect(tribes).toHaveLength(6);

    const xiongnu = DEFAULT_MINORITY_TRIBES.xiongnu;
    expect(xiongnu.name).toBe('匈奴');
    expect(xiongnu.relatedProvinces).toContain('并州');
    expect(xiongnu.specialUnitName).toBe('匈奴突骑');
    expect(xiongnu.specialtyTribute).toBe('战马');
    expect(xiongnu.activeSeason).toBe('winter');

    const xianbei = DEFAULT_MINORITY_TRIBES.xianbei;
    expect(xianbei.name).toBe('鲜卑');
    expect(xianbei.relatedProvinces).toContain('幽州');
    expect(xianbei.specialUnitName).toBe('鲜卑突骑');

    const qiang = DEFAULT_MINORITY_TRIBES.qiang;
    expect(qiang.name).toBe('羌族');
    expect(qiang.relatedProvinces).toContain('凉州');

    const di = DEFAULT_MINORITY_TRIBES.di;
    expect(di.name).toBe('氐族');
    expect(di.relatedProvinces).toContain('益州');

    const shanyue = DEFAULT_MINORITY_TRIBES.shanyue;
    expect(shanyue.name).toBe('山越');
    expect(shanyue.relatedProvinces).toContain('扬州');
    expect(shanyue.activeSeason).toBe('all');

    const nanman = DEFAULT_MINORITY_TRIBES.nanman;
    expect(nanman.name).toBe('南蛮');
    expect(nanman.relatedProvinces).toContain('益州');
    expect(nanman.specialUnitName).toBe('藤甲兵');
    expect(nanman.specialtyTribute).toBe('象牙');
  });

  it('常量定义符合规范', () => {
    expect(TRIBAL_PACIFY_COST_GOLD).toBe(300);
    expect(TRIBAL_PACIFY_TENSION_REDUCTION).toBe(25);
    expect(TRIBAL_SUBDUE_MONTHS).toBe(24);
    expect(TRIBAL_LEVY_BATCH_SIZE).toBe(500);
    expect(TRIBAL_LEVY_COST_GOLD).toBe(500);
  });

  it('getTribeThreatLevel 准确划分 4 档威胁等级并安全夹紧', () => {
    expect(getTribeThreatLevel(0)).toBe(TribeThreatLevel.PACIFIED);
    expect(getTribeThreatLevel(29)).toBe(TribeThreatLevel.PACIFIED);
    expect(getTribeThreatLevel(30)).toBe(TribeThreatLevel.UNSETTLED);
    expect(getTribeThreatLevel(59)).toBe(TribeThreatLevel.UNSETTLED);
    expect(getTribeThreatLevel(60)).toBe(TribeThreatLevel.RAIDING);
    expect(getTribeThreatLevel(79)).toBe(TribeThreatLevel.RAIDING);
    expect(getTribeThreatLevel(80)).toBe(TribeThreatLevel.INVASION);
    expect(getTribeThreatLevel(100)).toBe(TribeThreatLevel.INVASION);
    expect(getTribeThreatLevel(150)).toBe(TribeThreatLevel.INVASION);
    expect(getTribeThreatLevel(-20)).toBe(TribeThreatLevel.PACIFIED);
  });

  it('isBorderWarden 准确判定统帅与武力双达标之镇边宿将', () => {
    const caoRen = {
      id: 1,
      name: '曹仁',
      stats: {
        leadership: 88,
        war: 84,
        intelligence: 70,
        politics: 60,
        charisma: 75,
      },
      faction: 1,
      location: 1,
      skills: [],
    } as unknown as Officer;
    expect(isBorderWarden(caoRen)).toBe(true);

    const weakOfficer = {
      ...caoRen,
      stats: {
        ...caoRen.stats,
        leadership: 75,
        war: 70,
      },
    } as unknown as Officer;
    expect(isBorderWarden(weakOfficer)).toBe(false);
  });

  it('calculateTribeTensionDelta 计算综合影响因子', () => {
    const xiongnu = { ...DEFAULT_MINORITY_TRIBES.xiongnu };

    // 1. 常规基础自然增长
    const delta1 = calculateTribeTensionDelta({
      tribe: xiongnu,
      season: Season.AUTUMN,
    });
    expect(delta1).toBe(1);

    // 2. 活跃季节偏转（匈奴冬季 +2）
    const deltaWinter = calculateTribeTensionDelta({
      tribe: xiongnu,
      season: Season.WINTER,
    });
    expect(deltaWinter).toBe(3); // 1 + 2 = 3

    // 3. 宿将镇边压制（-2）
    const warden = {
      id: 10,
      name: '牵招',
      stats: {
        leadership: 82,
        war: 78,
        intelligence: 75,
        politics: 70,
        charisma: 70,
      },
      faction: 1,
      location: 1,
      skills: [],
    } as unknown as Officer;
    const deltaWithWarden = calculateTribeTensionDelta({
      tribe: xiongnu,
      season: Season.WINTER,
      borderOfficers: [warden],
    });
    expect(deltaWithWarden).toBe(1); // 3 - 2 = 1

    // 4. 重兵慑边（>=15000 驻军，-1）
    const strongBorderCity: City = {
      id: 1,
      name: '晋阳',
      province: '并州',
      troops: 16000,
      gold: 2000,
      food: 5000,
      order: 80,
      defense: 100,
      officers: [],
      stats: { agriculture: 500, commerce: 500, defense: 100, order: 80 },
    };
    const deltaStrong = calculateTribeTensionDelta({
      tribe: xiongnu,
      season: Season.WINTER,
      borderOfficers: [warden],
      borderCities: [strongBorderCity],
    });
    // 3 (冬) - 2 (宿将) - 1 (兵力>=15000) - 1 (商业>=400) = -1
    expect(deltaStrong).toBe(-1);

    // 5. 讨平威慑期内变化严格为 0
    const subduedXiongnu = {
      ...xiongnu,
      isSubdued: true,
      subduedMonths: 18,
    };
    const deltaSubdued = calculateTribeTensionDelta({
      tribe: subduedXiongnu,
      season: Season.WINTER,
    });
    expect(deltaSubdued).toBe(0);
  });

  it('canRecruitTribeTroops 校验地缘、张力与资金条件', () => {
    const jinyang: City = {
      id: 1,
      name: '晋阳',
      province: '并州',
      troops: 5000,
      gold: 800,
      food: 2000,
      order: 80,
      defense: 100,
      officers: [],
      stats: { agriculture: 300, commerce: 300, defense: 100, order: 80 },
    };

    const xiongnuPacified = { ...DEFAULT_MINORITY_TRIBES.xiongnu, tension: 20 };
    expect(canRecruitTribeTroops(jinyang, xiongnuPacified).canRecruit).toBe(true);

    // 张力过高拦截
    const xiongnuUnsettled = { ...DEFAULT_MINORITY_TRIBES.xiongnu, tension: 45 };
    const resTension = canRecruitTribeTroops(jinyang, xiongnuUnsettled);
    expect(resTension.canRecruit).toBe(false);
    expect(resTension.reason).toContain('非羁縻顺服态');

    // 异地拦截（如江南扬州城池招匈奴骑兵）
    const jianye: City = { ...jinyang, name: '建业', province: '扬州' };
    const resLoc = canRecruitTribeTroops(jianye, xiongnuPacified);
    expect(resLoc.canRecruit).toBe(false);
    expect(resLoc.reason).toContain('非 匈奴 活跃边郡');

    // 钱财不足拦截
    const poorCity: City = { ...jinyang, gold: 100 };
    const resGold = canRecruitTribeTroops(poorCity, xiongnuPacified);
    expect(resGold.canRecruit).toBe(false);
    expect(resGold.reason).toContain('金钱不足');
  });

  it('canLeadTribeSubjugation 检定领军将领资质与创伤状态', () => {
    const maChao = {
      id: 5,
      name: '马超',
      stats: {
        leadership: 88,
        war: 97,
        intelligence: 50,
        politics: 40,
        charisma: 80,
      },
      faction: 2,
      location: 1,
      skills: [],
    } as unknown as Officer;
    expect(canLeadTribeSubjugation(maChao).canLead).toBe(true);

    // 文弱之士不可统兵出塞
    const scholar = {
      ...maChao,
      name: '书生',
      stats: {
        ...maChao.stats,
        leadership: 40,
        war: 35,
      },
    } as unknown as Officer;
    const resScholar = canLeadTribeSubjugation(scholar);
    expect(resScholar.canLead).toBe(false);
    expect(resScholar.reason).toContain('皆不足 70');

    // 重伤武将禁止出征
    const woundedMaChao = {
      ...maChao,
      injury: 3, // 重伤
    } as unknown as Officer;
    const resWounded = canLeadTribeSubjugation(woundedMaChao);
    expect(resWounded.canLead).toBe(false);
    expect(resWounded.reason).toContain('战创深重');
  });
});
