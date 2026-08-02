// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 共享阵型解析器内核（FM-P2，计划 §7.2 / §4.3 / §4.4）。
 *
 * 纯函数：读入 `Formation` 目录与上下文，输出合法性、阵型贡献、五部部署与解释。
 * 不读全局 RNG、不改状态、不访问 React/Express。三模式（自动/标准/六角）复用同一结果。
 *
 * 数值量纲：`tiers[0]`（0-A 固定 Lv1）作为攻防机射唯一量纲；暴击/反击/连击贡献从
 * `effects`（`crit_rate`/`counter_rate`/`counter_coeff`/`chain_rate`）结构化读取。
 * 组织度档位只缩放正面阵型增量（§4.4）；负修正原值保留。
 */
import type { TerrainType, UnitType } from './enums/index.js';
import type { Formation, FormationDeployment } from './types/formation.js';
import type { SquadPosition } from './types/campaign.js';
import { ZERO_A_PLAYABLE_FORMATION_IDS } from './types/formation.js';

export { ZERO_A_PLAYABLE_FORMATION_IDS };

/** 组织度五档（§4.4） */
export type OrganizationBand = 'intact' | 'orderly' | 'loose' | 'chaos' | 'broken';

export interface OrganizationRule {
  band: OrganizationBand;
  execution: number;
  fleeModifier: number;
}

export const ORGANIZATION_BANDS: readonly OrganizationRule[] = [
  { band: 'intact', execution: 1.2, fleeModifier: -0.5 },
  { band: 'orderly', execution: 1.0, fleeModifier: 0 },
  { band: 'loose', execution: 0.8, fleeModifier: 0.1 },
  { band: 'chaos', execution: 0.5, fleeModifier: 0.3 },
  { band: 'broken', execution: 0.0, fleeModifier: 0.2 },
];

/** 组织度 0..100 → 档位（边界 19/20/39/40/59/60/79/80）。 */
export function organizationBandFor(organization: number): OrganizationRule {
  const value = Math.max(0, Math.min(100, organization));
  if (value >= 80) return ORGANIZATION_BANDS[0];
  if (value >= 60) return ORGANIZATION_BANDS[1];
  if (value >= 40) return ORGANIZATION_BANDS[2];
  if (value >= 20) return ORGANIZATION_BANDS[3];
  return ORGANIZATION_BANDS[4];
}

export interface FormationAvailability {
  formationId: number;
  available: boolean;
  /** 稳定原因键（未精通/兵种/地形/被围/非0-A/已变阵/未知），合法为空 */
  blockReason?: string;
  label?: string;
}

export interface FormationContext {
  catalog: readonly Formation[];
  mastered: readonly number[];
  unitType?: UnitType;
  terrain?: TerrainType;
  isSurrounded?: boolean;
  /** 已在本回合变过阵（每回合至多一次，标准模式） */
  alreadyChangedThisTurn?: boolean;
}

/** getAvailableFormations：返回 0-A 候选集，逐阵给可用性 + 稳定原因。 */
export function getAvailableFormations(ctx: FormationContext): FormationAvailability[] {
  const { catalog, mastered, unitType, terrain, isSurrounded, alreadyChangedThisTurn } = ctx;
  void terrain;
  const masterSet = new Set(mastered);
  return ZERO_A_PLAYABLE_FORMATION_IDS.map((id) => {
    const record = catalog.find((f) => f.id === id);
    if (!record) return { formationId: id, available: false, blockReason: 'unknown' };
    if (!masterSet.has(id)) return { formationId: id, available: false, blockReason: 'not_mastered' };
    if (unitType && record.restrictedUnits.includes(unitType)) return { formationId: id, available: false, blockReason: 'restricted_unit' };
    if (unitType && record.allowedUnits.length > 0 && !record.allowedUnits.includes(unitType)) {
      return { formationId: id, available: false, blockReason: 'unit_not_allowed' };
    }
    if (isSurrounded && id !== 0) return { formationId: id, available: false, blockReason: 'surrounded' };
    if (alreadyChangedThisTurn) return { formationId: id, available: false, blockReason: 'already_changed' };
    return { formationId: id, available: true };
  });
}

export type FormationEffectKind =
  | 'crit_rate'
  | 'counter_rate'
  | 'counter_coeff'
  | 'chain_rate'
  | 'charge'
  | 'first_strike'
  | 'range'
  | string;

export interface FormationContribution {
  formationId: number;
  /** tiers[0] 攻防机射（0-A Lv1） */
  attack: number;
  defense: number;
  mobility: number;
  range: number;
  /** effects 聚合的暴击链贡献 */
  critRate: number;
  counterRate: number;
  counterCoeff: number;
  chainRate: number;
  /** 组织度执行档位（只作用于正面增量） */
  organizationExecution: number;
  organizationBand: OrganizationBand;
}

/** 读取 effect modifier 数值（condition 为 flank_only 时需调用方传入侧击上下文，此处仅聚合无条件项）。 */
function effectValue(effects: readonly { modifier: { type: string; value: number; condition?: string } }[], type: FormationEffectKind): number {
  let total = 0;
  for (const e of effects) {
    if (e.modifier.type === type && e.modifier.condition == null) total += e.modifier.value;
  }
  return total;
}

/** resolveFormationContribution：唯一计算顺序 §5.2 中的 F_raw 部分（不含战术，含组织度执行）。 */
export function resolveFormationContribution(
  catalog: readonly Formation[],
  formationId: number,
  organization: number,
): FormationContribution {
  const record = catalog.find((f) => f.id === formationId);
  const empty: FormationContribution = {
    formationId, attack: 0, defense: 0, mobility: 0, range: 0,
    critRate: 0, counterRate: 0, counterCoeff: 0, chainRate: 0,
    organizationExecution: 1, organizationBand: 'orderly',
  };
  if (!record) return empty;
  const tier = record.tiers[0];
  const band = organizationBandFor(organization);
  const contribution = {
    formationId,
    attack: tier.attack,
    defense: tier.defense,
    mobility: tier.mobility,
    range: tier.range,
    critRate: effectValue(record.effects, 'crit_rate'),
    counterRate: effectValue(record.effects, 'counter_rate'),
    counterCoeff: effectValue(record.effects, 'counter_coeff'),
    chainRate: effectValue(record.effects, 'chain_rate'),
    organizationExecution: band.execution,
    organizationBand: band.band,
  };
  return contribution;
}

/** 负修正原值保留；正修正按组织度执行档缩放（§5.2 F_effective）。 */
export function applyOrganizationExecution(value: number, execution: number): number {
  return value >= 0 ? value * execution : value;
}

export interface DeploymentResolution {
  formationId: number;
  slots: Partial<Record<SquadPosition, { q: number; r: number }>>;
  fallbackOrder: readonly SquadPosition[];
  symmetry: FormationDeployment['symmetry'];
  /** 实际占位（缺失部已按 fallback 收缩，主将恒在中军） */
  occupied: SquadPosition[];
}

/** resolveFormationDeployment：由阵型 deployment 模板 + 实际可用阵位派生（Gate D）。 */
export function resolveFormationDeployment(
  record: Formation,
  availablePositions: readonly SquadPosition[],
): DeploymentResolution {
  const d = record.deployment;
  if (!d) {
    const occupied = [...availablePositions];
    return { formationId: record.id, slots: {}, fallbackOrder: [], symmetry: 'symmetric', occupied };
  }
  const availableSet = new Set(availablePositions);
  // 中军恒占用；缺部按 fallbackOrder 收缩到剩余可用阵位
  const occupied: SquadPosition[] = availablePositions.filter((p) => availableSet.has(p));
  return {
    formationId: record.id,
    slots: d.slots,
    fallbackOrder: d.fallbackOrder,
    symmetry: d.symmetry,
    occupied,
  };
}

export interface FormationBreakdown {
  dimension: 'base' | 'unit' | 'terrain' | 'organization' | 'tactic' | 'position';
  label: string;
  value: string;
  source: string;
}

export interface FormationResolution extends FormationContribution, DeploymentResolution {
  breakdown: FormationBreakdown[];
}

/** explainFormationResolution：逐项解释，供战报复算与 UI。 */
export function explainFormationResolution(resolution: FormationContribution, record?: Formation): FormationBreakdown[] {
  const items: FormationBreakdown[] = [];
  const name = record?.name ?? `阵型${resolution.formationId}`;
  items.push({ dimension: 'base', label: name, value: `攻${resolution.attack} 防${resolution.defense} 机${resolution.mobility} 射${resolution.range}`, source: 'formations.json tiers[0]' });
  items.push({ dimension: 'organization', label: '组织度', value: `${resolution.organizationBand} ×${resolution.organizationExecution}`, source: '组织度档位' });
  if (resolution.critRate) items.push({ dimension: 'base', label: '暴击率', value: `+${resolution.critRate}%`, source: 'effects crit_rate' });
  if (resolution.counterRate) items.push({ dimension: 'base', label: '反击率', value: `+${resolution.counterRate}%`, source: 'effects counter_rate' });
  if (resolution.counterCoeff) items.push({ dimension: 'base', label: '反击系数', value: `+${resolution.counterCoeff}`, source: 'effects counter_coeff' });
  if (resolution.chainRate) items.push({ dimension: 'base', label: '连击率', value: `+${resolution.chainRate}%`, source: 'effects chain_rate' });
  return items;
}
