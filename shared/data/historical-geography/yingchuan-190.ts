// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { buildHistoricalGeographyBundle, type CommanderySeed } from './seed-schema.js';
import type { HistoricalGeographyBundle, HistoricalSource } from './schema.js';

const YEAR = 190;
const COMMANDERY = 'yu_yingchuan_190';
const SOURCE = 'hhs_junguozhi_yingchuan';

const sources: HistoricalSource[] = [
  {
    id: SOURCE,
    title: '《后汉书》',
    author: '范晔撰；司马彪《续汉书》志',
    volume: '卷一百一十（志第二十·郡国二）',
    entry: '豫州刺史部·颍川郡',
    edition: '维基文库公开文本；与中国哲学书电子化计划原典入口交叉核对',
    url: 'https://zh.wikisource.org/wiki/後漢書/卷110',
    accessedAt: '2026-07-30',
    note: '载颍川郡十七城及阳翟、襄、襄城、昆阳、定陵、舞阳、郾、临颍、颍阳、颍阴、许、新汲、焉陵、长社、阳城、父城、轮氏。',
  },
];

/**
 * BF-P4 颍川郡 190 年对照切片。
 *
 * 十七县名据《后汉书·郡国二》。归一化坐标与道路是服务战场可读性的人工相对布局，
 * 不主张精确古城址或汉代道路测绘；因此县位置与路线置信度均标 approximate/inferred。
 */
const seed: CommanderySeed = {
  id: COMMANDERY,
  name: '颍川郡',
  province: '豫州',
  seatCountyId: 'yingchuan_yangdi',
  worldCityId: 3,
  scenarioYear: YEAR,
  sourceRefs: [SOURCE],
  defaultCountyLocationNote: '县名与隶属有原典明文；坐标仅为颍川郡域战场的人工相对布局。',
  counties: [
    { id: 'yingchuan_yangdi', name: '阳翟', role: 'seat', x: .43, y: .34, terrain: ['plain', 'hill', 'river'], adjacent: ['yingchuan_yangcheng', 'yingchuan_yingyang', 'yingchuan_lunshi', 'yingchuan_changshe', 'yingchuan_xinji'], landmarks: ['yingchuan_juntai'] },
    { id: 'yingchuan_xiang', name: '襄', x: .15, y: .55, adjacent: ['yingchuan_xiangcheng', 'yingchuan_fucheng'] },
    { id: 'yingchuan_xiangcheng', name: '襄城', x: .25, y: .65, terrain: ['plain', 'hill'], adjacent: ['yingchuan_xiang', 'yingchuan_fucheng', 'yingchuan_kunyang', 'yingchuan_wuyang'], landmarks: ['yingchuan_yuchi_mountain'] },
    { id: 'yingchuan_kunyang', name: '昆阳', x: .37, y: .78, terrain: ['plain', 'river'], adjacent: ['yingchuan_xiangcheng', 'yingchuan_dingling', 'yingchuan_wuyang'] },
    { id: 'yingchuan_dingling', name: '定陵', x: .49, y: .76, terrain: ['plain', 'river'], adjacent: ['yingchuan_kunyang', 'yingchuan_wuyang', 'yingchuan_yan', 'yingchuan_linying'] },
    { id: 'yingchuan_wuyang', name: '舞阳', x: .35, y: .9, adjacent: ['yingchuan_xiangcheng', 'yingchuan_kunyang', 'yingchuan_dingling', 'yingchuan_yan'] },
    { id: 'yingchuan_yan', name: '郾', x: .57, y: .88, adjacent: ['yingchuan_wuyang', 'yingchuan_dingling', 'yingchuan_linying'] },
    { id: 'yingchuan_linying', name: '临颍', x: .63, y: .7, terrain: ['plain', 'river'], adjacent: ['yingchuan_dingling', 'yingchuan_yan', 'yingchuan_yingyin', 'yingchuan_xu'] },
    { id: 'yingchuan_yingyang', name: '颍阳', x: .25, y: .25, terrain: ['hill', 'river'], adjacent: ['yingchuan_yangcheng', 'yingchuan_fucheng', 'yingchuan_yangdi'] },
    { id: 'yingchuan_yingyin', name: '颍阴', x: .57, y: .54, terrain: ['plain', 'river'], adjacent: ['yingchuan_linying', 'yingchuan_changshe', 'yingchuan_xu'] },
    { id: 'yingchuan_xu', name: '许', x: .75, y: .58, adjacent: ['yingchuan_linying', 'yingchuan_yingyin', 'yingchuan_yanling', 'yingchuan_changshe'], landmarks: ['yingchuan_ying_water'] },
    { id: 'yingchuan_xinji', name: '新汲', x: .69, y: .31, terrain: ['plain', 'river'], adjacent: ['yingchuan_yangdi', 'yingchuan_changshe', 'yingchuan_yanling'] },
    { id: 'yingchuan_yanling', name: '焉陵', x: .87, y: .38, adjacent: ['yingchuan_xinji', 'yingchuan_changshe', 'yingchuan_xu'] },
    { id: 'yingchuan_changshe', name: '长社', x: .64, y: .44, adjacent: ['yingchuan_yangdi', 'yingchuan_xinji', 'yingchuan_yanling', 'yingchuan_xu', 'yingchuan_yingyin'] },
    { id: 'yingchuan_yangcheng', name: '阳城', x: .31, y: .1, terrain: ['mountain', 'hill', 'forest', 'river'], adjacent: ['yingchuan_lunshi', 'yingchuan_yangdi', 'yingchuan_yingyang'], landmarks: ['yingchuan_songgao'] },
    { id: 'yingchuan_fucheng', name: '父城', x: .12, y: .72, terrain: ['plain', 'hill'], adjacent: ['yingchuan_xiang', 'yingchuan_xiangcheng', 'yingchuan_yingyang'] },
    { id: 'yingchuan_lunshi', name: '轮氏', x: .46, y: .12, terrain: ['hill', 'forest'], adjacent: ['yingchuan_yangcheng', 'yingchuan_yangdi'] },
  ],
  landmarks: [
    { id: 'yingchuan_juntai', name: '钧台', kind: 'pass', geometry: { type: 'point', x: .42, y: .36 }, tacticalTags: ['seat_front', 'duel_ground'] },
    { id: 'yingchuan_yuchi_mountain', name: '鱼齿山', kind: 'mountain', geometry: { type: 'point', x: .23, y: .68 }, tacticalTags: ['high_ground'] },
    { id: 'yingchuan_ying_water', name: '颍水', kind: 'river', geometry: { type: 'point', x: .61, y: .5 }, tacticalTags: ['river_crossing'] },
    { id: 'yingchuan_songgao', name: '嵩高山', kind: 'mountain', geometry: { type: 'point', x: .28, y: .07 }, tacticalTags: ['mountain_frontier'] },
  ],
  // 颍川是纯陆路郡，不提供显式 routes，由构建器从 adjacent 自动派生。
  routes: [],
};

export const yingchuan190: HistoricalGeographyBundle = buildHistoricalGeographyBundle(seed, sources);
