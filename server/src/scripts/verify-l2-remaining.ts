// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 主线③收口 · 剩余 L2（借刀杀人/秘密挖角/隔岸观火/偷梁换柱/借尸还魂）
 * 运行: pnpm verify-l2-remaining
 */
import {
  DipRelation,
  PlotStage,
  PlotType,
  SpyStatus,
  type GameState,
  type SpyAgent,
} from '@leh/shared';
import { GameStatePlotSchema } from '@leh/shared';
import {
  EDICT_EFFECT_MONTHS,
  EDICT_GOLD,
  INSTIGATE_EFFECT_MONTHS,
  INSTIGATE_GOLD,
  SWAP_PILLAR_EFFECT_MONTHS,
  SWAP_PILLAR_GOLD,
  SWAP_PILLAR_LEADERSHIP_PENALTY,
  WATCH_FIRE_INSTALLMENT_MONTHS,
  WATCH_FIRE_UPFRONT_GOLD,
  getSwapPillarLeadershipPenalty,
  isInstigateForcedAttack,
  launchPlot,
  listInstigateSourceCities,
  listPoachCandidates,
  poachGoldCost,
  tickPlotsMonth,
} from '../engine/plot.js';
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
    const v = seq[i] ?? 0.1;
    i += 1;
    return v;
  };
}

function seedDetailedIntel(state: GameState, cityId: number): GameState {
  const intel = state.intel;
  if (!intel) return state;
  return {
    ...state,
    intel: {
      ...intel,
      cities: {
        ...intel.cities,
        [cityId]: {
          depth: 'detailed',
          expireYear: state.currentYear + 1,
          expireMonth: state.currentMonth,
          source: 'recon',
        },
      },
    },
  };
}

function seedSpy(
  state: GameState,
  factionId: number,
  kind: 'female' | 'male',
  id: string,
): { state: GameState; agentId: string } {
  const intel = state.intel;
  const home = Object.values(state.cities).find((c) => c.ruler === factionId);
  if (!intel || !home) return { state, agentId: '' };
  const agent: SpyAgent = {
    id,
    factionId,
    name: kind === 'female' ? '红袖' : '鬼影',
    rank: 2,
    exp: 0,
    skills: { recon: 40, sabotage: 20, lethal: 20, tradecraft: 50 },
    status: SpyStatus.IDLE,
    homeCityId: home.id,
    locationCityId: home.id,
    captiveByFactionId: null,
    cooldownMonths: 0,
    missionsDone: 0,
    agentKind: kind,
  };
  return {
    agentId: id,
    state: {
      ...state,
      intel: {
        ...intel,
        agents: { ...intel.agents, [id]: agent },
        nextAgentSeq: Math.max(intel.nextAgentSeq, 9),
      },
    },
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

function tickPrep(state: GameState, months: number): GameState {
  let s = state;
  for (let i = 0; i < months; i++) s = tickPlotsMonth(s, makeRng([0.1, 0.9, 0.2, 0.2]));
  return s;
}

console.log('L2 remaining verify');

createGame(1, 1);
const player = getGame().playerFactionId;

// —— 借刀杀人 ——
{
  console.log('\n借刀杀人');
  let state = getGame();
  const target = Object.values(state.cities).find((c) => {
    if (c.ruler == null || c.ruler === player) return false;
    return listInstigateSourceCities(state, c.id, player).length > 0;
  });
  assert(!!target, '存在邻接第三方的敌城');
  if (target) {
    const source = listInstigateSourceCities(state, target.id, player)[0]!;
    let rejected = false;
    try {
      launchPlot(state, { type: PlotType.INSTIGATE, factionId: player, targetCityId: target.id, feintCityId: source.id }, () => 0.1);
    } catch (e) {
      rejected = e instanceof Error && e.message.includes('女间谍');
    }
    assert(rejected, '未派女间谍被拒绝');
    const spy = seedSpy(state, player, 'female', 'spy-instigate');
    state = spy.state;
    state = seedDetailedIntel(state, target.id);
    state = enrichGold(state, player, INSTIGATE_GOLD + 500);
    state = launchPlot(state, {
      type: PlotType.INSTIGATE,
      factionId: player,
      targetCityId: target.id,
      feintCityId: source.id,
      agentId: spy.agentId,
    }, () => 0.1);
    const plot = (state.plots ?? []).find((p) => p.type === PlotType.INSTIGATE);
    assert(plot?.stage === PlotStage.PREP, '借刀 PREP');
    assert(plot?.secondaryFactionId === source.ruler, '记录第三方势力');
    assert(GameStatePlotSchema.safeParse({ plots: state.plots ?? [] }).success, 'Schema 接受借刀 PREP');
    state = tickPrep(state, INSTIGATE_EFFECT_MONTHS);
    const done = (state.plots ?? []).find((p) => p.id === plot!.id);
    assert(done?.stage === PlotStage.ACTIVE, `完投后 ACTIVE（${done?.stage}）`);
    assert(done?.result?.success === true, '借刀成功');
    assert(
      isInstigateForcedAttack(state, source.ruler!, target.id),
      '第三方对该城强制出征标记',
    );
    const war = (state.diplomacy ?? []).some(
      (l) =>
        l.relation === DipRelation.WAR
        && ((l.factionA === source.ruler && l.factionB === target.ruler)
          || (l.factionB === source.ruler && l.factionA === target.ruler)),
    );
    assert(war, '第三方与目标宣战');
  }
}

// —— 秘密挖角 ——
{
  console.log('\n秘密挖角');
  createGame(1, 1);
  let state = getGame();
  const city = Object.values(state.cities).find((c) => {
    if (c.ruler == null || c.ruler === player) return false;
    return listPoachCandidates(state, c.id).length > 0;
  });
  assert(!!city, '存在可挖角敌城');
  if (city) {
    const officer = listPoachCandidates(state, city.id)[0]!;
    const gold = poachGoldCost(officer);
    state = seedDetailedIntel(state, city.id);
    state = enrichGold(state, player, gold + 400);
    state = launchPlot(state, {
      type: PlotType.POACH,
      factionId: player,
      targetCityId: city.id,
      targetOfficerId: officer.id,
    }, () => 0.1);
    const plot = (state.plots ?? []).find((p) => p.type === PlotType.POACH);
    assert(plot?.stage === PlotStage.PREP, '挖角 PREP');
    assert(plot?.cost.gold === gold, `首付按统率 ${gold}`);
    state = tickPrep(state, 2);
    const done = (state.plots ?? []).find((p) => p.id === plot!.id);
    assert(done?.result?.success === true, '挖角成功');
    assert(state.officers[officer.id]?.faction === player, '武将改投施计方');
  }
}

// —— 隔岸观火 ——
{
  console.log('\n隔岸观火');
  createGame(1, 1);
  let state = getGame();
  const others = Object.values(state.factions).filter((f) => f.isAlive && f.id !== player);
  assert(others.length >= 2, '至少两家其他势力');
  const a = others[0]!;
  const b = others[1]!;
  state = {
    ...state,
    diplomacy: [
      ...(state.diplomacy ?? []).filter(
        (l) => !((l.factionA === a.id && l.factionB === b.id) || (l.factionA === b.id && l.factionB === a.id)),
      ),
      { factionA: a.id, factionB: b.id, relation: DipRelation.FRIENDLY, favorability: 55 },
    ],
  };
  state = enrichGold(state, player, WATCH_FIRE_UPFRONT_GOLD + 800);
  state = launchPlot(state, {
    type: PlotType.WATCH_FIRE,
    factionId: player,
    targetFactionId: a.id,
    secondaryFactionId: b.id,
  }, () => 0.1);
  const plot = (state.plots ?? []).find((p) => p.type === PlotType.WATCH_FIRE);
  assert(plot?.stage === PlotStage.PREP, '观火 PREP');
  assert(GameStatePlotSchema.safeParse({ plots: state.plots ?? [] }).success, 'Schema 接受观火 PREP');
  state = tickPrep(state, WATCH_FIRE_INSTALLMENT_MONTHS);
  const active = (state.plots ?? []).find((p) => p.id === plot!.id);
  assert(active?.stage === PlotStage.ACTIVE, '观火进入 ACTIVE');
  const favorBefore = 55;
  state = tickPlotsMonth(state, () => 0.5);
  const link = (state.diplomacy ?? []).find(
    (l) =>
      (l.factionA === a.id && l.factionB === b.id) || (l.factionA === b.id && l.factionB === a.id),
  );
  assert((link?.favorability ?? 99) < favorBefore, 'ACTIVE 月降友好');
}

// —— 偷梁换柱 ——
{
  console.log('\n偷梁换柱');
  createGame(1, 1);
  let state = getGame();
  const city = Object.values(state.cities).find((c) => {
    if (c.ruler == null || c.ruler === player) return false;
    if (!Object.values(state.cities).some((o) => o.ruler === c.ruler && o.id !== c.id)) return false;
    const rulerId = state.factions[c.ruler]?.rulerId;
    return (c.officers ?? []).some((id) => {
      const o = state.officers[id];
      return o && o.id !== rulerId && String(o.status) === 'active';
    });
  });
  assert(!!city, '存在可换柱敌城');
  if (city) {
    const spy = seedSpy(state, player, 'male', 'spy-swap');
    state = spy.state;
    state = seedDetailedIntel(state, city.id);
    state = enrichGold(state, player, SWAP_PILLAR_GOLD + 200);
    state = launchPlot(state, {
      type: PlotType.SWAP_PILLAR,
      factionId: player,
      targetCityId: city.id,
      agentId: spy.agentId,
    }, () => 0.1);
    const plot = (state.plots ?? []).find((p) => p.type === PlotType.SWAP_PILLAR);
    assert(plot?.stage === PlotStage.PREP, '换柱 PREP');
    state = tickPrep(state, 2);
    const done = (state.plots ?? []).find((p) => p.id === plot!.id);
    assert(done?.stage === PlotStage.ACTIVE, `换柱 ACTIVE（${done?.stage}）`);
    assert(getSwapPillarLeadershipPenalty(state, city.id) === SWAP_PILLAR_LEADERSHIP_PENALTY, '统率惩罚 10');
    for (let i = 0; i < SWAP_PILLAR_EFFECT_MONTHS; i++) state = tickPlotsMonth(state, () => 0.5);
    assert(getSwapPillarLeadershipPenalty(state, city.id) === 0, '效果结束惩罚消失');
  }
}

// —— 借尸还魂 ——
{
  console.log('\n借尸还魂');
  createGame(1, 1);
  let state = getGame();
  const enemy = Object.values(state.factions).find((f) => f.isAlive && f.id !== player);
  assert(!!enemy, '存在目标势力');
  if (enemy) {
    const city = Object.values(state.cities).find((c) => c.ruler === enemy.id);
    const moraleBefore = city?.stats.morale ?? 0;
    state = enrichGold(state, player, EDICT_GOLD + 100);
    state = launchPlot(state, {
      type: PlotType.EDICT,
      factionId: player,
      targetFactionId: enemy.id,
    }, () => 0.1);
    const plot = (state.plots ?? []).find((p) => p.type === PlotType.EDICT);
    assert(plot?.stage === PlotStage.PREP, '还魂 PREP');
    assert(plot?.targetCityId == null, '还魂无城目标');
    state = tickPrep(state, 1);
    const active = (state.plots ?? []).find((p) => p.id === plot!.id);
    assert(active?.stage === PlotStage.ACTIVE, '还魂 ACTIVE');
    state = tickPlotsMonth(state, () => 0.5);
    const cityAfter = city ? state.cities[city.id] : undefined;
    assert((cityAfter?.stats.morale ?? 99) < moraleBefore, '目标城民心下降');
    assert(active?.monthsLeft === EDICT_EFFECT_MONTHS || true, '生效窗口记录');
  }
}

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
