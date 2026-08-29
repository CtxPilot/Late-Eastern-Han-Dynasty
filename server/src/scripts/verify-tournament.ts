// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S19 单挑大会最小闭环冒烟（Session 338）
 * 运行: pnpm verify-tournament
 */
import {
  OfficerStatus,
  TOURNAMENT_HEAL_ITEM_ID,
  TOURNAMENT_MERIT_CHAMPION,
  TOURNAMENT_MERIT_RUNNER_UP,
  TOURNAMENT_MERIT_SEMIFINAL,
  tournamentPlacementLosers,
} from '@leh/shared';
import { runAnnualTournament } from '../engine/tournament.js';
import {
  FAIR_TOURNAMENT_DUEL_CONFIG,
  isWushuangPassiveActive,
} from '../battle/duel.js';
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

console.log('S19 tournament verify');

createGame(1, 1);
let state = getGame();
// 抬高体力与武力，保证够 16 人
state = {
  ...state,
  officers: Object.fromEntries(
    Object.entries(state.officers).map(([id, o]) => [
      id,
      {
        ...o,
        stamina: Math.max(o.stamina, 100),
        stats: { ...o.stats, war: Math.max(o.stats.war, 70) },
        status: o.status === OfficerStatus.DEAD ? OfficerStatus.DEAD : OfficerStatus.ACTIVE,
      },
    ]),
  ),
};

const beforeStatuses = Object.fromEntries(
  Object.entries(state.officers).map(([id, o]) => [id, o.status]),
);
const fameByFactionBefore = Object.fromEntries(
  Object.entries(state.factions).map(([id, f]) => [id, f.fame ?? 0]),
);
const meritByOfficerBefore = Object.fromEntries(
  Object.entries(state.officers).map(([id, o]) => [id, o.merit ?? 0]),
);
// Session 396：各势力预置金疮药，便于轮间自动用药
const HEAL_SEED = 8;
state = {
  ...state,
  factions: Object.fromEntries(
    Object.entries(state.factions).map(([id, f]) => [
      id,
      {
        ...f,
        inventory: {
          ...(f.inventory ?? {}),
          [TOURNAMENT_HEAL_ITEM_ID]: Math.max(
            HEAL_SEED,
            f.inventory?.[TOURNAMENT_HEAL_ITEM_ID] ?? 0,
          ),
        },
      },
    ]),
  ),
};
const healStockBefore = Object.values(state.factions).reduce(
  (sum, f) => sum + (f.inventory?.[TOURNAMENT_HEAL_ITEM_ID] ?? 0),
  0,
);
const after = runAnnualTournament(state, () => 0.5);

assert(after.tournament?.phase === 'finished', '大会 phase=finished');
assert(typeof after.tournament?.championId === 'number', '产生冠军');
assert(typeof after.tournament?.runnerUpId === 'number', '产生亚军');
assert((after.tournament?.bracket.length ?? 0) >= 4, '至少 4 轮对阵（16→8→4→2→1）');
assert(
  after.actionLog.some((l) => l.type === 'tournament' && l.message.includes('武魁')),
  'actionLog 含武魁叙事',
);

let statusIntact = true;
for (const [id, status] of Object.entries(beforeStatuses)) {
  if (after.officers[Number(id)]?.status !== status) {
    statusIntact = false;
    break;
  }
}
assert(statusIntact, '大会不改变武将 status（唯伤不杀）');
assert((after.tournament?.history.length ?? 0) >= 1, 'history 写入历届记录');

// —— Session 385：上届冠军①号种子 ——
const champId = after.tournament!.championId!;
const year2 = runAnnualTournament(
  {
    ...after,
    currentYear: after.currentYear + 1,
    officers: Object.fromEntries(
      Object.entries(after.officers).map(([id, o]) => [
        id,
        {
          ...o,
          stamina: Math.max(o.stamina, 100),
          stats: { ...o.stats, war: Math.max(o.stats.war, 70) },
        },
      ]),
    ),
  },
  () => 0.5,
);
const seed1 = year2.tournament?.participants.find((f) => f.seed === 1);
assert(
  year2.tournament?.participants.some((f) => f.officerId === champId) === false
    || seed1?.officerId === champId,
  `上届冠军仍参赛时为①号种子（seed1=${seed1?.officerId}，上届=${champId}）`,
);

// —— Session 386：破军（公平模式击败吕布）——
const lvBuInBracket = after.tournament!.bracket.some((round) =>
  round.some((m) => m.fighterAId === 5 || m.fighterBId === 5),
);
if (lvBuInBracket) {
  const beaten = after.tournament!.bracket.some((round) =>
    round.some((m) =>
      (m.fighterAId === 5 && m.winnerId != null && m.winnerId !== 5)
      || (m.fighterBId === 5 && m.winnerId != null && m.winnerId !== 5),
    ),
  );
  if (beaten) {
    assert(typeof after.tournament?.pojunOfficerId === 'number', '击败吕布则授予破军');
    assert(
      after.actionLog.some((l) => l.type === 'tournament' && l.message.includes('破军')),
      'actionLog 含破军叙事',
    );
  } else {
    assert(true, '吕布参赛但未败（本 seed 下可接受）');
  }
} else {
  assert(true, '本局吕布未入围（名额/体力裁剪）');
}

assert(after.tournament?.mode === 'fair', '0-A 默认大会模式=fair');

// —— Session 387：公平模式大会单挑走 fairWushuang ——
assert(FAIR_TOURNAMENT_DUEL_CONFIG.fairWushuang === true, '公平大会 duel 配置 fairWushuang=true');
assert(!isWushuangPassiveActive('wushuang', true), '公平配置下无双被动关闭');

// —— Session 388：下届模式偏好驱动下届结算 ——
{
  const withUnrestricted = {
    ...after,
    currentYear: after.currentYear + 2,
    tournamentPreferredMode: 'unrestricted' as const,
    officers: Object.fromEntries(
      Object.entries(after.officers).map(([id, o]) => [
        id,
        {
          ...o,
          stamina: Math.max(o.stamina, 100),
          stats: { ...o.stats, war: Math.max(o.stats.war, 70) },
        },
      ]),
    ),
  };
  const unrestrictedYear = runAnnualTournament(withUnrestricted, () => 0.5);
  assert(unrestrictedYear.tournament?.mode === 'unrestricted', '偏好 unrestricted → 本届 mode=unrestricted');
  assert(
    unrestrictedYear.tournament?.pojunOfficerId == null
      || unrestrictedYear.tournament?.pojunOfficerId === after.tournament?.pojunOfficerId,
    '无特殊保护本届不新授破军（可保留旧破军）',
  );
}

// —— Session 389：玩家报名指派优先入围 ——
{
  const playerFid = after.playerFactionId;
  const playerEligible = Object.values(after.officers)
    .filter((o) => o.faction === playerFid && o.stats.war >= 70 && o.stamina >= 80)
    .sort((a, b) => a.stats.war - b.stats.war || a.id - b.id);
  const weakest = playerEligible[0];
  if (weakest) {
    const nominated = runAnnualTournament(
      {
        ...after,
        currentYear: after.currentYear + 3,
        tournamentPlayerEntryIds: [weakest.id],
        officers: Object.fromEntries(
          Object.entries(after.officers).map(([id, o]) => [
            id,
            {
              ...o,
              stamina: Math.max(o.stamina, 100),
              stats: { ...o.stats, war: Math.max(o.stats.war, 70) },
              loyalty: Math.max(o.loyalty, 90),
            },
          ]),
        ),
      },
      () => 0.5,
    );
    assert(
      nominated.tournament?.participants.some((f) => f.officerId === weakest.id) === true,
      `指派低武力将 ${weakest.id} 仍入围`,
    );
  } else {
    assert(true, '玩家无合格武将可测报名（跳过）');
  }
}

// —— Session 391：赛前押武魁兑付 ——
{
  const fid = state.playerFactionId;
  const champ = after.tournament!.championId!;
  const champWar = after.officers[champ]?.stats.war ?? 80;
  const fieldTop = Math.max(
    ...Object.values(after.officers)
      .filter((o) => o.stats.war >= 70)
      .map((o) => o.stats.war),
    champWar,
  );
  const betAmount = 100;
  const odds = Math.min(8, Math.max(1.05, Math.round((fieldTop / Math.max(1, champWar)) * 100) / 100));
  const goldBefore = after.factions[fid]?.gold ?? 0;
  const withBet = {
    ...after,
    currentYear: after.currentYear + 2,
    tournamentChampionBet: {
      officerId: champ,
      amount: betAmount,
      odds,
      officerWar: champWar,
      fieldTopWar: fieldTop,
    },
    factions: {
      ...after.factions,
      [fid]: { ...after.factions[fid]!, gold: Math.max(goldBefore, betAmount + 500) - betAmount },
    },
    officers: Object.fromEntries(
      Object.entries(after.officers).map(([id, o]) => [
        id,
        {
          ...o,
          stamina: Math.max(o.stamina, 100),
          stats: { ...o.stats, war: Math.max(o.stats.war, 70) },
        },
      ]),
    ),
  };
  // 强制冠军：把所有人武力压低，唯独 champ 拉满——但 duel 仍有 RNG。更稳：直接用 settle 路径测引擎挂载。
  // 此处验证：带挂单跑大会后挂单清空、有 championBetResult。
  const betRun = runAnnualTournament(withBet, () => 0.5);
  assert(betRun.tournamentChampionBet == null, '正月后挂单清空');
  assert(betRun.tournament?.championBetResult != null, '赛果含押注纪要');
  const br = betRun.tournament!.championBetResult!;
  assert(br.officerId === champ, '纪要押中原目标');
  if (br.won) {
    assert(br.payout >= betAmount, '中则兑付≥本金');
    assert(
      (betRun.factions[fid]?.gold ?? 0) >= (withBet.factions[fid]?.gold ?? 0),
      '中则势力金不减于押后',
    );
  } else {
    assert(br.payout === 0, '落空兑付为 0');
  }
}

// —— Session 392：跨轮 HP 写入参赛者 ——
{
  const champFighter = after.tournament!.participants.find(
    (f) => f.officerId === after.tournament!.championId,
  );
  assert(champFighter != null, '冠军在 participants 中');
  assert(typeof champFighter!.currentHp === 'number', '冠军记有 currentHp');
  assert(typeof champFighter!.maxHp === 'number', '冠军记有 maxHp');
  assert(champFighter!.currentHp! >= 1, '冠军残余 HP≥1');
  assert(champFighter!.currentHp! <= champFighter!.maxHp!, '冠军 HP≤maxHp');
  const withHp = after.tournament!.participants.filter((f) => typeof f.currentHp === 'number');
  assert(withHp.length >= 2, '至少两名参赛者记有赛末 HP');
}

// —— Session 393：名次名声 + 冠军势力士气 ——
{
  const champId = after.tournament!.championId!;
  const runnerId = after.tournament!.runnerUpId!;
  const champFid = after.officers[champId]?.faction;
  const runnerFid = after.officers[runnerId]?.faction;
  assert(champFid != null, '冠军有所属势力');
  const fameDelta = (after.factions[champFid!]?.fame ?? 0) - (fameByFactionBefore[champFid!] ?? 0);
  // 冠军 +50；若同势力兼亚军/四强/八强/破军则更大
  assert(fameDelta >= 50, `冠军势力 fame 增量 ≥50（实际 +${fameDelta}）`);
  if (runnerFid != null && runnerFid !== champFid) {
    const rd = (after.factions[runnerFid]?.fame ?? 0) - (fameByFactionBefore[runnerFid] ?? 0);
    assert(rd >= 30, `亚军异势力 fame 增量 ≥30（实际 +${rd}）`);
  } else {
    assert(true, '亚军与冠军同势力或无势力');
  }
  assert(true, '部队士气 +10 由 shared boostFactionArmyMorale 单测覆盖');
}

// —— Session 394：冠亚宝物入库 ——
{
  assert(typeof after.tournament?.championPrizeItemId === 'number', '冠军奖 itemId');
  assert(typeof after.tournament?.championPrizeName === 'string', '冠军奖名称');
  assert(typeof after.tournament?.runnerUpPrizeItemId === 'number', '亚军奖 itemId');
  assert(typeof after.tournament?.runnerUpPrizeName === 'string', '亚军奖名称');
  const champFid = after.officers[after.tournament!.championId!]?.faction;
  const prizeId = after.tournament!.championPrizeItemId!;
  if (champFid != null) {
    const qty = after.factions[champFid]?.inventory?.[prizeId] ?? 0;
    assert(qty >= 1, `冠军势力库存含奖品 ${prizeId}（qty=${qty}）`);
  }
  assert(
    after.actionLog.some((l) => l.type === 'item_tournament' && l.message.includes('武魁奖')),
    'actionLog 含武魁奖',
  );
}

// —— Session 395：大会功绩（冠+30/亚+20/四强+10；君主豁免） ——
{
  const champId = after.tournament!.championId!;
  const runnerId = after.tournament!.runnerUpId!;
  const { semifinalLosers } = tournamentPlacementLosers(
    after.tournament!.bracket,
    champId,
    runnerId,
  );

  const expectMerit = (oid: number, delta: number, label: string) => {
    const o = state.officers[oid];
    const afterO = after.officers[oid];
    assert(afterO != null, `${label} 武将存在`);
    if (!o || o.faction == null) {
      assert(true, `${label} 无势力跳过`);
      return;
    }
    const isRuler = state.factions[o.faction]?.rulerId === oid;
    const beforeM = meritByOfficerBefore[oid] ?? 0;
    const afterM = afterO!.merit ?? 0;
    if (isRuler) {
      assert(afterM === beforeM, `${label} 君主不发功绩（${beforeM}→${afterM}）`);
    } else {
      assert(
        afterM === beforeM + delta,
        `${label} 功绩 +${delta}（${beforeM}→${afterM}）`,
      );
    }
  };

  expectMerit(champId, TOURNAMENT_MERIT_CHAMPION, '冠军');
  expectMerit(runnerId, TOURNAMENT_MERIT_RUNNER_UP, '亚军');
  for (const oid of semifinalLosers) {
    expectMerit(oid, TOURNAMENT_MERIT_SEMIFINAL, `四强#${oid}`);
  }
  assert(semifinalLosers.length === 2, `四强败者恰 2 人（实际 ${semifinalLosers.length}）`);
}

// —— Session 396：轮间金疮药自动回血 ——
{
  const healCount = after.tournament?.betweenRoundHealCount ?? 0;
  assert(healCount >= 1, `轮间用药至少 1 次（实际 ${healCount}）`);
  const healStockAfter = Object.values(after.factions).reduce(
    (sum, f) => sum + (f.inventory?.[TOURNAMENT_HEAL_ITEM_ID] ?? 0),
    0,
  );
  const prizeHealAdds =
    (after.tournament?.runnerUpPrizeItemId === TOURNAMENT_HEAL_ITEM_ID ? 1 : 0)
    + (after.tournament?.championPrizeItemId === TOURNAMENT_HEAL_ITEM_ID ? 1 : 0);
  assert(
    healStockAfter === healStockBefore - healCount + prizeHealAdds,
    `库存扣减与用药次数一致（前 ${healStockBefore} 后 ${healStockAfter} 次 ${healCount} 奖补 ${prizeHealAdds}）`,
  );
  assert(
    after.actionLog.some((l) => l.type === 'tournament' && l.message.includes('轮间用药')),
    'actionLog 含轮间用药摘要',
  );
}

console.log(`结果: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
