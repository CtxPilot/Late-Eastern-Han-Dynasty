# 技术架构

> 文档状态：核心架构对齐 **Session 372（2026-08-22）**
> 存档双轨：服务端 SQLite 命名槽位（Session 340，`$XDG_DATA_HOME/leh/saves.db`）+ 浏览器 IndexedDB 槽位（`client/src/services/save-idb.ts`），规则收敛 `shared/save-limits.ts`。
> 双运行模式：联机（Express 权威，`pnpm dev` 默认）与离线（同一套权威引擎内嵌 Web Worker，本地 `?offline=1`、GitHub Pages 构建默认），经 `client/src/services/gateway.ts` 分发；详见 §五-A。多用户/云同步仍后置。

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
│  │  │ save-store.ts (SQLite 槽位, S340)     │  │   │
│  │  │ v1信封/迁移/内存恢复/PRNG 快照        │  │   │
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
| 数据库 | better-sqlite3 | **Session 340**：命名槽位生产介质 `$XDG_DATA_HOME/leh/saves.db`；信封仍为完整 `SaveEnvelopeV1` JSON 文本列；多用户/云同步后置 |
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
│       ├── engine/                  # 36 个引擎模块 (核心)
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
│       │   ├── state-pipeline.ts    # 双端共用编排(建局/回合管线/存档信封,S372)
│       │   ├── campaign.ts          # 战役层(S98)：编成/行军/自动战/围城
│       │   ├── factionPolitics.ts   # S27 城级派系(开垦/巡查/兵装/弹劾)
│       │   ├── hostageFamilies.ts   # 质任家属处置(S351)
│       │   ├── grandStrategist.ts   # 总军师(S37 简化)
│       │   ├── hegemony.ts          # 霸府/称王(HC-P0~P2)
│       │   ├── items.ts             # 宝物装备(S13)
│       │   ├── meritGrant/militaryMerit/nobility/policy/relations/tournament…
│       ├── battle/                  # 战斗子模块
│       │   ├── hex.ts               # 六角网格坐标工具
│       │   ├── damage.ts            # 伤害公式
│       │   ├── terrain.ts           # 地形消耗/修正表
│       │   ├── pathfinding.ts       # BFS 移动范围
│       │   ├── crit.ts               # 暴击/反击/连击引擎
│       │   ├── duel.ts              # 单挑引擎
│       │   └── simpleAi.ts          # 简易战斗 AI
│       ├── data/
│       │   ├── loader.ts            # JSON 数据加载 + Zod 校验
│       │   ├── officers.json        # 223 武将 (0-A 现行)
│       │   ├── cities.json          # 30 城 (0-A)
│       │   ├── formations.json      # 7 阵型 (0-A, 含补录冲阵)
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
│       ├── App.tsx                  # 根组件 + 场景栈路由 + 字体屏障
│       ├── stores/
│       │   └── gameStore.ts         # Zustand 全局状态（经 gateway 发指令）
│       ├── services/
│       │   ├── api.ts               # 在线 axios 客户端（114 导出）
│       │   ├── gateway.ts           # 在线/离线策略分发（S372）
│       │   ├── offline/offline-api.ts # 离线实现子集（Worker RPC）
│       │   └── save-idb.ts          # IndexedDB 存档槽位介质（S372）
│       ├── workers/
│       │   ├── game.worker.ts       # 浏览器内权威引擎宿主（镜像 service 层）
│       │   ├── browser-loader.ts    # 静态数据装载 shim（替代 node:fs 版 loader）
│       │   └── protocol.ts          # 主线程 ↔ Worker 消息契约
│       ├── components/
│       │   ├── layout/              # GameLayout / TopBar / 弹窗门禁
│       │   ├── command/             # 九域命令坞 + 各域抽屉（CMD-P0~P38 唯一入口）
│       │   ├── battle|battlefield|events|family|map|officer|scenario|ui …
│       │   └── （组件清单以仓库为准，此处不再逐一枚举）
│       └── utils/                   # 字体屏障 / 派生工具
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
    ├── 12-system-map.md             # 27 大系统
    ├── 13-three-kingdoms-chronicle.md # 三国编年史
    └── 14-officer-stats-reference.md # 武将五维参考
```

## 四、前端分层

```
UI 层 (React 组件 — 命令坞九域 + 抽屉 + 场景视图)
  └─→ 状态层 (Zustand gameStore — sceneStack 驱动 screen)
        └─→ 服务层 (services/gateway.ts — 在线/离线策略分发)
              ├─[在线] api.ts (axios REST + WS)
              └─[离线] offline-api.ts ──► workers/game.worker.ts（权威引擎）
                                          └─ save-idb.ts（IndexedDB 槽位）
                    └─→ 类型层 (shared/types)

**组件树**（主屏幕 `GameLayout`，CMD-P0~P38 后命令坞为全部玩家写链唯一入口）：
```
GameLayout
├── TopBar                 # 年月/季节/金粮兵/结束回合门禁/存档导出·导入·槽位
├── MapCanvas              # 大地图 (Konva)：底图+城市层+LOD
├── CommandShell           # 九域命令坞：内政/军事/人事/外交/计略/情报/屯田/家族/朝廷/势力
│   └── *OverviewDrawer    # 各域分面抽屉（唯一提交入口，统一终审窗）
├── EventDialog            # 待决事件弹窗
└── FamilyTreatmentDialog  # 家属质任待决弹窗（S351）
```

**战斗场景**是同一局游戏内的全屏场景。独立郡域战场批准后采用 Zustand 场景栈 `world → battlefield → melee/tactical → duel`，不为每层新增浏览器路由；服务端进行中状态仍是恢复与校验真源。

## 五、后端分层

```
路由层 (routes/game.ts — ~1250 行，80+ REST 端点)
  └─→ 服务层 (services/game.ts — ~2400 行编排器，withLock 串行)
        ├─→ 引擎层 (engine/ × 36 + battle/ × 10，纯函数 state+rng→newState)
        │     └─ state-pipeline.ts 双端共用管线（联机/离线同源结算，S372）
        └─→ 数据层 (loader.ts → JSON + Zod)
```

路由层 | REST API 端点，WebSocket 事件处理
服务层 | 业务流程编排、权限校验（当前回合玩家）、状态变更
引擎层 | 纯游戏逻辑（伤害计算/AI决策/事件触发），无副作用
数据层 | 静态 JSON → loader.ts Zod 校验 → `staticData` 对象

## 五-A、双运行模式（Session 372）

| | 联机模式（`pnpm dev` 默认） | 离线模式（本地 `?offline=1`；GitHub Pages 构建 `VITE_OFFLINE=1` 默认） |
|---|---|---|
| 权威结算 | Express 服务端 `services/game.ts`（withLock + runtimeRandom） | 浏览器 Web Worker `workers/game.worker.ts`（模块级 currentGame+RNG 单例，逐函数镜像 service 层） |
| 结算代码 | `server/src/engine/*` + `engine/state-pipeline.ts` | **同一份代码**（Vite 打包进 Worker；`leh-browser-loader` 插件把 loader 的 fs 实现重定向为虚拟数据注入） |
| 存档介质 | SQLite 槽位（XDG 数据目录） | IndexedDB 槽位（`save-idb.ts`），槽位规则/2MB 上限共用 `shared/save-limits.ts` |
| 分发 | `gateway.ts` 按 URL 参数/环境变量合并离线子集覆盖在线实现；未覆盖指令回退在线（断网时以错误提示呈现） | 同左 |

边界：白刃战 melee、郡域战场实例、总军师、势力总览、技能树、关系查询等约 30 个接口离线未覆盖；PWA 预缓存（完全离线冷启动）后置。

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
行政大地图出征
  → 服务端校验外交/编成/粮草/跨郡路径
    → 创建 War + BattlefieldInstance，冻结历史模板版本
      → Army 抵达郡界后从显式入口进入目标郡
        → 郡域节点行军
          → 同节点接触/攻击驻军/强攻城池 → Encounter
            → 自动 / 标准 / 六角微操（同一战前快照）
              → EncounterResult 回写郡域战场
                → 战争结束后 BattlefieldSettlement 原子回写 GameState
```

当前 Demo 仍使用 `activeBattlefield` / `activeMelee` 单场状态；上述正式实例化从 P1 开始分期实施，P2 才完成多实例、场景栈与中途恢复门禁。

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
| **战斗** | `engine/battle.ts` | ~1850 | 六角战场 · 移动/攻击/战法/火计/观天 · 协同包围 · 撤退追击 · 攻城修正 · 单挑编排 |
| **战斗子模块** | `battle/hex.ts` | — | 六角坐标计算 (轴向坐标) |
| | `battle/damage.ts` | — | 伤害公式 + 属性修正 |
| | `battle/terrain.ts` | — | 7种地形移动/攻防修正 |
| | `battle/pathfinding.ts` | — | BFS 移动范围 + 地形消耗 |
| | `battle/crit.ts` | — | 暴击/反击/连击引擎（§6.2~6.5） |
| | `battle/duel.ts` | — | 单挑引擎（§8 全自动结算） |
| | `battle/simpleAi.ts` | — | 简易战斗 AI（占位） |
| **出征** | `engine/march.ts` | — | 扣兵粮 · 开战 · 胜败占城/撤退/回流 |
| **谍报** | `engine/spy.ts` | 1118 | 招募 · 探秘 · 驻守反间 · 枕边风 · AI间谍 |
| **计谋** | `engine/plot.ts` + `engine/policy.ts` | — | S17 三层：L1 四计 ✅ / L2 **十一计 ✅339–347** / L3 **八国策 ✅348**（`policy.ts`） |
| **外交** | `engine/diplomacy.ts` | — | 进贡 · 结盟 · 献美 |
| **事件** | `engine/event.ts` | — | tickEvents 条件触发 · pending 选项队列 |
| **家族** | `engine/family.ts` | — | 妻子跟随 · 自动投奔检定 · 释放出仕 |
| **子女** | `engine/child.ts` | 261 | 登场年龄 · 母教 · 属性+技能 · 城/势力分配 |
| **美女** | `engine/beauty.ts` | — | 寻访 · 库存 · 赏赐 · 掠夺 · 点化女间谍 |
| **人事** | `engine/personnel.ts` | — | 搜索在野 · 登用 · 赏赐 · 婚配 |
| **任命** | `engine/appoint.ts` | — | 三轨(文/地/武) · 0-A精简枚举 · 门槛 |
| **战役** | `engine/campaign.ts` | ~1763 | 编成/行军/自动战 runAutoBattle/围城劝降/设施（S98 最小切片） |
| **白刃** | `engine/meleeRound.ts` | ~373+ | 标准模式回合 · 战术点 · applyMeleeSettlement 结算回写 |
| **质任** | `engine/hostageFamilies.ts` | ~146 | 家属失陷 → 待决处置(善待/中立/镇压) + 季度余波 |
| **城级派系** | `engine/factionPolitics.ts` | ~522 | 开垦/巡查/兵装/弹劾 + 月度派系 tick（S27） |
| **总军师** | `engine/grandStrategist.ts` | ~493 | 任命/解职/态势切换/月度忠诚 tick |
| **霸府** | `engine/hegemony.ts` | ~386 | 开府/称王门槛与原子称王/伪诏宣战（HC-P0~P2） |
| **宝物** | `engine/items.ts` | ~325 | 装备/卸下/赏赐/初始宝配（S13） |
| **功绩** | `engine/meritGrant.ts` + `militaryMerit.ts` | ~80 | 统一发放守卫 + 军事功绩口径 |
| **爵位** | `engine/nobility.ts` | ~65 | 王命封爵七级（HC-P1-4） |
| **国策** | `engine/policy.ts` | ~222 | L3 八国策：一策一时/下月生效/冷却6月 |
| **关系网** | `engine/relations.ts` | ~172 | 季度同城/同征/被俘/联姻演变（S24） |
| **大会** | `engine/tournament.ts` | ~213 | 年度正月16人单败大会（S19） |
| **人心** | `engine/mandateEffects.ts` | ~94 | 月度叛逃检定等 S26 效果 |
| **双端管线** | `engine/state-pipeline.ts` | ~230 | buildGameState/runEndTurnPipeline/buildSaveEnvelope/adoptSaveEnvelope（S372） |
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
| `pnpm test` | Vitest | 单元测试：shared **422**（含各系统纯函数）+ client **54** |
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

数据文件版本: 0-A 现行
  officers=223 · cities=30 · formations=7(6基础+冲阵) · units=9(6陆+3水)
  items=20 · skills=30 · females=10 · children=5
  scenarios=2 · events=24
```

## 十二、决策记录

| 日期 | 决策 | 理由 |
|------|------|------|
| 2026-07-15 | REST + WebSocket 而非全 REST | AI 回合需推送通知 |
| 2026-07-15 | Konva.js 而非原生 Canvas | React 集成更好、分层渲染 |
| 2026-07-15 | Zustand 而非 Redux | 轻量，适合游戏高频状态更新 |
| 2026-08-16 | Session 340：`better-sqlite3` 命名槽位库 `$XDG_DATA_HOME/leh/saves.db` | 单机游戏不需要独立数据库服务；多用户/云同步后置 |
| 2026-07-15 | better-sqlite3 选型写入架构表 | 存档介质当时仍待 S16 实装 |
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
| 2026-08-22 | Session 372：离线双运行模式 | gateway 分发 + 权威引擎内嵌 Web Worker + IndexedDB 槽位；结算复用同一 engine/state-pipeline 保证在线/离线一致；引擎禁用 `Math.random` 默认参 |
| 2026-08-22 | Session 370/372：GitHub Pages 发布 | 子路径 base 由环境变量注入、CSS 字体 URL 构建期重写；Pages 构建默认离线可玩 |

---

## 附：S20/S21 前端体验技术储备（Session 232 部分实装）

> 本节源自 Session 100 技术储备；现统一编号为 S20-W1~W4 / S21-W6~W9。至 Session 232，
> 命令坞壳与朝廷、人事、外交、军事、内政、计略六域原子迁移已完成；W1～W3 与 W4
> 其余增强仍按表中状态推进。详见 `docs/07-ui-design.md` §11~§12。

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
| `CommandDock` / `CommandShell` | `client/src/components/command/` | 九域命令坞、抽屉状态机与跨域导航（✅ CMD-P0～P29 持续实装） | S20-W4/§12 |
| `DiplomacyOverviewDrawer` | `client/src/components/command/DiplomacyOverviewDrawer.tsx` | 外交三分面、交涉/盟约写链（✅ CMD-P12～P15） | S20-W4/§12 |
| `MilitaryOverviewDrawer` | `client/src/components/command/MilitaryOverviewDrawer.tsx` | 军备/编成/军令/战报唯一入口（✅ CMD-P17～P21） | S20-W4/§12 |
| `CivilOverviewDrawer` | `client/src/components/command/CivilOverviewDrawer.tsx` | S03 内政写链与 S09 跨系统寻访（✅ CMD-P23～P25） | S20-W4/§12 |
| `StrategyOverviewDrawer` | `client/src/components/command/StrategyOverviewDrawer.tsx` | S17 四计态势、草稿、终审、记录与跨情报导航（✅ CMD-P27～P29；唯一入口） | S20-W4/§12 |
| `IntelOverviewDrawer` | `client/src/components/command/IntelOverviewDrawer.tsx` | S07 玩家可见情报四分面与全部玩家写链（P34 唯一入口） | S20-W4/§12 |
| `FamilyOverviewDrawer` | `client/src/components/command/FamilyOverviewDrawer.tsx` | S18 四分面、婚配/手动跟随草稿、统一终审与最新状态复验（P37） | S20-W4/§12 |
| `RadarChart` | `client/src/components/ui/RadarChart.tsx` | 纯 SVG 手写外交雷达 | S20-W4 |
| `AdminOfficePanel` | `client/src/components/layout/AdminOfficePanel.tsx` | 行政总署三段式重组 | S20-W4 |
| `DuelStage` | `client/src/components/battle/DuelStage.tsx` | 单挑 Konva 演出层（混合范式） | S21-W9 |
| `MeleeStage` | `client/src/components/battle/MeleeStage.tsx` | 白刃战横版 Konva 方阵 | S21-W8 |
| `Soldier` | `client/src/battle/soldier.ts` | 白刃战小兵粒子类（依据本项目原创规格实现） | S21-W8 |
| `HeroCharacter` | `client/src/battle/heroCharacter.ts` | HeroCharacter extends Soldier 特殊造型 | S21-W8 |
| `frameCount` | `client/src/battle/frameCount.ts` | 模块级共享帧计数 | S20-W3 |
| `meleeBackground` | `client/src/battle/meleeBackground.ts` | 白刃战视差背景 PCG | S20-W3 |
| `meleeStrategem` | `client/src/battle/meleeStrategem.ts` | 白刃战计谋全屏粒子 | S20-W3 |
| `useAudio` | `client/src/hooks/useAudio.ts` | 原生 Web Audio API 程序化合成 | S21-W9 |
| `inkMountains` | `shared/pcg/inkMountains.ts` | PCG 水墨山脉纯函数 | S20-W3 |
| `naturalRiver` | `shared/pcg/naturalRiver.ts` | PCG 自然河流纯函数 | S20-W3 |
| `terrainTiles` | `shared/pcg/terrainTiles.ts` | PCG 战术树/山/水纹绘制 | S20-W3 |
| `strategemVisuals` | `shared/pcg/strategemVisuals.ts` | PCG 计谋视觉（火烟/水环/伏兵雾） | S20-W3 |
| `formationCore` | `shared/formation-core.ts` | 阵型共享解析器（合法性/贡献/部署/解释纯函数，✅ Session 289） | S10-FM / FM-P2 |
| `factionInner` | `client/src/lib/factionInner.ts` | 派系判定纯函数（tags 派生） | S20-W4 |

### 新增数据字段（含已实装项，实装时同步 08 真源）

| 字段 | 类型 | 位置 | 说明 |
|------|------|------|------|
| `OfficerStatic.appearance` | `SpecialAppearance?` | `shared/types/officer.ts` + officers.json | 武将特殊造型（scale/auraColor/weaponLength/shadingMode/pheasantPlume/mount/ghostForm） |
| `BattleState.activeStrategem` | `'none'\|'fire'\|'water'\|'ambush'?` | `shared/types/battle.ts` | 计谋三级联动视觉驱动字段 |
| `Formation.meleePercent` | `{atk,def,mobility}?` | `shared/types/formation.ts` + formations.json | 标准模式白刃百分比修正（✅ Session 290，meleeRound 单一内容源） |
| `MeleeState.commandCache` | `Record<string,{round,result}>?` | `shared/types/battlefield.ts` + `shared/game-state-battle-schema.ts` | 白刃战动作级幂等缓存（✅ Session 290） |
| `gameStore.floatingDelta` | `{gold,food,reason}[]` | `client/src/stores/gameStore.ts` | 财政飘字 delta（前端算，非服务端字段） |

### 场景栈扩展（已批准，P2 实装）

```
应用壳: 'boot'（不进入游戏场景栈）
游戏栈: 'scenario' | 'world' | 'battlefield' | 'melee' | 'tactical' | 'duel'

回退：duel → melee/tactical → battlefield → world
```

前端栈只保存场景 ID、镜头与选择等瞬态信息；`BattlefieldInstance`、`Encounter`、Army、节点控制、模板版本及权威 PRNG 快照属于服务端 `GameState`。刷新或读档时先恢复权威快照，再由进行中状态重建场景栈，禁止把前端栈反写为游戏真源。

### 独立郡域战场数据流（已批准，P0～P6）

- 静态层：版本化 `CommanderyDefinition` / `CountyDefinition` / route / landmark，经 Zod 校验后加载；全量目标与 105 个行政治所一一对应。
- 实例层：`BattlefieldInstance` 冻结模板版本，记录 Army、节点/路线状态、Encounter 与生成审计。
- 接战层：自动、标准和六角微操消费同一战前快照并输出统一 `EncounterResult`。
- 回写层：单一幂等服务端事务同步城市控制、势力列表、Army、武将、伤亡与战利品。
- 随机层：静态模板零 RNG；动态部署、天气、遭遇及 P3 战场 AI 行动显式注入权威 `xorshift32-v1`，实现整场复现。

**双层数据模型结论（Q11 已落地，Session 174）**：`BattlefieldMap`（Tier I 大地图层，数字 `cityId`，19 个活跃调用点：`client/services/api.ts`、`server/engine/battlefield.ts`、`server/services/game.ts`、`shared/game-state-battle-schema.ts`、`client/stores/gameStore.ts`、`client/components/battlefield/BattlefieldPanel.tsx` 等）与 `BattlefieldInstance`（Tier II 郡域场景层，字符串 `countyId`，6 个调用点：`shared/battlefield-instance-schema.ts`、`shared/nanjun-battlefield.ts`、`client/stores/gameStore.ts`、`client/components/battlefield/BattlefieldSceneView.tsx` 等）**保持独立，不合并不废弃**。两类型服务不同层级（30 城邻接切片战场 vs 郡治+属县+水系+关隘历史地理场景），数据源、ID 体系、调用方均不同；废弃或合并都会破坏大量既有调用点与 CampaignArmy 62/62。`GameState.activeBattlefield` 与 `activeBattlefieldInstance` 场景栈强制互斥（不可同时非 null，Zod `superRefine` + orchestrator 双重护栏），`activeBattles`（六角战斗层）与两者均可父子共存。两类型未来可通过 `targetCommanderyId` / `worldCityId` 互引做一致性校验（预留接口，不强制实装）。详见 `docs/25-bf-p2-design.md` §四。

**县级攻打与月度 tick（Q9 已落地，Session 176）**：`engageCounty(countyId: string)` orchestrator 接受字符串 countyId（区别于 P1 `engageJiangling` 借用数字 `cityId=14` 的 hack），复用既有 `runAutoBattle` 自动结算引擎（设计文档 §7.2 三种结算模式之一），不调 `createBattle`（六角，需数字 cityId 体系，县级无映射——`runAutoBattle` `defCity` 参数用 `cityId=0` fallback，`city` 不存在时 `defCmd=undefined` 降级，`spoils=0` 符合 Q6"不产生金粮"）。攻占效果按 Q6/Q9 边界：不写入 `GameState.cities`、不产生金粮收入、不触发 S03/S04；仅更新 `BattlefieldInstance.nodeStates` + `CampaignArmy.troops`。`tickBattlefieldInstance(state)` 月度 tick（在 `endTurn` 的 `tickCampaignMarch`/`tickCampaignGarrison` 之后调用）实现：(1) 驻军消耗——已占领县 `controlTurns++`，`garrison==0` 时掉控制（`rulerFactionId=null`）；(2) 补给线切断（0-A 简化版）——攻方占领至少 1 个首批县 → 守方所有 CampaignArmy morale -5（真正"补给线经过攻方控制县"判定需 Army 在郡域内移动，当前 Army 在大地图层，两者无映射；糧耗×2 留 P5/R6）。首批 3 县（当阳/华容/枝江）开放为可攻打目标，其余 12 县仍为纯静态展示。详见 `docs/25-bf-p2-design.md` §二。

### 0-B 前置技术债（D-0B-1~13）

详见 `docs/12-system-map.md` §六。核心：Zustand store 拆 slice（D-0B-1）/ LOD 拖拽冻结（D-0B-2）/ screen 状态机栈式管理（D-0B-6）/ appearance+avatarGene 全量填写（D-0B-7）/ §35 财政俸禄（D-0B-9）/ activeStrategem 字段（D-0B-11）/ S17 L2 水攻伏兵引擎（D-0B-12）/ 字体资产闭环后的剩余 UI 适配（D-0B-13）。

---

*文档版本: v3.0 | 最后更新: 2026-08-22 | Session 372 双运行模式对齐（27 大系统口径）*
## Session 277：六角战旗纯核心分层

S10 战旗新增三层纯核心：`tactical-grid` 只负责坐标/A*/障碍，`melee-engagement` 只负责
1~2格武器与朝向，`tactical-system` 负责阶段/事件/撤销/配置/规则策略。服务端编排层必须
重新校验客户端预览，React/Konva 不持有权威战斗规则。完整依赖方向、扩展协议与流程见
`27-tactical-wargame-system.md`。
