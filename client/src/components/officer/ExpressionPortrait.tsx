// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { Officer } from '@leh/shared';
import { resolveExpression, type BackgroundTone, type BattleSideContext, type ExpressionId } from '@leh/shared';
import { getOfficerProfile } from './OfficerPortrait';

/**
 * S23 人物状态表情系统 — 分层合成渲染组件（`docs/24-...md` §5）。
 *
 * 程序化 SVG 分层：L0 基础脸（face/crown/beard，复用 OfficerPortrait 程序化分支）
 * + L1 表情层（brow/eye/mouth 按 ExpressionId 切换 path 变体）
 * + L2 背景色调层（半透明蒙版，独立于表情按严重度透出）。
 *
 * 不读 PNG：即使 officer.id ∈ {1,4,5}（3 原型已接入静态 PNG 名册），本组件也走程序化 SVG，
 * 以保证五官可叠加表情层。静态名册仍用 OfficerPortrait（PNG 优先）。
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
  const facePath =
    p.face === 'round' ? 'M41 45 Q60 35 79 45 L76 83 Q60 99 44 83Z'
      : p.face === 'long' ? 'M43 42 Q60 34 77 42 L74 88 Q60 103 46 88Z'
        : p.face === 'sharp' ? 'M40 43 Q60 32 80 43 L73 83 L60 99 47 83Z'
          : 'M39 43 Q60 34 81 43 L77 86 Q60 98 43 86Z';
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
          <path className="portrait-face" d={facePath} />
          {p.crown === 'royal' && (
            <>
              <path className="portrait-line portrait-crown" d="M36 43 L40 25 L80 25 84 43 M32 25 H88 M43 25 V15 M77 25 V15 M38 15 H82" />
              <path className="portrait-faint" d="M28 20 H92" />
            </>
          )}
          {p.crown === 'warrior' && (
            <>
              <path className="portrait-line portrait-crown" d="M37 44 Q38 19 60 17 Q82 19 83 44 M39 30 H81 M45 22 L38 10 M75 22 L82 10" />
              <path className="portrait-plume" d="M42 21 Q20 7 12 32 M78 21 Q100 7 108 32" />
            </>
          )}
          {p.crown === 'scholar' && (
            <>
              <path className="portrait-line portrait-crown" d="M40 43 L43 21 H77 L80 43 M43 29 H77 M50 21 L48 10 H72 L70 21" />
              <path className="portrait-faint" d="M31 30 Q60 23 89 30" />
            </>
          )}
          <path className="portrait-faint" d="M60 62 L58 73 63 74" />
          <path className="portrait-brow" d={ex.brow} />
          <path className="portrait-eye" d={ex.eye} />
          <path className="portrait-mouth" d={ex.mouth} />
          {p.beard === 'short' && <path className="portrait-beard" d="M48 78 Q60 89 72 78 Q69 96 60 99 Q51 96 48 78Z" />}
          {p.beard === 'goatee' && <path className="portrait-beard" d="M52 78 Q60 87 68 78 L64 112 60 123 56 112Z" />}
          {p.beard === 'wild' && <path className="portrait-beard" d="M44 76 Q60 91 76 76 L79 102 68 96 60 116 52 96 41 102Z" />}
          {p.beard === 'long' && <path className="portrait-beard" d="M45 76 Q60 89 75 76 Q78 111 69 139 L60 147 51 139 Q42 111 45 76Z" />}
          <path className="portrait-faint" d="M43 112 L60 132 77 112 M60 132 V150" />
        </g>
      </svg>
      {!compact && (
        <>
          <span className="portrait-clan">{p.clan}</span>
          <span className="portrait-seal" style={{ fontFamily: "'HanDynastySeal', serif" }}>{officer.name}</span>
          <span className="portrait-ribbon" />
        </>
      )}
    </div>
  );
}
