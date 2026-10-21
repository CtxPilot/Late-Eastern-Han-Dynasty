// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const itemsPath = path.resolve(__dirname, '../server/src/data/items.json');
const raw = fs.readFileSync(itemsPath, 'utf8');
const items = JSON.parse(raw);

/**
 * 十大经典史实/演义套装配置
 */
const SET_MAPPINGS = [
  { id: 1, name: '威震华夏', items: [1, 10, 117] },
  { id: 2, name: '天下无双', items: [2, 67, 73, 10] },
  { id: 3, name: '魏武雄风', items: [4, 12, 14, 123] },
  { id: 4, name: '昭烈仁德', items: [5, 11, 115] },
  { id: 5, name: '卧龙天机', items: [7, 13, 126, 127] },
  { id: 6, name: '常胜龙胆', items: [46, 68, 6] },
  { id: 7, name: '江东霸业', items: [22, 128, 51] },
  { id: 8, name: '万人莫敌', items: [3, 66, 79] },
  { id: 9, name: '锦马银枪', items: [47, 75, 70] },
  { id: 10, name: '社稷正朔', items: [15, 18, 120] },
];

const itemSetsMap = new Map();
for (const set of SET_MAPPINGS) {
  for (const itemId of set.items) {
    const list = itemSetsMap.get(itemId) ?? [];
    if (!list.includes(set.id)) {
      list.push(set.id);
    }
    itemSetsMap.set(itemId, list);
  }
}

let modifiedCount = 0;
for (const it of items) {
  if (itemSetsMap.has(it.id)) {
    it.sets = itemSetsMap.get(it.id);
    modifiedCount++;
  } else if (it.sets && it.sets.length === 0) {
    delete it.sets;
  }
}

fs.writeFileSync(itemsPath, JSON.stringify(items, null, 2) + '\n', 'utf8');
console.log(`Updated items.json: ${modifiedCount} items assigned to sets. Total items: ${items.length}`);
