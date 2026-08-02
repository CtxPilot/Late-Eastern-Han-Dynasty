// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { buildHistoricalGeographyBundle, type CommanderySeed } from './seed-schema.js';
import type { HistoricalGeographyBundle, HistoricalSource } from './schema.js';

const HHS = 'hhs_junguozhi_chenliu';
const SJZ = 'shuijingzhu_chenliu';
const SGZ = 'sgz_cao_xingbing_chenliu';

const sources: HistoricalSource[] = [
  { id: HHS, title: '《后汉书》', author: '范晔撰；司马彪《续汉书》志', volume: '卷一百一十一（志第二十一·郡国三）', entry: '兖州刺史部·陈留郡', edition: '维基文库公开文本；用户提供的历史地理整理稿交叉核对', url: 'https://zh.wikisource.org/wiki/%E5%BE%8C%E6%BC%A2%E6%9B%B8/%E5%8D%B7111', accessedAt: '2026-08-01', note: '陈留郡十七县、郡治及津渡亭障的行政真源。' },
  { id: SJZ, title: '《水经注》', author: '郦道元', volume: '济水、汴水、睢水诸篇', entry: '陈留郡河渠交通', edition: '维基文库公开文本；用户整理稿引文索引', url: 'https://zh.wikisource.org/wiki/%E6%B0%B4%E7%B6%93%E6%B3%A8', accessedAt: '2026-08-01', note: '用于三条水路主轴及河渠地标；具体几何仅作相对示意。' },
  { id: SGZ, title: '《三国志》', author: '陈寿撰、裴松之注', volume: '卷一·魏书一', entry: '武帝纪·初平元年陈留起兵与荥阳之战', edition: '维基文库公开文本；用户整理稿交叉核对', url: 'https://zh.wikisource.org/wiki/%E4%B8%89%E5%9C%8B%E5%BF%97/%E5%8D%B701', accessedAt: '2026-08-01', note: '用于酸枣西向荥阳军路的军事实践支撑。' },
];

/** BF-P5 第三郡：陈留郡 190 年切片。坐标与几何只表达史料支撑的相对拓扑。 */
const seed: CommanderySeed = {
  id: 'yan_chenliu_190', name: '陈留郡', province: '兖州', seatCountyId: 'chenliu_chenliu', worldCityId: 7, scenarioYear: 190,
  sourceRefs: [HHS, SJZ, SGZ], autoFillRoads: false,
  defaultCountyLocationNote: '县名与隶属有原典明文；坐标仅为陈留郡域战场的人工相对布局。',
  counties: [
    { id: 'chenliu_chenliu', name: '陈留', role: 'seat', x: .28, y: .54, terrain: ['plain', 'river'], adjacent: ['chenliu_junyi', 'chenliu_xiaohuang', 'chenliu_yongqiu', 'chenliu_weishi', 'chenliu_suanzao'], landmarks: ['chenliu_langdang_canal'], confidence: 'approximate' },
    { id: 'chenliu_junyi', name: '浚仪', x: .15, y: .43, terrain: ['plain', 'river'], adjacent: ['chenliu_chenliu', 'chenliu_weishi', 'chenliu_waihuang'], landmarks: ['chenliu_langdang_canal', 'chenliu_bian_water'], confidence: 'approximate' },
    { id: 'chenliu_weishi', name: '尉氏', role: 'frontier', x: .09, y: .72, terrain: ['plain', 'marsh'], adjacent: ['chenliu_chenliu', 'chenliu_junyi', 'chenliu_fugou'], landmarks: ['chenliu_weishi_marsh'], confidence: 'approximate' },
    { id: 'chenliu_yongqiu', name: '雍丘', x: .47, y: .67, terrain: ['plain', 'river', 'marsh'], adjacent: ['chenliu_chenliu', 'chenliu_xiangyi', 'chenliu_yu', 'chenliu_jiwu'], landmarks: ['chenliu_sui_water', 'chenliu_baiyang_marsh'], confidence: 'approximate' },
    { id: 'chenliu_xiangyi', name: '襄邑', role: 'frontier', x: .72, y: .75, terrain: ['plain', 'river'], adjacent: ['chenliu_yongqiu', 'chenliu_jiwu', 'chenliu_kaocheng'], landmarks: ['chenliu_sui_water'], confidence: 'approximate' },
    { id: 'chenliu_waihuang', name: '外黄', x: .72, y: .47, terrain: ['plain', 'river'], adjacent: ['chenliu_junyi', 'chenliu_xiaohuang', 'chenliu_kaocheng'], landmarks: ['chenliu_bian_water'], confidence: 'approximate' },
    { id: 'chenliu_xiaohuang', name: '小黄', x: .43, y: .45, adjacent: ['chenliu_chenliu', 'chenliu_waihuang', 'chenliu_donghun', 'chenliu_fengqiu'], confidence: 'inferred' },
    { id: 'chenliu_donghun', name: '东昏', x: .55, y: .35, adjacent: ['chenliu_xiaohuang', 'chenliu_jiyang'], confidence: 'inferred' },
    { id: 'chenliu_jiyang', name: '济阳', x: .69, y: .29, terrain: ['plain', 'river'], adjacent: ['chenliu_donghun', 'chenliu_pingqiu', 'chenliu_changyuan'], confidence: 'inferred' },
    { id: 'chenliu_pingqiu', name: '平丘', x: .45, y: .24, terrain: ['plain', 'river'], adjacent: ['chenliu_jiyang', 'chenliu_changyuan', 'chenliu_fengqiu'], landmarks: ['chenliu_ji_water', 'chenliu_kuangting'], confidence: 'approximate' },
    { id: 'chenliu_fengqiu', name: '封丘', role: 'frontier', x: .25, y: .29, terrain: ['plain', 'river'], adjacent: ['chenliu_pingqiu', 'chenliu_suanzao', 'chenliu_xiaohuang'], landmarks: ['chenliu_ji_water', 'chenliu_tonglao'], confidence: 'approximate' },
    { id: 'chenliu_suanzao', name: '酸枣', role: 'frontier', x: .12, y: .17, terrain: ['plain', 'river'], adjacent: ['chenliu_fengqiu', 'chenliu_changyuan', 'chenliu_chenliu'], landmarks: ['chenliu_yanjin', 'chenliu_pu_canal'], confidence: 'approximate' },
    { id: 'chenliu_changyuan', name: '长垣', role: 'frontier', x: .7, y: .12, terrain: ['plain', 'river'], adjacent: ['chenliu_suanzao', 'chenliu_pingqiu', 'chenliu_jiyang'], landmarks: ['chenliu_pu_canal'], confidence: 'approximate' },
    { id: 'chenliu_jiwu', name: '己吾', x: .67, y: .86, adjacent: ['chenliu_yongqiu', 'chenliu_xiangyi', 'chenliu_yu'], confidence: 'inferred' },
    { id: 'chenliu_kaocheng', name: '考城', role: 'frontier', x: .91, y: .57, terrain: ['plain', 'river'], adjacent: ['chenliu_waihuang', 'chenliu_xiangyi'], landmarks: ['chenliu_bian_water'], confidence: 'approximate' },
    { id: 'chenliu_yu', name: '圉', x: .5, y: .82, adjacent: ['chenliu_yongqiu', 'chenliu_jiwu', 'chenliu_fugou'], confidence: 'inferred' },
    { id: 'chenliu_fugou', name: '扶沟', role: 'frontier', x: .25, y: .91, terrain: ['plain', 'river'], adjacent: ['chenliu_weishi', 'chenliu_yu'], confidence: 'inferred' },
  ],
  landmarks: [
    { id: 'chenliu_yanjin', name: '延津', kind: 'ferry', geometry: { type: 'point', x: .08, y: .08 }, tacticalTags: ['yellow_river_crossing', 'northern_entry'], confidence: 'attested', sourceRefs: [HHS, SJZ] },
    { id: 'chenliu_ji_water', name: '济水', kind: 'river', geometry: { type: 'polyline', points: [[.05, .25], [.3, .24], [.55, .2], [.86, .18]] }, tacticalTags: ['waterway', 'floodplain'], confidence: 'approximate', sourceRefs: [SJZ] },
    { id: 'chenliu_pu_canal', name: '濮渠', kind: 'river', geometry: { type: 'polyline', points: [[.12, .17], [.34, .15], [.7, .12]] }, tacticalTags: ['waterway', 'canal_crossing'], confidence: 'approximate', sourceRefs: [SJZ] },
    { id: 'chenliu_langdang_canal', name: '蓗荡渠', kind: 'river', geometry: { type: 'polyline', points: [[.1, .4], [.18, .46], [.3, .52], [.43, .56]] }, tacticalTags: ['canal_hub'], confidence: 'approximate', sourceRefs: [SJZ] },
    { id: 'chenliu_bian_water', name: '汴水', kind: 'river', geometry: { type: 'polyline', points: [[.15, .43], [.42, .45], [.72, .47], [.94, .58]] }, tacticalTags: ['east_west_waterway'], confidence: 'approximate', sourceRefs: [SJZ] },
    { id: 'chenliu_sui_water', name: '睢水', kind: 'river', geometry: { type: 'polyline', points: [[.28, .54], [.47, .67], [.72, .75], [.96, .76]] }, tacticalTags: ['southern_waterway'], confidence: 'approximate', sourceRefs: [SJZ] },
    { id: 'chenliu_baiyang_marsh', name: '白羊陂', kind: 'marsh', geometry: { type: 'polygon', points: [[.41, .62], [.5, .62], [.54, .7], [.45, .73]] }, tacticalTags: ['seasonal_flood'], confidence: 'approximate', sourceRefs: [SJZ] },
    { id: 'chenliu_weishi_marsh', name: '尉氏北泽', kind: 'marsh', geometry: { type: 'polygon', points: [[.06, .64], [.14, .62], [.18, .69], [.1, .74]] }, tacticalTags: ['imperial_park'], confidence: 'attested', sourceRefs: [HHS] },
    { id: 'chenliu_tonglao', name: '桐牢亭', kind: 'pass', geometry: { type: 'point', x: .24, y: .27 }, tacticalTags: ['fortified_crossing'], confidence: 'attested', sourceRefs: [HHS] },
    { id: 'chenliu_kuangting', name: '匡亭', kind: 'pass', geometry: { type: 'point', x: .48, y: .25 }, tacticalTags: ['battle_site'], confidence: 'attested', sourceRefs: [HHS] },
  ],
  routes: [
    { id: 'route_bian_junyi_waihuang', from: 'chenliu_junyi', to: 'chenliu_waihuang', kind: 'river', movementCost: .8, confidence: 'approximate', sourceRefs: [SJZ] },
    { id: 'route_bian_waihuang_kaocheng', from: 'chenliu_waihuang', to: 'chenliu_kaocheng', kind: 'river', movementCost: .8, confidence: 'approximate', sourceRefs: [SJZ] },
    { id: 'route_sui_chenliu_yongqiu', from: 'chenliu_chenliu', to: 'chenliu_yongqiu', kind: 'river', movementCost: .8, confidence: 'approximate', sourceRefs: [SJZ] },
    { id: 'route_sui_yongqiu_xiangyi', from: 'chenliu_yongqiu', to: 'chenliu_xiangyi', kind: 'river', movementCost: .8, confidence: 'approximate', sourceRefs: [SJZ] },
    { id: 'route_pu_fengqiu_suanzao', from: 'chenliu_fengqiu', to: 'chenliu_suanzao', kind: 'river', movementCost: .9, confidence: 'approximate', sourceRefs: [SJZ] },
    { id: 'route_pu_suanzao_changyuan', from: 'chenliu_suanzao', to: 'chenliu_changyuan', kind: 'river', movementCost: .9, confidence: 'approximate', sourceRefs: [SJZ] },
    { id: 'route_yanjin_ferry', from: 'chenliu_suanzao', to: 'chenliu_yanjin', kind: 'ferry', movementCost: 1.2, confidence: 'attested', sourceRefs: [HHS, SJZ] },
    { id: 'road_chenliu_suanzao', from: 'chenliu_chenliu', to: 'chenliu_suanzao', movementCost: 1.2, confidence: 'inferred', sourceRefs: [SGZ] },
    { id: 'road_chenliu_junyi', from: 'chenliu_chenliu', to: 'chenliu_junyi', confidence: 'inferred', sourceRefs: [HHS] },
    { id: 'road_chenliu_xiaohuang', from: 'chenliu_chenliu', to: 'chenliu_xiaohuang', confidence: 'inferred', sourceRefs: [HHS] },
    { id: 'road_junyi_weishi', from: 'chenliu_junyi', to: 'chenliu_weishi', movementCost: 1.1, confidence: 'inferred', sourceRefs: [HHS] },
    { id: 'road_weishi_fugou', from: 'chenliu_weishi', to: 'chenliu_fugou', movementCost: 1.2, confidence: 'inferred', sourceRefs: [HHS] },
    { id: 'road_yongqiu_yu', from: 'chenliu_yongqiu', to: 'chenliu_yu', movementCost: 1.1, confidence: 'inferred', sourceRefs: [HHS] },
    { id: 'road_yu_jiwu', from: 'chenliu_yu', to: 'chenliu_jiwu', movementCost: 1.2, confidence: 'inferred', sourceRefs: [HHS] },
    { id: 'road_jiwu_xiangyi', from: 'chenliu_jiwu', to: 'chenliu_xiangyi', movementCost: 1.1, confidence: 'inferred', sourceRefs: [HHS] },
    { id: 'road_xiaohuang_donghun', from: 'chenliu_xiaohuang', to: 'chenliu_donghun', movementCost: 1.1, confidence: 'inferred', sourceRefs: [HHS] },
    { id: 'road_donghun_jiyang', from: 'chenliu_donghun', to: 'chenliu_jiyang', movementCost: 1.1, confidence: 'inferred', sourceRefs: [HHS] },
    { id: 'road_jiyang_pingqiu', from: 'chenliu_jiyang', to: 'chenliu_pingqiu', movementCost: 1.1, confidence: 'inferred', sourceRefs: [HHS] },
    { id: 'road_xiaohuang_fengqiu', from: 'chenliu_xiaohuang', to: 'chenliu_fengqiu', movementCost: 1.1, confidence: 'inferred', sourceRefs: [HHS] },
  ],
};

export const chenliu190: HistoricalGeographyBundle = buildHistoricalGeographyBundle(seed, sources);
