// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * BF-P5 郡国战场模板目录（orchestrator 去硬编码）。
 *
 * 所有已登记郡国模板的唯一入口。新增第三郡只需在此登记一条
 * （bundle/templateId/entryNodeIds/前缀/标签），orchestrator、路由校验、
 * 逐郡校验脚本与前端标签均自动生效，无需再改 if 分支。
 *
 * 关联：`docs/09-roadmap.md` BF-P5 行；`server/src/services/game.ts`
 * `enterNanjunBattlefield`；`shared/nanjun-battlefield.ts` 南郡兼容包装。
 */

import type { HistoricalGeographyBundle } from './data/historical-geography/schema.js';
import { nanjun190 } from './data/historical-geography/nanjun-190.js';
import { yingchuan190 } from './data/historical-geography/yingchuan-190.js';
import { chenliu190 } from './data/historical-geography/chenliu-190.js';
import { henan190 } from './data/historical-geography/henan-190.js';
import { henei190 } from './data/historical-geography/henei-190.js';
import { hongnong190 } from './data/historical-geography/hongnong-190.js';

/** 单个郡国模板登记项。 */
export interface CommanderyTemplateEntry {
  /** 稳定郡 id（路由/orchestrator 使用，如 `nanjun`）。 */
  id: string;
  /** UI 展示名（如 `南郡`）。 */
  label: string;
  /** 历史地理 bundle（seed 构建，Zod 已校验）。 */
  bundle: HistoricalGeographyBundle;
  /** 存档模板 id（如 `nanjun-190`），旧档兼容键。 */
  templateId: string;
  /** 郡域边界入口县 id（攻方部署点，来自模板县节点）。 */
  entryNodeIds: string[];
  /** 守方部署节点 id（守方纵深前沿县；守方 Army 入场部署点，R6）。 */
  defenderEntryNodeIds: string[];
  /** 实例 id 前缀（如 `bf-nanjun`）。 */
  instancePrefix: string;
  /** 战争 id 前缀（如 `war-nanjun`）。 */
  warPrefix: string;
}

/** 已登记郡国模板目录。新增郡国在此追加即可。 */
export const COMMANDERY_TEMPLATES: Record<string, CommanderyTemplateEntry> = {
  nanjun: {
    id: 'nanjun',
    label: '南郡',
    bundle: nanjun190,
    templateId: 'nanjun-190',
    entryNodeIds: ['nanjun_dangyang', 'nanjun_zhijiang'],
    defenderEntryNodeIds: ['nanjun_zhouling', 'nanjun_yidao'],
    instancePrefix: 'bf-nanjun',
    warPrefix: 'war-nanjun',
  },
  yingchuan: {
    id: 'yingchuan',
    label: '颍川郡',
    bundle: yingchuan190,
    templateId: 'yingchuan-190',
    entryNodeIds: ['yingchuan_xiangcheng', 'yingchuan_changshe'],
    defenderEntryNodeIds: ['yingchuan_wuyang', 'yingchuan_fucheng'],
    instancePrefix: 'bf-yingchuan',
    warPrefix: 'war-yingchuan',
  },
  chenliu: {
    id: 'chenliu', label: '陈留郡', bundle: chenliu190, templateId: 'chenliu-190',
    entryNodeIds: ['chenliu_suanzao', 'chenliu_weishi', 'chenliu_fugou'],
    defenderEntryNodeIds: ['chenliu_waihuang', 'chenliu_yongqiu'],
    instancePrefix: 'bf-chenliu', warPrefix: 'war-chenliu',
  },
  henan: {
    id: 'henan', label: '河南尹', bundle: henan190, templateId: 'henan-190',
    entryNodeIds: ['henan_xingyang', 'henan_zhongmou', 'henan_xinzheng'],
    defenderEntryNodeIds: ['henan_chenggao', 'henan_yanshi'],
    instancePrefix: 'bf-henan', warPrefix: 'war-henan',
  },
  henei: {
    id: 'henei', label: '河内郡', bundle: henei190, templateId: 'henei-190',
    entryNodeIds: ['henei_heyang', 'henei_xiuwu', 'henei_huojia'],
    defenderEntryNodeIds: ['henei_yewang', 'henei_huai'],
    instancePrefix: 'bf-henei', warPrefix: 'war-henei',
  },
  hongnong: {
    id: 'hongnong', label: '弘农郡', bundle: hongnong190, templateId: 'hongnong-190',
    entryNodeIds: ['hongnong_xinan', 'hongnong_yiyang', 'hongnong_luhun'],
    defenderEntryNodeIds: ['hongnong_shan', 'hongnong_hongnong'],
    instancePrefix: 'bf-hongnong', warPrefix: 'war-hongnong',
  },
};

/** 按郡 id 取模板；未登记返回 undefined。 */
export function getCommanderyTemplate(id: string): CommanderyTemplateEntry | undefined {
  return COMMANDERY_TEMPLATES[id];
}

/** 按存档 templateId（如 `nanjun-190`）取模板；未登记返回 undefined。 */
export function getCommanderyTemplateByTemplateId(
  templateId: string,
): CommanderyTemplateEntry | undefined {
  return Object.values(COMMANDERY_TEMPLATES).find((entry) => entry.templateId === templateId);
}

/** 按郡 id 取 UI 标签；未登记返回 undefined。 */
export function getCommanderyLabel(id: string): string | undefined {
  return COMMANDERY_TEMPLATES[id]?.label;
}

/** 按存档 templateId 取 UI 标签（BattlefieldSceneView 用）；未登记返回 undefined。 */
export function getCommanderyLabelByTemplateId(templateId: string): string | undefined {
  return getCommanderyTemplateByTemplateId(templateId)?.label;
}

/** 已登记郡 id 列表（路由校验用）。 */
export function getCommanderyIds(): string[] {
  return Object.keys(COMMANDERY_TEMPLATES);
}
