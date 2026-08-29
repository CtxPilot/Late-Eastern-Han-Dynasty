// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * avatarGene — 武将头像基因（批次③ · Session 409，P5-10 / 清 D-0B-7）。
 *
 * 结构对齐 `docs/08-data-dictionary.md` §avatarGene（Session 101 技术储备 → 本次实装）：
 * faceType(0-5) / crownType(0-9) / beardType(0-7) / eyeType(0-6) / wenwu(warrior|scholar)
 * + 可选手工覆盖 sealText / clanTitle / ribbonColor。
 *
 * 派生规则：FNV-1a 哈希 `id|name` 五轮取各维；文武分型由五维派生
 * （武+统 ≥ 智+政 → warrior）。手工覆盖（officers.json avatarGene / S 级策展）优先于哈希。
 * 全程零 RNG（确定性，存档/回放不受影响）。
 */

export interface AvatarGeneOverride {
  /** 脸型 0-5（ArtDirection §五 C 层 6 脸型；FACE_GENE_KEYS 顺序） */
  faceType?: number;
  /** 冠冕/发髻 0-9（CROWN_GENE_KEYS 顺序；08 真源字段名 hairType） */
  hairType?: number;
  /** 胡须 0-7（BEARD_GENE_KEYS 顺序） */
  beardType?: number;
  /** 眉眼 0-6（BROW_EYE_GENE_KEYS 顺序） */
  eyeType?: number;
  /** A′ 拓影分型（warrior/scholar；servant/royal 后置） */
  baseRubbing?: 'warrior' | 'scholar';
  /** 官职印印文（缺省按姓名，姓上名下竖排；动态官职印后置） */
  sealText?: string;
  /** 氏族题签（缺省按姓「X氏」） */
  clanTitle?: string;
  /** 印绶色（缺省按 NobilityRank 分档：紫/青/黑/黄，08 真源命名） */
  ribbonColor?: 'purple' | 'cyan' | 'black' | 'yellow';
}

export interface AvatarGene extends Required<Omit<AvatarGeneOverride, 'sealText' | 'clanTitle' | 'ribbonColor'>> {
  sealText?: string;
  clanTitle?: string;
  ribbonColor?: AvatarGeneOverride['ribbonColor'];
}

export const AVATAR_GENE_COUNTS = {
  face: 6,
  crown: 10,
  beard: 8,
  eye: 7,
} as const;

/** FNV-1a 32 位哈希（确定性，非加密）。 */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function pick(hash: number, salt: number, max: number): number {
  return (fnv1a(`${salt}:${hash}`) % max);
}

export interface AvatarGeneSource {
  id: number;
  name: string;
  stats: { war: number; leadership: number; intelligence: number; politics: number };
  avatarGene?: AvatarGeneOverride;
}

/** 由武将静态信息派生（或覆盖）头像基因。纯函数，零 RNG。 */
export function getAvatarGene(officer: AvatarGeneSource): AvatarGene {
  const base = fnv1a(`${officer.id}|${officer.name}`);
  const baseRubbing: 'warrior' | 'scholar' =
    officer.stats.war + officer.stats.leadership >= officer.stats.intelligence + officer.stats.politics
      ? 'warrior'
      : 'scholar';
  const derived: AvatarGene = {
    faceType: pick(base, 1, AVATAR_GENE_COUNTS.face),
    hairType: pick(base, 2, AVATAR_GENE_COUNTS.crown),
    beardType: pick(base, 3, AVATAR_GENE_COUNTS.beard),
    eyeType: pick(base, 4, AVATAR_GENE_COUNTS.eye),
    baseRubbing,
  };
  const o = officer.avatarGene;
  if (!o) return derived;
  return {
    faceType: o.faceType ?? derived.faceType,
    hairType: o.hairType ?? derived.hairType,
    beardType: o.beardType ?? derived.beardType,
    eyeType: o.eyeType ?? derived.eyeType,
    baseRubbing: o.baseRubbing ?? derived.baseRubbing,
    sealText: o.sealText,
    clanTitle: o.clanTitle,
    ribbonColor: o.ribbonColor,
  };
}

/** 印绶色档（§五 B 层：紫/青/黑/黄；NobilityRank 字符串 → 色键，08 真源命名）。 */
export function ribbonColorForRank(rank: string | undefined): 'purple' | 'cyan' | 'black' | 'yellow' {
  switch (rank) {
    case 'emperor':
    case 'king':
    case 'duke':
      return 'purple';
    case 'xiangMarquis':
    case 'xianMarquis':
      return 'cyan';
    case 'guanneiMarquis':
    case 'tingMarquis':
      return 'yellow';
    default:
      return 'black';
  }
}

/**
 * 全名单确定性消解表（碰撞检测 + 探测，08 真源「两两可辨」机制）：
 * 手工策展（officers.json avatarGene）优先 → 其余按 id 序哈希派生；
 * (脸,冠,须) 三元组撞车时按 胡须→冠冕 顺序确定性探测，直至空位。
 * 空间 6×10×8=480 ≥ 0-B 名册，探测必终止；全程零 RNG。
 */
export function deriveAvatarGeneTable(sources: AvatarGeneSource[]): Map<number, AvatarGene> {
  const seen = new Set<string>();
  const out = new Map<number, AvatarGene>();
  const ordered = [...sources].sort((a, b) => {
    const curated = (b.avatarGene ? 1 : 0) - (a.avatarGene ? 1 : 0);
    return curated !== 0 ? curated : a.id - b.id;
  });
  for (const o of ordered) {
    const g = getAvatarGene(o);
    let { faceType, hairType, beardType } = g;
    let probes = 0;
    while (seen.has(`${faceType},${hairType},${beardType}`)) {
      probes += 1;
      beardType = (beardType + 1) % AVATAR_GENE_COUNTS.beard;
      if (probes % AVATAR_GENE_COUNTS.beard === 0) {
        hairType = (hairType + 1) % AVATAR_GENE_COUNTS.crown;
      }
      if (probes % (AVATAR_GENE_COUNTS.beard * AVATAR_GENE_COUNTS.crown) === 0) {
        faceType = (faceType + 1) % AVATAR_GENE_COUNTS.face;
      }
      if (probes > AVATAR_GENE_COUNTS.face * AVATAR_GENE_COUNTS.crown * AVATAR_GENE_COUNTS.beard) break; // 走满空间，防御
    }
    seen.add(`${faceType},${hairType},${beardType}`);
    out.set(o.id, { ...g, faceType, hairType, beardType });
  }
  return out;
}
