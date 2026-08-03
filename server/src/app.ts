// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import express, { type Express } from 'express';
import cors from 'cors';
import { gameRouter } from './routes/game.js';
import { errorMiddleware } from './middleware/errors.js';
import {
  fixedWindowRateLimit,
  isOriginAllowed,
  loadSecurityConfig,
  requireApiAuthorization,
  securityHeaders,
  type SecurityConfig,
} from './security.js';

export function createApp(config: SecurityConfig = loadSecurityConfig()): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders());
  app.use(cors({
    credentials: false,
    origin(origin, callback) {
      callback(isOriginAllowed(origin, config) ? null : new Error('origin not allowed'), true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  // S16 浏览器导入包含完整 0-A GameState；传输上限只放宽请求体，内容仍由路由内
  // 的 SaveEnvelope/GameStateSchema 严格校验，避免把“大”误当成“可信”。
  app.use(express.json({ limit: '2mb', strict: true }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/game', fixedWindowRateLimit(config), requireApiAuthorization(config), gameRouter);
  app.use(errorMiddleware);
  return app;
}
