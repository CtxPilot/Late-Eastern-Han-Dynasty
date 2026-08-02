// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createApp } from './app.js';
import { staticData } from './data/loader.js';
import { setWss } from './ws/broadcast.js';
import { isAuthorizedRequest, isOriginAllowed, loadSecurityConfig } from './security.js';
import { setFormationCatalog } from './battle/crit.js';
import { setHexFormationCatalog } from './battle/hex-formation.js';
import { setMeleeFormationCatalog, setMeleeTacticalConfig } from './engine/meleeRound.js';
import { setAutoFormationCatalog } from './engine/campaign.js';
import { loadTacticalSystemV2 } from './data/loader.js';

const PORT = Number(process.env.PORT ?? 3001);
const security = loadSecurityConfig();

// ensure data loads at boot
console.log(
  `Data loaded: officers=${staticData.officers.length} cities=${staticData.cities.length} units=${staticData.units.length}`,
);

// FM-P3: 注入静态阵型目录供 crit.ts 从 formations.json effects 读取暴击链贡献（单一内容源）
setFormationCatalog(staticData.formations);
// FM-P3a: 注入静态阵型目录供 meleeRound 从 formations.json tiers[0] 点值读取标准模式贡献（单一内容源）
setMeleeFormationCatalog(staticData.formations);
// FM-P3: 注入静态阵型目录供 runAutoBattle 从 formations.json tiers[0] 点值读取自动战斗贡献（单一内容源）
setAutoFormationCatalog(staticData.formations);
// FM-P3: 注入静态阵型目录供 battle.ts 从 formations.json tiers[0] 点值读取六角阵型贡献（单一内容源）
setHexFormationCatalog(staticData.formations);
// FM-P3: 注入 TacticalConfig v2 供标准模式战术协同矩阵消费（单一内容源）
setMeleeTacticalConfig(loadTacticalSystemV2());

const app = createApp(security);
const server = createServer(app);
const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient(info, callback) {
    const allowed = isOriginAllowed(info.origin, security)
      && isAuthorizedRequest(info.req, security);
    callback(allowed, allowed ? 101 : 401, allowed ? undefined : 'Unauthorized');
  },
});
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

server.listen(PORT, security.host, () => {
  console.log(`Server listening on http://${security.host}:${PORT}`);
  console.log(`WebSocket on ws://${security.host}:${PORT}/ws`);
});
