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

export interface StaticDataBundle {
  officers: OfficerStatic[];
  cities: CityStatic[];
  formations: Formation[];
  units: UnitTemplate[];
  items: ItemStatic[];
  females: FemaleStatic[];
  children: ChildBirthDef[];
  skills: SkillTemplate[];
  scenarios: ScenarioStatic[];
  events: EventTemplate[];
}

// P5-12：数据懒加载与记忆化（按需单项验证，消除顶层冷启动一次性全载惩罚）
const lazyCache: Partial<StaticDataBundle> = {};

function createLazyStaticBundle(): StaticDataBundle {
  return {
    get officers() {
      if (!lazyCache.officers) lazyCache.officers = load<OfficerStatic[]>('officers', officersJson);
      return lazyCache.officers;
    },
    get cities() {
      if (!lazyCache.cities) lazyCache.cities = load<CityStatic[]>('cities', citiesJson);
      return lazyCache.cities;
    },
    get formations() {
      if (!lazyCache.formations) lazyCache.formations = load<Formation[]>('formations', formationsJson);
      return lazyCache.formations;
    },
    get units() {
      if (!lazyCache.units) lazyCache.units = load<UnitTemplate[]>('units', unitsJson);
      return lazyCache.units;
    },
    get items() {
      if (!lazyCache.items) lazyCache.items = load<ItemStatic[]>('items', itemsJson);
      return lazyCache.items;
    },
    get females() {
      if (!lazyCache.females) lazyCache.females = load<FemaleStatic[]>('females', femalesJson);
      return lazyCache.females;
    },
    get children() {
      if (!lazyCache.children) lazyCache.children = load<ChildBirthDef[]>('children', childrenJson);
      return lazyCache.children;
    },
    get skills() {
      if (!lazyCache.skills) lazyCache.skills = load<SkillTemplate[]>('skills', skillsJson);
      return lazyCache.skills;
    },
    get scenarios() {
      if (!lazyCache.scenarios) lazyCache.scenarios = load<ScenarioStatic[]>('scenarios', scenariosJson);
      return lazyCache.scenarios;
    },
    get events() {
      if (!lazyCache.events) lazyCache.events = load<EventTemplate[]>('events', eventsJson);
      return lazyCache.events;
    },
  };
}

const lazyBundle = createLazyStaticBundle();

/** Load all static JSON. */
export function loadAllStatic(): StaticDataBundle {
  return {
    officers: lazyBundle.officers,
    cities: lazyBundle.cities,
    formations: lazyBundle.formations,
    units: lazyBundle.units,
    items: lazyBundle.items,
    females: lazyBundle.females,
    children: lazyBundle.children,
    skills: lazyBundle.skills,
    scenarios: lazyBundle.scenarios,
    events: lazyBundle.events,
  };
}

export function loadTacticalSystemV2(): TacticalConfigV2 {
  return parseTacticalConfigV2(tacticalV2Json);
}

/** 技能树静态目录（S25）：与服务端 loader 同语义（raw.trees ?? raw）。 */
export function loadSkillTrees() {
  return ((skillTreesJson as { trees?: unknown }).trees ?? skillTreesJson) as import('@leh/shared').SkillTreeDef[];
}

export function getStaticData(): StaticDataBundle {
  return lazyBundle;
}

export const staticData = new Proxy({} as StaticDataBundle, {
  get(_t, prop: string) {
    return lazyBundle[prop as keyof StaticDataBundle];
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
