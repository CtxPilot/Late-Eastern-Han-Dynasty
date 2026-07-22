# 技术架构

> 文档状态：核心架构对齐 Session 157（2026-07-23）
> S16 已有 v1 信封、完整快照校验、迁移分派、受锁内存恢复与可序列化 PRNG；生产存取/API/UI/SQLite 尚未实现，图中数据库层仍以虚线标注

## 一、总体架构图

```
┌──────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐   │
│  │  React   │  │  Zustand │  │  Konva.js          │   │
│  │  18 组件  │  │  store   │  │  Canvas(地图+战斗)  │   │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘   │
│       │             │                │                │
│  ┌────┴─────────────┴────────────────┴──────────┐    │
│  │          api.ts (axios + WebSocket)           │    │
│  │    REST: 全部操作请求 + WS: AI/事件推送       │    │
│  └──────────────────────┬───────────────────────┘    │
└─────────────────────────┼───────────────────────────┘
                          │  :3001
┌─────────────────────────┼───────────────────────────┐
│                    Server (Node.js)                  │
│  ┌─────────────────────┴────────────────────────┐   │
│  │        app.ts — Express + CORS + JSON + WS   │   │
│  └──────┬──────────────┬──────────────────┬─────┘   │
│         │              │                  │          │
│  ┌──────┴──────┐  ┌───┴──────────────┐ ┌─┴──────┐  │
│  │  Routes     │  │   middleware/    │ │  ws/    │  │
│  │  game.ts    │  │   errors.ts      │ │broadcast│  │
│  │  (REST API) │  │   AppError       │ │ .ts     │  │
│  └──────┬──────┘  └──────────────────┘ └────────┘  │
│         │                                            │
│  ┌──────┴──────────────────────────────────────┐    │
│  │     services/game.ts — 业务流程编排器        │    │
│  │      权限校验·状态变更·引擎调用·响应组装      │    │
│  └──────┬──────────────────────────────────────┘    │
│         │                                            │
│  ┌──────┴──────────────────────────────────────┐    │
│  │              Game Engine                      │    │
│  │ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │    │
│  │ │ turn     │ │ battle   │ │ diplomacy   │  │    │
│  │ │ .ts      │ │  (主引擎) │ │ .ts         │  │    │
│  │ ├──────────┤ ├──────────┤ ├─────────────┤  │    │
│  │ │ civil    │ │ march    │ │ spy         │  │    │
│  │ │ .ts      │ │ .ts      │ │ .ts         │  │    │
│  │ ├──────────┤ ├──────────┤ ├─────────────┤  │    │
│  │ │ economy  │ │ appoint  │ │ plot        │  │    │
│  │ │ .ts      │ │ .ts      │ │ .ts         │  │    │
│  │ ├──────────┤ ├──────────┤ ├─────────────┤  │    │
│  │ │ event    │ │ beauty   │ │ plotAi      │  │    │
│  │ │ .ts      │ │ .ts      │ │ .ts         │  │    │
│  │ ├──────────┤ ├──────────┤ ├─────────────┤  │    │
│  │ │ family   │ │ child    │ │ personal    │  │    │
│  │ │ .ts      │ │ .ts      │ │ .ts         │  │    │
│  │ ├──────────┤ ├──────────┤ ├─────────────┤  │    │
│  │ │ ai       │ │ aiMilitry│ │ spyAi       │  │    │
│  │ │ .ts      │ │ .ts      │ │ .ts         │  │    │
│  │ ├──────────┤ ├──────────┤ │             │  │    │
│  │ │ intel    │ │ debate   │ └─────────────┘  │    │
│  │ │ .ts      │ │ .ts      │                  │    │
│  │ └──────────┘ └──────────┘                  │    │
│  │ ┌──────────────────────────────────────┐   │    │
│  │ │  battle/ 子模块                       │   │    │
│  │ │  hex.ts · damage.ts · terrain.ts     │   │    │
│  │ │  pathfinding.ts · simpleAi.ts        │   │    │
│  │ │  crit.ts · duel.ts                   │   │    │
│  │ └──────────────────────────────────────┘   │    │
│  └──────────────────┬────────────────────────┘    │
│                     │                               │
│  ┌──────────────────┴──────────────────────────┐   │
│  │              Data Layer                      │   │
│  │  ┌────────────────┐  ┌──────────────────┐  │   │
│  │  │ loader.ts      │  │ server/src/scripts│  │   │
│  │  │ Zod 校验后加载  │  │  验证/生成脚本    │  │   │
│  │  └───────┬────────┘  └──────────────────┘  │   │
│  │  ┌───────┴──────────────────────────────┐  │   │
│  │  │ Static JSON (server/src/data/)       │  │   │
│  │  │ officers/cities/formations/units/    │  │   │
│  │  │ items/skills/females/children/       │  │   │
│   │   │  scenarios/events  — 共 10 文件       │  │   │
│  │  └──────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────┐  │   │
│  │  │ db/ (空) — 生产持久化仍未实现        │  │   │
│  │  │ v1信封/迁移/内存恢复/PRNG 已在代码层 │  │   │
│  │  └──────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

## 二、技术栈选型

| 层 | 技术 | 选型理由 |
|----|------|---------|
| 前端框架 | React 18 + TypeScript | 组件化生态丰富，类型安全 |
| 构建工具 | Vite 5 | 快速HMR，原生ESM支持 |
| 状态管理 | Zustand | 轻量无boilerplate，适合游戏高频状态更新 |
| Canvas渲染 | Konva.js | React Canvas库，支持分层/事件/动画 |
| CSS | Tailwind CSS | 实用优先，快速响应式布局 |
| 后端框架 | Express + TypeScript | 轻量灵活，生态成熟 |
| 实时通信 | ws (WebSocket) | AI回合结束/战斗状态推送 |
| 数据库 | better-sqlite3 (已装，未用) | 生产存取介质待实现；现有 S16 仅完成格式、校验、迁移和内存恢复契约 |
| 运行时校验 | Zod | TypeScript 仅编译时，JSON 数据需运行时校验 |
| 包管理 | pnpm workspace | Monorepo原生支持，磁盘高效 |
| HTTP客户端 | axios | 前端API调用 |
| 单元测试 | Vitest | 兼容 TS，与 Vite 生态一致 |

## 三、Monorepo 结构

```
Late-Eastern-Han-Dynasty/
├── package.json                     # Monorepo 根
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── AGENTS.md                        # 执行agent必读
├── CONTRIBUTING.md                  # 人类贡献指南
├── HANDOFF.md                       # 会话交接
│
├── shared/                          # 共享类型·校验·工具
│   ├── index.ts                     # 入口聚合
│   ├── stamina.ts                   # 体力系统
│   ├── ceiling.ts / .test.ts        # 五维天花板 + 隐藏加成
│   ├── demographics.ts / .test.ts   # 人口四桶 + 粮耗
│   ├── city-roads.ts / .test.ts     # 0-A 30城官道邻接
│   ├── mask-state.ts                # S06 服务端视野裁剪
│   ├── intel.ts                     # 谍报四级可见性
│   ├── positions.ts                 # 三轨官职定义
│   ├── vitest.config.ts
│   ├── enums/
│   │   └── index.ts                 # 全部枚举定义
│   ├── types/                       # 24 个类型文件
│   │   ├── index.ts                 # 入口聚合
│   │   ├── game.ts                  # → GameState (主状态容器)
│   │   ├── officer.ts · city.ts · faction.ts · army.ts
│   │   ├── unit.ts · formation.ts · combatAbility.ts
│   │   ├── item.ts · skill.ts
│   │   ├── battle.ts · intel.ts · spy.ts · plot.ts
│   │   ├── diplomacy.ts · event.ts · scenario.ts
│   │   ├── female.ts · child.ts
│   │   ├── debate.ts · duel.ts
│   │   ├── common.ts                # 基础通用类型
│   │   └── save.ts                  # 存档结构（预留）
│   ├── validators/
│   │   └── index.ts                 # Zod 校验 Schema 集合
│   └── data/
│       └── cities-geo-reference.ts  # 城池 WGS84→等距圆柱投影
│
├── server/                          # 后端 (Node.js + Express)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 # 启动入口：HTTP + WS
│       ├── app.ts                   # Express 应用工厂
│       ├── routes/
│       │   └── game.ts              # 全部 REST API 路由
│       ├── services/
│       │   └── game.ts              # 业务逻辑编排器
│       ├── engine/                  # 20 个引擎模块 (核心)
│       │   ├── turn.ts              # 回合推进
│       │   ├── civil.ts             # 内政 (开发/施米/征兵/训练)
│       │   ├── economy.ts           # 势力金粮汇总同步
│       │   ├── march.ts             # 出征/占城/撤退
│       │   ├── battle.ts            # 战斗主引擎
│       │   ├── diplomacy.ts         # 外交 (进贡/结盟/献美)
│       │   ├── spy.ts               # 谍报引擎
│       │   ├── spyAi.ts             # AI 谍报决策
│       │   ├── plot.ts              # 计谋 S17（三层：战术/战略/国策）
│       │   ├── plotAi.ts            # AI 计谋决策
│       │   ├── event.ts             # 事件触发器
│       │   ├── family.ts            # 家族跟随
│       │   ├── child.ts             # 子女登场
│       │   ├── beauty.ts            # 美女资源
│       │   ├── personnel.ts         # 人事(搜索/登用/婚配)
│       │   ├── appoint.ts           # 三轨任命
│       │   ├── ai.ts                # AI 基础框架(内政占位)
│       │   ├── aiMilitary.ts        # AI 军事(占城/袭扰)
│       │   ├── debate.ts            # 舌战系统 MVP
│       │   └── intel.ts             # 城池情报辅助
│       ├── battle/                  # 战斗子模块
│       │   ├── hex.ts               # 六角网格坐标工具
│       │   ├── damage.ts            # 伤害公式
│       │   ├── terrain.ts           # 地形消耗/修正表
│       │   ├── pathfinding.ts       # BFS 移动范围
│       │   ├── crit.ts               # 暴击/反击/连击引擎
│       │   ├── duel.ts               # 单挑引擎
│       │   └── simpleAi.ts          # 简易战斗 AI
│       ├── data/
│       │   ├── loader.ts            # JSON 数据加载 + Zod 校验
│       │   ├── officers.json        # 30 武将 (0-A)
│       │   ├── cities.json          # 30 城 (0-A)
│       │   ├── formations.json      # 6 阵型 (0-A)
│       │   ├── units.json           # 9 兵种 (0-A: 6陆+3水)
│       │   ├── items.json           # 20 宝物 (0-A)
│       │   ├── skills.json          # 30 技能 (0-A)
│       │   ├── females.json         # 10 女性 (0-A)
│       │   ├── children.json        # 5 子女 (0-A)
│       │   ├── scenarios.json       # 2 剧本 (0-A)
│       │   └── events.json          # 24 事件 (0-A)
│       ├── scripts/                 # 验证/生成工具
│       │   ├── validate-data.ts     # pnpm validate-data 入口
│       │   ├── generate-0a-data.ts  # 0-A 数据集生成
│       │   ├── sync-city-coords.ts  # 城池坐标同步
│       │   ├── verify-child-engine.ts
│       │   ├── verify-fire-tactic.ts
│       │   ├── verify-scenario-events.ts # 场景/事件32项断言
│       │   └── verify-geo-google.ts
│       ├── middleware/
│       │   └── errors.ts            # AppError + 错误处理
│       └── ws/
│           └── broadcast.ts         # WebSocket 广播
│
├── client/                          # 前端 (Vite + React)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── public/
│   │   └── geo-basemap.png          # Natural Earth 底图
│   └── src/
│       ├── main.tsx                 # DOM 挂载
│       ├── App.tsx                  # 根组件 + 屏幕路由
│       ├── stores/
│       │   └── gameStore.ts         # Zustand 全局状态
│       ├── services/
│       │   └── api.ts               # axios API 客户端
│       ├── components/
│       │   ├── layout/
│       │   │   ├── GameLayout.tsx   # 主布局 (三栏)
│       │   │   ├── TopBar.tsx       # 顶部栏 (资源+回合)
│       │   │   ├── LeftPanel.tsx    # 左侧政务菜单
│       │   │   ├── RightPanel.tsx   # 右侧城详面板
│       │   │   ├── AppointPanel.tsx # 任命面板
│       │   │   ├── BeautyPanel.tsx  # 美女资源面板
│       │   │   ├── FamilyPanel.tsx  # 家族面板
│       │   │   ├── PersonnelPanel.tsx # 人事面板
│       │   │   ├── PlotPanel.tsx    # 计谋面板
│       │   │   └── SpyPanel.tsx     # 谍报面板
│       │   ├── map/
│       │   │   ├── WorldMap.tsx     # 地图容器
│       │   │   ├── MapCanvas.tsx    # Canvas 渲染
│       │   │   ├── mapLod.ts        # LOD 层级管理
│       │   │   └── mapViewport.ts   # 视口/缩放/平移
│       │   ├── battle/
│       │   │   └── BattleView.tsx   # 战斗场景 (六角)
│       │   ├── events/
│       │   │   └── EventDialog.tsx  # 事件选项弹窗
│       │   └── ui/
│       │       └── AccSection.tsx   # 折叠式区块
│       └── hooks/                   # (预留)
│
└── docs/                            # 设计文档 (15 文件)
    ├── 00-dev-constitution.md       # 开发宪法
    ├── 01-overview.md               # 项目概述
    ├── 02-architecture.md           # ← 本文
    ├── 03-data-models.md            # 数据模型
    ├── 04-game-systems.md           # 玩法系统
    ├── 05-combat-system.md          # 战斗/单挑
    ├── 06-api-design.md             # API 设计
    ├── 07-ui-design.md              # UI 设计
    ├── 08-data-dictionary.md        # 数据字典
    ├── 09-roadmap.md                # 路线图
    ├── 10-progress.md               # 开发进度
    ├── 11-context-management.md     # 上下文管理
    ├── 12-system-map.md             # 22 大系统
    ├── 13-three-kingdoms-chronicle.md # 三国编年史
    └── 14-officer-stats-reference.md # 武将五维参考
```

## 四、前端分层

```
UI 层 (React Components × 16)
  └─→ 状态层 (Zustand Store — gameStore)
        └─→ 服务层 (api.ts — axios + WS)
              └─→ 类型层 (shared/types × 24)
```

**组件树**（主屏幕 `GameLayout`）：
```
GameLayout
├── TopBar               # 年月/季节/金粮兵/结束回合/待决事件
├── LeftPanel            # 政务菜单 (AccSection 折叠)
│   ├── 人事 → PersonnelPanel / AppointPanel / BeautyPanel
│   ├── 外交 → 势力列表 + 进贡/结盟/献美按钮
│   ├── 谍报 → SpyPanel
│   ├── 计谋 → PlotPanel
│   ├── 家族 → FamilyPanel
│   └── 己方城池列表
├── WorldMap             # 大地图 (Konva)
│   └── MapCanvas        # 底图层 + 城市标记层
└── RightPanel           # 城池详情
    └── 人口/内政/军事/日志
```

**战斗屏幕**（`BattleView`）是独立全屏组件，覆盖在主布局之上。

## 五、后端分层

```
路由层 (routes/game.ts — 469 行 REST 端点)
  └─→ 服务层 (services/game.ts — 769 行编排器)
        └─→ 引擎层 (engine/ × 20 + battle/ × 7)
              └─→ 数据层 (loader.ts → JSON + Zod)
```

路由层 | REST API 端点，WebSocket 事件处理
服务层 | 业务流程编排、权限校验（当前回合玩家）、状态变更
引擎层 | 纯游戏逻辑（伤害计算/AI决策/事件触发），无副作用
数据层 | 静态 JSON → loader.ts Zod 校验 → `staticData` 对象

## 六、核心数据流

### 用户操作流程

```
用户点击"开发"按钮
  → Client: api.ts POST /api/civil/develop
    → Server: routes/game.ts 路由
      → services/game.ts 权限校验（本势力/本城）
        → engine/civil.ts 计算新值
          → services/game.ts 更新 GameState + 日志
            → 返回完整 gameState
              → Client: gameStore 更新 Zustand
                → React 重渲染 UI
```

### 结束回合流程（含 AI）

```
玩家点击"结束回合"
  → Client: POST /api/turn
    → Server: turn.ts 顺序执行:
      1. tickEconomy     — 金粮生产 + 同步 faction 缓存
      2. tickDemographics — 人口生育/衰老/死亡
      3. tickEvents      — 检查事件触发器
      4. tickDiplomacy   — 外交状态过期/更新
      5. tickSpyMonth    — 间谍任务结算
      6. tickPlotsMonth  — 计谋月度结算
      7. tickFollowCheck — 自动投奔检定
      8. tickChildrenAppear — 子女登场
      9. runAllAiPlots   — AI 发起计谋
     10. runAllAiSpy     — AI 谍报相位
     11. runAiMilitary   — AI 出征占城
     12. syncFactionResources — 全势力金粮同步
  → WebSocket 逐个推送 AI 行动
  → return 完整 GameState 给当前玩家
```

### 战斗流程

```
出征 (march.ts)
  → 创建 BattleState + BattleUnit
    → 玩家回合: 选单位 BFS 移动范围 → 执行指令
      → 攻击/战法/火计/移动 → 引擎计算 → 更新战场
        → 敌方回合: simpleAi 决策
          → 单挑触发: 6状态机(设计完成)
            → 一方全灭/撤退 → settleBattle
              → 占城/败撤/俘虏 → 更新 GameState
```

### 服务端视野裁剪（S06）

```
所有 GET /state 响应 → maskGameStateForPlayer()
  ┌─ 己方城池: full detail (金粮人口武将)
  ├─ 同盟城池: 兵力档中值 + 经济隐
  ├─ 他方城池(有detailed情报): 详细数据
  ├─ 他方城池(无情报): 迷雾 (ruler=null, 数据为0)
  └─ 在野武将: 保留可见; 敌将/敌特工: 不返回
```

## 六-A、引擎可移植性边界（Web → 其他客户端/引擎）

> 本节是架构约束，不是迁移 Godot 或其他引擎的路线承诺。迁移成本必须以实际 spike 测量，禁止预先宣称固定复用比例。

当前架构对未来更换表现层有一定准备：权威 `GameState`、静态 JSON、共享 TypeScript 合约与大部分规则位于 `shared/` / `server/`，React、Zustand、Konva 主要承担客户端交互和显示。但“规则与画面分离”不等于代码可以原样跨语言复用。

| 类别 | 当前真源 | 更换客户端时的预期 |
|---|---|---|
| 静态数据与存档交换格式 | JSON + Zod / `shared/types` | 可保留字段语义；需为新运行时重建校验、迁移和枚举映射 |
| 纯规则/算法 | `shared/`、`server/src/engine/`、`server/src/battle/` | 公式和测试向量可复用；跨语言通常需重写代码 |
| 服务端权威状态与权限裁剪 | `server/src/services/game.ts`、REST/WS | 可继续作为远端后端；若改本地单机则需重建编排、并发锁和持久化 |
| HTML UI | React + Tailwind | 需要按目标引擎 UI 系统重写 |
| 地图/战斗渲染与输入 | Konva + 浏览器事件 | 需要按目标场景树、摄像机、坐标和输入模型重写 |
| 客户端状态 | Zustand | 只作服务端状态投影与临时 UI 状态，不得成为第二套权威规则源 |

为保持可移植性，新增功能应遵守：

1. 规则函数不接收 DOM、React、Konva 节点或 Canvas context。
2. 可序列化状态只存数据与稳定 ID，不存渲染对象、回调或运行时节点引用。
3. 客户端通过明确 API 命令请求变更，服务端校验结算后返回状态；不要用全局 EventBus 绕过权威边界。
4. 动画事件可以作为服务端结果的表现性投影，但不能反向决定规则结算。
5. 关键算法保留确定性夹具/测试向量；未来跨语言端以相同输入输出验收。
6. 迁移前先做最小 spike：加载一个剧本、显示一张地图、推进一回合和执行一次战斗结算，再以实测工时决定路线。

## 七、引擎模块职责速查

| 引擎 | 文件 | 行数 | 核心功能 |
|------|------|:----:|---------|
| **回合** | `engine/turn.ts` | ~200 | 年/月/季推进 · 内政/谍报/计谋/子女时序编排 |
| **内政** | `engine/civil.ts` | ~150 | 即时版开发/施米 · 征兵/训练 · 人口结构联动 |
| **经济** | `engine/economy.ts` | 23 | 城池金粮 → faction 缓存同步 |
| **战斗** | `engine/battle.ts` | 806 | 六角战场 · 伤害 · 战法 · 火计 · 克制 · 状态效果 |
| **战斗子模块** | `battle/hex.ts` | — | 六角坐标计算 (轴向坐标) |
| | `battle/damage.ts` | — | 伤害公式 + 属性修正 |
| | `battle/terrain.ts` | — | 7种地形移动/攻防修正 |
| | `battle/pathfinding.ts` | — | BFS 移动范围 + 地形消耗 |
| | `battle/crit.ts` | — | 暴击/反击/连击引擎（§6.2~6.5） |
| | `battle/duel.ts` | — | 单挑引擎（§8 全自动结算） |
| | `battle/simpleAi.ts` | — | 简易战斗 AI（占位） |
| **出征** | `engine/march.ts` | — | 扣兵粮 · 开战 · 胜败占城/撤退/回流 |
| **谍报** | `engine/spy.ts` | 1118 | 招募 · 探秘 · 驻守反间 · 枕边风 · AI间谍 |
| **计谋** | `engine/plot.ts` | 659 | S17 三层：L1 美人计·离间·假情报·空城 ✅ / L2 战略计谋(釜底抽薪/调虎离山/暗渡陈仓等) / L3 国策态势(以逸待劳/远交近攻等) |
| **外交** | `engine/diplomacy.ts` | — | 进贡 · 结盟 · 献美 |
| **事件** | `engine/event.ts` | — | tickEvents 条件触发 · pending 选项队列 |
| **家族** | `engine/family.ts` | — | 妻子跟随 · 自动投奔检定 · 释放出仕 |
| **子女** | `engine/child.ts` | 261 | 登场年龄 · 母教 · 属性+技能 · 城/势力分配 |
| **美女** | `engine/beauty.ts` | — | 寻访 · 库存 · 赏赐 · 掠夺 · 点化女间谍 |
| **人事** | `engine/personnel.ts` | — | 搜索在野 · 登用 · 赏赐 · 婚配 |
| **任命** | `engine/appoint.ts` | — | 三轨(文/地/武) · 0-A精简枚举 · 门槛 |
| **AI基础** | `engine/ai.ts` | — | 内政占位决策框架 |
| **AI军事** | `engine/aiMilitary.ts` | — | 边境袭扰 · 兵力优势占城 |
| **舌战** | `engine/debate.ts` | — | 4论牌卡牌对决 · MVP |
| **情报** | `engine/intel.ts` | — | 开战前城池表面情报 |

## 八、共享层 (shared/) 工具模块

| 模块 | 用途 |
|------|------|
| `stamina.ts` | 体力系统：上限公式 `80+武/2+统/10+(政+智+魅)/50+merit×2+年龄修正`；月恢复公式；5个有效属性导出 |
| `ceiling.ts` | 五维天花板（曹100/吕100/诸葛100/荀100/刘100）+ 隐藏属性加成值（吕布武+50等） |
| `demographics.ts` | 人口四桶（男成/女成/男童/女童）· 粮耗公式 · 自然生育/衰老 · 寻访美女消耗女成 |
| `city-roads.ts` | 0-A 30城官道邻接表（无向边），定义出征可达性（Session 39 定稿） |
| `mask-state.ts` | S06 服务端视野裁剪：迷雾/同盟/Detailed/己方四级可见性；maskGameStateForPlayer |
| `intel.ts` | 城池视野枚举：己方·同盟·表面·侦查·无；getCityVisibility 判定 |
| `positions.ts` | 三轨官职定义 + meetsPositionReq + formatReq（S11/S12） |

## 九、通信协议

| 用途 | 协议 | 理由 |
|------|------|------|
| 操作请求/响应 | REST (axios) | 标准CRUD，易于调试 |
| AI 回合进度 | WebSocket (ws) | AI处理可能耗时，逐个推送避免客户端轮询 |
| 事件推送 | WebSocket | 事件可能在任意时间触发（含pending提醒） |
| 战斗同步 | REST | 回合制战斗，每次行动请求/响应 |

## 十、脚本与验证

| 脚本 | 命令 | 用途 |
|------|------|------|
| `pnpm validate-data` | `scripts/validate-data.ts` | 所有 JSON 文件 Zod 校验（expected units=9） |
| `pnpm test` | Vitest | 单元测试：ceiling/demographics/city-roads + 全量 68 测试 |
| `pnpm lint` | — | TypeScript 检查 (tsc --noEmit) |
| `generate-0a-data.ts` | — | 0-A 小数据集重新生成（**勿盲跑**，会覆盖战法与水军） |
| `verify-child-engine.ts` | — | 子女引擎 4 用例验证 |
| `verify-fire-tactic.ts` | — | 火计 4 用例验证 |
| `pnpm verify-scenario-events` | `verify-scenario-events.ts` | 两剧本隔离、反事实分支、角色/子女白名单、玩家/AI事件、史料层与过期失效验证 |

## 十一、数据层详解

```
server/src/data/loader.ts
  1. readFile JSON (10 文件)
  2. Zod Schema 校验 (shared/validators/index.ts)
  3. 构建 StaticData 对象 (map<string, T>)
  4. 后续通过 getStaticData() 访问

数据文件版本: 0-A (小数据集)
  officers=30 · cities=30 · formations=6 · units=9(6陆+3水)
  items=20 · skills=30 · females=10 · children=5
  scenarios=2 · events=24
```

## 十二、决策记录

| 日期 | 决策 | 理由 |
|------|------|------|
| 2026-07-15 | REST + WebSocket 而非全 REST | AI 回合需推送通知 |
| 2026-07-15 | Konva.js 而非原生 Canvas | React 集成更好、分层渲染 |
| 2026-07-15 | Zustand 而非 Redux | 轻量，适合游戏高频状态更新 |
| 2026-07-15 | better-sqlite3 已装，存档待 S16 | 单机游戏不需要独立数据库 |
| 2026-07-15 | pnpm workspace monorepo | shared types 共享，避免代码重复 |
| 2026-07-15 | Zod 运行时校验 | JSON 非 TS 类型，需运行时防错 |
| 2026-07-16 | Phase 0-A → 0-B 分拆 | 先小数据验证架构再扩容 |
| 2026-07-19 | 场景级势力/角色/事件白名单 | 同一静态数据包支持英雄集结与190历史切片而不串数据 |
| 2026-07-16 | 武将水军适性 ≥ C | NONE 仅纯文官（Session 71） |
| 2026-07-16 | 单挑 经典化：必杀参与循环 | 发扬经典三向克制精神 (Session 75) |
| 2026-07-16 | 美女 = 资源，历史女角 = 家族 | 两种不同系统 (Session 43) |
| 2026-07-16 | 服务端视野裁剪 | 避免客户端误读敌方数据 (Session 56) |
| 2026-07-18 | 零新依赖原则（Session 100） | React+Konva+Zustand+Tailwind+原生 WS+原生 Web Audio 覆盖 90% 前端体验需求，不引 framer-motion/gsap/PixiJS/D3/G6/howler.js |
| 2026-07-18 | DuelStage 混合范式（Session 100） | 静态元素 react-konva 声明式 + 动效 Konva.Animation + layer.getContext() 命令式 |
| 2026-07-18 | screen 六态栈（Session 100） | 'boot'\|'world'\|'campaign'\|'tactical'\|'melee'\|'duel'，栈式回退 |
| 2026-07-18 | appearance 字段落库（Session 100） | officers.json 新增 appearance（scale/auraColor/weaponLength/shadingMode/pheasantPlume/mount/ghostForm），同步 08 真源 |
| 2026-07-18 | 计谋三级联动服务端驱动（Session 100） | BattleState.activeStrategem 字段，前端订阅渲染，非前端独立切换 |

---

## 附：S20/S21 前端体验技术储备（Session 122 部分实装）

> 本节源自 Session 100 技术储备；现统一编号为 S20-W1~W4 / S21-W6~W9。Session 122 已实装 `OfficerDetail`、`OfficerRosterPanel` 与统一人事终审窗，其余仍为规划。详见 `docs/07-ui-design.md` §11~§12。

### 新增前端组件清单（实装状态）

| 组件 | 路径（规划） | 职责 | 所属系统 |
|------|------|------|:--:|
| `useBroadcast` | `client/src/hooks/useBroadcast.ts` | 原生 WebSocket 订阅 server/ws/broadcast.ts | S20-W1 |
| `TurnProgressOverlay` | `client/src/components/layout/TurnProgressOverlay.tsx` | endTurn 进度遮罩 | S20-W1 |
| `useAnimatedNumber` | `client/src/hooks/useAnimatedNumber.ts` | rAF + easeOutCubic 数字跳动 | S20-W2 |
| `mapTerritory` | `client/src/components/map/mapTerritory.ts` | graham scan 凸包纯函数 | S20-W3 |
| `TerritoryLayer` | `client/src/components/map/TerritoryLayer.tsx` | 势力领土 polygon | S20-W3 |
| `FogLayer` | `client/src/components/map/FogLayer.tsx` | globalCompositeOperation 挖洞迷雾 | S20-W3 |
| `FactionPanel` | `client/src/components/layout/FactionPanel.tsx` | 派系面板（tags 派生） | S20-W4 |
| `OfficerDetail` | `client/src/components/officer/OfficerDetail.tsx` | 武将详情 modal（✅ Session 122） | S20-W4 |
| `OfficerRosterPanel` | `client/src/components/layout/OfficerRosterPanel.tsx` | 己方在职武将列表 + 忠诚度警报（✅ Session 122） | S20-W4 |
| `OfficerPortrait` | `client/src/components/officer/OfficerPortrait.tsx` | 程序化人物头像；四名代表人物手工预设 + 其他武将稳定默认轮廓（✅ Session 124 简化切片） | S20-W4 / S22 |
| `CommandConfirmDialog` | `client/src/components/ui/CommandConfirmDialog.tsx` | 状态变更命令统一终审窗（✅ Session 122，人事首批接入） | S20-W4/§12 |
| `RadarChart` | `client/src/components/ui/RadarChart.tsx` | 纯 SVG 手写外交雷达 | S20-W4 |
| `AdminOfficePanel` | `client/src/components/layout/AdminOfficePanel.tsx` | 行政总署三段式重组 | S20-W4 |
| `DuelStage` | `client/src/components/battle/DuelStage.tsx` | 单挑 Konva 演出层（混合范式） | S21-W9 |
| `MeleeStage` | `client/src/components/battle/MeleeStage.tsx` | 白刃战横版 Konva 方阵 | S21-W8 |
| `Soldier` | `client/src/battle/soldier.ts` | 白刃战小兵粒子类（移植用户 demo） | S21-W8 |
| `HeroCharacter` | `client/src/battle/heroCharacter.ts` | HeroCharacter extends Soldier 特殊造型 | S21-W8 |
| `frameCount` | `client/src/battle/frameCount.ts` | 模块级共享帧计数 | S20-W3 |
| `meleeBackground` | `client/src/battle/meleeBackground.ts` | 白刃战视差背景 PCG | S20-W3 |
| `meleeStrategem` | `client/src/battle/meleeStrategem.ts` | 白刃战计谋全屏粒子 | S20-W3 |
| `useAudio` | `client/src/hooks/useAudio.ts` | 原生 Web Audio API 程序化合成 | S21-W9 |
| `inkMountains` | `shared/pcg/inkMountains.ts` | PCG 水墨山脉纯函数 | S20-W3 |
| `naturalRiver` | `shared/pcg/naturalRiver.ts` | PCG 自然河流纯函数 | S20-W3 |
| `terrainTiles` | `shared/pcg/terrainTiles.ts` | PCG 战术树/山/水纹绘制 | S20-W3 |
| `strategemVisuals` | `shared/pcg/strategemVisuals.ts` | PCG 计谋视觉（火烟/水环/伏兵雾） | S20-W3 |
| `factionInner` | `client/src/lib/factionInner.ts` | 派系判定纯函数（tags 派生） | S20-W4 |

### 新增数据字段（规划，实装时同步 08 真源）

| 字段 | 类型 | 位置 | 说明 |
|------|------|------|------|
| `OfficerStatic.appearance` | `SpecialAppearance?` | `shared/types/officer.ts` + officers.json | 武将特殊造型（scale/auraColor/weaponLength/shadingMode/pheasantPlume/mount/ghostForm） |
| `BattleState.activeStrategem` | `'none'\|'fire'\|'water'\|'ambush'?` | `shared/types/battle.ts` | 计谋三级联动视觉驱动字段 |
| `gameStore.floatingDelta` | `{gold,food,reason}[]` | `client/src/stores/gameStore.ts` | 财政飘字 delta（前端算，非服务端字段） |

### screen 状态机扩展（规划）

```
当前: 'boot' | 'world' | 'battle'
规划: 'boot' | 'world' | 'campaign' | 'tactical' | 'melee' | 'duel'
                                        ↑hex       ↑白刃    ↑单挑
栈式回退：单挑结束回白刃，白刃结束回 hex，hex 结束回大地图
```

### 0-B 前置技术债（D-0B-1~13）

详见 `docs/12-system-map.md` §六。核心：Zustand store 拆 slice（D-0B-1）/ LOD 拖拽冻结（D-0B-2）/ screen 状态机栈式管理（D-0B-6）/ appearance+avatarGene 全量填写（D-0B-7）/ §35 财政俸禄（D-0B-9）/ activeStrategem 字段（D-0B-11）/ S17 L2 水攻伏兵引擎（D-0B-12）/ 字体资产闭环后的剩余 UI 适配（D-0B-13）。

---

*文档版本: v2.6 | 最后更新: 2026-07-23 | Session 158 S16 边界与技术债同步*
