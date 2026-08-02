export type SkillDomain = 'battlefield' | 'melee' | 'duel' | 'campaign' | 'civil';

export interface SkillTreeNodeDef {
  id: string;
  skillId?: string;
  name: string;
  description: string;
  treeId: string;
  maxLevel: number;
  costPerLevel: number;
  prerequisites: string[];
  nodeType: 'skill' | 'passive' | 'gate';
  domains: SkillDomain[];
  effects?: { type: string; value: number; description: string }[];
  icon?: string;
}

export interface SkillTreeDef {
  id: string;
  name: string;
  description: string;
  nodes: SkillTreeNodeDef[];
}
