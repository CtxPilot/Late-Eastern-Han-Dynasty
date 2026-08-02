// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { isAuthorizedRequest, isOriginAllowed, loadSecurityConfig } from '../security.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  passed += 1;
  console.log(`PASS: ${message}`);
}

const local = loadSecurityConfig({});
assert(local.host === '127.0.0.1', '默认仅监听回环地址');
assert(isOriginAllowed('http://localhost:5173', local), '允许本机开发源');
assert(!isOriginAllowed('https://attacker.example', local), '拒绝未登记跨源');

let remoteRejected = false;
try {
  loadSecurityConfig({ HOST: '0.0.0.0' });
} catch {
  remoteRejected = true;
}
assert(remoteRejected, '非回环监听缺少令牌时启动失败');

const remote = loadSecurityConfig({ HOST: '0.0.0.0', GAME_API_TOKEN: 'test-token' });
assert(!isAuthorizedRequest({ headers: {} }, remote), '远程模式拒绝无认证请求');
assert(
  isAuthorizedRequest({ headers: { authorization: 'Bearer test-token' } }, remote),
  '远程模式接受正确 Bearer 令牌',
);

console.log(`security verification: ${passed}/6`);
