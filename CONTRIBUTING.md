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

首次进入先在 ScenarioSelect 选择剧本与势力；当前可选英雄集结或190《关东义兵》四槽技术切片。硬刷新 `Ctrl+Shift+R`。

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

见 `docs/12-system-map.md`（S01~S22）。禁止并行新开多个大系统。

## 跨平台字体铁律（Linux / Windows / macOS 三平台防御）

> 详见 `docs/00-dev-constitution.md` §11.3 + §11.7、`AGENTS.md` 核心规则 9、`client/public/fonts/README.md`。

### 禁止

- **禁止**在任何 CSS / Canvas / Konva 代码中引用宿主系统字体
  - 例：`font-family: "微软雅黑"` / `"华文行楷"` / `"Arial"` / `"PingFang SC"` —— 跨平台必然乱码或回退
  - Linux 极简发行版（Arch）可能无 CJK 字体 → Canvas 城市名直接 `□□□`（豆腐块）

### 必须

- **必须**使用工程内部别名 `HanDynastySerif`（正文/古籍）/ `HanDynastySeal`（官印/篆书）
  - 通过 `client/src/styles/fonts.css` 的 `@font-face` 加载本地 woff2
  - Konva `<Text>` 节点必须显式 `fontFamily="HanDynastySerif"`（Konva 默认是 `Arial`，跨平台不一致）
- **必须**在 `client/src/App.tsx` 的 FontBarrier 通过后才渲染 Canvas
  - `waitForGameFonts()` 阻塞等待字形写入内存，防第一帧画错字体
- 新增字体须同时提交 woff2 到 `client/public/fonts/` + 提供 OFL / SIL OFL 授权证明

### 工程规范（编码 / 换行符 / CI）

- 静态数据 JSON 必须 **UTF-8 (no BOM)**，CI 会自动拦截非 UTF-8 提交
- 换行符统一 **LF**（`.editorconfig` + `.gitattributes` 强制，Windows 协作者 IDE 会自动遵循）
- PR 提交后 GitHub Actions 自动跑 typecheck / lint / test / validate-data / 编码门禁
- 字体 woff2 文件**不入 git**（`.gitignore` 排除 `*.woff2`），开发者按 `client/public/fonts/README.md` 手动放入
