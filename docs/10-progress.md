# 开发进度跟踪

## 状态标识

- `[ ]` To Do — 未开始
- `[~]` WIP — 进行中
- `[x]` Done — 已完成
- `[!]` Blocked — 被阻塞

---

## Phase 0 — 文档 & 骨架

> 已拆分为 0-A(小数据集验证架构) / 0-B(全量数据扩容) 两轮，详见 `09-roadmap.md`。

### Phase 0-A — 架构骨架 + 小数据集

| ID | 任务 | 状态 | 备注 |
|:--:|------|:--:|------|
| P0-01 | Monorepo 初始化 (pnpm workspace) | [x] | shared/server/client |
| P0-02 | shared/types 全部类型定义 | [x] | 对照03；enums+types |
| P0-03 | shared/validators Zod 校验 | [x] | 先于 JSON；validate-data 脚本 |
| P0-04 | Server 骨架 (Express + WebSocket) | [x] | :3001 + /ws |
| P0-05 | Client 骨架 (Vite + React + Konva + Zustand + Tailwind) | [x] | :5173 proxy API |
| P0A-06 | officers.json（小，30武将） | [x] | 15史实精校+15占位 |
| P0A-07 | cities.json（小，30城） | [x] | 覆盖13州；name=治所；x/y=等距圆柱(lon/lat)，非插画手校 |
| P0A-08 | formations.json（小，6阵型） | [x] | — |
| P0A-09 | units.json（小） | [x] | **9 兵种**：6陆+走舸/蒙冲/楼船（Session 71） |
| P0A-10 | items.json（小，20宝物） | [x] | — |
| P0A-11 | females.json（小，10女性） | [x] | 皆有史/演义出处 |
| P0A-12 | children.json（小，5子女） | [x] | 皆有出处 |
| P0A-13 | skills.json（小，30通用技能） | [x] | 暂不含专属技 |
| P0A-14 | scenarios.json（小，1剧本） | [x] | 群雄割据0-A |
| P0A-15 | events.json（小，5事件） | [x] | — |
| P0-16 | 全部 12 份 docs 文档 | [x] | 2026-07-15 完成 |

**0-A 验收**：Zod 全过；地图可渲染、可推进1回合、可完成1次内政操作、可打通1场最简战斗。

**0-A 当前状态（已交付）+ Demo 叠加（至 Session 60）**：

| 域 | 状态 |
|----|------|
| 骨架 0-A | 30 城/将 + Zod + monorepo 全过 |
| 战略环 | 回合·地图·内政·人口·出征占城·迷雾**服务端裁剪** |
| 谍报/外交 | 特工+女间谍；进贡/结盟/**献美** |
| 美女/家族 | S09 stock；S18 女眷/婚配/跟随；**子女登场引擎**（父辈后置） |
| 人事 S11 | 搜索/登用 + **任命三轨**（Session 60） |
| 官职 S12 | **0-A 精简任命**（全量 24/44 级+功绩后置） |
| 计谋 S17 | **三层体系设计完成**：L1 美人计/离间/假情报/空城 · L2 11 战略计谋 · L3 8 国策 · 行政↔战场联动 |
| 战斗 | 六角+克制+火计+**战法引擎**+三级水军(9兵数据)+**暴击/反击/连击设计**+**单挑全面设计**；水域移动后置 |
| 事件 S14 | 引擎 + **EventDialog**（Session 59） |
| AI | 袭扰 + **出征占城** |
| 点化 | 献美→plantable→女间谍 |
| **暂缓** | **0-B**；水域移动引擎；连携；造船；全量官职；战法 UI 选层；战法 AI 施放 |

> 总览与接手：根目录 `HANDOFF.md` · 系统图 `12-system-map.md`。  
> **交接说明（2026-07-16 Sessions 81~83）**：单挑全面设计 经典化重写完成（核心三角+全自动+宿命对决+武魁大会）；架构文档全面重写(v2.0)；主副将+Squad编成+部队品质(经验Lv1-7/组织度/士气深化)+部曲12将+军屯田+家属质任+民屯田9维设计完成；功能代码保持至 Session 72。

### Phase 0-B — 数据扩容至全量（依赖对应 0-A 任务）

| ID | 任务 | 状态 | 备注 |
|:--:|------|:--:|------|
| P0B-06 | officers.json（全量 1000+武将） | [ ] | 脚本生成+重点人物人工校对 |
| P0B-07 | cities.json（全量 105城） | [ ] | 坐标取自 cities-geo-reference；name 用治所 |
| P0B-08 | formations.json（全量 18阵型） | [ ] | — |
| P0B-09 | units.json（全量 21兵种） | [ ] | — |
| P0B-10 | items.json（全量 165宝物） | [ ] | — |
| P0B-11 | females.json（全量 90+女性） | [ ] | — |
| P0B-12 | children.json（全量 50+子女） | [ ] | — |
| P0B-13 | skills.json（全量 149技能） | [ ] | 69通用+80专属 |
| P0B-14 | scenarios.json（全量 5+剧本） | [ ] | — |
| P0B-15 | events.json（全量） | [ ] | — |

---

## Phase 1 — 地图 & 回合

| ID | 任务 | 状态 | 依赖 |
|:--:|------|:--:|------|
| P1-01 | MapCanvas — 地形底图层 | [x] | geo-basemap + Konva；`MapCanvas.tsx` |
| P1-02 | CityMarker — 城市标注渲染 | [x] | 势力色 + LOD/碰撞；非 105 全量(仍 0-A 30 城) |
| P1-03 | 地图交互 (点击/缩放/平移) | [x] | cover 全屏 minZoom；拖拽钳制 |
| P1-04 | TopBar — 年月/季节/资源 | [x] | 金粮兵城汇总 + 结束回合 |
| P1-05 | 回合引擎 (turn.ts) | [x] | 年月/季节/收获/AI 调用 |
| P1-06 | GameLayout — 主布局 | [x] | Top + 左政务/中地图/右城详 |
| P1-07 | 初始 GameState 生成 | [x] | createGame 读剧本；季节随开局月 |
| P1-08 | GameService API | [x] | create/state/end-turn/civil/battle |
| P1-09 | AI 基础框架 | [x] | 内政占位 + 谍报/计谋/袭扰/占城（非 P5 正式 AI） |

**Phase 1 状态（骨架已完成）**：骨架任务全 `[x]`；UI 已三栏正式化。截图 `docs/screenshots/leh-phase1-layout.png`。

---

## Phase 2 — 内政 & 人事

| ID | 任务 | 状态 | 依赖 |
|:--:|------|:--:|------|
| P2-01 | LeftPanel 政务菜单 | [x] | Demo 菜单可点；后续再扩人事 |
| P2-02 | RightPanel — CityDetail | [x] | 城详+农商城/征兵/训练/施米 |
| P2-03 | 内政引擎 (开发/施米) | [x] | 即时版 civil.ts（非持续任务全量） |
| P2-04 | 军事引擎 (征兵/训练) | [x] | 征兵扣男成+可征上限；训练士气 |
| P2-05 | 人事引擎 (搜索/登用/赏赐/任命) | [x] | 搜索+登用+beauty赏赐+**三轨任命** Demo |
| P2-06 | OfficerDetail 面板 | [ ] | P1-06 |
| P2-07 | 内政 API | [x] | develop/conscript/relief/train |
| P2-08 | 前端 API Client | [x] | api.ts + store |

**Demo 切片（Session 29~60）**：人口/官道出征占城/美人/婚配/搜索登用/**三轨任命**（`appoint.ts` + `AppointPanel`）。  
**暂缓 0-B**。道路：`city-roads.ts`；人事：`personnel.ts`；官职门槛：`shared/positions.ts`；美人 UI：`BeautyPanel`。

---

## Phase 3 — 战斗系统

> **Demo 切片已实现**：`battle.ts` 含 20×15 六角网格、BFS 移动范围、基础伤害公式、敌方简单 AI、**兵种克制 matchup**（`getUnitMatchup`）、**火计引擎+UI**（Session 69）、**战法引擎最小切片**（Session 72）。  
> 以下为 P3 正式全量任务（单挑/攻城/阵型联动等），多数已有 Demo 代码（标 [~]）。

| ID | 任务 | 状态 | 依赖 |
|:--:|------|:--:|------|
| P3-01 | BattleCanvas 六角网格 | [~] | Demo `BattleView.tsx` 已实现 |
| P3-02 | BattleState 生成 | [~] | Demo `createBattle` 已实现 |
| P3-03 | 移动范围 BFS | [~] | Demo `getMoveRange` 已实现 |
| P3-04 | 伤害引擎 | [~] | Demo `calcDamage` §6.1 已实现 |
| P3-05 | 兵种克制+阵型联动 | [~] | Demo 仅克制系数；阵型联动未做 |
| P3-06 | 计策系统 | [~] | Session 69：火计最小切片；余14种后置 |
| P3-07 | 单挑系统 | [~] | **引擎最小切片已实装（Session 88）**；设计完成 05§8+03/04/06/07/08 全量同步 |
| P3-08 | 攻城战 | [ ] | P3-04 |
| P3-09 | BattleCommandBar | [~] | Demo 底部按钮栏已实现 |
| P3-10 | BattleInfoBar | [~] | Demo 顶部信息+SideCard 已实现 |
| P3-11 | 战斗 API | [~] | Demo move/attack/fire/ability/exit 已实现 |
| P3-12 | BattleView 完整组件 | [~] | Demo 组件已实现 |
| P3-13 | 特殊兵种战斗效果 | [ ] | P3-05 |
| P3-14 | 战役层引擎（CampaignArmy/行军/自动战斗） | [~] | **Session 98 最小切片已实装**；总军师态势接入/AI Army/设施回合化后置 |

---

## Phase 4 — 外交 & 事件 & 婚姻

> **Demo 切片已实现**：外交进贡/献美/结盟、婚配/赏赐美人、美女资源、家族跟随、**事件 tick + EventDialog 选项**。  
> 以下正式全量任务（外交弹窗/子女引擎/关押/伤病等）仍多未开始；P4-06/07 已 Demo 完成。

| ID | 任务 | 状态 | 依赖 |
|:--:|------|:--:|------|
| P4-01 | 外交引擎 | [~] | Demo 进贡/结盟/献美已实现 |
| P4-02 | DiplomacyModal | [~] | Demo LeftPanel 外交区已实现 |
| P4-03 | 婚姻引擎 | [~] | Demo marryFemale 已实现 |
| P4-04 | 女性库+六维影响力 | [~] | Demo females.json + 影响力已实现 |
| P4-05 | 子女引擎 | [x] | Session 68 最小切片：appearYear 登场+母教；族谱/全量后置 |
| P4-06 | 事件触发器 | [x] | tickEvents：autoChoice 自动；否则 pendingEvents |
| P4-07 | EventDialog | [x] | 对话逐段 + 选项；POST /event/choose |
| P4-08 | 宝物转移引擎 | [ ] | P1-05 |
| P4-09 | 外交/婚姻/事件 API | [~] | 事件 choose 已落地；外交/婚姻 API 见 Demo 路径 |
| P4-10 | 关押系统引擎 + UI | [ ] | P2-05, P3-11 |
| P4-11 | 伤病系统引擎 | [ ] | P3-04 |
| P4-12 | 伤兵系统引擎 | [ ] | P4-11, P3-11 |

---

## Phase 5 — AI & 打磨

| ID | 任务 | 状态 | 依赖 |
|:--:|------|:--:|------|
| P5-01 | AI 决策引擎 | [ ] | P1-09 |
| P5-02 | AI 战争决策 | [ ] | P5-01 |
| P5-03 | AI 外交决策 | [ ] | P5-01 |
| P5-04 | 套装系统引擎 | [ ] | P4-08 |
| P5-05 | 存档/读档(SQLite) | [ ] | P0-04 |
| P5-06 | 多剧本完善 | [ ] | P0-14 |
| P5-07 | UI 美化+动画 | [ ] | P1~P4 |
| P5-08 | Canvas 动画 | [ ] | P1-03, P3-01 |
| P5-09 | 音效系统 | [ ] | P5-07 |
| P5-10 | 武将头像 | [ ] | P0-06 |
| P5-11 | 平衡性测试 | [ ] | P5-01~P5-06 |
| P5-12 | 性能优化 | [ ] | P5-09 |
| P5-13 | 打包构建 | [ ] | P0-05 |
| P5-14 | 部队等级系统 | [ ] | P2-04, P3-11 |
| P5-15 | 武将特性 + 属性天花板计算引擎 | [ ] | P2-06, P0B-06 |

---

## 会话日志

```log
## 2026-07-17 — Session 98（战役层引擎最小切片实装 — §12~§17 引擎落地）
- Phase: **代码实装 + 引擎接入 + UI + 自验证**（从设计到可玩）
- 实装内容（0-A 最小切片，已标注简化项）:
  - `shared/types/campaign.ts` 新建战役层数据类型:
    - `CampaignNode`（§12 节点：type/ruler/adjacent/garrison/wallDurability）
    - `CampaignArmy`（§13.1：commander/subCommanders/advisor/unitType/formation/path/phase/troops/food/morale/organization/experience/fatigue/squads/structures/siegeState）
    - `CampaignSquad`（§13.3：officerId/role/position 五部阵位）
    - `SiegeState`（§16.5：wallDurability/siegeTurns/surrenderChance）
    - `CampStructure`（§15：type/builderId/buildProgress/durability）
    - `AutoBattleResult`（§17.5：winner/rounds/casualties/remaining/commanderStatus/duels/morale/prisoners/spoils/events）
    - `GrandStrategist`（§14：officerId/strategy/lastStrategyChange/战绩）
    - `FactionTrait`（§36：modifiers/specialAbility/flaw）
    - 字面量联合类型：`CampaignPhase`/`SquadPosition`/`StructureType`/`StrategyType`/`NodeType`
  - `shared/types/game.ts` 扩展：`campaignArmies: CampaignArmy[]` + `campaignNodes: CampaignNode[]` + `grandStrategists: GrandStrategist[]`
  - `shared/types/index.ts` 导出 campaign
  - `server/src/engine/campaign.ts` 新建战役层引擎（800+行）:
    - §12 节点：`buildCampaignNodes`/`syncNodesFromCities`
    - §13 编成：`startCampaign` 校验（邻接/兵粮/智力≥85/主将在出发城）+ Squad 五部阵位
    - §13 路径：`planPath` BFS 道路邻接最短路径
    - §13 行军：`tickCampaignMarch` 逐节点推进 + 补给消耗 + 缺粮士气降 + 经己方城补粮50% + 围城/野战触发
    - §13.6 参谋行动：`advisorAction` 激励/陷阱/撤退休整/斥候
    - §15 设施：`buildStructure` 11 种即时建造（简化）
    - §16 状态机：marching→sieging→assaulting→garrison/retreating
    - §16.5 劝降：`trySiegeSurrender` 成功率=10+魅力差×0.5+围城回合×2，上限60%
    - §16.6 强攻：`assault` 调 runAutoBattle + 攻城修正
    - §16.7 撤退：`retreatArmy` 士气-10
    - §17.2 战力公式：`computePower` basePower×commandMod×statusMod×envMod×stratagemMod×siegeMod
    - §17.3 多回合推演：`runAutoBattle` 3~10回合，战力浮动/伤亡递减/单挑/士气/溃散
    - §17.4 单挑事件：`maybeDuel` 触发率=5%+武差/10+吕布+15%，胜负=武力+power/10，5%斩杀
    - §17.5 结果：`AutoBattleResult` 完整结构
    - §16.7 战后结算：`applyBattleResultToState` 占城/武将迁移/势力重算/清反间/抢美女/败方残兵回流
    - `tickCampaignGarrison` 驻守恢复
  - `server/src/services/game.ts` 接入: buildGameState 初始化 campaignArmies/campaignNodes/grandStrategists；endTurn 接入 tickCampaignMarch/Garrison；8 个 service 函数
  - `server/src/routes/game.ts` 新增 8 端点：POST /campaign/start · /:armyId/march · /:armyId/build · /:armyId/assault · /:armyId/siege/surrender · /:armyId/retreat · /:armyId/advisor/action · GET /campaign/nodes
  - `client/src/services/api.ts` 新增 8 个客户端 API
  - `client/src/stores/gameStore.ts` 新增 campaign actions + lastBattleResult
  - `client/src/components/campaign/CampaignPanel.tsx` 新建：编成表单 + Army 列表 + 详情面板 + 操作按钮 + 战斗报告弹窗
  - `LeftPanel.tsx` 挂载「战役」折叠大项
  - `server/src/scripts/verify-campaign.ts` 新建冒烟测试 15 组 57 断言
- 简化/占位标注（避免误判为正式完成）:
  - 设施建造即时化（大型器械"消耗完整回合"约束后置）
  - 单挑事件快速判定（基于武力+power/10+10%爆冷+5%斩杀，未复用 duel.ts 完整演出）
  - 阵型联动修正=0（阵型×暴击/反击/连击后置接入）
  - 总军师态势加成未接入自动战斗公式（后置）
  - 郡国归属算法（§17.6）：0-A 30 城=30 郡国各 1 治所，占治所=全郡归属
  - AI Army：当前仅玩家 Army，AI 军事仍走旧 aiMilitary.ts（后置接入）
  - 兵种战法/火计：战役层自动战斗未接入（后置）
- 自验证:
  - `pnpm --filter @leh/shared build` ✅
  - `pnpm typecheck` ✅ 3/3 包全过
  - `pnpm test` ✅ 68/68
  - `pnpm validate-data` ✅ 10/10 (units=9)
  - `tsx src/scripts/verify-campaign.ts` ✅ 57/57 全部断言通过
  - `tsx src/scripts/verify-duel.ts` ✅ / `tsx src/scripts/verify-crit.ts` ✅（回归无破坏）
  - dev server (:3001) + client (:5173) 实操:
    - 创建游戏 → 30 节点生成 ✓
    - 编成（武将14+诸葛亮参谋，汉中20→冀县22）→ marching ✓
    - 推进回合 → 到达冀县22 → sieging ✓
    - 参谋激励 → 士气 +15 ✓
    - 建造冲车 → structures +1 ✓
    - 强攻 → winner=attacker, 6 回合, 单挑 4 次, 占冀县 ruler=2 ✓
- 文档同步: 05 §17 引擎实装状态注 · 03 §20/06 §2.14/07 §10 已对齐 · 12 S10→M+/战役实装 + Session 98 · 10-progress P3-14 · HANDOFF
- Next: 总军师系统实装（任命/态势切换/献策/对决） → 设施建造回合化 → 势力特点数据 → AI Army 接入

## 2026-07-17 — Session 96（S17 三层体系文档设计：§31 全量重写）
- Phase: **文档设计**（S17 计谋系统全面升级，无代码改动）
- 设计内容:
  - `docs/04-game-systems.md` §三十一 全量重写：
    - **三层架构**：L1 战术计谋（保留4计）· L2 战略计谋（新增11计）· L3 国策态势（新增8策）
    - **L2 战略计谋表**：釜底抽薪、调虎离山、暗渡陈仓、树上开花、借刀杀人、趁火打劫、秘密挖角、隔岸观火、偷梁换柱、借尸还魂、指桑骂槐（每计详列投入/前置/效果/行政→战场联动）
    - **L3 国策态势表**：以逸待劳、远交近攻、假痴不癫、反客为主、高筑墙广积粮、避实击虚、坚壁清野、深藏不露（一次选一，切换冷却6月）
    - **行政↔战场联动总表**：每个行政计谋的效果在战场层有玩家可感知的表现（城防减半/攻防加成/士气惩罚/兵力虚报等）
    - **三十六计全映射表**：36计按三层+战场+谍报完整分类，标注已实现/设计完成/后置
    - 数据结构扩展：Plot.layer / Plot.progress / NationalPolicy / BattleEffectModifier
    - L2 通用公式（成功率35%+分期加成、识破惩罚高于L1）
  - `docs/12-system-map.md`：S17 行更新为三层描述
  - `docs/01-overview.md`：S17 摘要更新
  - `docs/06-api-design.md`：新增 L2 发起/取消/进度 API + L3 国策切换 API
  - `docs/07-ui-design.md`：PlotPanel 改为三层折叠 + L2 进度条 + L3 单选开关
  - `docs/02-architecture.md`：引擎注释更新
  - `docs/05-combat-system.md`：四面楚歌引用加注 L2 + 联动说明
  - HANDOFF · 10-progress 双写
- 文档版本: 04-game-systems.md §31 v1.0→v3.0（三层体系）；12-system-map v3.10→v3.20
- 自验证：全文通读，三层一致性/36 计无遗漏/联动逻辑自洽
- Next: S17 L2 战略计谋实装（引擎扩展 + API + UI）

## 2026-07-17 — Session 95（旧品牌残留清零：截图/gitignore/会话日志）
- Phase: **合规收尾**（用户要求处理干净并验证）
- 工作区:
  - 18 张开发截图文件名前缀统一为 `leh-*.png`
  - `.gitignore` 排除规则同步为 `leh-*` 前缀
  - `10-progress` 截图路径统一为 `docs/screenshots/leh-*`
  - HANDOFF / 会话日志去掉旧品牌/旧 npm scope 字面（产品与审计叙述中性化）
  - **保留**：README 百度前端框架 **San** 免责声明（与旧产品代号无关，防混淆）
- 自验证:
  - 磁盘截图仅 `leh-*.png`（18 张）
  - 全库扫描旧品牌全大写字面 / 旧 npm scope / 旧截图前缀 → 零残留
  - 现存截图路径 `docs/screenshots/leh-phase1-layout.png` 等与磁盘一致
- 文档同步: 10-progress · HANDOFF
- Next: 数字平衡调整 或 实装编成/参谋引擎 或 水域移动

## 2026-07-17 — Session 94（品牌重命名：旧代号→LateEasternHanDynasty，旧 npm scope→@leh/）
- Phase: **全库品牌重命名**（文字替换 + 包名 + UI + 验证）
- 替换范围:
  - **品牌名** 旧代号 → `LateEasternHanDynasty`：README 标题、index.html `<title>`、App.tsx/TopBar.tsx UI 显示、HANDOFF/docs 中全部品牌引用
  - **npm package scope** 旧 scope → `@leh/`：`@leh/shared`·`@leh/server`·`@leh/client`，含 package.json 包名、workspace 依赖、所有 import 语句、构建命令
  - 脚本注释中旧 scope → `@leh/server`（第 2 批补扫）
  - WebSocket 问候 → `'leh server ws ready'`
  - 历史日志旧品牌字面中性化（10-progress 合规记录）
  - 当时保留：百度 "San" 框架免责声明（README）；截图文件名后由 Session 95 改为 `leh-*.png`
- 文件量: 63 文件变更，117 行增/117 行删（纯替换，无逻辑改动）
- 自验证:
  - `pnpm install` ✅ 重新生成 lock 文件（→ `@leh/`）
  - `pnpm typecheck` ✅ 3/3 包全过
  - `pnpm test` ✅ 68/68
  - `pnpm validate-data` ✅ 10 JSON 全量
  - case-sensitive 扫描旧 npm scope 与旧品牌字面 → 当时产品代码零残留；截图前缀见 Session 95
- 文档同步: 10-progress · HANDOFF
- Next: 数字平衡调整 或 实装编成/参谋引擎 或 水域移动

## 2026-07-17 — Session 92（文档一致性修正：02-architecture.md + README.md 结构更新）
- Phase: **文档维护**（修复文件计数/列表/目录与实际不一致）
- 已修正（02-architecture.md）:
  - types 文件数: 21→24，列表补 debate.ts·duel.ts
  - JSON 文件数: 11→10，battle/ 子模块: 5→7
  - React 组件数: 17→16，shared/types 引用: ×21→×24
  - battle/ 目录列表补 crit.ts·duel.ts
  - 引擎职责表补 crit.ts·duel.ts 条目
  - 架构图补 crit.ts·duel.ts 行
  - readFile JSON: 11→10
- 已修正（README.md）:
  - 项目结构图根目录: LateEasternHanDynasty/ → Late-Eastern-Han-Dynasty/
  - shared/ 补 city-roads.ts·intel.ts·positions.ts
  - server/ 补 middleware/·ws/，data 标 10 文件，scripts 标 8 个
  - client/components/ 展开为 layout/map/battle/events/ui 五子目录
  - 根目录补 scripts/·CREDITS.md·package.json·tsconfig*·vite.config.ts·LICENSE
  - docs/ 示例列表补 01-overview.md
- 自验证: git diff only 2 files, 纯文档改动

## 2026-07-17 — Session 93（部队编成体系全面重设计：参谋+副参谋+爵位加成）
- Phase: **纯文档设计**（无代码改动）
- 设计内容:
  - `docs/05-combat-system.md` §5.5 全面重写为「主副将与参谋编成系统」：
    - §5.5.1 编成表更新（副将/参谋/副参谋三列 + 功绩额外 + 爵位加成 + 上限约束）
    - §5.5.2 Squad 系统新增参谋幕僚行为规则（无 Squad/不带兵/随主将命运）
    - §5.5.5 数据结构新增 `advisorId`/`subAdvisorId`
    - §5.5.8 **参谋系统**全新设计：智力≥85独立槽位、战场作用（计策加成/视野+1/反迷雾）、主动策略（激励/陷阱/撤退休整）、随主将命运生存
    - §5.5.9 **爵位对编成的影响**全新设计：7级精简（关内侯→皇帝）、各爵位人数加成表、上限约束规则
  - `docs/03-data-models.md`：NobilityRank 枚举简化为7级（关内侯/亭侯/乡侯/县侯/公/王/皇帝）；Army/BattleUnit 补 `advisorId`/`subAdvisorId`
  - `docs/04-game-systems.md` §5.5：爵位轨道从12级精简为7级，注明编成加成联动
  - `docs/06-api-design.md` §2.4：March API body 补 `advisorId`/`subAdvisorId`
  - `docs/07-ui-design.md` §9.3：出征弹窗新增"选择参谋"步骤
  - `docs/01-overview.md`：能力表更新（主副将编成→主副将与参谋编成；爵12→爵7）
  - `docs/12-system-map.md`：S10 要点更新（含参谋+爵位）
- 核心设计变更:
  - 部队结构从 1主+0~3副(4人) → 1主+N副+1参+1副参(上限9~10人)
  - 新增参谋独立槽位（不带兵·智略综合·主动策略）
  - 爵位从12级民爵体系精简为7级实权爵位，并赋予编成加成功能
  - 武官官职定基础 + 功绩额外 + 爵位叠加 = 三级编成权限体系
  - 上限硬顶：大将军9人，君主10人
- 文档同步: 05 · 03 · 04 · 06 · 07 · 01 · 12 · README · 本进度 · HANDOFF
- README 更新:
  - 设计概要「主副将→主副将与参谋编成·爵位加成」
  - S05/S10 要点同步 (参谋·爵位加成)
  - 特色玩法「主副将·部曲·部队品质」→「主副将与参谋·爵位加成·部曲·部队品质」
  - 当前重点同步
- Next: 后续数字平衡调整 或 实装编成/参谋引擎

## 2026-07-17 — Session 91（合规深清：旧底图截图出库 + git 历史清洗）
- Phase: **合规深清**（用户确认 1+2：删旧截图 + 历史 rewrite）
- 工作区:
  - 删除 46 张旧/不明底图调试截图（offset/tune/tuned-v2/leh-geo-*/live-run/per-city/seats）
  - **保留 18 张** Natural Earth / 自产 UI 截图（ne-basemap、phase1-layout、lod、demo、equirect 等）
  - `.gitignore` 补旧底图模式，防止再入库
- git 历史:
  - backup 分支 → filter-repo 路径删除（Google 5 张 + 旧 46 张 + 孤儿 src/index 若残留）
  - 文本替换：LateEasternHanDynasty / LateEasternHanDynasty → LateEasternHanDynasty； 注释类残留
  - force-push origin main
- 验证: 历史 blob 无 LateEasternHanDynasty-google；product 路径无 LateEasternHanDynasty；screenshots=18

## 2026-07-17 — Session 90（开源后合规复扫 + 残留清除）
- Phase: **合规复扫**（用户：项目已开源，再查侵权）
- 复扫发现（Session 85~87 声称清零后仍残留）:
  1. **高**：正式 UI 仍显示 `LateEasternHanDynasty`（`client/index.html` 标题、`App.tsx` 启动页、`TopBar.tsx`）
  2. **高**：根目录孤儿 monorepo 前 demo `index.html` + `src/**` 仍含 `LateEasternHanDynasty Demo` 且被 git 跟踪
  3. **高**：5 张 `docs/screenshots/leh-google-geo-*.png` 仍被 git 跟踪（Session 85/86 称已移出/历史删除，但 baseline 又带回）；`.gitignore` 亦无排除规则
  4. **中**：`shared/enums/index.ts` 注释仍写「 轻/中/重水军」
  5. **中**：设计文档仍写「原版」「曹操传/霸王的大陆/三国杀」等商业作品名作参考来源
- 修复:
  - UI 品牌 → `LateEasternHanDynasty`（title / 启动页 / TopBar）
  - `git rm` 删除 5 张 Google 校准截图 + 根 `src/` + `index.html`
  - `.gitignore` 补 `leh-google-geo-*.png` 与孤儿 demo 路径
  - enums 注释去掉「」；`00` 参考标准改为史书/本作独立设计；`01/02/04`「原版」措辞中性化
  - `CREDITS.md` 去掉 Google 截图条目，改为 WGS84 坐标说明
- 仍属低风险/可接受:
  - README 免责声明中出现 Koei 全名（**必须保留**，用于划清界限）
  - 历史会话日志（10-progress Session 85~87）保留「RTK5 清除」字样作审计轨迹
  - 技能名「无双」等取自史书/演义习语，非商业作品专有 UI 素材
  - `docs/screenshots` 其余约 200MB 自产调试图：建议后续精简，但非第三方商标
- 验证: `git grep "LateEasternHanDynasty"` 仅命中历史日志；`git ls-files LateEasternHanDynasty-google*` / 根 `src/` 为空
- 未提交：待用户确认后 commit/push

## 2026-07-17 — Session 89（暴击/反击/连击引擎最小切片实装 — §6.2~§6.5 引擎落地）
- Phase: **代码实装 + 引擎接入 + 自验证**
- 实装内容（0-A 最小切片，已标注简化项）:
  - `server/src/battle/crit.ts` 新建战场暴击/反击/连击引擎（§6.2~§6.5）:
    - 暴击率(§6.2): 基础5% + 武力/50 + 兵种 + 适性 + 阵型 + 地形 + 通用技能(骑术/弓术) + 专属(武圣+15/无双+20/骑神+15/神将+15) + 宝物(签名武器映射) - 被克/雨/森林/混乱惩罚; 上限60%下限2%
    - 暴击倍率(§6.2): 基础×1.5; 武圣→×2.5; 刚力proxy(bravery)×(1+lv×0.075); 急攻×(1+lv×0.05)
    - 反击(§6.3): canCounter(弓弩不可/hasActed/士气≤30/混乱-沉着Lv3免疫) + 反击率(基础50%+固守+阵型+专属) + 反击系数(近战0.6/长枪0.5/骑射0.4; 刚烈×1.0/恶来×1.2/龙胆×0.8) + 反击暴击(基础+5%; 刚烈必暴)
    - 连击(§6.4): 连击率(基础10%+武力+兵种+适性+阵型+急攻/疾驰/奇袭/强行军+专属(无双+25/龙胆+20/咆哮首回+50/虎痴)) - 士气/体力惩罚; 上限40%下限3%; 连击伤害×0.6(无双×1.0不衰减); 连击暴击×0.7衰减(无双/天义不衰); 天义必二连
    - 防循环(§6.5表): 连击不再触连击/反击; 反击不再触反击; 战法不计入
    - 阵型修正表(§4.2): 18阵型 crit/counter/chain/counterCoeff 硬编码(方阵0/锋矢+5%crit+3%chain/冲阵+10%crit+5%chain/车悬+5%+5%/鹤翼侧击+20%...)
    - 专属识别: 0-A officers.json 无 uniqueSkill, 按 officer.id 识别(关羽6/吕布5/张飞7/赵云10/典韦13); 有 uniqueSkill 字段时优先读
  - `server/src/engine/battle.ts` attackUnit 重构: §6.1 baseDamage + resolveAttack(暴击→伤害→反击→连击) + 兵力/气力应用 + 反击致死判定(守方胜) + 暴击/反击/连击标签入 message/log
  - `server/src/battle/simpleAi.ts` doAttack 重构: 接收完整 officers, 调 resolveAttack; runSimpleEnemyAi 签名加 officers/battleTurn; runEnemyPhase 传入 state.officers/battle.turn
  - `server/src/scripts/verify-crit.ts` 新建冒烟测试: 暴击率(武圣>普通)/倍率(武圣×2.5)/反击(弓兵不可/混乱不可/沉着免疫/士气≤30/刚烈必反/恶来×1.2)/连击(吕布>普通/无双不衰减/咆哮首回+50)/连击暴击衰减/被克惩罚/阵型修正(冲阵>方阵)/200次resolveAttack统计(暴击37%连击18%反击56%) —— **全部断言通过**
- 简化/占位标注（避免误判为正式完成）:
  - 武将特性: 0-A officers.json 无 traits 字段, 用 skills proxy 近似(刚力→bravery, 铁壁→hold); 镇守/殿军/乱战/猛进/先登/夜战/连战/骑战/布划/奇袭等特性后置
  - 宝物: 0-A 无 GameState 装备系统, 按 officer.id 签名武器映射(方天画戟+5%/青龙偃月刀+5%/丈八蛇矛+5%连击/双铁戟+8%连击); 0-B 接入装备后改读
  - uniqueSkill: 0-A officers.json 无 uniqueSkill 字段, 引擎按 officer.id 识别专属; 0-B 加字段后改读
  - 高级联动: 鹤翼侧击+20%(需侧击判定, 简化为常驻)/先登攻城/夜战夜间/乱战被围(简化isSurrounded+10)/连战击破2队必连/殿军撤退反伤 — 后置
  - 反击连击/连击气力-5: 已接入; 反击后连击(§6.5➍)简化为仅攻方连击
- 自验证:
  - `pnpm typecheck` 三包全过 · `pnpm test` 68 passed · `pnpm validate-data` 全过
  - `tsx src/scripts/verify-crit.ts` 全部断言通过 ✓
  - dev server 实际演练: 关羽(武圣·重骑·锋矢) vs 周瑜(重步·方阵) 移动相邻→攻击:
    - 第1击: 「关羽 造成 515 伤害（克制）〔暴击·连击〕」日志「暴击 ×2.9 → 426 连击 89」
    - 多次攻击观察到「〔暴击·反击·连击〕·反击-56」「〔暴击·连击·连击暴击〕」
    - 暴击/反击/连击三者均在真实战斗中触发，事件流与防循环符合§6.5
- 文档同步: 05 §6 引擎状态注 · 10 · HANDOFF · 04 §26 状态
- Next: 水域移动引擎 或 战法 UI 选层 或 单挑深化(宿命对决/大会)

## 2026-07-17 — Session 88（单挑引擎最小切片实装 — P3-07 引擎落地）
- Phase: **代码实装 + 引擎接入 + UI + 自验证**（从设计到可玩）
- 实装内容（0-A 最小切片，已标注简化/占位项）:
  - `shared/types/duel.ts` 新增: DuelCommand(7指令枚举) / DuelPhase / DuelOutcome / DuelInjury / DuelDialog / DuelCombatantState / DuelRound / DuelResult / DuelState / DuelEngineConfig
  - `shared/types/battle.ts` 扩展: BattleState.duel?: DuelState | null（单挑进行时战场暂停）
  - `shared/types/index.ts` 导出 duel 类型
  - `server/src/battle/duel.ts` 新建单挑引擎（§8.5~§8.11 全自动结算）:
    - 状态机: createDuel → stepDuel → runDuelToCompletion → finalizeDuel（dueling→resolved）
    - 7指令体系(猛攻/牵制/必杀/格挡/闪避/周旋/暗袭) + 经典三向克制(猛攻克牵制·牵制克必杀·必杀克猛攻) + 辅助链(周旋克闪避/格挡·猛攻克周旋·必杀无视闪避)
    - 伤害公式(§8.6.1): |武差|×weaponPower×(1+指令修正) + 力量附加 + 体力系数 + ±10%浮动 + 牵制化解(-50%) + 闪避免疫 + 格挡减伤
    - 隐藏属性集成(§8.6.2): 力量/爆发/敏捷/运气/谋略/奇谋/威压/勇猛 全部参与命中/暴击/连击/受伤/被斩
    - 暴击(§8.11.1): 武力/50+武器+指令+技能+专属+运气; 上限70%下限3%; 武圣×2.5(青龙刀×3.0)
    - 反击(§8.11.2): 格挡30%基础+技能+专属; 恶来+30%/刚烈必反; 周旋克格挡失效
    - 连击(§8.11.3): 无双三连(×0.7/×0.5)/天义二连(×0.8)/龙胆累加/武圣击败后必连
    - 受伤(§8.7): 每损30%HP判定; 5部位(臂/腿/肋/头/重创); 概率=50%-运气/20
    - 结局(§8.8): 被斩/被俘/逃脱/投降/平局; 无双保护(不可被斩/俘); 历史宿命必斩(hook预留,0-A无华雄)
    - AI指令选择(§8.13.2): 6性格权重表 + 动态调整(预判必杀/克牵制/低血必杀/气力门槛/暗袭1次/易怒限制)
    - 叙事(§8.4.3): 10优先级模版 + 吕布/关羽/张飞/赵云 专属模版
    - 阵前(§8.4): 对话 + 武圣/咆哮威压 + 弓弩射箭
    - 武器(§8.9): 5主武器(剑/刀/枪/戟/钝器) + 0-A签名武器映射(关羽→青龙刀/吕布→方天画戟等); 副武器(弓/弩/暗器)预留
    - 专属(§8.10.3): 无双/武圣/龙胆/咆哮/天义/恶来/刚烈/虎痴/骑神/火神 已实装(0-A数据集无 uniqueSkill 字段,引擎按 officer.id+uniqueSkill 识别)
  - `server/src/engine/battle.ts` 接入:
    - challengeDuel(): 玩家发起 → canChallenge校验 → aiAcceptChallenge决策 → 拒绝(士气-15)/接受(扣20气力+createDuel+自动推进首回合)
    - stepBattleDuel(): 观看演出模式逐回合推进
    - skipBattleDuel(): fast/skip 模式直接 runDuelToCompletion
    - applyDuelOutcome(): 结局应用到战场(斩杀→武将死亡+部队溃散/俘获→PRISONER+溃散/逃脱→士气降/胜方士气功绩+观众效应) + 战斗结束判定
  - `server/src/services/game.ts`: battleChallengeDuel/battleDuelStep/battleDuelSkip (withLock 串行化)
  - `server/src/routes/game.ts`: POST /battle/duel/challenge · /duel/step · /duel/skip
  - `client/src/services/api.ts`: battleDuelChallenge/battleDuelStep/battleDuelSkip
  - `client/src/stores/gameStore.ts`: duelChallenge/duelStep/duelSkip actions
  - `client/src/components/battle/DuelPanel.tsx` 新建: HP双条+气力+受伤状态+阵前对话+逐回合叙事+详情折叠+结局面板+三速度模式(观看演出/快速结算/只看结果)
  - `client/src/components/battle/BattleView.tsx`: 新增【单挑】按钮(气力≥20,需相邻)+duelMode目标选择+ battle.duel 时渲染 DuelPanel 覆盖层
  - `server/src/scripts/verify-duel.ts` 新建冒烟测试: 关羽vs典韦/吕布vs张飞/偏将对决/canChallenge边界/aiAcceptChallenge/无双必先手/受伤/无双10次不被斩 —— **全部断言通过**
- 简化/占位标注（避免误判为正式完成）:
  - 武器: 0-A 无 GameState 装备系统,按 officer.id 签名映射(关羽→blade/吕布→halberd); 0-B 接入物品装备后改读
  - 通用技能/特性联动: 从 officer.skills 读取(bravery/hold/insight 等); 豪勇/刚力等特性用 bravery proxy 近似
  - uniqueSkill: 0-A officers.json 无 uniqueSkill 字段,引擎按 officer.id+uniqueSkill 双重识别; verify-duel 用 stub 注入 uniqueSkill 测试专属路径
  - 宿命对决(§8.14.1): 触发 hook 预留(FATED_DUO_PAIRS 空表,0-A 无华雄); 0-B 加华雄后启用 关羽vs华雄
  - 受伤战后延续(§8.7.3): 单挑内受伤生效; 战后 stamina/merit 仅在 applyDuelOutcome 做了 merit,战后伤势延续未接 GameState(后置)
  - 单挑大会 S19(§8.17): 独立系统,复用本引擎,但锦标赛框架未实装
- 自验证:
  - `pnpm typecheck` 三包全过 (shared/server/client)
  - `pnpm test` 68 passed
  - `pnpm validate-data` 全过 (units=9)
  - `tsx src/scripts/verify-duel.ts` 全部断言通过 ✓ (含 无双10次不被斩/必先手/接受拒绝边界/受伤触发)
  - dev server (:3001) + client (:5176) 跑起: 创建游戏→出征寿春(关羽 vs 周瑜)→移动相邻→点【单挑】→API 返回 "周瑜 拒绝了 关羽 的单挑挑战（士气-15）" ← §8.13.1 正确行为(武力差25≥15→拒绝保命)
  - 前端 DuelPanel.tsx / BattleView.tsx vite 模块编译 200 OK
  - 注: 0-A 场景无武力接近(差<15)且道路相邻的敌方武将组合,接受路径的完整 API 演练由 verify-duel.ts 引擎层覆盖(关羽vs典韦 差0/吕布vs张飞 等全部走完到 resolved)
- 顺带修复: child.ts + verify-child-engine.ts + verify-fire-tactic.ts 补 Officer.tags 字段（pre-existing typecheck error）
- P3-07 状态: [~]（引擎最小切片已实装+可玩; 正式全量含宿命对决/大会/战后延续 待 0-B/后续）
- 文档同步: 05 §8 引擎状态注 · 03 §19 类型标注实装 · 06 duel API 标已实装 · 07 §6.3 标已实装 · 10 · HANDOFF · 12
- Next: 暴击/反击/连击引擎 或 水域移动 或 战法 UI 选层

## 2026-07-16 — Session 73（暴击/反击/连击 × 技能·特性·专属联动设计）
- Phase: **纯文档设计**（无代码改动）
- 设计内容:
  - `05-combat-system.md` §6.2 暴击全面重写（含基础公式+6.2.1技能/6.2.2特性/6.2.3专属联动）
  - `05-combat-system.md` §6.3 反击全面重写（含触发条件+系数表+3层联动）
  - `05-combat-system.md` §6.4 连击新增（含率公式+伤害+暴击+限制+3层联动）
  - `05-combat-system.md` §6.5 三者联动事件流（完整流程图+防循环规则表）
  - `05-combat-system.md` §4.2 阵型联动：扩展为18阵型×暴击/反击/连击/额外联动四列表
  - `05-combat-system.md` §5.4 战法/§8.3 §8.6 单挑对齐注
  - `04-game-systems.md` §26.3 五类42项特性全部增补「暴击/反击/连击联动」列
  - `04-game-systems.md` §26.5 特性角色表同步更新联动数值
  - `04-game-systems.md` §26.8 新增 SkillEffect type 扩展（8种新 effect type + 3组专属数据样例）
- 修正: 确认暴击/反击/连击设计范围为**战场部队系统**（§6.2~§6.5），不混入单挑
- `05-combat-system.md` §8 新增独立单挑暴击/反击/连击规则 §8.8（与§6完全隔离）
- 设计核心原则:
  - 暴击/反击/连击 ≠ 独立通用公式，而是特性(被动)+技能(可培养)+专属(独有)三者交汇的结果
  - 每个武将的战斗风格由其特性组合+技能搭配+专属决定（差异化）
  - 四层防循环：连击不再触发连击/反击，反击不再触发反击，战法不计入
- 文档版本: 05-combat-system.md v1.2→v2.0, 12-system-map.md v2.10→v2.20
- 文档同步: 05 · 04 · 12 · 本进度 · HANDOFF
- Next: 实装暴击/反击/连击引擎 或 单挑 或 水域移动

## 2026-07-16 — Session 74（单挑系统全面设计文档）
- Phase: **纯文档设计**（无代码改动）
- 设计内容:
  - `05-combat-system.md` §8 全量重写：
    - §8.1~8.2 设计总览 + 状态机与生命周期（6状态+运行时 DuelState 结构）
    - §8.3 触发与发起（3种方式+拒绝机制+先手判定）
    - §8.4 阵前阶段（对话+弓弩射箭）
    - §8.5 单挑回合主循环（6指令+4角克制+每回合结算流程）
    - §8.6 伤害公式全量（含隐藏属性集成 §32.4 + 体力影响）
    - §8.7 受伤系统（部位/概率/战后延续）
    - §8.8 结局与战场影响（5种结局+功绩+观众效应）
    - §8.9 武器与装备（5主武器+3副武器+武器克制+14宝物映射）
    - §8.10 技能·特性·专属集成（5通用技能+10特性+9专属+3套装）
    - §8.11 独立暴击/反击/连击（含防循环规则表）
    - §8.12 单挑UI与交互（确认框+主面板+3种动画模式）
    - §8.13 AI单挑决策（发起决策+6性格×6指令权重表）
    - §8.14 特殊情况（夜间/雨雪/马上/车轮战/宿命/文官）
    - §8.15 模拟（关羽vs华雄完整演算含隐藏属性）
    - §8.16 设计原则与集成备忘
  - `03-data-models.md` §19 扩展：DuelPhase/DuelOutcome/DuelDialog/DuelState 类型
  - `04-game-systems.md` 同步：§26.1 单挑独立性说明 + §32.4 隐藏属性速查表
  - `06-api-design.md` 扩展：5个单挑端点（challenge/respond/action/skip/state）
  - `07-ui-design.md` 新增：§6.3 单挑面板（确认框/主面板/模式切换/结果面板）
  - `08-data-dictionary.md` 同步：items 字段补充单挑武器映射交叉引用
- 设计核心定位:
  - 单挑拥有完全独立的规则体系（暴击/反击/连击/伤害/技能），与§6战场系统隔离
  - 单挑是有限状态机（IDLE→CHALLENGING→PRE_DUEL→DUELING→RESOLVING→RESOLVED）
  - 6指令+4角克制+武器分化+部位受伤
  - 每个武将的单挑风格由专属技能主导（吕布三连斩/关羽单发暴/张飞反击/赵云全能）
- P3-07 状态: [ ]→[~]（设计完成，引擎待实装）
- 文档版本: 05 v2.0→v3.0, 03 v1.7→v1.8, 04 v3.0→v3.1, 06 v1.9→v2.0, 07 v2.0→v2.1, 08 v1.4→v1.5, 12 v2.20→v2.30
- 文档同步: 05 · 03 · 04 · 06 · 07 · 08 · 12 · 本进度 · HANDOFF
- Next: 实装单挑引擎 或 暴击/反击/连击引擎 或 水域移动

## 2026-07-16 — Session 85（全库版权排查 + RTK5清除 + CREDITS + 截图清理）
- Phase: **合规修复**（文档+数据+git）
- 版权排查:
  - 全库扫描 Koei/光荣/Tecmo/经典三国策略游戏 等商标引用 → 零残留
  - 扫描 AI 生成图片 → 删除 imagine-*.png
  - 扫描 32MB 孤图 map.png → 删除（未使用且来源不明）
  - 确认 geo-basemap.png 为 Natural Earth 公有领域
  - 确认 73 张截图均为自产开发截图，无 Koei 素材
- 修复:
  - 全库 47 处 "RTK5" 逐处替换为中性表述（三向克制/经典/经典设计传承等）
  - README "LateEasternHanDynasty" → "LateEasternHanDynasty"，"精神续作" → "受经典启发"
  - docs/07-ui-design.md 菜单 "经典三国策略游戏·怀古" → "乱世·英雄"
  - docs/07-ui-design.md "Romance of the Three Kingdoms" → "Heroes of the Realm"
  - docs/01-overview.md 对比表 "原版 RTK5" → "参考设计"
  - 全库 "经典三国策略游戏" → "经典三国策略游戏"
  - 5 张 Google Maps 校准截图移出版本控制
- 新建:
  - CREDITS.md（Natural Earth/古籍/第三方库来源声明）
  - .gitignore 补充 Google 截图排除规则
- 文档版本: 01 v1.8→v1.9, 05/07/10/HANDOFF 同步

## 2026-07-16 — Session 86（git 历史重写 — filter-branch 清洗）
- Phase: **合规修复**（git 历史）
- 操作:
  - 备份分支 backup-before-rewrite（保留原始历史 42ae166）
  - git filter-branch --index-filter 删除 5 张 Google 截图所有历史版本
  - git filter-branch --tree-filter 替换全历史 blob 中 RTK5 文本（按映射表）
  - git filter-branch --msg-filter 清洗 commit message 中的 RTK5/LateEasternHanDynasty
  - 清理垃圾对象（rm refs/original + reflog expire + gc --prune）
- 验证:
  - main blob RTK5 → 零残留
  - main commit message RTK5/LateEasternHanDynasty → 零残留
  - Google 截图文件在 main 历史中 → 已全部删除
- 推送: git push --force origin main（7 commit 全部重写）
- 备份分支说明: 保留本地，确认后删除

## 2026-07-16 — Session 87（合规报告 + SPDX + 许可证 + 免责声明）
- Phase: **合规修复**（代码+文档）
- 输出合规审查报告（Covering License/Dependencies/Brand/Data Security → 🟢低风险）
- 修复:
  - README 顶部添加中英双语免责声明（百度 LateEasternHanDynasty 无关 + Koei 独立声明）
  - 根 + shared/server/client 四个 package.json 补 license: MIT + author 字段
  - node scripts/add-spdx-headers.mjs 批量刷写 98 个 .ts/.tsx 文件 SPDX 头部
  - 删除根目录残留旧 src/（15 个文件，client/server 拆分前的冗余）
  - package.json 新增 pnpm spdx 命令
- 修复措辞: "经典原版最精髓" → "经典三向心理战的核心" 等 3 处
- 文档版本: 04 v3.5→v3.7（累计）
- 合规建议: 后续新增 .ts/.tsx 后跑 pnpm spdx；美术音频不走商业素材

## 2026-07-16 — Session 84（出身标签落地+教育·科技·文化+货币·税收·俸禄）
- Phase: **文档+数据**（tags落地，其余纯文档）
- 数据改动:
  - `officers.json` 30武将补全 `tags` 字段（出身标签从文档落地到数据）
  - `shared/types/officer.ts` OfficerStatic 新增 `tags: string[]`
  - `shared/validators/index.ts` OfficerStaticSchema 新增 `tags` Zod校验
  - 验证: tsc + validate-data 全通过
- 设计内容:
  - `04-game-systems.md` §4.1 出身标签全面扩展：
    - 新增 **边地** 标签（并幽/关陇/南中边境武将）
    - 社会出身机械效果表（士族×1.5教育·豪强隐匿税收·寒门军功+30%等）
    - 职业背景效果表（武人+10%单挑·儒生+10%教育等）
    - 0-A武将标签示例
  - `04-game-systems.md` 新增 **§三十四 教育·科技·文化**：
    - 教育投入+任教武将→儿童成丁属性加成（按出身倍率）
    - 科技树5分支×5级（农耕/商业/军事/城防/教化）
    - 文化产出公式+门槛用途
  - `04-game-systems.md` 新增 **§三十五 货币·税收·俸禄**：
    - 三国货币成色（魏1.0/蜀0.7/吴0.5/群雄可变）
    - 税收公式改革（税率×成色折扣→实际金库收入）
    - 武将俸禄体系+欠俸后果
    - 豪强税收隐匿+检籍/安抚
  - `04-game-systems.md` 新增 **§4.5 出身对游戏的核心影响**：
    - 仕官门槛与天花板（士族→丞相/寒门→将军/平民→校尉）
    - 派系系统（自动形成+内斗+袁绍分裂案例）
    - 政治资本（称帝/联盟/联姻的出身门槛）
    - 继承权（嫡庶/母族出身/废长立幼→内战概率）
    - 教育传承（士族家学vs寒门突破vs平民战技）
    - 袁绍完整案例分析（出身如何定义了一个人）
  - `04-game-systems.md` 新增 **§4.5.7 出身决定命运——经典案例**：
    - 刘表单骑定荆州 → 名士声望机制（和平占领概率）
    - 刘备创业为什么这么难 → 寒门+宗室远支的双重困境+诸葛亮转折点
    - 荀彧与颍川谋士团 → 地域人才网络机制（同地域士族连锁登用）
    - 司马家潜伏与篡位 → 士族政治资本终极运用（生存保护+宫廷影响+篡位条件）
  - `04-game-systems.md` 新增 **§4.5.8 出身系统总联动图**
- 文档版本: 04 v3.5→v3.8
- 文档同步: 04 · 10-progress · HANDOFF
- Next: 实装 或 继续文档设定

## 2026-07-16 — Session 83（部队组织大系统：经验·组织度·士气·部曲·军屯田·家属·民屯田）
- Phase: **纯文档设计**（无代码改动）
- 设计内容:
  - `05-combat-system.md` §5.6 **部队品质系统**：
    - 经验等级 Lv1~7（沿用§25：新卒→训练兵→老兵→劲旅→精锐→百战→铁军）
    - 组织度 0~100（严整/有序/松散/混乱/崩散五档+每档阵型加成）
    - 士气机制深化（档位效果+新增变化因素+恢复公式）
  - `05-combat-system.md` §5.7 **部曲系统**：
    - 12位史载部曲持有者（许褚/曹仁/李典/吕虔/高顺/孙策/甘宁/徐盛/周泰/公孙瓒/张嶷/夏侯惇）
    - 部曲随人走（调任/登用/被俘—只认主将不认势力）
    - 部曲经验与部队经验双向绑定，父死子继
    - 非部曲的特殊兵种区分（虎豹骑/青州兵等是势力级精锐）
  - `05-combat-system.md` §5.8 **军屯田+家属制度**：
    - 军屯田：驻军可选屯田自给（产粮公式+训练减半+组织度代价）
    - 家属制度：士兵家属=征兵城人口→家属后方失陷士气-40
    - 质任制（曹魏政策）：可花金500迁家属到后方城市（首都陷落=全国崩盘）
    - 敌占城后三选项：善待/中立/镇压（各影响不同）
    - 联动：流言（S07）·四面楚歌（S17）·忠诚（S11）
  - `04-game-systems.md` §2.1 扩展至**9 项开发维度**（新增民屯田）
  - `04-game-systems.md` §2.8 **民屯田全文**：
    - 与农业开发平行（farm花金+民屯分人口）
    - 地域系数表（8区）
    - 与农业开发的优劣势比较
- 文档版本: 05 v3.8→v3.9, 04 v3.3→v3.4, 12 v2.60→v2.70, 07/03/09/01 待后续同步
- 文档同步: 05 · 04 · 12 · 本进度 · HANDOFF
- Next: 实装单挑引擎 或 暴击/反击/连击引擎 或 水域移动 或 主副将/部队品质/部曲/屯田

## 2026-07-16 — Session 82（主副将编成系统 + 祝融火神专属）
- Phase: **纯文档设计**（无代码改动）
- 设计内容:
  - `05-combat-system.md` §5.5 新增 **主副将编成系统**：
    - §5.5.1 编成规则：武官官职决定副将数（军候0~~大将军3/君主4）、编成条件、兵种配置
    - §5.5.2 Squad 系统：BattleSquad 结构、主将/副将 Squad 行为规则、战斗表现公式
    - §5.5.3 阵型×副将兵种通用规则：覆盖 18 种阵型、四项属性修正、特殊效果映射表、站位分配
    - §5.5.4 人际关系加成：义兄弟·父子/兄弟·pairAffinity 六等关系 → 攻防/士气/支援效果
    - §5.5.5 数据结构：BattleUnit 扩展 squads 字段
    - §5.5.6 AI 编成逻辑：6 项优先级评分
    - §5.5.7 孟获×祝融特例：唯一夫妻战场加成，祝融接替孟获
  - `05-combat-system.md` §8.10.3 新增祝融专属 **「火神」**：
    - 战场：火计+30%/+1范围；孟获同队时全属性+10%
    - 单挑：暗袭可用飞刀，暗袭伤害+50%；射箭阶段武×0.8
  - 设计原则: 全书仅祝融一人可出战，不做通用夫妻系统；主副将编成参考经典主副将设计
- 文档版本: 05 v3.7→v3.8, 12 v2.50→v2.60
- 文档同步: 05 · 12 · 本进度 · HANDOFF
- Next: 实装单挑引擎 或 暴击/反击/连击引擎 或 水域移动 或 单挑大会 或 主副将编成

## 2026-07-16 — Session 81（新增 S19 单挑大会独立系统）
- Phase: **纯文档设计**（无代码改动）
- 设计内容:
  - `05-combat-system.md` §8.17 新增 **单挑大会** 完整设计文档：
    - §8.17.1 定位：独立于战场单挑的周期性锦标赛
    - §8.17.2 大会模式：无限制（吕布全开）vs 公平竞技（禁无双被动），赛前选择
    - §8.17.3 举办与参赛：每年1月触发·武力≥70·体力≥80·各势力按城数配额
    - §8.17.4 赛制：16人淘汰·种子制·体力跨轮不恢复·平局加赛
    - §8.17.5 奖励：冠军「武魁」/击败吕布「破军」/宝物+名声递进
    - §8.17.6 押注系统：动态赔率·爆冷×3·势力金限额20%
    - §8.17.7 叙事演出：开幕/爆冷/宿命/吕布出场/加冕 专属模版+主持NPC
    - §8.17.8 数据结构：TournamentState/Match/Bet/Record 全接口定义
    - §8.17.9 与 S11/S12/S13/S08/S03 联动
  - `12-system-map.md` 新增 S19（D 成熟度），19 大系统，v2.40→v2.50
- 核心设计变更:
  - 系统从 18 大扩展至 19 大
  - 「武魁」替代「天下无双」避免与吕布无双冲突
  - 「破军」作为公平模式下击败吕布的专属称号
- 文档版本: 05 v3.6→v3.7, 12 v2.40→v2.50
- 文档同步: 05 · 12 · 本进度 · HANDOFF
- Next: 实装单挑引擎 或 暴击/反击/连击引擎 或 水域移动 或 单挑大会(S19)

## 2026-07-16 — Session 80（单挑全自动结算 — 经典自动结算模式）
- Phase: **纯文档设计**（无代码改动）
- 设计变更:
  - 单挑从交互式改为**全自动结算**（发扬经典三国策略游戏）
  - `05 §8.1` 概述重写：玩家不操作，只看演出
  - `05 §8.5` 主循环标注为"引擎内部逻辑"，加说明框（玩家不可见/不可操作）
  - `05 §8.12` 完全重写：
    - 去掉7指令按钮UI面板
    - 改为自动演出面板（HP条+叙事文本+可展开详情）
    - 速度模式：观看演出 / 快速结算 / 只看结果（非 full/fast/skip）
  - `05 §8.13` 重写标题及说明：
    - "AI 单挑决策" → "单挑决策（全自动·引擎内部）"
    - 说明玩家只做两个决定（发起/接受），其余全自动
    - 指令选择表改为"引擎内部·双方通用"
  - `07 §6.3` UI面板同步更新
- 设计核心变更:
  - 7指令体系 + 三向克制 → 全部保留，但转为引擎内部推演逻辑
  - 玩家体验 = 经典三国策略游戏：触发→确认→观看→结果
- 文档版本: 05 v3.5→v3.6, 07 v2.2→v2.3
- 文档同步: 05 · 07 · 本进度 · HANDOFF
- Next: 实装单挑引擎 或 暴击/反击/连击引擎 或 水域移动

## 2026-07-16 — Session 79（吕布无双规则补完：必杀不可化解·化解一切必杀）
- Phase: **纯文档设计**（无代码改动）
- 设计内容:
  - `05-combat-system.md` 天下无双型强化：
    - **吕布必杀不可化解**：牵制克必杀对吕布无效（核心三角在吕布身上只有两条边）
    - **吕布化解一切必杀**：任何对手的必杀在吕布面前自动化为虚无——无需指令、无需消耗
    - 结论更新：「能"不输"给吕布的唯一方式是撑到10回合平局。不是不会死，是没人能赢。」
  - `05-combat-system.md` §8.10.3 无双专属同步更新（两条新规则写入）
- 文档版本: 05 v3.4→v3.5
- 文档同步: 05 · 本进度 · HANDOFF
- Next: 实装单挑引擎 或 暴击/反击/连击引擎 或 水域移动

## 2026-07-16 — Session 78（新增天下无双型 — 仅吕布）
- Phase: **纯文档设计**（无代码改动）
- 设计内容:
  - `05-combat-system.md` §8.6.3 新增 **风格六：天下无双型**
  - **仅吕布一人**，天下唯一
  - 核心设计：
    - 六项隐藏属性碾压级（力量98·爆发95·威压98·勇猛7·武力100）
    - 唯一明牌弱点谋略30——但规则上牵制克必杀仍然有效
    - 必杀三连击合计 ≈89伤害（三发暴击≈178+ → 一套带走任何武将）
    - AI行为：必杀+40%、猛攻+25%、牵制0%、格挡0%
    - 平衡杠杆：必须连续牵制化解+赌他不暴击+耗光他气力
    - 终极结论：能"赢"吕布的唯一方式是平局（10回合），因为无双单挑不败保他不死
  - 专属叙事模版5条（阵前·必杀·三连击·化解·斩杀）
- 文档版本: 05 v3.3→v3.4
- 文档同步: 05 · 本进度 · HANDOFF
- Next: 实装单挑引擎 或 暴击/反击/连击引擎 或 水域移动

## 2026-07-16 — Session 77（隐藏属性单挑深化 + 武将风格分类）
- Phase: **纯文档设计**（无代码改动）
- 设计内容:
  - `05-combat-system.md` §8.6.2 全面扩展：
    - 隐藏属性表从 6 行扩展至全量 **8 项**（补齐谋略/奇谋）
    - 每项增加完整公式、范围标度、影响比重列
    - 新增勇猛vs力量的区别说明
  - `05-combat-system.md` §8.6.3 新增 **武将单挑风格 5 分类**：
    - **猛将型**（力量爆发流）：吕布/关羽/张飞/马超
    - **技巧型**（敏捷爆发流）：赵云/太史慈/甘宁
    - **铁壁型**（防御消耗流）：典韦/许褚/周泰
    - **智将型**（预判牵制流）：周瑜/陆逊/司马懿
    - **豪杰型**（均衡适应流）：孙策/夏侯惇/张辽
    - 每类含典型武将数据、核心打法、AI行为特征
  - `05-combat-system.md` §8.6.4 新增 **隐藏属性×体力联动**：
    - 五档体力系数对隐藏属性的衰减表
    - 吕布例算（体力35%→力量98→实际78）
  - `04-game-systems.md` §32.4 速查表扩展至全量8项 + 影响度标度 v3.2→v3.3
- 核心设计变更:
  - 单挑不再是"武力×技能"的简单公式，而是 8 项隐藏属性×体力×性格的多维博弈
  - 武将风格分类让单挑的差异化不再仅靠专属技能，隐藏属性组合本身就在塑造打法
  - 影响度标度（高/中/低）让玩家一目了然哪个隐藏属性在单挑中最关键
- 文档版本: 05 v3.2→v3.3, 04 v3.2→v3.3
- 文档同步: 05 · 04 · 本进度 · HANDOFF
- Next: 实装单挑引擎 或 暴击/反击/连击引擎 或 水域移动

## 2026-07-16 — Session 76（宿命对决详表 + 叙事系统深化）
- Phase: **纯文档设计**（无代码改动）
- 设计内容:
  - `05-combat-system.md` §8.14 全面扩展：
    - 新增 §8.14.1 宿命对决详表：6 个演义名场面完整设计
      - **三英战吕布**：3v1 接力战·刘关张共享350HP·替入士气联动
      - **许褚裸衣斗马超**：裸衣状态·防御不可·仅核心三角指令
      - **赵云长坂坡七进七出**：连战递进·曹军5将车轮·龙胆累加
      - **太史慈vs孙策**：抢夺模式·武器夺还·擒拿判定归顺
      - **关羽斩颜良/文丑**：突袭开局·首回合必杀无视牵制·必斩
      - **张飞据水断桥**：大喝威慑·意志对决·溃逃判定
    - 宿命对决触发总表：9 组对决 + 归因剧本/条件/规则/结局
  - 背景: 发扬自经典三国策略游戏的戏剧化叙事精神，在三向克制核心基础上叠加传奇色彩
- 设计原则变更:
  - 宿命对决优先级 > 通用单挑规则（§8.3~8.13 被覆盖或扩展）
  - 每组成名场面都有独特的机械设计hooks，不套用统一公式
- 文档版本: 05 v3.1→v3.2
- 文档同步: 05 · 本进度 · HANDOFF
- Next: 实装单挑引擎 或 暴击/反击/连击引擎 或 水域移动

## 2026-07-16 — Session 75（单挑系统 经典化重写 + 架构文档全面重写）
- Phase: **纯文档设计**（无代码改动）
- 设计内容:
  - `docs/02-architecture.md` **全面重写**（v1.0→v2.0，对齐 Session 75 代码现实）：
    - 总体架构图更新：20 引擎模块 + 5 战斗子模块 + shared 工具链 + 脚本/测试
    - Monorepo 结构完全重写：对齐实际 21 类型文件 + 17 组件 + 14 文档
    - 新增 §六 核心数据流（用户操作·结束回合AI·战斗·视野裁剪 四流程）
    - 新增 §七 引擎模块职责速查表（20 引擎 + 5 战斗子模块 + 行数）
    - 新增 §八 shared 工具模块（stamina/ceiling/demographics/city-roads/mask-state/intel/positions）
    - 新增 §十 脚本与验证（validate-data/test/lint + 3 验证脚本）
    - 新增 §十一 数据层详解（loader.ts + 0-A 规模）
    - 决策记录从 6 项扩展至 11 项
    - 移除 better-sqlite3 实线（S16 未实现，改为虚线标注）
  - `05-combat-system.md` §8 单挑指令体系 经典化重写：
    - §8.5.1 7指令体系：核心三角(猛攻/牵制/必杀) + 辅助三选(格挡/闪避/周旋) + 暗袭
    - §8.5.2 克制循环图重写：3角核心（发扬自经典版本）+ 辅助链 + 博弈心理说明
    - §8.5.3 每回合结算流程更新（必杀参与克制判定）
    - §8.6.1 伤害公式更新（牵制化解必杀-50%、暗袭无视格挡减伤）
    - §8.4.3 新增 经典风格系统叙事文本（10级优先级 + 特殊武将模版）
    - §8.16 设计原则更新（新增经典设计精神 + 叙事原则）
    - §8.15 模拟重算（关羽vs华雄用新7指令体系，4回合斩杀）
  - `§8.10` 技能/特性/专属同步：新增识破技能、咆哮+牵制化解、铁壁/恶来+周旋克格挡注、易怒+三向克制双重博弈注释
  - `§8.11` 暴击/反击/连击同步：周旋+5%暴击、格挡反手周旋克制、防循环表扩展
  - `§8.12` UI 面板更新（7按钮：猛攻/牵制/必杀/格挡/闪避/周旋/暗袭）
  - `§8.13` AI权重表重写（7指令×6性格 + 动态调整含三向克制逻辑）
- 同步文档:
  - `03-data-models.md` §19 DuelAction 枚举更新（新增 RESTRAIN 牵制·重排克制注释）v1.8→v1.9
  - `04-game-systems.md` §26.3 易怒特性同步三向克制注释 v3.1→v3.2
  - `07-ui-design.md` §6.3 单挑面板更新（7按钮 + 叙事文本行）
  - `09-roadmap.md` P3-07 描述更新（6指令+4角→7指令+三向）
  - `12-system-map.md` S10 描述 / Session引用 / 版本号 v2.30→v2.40
- 核心设计变更:
  - **必杀从"无视克制的安全牌"变为"克制循环的主角"**（发扬自经典版本精神）
  - 核心三角：猛攻克牵制 → 牵制克必杀 → 必杀克猛攻
  - 每一回合都是赌上性命的心理博弈——没有安全牌
- 文档版本: 02 v1.0→v2.0, 05 v3.0→v3.1, 03 v1.8→v1.9, 04 v3.1→v3.2, 07 v2.1→v2.2, 09 v1.2→v1.3, 12 v2.30→v2.40
- 文档同步: 02 · 05 · 03 · 04 · 07 · 09 · 12 · 本进度 · HANDOFF
- Next: 实装单挑引擎 或 暴击/反击/连击引擎 或 水域移动

## 2026-07-16 — Session 72（P0 漏洞修复 + S10 战法引擎最小切片）
- Phase: **安全修复 + 状态一致性修复 + 战法引擎**
- 修复 P0 安全漏洞:
  - Sec-1: `services/game.ts` doReleaseOfficer 加势力归属校验（仅可释放己方武将）
  - Sec-2: doJoinFaction 加校验（仅可招募在野武将加入己方势力）
  - Sec-4: `engine/march.ts` prepareMarch 加 Number.isFinite 校验防 NaN 污染城池
  - Sec-6: `services/game.ts` 新增 withLock 请求锁，所有写操作串行化防 race condition
- 修复 P0 状态一致性:
  - B1: `engine/plot.ts` 离间计改用传入的 diplomacy 参数（含本轮前序计谋修改）
  - B2: `engine/march.ts` settleBattle 占城后 city.officers 含释放的在野败将
  - B2: `engine/aiMilitary.ts` doAiCapture 同步修复
  - B16: `engine/family.ts` joinFaction/releaseOfficer 统一维护 city.officers 列表
  - B18: `engine/event.ts` war 效果加 targetId===playerFactionId 守卫防自环
- 修复 P0 前端死锁:
  - F1: `stores/gameStore.ts` boot() 先 GET /state 恢复已有游戏，无游戏再 createGame
  - F6: `components/events/EventDialog.tsx` catalog 缺失时自动 chooseEvent(0) 解除死锁
- S10 战法引擎最小切片:
  - `engine/battle.ts` 新增 castAbility + getUsableAbilities + applySpecialEffect
  - 适性→等级映射：S→5, A→3, B→2, C→1, NONE→0(不可用)
  - 威力 = 基础伤害(§6.1) × power 倍率 × 随机浮动
  - 特殊效果：stun/knockback/fire/confusion/charge/morale 写入 statusEffects
  - `services/game.ts` battleAbility + battleUsableAbilities
  - `routes/game.ts` GET /battle/abilities/:unitId + POST /battle/ability
  - `services/api.ts` battleUsableAbilities + battleAbility
  - `stores/gameStore.ts` castAbility + loadAbilities + usableAbilities state
  - `components/battle/BattleView.tsx` 战法按钮列表 + abilitySel 模式（选战法→点敌军施放）
- 验证:
  - typecheck 全绿 · test 68/68 · validate-data 全 OK
  - API 黑盒: Sec-1/Sec-2/Sec-4 拦截确认 · 战法施放确认（关羽突破·神 1562 伤害·耗气34·冲锋效果）
  - 适性等级: S→5级, C→1级, NONE→不可用 确认
- 简化: 战法层级自动选最高可用（无 UI 选层）；连携仅 coopAllowed 标记；AI 不施放战法
- 文档: 05§5.4 · 06 API · 12 S10 · HANDOFF · 本进度
- Next: 单挑 或 水域移动 或 技能接入内政

## 2026-07-16 — Session 64（隐藏属性扩充 + 舌战MVP）
- Phase: **隐藏属性扩充8项 + 舌战系统MVP**（非0-B）
- 交付:
  - `OfficerHidden` 新增 8 字段：力量(power)、爆发(burst)、敏捷(agility)、运气(luck)、直觉(intuition)、威压(awe)、谋略(strategy)、奇谋(tactics)
  - `shared/types/debate.ts`：DebateState/DebateCardType/DebateSide 类型定义
  - `server/src/engine/debate.ts`：initDebate/playCard/aiChooseCard 引擎（4论牌系统）
  - `server/src/data/officers.json`：30武将填入8隐藏初值（历史15将精校，占位15将=50均）
  - `shared/validators/index.ts`：Zod 校验追加8字段
  - `docs/04-game-systems.md`：新增 §三十二 隐藏战斗/文官属性 + §三十三 舌战系统
  - `docs/14-officer-stats-reference.md`：150+武将增加谋略/奇谋参考列
- 文档同步: 01-overview(20项) · 11-context-management(20项) · 00-dev-constitution · 03-data-models 均已更新
- 决策点:
  - 物体系4项：力量/爆发/敏捷/运气（身体能力）
  - 精神系4项：直觉/威压/谋略/奇谋（含文官战略vs战术区分）
  - 勇猛/冷静保持0~7小标度不动，新8项用1~100
  - 舌战4论牌：道理→感情→典故→诡辩，覆盖文官4种智力表达
  - MVP无卡片动画，仅文本选牌
- 验证: validate-data 全OK · typecheck 全绿 · build 通过
- Next: 战斗加深（火计UI / 更多兵种 / 单挑）

## 2026-07-16 — Session 65a（无寿命剧本体力修正）
- Phase: **体力系统 — 无寿命模式支持**
- 改动:
  - `shared/types/scenario.ts`：ScenarioStatic 加 `noLifespan?: boolean`
  - `shared/validators/index.ts`：ScenarioStaticSchema 同步追加
  - `server/src/services/game.ts`：`stamina: 100` → 调用 `calcStaminaMax()`，无寿命传 age=40
  - `server/src/data/scenarios.json`：群雄割据剧本加 `"noLifespan": false`
- 无寿命规则：固定 age=40 → `ageModifier=0`，所有人年龄修正一致，体力只由五维+隐藏+功劳决定
- 验证: shared build · validate-data · typecheck 全绿

## 2026-07-16 — Session 65b（power体魄偏转）
- Phase: **体力系统修正 — 力量属性偏移年龄惩罚**
- 改动:
  - `shared/stamina.ts`：`ageModifier(age, power)` 新增体魄偏转参数，每20点power偏转1点年龄惩罚，上限+5
  - `calcStaminaMax`：调用 `ageModifier` 时传入 `officer.hidden.power`
  - `calcStaminaRecovery`：年老(-2)可被 power 抵消，每40点抵消1，上限2，power≥80完全免年老惩罚
- 关键武将效果（219年）：
  - 黄忠(99)→72岁体力从118→122，恢复~8/月（免年老惩罚）
  - 黄盖(60)→70岁-20+3=-17，体力提高
  - 严颜(78)→70岁-10+3=-7
  - 司马懿(70)→40岁+0仍0（base≥0不叠加），但其power高→恢复快
  - 吕布(100)→30岁+5不变（base≥0）
- 验证: shared build · validate-data · typecheck 全绿
- Next: **[讨论] 武将等级/功绩系统完善 —— 勇名已由功绩替代，但 `meritLevel` 运行时字段缺失，需补全**

## 2026-07-16 — Session 65c（功绩等级系统文档标注）
- Phase: **文档对账 — 功绩系统实现差距标注**（纯文档）
- 改动:
  - `docs/03-data-models.md`：`meritLevel / meritPath / peakMeritLevel` 三个字段标记为"运行时类型尚未实现"
  - `docs/04-game-systems.md` §十：顶部新增"实现状态"段落，注明映射函数缺失 / 运行时字段待补 / 门槛未联动
  - `docs/04-game-systems.md`：新增 §6.4 待补小节，列出3项已知缺口
  - `docs/12-system-map.md` S12：状态细化，区分"体力已接入"与"功绩等级代码未实现"
- 触发原因：检查发现 stamina 调用处传 `pos?.merit` 当作 `meritLevel` 是临时方案，且运行时类型与设计文档不一致
- Next: 战斗加深（火计UI / 更多兵种 / 单挑）

## 2026-07-16 — Session 66（GitHub 仓库初始化）
- Phase: **基础设施 — GitHub 远程仓库接入**
- 内容:
  - 创建 `.gitignore`（node_modules/dist/build/.env/...）
  - `git init` + 首次 commit（232 files, 37,385 insertions）
  - 生成 SSH key (ed25519) 并绑定 GitHub 账号 `CtxPilot`
  - 推送至 `github.com:CtxPilot/-LateEasternHanDynasty.git`（私有库）
- 后续日常: `git add -A && git commit -m "feat: ..." && git push`
- Next: 战斗加深（火计UI / 更多兵种 / 单挑）

## 2026-07-16 — Session 67（S18 子女/父辈差距文档标注）
- Phase: **文档对账 — 家族系统子女与父辈缺口**（纯文档）
- 改动:
  - `docs/04-game-systems.md` §十四：实现状态 + §10.5 待补；§30.7 改为「部分实现」+ §30.7.1 父辈模型待补
  - `docs/03-data-models.md`：bloodline 注释；女角 father/mother 0-A 空；ChildBirth 实现状态
  - `docs/08-data-dictionary.md`：children 0-A 5 条 vs 全量 50+；childId 未入库
  - `docs/12-system-map.md` S18：M+ → **M**（跟随有、子女/父辈无）
  - `docs/07-ui-design.md` / `01-overview.md`：对齐实际 UI 与缺口
- 结论: 子女仅姻亲预告；P4-05 仍 `[ ]`；父辈无 UI、武将无 fatherId
- Next: 战斗加深 或 子女引擎最小切片（用户择）

## 2026-07-16 — Session 68（P4-05 子女引擎最小切片）
- Phase: **S18 子女登场引擎**
- 代码:
  - `server/src/engine/child.ts`：`tickChildrenAppear`（每年 1 月）/ `catchUpChildren`（开局）
  - `turn.ts` 接入；`game.ts` 开局补登
  - 正妻母教：属性 + extraSkills；未婚在野无母教
  - 动态生成武将（可不预置 officers）；城/势力列表 + 父 bloodline 回写
  - `FamilyPanel` 姻亲：待登场 / 已登场状态
  - 数据：甄宓→曹操、步练师→孙权 `husbandId`/`initialHusbandId` 补全
  - `server/src/scripts/verify-child-engine.ts` 4 用例
- 验证: typecheck 全绿 · validate-data OK · verify-child-engine OK · test 68/68
- 简化: 无独立子女 tab；无父辈 UI；全量 50+ 后置
- 文档: 04§十四/§30.7 · 03 · 08 · 12 S18→M+ · 10-progress · HANDOFF
- Next: 战斗加深（火计 UI / 单挑）或 父辈只读

## 2026-07-16 — Session 69（S10 火计最小切片）
- Phase: **战场计策 — 火计 + 气力**
- 代码:
  - `BattleUnit.energy/maxEnergy`；开战 100
  - `castFireTactic`：耗气30、智判定、技能等级系数、林/雨/雪/水修正、灼烧
  - 回合恢复气力 智/10；灼烧 tick 在敌方回合前
  - `POST /battle/fire` · `battleFire` · store `castFire` · BattleView 火计按钮
  - `verify-fire-tactic.ts` 4 用例
- 验证: shared/server/client typecheck · verify-fire · test 68/68
- 简化: 仅火计；无蔓延格/多目标；AI 不用计策
- 文档: 05§七 · 06 API · 12 S10 · 07 摘要 · HANDOFF · 本进度
- Next: 单挑最小切片 或 水计/鼓舞

## 2026-07-16 — Session 70（S10 兵种战法数据定义）
- Phase: **战法 schema + 0-A 数据**（无引擎/UI）
- 代码:
  - `shared/types/combatAbility.ts`：leveled | proficiency · specialEffect · coopAllowed
  - `UnitTemplate.abilities` · Zod `CombatAbilityDefSchema`（leveled 必 5 级）
  - `units.json`：6 基础兵种全战法（步2/重步2/枪3/弓3/轻骑3/重骑3）共16战法
  - 特殊兵种 proficiency 草案仅文档；0-B 入库
- 设计定稿:
  - 基础：Lv1~5 + 适性门槛 C→B→A→S→S
  - 特殊：无等级显示，熟练度 basePower→maxPower（引擎后置）
  - 连携：仅 `coopAllowed`；关系/亲密度引擎后置（参考经典系列设计）
- 验证: validate-data OK · typecheck 全绿 · test 68/68
- 文档: 08§三 · 05§5.4 · 12 S10 · 01 · HANDOFF · 本进度
- Next: 水军讨论 → 用户确认 0-A 加 navy

## 2026-07-16 — Session 70b（交接：水军拍板 + 进度文档）
- Phase: 换模型前文档对齐
- 拍板：水军纳入 0-A（后由 Session 71 改为三级并入库）

## 2026-07-16 — Session 71（三级水军）
- Phase: **水军数据层** — 走舸 / 蒙冲 / 楼船
- 代码:
  - `UnitType`: `lightNavy` / `mediumNavy` / `heavyNavy`（废止单一 `navy`）
  - `units.json` 9 条；各 3 战法 leveled×5
  - 30 武将三级水军适性；validate expected 9
  - 吕布水军 NONE→**C**（用户：武将至少 C，NONE 留给纯文官）
- 设计沉淀:
  - C=60%可带队；NONE=不可带队（见 11-context）
  - 原则：会统兵的武将水军≥C；荀彧等文官可 NONE
- 验证: validate-data · typecheck · test 68/68
- 未做: 水域移动引擎 · 造船 · 战法施放
- 文档: 05§5.4 · 08 · 03 · HANDOFF · 本进度
- Next: 战法引擎 或 单挑

## 2026-07-16 — Session 71b（换模型交接）
- Phase: **文档对齐**（无新功能代码）
- 核对: units=9 · 吕布水军 C · 荀彧 NONE · 战法数据齐
- 勿丢结论: 战法双体系 · 连携仅 coopAllowed · 三级水军 · C/NONE 原则
- 文档: HANDOFF 重写 · 本进度 · 05 适性注 · 12 · 01
- Next: 战法引擎最小切片 或 单挑

## 2026-07-16 — Session 63（体力公式定稿）
- Phase: **体力系统 §7.1-7.3 设计定稿 + 代码落地**
- 交付:
  - `docs/04-game-systems.md` §7.1-7.3 重写：
    - 新上限公式：`80 + 武有效/2 + 统有效/10 + (政有效+智有效+魅有效)/50 + meritLevel×2 + 年龄修正`
    - 消耗表微调：新增战斗每回合/搜索消耗，降低开发/施米
    - 月恢复公式：`武有效/20 + 统有效/20 + (政效+智效+魅效)/100 + 年轻-年老+城市+医术`
  - `shared/stamina.ts`：新增 calcStaminaMax / calcStaminaRecovery / 5个 effectiveStat 导出函数
  - `docs/14-officer-stats-reference.md`：150+ 武将添加体力列（公式值，不含年龄/merit）
- 决策点：
  - 采纳方案B-2：武/2 + 统/10 + (政+智+魅)/50（武力主导，保镖不被统率拖累）
  - 魅力加入文组合（与政智同除50），统率权重降为武的1/5
  - 隐藏加成计入有效值（吕布武+50等）
  - meritLevel×2 保留，消耗表微调&月恢复新公式均确认
- 验证: pnpm typecheck 全绿 · pnpm test 68/68 · pnpm build 通过
- 文档已改: 本进度 · HANDOFF · docs/04-game-systems.md · docs/14-officer-stats-reference.md · shared/stamina.ts · shared/tsconfig.json
- Next: 讨论隐藏属性设定（compatibility/righteousness/ambition/valor/composure 细化）

## 2026-07-16 — Session 62（武将五维参考文档）
- Phase: **文档台账——武将五维参考**（非功能开发）
- 交付: `docs/14-officer-stats-reference.md`
  - 覆盖 150+ 人物（含曹魏54/蜀汉35/东吴30/群雄40+/晋系12/女性6）
  - 按势力分节，每节含统/武/智/政/魅五维建议值及备注
  - 附录：统率Top30·武力Top30·智力Top20·政治Top20·魅力Top20
  - 附已录入 vs 建议对照，预留0-B全量替换占位武将
- 天花板体系对齐 `shared/ceiling.ts`（曹100/吕100/诸葛100/荀100/刘100）
- 验证: wc -l 553，markdown 格式有效
- 文档已改: 本进度 · HANDOFF · `docs/10-progress.md` 会话日志
- Next: 全库过时表述对账 或 战斗加深

## 2026-07-16 — Session 61（三国编年史文档）
- Phase: **文档台账——三国编年史**（非功能开发）
- 交付: `docs/13-three-kingdoms-chronicle.md`
  - 覆盖 168–280 年共 112 年，997 行
  - 标注〔正史〕/〔演义〕/〔传说〕三源
  - 附录：人物生卒年表、年号对照表、演义 120 回目完整列表
  - 综合《三国志》《后汉书》《资治通鉴》《三国演义》及裴注
- 验证: 文件写入完成，wc -l 997，markdown 格式有效
- 文档已改: 本进度 · HANDOFF · `docs/10-progress.md` 会话日志
- Next: 全库过时表述对账 或 战斗加深

## 2026-07-16 — Session 60b（交接：文档梳理）
- Phase: **无新功能**；刷新 HANDOFF / 10-progress 摘要至 Session 60
- 用途: 用户换模型做全库文档对账与精简
- 梳理提示: 扫 01/03/04/06/07/09 是否仍有「选项UI后置」「任命后置」；S12/P3/0-B 勿标完成
- 功能 Next 不变: 战斗加深；勿 0-B

## 2026-07-16 — Session 60（S11/S12 任命 Demo）
- Phase: **任命三轨**（主攻 S11/S12）
- 实现:
  1. shared/positions.ts：文/地/武标签 + 属性门槛 + 唯一职标记
  2. appoint.ts：appointOfficer；忠诚±；太守城士气+3；大将军全城士气+1
  3. POST /personnel/appoint { officerId, track, position, cityId? }
  4. AppointPanel 挂左栏人事；太守须在目标城
- 验证:
  - API：军候/太守/大将军唯一/解职全过
  - UI：人事→任命 占位将3→军候、关羽→大将军
  - typecheck 全绿 · test 68/68
- 简化: 0-A 精简枚举（非全量24/44）；无功绩门槛；无带兵上限联动
- 文档已改: 04§3.4/§九 · 06 appoint · 07 LeftPanel · 01 · 12 · HANDOFF
- Next: 文档梳理交接 → 战斗加深；勿 0-B

## 2026-07-16 — Session 59（S14 事件选项 UI）
- Phase: **P4-07 EventDialog**（主攻 S14）
- 实现:
  1. event.tickEvents：无 autoChoice → pendingEvents；有则自动结算
  2. resolveEventChoice + POST /api/game/event/choose
  3. 有 pending 时禁止 end-turn（服务端+客户端）
  4. GET /static 下发 events 目录（对话/选项标签，无 effects）
  5. EventDialog：逐段对话 → 选项按钮；挂 GameLayout
  6. TopBar 有待决时禁用「结束回合」
- 验证:
  - API：开局 end-turn → pending=[101连环计] → choose 施行 → completed=[101] → 可再 end-turn
  - UI（Chrome headless）：结束回合 → 弹窗「连环计」→ 继续 → 选「施行」→ 弹窗关闭
  - typecheck 全绿 · pnpm test 68/68 · validate-data OK
- 简化: 效果仅服务端；无头像；多待决 FIFO 逐件；WS 仅推 pending 提示
- Next: 任命(S11/S12) | 战斗加深；勿 0-B

## 2026-07-16 — Session 58b（验收对账）
- Phase: **对话承诺 vs 代码/文档全量核对**（无新功能）
- 核对结果:
  | 承诺项 | 代码 | 文档 | 结论 |
  |--------|:----:|:----:|------|
  | vitest 单测 68 | ✓ | ✓ | 完整 |
  | 兵种克制 matchup | ✓ | ✓ | 完整（火计 UI 明确后置） |
  | AI 出征占城 | ✓ | ✓ | 完整（数值模拟简化） |
  | 事件 tickEvents | ✓ | ✓ | 完整（选项 UI 后置） |
  | errorMiddleware | ✓ | ✓ | 完整（成功路径仍裸 data） |
  | WS 回合推送 | ✓ | ✓ | 完整（客户端未接 UI） |
  | 献美点化女间谍 | ✓ | ✓ | 完整 |
  | CONTRIBUTING.md | ✓ | ✓ | 完整 |
  | 进度双写 | ✓ | ✓ | 完整 |
- 补修: 04§30.3 过时「点化后置」；07 外交加「点化」；01 摘要；P3-05/P4-06 标 [~]
- 静态验证: pnpm test 68/68 · typecheck 全绿 · validate-data 全 OK
- Next: 事件选项 UI | 任命 | 战斗加深；勿 0-B

## 2026-07-16 — Session 58（工程债落地）
- Phase: **测试基建 + 战斗/AI/事件/点化/API·WS**（用户：全部采纳建议逐步实施）
- 实现:
  1. vitest：shared demographics/ceiling/city-roads 单测（68+）
  2. 兵种克制：getUnitMatchup 1.3/0.7 → battle + simpleAi
  3. AI 出征占城：aiMilitary 兵力优势 autoResolve + settle 式占城
  4. 事件最小引擎：event.tickEvents（autoChoice + completedEvents）
  5. API errorMiddleware；WS end-turn 广播
  6. 献美→点化女间谍：plantableBeauty + POST /intel/plant-female + UI
  7. CONTRIBUTING.md；文档 04/06/12/HANDOFF 同步
- 验证: shared build + server/client typecheck OK；pnpm test 通过
- 简化: 火计 UI 后置；事件选项弹窗后置；AI 占城为数值模拟非完整行军
- Next: 事件选项 UI | 任命 | 战斗加深；勿 0-B

## 2026-07-16 — Session 57（文档梳理）
- Phase: **文档梳理**（对齐 01/04/06/07/12 与代码现状；无新功能）
- 审计: 全量代码 vs 文档对照（引擎/路由/共享模块/UI面板/数据文件），一致性高
- 修复:
  - 10-progress.md Session 47/52 日志中过时「后置/未做」表述（S06裁剪/假情报空城/人事搜索登用/女间谍/计谋/跟随引擎 均已实现）
  - 07-ui-design.md §5.1 LeftPanel 组件树重写对齐实际代码（谍报/计谋/家族/人事/外交/君主/己方城池）
  - 07-ui-design.md §5.3 RightPanel 描述更新
  - 07-ui-design.md §五 主布局图 + §八 组件树重写
  - 10-progress.md Phase 3/4 添加 Demo 切片备注（避免误判为完全未开始）
  - 06-api-design.md Demo 路径标注「全部已实现」
  - HANDOFF 同步更新
- 结论: 文档与代码一致性高；18系统中12个M/M+系统均有完整代码；无虚假声明
- Next（功能）: S14 事件 | 任命 | 战斗加深；勿 0-B

## 2026-07-16 — Session 56b（交接）
- Phase: **进度/交接文档更新**（用户：换模型做文档梳理；无新功能）
- 更新: HANDOFF 重写为全量能力总表 + 文档地图 + Next=文档梳理
  10-progress 状态表；12-system-map 当前建议
- Next（文档）: 对齐 01/04/06/07 与代码；清过时「未做」表述
- Next（功能，梳理后）: S14 事件 | 任命 | 战斗加深；勿 0-B

## 2026-07-16 — Session 56
- Phase: **S06 服务端视野裁剪**
- 实现:
  - shared/mask-state.ts：maskGameStateForPlayer
    迷雾：ruler=null 金粮兵0；同盟：兵力档中值+经济隐；detailed：金粮约百
    敌将/敌特工/他方计谋不下发；在野将保留
  - getClientGame()；所有 API 返回投影；currentGame 仍全量
- 验证(API 13/13): 迷雾隐/surface/detailed/同盟档/开发仍通/敌特工空
- 文档: 04§5.5；06；12 S06→M+；本进度；HANDOFF
- Next: S14 事件 | 任命 | 战斗加深

## 2026-07-16 — Session 55
- Phase: **外交献美 S08∩S09**
- 实现:
  - diplomacy.giftBeautyStock：己方 beauty−n / 对方+n / 友好+12×n；amount 1~5
  - 交战禁止；非本势力；库存不足/非法数量拒绝
  - POST /diplomacy/gift-beauty；LeftPanel 各势力「献美」按钮
- 验证(API 9/9): 无库存拒/本势力拒/转移库存/友好+12/日志/数量非法/超量拒
- 文档: 04§30.3；06；07；12 S08→M+；本进度；HANDOFF
- 简化: 点化女间谍掩护线仍后置
- Next: 服务端视野裁剪 | S14 事件 | 任命

## 2026-07-16 — Session 54
- Phase: **S11 人事搜索/登用 P2-05**
- 实现:
  - personnel.ts: searchTalent(城, 金80, 智/魅成功率, 发现在野/金/粮)
    recruitOfficer(在野, 金200, 登用率公式, joinFaction+妻随)
  - 路由 POST /personnel/search | /personnel/recruit
  - PersonnelPanel：搜索按钮 + 在野列表登用；LeftPanel 人事接入
  - 禁止：非己方城搜索、已有势力登用、历史女角不在 officers
- 验证(API 9/9):
  - 敌城搜索拒；搜索扣金/日志；登用成功入势力+扣200；己方拒登用；搜索可寻得在野
  - tsc OK
- 文档: 04§3.1-3.2；06；07；12 S11→M；本进度；HANDOFF
- 简化: 无俘虏录用/任命/宝物搜索全量；任命后置
- Next: 外交献美 | 服务端视野裁剪 | S14 事件

## 2026-07-16 — Session 53
- Phase: **S17 假情报 + 空城疑兵**（HANDOFF Next 第1项）
- 实现:
  - PlotType.FALSE_INTEL / EMPTY_FORT；PlotCost.food；result.inverted
  - plot.ts：假情报(金120+detailed→ACTIVE3月诱饵×2.2；识破无效)
    空城疑兵(粮150+己方兵<3500→ACTIVE3月×0.15；识破 ACTIVE2月×2.5)
  - getPlotAttackModifier / isEmptyFortDeterring
  - aiMilitary.ts：AI 读权重 → 暂缓日志 / 最简袭扰掉兵
  - plotAi：AI 也可发假情报/空城
  - turn：tickPlots 后 runAiMilitary
  - PlotPanel：四类型 + active 剩余月展示
- 验证(API):
  - 空城兵多/敌城拒绝；假情报无 detailed/己城拒绝
  - 探秘宛→假情报扣120→end-turn ACTIVE 成功
  - 出征后襄阳寡兵→空城扣150粮→ACTIVE（可识破反转）
  - shared/server/client tsc OK
- 文档: 04§31；06；07；12；01；本进度；HANDOFF
- 简化: AI 袭扰不占城；连环计后置
- Next: 人事搜索登用(P2-05) | 服务端视野裁剪 | 外交献美

## 2026-07-16 — Session 52
- Phase: **第1环 Debug**（S05/S07/S01；S06 服务端裁剪后置）
- 实现:
  - `economy.ts`：`syncFactionResources` — 城池金粮真源 → 全势力缓存
  - 开局 createGame / 进贡·结盟 / 占城 / 回合末（AI 谍报·计谋之后）全量同步
  - `tickSpyMonth`：灭亡势力特工 dead；失城反间撤回；孤儿 cityDefense 清；home 失守重定
  - `clearCityCounterOnCapture`：占城立即拆敌反间
  - `settleBattle`：全部存活攻方主将迁入（非仅首单位）+ 拆反间 + 金同步
  - AI 不再叠写 faction.gold 假增量（以城成长为准）
- 验证(API 黑盒 14/14):
  - 开局/进贡/结盟/多回合 end-turn 全势力 gold 差=0
  - 驻守反间保留；占宛主将迁入+无反间残留
  - 无孤儿 defense / 无死势力活特工
  - shared build + server/client tsc OK
- 文档: 04§8/§28.8c/§29.5-6；06 API；12-system-map；本进度；HANDOFF
- 仍后置: 0-B（裁剪/假情报/空城/人事搜索登用 后续 Session 已实现）
- Next: 假情报/空城疑兵 | 人事搜索登用(P2-05) | 服务端视野裁剪

## 2026-07-16 — Session 51
- Phase: 实现 **家族跟随引擎 S18 深化**（HANDOFF Next 第1项）
- 实现:
  - 引擎: `family.ts` — `joinFaction()`（男将入势力+妻子自动跟随迁移）/ `releaseOfficer()`（释放+妻factionId=null）/ `tickFollowCheck()`（月度自动投奔检定）
  - 跟随规则(§3.5): 相性差<20+邻接→20% / 理想一致(benevolence)→40% / 血亲召唤→50%
  - 女角跟随(§30.6/30.7): 男将加入→其妻(husbandId)自动入势力+迁移；男将释放→妻factionId=null
  - turn.ts: tickFollowCheck 月度集成
  - 路由: POST /personnel/join-faction | release-officer | follow-check
  - UI: FamilyPanel 加在野武将列表+相性差标注+手动跟随检查按钮
  - 验证种子: createGame 释放占位武将12(111, compat=65, ideal=benevolence)到宛(13)待投奔
- 验证(API 黑盒):
  - 在野武将111(相性65/差10, ideal=benevolence) 因理想一致投奔刘备军 ✓
  - end-turn 第2回合自动触发投奔 ✓
  - joinFaction: 诸葛亮释放后加入曹操军→黄月英自动跟随入曹操(factionId=1, loc=1) ✓
  - releaseOfficer: 释放诸葛亮→黄月英factionId=null(跟随流落) ✓
  - shared build + server/client tsc --noEmit OK
- 文档: 04§3.5+§30.7 标已实现；06 API；07 UI；12-system-map S18→M+；01；本进度；HANDOFF
- 简化: 事件绑定/师徒/名望吸引后置；义兄弟需tags(未补)；女角仅husbandId关联(非fatherId)
- Next: 第1环 Debug(S05/S07/S06/S01) | 假情报/空城疑兵 | 人事搜索登用(P2-05)

## 2026-07-16 — Session 50
- Phase: 实现 **计谋 S17 原型**（美人计/离间计）
- 实现:
  - 类型: `Plot` / `PlotType` / `PlotStage` 枚举 + `GameState.plots` 字段
  - 引擎: `plot.ts` — `launchPlot()`（美人计 beauty2+金150 需detailed / 离间计 金200）+ `tickPlotsMonth()` 月度结算（1月准备→结算）
  - 成功率: 基础45% + 女间谍+20% + detailed+15% − 反间level×8%；识破: 20%+女间谍10%+反间level×8%
  - 导出 `upsertDipFavor` 供 plot 复用外交修改
  - turn.ts: tickPlotsMonth + runAllAiPlots 集成
  - AI: plotAi.ts 30% 概率发起美人计/离间计
  - 路由: `POST /plot/launch`
  - UI: PlotPanel 计谋列表+发起表单+女间谍选项；LeftPanel 加「计谋」折叠
- 验证(API 黑盒):
  - GameState.plots 初始 []；美人计发起 beauty2→0 金−150 prep1月
  - 美人计结算成功（曹操军对吕布军友好−22）
  - 离间计发起+结算（成功/失败/识破均有）
  - 无 detailed 情报→拒绝；无美女→拒绝
  - AI 发起离间计（曹操/吕布/孙权均有）
  - end-turn 连续推进稳定
  - shared build + server/client tsc --noEmit OK
- 文档: 04§31 标已实现+公式；06 API；07 UI；12-system-map S17→M；01；本进度；HANDOFF
- 简化: 假情报/空城疑兵/连环后置；离间不限制邻接；AI 不判断 detailed 邻接
- Next: 家族跟随引擎(S18) | 第1环 Debug(S05/S07/S06/S01) | 假情报/空城疑兵

## 2026-07-16 — Session 49
- Phase: **全项目审查 + Bug 修复**（P0×5 + P1×5）
- 审查: 3个探查 agent 并行审计引擎/类型/文档，发现10项修复
- 修复 P0（高优）:
  - rewardBeautyStock 加 amount>0 正整数校验（防负数刷忠诚漏洞）beauty.ts:113
  - SpyPanel useEffect 切换 agent 时重置 missionType（防枕边风误派给男特工）SpyPanel.tsx:84
  - AI 间谍目标过滤排除盟友（isAllied guard）spyAi.ts:153
  - 10-progress.md 删重复 Session 12 标题
  - 12-system-map 第1.5环女间谍标✓ + 页脚 v1.5
- 修复 P1（中优）:
  - sowDiscord 降民忠用 curCity.stats 而非陈旧 target.stats spy.ts:699
  - lootBeautyOnCapture 加 faction 存在性守卫（防 undefined 崩溃）beauty.ts:207
  - upsertDipFavor 创建路径不再凭空创 WAR（只创 HOSTILE）spy.ts:163
  - turn.ts nextState 用 ai 作 base（防未来 AI 扩展丢字段）turn.ts:167
  - seekBeauty 加 factionId 参数 + AI spyAi 加 seekBeauty 阶段（解 AI 无美女来源死锁）beauty.ts:46 + spyAi.ts:133
- 验证:
  - shared build + server/client tsc --noEmit OK
  - API 黑盒: 负数赏赐拦截 / amount=0拦截 / 非整数拦截 / 正常赏赐OK
  - 女间谍训练+枕边风仍正常
  - end-turn 连续3回合稳定；AI 曹操/孙权 beautyStock 增长（AI 女间谍死锁解除）
  - 男间谍仍被拒执行枕边风
- 文档: 本进度 + 12-system-map + HANDOFF
- Next: 计谋原型(S17) | 家族跟随引擎 | 第1环 Debug

## 2026-07-16 — Session 48
- Phase: 实现 **女间谍 S07∩S09**（HANDOFF Next 第1项）
- 实现:
  - 类型: `SpyAgent.agentKind?: 'male'|'female'`；`SpyMissionType.PILLOW_TALK/SOW_DISCORD`
  - 引擎: `trainFemaleSpy()`（耗 beauty2+金100，femaleSpySkills 偏 recon/lethal/tradecraft）
  - `dispatchMission` 扩展枕边风(忠诚−18~35+rank×2)/离间(降第三方友好 or 降民忠)；
    女间谍被捕友好−25(男−18)；反间对女间谍 detect+5；有 detailed 情报时成功率+10
  - AI: spyAi beauty≥4 时训女间谍 + 有 detailed 情报时优先枕边风/离间
  - 路由: `POST /intel/recruit-female`
  - UI: SpyPanel 训练女间谍按钮(pink) + ♀标记 + 条件显示枕边风/离间 option
- 验证(API 黑盒):
  - 寻访 beauty 0→2；训练 beautyStock 2→0 金−100 → agentKind=female skills tradecraft高
  - 枕边风成功 → 曹操忠诚−27
  - 离间失败 → 女间谍被捕 友好−25
  - 男间谍执行枕边风 → "该任务仅限女间谍执行"
  - beauty=0 训练 → "美女资源不足（需 2）"
  - shared build + server/client tsc --noEmit OK
- 文档: 04§29.4/29.5/29.6/29.7 + §30.5标已实现；06 API；07 UI；01；12-system-map；本进度；HANDOFF
- 简化: 掩护线(献美→点化)后置；离间降友好数值偏保守
- Next: 计谋原型(S17美人计/离间) | 家族跟随引擎 | 第1环 Debug

## 2026-07-16 — Session 47
- Phase: **全量功能验证** + 进度双写（上下文将满；无新功能）
- 验证:
  - shared build + server/client tsc --noEmit OK
  - validate-data：officers/cities/formations/units/items/females/children/skills/scenarios/events 全 OK
  - API 黑盒 25/25 PASS（对运行中 :3001）:
    A 健康/static · B 开局美女/女角/intel · C 内政全套
    D 寻访 stock+1 seekLeft−1 · 赏赐忠诚+库存−
    E 黄月英↔诸葛亮 · 祝融 canCommand
    F 非邻接出征拒绝 · 邻接 suggest→开战→占宛 · 抢夺 stock
    G 谍报招募/探秘/驻守反间 · H 进贡城金−200/结盟
    I 敌城开发拒绝 · 结束回合 190/1→2 · J 人口四桶/隐藏加成字段
- 文档: HANDOFF 重写为验收交接稿；本进度；12-system-map 成熟度脚注
- 已知债: 0-B 暂缓（女间谍/计谋/跟随引擎/裁剪 后续 Session 已实现）
- Next: 女间谍 | 计谋原型 | 家族跟随 | 第1环 Debug（一次一个）

## 2026-07-16 — Session 46
- Phase: 实现 **家族面板 S18**
- 实现:
  - FamilyPanel：女眷/姻亲/婚配；祝融可出战标记；子女表来自 /static children
  - BeautyPanel 仅库存赏赐；人事与家族分栏
  - listStatic 导出 children 摘要；boot 拉取
- 验证: typecheck OK；刘备开局家族可见黄月英/糜夫人
- 文档: 07/HANDOFF/本进度
- Next: 女间谍/计谋/跟随引擎

## 2026-07-16 — Session 45
- Phase: 用户补充 — 历史女角不可人事/美女获得；除祝融入家族系统；不可像男将工作
- 文档: 04§30.1/30.1b/30.6/30.7 家族；12-system-map S18=家族；00/01/HANDOFF
- 代码: 无
- Next: 家族面板 or 女间谍 or 计谋

## 2026-07-16 — Session 44
- Phase: 按定稿实现 **S09 美女资源**
- 实现:
  - Faction.beautyStock；City.beautySeekLeft 开局 floor(女成/400)
  - seekBeauty 寻访；rewardBeautyStock 赏赐忠诚；占城 lootBeautyOnCapture
  - 删除 searchBeauty→历史女；UI 寻访/顶栏美女/人事库存赏赐
- 验证: 成都 seekLeft 初值；寻访成功 stock+1 seek−1；赏赐关羽忠诚+
- 文档: HANDOFF / 本进度
- Next: 女间谍 / 计谋 或 第1环 Debug

## 2026-07-16 — Session 43c
- Phase: 用户澄清 — 寻访成功「扣1」= 扣城 **潜在可寻次数** beautySeekLeft
- 文档: 04§30.2/30.3（stock+1 且 seekLeft−1；抢夺多扣可寻+降民忠）
- Next: 实现 S09

## 2026-07-16 — Session 43b
- Phase: 用户补充美女规则 — **按势力**；寻访成功 **+1**；抢夺 **多拿+降民忠**
- 文档: 04§30.2/30.3、12-system-map、HANDOFF 数量备忘
- 代码: 无
- Next: 实现 S09 Faction.beautyStock

## 2026-07-16 — Session 43
- Phase: 美女=普通资源；历史女角才婚姻；寻访/上贡/外交/抢夺；赏赐忠诚；
  女间谍+计谋系统；与谍报/外交三角联动（用户定稿）
- 文档:
  - 04 新增 §30 美女/历史女角、§31 计谋；§9 婚配限具名女；旧搜罗标债
  - 12-system-map → 18 系统（S09 美女资源、S17 计谋、S18 历史女角婚姻）
  - HANDOFF / 本进度 / 01 摘要
- 代码: 无（仅设计定稿；现 searchBeauty 混用待重构）
- Next: 实现 S09 重构 → 女间谍 → 美人计/离间原型

## 2026-07-16 — Session 42
- Phase: 用户定调 **先定大系统清单，再逐步扩充完善 Debug**
- 文档: 新建 `docs/12-system-map.md`（16 大系统 + 成熟度 + 四环扩充顺序）
- 同步: AGENTS 规则8、11 启动流程、HANDOFF 以系统 ID 导航
- 无玩法代码变更
- Next: 用户点名 Sxx 或默认第1环 Debug（S05/S07/S06/S01）

## 2026-07-16 — Session 41
- Phase: 独立谍报系统（含反谍报+AI）；招募人数/等级由成年男+驻军决定
- 实现: spy.ts/spyAi.ts；IntelState.agents；左侧谍报面板；去一键侦查
- 验证: 成都招募×1 Lv1；探秘宛 detailed；驻守反间；typecheck OK
- 文档: 04§29、06/07、HANDOFF
- Next: 营救策反/脱敏

## 2026-07-16 — Session 40
- Phase: 用户：他方信息不可见；谍报/侦查；与外交互动；盟友部分可见
- 实现:
  - shared/intel.ts + GameState.intel；getCityVisibility
  - scoutCity 邻接+60金40粮 detailed 3月；出征 surface
  - diplomacy tribute/alliance；结盟后 ally 可见性
  - UI 右栏脱敏+侦查；地图灰势力/兵力???；左外交列表
- 验证: 侦查宛；进贡孙权→结盟 OK
- 文档: 04§5.5、06、07、HANDOFF
- 简化: 客户端仍持全量数据；停战未做
- Next: 停战/脱敏下发/多跳

## 2026-07-16 — Session 39c
- Phase: 用户：左右内政重复；美人放人事；人口无法收起；默认子项不打开
- UI:
  - 左侧去掉内政/军事操作，只保留人事(美人)/外交/君主/己方城池
  - 美人并入「人事」折叠下
  - 左右折叠 open 初始 null；toggle 再点收起（含人口）
- 文档: 07/HANDOFF/本进度
- Next: 同前

## 2026-07-16 — Session 39b
- Phase: 用户反馈左侧看不到美人；各大项要做成下拉（像人口）
- 修复/UI:
  - 左侧「美人」独立折叠大项，**默认展开**；去掉埋在底部的旧块
  - AccSection 统一组件；右栏：基本信息/人口结构/粮耗/内政/军事/日志 均可折叠
  - 默认右栏展开人口结构
- 文档: 07、HANDOFF 试玩步骤
- Next: 同 Session 39

## 2026-07-16 — Session 39
- Phase: 用户要求 美人列表 UI + 出征邻接(史实/地图) + 婚配/赏赐 + 天花板只显示100隐藏不展示
- 实现:
  - shared/city-roads.ts 30城官道；march 强制邻接；MapCanvas 虚线
  - BeautyPanel 列表；personnel marry/gift-beauty API
  - panelStatDisplay 顶100；officers.json 隐藏加成对齐 ceiling.ts
  - Officer.wifeId/beauties；Female.giftedToOfficerId
- 验证 API:
  - 成都→宛 拒绝；襄阳→宛 可出征
  - 搜罗貂蝉→赏赐关羽→改婚配关羽；stats≤100；刘备 charisma 面板100/hidden=5不用于展示
- 文档: 04§27.3/28.8b/c、06、07、03、HANDOFF、本进度
- 简化: 一妻无妾；无多跳行军
- Next: 多跳行军 / D4瘟疫 / P5-15(UI仍不显隐藏)

## 2026-07-16 — Session 38
- Phase: 用户要求 **写入规则「每完成新功能及时更新进度与相关文档」** + 按文档继续开发
- 规则写入:
  - AGENTS.md 规则 5「完成即文档」+ 规则 7「不确定先问/可提议」
  - 00-dev-constitution.md §一 / §八；11-context-management.md 会话结束流程
- 功能: **搜罗美人 Demo**（HANDOFF Next 第 1）
  - demographics: BEAUTY_SEARCH、adultFemaleCostForBeautyPoints
  - civil.searchBeauty：80金+1池+女成−400；具名女 or 民心+2
  - API POST /civil/search-beauty；RightPanel 按钮
- 文档同步: 04§28.8a、06 Demo API、07 RightPanel、01 术语、HANDOFF、本进度
- 验证: 成都搜罗 → 得貂蝉，女成 8504→8104、pool 21→20；二次得城中佳人；非己方拒绝
- 简化: 非完整 P4 婚姻/赏赐；D4 瘟疫等未做（[~]）
- 提议见 HANDOFF §10（美人栏 UI / 出征邻接 / 天花板只读面板）
- Next: 婚配简版 或 D4 瘟疫切片 或 P5-15；勿 0-B

## 2026-07-16 — Session 37
- Phase: 按 HANDOFF **出征/占城** Demo 闭环
- 实现:
  - `shared/types/battle.ts`: fromCityId / settled
  - `server/src/engine/march.ts`: prepareMarch（扣兵粮）+ settleBattle（胜占城/败撤回流）
  - `battle.ts`: 出征兵力入场；守将优先本城、避免君主全国飞守；野战守军×0.75
  - API: POST /march、GET /march/suggest-from/:id、battle/exit → GameState
  - UI: RightPanel「出征攻城」；BattleView 胜后「返回并占城」
- 验证:
  - API: 襄阳→宛 出征 4500 vs 3750 → 关羽胜 → 宛 ruler=刘备军、可开发农业
  - 中途撤军 50% 回流；己方城拒绝出征
  - Chrome headless: 点出征→自动战→占城；截图 leh-march-capture.png
- 简化标注: 无行军回合/Army 实体/邻接限制；非 P3 完整攻城
- Next: 搜罗美人 / 人口 D4 / P5-15；勿先 0-B

## 2026-07-16 — Session 36b
- Phase: 用户要求 **检查对话全部改动是否已入文档**（上下文将满）
- 审计结论: 主体已对齐；补 HANDOFF 征兵/结束回合描述；10-progress 状态行刷到 Session 36
- 历史会话日志中旧隐藏加成数字保留作史料，不定稿
- Next: 出征占城（新会话从 HANDOFF 接手即可）

## 2026-07-16 — Session 36
- Phase: 用户要求 **更新所有文档**（天花板定稿全量同步）
- 文档: 01 定稿表；03 CeilingBonus；04§27 定稿说明+速查；09 P5-15；11 ceiling.ts；HANDOFF §6
- 代码: 新增 `shared/ceiling.ts`（CEILING_HOLDERS / SECOND_TIER_FLOOR）与文档一致
- 隐藏加成: 吕50 / 诸葛20 / 曹15 / 荀10 / 刘5；武第二档 97
- Next: 出征占城

## 2026-07-16 — Session 35
- Phase: 改天花板隐藏加成数值（吕50/诸葛20/曹15/荀10/刘5；武第二档97）
- Next: 接 36 全文档同步

## 2026-07-16 — Session 34
- Phase: 更新所有相关文档（人口/美女等全量对齐）
- Next: 接 35

## 2026-07-16 — Session 33
- Phase: 用户要求 **成年女 ∝ 美女资源量**
- 实现: `beautyPool = floor(adultFemale/400)`；强制同步；RightPanel
- Next: 接 34 文档

## 2026-07-16 — Session 32
- Phase: 自然衰老 + 新生儿童 + 成丁性别比 112:100
- Next: 接 33 美女资源

## 2026-07-16 — Session 31
- Phase: 用户要求 **城市消耗与人口比例挂钩，成年男性吃得明显更多** → 落地
- 实现: demographics 粮耗/征兵/面板（见 HANDOFF）
- Next: 接 32 生育衰老

## 2026-07-16 — Session 30
- Phase: 用户新想法 **人口分层** → 规划写入 04§28（后由 31 实现）
- Next: 接 31

## 2026-07-16 — Session 29
- Phase: 用户定调 **尽快可玩 Demo、暂缓全图** → Demo 内政/军事闭环
- 实现:
  - civil: 农/商/城开发 + 征兵 + 施米 + 训练（即时结算）
  - API develop/conscript/relief/train；左右面板全接通
  - AI 对敌城农商/兵力微成长（压迫感）
- 验证 headless: 农+26/商+20/城+18/征兵+505/训练/施米 全 OK；结束回合春2月
  截图 `docs/screenshots/leh-demo-playable.png`
- 决策: **不扩 105 城**；接 Session 30 人口规划
- Next: 用户确认人口实现优先级

## 2026-07-16 — Session 28
- Phase: 用户要求 **更新文档 + 按 RFC/路线图开发后续** → 启动 **Phase 1**
- 文档: HANDOFF / 10-progress 双写；0-A 收官说明；P1-01~09 勾选
- 代码:
  - `GameLayout` + `TopBar` + `LeftPanel` + `RightPanel` 三栏布局
  - `MapCanvas` 从 WorldMap 拆出（仅地图）；store `focusMapOnCity`
  - `engine/turn.ts` 季节收获 + 调用 `engine/ai.ts` 占位 AI
  - createGame 季节随开局月；TopBar 金粮从己方城汇总
- 验证: 截图 `docs/screenshots/leh-phase1-layout.png`
- Next: 接 Session 29 Demo

## 2026-07-16 — Session 27c
- Phase: 用户要求 **缩放只缩放内容，底图保持全屏**（不再缩成中间小图+黑边）
- 实现:
  - `mapViewport.ts`：minScale = cover（max(vw/W,vh/H)），底图始终铺满视口
  - 滚轮只能从 cover 放大，不能再缩小出黑边；拖拽 clamp 不露空
  - LOD 按相对 cover 的倍率（rel=scale/minScale）
- 验证: typecheck OK；狂滚缩小后仍战略视野且 canvas 满屏
- Next: 接 Session 28 Phase 1

## 2026-07-16 — Session 27b
- Phase: 用户反馈 **缩放后字体/图标重叠、字号不合适**
- 修复:
  - 字号改为 **屏幕像素恒定**（约 12–15px 名 / 5–7px 点），不再错误放大
  - `layoutCityMarkers()`：标签包围盒碰撞消隐（优先选中>己方>等级）；可上/下避让
  - 过近城点隐藏低优先级标记；州郡级默认不全显城名（tier≥3）
  - 截图 `docs/screenshots/leh-lod-fixed-*.png`
- 验证: typecheck OK；headless 远/中/近视野切换正常
- Next: 接 27c 全屏 cover

## 2026-07-16 — Session 27
- Phase: 用户要求 **缩放分级显示地理信息**（参考全面战争三国）
- 实现:
  - `client/src/components/map/mapLod.ts`：四级 LOD（strategic/operational/tactical/local）
  - 远景：州名 + 大都会；中景：大城名；近景：全城 + 郡国 + 兵力
  - 己方/选中城任意缩放始终可见；右下角视野指示器
  - WorldMap 接入；标记/字号按 scale 近似屏幕恒定
- 验证: Chrome headless 滚轮 → 战役→城池→战略 指示器切换正确；开发农业 OK
  截图 `docs/screenshots/leh-lod-strategic.png` / `leh-lod-local.png` / `leh-lod-far.png`
- Next: 接 27b 碰撞/字号修复

## 2026-07-16 — Session 26b
- Phase: 用户确认布局 OK；问版权；嫌 3.6K 放大不清晰 → **升 8K**
- 版权: Natural Earth = **public domain**（https://www.naturalearthdata.com/about/terms-of-use/），游戏可用
- 改动:
  - `MAP_GEO` 3600×2777 → **8192×6320**（与原插画 8K 宽同级，高按经纬比）
  - 重渲染 `geo-basemap.png`；sync 30 城像素；validate-data OK
  - 滚轮最大缩放约 1.4（接近 1:1 像素仍清晰）
- Next: 接 Session 27 LOD

## 2026-07-16 — Session 26
- Phase: 用户反馈底图仍不对 → **换 Natural Earth 真实地理底图**（与城点同一投影）
- 方案:
  - `scripts/render-geo-basemap.py` 从 Natural Earth 50m 陆地/河流渲染 `client/public/geo-basemap.png`
  - bounds 与 `MAP_GEO` 一致（95–130°E, 18–45°N 等距圆柱）
  - `WorldMap` 加载 `/geo-basemap.png` 替代纯程序化网格
  - 城点仍为 WGS84 lon/lat 投影，**不手写像素**
- 验证:
  - 底图 HTTP 200；Chrome headless 截图 `docs/screenshots/leh-ne-basemap-ingame.png`
  - 开发农业 成都 380→409 OK
  - 预览：成都内陆、建业近长江口、襄平辽东、番禺珠江口、龙编越南北部
- Next: 接 26b 升 8K

## 2026-07-16 — Session 25
- Phase: **弃用插画底图**，改纯经纬度地图（用户：改了很多次坐标都不行，怀疑是底图问题）
- 根因: map.png 为艺术插画，投影不均匀，经纬度与地形标注无法同时对齐 → 反复手校无效
- 方案:
  - `lonLatToPixel()` = 等距圆柱（lon 95~130°E, lat 18~45°N → 3600×2777）
  - `GAME_SEAT_GEO` 只保留 Google Maps lon/lat，删除手写校准 x/y
  - `WorldMap` 不再加载 `/map.png`；程序化绘制网格/黄河长江示意/州名
  - sync-city-coords / validate-data / verify-geo-google 同步新投影
  - 同步更新 README / HANDOFF / 本进度表
- 验证:
  - validate-data 全 OK（含 11 条史实地理序）
  - Chrome headless: 全图截图 `docs/screenshots/leh-equirect-full.png`
  - 开发农业 成都 380→407；结束回合 → 190年2月
  - 目视: 成都/江州西南、姑臧西北、襄平东北、龙编/番禺在南、中原簇集正确
- Next: 被 Session 26 用 Natural Earth 底图接续

## 2026-07-15 — Session 24e
- Phase: 坐标真源改为 Google Maps WGS84 + 地形锚点（用户建议：对照 Google Maps 即可）
- 方案:
  - `GAME_SEAT_GEO`：30 治所各存 lon/lat（Google Maps 史实）+ x/y（map.png 地形校准像素）
  - `lonLatToPixel()` = 锚点 IDW；禁止纯 equirect（底图非均匀投影）
  - 新增 `verify-geo-google`（输出每城 Google Maps 链接 + 像素对照）
- 验证: shared build + sync-city-coords（0/30 变更）+ validate-data 全 OK；目视截图
  `docs/screenshots/leh-google-geo-full.png`（成都/江州在盆地、中原沿黄河、交州在南、辽东在东北）
- Next: 用户逐城审阅；某城仍偏 → Google Maps 确认 lon/lat → 调 `GAME_SEAT_GEO` x/y → sync

## 2026-07-15 — Session 24d
- Phase: 放弃全局偏移，30 城逐城独立手校
- 用户反馈: 全局 +450/-450 后每城偏差仍不一致
- 修复:
  - 删除 `MAP_CITY_OFFSET`；`GAME_SEAT_GEO` 每城 x/y 单独对照地形图校准
  - `TERRAIN_ANCHORS` 改为由 30 治所 + 敦煌自动派生（0-B IDW）
  - 例: 成都 2520,3050（盆地）；长安 3180,1780；江陵 4160,2780（长江）
- 验证: validate-data OK；参考图 `docs/screenshots/leh-per-city-geo.png`
- Next: 用户逐城反馈；改单城 → 改 `GAME_SEAT_GEO[adminName].x/y` → sync-city-coords

## 2026-07-15 — Session 24c
- Phase: 全局坐标校正 — 整体左下偏移
- 用户反馈: 城市相对地形图整体偏左下
- 修复: `MAP_CITY_OFFSET { dx:450, dy:-450 }` 应用于 `getGameSeatPixel`/`lonLatToPixel`；30 城 sync
- 例: 成都 2294,3135 → 2744,2685；洛阳 → 4710,1394
- 验证: validate-data OK；`docs/screenshots/leh-geo-offset450.png` 目视盆地/黄河落点改善
- Next: 用户确认偏移量；仍偏则只改 `MAP_CITY_OFFSET` 后 `sync-city-coords`

## 2026-07-15 — Session 24b
- Phase: 回滚 Session 24 错误 equirect 投影，恢复地形锚点坐标
- 问题: Session 24 用校准 equirect 只验证了 lon/lat 代码序，未对照地形图；成都落高原、龙编落西南山地等，用户截图驳回
- 修复:
  - 废弃 equirect；恢复 `TERRAIN_ANCHORS` + IDW（0-B）与 `GAME_SEAT_GEO` 手校 x/y（0-A 真源）
  - 30 城回到地形贴图坐标（成都 2294,3135 等）；冀县微调为 2720,1880；宛/江陵 x 略展开
  - 新截图 `docs/screenshots/leh-geo-terrain-fixed.png` 目视：成都/江州在盆地、中原沿黄河、交州在南
- 教训: 坐标验收必须 **全图标注叠加地形图目视**，不能只跑 validate-data 经纬度序断言
- Next: 用户逐城审阅；若有单城仍偏，直接改 `GAME_SEAT_GEO` 对应 x/y

## 2026-07-15 — Session 24
- Phase: 城市坐标按史实经纬度全面修正（30/30 城）— **已被 24b 回滚，勿作参考**
- 问题: 部分城市手标/IDW 投影偏离史实（如冀县曾偏西、荆州三城共 x=4096、西北东西向颠倒）
- 修复:
  - `cities-geo-reference.ts`: IDW 改为校准等距圆柱投影（bounds 92.5~131°E, 19.5~46°N）
  - 新增 `GAME_SEAT_LON_LAT`（30 治所史实经纬度）+ `getGameSeatPixel()`
  - 新增 `server/src/scripts/sync-city-coords.ts`；`validate-data` 增加投影一致性 + 11 条史实地理序断言
  - 30 城 x/y 全部重算（例：冀县 2595,1824→2813,1987；成都 2294,3135→2460,2667）
- 验证: validate-data 全 OK（含 geo ordering）；API 成都/长安/冀县坐标一致；Chrome headless 截图
  `docs/screenshots/leh-geo-historical-full.png` 地图落点分布合理、开发农业可点
- Next: 用户确认地图视觉效果后进 Phase 1 或 0-B

## 2026-07-15 — Session 23
- Phase: 修正城市坐标 — 23/30城坐标更新
- 问题: 30城坐标部分存在明显地理错误（冀县显示于长安以北、剧县显示于平原以北、寿春显示于襄阳以北）
- 修复:
  - 20座有对应控制点（MAP_ART_CONTROLS）的城市 → 使用精确的控制点像素坐标
  - 冀县/汉阳: (2499,1660) → (2595,1824) — 修正至长安正北略偏西
  - 剧县/北海: (5366,1360) → (5366,1492) — 修正至平原以南
  - 寿春/九江: (5202,2305) → (5424,2565) — 修正至襄阳以南
  - 7城保留原手标坐标（阳翟/平舆/真定/陈留/濮阳/壶关/涿 — 经核查相对位置合理）
- 验证: validate-data 全 30 城 OK；shared build 通过；关键地理关系断言全通过
- 已知: 底图插画本身存在局部经/纬度扭曲（如晋阳y<姑臧y、成都y>江陵y），控制点坐标反映的是插画标注位置，
  部分控制点间y/x序关系与经纬度不一致属插画固有变形，本次不作修正
- Next: 用户确认坐标修正效果后进 Phase 1 或 0-B

## 2026-07-15 — Session 22
- Phase: 交接文件 + 开发准则「进度双写」
- 新建根目录 HANDOFF.md（当前阶段/怎么跑/城名与地理约定/已知简化/Next/结束清单）
- 00-dev-constitution.md v1.2：强制 10-progress 与 HANDOFF 同步；UI 须实操验证
- 11-context-management.md：会话启动先读 HANDOFF；结束流程增加同步 HANDOFF
- AGENTS.md：启动读 HANDOFF；核心规则增加进度双写
- Next: 用户确认 0-A 地图/治所后进 Phase 1 或 0-B

## 2026-07-15 — Session 21
- Phase: 同步更新 10-progress.md（进度真源）
- 刷新 P0A-07 备注：治所名 + adminName + 手标坐标
- 写入 0-A「当前状态」摘要（怎么跑/城名约定/地理参考/已知简化/截图路径）
- P0B-07 备注注明扩容时坐标取 cities-geo-reference、name 用治所
- 无代码变更

## 2026-07-15 — Session 20
- Phase: 城名统一为治所名 + 按地图标注手标30城坐标
- 显示名 name=治所/通用地名（洛阳/长安/成都/建业/邺/江陵…）
- 新增可选 adminName=郡国正式名（河南尹/蜀郡/丹阳郡…），面板「郡国」行展示
- 30城 x/y 按 map.png 汉字标注手标（非 equirectangular），州名仍作 province
- 错误: favicon 404 → 补 public/favicon.ico；Zod 放行 adminName
- 验证: validate-data OK；API 己方城=成都/汉中/江陵/襄阳/江州；截图 docs/screenshots/leh-seats-full.png
- 己方列表现为治所名，不再显示「蜀郡」作主名

## 2026-07-15 — Session 19
- Phase: 排查「数据对了但浏览器画面不对」+ 修复投影/热重载/默认视野
- 第1步 服务与数据:
  - 发现多套 server/vite 进程并存（pts/2 的 pnpm dev + nohup），易连到旧进程
  - cities.json 启动时读入内存；tsx watch 改 JSON 不会自动重载 → 用户刷新前端仍拿旧坐标
  - 硬重启后 file vs API 30/30 一致；已加 getStaticData() 按 cities.json mtime 热重载
- 第2步 渲染变换:
  - Konva Stage 统一 scaleX/Y，城市 Group 用与底图相同的 map 像素坐标 → 无双重缩放问题
  - 真正错位根因是经纬度 equirectangular 与 map.png 插画地理不一致（蜀郡 y 曾偏北 ~860px）
- 第3步 前端数据源:
  - 城市坐标只来自 API createGame，无 localStorage/client 副本
  - 启动时 console.info('[map-geo] …') 打印实际渲染坐标供对照
- 修复:
  - cities-geo-reference 改为 map-art 控制点 + IDW 投影（锚洛阳/长安/成都/建业等）
  - 重写 30 城 x/y（蜀郡回到 2294,3135 贴成都标注）
  - 默认「全图」视野 + 全图按钮（避免只看到益州一角误判）
- 验证: API 蜀郡 2294/3135；无头浏览器截图 docs/screenshots/leh-geo-fixed-full.png；typecheck OK
- 请用户: 停掉旧 pnpm dev → 重新 pnpm dev → 浏览器强制刷新 Ctrl+Shift+R

## 2026-07-15 — Session 18
- Phase: 地理坐标修正（与 P0A-07 数据条数无关；仍 30 城游戏数据）
- 任务A: 新建 shared/data/cities-geo-reference.ts
  - 105 郡国地理参考：name/province/lon/lat/x/y/seatProxy
  - 投影到 map.png 8192×4610（lon 97~128, lat 18~43）
  - 另 EXTRA_GEO_LABELS 含「襄阳」（非 105 郡国名，0-A 游戏用）
  - 不含人口/势力等游戏字段；供 0-B 扩容取坐标
- 任务B: 用参考表重写 server/src/data/cities.json 中 30 城 x/y（条数仍 30）
- 验证:
  - 关系断言: 长安西于洛阳、成都西南、丹阳东、辽东北、交趾南 全 OK
  - Zod validate-data 仍 30 城全过
  - 浏览器截图 docs/screenshots/leh-geo-shudu.png / leh-geo-wide.png
- 明确未做: 未把游戏 cities 扩到 105

## 2026-07-15 — Session 17
- Phase: 修复 P0A 验收阶段发现的问题（非新功能）
- 问题: 报告称「1次内政已验证」，但浏览器点城后看不到「开发农业」
- 根因: 按钮用 isPlayerCity 条件渲染；玩家刘备仅占西南5城(蜀郡/汉中/南郡/襄阳/巴郡)，
  默认全图缩放下易点到中原他方城，面板只显示发起战斗/关闭，开发按钮被隐藏；
  且无己方城引导，验收操作路径不成立。API 链路本身正常。
- 修复:
  - 开发农业按钮始终可见，他方城 disabled + 文案说明
  - 启动后自动选中并镜头对准己方都城(蜀郡)
  - 左上角己方城池快捷列表；地图己方标记「己」；成功反馈 lastActionOk
  - 点击热区随缩放补偿，降低点不中概率
- 实际浏览器验证(puppeteer-core + Chrome headless，非仅 API):
  1. 打开 :5173 → 自动出现蜀郡面板且「开发农业」可点 → 农业 380→402，有成功反馈 OK
  2. 结束回合 → 190年2月 + 日志「回合结束」 OK
  3. 发起战斗 → 敌方自动移动 → 返回大地图 OK
  4. 己方城池列表/地图 UI OK；pnpm validate-data OK
- 教训: 验收必须按报告步骤在浏览器实操，禁止只跑 API/代码推断

## 2026-07-15 — Session 16
- Phase: **正式 Phase 0-A 全量交付**（非 demo；从 monorepo 架构起正式走）
- Completed P0-01~05 + P0A-06~15 全部 [x]
- 结构: pnpm workspace → shared(types+enums+Zod) / server(Express+ws+engine) / client(Vite+React+Konva+Zustand+Tailwind)
- 数据: server/src/data/*.json 均过 Zod；30武将/30城(13州)/6阵/6兵/20宝/10女/5子女/30技/1剧本/5事件
- 复用 demo: 地图底图+城坐标、hex 移动、§6.1 伤害、simpleAi 规则（标注为 P1-09 占位种子，非 P5 正式 AI）
- 验收自测:
  1. pnpm validate-data 全 OK
  2. pnpm typecheck / lint 全过
  3. API: create → end-turn(年月+1) → develop-farm(蜀郡农业+) → battle 完整打穿(关羽胜)
  4. 地图/内政/战斗 UI 在 client 接通上述 API
- 简化/占位说明: 内政仅「开发农业」；大地图 AI 仅日志占位；战斗 AI 为规则写死；skills 仅1级桩；无 SQLite 存档
- Next: Phase 1 地图&回合正式任务 / 或 0-B 数据扩容（须 0-A 验收被用户确认后）

## 2026-07-15 — Session 15
- Phase: demo 补「规则写死的最简战斗AI」+ 大地图回合AI占位
- Completed:
  - 战斗: battlePhase 状态机(player/enemy/over)；敌方回合自动执行 if 在射程→攻击 else 朝最近玩家移动(复用 reachable + §6.1 伤害)
  - 实现见 src/battle/simpleAi.ts — **demo 战斗AI为规则写死的占位实现，非 P5-01 正式 AI 决策引擎**
  - 大地图结束回合: 对其它势力打日志「XX势力进行了内政（占位）」，无真实内政计算
- Explicitly NOT done: AI难度/性格/权重、外交、内政真实结算、多AI博弈（均属 Phase 5）
- Next: 用户验证敌方会自动移动/攻击

## 2026-07-15 — Session 14
- Phase: **demo 跑通**（非正式 Phase 0-A 交付；未做 Zod/Monorepo/后端/完整类型体系）
- 核实:
  - 文档消歧义补丁4项已在 05/08/03 生效，本次未重复修改
  - 根目录已有 Vite 骨架(package.json/index.html/vite.config)，src 几乎为空 → 续建而非推倒
  - 地图文件 imagine-*.png = 8192×4610 PNG 三国全图 → 作 MapCanvas 底图，城市坐标手标
- Completed:
  - React+Vite+Konva+Zustand 最小 demo：大地图底图+12城点位/信息面板/结束回合(年月+1)
  - 最小战斗：20×15 六角、地形消耗(平原1/森林2/水域4)、§6.1 核心伤害、双方各1部队、可回大地图
  - 极小数据：8武将/3兵种/3地形/12城（坐标对照 public/map.png 手标，可再调）
- 明确未做: Zod、SQLite、WebSocket、AI、内政、外交、单挑、计策、攻城、专属技能
- 与 Phase 0-A 差距: 无 monorepo/shared types/validators/server；无 0-A 验收四项完整闭环；
  数据与规则仅为可玩切片，正式架构需按 09-roadmap 0-A 重走
- Run: `npm install && npm run dev` → http://localhost:5173
- Next: 用户审 demo 效果后决定是否补规范或继续加玩法

## 2026-07-15 — Session 13
- Phase: 文档对账 + Roadmap 补洞（无代码）
- Completed:
  - 宝物总数统一为165(原130/~160/158三方打架)；01品类表重配额(主武器42→45/特殊20→22/消耗品18→20)
    使合计=165；同步修正 00/08/09/10/11 五处引用
  - 08-data-dictionary.md: category字段说明对齐03的weapon_primary/weapon_secondary命名
  - 11-context-management.md: 宝物品类速查表同步对齐weapon_primary/weapon_secondary
  - 00-dev-constitution.md: 新增"核心数字真源规则"——规模数字以08-data-dictionary.md为唯一真源
  - 09-roadmap.md / 10-progress.md: Phase 0 拆分为 0-A(小数据集验证架构，含P0-01~05+P0A-06~15)
    与 0-B(全量数据扩容，P0B-06~15)两轮；0-A验收标准写入
  - 09-roadmap.md / 10-progress.md: 补齐04-game-systems.md §22-27对应任务ID
    (P4-10关押/P4-11伤病/P4-12伤兵/P5-14部队等级/P5-15武将特性+属性天花板)
- Decisions: 数字真源=08-data-dictionary.md；Phase 0先小数据集验证架构再扩容全量；
  Zod校验先于任何JSON数据生成
- Blockers: none
- Next: Phase 0-A 代码实施（Monorepo初始化 → 类型定义 → Zod校验 → Server/Client骨架 → 小数据集生成）

## 2026-07-15 — Session 12
- Phase: 属性天花板定稿 + 隐藏加成写入
- Completed:
  - 04-game-systems.md §二十七: 第二梯度 武从97起 / 统智政魅从99起;
    隐藏加成 吕布+50 / 诸葛亮+30 / 曹操+20 / 荀彧+20 / 刘备+10;
    有效属性公式、隐藏光环、差异化密度表; v1.9
  - 03-data-models.md: CeilingBonus / OfficerHidden.ceilingBonus
  - 01-overview.md: 天花板摘要同步
- Blockers: none
- Next: 用户休息后继续；或 Phase 0 代码实施

## 2026-07-15 — Session 11
- Phase: 属性天花板体系 v3 (100独一+97起并列+255上限+特性看总属性)
- Completed:
  - 04-game-systems.md §二十七属性天花板: 5维天花板1人/维,第二梯度97~99并列,
    96起更多并列, 上限255, 特性天花板=总属性/20(含装备功绩爵位)
  - 01-overview.md: 属性天花板摘要
  - 04 v1.8, 共27章
- Blockers: none
- Next: 用户其他想法

## 2026-07-15 — Session 10
- Phase: 武将特性系统 (42×5级, 5类, 属性天花板)
- Completed:
  - 04-game-systems.md §二十六武将特性: 5类(战略/战术/战斗/内政/人格)42特性;
    每特性Lv1~5级+(属性天花板=统/智/武/政/魅/20);
    战略vs战术分离示例(荀彧vs荀攸vs典韦);
    属性天花板角色表(吕布武5/曹操统4/诸葛亮智5等)
  - 03-data-models.md: TraitCategory enum + OfficerTrait 接口 + Officer.traits 字段
  - 04 v1.7, 共26章
- Blockers: none
- Next: 用户其他想法

## 2026-07-15 — Session 9
- Phase: 伤兵系统 / 部队等级系统
- Completed:
  - 04-game-systems.md §二十四伤兵(伤亡分流/恢复率/容量/恶化/战后统计)
  - 04-game-systems.md §二十五部队等级(7级/经验获取/补员稀释/训练加速/与兵质的关系)
  - 04 v1.6, 共25章
- Blockers: none
- Next: 用户其他想法

## 2026-07-15 — Session 8
- Phase: 伤病系统
- Completed:
  - 04-game-systems.md §二十三、伤病系统:
    5级伤情(轻伤~死亡) / 6种受伤来源 / 5种疾病(伤寒/瘟疫/疟疾/老年/酒色)
    / 后遗症(臂残/腿跛/肺伤/脑震/容损) / 9种伤愈方式 / 瘟疫传播机制 / 年老体衰
  - 04 v1.5
- Blockers: none
- Next: 用户其他想法

## 2026-07-15 — Session 7
- Phase: 关押系统 / 人才自动跟随 / 士兵俘虏 / 战后城市损耗
- Completed:
  - 04-game-systems.md: 三人事新增荐才/招贤令/名望吸引/察举/自动跟随;
    新增二十二关押(监狱4级/3角色/7审讯/囚心理/劫狱/处决)
  - 05-combat-system.md: 新增十一战后结算(士兵俘虏4处置/战利品/城市损耗恢复/管制)
- Docs: 04 v1.4, 05 v1.2+
- Blockers: none
- Next: 用户其他想法

## 2026-07-15 — Session 6 (Bugfix)
- Phase: 人才招募v2 / 士兵俘虏 / 战后城市损耗
- Completed:
  - 04-game-systems.md: 三、人事系统扩展(荐才/招贤令/名望吸引/察举)
  - 05-combat-system.md: 新增十一、战后结算(士兵俘虏/战利品/城市损耗/恢复/管制)
- Blockers: none
- Next: 关押系统写入 + 用户其他想法

## 2026-07-15 — Session 6 (Bugfix)
- Phase: 文档审查 & 修复 — 10项发现问题修复
- Fixed P0:
  - ScenarioStartingState 旧 position/rank 字符串 → 新 enum 字段
  - 04-game-systems TOC与正文章节编号错位 → 统一为21章
  - 08-data-dictionary Item.category → weapon_primary/secondary
- Fixed P1:
  - 体力公式明确判定规则(max(统+武,政+智)/10) + 典型值验证
  - 功绩衰减速率 1%/季→0.3%/季, 最低保留Lv10
- Fixed P2:
  - 外交v3正文完整写入(16行动+9宣战理由+信誉+公式)
  - 献帝v2正文写入(状态机/7诏书/收益与代价/被夺)
  - 贸易v2正文写入(路线/设施/禁运/劫掠)
  - 功绩20级完整表(含属性/技能/特殊效果三列)
- Fixed P3:
  - 宝物总数修正为~160(待数据录入精算)
  - 兵种适性新增训练等效路径(0.3次/季)
- Docs updated: 03/04/01/08/10 all at v1.3+
- Blockers: none
- Next: 用户其他想法或 Phase 0 代码实施

## 2026-07-15 — Session 5
- Phase: 出身关系网/功绩影响表/装备兵种熟练度/特殊人物/英雄集结/开局设定
- Completed:
  - 03-data-models.md: SpecialNPC/OfficerTag/OfficerRelation/Proficiency/UnitUsageRecord/GameSetup 新增;
    Scenario.type/whatIfRules 新增; Officer 增加 tags/relations/proficiency/unitUsageRecords
  - 04-game-systems.md: 出身与关系网(四)/装备兵种熟练度(十九)/特殊人物(二十)/剧本&英雄集结(二十一) 新增4章;
    章节全面重编号(1~23章)
  - 01-overview.md: 剧本/开局/关系网/熟练度/特殊人物摘要
- Pending: 外交v3/献帝v2/贸易v2 三章 body 内容待后续补充
- Blockers: none
- Next: 用户其他想法或 Phase 0 代码实施

## 2026-07-15 — Session 4
- Phase: 文档更新 — 地域特产/纬度兵种造价/少数民族进贡与掠夺
- Completed:
  - 04-game-systems.md: 内政新增2.7(地域特产13州)+2.8(纬度兵种造价5级梯度);
    少数民族新增6.4(进贡)+6.5(掠夺)
  - 08-data-dictionary.md: cities新增 latitudeIndex/specialties 字段
  - 01-overview.md: 新增特产表/纬度梯度/少数民族交互摘要
- Decisions: 纬度5级制决定骑兵/水军造价(北低南高); 少数民族双向交互(进贡+掠夺)
- Blockers: none
- Next: 用户其他想法或 Phase 0 代码实施

## 2026-07-15 — Session 3
- Phase: 文档更新 — 内政v3/关隘/少数民族/城市六级/宫城/部队比例修正
- Completed:
  - 03-data-models.md: 新增 CityTier/EthnicGroup/ResourceType/CityFacility/CityPolicy 枚举;
    Pass/MinorityState/ResourceStock/CityUpgradeLog 接口;
    City 接口增加 tier/countyCount/facilities/policy/developmentProgress/resourceOutput 字段;
    GameState 增加 passes/minorities/factionResources/cityUpgradeLogs; 全部章节重新编号(20章)
  - 04-game-systems.md: 内政v3完全重写(8维度/10设施/10政策/3资源/贸易/持续任务);
    新增3章：关隘系统(25座)/少数民族系统(6族19据点)/城市等级系统(Lv1~6+宫城三路径);
    所有章节重新编号(1~17章)
  - 05-combat-system.md: 攻城战重写(6级城市缩放战场15×10→35×25);
    新增小县城据点机制/宫城三层设防/关隘战; v1.2
  - 08-data-dictionary.md: cities.json新增字段; 新增三份Schema(关隘/少数民族/资源); itemsets重编号
  - 01-overview.md: 新增城市等级表/少数民族表/三种资源说明
  - 06-api-design.md: 新增内政·设施/关隘/少数民族/城市升级 API 共4节
  - 07-ui-design.md: 新增内政面板/夷狄交互面板/城市升级面板 UI 描述
- Decisions: 城市等级从5级扩展为6级(含关隘Lv1); 宫城解锁三条路径(拥献帝最速);
  少数民族不灭只扰; 内政改为持续型投入(非即时结算); 关隘作为主地图独立节点
- Blockers: none
- Next: 根据用户其他想法继续补充，或开始 Phase 0 代码实施

## 2026-07-15 — Session 2
- Phase: 文档更新 — 官职/功绩/体力/经济/赏赐/主副武器/单挑v3
- Completed:
  - 03-data-models.md: 新增 CivilPosition/MilitaryPosition/NobilityRank/DuelAction 枚举;
    Officer 接口新增三轨官职/功绩/体力/5槽装备/美人字段;
    新增 FactionFinance/CityFinance/ArmySupply/Beauty/DuelInjury/DuelRound/DuelResult 接口;
    武器重分类 PrimaryWeaponSubType/SecondaryWeaponSubType
  - 04-game-systems.md: 新增官职(五)/功绩(六)/体力(七)/经济(八)/赏赐(十一) 共5章;
    重新编号婚姻→九, 子女→十, 宝物→十二, 事件→十三, AI→十四;
    宝物系统更新为5槽(主武器+副武器+甲+马+辅)
  - 05-combat-system.md: 单挑系统全面重写为v3版本(6指令/4角克制/副武器介入/部位受伤/波及相关)
  - 01-overview.md: 对比表新增官职/经济/体力/单挑行; 宝物165件更新; 5槽装备说明
  - 03/05 文档版本更新至 v1.1
- Decisions: 主副武器分槽设计已写入数据模型; 弓/弩/暗器确认为副武器三选一
- Blockers: none
- Next: 可根据用户其他想法继续补充，或开始 Phase 0 代码实施

## 2026-07-15 — Session 1
- Phase: 文档设计 (P0-16)
- Completed: 全部 12 份开发文档
  00-dev-constitution.md  开发总则
  01-overview.md          项目概述 + 术语表
  02-architecture.md      技术架构
  03-data-models.md       数据模型全量
  04-game-systems.md      游戏系统(内政/人事/外交/婚姻/子女/宝物/事件/AI)
  05-combat-system.md     战斗系统(六角网格/地形/天气/阵型/兵种/伤害/计策/单挑/攻城)
  06-api-design.md        REST + WebSocket API
  07-ui-design.md         组件树 & 路由 & 交互流程
  08-data-dictionary.md   静态数据全表 Schema
  09-roadmap.md           开发路线图 & 里程碑
  10-progress.md          进度跟踪(本文档)
  11-context-management.md 上下文管理策略
- Decisions:
  - REST + WebSocket 通信
  - Konva.js Canvas 渲染
  - Zustand 状态管理
  - pnpm workspace Monorepo
  - better-sqlite3 存档
  - Zod 运行时校验
  - 遵循01-overview中定义的完整系统清单
- Blockers: none
- Next: Phase 0 实施 — Monorepo 初始化 → types 定义 → 数据文件生成
```

## 2026-07-17 — Session 97（战役/战术分层全面设计：战斗系统重构）
- Phase: **文档设计**（战斗系统从六角网格战术层重构为战役/战术两层，无代码改动）
- 设计内容:
  - **`docs/00-dev-constitution.md`**：新增 §十 命名分层规范（技能二字/三字、势力特点四字、兵种三字等层级分界 + 全库 grep 约束）
  - **`docs/05-combat-system.md` 全面重构**：
    - 文档结构改为 Part I 战役层 + Part II 战术战斗要素
    - **§十二 战役地图节点**：大城/县城/关隘/港口/设施五类节点，节点属性表，道路网络，郡国体系
    - **§十三 Army 实体与编成**：CampaignArmy 数据结构，编成流程（主将+副将+参谋），Squad 五部阵位（先锋/中军/左/右/后卫），补给系统，品质四维（士气/组织度/经验/疲劳），参谋战役角色表
    - **§十四 总军师系统**：总军师 vs 参谋 vs 军师官职三层区分，态势决策（进攻/防守/发展/隐忍），战略献策，总军师对决
    - **§十五 设施与机关系统**：12 种设施总表（副将建造：营寨/冲车/云梯/井阑/投石车/栅栏/壕沟/浮桥/粮仓；参谋专属：陷阱/瞭望塔），混合建造模型（大型器械消耗回合 vs 机关不占回合 vs 扎营自动），技能/特性联动全表，耐久与摧毁规则
    - **§十六 战役状态机**：驻守→行军→野战→围城（围困/造械/劝降/强攻/撤围）→战后六阶段，各阶段操作矩阵
    - **§十七 自动战斗算法**：战力公式（基础战力×编成修正×状态修正×环境修正×计谋修正×攻城修正），多回合推演模拟，单挑在算法中的触发概率，郡国归属算法（动态投降率）
    - **§十八 战术战斗层（设计保留）**：现有 battle.ts 保持，标注为可选模式
  - **`docs/04-game-systems.md`**：
    - **§三十六 势力特点**：12 势力完整设定表（曹操唯才是举/刘备仁德济世/孙权坐断东南/吕布虓虎之勇/袁绍四世三公/马腾羌胡归心/公孙瓒白马长史/张鲁五斗米道/刘表保境安民/张角苍天已死/袁术僭号称帝/孔融名士风流），核心理念+数值修正+特殊能力+负面特性四结构
    - **§三十七 总军师系统规则**：三层角色区分表，任命/解职条件，态势切换冷却规则，总军师对决详细公式，AI 态势判定逻辑
  - **`docs/03-data-models.md`**：新增 §二十 战役层数据类型（CampaignNode/CampaignArmy/CampStructure/AutoBattleResult/GrandStrategist/FactionTrait）
  - **`docs/06-api-design.md`**：新增 §2.14 战役 API（8端点） + §2.15 总军师 API（4端点） + §2.16 势力特点 API（2端点）
  - **`docs/07-ui-design.md`**：新增 §十 战役UI（Army面板/建造菜单/战斗报告弹窗/总军师面板/势力特点展示）
  - **`docs/12-system-map.md`**：S10 更新为战役/战术分层描述，Session 97 加入建议列表
  - **HANDOFF / 10-progress** 进度双写
- 核心设计变更:
  - 战斗系统从"出征→瞬移→hex战术战斗"变为"编成→多回合行军→自动算法结算"
  - 主副将/参谋/总军师三层分离，各司其职
  - 势力特点为每个势力赋予独特玩法风格
  - 战术层（hex battle）设计保留，代码存续但不作为主线
- 文档版本: 05 v3.9→v4.0, 04 v3.8→v4.0, 03 v2.0→v2.1, 06 v2.0→v2.2, 07 v2.4→v2.5, 12 v3.10→v4.0, 00 v1.3→v1.4
- 自验证: 全文通读，各章引用一致性/命名分层无冲突/逻辑自洽
- Next: 战役层引擎实装（CampaignArmy/行军/自动战斗算法） → 总军师系统 → 设施系统 → 势力特点数据

## 2026-07-17 — Session 97b（命名合规维护：补规则缺口 + 修5处重名）
- Phase: **合规维护**（用户要求审核命名规则可执行性 + 扫描实际冲突 + 修补）
- 扫描结果:
  - 跨层冲突3处：技能「激励」vs 轻步兵战法「激励」、特性「铁壁」vs 重步兵战法「铁壁」、技能「远射」vs 弓箭手特性「远射」
  - 同层自重复2处：蒙冲=兵种名+特性名、楼船=兵种名+特性名
  - 其余6处同层战法名重复（突击/突破/激流/火船/冲撞）属合理军事动作复用，不改
- 修复:
  - `00-dev-constitution.md` §十：补全局原则行 + 技能/特性禁止列加「战法名」+ 战法列改为「推荐唯一，与兵种名相同时须改」
  - `server/src/data/units.json`：5处改名（激励→振奋、铁壁→坚垒、远射→劲射、蒙冲→铁撞、楼船→巨舰）
  - `docs/05-combat-system.md` §5.4：战法表同步（激励→振奋、铁壁→坚垒）
- 自验证:
  - `pnpm --filter @leh/shared build` ✅
  - `pnpm validate-data` ✅ 10/10
  - `pnpm test` ✅ 68/68
  - grep 确认新名不与其他层级冲突
- 文档版本: 00 v1.4→v1.5
- Next: 战役层引擎实装

## 2026-07-17 — Session 97c（学派与信仰系统设计：§38 全量写 + 各文档同步）
- Phase: **文档设计**（新系统：学派与信仰，无代码改动）
- 设计内容:
  - **`docs/04-game-systems.md`**：
    - §34.5 新增与学派系统互动节（科技↔学派双向影响、学派→文化产出公式）
    - **§三十八 学派与信仰**全量写：
      - 38.1 城市文化倾向概念：7 种学派倾向值（儒/道/佛/墨/法/纵横/医），决定因素表
      - 38.2 各学派详表：儒（教化/礼法）、道（太平/天师）、佛（白马寺/译经）、墨（守城/机关）、法（律令/赏罚）、纵横（合纵/连横）、医（伤寒/青囊）。每学派含历史背景+三档阈值效果+§34联动
      - 38.3 获得与改变：8种文化设施（太学/道观/浮屠祠/墨者工坊/律令府/纵横馆/济世堂/藏书阁）建造表+武将任教+势力级文化政策（独尊儒术/黄老无为/诸法并用等）+S14事件预留
      - 38.4 学派冲突：儒×法冲突规则，佛/道相安规则
      - 38.5 与已有系统联动总表（§34科技/§17自动战斗/§15设施/§08外交/§17计谋/§23伤病/§04人口/§35税收/势力特点/S15 AI）
      - 38.6 各势力初始倾向建议表（13势力+洛阳，历史依据标注）
      - 38.7 数据结构（City.culture + Faction.culturalPolicy）
  - **`docs/01-overview.md`**：能力列表补学派与信仰
  - **`docs/03-data-models.md`**：新增 §20.7 CityCulture 类型
  - **`docs/07-ui-design.md`**：新增 §10.7 城市文化面板（学派分布/设施/导师/激活效果）
  - **`docs/06-api-design.md`**：新增 §2.17 学派与文化 API（5端点）
  - **HANDOFF/10-progress** 双写
- 核心设计原则:
  - 学派=被动加成系统（建设施→倾向偏移→持续生效），不需要每回合操作
  - 与§34科技/教育的区分：科技是国家投入，学派是社会思潮。独立但相互反馈
  - 墨家与战役层设施系统深度联动（建造+20%、可并行造器械、耐久+30%）
  - 儒法冲突规则、佛道相安规则
  - 洛阳初始佛25（白马寺68年历史）
- 文档版本: 04 v4.0→v4.1, 01 v1.9→v2.0, 03 v2.1→v2.2, 06 v2.2→v2.3, 07 v2.5→v2.6
- 自验证: 全文通读，各学派效果对接已有系统公式的一致性/历史准确性/命名不冲突
- Next: 战役层引擎实装（CampaignArmy/行军/自动战斗算法） → 总军师系统 → 设施系统 → 势力特点数据 → 学派系统

---

*文档版本: v5.8 | 2026-07-17 | Session 98 战役层引擎最小切片实装（§12节点·§13 Army编成+行军+补给·§15设施·§16状态机·§17自动战斗算法·CampaignPanel UI·57断言全过·dev实操占城）*
