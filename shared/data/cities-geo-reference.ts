// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Eastern Han 13-province commandery geography reference.
 *
 * Coordinate workflow (Phase 0-A):
 * 1. lon/lat = 治所 WGS84（Google Maps 史实）
 * 2. x/y = 等距圆柱 equirectangular（与 client/public/geo-basemap.png 同 bounds）
 *
 * 底图 = Natural Earth 50m 陆地/河流（scripts/render-geo-basemap.py），
 * 非用户插画 map.png（插画投影不均，无法与经纬度对齐）。
 */

export interface CityGeoRef {
  /** Stable geo id 1..105 (same order as docs/08 13州清单) */
  id: number;
  name: string;
  province: string;
  lon: number;
  lat: number;
  x: number;
  y: number;
  seatProxy: string;
}

/** Google Maps WGS84 seat; pixel derived by equirectangular projection. */
export interface GameSeatGeo {
  /** WGS84 longitude (Google Maps) */
  lon: number;
  /** WGS84 latitude (Google Maps) */
  lat: number;
}

/**
 * Map canvas size + geographic bounds (equirectangular).
 * lon 95~130°E, lat 18~45°N covers Eastern Han core + 交州/辽东.
 * Aspect ratio matches degrees so shapes are not stretched.
 * Width 8192 (~8K) so zoom stays sharp; height = width * latSpan/lonSpan.
 */
export const MAP_GEO = {
  width: 8192,
  height: 6320,
  lonMin: 95,
  lonMax: 130,
  latMin: 18,
  latMax: 45,
} as const;

/**
 * Phase 0-A 30 治所：仅存 Google Maps WGS84。
 * 显示像素由 lonLatToPixel 投影，禁止手写 x/y。
 */
export const GAME_SEAT_GEO: Readonly<Record<string, GameSeatGeo>> = {
  河南尹: { lon: 112.454, lat: 34.6197 }, // 洛阳
  京兆尹: { lon: 108.9402, lat: 34.3416 }, // 长安
  颍川郡: { lon: 113.383, lat: 34.404 }, // 阳翟
  汝南郡: { lon: 114.622, lat: 32.962 }, // 平舆
  魏郡: { lon: 114.478, lat: 36.335 }, // 邺
  常山国: { lon: 114.57, lat: 38.146 }, // 真定
  陈留郡: { lon: 114.35, lat: 34.8 }, // 陈留
  东郡: { lon: 115.029, lat: 35.761 }, // 濮阳
  下邳国: { lon: 117.18, lat: 34.26 }, // 下邳/徐州
  广陵郡: { lon: 119.42, lat: 32.393 }, // 广陵
  平原郡: { lon: 116.43, lat: 37.165 }, // 平原
  北海国: { lon: 119.1, lat: 36.72 }, // 剧县
  南阳郡: { lon: 112.528, lat: 32.99 }, // 宛
  南郡: { lon: 112.19, lat: 30.352 }, // 江陵
  襄阳: { lon: 112.122, lat: 32.009 }, // 襄阳
  吴郡: { lon: 120.62, lat: 31.299 }, // 吴
  丹阳郡: { lon: 118.78, lat: 32.04 }, // 建业
  九江郡: { lon: 116.78, lat: 32.57 }, // 寿春
  蜀郡: { lon: 104.066, lat: 30.657 }, // 成都
  汉中郡: { lon: 107.03, lat: 33.07 }, // 汉中
  巴郡: { lon: 106.551, lat: 29.563 }, // 江州
  汉阳郡: { lon: 105.72, lat: 34.58 }, // 冀县/天水
  武威郡: { lon: 102.638, lat: 37.928 }, // 姑臧
  太原郡: { lon: 112.549, lat: 37.87 }, // 晋阳
  上党郡: { lon: 113.12, lat: 36.195 }, // 壶关
  涿郡: { lon: 115.974, lat: 39.485 }, // 涿
  广阳郡: { lon: 116.407, lat: 39.904 }, // 蓟
  辽东郡: { lon: 123.43, lat: 41.8 }, // 襄平
  南海郡: { lon: 113.264, lat: 23.129 }, // 番禺
  交趾郡: { lon: 105.85, lat: 21.028 }, // 龙编
};

function clampPixel(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(MAP_GEO.width - 1, Math.max(0, Math.round(x))),
    y: Math.min(MAP_GEO.height - 1, Math.max(0, Math.round(y))),
  };
}

/**
 * WGS84 → 程序化地图像素（等距圆柱）。
 * x 随 lon 线性，y 随 lat 线性（北在上）。
 */
export function lonLatToPixel(lon: number, lat: number): { x: number; y: number } {
  const { width, height, lonMin, lonMax, latMin, latMax } = MAP_GEO;
  const x = ((lon - lonMin) / (lonMax - lonMin)) * width;
  const y = ((latMax - lat) / (latMax - latMin)) * height;
  return clampPixel(x, y);
}

/** Inverse of lonLatToPixel (for debug / UI). */
export function pixelToLonLat(x: number, y: number): { lon: number; lat: number } {
  const { width, height, lonMin, lonMax, latMin, latMax } = MAP_GEO;
  const lon = lonMin + (x / width) * (lonMax - lonMin);
  const lat = latMax - (y / height) * (latMax - latMin);
  return { lon, lat };
}

/** @deprecated alias — same as GAME_SEAT_GEO lon/lat only */
export const GAME_SEAT_LON_LAT: Readonly<Record<string, { lon: number; lat: number }>> =
  GAME_SEAT_GEO;

/** Project seat lon/lat (Google) to map display pixel. */
export function getGameSeatPixel(adminName: string): { x: number; y: number } | undefined {
  const seat = GAME_SEAT_GEO[adminName];
  if (!seat) return undefined;
  return lonLatToPixel(seat.lon, seat.lat);
}

export function googleMapsUrl(lon: number, lat: number): string {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

/** Approximate major rivers as lon/lat polylines (schematic, for procedural map). */
export const RIVER_SCHEMATICS: ReadonlyArray<{
  name: string;
  points: ReadonlyArray<[number, number]>;
}> = [
  {
    name: '黄河',
    points: [
      [100.2, 37.5],
      [103.0, 36.0],
      [106.5, 35.0],
      [109.0, 34.5],
      [110.5, 34.8],
      [112.5, 34.9],
      [114.5, 35.0],
      [116.5, 36.5],
      [118.0, 37.5],
      [119.0, 37.8],
    ],
  },
  {
    name: '长江',
    points: [
      [99.5, 28.0],
      [103.5, 29.5],
      [106.5, 29.6],
      [108.5, 30.5],
      [111.0, 30.4],
      [112.2, 30.3],
      [114.3, 30.5],
      [116.5, 29.8],
      [118.8, 32.0],
      [120.5, 31.5],
      [121.5, 31.3],
    ],
  },
];

/** Province label anchors (approx centroid lon/lat). */
export const PROVINCE_LABELS: ReadonlyArray<{ name: string; lon: number; lat: number }> = [
  { name: '司隶', lon: 111.5, lat: 34.5 },
  { name: '豫州', lon: 114.5, lat: 33.5 },
  { name: '冀州', lon: 115.0, lat: 37.5 },
  { name: '兖州', lon: 116.0, lat: 35.5 },
  { name: '徐州', lon: 117.5, lat: 34.0 },
  { name: '青州', lon: 118.5, lat: 36.8 },
  { name: '荆州', lon: 112.0, lat: 31.0 },
  { name: '扬州', lon: 118.5, lat: 31.5 },
  { name: '益州', lon: 105.0, lat: 30.5 },
  { name: '凉州', lon: 103.0, lat: 36.5 },
  { name: '并州', lon: 112.5, lat: 38.0 },
  { name: '幽州', lon: 118.0, lat: 40.5 },
  { name: '交州', lon: 110.0, lat: 22.5 },
];

/** Raw seats: [id, name, province, lon, lat, seatProxy] — lon/lat for 0-B */
const SEATS: readonly [number, string, string, number, number, string][] = [
  [1, '河南尹', '司隶', 112.454, 34.6197, '洛阳'],
  [2, '河内郡', '司隶', 113.4, 35.1, '武陟/怀'],
  [3, '河东郡', '司隶', 111.0, 35.03, '运城安邑'],
  [4, '弘农郡', '司隶', 110.85, 34.52, '灵宝'],
  [5, '京兆尹', '司隶', 108.9402, 34.3416, '西安长安'],
  [6, '左冯翊', '司隶', 109.6, 34.8, '大荔'],
  [7, '右扶风', '司隶', 108.45, 34.3, '兴平'],
  [8, '颍川郡', '豫州', 113.83, 34.03, '禹州'],
  [9, '汝南郡', '豫州', 114.35, 33.0, '平舆/汝南'],
  [10, '梁国', '豫州', 115.15, 34.45, '商丘'],
  [11, '沛国', '豫州', 116.75, 33.95, '濉溪/沛'],
  [12, '陈国', '豫州', 114.88, 33.75, '淮阳'],
  [13, '鲁国', '豫州', 117.0, 35.58, '曲阜'],
  [14, '魏郡', '冀州', 114.478, 36.335, '临漳/邺'],
  [15, '钜鹿郡', '冀州', 114.98, 37.22, '平乡'],
  [16, '常山国', '冀州', 114.48, 38.04, '石家庄正定'],
  [17, '中山国', '冀州', 115.15, 38.52, '定州'],
  [18, '安平国', '冀州', 115.52, 37.7, '安平/冀州'],
  [19, '河间国', '冀州', 116.1, 38.45, '献县/河间'],
  [20, '清河国', '冀州', 115.7, 37.05, '清河'],
  [21, '赵国', '冀州', 114.5, 37.07, '邯郸'],
  [22, '勃海郡', '冀州', 117.0, 38.0, '南皮'],
  [23, '陈留郡', '兖州', 114.35, 34.8, '开封陈留'],
  [24, '东郡', '兖州', 115.45, 35.7, '濮阳'],
  [25, '东平国', '兖州', 116.47, 35.94, '东平'],
  [26, '任城国', '兖州', 116.58, 35.42, '济宁'],
  [27, '泰山郡', '兖州', 117.13, 36.2, '泰安'],
  [28, '济北国', '兖州', 116.8, 36.2, '长清'],
  [29, '山阳郡', '兖州', 116.1, 35.4, '金乡/巨野'],
  [30, '济阴郡', '兖州', 115.45, 35.25, '定陶'],
  [31, '东海郡', '徐州', 118.35, 34.6, '郯城'],
  [32, '琅邪国', '徐州', 118.35, 35.05, '临沂'],
  [33, '彭城国', '徐州', 117.18, 34.26, '徐州'],
  [34, '广陵郡', '徐州', 119.42, 32.393, '扬州'],
  [35, '下邳国', '徐州', 118.0, 34.15, '睢宁/邳州'],
  [36, '济南国', '青州', 117.0, 36.65, '济南'],
  [37, '平原郡', '青州', 116.43, 37.165, '平原'],
  [38, '乐安国', '青州', 118.05, 37.15, '博兴'],
  [39, '北海国', '青州', 119.1, 36.72, '剧县/昌乐'],
  [40, '东莱郡', '青州', 120.75, 37.8, '龙口/黄县'],
  [41, '齐国', '青州', 118.05, 36.8, '临淄'],
  [42, '南阳郡', '荆州', 112.528, 32.99, '南阳'],
  [43, '南郡', '荆州', 112.19, 30.352, '江陵'],
  [44, '江夏郡', '荆州', 114.3, 30.55, '武汉云梦'],
  [45, '零陵郡', '荆州', 111.6, 26.22, '永州'],
  [46, '桂阳郡', '荆州', 113.0, 25.8, '郴州'],
  [47, '武陵郡', '荆州', 111.7, 29.05, '常德'],
  [48, '长沙郡', '荆州', 112.98, 28.2, '长沙'],
  [49, '九江郡', '扬州', 116.78, 32.57, '寿春/寿县'],
  [50, '丹阳郡', '扬州', 118.78, 32.04, '建业/南京'],
  [51, '庐江郡', '扬州', 117.28, 31.25, '舒城/庐江'],
  [52, '会稽郡', '扬州', 120.58, 30.0, '绍兴'],
  [53, '吴郡', '扬州', 120.62, 31.299, '苏州'],
  [54, '豫章郡', '扬州', 115.89, 28.68, '南昌'],
  [55, '汉中郡', '益州', 107.03, 33.07, '汉中'],
  [56, '巴郡', '益州', 106.551, 29.563, '重庆'],
  [57, '广汉郡', '益州', 104.68, 31.13, '广汉/雒'],
  [58, '蜀郡', '益州', 104.066, 30.657, '成都'],
  [59, '犍为郡', '益州', 103.75, 29.55, '彭山'],
  [60, '牂牁郡', '益州', 106.7, 26.6, '贵阳/且兰'],
  [61, '越巂郡', '益州', 102.27, 27.88, '西昌'],
  [62, '益州郡', '益州', 102.7, 25.05, '晋宁/滇池'],
  [63, '永昌郡', '益州', 100.23, 25.6, '保山'],
  [64, '广汉属国', '益州', 104.4, 32.3, '江油'],
  [65, '蜀郡属国', '益州', 103.0, 30.0, '雅安'],
  [66, '犍为属国', '益州', 104.6, 28.8, '宜宾'],
  [67, '陇西郡', '凉州', 104.63, 35.0, '临洮'],
  [68, '汉阳郡', '凉州', 105.72, 34.58, '天水冀县'],
  [69, '武都郡', '凉州', 105.3, 33.4, '成县'],
  [70, '金城郡', '凉州', 103.6, 36.1, '兰州西'],
  [71, '安定郡', '凉州', 106.7, 35.6, '镇原'],
  [72, '北地郡', '凉州', 107.4, 36.0, '宁县'],
  [73, '武威郡', '凉州', 102.638, 37.928, '武威'],
  [74, '张掖郡', '凉州', 100.45, 38.93, '张掖'],
  [75, '酒泉郡', '凉州', 98.5, 39.73, '酒泉'],
  [76, '敦煌郡', '凉州', 94.66, 40.14, '敦煌'],
  [77, '张掖属国', '凉州', 100.2, 39.2, '张掖北'],
  [78, '居延属国', '凉州', 101.1, 41.8, '额济纳'],
  [79, '上党郡', '并州', 113.12, 36.195, '长治'],
  [80, '太原郡', '并州', 112.549, 37.87, '太原'],
  [81, '上郡', '并州', 109.5, 37.6, '榆林南'],
  [82, '西河郡', '并州', 111.15, 37.45, '离石'],
  [83, '五原郡', '并州', 110.05, 40.6, '包头西'],
  [84, '云中郡', '并州', 111.65, 40.55, '托克托'],
  [85, '定襄郡', '并州', 112.5, 40.1, '和林格尔'],
  [86, '雁门郡', '并州', 112.95, 39.35, '代县'],
  [87, '朔方郡', '并州', 107.4, 40.75, '磴口'],
  [88, '涿郡', '幽州', 115.974, 39.485, '涿州'],
  [89, '广阳郡', '幽州', 116.407, 39.904, '北京蓟'],
  [90, '代郡', '幽州', 114.15, 40.4, '蔚县'],
  [91, '上谷郡', '幽州', 115.5, 40.4, '怀来'],
  [92, '渔阳郡', '幽州', 116.85, 40.38, '密云'],
  [93, '右北平郡', '幽州', 118.2, 40.0, '遵化'],
  [94, '辽西郡', '幽州', 120.45, 41.0, '义县'],
  [95, '辽东郡', '幽州', 123.43, 41.8, '辽阳'],
  [96, '玄菟郡', '幽州', 125.35, 41.8, '抚顺'],
  [97, '乐浪郡', '幽州', 125.75, 39.0, '平壤'],
  [98, '辽东属国', '幽州', 122.0, 41.1, '朝阳'],
  [99, '南海郡', '交州', 113.264, 23.129, '广州'],
  [100, '苍梧郡', '交州', 111.28, 23.48, '梧州'],
  [101, '郁林郡', '交州', 109.4, 22.8, '桂平'],
  [102, '合浦郡', '交州', 109.2, 21.66, '合浦'],
  [103, '交趾郡', '交州', 105.85, 21.028, '河内'],
  [104, '九真郡', '交州', 105.9, 19.8, '清化'],
  [105, '日南郡', '交州', 107.6, 16.5, '顺化'],
];

function build(): CityGeoRef[] {
  return SEATS.map(([id, name, province, lon, lat, seatProxy]) => {
    const { x, y } = lonLatToPixel(lon, lat);
    return { id, name, province, lon, lat, x, y, seatProxy };
  });
}

export const CITIES_GEO_REFERENCE: CityGeoRef[] = build();

const EXTRA_SEATS: readonly [string, string, number, number, string][] = [
  ['襄阳', '荆州', 112.122, 32.009, '襄阳'],
];

export const EXTRA_GEO_LABELS: CityGeoRef[] = EXTRA_SEATS.map(
  ([name, province, lon, lat, seatProxy], i) => {
    const { x, y } = lonLatToPixel(lon, lat);
    return { id: -(i + 1), name, province, lon, lat, x, y, seatProxy };
  },
);

export function getCityGeoByName(name: string): CityGeoRef | undefined {
  return (
    CITIES_GEO_REFERENCE.find((c) => c.name === name) ??
    EXTRA_GEO_LABELS.find((c) => c.name === name)
  );
}

export function getCityGeoById(id: number): CityGeoRef | undefined {
  return CITIES_GEO_REFERENCE.find((c) => c.id === id);
}
