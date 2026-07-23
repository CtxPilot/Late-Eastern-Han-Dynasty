// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * One-shot generator for Phase 0-A static JSON (run via tsx).
 * Historical stats use ceiling system from 04 §二十七.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

throw new Error(
  'Legacy 0-A generator is frozen: it predates hand-maintained units, 30 historical officers, and scenario/event isolation. Update the generator before running it.',
);

const dir = join(dirname(fileURLToPath(import.meta.url)), '../data');
const w = (name: string, data: unknown) => {
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log('wrote', name, Array.isArray(data) ? data.length : 1);
};

const prof = (s: string) => ({
  lightInfantry: s,
  heavyInfantry: s,
  spearman: s,
  archer: s,
  lightCavalry: s,
  heavyCavalry: s,
});

// --- units (6) ---
// NOTE: units.json abilities + 三级水军 (Session 70~71) are hand-maintained.
// Re-running this generator will WIPE units — do not overwrite units.json blindly.
const units = [
  {
    type: 'lightInfantry',
    name: '轻步兵',
    isSpecial: false,
    attack: 5,
    defense: 4,
    mobility: 4,
    range: 1,
    traits: [{ name: '轻便', description: '无地形惩罚', modifier: { type: 'terrain_ignore', value: 1 } }],
    strongAgainst: ['archer'],
    weakAgainst: ['heavyCavalry'],
    recruitRequirement: null,
    terrainModifiers: { plain: 0, forest: 0, mountain: 0, water: -3 },
    recruitCost: { gold: 80, food: 50, population: 1 },
  },
  {
    type: 'heavyInfantry',
    name: '重步兵',
    isSpecial: false,
    attack: 7,
    defense: 8,
    mobility: 3,
    range: 1,
    traits: [{ name: '坚盾', description: '克制枪兵', modifier: { type: 'vs_spearman', value: 20 } }],
    strongAgainst: ['spearman'],
    weakAgainst: ['archer'],
    recruitRequirement: null,
    terrainModifiers: { plain: 0, forest: -1, mountain: 0, water: -3 },
    recruitCost: { gold: 120, food: 70, population: 1 },
  },
  {
    type: 'spearman',
    name: '长枪兵',
    isSpecial: false,
    attack: 8,
    defense: 5,
    mobility: 4,
    range: 1,
    traits: [{ name: '刺骑', description: '克制骑兵', modifier: { type: 'vs_cavalry', value: 50 } }],
    strongAgainst: ['lightCavalry', 'heavyCavalry'],
    weakAgainst: ['heavyInfantry'],
    recruitRequirement: null,
    terrainModifiers: { plain: 0, forest: 0, mountain: -1, water: -3 },
    recruitCost: { gold: 100, food: 60, population: 1 },
  },
  {
    type: 'archer',
    name: '弓箭手',
    isSpecial: false,
    attack: 6,
    defense: 3,
    mobility: 4,
    range: 3,
    traits: [{ name: '远射', description: '射程3', modifier: { type: 'range', value: 3 } }],
    strongAgainst: ['heavyInfantry'],
    weakAgainst: ['lightInfantry', 'lightCavalry'],
    recruitRequirement: null,
    terrainModifiers: { plain: 0, forest: -1, mountain: 1, water: -3 },
    recruitCost: { gold: 90, food: 55, population: 1 },
  },
  {
    type: 'lightCavalry',
    name: '轻骑兵',
    isSpecial: false,
    attack: 7,
    defense: 4,
    mobility: 7,
    range: 1,
    traits: [{ name: '绕后', description: '机动高', modifier: { type: 'flank', value: 20 } }],
    strongAgainst: ['archer'],
    weakAgainst: ['spearman'],
    recruitRequirement: null,
    terrainModifiers: { plain: 1, forest: -2, mountain: -99, water: -3 },
    recruitCost: { gold: 150, food: 80, population: 1 },
  },
  {
    type: 'heavyCavalry',
    name: '重骑兵',
    isSpecial: false,
    attack: 10,
    defense: 7,
    mobility: 5,
    range: 1,
    traits: [{ name: '冲锋', description: '首击强化', modifier: { type: 'charge', value: 50 } }],
    strongAgainst: ['lightInfantry', 'heavyInfantry'],
    weakAgainst: ['spearman'],
    recruitRequirement: null,
    terrainModifiers: { plain: 1, forest: -2, mountain: -99, water: -3 },
    recruitCost: { gold: 200, food: 100, population: 1 },
  },
];
w('units.json', units);

// --- formations (6) ---
const formations = [
  {
    id: 0,
    name: '方阵',
    description: '攻守均衡之基本阵型。',
    historicalSource: '孙膑兵法·十阵',
    modifiers: { attack: 1, defense: 1, mobility: 0, range: 0 },
    effects: [],
    allowedUnits: ['lightInfantry', 'heavyInfantry', 'spearman', 'archer'],
    bestUnits: ['heavyInfantry', 'spearman'],
    restrictedUnits: [],
    terrainModifiers: { plain: 0, forest: -1, mountain: -2, water: -3 },
  },
  {
    id: 2,
    name: '锥形阵',
    description: '锐锋突进，利于突击。',
    historicalSource: '孙膑兵法·十阵',
    modifiers: { attack: 2, defense: 0, mobility: 1, range: 0 },
    effects: [{ name: '突击', description: '首回合攻+10%', modifier: { type: 'first_strike', value: 10 } }],
    allowedUnits: ['lightInfantry', 'spearman', 'lightCavalry', 'heavyCavalry'],
    bestUnits: ['heavyCavalry', 'spearman'],
    restrictedUnits: [],
    terrainModifiers: { plain: 2, forest: -1, mountain: -2, water: -3 },
  },
  {
    id: 4,
    name: '鹤翼阵',
    description: '两翼展开包抄。',
    historicalSource: '孙膑兵法·十阵',
    modifiers: { attack: 1, defense: 0, mobility: 1, range: 1 },
    effects: [],
    allowedUnits: ['lightInfantry', 'archer', 'lightCavalry'],
    bestUnits: ['archer', 'lightCavalry'],
    restrictedUnits: ['heavyCavalry'],
    terrainModifiers: { plain: 1, forest: 0, mountain: -1, water: -2 },
  },
  {
    id: 6,
    name: '锋矢阵',
    description: '如箭矢直贯敌阵。',
    historicalSource: '武经总要',
    modifiers: { attack: 3, defense: -1, mobility: 1, range: 0 },
    effects: [],
    allowedUnits: ['spearman', 'lightCavalry', 'heavyCavalry'],
    bestUnits: ['heavyCavalry'],
    restrictedUnits: [],
    terrainModifiers: { plain: 2, forest: -2, mountain: -3, water: -3 },
  },
  {
    id: 7,
    name: '偃月阵',
    description: '半月形防御反击。',
    historicalSource: '武经总要',
    modifiers: { attack: 0, defense: 2, mobility: 0, range: 0 },
    effects: [],
    allowedUnits: ['lightInfantry', 'heavyInfantry', 'spearman', 'archer'],
    bestUnits: ['heavyInfantry'],
    restrictedUnits: [],
    terrainModifiers: { plain: 0, forest: 1, mountain: 1, water: -2 },
  },
  {
    id: 8,
    name: '长蛇阵',
    description: '首尾相应，利于行军。',
    historicalSource: '孙膑兵法·十阵',
    modifiers: { attack: 0, defense: 0, mobility: 2, range: 0 },
    effects: [],
    allowedUnits: ['lightInfantry', 'spearman', 'archer', 'lightCavalry'],
    bestUnits: ['lightCavalry', 'lightInfantry'],
    restrictedUnits: [],
    terrainModifiers: { plain: 1, forest: 1, mountain: 0, water: -1 },
  },
];
w('formations.json', formations);

// --- skills (30 generic, 1 level stub each for 0-A) ---
const skillDefs: { id: string; name: string; category: string; description: string }[] = [
  { id: 'fire', name: '火计', category: 'tactics', description: '纵火伤敌' },
  { id: 'water', name: '水计', category: 'tactics', description: '水攻伤敌' },
  { id: 'rockfall', name: '落石', category: 'tactics', description: '山地落石' },
  { id: 'ambush', name: '伏兵', category: 'tactics', description: '森林伏击' },
  { id: 'taunt', name: '挑拨', category: 'tactics', description: '降低敌士气' },
  { id: 'discord', name: '离间', category: 'tactics', description: '离间敌军' },
  { id: 'calm', name: '沉着', category: 'tactics', description: '稳定本方士气' },
  { id: 'inspire', name: '激励', category: 'tactics', description: '提升士气' },
  { id: 'sorcery', name: '妖术', category: 'tactics', description: '特殊计策' },
  { id: 'illusion', name: '幻术', category: 'tactics', description: '迷惑敌军' },
  { id: 'gallop', name: '疾驰', category: 'command', description: '骑兵机动力提升' },
  { id: 'forcedMarch', name: '强行军', category: 'command', description: '增加移动' },
  { id: 'rapidAttack', name: '急攻', category: 'command', description: '提升攻击' },
  { id: 'hold', name: '固守', category: 'command', description: '提升防御' },
  { id: 'longRange', name: '远射', category: 'command', description: '射程+1' },
  { id: 'formationChange', name: '布阵', category: 'command', description: '切换阵型' },
  { id: 'reorganize', name: '重整', category: 'command', description: '恢复士气' },
  { id: 'raid', name: '奇袭', category: 'command', description: '奇袭加成' },
  { id: 'farming', name: '农政', category: 'civil', description: '提升农业开发' },
  { id: 'commerce', name: '商政', category: 'civil', description: '提升商业开发' },
  { id: 'fortify', name: '筑城', category: 'civil', description: '提升城防' },
  { id: 'recruit', name: '征兵', category: 'civil', description: '征兵效率' },
  { id: 'train', name: '训练', category: 'civil', description: '训练效率' },
  { id: 'discover', name: '寻访', category: 'civil', description: '搜索人才' },
  { id: 'eloquence', name: '辩才', category: 'civil', description: '外交说服' },
  { id: 'medicine', name: '医术', category: 'civil', description: '治疗伤兵' },
  { id: 'insight', name: '洞察', category: 'personal', description: '识破计策' },
  { id: 'bravery', name: '勇武', category: 'personal', description: '单挑加成' },
  { id: 'riding', name: '骑术', category: 'personal', description: '骑兵适性' },
  { id: 'archery', name: '弓术', category: 'personal', description: '弓兵适性' },
];
const skills = skillDefs.map((s) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  description: s.description,
  maxLevel: 5,
  levels: [
    {
      level: 1,
      name: `${s.name}·初`,
      effects: [{ type: s.id, value: 1, description: `${s.name}等级1` }],
      requirement: {},
    },
  ],
}));
w('skills.json', skills);

// --- officers (15 historical + 15 placeholder) ---
type O = {
  id: number;
  name: string;
  birthYear: number;
  deathYear: number;
  stats: { leadership: number; war: number; intelligence: number; politics: number; charisma: number };
  hidden: Record<string, unknown>;
  unitProficiency: Record<string, string>;
  formationMastery: number[];
  skills: { skillId: string; level: number }[];
  uniqueSkill?: string;
};

const hist: O[] = [
  {
    id: 1,
    name: '曹操',
    birthYear: 155,
    deathYear: 220,
    stats: { leadership: 100, war: 72, intelligence: 91, politics: 94, charisma: 90 },
    hidden: {
      compatibility: 25,
      righteousness: 5,
      ambition: 14,
      valor: 5,
      composure: 6,
      lifespan: 220,
      growth: 'mid',
      personality: 'bold',
      ideal: 'hegemony',
      bloodline: [2, 3],
      ceilingBonus: { attribute: 'leadership', hiddenBonus: 20 },
    },
    unitProficiency: { ...prof('A'), lightCavalry: 'S', heavyCavalry: 'S' },
    formationMastery: [0, 2, 4, 6, 7, 8],
    skills: [
      { skillId: 'inspire', level: 3 },
      { skillId: 'farming', level: 2 },
      { skillId: 'rapidAttack', level: 2 },
    ],
  },
  {
    id: 2,
    name: '刘备',
    birthYear: 161,
    deathYear: 223,
    stats: { leadership: 85, war: 75, intelligence: 78, politics: 82, charisma: 100 },
    hidden: {
      compatibility: 75,
      righteousness: 14,
      ambition: 10,
      valor: 5,
      composure: 5,
      lifespan: 223,
      growth: 'mid',
      personality: 'gentle',
      ideal: 'benevolence',
      bloodline: [10, 11],
      ceilingBonus: { attribute: 'charisma', hiddenBonus: 10 },
    },
    unitProficiency: prof('A'),
    formationMastery: [0, 4, 7, 8],
    skills: [
      { skillId: 'inspire', level: 2 },
      { skillId: 'eloquence', level: 3 },
      { skillId: 'discover', level: 2 },
    ],
  },
  {
    id: 3,
    name: '孙权',
    birthYear: 182,
    deathYear: 252,
    stats: { leadership: 84, war: 70, intelligence: 80, politics: 88, charisma: 86 },
    hidden: {
      compatibility: 100,
      righteousness: 8,
      ambition: 10,
      valor: 4,
      composure: 5,
      lifespan: 252,
      growth: 'high',
      personality: 'calm',
      ideal: 'separatist',
      bloodline: [],
      ceilingBonus: null,
    },
    unitProficiency: { ...prof('B'), lightInfantry: 'A', archer: 'A' },
    formationMastery: [0, 4, 7, 8],
    skills: [
      { skillId: 'commerce', level: 2 },
      { skillId: 'hold', level: 2 },
    ],
  },
  {
    id: 4,
    name: '诸葛亮',
    birthYear: 181,
    deathYear: 234,
    stats: { leadership: 95, war: 38, intelligence: 100, politics: 96, charisma: 92 },
    hidden: {
      compatibility: 75,
      righteousness: 13,
      ambition: 4,
      valor: 2,
      composure: 7,
      lifespan: 234,
      growth: 'low',
      personality: 'calm',
      ideal: 'benevolence',
      bloodline: [950],
      ceilingBonus: { attribute: 'intelligence', hiddenBonus: 30 },
    },
    unitProficiency: { ...prof('B'), archer: 'A', spearman: 'A' },
    formationMastery: [0, 2, 4, 6, 7, 8],
    skills: [
      { skillId: 'fire', level: 3 },
      { skillId: 'calm', level: 3 },
      { skillId: 'formationChange', level: 3 },
      { skillId: 'farming', level: 2 },
    ],
  },
  {
    id: 5,
    name: '吕布',
    birthYear: 156,
    deathYear: 199,
    stats: { leadership: 78, war: 100, intelligence: 30, politics: 22, charisma: 55 },
    hidden: {
      compatibility: 50,
      righteousness: 2,
      ambition: 15,
      valor: 7,
      composure: 2,
      lifespan: 199,
      growth: 'low',
      personality: 'reckless',
      ideal: 'fame',
      bloodline: [],
      ceilingBonus: { attribute: 'war', hiddenBonus: 50 },
    },
    unitProficiency: { ...prof('A'), lightCavalry: 'S', heavyCavalry: 'S' },
    formationMastery: [2, 6, 16],
    skills: [
      { skillId: 'gallop', level: 3 },
      { skillId: 'bravery', level: 3 },
      { skillId: 'rapidAttack', level: 2 },
    ],
  },
  {
    id: 6,
    name: '关羽',
    birthYear: 162,
    deathYear: 220,
    stats: { leadership: 95, war: 98, intelligence: 75, politics: 63, charisma: 94 },
    hidden: {
      compatibility: 75,
      righteousness: 14,
      ambition: 6,
      valor: 7,
      composure: 4,
      lifespan: 220,
      growth: 'low',
      personality: 'brave',
      ideal: 'benevolence',
      bloodline: [7],
      ceilingBonus: null,
    },
    unitProficiency: { ...prof('A'), lightCavalry: 'S', heavyCavalry: 'S' },
    formationMastery: [0, 2, 4, 6, 7, 8],
    skills: [
      { skillId: 'gallop', level: 3 },
      { skillId: 'inspire', level: 2 },
      { skillId: 'bravery', level: 2 },
    ],
  },
  {
    id: 7,
    name: '张飞',
    birthYear: 167,
    deathYear: 221,
    stats: { leadership: 82, war: 99, intelligence: 40, politics: 28, charisma: 50 },
    hidden: {
      compatibility: 75,
      righteousness: 10,
      ambition: 5,
      valor: 7,
      composure: 1,
      lifespan: 221,
      growth: 'low',
      personality: 'reckless',
      ideal: 'chivalry',
      bloodline: [6],
      ceilingBonus: null,
    },
    unitProficiency: { ...prof('A'), spearman: 'S', heavyInfantry: 'S' },
    formationMastery: [0, 2, 6, 7],
    skills: [
      { skillId: 'taunt', level: 2 },
      { skillId: 'bravery', level: 3 },
      { skillId: 'rapidAttack', level: 2 },
    ],
  },
  {
    id: 8,
    name: '荀彧',
    birthYear: 163,
    deathYear: 212,
    stats: { leadership: 72, war: 28, intelligence: 95, politics: 100, charisma: 88 },
    hidden: {
      compatibility: 25,
      righteousness: 12,
      ambition: 3,
      valor: 1,
      composure: 6,
      lifespan: 212,
      growth: 'low',
      personality: 'calm',
      ideal: 'benevolence',
      bloodline: [],
      ceilingBonus: { attribute: 'politics', hiddenBonus: 20 },
    },
    unitProficiency: prof('C'),
    formationMastery: [0, 7],
    skills: [
      { skillId: 'commerce', level: 3 },
      { skillId: 'eloquence', level: 3 },
      { skillId: 'discover', level: 2 },
    ],
  },
  {
    id: 9,
    name: '夏侯惇',
    birthYear: 156,
    deathYear: 220,
    stats: { leadership: 85, war: 90, intelligence: 55, politics: 48, charisma: 70 },
    hidden: {
      compatibility: 25,
      righteousness: 8,
      ambition: 7,
      valor: 6,
      composure: 4,
      lifespan: 220,
      growth: 'mid',
      personality: 'brave',
      ideal: 'hegemony',
      bloodline: [],
      ceilingBonus: null,
    },
    unitProficiency: { ...prof('A'), heavyInfantry: 'S' },
    formationMastery: [0, 2, 7],
    skills: [
      { skillId: 'hold', level: 2 },
      { skillId: 'bravery', level: 2 },
    ],
  },
  {
    id: 10,
    name: '赵云',
    birthYear: 168,
    deathYear: 229,
    stats: { leadership: 88, war: 96, intelligence: 72, politics: 55, charisma: 82 },
    hidden: {
      compatibility: 75,
      righteousness: 13,
      ambition: 4,
      valor: 6,
      composure: 6,
      lifespan: 229,
      growth: 'mid',
      personality: 'brave',
      ideal: 'chivalry',
      bloodline: [],
      ceilingBonus: null,
    },
    unitProficiency: { ...prof('A'), lightCavalry: 'S', spearman: 'S' },
    formationMastery: [0, 2, 4, 6, 8],
    skills: [
      { skillId: 'gallop', level: 2 },
      { skillId: 'bravery', level: 2 },
      { skillId: 'reorganize', level: 1 },
    ],
  },
  {
    id: 11,
    name: '周瑜',
    birthYear: 175,
    deathYear: 210,
    stats: { leadership: 94, war: 72, intelligence: 96, politics: 78, charisma: 90 },
    hidden: {
      compatibility: 100,
      righteousness: 8,
      ambition: 8,
      valor: 4,
      composure: 5,
      lifespan: 210,
      growth: 'low',
      personality: 'bold',
      ideal: 'separatist',
      bloodline: [],
      ceilingBonus: null,
    },
    unitProficiency: { ...prof('B'), archer: 'A', lightInfantry: 'A' },
    formationMastery: [0, 4, 7, 8],
    skills: [
      { skillId: 'fire', level: 3 },
      { skillId: 'inspire', level: 2 },
      { skillId: 'formationChange', level: 2 },
    ],
  },
  {
    id: 12,
    name: '司马懿',
    birthYear: 179,
    deathYear: 251,
    stats: { leadership: 96, war: 65, intelligence: 98, politics: 92, charisma: 70 },
    hidden: {
      compatibility: 30,
      righteousness: 4,
      ambition: 14,
      valor: 3,
      composure: 7,
      lifespan: 251,
      growth: 'high',
      personality: 'cautious',
      ideal: 'hegemony',
      bloodline: [],
      ceilingBonus: null,
    },
    unitProficiency: { ...prof('B'), heavyInfantry: 'A' },
    formationMastery: [0, 2, 7, 8],
    skills: [
      { skillId: 'calm', level: 3 },
      { skillId: 'hold', level: 2 },
      { skillId: 'insight', level: 2 },
    ],
  },
  {
    id: 13,
    name: '典韦',
    birthYear: 160,
    deathYear: 197,
    stats: { leadership: 70, war: 97, intelligence: 35, politics: 20, charisma: 45 },
    hidden: {
      compatibility: 25,
      righteousness: 9,
      ambition: 3,
      valor: 7,
      composure: 3,
      lifespan: 197,
      growth: 'low',
      personality: 'brave',
      ideal: 'chivalry',
      bloodline: [],
      ceilingBonus: null,
    },
    unitProficiency: { ...prof('A'), heavyInfantry: 'S' },
    formationMastery: [0, 7],
    skills: [
      { skillId: 'bravery', level: 3 },
      { skillId: 'hold', level: 2 },
    ],
  },
  {
    id: 14,
    name: '黄忠',
    birthYear: 148,
    deathYear: 220,
    stats: { leadership: 80, war: 94, intelligence: 55, politics: 40, charisma: 68 },
    hidden: {
      compatibility: 75,
      righteousness: 10,
      ambition: 4,
      valor: 6,
      composure: 5,
      lifespan: 220,
      growth: 'low',
      personality: 'brave',
      ideal: 'chivalry',
      bloodline: [],
      ceilingBonus: null,
    },
    unitProficiency: { ...prof('B'), archer: 'S', lightCavalry: 'A' },
    formationMastery: [0, 4, 6],
    skills: [
      { skillId: 'archery', level: 3 },
      { skillId: 'longRange', level: 2 },
    ],
  },
  {
    id: 15,
    name: '陆逊',
    birthYear: 183,
    deathYear: 245,
    stats: { leadership: 92, war: 68, intelligence: 94, politics: 85, charisma: 80 },
    hidden: {
      compatibility: 100,
      righteousness: 9,
      ambition: 6,
      valor: 3,
      composure: 6,
      lifespan: 245,
      growth: 'high',
      personality: 'calm',
      ideal: 'separatist',
      bloodline: [],
      ceilingBonus: null,
    },
    unitProficiency: { ...prof('B'), archer: 'A', lightInfantry: 'A' },
    formationMastery: [0, 4, 7, 8],
    skills: [
      { skillId: 'fire', level: 2 },
      { skillId: 'ambush', level: 2 },
      { skillId: 'calm', level: 2 },
    ],
  },
];

const placeholders: O[] = [];
for (let i = 0; i < 15; i++) {
  const id = 100 + i;
  placeholders.push({
    id,
    name: `占位武将${i + 1}`,
    birthYear: 160 + (i % 20),
    deathYear: 210 + (i % 30),
    stats: {
      leadership: 40 + (i % 40),
      war: 40 + ((i * 3) % 40),
      intelligence: 40 + ((i * 5) % 40),
      politics: 40 + ((i * 7) % 40),
      charisma: 40 + ((i * 11) % 40),
    },
    hidden: {
      compatibility: 10 + i * 5,
      righteousness: 1 + (i % 10),
      ambition: 1 + (i % 10),
      valor: 1 + (i % 6),
      composure: 1 + (i % 6),
      lifespan: 210 + (i % 30),
      growth: ['low', 'mid', 'high'][i % 3],
      personality: ['brave', 'calm', 'bold', 'cautious', 'reckless', 'gentle'][i % 6],
      ideal: ['hegemony', 'benevolence', 'separatist', 'chivalry', 'fame'][i % 5],
      bloodline: [],
      ceilingBonus: null,
    },
    unitProficiency: prof(['A', 'B', 'C'][i % 3]),
    formationMastery: [0, 2, 4].slice(0, 1 + (i % 3)),
    skills: [{ skillId: skillDefs[i % skillDefs.length].id, level: 1 }],
  });
}
w('officers.json', [...hist, ...placeholders]);

// --- cities (30, 13 provinces) map 8192x4610 ---
// reuse demo ratios where possible + fill provinces
const cities = [
  { id: 1, name: '河南尹', province: '司隶', x: 0.52, y: 0.4, maxPopulation: 50000, isCapital: true, isPass: false, specialProduct: null, tier: 5, latitudeIndex: 3, recruitableUnits: ['lightInfantry', 'heavyInfantry', 'spearman', 'archer', 'lightCavalry'], initialStats: { farm: 400, commerce: 500, wall: 300 } },
  { id: 2, name: '京兆尹', province: '司隶', x: 0.38, y: 0.4, maxPopulation: 40000, isCapital: true, isPass: false, specialProduct: '丝绸', tier: 4, latitudeIndex: 3, recruitableUnits: ['lightInfantry', 'heavyInfantry', 'spearman', 'archer'], initialStats: { farm: 350, commerce: 400, wall: 280 } },
  { id: 3, name: '颍川郡', province: '豫州', x: 0.56, y: 0.42, maxPopulation: 35000, isCapital: true, isPass: false, specialProduct: null, tier: 3, latitudeIndex: 3, recruitableUnits: ['lightInfantry', 'spearman', 'archer'], initialStats: { farm: 320, commerce: 300, wall: 200 } },
  { id: 4, name: '汝南郡', province: '豫州', x: 0.58, y: 0.48, maxPopulation: 30000, isCapital: false, isPass: false, specialProduct: null, tier: 3, latitudeIndex: 3, recruitableUnits: ['lightInfantry', 'archer'], initialStats: { farm: 300, commerce: 250, wall: 180 } },
  { id: 5, name: '魏郡', province: '冀州', x: 0.58, y: 0.3, maxPopulation: 38000, isCapital: true, isPass: false, specialProduct: null, tier: 4, latitudeIndex: 4, recruitableUnits: ['lightInfantry', 'heavyInfantry', 'spearman', 'lightCavalry'], initialStats: { farm: 340, commerce: 360, wall: 260 } },
  { id: 6, name: '常山国', province: '冀州', x: 0.6, y: 0.26, maxPopulation: 22000, isCapital: false, isPass: false, specialProduct: null, tier: 3, latitudeIndex: 4, recruitableUnits: ['lightInfantry', 'lightCavalry'], initialStats: { farm: 250, commerce: 200, wall: 160 } },
  { id: 7, name: '陈留郡', province: '兖州', x: 0.55, y: 0.38, maxPopulation: 28000, isCapital: true, isPass: false, specialProduct: null, tier: 3, latitudeIndex: 3, recruitableUnits: ['lightInfantry', 'spearman', 'archer'], initialStats: { farm: 280, commerce: 270, wall: 190 } },
  { id: 8, name: '东郡', province: '兖州', x: 0.57, y: 0.34, maxPopulation: 24000, isCapital: false, isPass: false, specialProduct: null, tier: 3, latitudeIndex: 3, recruitableUnits: ['lightInfantry', 'heavyInfantry'], initialStats: { farm: 260, commerce: 220, wall: 170 } },
  { id: 9, name: '下邳国', province: '徐州', x: 0.68, y: 0.4, maxPopulation: 26000, isCapital: true, isPass: false, specialProduct: null, tier: 3, latitudeIndex: 3, recruitableUnits: ['lightInfantry', 'spearman', 'lightCavalry'], initialStats: { farm: 250, commerce: 240, wall: 220 } },
  { id: 10, name: '广陵郡', province: '徐州', x: 0.7, y: 0.5, maxPopulation: 22000, isCapital: false, isPass: false, specialProduct: null, tier: 3, latitudeIndex: 3, recruitableUnits: ['lightInfantry', 'archer'], initialStats: { farm: 230, commerce: 260, wall: 150 } },
  { id: 11, name: '平原郡', province: '青州', x: 0.62, y: 0.32, maxPopulation: 24000, isCapital: true, isPass: false, specialProduct: null, tier: 3, latitudeIndex: 4, recruitableUnits: ['lightInfantry', 'spearman'], initialStats: { farm: 270, commerce: 210, wall: 160 } },
  { id: 12, name: '北海国', province: '青州', x: 0.66, y: 0.3, maxPopulation: 20000, isCapital: false, isPass: false, specialProduct: null, tier: 2, latitudeIndex: 4, recruitableUnits: ['lightInfantry', 'archer'], initialStats: { farm: 220, commerce: 200, wall: 140 } },
  { id: 13, name: '南阳郡', province: '荆州', x: 0.5, y: 0.5, maxPopulation: 32000, isCapital: false, isPass: false, specialProduct: '铁', tier: 3, latitudeIndex: 3, recruitableUnits: ['lightInfantry', 'heavyInfantry', 'archer'], initialStats: { farm: 300, commerce: 280, wall: 200 } },
  { id: 14, name: '南郡', province: '荆州', x: 0.5, y: 0.62, maxPopulation: 30000, isCapital: true, isPass: false, specialProduct: null, tier: 4, latitudeIndex: 2, recruitableUnits: ['lightInfantry', 'spearman', 'archer'], initialStats: { farm: 310, commerce: 300, wall: 240 } },
  { id: 15, name: '襄阳', province: '荆州', x: 0.5, y: 0.55, maxPopulation: 28000, isCapital: false, isPass: true, specialProduct: null, tier: 3, latitudeIndex: 3, recruitableUnits: ['lightInfantry', 'heavyInfantry', 'archer'], initialStats: { farm: 280, commerce: 290, wall: 300 } },
  { id: 16, name: '吴郡', province: '扬州', x: 0.74, y: 0.6, maxPopulation: 30000, isCapital: false, isPass: false, specialProduct: '丝绸', tier: 3, latitudeIndex: 2, recruitableUnits: ['lightInfantry', 'archer'], initialStats: { farm: 290, commerce: 350, wall: 180 } },
  { id: 17, name: '丹阳郡', province: '扬州', x: 0.7, y: 0.58, maxPopulation: 35000, isCapital: true, isPass: false, specialProduct: null, tier: 4, latitudeIndex: 2, recruitableUnits: ['lightInfantry', 'spearman', 'archer'], initialStats: { farm: 300, commerce: 340, wall: 220 } },
  { id: 18, name: '九江郡', province: '扬州', x: 0.64, y: 0.52, maxPopulation: 25000, isCapital: false, isPass: false, specialProduct: null, tier: 3, latitudeIndex: 2, recruitableUnits: ['lightInfantry', 'archer'], initialStats: { farm: 260, commerce: 250, wall: 170 } },
  { id: 19, name: '蜀郡', province: '益州', x: 0.28, y: 0.68, maxPopulation: 45000, isCapital: true, isPass: false, specialProduct: '蜀锦', tier: 5, latitudeIndex: 2, recruitableUnits: ['lightInfantry', 'heavyInfantry', 'spearman', 'archer'], initialStats: { farm: 380, commerce: 420, wall: 280 } },
  { id: 20, name: '汉中郡', province: '益州', x: 0.36, y: 0.52, maxPopulation: 22000, isCapital: false, isPass: true, specialProduct: '药材', tier: 3, latitudeIndex: 3, recruitableUnits: ['lightInfantry', 'spearman', 'archer', 'lightCavalry'], initialStats: { farm: 240, commerce: 180, wall: 260 } },
  { id: 21, name: '巴郡', province: '益州', x: 0.34, y: 0.7, maxPopulation: 20000, isCapital: false, isPass: false, specialProduct: null, tier: 3, latitudeIndex: 2, recruitableUnits: ['lightInfantry', 'archer'], initialStats: { farm: 250, commerce: 200, wall: 150 } },
  { id: 22, name: '汉阳郡', province: '凉州', x: 0.32, y: 0.35, maxPopulation: 18000, isCapital: true, isPass: false, specialProduct: '良马', tier: 3, latitudeIndex: 4, recruitableUnits: ['lightCavalry', 'heavyCavalry', 'lightInfantry'], initialStats: { farm: 180, commerce: 160, wall: 200 } },
  { id: 23, name: '武威郡', province: '凉州', x: 0.28, y: 0.28, maxPopulation: 15000, isCapital: false, isPass: false, specialProduct: '良马', tier: 2, latitudeIndex: 5, recruitableUnits: ['lightCavalry', 'heavyCavalry'], initialStats: { farm: 150, commerce: 140, wall: 180 } },
  { id: 24, name: '太原郡', province: '并州', x: 0.48, y: 0.28, maxPopulation: 22000, isCapital: true, isPass: false, specialProduct: null, tier: 3, latitudeIndex: 5, recruitableUnits: ['lightInfantry', 'spearman', 'lightCavalry'], initialStats: { farm: 220, commerce: 180, wall: 190 } },
  { id: 25, name: '上党郡', province: '并州', x: 0.5, y: 0.32, maxPopulation: 16000, isCapital: false, isPass: false, specialProduct: null, tier: 2, latitudeIndex: 4, recruitableUnits: ['lightInfantry', 'spearman'], initialStats: { farm: 180, commerce: 150, wall: 170 } },
  { id: 26, name: '涿郡', province: '幽州', x: 0.62, y: 0.22, maxPopulation: 20000, isCapital: false, isPass: false, specialProduct: null, tier: 3, latitudeIndex: 5, recruitableUnits: ['lightInfantry', 'lightCavalry'], initialStats: { farm: 210, commerce: 170, wall: 150 } },
  { id: 27, name: '广阳郡', province: '幽州', x: 0.64, y: 0.2, maxPopulation: 18000, isCapital: true, isPass: false, specialProduct: null, tier: 3, latitudeIndex: 5, recruitableUnits: ['lightInfantry', 'spearman'], initialStats: { farm: 190, commerce: 180, wall: 160 } },
  { id: 28, name: '辽东郡', province: '幽州', x: 0.78, y: 0.18, maxPopulation: 14000, isCapital: false, isPass: false, specialProduct: null, tier: 2, latitudeIndex: 5, recruitableUnits: ['lightInfantry', 'lightCavalry'], initialStats: { farm: 140, commerce: 120, wall: 140 } },
  { id: 29, name: '南海郡', province: '交州', x: 0.48, y: 0.88, maxPopulation: 16000, isCapital: true, isPass: false, specialProduct: '珍珠', tier: 3, latitudeIndex: 1, recruitableUnits: ['lightInfantry', 'archer'], initialStats: { farm: 170, commerce: 200, wall: 120 } },
  { id: 30, name: '交趾郡', province: '交州', x: 0.4, y: 0.92, maxPopulation: 14000, isCapital: false, isPass: false, specialProduct: null, tier: 2, latitudeIndex: 1, recruitableUnits: ['lightInfantry'], initialStats: { farm: 150, commerce: 160, wall: 100 } },
].map((c) => ({
  ...c,
  x: Math.round(c.x * 8192),
  y: Math.round(c.y * 4610),
  specialties: c.specialProduct ? [c.specialProduct] : [],
  facilities: [],
  policy: null,
  developmentProgress: { farm: 0, commerce: 0, wall: 0 },
  countyCount: c.id === 14 ? 17 : 3 + (c.id % 5),
}));
w('cities.json', cities);

// --- items (20) ---
const items = [
  { id: 1, name: '青龙偃月刀', category: 'weapon_primary', quality: 'legendary', primaryWeaponSubType: 'blade', baseStats: { war: 10 }, baseEffect: [{ type: 'crit_rate', value: 5, description: '暴击+5%' }], equipRequirement: { minWar: 80 }, acquisition: ['initial', 'loot'], description: '关羽所用大刀' },
  { id: 2, name: '方天画戟', category: 'weapon_primary', quality: 'legendary', primaryWeaponSubType: 'halberd', baseStats: { war: 12 }, baseEffect: [{ type: 'charge_damage', value: 15 }], equipRequirement: { minWar: 90 }, acquisition: ['initial', 'loot'], description: '吕布兵器' },
  { id: 3, name: '丈八蛇矛', category: 'weapon_primary', quality: 'epic', primaryWeaponSubType: 'spear', baseStats: { war: 8 }, baseEffect: [{ type: 'vs_cavalry', value: 10 }], equipRequirement: { minWar: 70 }, acquisition: ['initial', 'loot'], description: '张飞兵器' },
  { id: 4, name: '倚天剑', category: 'weapon_primary', quality: 'legendary', primaryWeaponSubType: 'sword', baseStats: { war: 8, leadership: 3 }, baseEffect: [{ type: 'authority', value: 5 }], equipRequirement: { minLeadership: 70 }, acquisition: ['event'], description: '曹操佩剑' },
  { id: 5, name: '雌雄双股剑', category: 'weapon_primary', quality: 'epic', primaryWeaponSubType: 'sword', baseStats: { war: 6, charisma: 3 }, baseEffect: [], equipRequirement: { minCharisma: 60 }, acquisition: ['initial'], description: '刘备佩剑' },
  { id: 6, name: '宝雕弓', category: 'weapon_secondary', quality: 'rare', secondaryWeaponSubType: 'bow', baseStats: { war: 4 }, baseEffect: [{ type: 'range', value: 1 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 800, description: '精良弓' },
  { id: 7, name: '诸葛连弩', category: 'weapon_secondary', quality: 'epic', secondaryWeaponSubType: 'crossbow', baseStats: { war: 5, intelligence: 2 }, baseEffect: [{ type: 'armor_pierce', value: 15 }], equipRequirement: { minIntelligence: 50 }, acquisition: ['craft', 'event'], description: '连弩' },
  { id: 8, name: '黑铁甲', category: 'armor', quality: 'rare', armorSubType: 'metal', baseStats: { leadership: 2 }, baseEffect: [{ type: 'defense', value: 8 }], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 1000, description: '重甲' },
  { id: 9, name: '软猬甲', category: 'armor', quality: 'epic', armorSubType: 'specialArmor', baseStats: {}, baseEffect: [{ type: 'arrow_resist', value: 30 }], equipRequirement: {}, acquisition: ['event'], description: '防箭奇甲' },
  { id: 10, name: '赤兔马', category: 'mount', quality: 'legendary', baseStats: { war: 3 }, baseEffect: [{ type: 'mobility', value: 2, description: '机动力+2' }], equipRequirement: { minWar: 70 }, acquisition: ['event', 'loot'], description: '千里马' },
  { id: 11, name: '的卢', category: 'mount', quality: 'epic', baseStats: { charisma: 2 }, baseEffect: [{ type: 'escape', value: 20 }], equipRequirement: {}, acquisition: ['event'], description: '刘备坐骑' },
  { id: 12, name: '绝影', category: 'mount', quality: 'epic', baseStats: { leadership: 2 }, baseEffect: [{ type: 'mobility', value: 1 }], equipRequirement: {}, acquisition: ['initial'], description: '曹操坐骑' },
  { id: 13, name: '孙子兵法', category: 'book', quality: 'legendary', baseStats: { intelligence: 8, leadership: 4 }, baseEffect: [{ type: 'tactic_power', value: 10 }], equipRequirement: { minIntelligence: 60 }, acquisition: ['search', 'event'], description: '兵家圣典' },
  { id: 14, name: '孟德新书', category: 'book', quality: 'epic', baseStats: { leadership: 5, politics: 3 }, baseEffect: [], equipRequirement: {}, acquisition: ['event'], description: '曹操兵书' },
  { id: 15, name: '传国玉玺', category: 'special', quality: 'legendary', baseStats: { charisma: 10, politics: 5 }, baseEffect: [{ type: 'legitimacy', value: 50 }], equipRequirement: {}, acquisition: ['event'], description: '受命于天' },
  { id: 16, name: '玉玺残片', category: 'special', quality: 'rare', baseStats: { charisma: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['search'], description: '玉玺碎片' },
  { id: 17, name: '金疮药', category: 'consumable', quality: 'common', baseStats: {}, baseEffect: [], consumable: { effect: { type: 'heal', value: 30, description: '恢复伤势' }, maxStack: 20 }, equipRequirement: {}, acquisition: ['shop'], shopPrice: 50, description: '疗伤药' },
  { id: 18, name: '兵符', category: 'special', quality: 'rare', baseStats: { leadership: 3 }, baseEffect: [{ type: 'recruit_bonus', value: 10 }], equipRequirement: {}, acquisition: ['event'], description: '调兵信物' },
  { id: 19, name: '青铜剑', category: 'weapon_primary', quality: 'common', primaryWeaponSubType: 'sword', baseStats: { war: 2 }, baseEffect: [], equipRequirement: {}, acquisition: ['shop', 'loot'], shopPrice: 200, description: '普通铜剑' },
  { id: 20, name: '革甲', category: 'armor', quality: 'common', armorSubType: 'leather', baseStats: {}, baseEffect: [{ type: 'defense', value: 3 }], equipRequirement: {}, acquisition: ['shop'], shopPrice: 150, description: '普通革甲' },
];
w('items.json', items);

// --- females (10, historical/romance) ---
const mkInf = (h: number, c: number, m: number, p: number, f: number, s: number) => ({
  household: h,
  counsel: c,
  martial: m,
  prestige: p,
  fortitude: f,
  scholarship: s,
});
const females = [
  { id: 201, name: '黄月英', birthYear: 185, deathYear: 235, family: 'localPower', clanName: '黄', factionId: 2, locationId: 19, initialStatus: 'married', initialHusbandId: 4, influence: mkInf(60, 80, 20, 50, 40, 95), statBonus: { intelligence: 5, politics: 3 }, teachableSkills: ['calm', 'farming'], enhanceableSkills: [{ skill: 'fire', bonus: 1 }], talents: ['bloodlineScholar', 'featherFan'], relatedEvents: [], canCommand: false, description: '诸葛亮妻，襄阳黄承彦女（《三国志》裴注）' },
  { id: 202, name: '貂蝉', birthYear: 173, deathYear: 200, family: 'commoner', clanName: '任', factionId: null, locationId: 1, initialStatus: 'single', influence: mkInf(40, 70, 10, 90, 50, 40), statBonus: { charisma: 8 }, teachableSkills: ['eloquence'], enhanceableSkills: [], talents: ['diplomaticGrace', 'captiveShield'], relatedEvents: [101], canCommand: false, description: '王允义女，连环计（《三国演义》）' },
  { id: 203, name: '孙尚香', birthYear: 189, deathYear: 230, family: 'greatClan', clanName: '孙', factionId: 3, locationId: 17, initialStatus: 'single', influence: mkInf(50, 40, 70, 80, 75, 45), statBonus: { war: 4, charisma: 3 }, teachableSkills: ['bravery'], enhanceableSkills: [], talents: ['bloodlineWarrior', 'moraleAnchor'], relatedEvents: [], canCommand: false, description: '孙权妹，刘备夫人（《三国志·法正传》等）' },
  { id: 204, name: '蔡琰', birthYear: 177, deathYear: 249, family: 'greatClan', clanName: '蔡', factionId: 1, locationId: 1, initialStatus: 'widow', influence: mkInf(55, 75, 10, 70, 60, 98), statBonus: { intelligence: 6, politics: 4, charisma: 4 }, teachableSkills: ['eloquence', 'medicine'], enhanceableSkills: [], talents: ['bloodlineScholar', 'childEducator'], relatedEvents: [], canCommand: false, description: '蔡邕女，文姬归汉（《后汉书·列女传》）' },
  { id: 205, name: '大乔', birthYear: 178, deathYear: 220, family: 'localPower', clanName: '桥', factionId: 3, locationId: 17, initialStatus: 'married', influence: mkInf(70, 50, 15, 85, 45, 55), statBonus: { charisma: 6 }, teachableSkills: [], enhanceableSkills: [], talents: ['prestige', 'concubineHarmony'].filter(Boolean) as string[], relatedEvents: [], canCommand: false, description: '桥公长女，孙策妻（《三国志·周瑜传》）' },
  { id: 206, name: '小乔', birthYear: 180, deathYear: 220, family: 'localPower', clanName: '桥', factionId: 3, locationId: 17, initialStatus: 'married', initialHusbandId: 11, influence: mkInf(65, 55, 15, 88, 45, 60), statBonus: { charisma: 7, intelligence: 2 }, teachableSkills: [], enhanceableSkills: [], talents: ['diplomaticGrace'], relatedEvents: [], canCommand: false, description: '桥公次女，周瑜妻（《三国志·周瑜传》）' },
  { id: 207, name: '甄宓', birthYear: 183, deathYear: 221, family: 'greatClan', clanName: '甄', factionId: 1, locationId: 5, initialStatus: 'married', influence: mkInf(70, 60, 10, 90, 50, 70), statBonus: { charisma: 8, politics: 2 }, teachableSkills: [], enhanceableSkills: [], talents: ['prestige', 'household'].includes('prestige') ? ['prestige' as string] : [], relatedEvents: [], canCommand: false, description: '文昭甄皇后（《三国志·后妃传》）' },
  { id: 208, name: '步练师', birthYear: 185, deathYear: 238, family: 'localPower', clanName: '步', factionId: 3, locationId: 17, initialStatus: 'married', influence: mkInf(75, 65, 20, 70, 55, 60), statBonus: { politics: 4, charisma: 3 }, teachableSkills: ['commerce'], enhanceableSkills: [], talents: ['economicBoost', 'household'], relatedEvents: [], canCommand: false, description: '孙权夫人，临淮淮阴人（《三国志·妃嫔传》）' },
  { id: 209, name: '祝融', birthYear: 180, deathYear: 240, family: 'localPower', clanName: '祝融', factionId: null, locationId: 21, initialStatus: 'married', influence: mkInf(40, 30, 95, 60, 80, 25), statBonus: { war: 8, leadership: 3 }, teachableSkills: ['bravery', 'riding'], enhanceableSkills: [], talents: ['bloodlineWarrior', 'nightRaid'], relatedEvents: [], canCommand: true, description: '南蛮王孟获之妻，唯一可出战女将（《三国演义》）' },
  { id: 210, name: '糜夫人', birthYear: 170, deathYear: 208, family: 'localPower', clanName: '糜', factionId: 2, locationId: 14, initialStatus: 'married', initialHusbandId: 2, influence: mkInf(80, 40, 15, 55, 70, 40), statBonus: { charisma: 3 }, teachableSkills: [], enhanceableSkills: [], talents: ['loyaltyAura', 'childEducator'], relatedEvents: [], canCommand: false, description: '刘备夫人，糜竺之妹（《三国志·先主传》）' },
];
// fix invalid talents
females[4].talents = ['diplomaticGrace', 'concubineHarmony'];
females[6].talents = ['prestige', 'household'];
w('females.json', females);

// --- children (5, historical) ---
const children = [
  { childId: 950, childName: '诸葛瞻', fatherId: 4, motherId: 201, birthYear: 227, appearYear: 243, source: 'history', baseStats: { leadership: 55, war: 48, intelligence: 68, politics: 65, charisma: 70 }, motherBonus: { fromScholarship: { intelligence: 5, politics: 3 }, fromBloodline: {}, extraSkills: ['calm'], extraTalents: [] } },
  { childId: 951, childName: '关兴', fatherId: 6, motherId: 210, birthYear: 190, appearYear: 206, source: 'history', baseStats: { leadership: 70, war: 78, intelligence: 55, politics: 45, charisma: 60 }, motherBonus: { fromScholarship: {}, fromBloodline: { war: 3 }, extraSkills: ['bravery'], extraTalents: [] } },
  { childId: 952, childName: '张苞', fatherId: 7, motherId: 210, birthYear: 192, appearYear: 208, source: 'romance', baseStats: { leadership: 68, war: 82, intelligence: 40, politics: 30, charisma: 48 }, motherBonus: { fromScholarship: {}, fromBloodline: { war: 4 }, extraSkills: ['bravery'], extraTalents: [] } },
  { childId: 953, childName: '曹丕', fatherId: 1, motherId: 207, birthYear: 187, appearYear: 203, source: 'history', baseStats: { leadership: 78, war: 55, intelligence: 82, politics: 85, charisma: 75 }, motherBonus: { fromScholarship: { intelligence: 3 }, fromBloodline: {}, extraSkills: ['eloquence'], extraTalents: [] } },
  { childId: 954, childName: '孙登', fatherId: 3, motherId: 208, birthYear: 209, appearYear: 225, source: 'history', baseStats: { leadership: 72, war: 50, intelligence: 75, politics: 78, charisma: 80 }, motherBonus: { fromScholarship: { politics: 3 }, fromBloodline: {}, extraSkills: ['commerce'], extraTalents: [] } },
];
// Note: motherIds for 关兴/张苞 use 糜夫人 as stand-in for 0-A linkage (romance often omits birth mothers)
w('children.json', children);

// --- events (5) ---
const events = [
  {
    id: 100,
    name: '三顾茅庐',
    description: '刘备三访隆中，请诸葛亮出山。',
    category: 'historical',
    conditions: [
      { type: 'year', field: 'currentYear', operator: 'gte', value: 207 },
      { type: 'officer', field: 'faction', operator: 'equals', value: 2 },
    ],
    dialogues: [
      { speakerId: 2, speakerName: '刘备', text: '备闻先生大名，特来拜访。' },
      { speakerId: 4, speakerName: '诸葛亮', text: '将军既不弃，愿效犬马之劳。' },
    ],
    choices: [
      {
        label: '诚心相请',
        effects: [
          { type: 'recruit', target: 'officer', targetId: 4, field: 'faction', value: 2 },
          { type: 'loyalty', target: 'officer', targetId: 4, field: 'loyalty', value: 100 },
        ],
      },
    ],
    autoChoice: 0,
  },
  {
    id: 101,
    name: '连环计',
    description: '王允以貂蝉离间董卓吕布。',
    category: 'historical',
    conditions: [{ type: 'year', field: 'currentYear', operator: 'lte', value: 192 }],
    dialogues: [{ speakerName: '王允', text: '董贼可除，全仗此计。' }],
    choices: [
      { label: '施行', effects: [{ type: 'relation', target: 'global', field: 'favorability', value: -20 }] },
      { label: '作罢', effects: [] },
    ],
  },
  {
    id: 102,
    name: '赤壁风云',
    description: '孙刘联军火攻曹操。',
    category: 'historical',
    conditions: [{ type: 'year', field: 'currentYear', operator: 'equals', value: 208 }],
    dialogues: [
      { speakerId: 11, speakerName: '周瑜', text: '万事俱备，只欠东风。' },
      { speakerId: 4, speakerName: '诸葛亮', text: '可借东风。' },
    ],
    choices: [
      { label: '火攻', effects: [{ type: 'battle_bonus', target: 'faction', targetId: 3, field: 'fire', value: 30 }] },
    ],
    autoChoice: 0,
  },
  {
    id: 103,
    name: '屯田令',
    description: '曹操推行屯田，以足军粮。',
    category: 'historical',
    conditions: [{ type: 'year', field: 'currentYear', operator: 'gte', value: 196 }],
    dialogues: [{ speakerId: 1, speakerName: '曹操', text: '定国之术，在于强兵足食。' }],
    choices: [
      {
        label: '推行屯田',
        effects: [{ type: 'develop', target: 'city', targetId: 1, field: 'farm', value: 50 }],
      },
    ],
    autoChoice: 0,
  },
  {
    id: 104,
    name: '夷陵战前',
    description: '刘备为关羽报仇，兴兵伐吴。',
    category: 'historical',
    conditions: [{ type: 'year', field: 'currentYear', operator: 'gte', value: 221 }],
    dialogues: [
      { speakerId: 2, speakerName: '刘备', text: '云长之仇，不共戴天！' },
      { speakerId: 4, speakerName: '诸葛亮', text: '主公且慎。' },
    ],
    choices: [
      { label: '兴兵', effects: [{ type: 'war', target: 'faction', targetId: 3, field: 'relation', value: 'war' }] },
      { label: '隐忍', effects: [{ type: 'loyalty', target: 'officer', targetId: 2, field: 'loyalty', value: -5 }] },
    ],
  },
];
w('events.json', events);

// --- scenario (1) 黄巾之后/群雄并起简化 190 ---
const ownership: Record<string, number> = {};
// faction 1 魏/曹操, 2 蜀/刘备, 3 吴/孙权, 4 吕布
const assign: [number, number][] = [
  [1, 1], [2, 1], [3, 1], [5, 1], [7, 1], [8, 1], [13, 1], [24, 1], [25, 1],
  [19, 2], [20, 2], [21, 2], [14, 2], [15, 2],
  [16, 3], [17, 3], [18, 3], [10, 3], [29, 3], [30, 3],
  [9, 4], [11, 4],
  [4, 1], [6, 1], [12, 1], [22, 1], [23, 1], [26, 1], [27, 1], [28, 1],
];
for (const [cid, fid] of assign) ownership[String(cid)] = fid;

const scenarios = [
  {
    id: 1,
    name: '群雄割据（0-A）',
    type: 'historical',
    description: '初平元年前后，曹操、刘备、孙权、吕布四方并立的最小验证剧本。',
    startYear: 190,
    endYear: 220,
    playableFactions: [1, 2, 3, 4],
    recommendedFaction: 2,
    startState: {
      year: 190,
      month: 1,
      factions: [1, 2, 3, 4],
      activeFactionIds: [1, 2, 3, 4],
      cityOwnership: ownership,
      officerPositions: [
        { officerId: 1, cityId: 1, factionId: 1, militaryPosition: 'grandGeneral', loyalty: 100 },
        { officerId: 8, cityId: 1, factionId: 1, civilPosition: 'chancellor', loyalty: 95 },
        { officerId: 9, cityId: 2, factionId: 1, militaryPosition: 'general', loyalty: 100 },
        { officerId: 12, cityId: 5, factionId: 1, militaryPosition: 'colonel', loyalty: 80 },
        { officerId: 13, cityId: 1, factionId: 1, militaryPosition: 'captain', loyalty: 100 },
        { officerId: 2, cityId: 19, factionId: 2, nobilityRank: 'prince', loyalty: 100 },
        { officerId: 4, cityId: 20, factionId: 2, civilPosition: 'chancellor', loyalty: 100 },
        { officerId: 6, cityId: 15, factionId: 2, militaryPosition: 'general', loyalty: 100 },
        { officerId: 7, cityId: 14, factionId: 2, militaryPosition: 'general', loyalty: 100 },
        { officerId: 10, cityId: 19, factionId: 2, militaryPosition: 'colonel', loyalty: 100 },
        { officerId: 14, cityId: 20, factionId: 2, militaryPosition: 'captain', loyalty: 90 },
        { officerId: 3, cityId: 17, factionId: 3, nobilityRank: 'prince', loyalty: 100 },
        { officerId: 11, cityId: 17, factionId: 3, militaryPosition: 'grandGeneral', loyalty: 100 },
        { officerId: 15, cityId: 16, factionId: 3, militaryPosition: 'colonel', loyalty: 90 },
        { officerId: 5, cityId: 9, factionId: 4, militaryPosition: 'grandGeneral', loyalty: 100 },
        // placeholders spread
        ...placeholders.slice(0, 15).map((p, i) => ({
          officerId: p.id,
          cityId: [1, 5, 19, 17, 9, 2, 14, 16, 22, 24, 26, 29, 3, 11, 7][i],
          factionId: [1, 1, 2, 3, 4, 1, 2, 3, 1, 1, 1, 3, 1, 4, 1][i],
          loyalty: 70 + (i % 20),
        })),
      ],
      femalePositions: females.map((f) => ({
        femaleId: f.id,
        cityId: f.locationId,
        status: f.initialStatus,
        husbandId: f.initialHusbandId,
        factionId: f.factionId ?? undefined,
      })),
      initialDiplomacy: [
        { factionA: 1, factionB: 2, relation: 'hostile', favorability: -30 },
        { factionA: 1, factionB: 3, relation: 'neutral', favorability: 0 },
        { factionA: 1, factionB: 4, relation: 'war', favorability: -60 },
        { factionA: 2, factionB: 3, relation: 'friendly', favorability: 40 },
        { factionA: 2, factionB: 4, relation: 'hostile', favorability: -20 },
        { factionA: 3, factionB: 4, relation: 'neutral', favorability: 0 },
      ],
      completedEvents: [],
    },
  },
];
w('scenarios.json', scenarios);

console.log('0-A data generation complete.');
