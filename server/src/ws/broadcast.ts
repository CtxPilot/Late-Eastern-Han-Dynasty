// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { WebSocketServer, WebSocket } from 'ws';

let wss: WebSocketServer | null = null;

export function setWss(server: WebSocketServer) {
  wss = server;
}

export type WsEvent =
  | { type: 'turn_progress'; phase: string; message: string; progress?: number }
  | { type: 'turn_complete'; message: string }
  | {
      type: 'event_triggered';
      name: string;
      message: string;
      payload?: { pendingEvents?: number[] };
    }
  | { type: 'hello'; message: string };

/** 向所有已连接客户端广播 */
export function broadcast(event: WsEvent) {
  if (!wss) return;
  const raw = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) {
      try {
        client.send(raw);
      } catch {
        // ignore dead sockets
      }
    }
  }
}

export function isOpen(socket: WebSocket): boolean {
  return socket.readyState === 1;
}
