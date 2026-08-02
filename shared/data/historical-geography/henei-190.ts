// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { buildHistoricalGeographyBundle, type CommanderySeed } from './seed-schema.js';
import type { HistoricalGeographyBundle, HistoricalSource } from './schema.js';

const HHS = 'hhs_junguozhi_henei';
const SJZ_HE = 'shuijingzhu_he_henei';
const SJZ_QI = 'shuijingzhu_qi_henei';
const SGZ_COALITION = 'sgz_coalition_henei_190';

const sources: HistoricalSource[] = [
  {
    id: HHS,
    title: '《后汉书》',
    author: '范晔撰；司马彪《续汉书》志',
    volume: '卷一百零九（志第十九·郡国一）',
    entry: '司隶校尉部·河内郡',
    edition: '维基文库四库全书本公开文本',
    url: 'https://zh.wikisource.org/zh/%E5%BE%8C%E6%BC%A2%E6%9B%B8_(%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC)/%E5%85%A8%E8%A6%BD2',
    accessedAt: '2026-08-01',
    note: '河内郡十八城、治怀及孟津、太行山、淇水、牧野、羑里等附注的行政真源。',
  },
  {
    id: SJZ_HE,
    title: '《水经注》',
    author: '郦道元',
    volume: '卷五',
    entry: '河水·河阳故城与孟津',
    edition: '维基文库公开文本',
    url: 'https://zh.wikisource.org/zh-hant/%E6%B0%B4%E7%B6%93%E6%B3%A8/05',
    accessedAt: '2026-08-01',
    note: '用于河阳南临孟津与黄河北岸渡口轴；几何只表达相对方位。',
  },
  {
    id: SJZ_QI,
    title: '《水经注》',
    author: '郦道元',
    volume: '卷九',
    entry: '淇水及朝歌周边水系',
    edition: '维基文库公开文本',
    url: 'https://zh.wikisource.org/zh/%E6%B0%B4%E7%B6%93%E6%B3%A8/09',
    accessedAt: '2026-08-01',
    note: '用于共—朝歌一带淇水轴；不把后世渠道工程反投至 190 年。',
  },
  {
    id: SGZ_COALITION,
    title: '《三国志》',
    author: '陈寿撰、裴松之注',
    volume: '卷一·魏书一',
    entry: '武帝纪·初平元年关东诸军屯驻',
    edition: '维基文库公开文本',
    url: 'https://zh.wikisource.org/zh/%E4%B8%89%E5%9C%8B%E5%BF%97/%E5%8D%B701',
    accessedAt: '2026-08-01',
    note: '支撑河内太守王匡参与关东联军的 190 年剧本背景；具体县际行军线仍标推定。',
  },
];

/** BF-P5 第五郡：河内郡 190 年切片。坐标与自动道路为战场相对拓扑。 */
const seed: CommanderySeed = {
  id: 'sili_henei_190',
  name: '河内郡',
  province: '司隶',
  seatCountyId: 'henei_huai',
  // 0-A 30 城没有河内治所；暂借洛阳大地图节点承载进场与守方归属，不表示行政合并。
  worldCityId: 1,
  scenarioYear: 190,
  sourceRefs: [HHS, SJZ_HE, SJZ_QI, SGZ_COALITION],
  defaultCountyLocationNote: '县名与隶属据《后汉书·郡国志》；坐标仅为河内郡战场人工相对布局。',
  counties: [
    { id: 'henei_huai', name: '怀', role: 'seat', x: .43, y: .57, terrain: ['plain', 'river'], adjacent: ['henei_yewang', 'henei_wen', 'henei_zhou', 'henei_wude', 'henei_shanyang', 'henei_heyang', 'henei_pinggao'], landmarks: ['henei_qin_water'], confidence: 'approximate' },
    { id: 'henei_heyang', name: '河阳', role: 'frontier', x: .38, y: .88, terrain: ['plain', 'river'], adjacent: ['henei_wen', 'henei_huai', 'henei_pinggao'], landmarks: ['henei_yellow_river', 'henei_mengjin'], confidence: 'approximate' },
    { id: 'henei_zhi', name: '轵', x: .08, y: .48, terrain: ['hill', 'river'], adjacent: ['henei_qinshui', 'henei_bo', 'henei_yewang'], landmarks: ['henei_qin_water'], confidence: 'approximate' },
    { id: 'henei_bo', name: '波', x: .14, y: .64, terrain: ['plain', 'hill'], adjacent: ['henei_zhi', 'henei_yewang', 'henei_wen'], confidence: 'inferred' },
    { id: 'henei_qinshui', name: '沁水', role: 'frontier', x: .12, y: .3, terrain: ['mountain', 'river'], adjacent: ['henei_zhi', 'henei_yewang'], landmarks: ['henei_qin_water', 'henei_taihang'], confidence: 'approximate' },
    { id: 'henei_yewang', name: '野王', x: .27, y: .43, terrain: ['hill', 'mountain', 'river'], adjacent: ['henei_zhi', 'henei_bo', 'henei_qinshui', 'henei_huai', 'henei_zhou'], landmarks: ['henei_taihang', 'henei_taihang_pass'], confidence: 'approximate' },
    { id: 'henei_wen', name: '温', x: .25, y: .7, terrain: ['plain', 'river'], adjacent: ['henei_bo', 'henei_huai', 'henei_heyang'], landmarks: ['henei_yellow_river', 'henei_ji_water'], confidence: 'approximate' },
    { id: 'henei_zhou', name: '州', x: .42, y: .42, terrain: ['plain'], adjacent: ['henei_yewang', 'henei_huai', 'henei_shanyang', 'henei_xiuwu'], confidence: 'inferred' },
    { id: 'henei_pinggao', name: '平皋', x: .51, y: .76, terrain: ['plain', 'river'], adjacent: ['henei_heyang', 'henei_huai', 'henei_shanyang', 'henei_wude'], landmarks: ['henei_yellow_river'], confidence: 'approximate' },
    { id: 'henei_shanyang', name: '山阳', x: .54, y: .58, terrain: ['plain'], adjacent: ['henei_huai', 'henei_zhou', 'henei_pinggao', 'henei_wude', 'henei_xiuwu'], confidence: 'inferred' },
    { id: 'henei_wude', name: '武德', x: .64, y: .69, terrain: ['plain', 'river'], adjacent: ['henei_huai', 'henei_pinggao', 'henei_shanyang', 'henei_huojia'], confidence: 'inferred' },
    { id: 'henei_huojia', name: '获嘉', role: 'frontier', x: .73, y: .61, terrain: ['plain'], adjacent: ['henei_wude', 'henei_xiuwu', 'henei_ji'], confidence: 'approximate' },
    { id: 'henei_xiuwu', name: '修武', role: 'frontier', x: .62, y: .46, terrain: ['plain', 'hill'], adjacent: ['henei_zhou', 'henei_shanyang', 'henei_huojia', 'henei_gong', 'henei_ji'], landmarks: ['henei_taihang_pass'], confidence: 'approximate' },
    { id: 'henei_gong', name: '共', role: 'frontier', x: .69, y: .3, terrain: ['hill', 'river'], adjacent: ['henei_xiuwu', 'henei_ji', 'henei_chaoge'], landmarks: ['henei_qi_water', 'henei_taihang'], confidence: 'approximate' },
    { id: 'henei_ji', name: '汲', x: .8, y: .47, terrain: ['plain', 'river'], adjacent: ['henei_huojia', 'henei_xiuwu', 'henei_gong', 'henei_chaoge'], landmarks: ['henei_qi_water', 'henei_youli'], confidence: 'approximate' },
    { id: 'henei_chaoge', name: '朝歌', role: 'frontier', x: .86, y: .3, terrain: ['plain', 'river'], adjacent: ['henei_gong', 'henei_ji', 'henei_dangyin', 'henei_linlu'], landmarks: ['henei_qi_water', 'henei_muye'], confidence: 'approximate' },
    { id: 'henei_dangyin', name: '荡阴', role: 'frontier', x: .92, y: .17, terrain: ['plain', 'river'], adjacent: ['henei_chaoge', 'henei_linlu'], landmarks: ['henei_huan_water'], confidence: 'approximate' },
    { id: 'henei_linlu', name: '林虑', role: 'frontier', x: .75, y: .09, terrain: ['mountain', 'forest', 'river'], adjacent: ['henei_chaoge', 'henei_dangyin'], landmarks: ['henei_taihang', 'henei_huan_water'], confidence: 'approximate' },
  ],
  landmarks: [
    { id: 'henei_yellow_river', name: '河水', kind: 'river', geometry: { type: 'polyline', points: [[.03, .84], [.3, .88], [.58, .86], [.98, .79]] }, tacticalTags: ['southern_boundary', 'capital_crossing'], confidence: 'approximate', sourceRefs: [HHS, SJZ_HE] },
    { id: 'henei_mengjin', name: '孟津', kind: 'ferry', geometry: { type: 'point', x: .4, y: .9 }, tacticalTags: ['luoyang_north_gate', 'coalition_crossing'], confidence: 'attested', sourceRefs: [HHS, SJZ_HE] },
    { id: 'henei_qin_water', name: '沁水', kind: 'river', geometry: { type: 'polyline', points: [[.08, .13], [.12, .3], [.27, .47], [.43, .6]] }, tacticalTags: ['western_waterway', 'river_crossing'], confidence: 'approximate', sourceRefs: [HHS] },
    { id: 'henei_taihang', name: '太行山', kind: 'mountain', geometry: { type: 'polygon', points: [[.03, .06], [.78, .03], [.72, .2], [.3, .25], [.08, .2]] }, tacticalTags: ['northern_barrier', 'high_ground'], confidence: 'approximate', sourceRefs: [HHS] },
    { id: 'henei_taihang_pass', name: '太行陉', kind: 'pass', geometry: { type: 'point', x: .35, y: .29 }, tacticalTags: ['northern_gate', 'chokepoint'], confidence: 'approximate', locationNote: '按野王北倚太行通道抽象为战场关口，不主张精确关址。', sourceRefs: [HHS] },
    { id: 'henei_qi_water', name: '淇水', kind: 'river', geometry: { type: 'polyline', points: [[.68, .12], [.72, .27], [.84, .35], [.96, .47]] }, tacticalTags: ['eastern_waterway', 'river_crossing'], confidence: 'approximate', sourceRefs: [HHS, SJZ_QI] },
    { id: 'henei_muye', name: '鹿腹山', kind: 'mountain', geometry: { type: 'polygon', points: [[.78, .23], [.87, .2], [.9, .29], [.82, .33]] }, tacticalTags: ['eastern_high_ground'], confidence: 'approximate', sourceRefs: [HHS] },
    { id: 'henei_youli', name: '铜关', kind: 'pass', geometry: { type: 'point', x: .82, y: .43 }, tacticalTags: ['eastern_chokepoint'], confidence: 'approximate', locationNote: '《后汉书》汲县下注引《晋地道记》有铜关；具体位置仅作相对锚点。', sourceRefs: [HHS] },
    { id: 'henei_huan_water', name: '洹水', kind: 'river', geometry: { type: 'polyline', points: [[.73, .06], [.82, .13], [.95, .2]] }, tacticalTags: ['northeast_waterway'], confidence: 'approximate', sourceRefs: [HHS] },
    { id: 'henei_ji_water', name: '济水故道', kind: 'river', geometry: { type: 'polyline', points: [[.18, .72], [.28, .7], [.43, .68], [.58, .72]] }, tacticalTags: ['southern_waterway'], confidence: 'approximate', locationNote: '《后汉书》温县下注称济水后枯绝；仅作历史地貌锚点，不设通航保证。', sourceRefs: [HHS] },
  ],
  routes: [
    { id: 'route_heyang_mengjin', from: 'henei_heyang', to: 'henei_mengjin', kind: 'ferry', movementCost: 1.1, confidence: 'attested', sourceRefs: [HHS, SJZ_HE] },
    { id: 'route_qin_qinshui_yewang', from: 'henei_qinshui', to: 'henei_yewang', kind: 'river', movementCost: .9, confidence: 'approximate', sourceRefs: [HHS] },
    { id: 'route_taihang_yewang', from: 'henei_yewang', to: 'henei_taihang_pass', kind: 'pass', movementCost: 1.4, confidence: 'approximate', sourceRefs: [HHS] },
    { id: 'route_qi_gong_chaoge', from: 'henei_gong', to: 'henei_chaoge', kind: 'river', movementCost: .9, confidence: 'approximate', sourceRefs: [HHS, SJZ_QI] },
  ],
  autoFillRoads: true,
};

export const henei190: HistoricalGeographyBundle = buildHistoricalGeographyBundle(seed, sources);
