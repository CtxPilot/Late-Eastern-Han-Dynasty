// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';

/**
 * S20-W1: useBroadcast 原生 WebSocket 订阅 Hook
 *
 * 参照体系：
 * - docs/07-ui-design.md §11.1.1 W1 endTurn WebSocket 接入 + TurnProgressOverlay
 * - server/src/ws/broadcast.ts 契约
 *
 * 规格：
 * 1. 原生 WebSocket 订阅服务端的 /ws 广播通道；
 * 2. 解析 turn_progress (phase/progress/message), turn_complete, event_triggered；
 * 3. 模块级连接复用与退避重连（1s → 3s → 10s）；
 * 4. 离线/Worker/PWA 或断线降级：结合 monthSettling 状态驱动确定性进度推进（0% → 90% 渐进，完成直达 100%）。
 */

export interface BroadcastState {
  active: boolean;
  connected: boolean;
  phase: string;
  progress: number; // 0 ~ 100
  message: string;
  lastEvent: string | null;
}

const DEFAULT_STATE: BroadcastState = {
  active: false,
  connected: false,
  phase: '乾坤推演',
  progress: 0,
  message: '天道流转，正在推演天下变幻…',
  lastEvent: null,
};

export function useBroadcast(): BroadcastState {
  const [state, setState] = useState<BroadcastState>(DEFAULT_STATE);
  const monthSettling = useGameStore((s) => s.monthSettling);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(1000);
  const simulatedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // 1. WebSocket 连接与重连管理
  useEffect(() => {
    isMountedRef.current = true;

    if (typeof window === 'undefined' || typeof window.WebSocket === 'undefined') {
      return;
    }

    const connect = () => {
      // 避免静态预览或非单机服务端报错时崩溃
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // 若开发/预览端口有 host 则连接目标 host，否则 fallback
        const host = window.location.host || 'localhost:3000';
        const wsUrl = `${protocol}//${host}/ws`;

        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (!isMountedRef.current) return;
          retryDelayRef.current = 1000;
          setState((prev) => ({ ...prev, connected: true }));
        };

        ws.onmessage = (event) => {
          if (!isMountedRef.current) return;
          try {
            const data = JSON.parse(String(event.data));
            if (data.type === 'turn_progress') {
              setState((prev) => ({
                ...prev,
                active: true,
                phase: data.phase || '各方推演',
                progress: Math.max(prev.progress, data.progress ?? 30),
                message: data.message || prev.message,
              }));
            } else if (data.type === 'turn_complete') {
              setState((prev) => ({
                ...prev,
                progress: 100,
                phase: '推演终',
                message: data.message || '乾坤推演完毕',
              }));
              setTimeout(() => {
                if (isMountedRef.current) {
                  setState((prev) => ({ ...prev, active: false }));
                }
              }, 400);
            } else if (data.type === 'event_triggered') {
              setState((prev) => ({
                ...prev,
                lastEvent: data.message || data.name || null,
              }));
            }
          } catch {
            // ignore non-json frames
          }
        };

        ws.onerror = () => {
          // 静默处理，由 onclose 统一处理重连
        };

        ws.onclose = () => {
          if (!isMountedRef.current) return;
          setState((prev) => ({ ...prev, connected: false }));
          socketRef.current = null;

          // 退避重连: 1s -> 3s -> 10s
          const delay = retryDelayRef.current;
          retryDelayRef.current = Math.min(10000, delay * 3);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        };
      } catch {
        setState((prev) => ({ ...prev, connected: false }));
      }
    };

    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  // 2. 离线/无 WS 状态下的假进度平滑降级（S20-W1 规范）
  useEffect(() => {
    if (monthSettling) {
      // 开启推演遮罩
      setState((prev) => ({
        ...prev,
        active: true,
        progress: prev.connected ? prev.progress : 15,
        phase: '天道流转',
        message: '正在清点各方府库税赋与军民农桑…',
      }));

      // 如果未连接真实 WS，通过计时器推进假进度条（至 90% 悬停）
      if (!state.connected) {
        let step = 0;
        const fakePhases = [
          { p: 25, phase: '民政核算', msg: '正在结算各方城池赋税、开荒屯田与灾异…' },
          { p: 55, phase: '军机布防', msg: '正在调拔前线兵力防线与后方补给辎重…' },
          { p: 75, phase: '天下博弈', msg: '正在研判诸侯纵横捭阖与战略动向…' },
          { p: 88, phase: '史官录简', msg: '起居注载录四方军机，刊印新岁简册…' },
        ];

        simulatedTimerRef.current = setInterval(() => {
          if (step < fakePhases.length) {
            const cur = fakePhases[step];
            setState((prev) => ({
              ...prev,
              progress: cur.p,
              phase: cur.phase,
              message: cur.msg,
            }));
            step++;
          }
        }, 180);
      }
    } else {
      // 回合结算结束，迅速封顶 100% 后关闭
      if (simulatedTimerRef.current) {
        clearInterval(simulatedTimerRef.current);
        simulatedTimerRef.current = null;
      }
      setState((prev) => ({
        ...prev,
        progress: 100,
        phase: '推演终',
        message: '岁在今兹，万象更始。',
      }));
      const closeTimer = setTimeout(() => {
        if (isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            active: false,
            progress: 0,
            phase: '乾坤推演',
          }));
        }
      }, 350);

      return () => clearTimeout(closeTimer);
    }

    return () => {
      if (simulatedTimerRef.current) {
        clearInterval(simulatedTimerRef.current);
        simulatedTimerRef.current = null;
      }
    };
  }, [monthSettling, state.connected]);

  return state;
}
