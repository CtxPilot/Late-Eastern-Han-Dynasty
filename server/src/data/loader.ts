// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTacticalConfigV2, type TacticalConfigV2 } from '@leh/shared';
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
import { validators } from '@leh/shared';

const dataDir = join(dirname(fileURLToPath(import.meta.url)));

function load<T>(key: validators.DataFileKey, file: string): T {
  const raw: unknown = JSON.parse(readFileSync(join(dataDir, file), 'utf-8'));
  const result = validators.validateDataFile(key, raw);
  if (!result.success) {
    throw new Error(`Invalid ${file}: ${JSON.stringify(result.error.issues.slice(0, 5))}`);
  }
  return result.data as T;
}

/** Load all static JSON. Re-call after data files change (mtime-aware). */
export function loadAllStatic() {
  return {
    officers: load<OfficerStatic[]>('officers', 'officers.json'),
    cities: load<CityStatic[]>('cities', 'cities.json'),
    formations: load<Formation[]>('formations', 'formations.json'),
    units: load<UnitTemplate[]>('units', 'units.json'),
    items: load<ItemStatic[]>('items', 'items.json'),
    females: load<FemaleStatic[]>('females', 'females.json'),
    children: load<ChildBirthDef[]>('children', 'children.json'),
    skills: load<SkillTemplate[]>('skills', 'skills.json'),
    scenarios: load<ScenarioStatic[]>('scenarios', 'scenarios.json'),
    events: load<EventTemplate[]>('events', 'events.json'),
  };
}

/**
 * 加载 TacticalConfig v2（战术协同矩阵，FM-P3）。v2 位于 shared/data（共享配置而非服务端数据），
 * 从 server/src/data 上层三级到仓库根 shared/data 读取，经 Zod 解析，越权即抛错。
 */
export function loadTacticalSystemV2(): TacticalConfigV2 {
  const p = join(dataDir, '../../../shared/data/tactical-system.v2.json');
  return parseTacticalConfigV2(JSON.parse(readFileSync(p, 'utf-8')));
}

let cached = loadAllStatic();
let citiesMtime = statSync(join(dataDir, 'cities.json')).mtimeMs;

/** Hot-reload cities.json (and full pack) when file mtime changes — no process restart needed. */
export function getStaticData() {
  const mt = statSync(join(dataDir, 'cities.json')).mtimeMs;
  if (mt !== citiesMtime) {
    citiesMtime = mt;
    cached = loadAllStatic();
    console.log(
      `[data] reloaded static JSON (cities mtime changed), sample 成都=`,
      cached.cities.find((c) => c.name === '成都' || c.adminName === '蜀郡'),
    );
  }
  return cached;
}

/** @deprecated prefer getStaticData() for reload-safe access */
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

/** @deprecated use getUnitByType() */
export const unitByType = new Proxy({} as Record<string, UnitTemplate>, {
  get(_t, prop: string) {
    return getUnitByType()[prop];
  },
});
