// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * HC-P2 称帝主线与天下一统终局胜负条件专项验收脚本。
 *
 * 验收维度：
 * 1. 称帝门槛权威查询（getEmperorRequirements）
 * 2. 双路径即位机制（受禅代汉 vs 自主改元）
 * 3. 称帝权威状态转移（proclaimEmperor）
 * 4. 天命跃升与外交天命威慑
 * 5. 战役终局：天下一统（Unification Victory）
 * 6. 战役终局：身死国灭（Defeat Game Over）
 * 7. 零 RNG 漂移与金样指纹守护
 *
 * 运行: pnpm --filter @leh/server exec tsx src/scripts/verify-s50-emperor-and-endgame.ts
 */

import { createGame } from '../services/game.js';
import {
  getEmperorRequirements,
  proclaimEmperor,
  establishHegemony,
  EMPEROR_IMPERIAL_AUTHORITY_REQUIRED,
} from '../engine/hegemony.js';
import { checkEndgameStatus } from '../engine/endgame.js';
import { computeMandate, type GameState, type PoliticalStage } from '@leh/shared';

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

function run(): void {
  console.log('=== HC-P2 称帝主线与天下一统终局胜负条件专项验收 ===\n');

  const g = createGame(2, 1);
  const playerFid = g.playerFactionId;

  // ── 1. 称帝门槛权威查询 ──────────────────────────────────────────
  console.log('【1. 称帝门槛权威查询（getEmperorRequirements）】');
  const reqVassal = getEmperorRequirements(g, playerFid);
  assert(!reqVassal.politicalStage.passed, '诸侯阶段（vassal）不可称帝');
  assert(!reqVassal.allPassed, '诸侯阶段称帝门槛全检不通过');

  // 开霸府后检查（先赋予控制汉帝所在城池）
  const playerFirstCity = g.factions[playerFid].cityIds[0];
  const gWithEmperor: GameState = {
    ...g,
    emperorLocation: playerFirstCity,
    cities: {
      ...g.cities,
      [playerFirstCity]: {
        ...g.cities[playerFirstCity],
        ruler: playerFid,
      },
    },
  };
  let stateHegemon = establishHegemony(gWithEmperor, playerFid);
  const reqHegemon = getEmperorRequirements(stateHegemon, playerFid);
  assert(!reqHegemon.politicalStage.passed, '霸府阶段（hegemon）不可跳级称帝');
  assert(reqHegemon.cityCount.threshold >= 4, `190 剧本称帝城池门槛合理（需 ${reqHegemon.cityCount.threshold} 城，>=50% 争夺城）`);

  // 构造已称王状态
  let stateKing: GameState = {
    ...stateHegemon,
    factions: {
      ...stateHegemon.factions,
      [playerFid]: {
        ...stateHegemon.factions[playerFid],
        politicalStage: 'king' as PoliticalStage,
        kingdomName: '魏',
        politicalTitle: '魏王',
        politicalStageAgeMonths: 5, // 仅维持 5 个月
        imperialAuthority: 70, // 皇权不足 90
        cityIds: [playerFirstCity], // 仅 1 城
      },
    },
  };
  const reqKingImmature = getEmperorRequirements(stateKing, playerFid);
  assert(reqKingImmature.politicalStage.passed, '王阶段政治阶段检查通过');
  assert(!reqKingImmature.cityCount.passed, '城池不足时城池检查不通过');
  assert(!reqKingImmature.politicalStageAgeMonths.passed, '称王未满12个月时沉淀检查不通过');
  assert(!reqKingImmature.imperialAuthority.passed, '皇权不足90时检查不通过');
  assert(!reqKingImmature.allPassed, '未满足全部条件时 allPassed 为 false');

  // 构造满足条件的王阶段状态
  const contestableCities = Object.keys(g.cities).map(Number).slice(0, reqKingImmature.cityCount.threshold);
  const kingCities = { ...stateKing.cities };
  for (const cid of contestableCities) {
    kingCities[cid] = { ...kingCities[cid], ruler: playerFid };
  }
  let stateKingReady: GameState = {
    ...stateKing,
    cities: kingCities,
    factions: {
      ...stateKing.factions,
      [playerFid]: {
        ...stateKing.factions[playerFid],
        cityIds: contestableCities,
        politicalStageAgeMonths: 14, // 满足 >= 12
        imperialAuthority: 95, // 满足 >= 90
      },
    },
  };
  const reqKingReady = getEmperorRequirements(stateKingReady, playerFid);
  assert(reqKingReady.cityCount.passed, `城池达标（${reqKingReady.cityCount.current}/${reqKingReady.cityCount.threshold}）`);
  assert(reqKingReady.politicalStageAgeMonths.passed, `称王沉淀达标（${reqKingReady.politicalStageAgeMonths.current}月 >= 12月）`);
  assert(reqKingReady.imperialAuthority.passed, `皇权达标（${reqKingReady.imperialAuthority.current} >= 90）`);
  assert(reqKingReady.allPassed, '全部条件满足时 allPassed 为 true');
  assert(reqKingReady.recommendedEraNames.length >= 3, `提供推荐开国年号候选（${reqKingReady.recommendedEraNames.join('、')}）`);

  // ── 2. 双路径即位机制（受禅代汉 vs 自主改元） ─────────────────────
  console.log('\n【2. 双路径即位机制（受禅代汉 vs 自主改元）】');
  // 无天子、无玉玺
  const stateNoEmperorNoSeal: GameState = {
    ...stateKingReady,
    emperorLocation: null,
    factions: {
      ...stateKingReady.factions,
      [playerFid]: {
        ...stateKingReady.factions[playerFid],
        inventory: {},
      },
    },
  };
  const reqNoAbdication = getEmperorRequirements(stateNoEmperorNoSeal, playerFid);
  assert(!reqNoAbdication.isAbdication, '无天子且无玉玺时判定为自主改元即位（!isAbdication）');

  // 控制天子城池
  const stateWithEmperor: GameState = {
    ...stateNoEmperorNoSeal,
    emperorLocation: contestableCities[0], // 天子在己方城
  };
  const reqWithEmperor = getEmperorRequirements(stateWithEmperor, playerFid);
  assert(reqWithEmperor.isAbdication, '控制天子时判定为受禅代汉（isAbdication === true）');

  // 未控天子但持存传国玉玺（item 15）
  const stateWithSeal: GameState = {
    ...stateNoEmperorNoSeal,
    emperorLocation: 9999, // 天子在他方
    factions: {
      ...stateNoEmperorNoSeal.factions,
      [playerFid]: {
        ...stateNoEmperorNoSeal.factions[playerFid],
        inventory: { 15: 1 },
      },
    },
  };
  const reqWithSeal = getEmperorRequirements(stateWithSeal, playerFid);
  assert(reqWithSeal.isAbdication, '持有传国玉玺时判定为奉玺受禅代汉（isAbdication === true）');

  // ── 3. 称帝权威状态转移（proclaimEmperor） ─────────────────────────
  console.log('\n【3. 称帝权威状态转移（proclaimEmperor）】');
  // 执行受禅称帝
  const stateAfterEmperorAbdication = proclaimEmperor(stateWithEmperor, playerFid, '黄初');
  const facEmperor = stateAfterEmperorAbdication.factions[playerFid];
  assert(facEmperor.politicalStage === 'emperor', '政治阶段成功晋升为 emperor');
  assert(facEmperor.politicalTitle === '魏帝', '君主头衔确立为「魏帝」');
  assert(facEmperor.eraName === '黄初', '开国年号确立为「黄初」');
  assert(facEmperor.imperialAuthority === 95 - EMPEROR_IMPERIAL_AUTHORITY_REQUIRED, `皇权准确扣除 90（余量 ${facEmperor.imperialAuthority}）`);
  assert(facEmperor.politicalStageAgeMonths === 0, '新阶段沉淀月数重置为 0');
  assert(
    stateAfterEmperorAbdication.actionLog.some((l) => l.type === 'emperor_proclaimed' && l.message.includes('受禅登基')),
    '行动日志准确记录受禅登基大典',
  );

  // 执行自主改元称帝（验证其他势力好感扣减 20）
  const initialDiplomacy = stateNoEmperorNoSeal.diplomacy.map((link) => ({ ...link, favorability: 50 }));
  const stateBeforeAutonomous: GameState = {
    ...stateNoEmperorNoSeal,
    diplomacy: initialDiplomacy,
  };
  const stateAfterAutonomous = proclaimEmperor(stateBeforeAutonomous, playerFid, '建安');
  const otherLinks = stateAfterAutonomous.diplomacy.filter(
    (l) => l.factionA === playerFid || l.factionB === playerFid,
  );
  assert(
    otherLinks.every((l) => l.favorability === 30),
    '自主改元称帝使所有其他诸侯好感度下降 20（50 -> 30）',
  );
  assert(
    stateAfterAutonomous.actionLog.some((l) => l.type === 'emperor_proclaimed' && l.message.includes('自主即位')),
    '行动日志准确记录自主改元即位',
  );

  // ── 4. 天命跃升与机制收益 ─────────────────────────────────────────
  console.log('\n【4. 天命跃升与机制收益】');
  const mandateBefore = computeMandate(stateKingReady.factions[playerFid], stateKingReady);
  const mandateAfter = computeMandate(facEmperor, stateAfterEmperorAbdication);
  assert(mandateAfter - mandateBefore === 20, `称帝天命跃升 20 点（王阶段30 -> 帝阶段50，当前 ${mandateAfter}）`);

  // ── 5. 战役终局：天下一统（Unification Victory） ──────────────────
  console.log('\n【5. 战役终局：天下一统（Unification Victory）】');
  // 构造所有其他势力全部灭亡的状态
  const deadFactions: GameState['factions'] = {};
  for (const [fidStr, fac] of Object.entries(stateAfterEmperorAbdication.factions)) {
    const fid = Number(fidStr);
    if (fid === playerFid) {
      deadFactions[fid] = { ...fac, isAlive: true };
    } else {
      deadFactions[fid] = { ...fac, isAlive: false, cityIds: [] };
    }
  }
  const stateNearVictory: GameState = {
    ...stateAfterEmperorAbdication,
    factions: deadFactions,
    endgameResult: undefined,
  };
  const stateVictory = checkEndgameStatus(stateNearVictory);
  assert(stateVictory.endgameResult != null, '成功生成终局结算结果（endgameResult）');
  assert(stateVictory.endgameResult?.type === 'unification_victory', '终局类型为天下一统胜利（unification_victory）');
  assert(stateVictory.endgameResult?.rulerName != null, `记录开国君主姓名：${stateVictory.endgameResult?.rulerName}`);
  assert(stateVictory.endgameResult?.eraName === '黄初', `记录开国年号：${stateVictory.endgameResult?.eraName}`);
  assert(stateVictory.endgameResult?.topMeritOfficers != null, '开国功臣榜已生成');
  assert((stateVictory.endgameResult?.topMeritOfficers.length ?? 0) > 0, `开国功臣数量：${stateVictory.endgameResult?.topMeritOfficers.length} 位`);
  assert((stateVictory.endgameResult?.chronicle.length ?? 0) > 0, `霸业史诗年谱已生成（共 ${stateVictory.endgameResult?.chronicle.length} 条纪事）`);
  assert(
    stateVictory.actionLog.some((l) => l.type === 'game_victory' && l.message.includes('天下一统')),
    'actionLog 中准确记录【天下一统】终局战报',
  );

  // 终局幂等性验证
  const stateVictoryIdempotent = checkEndgameStatus(stateVictory);
  assert(stateVictoryIdempotent === stateVictory, '重复执行 checkEndgameStatus 幂等不重复创建');

  // ── 6. 战役终局：身死国灭（Defeat Game Over） ─────────────────────
  console.log('\n【6. 战役终局：身死国灭（Defeat Game Over）】');
  const statePlayerDefeated: GameState = {
    ...g,
    factions: {
      ...g.factions,
      [playerFid]: {
        ...g.factions[playerFid],
        isAlive: false,
        cityIds: [],
      },
    },
    endgameResult: undefined,
  };
  const stateDefeat = checkEndgameStatus(statePlayerDefeated);
  assert(stateDefeat.endgameResult != null, '成功生成战败终局结算结果');
  assert(stateDefeat.endgameResult?.type === 'defeat', '终局类型为身死国灭失败（defeat）');
  assert(
    stateDefeat.actionLog.some((l) => l.type === 'game_defeat' && l.message.includes('身死国灭')),
    'actionLog 中准确记录【身死国灭】终局战报',
  );

  // ── 7. 零 RNG 漂移与常规游戏不受扰动 ─────────────────────────────
  console.log('\n【7. 零 RNG 漂移与常规游戏不受扰动】');
  // 常规多势力割据状态下，checkEndgameStatus 不产生任何 endgameResult
  const stateNormal = checkEndgameStatus(g);
  assert(stateNormal.endgameResult === undefined, '常规割据对局中 endgameResult 保持为 undefined，绝无误触发');
  assert(stateNormal === g, '无终局产生时返回相同引用，完全无副作用');

  console.log(`\n验收结果：${pass} 通过，${fail} 失败`);
  if (fail > 0) {
    process.exit(1);
  }
}

run();
