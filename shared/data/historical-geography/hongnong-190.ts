// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { buildHistoricalGeographyBundle, type CommanderySeed } from './seed-schema.js';
import type { HistoricalGeographyBundle, HistoricalSource } from './schema.js';

const HHS = 'hhs_junguozhi_hongnong';
const SJZ_HE = 'shuijingzhu_he_hongnong';
const SJZ_LUO = 'shuijingzhu_luo_hongnong';
const ZZTJ_190 = 'zizhitongjian_190_hangu';

const sources: HistoricalSource[] = [
  {
    id: HHS,
    title: '《后汉书》',
    author: '范晔撰；司马彪《续汉书》志',
    volume: '卷一百零九（志第十九·郡国一）',
    entry: '司隶校尉部·弘农郡',
    edition: '维基文库公开文本',
    url: 'https://zh.wikisource.org/zh-hant/%E5%BE%8C%E6%BC%A2%E6%9B%B8/%E5%8D%B7109',
    accessedAt: '2026-08-01',
    note: '弘农郡九城、治弘农及崤山、谷水、涧水、熊耳山、伊水等附注的行政真源。',
  },
  {
    id: SJZ_HE,
    title: '《水经注》',
    author: '郦道元',
    volume: '卷四',
    entry: '河水·华阴—桃林—弘农—陕县河段',
    edition: '维基文库四库全书本公开文本',
    url: 'https://zh.wikisource.org/zh-hans/%E6%B0%B4%E7%B6%93%E6%B3%A8%E9%87%8B_(%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC)/%E5%8D%B704',
    accessedAt: '2026-08-01',
    note: '用于河水、华山、桃林与崤函通道的相对轴线；不据后世记载反推 190 年潼关关城。',
  },
  {
    id: SJZ_LUO,
    title: '《水经注》',
    author: '郦道元',
    volume: '卷十五',
    entry: '洛水·伊水、谷水、涧水上游',
    edition: '维基文库公开文本',
    url: 'https://zh.wikisource.org/zh-hant/%E6%B0%B4%E7%B6%93%E6%B3%A8/15',
    accessedAt: '2026-08-01',
    note: '用于卢氏—陆浑—宜阳及黾池—新安水系骨架；几何均为相对表达。',
  },
  {
    id: ZZTJ_190,
    title: '《资治通鉴》',
    author: '司马光',
    volume: '卷五十九',
    entry: '汉纪五十一·初平元年',
    edition: '维基文库公开文本',
    url: 'https://zh.wikisource.org/zh/%E8%B3%87%E6%B2%BB%E9%80%9A%E9%91%91/%E5%8D%B7059',
    accessedAt: '2026-08-01',
    note: '用于 190 年董卓迁都与洛阳—函谷—长安战略背景，不据此虚构具体县际交战。',
  },
];

/** BF-P5 第六郡：弘农郡 190 年切片。坐标与自动道路为战场相对拓扑。 */
const seed: CommanderySeed = {
  id: 'sili_hongnong_190',
  name: '弘农郡',
  province: '司隶',
  seatCountyId: 'hongnong_hongnong',
  // 0-A 30 城没有弘农治所；暂借长安大地图节点承载进场与守方归属，不表示行政合并。
  worldCityId: 2,
  scenarioYear: 190,
  sourceRefs: [HHS, SJZ_HE, SJZ_LUO, ZZTJ_190],
  defaultCountyLocationNote: '县名与隶属据《后汉书·郡国志》；坐标仅为弘农郡战场人工相对布局。',
  counties: [
    { id: 'hongnong_hongnong', name: '弘农', role: 'seat', x: .38, y: .4, terrain: ['hill', 'river'], adjacent: ['hongnong_hu', 'hongnong_shan', 'hongnong_mianchi'], landmarks: ['hongnong_yellow_river', 'hongnong_hangu'], confidence: 'approximate' },
    { id: 'hongnong_shan', name: '陕', x: .58, y: .38, terrain: ['hill', 'river'], adjacent: ['hongnong_hongnong', 'hongnong_hu', 'hongnong_mianchi'], landmarks: ['hongnong_yellow_river', 'hongnong_xiao'], confidence: 'approximate' },
    { id: 'hongnong_mianchi', name: '黾池', role: 'frontier', x: .7, y: .32, terrain: ['hill', 'river'], adjacent: ['hongnong_hongnong', 'hongnong_shan', 'hongnong_xinan', 'hongnong_lushi'], landmarks: ['hongnong_gu_water', 'hongnong_xiao'], confidence: 'approximate' },
    { id: 'hongnong_xinan', name: '新安', role: 'frontier', x: .87, y: .36, terrain: ['hill', 'river'], adjacent: ['hongnong_mianchi', 'hongnong_yiyang'], landmarks: ['hongnong_jian_water', 'hongnong_hangu_east'], confidence: 'approximate' },
    { id: 'hongnong_yiyang', name: '宜阳', role: 'frontier', x: .82, y: .59, terrain: ['hill', 'river'], adjacent: ['hongnong_xinan', 'hongnong_luhun', 'hongnong_lushi'], landmarks: ['hongnong_luo_water'], confidence: 'approximate' },
    { id: 'hongnong_luhun', name: '陆浑', role: 'frontier', x: .7, y: .76, terrain: ['mountain', 'river'], adjacent: ['hongnong_yiyang', 'hongnong_lushi'], landmarks: ['hongnong_luo_water', 'hongnong_xiong_er'], confidence: 'approximate' },
    { id: 'hongnong_lushi', name: '卢氏', role: 'frontier', x: .48, y: .75, terrain: ['mountain', 'forest', 'river'], adjacent: ['hongnong_mianchi', 'hongnong_yiyang', 'hongnong_luhun'], landmarks: ['hongnong_yi_water', 'hongnong_xiong_er'], confidence: 'approximate' },
    { id: 'hongnong_hu', name: '湖', x: .22, y: .34, terrain: ['hill', 'river'], adjacent: ['hongnong_huayin', 'hongnong_hongnong', 'hongnong_shan'], landmarks: ['hongnong_yellow_river', 'hongnong_taolin'], confidence: 'approximate' },
    { id: 'hongnong_huayin', name: '华阴', role: 'frontier', x: .08, y: .3, terrain: ['mountain', 'river'], adjacent: ['hongnong_hu'], landmarks: ['hongnong_yellow_river', 'hongnong_hua_mountain', 'hongnong_taolin'], confidence: 'approximate' },
  ],
  landmarks: [
    { id: 'hongnong_yellow_river', name: '河水', kind: 'river', geometry: { type: 'polyline', points: [[.02, .17], [.23, .22], [.47, .25], [.72, .2], [.98, .17]] }, tacticalTags: ['northern_boundary', 'west_east_waterway'], confidence: 'approximate', sourceRefs: [HHS, SJZ_HE] },
    { id: 'hongnong_hua_mountain', name: '华山', kind: 'mountain', geometry: { type: 'polygon', points: [[.02, .34], [.14, .3], [.19, .48], [.08, .55]] }, tacticalTags: ['western_barrier', 'high_ground'], confidence: 'attested', sourceRefs: [HHS, SJZ_HE] },
    { id: 'hongnong_taolin', name: '桃林塞', kind: 'pass', geometry: { type: 'point', x: .18, y: .29 }, tacticalTags: ['western_gate', 'chokepoint'], confidence: 'approximate', locationNote: '桃林范围宽广，此处仅作华阴—湖之间的战场通道锚点。', sourceRefs: [HHS, SJZ_HE] },
    { id: 'hongnong_hangu', name: '秦函谷关', kind: 'pass', geometry: { type: 'point', x: .36, y: .34 }, tacticalTags: ['inner_pass', 'chokepoint'], confidence: 'attested', sourceRefs: [HHS, SJZ_HE] },
    { id: 'hongnong_xiao', name: '二崤', kind: 'mountain', geometry: { type: 'polygon', points: [[.52, .43], [.74, .38], [.8, .52], [.59, .58]] }, tacticalTags: ['eastern_barrier', 'narrow_road'], confidence: 'approximate', sourceRefs: [HHS, SJZ_HE] },
    { id: 'hongnong_hangu_east', name: '汉函谷关', kind: 'pass', geometry: { type: 'point', x: .9, y: .31 }, tacticalTags: ['luoyang_west_gate', 'chokepoint'], confidence: 'attested', sourceRefs: [HHS, ZZTJ_190] },
    { id: 'hongnong_gu_water', name: '谷水', kind: 'river', geometry: { type: 'polyline', points: [[.62, .28], [.72, .32], [.91, .27]] }, tacticalTags: ['eastern_waterway'], confidence: 'approximate', sourceRefs: [HHS, SJZ_LUO] },
    { id: 'hongnong_jian_water', name: '涧水', kind: 'river', geometry: { type: 'polyline', points: [[.81, .41], [.87, .36], [.98, .4]] }, tacticalTags: ['eastern_waterway'], confidence: 'approximate', sourceRefs: [HHS, SJZ_LUO] },
    { id: 'hongnong_luo_water', name: '雒水', kind: 'river', geometry: { type: 'polyline', points: [[.42, .82], [.65, .72], [.82, .59], [.98, .55]] }, tacticalTags: ['southern_waterway'], confidence: 'approximate', sourceRefs: [HHS, SJZ_LUO] },
    { id: 'hongnong_yi_water', name: '伊水·熊耳门', kind: 'pass', geometry: { type: 'point', x: .46, y: .71 }, tacticalTags: ['southern_gate', 'river_source'], confidence: 'approximate', locationNote: '以卢氏熊耳门及伊水源合并为战场尺度关口锚点。', sourceRefs: [HHS, SJZ_LUO] },
    { id: 'hongnong_xiong_er', name: '熊耳山', kind: 'mountain', geometry: { type: 'polygon', points: [[.38, .66], [.62, .66], [.7, .86], [.43, .91]] }, tacticalTags: ['southern_barrier', 'high_ground'], confidence: 'approximate', sourceRefs: [HHS, SJZ_LUO] },
  ],
  routes: [
    { id: 'route_huayin_taolin', from: 'hongnong_huayin', to: 'hongnong_taolin', kind: 'pass', movementCost: 1.3, confidence: 'approximate', sourceRefs: [HHS, SJZ_HE] },
    { id: 'route_hongnong_hangu', from: 'hongnong_hongnong', to: 'hongnong_hangu', kind: 'pass', movementCost: 1.2, confidence: 'attested', sourceRefs: [HHS, SJZ_HE] },
    { id: 'route_shan_xiao', from: 'hongnong_shan', to: 'hongnong_xiao', kind: 'pass', movementCost: 1.4, confidence: 'approximate', sourceRefs: [HHS, SJZ_HE] },
    { id: 'route_xinan_hangu_east', from: 'hongnong_xinan', to: 'hongnong_hangu_east', kind: 'pass', movementCost: 1.2, confidence: 'attested', sourceRefs: [HHS, ZZTJ_190] },
    { id: 'route_lushi_yi', from: 'hongnong_lushi', to: 'hongnong_yi_water', kind: 'pass', movementCost: 1.3, confidence: 'approximate', sourceRefs: [HHS, SJZ_LUO] },
  ],
  autoFillRoads: true,
};

export const hongnong190: HistoricalGeographyBundle = buildHistoricalGeographyBundle(seed, sources);
