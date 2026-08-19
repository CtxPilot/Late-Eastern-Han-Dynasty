// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 主线③续 · L2 趁火打劫冒烟（Session 344）
 * 运行: pnpm verify-l2-strike-while-hot
 */
import {
  DipRelation,
  PlotStage,
  PlotType,
  UnitType,
  type GameState,
} from '@leh/shared';
import { GameStatePlotSchema } from '@leh/shared';
import {
  STRIKE_WHILE_HOT_FIRST_HIT_MUL,
  STRIKE_WHILE_HOT_GOLD,
  STRIKE_WHILE_HOT_MIN_WARS,
  cancelPlot,
  countWarsForFaction,
  getStrikeWhileHotFirstHitMul,
  launchPlot,
} from '../engine/plot.js';
import { runAutoBattle } from '../engine/campaign.js';
import { createGame, getGame } from '../services/game.js';

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

function makeRng(seq: number[]): () => number {
  let i = 0;
  return () => {
    const v = seq[i] ?? 0.5;
    i += 1;
    return v;
  };
}

function enrichGold(state: GameState, factionId: number, gold: number): GameState {
  const city = Object.values(state.cities).find((c) => c.ruler === factionId);
  if (!city) return state;
  return {
    ...state,
    cities: {
      ...state.cities,
      [city.id]: { ...city, gold: city.gold + gold },
    },
  };
}

/** 让 targetFaction 与给定势力列表全部 WAR（确保多线交战前置） */
function setWars(state: GameState, targetFactionId: number, enemies: number[]): GameState {
  const diplomacy = [...(state.diplomacy ?? [])];
  for (const e of enemies) {
    const existing = diplomacy.find((l) =>
      (l.factionA === targetFactionId && l.factionB === e) ||
      (l.factionA === e && l.factionB === targetFactionId),
    );
    if (existing) {
      existing.relation = DipRelation.WAR;
      existing.favorability = -80;
    } else {
      diplomacy.push({ factionA: targetFactionId, factionB: e, relation: DipRelation.WAR, favorability: -80 });
    }
  }
  return { ...state, diplomacy };
}

console.log('L2 strikeWhileHot verify');

createGame(1, 1);
let state = getGame();
const player = state.playerFactionId;

// 找非玩家存续势力作为目标
const targetFac = Object.values(state.factions).find((f) => f.id !== player && f.isAlive);
assert(!!targetFac, '存在非玩家存续势力');
const target = targetFac!.id;

// 无前置（目标未多线交战）→ 拒绝
let noWarRejected = false;
try {
  launchPlot(
    state,
    { type: PlotType.STRIKE_WHILE_HOT, factionId: player, targetFactionId: target },
    () => 0.1,
  );
} catch (e) {
  noWarRejected = e instanceof Error && e.message.includes('交战');
}
assert(noWarRejected, '目标未同时与≥2家交战时发起被拒绝');

// 只与 1 家交战 → 仍拒绝
state = setWars(state, target, [player]);
let oneWarRejected = false;
try {
  launchPlot(
    state,
    { type: PlotType.STRIKE_WHILE_HOT, factionId: player, targetFactionId: target },
    () => 0.1,
  );
} catch (e) {
  oneWarRejected = e instanceof Error && e.message.includes('交战');
}
assert(oneWarRejected, '仅 1 家交战时仍被拒绝');

// 同时与 2 家交战 → 金不足拒绝
state = setWars(state, target, [player, player + 99]);
const lowGold = {
  ...state,
  cities: Object.fromEntries(
    Object.values(state.cities).map((c) =>
      c.ruler === player
        ? [c.id, { ...c, gold: STRIKE_WHILE_HOT_GOLD - 1 }]
        : [c.id, c],
    ),
  ),
} as GameState;
let noGoldRejected = false;
try {
  launchPlot(
    lowGold,
    { type: PlotType.STRIKE_WHILE_HOT, factionId: player, targetFactionId: target },
    () => 0.1,
  );
} catch {
  noGoldRejected = true;
}
assert(noGoldRejected, '金不足发起被拒绝');

// 正常发起
state = enrichGold(state, player, STRIKE_WHILE_HOT_GOLD + 50);
const beforeGold = Object.values(state.cities)
  .filter((c) => c.ruler === player)
  .reduce((s, c) => s + c.gold, 0);
assert(countWarsForFaction(state, target) >= STRIKE_WHILE_HOT_MIN_WARS, '前置：目标多线交战成立');

state = launchPlot(
  state,
  { type: PlotType.STRIKE_WHILE_HOT, factionId: player, targetFactionId: target },
  () => 0.1,
);

const afterGold = Object.values(state.cities)
  .filter((c) => c.ruler === player)
  .reduce((s, c) => s + c.gold, 0);
assert(afterGold === beforeGold - STRIKE_WHILE_HOT_GOLD, `扣金 ${STRIKE_WHILE_HOT_GOLD}`);

const plot = (state.plots ?? []).find((p) => p.type === PlotType.STRIKE_WHILE_HOT);
assert(!!plot, '计谋记录存在');
assert(plot!.stage === PlotStage.RESOLVED, '即时 RESOLVED');
assert(plot!.monthsLeft === 0, 'monthsLeft=0');
assert(plot!.layer === 'strategic', 'layer=strategic');
assert(plot!.targetFactionId === target, 'targetFactionId=目标势力');
assert(plot!.targetCityId == null, '无 targetCityId');
assert(plot!.result?.success === true, 'result.success');
assert(plot!.result?.detected === false, '无识破');
assert(
  !!state.actionLog.find((e) => e.type === 'plot_resolve' && e.message.includes('趁火打劫')),
  'actionLog 有结算',
);

// 效果查询：目标仍多线交战 → ×1.2
assert(
  getStrikeWhileHotFirstHitMul(state, player, target) === STRIKE_WHILE_HOT_FIRST_HIT_MUL,
  '目标仍多线交战 → 首击 ×1.2',
);
assert(
  getStrikeWhileHotFirstHitMul(state, target, player) === 1,
  '反向（目标发起）不生效',
);

// 目标停战 → 效果自然消散
const noLongerWar = { ...state, diplomacy: [] } as GameState;
assert(
  getStrikeWhileHotFirstHitMul(noLongerWar, player, target) === 1,
  '目标停战后效果消散（趁火打劫需趁火）',
);

// Schema 往返
assert(
  (() => {
    try {
      GameStatePlotSchema.parse({ plots: state.plots ?? [] });
      return true;
    } catch {
      return false;
    }
  })(),
  'GameStatePlotSchema 接受趁火打劫 RESOLVED',
);

// 已结算不可取消
let cancelRejected = false;
try {
  cancelPlot(state, plot!.id, player);
} catch {
  cancelRejected = true;
}
assert(cancelRejected, '已结算不可 cancelPlot');

// 非法目标拒绝（自身 / 已灭亡）
let selfRejected = false;
try {
  launchPlot(
    state,
    { type: PlotType.STRIKE_WHILE_HOT, factionId: player, targetFactionId: player },
    () => 0.1,
  );
} catch (e) {
  selfRejected = e instanceof Error && e.message.includes('自己');
}
assert(selfRejected, '不能对自己施展');

// runAutoBattle 接入：构造一次对目标势力城的自动战，验证首回合伤害 +20%
createGame(1, 1);
let s2 = getGame();
const target2 = Object.values(s2.factions).find((f) => f.id !== player && f.isAlive)!;
s2 = setWars(s2, target2.id, [player, player + 99]);
s2 = enrichGold(s2, player, STRIKE_WHILE_HOT_GOLD + 50);
s2 = launchPlot(
  s2,
  { type: PlotType.STRIKE_WHILE_HOT, factionId: player, targetFactionId: target2.id },
  () => 0.1,
);

const targetCity = Object.values(s2.cities).find((c) => c.ruler === target2.id);
assert(!!targetCity, '目标势力有城');
const atkArmy = {
  id: 'army-1',
  factionId: player,
  commanderId: s2.factions[player]!.rulerId,
  subCommanderIds: [],
  advisorId: undefined,
  name: '讨伐军',
  unitType: UnitType.HEAVY_INFANTRY,
  troops: 5000,
  maxTroops: 5000,
  morale: 90,
  organization: 70,
  fatigue: 0,
  experience: 0,
  formation: 0,
  squads: [],
  currentCityId: 1,
  currentNodeId: 1,
  targetNodeId: targetCity!.id,
  fromNodeId: 1,
  phase: 'sieging' as const,
  path: [],
  structures: [],
  supplies: 0,
  perMonthSupplies: 0,
  food: 1000,
  maxFood: 2000,
};
const noStrike = runAutoBattle(s2, atkArmy, null, { cityId: targetCity!.id, garrison: 5000, wall: 100 }, makeRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
const strikeApplied = noStrike.events.some((e) => e.type === 'stratagem' && e.description.includes('趁火打劫'));
assert(strikeApplied, '自动战 events 记录趁火打劫首击加成');
assert(
  getStrikeWhileHotFirstHitMul(s2, player, target2.id) === STRIKE_WHILE_HOT_FIRST_HIT_MUL,
  '战斗前效果查询 ×1.2',
);

// 无趁火打劫记录 → 事件不出现
const s3 = { ...s2, plots: [] } as GameState;
const noPlot = runAutoBattle(s3, atkArmy, null, { cityId: targetCity!.id, garrison: 5000, wall: 100 }, makeRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
assert(
  !noPlot.events.some((e) => e.description.includes('趁火打劫')),
  '无计谋记录 → 无首击加成事件',
);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);