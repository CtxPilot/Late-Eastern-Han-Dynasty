// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { createApp } from '../app.js';
import { isAuthorizedRequest, isOriginAllowed, loadSecurityConfig } from '../security.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  passed += 1;
  console.log(`PASS: ${message}`);
}

const config = loadSecurityConfig({
  HOST: '127.0.0.1',
  GAME_API_TOKEN: 'integration-token',
  ALLOWED_ORIGINS: 'http://localhost:5173',
  RATE_LIMIT_PER_MINUTE: '20',
});
const server = createServer(createApp(config));
const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient(info, callback) {
    const allowed = isOriginAllowed(info.origin, config) && isAuthorizedRequest(info.req, config);
    callback(allowed, allowed ? 101 : 401, allowed ? undefined : 'Unauthorized');
  },
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('无法取得测试监听端口');
const base = `http://127.0.0.1:${address.port}`;

try {
  const health = await fetch(`${base}/health`);
  assert(health.status === 200, '健康检查可用');
  assert(health.headers.get('x-content-type-options') === 'nosniff', '安全响应头实际返回');

  const unauthenticated = await fetch(`${base}/api/game/state`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  assert(unauthenticated.status === 401, '实际 HTTP 请求拒绝缺失 Bearer 令牌');

  const badOrigin = await fetch(`${base}/api/game/state`, {
    headers: {
      Origin: 'https://attacker.example',
      Authorization: 'Bearer integration-token',
    },
  });
  assert(badOrigin.status === 400, '实际 HTTP 请求拒绝未登记 Origin');

  const authorized = await fetch(`${base}/api/game/state`, {
    headers: {
      Origin: 'http://localhost:5173',
      Authorization: 'Bearer integration-token',
    },
  });
  assert(authorized.status !== 401, '正确 Origin 与 Bearer 令牌通过认证层');

  const invalidBody = await fetch(`${base}/api/game/personnel/marry`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173',
      Authorization: 'Bearer integration-token',
      'Content-Type': 'application/json',
    },
    body: '[]',
  });
  assert(invalidBody.status === 400, 'Zod 结构边界拒绝非对象 JSON');

  const rejectedWsStatus = await new Promise<number>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`, {
      origin: 'https://attacker.example',
      headers: { Authorization: 'Bearer integration-token' },
    });
    socket.once('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0));
    socket.once('error', (error) => reject(error));
  });
  assert(rejectedWsStatus === 401, '实际 WebSocket 握手拒绝未登记 Origin');

  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`, {
      origin: 'http://localhost:5173',
      headers: { Authorization: 'Bearer integration-token' },
    });
    socket.once('open', () => { socket.close(); resolve(); });
    socket.once('error', reject);
  });
  assert(true, '实际 WebSocket 握手接受正确 Origin 与 Bearer 令牌');
} finally {
  wss.close();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log(`security HTTP verification: ${passed}/${passed}`);
