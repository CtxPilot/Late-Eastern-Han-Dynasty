// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { buildHistoricalGeographyBundle, type CommanderySeed } from './seed-schema.js';
import type { HistoricalGeographyBundle, HistoricalSource } from './schema.js';

const HHS = 'hhs_junguozhi_henan';
const SJZ_LUO = 'shuijingzhu_luo_henan';
const SGZ_XINGYANG = 'sgz_cao_xingyang_190';

const sources: HistoricalSource[] = [
  {
    id: HHS,
    title: '《后汉书》',
    author: '范晔撰；司马彪《续汉书》志',
    volume: '卷一百零九（志第十九·郡国一）',
    entry: '司隶校尉部·河南尹',
    edition: '维基文库公开文本；与中国哲学书电子化计划条目交叉核对',
    url: 'https://zh.wikisource.org/wiki/%E5%BE%8C%E6%BC%A2%E6%9B%B8/%E5%8D%B7109',
    accessedAt: '2026-08-01',
    note: '河南尹二十一城、雒阳治所及关渡山水附注的行政真源。',
  },
  {
    id: SJZ_LUO,
    title: '《水经注》',
    author: '郦道元',
    volume: '卷十六',
    entry: '谷水、洛水、伊水及洛阳周边水系',
    edition: '维基文库四库全书本公开文本',
    url: 'https://zh.wikisource.org/wiki/%E6%B0%B4%E7%B6%93%E6%B3%A8_(%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC)/%E5%8D%B716',
    accessedAt: '2026-08-01',
    note: '用于谷水—洛水东西轴、伊水汇流与函谷故关方位；几何仅表达相对拓扑。',
  },
  {
    id: SGZ_XINGYANG,
    title: '《三国志》',
    author: '陈寿撰、裴松之注',
    volume: '卷一·魏书一',
    entry: '武帝纪·初平元年荥阳汴水之战',
    edition: '维基文库公开文本',
    url: 'https://zh.wikisource.org/wiki/%E4%B8%89%E5%9C%8B%E5%BF%97/%E5%8D%B701',
    accessedAt: '2026-08-01',
    note: '支撑酸枣向西经荥阳、成皋进入洛阳盆地的 190 年军事入口。',
  },
];

/** BF-P5 第四郡：河南尹 190 年切片。坐标与道路为相对拓扑，不主张精确古道测绘。 */
const seed: CommanderySeed = {
  id: 'sili_henan_190',
  name: '河南尹',
  province: '司隶',
  seatCountyId: 'henan_luoyang',
  worldCityId: 1,
  scenarioYear: 190,
  sourceRefs: [HHS, SJZ_LUO, SGZ_XINGYANG],
  defaultCountyLocationNote: '县名与隶属有《后汉书·郡国志》明文；坐标仅为河南尹战场的人工相对布局。',
  counties: [
    { id: 'henan_luoyang', name: '雒阳', role: 'seat', x: .34, y: .45, terrain: ['plain', 'river'], adjacent: ['henan_henan', 'henan_gucheng', 'henan_yanshi', 'henan_pingyin'], landmarks: ['henan_luo_water', 'henan_gu_water'], confidence: 'approximate' },
    { id: 'henan_henan', name: '河南', x: .25, y: .51, terrain: ['plain', 'river'], adjacent: ['henan_luoyang', 'henan_xincheng', 'henan_gucheng', 'henan_ping'], landmarks: ['henan_luo_water', 'henan_jian_water'], confidence: 'approximate' },
    { id: 'henan_liang', name: '梁', role: 'frontier', x: .29, y: .9, terrain: ['hill', 'mountain', 'river'], adjacent: ['henan_xincheng', 'henan_ping'], confidence: 'approximate' },
    { id: 'henan_xingyang', name: '荥阳', role: 'frontier', x: .67, y: .34, terrain: ['plain', 'river'], adjacent: ['henan_chenggao', 'henan_jing', 'henan_zhongmou', 'henan_yangwu'], landmarks: ['henan_bian_water'], confidence: 'approximate' },
    { id: 'henan_juan', name: '卷', role: 'frontier', x: .7, y: .08, terrain: ['plain', 'river'], adjacent: ['henan_yuanwu', 'henan_yangwu'], landmarks: ['henan_yellow_river'], confidence: 'approximate' },
    { id: 'henan_yuanwu', name: '原武', role: 'frontier', x: .79, y: .14, terrain: ['plain', 'river'], adjacent: ['henan_juan', 'henan_yangwu', 'henan_zhongmou'], landmarks: ['henan_yellow_river'], confidence: 'approximate' },
    { id: 'henan_yangwu', name: '阳武', role: 'frontier', x: .75, y: .27, terrain: ['plain', 'river'], adjacent: ['henan_juan', 'henan_yuanwu', 'henan_xingyang', 'henan_zhongmou'], confidence: 'approximate' },
    { id: 'henan_zhongmou', name: '中牟', role: 'frontier', x: .82, y: .4, terrain: ['plain', 'marsh', 'river'], adjacent: ['henan_xingyang', 'henan_yangwu', 'henan_yuanwu', 'henan_kaifeng', 'henan_yuanling'], landmarks: ['henan_pu_tian_marsh'], confidence: 'approximate' },
    { id: 'henan_kaifeng', name: '开封', role: 'frontier', x: .94, y: .45, terrain: ['plain', 'river'], adjacent: ['henan_zhongmou', 'henan_yuanling'], confidence: 'approximate' },
    { id: 'henan_yuanling', name: '苑陵', role: 'frontier', x: .88, y: .56, terrain: ['plain'], adjacent: ['henan_zhongmou', 'henan_kaifeng', 'henan_xinzheng'], confidence: 'inferred' },
    { id: 'henan_pingyin', name: '平阴', x: .45, y: .25, terrain: ['plain', 'river'], adjacent: ['henan_luoyang', 'henan_yanshi', 'henan_gong'], landmarks: ['henan_yellow_river'], confidence: 'approximate' },
    { id: 'henan_gucheng', name: '谷城', x: .2, y: .39, terrain: ['plain', 'river'], adjacent: ['henan_luoyang', 'henan_henan', 'henan_xincheng'], landmarks: ['henan_gu_water'], confidence: 'approximate' },
    { id: 'henan_goushi', name: '缑氏', x: .43, y: .61, terrain: ['plain', 'hill', 'river'], adjacent: ['henan_yanshi', 'henan_gong', 'henan_ping', 'henan_mi'], landmarks: ['henan_luo_water'], confidence: 'approximate' },
    { id: 'henan_gong', name: '巩', x: .53, y: .43, terrain: ['plain', 'hill', 'river'], adjacent: ['henan_pingyin', 'henan_yanshi', 'henan_goushi', 'henan_chenggao'], landmarks: ['henan_luo_water'], confidence: 'approximate' },
    { id: 'henan_chenggao', name: '成皋', role: 'frontier', x: .6, y: .34, terrain: ['hill', 'mountain', 'river'], adjacent: ['henan_gong', 'henan_xingyang', 'henan_jing'], landmarks: ['henan_hulao'], confidence: 'approximate' },
    { id: 'henan_jing', name: '京', x: .66, y: .51, terrain: ['plain', 'hill'], adjacent: ['henan_chenggao', 'henan_xingyang', 'henan_mi', 'henan_xinzheng'], confidence: 'approximate' },
    { id: 'henan_mi', name: '密', x: .61, y: .64, terrain: ['hill', 'forest'], adjacent: ['henan_jing', 'henan_xinzheng', 'henan_goushi', 'henan_ping'], confidence: 'approximate' },
    { id: 'henan_xincheng', name: '新城', role: 'frontier', x: .15, y: .65, terrain: ['hill', 'mountain', 'river'], adjacent: ['henan_henan', 'henan_gucheng', 'henan_liang', 'henan_ping'], landmarks: ['henan_hangu_pass'], confidence: 'approximate' },
    { id: 'henan_yanshi', name: '偃师', x: .43, y: .45, terrain: ['plain', 'river'], adjacent: ['henan_luoyang', 'henan_pingyin', 'henan_gong', 'henan_goushi'], landmarks: ['henan_luo_water'], confidence: 'approximate' },
    { id: 'henan_xinzheng', name: '新郑', role: 'frontier', x: .72, y: .7, terrain: ['plain', 'river'], adjacent: ['henan_jing', 'henan_mi', 'henan_yuanling', 'henan_ping'], confidence: 'approximate' },
    { id: 'henan_ping', name: '平', x: .46, y: .78, terrain: ['hill', 'river'], adjacent: ['henan_henan', 'henan_liang', 'henan_xincheng', 'henan_goushi', 'henan_mi', 'henan_xinzheng'], landmarks: ['henan_yi_water', 'henan_song_mountain'], confidence: 'inferred' },
  ],
  landmarks: [
    { id: 'henan_yellow_river', name: '河水', kind: 'river', geometry: { type: 'polyline', points: [[.38, .17], [.56, .13], [.76, .09], [.98, .12]] }, tacticalTags: ['northern_boundary', 'ferry_front'], confidence: 'approximate', locationNote: '只表达河南尹北缘的黄河战略边界，不表达 190 年精确河道。', sourceRefs: [HHS] },
    { id: 'henan_luo_water', name: '洛水', kind: 'river', geometry: { type: 'polyline', points: [[.1, .7], [.25, .55], [.34, .48], [.52, .44], [.63, .35]] }, tacticalTags: ['capital_waterway', 'east_west_axis'], confidence: 'approximate', sourceRefs: [SJZ_LUO] },
    { id: 'henan_gu_water', name: '谷水', kind: 'river', geometry: { type: 'polyline', points: [[.1, .48], [.2, .4], [.34, .45]] }, tacticalTags: ['western_approach', 'capital_canal'], confidence: 'approximate', sourceRefs: [SJZ_LUO] },
    { id: 'henan_jian_water', name: '涧水', kind: 'river', geometry: { type: 'polyline', points: [[.08, .56], [.18, .53], [.25, .51]] }, tacticalTags: ['western_approach'], confidence: 'approximate', sourceRefs: [SJZ_LUO] },
    { id: 'henan_yi_water', name: '伊水', kind: 'river', geometry: { type: 'polyline', points: [[.38, .96], [.44, .76], [.43, .61], [.39, .52]] }, tacticalTags: ['southern_waterway', 'river_crossing'], confidence: 'approximate', sourceRefs: [SJZ_LUO] },
    { id: 'henan_bian_water', name: '汴水', kind: 'river', geometry: { type: 'polyline', points: [[.61, .35], [.68, .35], [.83, .42], [.98, .46]] }, tacticalTags: ['coalition_route', 'east_west_waterway'], confidence: 'approximate', sourceRefs: [SGZ_XINGYANG] },
    { id: 'henan_hulao', name: '虎牢', kind: 'pass', geometry: { type: 'point', x: .6, y: .33 }, tacticalTags: ['eastern_gate', 'chokepoint'], confidence: 'attested', sourceRefs: [HHS] },
    { id: 'henan_hangu_pass', name: '函谷故关', kind: 'pass', geometry: { type: 'point', x: .12, y: .61 }, tacticalTags: ['western_gate', 'chokepoint'], confidence: 'approximate', locationNote: '作为洛阳西向战略出口的相对标记；不与新安县内的具体关城坐标等同。', sourceRefs: [SJZ_LUO] },
    { id: 'henan_song_mountain', name: '嵩高山', kind: 'mountain', geometry: { type: 'polygon', points: [[.48, .76], [.58, .72], [.64, .83], [.55, .92], [.46, .86]] }, tacticalTags: ['southern_barrier', 'high_ground'], confidence: 'approximate', sourceRefs: [HHS] },
    { id: 'henan_pu_tian_marsh', name: '圃田泽', kind: 'marsh', geometry: { type: 'polygon', points: [[.77, .37], [.88, .36], [.91, .46], [.81, .49]] }, tacticalTags: ['wetland', 'eastern_screen'], confidence: 'approximate', sourceRefs: [HHS] },
  ],
  routes: [
    { id: 'route_bian_xingyang_zhongmou', from: 'henan_xingyang', to: 'henan_zhongmou', kind: 'river', movementCost: .9, confidence: 'approximate', sourceRefs: [SGZ_XINGYANG] },
    { id: 'route_luo_luoyang_yanshi', from: 'henan_luoyang', to: 'henan_yanshi', kind: 'river', movementCost: .8, confidence: 'approximate', sourceRefs: [SJZ_LUO] },
    { id: 'route_luo_yanshi_gong', from: 'henan_yanshi', to: 'henan_gong', kind: 'river', movementCost: .8, confidence: 'approximate', sourceRefs: [SJZ_LUO] },
    { id: 'route_chenggao_hulao', from: 'henan_chenggao', to: 'henan_hulao', kind: 'pass', movementCost: 1.3, confidence: 'attested', sourceRefs: [HHS] },
    { id: 'route_xincheng_hangu', from: 'henan_xincheng', to: 'henan_hangu_pass', kind: 'pass', movementCost: 1.4, confidence: 'approximate', sourceRefs: [SJZ_LUO] },
  ],
  autoFillRoads: true,
};

export const henan190: HistoricalGeographyBundle = buildHistoricalGeographyBundle(seed, sources);
