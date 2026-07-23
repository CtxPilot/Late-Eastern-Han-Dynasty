// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { Officer } from '@leh/shared';

type PortraitPreset = {
  image?: string;
  courtesy: string;
  clan: string;
  title: string;
  role: string;
  quote: string;
  ink: string;
  seal: string;
  face: 'round' | 'long' | 'square' | 'sharp';
  crown: 'royal' | 'warrior' | 'scholar';
  beard: 'short' | 'long' | 'goatee' | 'wild';
};

const HERO_PRESETS: Record<number, PortraitPreset> = {
  1: { image: '/portraits/cao_cao.png', courtesy: '孟德', clan: '沛国曹氏', title: '魏武挥鞭', role: '雄主', quote: '设奇策，挟天子，定北方', ink: '#27354a', seal: '#8c2f2b', face: 'round', crown: 'royal', beard: 'short' },
  4: { image: '/portraits/zhuge_liang.png', courtesy: '孔明', clan: '琅琊诸葛氏', title: '卧龙经略', role: '军师', quote: '隆中定策，鞠躬尽瘁', ink: '#405348', seal: '#7f352c', face: 'long', crown: 'scholar', beard: 'goatee' },
  5: { image: '/portraits/lv_bu.png', courtesy: '奉先', clan: '五原郡吕氏', title: '虓虎无双', role: '飞将', quote: '辕门射戟，勇冠并州', ink: '#502e32', seal: '#a21d24', face: 'sharp', crown: 'warrior', beard: 'wild' },
  6: { image: '/portraits/guan_yu.png', courtesy: '云长', clan: '河东关氏', title: '威震华夏', role: '名将', quote: '忠义凛然，水淹七军', ink: '#29473f', seal: '#8f2822', face: 'square', crown: 'warrior', beard: 'long' },
};

export function getOfficerProfile(officer: Officer): PortraitPreset {
  return HERO_PRESETS[officer.id] ?? {
    courtesy: '',
    clan: officer.tags.slice(0, 2).join(' · ') || '汉末人物',
    title: officer.tags[officer.tags.length - 1] ?? '时势英杰',
    role: officer.stats.war >= 80 ? '武将' : officer.stats.intelligence >= 80 ? '谋臣' : '官吏',
    quote: '生逢乱世，各秉其志',
    ink: '#3f3a32',
    seal: '#81332d',
    face: officer.id % 2 ? 'square' : 'long',
    crown: officer.stats.war >= officer.stats.intelligence ? 'warrior' : 'scholar',
    beard: officer.id % 3 === 0 ? 'goatee' : 'short',
  };
}

export function OfficerPortrait({ officer, compact = false }: { officer: Officer; compact?: boolean }) {
  const p = getOfficerProfile(officer);
  const facePath = p.face === 'round' ? 'M41 45 Q60 35 79 45 L76 83 Q60 99 44 83Z' : p.face === 'long' ? 'M43 42 Q60 34 77 42 L74 88 Q60 103 46 88Z' : p.face === 'sharp' ? 'M40 43 Q60 32 80 43 L73 83 L60 99 47 83Z' : 'M39 43 Q60 34 81 43 L77 86 Q60 98 43 86Z';

  return (
    <div className={`officer-portrait ${compact ? 'officer-portrait--compact' : ''}`} style={{ '--portrait-ink': p.ink, '--portrait-seal': p.seal } as React.CSSProperties} aria-label={`${officer.name}${p.courtesy ? `，字${p.courtesy}` : ''}头像`}>
      {p.image ? <img className="portrait-image" src={p.image} alt="" aria-hidden="true" /> : <svg viewBox="0 0 120 150" role="img" aria-hidden="true">
        <defs><filter id={`rough-${officer.id}`}><feTurbulence baseFrequency="0.035" numOctaves="3" seed={officer.id} result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.3"/></filter></defs>
        <path className="portrait-halo" d="M22 130 Q16 80 33 39 Q60 8 87 39 Q104 80 98 130Z" />
        <g filter={`url(#rough-${officer.id})`}>
          <path className="portrait-robe" d="M20 150 Q25 105 48 91 L72 91 Q95 105 100 150Z" />
          <path className="portrait-face" d={facePath} />
          {p.crown === 'royal' && <><path className="portrait-line portrait-crown" d="M36 43 L40 25 L80 25 84 43 M32 25 H88 M43 25 V15 M77 25 V15 M38 15 H82"/><path className="portrait-faint" d="M28 20 H92"/></>}
          {p.crown === 'warrior' && <><path className="portrait-line portrait-crown" d="M37 44 Q38 19 60 17 Q82 19 83 44 M39 30 H81 M45 22 L38 10 M75 22 L82 10"/><path className="portrait-plume" d="M42 21 Q20 7 12 32 M78 21 Q100 7 108 32"/></>}
          {p.crown === 'scholar' && <><path className="portrait-line portrait-crown" d="M40 43 L43 21 H77 L80 43 M43 29 H77 M50 21 L48 10 H72 L70 21"/><path className="portrait-faint" d="M31 30 Q60 23 89 30"/></>}
          <path className="portrait-brow" d={p.face === 'sharp' ? 'M45 55 L56 58 M75 55 L64 58' : p.face === 'square' ? 'M44 54 Q50 50 56 54 M76 54 Q70 50 64 54' : 'M45 55 Q51 53 56 55 M75 55 Q69 53 64 55'} />
          <path className="portrait-eye" d="M46 61 Q51 64 56 61 M74 61 Q69 64 64 61" />
          <path className="portrait-faint" d="M60 62 L58 73 63 74" />
          {p.beard === 'short' && <path className="portrait-beard" d="M48 78 Q60 89 72 78 Q69 96 60 99 Q51 96 48 78Z" />}
          {p.beard === 'goatee' && <path className="portrait-beard" d="M52 78 Q60 87 68 78 L64 112 60 123 56 112Z" />}
          {p.beard === 'wild' && <path className="portrait-beard" d="M44 76 Q60 91 76 76 L79 102 68 96 60 116 52 96 41 102Z" />}
          {p.beard === 'long' && <path className="portrait-beard" d="M45 76 Q60 89 75 76 Q78 111 69 139 L60 147 51 139 Q42 111 45 76Z" />}
          <path className="portrait-faint" d="M43 112 L60 132 77 112 M60 132 V150" />
        </g>
      </svg>}
      {!compact && <><span className="portrait-clan">{p.clan}</span><span className="portrait-seal">{officer.name}</span><span className="portrait-ribbon" /></>}
    </div>
  );
}
