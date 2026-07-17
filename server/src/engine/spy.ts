// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 谍报主引擎：招募 / 进攻任务 / 驻守反间 / 俘虏 / 与外交冲击
 * 设计真源 docs/04 §29
 */
import {
  DipRelation,
  SpyCaptiveAction,
  SpyMissionType,
  SpyStatus,
  addMonths,
  emptyIntel,
  ensureDemographics,
  findDiplomacy,
  isAllied,
  playerCitiesAdjacentTo,
  type CityCounterIntel,
  type GameState,
  type IntelState,
  type SpyAgent,
  type SpyMissionLog,
  type SpyRank,
  type SpySkills,
} from '@leh/shared';

const SPY_NAMES = [
  '鬼影', '青狼', '墨鸦', '夜枭', '灰狐', '赤蝎', '白蛇', '铜雀',
  '铁幕', '风耳', '千面', '无痕', '冷刃', '暗香', '玄机', '残灯',
  '细柳', '惊鸿', '伏虎', '潜蛟', '听潮', '衔枚', '雪盲', '沙隼',
];

const FEMALE_SPY_NAMES = [
  '红袖', '妙音', '飞燕', '绿珠', '貂雪', '幽兰', '青萍', '婉清',
  '素心', '夜莺', '绛仙', '玉笙', '寒月', '锦瑟', '落霞', '惊鸿',
];

export const RECRUIT_GOLD_PER = 120;
export const RECRUIT_FOOD_PER = 60;
export const MAX_ROSTER = 8;

/** 女间谍训练成本（§30.5）：美女 2 + 金 100 */
export const FEMALE_SPY_BEAUTY_COST = 2;
export const FEMALE_SPY_GOLD_COST = 100;
/** 献美点化：扣对方 1 点 beauty + 己方金 80 */
export const PLANT_FEMALE_GOLD = 80;

const MISSION_GOLD: Record<string, number> = {
  [SpyMissionType.RECON]: 40,
  [SpyMissionType.SABOTAGE]: 80,
  [SpyMissionType.ASSASSINATE]: 120,
  [SpyMissionType.PILLOW_TALK]: 60,
  [SpyMissionType.SOW_DISCORD]: 80,
};

function ensureIntel(state: GameState): IntelState {
  const i = state.intel ?? emptyIntel();
  return {
    cities: i.cities ?? {},
    agents: i.agents ?? {},
    cityDefense: i.cityDefense ?? {},
    nextAgentSeq: i.nextAgentSeq ?? 1,
    recentMissions: i.recentMissions ?? [],
    plantableBeauty: i.plantableBeauty ?? {},
  };
}

function pushLog(
  state: GameState,
  type: string,
  message: string,
  patch: Partial<GameState> = {},
): GameState {
  return {
    ...state,
    ...patch,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type,
        message,
      },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

function pushMissionLog(intel: IntelState, log: SpyMissionLog): IntelState {
  return {
    ...intel,
    recentMissions: [log, ...intel.recentMissions].slice(0, 30),
  };
}

function aliveAgents(intel: IntelState, factionId: number): SpyAgent[] {
  return Object.values(intel.agents).filter(
    (a) => a.factionId === factionId && a.status !== SpyStatus.DEAD,
  );
}

export function rosterCap(state: GameState, factionId: number): number {
  const cities = Object.values(state.cities).filter((c) => c.ruler === factionId).length;
  return Math.min(MAX_ROSTER, 1 + Math.floor(cities / 3));
}

/** 招募批次数与初始等级权重：成年男+驻军 */
export function recruitBatchFromCity(adultMale: number, troops: number): {
  batch: number;
  laborPool: number;
} {
  const laborPool = Math.max(0, adultMale) + Math.max(0, troops);
  const batch = Math.max(1, Math.min(3, Math.floor(laborPool / 8000) || 1));
  // laborPool < 8000 → floor=0 → 用 ||1 至少招 1
  return { batch: laborPool < 8000 ? 1 : batch, laborPool };
}

function rollInitialRank(laborPool: number): SpyRank {
  const r = Math.random();
  if (laborPool < 5000) return 1;
  if (laborPool < 15000) return r < 0.7 ? 1 : 2;
  if (r < 0.5) return 1;
  if (r < 0.85) return 2;
  return 3;
}

function baseSkills(rank: SpyRank): SpySkills {
  const b = 25 + rank * 8;
  const j = () => b + Math.floor(Math.random() * 15) - 5;
  return {
    recon: Math.max(10, Math.min(90, j())),
    sabotage: Math.max(10, Math.min(90, j())),
    lethal: Math.max(10, Math.min(90, j())),
    tradecraft: Math.max(10, Math.min(90, j())),
  };
}

function randomName(used: Set<string>): string {
  for (let i = 0; i < 40; i++) {
    const n = SPY_NAMES[Math.floor(Math.random() * SPY_NAMES.length)];
    const full = `${n}·${Math.floor(Math.random() * 90) + 10}`;
    if (!used.has(full)) return full;
  }
  return `细作·${Date.now() % 1000}`;
}

function randomNameFromList(used: Set<string>, pool: string[]): string {
  for (let i = 0; i < 40; i++) {
    const n = pool[Math.floor(Math.random() * pool.length)];
    const full = `${n}·${Math.floor(Math.random() * 90) + 10}`;
    if (!used.has(full)) return full;
  }
  return `红颜·${Date.now() % 1000}`;
}

export function upsertDipFavor(
  state: GameState,
  a: number,
  b: number,
  delta: number,
): GameState['diplomacy'] {
  const links = [...state.diplomacy];
  const existing = findDiplomacy(links, a, b);
  if (!existing) {
    const fav = Math.max(-100, Math.min(100, delta));
    // Creation path: never auto-create WAR from a single spy event — only HOSTILE.
    // WAR requires an explicit declaration of war.
    let relation = DipRelation.NEUTRAL;
    if (fav <= -40) relation = DipRelation.HOSTILE;
    return [
      ...links,
      { factionA: a, factionB: b, relation, favorability: fav },
    ];
  }
  return links.map((l) => {
    const match =
      (l.factionA === a && l.factionB === b) ||
      (l.factionA === b && l.factionB === a);
    if (!match) return l;
    const fav = Math.max(-100, Math.min(100, l.favorability + delta));
    let relation = l.relation as string;
    if (relation !== DipRelation.ALLIED && relation !== 'allied') {
      if (fav <= -60) relation = DipRelation.WAR;
      else if (fav <= -30) relation = DipRelation.HOSTILE;
      else if (fav >= 30) relation = DipRelation.FRIENDLY;
      else relation = DipRelation.NEUTRAL;
    }
    return { ...l, favorability: fav, relation: relation as typeof l.relation };
  });
}

function getCounterLevel(intel: IntelState, cityId: number): {
  level: number;
  station?: SpyAgent;
} {
  const d = intel.cityDefense[cityId];
  if (!d || d.level <= 0) return { level: 0 };
  const station = d.stationAgentId ? intel.agents[d.stationAgentId] : undefined;
  return { level: d.level, station };
}

function skillForMission(type: SpyMissionType, s: SpySkills): number {
  if (type === SpyMissionType.RECON) return s.recon;
  if (type === SpyMissionType.SABOTAGE) return s.sabotage;
  if (type === SpyMissionType.ASSASSINATE) return s.lethal;
  // 女间谍专属任务用 tradecraft（枕边风/离间靠伪装社交）
  if (type === SpyMissionType.PILLOW_TALK || type === SpyMissionType.SOW_DISCORD) {
    return s.tradecraft;
  }
  return s.tradecraft;
}

/**
 * 在己方城招募一批特工（人数/等级由男成+驻军决定）
 */
export function recruitSpies(
  state: GameState,
  cityId: number,
  factionId?: number,
): GameState {
  const fid = factionId ?? state.playerFactionId;
  const city = state.cities[cityId];
  if (!city) throw new Error('城市不存在');
  if (city.ruler !== fid) throw new Error('非该势力城市，无法招募');

  const intel = ensureIntel(state);
  const cap = rosterCap(state, fid);
  const current = aliveAgents(intel, fid).length;
  const free = cap - current;
  if (free <= 0) throw new Error(`编制已满（上限 ${cap}）`);

  const d = ensureDemographics(city);
  const { batch: rawBatch, laborPool } = recruitBatchFromCity(d.adultMale, city.troops);
  const batch = Math.min(rawBatch, free);
  const goldCost = RECRUIT_GOLD_PER * batch;
  const foodCost = RECRUIT_FOOD_PER * batch;
  if (city.gold < goldCost) throw new Error(`金钱不足（需 ${goldCost}）`);
  if (city.food < foodCost) throw new Error(`粮食不足（需 ${foodCost}）`);

  const usedNames = new Set(Object.values(intel.agents).map((a) => a.name));
  let seq = intel.nextAgentSeq;
  const agents = { ...intel.agents };
  const created: string[] = [];

  for (let i = 0; i < batch; i++) {
    const rank = rollInitialRank(laborPool);
    const id = `spy-${fid}-${seq++}`;
    const name = randomName(usedNames);
    usedNames.add(name);
    agents[id] = {
      id,
      factionId: fid,
      name,
      rank,
      exp: 0,
      skills: baseSkills(rank),
      status: SpyStatus.IDLE,
      homeCityId: cityId,
      locationCityId: cityId,
      captiveByFactionId: null,
      cooldownMonths: 0,
      missionsDone: 0,
      coverIdentity: `${city.name}行人`,
      agentKind: 'male',
    };
    created.push(`${name}(Lv${rank})`);
  }

  const nextIntel: IntelState = {
    ...intel,
    agents,
    nextAgentSeq: seq,
  };
  const cities = {
    ...state.cities,
    [cityId]: {
      ...city,
      gold: city.gold - goldCost,
      food: city.food - foodCost,
    },
  };

  return pushLog(
    state,
    'spy_recruit',
    `${city.name} 招募密探×${batch}：${created.join('、')}（劳力池${laborPool}，耗${goldCost}金/${foodCost}粮）`,
    { cities, intel: nextIntel },
  );
}

/** 女间谍技能倾向：recon/lethal/tradecraft 偏高，sabotage 偏低（§30.5） */
function femaleSpySkills(rank: SpyRank): SpySkills {
  const b = 30 + rank * 8;
  const j = () => b + Math.floor(Math.random() * 15) - 5;
  const low = () => 15 + Math.floor(Math.random() * 20);
  return {
    recon: Math.max(15, Math.min(95, j() + 8)),
    sabotage: Math.max(10, Math.min(70, low())),
    lethal: Math.max(15, Math.min(95, j() + 5)),
    tradecraft: Math.max(20, Math.min(95, j() + 10)),
  };
}

/**
 * 训练女间谍（S07∩S09）：耗 beauty 2 + 金 100 + 1 编制位
 * 生成 SpyAgent(agentKind:'female')，技能偏 recon/lethal/tradecraft
 */
export function trainFemaleSpy(
  state: GameState,
  cityId: number,
  factionId?: number,
): GameState {
  const fid = factionId ?? state.playerFactionId;
  const city = state.cities[cityId];
  if (!city) throw new Error('城市不存在');
  if (city.ruler !== fid) throw new Error('非该势力城市，无法训练');

  const intel = ensureIntel(state);
  const cap = rosterCap(state, fid);
  const current = aliveAgents(intel, fid).length;
  const free = cap - current;
  if (free <= 0) throw new Error(`编制已满（上限 ${cap}）`);

  const faction = state.factions[fid];
  if (!faction) throw new Error('势力不存在');
  if ((faction.beautyStock ?? 0) < FEMALE_SPY_BEAUTY_COST) {
    throw new Error(`美女资源不足（需 ${FEMALE_SPY_BEAUTY_COST}）`);
  }
  if (city.gold < FEMALE_SPY_GOLD_COST) {
    throw new Error(`金钱不足（需 ${FEMALE_SPY_GOLD_COST}）`);
  }

  const usedNames = new Set(Object.values(intel.agents).map((a) => a.name));
  const seq = intel.nextAgentSeq;
  const id = `spy-${fid}-${seq}`;
  const rank = rollInitialRank(10000 + Math.floor(Math.random() * 8000));
  const name = randomNameFromList(usedNames, FEMALE_SPY_NAMES);
  usedNames.add(name);

  const agent: SpyAgent = {
    id,
    factionId: fid,
    name,
    rank,
    exp: 0,
    skills: femaleSpySkills(rank),
    status: SpyStatus.IDLE,
    homeCityId: cityId,
    locationCityId: cityId,
    captiveByFactionId: null,
    cooldownMonths: 0,
    missionsDone: 0,
    coverIdentity: `${city.name}舞姬`,
    agentKind: 'female',
  };

  const agents = { ...intel.agents, [id]: agent };
  const nextIntel: IntelState = {
    ...intel,
    agents,
    nextAgentSeq: seq + 1,
  };

  const factions = {
    ...state.factions,
    [fid]: {
      ...faction,
      beautyStock: (faction.beautyStock ?? 0) - FEMALE_SPY_BEAUTY_COST,
    },
  };
  const cities = {
    ...state.cities,
    [cityId]: {
      ...city,
      gold: city.gold - FEMALE_SPY_GOLD_COST,
    },
  };

  return pushLog(
    state,
    'spy_train_female',
    `${city.name} 训练女间谍 ${name}(Lv${rank})（耗美女${FEMALE_SPY_BEAUTY_COST}/金${FEMALE_SPY_GOLD_COST}）`,
    { cities, factions, intel: nextIntel },
  );
}

/**
 * 献美→点化女间谍（S07∩S08∩S09 掩护线）
 * 条件：对目标势力 plantableBeauty≥1；对方 beautyStock≥1；编制有空；己方城有金 80
 * 效果：plantable−1、对方 beauty−1、生成己方女间谍（home=己方城，cover=对方）
 */
export function plantFemaleFromGift(
  state: GameState,
  targetFactionId: number,
  homeCityId?: number,
): GameState {
  const fid = state.playerFactionId;
  if (targetFactionId === fid) throw new Error('不能对本势力点化');
  const target = state.factions[targetFactionId];
  if (!target?.isAlive) throw new Error('目标势力不存在或已灭亡');

  const intel = ensureIntel(state);
  const plantable = intel.plantableBeauty ?? {};
  const left = plantable[targetFactionId] ?? 0;
  if (left < 1) {
    throw new Error(`无可点化额度（需先向 ${target.name} 献美）`);
  }
  if ((target.beautyStock ?? 0) < 1) {
    throw new Error(`${target.name} 后宫库存已空，无法点化`);
  }

  const cap = rosterCap(state, fid);
  if (aliveAgents(intel, fid).length >= cap) {
    throw new Error(`编制已满（上限 ${cap}）`);
  }

  // 默认 home：己方金≥80 的城
  const home =
    (homeCityId != null ? state.cities[homeCityId] : null) ??
    Object.values(state.cities).find(
      (c) => c.ruler === fid && c.gold >= PLANT_FEMALE_GOLD,
    );
  if (!home || home.ruler !== fid) throw new Error('无可用己方城支付点化费用');
  if (home.gold < PLANT_FEMALE_GOLD) {
    throw new Error(`金钱不足（需 ${PLANT_FEMALE_GOLD}）`);
  }

  const usedNames = new Set(Object.values(intel.agents).map((a) => a.name));
  const seq = intel.nextAgentSeq;
  const id = `spy-${fid}-${seq}`;
  const rank = rollInitialRank(12000);
  const name = randomNameFromList(usedNames, FEMALE_SPY_NAMES);

  const agent: SpyAgent = {
    id,
    factionId: fid,
    name,
    rank,
    exp: 0,
    skills: femaleSpySkills(rank),
    status: SpyStatus.IDLE,
    homeCityId: home.id,
    locationCityId: home.id,
    captiveByFactionId: null,
    cooldownMonths: 1,
    missionsDone: 0,
    coverIdentity: `${target.name}后宫`,
    agentKind: 'female',
  };

  const nextPlantable = { ...plantable, [targetFactionId]: left - 1 };
  if (nextPlantable[targetFactionId] <= 0) delete nextPlantable[targetFactionId];

  const nextIntel: IntelState = {
    ...intel,
    agents: { ...intel.agents, [id]: agent },
    nextAgentSeq: seq + 1,
    plantableBeauty: nextPlantable,
  };

  const factions = {
    ...state.factions,
    [targetFactionId]: {
      ...target,
      beautyStock: (target.beautyStock ?? 0) - 1,
    },
  };
  const cities = {
    ...state.cities,
    [home.id]: { ...home, gold: home.gold - PLANT_FEMALE_GOLD },
  };

  return pushLog(
    state,
    'spy_plant_female',
    `点化 ${target.name} 后宫 → 女间谍 ${name}(Lv${rank})（耗金${PLANT_FEMALE_GOLD}；可点化余 ${nextPlantable[targetFactionId] ?? 0}）`,
    { cities, factions, intel: nextIntel },
  );
}

/** 驻守反间 */
export function stationCounter(
  state: GameState,
  agentId: string,
  cityId: number,
  factionId?: number,
): GameState {
  const fid = factionId ?? state.playerFactionId;
  const intel = ensureIntel(state);
  const agent = intel.agents[agentId];
  if (!agent || agent.factionId !== fid) throw new Error('特工不存在');
  if (agent.status !== SpyStatus.IDLE || agent.cooldownMonths > 0) {
    throw new Error('特工非空闲或冷却中');
  }
  const city = state.cities[cityId];
  if (!city || city.ruler !== fid) throw new Error('须驻守己方城');

  // 原驻守者撤回
  let agents = { ...intel.agents };
  const prev = intel.cityDefense[cityId];
  if (prev?.stationAgentId && agents[prev.stationAgentId]) {
    const p = agents[prev.stationAgentId];
    agents[prev.stationAgentId] = {
      ...p,
      status: SpyStatus.IDLE,
      locationCityId: p.homeCityId,
    };
  }

  const level: 1 | 2 = agent.rank >= 3 ? 2 : 1;
  agents[agentId] = {
    ...agent,
    status: SpyStatus.COUNTER_DUTY,
    locationCityId: cityId,
  };
  const defense: CityCounterIntel = {
    level,
    untilYear: 9999,
    untilMonth: 12,
    stationAgentId: agentId,
  };
  const nextIntel: IntelState = {
    ...intel,
    agents,
    cityDefense: { ...intel.cityDefense, [cityId]: defense },
  };
  return pushLog(
    state,
    'spy_station',
    `${agent.name} 驻守 ${city.name} 反间（等级 ${level}）`,
    { intel: nextIntel },
  );
}

export function unstationCounter(
  state: GameState,
  cityId: number,
  factionId?: number,
): GameState {
  const fid = factionId ?? state.playerFactionId;
  const intel = ensureIntel(state);
  const city = state.cities[cityId];
  if (!city || city.ruler !== fid) throw new Error('非己方城');
  const def = intel.cityDefense[cityId];
  if (!def?.stationAgentId) throw new Error('该城无驻守密探');

  const agents = { ...intel.agents };
  const ag = agents[def.stationAgentId];
  if (ag) {
    agents[def.stationAgentId] = {
      ...ag,
      status: SpyStatus.IDLE,
      locationCityId: ag.homeCityId,
    };
  }
  const cityDefense = { ...intel.cityDefense };
  delete cityDefense[cityId];
  return pushLog(
    state,
    'spy_unstation',
    `${ag?.name ?? '密探'} 撤离 ${city.name} 反间`,
    { intel: { ...intel, agents, cityDefense } },
  );
}

export function dispatchMission(
  state: GameState,
  opts: {
    agentId: string;
    type: SpyMissionType;
    targetCityId: number;
    targetOfficerId?: number;
    factionId?: number;
  },
): GameState {
  const fid = opts.factionId ?? state.playerFactionId;
  const type = opts.type;
  const isFemaleMission = type === SpyMissionType.PILLOW_TALK || type === SpyMissionType.SOW_DISCORD;
  if (
    type !== SpyMissionType.RECON &&
    type !== SpyMissionType.SABOTAGE &&
    type !== SpyMissionType.ASSASSINATE &&
    !isFemaleMission
  ) {
    throw new Error('Demo 仅支持探秘/破坏/刺杀/枕边风/离间');
  }

  const intel = ensureIntel(state);
  const agent = intel.agents[opts.agentId];
  if (!agent || agent.factionId !== fid) throw new Error('特工不存在');
  if (agent.status !== SpyStatus.IDLE || agent.cooldownMonths > 0) {
    throw new Error('特工非空闲或冷却中');
  }

  // 女间谍专属任务仅限 agentKind==='female'
  if (isFemaleMission && agent.agentKind !== 'female') {
    throw new Error('该任务仅限女间谍执行');
  }

  const target = state.cities[opts.targetCityId];
  if (!target) throw new Error('目标城不存在');
  if (target.ruler === fid) throw new Error('不能对己方城执行进攻任务');

  if (
    target.ruler != null &&
    isAllied(state.diplomacy, fid, target.ruler) &&
    type !== SpyMissionType.RECON
  ) {
    throw new Error('禁止对同盟执行破坏/刺杀');
  }

  const ownCities = Object.values(state.cities)
    .filter((c) => c.ruler === fid)
    .map((c) => c.id);
  const adj = playerCitiesAdjacentTo(ownCities, opts.targetCityId);
  if (adj.length === 0) throw new Error('目标与己方城无官道邻接，无法潜入');

  const goldCost = MISSION_GOLD[type] ?? 50;
  const payCity = adj
    .map((id) => state.cities[id])
    .find((c) => c && c.gold >= goldCost);
  if (!payCity) throw new Error(`邻接城金钱不足（需 ${goldCost}）`);

  const { level: cLevel, station } = getCounterLevel(intel, opts.targetCityId);
  const skill = skillForMission(type, agent.skills);
  const isFemaleAgent = agent.agentKind === 'female';
  let successChance =
    (type === SpyMissionType.RECON ? 55 : type === SpyMissionType.SABOTAGE ? 40 : isFemaleMission ? 42 : 28) +
    agent.rank * 8 +
    skill / 5 -
    target.stats.wall / 20 -
    cLevel * 8 -
    (station ? station.skills.tradecraft / 10 : 0);
  // 女间谍枕边风/离间在有 detailed 情报时成功率+10
  if (isFemaleMission) {
    const report = intel.cities[opts.targetCityId];
    if (report && report.depth === 'detailed') successChance += 10;
  }
  successChance = Math.max(8, Math.min(92, successChance));

  let detectChance =
    10 +
    cLevel * 12 +
    (station ? station.skills.tradecraft / 5 : 0) -
    agent.skills.tradecraft / 5 -
    agent.rank * 3 +
    (type === SpyMissionType.ASSASSINATE ? 15 : 0);
  // §30.5: 城级反间对女间谍 detect+5
  if (isFemaleAgent && cLevel > 0) detectChance += 5;
  detectChance = Math.max(5, Math.min(85, detectChance));

  const success = Math.random() * 100 < successChance;
  const detected = Math.random() * 100 < detectChance;
  let captured = false;
  let dead = false;
  if (detected) {
    if (!success) captured = Math.random() < 0.75;
    else captured = Math.random() < 0.25;
    if (captured && Math.random() < 0.12) {
      dead = true;
      captured = false;
    }
  } else if (!success && Math.random() < 0.08) {
    captured = true;
  }

  let agents = { ...intel.agents };
  let officers = state.officers;
  let cities = {
    ...state.cities,
    [payCity.id]: { ...payCity, gold: payCity.gold - goldCost },
  };
  let diplomacy = state.diplomacy;
  let cityReports = { ...intel.cities };
  const messages: string[] = [];

  if (success) {
    if (type === SpyMissionType.RECON) {
      const months = 2 + agent.rank;
      const exp = addMonths(state.currentYear, state.currentMonth, months);
      cityReports[opts.targetCityId] = {
        depth: 'detailed',
        expireYear: exp.year,
        expireMonth: exp.month,
        source: 'recon',
      };
      messages.push(`探得 ${target.name} 虚实（详报至${exp.year}年${exp.month}月）`);
    } else if (type === SpyMissionType.SABOTAGE) {
      const t = cities[opts.targetCityId] ?? target;
      const roll = Math.random();
      let next = { ...t };
      if (roll < 0.35) {
        const loss = 80 + Math.floor(Math.random() * 120);
        next = { ...next, food: Math.max(0, next.food - loss) };
        messages.push(`破坏 ${target.name} 粮储 −${loss}`);
      } else if (roll < 0.65) {
        const loss = 50 + Math.floor(Math.random() * 80);
        next = { ...next, gold: Math.max(0, next.gold - loss) };
        messages.push(`劫掠 ${target.name} 金库 −${loss}`);
      } else if (roll < 0.85) {
        const loss = 5 + Math.floor(Math.random() * 10);
        next = {
          ...next,
          stats: { ...next.stats, wall: Math.max(0, next.stats.wall - loss) },
        };
        messages.push(`损毁 ${target.name} 城防 −${loss}`);
      } else {
        const loss = 8 + Math.floor(Math.random() * 8);
        next = {
          ...next,
          troopsMorale: Math.max(20, (next.troopsMorale ?? 70) - loss),
          stats: {
            ...next.stats,
            morale: Math.max(10, (next.stats.morale ?? 70) - loss),
          },
        };
        messages.push(`动摇 ${target.name} 民心士气 −${loss}`);
      }
      cities[opts.targetCityId] = next;
    } else if (type === SpyMissionType.ASSASSINATE) {
      // assassinate
      const inCity = Object.values(state.officers).filter(
        (o) =>
          o.faction === target.ruler &&
          o.location === opts.targetCityId &&
          String(o.status) === 'active',
      );
      const pool =
        inCity.length > 0
          ? inCity
          : Object.values(state.officers).filter((o) => o.faction === target.ruler);
      if (pool.length > 0) {
        const victim =
          opts.targetOfficerId != null && state.officers[opts.targetOfficerId]
            ? state.officers[opts.targetOfficerId]
            : pool[Math.floor(Math.random() * pool.length)];
        const drop = 25 + Math.floor(Math.random() * 16);
        officers = {
          ...state.officers,
          [victim.id]: {
            ...victim,
            loyalty: Math.max(0, victim.loyalty - drop),
          },
        };
        messages.push(`行刺 ${victim.name}，其忠诚 −${drop}`);
      } else {
        messages.push('刺杀未遂（无将可刺）');
      }
    } else if (type === SpyMissionType.PILLOW_TALK) {
      // 枕边风：目标城武将忠诚下降（§30.5）
      const inCity = Object.values(state.officers).filter(
        (o) =>
          o.faction === target.ruler &&
          o.location === opts.targetCityId &&
          String(o.status) === 'active',
      );
      const pool =
        inCity.length > 0
          ? inCity
          : Object.values(state.officers).filter((o) => o.faction === target.ruler);
      if (pool.length > 0) {
        const victim =
          opts.targetOfficerId != null && state.officers[opts.targetOfficerId]
            ? state.officers[opts.targetOfficerId]
            : pool[Math.floor(Math.random() * pool.length)];
        const drop = 18 + Math.floor(Math.random() * 18) + agent.rank * 2;
        officers = {
          ...state.officers,
          [victim.id]: {
            ...victim,
            loyalty: Math.max(0, victim.loyalty - drop),
          },
        };
        messages.push(`枕边风：${victim.name} 忠诚 −${drop}`);
      } else {
        messages.push('枕边风未遂（无将可惑）');
      }
    } else if (type === SpyMissionType.SOW_DISCORD) {
      // 离间流言：目标势力与一邻接势力友好下降（§30.5, 接 S17）
      const targetFid = target.ruler;
      if (targetFid == null) {
        messages.push('离间未遂（目标无主）');
      } else {
        // 找目标城的邻接势力（官道邻接目标城的非己方城）
        const adjCityIds = playerCitiesAdjacentTo(
          Object.values(state.cities).filter((c) => c.ruler !== fid && c.ruler !== targetFid).map((c) => c.id),
          opts.targetCityId,
        );
        const thirdFids = new Set<number>();
        for (const cid of adjCityIds) {
          const r = state.cities[cid]?.ruler;
          if (r != null) thirdFids.add(r);
        }
        if (thirdFids.size === 0) {
          // 退而求其次：离间目标势力自身内部 → 民忠下降
          const loss = 10 + agent.rank * 3 + Math.floor(Math.random() * 8);
          const curCity = cities[opts.targetCityId] ?? target;
          cities[opts.targetCityId] = {
            ...curCity,
            stats: {
              ...curCity.stats,
              morale: Math.max(10, (curCity.stats.morale ?? 70) - loss),
            },
          };
          messages.push(`流言惑众：${target.name} 民忠 −${loss}`);
        } else {
          const thirdFid = [...thirdFids][Math.floor(Math.random() * thirdFids.size)];
          const drop = 8 + agent.rank * 3 + Math.floor(Math.random() * 12);
          diplomacy = upsertDipFavor(state, targetFid, thirdFid, -drop);
          const thirdName = state.factions[thirdFid]?.name ?? '第三方';
          const targetName = state.factions[targetFid]?.name ?? '敌方';
          messages.push(`离间 ${targetName} 与 ${thirdName}（友好−${drop}）`);
        }
      }
    }
  } else {
    const failMsg =
      type === SpyMissionType.RECON
        ? '探秘失败'
        : type === SpyMissionType.SABOTAGE
          ? '破坏失败'
          : type === SpyMissionType.PILLOW_TALK
            ? '枕边风失败'
            : type === SpyMissionType.SOW_DISCORD
              ? '离间失败'
              : '刺杀失败';
    messages.push(failMsg);
  }

  let nextAgent: SpyAgent = { ...agent, missionsDone: agent.missionsDone + 1 };
  if (dead) {
    nextAgent = {
      ...nextAgent,
      status: SpyStatus.DEAD,
      locationCityId: null,
      captiveByFactionId: null,
    };
    messages.push(`${agent.name} 殉职`);
  } else if (captured && target.ruler != null) {
    nextAgent = {
      ...nextAgent,
      status: SpyStatus.CAPTIVE,
      locationCityId: opts.targetCityId,
      captiveByFactionId: target.ruler,
      cooldownMonths: 0,
    };
    // §30.5: 女间谍被捕友好冲击 −25（高于男 −18）
    const favorHit = isFemaleAgent ? -25 : -18;
    diplomacy = upsertDipFavor(state, fid, target.ruler, favorHit);
    const capName = state.factions[target.ruler]?.name ?? '敌方';
    messages.push(`${agent.name} 被 ${capName} 拿获（友好${favorHit}）`);
  } else if (!success || detected) {
    nextAgent = {
      ...nextAgent,
      status: SpyStatus.RECOVERING,
      locationCityId: agent.homeCityId,
      cooldownMonths: success ? 1 : 2,
      exp: nextAgent.exp + (success ? 12 : 3),
    };
    if (detected) messages.push('行动暴露，狼狈撤回');
  } else {
    nextAgent = {
      ...nextAgent,
      status: SpyStatus.IDLE,
      locationCityId: agent.homeCityId,
      cooldownMonths: 0,
      exp: nextAgent.exp + 15 + agent.rank * 2,
    };
  }

  const thresholds = [0, 0, 40, 100, 200, 350];
  while (nextAgent.rank < 5 && nextAgent.exp >= thresholds[nextAgent.rank + 1]) {
    nextAgent = {
      ...nextAgent,
      rank: (nextAgent.rank + 1) as SpyRank,
      skills: {
        recon: Math.min(100, nextAgent.skills.recon + 5),
        sabotage: Math.min(100, nextAgent.skills.sabotage + 5),
        lethal: Math.min(100, nextAgent.skills.lethal + 5),
        tradecraft: Math.min(100, nextAgent.skills.tradecraft + 5),
      },
    };
    messages.push(`${agent.name} 晋升 Lv${nextAgent.rank}`);
  }

  agents[agent.id] = nextAgent;
  let nextIntel: IntelState = {
    ...intel,
    agents,
    cities: cityReports,
  };
  nextIntel = pushMissionLog(nextIntel, {
    year: state.currentYear,
    month: state.currentMonth,
    type,
    agentId: agent.id,
    agentName: agent.name,
    factionId: fid,
    targetCityId: opts.targetCityId,
    success,
    captured,
    dead,
    message: messages.join('；'),
  });

  return pushLog(
    state,
    'spy_mission',
    `【谍报】${agent.name}→${target.name}：${messages.join('；')}`,
    {
      cities,
      officers,
      intel: nextIntel,
      diplomacy,
    },
  );
}

// fix assassinate officers - use proper scope
// The var officersPatch is ugly - rewrite assassinate branch cleaner in a follow-up if needed

export function resolveCaptive(
  state: GameState,
  agentId: string,
  action: SpyCaptiveAction,
  factionId?: number,
): GameState {
  const fid = factionId ?? state.playerFactionId;
  const intel = ensureIntel(state);
  const agent = intel.agents[agentId];
  if (!agent) throw new Error('特工不存在');
  if (agent.status !== SpyStatus.CAPTIVE || agent.captiveByFactionId !== fid) {
    throw new Error('非本方关押的密探');
  }
  const owner = agent.factionId;
  let agents = { ...intel.agents };
  let diplomacy = state.diplomacy;
  let msg = '';

  if (action === SpyCaptiveAction.HOLD) {
    msg = `${agent.name} 继续关押`;
  } else if (action === SpyCaptiveAction.EXECUTE) {
    agents[agentId] = {
      ...agent,
      status: SpyStatus.DEAD,
      captiveByFactionId: null,
      locationCityId: null,
    };
    diplomacy = upsertDipFavor(state, fid, owner, -10);
    msg = `处决密探 ${agent.name}（与其主友好−10）`;
  } else if (action === SpyCaptiveAction.RELEASE) {
    agents[agentId] = {
      ...agent,
      status: SpyStatus.IDLE,
      captiveByFactionId: null,
      locationCityId: agent.homeCityId,
      cooldownMonths: 2,
    };
    diplomacy = upsertDipFavor(state, fid, owner, 5);
    msg = `释放 ${agent.name}（友好+5）`;
  } else if (action === SpyCaptiveAction.EXCHANGE) {
    const myCaptive = Object.values(agents).find(
      (a) =>
        a.factionId === fid &&
        a.status === SpyStatus.CAPTIVE &&
        a.captiveByFactionId === owner,
    );
    agents[agentId] = {
      ...agent,
      status: SpyStatus.IDLE,
      captiveByFactionId: null,
      locationCityId: agent.homeCityId,
      cooldownMonths: 1,
    };
    if (myCaptive) {
      agents[myCaptive.id] = {
        ...myCaptive,
        status: SpyStatus.IDLE,
        captiveByFactionId: null,
        locationCityId: myCaptive.homeCityId,
        cooldownMonths: 1,
      };
      msg = `交换俘虏：释 ${agent.name}，换回 ${myCaptive.name}`;
    } else {
      diplomacy = upsertDipFavor(state, fid, owner, 3);
      msg = `单方释放 ${agent.name}（无可交换，友好+3）`;
    }
  } else {
    throw new Error('未知处置');
  }

  return pushLog(state, 'spy_captive', msg, {
    intel: { ...intel, agents },
    diplomacy,
  });
}

/**
 * 占城后清理该城反间：驻守特工回 idle，删除 cityDefense
 * （供 march.settleBattle 调用）
 */
export function clearCityCounterOnCapture(
  state: GameState,
  cityId: number,
): GameState {
  const intel = ensureIntel(state);
  const def = intel.cityDefense[cityId];
  if (!def) return state;
  const agents = { ...intel.agents };
  if (def.stationAgentId && agents[def.stationAgentId]) {
    const ag = agents[def.stationAgentId];
    if (ag.status !== SpyStatus.DEAD) {
      agents[def.stationAgentId] = {
        ...ag,
        status: SpyStatus.IDLE,
        locationCityId: ag.homeCityId,
        cooldownMonths: Math.max(ag.cooldownMonths, 1),
      };
    }
  }
  const cityDefense = { ...intel.cityDefense };
  delete cityDefense[cityId];
  return { ...state, intel: { ...intel, agents, cityDefense } };
}

/** 回合：冷却推进 + 死势力/失城反间清理 + 无家可归重定 */
export function tickSpyMonth(state: GameState): GameState {
  const intel = ensureIntel(state);
  const agents = { ...intel.agents };
  const cityDefense = { ...intel.cityDefense };

  for (const [id, a] of Object.entries(agents)) {
    if (a.status === SpyStatus.DEAD) continue;
    let next = { ...a };
    const fac = state.factions[next.factionId];

    // 灭亡势力特工：编制清空
    if (!fac || !fac.isAlive) {
      agents[id] = {
        ...next,
        status: SpyStatus.DEAD,
        locationCityId: null,
        captiveByFactionId: null,
        cooldownMonths: 0,
      };
      continue;
    }

    // 驻守反间：城已非本势力 → 撤回
    if (next.status === SpyStatus.COUNTER_DUTY) {
      const loc = next.locationCityId;
      const city = loc != null ? state.cities[loc] : undefined;
      if (!city || city.ruler !== next.factionId) {
        next = {
          ...next,
          status: SpyStatus.IDLE,
          locationCityId: next.homeCityId,
          cooldownMonths: Math.max(next.cooldownMonths, 1),
        };
      }
    }

    // home 城失守 → 迁往都城或任意己方城
    const home = state.cities[next.homeCityId];
    if (!home || home.ruler !== next.factionId) {
      const capital = state.cities[fac.capitalCityId];
      const fallback =
        capital && capital.ruler === next.factionId
          ? capital.id
          : Object.values(state.cities).find((c) => c.ruler === next.factionId)?.id;
      if (fallback != null) {
        const keepLoc =
          next.status === SpyStatus.COUNTER_DUTY || next.status === SpyStatus.CAPTIVE;
        next = {
          ...next,
          homeCityId: fallback,
          locationCityId: keepLoc ? next.locationCityId : fallback,
        };
      }
    }

    if (next.cooldownMonths > 0) {
      next = { ...next, cooldownMonths: next.cooldownMonths - 1 };
    }
    if (next.status === SpyStatus.RECOVERING && next.cooldownMonths <= 0) {
      next = { ...next, status: SpyStatus.IDLE };
    }
    agents[id] = next;
  }

  // 清理孤儿反间：特工缺失/非驻守/城非驻守方
  for (const cityIdStr of Object.keys(cityDefense)) {
    const cityId = Number(cityIdStr);
    const def = cityDefense[cityId];
    if (!def) {
      delete cityDefense[cityId];
      continue;
    }
    const city = state.cities[cityId];
    const ag = def.stationAgentId ? agents[def.stationAgentId] : undefined;
    const stale =
      !city ||
      !ag ||
      ag.status === SpyStatus.DEAD ||
      ag.status !== SpyStatus.COUNTER_DUTY ||
      city.ruler !== ag.factionId;
    if (stale) {
      if (ag && ag.status === SpyStatus.COUNTER_DUTY) {
        agents[ag.id] = {
          ...ag,
          status: SpyStatus.IDLE,
          locationCityId: ag.homeCityId,
        };
      }
      delete cityDefense[cityId];
    }
  }

  return { ...state, intel: { ...intel, agents, cityDefense } };
}
