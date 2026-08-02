// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { Request, RequestHandler } from 'express';

const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export type SecurityConfig = {
  host: string;
  apiToken: string | null;
  allowedOrigins: ReadonlySet<string>;
  rateLimitPerMinute: number;
};

export function loadSecurityConfig(env: NodeJS.ProcessEnv = process.env): SecurityConfig {
  const host = env.HOST?.trim() || '127.0.0.1';
  const apiToken = env.GAME_API_TOKEN?.trim() || null;
  const origins = (env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS.join(','))
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const rateLimit = Number(env.RATE_LIMIT_PER_MINUTE ?? 120);
  const rateLimitPerMinute = Number.isSafeInteger(rateLimit) && rateLimit > 0 ? rateLimit : 120;

  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1' && !apiToken) {
    throw new Error('非回环监听必须设置 GAME_API_TOKEN');
  }
  return { host, apiToken, allowedOrigins: new Set(origins), rateLimitPerMinute };
}

export function isOriginAllowed(origin: string | undefined, config: SecurityConfig): boolean {
  return origin == null || config.allowedOrigins.has(origin);
}

function readBearer(req: Pick<Request, 'headers'>): string | null {
  const value = req.headers.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ')
    ? value.slice('Bearer '.length)
    : null;
}

export function isAuthorizedRequest(
  req: Pick<Request, 'headers'>,
  config: SecurityConfig,
): boolean {
  return config.apiToken == null || readBearer(req) === config.apiToken;
}

export function securityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  };
}

export function requireApiAuthorization(config: SecurityConfig): RequestHandler {
  return (req, res, next) => {
    if (!isAuthorizedRequest(req, config)) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    next();
  };
}

export function fixedWindowRateLimit(config: SecurityConfig): RequestHandler {
  const buckets = new Map<string, { minute: number; count: number }>();
  return (req, res, next) => {
    const minute = Math.floor(Date.now() / 60_000);
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = buckets.get(key);
    const bucket = current?.minute === minute ? current : { minute, count: 0 };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > config.rateLimitPerMinute) {
      res.setHeader('Retry-After', '60');
      res.status(429).json({ error: 'rate limit exceeded' });
      return;
    }
    next();
  };
}
