// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S20-W3: PCG 水墨山脉纯函数引擎 (inkMountains.ts)
 *
 * 规格：
 * - 纯数学确定性算法，零外部美术资产依赖；
 * - 依据种子与视口分辨率生成古典水墨山水画的层峦叠嶂（远山青黛、烟岚中峰、近景重峦）；
 * - 多重谐波叠加与确定性分形细分，像素级跨平台重现；
 * - 导出纯几何点集数据与 Canvas 2D / SVG 路径，支持 60 FPS 动态视差与静态渲染。
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface InkMountainLayer {
  layerIndex: number;
  name: string;
  fill: string;
  stroke: string;
  opacity: number;
  points: Point2D[];
  pathString: string;
}

export interface InkMountainOptions {
  width?: number;
  height?: number;
  seed?: number;
  layerCount?: number;
  baseElevation?: number; // 0.0 ~ 1.0 (基准山线高度)
}

function createDeterministicRng(seed: number) {
  let s = (seed ^ 0x6d2b79f5) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const MOUNTAIN_LAYER_CONFIGS = [
  {
    name: '青黛远山',
    fill: '#242a35',
    stroke: '#3b4554',
    opacity: 0.35,
    elevationFactor: 0.42,
    roughness: 0.12,
    octaves: 3,
  },
  {
    name: '烟岚中峰',
    fill: '#181e26',
    stroke: '#28323f',
    opacity: 0.65,
    elevationFactor: 0.58,
    roughness: 0.22,
    octaves: 4,
  },
  {
    name: '近景重峦',
    fill: '#0d1117',
    stroke: '#1c2430',
    opacity: 0.9,
    elevationFactor: 0.72,
    roughness: 0.32,
    octaves: 5,
  },
];

/**
 * 依据种子和多重正弦谐波生成确定性连续山脊轮廓
 */
function generateRidgeHeight(
  xRatio: number,
  octaves: number,
  roughness: number,
  rng: () => number,
): number {
  let elevation = 0;
  let amplitude = 1.0;
  let frequency = 1.0;
  let maxAmp = 0;

  for (let o = 0; o < octaves; o++) {
    const phase = rng() * Math.PI * 2;
    const wave = Math.sin(xRatio * Math.PI * (2 + o * 3) * frequency + phase);
    elevation += wave * amplitude;
    maxAmp += amplitude;
    amplitude *= roughness;
    frequency *= 2.1;
  }

  return elevation / maxAmp;
}

/**
 * 生成全部分层水墨山峦几何数据
 */
export function generateInkMountainLayers(options: InkMountainOptions = {}): InkMountainLayer[] {
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const seed = options.seed ?? 190;
  const layerCount = Math.min(options.layerCount ?? 3, MOUNTAIN_LAYER_CONFIGS.length);
  const segments = 48; // 水平细分段数

  const rng = createDeterministicRng(seed);
  const layers: InkMountainLayer[] = [];

  for (let l = 0; l < layerCount; l++) {
    const config = MOUNTAIN_LAYER_CONFIGS[l];
    const baseLine = height * (options.baseElevation ?? config.elevationFactor);
    const amp = height * 0.18 * (0.8 + l * 0.3);

    // 为当前层采样山脊点
    const ridgePoints: Point2D[] = [];
    for (let s = 0; s <= segments; s++) {
      const xRatio = s / segments;
      const x = Math.round(xRatio * width);
      // 利用多重谐波结合局部分形扰动
      const hNorm = generateRidgeHeight(xRatio, config.octaves, config.roughness, rng);
      const y = Math.round(baseLine - hNorm * amp);
      ridgePoints.push({ x, y });
    }

    // 闭合底边与侧边点构成完整多边形 (右下角 -> 左下角)
    const polygonPoints: Point2D[] = [
      ...ridgePoints,
      { x: width, y: height },
      { x: 0, y: height },
    ];

    // 构建 SVG 路径字符
    const dParts: string[] = [`M ${polygonPoints[0].x} ${polygonPoints[0].y}`];
    for (let i = 1; i < polygonPoints.length; i++) {
      dParts.push(`L ${polygonPoints[i].x} ${polygonPoints[i].y}`);
    }
    dParts.push('Z');
    const pathString = dParts.join(' ');

    layers.push({
      layerIndex: l,
      name: config.name,
      fill: config.fill,
      stroke: config.stroke,
      opacity: config.opacity,
      points: polygonPoints,
      pathString,
    });
  }

  return layers;
}

export interface CanvasContextLike {
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  globalAlpha?: number;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  arc(x: number, y: number, r: number, sa: number, ea: number): void;
  rect(x: number, y: number, w: number, h: number): void;
}

/**
 * Canvas 2D 上下文命令式渲染辅助函数
 */
export function renderInkMountains(
  ctx: CanvasContextLike,
  layers: InkMountainLayer[],
): void {
  for (const layer of layers) {
    if (layer.points.length === 0) continue;
    ctx.globalAlpha = layer.opacity;
    ctx.fillStyle = layer.fill;
    ctx.strokeStyle = layer.stroke;

    ctx.beginPath();
    ctx.moveTo(layer.points[0].x, layer.points[0].y);
    for (let i = 1; i < layer.points.length; i++) {
      ctx.lineTo(layer.points[i].x, layer.points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
