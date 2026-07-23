# Contributing · 贡献指南

Thank you for helping build an open-source historical strategy simulation framework. Tests, documentation, accessibility, historical-source review, and focused engine changes are all useful contributions.

感谢你参与这个开源历史策略模拟框架。AI Agent 请先读 `AGENTS.md` 与 `HANDOFF.md`；人类贡献者也应先了解本文所列的事实边界和验证要求。

## 开始之前

- 先搜索现有 Issue；较大的功能或数据扩容请先开 Issue 讨论范围，并使用 [`docs/19-design-proposal-templates.md`](docs/19-design-proposal-templates.md) 区分“提案”与“已定设计”。
- 一次 PR 聚焦一个大系统（`docs/12-system-map.md` 的 S01~S22）。
- 不要把 `docs/` 中标记为“设计中”的能力描述为已实现。
- 不提交商业字体、商业游戏素材、来源不明图片或模仿知名游戏构图的资产。
- 参与项目即表示同意遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

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

提交 PR 前至少运行：

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm verify-campaign
pnpm verify-save-entities
pnpm verify-save-campaign
pnpm verify-save-battle
pnpm verify-save-diplomacy
pnpm verify-save-intel
pnpm verify-save-plot
pnpm verify-save-game-state
pnpm verify-save-migration
pnpm verify-battle-rng
pnpm verify-duel-rng
pnpm verify-civil-rng
pnpm verify-plot-spy-rng
pnpm verify-personnel-rng
pnpm verify-family-rng
pnpm verify-beauty-rng
pnpm verify-grand-strategist-rng
pnpm verify-ai-military-rng
pnpm verify-march-fog
pnpm validate-data
pnpm verify-scenario-events
```

若修改单挑、暴击/反击/连击、子女或火计，请额外运行同目录对应的 `verify-*.ts`。涉及 UI 的 PR 必须说明实际点击路径、预期结果和测试环境；截图应来自本仓库实际运行界面。

## Pull request 清单

- [ ] PR 标题采用 Conventional Commits 风格。
- [ ] 描述“改了什么 / 为什么 / 如何验证 / 尚未实现什么”。
- [ ] 新行为有测试或验证脚本覆盖。
- [ ] 静态规模数字先改 `docs/08-data-dictionary.md`，再同步引用处。
- [ ] 功能改动已同步 `docs/10-progress.md`、`HANDOFF.md` 和受影响设计文档。
- [ ] 未引入来源不明、不可再分发或与 MIT 不兼容的资产。

## Issue 与安全报告

Bug 报告请给出复现步骤、预期行为、实际行为、环境和必要截图。功能建议请明确所属 Sxx 系统、最小范围和为什么适合框架定位。

安全漏洞不要公开提交 Issue；请按 [SECURITY.md](SECURITY.md) 私下报告。

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
- 新增字体必须提供 OFL / SIL OFL 授权证明，并更新 `client/public/fonts/README.md`；当前字体二进制按仓库策略不进入 Git。

### 工程规范（编码 / 换行符 / CI）

- 静态数据 JSON 必须 **UTF-8 (no BOM)**，CI 会自动拦截非 UTF-8 提交
- 换行符统一 **LF**（`.editorconfig` + `.gitattributes` 强制，Windows 协作者 IDE 会自动遵循）
- PR 提交后 GitHub Actions 自动跑 typecheck / lint / test / validate-data / 编码门禁
- 字体 woff2 文件**不入 git**（`.gitignore` 排除 `*.woff2`），开发者按 `client/public/fonts/README.md` 手动放入
