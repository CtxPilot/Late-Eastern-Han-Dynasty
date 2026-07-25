// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { Officer } from '@leh/shared';
import { resolveExpression, type BackgroundTone, type BattleSideContext, type ExpressionId } from '@leh/shared';
import { BEARD_PATHS, FACE_PATHS, getOfficerProfile, renderCrownPaths } from './OfficerPortrait';

/**
 * S23 人物状态表情系统 — 分层合成渲染组件（`docs/24-...md` §5）。
 *
 * 程序化 SVG 分层：L0 基础脸（face/crown/beard，复用 OfficerPortrait 程序化分支）
 * + L1 表情层（brow/eye/mouth 按 ExpressionId 切换 path 变体）
 * + L2 背景色调层（半透明蒙版，独立于表情按严重度透出）。
 *
 * 不读 PNG：即使 officer.id ∈ {1,4,5}（3 原型已接入静态 PNG 名册），本组件也走程序化 SVG，
 * 以保证五官可叠加表情层。静态名册仍用 OfficerPortrait（PNG 优先）。
 *
 * Session 179：face/crown/beard 路径改用 OfficerPortrait 导出的共享常量
 * （FACE_PATHS/CROWN_RENDER/BEARD_PATHS），避免两边分叉；辨识度优化见 OfficerPortrait 注释。
 */

interface ExpressionPath { brow: string; eye: string; mouth: string; }

const EXPRESSION_PATHS: Record<ExpressionId, ExpressionPath> = {
  // 眉平、眼平、口平
  neutral:    { brow: 'M45 55 Q51 53 56 55 M75 55 Q69 53 64 55', eye: 'M46 61 Q51 63 56 61 M74 61 Q69 63 64 61', mouth: 'M53 80 Q60 81 67 80' },
  // 眉扬、眼略大、嘴角上
  victory:    { brow: 'M45 53 Q51 50 56 52 M75 53 Q69 50 64 52', eye: 'M46 59 Q51 64 56 59 M74 59 Q69 64 64 59', mouth: 'M52 78 Q60 85 68 78' },
  // 眉蹙、眼半闭、嘴角下
  defeat:     { brow: 'M45 56 Q51 58 56 56 M75 56 Q69 58 64 56', eye: 'M46 62 Q51 60 56 62 M74 62 Q69 60 64 62', mouth: 'M52 82 Q60 78 68 82' },
  // 眉内低外高（竖）、眼瞪、口紧抿
  anger:      { brow: 'M45 53 L56 57 M75 53 L64 57', eye: 'M46 60 L56 62 M74 60 L64 62', mouth: 'M50 82 L70 82' },
  // 眉蹙、眼平、咬牙（齿）
  reluctant:  { brow: 'M45 56 Q51 57 56 56 M75 56 Q69 57 64 56', eye: 'M46 61 Q51 62 56 61 M74 61 Q69 62 64 61', mouth: 'M52 80 Q60 76 68 80 L68 83 Q60 85 52 83 Z' },
  // 眉一高一低（挑）、眼斜、口微下
  suspicion:  { brow: 'M45 54 Q51 51 56 53 M75 56 Q69 53 64 55', eye: 'M46 60 Q51 62 56 60 M74 61 Q69 63 64 61', mouth: 'M52 81 Q60 79 68 81' },
  // 眉拢、眼垂、口平微下
  ponder:     { brow: 'M45 57 Q51 55 56 57 M75 57 Q69 55 64 57', eye: 'M46 63 Q51 60 56 63 M74 63 Q69 60 64 63', mouth: 'M52 82 Q60 81 68 82' },
};

const TONE_COLOR: Record<BackgroundTone, string> = {
  gold: 'rgba(180,140,60,0.32)',
  cold: 'rgba(60,90,120,0.34)',
  'dark-red': 'rgba(120,30,30,0.34)',
  grey: 'rgba(70,70,70,0.36)',
  neutral: 'transparent',
};

export interface ExpressionPortraitProps {
  officer: Officer;
  /** 战斗上下文（BattleView SideCard 传入）；OfficerDetail 不传则走持续态 */
  battle?: BattleSideContext | null;
  /** 大地图部队士气（持续态场景，从 CampaignArmy.morale 取）；无则跳过士气维度 */
  armyMorale?: number;
  /** 紧凑模式（名册缩略图尺寸，表情仍可辨但较小） */
  compact?: boolean;
  /** 附加类名 */
  className?: string;
}

export function ExpressionPortrait({ officer, battle, armyMorale, compact = false, className }: ExpressionPortraitProps) {
  const state = resolveExpression({
    officerId: officer.id,
    loyalty: officer.loyalty,
    stamina: officer.stamina,
    status: officer.status,
    stats: officer.stats,
    hidden: officer.hidden,
    morale: armyMorale,
    battle: battle ?? null,
  });
  const p = getOfficerProfile(officer);
  const ex = EXPRESSION_PATHS[state.expression];

  return (
    <div
      className={`officer-portrait ${compact ? 'officer-portrait--compact' : ''} ${className ?? ''}`.trim()}
      style={{ '--portrait-ink': p.ink, '--portrait-seal': p.seal } as React.CSSProperties}
      data-testid={`expression-portrait-${officer.id}`}
      data-expression={state.expression}
      data-tone={state.backgroundTone}
      aria-label={`${officer.name}${p.courtesy ? `，字${p.courtesy}` : ''}头像·${state.expression}`}
    >
      <div className="expression-tone" style={{ backgroundColor: TONE_COLOR[state.backgroundTone] }} />
      <svg viewBox="0 0 120 150" role="img" aria-hidden="true">
        <defs>
          <filter id={`rough-ex-${officer.id}`}>
            <feTurbulence baseFrequency="0.035" numOctaves={3} seed={officer.id} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={1.3} />
          </filter>
        </defs>
        <path className="portrait-halo" d="M22 130 Q16 80 33 39 Q60 8 87 39 Q104 80 98 130Z" />
        <g filter={`url(#rough-ex-${officer.id})`}>
          <path className="portrait-robe" d="M20 150 Q25 105 48 91 L72 91 Q95 105 100 150Z" />
          <path className="portrait-face" d={FACE_PATHS[p.face]} />
          {renderCrownPaths(p.crown)}
          <path className="portrait-faint" d="M60 62 L58 73 63 74" />
          <path className="portrait-brow" d={ex.brow} />
          <path className="portrait-eye" d={ex.eye} />
          <path className="portrait-mouth" d={ex.mouth} />
          <path className="portrait-beard" d={BEARD_PATHS[p.beard]} />
          <path className="portrait-faint" d="M43 112 L60 132 77 112 M60 132 V150" />
        </g>
      </svg>
    </div>
  );
}
