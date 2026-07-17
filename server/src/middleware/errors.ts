// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { ErrorRequestHandler, RequestHandler } from 'express';

/** 统一业务错误 */
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = 'BAD_REQUEST',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** 包装同步/异步路由，把 throw 交给错误中间件 */
export function asyncHandler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res))
      .then((data) => {
        // 若 handler 已写响应则跳过
        if (res.headersSent) return;
        if (data !== undefined) res.json(data);
      })
      .catch(next);
  };
}

/**
 * 统一错误响应：{ success: false, error, message }
 * 成功路径仍返回裸 data（兼容现有客户端）
 */
export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof AppError ? err.status : 400;
  const message = err instanceof Error ? err.message : 'unknown error';
  const code = err instanceof AppError ? err.code : 'ERROR';
  if (!res.headersSent) {
    res.status(status).json({
      success: false,
      error: message,
      message,
      code,
    });
  }
};
