// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 433 · docs/43 S1 围城合流（战役层自动战）验证。
 *
 * 断言面（docs/43 §六 S1 行 + §五 R1~R4）：
 *   1. 双军围同城 → 一次合成自动战（兵力=Σ、主军主导编成）；
 *   2. 损耗按兵力占比分摊、尾差归主军（R2 比例守恒）；
 *   3. siegeState 共享/迁移不重置（D5/R3）、主军撤退转移、劝降读主军围城月数；
 *   4. AI 对等：多军围城 AI 同样一次合成强攻（D3/D7）；
 *   5. 单军路径与 `runAutoBattle` 直接调用逐字节等价（R4）；
 *   6. 双局 24 月确定性 + 完整 GameStateSchema（R1 无合成军落库）。
 */
import {
  DipRelation,
  FormationType,
  GameStateSchema,
  SerializableRng,
  UnitType,
  buildMergedSiegeArmy,
  collectSiegeMergeGroup,
  type CampaignArmy,
  type GameState,
  type SiegeState,
} from '@leh/shared';
import {
  assaultForFaction,
  retreatArmy,
  runAutoBattle,
  tickCampaignMarch,
  trySiegeSurrender,
} from '../engine/campaign.js';
import { runAiMilitary } from '../engine/aiMilitary.js';
import { createGame, endTurn, getGame } from '../services/game.js';

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
  return getGame();
}

/** 把武将调到前线（location 指向出发城并移出名册，仿 startCampaign 语义）。 */
function deployOfficer(state: GameState, officerId: number, fromNodeId: number): GameState {
  const officer = state.officers[officerId];
  if (!officer) throw new Error(`武将 ${officerId} 不存在`);
  const cities = { ...state.cities };
  for (const city of Object.values(state.cities)) {
    if (!city.officers.includes(officerId)) continue;
    cities[city.id] = { ...city, officers: city.officers.filter((id) => id !== officerId) };
  }
  return {
    ...state,
    cities,
    officers: { ...state.officers, [officerId]: { ...officer, location: fromNodeId } },
  };
}

function siegeStateOf(state: GameState, cityId: number, siegeTurns = 0): SiegeState {
  const wall = (state.cities[cityId]?.stats.wall ?? 0) * 100;
  return {
    wallDurability: wall,
    maxWallDurability: wall,
    gateDurability: 100,
    siegeTurns,
    attackerStructures: [],
    defenderBonus: 0,
    surrenderChance: 10,
  };
}

function siegeArmy(
  overrides: Partial<CampaignArmy> & { id: string; commanderId: number; troops: number },
): CampaignArmy {
  return {
    factionId: 2,
    name: `${overrides.id}军`,
    subCommanderIds: [],
    unitType: UnitType.LIGHT_INFANTRY,
    formation: FormationType.SQUARE,
    currentNodeId: 13,
    targetNodeId: 13,
    path: [],
    phase: 'sieging',
    maxTroops: overrides.troops,
    food: 3000,
    maxFood: 9000,
    morale: 80,
    organization: 80,
    experience: 0,
    fatigue: 0,
    squads: [],
    structures: [],
    fromNodeId: 15,
    ...overrides,
  };
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

console.log('\n=== Session 433 · docs/43 S1 围城合流验证 ===\n');

// ---------------------------------------------------------------------------
console.log('1. 双军围同城 → 一次合成自动战（D3/D4/D7）');
{
  let s = freshState();
  s = deployOfficer(s, 6, 15); // 关羽（襄阳 15）
  s = deployOfficer(s, 7, 14); // 张飞（江陵 14）
  const a = siegeArmy({
    id: 'merge-a',
    name: '关羽军',
    commanderId: 6,
    troops: 8000,
    fromNodeId: 15,
    siegeState: siegeStateOf(s, 13, 3),
  });
  const b = siegeArmy({
    id: 'merge-b',
    name: '张飞军',
    commanderId: 7,
    troops: 4000,
    fromNodeId: 14,
  });
  s = { ...s, campaignArmies: [a, b] };

  const group = collectSiegeMergeGroup(s.campaignArmies, 'merge-b');
  assert(group.map((g) => g.id).join(',') === 'merge-a,merge-b', '合流组按兵力降序（主军=关羽军）');
  assert(buildMergedSiegeArmy(group).troops === 12000, '合成军兵力=Σ（12000）');

  const rng = new SerializableRng(20260908);
  const out = assaultForFaction(s, 'merge-b', 2, () => rng.next());
  const result = out.result;
  assert(
    result.attackerRemaining + result.attackerCasualties === 12000,
    `一次合成自动战：攻方总兵力 12000（余 ${result.attackerRemaining} + 损 ${result.attackerCasualties}）`,
  );
  assert(result.winner === 'attacker', '12000 vs 5000 → 攻方胜（占城分支）');

  const afterA = out.state.campaignArmies.find((x) => x.id === 'merge-a');
  const afterB = out.state.campaignArmies.find((x) => x.id === 'merge-b');
  assert(!!afterA && !!afterB, '两军各回写一次（R1 真身不迁移）');
  assert(
    (afterA?.troops ?? 0) + (afterB?.troops ?? 0) === result.attackerRemaining,
    'R2 比例守恒：Σ各军兵力 = 合流前总兵力 − 总损耗',
  );
  const lossA = 8000 - (afterA?.troops ?? 0);
  const lossB = 4000 - (afterB?.troops ?? 0);
  const floorA = Math.floor((result.attackerCasualties * 8000) / 12000);
  const floorB = Math.floor((result.attackerCasualties * 4000) / 12000);
  assert(lossB === floorB, `损耗按兵力占比 floor 分摊（B −${lossB} = ${floorB}）`);
  assert(
    lossA === floorA + (result.attackerCasualties - floorA - floorB),
    `尾差归主军（A −${lossA} = ${floorA} + 尾差 ${result.attackerCasualties - floorA - floorB}）`,
  );

  const city = out.state.cities[13];
  assert(city.ruler === 2, '占城：宛归刘备军');
  assert(
    city.troops === result.attackerRemaining,
    `占城驻军 = 各军残兵之和（${city.troops}）`,
  );
  assert(
    city.officers.includes(6) && city.officers.includes(7),
    '各军主将一并入城（关羽/张飞）',
  );
  assert(
    out.state.campaignArmies.filter((x) => x.id === 'merge-a' || x.id === 'merge-b').length === 2,
    '合流军无重复回写（ID 唯一）',
  );
  assert(
    out.state.campaignArmies.every((x) => x.siegeState == null),
    '占城后围城进度清除',
  );
  assert(GameStateSchema.safeParse(out.state).success, '占城后过完整 GameStateSchema');
  const captureLog = out.state.actionLog.find((e) => e.type === 'campaign_capture');
  assert(
    captureLog?.message.startsWith('关羽军等 2 支攻占') ?? false,
    `D12 战报主语=「主军名等 N 支」：${captureLog?.message ?? '（无日志）'}`,
  );
}

// ---------------------------------------------------------------------------
console.log('\n2. siegeState 共享 / join 不重置 / 劝降读主军（D5/R3）');
{
  let s = freshState();
  s = deployOfficer(s, 6, 15);
  s = deployOfficer(s, 7, 14);
  s = deployOfficer(s, 10, 15);
  const a = siegeArmy({
    id: 'merge-a',
    name: '关羽军',
    commanderId: 6,
    troops: 8000,
    fromNodeId: 15,
    siegeState: siegeStateOf(s, 13, 3),
  });
  const b = siegeArmy({
    id: 'merge-b',
    name: '张飞军',
    commanderId: 7,
    troops: 4000,
    fromNodeId: 14,
  });
  s = { ...s, campaignArmies: [a, b] };

  // 劝降失败（roll=0.999 → 必失败）：围城月数应记在主军身上
  const fail = trySiegeSurrender(s, 'merge-b', () => 0.999);
  assert(!fail.success, '高 roll → 劝降失败');
  const failA = fail.state.campaignArmies.find((x) => x.id === 'merge-a');
  const failB = fail.state.campaignArmies.find((x) => x.id === 'merge-b');
  assert(failA?.siegeState?.siegeTurns === 4, '主军围城回合 +1（3→4）');
  assert(failB?.siegeState == null, '非主军不持有围城进度（R3 至多一份）');

  // 第三方军行军抵达 → join（不重置、不自持）
  const c = siegeArmy({
    id: 'merge-c',
    name: '赵云军',
    commanderId: 10,
    troops: 3000,
    fromNodeId: 15,
    phase: 'marching',
    path: [13],
  });
  let joined = { ...fail.state, campaignArmies: [...fail.state.campaignArmies, c] };
  joined = tickCampaignMarch(joined);
  const joinedA = joined.campaignArmies.find((x) => x.id === 'merge-a');
  const joinedC = joined.campaignArmies.find((x) => x.id === 'merge-c');
  assert(joinedC?.phase === 'sieging', '行军军抵达敌城进入围城');
  assert(joinedC?.siegeState == null, 'join 不自持围城进度（D5 不重置）');
  assert(joinedA?.siegeState?.siegeTurns === 4, 'join 不重置既有围城进度（仍为 4）');
  assert(
    joined.campaignArmies.filter((x) => x.siegeState != null).length === 1,
    'R3：同城同势力至多一份 siegeState',
  );
  assert(
    joined.actionLog.some((e) => e.message.includes('与友军合流围城')),
    '抵达日志标注「与友军合流围城」',
  );

  // 主军撤退 → 进度迁移给剩余兵力最大军（张飞军 4000 > 赵云军 3000）
  const retreated = retreatArmy(joined, 'merge-a');
  const retreatA = retreated.campaignArmies.find((x) => x.id === 'merge-a');
  const retreatB = retreated.campaignArmies.find((x) => x.id === 'merge-b');
  assert(retreatA?.siegeState == null, '主军撤退后不再持有围城进度');
  assert(retreatB?.siegeState?.siegeTurns === 4, '围城进度迁移给剩余兵力最大军（张飞军，仍为 4）');
  assert(GameStateSchema.safeParse(retreated).success, '撤退后过完整 GameStateSchema');

  // 劝降读主军围城月数：主军 0 月 vs 10 月，成功率差 20 个百分点
  const chanceOf = (turns: number): number => {
    const base = freshState();
    const a0 = siegeArmy({
      id: 'merge-a',
      name: '关羽军',
      commanderId: 6,
      troops: 8000,
      fromNodeId: 15,
      siegeState: siegeStateOf(base, 13, turns),
    });
    const b0 = siegeArmy({
      id: 'merge-b',
      name: '张飞军',
      commanderId: 7,
      troops: 4000,
      fromNodeId: 14,
    });
    const res = trySiegeSurrender(
      { ...base, campaignArmies: [a0, b0] },
      'merge-b',
      () => 0.999,
    );
    const msg = res.state.actionLog.find((e) => e.type === 'campaign_surrender_fail')?.message ?? '';
    return Number(/(\d+)%/.exec(msg)?.[1] ?? -1);
  };
  const c0 = chanceOf(0);
  const c10 = chanceOf(10);
  assert(c0 > 0 && c10 > 0, `劝降成功率可读（0 月 ${c0}% / 10 月 ${c10}%）`);
  assert(c10 - c0 === 20, '劝降成功率随主军围城月数 +2%/月（10 月 = +20）');
}

// ---------------------------------------------------------------------------
console.log('\n3. AI 对等：多军围城一次合成强攻（D3/D7）');
{
  let s = freshState();
  const enemyCity = 15; // 玩家（刘备军）襄阳
  assert(s.cities[enemyCity].ruler === 2, '目标城归玩家（襄阳 15）');
  // 外交：曹操(1) 对刘备(2) 敌对
  const link = s.diplomacy.find(
    (d) => (d.factionA === 1 && d.factionB === 2) || (d.factionA === 2 && d.factionB === 1),
  );
  s = {
    ...s,
    diplomacy: link
      ? s.diplomacy.map((d) => (d === link ? { ...d, relation: DipRelation.WAR } : d))
      : [...s.diplomacy, { factionA: 1, factionB: 2, relation: DipRelation.WAR, favorability: -80 }],
  };
  const aiOfficers = Object.values(s.officers)
    .filter((o) => o.faction === 1 && o.status === 'active')
    .sort((x, y) => x.id - y.id)
    .slice(0, 2);
  assert(aiOfficers.length === 2, '取到 2 名曹操军武将');
  for (const officer of aiOfficers) s = deployOfficer(s, officer.id, enemyCity);
  const aiA = siegeArmy({
    id: 'ai-merge-a',
    name: '夏侯惇军',
    factionId: 1,
    commanderId: aiOfficers[0]!.id,
    troops: 5000,
    currentNodeId: enemyCity,
    targetNodeId: enemyCity,
    fromNodeId: enemyCity,
    siegeState: siegeStateOf(s, enemyCity, 1),
  });
  const aiB = siegeArmy({
    id: 'ai-merge-b',
    name: '许褚军',
    factionId: 1,
    commanderId: aiOfficers[1]!.id,
    troops: 4000,
    currentNodeId: enemyCity,
    targetNodeId: enemyCity,
    fromNodeId: enemyCity,
  });
  s = { ...s, campaignArmies: [aiA, aiB] };

  const rng = new SerializableRng(433);
  const after = runAiMilitary(s, () => rng.next(), () => rng.next());
  const mergedReports = after.actionLog.filter(
    (e) => e.type === 'ai_battle_report' && e.message.includes('等 2 支'),
  );
  assert(mergedReports.length === 1, `AI 多军围城仅一次战报（等 2 支）：${mergedReports[0]?.message ?? '（无）'}`);
  assert(
    !after.campaignArmies.some((x) => x.id === 'ai-merge-a' && x.phase === 'sieging'),
    'AI 合流后不再逐军重复强攻',
  );
  assert(GameStateSchema.safeParse(after).success, 'AI 合流后过完整 GameStateSchema');
}

// ---------------------------------------------------------------------------
console.log('\n4. 单军路径等价（R4）');
{
  let s = freshState();
  s = deployOfficer(s, 6, 15);
  const solo = siegeArmy({
    id: 'solo',
    name: '关羽军',
    commanderId: 6,
    troops: 8000,
    fromNodeId: 15,
    siegeState: siegeStateOf(s, 13, 2),
  });
  s = { ...s, campaignArmies: [solo] };
  assert(buildMergedSiegeArmy([solo]) === solo, '单军组合成军=真身（无变换）');
  assert(collectSiegeMergeGroup(s.campaignArmies, 'solo').length === 1, '单军组合流组长度 1');

  const rngDirect = new SerializableRng(99);
  const direct = runAutoBattle(
    s,
    solo,
    null,
    { cityId: 13, garrison: s.cities[13].troops, wall: s.cities[13].stats.wall ?? 0 },
    () => rngDirect.next(),
  );
  const rngAssault = new SerializableRng(99);
  const out = assaultForFaction(s, 'solo', 2, () => rngAssault.next());
  assert(
    stable(direct) === stable(out.result),
    '单军强攻结果与 runAutoBattle 直接调用逐字节一致（R4）',
  );
  const afterSolo = out.state.campaignArmies.find((x) => x.id === 'solo');
  assert(
    afterSolo?.troops === out.result.attackerRemaining,
    '单军回写兵力 = 自动战剩余（无分摊）',
  );
  if (out.result.winner === 'attacker') {
    assert(
      out.state.cities[13].troops === out.result.attackerRemaining,
      '单军占城驻军 = 剩余兵力',
    );
  }
  assert(
    out.state.campaignArmies.filter((x) => x.id === 'solo').length === 1,
    '单军仅回写一次',
  );
  assert(GameStateSchema.safeParse(out.state).success, '单军战后过完整 GameStateSchema');
}

// ---------------------------------------------------------------------------
console.log('\n5. 双局 24 月确定性（R4 权威 RNG 流）');
{
  const run = (): string => {
    createGame(1, 2);
    for (let i = 0; i < 24; i++) endTurn();
    return stable(getGame());
  };
  const first = run();
  const second = run();
  assert(first === second, '同种子 24 个月终态逐字节一致');
}

console.log(`\n=== 结果: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
