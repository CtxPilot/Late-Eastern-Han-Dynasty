// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { resolveExpression, type ExpressionInput } from './expression';
import { OfficerStatus } from './enums/index.js';
import type { OfficerHidden } from './types/officer.js';

// resolveExpression 不读取 hidden/stats 的具体数值（只用 officerId 分支），
// 因此测试夹具给一组占位值即可。
function makeInput(over: Partial<ExpressionInput> & { officerId: number }): ExpressionInput {
  const hidden = {
    compatibility: 50,
    righteousness: 50,
    ambition: 50,
    valor: 50,
    composure: 50,
    lifespan: 70,
    growth: 'medium',
    personality: 'balanced',
    ideal: 'balanced',
    bloodline: [],
    ceilingBonus: null,
    power: 50,
    burst: 50,
    agility: 50,
    luck: 50,
    intuition: 50,
    awe: 50,
    strategy: 50,
    tactics: 50,
  } as unknown as OfficerHidden;
  return {
    officerId: over.officerId,
    loyalty: over.loyalty ?? 80,
    stamina: over.stamina ?? 80,
    status: over.status ?? OfficerStatus.ACTIVE,
    stats: over.stats ?? { leadership: 50, war: 50, intelligence: 50, politics: 50, charisma: 50 },
    hidden,
    morale: over.morale,
    battle: over.battle,
  };
}

const LV_BU = 5;
const CAO_CAO = 1;
const ZHUGE_LIANG = 4;
const GENERIC = 2; // 非 3 原型，走通用回退

describe('resolveExpression — 3 原型胜/败（瞬时态）', () => {
  it('吕布胜 → victory + gold + transient', () => {
    const r = resolveExpression(makeInput({
      officerId: LV_BU,
      battle: { side: 'attacker', winner: 'attacker', morale: 80 },
    }));
    expect(r).toEqual({ expression: 'victory', backgroundTone: 'gold', transient: true });
  });

  it('吕布败 → anger + cold + transient', () => {
    const r = resolveExpression(makeInput({
      officerId: LV_BU,
      battle: { side: 'attacker', winner: 'defender', morale: 40 },
    }));
    expect(r).toEqual({ expression: 'anger', backgroundTone: 'cold', transient: true });
  });

  it('曹操作胜 → neutral(自信) + gold + transient', () => {
    const r = resolveExpression(makeInput({
      officerId: CAO_CAO,
      battle: { side: 'attacker', winner: 'attacker', morale: 80 },
    }));
    expect(r).toEqual({ expression: 'neutral', backgroundTone: 'gold', transient: true });
  });

  it('曹操作败 → ponder + cold + transient', () => {
    const r = resolveExpression(makeInput({
      officerId: CAO_CAO,
      battle: { side: 'defender', winner: 'attacker', morale: 40 },
    }));
    expect(r).toEqual({ expression: 'ponder', backgroundTone: 'cold', transient: true });
  });

  it('诸葛亮胜 → neutral(不动声色) + gold + transient', () => {
    const r = resolveExpression(makeInput({
      officerId: ZHUGE_LIANG,
      battle: { side: 'attacker', winner: 'attacker', morale: 80 },
    }));
    expect(r).toEqual({ expression: 'neutral', backgroundTone: 'gold', transient: true });
  });

  it('诸葛亮败 → ponder + cold + transient', () => {
    const r = resolveExpression(makeInput({
      officerId: ZHUGE_LIANG,
      battle: { side: 'defender', winner: 'attacker', morale: 40 },
    }));
    expect(r).toEqual({ expression: 'ponder', backgroundTone: 'cold', transient: true });
  });

  it('通用武将胜 → victory(标准) + gold + transient', () => {
    const r = resolveExpression(makeInput({
      officerId: GENERIC,
      battle: { side: 'attacker', winner: 'attacker', morale: 80 },
    }));
    expect(r).toEqual({ expression: 'victory', backgroundTone: 'gold', transient: true });
  });

  it('通用武将败 → defeat(标准) + cold + transient', () => {
    const r = resolveExpression(makeInput({
      officerId: GENERIC,
      battle: { side: 'defender', winner: 'attacker', morale: 40 },
    }));
    expect(r).toEqual({ expression: 'defeat', backgroundTone: 'cold', transient: true });
  });

  it('战斗进行中(winner=null) 不算瞬时态，回退持续态', () => {
    const r = resolveExpression(makeInput({
      officerId: LV_BU,
      loyalty: 80,
      battle: { side: 'attacker', winner: null, morale: 60 },
    }));
    expect(r.transient).toBe(false);
    expect(r.expression).toBe('neutral');
  });
});

describe('resolveExpression — 3 原型持续态（忠诚/stamina）', () => {
  it('吕布低忠诚 → reluctant + dark-red', () => {
    const r = resolveExpression(makeInput({ officerId: LV_BU, loyalty: 40 }));
    expect(r).toEqual({ expression: 'reluctant', backgroundTone: 'dark-red', transient: false });
  });

  it('曹操作低忠诚 → suspicion + dark-red', () => {
    const r = resolveExpression(makeInput({ officerId: CAO_CAO, loyalty: 40 }));
    expect(r).toEqual({ expression: 'suspicion', backgroundTone: 'dark-red', transient: false });
  });

  it('诸葛亮低忠诚 → suspicion + dark-red', () => {
    const r = resolveExpression(makeInput({ officerId: ZHUGE_LIANG, loyalty: 40 }));
    expect(r).toEqual({ expression: 'suspicion', backgroundTone: 'dark-red', transient: false });
  });

  it('吕布 stamina 低 → anger + grey', () => {
    const r = resolveExpression(makeInput({ officerId: LV_BU, stamina: 20 }));
    expect(r).toEqual({ expression: 'anger', backgroundTone: 'grey', transient: false });
  });

  it('曹操作 stamina 低 → ponder + grey', () => {
    const r = resolveExpression(makeInput({ officerId: CAO_CAO, stamina: 20 }));
    expect(r).toEqual({ expression: 'ponder', backgroundTone: 'grey', transient: false });
  });

  it('诸葛亮 stamina 低 → ponder + grey', () => {
    const r = resolveExpression(makeInput({ officerId: ZHUGE_LIANG, stamina: 20 }));
    expect(r).toEqual({ expression: 'ponder', backgroundTone: 'grey', transient: false });
  });

  it('通用武将低忠诚 → suspicion + dark-red', () => {
    const r = resolveExpression(makeInput({ officerId: GENERIC, loyalty: 40 }));
    expect(r).toEqual({ expression: 'suspicion', backgroundTone: 'dark-red', transient: false });
  });

  it('通用武将 stamina 低 → ponder + grey', () => {
    const r = resolveExpression(makeInput({ officerId: GENERIC, stamina: 20 }));
    expect(r).toEqual({ expression: 'ponder', backgroundTone: 'grey', transient: false });
  });
});

describe('resolveExpression — 互斥与背景透出规则', () => {
  it('胜仗 + 低忠诚（吕布）→ 表情 victory(瞬时) + 背景 dark-red(持续透出)', () => {
    const r = resolveExpression(makeInput({
      officerId: LV_BU,
      loyalty: 40,
      battle: { side: 'attacker', winner: 'attacker', morale: 80 },
    }));
    expect(r.expression).toBe('victory');
    expect(r.backgroundTone).toBe('dark-red');
    expect(r.transient).toBe(true);
  });

  it('败仗 + stamina 极低（吕布）→ 表情 anger(瞬时,吕布败) + 背景 grey(负伤透出)', () => {
    const r = resolveExpression(makeInput({
      officerId: LV_BU,
      stamina: 10,
      battle: { side: 'attacker', winner: 'defender', morale: 40 },
    }));
    expect(r.expression).toBe('anger');
    expect(r.backgroundTone).toBe('grey');
    expect(r.transient).toBe(true);
  });

  it('败仗 + stamina 极低（通用）→ 表情 defeat(标准败) + 背景 grey(负伤透出)', () => {
    const r = resolveExpression(makeInput({
      officerId: GENERIC,
      stamina: 10,
      battle: { side: 'attacker', winner: 'defender', morale: 40 },
    }));
    expect(r.expression).toBe('defeat');
    expect(r.backgroundTone).toBe('grey');
    expect(r.transient).toBe(true);
  });

  it('胜仗 + stamina 极低（吕布）→ 瞬时态优先，表情 victory + 背景 grey(负伤)', () => {
    const r = resolveExpression(makeInput({
      officerId: LV_BU,
      stamina: 10,
      battle: { side: 'attacker', winner: 'attacker', morale: 80 },
    }));
    expect(r.expression).toBe('victory');
    expect(r.backgroundTone).toBe('grey');
    expect(r.transient).toBe(true);
  });
});

describe('resolveExpression — status 锁定', () => {
  it('PRISONER → neutral + cold，忽略其余输入', () => {
    const r = resolveExpression(makeInput({
      officerId: LV_BU,
      loyalty: 20,
      stamina: 10,
      status: OfficerStatus.PRISONER,
      battle: { side: 'attacker', winner: 'attacker', morale: 80 },
    }));
    expect(r).toEqual({ expression: 'neutral', backgroundTone: 'cold', transient: false });
  });

  it('DEAD → neutral + grey', () => {
    const r = resolveExpression(makeInput({
      officerId: LV_BU,
      status: OfficerStatus.DEAD,
    }));
    expect(r).toEqual({ expression: 'neutral', backgroundTone: 'grey', transient: false });
  });

  it('FREE → neutral + neutral', () => {
    const r = resolveExpression(makeInput({
      officerId: LV_BU,
      status: OfficerStatus.FREE,
    }));
    expect(r).toEqual({ expression: 'neutral', backgroundTone: 'neutral', transient: false });
  });
});

describe('resolveExpression — 士气持续态与默认', () => {
  it('无 battle + 低士气 → ponder + neutral', () => {
    const r = resolveExpression(makeInput({ officerId: GENERIC, morale: 30 }));
    expect(r).toEqual({ expression: 'ponder', backgroundTone: 'neutral', transient: false });
  });

  it('无 battle + 高士气 → neutral + gold（背景透出积极）', () => {
    const r = resolveExpression(makeInput({ officerId: GENERIC, morale: 80 }));
    expect(r).toEqual({ expression: 'neutral', backgroundTone: 'gold', transient: false });
  });

  it('默认（一切正常）→ neutral + neutral', () => {
    const r = resolveExpression(makeInput({ officerId: GENERIC }));
    expect(r).toEqual({ expression: 'neutral', backgroundTone: 'neutral', transient: false });
  });
});

describe('resolveExpression — 确定性', () => {
  it('相同输入两次调用结果完全一致（不消耗 RNG）', () => {
    const input = makeInput({
      officerId: LV_BU,
      loyalty: 45,
      stamina: 25,
      morale: 50,
      battle: { side: 'attacker', winner: 'attacker', morale: 75 },
    });
    const a = resolveExpression(input);
    const b = resolveExpression(input);
    expect(a).toEqual(b);
  });
});
