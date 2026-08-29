// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { CSSProperties, ReactNode } from 'react';

/**
 * 印信徽章（批次② · Session 408，ArtDirection.md §四「印信格系统」）：
 * 方印/圆印 + HanDynastySeal 单字 + 按 id/字哈希的确定性「磨损缺口」（边框虚线段）。
 * 颜色一律走本表（§1.1 token 等值），组件调用处禁止裸 hex。
 */

export type SealColor =
  | 'seal'      // 朱砂：第一强调（稀缺，一屏≤2）
  | 'gold'      // 金印：爵位/金钱
  | 'military'  // 军=朱红系
  | 'civil'     // 政=金系
  | 'personnel' // 人/家族=宣棕系
  | 'intel'     // 谍=青系
  | 'family'    // 家族=桃系（§1.2）
  | 'ink';      // 墨：中性

const SEAL_PALETTE: Record<SealColor, { fg: string; bg: string }> = {
  seal: { fg: '#FDE68A', bg: '#A61919' },
  gold: { fg: '#78350F', bg: '#D7AA62' },
  military: { fg: '#FCA5A5', bg: '#7F1D1D' },
  civil: { fg: '#78350F', bg: '#FBBF24' },
  personnel: { fg: '#F5EBD0', bg: '#6B4E2C' },
  intel: { fg: '#E0F2FE', bg: '#0C4A6E' },
  family: { fg: '#FECDD3', bg: '#881D3F' },
  ink: { fg: '#C7AE7A', bg: '#292524' },
};

/** 确定性磨损缺口：同一印永远同缺口（哈希自字符+seed，不消费 RNG）。 */
function chipDash(char: string, seed: number): string {
  let h = seed;
  for (let i = 0; i < char.length; i++) h = (h * 31 + char.charCodeAt(i)) >>> 0;
  const gap1 = 3 + (h % 4);
  const mark1 = 14 + ((h >> 3) % 6);
  const gap2 = 2 + ((h >> 7) % 3);
  return `${mark1} ${gap1} ${10 + ((h >> 11) % 8)} ${gap2}`;
}

export function SealBadge({
  char,
  color = 'ink',
  shape = 'square',
  size = 18,
  title,
  className,
  style,
}: {
  char: string;
  color?: SealColor;
  shape?: 'square' | 'round';
  size?: number;
  title?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { fg, bg } = SEAL_PALETTE[color];
  const dash = chipDash(char, shape === 'round' ? 7 : 13);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      className={className}
      style={style}
    >
      {shape === 'round' ? (
        <circle cx="12" cy="12" r="9.6" fill={bg} stroke={fg} strokeWidth="1.2" strokeDasharray={dash} />
      ) : (
        <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="2" fill={bg} stroke={fg} strokeWidth="1.2" strokeDasharray={dash} />
      )}
      <text
        x="12"
        y={shape === 'round' ? 16.6 : 16.4}
        fontSize="13"
        fill={fg}
        textAnchor="middle"
        style={{ fontFamily: "'HanDynastySeal', serif" }}
      >
        {char}
      </text>
    </svg>
  );
}

/** 印信图标语义表：kind → 印色（§1.2 固定语义，禁止按位置轮换）。 */
export type SealIconKind =
  | 'gold'     // 金
  | 'food'     // 粮
  | 'troops'   // 兵
  | 'pop'      // 口（人口）
  | 'city'     // 城
  | 'intel'    // 谍（情报）
  | 'scheme'   // 计（计略）
  | 'network'  // 礼（宫廷人脉）
  | 'rank'     // 爵（官爵）
  | 'harvest'  // 丰（丰收/吉）
  | 'warn'     // 警（警示）
  | 'doom'     // 凶（凶险）
  | 'joy';     // 喜（喜庆）

const SEAL_ICON_MAP: Record<SealIconKind, { char: string; color: SealColor; shape: 'square' | 'round' }> = {
  gold: { char: '金', color: 'gold', shape: 'square' },
  food: { char: '粮', color: 'personnel', shape: 'square' },
  troops: { char: '兵', color: 'military', shape: 'square' },
  pop: { char: '口', color: 'ink', shape: 'square' },
  city: { char: '城', color: 'ink', shape: 'square' },
  intel: { char: '谍', color: 'intel', shape: 'square' },
  scheme: { char: '计', color: 'intel', shape: 'round' },
  network: { char: '礼', color: 'personnel', shape: 'square' },
  rank: { char: '爵', color: 'gold', shape: 'square' },
  harvest: { char: '丰', color: 'civil', shape: 'round' },
  warn: { char: '警', color: 'civil', shape: 'round' },
  doom: { char: '凶', color: 'seal', shape: 'round' },
  joy: { char: '喜', color: 'personnel', shape: 'round' },
};

export function SealIcon({ kind, size = 18, className, style }: { kind: SealIconKind; size?: number; className?: string; style?: CSSProperties }) {
  const def = SEAL_ICON_MAP[kind];
  return <SealBadge char={def.char} color={def.color} shape={def.shape} size={size} className={className} style={style} />;
}

/** 竖排简册面板（批次②）：竖排题签 + 竹简纹路；标题一律 HanDynastySerif 700。 */
export function SlipPanel({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex border border-ink-700 bg-stone-900/60 rounded ${className}`}>
      <div
        className="shrink-0 w-7 py-2 flex items-start justify-center border-r border-ink-700"
        style={{
          writingMode: 'vertical-rl',
          letterSpacing: '0.25em',
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(255,255,255,.03) 0 1px, transparent 1px 6px), linear-gradient(180deg, rgba(107,78,44,.35), rgba(107,78,44,.08))',
        }}
      >
        <span className="text-xs text-paper-300 font-semibold">{title}</span>
      </div>
      <div className="min-w-0 flex-1 p-2">{children}</div>
    </div>
  );
}
