// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { Officer, OfficerStats } from '@leh/shared';

type FaceShape = 'round' | 'long' | 'square' | 'sharp';
type CrownShape = 'royal' | 'warrior' | 'scholar' | 'guan';
type BeardShape = 'short' | 'long' | 'goatee' | 'wild';

type PortraitPreset = {
  image?: string;
  courtesy: string;
  clan: string;
  title: string;
  role: string;
  quote: string;
  ink: string;
  seal: string;
  face: FaceShape;
  crown: CrownShape;
  beard: BeardShape;
};

/**
 * 程序化五官路径常量（OfficerPortrait 列表缩略图 + ExpressionPortrait 详情页大头像共用）。
 * 路径坐标基于 viewBox 0 0 120 150。brow/eye/mouth 不在此处（由表情层 EXPRESSION_PATHS 覆盖）。
 *
 * Session 179 辨识度优化：加大 face/crown/beard 路径差异 + 新增 guan 武圣冠 +
 * 胡须标志性强化（关羽 long 更飘逸/吕布 wild 更狂乱）+ 色调色相差异化。
 */
export const FACE_PATHS: Record<FaceShape, string> = {
  // 曹操：宽圆脸（宽 37-83=46，高 46-86=40，近 1:1）
  round: 'M37 46 Q60 33 83 46 L79 86 Q60 103 41 86Z',
  // 诸葛亮：窄长脸（宽 44-76=32，高 41-93=52，0.6:1 明显长）
  long: 'M44 41 Q60 33 76 41 L72 93 Q60 109 48 93Z',
  // 关羽：方宽下颌（下颌 39-81 宽方，体现方额广颐）
  square: 'M37 44 Q60 35 83 44 L81 88 Q60 100 39 88Z',
  // 吕布：尖下颌（下颌尖到 60,103，体现虓虎锐相）
  sharp: 'M40 44 Q60 31 80 44 L66 84 L60 103 L54 84Z',
};

export const CROWN_RENDER: Record<CrownShape, { line: string; plume?: string; faint?: string; beads?: string; band?: string }> = {
  // 曹操帝冠：旒珠挂下（新增标志性细节，区分于其他冠冕）
  royal: {
    line: 'M36 43 L40 25 L80 25 84 43 M32 25 H88 M43 25 V15 M77 25 V15 M38 15 H82',
    beads: 'M42 26 Q43 33 42 40 M78 26 Q77 33 78 40',
    faint: 'M28 20 H92',
  },
  // 吕布武冠：双雉翎更夸张更长更弯（强化飞将识别度，区别于关羽盔缨）
  warrior: {
    line: 'M37 44 Q38 19 60 17 Q82 19 83 44 M39 30 H81 M45 22 L38 10 M75 22 L82 10',
    plume: 'M42 21 Q12 3 4 38 M78 21 Q108 3 116 38',
  },
  // 诸葛亮纶巾：加横带轮廓（新增标志性，区分于其他文冠）
  scholar: {
    line: 'M40 43 L43 21 H77 L80 43 M43 29 H77 M50 21 L48 10 H72 L70 21',
    band: 'M44 17 Q60 14 76 17',
    faint: 'M31 30 Q60 23 89 30',
  },
  // 关羽武圣冠（Session 179 新增）：无雉翎，盔缨短而上翘——区别于吕布雉翎的长弯外展
  guan: {
    line: 'M38 44 Q40 22 60 20 Q80 22 82 44 M40 32 H80 M48 24 L42 14 M72 24 L78 14',
    plume: 'M50 20 Q44 6 36 16 M70 20 Q76 6 84 16',
    faint: 'M44 36 H76',
  },
};

export const BEARD_PATHS: Record<BeardShape, string> = {
  short: 'M48 78 Q60 89 72 78 Q69 96 60 99 Q51 96 48 78Z',
  // 关羽长髯：更长更飘逸（延伸到 150，体现美髯公标志）
  long: 'M45 76 Q60 89 75 76 Q80 118 72 145 L60 150 48 145 Q40 118 45 76Z',
  goatee: 'M52 78 Q60 87 68 78 L64 112 60 123 56 112Z',
  // 吕布乱须：更狂乱分叉（增加分叉节点，体现虓虎狂态）
  wild: 'M42 74 Q60 92 78 74 L82 108 Q72 100 68 110 L60 122 52 110 Q48 100 38 108 L42 74Z',
};

const HERO_PRESETS: Record<number, PortraitPreset> = {
  1: { image: '/portraits/cao_cao.png', courtesy: '孟德', clan: '沛国曹氏', title: '魏武挥鞭', role: '雄主', quote: '设奇策，挟天子，定北方', ink: '#1e2a3d', seal: '#7a2820', face: 'round', crown: 'royal', beard: 'short' },
  4: { image: '/portraits/zhuge_liang.png', courtesy: '孔明', clan: '琅琊诸葛氏', title: '卧龙经略', role: '军师', quote: '隆中定策，鞠躬尽瘁', ink: '#2d4a3a', seal: '#6a3528', face: 'long', crown: 'scholar', beard: 'goatee' },
  5: { image: '/portraits/lv_bu.png', courtesy: '奉先', clan: '五原郡吕氏', title: '虓虎无双', role: '飞将', quote: '辕门射戟，勇冠并州', ink: '#4a1d2a', seal: '#a01820', face: 'sharp', crown: 'warrior', beard: 'wild' },
  6: { image: '/portraits/guan_yu.png', courtesy: '云长', clan: '河东关氏', title: '威震华夏', role: '名将', quote: '忠义凛然，水淹七军', ink: '#1e3a2d', seal: '#7a2818', face: 'square', crown: 'guan', beard: 'long' },
};

/**
 * 非原型武将的称号 fallback：从五维派生，不再取 tags 末项（避免把"义兄弟"
 * "匡扶汉室"等关系/政治标签当称号）。4 原型武将走 HERO_PRESETS 专属称号不受影响。
 *
 * 阈值参考 0-A 武将分布：95+ 为顶流（万人敌/神算），90+ 为一流（猛将/谋主），
 * 80+ 为二线（宿将/谋士/战将），85+ 统帅/名士为辅线。其余 fallback '时势英杰'。
 */
function deriveFallbackTitle(stats: OfficerStats): string {
  const { war, intelligence, leadership, politics, charisma } = stats;
  if (war >= 95) return '万人敌';
  if (intelligence >= 95) return '神算';
  if (war >= 90) return '猛将';
  if (intelligence >= 90) return '谋主';
  if (war >= 80 && leadership >= 80) return '宿将';
  if (intelligence >= 80) return '谋士';
  if (war >= 80) return '战将';
  if (leadership >= 85) return '统帅';
  if (politics >= 80) return '干吏';
  if (charisma >= 85) return '名士';
  return '时势英杰';
}

export function getOfficerProfile(officer: Officer): PortraitPreset {
  return HERO_PRESETS[officer.id] ?? {
    courtesy: '',
    clan: officer.tags.slice(0, 2).join(' · ') || '汉末人物',
    title: deriveFallbackTitle(officer.stats),
    role: officer.stats.war >= 80 ? '武将' : officer.stats.intelligence >= 80 ? '谋臣' : '官吏',
    quote: '生逢乱世，各秉其志',
    ink: '#3f3a32',
    seal: '#81332d',
    face: officer.id % 2 ? 'square' : 'long',
    crown: officer.stats.war >= officer.stats.intelligence ? 'warrior' : 'scholar',
    beard: officer.id % 3 === 0 ? 'goatee' : 'short',
  };
}

/**
 * 渲染冠冕全部分支 path（line/plume/faint/beads/band）。供 OfficerPortrait 与
 * ExpressionPortrait 共用，避免两边分叉。
 */
export function renderCrownPaths(crown: CrownShape) {
  const c = CROWN_RENDER[crown];
  return (
    <>
      <path className="portrait-line portrait-crown" d={c.line} />
      {c.plume && <path className="portrait-plume" d={c.plume} />}
      {c.faint && <path className="portrait-faint" d={c.faint} />}
      {c.beads && <path className="portrait-faint" d={c.beads} />}
      {c.band && <path className="portrait-faint" d={c.band} />}
    </>
  );
}

export function OfficerPortrait({ officer, compact = false }: { officer: Officer; compact?: boolean }) {
  const p = getOfficerProfile(officer);

  return (
    <div className={`officer-portrait ${compact ? 'officer-portrait--compact' : ''}`} style={{ '--portrait-ink': p.ink, '--portrait-seal': p.seal } as React.CSSProperties} aria-label={`${officer.name}${p.courtesy ? `，字${p.courtesy}` : ''}头像`}>
      {p.image ? <img className="portrait-image" src={p.image} alt="" aria-hidden="true" /> : <svg viewBox="0 0 120 150" role="img" aria-hidden="true">
        <defs><filter id={`rough-${officer.id}`}><feTurbulence baseFrequency="0.035" numOctaves="3" seed={officer.id} result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.3"/></filter></defs>
        <path className="portrait-halo" d="M22 130 Q16 80 33 39 Q60 8 87 39 Q104 80 98 130Z" />
        <g filter={`url(#rough-${officer.id})`}>
          <path className="portrait-robe" d="M20 150 Q25 105 48 91 L72 91 Q95 105 100 150Z" />
          <path className="portrait-face" d={FACE_PATHS[p.face]} />
          {renderCrownPaths(p.crown)}
          <path className="portrait-brow" d={p.face === 'sharp' ? 'M45 55 L56 58 M75 55 L64 58' : p.face === 'square' ? 'M44 54 Q50 50 56 54 M76 54 Q70 50 64 54' : 'M45 55 Q51 53 56 55 M75 55 Q69 53 64 55'} />
          <path className="portrait-eye" d="M46 61 Q51 64 56 61 M74 61 Q69 64 64 61" />
          <path className="portrait-faint" d="M60 62 L58 73 63 74" />
          <path className="portrait-beard" d={BEARD_PATHS[p.beard]} />
          <path className="portrait-faint" d="M43 112 L60 132 77 112 M60 132 V150" />
        </g>
      </svg>}
      {!compact && <><span className="portrait-clan">{p.clan}</span><span className="portrait-seal">{officer.name}</span><span className="portrait-ribbon" /></>}
    </div>
  );
}
