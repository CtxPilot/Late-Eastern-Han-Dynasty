// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-07 边疆异族羁縻、朝贡互市与寇边讨伐体系数据模型与契约
 */

export type MinorityTribeId = 'xiongnu' | 'xianbei' | 'qiang' | 'di' | 'shanyue' | 'nanman';

/**
 * 边疆异族威胁与张力等级（docs/04 §7.2）
 */
export enum TribeThreatLevel {
  PACIFIED = 0,   // 羁縻顺服 (0~29)：安居互市，可进贡、可征募特种兵
  UNSETTLED = 1,  // 暗流骚动 (30~59)：风声鹤唳，偶有轻微袭扰
  RAIDING = 2,    // 寇边劫掠 (60~79)：洗劫边城金粮，损耗民心
  INVASION = 3,   // 大举入侵 (80~100)：猛攻边寨，损伤城防与驻军
}

/**
 * 少数民族静态配置与运行时动态状态实体
 */
export interface MinorityTribe {
  id: MinorityTribeId;
  name: string;               // 民族名称（匈奴 / 鲜卑 / 羌 / 氐 / 山越 / 南蛮）
  regionName: string;         // 活跃地缘（并州北 / 幽州北 / 凉州 / 凉益交界 / 扬州山地 / 益州南部）
  relatedProvinces: string[]; // 关联的汉地边郡州部列表
  tension: number;            // 紧张度 0~100 (0=极度顺服亲善, 100=剑拔弩张大举寇边)
  specialUnitName: string;    // 特色兵种（匈奴突骑、鲜卑突骑、羌兵、氐族步兵、山越兵、藤甲兵）
  specialtyTribute: string;   // 朝贡特产（战马、角弓、良马、药材、生铜、象牙）
  activeSeason?: 'spring' | 'summer' | 'autumn' | 'winter' | 'all'; // 活跃季节偏转
  isSubdued?: boolean;        // 是否处于大捷讨平威慑期
  subduedMonths?: number;     // 威慑平静期剩余月数（期间紧张度锁定为 0，不敢寇边）
  tributeCooldown?: number;   // 进贡冷却月数
}
