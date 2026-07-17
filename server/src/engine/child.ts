// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S18 子女引擎（P4-05 最小切片）
 * 设计真源 docs/04 §十四：固定 ChildBirthDef 表；appearYear 登场；正妻母教加成。
 */
import {
  CivilPosition,
  GrowthPotential,
  Ideal,
  LocalPosition,
  MilitaryPosition,
  NobilityRank,
  OfficerStatus,
  Personality,
  calcStaminaMax,
  type ChildBirthDef,
  type GameState,
  type Officer,
  type OfficerStats,
} from '@leh/shared';
import { getStaticData } from '../data/loader.js';

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
      { year: state.currentYear, month: state.currentMonth, type, message },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

function clampStat(n: number): number {
  return Math.max(1, Math.min(100, Math.floor(n)));
}

function mergeStats(
  base: OfficerStats,
  ...partials: Array<Partial<OfficerStats> | undefined>
): OfficerStats {
  const next: OfficerStats = { ...base };
  for (const p of partials) {
    if (!p) continue;
    for (const key of ['leadership', 'war', 'intelligence', 'politics', 'charisma'] as const) {
      if (p[key] != null) next[key] = clampStat(next[key] + (p[key] as number));
    }
  }
  return next;
}

function isMotherWife(state: GameState, fatherId: number, motherId: number): boolean {
  const father = state.officers[fatherId];
  const mother = state.females[motherId];
  if (!father || !mother) return false;
  return mother.husbandId === fatherId || father.wifeId === motherId;
}

function resolvePlacement(
  state: GameState,
  def: ChildBirthDef,
  marriedWithBonus: boolean,
): { faction: number | null; location: number | null; status: OfficerStatus } {
  const father = state.officers[def.fatherId];
  const mother = state.females[def.motherId];

  // 04§十四：父母已婚配 → 入父/母势力；未结婚 → 在野
  if (marriedWithBonus) {
    if (father && father.status !== OfficerStatus.DEAD && father.faction != null) {
      return {
        faction: father.faction,
        location: father.location,
        status: OfficerStatus.ACTIVE,
      };
    }
    if (mother?.factionId != null) {
      return {
        faction: mother.factionId,
        location: mother.locationId ?? null,
        status: OfficerStatus.ACTIVE,
      };
    }
  }

  const loc = mother?.locationId ?? father?.location ?? null;
  return { faction: null, location: loc, status: OfficerStatus.FREE };
}

function buildChildOfficer(
  state: GameState,
  def: ChildBirthDef,
  marriedWithBonus: boolean,
): Officer {
  const father = state.officers[def.fatherId];
  let stats = { ...def.baseStats };
  const skills: Officer['skills'] = [];

  if (marriedWithBonus && def.motherBonus) {
    stats = mergeStats(
      stats,
      def.motherBonus.fromScholarship,
      def.motherBonus.fromBloodline,
    );
    for (const skillId of def.motherBonus.extraSkills ?? []) {
      skills.push({ skillId, level: 1, useCount: 0 });
    }
  }

  const age = Math.max(16, state.currentYear - def.birthYear);
  const deathYear = def.birthYear + 65;
  const place = resolvePlacement(state, def, marriedWithBonus);

  const staticLike = {
    id: def.childId,
    name: def.childName,
    birthYear: def.birthYear,
    deathYear,
    stats,
    hidden: {
      compatibility: father?.hidden.compatibility ?? 75,
      righteousness: father?.hidden.righteousness ?? 8,
      ambition: father?.hidden.ambition ?? 8,
      valor: Math.min(7, Math.max(1, Math.floor(stats.war / 15))),
      composure: Math.min(7, Math.max(1, Math.floor(stats.intelligence / 15))),
      lifespan: deathYear,
      growth: GrowthPotential.MID,
      personality: Personality.CALM,
      ideal: father?.hidden.ideal ?? Ideal.FAME,
      bloodline: [def.fatherId, def.motherId].filter((id) => id > 0),
      ceilingBonus: null,
      power: clampStat(40 + stats.war / 3),
      burst: clampStat(40 + stats.war / 4),
      agility: clampStat(45 + stats.war / 5),
      luck: 50,
      intuition: clampStat(40 + stats.intelligence / 4),
      awe: clampStat(30 + stats.leadership / 4),
      strategy: clampStat(40 + stats.intelligence / 3),
      tactics: clampStat(40 + stats.intelligence / 4),
    },
    unitProficiency: father?.unitProficiency ?? {},
    formationMastery: father?.formationMastery?.slice(0, 3) ?? [0],
    skills: skills.map((s) => ({ skillId: s.skillId, level: s.level })),
    tags: father?.tags ?? [],
  };

  return {
    ...staticLike,
    skills,
    faction: place.faction,
    location: place.location,
    loyalty: place.faction != null ? 80 : 50,
    experience: 0,
    status: place.status,
    civilPosition: CivilPosition.NONE,
    localPosition: LocalPosition.NONE,
    militaryPosition: MilitaryPosition.NONE,
    nobilityRank: NobilityRank.NONE,
    merit: 0,
    stamina: calcStaminaMax(staticLike, 0, age),
    wifeId: null,
    beauties: [],
  };
}

function registerOfficer(state: GameState, officer: Officer): GameState {
  const officers = { ...state.officers, [officer.id]: officer };
  let cities = state.cities;
  let factions = state.factions;

  if (officer.location != null && cities[officer.location]) {
    const city = cities[officer.location];
    if (!city.officers.includes(officer.id)) {
      cities = {
        ...cities,
        [city.id]: { ...city, officers: [...city.officers, officer.id] },
      };
    }
  }

  if (officer.faction != null && factions[officer.faction]) {
    const fac = factions[officer.faction];
    if (!fac.officerIds.includes(officer.id)) {
      factions = {
        ...factions,
        [fac.id]: { ...fac, officerIds: [...fac.officerIds, officer.id] },
      };
    }
  }

  if (officer.hidden.bloodline.length > 0) {
    const fatherId = officer.hidden.bloodline[0];
    const father = officers[fatherId];
    if (father && !father.hidden.bloodline.includes(officer.id)) {
      officers[fatherId] = {
        ...father,
        hidden: {
          ...father.hidden,
          bloodline: [...father.hidden.bloodline, officer.id],
        },
      };
    }
  }

  return { ...state, officers, cities, factions };
}

function spawnOne(state: GameState, def: ChildBirthDef): GameState {
  if (state.officers[def.childId]) return state;

  const married = isMotherWife(state, def.fatherId, def.motherId);
  const officer = buildChildOfficer(state, def, married);
  let next = registerOfficer(state, officer);

  const placeNote =
    officer.faction != null
      ? `加入${next.factions[officer.faction]?.name ?? officer.faction}`
      : '在野';
  const bonusNote = married && def.motherBonus ? '（含母教）' : '（无母教）';
  next = pushLog(
    next,
    'child_appear',
    `${def.childName}年满登场${bonusNote}，${placeNote}`,
  );
  return next;
}

/** 开局补登：appearYear ≤ 当前年且尚未入库 */
export function catchUpChildren(
  state: GameState,
  defs: ChildBirthDef[] = getStaticData().children,
): GameState {
  let next = state;
  for (const def of defs) {
    if (def.appearYear <= state.currentYear) {
      next = spawnOne(next, def);
    }
  }
  return next;
}

/**
 * 每年 1 月：登场年 == 当前年 的子女入将领库。
 * 其它月份不触发（与 04§十四 春/1 月一致）。
 */
export function tickChildrenAppear(
  state: GameState,
  defs: ChildBirthDef[] = getStaticData().children,
): GameState {
  if (state.currentMonth !== 1) return state;

  let next = state;
  for (const def of defs) {
    if (def.appearYear === state.currentYear) {
      next = spawnOne(next, def);
    }
  }
  return next;
}
