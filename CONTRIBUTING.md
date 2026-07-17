# 贡献指南（人类开发者）

> AI Agent 请先读 `AGENTS.md` 与 `HANDOFF.md`。本文面向人类接手。

## 怎么跑

```bash
pnpm install
pnpm --filter @leh/shared build && pnpm dev
# 服务 :3001  前端 :5173（代理 /api）
# 数据校验: pnpm validate-data
# 单元测试: pnpm --filter @leh/shared test
# 类型检查: pnpm typecheck
```

开局默认刘备军（`playerFactionId=2`，成都 id=19）。硬刷新 `Ctrl+Shift+R`。

## 项目结构

```
shared/   类型、Zod、纯函数（人口/迷雾/官道/天花板）
server/   Express API + 引擎（engine/*）+ 静态 JSON
client/   Vite + React + Konva + Zustand
docs/     设计真源（见 HANDOFF 文档地图）
```

## 加一个新 API 端点

1. **引擎** `server/src/engine/<system>.ts` — 纯函数 `(state, args) => GameState`，抛 `Error` 表示业务失败  
2. **服务** `server/src/services/game.ts` — 更新 `currentGame`，返回 `getClientGame()`（已脱敏）  
3. **路由** `server/src/routes/game.ts` — `POST /api/game/...`  
4. **客户端** `client/src/services/api.ts` + `stores/gameStore.ts` + 对应 Panel  
5. **文档** `docs/06-api-design.md` Demo 段 + `docs/04` 相关节 + `HANDOFF` / `10-progress` 双写  

## 加一个新引擎模块

- 放在 `server/src/engine/`  
- 若公式/常量需前后端共用 → `shared/`  
- 回合末钩子加在 `server/src/engine/turn.ts` 的 `advanceTurn`  
- 在 `docs/04-game-systems.md` 对应章节末尾注明 `> 代码：server/src/engine/xxx.ts`

## 测试

- 纯函数：`shared/*.test.ts`（vitest）  
- 跑：`pnpm --filter @leh/shared test`  
- 业务 API：手动/curl 黑盒；改玩法后须实际点一遍再写「怎么验证」

## 提交规范

- Conventional Commits：`feat:` / `fix:` / `docs:` / `test:`  
- 每次提交只做一件事  
- **完成即文档**：进度 `10-progress` + `HANDOFF` + 触及的设计文档  

## 数字真源

规模数字只改 `docs/08-data-dictionary.md`，再同步其它文档。

## 一次只攻一个大系统

见 `docs/12-system-map.md`（S01~S19）。禁止并行新开多个大系统。
