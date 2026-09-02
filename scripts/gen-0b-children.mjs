// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 0-B 数据扩容 P0B-12：children.json 5 → 50 子女登场事件（新增 id 955~999，Session 427）。
 *
 * 规则（docs/08 §七 为真源；docs/00-dev-constitution.md §九为红线）：
 * - 全部为史书可考子嗣（关索为民间传说层，source=folklore）；禁止自创。
 * - fatherId 仅指 officers.json 在册武将；motherId 指 females.json 在册女性，母不详者取 0
 *   （引擎 bloodline 按 id>0 过滤，为既定约定）。
 * - appearYear = birthYear + 16（08 §七 登场年口径）。
 * - childId 使用 950~999 子女专用段，且不得与 officers.json 姓名/ID 重复（避免动态入库撞静态）。
 * - motherBonus 仅在母亲可考时手书（引擎仅在父母已婚且均在局内时消费）。
 * - 剧本 childEventIds 白名单未收录新 id（scenario1 仅 950~954），GameState 注入面零变化。
 *
 * 运行：node scripts/gen-0b-children.mjs（幂等：剥掉已生成段重排全表）。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'server', 'src', 'data', 'children.json');
const officersFile = join(ROOT, 'server', 'src', 'data', 'officers.json');
const femalesFile = join(ROOT, 'server', 'src', 'data', 'females.json');
const skillsFile = join(ROOT, 'server', 'src', 'data', 'skills.json');

/** 45 条新增（id 955~999）。字段顺序与 0-A 现有文件一致。 */
const NEW_CHILDREN = [
  // ── 曹魏 ─────────────────────────────────────────────────────
  { childId: 961, childName: '夏侯楙', fatherId: 9, motherId: 0, birthYear: 192, appearYear: 208, source: 'history', baseStats: { leadership: 45, war: 40, intelligence: 50, politics: 55, charisma: 50 } },
  { childId: 962, childName: '夏侯霸', fatherId: 120, motherId: 0, birthYear: 191, appearYear: 207, source: 'history', baseStats: { leadership: 70, war: 80, intelligence: 50, politics: 40, charisma: 55 } },
  { childId: 963, childName: '曹爽', fatherId: 122, motherId: 0, birthYear: 205, appearYear: 221, source: 'history', baseStats: { leadership: 60, war: 50, intelligence: 50, politics: 55, charisma: 65 } },
  { childId: 959, childName: '曹彪', fatherId: 1, motherId: 0, birthYear: 195, appearYear: 211, source: 'history', baseStats: { leadership: 65, war: 62, intelligence: 55, politics: 50, charisma: 60 } },
  { childId: 958, childName: '夏侯玄', fatherId: 190, motherId: 0, birthYear: 209, appearYear: 225, source: 'history', baseStats: { leadership: 55, war: 40, intelligence: 82, politics: 70, charisma: 85 } },
  { childId: 956, childName: '司马攸', fatherId: 208, motherId: 221, birthYear: 246, appearYear: 262, source: 'history', baseStats: { leadership: 72, war: 45, intelligence: 82, politics: 85, charisma: 88 }, motherBonus: { fromScholarship: { politics: 3, intelligence: 2 }, fromBloodline: {}, extraSkills: ['calm'], extraTalents: [] } },
  { childId: 964, childName: '曹肇', fatherId: 189, motherId: 0, birthYear: 215, appearYear: 231, source: 'history', baseStats: { leadership: 50, war: 48, intelligence: 62, politics: 58, charisma: 65 } },
  { childId: 965, childName: '典满', fatherId: 13, motherId: 0, birthYear: 205, appearYear: 221, source: 'history', baseStats: { leadership: 45, war: 72, intelligence: 35, politics: 30, charisma: 45 } },
  { childId: 966, childName: '许仪', fatherId: 100, motherId: 0, birthYear: 218, appearYear: 234, source: 'history', baseStats: { leadership: 42, war: 68, intelligence: 38, politics: 32, charisma: 40 } },
  { childId: 967, childName: '庞会', fatherId: 192, motherId: 0, birthYear: 215, appearYear: 231, source: 'history', baseStats: { leadership: 55, war: 82, intelligence: 45, politics: 35, charisma: 40 } },
  { childId: 968, childName: '徐盖', fatherId: 116, motherId: 0, birthYear: 216, appearYear: 232, source: 'history', baseStats: { leadership: 55, war: 62, intelligence: 48, politics: 45, charisma: 50 } },
  { childId: 969, childName: '张雄', fatherId: 117, motherId: 0, birthYear: 218, appearYear: 234, source: 'history', baseStats: { leadership: 55, war: 60, intelligence: 50, politics: 45, charisma: 48 } },
  { childId: 970, childName: '乐綝', fatherId: 119, motherId: 0, birthYear: 218, appearYear: 234, source: 'history', baseStats: { leadership: 52, war: 65, intelligence: 45, politics: 40, charisma: 45 } },
  { childId: 971, childName: '李祯', fatherId: 102, motherId: 0, birthYear: 215, appearYear: 231, source: 'history', baseStats: { leadership: 50, war: 50, intelligence: 60, politics: 62, charisma: 55 } },
  { childId: 972, childName: '郭奕', fatherId: 125, motherId: 0, birthYear: 206, appearYear: 222, source: 'history', baseStats: { leadership: 40, war: 30, intelligence: 78, politics: 72, charisma: 65 } },
  { childId: 973, childName: '郝凯', fatherId: 223, motherId: 0, birthYear: 228, appearYear: 244, source: 'history', baseStats: { leadership: 50, war: 58, intelligence: 50, politics: 45, charisma: 45 } },
  { childId: 974, childName: '王肃', fatherId: 256, motherId: 0, birthYear: 195, appearYear: 211, source: 'history', baseStats: { leadership: 40, war: 25, intelligence: 85, politics: 82, charisma: 72 } },
  { childId: 975, childName: '曹芳', fatherId: 253, motherId: 0, birthYear: 232, appearYear: 248, source: 'history', baseStats: { leadership: 45, war: 30, intelligence: 58, politics: 62, charisma: 68 } },
  { childId: 976, childName: '司马伦', fatherId: 208, motherId: 262, birthYear: 248, appearYear: 264, source: 'history', baseStats: { leadership: 50, war: 40, intelligence: 55, politics: 60, charisma: 55 } },

  // ── 蜀汉 ─────────────────────────────────────────────────────
  { childId: 977, childName: '刘璿', fatherId: 262, motherId: 0, birthYear: 224, appearYear: 240, source: 'history', baseStats: { leadership: 50, war: 35, intelligence: 60, politics: 62, charisma: 65 } },
  { childId: 978, childName: '赵统', fatherId: 10, motherId: 0, birthYear: 216, appearYear: 232, source: 'history', baseStats: { leadership: 62, war: 75, intelligence: 45, politics: 40, charisma: 55 } },
  { childId: 979, childName: '赵广', fatherId: 10, motherId: 0, birthYear: 222, appearYear: 238, source: 'history', baseStats: { leadership: 55, war: 74, intelligence: 42, politics: 35, charisma: 50 } },
  { childId: 980, childName: '马承', fatherId: 131, motherId: 0, birthYear: 216, appearYear: 232, source: 'history', baseStats: { leadership: 55, war: 72, intelligence: 40, politics: 38, charisma: 50 } },
  { childId: 981, childName: '庞宏', fatherId: 127, motherId: 0, birthYear: 211, appearYear: 227, source: 'history', baseStats: { leadership: 50, war: 40, intelligence: 70, politics: 65, charisma: 55 } },
  { childId: 982, childName: '张绍', fatherId: 7, motherId: 239, birthYear: 212, appearYear: 228, source: 'history', baseStats: { leadership: 45, war: 48, intelligence: 55, politics: 60, charisma: 62 }, motherBonus: { fromScholarship: {}, fromBloodline: { war: 2 }, extraSkills: [], extraTalents: [] } },
  { childId: 983, childName: '关彝', fatherId: 263, motherId: 0, birthYear: 218, appearYear: 234, source: 'history', baseStats: { leadership: 50, war: 65, intelligence: 48, politics: 42, charisma: 55 } },
  { childId: 984, childName: '张遵', fatherId: 264, motherId: 0, birthYear: 216, appearYear: 232, source: 'history', baseStats: { leadership: 55, war: 70, intelligence: 45, politics: 40, charisma: 50 } },
  { childId: 985, childName: '蒋斌', fatherId: 138, motherId: 0, birthYear: 222, appearYear: 238, source: 'history', baseStats: { leadership: 55, war: 50, intelligence: 58, politics: 60, charisma: 55 } },
  { childId: 986, childName: '刘永', fatherId: 2, motherId: 0, birthYear: 210, appearYear: 226, source: 'history', baseStats: { leadership: 55, war: 42, intelligence: 60, politics: 65, charisma: 62 } },

  // ── 孙吴 ─────────────────────────────────────────────────────
  { childId: 987, childName: '孙绍', fatherId: 105, motherId: 205, birthYear: 200, appearYear: 216, source: 'history', baseStats: { leadership: 60, war: 55, intelligence: 60, politics: 55, charisma: 70 }, motherBonus: { fromScholarship: {}, fromBloodline: { charisma: 2 }, extraSkills: ['eloquence'], extraTalents: [] } },
  { childId: 988, childName: '孙和', fatherId: 3, motherId: 251, birthYear: 224, appearYear: 240, source: 'history', baseStats: { leadership: 62, war: 45, intelligence: 78, politics: 75, charisma: 80 }, motherBonus: { fromScholarship: { politics: 2 }, fromBloodline: {}, extraSkills: [], extraTalents: [] } },
  { childId: 989, childName: '孙霸', fatherId: 3, motherId: 0, birthYear: 228, appearYear: 244, source: 'history', baseStats: { leadership: 55, war: 55, intelligence: 60, politics: 55, charisma: 65 } },
  { childId: 990, childName: '周循', fatherId: 11, motherId: 206, birthYear: 200, appearYear: 216, source: 'history', baseStats: { leadership: 62, war: 55, intelligence: 75, politics: 55, charisma: 78 }, motherBonus: { fromScholarship: {}, fromBloodline: { intelligence: 2, charisma: 2 }, extraSkills: ['insight'], extraTalents: [] } },
  { childId: 991, childName: '周胤', fatherId: 11, motherId: 206, birthYear: 205, appearYear: 221, source: 'history', baseStats: { leadership: 50, war: 50, intelligence: 60, politics: 45, charisma: 55 } },
  { childId: 992, childName: '鲁淑', fatherId: 141, motherId: 0, birthYear: 218, appearYear: 234, source: 'history', baseStats: { leadership: 52, war: 45, intelligence: 65, politics: 60, charisma: 55 } },
  { childId: 993, childName: '韩综', fatherId: 145, motherId: 0, birthYear: 210, appearYear: 226, source: 'history', baseStats: { leadership: 50, war: 60, intelligence: 40, politics: 35, charisma: 40 } },
  { childId: 994, childName: '周邵', fatherId: 109, motherId: 0, birthYear: 202, appearYear: 218, source: 'history', baseStats: { leadership: 55, war: 65, intelligence: 45, politics: 40, charisma: 48 } },
  { childId: 995, childName: '步阐', fatherId: 206, motherId: 0, birthYear: 222, appearYear: 238, source: 'history', baseStats: { leadership: 55, war: 50, intelligence: 60, politics: 62, charisma: 50 } },
  { childId: 996, childName: '全怿', fatherId: 244, motherId: 243, birthYear: 215, appearYear: 231, source: 'history', baseStats: { leadership: 55, war: 55, intelligence: 50, politics: 48, charisma: 55 } },
  { childId: 997, childName: '吕据', fatherId: 245, motherId: 0, birthYear: 208, appearYear: 224, source: 'history', baseStats: { leadership: 62, war: 58, intelligence: 55, politics: 50, charisma: 52 } },
  { childId: 998, childName: '孙朗', fatherId: 114, motherId: 0, birthYear: 195, appearYear: 211, source: 'history', baseStats: { leadership: 45, war: 50, intelligence: 45, politics: 40, charisma: 45 } },

  // ── 传说与他支 ───────────────────────────────────────────────
  { childId: 999, childName: '关索', fatherId: 6, motherId: 0, birthYear: 210, appearYear: 226, source: 'folklore', baseStats: { leadership: 58, war: 78, intelligence: 45, politics: 30, charisma: 60 } },
  { childId: 955, childName: '张虎', fatherId: 115, motherId: 0, birthYear: 210, appearYear: 226, source: 'history', baseStats: { leadership: 50, war: 62, intelligence: 45, politics: 40, charisma: 45 } },
  { childId: 957, childName: '邓忠', fatherId: 209, motherId: 0, birthYear: 232, appearYear: 248, source: 'history', baseStats: { leadership: 55, war: 72, intelligence: 55, politics: 40, charisma: 45 } },
  { childId: 960, childName: '袁尚', fatherId: 113, motherId: 0, birthYear: 178, appearYear: 194, source: 'history', baseStats: { leadership: 55, war: 55, intelligence: 65, politics: 50, charisma: 68 } },
];

// ── 校验与合并 ─────────────────────────────────────────────────
const officers = JSON.parse(readFileSync(officersFile, 'utf-8'));
const females = JSON.parse(readFileSync(femalesFile, 'utf-8'));
const skills = JSON.parse(readFileSync(skillsFile, 'utf-8'));
const officerById = new Map(officers.map((o) => [o.id, o]));
const officerNames = new Set(officers.map((o) => o.name));
const femaleIds = new Set(females.map((f) => f.id));
const skillKeys = new Set(skills.map((s) => s.id));
const STAT_KEYS = ['leadership', 'war', 'intelligence', 'politics', 'charisma'];

const existing = JSON.parse(readFileSync(FILE, 'utf-8'));
// 幂等：剥掉上一轮生成的 955+ 段，只保留 0-A 基线段（950~954）
const genIds = new Set(NEW_CHILDREN.map((c) => c.childId));
const base = existing.filter((c) => !genIds.has(c.childId));
const baseIds = new Set(base.map((c) => c.childId));
if (baseIds.size !== base.length) throw new Error('base children has duplicate childIds');

const seenIds = new Set();
const seenNames = new Set(base.map((c) => c.childName));
for (const c of NEW_CHILDREN) {
  if (baseIds.has(c.childId)) throw new Error(`childId ${c.childId} already exists in 0-A base`);
  if (seenIds.has(c.childId)) throw new Error(`duplicate generated childId ${c.childId}`);
  if (seenNames.has(c.childName)) throw new Error(`duplicate childName ${c.childName} (id ${c.childId})`);
  if (officerById.has(c.childId)) throw new Error(`childId ${c.childId} collides with officer id`);
  if (officerNames.has(c.childName)) throw new Error(`childName ${c.childName} already in officers.json (would duplicate static officer)`);
  if (!officerById.has(c.fatherId)) throw new Error(`childId ${c.childId} fatherId ${c.fatherId} not in officers.json`);
  if (c.motherId !== 0 && !femaleIds.has(c.motherId)) throw new Error(`childId ${c.childId} motherId ${c.motherId} not in females.json`);
  if (c.appearYear !== c.birthYear + 16) throw new Error(`childId ${c.childId} appearYear must be birthYear+16`);
  if (!['history', 'romance', 'folklore'].includes(c.source)) throw new Error(`childId ${c.childId} invalid source`);
  for (const key of STAT_KEYS) {
    const v = c.baseStats[key];
    if (typeof v !== 'number' || v < 1 || v > 100) throw new Error(`childId ${c.childId} baseStats.${key} out of range`);
  }
  for (const s of c.motherBonus?.extraSkills ?? []) {
    if (!skillKeys.has(s)) throw new Error(`childId ${c.childId} extraSkills ${s} not in skills.json`);
  }
  if (c.motherBonus && c.motherId === 0) throw new Error(`childId ${c.childId} motherBonus set but motherId is 0`);
  seenIds.add(c.childId);
  seenNames.add(c.childName);
}

const merged = [...base, ...NEW_CHILDREN].sort((a, b) => a.childId - b.childId);
if (merged.length !== 50) throw new Error(`expected 50 children (0-A 5 + 0-B 45, meets docs/08 floor 50+), got ${merged.length}`);
writeFileSync(FILE, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`children.json written: ${merged.length} records (added ${NEW_CHILDREN.length}, ids 955~999)`);
