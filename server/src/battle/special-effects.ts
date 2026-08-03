// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { BattleStatusEffect, CombatAbilityDef } from '@leh/shared';

/**
 * S10 战法效果的唯一状态映射；玩家施放与敌军 AI 必须共用，避免 fire 等
 * 数据效果在两条执行路径中落成不同的 BattleStatusEffect type。
 */
export function applySpecialEffect(
  ability: CombatAbilityDef,
  effects: BattleStatusEffect[],
  level: number,
): string {
  switch (ability.specialEffect) {
    case 'stun':
      effects.push({ type: 'stun', remainingTurns: 1, value: level });
      return '（眩晕）';
    case 'knockback':
      effects.push({ type: 'knockback', remainingTurns: 1, value: level });
      return '（击退）';
    case 'fire':
      effects.push({ type: 'burn', remainingTurns: level >= 4 ? 2 : 1, value: Math.max(1, Math.floor(level * 5)) });
      return '（起火）';
    case 'confusion':
      effects.push({ type: 'confusion', remainingTurns: 1, value: level });
      return '（混乱）';
    case 'charge':
      effects.push({ type: 'charge', remainingTurns: 1, value: level });
      return '（冲锋）';
    case 'pierce':
      return '（贯穿）';
    case 'aoe':
      return '（范围）';
    case 'morale':
      return '（降士气）';
    default:
      return '';
  }
}
