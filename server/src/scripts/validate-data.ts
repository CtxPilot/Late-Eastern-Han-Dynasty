// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGameSeatPixel, validators } from '@leh/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../data');

const files: { key: validators.DataFileKey; file: string; expected: number }[] = [
  { key: 'officers', file: 'officers.json', expected: 223 },
  { key: 'cities', file: 'cities.json', expected: 30 },
  { key: 'formations', file: 'formations.json', expected: 6 },
  { key: 'units', file: 'units.json', expected: 9 },
  { key: 'items', file: 'items.json', expected: 20 },
  { key: 'females', file: 'females.json', expected: 10 },
  { key: 'children', file: 'children.json', expected: 5 },
  { key: 'skills', file: 'skills.json', expected: 30 },
  { key: 'scenarios', file: 'scenarios.json', expected: 2 },
  { key: 'events', file: 'events.json', expected: 24 },
];

let failed = 0;

for (const { key, file, expected } of files) {
  const raw = JSON.parse(readFileSync(join(dataDir, file), 'utf-8')) as unknown;
  const result = validators.validateDataFile(key, raw);
  if (!result.success) {
    failed += 1;
    console.error(`FAIL ${file}:`, result.error.issues.slice(0, 8));
    continue;
  }
  const count = Array.isArray(result.data) ? result.data.length : 0;
  if (count !== expected) {
    failed += 1;
    console.error(`FAIL ${file}: expected ${expected} items, got ${count}`);
    continue;
  }
  console.log(`OK   ${file} (${count})`);
}

// provinces coverage for cities
const cities = JSON.parse(readFileSync(join(dataDir, 'cities.json'), 'utf-8')) as {
  name: string;
  adminName: string;
  province: string;
  x: number;
  y: number;
}[];
const provinces = new Set(cities.map((c) => c.province));
const required = [
  '司隶',
  '豫州',
  '冀州',
  '兖州',
  '徐州',
  '青州',
  '荆州',
  '扬州',
  '益州',
  '凉州',
  '并州',
  '幽州',
  '交州',
];
const missing = required.filter((p) => !provinces.has(p));
if (missing.length) {
  failed += 1;
  console.error('FAIL cities province coverage missing:', missing);
} else {
  console.log('OK   cities cover all 13 provinces');
}

// cities.json x/y must match GAME_SEAT_LON_LAT projection
let projOk = true;
for (const city of cities) {
  const expected = getGameSeatPixel(city.adminName);
  if (!expected) {
    failed += 1;
    projOk = false;
    console.error(`FAIL cities geo: no seat lon/lat for ${city.name} (${city.adminName})`);
    continue;
  }
  if (city.x !== expected.x || city.y !== expected.y) {
    failed += 1;
    projOk = false;
    console.error(
      `FAIL cities geo: ${city.name} x/y (${city.x},${city.y}) != projected (${expected.x},${expected.y})`,
    );
  }
}
if (projOk) {
  console.log('OK   cities x/y match historical seat projection');
}

// key geographic ordering (史实)
type CityCoord = { name: string; x: number; y: number };
const byName = Object.fromEntries(cities.map((c) => [c.name, c])) as Record<string, CityCoord>;
const geoChecks: [string, string, 'x' | 'y', '<' | '>'][] = [
  ['长安', '洛阳', 'x', '<'],
  ['成都', '长安', 'x', '<'],
  ['冀县', '长安', 'x', '<'],
  ['姑臧', '冀县', 'x', '<'],
  ['汉中', '成都', 'y', '<'],
  ['江陵', '襄阳', 'y', '>'],
  ['寿春', '襄阳', 'x', '>'],
  ['建业', '寿春', 'x', '>'],
  ['晋阳', '邺', 'x', '<'],
  ['龙编', '番禺', 'x', '<'],
  ['襄平', '蓟', 'x', '>'],
];
let orderOk = true;
for (const [a, b, axis, op] of geoChecks) {
  const ca = byName[a];
  const cb = byName[b];
  if (!ca || !cb) {
    failed += 1;
    orderOk = false;
    console.error(`FAIL geo order: missing ${a} or ${b}`);
    continue;
  }
  const av = ca[axis];
  const bv = cb[axis];
  const ok = op === '<' ? av < bv : av > bv;
  if (!ok) {
    failed += 1;
    orderOk = false;
    console.error(`FAIL geo order: ${a}.${axis}=${av} should be ${op} ${b}.${axis}=${bv}`);
  }
}
if (orderOk) {
  console.log('OK   cities geographic ordering (史实)');
}

type ScenarioCheck = {
  id: number;
  playableFactions: number[];
  factionSetups: { id: number; rulerId: number; capitalCityId: number }[];
  eventIds: number[];
  availableOfficerIds: number[];
  availableFemaleIds: number[];
  childEventIds: number[];
  availableEventLayers: string[];
  defaultEventLayers: string[];
  startState: {
    activeFactionIds: number[];
    cityOwnership: Record<string, number>;
    officerPositions: { officerId: number; cityId: number; factionId: number }[];
    femalePositions: { femaleId: number; cityId: number }[];
  };
};
type EventCheck = {
  id: number;
  scenarioIds: number[];
  decisionFactionId?: number;
  decisionOfficerId?: number;
  prerequisiteEventIds?: number[];
  autoChoice?: number;
  conditions: { type: string; field: string; operator: string; targetId?: number; value: unknown }[];
  choices: { effects: { type: string; target: string; targetId?: number; field: string; value: unknown }[] }[];
  dateWindow: { startYear: number; startMonth: number; endYear: number; endMonth: number };
};

const officers = JSON.parse(readFileSync(join(dataDir, 'officers.json'), 'utf-8')) as { id: number }[];
const females = JSON.parse(readFileSync(join(dataDir, 'females.json'), 'utf-8')) as { id: number }[];
const scenarios = JSON.parse(readFileSync(join(dataDir, 'scenarios.json'), 'utf-8')) as ScenarioCheck[];
const events = JSON.parse(readFileSync(join(dataDir, 'events.json'), 'utf-8')) as EventCheck[];
const children = JSON.parse(readFileSync(join(dataDir, 'children.json'), 'utf-8')) as { childId: number }[];
const cityIds = new Set((cities as unknown as { id: number }[]).map((city) => city.id));
const officerIds = new Set(officers.map((officer) => officer.id));
const femaleIds = new Set(females.map((female) => female.id));
const scenarioIds = new Set(scenarios.map((scenario) => scenario.id));
const eventIds = new Set(events.map((event) => event.id));
const childEventIds = new Set(children.map((child) => child.childId));

function failReference(message: string): void {
  failed += 1;
  console.error(`FAIL references: ${message}`);
}

for (const scenario of scenarios) {
  const active = new Set(scenario.startState.activeFactionIds);
  const availableOfficers = new Set(scenario.availableOfficerIds);
  const setups = new Map(scenario.factionSetups.map((setup) => [setup.id, setup]));
  for (const factionId of active) {
    const setup = setups.get(factionId);
    if (!setup) {
      failReference(`scenario ${scenario.id} missing faction setup ${factionId}`);
      continue;
    }
    if (scenario.startState.cityOwnership[String(setup.capitalCityId)] !== factionId) {
      failReference(`scenario ${scenario.id} faction ${factionId} does not control its setup seat`);
    }
    const rulerPosition = scenario.startState.officerPositions.find((position) => position.officerId === setup.rulerId);
    if (!rulerPosition || rulerPosition.factionId !== factionId) {
      failReference(`scenario ${scenario.id} ruler ${setup.rulerId} is not in faction ${factionId}`);
    }
  }
  for (const factionId of scenario.playableFactions) {
    if (!active.has(factionId)) failReference(`scenario ${scenario.id} playable faction ${factionId} is inactive`);
  }
  for (const id of scenario.availableOfficerIds) {
    if (!officerIds.has(id)) failReference(`scenario ${scenario.id} references missing officer ${id}`);
  }
  for (const position of scenario.startState.officerPositions) {
    if (!availableOfficers.has(position.officerId)) failReference(`scenario ${scenario.id} positions unavailable officer ${position.officerId}`);
    if (!cityIds.has(position.cityId)) failReference(`scenario ${scenario.id} positions officer at missing city ${position.cityId}`);
    if (!active.has(position.factionId)) failReference(`scenario ${scenario.id} positions officer in inactive faction ${position.factionId}`);
  }
  for (const id of scenario.availableFemaleIds) {
    if (!femaleIds.has(id)) failReference(`scenario ${scenario.id} references missing female ${id}`);
  }
  for (const id of scenario.childEventIds) {
    if (!childEventIds.has(id)) failReference(`scenario ${scenario.id} references missing child event ${id}`);
  }
  for (const eventId of scenario.eventIds) {
    const event = events.find((item) => item.id === eventId);
    if (!event || !event.scenarioIds.includes(scenario.id)) failReference(`scenario ${scenario.id} event ${eventId} is not linked both ways`);
  }
  for (const layer of scenario.defaultEventLayers) {
    if (!scenario.availableEventLayers.includes(layer)) failReference(`scenario ${scenario.id} default layer ${layer} is unavailable`);
  }
}

for (const event of events) {
  const eventScenarios = event.scenarioIds
    .map((scenarioId) => scenarios.find((scenario) => scenario.id === scenarioId))
    .filter((scenario): scenario is ScenarioCheck => scenario != null);
  const activeInEveryScenario = (factionId: number) =>
    eventScenarios.every((scenario) => scenario.startState.activeFactionIds.includes(factionId));
  for (const scenarioId of event.scenarioIds) {
    const scenario = scenarios.find((item) => item.id === scenarioId);
    if (!scenarioIds.has(scenarioId) || !scenario?.eventIds.includes(event.id)) failReference(`event ${event.id} scenario ${scenarioId} is not linked both ways`);
  }
  if (event.decisionFactionId != null && !activeInEveryScenario(event.decisionFactionId)) {
    failReference(`event ${event.id} decision faction ${event.decisionFactionId} is not active in every linked scenario`);
  }
  for (const prerequisiteId of event.prerequisiteEventIds ?? []) {
    if (!eventIds.has(prerequisiteId)) failReference(`event ${event.id} prerequisite ${prerequisiteId} is missing`);
  }
  if (event.autoChoice != null && event.autoChoice >= event.choices.length) {
    failReference(`event ${event.id} autoChoice is out of range`);
  }
  const start = event.dateWindow.startYear * 12 + event.dateWindow.startMonth;
  const end = event.dateWindow.endYear * 12 + event.dateWindow.endMonth;
  if (start > end) failReference(`event ${event.id} has an inverted date window`);

  const conditionFields: Record<string, string[]> = {
    year: ['currentYear'],
    officer: ['faction', 'officerId'],
    city: ['controllerId'],
    faction: ['rulerId', 'isAlive'],
    event: ['choice'],
  };
  for (const condition of event.conditions) {
    if (!conditionFields[condition.type]?.includes(condition.field)) {
      failReference(`event ${event.id} has unsupported condition ${condition.type}.${condition.field}`);
    }
    const numberValue = typeof condition.value === 'number' && Number.isFinite(condition.value);
    if (condition.type === 'year' && (!['equals', 'gte', 'lte'].includes(condition.operator) || !numberValue || condition.targetId != null)) {
      failReference(`event ${event.id} has invalid year condition`);
    }
    if (condition.type === 'city' && (condition.operator !== 'equals' || condition.targetId == null || !cityIds.has(condition.targetId) || !numberValue || !activeInEveryScenario(condition.value as number))) {
      failReference(`event ${event.id} has invalid city condition`);
    }
    if (condition.type === 'faction') {
      const validValue = condition.field === 'isAlive' ? typeof condition.value === 'boolean' : numberValue;
      if (condition.operator !== 'equals' || condition.targetId == null || !activeInEveryScenario(condition.targetId) || !validValue) failReference(`event ${event.id} has invalid faction condition`);
    }
    if (condition.type === 'officer') {
      const validTarget = condition.targetId == null || officerIds.has(condition.targetId);
      const validValue = condition.field === 'faction'
        ? condition.operator === 'equals' && numberValue && activeInEveryScenario(condition.value as number)
        : condition.field === 'officerId'
          && condition.operator === 'in'
          && Array.isArray(condition.value)
          && condition.value.every((id) => typeof id === 'number' && officerIds.has(id));
      if (!validTarget || !validValue) failReference(`event ${event.id} has invalid officer condition`);
    }
    if (condition.type === 'event') {
      const selectedEvent = events.find((item) => item.id === condition.targetId);
      const validChoice = numberValue && Number.isInteger(condition.value as number)
        && (condition.value as number) >= 0
        && (condition.value as number) < (selectedEvent?.choices.length ?? 0);
      if (condition.operator !== 'equals' || !selectedEvent || !validChoice || !event.prerequisiteEventIds?.includes(selectedEvent.id)) {
        failReference(`event ${event.id} has invalid event-choice condition`);
      }
    }
  }
  const effectTargets: Record<string, string[]> = {
    recruit: ['officer'],
    loyalty: ['officer'],
    develop: ['city'],
    relation: ['faction'],
    war: ['faction'],
    capital: ['faction'],
    troops: ['city'],
    gold: ['city'],
    food: ['city'],
    population: ['city'],
  };
  for (const choice of event.choices) {
    for (const effect of choice.effects) {
      if (!effectTargets[effect.type]?.includes(effect.target)) {
        failReference(`event ${event.id} has unsupported effect ${effect.type}->${effect.target}`);
      }
      const numberValue = typeof effect.value === 'number' && Number.isFinite(effect.value);
      const requiresDecision = effect.type === 'relation' || effect.type === 'war';
      if (requiresDecision && event.decisionFactionId == null && event.decisionOfficerId == null) failReference(`event ${event.id} effect ${effect.type} requires decisionFactionId or decisionOfficerId`);
      if (effect.type === 'recruit' && (effect.targetId == null || !officerIds.has(effect.targetId) || effect.field !== 'faction' || !numberValue || !activeInEveryScenario(effect.value as number))) {
        failReference(`event ${event.id} has invalid recruit effect`);
      }
      if (effect.type === 'loyalty' && (effect.targetId == null || !officerIds.has(effect.targetId) || effect.field !== 'loyalty' || !numberValue)) {
        failReference(`event ${event.id} has invalid loyalty effect`);
      }
      if (effect.type === 'develop' && (effect.targetId == null || !cityIds.has(effect.targetId) || effect.field !== 'farm' || !numberValue)) {
        failReference(`event ${event.id} has invalid develop effect`);
      }
      if (effect.type === 'relation' && (effect.targetId == null || !activeInEveryScenario(effect.targetId) || effect.field !== 'favorability' || !numberValue)) {
        failReference(`event ${event.id} has invalid relation effect`);
      }
      if (effect.type === 'war' && (effect.targetId == null || !activeInEveryScenario(effect.targetId) || effect.field !== 'relation' || effect.value !== 'war')) {
        failReference(`event ${event.id} has invalid war effect`);
      }
      if (effect.type === 'capital' && (effect.targetId == null || !activeInEveryScenario(effect.targetId) || effect.field !== 'capitalCityId' || !numberValue || !cityIds.has(effect.value as number))) {
        failReference(`event ${event.id} has invalid capital effect`);
      }
      if (effect.type === 'troops' && (effect.targetId == null || !cityIds.has(effect.targetId) || effect.field !== 'troops' || !numberValue)) {
        failReference(`event ${event.id} has invalid troops effect`);
      }
      if (effect.type === 'gold' && (effect.targetId == null || !cityIds.has(effect.targetId) || effect.field !== 'gold' || !numberValue)) {
        failReference(`event ${event.id} has invalid gold effect`);
      }
      if (effect.type === 'food' && (effect.targetId == null || !cityIds.has(effect.targetId) || effect.field !== 'food' || !numberValue)) {
        failReference(`event ${event.id} has invalid food effect`);
      }
      if (effect.type === 'population' && (effect.targetId == null || !cityIds.has(effect.targetId) || effect.field !== 'population' || !numberValue)) {
        failReference(`event ${event.id} has invalid population effect`);
      }
    }
  }
}

if (failed === 0) console.log('OK   scenario/event cross-file references');

console.log(`\nListed data files: ${readdirSync(dataDir).filter((f) => f.endsWith('.json')).join(', ')}`);
if (failed > 0) {
  console.error(`\n${failed} validation failure(s)`);
  process.exit(1);
}
console.log('\nAll data validation passed.');
