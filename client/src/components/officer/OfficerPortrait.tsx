// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo } from 'react';
import type { Officer, OfficerStats } from '@leh/shared';
import { deriveAvatarGeneTable, getAvatarGene, ribbonColorForRank, type AvatarGene } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

type FaceShape = 'round' | 'long' | 'square' | 'sharp' | 'oval' | 'broad';
type CrownShape = 'royal' | 'warrior' | 'scholar' | 'guan' | 'tied' | 'helm' | 'cap' | 'plume' | 'hood' | 'jade';
type BeardShape = 'short' | 'long' | 'goatee' | 'wild' | 'stubble' | 'forked' | 'bushy' | 'thin';

/** 基因序号 → 形状键（shared/avatar-gene.ts AVATAR_GENE_COUNTS 一一对应）。 */
export const FACE_GENE_KEYS: readonly FaceShape[] = ['round', 'long', 'square', 'sharp', 'oval', 'broad'];
export const CROWN_GENE_KEYS: readonly CrownShape[] = ['royal', 'warrior', 'scholar', 'guan', 'tied', 'helm', 'cap', 'plume', 'hood', 'jade'];
export const BEARD_GENE_KEYS: readonly BeardShape[] = ['short', 'long', 'goatee', 'wild', 'stubble', 'forked', 'bushy', 'thin'];

type PortraitPreset = {
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
 * 批次③（Session 409）P5-10 扩容至 6 脸 / 10 冠 / 8 须（ArtDirection.md §五 C 层），
 * 形状由 avatarGene 驱动（shared/avatar-gene.ts 哈希派生 + officers.json 手工策展）。
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
  // 批次③新增：椭圆均衡脸
  oval: 'M42 44 Q60 34 78 44 L74 90 Q60 105 46 90Z',
  // 批次③新增：阔面宽颐
  broad: 'M34 47 Q60 36 86 47 L82 84 Q60 100 38 84Z',
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
  // —— 批次③新增六冠 ——
  tied: { // 束发儒巾
    line: 'M42 44 Q42 24 60 22 Q78 24 78 44 M42 32 Q60 27 78 32 M50 22 V14 H70 V22',
    faint: 'M38 38 H82',
  },
  helm: { // 铁盔
    line: 'M38 44 Q38 20 60 18 Q82 20 82 44 M36 34 H84 M44 18 L48 10 M76 18 L72 10',
    faint: 'M40 40 H80',
  },
  cap: { // 平顶帻
    line: 'M40 44 L42 24 H78 L80 44 M40 24 H80 M46 24 V17 H74 V24',
  },
  plume: { // 鹖冠（双直翎）
    line: 'M40 44 Q42 22 60 20 Q78 22 80 44 M42 33 H78',
    plume: 'M56 20 Q58 4 66 12 M64 20 Q70 6 78 16',
  },
  hood: { // 风帽
    line: 'M38 46 Q36 20 60 18 Q84 20 82 46 M40 30 Q60 22 80 30 M42 44 Q60 38 78 44',
  },
  jade: { // 玉冠
    line: 'M44 44 L46 26 Q60 20 74 26 L76 44 M46 32 H74',
    beads: 'M52 26 Q53 20 60 18 Q67 20 68 26',
  },
};

export const BEARD_PATHS: Record<BeardShape, string> = {
  short: 'M48 78 Q60 89 72 78 Q69 96 60 99 Q51 96 48 78Z',
  // 关羽长髯：更长更飘逸（延伸到 150，体现美髯公标志）
  long: 'M45 76 Q60 89 75 76 Q80 118 72 145 L60 150 48 145 Q40 118 45 76Z',
  goatee: 'M52 78 Q60 87 68 78 L64 112 60 123 56 112Z',
  // 吕布乱须：更狂乱分叉（增加分叉节点，体现虓虎狂态）
  wild: 'M42 74 Q60 92 78 74 L82 108 Q72 100 68 110 L60 122 52 110 Q48 100 38 108 L42 74Z',
  // —— 批次③新增四须 ——
  stubble: 'M49 78 Q60 90 71 78 Q69 90 60 93 Q51 90 49 78Z', // 疏髯
  forked: 'M48 77 Q54 86 60 84 Q66 86 72 77 L69 96 64 90 60 98 56 90 51 96Z', // 分须
  bushy: 'M42 72 Q60 88 78 72 L80 92 Q70 104 60 102 Q50 104 40 92Z', // 络腮
  thin: 'M52 79 Q60 86 68 79 L66 100 60 106 54 100Z', // 细须
};

/** 眉眼七式（批次③；ExpressionPortrait 的表情层按 ExpressionId 覆盖同区域）。 */
export const BROW_EYE_PATHS: readonly { brow: string; eye: string }[] = [
  { brow: 'M45 55 Q51 53 56 55 M75 55 Q69 53 64 55', eye: 'M46 61 Q51 63 56 61 M74 61 Q69 63 64 61' }, // 0 平眉凤眼
  { brow: 'M44 53 L56 51 M76 53 L64 51', eye: 'M45 61 Q51 65 57 61 M75 61 Q69 65 63 61' }, // 1 剑眉环眼
  { brow: 'M44 54 Q51 50 57 53 M76 54 Q69 50 63 53', eye: 'M46 62 Q51 59 56 62 M74 62 Q69 59 64 62' }, // 2 卧蚕眉细眼
  { brow: 'M43 52 L57 56 M77 52 L63 56', eye: 'M45 60 Q51 64 57 60 M75 60 Q69 64 63 60' }, // 3 浓眉怒目
  { brow: 'M45 56 Q51 55 56 57 M75 56 Q69 55 64 57', eye: 'M46 63 Q51 60 56 63 M74 63 Q69 60 64 63' }, // 4 淡眉垂目
  { brow: 'M44 52 Q51 49 57 52 M76 52 Q69 49 63 52', eye: 'M45 60 Q51 64 57 60 M75 60 Q69 64 63 60' }, // 5 英眉朗目
  { brow: 'M45 52 Q51 56 56 58 M75 52 Q69 56 64 58', eye: 'M46 62 Q51 65 56 62 M74 62 Q69 65 64 62' }, // 6 八字眉眯眼
];

const HERO_TEXT_PRESETS: Record<number, Pick<PortraitPreset, 'courtesy' | 'title' | 'role' | 'quote' | 'ink' | 'seal'>> = {
  1: { courtesy: '孟德', title: '魏武挥鞭', role: '雄主', quote: '设奇策，挟天子，定北方', ink: '#1e2a3d', seal: '#7a2820' },
  4: { courtesy: '孔明', title: '卧龙经略', role: '军师', quote: '隆中定策，鞠躬尽瘁', ink: '#2d4a3a', seal: '#6a3528' },
  5: { courtesy: '奉先', title: '虓虎无双', role: '飞将', quote: '辕门射戟，勇冠并州', ink: '#4a1d2a', seal: '#a01820' },
  6: { courtesy: '云长', title: '威震华夏', role: '名将', quote: '忠义凛然，水淹七军', ink: '#1e3a2d', seal: '#7a2818' },
};

/**
 * 非原型武将的称号 fallback：从五维派生，不再取 tags 末项（避免把"义兄弟"
 * "匡扶汉室"等关系/政治标签当称号）。4 原型武将走专属称号不受影响。
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

/**
 * 文字身份（字/称号/墨朱色调）+ 基因形状（face/crown/beard 由 avatarGene 驱动）。
 * gene 缺省时按单将哈希派生（无名册上下文的场景）。
 */
export function getOfficerProfile(officer: Officer, gene?: AvatarGene): PortraitPreset {
  const g = gene ?? getAvatarGene(officer);
  const hero = HERO_TEXT_PRESETS[officer.id];
  const clan = g.clanTitle ?? `${officer.name.slice(0, 1)}氏`;
  return {
    courtesy: hero?.courtesy ?? '',
    clan,
    title: hero?.title ?? deriveFallbackTitle(officer.stats),
    role: hero?.role ?? (officer.stats.war >= 80 ? '武将' : officer.stats.intelligence >= 80 ? '谋臣' : '官吏'),
    quote: hero?.quote ?? '生逢乱世，各秉其志',
    ink: hero?.ink ?? '#3f3a32',
    seal: hero?.seal ?? '#81332d',
    face: FACE_GENE_KEYS[g.faceType] ?? 'oval',
    crown: CROWN_GENE_KEYS[g.hairType] ?? 'cap',
    beard: BEARD_GENE_KEYS[g.beardType] ?? 'short',
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

/** A′ 拓影层（批次③）：按文武分型的程序化剪影纹，multiply ≤0.18，免扫描 PNG（§五）。 */
export function renderRubbingTexture(
  officerId: number,
  baseRubbing: 'warrior' | 'scholar' | 'servant' | 'royal',
) {
  const jitter = (officerId % 5) * 3;
  const paths =
    baseRubbing === 'warrior'
      ? [
          `M18 ${44 + jitter} L60 ${30 + jitter} L102 ${46 + jitter}`,
          `M24 ${70 - jitter} Q60 ${58 - jitter} 96 ${72 - jitter}`,
          `M30 108 L60 96 L90 110`,
        ]
      : baseRubbing === 'servant'
        ? [ // 龙套：细密短纹
            `M30 46 L50 42 M70 42 L90 46`,
            `M34 66 L54 62 L74 66 L94 62`,
            `M36 86 L56 82 L76 86 L96 82`,
          ]
        : baseRubbing === 'royal'
          ? [ // 君主：环纹与冕旒弧
              `M60 34 Q88 34 92 62`,
              `M60 34 Q32 34 28 62`,
              `M24 ${74 + jitter} Q60 ${62 + jitter} 96 ${74 + jitter}`,
            ]
          : [
              `M22 ${38 + jitter} Q60 ${30 + jitter} 98 ${38 + jitter}`,
              `M20 ${62 - jitter} H100`,
              `M26 ${86 + jitter} Q60 ${76 + jitter} 94 ${86 + jitter}`,
            ];
  return (
    <g className="portrait-rubbing">
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}

const RIBBON_COLOR: Record<'purple' | 'cyan' | 'black' | 'yellow', string> = {
  purple: '#6B3FA0',
  cyan: '#2E5E4E',
  yellow: '#C9A227',
  black: '#3f3a32',
};

/** officeSeal 动态官职印（批次③余项 · Session 418）：在职官职取单字篆印，无官职用姓名。 */
export function officeSealText(officer: Officer): string {
  const mil = String(officer.militaryPosition ?? 'none');
  const civ = String(officer.civilPosition ?? 'none');
  const MIL_CHAR: Record<string, string> = { captain: '尉', colonel: '校', general: '将', grandGeneral: '帅' };
  const CIV_CHAR: Record<string, string> = { clerk: '吏', magistrate: '令', prefect: '守', governor: '牧', chancellor: '相' };
  if (mil !== 'none') return MIL_CHAR[mil] ?? officer.name.slice(0, 1);
  if (civ !== 'none') return CIV_CHAR[civ] ?? officer.name.slice(0, 1);
  return officer.name;
}

/** A′ 拓影分型的运行时细分：君主→royal，无势力→servant（存储基因仅 warrior/scholar）。 */
export function resolveRubbingStyle(
  officer: Officer,
  base: 'warrior' | 'scholar',
  isRuler: boolean,
): 'warrior' | 'scholar' | 'servant' | 'royal' {
  if (isRuler) return 'royal';
  if (officer.faction == null) return 'servant';
  return base;
}

/** 消解表模块缓存：officers 名册规模变化时重建（招募/登用会增员）。 */
let geneTableCache: { count: number; table: Map<number, AvatarGene> } | null = null;

/** 名册级消解基因（两两可辨）；无名册上下文时回退单将哈希。 */
export function useOfficerGene(officer: Officer): AvatarGene {
  const officers = useGameStore((s) => s.game?.officers);
  return useMemo(() => {
    if (officers) {
      const list = Object.values(officers);
      if (list.length > 0 && geneTableCache?.count !== list.length) {
        geneTableCache = { count: list.length, table: deriveAvatarGeneTable(list) };
      }
      const hit = geneTableCache?.table.get(officer.id);
      if (hit) return hit;
    }
    return getAvatarGene(officer);
  }, [officer, officers]);
}

/** 是否本势力君主（royalSeal/royal 拓影判定）；无名册时按 gene 无从判定→false。 */
export function useIsRuler(officer: Officer): boolean {
  const factions = useGameStore((s) => s.game?.factions);
  return useMemo(() => {
    if (officer.faction == null) return false;
    return factions?.[officer.faction]?.rulerId === officer.id;
  }, [factions, officer.faction, officer.id]);
}

export function OfficerPortrait({ officer, compact = false }: { officer: Officer; compact?: boolean }) {
  const gene = useOfficerGene(officer);
  const isRuler = useIsRuler(officer);
  const p = getOfficerProfile(officer, gene);
  const browEye = BROW_EYE_PATHS[gene.eyeType] ?? BROW_EYE_PATHS[0];
  const ribbon = gene.ribbonColor ?? ribbonColorForRank(officer.nobilityRank);
  const sealText = gene.sealText ?? officeSealText(officer);
  const rubbingStyle = resolveRubbingStyle(officer, gene.baseRubbing, isRuler);

  return (
    <div className={`officer-portrait ${compact ? 'officer-portrait--compact' : ''}`} style={{ '--portrait-ink': p.ink, '--portrait-seal': p.seal } as React.CSSProperties} aria-label={`${officer.name}${p.courtesy ? `，字${p.courtesy}` : ''}头像`}>
      <svg viewBox="0 0 120 150" role="img" aria-hidden="true">
        <defs><filter id={`rough-${officer.id}`}><feTurbulence baseFrequency="0.035" numOctaves={3} seed={officer.id} result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale={1.3}/></filter></defs>
        <path className="portrait-halo" d="M22 130 Q16 80 33 39 Q60 8 87 39 Q104 80 98 130Z" />
        {/* A′ 拓影层（multiply ≤0.18） */}
        {renderRubbingTexture(officer.id, rubbingStyle)}
        <g filter={`url(#rough-${officer.id})`}>
          <path className="portrait-robe" d="M20 150 Q25 105 48 91 L72 91 Q95 105 100 150Z" />
          <path className="portrait-face" d={FACE_PATHS[p.face]} />
          {renderCrownPaths(p.crown)}
          <path className="portrait-brow" d={browEye.brow} />
          <path className="portrait-eye" d={browEye.eye} />
          <path className="portrait-faint" d="M60 62 L58 73 63 74" />
          <path className="portrait-beard" d={BEARD_PATHS[p.beard]} />
          <path className="portrait-faint" d="M43 112 L60 132 77 112 M60 132 V150" />
        </g>
      </svg>
      {!compact && (
        <>
          {/* B 层 · 氏族简册题签（竖排） */}
          <div
            className="absolute top-2 left-2 px-1 py-0.5 text-xs leading-tight"
            style={{
              writingMode: 'vertical-rl',
              letterSpacing: '0.12em',
              color: '#3d2d1d',
              background: 'rgba(228,210,165,.72)',
              borderLeft: '2px solid var(--portrait-seal)',
            }}
          >
            {p.clan}
          </div>
          {/* B 层 · 姓名印（姓上名下、朱砂底金双框、篆书） */}
          <div
            className="absolute right-2 bottom-3 grid place-items-center"
            style={{
              width: 30,
              height: 30,
              padding: 2,
              border: isRuler ? '3px double #FDE68A' : '2px double #d7aa62',
              color: '#ead4a6',
              background: 'var(--portrait-seal)',
              fontFamily: "'HanDynastySeal', serif",
              writingMode: 'vertical-rl',
              fontSize: 12,
              lineHeight: 1,
              boxShadow: '0 2px 4px rgba(0,0,0,.35)',
            }}
            aria-hidden
          >
            {(gene.sealText ?? sealText).slice(0, 3)}
          </div>
          {/* B 层 · 印绶色条（紫/青/黑/黄，联动 NobilityRank） */}
          <div className="absolute left-0 right-0 bottom-0 h-[4px]" style={{ background: RIBBON_COLOR[ribbon], opacity: 0.9 }} />
        </>
      )}
    </div>
  );
}
