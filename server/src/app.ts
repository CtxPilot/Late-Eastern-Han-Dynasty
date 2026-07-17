// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import express, { type Express } from 'express';
import cors from 'cors';
import { gameRouter } from './routes/game.js';
import { errorMiddleware } from './middleware/errors.js';

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/game', gameRouter);
  app.use(errorMiddleware);
  return app;
}
