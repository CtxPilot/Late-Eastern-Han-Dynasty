// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 六角战斗阵型贡献（FM-P3 · 唯一量纲 = formations.json tiers[0] 点值）。
 *
 * 与标准模式 `meleeRound.standardMeleeMods`、自动战斗 `campaign.autoFormationMods` 同源：
 * 三模式共读 `resolveFormationContribution`，各自按公式量纲做模式专用投影（计划 §5.1 允许）。
 *
 * 六角投影：tiers[0] 攻/防点值线性换算为 baseAttack/baseDefense 增量（兵种攻防约 5~20，
 * 点值 ±2~3 → ±约 4~7，可感知但不过量）；负修正原值保留。
 * 组织度执行档：BattleState/BattleUnit 暂无组织度字段，按 orderly(×1.0) 中性解析，
 * 随六角部署注入一并接入。
 */
import { type Formation } from '@leh/shared';
import { applyOrganizationExecution, resolveFormationContribution } from '@leh/shared';

/** 六角战斗阵型目录（服务端启动 `setHexFormationCatalog(staticData.formations)`；null 中性回退） */
let HEX_FORMATION_CATALOG: readonly Formation[] | null = null;

/** 注入六角战斗阵型目录（null 恢复中性回退，等价"无阵型加成"）。 */
export function setHexFormationCatalog(catalog: readonly Formation[] | null): void {
  HEX_FORMATION_CATALOG = catalog;
}

/** 六角模式专用投影系数（点值 → baseAttack/baseDefense 增量） */
export const HEX_FORM_ATK_GAIN = 2;
export const HEX_FORM_DEF_GAIN = 2.5;

/** 六角阵型修正：攻/防点值（组织度 orderly ×1.0 中性；负修正原值保留）。导出供战报复算/验证。 */
export function hexFormationMods(formation: number): { atk: number; def: number } {
  const catalog = HEX_FORMATION_CATALOG;
  if (!catalog) return { atk: 0, def: 0 };
  const contrib = resolveFormationContribution(catalog, formation, 60);
  const exec = contrib.organizationExecution;
  return {
    atk: applyOrganizationExecution(contrib.attack, exec) * HEX_FORM_ATK_GAIN,
    def: applyOrganizationExecution(contrib.defense, exec) * HEX_FORM_DEF_GAIN,
  };
}
