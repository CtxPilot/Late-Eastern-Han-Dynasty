// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameAction } from '@leh/shared';
import { formatActionLogEntry, type FormattedLogItem, type LogCategory } from './eventLogParser';
import { InkButton } from '../ui/buttons';

interface EventLogTerminalProps {
  entries: readonly GameAction[];
  maxEntries?: number;
  compact?: boolean;
  className?: string;
}

export function EventLogTerminal({
  entries,
  maxEntries = 50,
  compact = false,
  className = '',
}: EventLogTerminalProps) {
  const [filterCategory, setFilterCategory] = useState<LogCategory>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const logContainerRef = useRef<HTMLDivElement>(null);

  // S20-W2：新条目到达自动平滑顶滚
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [entries.length]);

  const formattedItems = useMemo(() => {
    return entries.map((e, i) => formatActionLogEntry(e, i));
  }, [entries]);

  const filteredItems = useMemo(() => {
    let items = formattedItems;
    if (filterCategory !== 'all') {
      items = items.filter((item) => item.category === filterCategory);
    }
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.displayMessage.toLowerCase().includes(kw) ||
          item.categoryTag.toLowerCase().includes(kw) ||
          item.dateLabel.includes(kw),
      );
    }
    return items;
  }, [formattedItems, filterCategory, searchKeyword]);

  const displayList = compact ? filteredItems.slice(0, maxEntries) : filteredItems;

  return (
    <>
      <div
        className={`rounded border border-stone-800 bg-[#1c1a17] text-stone-200 shadow-2xl flex flex-col overflow-hidden ${className}`}
        data-testid="event-log-terminal"
      >
        {/* Linux 伪 Terminal 标题栏 */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-stone-800 bg-stone-900/90 select-none">
          <div className="flex items-center gap-2">
            {/* 三点经典终端指示灯（朱砂/玄黄/苍碧） */}
            <div className="flex items-center gap-1.5" aria-hidden>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600/90 shadow-[0_0_6px_rgba(225,29,72,0.4)]" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/90 shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/90 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
            </div>
            <span className="text-xs text-amber-300 font-song font-semibold tracking-wider flex items-center gap-1">
              漢末起居注
              <span className="text-[10px] text-stone-500 font-mono">/tty-annal</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-stone-500 font-mono">
              [ {entries.length} 简 ]
            </span>
            <button
              type="button"
              className="text-[11px] text-amber-500/80 hover:text-amber-300 font-song px-1.5 py-0.5 rounded hover:bg-stone-800 transition-colors"
              onClick={() => setModalOpen(true)}
              title="展卷详察"
            >
              ⛶ 展卷
            </button>
          </div>
        </div>

        {/* 分类快捷筛选栏 */}
        {!compact && (
          <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-stone-800/80 bg-stone-950/60 overflow-x-auto text-[11px] font-song scrollbar-none">
            {(
              [
                ['all', '全部'],
                ['military', '军机'],
                ['civil', '内政'],
                ['plot', '谍变'],
                ['event', '天时'],
                ['hegemony', '大典'],
                ['relations', '人伦'],
              ] as const
            ).map(([cat, label]) => (
              <button
                key={cat}
                type="button"
                className={`px-2 py-0.5 rounded transition-all shrink-0 ${
                  filterCategory === cat
                    ? 'bg-amber-950 text-amber-200 border border-amber-700/80'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                }`}
                onClick={() => setFilterCategory(cat)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 文言终端日志行 */}
        <div
          ref={logContainerRef}
          className={`overflow-y-auto px-2.5 py-2 space-y-1 font-mono text-xs select-text scroll-smooth ${
            compact ? 'max-h-56' : 'max-h-96'
          }`}
        >
          {displayList.length === 0 ? (
            <div className="py-4 text-center text-xs text-stone-600 font-song">
              本卷暂无对应起居记载。
            </div>
          ) : (
            displayList.map((item) => (
              <TerminalLogRow key={item.id} item={item} compact={compact} />
            ))
          )}
        </div>
      </div>

      {/* 展卷大弹窗模态层 */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none animate-[ink-fade-in_180ms_ease-out]"
          data-testid="event-log-modal"
        >
          <div className="w-full max-w-4xl max-h-[90vh] rounded border-2 border-double border-amber-800/80 bg-[#1c1a17] text-stone-200 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
            {/* 模态题头 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-900/90">
              <div className="flex items-center gap-2">
                <span className="w-2 h-4 bg-seal-600 rounded-xs" aria-hidden />
                <h3 className="text-base text-amber-200 font-song font-bold tracking-wide">
                  起居注全卷 · 史官备录
                </h3>
                <span className="text-xs text-stone-500 font-mono">
                  [共存录 {formattedItems.length} 简]
                </span>
              </div>
              <InkButton
                type="button"
                className="text-stone-400 hover:text-stone-100 text-lg leading-none px-2 py-0.5 rounded hover:bg-stone-800"
                onClick={() => setModalOpen(false)}
              >
                ×
              </InkButton>
            </div>

            {/* 搜索与过滤工具 */}
            <div className="p-3 border-b border-stone-800/80 bg-stone-950/70 flex flex-wrap items-center justify-between gap-2 text-xs font-song">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {(
                  [
                    ['all', '全部'],
                    ['military', '军机'],
                    ['civil', '内政'],
                    ['plot', '谍变'],
                    ['event', '天时'],
                    ['hegemony', '大典'],
                    ['relations', '人伦'],
                  ] as const
                ).map(([cat, label]) => (
                  <button
                    key={cat}
                    type="button"
                    className={`px-2.5 py-1 rounded transition-all shrink-0 ${
                      filterCategory === cat
                        ? 'bg-amber-900/80 text-amber-100 border border-amber-600'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                    }`}
                    onClick={() => setFilterCategory(cat)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="检索实录文词…"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="bg-stone-900 border border-stone-700 px-2 py-1 rounded text-stone-200 text-xs focus:outline-none focus:border-amber-600 placeholder:text-stone-600 w-44"
                />
                {searchKeyword && (
                  <button
                    type="button"
                    className="text-stone-400 hover:text-stone-200 text-xs"
                    onClick={() => setSearchKeyword('')}
                  >
                    清空
                  </button>
                )}
              </div>
            </div>

            {/* 模态滚动列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xs select-text">
              {filteredItems.length === 0 ? (
                <div className="py-12 text-center text-sm text-stone-500 font-song">
                  查无记载
                </div>
              ) : (
                filteredItems.map((item) => (
                  <TerminalLogRow key={item.id} item={item} compact={false} />
                ))
              )}
            </div>

            {/* 模态底栏 */}
            <div className="px-4 py-2.5 border-t border-stone-800 bg-stone-950/80 flex items-center justify-between text-xs text-stone-500 font-song">
              <span>史家直笔，善恶必书；古今成败，昭然若揭。</span>
              <button
                type="button"
                className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-xs transition-colors"
                onClick={() => setModalOpen(false)}
              >
                卷毕回览
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TerminalLogRow({
  item,
  compact,
}: {
  item: FormattedLogItem;
  compact: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 py-0.5 border-b border-stone-800/40 hover:bg-stone-900/50 px-1 rounded transition-all duration-300 motion-safe:animate-[ink-fade-in_300ms_ease-out] group">
      {/* 年月简标 */}
      <span className="text-[11px] text-stone-500 font-mono shrink-0 select-none">
        {item.dateLabel}
      </span>

      {/* 类别标签 */}
      <span className="text-[11px] text-amber-500/90 font-mono font-semibold shrink-0 select-none">
        {item.categoryTag}
      </span>

      {/* 文言条目主体 */}
      <span
        className={`font-song text-stone-300 leading-snug flex-1 ${
          compact ? 'truncate' : 'break-words'
        }`}
        title={compact ? item.displayMessage : undefined}
      >
        {item.displayMessage}
      </span>

      {/* 点阵前导线（仅在中宽屏展示，连接文本与右侧印章） */}
      <span
        className="text-stone-700/60 font-mono text-[10px] select-none hidden md:inline shrink-0"
        aria-hidden
      >
        ········
      </span>

      {/* 状态印章（丰 / 警 / 凶 / 喜 / 谋 / 战 / 平） */}
      <span
        className={`text-[10px] font-song font-bold px-1.5 py-0.2 rounded-xs border shrink-0 select-none ${item.stampColorClass}`}
        style={item.stampBadgeStyle}
      >
        [ {item.stampChar} ]
      </span>
    </div>
  );
}
