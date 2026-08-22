// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Node 内建模块的最小类型垫片（仅服务于把服务端引擎纳入客户端 tsc 程序）。
 * 运行时由 client/vite.config.ts 的 leh-node-shims 插件替换为无害虚拟模块；
 * 引擎数据在浏览器经 virtual:leh-data 注入，真实 fs 永不触达。
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding?: string): string;
  export function statSync(path: string): { mtimeMs: number; size: number };
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: unknown): unknown;
  export function readdirSync(path: string): string[];
  export function renameSync(from: string, to: string): void;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function dirname(path: string): string;
  export function resolve(...parts: string[]): string;
}
declare module 'node:url' {
  export function fileURLToPath(url: string): string;
}
declare module 'fs' {
  import * as nfs from 'node:fs';
  export = nfs;
}
declare module 'path' {
  import * as npath from 'node:path';
  export = npath;
}
declare module 'url' {
  import * as nurl from 'node:url';
  export = nurl;
}
