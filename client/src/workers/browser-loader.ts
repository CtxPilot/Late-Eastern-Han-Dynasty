// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 浏览器/Worker 环境的静态数据装载器（离线可玩版 Session 372 Phase 3）。
 *
 * 与 server/src/data/loader.ts 同 API：getStaticData/staticData/getUnitByType/
 * unitByType/loadAllStatic/loadTacticalSystemV2。差异仅介质——Vite 静态 JSON 导入
 * 替代 node:fs；Zod 校验共用 @leh/shared validators。client/vite.config.ts 的
 * `leh-browser-loader` 插件把引擎内 '../data/loader.js' 解析重定向到本文件。
 */
import { parseTacticalConfigV2, validators, type TacticalConfigV2 } from '@leh/shared';
import type {
  ChildBirthDef,
  CityStatic,
  EventTemplate,
  FemaleStatic,
  Formation,
  ItemStatic,
  OfficerStatic,
  ScenarioStatic,
  SkillTemplate,
  UnitTemplate,
} from '@leh/shared';
import {
  children as childrenJson,
  cities as citiesJson,
  events as eventsJson,
  females as femalesJson,
  formations as formationsJson,
  items as itemsJson,
  officers as officersJson,
  scenarios as scenariosJson,
  skills as skillsJson,
  skillTrees as skillTreesJson,
  tacticalSystemV2 as tacticalV2Json,
  units as unitsJson,
} from 'virtual:leh-data';

function load<T>(key: Parameters<typeof validators.validateDataFile>[0], raw: unknown): T {
  const result = validators.validateDataFile(key, raw);
  if (!result.success) {
    throw new Error(`Invalid ${String(key)}: ${JSON.stringify(result.error.issues.slice(0, 5))}`);
  }
  return result.data as T;
}

/** Load all static JSON. */
export function loadAllStatic() {
  return {
    officers: load<OfficerStatic[]>('officers', officersJson),
    cities: load<CityStatic[]>('cities', citiesJson),
    formations: load<Formation[]>('formations', formationsJson),
    units: load<UnitTemplate[]>('units', unitsJson),
    items: load<ItemStatic[]>('items', itemsJson),
    females: load<FemaleStatic[]>('females', femalesJson),
    children: load<ChildBirthDef[]>('children', childrenJson),
    skills: load<SkillTemplate[]>('skills', skillsJson),
    scenarios: load<ScenarioStatic[]>('scenarios', scenariosJson),
    events: load<EventTemplate[]>('events', eventsJson),
  };
}

export function loadTacticalSystemV2(): TacticalConfigV2 {
  return parseTacticalConfigV2(tacticalV2Json);
}

/** 技能树静态目录（S25）：与服务端 loader 同语义（raw.trees ?? raw）。 */
export function loadSkillTrees() {
  return ((skillTreesJson as { trees?: unknown }).trees ?? skillTreesJson) as import('@leh/shared').SkillTreeDef[];
}

const cached = loadAllStatic();

export function getStaticData() {
  return cached;
}

export const staticData = new Proxy({} as ReturnType<typeof loadAllStatic>, {
  get(_t, prop: string) {
    return getStaticData()[prop as keyof ReturnType<typeof loadAllStatic>];
  },
});

export function getUnitByType(): Record<string, UnitTemplate> {
  return Object.fromEntries(getStaticData().units.map((u) => [u.type, u])) as Record<
    string,
    UnitTemplate
  >;
}

export const unitByType = new Proxy({} as Record<string, UnitTemplate>, {
  get(_t, prop: string) {
    return getUnitByType()[prop];
  },
});
