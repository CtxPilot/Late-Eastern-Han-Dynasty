// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  NobilityRank,
  OfficerStatus,
  NOBILITY_LABELS,
  nextNobilityRank,
  type GameState,
} from '@leh/shared';

export function nobilityPromotionCost(target: NobilityRank): number {
  return target === NobilityRank.DUKE ? 20 : 10;
}

/** HC-P1-4 王命封爵：终身、逐级，臣属上限为公。 */
export function grantNobility(
  state: GameState,
  factionId: number,
  officerId: number,
  targetRank: NobilityRank,
): GameState {
  const faction = state.factions[factionId];
  if (!faction?.isAlive) throw new Error('势力不存在或已灭亡');
  const stage = faction.politicalStage ?? 'vassal';
  if (stage !== 'king' && stage !== 'emperor') {
    throw new Error('王命封爵仅限称王或称帝势力');
  }
  const officer = state.officers[officerId];
  if (!officer) throw new Error('武将不存在');
  if (officerId === faction.rulerId) throw new Error('不可对君主本人使用王命封爵');
  if (officer.faction !== factionId) throw new Error('只能册封同势力武将');
  if (officer.status !== OfficerStatus.ACTIVE) throw new Error('受封者必须为在职武将');

  const next = nextNobilityRank(officer.nobilityRank);
  if (next == null || next === NobilityRank.KING || next === NobilityRank.EMPEROR) {
    throw new Error('臣属爵位上限为公');
  }
  if (targetRank !== next) throw new Error('爵位必须逐级晋升，不可越级');

  const cost = nobilityPromotionCost(targetRank);
  const authority = faction.imperialAuthority ?? 0;
  if (authority < cost) throw new Error(`皇权不足（需${cost}，当前${authority}）`);

  return {
    ...state,
    factions: {
      ...state.factions,
      [factionId]: { ...faction, imperialAuthority: authority - cost },
    },
    officers: {
      ...state.officers,
      [officerId]: { ...officer, nobilityRank: targetRank },
    },
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type: 'grant_nobility',
        message: `王命册封 ${officer.name} 为${NOBILITY_LABELS[targetRank]}（皇权-${cost}）`,
      },
      ...state.actionLog,
    ].slice(0, 80),
  };
}
