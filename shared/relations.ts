import type { Officer } from './types/officer.js';

export type RelationType = 'sworn' | 'master_disciple' | 'parent_child' | 'siblings' | 'spouse' | 'best_friend' | 'enemy' | 'lord_retainer';
export type RelationSource = 'official' | 'romance';
export type RelationState = 'intimate' | 'friendly' | 'neutral' | 'dislike' | 'hostile';

export interface StaticRelation {
  fromId: number;
  toId: number;
  type: RelationType;
  source: RelationSource;
  note?: string;
}

export interface OfficerRelation {
  targetId: number;
  targetName: string;
  type: RelationType;
  source: RelationSource;
  state: RelationState;
  affinity: number;
}

const TAG_AFFINITY_RULES: Record<string, { same: number; opposite?: number }> = {
  social: { same: 15 },
  region: { same: 10 },
  politics: { same: 20, opposite: -20 },
  special: { same: 0, opposite: -40 },
};

const STATE_THRESHOLDS: [number, RelationState][] = [
  [80, 'intimate'],
  [40, 'friendly'],
  [-39, 'neutral'],
  [-60, 'dislike'],
  [-Infinity, 'hostile'],
];

export function pairAffinity(a: Officer, b: Officer): number {
  const tagScore = computeTagAffinity(a, b);
  const compatScore = computeHiddenCompatibility(a, b);
  return tagScore * 0.4 + compatScore * 0.6;
}

function computeTagAffinity(a: Officer, b: Officer): number {
  let score = 0;
  const aTags = a.tags ?? [];
  const bTags = b.tags ?? [];
  const aSocial = aTags.filter((t) => ['皇室', '汉室宗亲', '外戚', '士族', '将门', '豪族', '寒门', '平民', '商贾', '医家', '隐士', '技术匠人'].includes(t));
  const bSocial = bTags.filter((t) => ['皇室', '汉室宗亲', '外戚', '士族', '将门', '豪族', '寒门', '平民', '商贾', '医家', '隐士', '技术匠人'].includes(t));
  if (aSocial.some((t) => bSocial.includes(t))) score += TAG_AFFINITY_RULES.social.same;
  const regions = ['司隶', '豫州', '兖州', '徐州', '青州', '冀州', '并州', '幽州', '凉州', '荆州', '扬州', '益州', '交州', '南中'];
  const aRegion = aTags.find((t) => regions.includes(t));
  const bRegion = bTags.find((t) => regions.includes(t));
  if (aRegion && bRegion && aRegion === bRegion) score += TAG_AFFINITY_RULES.region.same;
  const politics = ['匡扶汉室', '篡汉自立', '割据自守', '择木而栖', '名利之徒', '苟全性命', '汉室忠臣', '隐逸山林'];
  const aPol = aTags.find((t) => politics.includes(t));
  const bPol = bTags.find((t) => politics.includes(t));
  if (aPol && bPol) {
    if (aPol === bPol) score += TAG_AFFINITY_RULES.politics.same;
    else if (isOpposingPolitics(aPol, bPol)) score += (TAG_AFFINITY_RULES.politics.opposite ?? -20);
  }
  if (aTags.includes('弑主') || bTags.includes('弑主')) score += (TAG_AFFINITY_RULES.special.opposite ?? -40);
  return score;
}

function isOpposingPolitics(a: string, b: string): boolean {
  const opposing: Record<string, string[]> = {
    '匡扶汉室': ['篡汉自立', '割据自守'],
    '篡汉自立': ['匡扶汉室', '汉室忠臣'],
    '汉室忠臣': ['篡汉自立', '割据自守'],
    '割据自守': ['匡扶汉室'],
  };
  return (opposing[a] ?? []).includes(b);
}

function computeHiddenCompatibility(a: Officer, b: Officer): number {
  const diff = Math.abs((a.hidden?.compatibility ?? 50) - (b.hidden?.compatibility ?? 50));
  return (1 - diff / 150) * 100;
}

export function relationState(affinity: number): RelationState {
  for (const [threshold, state] of STATE_THRESHOLDS) {
    if (affinity >= threshold) return state;
  }
  return 'hostile';
}

export function evolveAffinity(base: number, event: string, personalityModifier: number = 1): number {
  const deltaMap: Record<string, number> = {
    same_city: 1,
    joint_expedition: 3,
    captured: -20,
    rescued: 8,
    married: 15,
    rivalry: -5,
  };
  const delta = (deltaMap[event] ?? 0) * personalityModifier;
  return Math.max(-100, Math.min(100, base + delta));
}

export function skillPointsForMerit(meritLevel: number): number {
  let total = 0;
  for (let lv = 1; lv <= meritLevel; lv++) {
    if (lv <= 5) total += 1;
    else if (lv <= 10) total += 2;
    else if (lv <= 15) total += 3;
    else total += 4;
  }
  return total;
}

export function traitPointsForMerit(meritLevel: number): number {
  return Math.floor(meritLevel / 5);
}
