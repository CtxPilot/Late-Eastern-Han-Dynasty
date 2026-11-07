// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

export type LogCategory =
  | 'all'
  | 'turn'
  | 'civil'
  | 'military'
  | 'plot'
  | 'hegemony'
  | 'relations'
  | 'event'
  | 'general';

export type StampType = 'feng' | 'jing' | 'xiong' | 'xi' | 'mou' | 'zhan' | 'ping';

export interface FormattedLogItem {
  id: string;
  year: number;
  month: number;
  dateLabel: string;
  category: LogCategory;
  categoryTag: string;
  stamp: StampType;
  stampChar: string;
  stampColorClass: string;
  stampBadgeStyle: {
    color: string;
    borderColor: string;
    backgroundColor: string;
  };
  rawMessage: string;
  displayMessage: string;
}

const CATEGORY_MAP: Record<string, { tag: string; category: LogCategory }> = {
  turn: { tag: '[ 旬始 ]', category: 'turn' },
  end_turn: { tag: '[ 旬始 ]', category: 'turn' },
  civil: { tag: '[ 内政 ]', category: 'civil' },
  develop: { tag: '[ 内政 ]', category: 'civil' },
  farm: { tag: '[ 内政 ]', category: 'civil' },
  commerce: { tag: '[ 内政 ]', category: 'civil' },
  conscript: { tag: '[ 内政 ]', category: 'civil' },
  train: { tag: '[ 内政 ]', category: 'civil' },
  military: { tag: '[ 军机 ]', category: 'military' },
  battlefield: { tag: '[ 军机 ]', category: 'military' },
  battle: { tag: '[ 军机 ]', category: 'military' },
  march: { tag: '[ 军机 ]', category: 'military' },
  siege: { tag: '[ 军机 ]', category: 'military' },
  sortie: { tag: '[ 军机 ]', category: 'military' },
  duel: { tag: '[ 军机 ]', category: 'military' },
  retreat: { tag: '[ 军机 ]', category: 'military' },
  plot: { tag: '[ 谍变 ]', category: 'plot' },
  intel: { tag: '[ 谍变 ]', category: 'plot' },
  spy: { tag: '[ 谍变 ]', category: 'plot' },
  hegemony: { tag: '[ 大典 ]', category: 'hegemony' },
  tournament: { tag: '[ 大典 ]', category: 'hegemony' },
  emperor: { tag: '[ 大典 ]', category: 'hegemony' },
  king: { tag: '[ 大典 ]', category: 'hegemony' },
  relations: { tag: '[ 人伦 ]', category: 'relations' },
  family: { tag: '[ 人伦 ]', category: 'relations' },
  marriage: { tag: '[ 人伦 ]', category: 'relations' },
  oath: { tag: '[ 人伦 ]', category: 'relations' },
  mentor: { tag: '[ 人伦 ]', category: 'relations' },
  event: { tag: '[ 天时 ]', category: 'event' },
  disaster: { tag: '[ 天时 ]', category: 'event' },
  plague: { tag: '[ 天时 ]', category: 'event' },
  weather: { tag: '[ 天时 ]', category: 'event' },
};

const STAMP_CONFIGS: Record<
  StampType,
  {
    char: string;
    class: string;
    style: { color: string; borderColor: string; backgroundColor: string };
  }
> = {
  feng: {
    char: '丰',
    class: 'text-emerald-400 border-emerald-600/80 bg-emerald-950/70',
    style: { color: '#4ade80', borderColor: '#059669', backgroundColor: 'rgba(6, 78, 59, 0.7)' },
  },
  jing: {
    char: '警',
    class: 'text-amber-400 border-amber-600/80 bg-amber-950/70',
    style: { color: '#fbbf24', borderColor: '#d97706', backgroundColor: 'rgba(120, 53, 15, 0.7)' },
  },
  xiong: {
    char: '凶',
    class: 'text-rose-400 border-rose-600/80 bg-rose-950/70',
    style: { color: '#f87171', borderColor: '#e11d48', backgroundColor: 'rgba(136, 19, 55, 0.7)' },
  },
  xi: {
    char: '喜',
    class: 'text-yellow-300 border-yellow-500/90 bg-yellow-950/80',
    style: { color: '#fde047', borderColor: '#ca8a04', backgroundColor: 'rgba(113, 63, 18, 0.8)' },
  },
  mou: {
    char: '谋',
    class: 'text-cyan-400 border-cyan-600/80 bg-cyan-950/70',
    style: { color: '#38bdf8', borderColor: '#0891b2', backgroundColor: 'rgba(22, 78, 99, 0.7)' },
  },
  zhan: {
    char: '战',
    class: 'text-orange-400 border-orange-700/80 bg-orange-950/70',
    style: { color: '#fb923c', borderColor: '#c2410c', backgroundColor: 'rgba(124, 45, 18, 0.7)' },
  },
  ping: {
    char: '平',
    class: 'text-stone-400 border-stone-700/80 bg-stone-900/70',
    style: { color: '#a8a29e', borderColor: '#57534e', backgroundColor: 'rgba(41, 37, 36, 0.7)' },
  },
};

/**
 * 依据文言战报内容与类型，解析出印章标识。
 */
export function deriveStamp(message: string, actionType: string): StampType {
  const msg = message.toLowerCase();

  // 1. 凶：破灭、丧亡、败北、重灾
  if (
    msg.includes('溃') ||
    msg.includes('殁') ||
    msg.includes('斩') ||
    msg.includes('疫') ||
    msg.includes('疾') ||
    msg.includes('灾') ||
    msg.includes('败') ||
    msg.includes('破产') ||
    msg.includes('失陷') ||
    msg.includes('凶') ||
    msg.includes('死') ||
    msg.includes('拔树') ||
    msg.includes('全歼') ||
    msg.includes('离散')
  ) {
    return 'xiong';
  }

  // 2. 喜：开朝、称王、登基、结义、封官、大捷、武魁
  if (
    msg.includes('称帝') ||
    msg.includes('称王') ||
    msg.includes('受禅') ||
    msg.includes('即位') ||
    msg.includes('金兰') ||
    msg.includes('拜师') ||
    msg.includes('登用') ||
    msg.includes('武魁') ||
    msg.includes('破军') ||
    msg.includes('喜') ||
    msg.includes('霸府') ||
    msg.includes('大赦') ||
    msg.includes('降伏') ||
    msg.includes('投奔')
  ) {
    return 'xi';
  }

  // 3. 谋：战术计策、伏兵、水攻、火计、离间、流言、暗渡
  if (
    msg.includes('水计') ||
    msg.includes('水攻') ||
    msg.includes('伏兵') ||
    msg.includes('火计') ||
    msg.includes('离间') ||
    msg.includes('流言') ||
    msg.includes('暗渡') ||
    msg.includes('树上开花') ||
    msg.includes('调虎离山') ||
    msg.includes('釜底抽薪') ||
    msg.includes('空城') ||
    msg.includes('计策') ||
    msg.includes('刺探') ||
    msg.includes('谍报') ||
    actionType === 'plot' ||
    actionType === 'intel'
  ) {
    return 'mou';
  }

  // 4. 丰：民殷国富、开垦、收获、得粮、充实、进贡、增产
  if (
    msg.includes('得粮') ||
    msg.includes('开垦') ||
    msg.includes('丰') ||
    msg.includes('增收') ||
    msg.includes('产粮') ||
    msg.includes('充实') ||
    msg.includes('进贡') ||
    msg.includes('获益') ||
    msg.includes('商贸兴旺') ||
    msg.includes('征兵') ||
    msg.includes('训练') ||
    msg.includes('大获全胜')
  ) {
    return 'feng';
  }

  // 5. 警：逼近、袭、围城、危急、忠诚下降、威胁
  if (
    msg.includes('逼近') ||
    msg.includes('引兵复袭') ||
    msg.includes('围城') ||
    msg.includes('袭') ||
    msg.includes('警') ||
    msg.includes('危') ||
    msg.includes('告急') ||
    msg.includes('缺粮') ||
    msg.includes('叛') ||
    msg.includes('被俘') ||
    msg.includes('不仕') ||
    msg.includes('降至')
  ) {
    return 'jing';
  }

  // 6. 战：出征、交兵、鏖战、攻打、单挑、突围
  if (
    msg.includes('出征') ||
    msg.includes('接战') ||
    msg.includes('鏖战') ||
    msg.includes('攻打') ||
    msg.includes('单挑') ||
    msg.includes('突围') ||
    msg.includes('截击') ||
    msg.includes('驰援') ||
    actionType === 'battle' ||
    actionType === 'battlefield' ||
    actionType === 'duel'
  ) {
    return 'zhan';
  }

  // 7. 平：日常中性
  return 'ping';
}

export interface LogEntryInput {
  type: string;
  message: string;
  year?: number;
  month?: number;
}

/**
 * 格式化单条行动日志为文言 Terminal 规范项。
 */
export function formatActionLogEntry(
  entry: LogEntryInput,
  index: number,
  fallbackYear?: number,
  fallbackMonth?: number,
): FormattedLogItem {
  const meta = CATEGORY_MAP[entry.type] ?? { tag: '[ 奏报 ]', category: 'general' };
  const stamp = deriveStamp(entry.message, entry.type);
  const stampCfg = STAMP_CONFIGS[stamp];

  const y = entry.year ?? fallbackYear ?? 190;
  const m = entry.month ?? fallbackMonth ?? 1;
  const dateLabel = `${y}年${m}月`;
  const displayMessage = entry.message.trim();

  return {
    id: `log-${y}-${m}-${index}-${entry.type}`,
    year: y,
    month: m,
    dateLabel,
    category: meta.category,
    categoryTag: meta.tag,
    stamp,
    stampChar: stampCfg.char,
    stampColorClass: stampCfg.class,
    stampBadgeStyle: stampCfg.style,
    rawMessage: entry.message,
    displayMessage,
  };
}
