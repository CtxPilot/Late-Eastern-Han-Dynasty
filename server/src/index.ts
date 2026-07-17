// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createApp } from './app.js';
import { staticData } from './data/loader.js';
import { setWss } from './ws/broadcast.js';

const PORT = Number(process.env.PORT ?? 3001);

// ensure data loads at boot
console.log(
  `Data loaded: officers=${staticData.officers.length} cities=${staticData.cities.length} units=${staticData.units.length}`,
);

const app = createApp();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
setWss(wss);

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'hello', message: 'leh server ws ready' }));
  socket.on('message', (raw) => {
    try {
      const msg = JSON.parse(String(raw)) as { type?: string };
      if (msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {
      // ignore
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`WebSocket on ws://localhost:${PORT}/ws`);
});
