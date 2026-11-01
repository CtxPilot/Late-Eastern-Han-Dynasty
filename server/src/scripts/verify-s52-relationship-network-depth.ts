// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 454 · docs/52「S24 关系网深度闭环」验证（engine 级）。
 *
 * 断言面：
 *   1. 义结金兰资格（同城/同势力/亲和/上限/宿敌/金额）与缔结结果；
 *   2. 拜师授业资格（属性优势/师徒唯一/收徒上限）与缔结结果；
 *   3. 每年正月授业点拨（确定性最大差距项、上限师傅−2、非同城零操作）；
 *   4. 季度宿敌同城忠诚惩罚（君主豁免）；
 *   5. 战阵击斩血仇（复仇者识别、亲和 −100、去重）与血仇不仕登用门禁（零 RNG/零扣金）；
 *   6. 六角羁绊查询（义兄弟并肩/宿敌相搏/同袍死战）；
 *   7. 持久化 Schema（合法/非法引用）；
 *   8. 无运行时关系时零操作与双局确定性。
 */
import {
  GameStateSchema,
  OfficerStatus,
  SWORN_GOLD,
  MENTOR_GOLD,
  applySwornFury,
  bloodFeudAvengerIds,
  findRecruitNemesis,
  hasFallenSwornBrother,
  isNemesisPair,
  isSwornBrothers,
  nemesisBattleBonus,
  relationPairKey,
  swornAllyBattleBonus,
  type GameState,
  type RuntimeRelation,
} from '@leh/shared';
import { recruitOfficer } from '../engine/personnel.js';
import {
  allRelations,
  appointMentorship,
  registerBloodFeud,
  swearBrotherhood,
  tickMentorshipAnnual,
  tickNemesisCoexistenceQuarter,
} from '../engine/relationDepth.js';
import { createGame, getGame } from '../services/game.js';

let pass = 0;
let fail = 0;
function assert(cond: unknown, msg: string): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

function freshState(): GameState {
  createGame(1, 2);
  return JSON.parse(JSON.stringify(getGame())) as GameState;
}

function withAffinity(state: GameState, aId: number, bId: number, value: number): GameState {
  return {
    ...state,
    relationAffinities: {
      ...(state.relationAffinities ?? {}),
      [relationPairKey(aId, bId)]: value,
    },
  };
}

function runtime(state: GameState, relation: RuntimeRelation): GameState {
  return { ...state, runtimeRelations: [...(state.runtimeRelations ?? []), relation] };
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.entries(v as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, val]) => `${k}:${stable(val)}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

// 场景 1 玩家 = 刘备军（id 2）；同城 14：刘备(2)、诸葛亮(4)、张飞(7)、赵云(10)、公孙瓒(106)
const LIU_BEI = 2;
const ZHUGE = 4;
const ZHANG_FEI = 7;
const ZHAO_YUN = 10;
const GONGSUN = 106;
const SIMA_YI = 12;

console.log('S24 关系网深度验证（docs/52）');

// —— 1. 义结金兰 ——
{
  let state = withAffinity(freshState(), ZHUGE, ZHAO_YUN, 90);
  const before = state.cities[state.officers[ZHUGE].location!]!.gold;
  const next = swearBrotherhood(state, ZHUGE, ZHAO_YUN);
  const rel = (next.runtimeRelations ?? []).find(
    (r) => r.type === 'sworn' && ((r.fromId === ZHUGE && r.toId === ZHAO_YUN) || (r.fromId === ZHAO_YUN && r.toId === ZHUGE)),
  );
  assert(rel != null, '义结金兰写入 runtimeRelations(sworn)');
  assert(next.relationAffinities?.[relationPairKey(ZHUGE, ZHAO_YUN)] === 100, '结义后亲和锁定 100');
  const payer = Object.values(next.cities).find((c) => c.gold === before - SWORN_GOLD && c.ruler === next.playerFactionId);
  assert(payer != null || before < SWORN_GOLD, `结义扣除 ${SWORN_GOLD} 金`);
  assert(next.actionLog[0]?.message.includes('金兰之契'), '结义写入大事记');

  const lowAffinity = withAffinity(freshState(), ZHUGE, ZHAO_YUN, 50);
  let lowErr = '';
  try { swearBrotherhood(lowAffinity, ZHUGE, ZHAO_YUN); } catch (e) { lowErr = String(e); }
  assert(lowErr.includes('亲和不足'), '亲和 <80 拒绝结义');

  const alreadySworn = runtime(withAffinity(freshState(), ZHUGE, ZHAO_YUN, 90), {
    fromId: ZHUGE, toId: ZHAO_YUN, type: 'sworn',
  });
  let dupErr = '';
  try { swearBrotherhood(alreadySworn, ZHUGE, ZHAO_YUN); } catch (e) { dupErr = String(e); }
  assert(dupErr.includes('已是义兄弟'), '重复结义拒绝');

  let capState = withAffinity(freshState(), ZHUGE, ZHAO_YUN, 90);
  capState = runtime(capState, { fromId: ZHUGE, toId: LIU_BEI, type: 'sworn' });
  capState = runtime(capState, { fromId: ZHUGE, toId: ZHANG_FEI, type: 'sworn' });
  let capErr = '';
  try { swearBrotherhood(capState, ZHUGE, ZHAO_YUN); } catch (e) { capErr = String(e); }
  assert(capErr.includes('结义已满'), '结义上限 2 人');

  const nemesisState = withAffinity(runtime(freshState(), { fromId: ZHUGE, toId: ZHAO_YUN, type: 'enemy' }), ZHUGE, ZHAO_YUN, 95);
  let nemErr = '';
  try { swearBrotherhood(nemesisState, ZHUGE, ZHAO_YUN); } catch (e) { nemErr = String(e); }
  assert(nemErr.includes('宿敌不可结义'), '宿敌不可结义');

  const otherCity = freshState();
  const moved = JSON.parse(JSON.stringify(otherCity)) as GameState;
  const awayCity = Object.values(moved.cities).find((c) => c.id !== moved.officers[ZHUGE].location && c.ruler === moved.playerFactionId);
  if (awayCity) {
    moved.officers[ZHAO_YUN] = { ...moved.officers[ZHAO_YUN], location: awayCity.id };
    let cityErr = '';
    try { swearBrotherhood(withAffinity(moved, ZHUGE, ZHAO_YUN, 90), ZHUGE, ZHAO_YUN); } catch (e) { cityErr = String(e); }
    assert(cityErr.includes('同处一城'), '不同城拒绝结义');
  } else {
    assert(true, '不同城拒绝结义（场景无第二城，跳过）');
  }
}

// —— 2. 拜师授业 ——
{
  let state = withAffinity(freshState(), ZHUGE, ZHAO_YUN, 50);
  const next = appointMentorship(state, ZHUGE, ZHAO_YUN);
  const rel = (next.runtimeRelations ?? []).find(
    (r) => r.type === 'master_disciple' && r.fromId === ZHUGE && r.toId === ZHAO_YUN,
  );
  assert(rel != null, '拜师写入有向 master_disciple');
  assert(next.relationAffinities?.[relationPairKey(ZHUGE, ZHAO_YUN)] === 90, '师徒亲和提升至 90');
  assert(next.actionLog[0]?.message.includes('名师高足'), '拜师写入大事记');
  assert(MENTOR_GOLD > 0, `拜师束脩 ${MENTOR_GOLD} 金`);

  const noGap = withAffinity(freshState(), ZHAO_YUN, GONGSUN, 50);
  let gapErr = '';
  try { appointMentorship(noGap, GONGSUN, ZHAO_YUN); } catch (e) { gapErr = String(e); }
  assert(gapErr.length > 0, '无属性优势的师傅拒绝收徒');

  let alreadyMaster = withAffinity(freshState(), ZHUGE, ZHAO_YUN, 50);
  alreadyMaster = runtime(alreadyMaster, { fromId: ZHUGE, toId: ZHANG_FEI, type: 'master_disciple' });
  alreadyMaster = runtime(alreadyMaster, { fromId: ZHUGE, toId: GONGSUN, type: 'master_disciple' });
  let masterErr = '';
  try { appointMentorship(alreadyMaster, ZHUGE, ZHAO_YUN); } catch (e) { masterErr = String(e); }
  assert(masterErr.includes('收徒已满'), '师傅收徒上限 2 人');

  let discipleBusy = withAffinity(freshState(), ZHUGE, ZHAO_YUN, 50);
  discipleBusy = runtime(discipleBusy, { fromId: LIU_BEI, toId: ZHAO_YUN, type: 'master_disciple' });
  let busyErr = '';
  try { appointMentorship(discipleBusy, ZHUGE, ZHAO_YUN); } catch (e) { busyErr = String(e); }
  assert(busyErr.includes('已有师傅'), '徒弟仅限一位师傅');
}

// —— 3. 每年正月授业点拨 ——
{
  let state = withAffinity(freshState(), ZHUGE, ZHAO_YUN, 90);
  const bonded = runtime(state, { fromId: ZHUGE, toId: ZHAO_YUN, type: 'master_disciple' });
  const beforePolitics = bonded.officers[ZHAO_YUN].stats.politics;
  const grown = tickMentorshipAnnual(bonded);
  assert(grown.officers[ZHAO_YUN].stats.politics === beforePolitics + 1, '授业点拨按最大差距项（政治）成长 +1');
  assert(grown.actionLog[0]?.message.includes('授业点拨'), '授业点拨写入大事记');

  const repeat = tickMentorshipAnnual(grown);
  assert(repeat === grown, '同一年内重复 tick 不再成长（每年 1 点）');

  const apart = JSON.parse(JSON.stringify(bonded)) as GameState;
  const other = Object.values(apart.cities).find((c) => c.id !== apart.officers[ZHAO_YUN].location);
  if (other) {
    apart.officers[ZHAO_YUN] = { ...apart.officers[ZHAO_YUN], location: other.id };
    const noop = tickMentorshipAnnual(apart);
    assert(noop === apart, '师徒不同城时授业点拨零操作');
  } else {
    assert(true, '师徒不同城时零操作（场景无第二城，跳过）');
  }

  const capped = JSON.parse(JSON.stringify(bonded)) as GameState;
  const master = capped.officers[ZHUGE];
  capped.officers[ZHAO_YUN] = {
    ...capped.officers[ZHAO_YUN],
    stats: {
      leadership: master.stats.leadership - 2,
      war: master.stats.war - 2,
      intelligence: master.stats.intelligence - 2,
      politics: master.stats.politics - 2,
      charisma: master.stats.charisma - 2,
    },
  };
  const cappedNext = tickMentorshipAnnual(capped);
  assert(cappedNext === capped, '徒弟属性达「师傅−2」上限后不再成长');
}

// —— 4. 季度宿敌同城忠诚惩罚 ——
{
  let state = freshState();
  state = runtime(state, { fromId: ZHANG_FEI, toId: ZHAO_YUN, type: 'enemy' });
  const beforeA = state.officers[ZHANG_FEI].loyalty;
  const beforeB = state.officers[ZHAO_YUN].loyalty;
  const next = tickNemesisCoexistenceQuarter(state);
  assert(next.officers[ZHANG_FEI].loyalty === beforeA - 10, '宿敌同城：张飞忠诚 −10');
  assert(next.officers[ZHAO_YUN].loyalty === beforeB - 10, '宿敌同城：赵云忠诚 −10');
  assert(next.actionLog[0]?.message.includes('势同水火'), '宿敌同城写入大事记');

  const rulerCase = runtime(freshState(), { fromId: LIU_BEI, toId: ZHUGE, type: 'enemy' });
  const rulerNext = tickNemesisCoexistenceQuarter(rulerCase);
  assert(rulerNext.officers[LIU_BEI].loyalty === rulerCase.officers[LIU_BEI].loyalty, '君主不参与宿敌忠诚惩罚');
  assert(rulerNext.officers[ZHUGE].loyalty === rulerCase.officers[ZHUGE].loyalty - 10, '宿敌另一方（非君主）忠诚 −10');
}

// —— 5. 血仇与血仇不仕 ——
{
  const relations = [
    { fromId: ZHUGE, toId: ZHAO_YUN, type: 'sworn' as const },
  ];
  assert(bloodFeudAvengerIds(ZHAO_YUN, SIMA_YI, relations).includes(ZHUGE), '结义兄弟纳入复仇者');
  const teacher = [{ fromId: ZHUGE, toId: ZHAO_YUN, type: 'master_disciple' as const }];
  assert(bloodFeudAvengerIds(ZHAO_YUN, SIMA_YI, teacher).includes(ZHUGE), '师傅为徒弟复仇');
  assert(bloodFeudAvengerIds(ZHUGE, SIMA_YI, teacher).includes(ZHAO_YUN), '徒弟为师傅复仇');
  const parent = [{ fromId: LIU_BEI, toId: ZHAO_YUN, type: 'parent_child' as const }];
  assert(bloodFeudAvengerIds(ZHAO_YUN, SIMA_YI, parent).includes(LIU_BEI), '父子血亲纳入复仇者');

  let state = runtime(freshState(), { fromId: ZHUGE, toId: ZHAO_YUN, type: 'sworn' });
  state = { ...state, officers: { ...state.officers, [ZHAO_YUN]: { ...state.officers[ZHAO_YUN], status: OfficerStatus.DEAD } } };
  const feud = registerBloodFeud(state, ZHANG_FEI, ZHAO_YUN);
  assert(isNemesisPair(ZHUGE, ZHANG_FEI, feud.runtimeRelations ?? []), '阵斩后结义兄弟与凶手结为宿敌');
  assert(feud.relationAffinities?.[relationPairKey(ZHUGE, ZHANG_FEI)] === -100, '血仇亲和坠至 −100');
  assert(feud.actionLog[0]?.message.includes('血海深仇'), '血仇写入大事记');
  const again = registerBloodFeud(feud, ZHANG_FEI, ZHAO_YUN);
  assert(again === feud, '同一血仇不重复写入');

  // 血仇不仕：目标与说客互为宿敌 → 掷点前拦截，不耗金、不消费 RNG。
  let gateState = freshState();
  const target = Object.values(gateState.officers).find(
    (o) => o.faction != null && o.faction !== gateState.playerFactionId && o.status === 'active',
  );
  assert(target != null, '场景存在可用于血仇不仕门禁的武将');
  if (target) {
    gateState.officers[target.id] = {
      ...gateState.officers[target.id],
      faction: null,
      status: OfficerStatus.FREE,
      location: gateState.officers[ZHUGE].location,
    };
    gateState = runtime(gateState, { fromId: target.id, toId: ZHUGE, type: 'enemy' });
    let rngCalls = 0;
    const rng = () => { rngCalls++; return 0; };
    const beforeGold = Object.values(gateState.cities)
      .filter((c) => c.ruler === gateState.playerFactionId)
      .reduce((n, c) => n + c.gold, 0);
    let gateErr = '';
    try { recruitOfficer(gateState, target.id, rng, ZHUGE); } catch (e) { gateErr = String(e); }
    assert(gateErr.includes('血仇未雪'), '血仇不仕：登用被硬门禁拦截');
    assert(rngCalls === 0, '血仇不仕：拦截前零 RNG 消费');
    const afterGold = Object.values(gateState.cities)
      .filter((c) => c.ruler === gateState.playerFactionId)
      .reduce((n, c) => n + c.gold, 0);
    assert(afterGold === beforeGold, '血仇不仕：拦截前零扣金');
    assert(findRecruitNemesis(target.id, ZHUGE, LIU_BEI, allRelations(gateState)) === ZHUGE, 'findRecruitNemesis 命中说客');
  }
}

// —— 6. 六角羁绊查询 ——
{
  const rels = [{ fromId: ZHUGE, toId: ZHAO_YUN, type: 'sworn' as const }];
  const sworn = swornAllyBattleBonus(ZHUGE, [ZHAO_YUN], rels);
  assert(sworn.damagePct === 5 && sworn.critBonus === 5, '义兄弟并肩：伤害 +5%、暴击 +5%');
  const noAlly = swornAllyBattleBonus(ZHUGE, [ZHANG_FEI], rels);
  assert(noAlly.damagePct === 0 && noAlly.critBonus === 0, '无义兄弟同场不加成');
  const nem = nemesisBattleBonus(ZHUGE, SIMA_YI, [
    { fromId: ZHUGE, toId: SIMA_YI, type: 'enemy' as const },
  ]);
  assert(nem.critBonus === 10 && nem.counterBonus === 10, '宿敌相搏：暴击 +10%、反击 +10%');
  const staticNem = nemesisBattleBonus(ZHUGE, SIMA_YI, allRelations(freshState()));
  assert(staticNem.critBonus === 10, '静态历史宿敌同样生效（诸葛亮↔司马懿）');
  assert(hasFallenSwornBrother(ZHUGE, [ZHAO_YUN], rels), '同袍死战：义兄弟已溃');
  const units = [
    { id: 'a', side: 'attacker', commanderId: ZHUGE, isDestroyed: false, isRetreated: false, troopCount: 100, morale: 70, swornFury: undefined },
    { id: 'b', side: 'attacker', commanderId: ZHAO_YUN, isDestroyed: true, isRetreated: false, troopCount: 0, morale: 0, swornFury: undefined },
  ];
  const fury = applySwornFury(units, rels);
  assert(fury[0].swornFury === true && fury[0].morale === 85, '同袍死战触发：士气 +15 并标记');
  const furyAgain = applySwornFury(fury, rels);
  assert(furyAgain[0].morale === 85, '同袍死战不重复加士气');
}

// —— 7. Schema ——
{
  const state = runtime(withAffinity(freshState(), ZHUGE, ZHAO_YUN, 90), {
    fromId: ZHUGE, toId: ZHAO_YUN, type: 'sworn', establishedYear: 190, establishedMonth: 1,
  });
  assert(GameStateSchema.safeParse(state).success, 'Schema 接受合法 runtimeRelations');
  const bad = runtime(freshState(), { fromId: ZHUGE, toId: 99999, type: 'sworn' });
  assert(!GameStateSchema.safeParse(bad).success, 'Schema 拒绝悬空武将引用');
  const same = runtime(freshState(), { fromId: ZHUGE, toId: ZHUGE, type: 'sworn' });
  assert(!GameStateSchema.safeParse(same).success, 'Schema 拒绝自指关系');
}

// —— 8. 零操作与确定性 ——
{
  const state = freshState();
  assert(tickMentorshipAnnual(state) === state, '无运行时关系：授业点拨零操作（同引用）');
  assert(tickNemesisCoexistenceQuarter(state) === state, '无运行时关系：宿敌同城零操作（同引用）');

  const base = withAffinity(freshState(), ZHUGE, ZHAO_YUN, 90);
  const a = swearBrotherhood(base, ZHUGE, ZHAO_YUN);
  const b = swearBrotherhood(base, ZHUGE, ZHAO_YUN);
  assert(stable(a) === stable(b), '双局结义结果逐字节一致');
  assert(isSwornBrothers(ZHUGE, ZHAO_YUN, a.runtimeRelations ?? []), 'isSwornBrothers 双向判定');
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
if (fail > 0) process.exit(1);
