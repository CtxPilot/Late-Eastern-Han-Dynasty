// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * R2 谈判公式确定性验证（登用/结盟百分比一致性 + HC-P0-5 霸府外交权重加成）。
 * 覆盖：
 * - 登用率公式百分点逐项相加且只 clamp 一次（5 项）
 * - 结盟成功率公式（友好/使者魅力/共同敌人/条约态/hegemonyModifier 逐项相加）
 * - UI 日志百分比与共享公式同源
 * - 固定 seed 结盟成功/失败可复现，只消费一次权威 RNG
 * - HC-P0-5（追加断言）：霸府/王/帝政治阶段对结盟成功率 + 进贡/宫廷牵线友好增量的修正
 *
 * Run: pnpm verify-negotiation-r2
 */
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  DipRelation,
  SerializableRng,
  calculateAllianceChance,
  calculateRecruitChance,
  findDiplomacy,
  hegemonyAllianceModifier,
  hegemonyFavorMultiplier,
  type GameState,
  type Officer,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { getRuntimeRngState, resetRuntimeRng } from '../runtime-rng.js';
import {
  createGame,
  doAlliance,
  doTribute,
  getGame,
  restoreGameFromEnvelope,
} from '../services/game.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

function withOfficer(
  officer: Officer,
  patch: {
    charisma?: number;
    compatibility?: number;
    righteousness?: number;
    ambition?: number;
  },
): Officer {
  return {
    ...officer,
    stats: {
      ...officer.stats,
      charisma: patch.charisma ?? officer.stats.charisma,
    },
    hidden: {
      ...officer.hidden,
      compatibility:
        patch.compatibility ?? officer.hidden.compatibility,
      righteousness: patch.righteousness ?? officer.hidden.righteousness,
      ambition: patch.ambition ?? officer.hidden.ambition,
    },
  };
}

function envelopeFor(snapshot: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-23T12:00:00.000Z',
    updatedAt: '2026-07-23T12:00:00.000Z',
    scenarioId: snapshot.scenarioId,
    rng: getRuntimeRngState(),
    snapshot,
  };
}

function seedForRoll(predicate: (roll: number) => boolean): number {
  for (let seed = 1; seed < 100_000; seed += 1) {
    const rng = new SerializableRng(seed);
    if (predicate(rng.next() * 100)) return seed;
  }
  throw new Error('无法构造谈判固定 seed');
}

createGame(1, 1);
const initial = getGame();
const recruiter = initial.officers[initial.factions[1].rulerId];
const target = Object.values(initial.officers).find(
  (officer) => officer.id !== recruiter.id,
);
if (!recruiter || !target) throw new Error('缺少登用公式验证武将');

const neutralRecruiter = withOfficer(recruiter, {
  charisma: 60,
  compatibility: 75,
});
const neutralTarget = withOfficer(target, {
  charisma: 60,
  compatibility: 75,
  righteousness: 5,
  ambition: 5,
});
assert(
  calculateRecruitChance(neutralRecruiter, neutralTarget) === 75,
  '登用公式应按百分点得到 40+0+40+10-15=75',
);
assert(
  calculateRecruitChance(
    neutralRecruiter,
    withOfficer(neutralTarget, { righteousness: 6 }),
  ) === 77,
  '义理每提高 1 应严格增加 2 个百分点',
);
assert(
  calculateRecruitChance(
    neutralRecruiter,
    withOfficer(neutralTarget, { ambition: 6 }),
  ) === 72,
  '野心每提高 1 应严格减少 3 个百分点',
);
assert(
  calculateRecruitChance(
    withOfficer(neutralRecruiter, { charisma: 70 }),
    neutralTarget,
  ) === 78,
  '说客魅力提高 10 应增加 3 个百分点',
);
assert(
  calculateRecruitChance(
    withOfficer(neutralRecruiter, { compatibility: 150 }),
    neutralTarget,
  ) <
    calculateRecruitChance(neutralRecruiter, neutralTarget),
  '相性差扩大时登用率必须单调下降',
);
assert(
  calculateRecruitChance(
    withOfficer(neutralRecruiter, { charisma: 1, compatibility: 150 }),
    withOfficer(neutralTarget, {
      charisma: 100,
      compatibility: 0,
      righteousness: 0,
      ambition: 15,
    }),
  ) === 5,
  '登用率下界必须为 5%',
);
assert(
  calculateRecruitChance(
    withOfficer(neutralRecruiter, { charisma: 100 }),
    withOfficer(neutralTarget, {
      charisma: 1,
      righteousness: 15,
      ambition: 0,
    }),
  ) === 90,
  '登用率上界必须为 90%',
);

doTribute(3);
doTribute(3);
const prepared = getGame();
const alliance = calculateAllianceChance(prepared, 3);
assert(alliance.favorability === 30, '两次进贡后结盟公式读取双边友好 30');
assert(alliance.treatyModifier === 5, 'friendly 关系只提供一次 +5 条约修正');
assert(
  alliance.chance ===
    Math.min(
      90,
      Math.max(
        5,
        35 +
          30 * 0.35 +
          alliance.envoyCharisma * 0.15 +
          alliance.commonEnemyModifier +
          5 +
          alliance.hegemonyModifier +
          alliance.eloquenceModifier +
          alliance.mandateModifier,
      ),
    ),
  '外交公式必须按百分点逐项相加（含霸府/辩才/天命）且只 clamp 一次',
);
const lowerFavorState: GameState = {
  ...prepared,
  diplomacy: prepared.diplomacy.map((link) =>
    (link.factionA === 1 && link.factionB === 3) ||
    (link.factionA === 3 && link.factionB === 1)
      ? { ...link, favorability: 15, relation: DipRelation.NEUTRAL }
      : link,
  ),
};
assert(
  calculateAllianceChance(prepared, 3).chance >
    calculateAllianceChance(lowerFavorState, 3).chance,
  '双边友好提高时外交成功率必须单调上升',
);
const lowState: GameState = {
  ...prepared,
  diplomacy: prepared.diplomacy.map((link) =>
    (link.factionA === 1 && link.factionB === 3) ||
    (link.factionA === 3 && link.factionB === 1)
      ? { ...link, favorability: -100, relation: DipRelation.HOSTILE }
      : link,
  ),
  officers: Object.fromEntries(
    Object.entries(prepared.officers).map(([id, officer]) => [
      id,
      officer.faction === 1
        ? withOfficer(officer, { charisma: 1 })
        : officer,
    ]),
  ) as GameState['officers'],
};
assert(
  calculateAllianceChance(lowState, 3).chance ===
    Math.min(
      90,
      Math.max(
        5,
        35 +
          -100 * 0.35 +
          1 * 0.15 +
          calculateAllianceChance(lowState, 3).commonEnemyModifier +
          0 +
          calculateAllianceChance(lowState, 3).hegemonyModifier +
          calculateAllianceChance(lowState, 3).eloquenceModifier +
          calculateAllianceChance(lowState, 3).mandateModifier,
      ),
    ),
  '外交低端按公式结算（含天命）并受 5% 下界保护',
);
const highState: GameState = {
  ...prepared,
  diplomacy: prepared.diplomacy.map((link) =>
    (link.factionA === 1 && link.factionB === 3) ||
    (link.factionA === 3 && link.factionB === 1)
      ? { ...link, favorability: 100, relation: DipRelation.FRIENDLY }
      : link,
  ),
  officers: Object.fromEntries(
    Object.entries(prepared.officers).map(([id, officer]) => [
      id,
      officer.faction === 1
        ? withOfficer(officer, { charisma: 100 })
        : officer,
    ]),
  ) as GameState['officers'],
};
assert(
  calculateAllianceChance(highState, 3).chance === 90,
  '外交成功率上界必须为 90%',
);

resetRuntimeRng(seedForRoll((roll) => roll < alliance.chance));
const successSave = envelopeFor(prepared);
restoreGameFromEnvelope(successSave);
const success = doAlliance(3);
assert(
  findDiplomacy(success.diplomacy, 1, 3)?.relation === DipRelation.ALLIED,
  '固定成功 seed 必须缔盟',
);
assert(
  getRuntimeRngState().draws === successSave.rng.draws + 1,
  '结盟成功只消费一次权威随机数',
);
assert(
  success.actionLog[0]?.message.includes(
    `成功率 ${Math.round(alliance.chance)}%`,
  ),
  '结盟日志百分比必须与共享公式的 UI 显示值一致',
);

resetRuntimeRng(seedForRoll((roll) => roll >= alliance.chance));
const failureSave = envelopeFor(prepared);
restoreGameFromEnvelope(failureSave);
const failure = doAlliance(3);
assert(
  findDiplomacy(failure.diplomacy, 1, 3)?.relation !== DipRelation.ALLIED,
  '固定失败 seed 必须保留原外交关系',
);
assert(
  getRuntimeRngState().draws === failureSave.rng.draws + 1,
  '结盟失败也只消费一次权威随机数',
);
assert(
  failure.actionLog[0]?.message.includes(
    `成功率 ${Math.round(alliance.chance)}%`,
  ),
  '失败日志百分比必须与共享公式的 UI 显示值一致',
);

restoreGameFromEnvelope(successSave);
const replay = doAlliance(3);
assert(
  JSON.stringify(replay) === JSON.stringify(success),
  '同一保存点与固定 seed 的结盟结果必须可复现',
);

// ── HC-P0-5 霸府外交权重加成（追加断言） ──
// vassal 状态下 hegemonyAllianceModifier 应为 0，既有 20 项断言已隐式验证
assert(hegemonyAllianceModifier('vassal') === 0, 'vassal 阶段结盟修正=0');
assert(hegemonyAllianceModifier('hegemon') === 5, 'hegemon 阶段结盟修正=+5');
assert(hegemonyAllianceModifier('king') === 8, 'king 阶段结盟修正=+8（分档预留）');
assert(hegemonyAllianceModifier('emperor') === 12, 'emperor 阶段结盟修正=+12（分档预留）');
assert(hegemonyAllianceModifier(undefined) === 0, 'undefined 阶段兜底为 0');

assert(hegemonyFavorMultiplier('vassal') === 1.0, 'vassal 进贡/宫廷牵线倍数=1.0');
assert(hegemonyFavorMultiplier('hegemon') === 1.1, 'hegemon 进贡/宫廷牵线倍数=×1.1');
assert(hegemonyFavorMultiplier('king') === 1.2, 'king 进贡/宫廷牵线倍数=×1.2（分档预留）');
assert(hegemonyFavorMultiplier('emperor') === 1.3, 'emperor 进贡/宫廷牵线倍数=×1.3（分档预留）');
assert(hegemonyFavorMultiplier(undefined) === 1.0, 'undefined 进贡/宫廷牵线倍数兜底为 1.0');

// 霸府状态结盟成功率应严格高于 vassal 状态（其他条件相同）
const hegemonyState: GameState = {
  ...prepared,
  factions: {
    ...prepared.factions,
    [1]: { ...prepared.factions[1], politicalStage: 'hegemon' },
  },
};
const hegemonyAlliance = calculateAllianceChance(hegemonyState, 3);
assert(
  hegemonyAlliance.hegemonyModifier === 5,
  '霸府状态 breakdown.hegemonyModifier === 5',
);
assert(
  hegemonyAlliance.chance === alliance.chance + 5 ||
    hegemonyAlliance.chance === 90,
  '霸府状态结盟成功率 = vassal +5（或被 clamp 至上界 90）',
);
assert(
  hegemonyAlliance.chance >= alliance.chance,
  '霸府状态结盟成功率单调不低于 vassal',
);

// 称王状态分档预留：+8
const kingState: GameState = {
  ...prepared,
  factions: {
    ...prepared.factions,
    [1]: { ...prepared.factions[1], politicalStage: 'king' },
  },
};
const kingAlliance = calculateAllianceChance(kingState, 3);
assert(kingAlliance.hegemonyModifier === 8, '称王状态结盟修正=+8（分档预留）');

// 称帝状态分档预留：+12
const emperorState: GameState = {
  ...prepared,
  factions: {
    ...prepared.factions,
    [1]: { ...prepared.factions[1], politicalStage: 'emperor' },
  },
};
const emperorAlliance = calculateAllianceChance(emperorState, 3);
assert(emperorAlliance.hegemonyModifier === 12, '称帝状态结盟修正=+12（分档预留）');

// 分档单调性：hegemon < king < emperor
assert(
  hegemonyAlliance.hegemonyModifier < kingAlliance.hegemonyModifier,
  '分档单调：hegemon(+5) < king(+8)',
);
assert(
  kingAlliance.hegemonyModifier < emperorAlliance.hegemonyModifier,
  '分档单调：king(+8) < emperor(+12)',
);

// 进贡/宫廷牵线友好增量放大验证
import { doTransferCourtNetwork } from '../services/game.js';
// 先准备：让己方有 courtNetwork
const giftPrepState: GameState = {
  ...prepared,
  factions: {
    ...prepared.factions,
    [1]: { ...prepared.factions[1], courtNetwork: 10 },
  },
};
restoreGameFromEnvelope(envelopeFor(giftPrepState));
const vassalGiftFav = findDiplomacy(getGame().diplomacy, 1, 3)?.favorability ?? 0;
doTransferCourtNetwork(3, 1);
const vassalGiftAfter = findDiplomacy(getGame().diplomacy, 1, 3)?.favorability ?? 0;
const vassalGiftDelta = vassalGiftAfter - vassalGiftFav;
assert(
  vassalGiftDelta === 12,
  `vassal 宫廷牵线×1 友好增量应为 12×1×1.0=12（实测 ${vassalGiftDelta}）`,
);

// 霸府状态宫廷牵线：友好增量应放大为 round(12×1.1)=13
const hegemonyGiftState: GameState = {
  ...getGame(),
  factions: {
    ...getGame().factions,
    [1]: { ...getGame().factions[1], politicalStage: 'hegemon', courtNetwork: 10 },
  },
  diplomacy: getGame().diplomacy.map((l) =>
    (l.factionA === 1 && l.factionB === 3) || (l.factionA === 3 && l.factionB === 1)
      ? { ...l, favorability: 0 }
      : l,
  ),
};
restoreGameFromEnvelope(envelopeFor(hegemonyGiftState));
doTransferCourtNetwork(3, 1);
const hegemonyGiftAfter = findDiplomacy(getGame().diplomacy, 1, 3)?.favorability ?? 0;
assert(
  hegemonyGiftAfter === 13,
  `霸府宫廷牵线×1 友好增量应放大为 round(12×1.1)=13（实测 ${hegemonyGiftAfter}）`,
);
assert(
  hegemonyGiftAfter > vassalGiftDelta,
  '霸府宫廷牵线友好增量严格大于 vassal（×1.1 放大生效）',
);

console.log(`R2 negotiation verification passed: ${passed}/40`);
