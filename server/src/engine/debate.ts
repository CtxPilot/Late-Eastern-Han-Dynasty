// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { DebateCardType } from '@leh/shared';
import type { OfficerStatic, DebateState, DebateSide, DebateCardValues } from '@leh/shared';

const ALL_CARDS: DebateCardType[] = [
  DebateCardType.REASON,
  DebateCardType.EMOTION,
  DebateCardType.CLASSIC,
  DebateCardType.SOPHISTRY,
];

function computeCardValues(officer: OfficerStatic): DebateCardValues {
  const s = officer.stats;
  const h = officer.hidden;
  return {
    [DebateCardType.REASON]: Math.floor(s.politics / 2),
    [DebateCardType.EMOTION]: Math.floor(s.charisma / 2),
    [DebateCardType.CLASSIC]: Math.floor(h.strategy / 2),
    [DebateCardType.SOPHISTRY]: Math.floor(h.tactics / 2),
  };
}

function initSide(officer: OfficerStatic): DebateSide {
  const argument = Math.floor(officer.stats.intelligence / 2 + officer.hidden.strategy / 4);
  return {
    officerId: officer.id,
    argument: Math.max(5, argument),
    maxArgument: Math.max(5, argument),
    cardValues: computeCardValues(officer),
  };
}

export function initDebate(
  attacker: OfficerStatic,
  defender: OfficerStatic,
  id: string,
): DebateState {
  return {
    id,
    attacker: initSide(attacker),
    defender: initSide(defender),
    turn: 0,
    currentSide: 'attacker',
    phase: 'select',
    log: [],
    result: null,
  };
}

const CARD_LABEL: Record<DebateCardType, string> = {
  [DebateCardType.REASON]: '道理',
  [DebateCardType.EMOTION]: '感情',
  [DebateCardType.CLASSIC]: '典故',
  [DebateCardType.SOPHISTRY]: '诡辩',
};

function applyDamage(
  state: DebateState,
  target: 'attacker' | 'defender',
  damage: number,
  logMsg: string,
): void {
  const side = state[target];
  const prev = side.argument;
  side.argument = Math.max(0, side.argument - damage);
  state.log.push(`${logMsg}（${prev}→${side.argument}）`);
  if (side.argument <= 0) {
    state.phase = 'done';
    const winnerId = state[target === 'attacker' ? 'defender' : 'attacker'].officerId;
    state.result = {
      winnerId,
      loserId: side.officerId,
      rounds: state.turn + 1,
      reason: '论据耗尽',
    };
  }
}

export function playCard(
  state: DebateState,
  card: DebateCardType,
  acceptSophistryHack?: boolean,
): DebateState {
  const curKey = state.currentSide;
  const oppKey: 'attacker' | 'defender' = curKey === 'attacker' ? 'defender' : 'attacker';
  const cur = state[curKey];
  const opp = state[oppKey];
  const atkVal = cur.cardValues[card];

  state.log.push(`第${state.turn + 1}回合·${curKey === 'attacker' ? '攻方' : '守方'}出【${CARD_LABEL[card]}】`);

  let damage = atkVal;

  if (card === DebateCardType.SOPHISTRY) {
    const threshold = Math.floor(opp.argument / 2);
    if (atkVal > threshold || acceptSophistryHack) {
      damage = Math.floor(atkVal * 1.5);
      applyDamage(state, oppKey, damage, `诡辩破防！+${damage - atkVal}额外伤害`);
    } else {
      applyDamage(state, oppKey, damage, `诡辩未破防`);
    }
  } else if (card === DebateCardType.EMOTION) {
    const bonusDmg = Math.floor(opp.argument * 0.1);
    damage += bonusDmg;
    applyDamage(state, oppKey, damage, `感情攻击（含士气削${bonusDmg}）`);
  } else {
    applyDamage(state, oppKey, damage, `${CARD_LABEL[card]}攻击`);
  }

  if (state.result) return state;

  state.turn++;
  state.currentSide = curKey === 'attacker' ? 'defender' : 'attacker';
  state.phase = 'select';
  return state;
}

export function aiChooseCard(state: DebateState): DebateCardType {
  const cur = state[curKey(state)];
  const opp = state[oppKey(state)];
  const cards = ALL_CARDS.slice();

  cards.sort((a, b) => {
    if (cur.cardValues[a] < opp.argument * 0.3) return 1;
    if (cur.cardValues[b] < opp.argument * 0.3) return -1;
    return cur.cardValues[b] - cur.cardValues[a];
  });

  const card = cards[0];
  if (card === DebateCardType.SOPHISTRY && cur.cardValues[card] > opp.argument * 0.3) {
    return card;
  }
  return card;
}

function curKey(state: DebateState): 'attacker' | 'defender' {
  return state.currentSide;
}

function oppKey(state: DebateState): 'attacker' | 'defender' {
  return state.currentSide === 'attacker' ? 'defender' : 'attacker';
}
