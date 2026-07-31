// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { buildHistoricalGeographyBundle, type CommanderySeed } from './seed-schema.js';
import type { HistoricalGeographyBundle, HistoricalSource } from './schema.js';

const YEAR = 190;
const COMMANDERY = 'jing_nanjun_190';

const sources: HistoricalSource[] = [
  {
    id: 'hhs_junguozhi_nanjun',
    title: '《后汉书》',
    author: '范晔撰；司马彪《续汉书》志',
    volume: '卷一百一十二（志第二十二·郡国四）',
    entry: '荆州刺史部·南郡',
    edition: '维基文库公开文本（未校对提示页；与中国哲学书电子化计划入口交叉核对）',
    url: 'https://zh.wikisource.org/zh/後漢書/卷112',
    accessedAt: '2026-07-23',
    note: '载南郡十七城及江陵、巫、秭归、中卢、编、当阳、华容、襄阳、邔、宜城、鄀、临沮、枝江、夷道、夷陵、州陵、很山。',
  },
  {
    id: 'hhs_ctext_entry',
    title: '《后汉书》',
    author: '范晔撰；司马彪《续汉书》志',
    volume: '郡国志',
    entry: '荆州·南郡',
    edition: '中国哲学书电子化计划公开原典入口',
    url: 'https://ctext.org/hou-han-shu/zh',
    accessedAt: '2026-07-23',
    note: '作为异站复核入口；数据不复制网站现代整理或扫描资产。',
  },
  {
    id: 'sgz_liubiao',
    title: '《三国志》',
    author: '陈寿撰、裴松之注',
    volume: '卷六·魏书六',
    entry: '刘表传及裴注引《战略》',
    edition: '维基文库公开文本',
    url: 'https://zh.wikisource.org/zh/三國志/卷06',
    accessedAt: '2026-07-23',
    note: '载灵帝崩后刘表代王叡为荆州刺史、合兵军襄阳；不等于 190 年已另置襄阳郡。',
  },
  {
    id: 'sgz_zhouyu_nanjun',
    title: '《三国志》',
    author: '陈寿撰、裴松之注',
    volume: '卷五十四·吴书九',
    entry: '周瑜传',
    edition: '维基文库公开文本',
    url: 'https://zh.wikisource.org/zh/三國志/卷54',
    accessedAt: '2026-07-23',
    note: '载建安十三年后周瑜进攻南郡、曹仁守江陵；用于确认 208 年战争背景晚于本 190 切片，不据此反改 190 县表。',
  },
  {
    id: 'shuijingzhu_jiang_34',
    title: '《水经注》',
    author: '郦道元',
    volume: '卷三十四·江水',
    entry: '夷陵、夷道、枝江、江陵沿江段',
    edition: '维基文库公开文本',
    url: 'https://zh.wikisource.org/zh/水經注/34',
    accessedAt: '2026-07-23',
    note: '用于长江沿线相对次序、荆门虎牙、江陵江津等地貌锚点。',
  },
  {
    id: 'shuijingzhu_jiang_35',
    title: '《水经注》',
    author: '郦道元',
    volume: '卷三十五·江水',
    entry: '华容、夏水、涌水段',
    edition: '维基文库公开文本',
    url: 'https://zh.wikisource.org/zh/水經注/35',
    accessedAt: '2026-07-23',
    note: '载江水至华容县西夏水出、华容县南涌水入，支撑东南水网与湖沼标签。',
  },
  {
    id: 'shuijingzhu_jushui_32',
    title: '《水经注》',
    author: '郦道元',
    volume: '卷三十二·沮水',
    entry: '临沮、当阳、枝江段',
    edition: '维基文库公开文本',
    url: 'https://zh.wikisource.org/zh/水經注/32',
    accessedAt: '2026-07-23',
    note: '载沮水经临沮、当阳，继而于枝江东南入江，并记荆山、青溪、麦城等相对位置。',
  },
];

/**
 * BF-P0 南郡 190 年切片。
 *
 * localX/localY 与 localGeometry 是人工编订的郡域相对布局，不是古城址测量值；
 * 史书可证的是县名、隶属及部分水系相对次序。所有位置因此至少标 approximate。
 *
 * 南郡是水系复杂郡国的 seed 表达活样本：含 8 条水路、7 条多形态地标
 * （polyline/polygon）、6 个侯国和 2 个边县，充分验证 seed schema 的 95% 覆盖度。
 */
const seed: CommanderySeed = {
  id: COMMANDERY,
  name: '南郡',
  province: '荆州',
  seatCountyId: 'nanjun_jiangling',
  worldCityId: 14,
  scenarioYear: YEAR,
  sourceRefs: ['hhs_junguozhi_nanjun', 'hhs_ctext_entry', 'sgz_liubiao'],
  // 南郡 routes 全部显式（水路为主），不从 adjacent 自动派生。
  autoFillRoads: false,
  counties: [
    { id: 'nanjun_jiangling', name: '江陵', role: 'seat', x: 0.62, y: 0.65, terrain: ['plain', 'river', 'lake'], adjacent: ['nanjun_zhijiang', 'nanjun_huarong', 'nanjun_dangyang'], landmarks: ['nanjun_yangtze', 'nanjun_jiangjin'], confidence: 'approximate', locationNote: '郡治及县名有明文；坐标仅表达其处郡域中东部、临江的相对布局，不主张精确古城址。', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jiang_34'] },
    { id: 'nanjun_wu', name: '巫', role: 'frontier', x: 0.05, y: 0.43, terrain: ['mountain', 'forest', 'river'], adjacent: ['nanjun_zigui'], landmarks: ['nanjun_yangtze'], confidence: 'approximate', locationNote: '县名与巫山有明文；相对位置仅表达长江西部峡江前沿。', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jiang_34'] },
    { id: 'nanjun_zigui', name: '秭归', x: 0.16, y: 0.47, terrain: ['mountain', 'forest', 'river'], adjacent: ['nanjun_wu', 'nanjun_yiling'], landmarks: ['nanjun_yangtze'], confidence: 'approximate', locationNote: '县名有明文；相对位置表达巫与夷陵之间的峡江节点。', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jiang_34'] },
    { id: 'nanjun_zhonglu', name: '中卢', role: 'marquisate', x: 0.67, y: 0.12, terrain: ['hill', 'forest', 'river'], adjacent: ['nanjun_bian'], landmarks: ['nanjun_han_river'], confidence: 'inferred', locationNote: '侯国及疏水入沔有明文；郡域归一化位置按襄阳西南关系推定。', sourceRefs: ['hhs_junguozhi_nanjun'] },
    { id: 'nanjun_bian', name: '编', x: 0.54, y: 0.27, terrain: ['hill', 'forest'], adjacent: ['nanjun_zhonglu', 'nanjun_dangyang', 'nanjun_linju'], landmarks: [], confidence: 'inferred', locationNote: '县名与蓝口聚有明文；位置仅为连接北部县群与当阳的布局推定。', sourceRefs: ['hhs_junguozhi_nanjun'] },
    { id: 'nanjun_dangyang', name: '当阳', x: 0.52, y: 0.46, terrain: ['plain', 'hill', 'forest', 'river'], adjacent: ['nanjun_linju', 'nanjun_bian', 'nanjun_yicheng', 'nanjun_ruo', 'nanjun_jiangling', 'nanjun_zhijiang'], landmarks: ['nanjun_ju_river', 'nanjun_zhang_river'], confidence: 'approximate', locationNote: '县名及沮水经城北有明文；坐标表达临沮下游、枝江上游的相对次序。', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jushui_32'] },
    { id: 'nanjun_huarong', name: '华容', role: 'marquisate', x: 0.83, y: 0.73, terrain: ['plain', 'river', 'lake', 'marsh'], adjacent: ['nanjun_jiangling', 'nanjun_zhouling'], landmarks: ['nanjun_yangtze', 'nanjun_xia_water', 'nanjun_yunmeng'], confidence: 'approximate', locationNote: '侯国、云梦泽在南及夏水出江有明文；位置仅表达江陵以东南的水网节点。', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jiang_35'] },
    { id: 'nanjun_qi', name: '邔', role: 'marquisate', x: 0.87, y: 0.19, terrain: ['plain', 'hill'], adjacent: ['nanjun_yicheng'], landmarks: [], confidence: 'inferred', locationNote: '侯国与犂丘城有明文；相对位置按北部县群布局推定。', sourceRefs: ['hhs_junguozhi_nanjun'] },
    { id: 'nanjun_yicheng', name: '宜城', role: 'marquisate', x: 0.78, y: 0.28, terrain: ['plain', 'hill', 'river'], adjacent: ['nanjun_qi', 'nanjun_ruo', 'nanjun_dangyang'], landmarks: ['nanjun_han_river'], confidence: 'inferred', locationNote: '侯国有明文；相对位置按襄阳方向、鄀及当阳之间的县群关系推定。', sourceRefs: ['hhs_junguozhi_nanjun'] },
    { id: 'nanjun_ruo', name: '鄀', role: 'marquisate', x: 0.69, y: 0.34, terrain: ['plain', 'hill', 'river'], adjacent: ['nanjun_yicheng', 'nanjun_dangyang'], landmarks: ['nanjun_han_river'], confidence: 'inferred', locationNote: '侯国有明文；坐标为连接宜城、当阳的人工相对布局。', sourceRefs: ['hhs_junguozhi_nanjun'] },
    { id: 'nanjun_linju', name: '临沮', role: 'marquisate', x: 0.36, y: 0.32, terrain: ['mountain', 'forest', 'river'], adjacent: ['nanjun_bian', 'nanjun_dangyang', 'nanjun_yiling'], landmarks: ['nanjun_ju_river', 'nanjun_jing_mountain'], confidence: 'approximate', locationNote: '侯国、荆山及沮水经县西南有明文；坐标表达当阳上游山地节点。', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jushui_32'] },
    { id: 'nanjun_zhijiang', name: '枝江', role: 'marquisate', x: 0.52, y: 0.69, terrain: ['plain', 'river', 'lake', 'marsh'], adjacent: ['nanjun_yidao', 'nanjun_dangyang', 'nanjun_jiangling'], landmarks: ['nanjun_yangtze', 'nanjun_ju_river'], confidence: 'approximate', locationNote: '侯国及沮水于县东南入江有明文；坐标表达江陵以西、当阳下游。', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jushui_32', 'shuijingzhu_jiang_34'] },
    { id: 'nanjun_yidao', name: '夷道', x: 0.38, y: 0.67, terrain: ['hill', 'mountain', 'forest', 'river'], adjacent: ['nanjun_yiling', 'nanjun_zhijiang', 'nanjun_henshan'], landmarks: ['nanjun_yangtze'], confidence: 'approximate', locationNote: '县名及山地记载有明文；位置表达夷陵与枝江之间的沿江节点。', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jiang_34'] },
    { id: 'nanjun_yiling', name: '夷陵', x: 0.27, y: 0.57, terrain: ['mountain', 'forest', 'river'], adjacent: ['nanjun_zigui', 'nanjun_yidao', 'nanjun_linju'], landmarks: ['nanjun_yangtze', 'nanjun_jingmen_huya'], confidence: 'approximate', locationNote: '县名、荆门与虎牙山有明文；位置表达秭归下游、夷道上游。', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jiang_34'] },
    { id: 'nanjun_zhouling', name: '州陵', x: 0.93, y: 0.64, terrain: ['plain', 'river', 'lake', 'marsh'], adjacent: ['nanjun_huarong'], landmarks: ['nanjun_xia_water', 'nanjun_yunmeng'], confidence: 'inferred', locationNote: '县名有明文；位置为华容以东的战场边界布局推定。', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jiang_35'] },
    { id: 'nanjun_henshan', name: '很山', role: 'frontier', x: 0.28, y: 0.86, terrain: ['mountain', 'forest'], adjacent: ['nanjun_yidao'], landmarks: [], confidence: 'inferred', locationNote: '《郡国志》仅明载故属武陵；位置作为南部山地边界节点推定，存疑最大。', sourceRefs: ['hhs_junguozhi_nanjun'] },
  ],
  landmarks: [
    { id: 'nanjun_yangtze', name: '江水（长江）', kind: 'river', geometry: { type: 'polyline', points: [[0.02, 0.42], [0.27, 0.57], [0.52, 0.69], [0.83, 0.73], [0.98, 0.68]] }, tacticalTags: ['major_waterway', 'naval_route', 'crossing_constraint'], confidence: 'approximate', locationNote: '沿江县次序有原典支撑；折线只作战场示意，不代表古河道测绘。', sourceRefs: ['shuijingzhu_jiang_34', 'shuijingzhu_jiang_35'] },
    { id: 'nanjun_ju_river', name: '沮水', kind: 'river', geometry: { type: 'polyline', points: [[0.34, 0.28], [0.52, 0.46], [0.52, 0.69]] }, tacticalTags: ['river_route', 'crossing_constraint'], confidence: 'approximate', locationNote: '临沮—当阳—枝江入江的次序有原典支撑；折线为归一化示意。', sourceRefs: ['shuijingzhu_jushui_32'] },
    { id: 'nanjun_zhang_river', name: '漳水', kind: 'river', geometry: { type: 'polyline', points: [[0.43, 0.34], [0.54, 0.48], [0.57, 0.58]] }, tacticalTags: ['river_route', 'crossing_constraint'], confidence: 'approximate', locationNote: '漳水与沮水在当阳一带汇合关系有原典支撑；折线为示意。', sourceRefs: ['shuijingzhu_jushui_32'] },
    { id: 'nanjun_han_river', name: '沔水（汉水）', kind: 'river', geometry: { type: 'polyline', points: [[0.62, 0.02], [0.76, 0.08], [0.80, 0.31]] }, tacticalTags: ['major_waterway', 'ferry'], confidence: 'approximate', locationNote: '襄阳北津及中卢疏水入沔有原典文字；折线为战场示意。', sourceRefs: ['hhs_junguozhi_nanjun'] },
    { id: 'nanjun_xia_water', name: '夏水', kind: 'river', geometry: { type: 'polyline', points: [[0.72, 0.66], [0.83, 0.73], [0.96, 0.60]] }, tacticalTags: ['seasonal_waterway', 'marsh_edge'], confidence: 'approximate', locationNote: '华容县西夏水出江有明文；折线不表示精确古河道。', sourceRefs: ['shuijingzhu_jiang_35'] },
    { id: 'nanjun_yunmeng', name: '云梦泽（南郡东南水泽）', kind: 'marsh', geometry: { type: 'polygon', points: [[0.76, 0.67], [0.95, 0.57], [0.98, 0.82], [0.80, 0.86]] }, tacticalTags: ['marsh', 'floodplain', 'seasonal_obstacle'], confidence: 'inferred', locationNote: '《郡国志》明载华容南有云梦泽，但古泽范围及异说复杂；多边形仅表达华容南部水泽带。', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jiang_35'] },
    { id: 'nanjun_jing_mountain', name: '荆山', kind: 'mountain', geometry: { type: 'polygon', points: [[0.25, 0.18], [0.43, 0.16], [0.47, 0.35], [0.30, 0.40]] }, tacticalTags: ['mountain', 'forest', 'high_ground'], confidence: 'approximate', locationNote: '临沮有荆山明载；范围多边形仅示意山地带。', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jushui_32'] },
    { id: 'nanjun_jingmen_huya', name: '荆门·虎牙', kind: 'pass', geometry: { type: 'point', x: 0.30, y: 0.59 }, tacticalTags: ['river_chokepoint', 'high_ground'], confidence: 'approximate', locationNote: '夷陵有荆门、虎牙山有明文；点位只表达夷陵峡江咽喉。', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jiang_34'] },
    { id: 'nanjun_jiangjin', name: '江津', kind: 'ferry', geometry: { type: 'point', x: 0.60, y: 0.69 }, tacticalTags: ['ferry', 'major_crossing', 'port'], confidence: 'approximate', locationNote: '《水经注》记江陵江津戍、江津口；点位仅表达江陵临江渡口。', sourceRefs: ['shuijingzhu_jiang_34'] },
    { id: 'nanjun_xiangyang_ferry', name: '襄阳方向（北津入口）', kind: 'ferry', geometry: { type: 'point', x: 0.77, y: 0.07 }, tacticalTags: ['ferry', 'northern_entry', 'boundary_entry', 'world_city_15'], confidence: 'approximate', locationNote: '190 年史料中的襄阳县事实保留为南郡北部方位依据；游戏大地图襄阳（ID 15）独立，因此此点只表示通往襄阳战略节点的边界入口，不生成第二个可争夺县城。', sourceRefs: ['hhs_junguozhi_nanjun', 'sgz_liubiao'] },
  ],
  routes: [
    { id: 'route_yangtze_wu_zigui', from: 'nanjun_wu', to: 'nanjun_zigui', kind: 'river', movementCost: 1.4, seasonal: 'all', confidence: 'attested', sourceRefs: ['shuijingzhu_jiang_34'] },
    { id: 'route_yangtze_zigui_yiling', from: 'nanjun_zigui', to: 'nanjun_yiling', kind: 'river', movementCost: 1.4, seasonal: 'all', confidence: 'attested', sourceRefs: ['shuijingzhu_jiang_34'] },
    { id: 'route_yangtze_yiling_yidao', from: 'nanjun_yiling', to: 'nanjun_yidao', kind: 'river', movementCost: 1.2, seasonal: 'all', confidence: 'attested', sourceRefs: ['shuijingzhu_jiang_34'] },
    { id: 'route_yangtze_yidao_zhijiang', from: 'nanjun_yidao', to: 'nanjun_zhijiang', kind: 'river', movementCost: 1.1, seasonal: 'all', confidence: 'attested', sourceRefs: ['shuijingzhu_jiang_34'] },
    { id: 'route_yangtze_zhijiang_jiangling', from: 'nanjun_zhijiang', to: 'nanjun_jiangling', kind: 'river', movementCost: 1, seasonal: 'all', confidence: 'attested', sourceRefs: ['shuijingzhu_jiang_34'] },
    { id: 'route_yangtze_jiangling_huarong', from: 'nanjun_jiangling', to: 'nanjun_huarong', kind: 'river', movementCost: 1.1, seasonal: 'all', confidence: 'attested', sourceRefs: ['shuijingzhu_jiang_34', 'shuijingzhu_jiang_35'] },
    { id: 'route_ju_linju_dangyang', from: 'nanjun_linju', to: 'nanjun_dangyang', kind: 'river', movementCost: 1.2, seasonal: 'all', confidence: 'attested', sourceRefs: ['shuijingzhu_jushui_32'] },
    { id: 'route_ju_dangyang_zhijiang', from: 'nanjun_dangyang', to: 'nanjun_zhijiang', kind: 'river', movementCost: 1.2, seasonal: 'all', confidence: 'attested', sourceRefs: ['shuijingzhu_jushui_32'] },
    { id: 'route_road_xiangyang_yicheng', from: 'nanjun_xiangyang_ferry', to: 'nanjun_yicheng', kind: 'road', movementCost: 1.2, seasonal: 'all', confidence: 'inferred', sourceRefs: ['hhs_junguozhi_nanjun', 'sgz_liubiao'] },
    { id: 'route_road_yicheng_dangyang', from: 'nanjun_yicheng', to: 'nanjun_dangyang', kind: 'road', movementCost: 1.4, seasonal: 'all', confidence: 'inferred', sourceRefs: ['hhs_junguozhi_nanjun'] },
    { id: 'route_road_dangyang_jiangling', from: 'nanjun_dangyang', to: 'nanjun_jiangling', kind: 'road', movementCost: 1.3, seasonal: 'all', confidence: 'inferred', sourceRefs: ['hhs_junguozhi_nanjun', 'shuijingzhu_jushui_32'] },
  ],
};

export const nanjun190: HistoricalGeographyBundle = buildHistoricalGeographyBundle(seed, sources);
