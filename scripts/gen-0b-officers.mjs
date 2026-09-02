// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 0-B 数据扩容 P0B-06 第一梯队：officers.json 223 → 240（Session 430）。
 *
 * 来源：docs/14-officer-stats-reference.md 附录六指定的 0-B 候选池（ID 为「—」者）。
 * 经与 officers.json 差集并扣除 docs/14 §六女性区（属 females.json）、⚠方士禁录
 * （左慈/于吉/管辂/祢衡——04 §3.2 既定）、P0B-12 子女覆盖（袁尚）、名称变体（歩骘=步骘、
 * 祝融夫人=祝融、蔡文姬=蔡琰、甄氏=甄宓）后，可录入候选共 17 人，全部落库，候选池清零。
 *
 * 口径：
 * - 五维取 docs/14 定稿参考值（统→leadership 武→war 智→intelligence 政→politics 魅→charisma）。
 * - 生卒年：有史可考者取考据值（杨修 175~219、谯周 201~270、马休马铁 212 同死、袁谭 203 等）；
 *   史无明文者取约值（录入后待人工校对，08 §五既定「脚本生成+人工校对」流程）。
 * - hidden 派生公式与 engine/child.ts buildChildOfficer 同源；unitProficiency 全 C 起步；
 *   formationMastery [0]；skills/tags 空（技能绑定留待后续批次）；avatarGene 省略（D-0B-7）。
 * - 断言：id/姓名与既有 223、子女 950~999 段不冲突；deathYear>birthYear；候选池清零。
 *
 * 运行：node scripts/gen-0b-officers.mjs（幂等：剥掉 id≥310 的生成段重排全表）。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'server', 'src', 'data', 'officers.json');
const CHILDREN = join(ROOT, 'server', 'src', 'data', 'children.json');

const UNIT_KEYS = ['lightInfantry', 'heavyInfantry', 'spearman', 'archer', 'crossbowman', 'lightCavalry', 'heavyCavalry', 'horseArcher', 'lightNavy', 'mediumNavy', 'heavyNavy', 'siege'];

/** [id, name, birth, death, 统, 武, 智, 政, 魅, tags] —— 五维取 docs/14 定稿值 */
const NEW_OFFICERS = [
  [310, '毛玠', 165, 216, 40, 15, 72, 82, 65, ['士族', '兖州', '文官', '谋臣']],
  [311, '崔琰', 163, 216, 30, 12, 68, 85, 60, ['士族', '冀州', '文官']],
  [312, '杨修', 175, 219, 30, 15, 85, 60, 35, ['士族', '弘农', '文官']],
  [313, '丁仪', 175, 220, 25, 10, 72, 55, 30, ['士族', '沛国', '文官']],
  [314, '秦宓', 170, 226, 20, 10, 75, 55, 65, ['士族', '益州', '文官']],
  [315, '谯周', 201, 270, 10, 2, 72, 70, 40, ['士族', '益州', '文官']],
  [316, '阚泽', 170, 243, 30, 15, 80, 65, 58, ['寒门', '扬州', '文官']],
  [317, '郝萌', 160, 196, 40, 55, 20, 8, 20, ['并州', '武将']],
  [318, '张勋', 155, 199, 55, 60, 35, 18, 25, ['淮南', '武将']],
  [319, '雷薄', 158, 200, 40, 50, 20, 10, 15, ['淮南', '武将']],
  [320, '刘琮', 175, 230, 30, 15, 40, 35, 30, ['汉室', '荆州']],
  [321, '马休', 180, 212, 55, 68, 30, 18, 25, ['凉州', '武将']],
  [322, '马铁', 183, 212, 50, 65, 28, 15, 20, ['凉州', '武将']],
  [323, '刘循', 200, 260, 52, 40, 38, 25, 35, ['益州', '武将']],
  [324, '张卫', 160, 215, 62, 58, 35, 18, 30, ['汉中', '武将']],
  [325, '杨昂', 158, 215, 55, 62, 30, 12, 20, ['汉中', '武将']],
  [326, '袁谭', 168, 203, 62, 72, 42, 35, 40, ['汝南', '君主亲族']],
];

const clampStat = (n) => Math.max(1, Math.min(100, Math.floor(n)));

function buildOfficer([id, name, birth, death, leadership, war, intelligence, politics, charisma, tags]) {
  return {
    id,
    name,
    birthYear: birth,
    deathYear: death,
    stats: { leadership, war, intelligence, politics, charisma },
    hidden: {
      compatibility: 75,
      righteousness: 8,
      ambition: 8,
      valor: Math.min(7, Math.max(1, Math.floor(war / 15))),
      composure: Math.min(7, Math.max(1, Math.floor(intelligence / 15))),
      lifespan: death,
      growth: 'mid',
      personality: 'calm',
      ideal: 'fame',
      bloodline: [],
      ceilingBonus: null,
      power: clampStat(40 + war / 3),
      burst: clampStat(40 + war / 4),
      agility: clampStat(45 + war / 5),
      luck: 50,
      intuition: clampStat(40 + intelligence / 4),
      awe: clampStat(30 + leadership / 4),
      strategy: clampStat(40 + intelligence / 3),
      tactics: clampStat(40 + intelligence / 4),
    },
    unitProficiency: Object.fromEntries(UNIT_KEYS.map((k) => [k, 'C'])),
    formationMastery: [0],
    skills: [],
    tags,
  };
}

// ── 校验与合并 ─────────────────────────────────────────────────
const raw = JSON.parse(readFileSync(FILE, 'utf-8'));
if (raw.length !== 223 && raw.length !== 240) throw new Error(`unexpected input: ${raw.length} officers`);
const base = raw.filter((o) => o.id < 310);
if (base.length !== 223) throw new Error(`base officers found ${base.length}, expect 223`);

const children = JSON.parse(readFileSync(CHILDREN, 'utf-8'));
const childNames = new Set(children.map((c) => c.childName));
const existingIds = new Set(base.map((o) => o.id));
const existingNames = new Set(base.map((o) => o.name));

const generated = NEW_OFFICERS.map(buildOfficer);
for (const o of generated) {
  if (existingIds.has(o.id)) throw new Error(`id ${o.id} collides`);
  if (existingNames.has(o.name) || childNames.has(o.name)) throw new Error(`name ${o.name} collides`);
  if (o.deathYear <= o.birthYear) throw new Error(`${o.name} deathYear <= birthYear`);
  for (const v of Object.values(o.stats)) {
    if (!(v >= 1 && v <= 100)) throw new Error(`${o.name} stat out of range`);
  }
}

const merged = [...base, ...generated].sort((a, b) => a.id - b.id);
if (merged.length !== 240) throw new Error(`expect 240 officers (223 + 17), got ${merged.length}`);
writeFileSync(FILE, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`officers.json written: ${merged.length} officers (added ${generated.length}: ${generated.map((o) => o.name).join(' ')})`);
