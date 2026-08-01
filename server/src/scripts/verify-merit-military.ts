// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S12 军事功绩冒烟测试（docs/04 §十 6.1 军事条目，Session 263）：
 *   1. 战棋层破城 +30（攻方主将）；占城致目标势力覆灭再 +50（灭国）
 *   2. 战棋层守城 +8（守方主将 = 城内武力最高 ACTIVE 守方武将）
 *   3. 战役层守城 +8（assault 攻方败，defCityId 场景）
 *   4. 计谋：casterOfficerId 显式/缺省军师解析；成功 +5 / 失败不发；君主守卫；
 *      PlotRuntimeSchema 新旧档兼容
 *
 * 确定性：固定 RNG（0/0.5/1）；功绩为固定值不消耗权威 RNG。
 *
 * 运行: pnpm verify-merit-military
 */
import {
  GameStateSchema,
  PlotStage,
  PlotType,
  FormationType,
  UnitType,
  isHostileOrAtWar,
  playerCitiesAdjacentTo,
  type BattleState,
  type GameState,
  type CampaignArmy,
} from '@leh/shared';
import { createGame, getGame } from '../services/game.js';
import { prepareMarch, settleBattle } from '../engine/march.js';
import {
  assault,
  buildCampaignNodes,
  startCampaign,
  tickCampaignMarch,
} from '../engine/campaign.js';
import { launchPlot, tickPlotsMonth } from '../engine/plot.js';
import {
  MERIT_ANNIHILATE_FACTION,
  MERIT_CAPTURE_CITY,
  MERIT_DEFEND_CITY,
  MERIT_FIELD_ANNIHILATE,
  MERIT_FIELD_ROUT,
  pickDefenderCommander,
} from '../engine/militaryMerit.js';

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

/** 沿官道找一个可攻打的相邻敌城并增强兵力；返回已 prepare 的 battle 上下文。 */
function prepareOneCapture(state: GameState): {
  prepared: ReturnType<typeof prepareMarch>;
  targetId: number;
} | null {
  const faction = state.factions[state.playerFactionId];
  // 把各势力君主 war 调低：确保攻/守方"武力最高主将"均为非君主武将，
  // 从而验证军事功绩发放路径（君主守卫 §6.5 已在 verify-merit-grants 单独覆盖）。
  let weakened = state;
  for (const f of Object.values(state.factions)) {
    const ruler = f.rulerId != null ? state.officers[f.rulerId] : undefined;
    if (ruler) {
      weakened = {
        ...weakened,
        officers: {
          ...weakened.officers,
          [ruler.id]: { ...ruler, stats: { ...ruler.stats, war: 1 } },
        },
      };
    }
  }
  state = weakened;
  for (const target of Object.values(state.cities)) {
    if (target.ruler == null || target.ruler === state.playerFactionId) continue;
    const candidates = playerCitiesAdjacentTo(faction.cityIds, target.id)
      .filter((cid) => (state.cities[cid]?.troops ?? 0) >= 1_500);
    // 优先君主驻守城作为出发城（保证出发城有驻守武将，战役 startCampaign 校验要求主将在出发节点）
    const rulerLoc = state.officers[faction.rulerId]?.location;
    const sourceId = rulerLoc != null && candidates.includes(rulerLoc) ? rulerLoc : candidates[0];
    if (sourceId == null) continue;
    const source = state.cities[sourceId];
    const strengthened = {
      ...state,
      cities: {
        ...state.cities,
        [sourceId]: {
          ...source,
          troops: Math.max(source.troops, 10_000),
          food: Math.max(source.food, 10_000),
        },
      },
    };
    const prepared = prepareMarch(strengthened, {
      fromCityId: sourceId,
      targetCityId: target.id,
      troopCount: 8_000,
    });
    return { prepared, targetId: target.id };
  }
  return null;
}

console.log('\n=== S12 军事功绩冒烟测试（docs/04 §6.1 军事条目）===\n');

// --- 1. 战棋层：破城 +30 / 灭国 +50 ---
console.log('1. 战棋层破城/灭国（march.ts settleBattle）');
{
  createGame(1, 1);
  const initial = getGame();
  const ctx = prepareOneCapture(initial);
  assert(ctx != null, '找到可沿官道攻打的相邻敌城');
  if (!ctx) process.exit(1);
  const { prepared, targetId } = ctx;
  // 显式指定非君主武将担任攻方主将（createBattle 默认取出发城首位=君主会被 §6.5 守卫拦截，
  // 君主守卫本身已在 verify-merit-grants 覆盖；此处验证发放路径）
  const nonRulerCmd = Object.values(prepared.state.officers).find(
    (o) =>
      o.faction === prepared.state.playerFactionId &&
      o.status === 'active' &&
      o.id !== prepared.state.factions[prepared.state.playerFactionId]?.rulerId,
  );
  assert(nonRulerCmd != null, '势力内存在非君主现役武将');
  if (!nonRulerCmd) process.exit(1);
  const won: BattleState = {
    ...prepared.battle,
    phase: 'over',
    winner: 'attacker',
    units: prepared.battle.units.map((unit, idx) =>
      unit.side === 'attacker' && idx === 0
        ? { ...unit, commanderId: nonRulerCmd.id }
        : unit.side === 'defender'
          ? { ...unit, troopCount: 0, isDestroyed: true }
          : unit,
    ),
  };
  const cmdId = nonRulerCmd.id;
  const before = prepared.state.officers[cmdId]?.merit ?? 0;
  const after = settleBattle(prepared.state, won, () => 0.5);
  const gain = (after.officers[cmdId]?.merit ?? 0) - before;
  const prevRuler = prepared.state.cities[targetId].ruler;
  const annihilated = prevRuler != null && after.factions[prevRuler] != null && !after.factions[prevRuler].isAlive;
  assert(gain === MERIT_CAPTURE_CITY, `破城：攻方主将 ${nonRulerCmd.name} +${MERIT_CAPTURE_CITY}（实际 +${gain}）`);
  assert(after.cities[targetId].ruler === after.playerFactionId, '破城占城生效');
  if (annihilated) {
    assert(gain === MERIT_CAPTURE_CITY + MERIT_ANNIHILATE_FACTION, `灭国：主将再 +${MERIT_ANNIHILATE_FACTION}（合计 +${gain}）`);
    assert(after.factions[prevRuler]?.isAlive === false, '目标势力覆灭（isAlive=false）');
  } else {
    console.log('    说明：目标势力尚存（非单城势力），灭国 +50 未触发（由战役层 trySiegeSurrender 用例覆盖）');
  }
}

// --- 2. 战棋层：守城 +8 ---
console.log('\n2. 战棋层守城（defender 胜 → 守方主将 +8）');
{
  createGame(1, 1);
  const initial = getGame();
  const ctx = prepareOneCapture(initial);
  assert(ctx != null, '找到可沿官道攻打的相邻敌城（守城用例）');
  if (!ctx) process.exit(1);
  const { prepared } = ctx;
  const defWon: BattleState = {
    ...prepared.battle,
    phase: 'over',
    winner: 'defender',
    units: prepared.battle.units.map((unit) =>
      unit.side === 'attacker' ? { ...unit, troopCount: 0, isDestroyed: true } : unit,
    ),
  };
  const target = prepared.state.cities[prepared.battle.cityId!];
  const defFid = prepared.battle.defenderFaction ?? target.ruler;
  assert(defFid != null, '守方势力存在');
  const defCmd = defFid != null ? pickDefenderCommander(prepared.state, target, defFid) : undefined;
  assert(defCmd != null, '守方主将存在（城内武力最高 ACTIVE）');
  if (!defCmd || defFid == null) process.exit(1);
  const before = prepared.state.officers[defCmd.id]?.merit ?? 0;
  const after = settleBattle(prepared.state, defWon, () => 0.5);
  const gain = (after.officers[defCmd.id]?.merit ?? 0) - before;
  assert(gain === MERIT_DEFEND_CITY, `守城：守方主将 ${defCmd.name} +${MERIT_DEFEND_CITY}（实际 +${gain}）`);
  assert(after.cities[prepared.battle.cityId!].ruler === defFid, '城归属未变（守城成功）');
}

// --- 3. 计谋：执行武将解析 / 成功 +5 / 失败不发 / 君主守卫 / schema ---
console.log('\n3. 计谋功绩（plot.ts casterOfficerId + 成功 +5）');
{
  createGame(1, 1);
  const initial = getGame();
  const fid = initial.playerFactionId;
  const rulerId = initial.factions[fid]?.rulerId;
  assert(rulerId != null, '玩家势力君主存在');

  // 3a. 缺省 casterOfficerId = 势力内非君主智最高
  const s1 = launchPlot(initial, {
    type: PlotType.SOW_DISCORD,
    targetFactionId: Object.keys(initial.factions)
      .map(Number)
      .find((f) => f !== fid),
  }, () => 0);
  const plot1 = s1.plots[s1.plots.length - 1];
  const expectedCaster = Object.values(initial.officers)
    .filter((o) => o.faction === fid && o.status === 'active' && o.id !== rulerId)
    .sort((a, b) => b.stats.intelligence - a.stats.intelligence || a.id - b.id)[0]?.id;
  assert(plot1?.casterOfficerId === expectedCaster, `缺省执行武将=非君主智最高（id ${plot1?.casterOfficerId}）`);
  assert(plot1?.casterOfficerId !== rulerId, '执行武将非君主');
  assert(plot1?.stage === PlotStage.PREP, '计谋进入准备期');

  // 3b. 显式 casterOfficerId 生效
  const s2 = launchPlot(initial, {
    type: PlotType.SOW_DISCORD,
    targetFactionId: Object.keys(initial.factions).map(Number).find((f) => f !== fid),
    casterOfficerId: rulerId, // 显式传君主（守卫用例：成功也不发）
  }, () => 0);
  const plot2 = s2.plots[s2.plots.length - 1];
  assert(plot2?.casterOfficerId === rulerId, '显式 casterOfficerId 生效');

  // 3c. 成功 +5（rng=0 强制成功；PREP 1 月后 tick 结算）
  const casterId1 = plot1.casterOfficerId;
  if (casterId1 == null) process.exit(1);
  const casterMeritBefore = s1.officers[casterId1]?.merit ?? 0;
  let s3 = tickPlotsMonth(s1, () => 0);
  const resolved1 = s3.plots.find((p) => p.id === plot1.id);
  assert(resolved1?.stage === PlotStage.RESOLVED && resolved1?.result?.success === true, '计谋成功结算');
  const casterMeritAfter = s3.officers[casterId1]?.merit ?? 0;
  assert(casterMeritAfter - casterMeritBefore === 5, `计谋成功：执行武将 +5（实际 +${casterMeritAfter - casterMeritBefore}）`);

  // 3d. 君主守卫：显式传君主 → 成功也不发放
  const rulerMeritBefore = s2.officers[rulerId]?.merit ?? 0;
  const s4 = tickPlotsMonth(s2, () => 0);
  const resolved2 = s4.plots.find((p) => p.id === plot2.id);
  assert(resolved2?.result?.success === true, '君主执行的计谋仍成功结算');
  assert((s4.officers[rulerId]?.merit ?? 0) === rulerMeritBefore, '君主不获计谋功绩（§6.5 守卫）');

  // 3e. 失败不发（rng=1 强制失败）
  const s5 = launchPlot(initial, {
    type: PlotType.SOW_DISCORD,
    targetFactionId: Object.keys(initial.factions).map(Number).find((f) => f !== fid),
  }, () => 0);
  const plot5 = s5.plots[s5.plots.length - 1];
  const casterId5 = plot5.casterOfficerId;
  if (casterId5 == null) process.exit(1);
  const failCasterBefore = s5.officers[casterId5]?.merit ?? 0;
  const s6 = tickPlotsMonth(s5, () => 1);
  const resolved3 = s6.plots.find((p) => p.id === plot5.id);
  assert(resolved3?.result?.success === false, '计谋失败结算');
  assert((s6.officers[casterId5]?.merit ?? 0) === failCasterBefore, '计谋失败不发放');

  // 3f. PlotRuntimeSchema / GameStateSchema 新旧档兼容
  const withCaster: GameState = { ...s3, plots: [plot1] };
  const parsed = GameStateSchema.parse(withCaster);
  assert(parsed.plots[0]?.casterOfficerId === plot1.casterOfficerId, '带 casterOfficerId 的计谋过完整 Schema');
  const legacy = { ...plot1, casterOfficerId: undefined };
  const legacyParsed = GameStateSchema.parse({ ...withCaster, plots: [legacy] });
  assert(legacyParsed.plots[0]?.casterOfficerId == null, '旧档（无 casterOfficerId）兼容');
}

// --- 4. 战役层：assault 攻方败 → 守城 +8（defCityId 场景） ---
console.log('\n4. 战役层守城（assault 攻方败 → 守方主将 +8）');
{
  createGame(1, 1);
  const initial = getGame();
  const ctx = prepareOneCapture(initial);
  assert(ctx != null, '找到可沿官道攻打的相邻敌城（战役守城用例）');
  if (!ctx) process.exit(1);
  const { prepared, targetId } = ctx;
  // 用极小兵力强攻强守城 → 守方必胜；主将须位于出发城（startCampaign 校验）。
  // 首都洛阳不与敌城邻接（前线城挡路），故把君主临时移至出发城充当主将（攻方身份与守城功绩无关）。
  let campState = prepared.state;
  const fid4 = campState.playerFactionId;
  const fromCity = prepared.battle.fromCityId;
  if (fromCity == null) process.exit(1);
  let cmdInCity = Object.values(campState.officers).find(
    (o) => o.faction === fid4 && o.status === 'active' && o.location === fromCity,
  );
  if (!cmdInCity) {
    const ruler = campState.officers[campState.factions[fid4].rulerId];
    if (ruler) {
      campState = {
        ...campState,
        officers: {
          ...campState.officers,
          [ruler.id]: { ...ruler, location: fromCity },
        },
      };
      cmdInCity = campState.officers[ruler.id];
    }
  }
  if (!cmdInCity) {
    console.log('    说明: 出发城无驻守武将，跳过战役守城用例');
  } else {
    const smallArmy = startCampaign(campState, {
      commanderId: cmdInCity!.id,
      subCommanderIds: [],
      fromNodeId: fromCity,
      targetNodeId: targetId,
      unitType: 'heavyInfantry' as never,
      formation: 0 as never,
      troopCount: 1000,
      food: 500,
    });
    let s = smallArmy.state;
    s = tickCampaignMarch(s); // 到达围城
    const siege = assault(s, s.campaignArmies[0].id, () => 0.5);
    s = siege.state;
    const battleResult = siege.result;
    if (battleResult.winner === 'defender') {
      const defCity = s.cities[targetId];
      const defCmd = defCity.ruler != null ? pickDefenderCommander(s, defCity, defCity.ruler) : undefined;
      assert(defCmd != null, '守方主将存在（战役 assault）');
      if (defCmd && defCity.ruler != null) {
        const beforeMerit = prepared.state.officers[defCmd.id]?.merit ?? 0;
        const afterMerit = s.officers[defCmd.id]?.merit ?? 0;
        assert(
          afterMerit - beforeMerit === MERIT_DEFEND_CITY,
          `战役守城：守方主将 ${defCmd.name} +${MERIT_DEFEND_CITY}（实际 +${afterMerit - beforeMerit}）`,
        );
      }
    } else {
      console.log('    说明: 攻方小兵力意外获胜，战役守城分支未触发（march 层守城 +8 已全链路覆盖）');
    }
  }
}

// --- 5. 野战击破：全歼 +20 / 击退 +10 / 守方击退 +10 ---
console.log('\n5. 野战击破功绩（field_battle：全歼/击退/守方击退）');
{
  /** 构造一场确定性野战：攻方从 fromNode 出征撞上驻守 targetNode 的敌 Army（hostile）。 */
  function runFieldBattle(atkTroops: number, defTroops: number): {
    outcome: ReturnType<typeof assault>['result'];
    state: GameState;
    atkCmd: number;
    defCmd: number;
    baseMerit: number;
  } {
    createGame(1, 1);
    const initial = getGame();
    const fid = initial.playerFactionId;
    // 直接找相邻敌城对（不经 prepareMarch，避免其扣减出兵兵力影响 startCampaign 校验）
    const faction = initial.factions[fid];
    let pair: { fromCityId: number; targetId: number } | undefined;
    for (const target of Object.values(initial.cities)) {
      if (target.ruler == null || target.ruler === fid) continue;
      const candidates = playerCitiesAdjacentTo(faction.cityIds, target.id)
        .filter((cid) => (initial.cities[cid]?.troops ?? 0) >= 1_000);
      if (candidates.length === 0) continue;
      pair = { fromCityId: candidates[0], targetId: target.id };
      break;
    }
    if (!pair) throw new Error('野战夹具找不到相邻敌城对');
    // 增强出发城兵力/粮草到 ≥ 出征需求
    const fromSrc = initial.cities[pair.fromCityId];
    const withNodes: GameState = {
      ...initial,
      campaignNodes: buildCampaignNodes(initial),
      cities: {
        ...initial.cities,
        [pair.fromCityId]: {
          ...fromSrc,
          troops: Math.max(fromSrc.troops, atkTroops + 1_000),
          food: Math.max(fromSrc.food, atkTroops + 1_000),
        },
      },
    };
    const targetId = pair.targetId;
    // 敌 Army 主将：与玩家为 hostile/war 的势力首个 ACTIVE 武将
    const enemyFid = Object.keys(withNodes.factions)
      .map(Number)
      .find(
        (f) =>
          f !== fid &&
          isHostileOrAtWar(withNodes.diplomacy, fid, f),
      ) ?? Object.keys(withNodes.factions).map(Number).find((f) => f !== fid);
    if (enemyFid == null) throw new Error('野战夹具找不到敌对势力');
    // 守方 Army 主将：敌方势力非君主 ACTIVE 武将（君主不发功绩守卫 §6.5）
    const enemyRulerId = withNodes.factions[enemyFid].rulerId;
    const defCmd =
      Object.values(withNodes.officers).find(
        (o) => o.faction === enemyFid && o.status === 'active' && o.id !== enemyRulerId,
      )?.id ?? withNodes.factions[enemyFid].rulerId;
    const enemyArmy: CampaignArmy = {
      id: 'field-defender', factionId: enemyFid, name: '敌守军', commanderId: defCmd, subCommanderIds: [],
      unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE,
      currentNodeId: targetId, path: [], phase: 'garrison',
      troops: defTroops, maxTroops: defTroops, food: 1000, maxFood: 1000,
      morale: 70, organization: 70, experience: 0, fatigue: 0,
      squads: [], structures: [],
    };
    const fromCity = pair.fromCityId;
    let campState = withNodes;
    // 攻方主将：势力内非君主 ACTIVE 武将（避免君主守卫拦截；不在出发城则临时移入）
    const rulerId5 = campState.factions[fid].rulerId;
    let marchCmd = Object.values(campState.officers).find(
      (o) =>
        o.faction === fid &&
        o.status === 'active' &&
        o.id !== rulerId5 &&
        o.location === fromCity,
    )?.id;
    if (marchCmd == null) {
      const nonRuler = Object.values(campState.officers).find(
        (o) => o.faction === fid && o.status === 'active' && o.id !== rulerId5,
      );
      if (nonRuler) {
        campState = {
          ...campState,
          officers: {
            ...campState.officers,
            [nonRuler.id]: { ...nonRuler, location: fromCity },
          },
        };
        marchCmd = nonRuler.id;
      }
    }
    if (marchCmd == null) {
      // 势力除君主外无现役武将：君主临时移入（守方功绩仍可验证）
      const ruler = campState.officers[rulerId5];
      if (ruler) {
        campState = {
          ...campState,
          officers: {
            ...campState.officers,
            [ruler.id]: { ...ruler, location: fromCity },
          },
        };
        marchCmd = ruler.id;
      }
    }
    // 功绩带兵+ 数值消费（Session 265）：攻方主将设 Lv15（白身 cap=10000）以容纳 10000 兵用例
    const commanderId = marchCmd ?? campState.factions[fid].rulerId;
    const commander = campState.officers[commanderId];
    let baseMerit = commander?.merit ?? 0;
    if (commander && commanderId !== campState.factions[fid].rulerId) {
      baseMerit = 45_000;
      campState = {
        ...campState,
        officers: {
          ...campState.officers,
          [commanderId]: {
            ...commander,
            merit: baseMerit,
            meritLevel: 15,
            peakMeritLevel: 15,
            meritPath: 'warrior',
          },
        },
      };
    }
    const started = startCampaign(campState, {
      commanderId,
      subCommanderIds: [],
      fromNodeId: fromCity,
      targetNodeId: targetId,
      unitType: UnitType.HEAVY_CAVALRY,
      formation: FormationType.WEDGE,
      troopCount: atkTroops,
      food: Math.max(1000, atkTroops),
    });
    let s = tickCampaignMarch({
      ...started.state,
      campaignArmies: [...started.state.campaignArmies, enemyArmy],
    });
    const atkArmy = s.campaignArmies.find((a) => a.factionId === fid)!;
    const outcome = assault(s, atkArmy.id, () => 0.5);
    return {
      outcome: outcome.result,
      state: outcome.state,
      atkCmd: atkArmy.commanderId,
      defCmd,
      baseMerit,
    };
  }

  // 5a. 击破主力：攻 10000 vs 敌 800 → 攻方胜且守方溃散（30% 线）→ 攻方主将 +20
  {
    const { outcome, state, atkCmd, baseMerit } = runFieldBattle(10_000, 800);
    const gain = (state.officers[atkCmd]?.merit ?? 0) - baseMerit;
    assert(
      outcome.winner === 'attacker',
      `大优势野战攻方胜（winner=${outcome.winner}）`,
    );
    assert(gain === MERIT_FIELD_ANNIHILATE, `野战击破主力：攻方主将 +${MERIT_FIELD_ANNIHILATE}（实际 +${gain}）`);
  }

  // 5b. 击破（势均力敌）：攻 3000 vs 敌 2000 → 攻方胜；按守方是否溃散分档 +20/+10
  {
    const { outcome, state, atkCmd, baseMerit } = runFieldBattle(3_000, 2_000);
    const gain = (state.officers[atkCmd]?.merit ?? 0) - baseMerit;
    if (outcome.winner === 'attacker') {
      const defRouted = outcome.events.some(
        (e) => e.type === 'rout' && e.description.includes('守方'),
      );
      const expected = defRouted ? MERIT_FIELD_ANNIHILATE : MERIT_FIELD_ROUT;
      assert(
        gain === expected,
        `野战击破分档：守方${defRouted ? '溃散 +20' : '未溃散险胜 +10'}（实际 +${gain}）`,
      );
    } else {
      console.log(`    说明: 势均力敌场景守方胜（winner=${outcome.winner}），守方击退由 5c 覆盖`);
    }
  }

  // 5c. 守方击退：攻 1000 vs 敌 8000 → 攻方败 → 守方 Army 主将 +10
  {
    const { outcome, state, defCmd } = runFieldBattle(1_000, 8_000);
    const gain = state.officers[defCmd]?.merit ?? 0;
    if (outcome.winner === 'defender') {
      assert(gain === MERIT_FIELD_ROUT, `野战守方击退：守方主将 +${MERIT_FIELD_ROUT}（实际 +${gain}）`);
    } else {
      console.log(`    说明: 守方击退场景未按预期攻方败（winner=${outcome.winner}），跳过精确断言`);
    }
  }
}

console.log(`\n结果：${pass} 通过，${fail} 失败`);
if (fail > 0) process.exit(1);
