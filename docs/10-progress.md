# 开发进度跟踪

## 2026-08-04 — Session 322 · S10 单挑观看/跳过装备属性同源

- Phase：**S10 战斗深化**；继续同一大系统，郡域阵前入口为最小依赖修补，不扩数据规模。
- 修复：六角战中 `stepBattleDuel` 与郡域阵前单挑逐回合入口现在和 `skipBattleDuel` 一样传入双方装备单挑加成；观看与跳过不再因装备产生不同结算。
- 文档：同步 `docs/05-combat-system.md`、`docs/21-battlefield-scene-design.md` 与根目录 `HANDOFF.md`。
- 验证：duel/装备回归、server typecheck/lint、shared build/test、`git diff --check` 全部通过。
- 诚实边界：正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成；本轮不宣称 P5-01 全局 AI 完成。
- **Next**：继续权威战法/敌军 AI/单挑一致性回归；正式特殊兵种使用次数熟练度仍待用户批准，S16 SQLite 仍未实装。

## 2026-08-04 — Session 321 · S10 敌军 AI 暴击装备属性同源

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、不新增 BattleState 字段、API、RNG 或数据规模。
- 修复：敌军 AI 普攻进入完整暴击/反击链时，现在复用玩家路径的装备 `crit_rate`，分别传入攻方暴击与守方反击暴击判定；旧的简化 AI 调用仍按无装备处理。
- 验证脚本 `verify-tactical-ai` 新增无装备/装备青龙偃月刀的固定 RNG 对照，覆盖总断言 **28/28**；确认无装备不虚增暴击、装备暴率正常生效。
- 文档：同步 `docs/05-combat-system.md` §18.1.1 与根目录 `HANDOFF.md`。
- 诚实边界：正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成；本轮不宣称 P5-01 全局 AI 完成。
- **Next**：继续权威战法/敌军 AI 一致性回归；正式特殊兵种使用次数熟练度仍待用户批准，S16 SQLite 仍未实装。

## 2026-08-03 — Session 305 · S10 敌军主动兵种战法切片

> **范围**：继续 S10 六角战斗深化；不新增字段、数据规模或独立规则系统。

- `server/src/battle/simpleAi.ts`：敌军在目标进入 1~2 格白刃范围时，读取当前兵种 `leveled`
  战法和武将兵种适性，选择可负担的最高层级；成功施放后按既有 `calcDamage`、阵型贡献和
  权威 RNG 结算，扣除对应气力、结束该部队行动并保留状态效果。命中失败只消费气力，不追加普攻；
  `proficiency` 特殊战法、多目标范围展开暂不接入。
- 验证脚本 `verify-tactical-ai` 从 6 项增至 **9/9**，覆盖适性门禁、战法气力消费和状态效果；
  `verify-battle-rng` **5/5**、`verify-save-battle` **26/26**、server typecheck 全绿。
- **诚实边界**：本轮未实现敌军主动单挑、阵型切换、协同包围、撤退和全局 P5-01 AI。
- **Next**：继续 S10 主动单挑深化，或由用户改拍 FM-P4 存档/读档验收；不启动 0-B。

## 2026-08-03 — Session 303（FM-P4 浏览器变阵→攻击→战报链收口）

> **范围**：补齐 FM-P4 的浏览器实际操作验收，不扩数据规模、不新增规则或客户端计算。

- `scripts/verify-fm4-report-ui.mjs` 通过 CDP 真实鼠标事件完成进入六角战场、选择我军、变阵、结束行动、移动与攻击；按当前可用阵型验证战报同时出现变阵 TP/阵型解释与攻击阵型贡献。
- `BattleView` 补充 `btn-select-attacker`、`btn-finish-player` 验收定位标识；仅测试挂点，无行为变化。
- 验证：浏览器链通过，Chrome 1440×900、console errors=0；`verify-fm4-hex-formation` **11/11**；shared **377** / client **43**；typecheck、test、build 全绿。
- **Next**：FM-P4 浏览器内容链已收口；下一项由用户拍板进入 S10 主动战法/主动单挑深化，或继续 FM-P4 存档/读档验收。

## 2026-08-03 — Session 302（FM-P4 六角战报解释 UI）

> **范围**：完成六角战中变阵后的战报解释 UI，不扩数据规模、不新增规则或客户端计算。

- `BattleLogEntry.explanation?`：旧日志兼容的可选结构化字段；变阵写入 TP 前后值与阵型前后值，攻击写入攻守
  阵型及六角 `baseAttack/baseDefense` 阵型贡献。
- `BattleReport`：展示最近六条战报、变阵 TP/阵型变化、攻击阵型贡献；服务端合法性错误展示为阻断原因。
- 验证：typecheck、lint、build、shared 377/client 43、`verify-fm4-hex-formation` **11/11**；Chrome
  1440×900 实测进入六角战场后战报面板出现，`consoleErrors=0`。
- **诚实边界**：本轮未新增浏览器攻击/变阵动作链；已有 UI 专项因 headless 指针事件未命中路径摘要而未作为本轮通过依据。
- **Next**：FM-P4 补完整浏览器变阵→攻击→战报内容链，或由用户拍板进入下一项 S10 战斗深化。

## 状态标识

- `[ ]` To Do — 未开始
- `[~]` WIP — 进行中
- `[x]` Done — 已完成
- `[!]` Blocked — 被阻塞

## 2026-08-03 — Session 301（FM-P4 六角战中变阵状态机）

> **范围**：实现六角战中变阵最小闭环；每回合每方至多一次、消耗 1 TP、仅玩家阶段主将未行动时可用，变阵后结束主将行动，不调用白刃回合。

- **状态**：`BattleState` 新增可选 `tacticalPoints/tacticalPointsUsed`（旧档缺省兼容）；新回合补充 5 TP，智力 ≥80 额外 +1，上限 10；变阵动作写入 `actionHistory`。
- **引擎**：新增 `changeBattleFormation`；复用 `getAvailableFormations` 检查精通、兵种、被围与当前阶段；成功后同步攻方存活 `BattleUnit.formation`，主将 `hasActed=true`。
- **API/UI**：新增 `POST /api/game/battle/formation`；六角战斗底部新增变阵入口和六基础阵型选择器，客户端只作入口/状态展示，服务端权威拒绝非法请求。
- **结算**：退出六角战时将实际攻方阵型写回 `MeleeState.attackerFormation`，保持战报和一次性结算一致。
- **验证**：`verify-fm4-hex-formation` **9/9**；typecheck、共享/客户端单测与构建已通过。

## 2026-08-03 — Session 300（版权、Git 历史与 Agent 留存合规清理）

> **范围**：按版权风险复查结论执行清理；不改变游戏规则和功能。疑似带外部品牌标识的早期演示截图已移出仓库并隔离，公开代码/文档改为中性表达，Git 历史与提交说明完成清洗。

- 资产：`docs/screenshots` 从 126 张收敛为 125 张；`CREDITS.md`、`ASSET_MANIFEST.md`、`scripts/verify-compliance.mjs` 数量同步。
- 文本：生产注释与公开进度记录不再保留商业作品名称或品牌暗示。
- 门禁：补齐 4 个缺失 SPDX 标识；删除仓库内空的 Agent 状态目录；发行包继续禁止 Agent 会话、快照、数据库、WAL、认证文件。
- 历史：重写本地所有分支和远程跟踪引用中的商业名称、提交说明和疑似截图；清理备份引用/不可达对象后再复扫。
- **验证状态**：本 Session 收尾前必须通过 `pnpm verify-compliance`、全历史品牌扫描、`git fsck` 与回归测试；远端 `main` 需用户确认后强制更新。

## 2026-08-02 — Session 297（S10-FM：FM-P3 六角部署注入与多 unit 终局）

> **范围**：启动用户批准的六角部署注入；完成 `CampaignArmy.squads` → 多 `BattleUnit` 初始投影，
> 不接入六角战中变阵状态机。
> **诚实标注**：BattleState 仍无组织度字段；六角变阵 TP/阶段门禁、战报解释 UI 留后续评审/FM-P4。

- **共享部署投影**：`shared/formation-core.ts` 新增 `projectHexDeployment`，读取阵型 `deployment.slots`，
  以中军锚点投影到 20×15 六角场；攻方保持模板方向、守方轴向镜像；缺失阵位不生成虚构 unit；越界/碰撞
  按固定邻接顺序确定性收缩，并输出初始 facing。
- **创建链**：`createBattle` 新增可选 `attackerArmy/defenderArmy`；有 Army 时按 `CampaignArmy.squads`
  生成多个 `BattleUnit`，主将固定 center；旧无 Army 调用继续生成原双 unit。tactical melee 入口传入攻守 Army。
- **多 unit 运行时**：客户端既有 `units[]` 选择/移动兼容；simple AI 逐 unit 行动；普攻、战法、火计、
  灼烧与 AI 终局改按整方是否仍有存活 unit，击破单个 Squad 不提前结束整场。
- **验证**：`verify-fm3-hex-deployment` **13/13**；`verify-battle-commanders` 覆盖 **111** 场景；
  shared **377** + client **42**；三端 typecheck、validate-data、client build 全绿。
- **文档**：同步 `05`、`09`、`12`、`27`、`29`、本文件与根 `HANDOFF.md`。
- **Next**：六角战中变阵状态机评审（TP/阶段/每回合一次门禁），或进入 FM-P4 战报解释 UI。

## 2026-08-02 — Session 296（S10-FM：FM-P3 标准模式战术协同矩阵）

> **范围**：标准模式战术协同矩阵（TacticalConfig v2 单一真源 + `MeleeState.tactic?` 持久士气姿态）。
> 用户拍板：持久 tactic 字段 + UI 选择。
> **诚实标注**：synergy 冲突 0.9 因 0-A 无战术×阵型反向关系表不产生触发源（计划 §4.6 不扩 6×6 矩阵），
> 常量保留供 0-B 反向关系扩展；战报解释 UI 仍留 FM-P4。

- **shared**：`ACTIVE_TACTIC_IDS`（assault/hold/ambush）+ `resolveTacticSynergy(config, tactic, enemyFormationId)`
  （敌阵 ∈ `strongAgainstFormationIds` → ×1.1，否则 ×1.0；null/未设置中性）+ `tacticModifiers`（T_base 攻/防/先手，
  不受组织度缩放）+ synergy 常量（1.1/1.0/**0.9 保留不触发**）；`MeleeState.tactic?: TacticalTacticId | null`
  （old档兼容）+ Zod `tactic` 可选；shared 单测 **+2 → 376 项**。
- **引擎**：`runMeleeRound` 消费 `state.tactic` —— 先手加 `initiative`、攻方伤害 `(F_effective + T_base) × synergy`
  （计划 §5.2）、我方减伤加战术防修正；战报 events 记「战术·强攻」等；`setMeleeTacticalConfig` 注入（null 中性）。
- **持久/UI**：`POST /melee/tactic` 路由 + `meleeSetTactic`（运行时校验非法值）+ client api/store `meleeSetTactic`；
  StandardModePanel 新增「战术姿态」选择（强攻/固守/奇袭/无，不耗 TP，展示文案与 v2 语义对应、数值不重复）。
- **data**：`loader.loadTacticalSystemV2()`（从 shared/data v2 json 读取 + Zod 解析）；`index.ts` 启动注入。
- **验证**：`verify-fm3-tactic.ts` **9 断言**（T_base 攻+0.25 生效/未注入中性/先手受 initiative 影响/持久写入
  + 事件记录/清除/null/非法拒绝/schema 往返含旧档）；tsc/lint 三端、shared 376 + client 42 单测、validate-data、
  client build 全绿；回归 verify-melee-modes 12、verify-fm3-melee-inject/auto-formation/auto-battle/idempotency/
  crit-inject/hex-formation、verify-campaign 71 全绿。
- 文档：`29` 状态/§7.4 表、`27` §6.3、`12` S10、`09` FM 表 + Session 段、`10-progress`、`HANDOFF` 双写。

## 2026-08-02 — Session 295（S10-FM：FM-P3 六角战斗阵型贡献，三模式点值同源闭环）

> **范围**：六角 `battle.ts` 阵型贡献（唯一量纲 = `tiers[0]` 点值，模式专用投影）。
> **诚实标注**：六角部署注入（多 unit / 初始部署 / 朝向邻接派生 / 六角变阵状态机评审）仍后置；
> 六角组织度执行档因 BattleState/BattleUnit 暂无组织度字段，随部署注入一并接入。

- **`server/src/battle/hex-formation.ts`**（新模块，避免 battle.ts↔simpleAi 循环依赖）：`setHexFormationCatalog`
  服务端注入（`index.ts`）+ 中性回退；`HEX_FORM_ATK_GAIN=2` / `HEX_FORM_DEF_GAIN=2.5`；
  `hexFormationMods(formation)` = `tiers[0]` 攻/防点值 × 增益（组织度 60 → orderly ×1.0 中性，负原值保留），导出供复算/验证。
- **接入**：`DamageInput` 加可选 `formationAtk/formationDef`；`calcDamage` 中攻点值进 `baseAttack`、
  防点值进 `baseDefense`；三处消费同源——普攻 `attackUnit`（battle.ts）、战法 `castAbility`（battle.ts）、
  AI 评估 `runSimpleEnemyAi`（simpleAi.ts）。crit 反击/连击基于 `baseDamage` 自动继承阵型贡献，无需改动。
- **回归**：verify-fm3-hex-formation **11 断言**（中性/系数锚定/逐阵投影/calcDamage 方向性/端到端注入生效/
  固定 rng 复现）；`tsc`/`lint` 三端、`pnpm test` shared 374 + client 42、validate-data、client build 全绿；
  verify-campaign 71、verify-melee-modes 12、verify-fm3-auto-formation/auto-battle/melee-inject/idempotency/
  crit-inject、verify-battle-rng 5、verify-tactical-ai 6、verify-items 32、verify-save-battle 26 全绿。
- 文档：`29` 状态/§7.4 表、`12` S10、`09` FM 表 + Session 段、`27` §6.2、`10-progress`、`HANDOFF` 双写。

## 2026-08-02 — Session 294（README 游戏化重构：双语 + 精简工程细节）

> **范围**：纯文档维护（README.md 整文件重写），零代码/数据/规则改动。用户拍板三项：
> ①重要部分中英双语（英文为主、先 EN 后 ZH）；②精简工程细节；③英文主名 + 中文副名 + 游戏语气。

- **新结构**（游戏项目自述，非工程框架自述）：
  1. **Header**：`Late Eastern Han Dynasty · 晚东汉末 · 三国争霸` + 双语导语（可玩回合制大战略 / 非商业 / 不复刻商业游戏）
  2. **The Game · 这是怎样一款游戏**（双语）：五步核心循环（经营→求贤→出征→交战→崛起）+ 27 大系统高光 + 0-A/0-B 规模数字 + **Honest scope 诚实边界**（SQLite/全剧本/私兵/屯田/阵型成长/单挑大会/0-B 未实装）
  3. **Who it's for · 核心玩家**（双语）：单人回合制/战棋玩家、历史策略模拟爱好者；单机 vs AI、浏览器本地
  4. **Architecture · 技术架构方案**（双语）：shared（Zod+PRNG）/ server（权威引擎）/ client（React+Konva 瘦客户端）；确定性续玩、迷雾服务端裁剪、Zod 先行；一行式架构图
  5. **Copyright & assets · 版权与素材**（双语）：独立原创；公有领域史书；金石水墨·拓片简册·印信官职；字体 SIL OFL 本地打包；clean-room + 台账/审计门禁；源码 MIT、素材单独许可
  6. **Getting started**（Quick Start + 截图保留、图注双语）
  7. **Roadmap · 发展路线**（双语简要）
  8. **Contributing / Maintainer documentation**（精简导航 5 行 + 一句 sanity checks 指引 CONTRIBUTING）
- **移除/压缩**：原 40+ 行验证命令清单与长 CI 断言段 → 一句 sanity checks + 指引；冗长 Maintainer 列表精简。
- **验证**：`git diff --check` 通过；python 提取全部相对链接逐一核对存在（无死链，含两张截图与 fonts README）。
- 文档：仅 `README.md` 本体；`10-progress`、`HANDOFF` 双写（本记录）。

## 2026-08-02 — Session 293（README 进度同步 + 断言数字实测校准）

> **范围**：纯文档维护（README.md），零代码/数据/规则改动。按当前进度（Session 292 收口）同步自述，
> 并对 README 中过时的测试/断言数字做**实测校准**（全部跑一遍服务端 verify 脚本取真实结果，非沿用旧数）。

- **Current status and honest scope 重写**：30 城基线（9 兵种/7 阵型/223 将/20 宝/10 女/5 子/30 技/2 剧本/24 事件）、
  27 大系统成熟度地图引用、三层战斗 + 战役 Army 五部阵位 + 功绩等级（获取点/数值消费）+ 宝物 0-A 闭环 +
  关系网/技能树 + 霸府称王爵位 + 六郡域战场模板（98 县/151 路/55 地标，迷雾/补给线/AI 增援）+ 确定性续玩 +
  派系政治 + 阵型整合 FM-P1~P3（六角部署后置）；limitations 同步（SQLite 存档/0-B/完整剧本/私兵/军屯/阵型成长/单挑大会未实装）。
- **断言数字实测校准**：verify-campaign 71（原 62）、save-battle 26、save-migration 23（原 19）、
  civil-rng 9（原 12）、plot-spy 34（原 30）、negotiation-r2 40（原 20）、family 35（原 32）、
  ai-military 38（原 7）、save-battlefield-instance 101（原 49）、shared 374 + client 42（原 198/31）；
  新增 AI decision replay（faction-sort 10 / decisionRng 6+6 / replay 4×4）与 formation-support /
  faction-politics(94) / treasure(32) / Hegemony-Court 校验说明。
- **Validation 命令清单**补充：verify-s27 / verify-items / verify-merit* / verify-hc-p0|p1 /
  verify-bf-p3-dynamic|p4-duel / verify-melee-modes / verify-tactical-ai / verify-r8-growth-balance。
- **Development roadmap 更新**：R1~R8 收口、HC 进展、FM 剩余（六角部署/协同矩阵/FM-P4）、0-B 前置项。
- 验证：`git diff --check` 通过；README 无 markdown lint 门禁；数字均来自实测运行输出。
- 文档：仅 `README.md` 本体；`10-progress`、`HANDOFF` 双写（本记录本身）。

## 2026-08-02 — Session 292（S10-FM：FM-P3 自动战斗阵型贡献）

> **范围**：`runAutoBattle` 自动战斗阵型贡献（唯一量纲 = `tiers[0]` 点值 + 五部侧击）。
> **诚实标注**：六角 `battle.ts` 阵型贡献/部署注入仍后置（需多 unit 支持 + 六角变阵状态机评审 +
> 客户端/AI 多 unit 适配，属独立大重构）；战术协同矩阵运行时与战报解释 UI 仍留 FM-P4。

- **`autoFormationMods(formationId, org, squads)`**：攻/防点值（×0.1 等价性换算，与标准模式同源）合并为
  加性战力修正，正面增量按组织度执行档缩放（`resolveFormationContribution` 五档）、负修正原值保留；
  `squadFlankBonus` 五部侧击 +10%（05 §13.3，己方有左/右翼 Squad 触发，0-A 简化不判敌展开结构）；
  `mobility/range` 点值不参与自动战力（自动无走向/射程概念）。
- **接入点**：`campaign.ts` `ArmyPowerInput.formationMod?`（缺省 0 中性）→ `computePower`
  `commandMod = mainMod + subMod + advisorMod + formationMod`（原恒 0 注释删除）；`runAutoBattle`
  4 处 computePower 注入 `formationMod`（攻方按当回合 `atkOrg` 每回合求值；守方有 Army 同理，
  守城无 Army 时为 0——城墙惩罚/wallPenalty 已表达守势，不虚拟守方阵型）。
- **单一内容源**：`setAutoFormationCatalog(staticData.formations)` 服务端启动注入；null 回退中性（0，
  不携带第二套数值表）。`autoFormationMods`/`squadFlankBonus` 导出供战报复算/验证。
- **组织度执行档与全局 `orgCoeff` 分项解释**（计划 §4.4）：formationMod 是加性项，不重复乘 orgCoeff。
- **验证**：`verify-fm3-auto-formation.ts` **13 断言**（未注入中性/方·圆·锥·锋点值战力修正、
  组织度严整·崩散、圆阵崩散负原值保留、五部侧击差值、squadFlankBonus 0/0.1、端到端注入生效、
  固定 rng 可复现）；`pnpm typecheck`/`lint` 三端全绿；回归 verify-campaign 71/71、
  verify-fm3-auto-battle 4、verify-fm3-idempotency 5、verify-fm3-melee-inject、
  verify-fm3-crit-inject、verify-melee-modes 12/12、verify-ai-military-rng 38/38 全绿。
- 文档：`05` §17.2、`29` 状态/§7.4 表、`09` FM 表 + Session 段、`12` S10、`10-progress`、`HANDOFF` 双写。

## 2026-08-02 — Session 291（S10-FM：FM-P3a 标准模式点值迁移）

> **范围**：标准模式 `runMeleeRound` 唯一量纲收敛到 N1 已审的 `tiers[0]` 点值（用户拍板「等价性换算」），
> `meleePercent` 过渡字段退役。**诚实标注**：点值与旧百分比分布不同，不逐点相等；自动/六角点值迁移、
> 六角 `battle.ts` 部署注入与战术协同矩阵运行时仍后置。

- **点值消费（等价性单点换算）**：`runMeleeRound` 经 `standardMeleeMods` 消费 `tiers[0]` 点值——
  `MELEE_ATK_GAIN=0.1`（1 点攻≈+10% 伤害系数）、`MELEE_DEF_GAIN=0.1`（1 点防≈-10% 承受伤害）、
  `MELEE_MOB_GAIN=0.5` + `MELEE_MOB_BASE=1.0`（先手）；模块常量导出，`standardMeleeMods` 导出供战报复算。
- **组织度执行档接入（FM-P3a 计划 §4.4）**：`MeleeState.attackerOrganization/defenderOrganization?`
  （optional 旧档兼容，Zod 同步）；`meleeStart` 从 Army 快照组织度；`resolveFormationContribution`
  五档执行只缩放正面增量、负修正原值保留；缺省按 orderly ×1.0 中性解析（旧档/未携带不改变行为）。
- **`meleePercent` 过渡字段退役（单一内容源收口）**：`Formation` 类型/Zod/`formations.json`/
  `generate-0a-data` 全部移除；不再存在第二套阵型数值表（计划 §7.3 / N1 唯一量纲）。
- **StandardModePanel** 阵型说明同步新点值换算数值（按 orderly 基准，注释标注动态化留 FM-P4）；
  六角 `battle.ts` 中 WEDGE/SQUARE 硬编码与 `runAutoBattle` formationMod=0 未动（FM-P3 剩余）。
- **验证**：`verify-fm3-melee-inject.ts` 重写为点值语义 **16 断言**（系数锚定/单一内容源/组织度
  严整·松散·崩散仅缩放正面/负修正原值保留/攻守角色/先手排序/旧档缺省中性/点值路径可运行 + 逐阵
  迁移对比表）；`pnpm typecheck`/`lint` 三端全绿；`pnpm validate-data`（formations 7 ✓）；
  `pnpm test` shared 374 + client 42；回归 verify-melee-modes 12/12、verify-fm3-crit-inject、
  verify-fm3-idempotency 5、verify-fm3-auto-battle 4、verify-crit、verify-campaign 71/71、
  verify-duel、verify-tactical-ai 6、verify-save-battle 26、client build 全绿。
- 文档：`03` §9、`08` 字段/运行量纲说明、`29` 状态/§2.2 表/§5.1/§7.4 表、`27` §6.2、`05` §20.3.2、
  `09` FM 表 + Session 段、`12` S10、`formation-catalog-migration` §六门禁 + §4.2 Session 291 对比表、
  `10-progress`、`HANDOFF` 双写。

## 2026-08-02 — Session 288（FM-P0 评审材料补全：N1 数值映射 + D 五部部署草稿）

> 延续 Session 287 的 FM-P0 评审阶段，**零生产数据写入**；仅补全 Gate N1 / D 两项评审材料，
> M/N1/D 仍待用户审核，通过前不得进入 FM-P1 Schema/数据迁移。

- **N1 逐阵 Lv1 唯一量纲映射表**（`docs/formation-catalog-migration.md` §4 展开）：
  - 核实并登记量纲漂移：`formations.json` 当前 `[0,2,4,6,7,8,16]` 缺**圆阵(1)/雁行(3)**，
    且与 `05 §4.5.1` 存在 atk/def/range 漂移（锥形 def 0 vs -2、鹤翼 atk/range、锋矢 atk 3 vs 1、
    长蛇 atk/def、偃月 mobility）
  - 唯一运行量纲 = `formations.json` Lv1 `modifiers`（固定 Lv1）+ `05 §4.7` 暴击/反击/连击贡献；
    `27 §6.2`/`meleeRound.ts` 百分比仅作回归基线登记，不叠加
  - 逐阵 7 行映射表（0/1/2/3/4/6/16）：目标 atk/def/mob/rng + 暴击/反击/反击系数/连击率 +
    换算理由（查表）+ 影响引擎（三模式+crit.ts）+ 迁移前后回归样例 + 审批列（待审）
  - 契约：负修正原值保留、组织度五档只缩放正面增量、`resolvedDelta=(F_effective+T_base)×synergy`
- **D 六阵五部部署草稿**（§5 展开）：
  - 坐标约定：六角轴向 `(q,r)`，中军原点 `(0,0)`，缺部按 fallbackOrder 收缩不生成虚构部队
  - 六阵 `slots` 偏移 + `fallbackOrder` + `symmetry`（全 symmetric）+ 空间表达：
    方阵紧凑对称 / 圆阵环护中军 / 锥形先锋前突两翼斜后 / 雁行两翼拉开射击纵深 /
    鹤翼两翼前伸中军后置 / 锋矢矢尖中央强突
  - 约束：自动取五部侧击 +10%（§13.3），六角只取剑/矛/斧实际朝向（+12/+8/+18%）二者互斥；
    夹击/包抄由左右翼+邻接+朝向派生，不新增「合围」命令
  - 五部预览 UI 原则：六卡全显、非法项禁用显原因、形状+文字+阵位标签三通道
- 门禁：A ✅ / I ✅ / **M/N1/D ⏳ 待审** / R ⏳ 待审
- 验证：CSV 146 行脚本校验通过（旧精通与实际 officers.json 一致、新精通 ⊆ `[0,1,2,3,4,6]`、
  无 7/8/16 残留、无空精通）；本 Session 零生产代码/数据改动，无需 typecheck/test
- 文档：`docs/formation-catalog-migration.md` §四/§五 展开 + 门禁状态表；`10-progress`、`HANDOFF` 双写

## 2026-08-02 — Session 290（S10-FM：FM-P3 crit + meleeRound 注入 + 变阵幂等 + 自动入口恢复）

> **范围**：FM-P3 三模式同源消费中的 **crit.ts + meleeRound 注入**（用户拍板：百分比表外移到 JSON，不改行为）
> + **白刃战动作级幂等** + **自动入口恢复 `runAutoBattle`**。
> **诚实标注**：标准/自动/六角 **点值量纲迁移**、六角 `battle.ts` 部署注入**未做**，留 FM-P3 剩余。

- **crit.ts 单一内容源注入（行为等价）**：
  - `server/src/battle/crit.ts`：`setFormationCatalog(catalog|null)` + `catalogFormationMods` +
    `formationModsResolved`（未注入回退旧 §4.2 硬编码表）；`computeCritRate`/`computeCounterRate`/
    `computeCounterCoeff`/`computeChainRate` 4 处改用 `formationModsResolved`；暴击链数值结构化入库 `effects`（FM-P2）
- **meleeRound 百分比表外移（行为不变）**：
  - `Formation` 类型 + Zod 新增可选 `meleePercent { atk, def, mobility }`（03 §9 同步）
  - `formations.json` 六基础补 `meleePercent`（方阵 0.0/0.30/0.8、圆阵 -0.1/0.20/0.7、锥形 0.25/-0.10/1.3、
    雁行 0.15/-0.05/1.1、鹤翼 0.10/0.15/0.9、锋矢 0.20/-0.15/1.2）；冲阵无（不入标准候选）
  - `meleeRound.ts`：`setMeleeFormationCatalog(catalog|null)` + `meleeMods`（未注入回退旧 `FORMATION_MODS`）；
    `runMeleeRound` 2 处 `FORMATION_MODS[...]` → `meleeMods(...)`，伤害/先手判定不变
  - `server/src/index.ts` 启动注入两处；`generate-0a-data.ts` formations 块同步 `meleePercent`
- **等价性验证**：`verify-fm3-crit-inject.ts` 5 断言（7 阵 crit/counter/coeff/chain 注入 vs 硬编码浮点等价）+ `verify-fm3-melee-inject.ts` 4 断言（6 对阵伤害/先手注入 vs 硬编码一致；6 基础有 meleePercent；冲阵无）
- **白刃战动作级幂等（FM-P3 §7.5）**：
  - `MeleeState.commandCache?`（Record<string,{round,result}>）+ schema/类型；`createMeleeState` 默认 `{}`
  - `meleeRound` service 增参 `commandId/expectedRound`：同 ID 同轮重试返回首次结果（不二次扣 TP/推进）；
    同 ID 不同轮（过期 expectedRound）拒绝；不同 ID 各自正常执行
  - route `/melee/round` 解析 commandId/expectedRound；client api + store 自动生成 commandId（含当前回合）
  - `verify-fm3-idempotency.ts` 5 断言（同 ID 同轮重试幂等、不二次扣 TP/推进、过期拒绝、不同 ID 正常推进）
- **自动入口恢复 `runAutoBattle`（§2.2/§7.4 清债）**：
  - 局部自动结算由 `runMeleeRound` 逐回合循环改为调用既有 `runAutoBattle`（攻守 Army → 结果桥接回 melee 状态 → `applyMeleeSettlement` 一次回写）
  - `verify-fm3-auto-battle.ts` 4 断言（phase 终局 + 单次回写 + 走 runAutoBattle 语义）
- **验证**：`pnpm typecheck`/`pnpm lint` 三端全绿；`pnpm validate-data`；`pnpm test` shared 374 + client 42；
  回归 verify-crit / verify-melee-modes 12/12 / verify-campaign 71/71 / verify-duel / verify-merit-consume 17 /
  verify-tactical-ai 6 / verify-fm3-* / client build
- 文档：`03` §9（meleePercent）、`29` 状态、`09` FM 表 + Session 段、`12` S10、`10-progress`、`HANDOFF` 双写
- **边界（诚实标注）**：meleeRound 百分比（0.30）与 tiers 点值（方阵 def=1）量纲不同，**点值迁移未做**
  （需单独平衡决策）；六角 `battle.ts` 部署注入未做。

## 2026-08-02 — Session 289（S10-FM：FM-P2 共享阵型解析器实装）

> **范围**：FM-P2 共享合法性 / 阵型贡献 / 五部部署 / 解释纯函数（计划 §7.2 §4.3 §4.4 §7.3）。
> **零 RNG / 零状态变更**；运行时硬编码（`meleeRound`/`battle`/`runAutoBattle`/`crit`）注入留 FM-P3。

- **`shared/formation-core.ts` 共享解析器内核**：
  - `organizationBandFor` + `ORGANIZATION_BANDS`（组织度五档：80/60/40/20 边界，§4.4）
  - `getAvailableFormations(ctx)`：返回 0-A 候选集 `[0,1,2,3,4,6]`，逐阵 `available` + 稳定 `blockReason`
    （`not_mastered`/`restricted_unit`/`unit_not_allowed`/`surrounded`/`already_changed`/`unknown`）
  - `resolveFormationContribution(catalog, id, org)`：读 `tiers[0]`（0-A Lv1 攻防机射）+ `effects`
    暴击链（`crit_rate`/`counter_rate`/`counter_coeff`/`chain_rate`）+ 组织度执行档
  - `applyOrganizationExecution`：负修正原值保留，正修正按档缩放（§5.2 F_effective）
  - `resolveFormationDeployment`：由 `deployment` 模板 + 实际阵位派生（主将恒中军、缺部收缩，Gate D）
  - `explainFormationResolution`：逐项 `FormationBreakdown`（base/organization/…），供战报复算
  - `ZERO_A_PLAYABLE_FORMATION_IDS` 复用（不含冲阵 16）
- **暴击链结构化入库（§7.3 单一内容源）**：`formations.json` 六基础 + 冲阵补 `effects`（05 §4.7）——
  圆阵 `counter_rate +10`/`counter_coeff +0.1`、锥形 `chain_rate +5`、鹤翼 `crit_rate +20 (flank_only)`、
  锋矢 `crit_rate +5`/`chain_rate +3`、冲阵 `crit_rate +10`/`chain_rate +5`；`generate-0a-data.ts` 同步
- **测试**：`shared/formation-core.test.ts` 7 项（组织度边界、精通/兵种限制、不含 16、贡献读 tiers+effects、
  组织度只缩放正增量、部署收缩、解释）
- **验证**：`pnpm validate-data`、三端 `typecheck`/`lint` 全绿；`pnpm test` shared 374（+7）+ client 42；
  回归 `verify-melee-modes` 12/12、`verify-campaign` 71/71、`verify-crit` 全过
- 文档：`29` 状态、`09` FM 表 + Session 段、`12` S10、`10-progress`、`HANDOFF` 双写
- **边界（诚实标注）**：FM-P2 仅产出共享纯函数与数据真源，未接入任何引擎；三模式消费、AI、UI、
  存档迁移属 FM-P3~P5

## 2026-08-02 — Session 288（S10-FM：Gate M/N1/D 批准 + FM-P1 Schema/数据迁移实装）

> **门禁**：FM-P0 评审材料（目录迁移 + 146 将 CSV + N1 数值映射表 + D 五部部署草稿）经用户批准；
> 进入 FM-P1 生产变更。**运行时硬编码退役归 FM-P2/P3 共享解析器注入，N1 契约明确"通过前不替换"。**

- **Schema/Type（Zod 先行）**：
  - `shared/types/formation.ts`：由 legacy `FormationTemplate/modifiers` 迁移到长期目标 `Formation`
    （`family`/`tiers`/`ultimate`/`prerequisites?`/`specialUnlock?`/`deployment?`）+ `FormationLevelData`/
    `FormationUltimate`/`FormationPrerequisite`/`FormationDeployment`/`HexOffset` + `ZERO_A_PLAYABLE_FORMATION_IDS`
  - `shared/validators/index.ts`：`FormationTemplateSchema` → `FormationSchema`（含部署 schema）
  - `server/src/data/loader.ts`：`FormationTemplate` → `Formation` 类型
- **TacticalConfig v2**：`shared/data/tactical-system.v2.json` 新建（数字 ID 关系，不复制阵型属性）；
  `shared/tactical-system.ts` 新增 `TacticalConfigV2Schema`/`parseTacticalConfigV2`/`migrateTacticalV1ToV2`
  （强攻→`[0,1,3]` 方/圆/雁、固守→`[6]` 锋矢、奇袭→`[4]` 鹤翼，长蛇关系后置）；v1 文件只读保留
- **formations.json**：收敛 7 阵目标目录 `[0,1,2,3,4,6,16]`；**新增圆阵(1)/雁行(3)**（数值按
  `05 §4.5.1` Lv1 校勘）；7 偃月/8 长蛇移出可选集（稳定 ID 保留不复用不改号）；六基础 + 冲阵均填
  `family/tiers/ultimate/deployment`（五部部署草稿 Gate D）
- **officers.json**：146 将 `formationMastery` 按已审 CSV 逐人迁移（旧精通与实际一致、新精通 ⊆
  `[0,1,2,3,4,6]`、无 7/8 残留）；冲阵 16 精通保留（吕布/夏侯渊/马超/马腾/曹彰/庞德/文鸯/曹纯/马岱/
  张绣 10 名骑兵将，不入三模式候选）
- **validate-data**：新增 formations 目录 + officer `formationMastery` 跨引用校验（7/8 禁止残留、
  ID 必须存在）；`generate-0a-data.ts` formations 块同步新结构
- **验证**：`pnpm validate-data`（formations 7 ✓、officers 223 ✓、跨引用 ✓）；`pnpm typecheck` /
  `pnpm lint` 三端全绿；`pnpm test` shared 367 + client 42 全过（含 v2 解析 + v1→v2 迁移 4 新断言）；
  `pnpm --filter @leh/client build` 通过；回归 `verify-melee-modes` 12/12、`verify-campaign` 71/71、
  `verify-crit`、`verify-duel` 全绿
- 文档：`08` §二、`03` §9、`27` §6.2/§6.3、`05` §4、`09` FM 表 + P3-05 + Session 279 段、
  `12` S10、`10-progress`、`HANDOFF` 双写

## 2026-08-02 — Session 287（S27 深化：fame 叙事化标签实装）

- **fame 叙事化标签**（纯展示，不改变声望数值/获取/衰减规则）：
  - `shared/city-factions.ts` 新增 `fameLabel` 纯函数：5 档文言标签，档位边界与投奔阈值对齐
    ≥900 威震天下 / ≥600 名扬海内 / ≥300 声名鹊起 / ≥100 崭露头角 / <100 名不见经传
  - `server/src/services/game.ts` `getFactionOverview` 返回新增 `fameLabel`
  - 客户端 `api.FactionOverview` 类型补 `fameLabel`；`FactionOverviewDrawer` 声望区展示标签
  - 测试：`shared/city-factions.test.ts` 新增 `fameLabel` 单测（363→364 项全过）
- 文档：`34-faction-politics-design.md` §5.1、`08-data-dictionary.md` §四、`12-system-map.md` S27
  深化备注、`10-progress.md`、`HANDOFF.md` 双写
- 验证：shared build + 364/364 单测、server/client typecheck 全绿
- 未改设计边界：标签为纯展示，无叙事层/事件对话联动；fame 仍无独立 UI 进度条以外的叙事

## 2026-08-02 — Session 287（FM-P0 阵型目录迁移评审材料，零生产数据写入）

> 用户下达启动 S10-FM 阵型整合（Gate A 原设定优先 + Gate I 启动实施，均通过）。
> 按 `29-formation-integration-development-plan.md`，本阶段**仅产出 FM-P0 评审材料**，
> 不修改任何代码 / Schema / API / RNG / 静态 JSON / 存档；M/N1/D 审核通过前不得写数据。

- **目录迁移材料** `docs/formation-catalog-migration.md`：
  - 登记当前实际目录 `[0,2,4,6,7,8,16]`（缺圆阵 1、雁行 3）→ 目标 0-A `[0,1,2,3,4,6,16]`；
    冲阵 16 只读兼容不入候选；7 偃月/8 长蛇保留记录但移出可选集，稳定 ID 不复用不改号
  - 稳定 ID 与存档版本策略、逐将迁移规则、数值门禁 N1 契约、五部部署 Gate D 契约、门禁状态表
- **逐将精通迁移表** `docs/officer-formation-mastery-migration.csv`（146 将，Gate M 评审材料）：
  - 用户确认**按兵种适性规则化映射**（7 偃月→1 圆阵；8 长蛇→6 锋矢[骑兵] 或 2 锥形[步兵]，
    远程预留→3 雁行，当前 0 例）
  - 逐行含 武将ID/姓名/旧精通/新精通/变更理由/校勘人(待审)/审核状态(待审核)
  - 校验：146 将迁移后 `formationMastery ⊆ [0,1,2,3,4,6]`、无空精通、无机械 7/8 替换
- **门禁**：A ✅ / I ✅ / M ⏳ 待审 / N1 ⏳ 待审 / D ⏳ 待审 / R ⏳ 待审

## 2026-08-02 — Session 285（S27 城级派系与门阀系统实装）

- **S27 城级派系与门阀**（注册 26→27 大系统，设计 `docs/34-faction-politics-design.md` 新建）：
  - `shared/city-factions.ts`：`CITY_FACTION_KINDS` 元组（8 类）、`CityFactionEntry`、
    试点 6 城（洛阳/长安/阳翟/汝南/邺/陈留）确定性派生、名门特例（颍川荀氏·陈氏/汝南袁氏）、
    满意度回归、效果纯函数（商贾商业±15%/流民兵源+20%/民兵/世家守军−15%/兵装战力±/fame 投奔三档）
  - `shared/city-factions.test.ts`：37 项单测（派生/特例/效果/回归）
  - 类型与 Zod：`City.cityFactions?`/`factionPatrolStamp?`、`Faction.arms?`/`fame?`（均 optional 旧档兼容），
    `CityFactionEntrySchema`（kind=z.enum(CITY_FACTION_KINDS)），shared/tsconfig.json 注册
  - `server/src/engine/factionPolitics.ts`：开垦（50金/智≥60/流民+8~15·世家−10~20·farm+20~40，3 次 RNG）、
    巡查（30金/武≥60/商贾+5~10·小势力−8~15·当月免叛乱，1+小势力数 次 RNG）、兵装采购（10金/件）、
    `tickFactionPolitics` 月度结算（补种/回归/兵装月产/10% 叛乱/每季 fame−2）、`grantFame`（0~1000 夹紧）
  - 引擎接入：turn.ts 产金×商贾修正 + 月度 tick；civil.ts 施米 fame+2/征兵兵源与兵装/训练−5兵装/开发完成联动；
    family.ts 投奔×fame 三档；campaign/march 破城+20/占城+10/灭国+50 + 民兵 + 世家暗通 −15% + 兵装战力；
    diplomacy 结盟+10；battle 民兵/暗通/兵装初始值
  - API：`POST /civil/reclaim`、`POST /civil/patrol`、`POST /faction/buy-arms`；
    `GET /faction/overview` 新增 fame/arms；gameService 三个 do* 命令（withLock+runtimeRandom）
  - 客户端：CivilOverviewDrawer「乡政」分面（派系满意度列表 <30红/≥70绿 + 开垦/巡查 + 武将下拉）；
    FactionOverviewDrawer「声望与兵装（S27）」区（fame 分档配色 + 采购按钮 ×10=100金）
  - 创建即派生：buildGameState 直接补种 cityFactions（客户端新局立即可见）
  - 验证：`pnpm verify-s27` 66 断言全过；shared 348 + client 42 单测全绿；validate-data 过；
    全部既有 verify-* 复跑全绿；server/client typecheck+lint 干净
- 文档：`08-data-dictionary.md` 新增 §二十一 数字真源 + §二十二 运行时字段 + 系统 ID 真源注册 S27；
  `34-faction-politics-design.md` 新建；`04-game-systems.md` §四十一；`03-data-models.md` §二十七；
  `06-api-design.md` §2.17；`07-ui-design.md` §12.2.22；`12-system-map.md` 注册 S27（26→27 大系统）

## 2026-08-01 — Session 284（S24 关系网 + S25 技能树系统实装）

- **S24 关系网系统**（注册 24→25 大系统）：
  - `shared/relations.ts`：pairAffinity 公式（tagAffinity 0.4 + hiddenCompatibility 0.6）、六等关系状态、动态演变、技能点/特性点公式
  - `server/src/data/relations.json`：首批 31 对重点关系（桃园三义/曹操-曹丕父子/诸葛亮-姜维师徒/孙策-周瑜挚友/各势力敌对关系），史源分层标注
  - 服务端 `GET /api/game/relations/:officerId` 端点
  - 客户端 OfficerDetail 新增「社交」tab：关系列表（类型徽章+对象名+史源分色+六等状态）+ SVG 径向图谱
  - 家族 tab 更名为「关系」，婚姻区块扩展妾/姬（`Officer.consortIds` 女性实体引用，分两档）
- **S25 技能树系统**（注册 25→26 大系统）：
  - `shared/types/skill-tree.ts`：SkillTreeNodeDef / SkillTreeDef 类型
  - `server/src/data/skill-trees.json`：5 棵子树（战略计策/战术计策/单挑技能/统军/内政），30 技能按战斗层映射，节点前置依赖
  - 技能点绑定 merit 等级（公式：`skillPointsForMerit`），特性点每 5 级 +1
  - 服务端 5 个 API 端点（技能树定义/武将状态/加点/特性加点/重置）
  - 客户端 OfficerDetail 新增「技能」tab：技能树面板（子树切换+节点列表+加点按钮）+ 特性点概览
  - 布阵→统军树（战场+白刃+战役），洞察→战略计策树（战场+白刃），沉着跨战术+单挑树
- 数据层：`Officer` 新增 `skillTreeState`/`skillPointsSpent`/`traitLevels`/`traitPointsSpent`/`consortIds`（全部 optional，旧档兼容）
- Zod schema 同步更新，`shared/tsconfig.json` 注册新文件
- 回归：`pnpm typecheck`、`pnpm test`（shared 311 / client 42）全绿
- 文档：`30-skill-tree-design.md` 定稿、`12-system-map.md` 注册 S24+S25（23→25）、`03-data-models.md`/`06-api-design.md`/`07-ui-design.md` 同步

## 2026-08-01 — Session 283（运行时恢复与战法 UI 修复）

- 用户报告：程序启动直接进入战斗地图不在大地图、刷新恢复不了、战斗界面多个操作无效。
  经浏览器复现定位：六角战斗（`activeBattle`）刷新恢复本就正常；真正缺口是
  **Tier II 郡域战场（`activeBattlefieldInstance`）未参与 `boot()` 恢复**——南郡/颍川战场
  中刷新直接落回世界地图，且战场中进行的阵前单挑状态一并丢失。
- 修复一：`client/src/stores/gameStore.ts` `boot()` 新增 `activeBattlefieldInstance` 恢复分支
  （`getBattlefieldInstance()` → 场景栈 `[{scene:'world'},{scene:'battlefield', battlefieldId}]`，
  `screen='battlefield'`，补齐 Tier I/II 同等最深场景恢复契约）。
- 修复二：`server/src/engine/battle.ts` `getUsableAbilities` 每战法只返回**最高可用等级**
  （原实现把 Lv1~5 全部返回 → 六角战斗中突击/突破/猛突各渲染 5 个重复按钮 + React key
  冲突警告刷屏）；与 `castAbility` 的「玩家选择层级 = 可用最高层」口径对齐。
- 修复三（Session 283 追加）：**刷新恢复的六角战斗点「撤军返回」卡死在「启动中」**。
  根因：`boot()` 恢复 `activeBattle` 用 `replaceStack({scene:'battle'})` 建**单层栈**，
  `exitBattle` 的 `popScene` 弹空后 `screenOf([])` 回退 `'boot'`。修复：battle 分支改为
  两帧栈 `[{scene:'world'},{scene:'battle',battleId}]`，与正常 march 的
  `[world,battle]` 栈一致，撤军后自然回到大地图。
- 实测（Headless Chrome + 权威 API）：郡域战场刷新恢复 16 县节点 ✓、重复刷新幂等 ✓、
  单挑中刷新恢复（战场+单挑面板）✓、六角战斗战法按钮去重（突击/突破/猛突各 1）✓、
  撤军→世界→战场往返正常 ✓、console error=0 ✓。
- 实测（修复三）：刷新恢复的战斗中点「撤军返回」→ 回到世界地图 ✓（修复前卡「启动中」）。
- 已知边界（未改）：「围攻江陵（六角接战）」按钮复用旧 `marchOnCity` 路径，190 剧本
  袁绍等多数势力因无邻接己方城/目标无主必然失败（设计约束非新回归）；「攻打县」需
  先在大地图编成出征军（`CampaignArmy`）——均为既有设计门禁，按钮缺失引导文案留后续。
- 回归：`pnpm typecheck`、`pnpm test`（shared 311 / client 42）全绿；`docs/07-ui-design.md`
  §12.2.15 恢复契约同步。

## 2026-08-01 — Session 280 收口补记（授权后复核）

- 合规整改闭环：授权后以工作区外 bundle 备份为前提，重写全部 Git 可达历史并移除不明头像 PNG/关联截图对象；删除 `refs/original`、过期 reflog 并执行 gc，路径审计无残留。
- 恢复 `client/src/App.tsx`、`BattleView.tsx`、`DuelPanel.tsx` 的交叉损坏 JSX；`pnpm --filter @leh/client exec tsc --noEmit`、`pnpm test`（shared 311/client 42）、`pnpm validate-data`、`pnpm verify-compliance` 与 client production build 全部通过。
- 构建门禁发现并修正退役字体路径 `MuYaoSoftBrush.woff2`，统一为 `MaShanZheng-Regular.woff2`；平台侧未导出对话仍标记为需所有者材料，不作不可验证声明。

## 2026-08-01 — Session 281（全仓版权复审整改）

- 只读复审发现并处理忽略目录 `assets/portraits/` 的 4 个来源不明头像；已移至工作区外权限受限隔离区，未纳入项目或发行包。
- `scripts/verify-compliance.mjs` 增加忽略头像目录和外部 Demo 文件阻断，防止 `.gitignore` 绕过合规检查。
- `docs/29-formation-integration-development-plan.md` 删除商业作品/发行方名称、手册和扫描链接，改为抽象案例与外部隔离材料说明；README、CREDITS、ASSET_MANIFEST、`01/05/10/HANDOFF` 统一中性原创措辞。

## 2026-08-01 — Session 282（运行时浏览器验收修复）

- 复现并修复 CMD-P4 浏览器验收失败：朝廷抽屉原显示“朝廷官制”，与当前验收契约及设计术语“霸府官制”不一致；统一为“霸府官制 · 只读总览”。
- 实机验证：`pnpm verify-cmd-p4-headless` 通过（开霸府、伪诏、取消回滚、人事跳转、console error=0）；CMD-P7 通过（1440×900、1,000 条合成名册、独立滚动与焦点恢复）。
- 回归验证：`pnpm typecheck`、`pnpm test`（shared 311/client 42）通过。
- 备注：`verify-cmd-p6-headless` 仍是迁移前“旧人事手风琴”历史基线；当前设计已物理删除旧 DOM、命令坞人事抽屉为唯一入口，因此该脚本失败属于过期验收脚本，不是运行时故障；后续应迁移/归档该脚本，不能以其旧 DOM 断言阻断当前构建。
- 复核结论：生产代码、字体、Natural Earth、程序化音频和当前 Git 可达历史未发现第三方三国游戏代码或发行资源；平台侧未导出 Agent 对话仍不在可审查范围。

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
| P0A-06 | officers.json（基线30；当前223武将） | [x] | 0-A验收基线30名史实武将；当前JSON实测223名，0-B 1000+目标仍暂缓 |
| P0A-07 | cities.json（小，30城） | [x] | 覆盖13州；name=治所；x/y=等距圆柱(lon/lat)，非插画手校 |
| P0A-08 | formations.json（小，7阵型） | [x] | 当前实际 `[0,2,4,6,7,8,16]`；原设定目标目录待 FM-P0/P1 迁移 |
| P0A-09 | units.json（小） | [x] | **9 兵种**：6陆+走舸/蒙冲/楼船（Session 71） |
| P0A-10 | items.json（小，20宝物） | [x] | — |
| P0A-11 | females.json（小，10女性） | [x] | 皆有史/演义出处 |
| P0A-12 | children.json（小，5子女） | [x] | 皆有出处 |
| P0A-13 | skills.json（小，30通用技能） | [x] | 暂不含专属技 |
| P0A-14 | scenarios.json（小，2剧本） | [x] | 英雄集结 + 190《关东义兵》四势力技术切片 |
| P0A-15 | events.json（小，24事件） | [x] | 190链：5→24事件；5条叙事线+玩家抉择系统+gold/food/population效果 |
| P0-16 | 全部 12 份 docs 文档 | [x] | 2026-07-15 完成 |

**0-A 验收**：Zod 全过；地图可渲染、可推进1回合、可完成1次内政操作、可打通1场最简战斗。

**0-A 当前状态（已交付）+ Demo 叠加（至 Session 60）**：

| 域 | 状态 |
|----|------|
| 骨架 0-A | 30城/30将验收基线 + Zod + monorepo 全过；当前武将数据已扩至223名 |
| 战略环 | 回合·地图·内政·人口·出征占城·迷雾**服务端裁剪** |
| 谍报/外交 | 特工+女间谍；进贡/结盟/**宫廷牵线** |
| 宫廷人脉/家族 | S09 非人格化人脉；S18 成年婚配/正式配偶跟随；**子女登场引擎**（父辈后置） |
| 人事 S11 | 搜索/登用 + **任命三轨**（Session 60） |
| 官职 S12 | **0-A 精简任命**（全量 24/44 级+功绩后置） |
| 计谋 S17 | **三层体系设计完成**：L1 美人计/离间/假情报/空城 · L2 11 战略计谋 · L3 8 国策 · 行政↔战场联动 |
| 战斗 | 六角+克制+火计+**战法引擎**+三级水军(9兵数据)+**暴击/反击/连击设计**+**单挑全面设计**；水域移动后置 |
| 事件 S14 | 条件式引擎 + **EventDialog**；场景/史料层隔离、窗口/前置/互斥/失效、玩家/AI决策（Session 106） |
| AI | 袭扰 + **出征占城** |
| 掩护招募 | 宫廷牵线→plantable→女间谍 |
| **暂缓** | **0-B**；水域移动引擎；连携；造船；全量官职；战法 UI 选层；战法 AI 施放 |

> 总览与接手：根目录 `HANDOFF.md` · 系统图 `12-system-map.md`。  
> **交接说明（2026-07-16 Sessions 81~83）**：单挑全面设计 经典化重写完成（核心三角+全自动+宿命对决+武魁大会）；架构文档全面重写(v2.0)；主副将+Squad编成+部队品质(经验Lv1-7/组织度/士气深化)+部曲12将+军屯田+家属质任+民屯田9维设计完成；功能代码保持至 Session 72。

### Phase 0-B — 数据扩容至全量（依赖对应 0-A 任务）

| ID | 任务 | 状态 | 备注 |
|:--:|------|:--:|------|
| P0B-06 | officers.json（全量 1000+武将） | [ ] | 脚本生成+重点人物人工校对 |
| P0B-07 | cities.json（全量 105城） | [ ] | 坐标取自 cities-geo-reference；name 用治所 |
| P0B-08 | formations.json（全量 27阵型：18陆+9水） | [ ] | 0-B 暂停 |
| P0B-09 | units.json（全量 21兵种） | [ ] | — |
| P0B-10 | items.json（全量 165宝物） | [ ] | — |
| P0B-11 | females.json（全量 90+女性） | [ ] | — |
| P0B-12 | children.json（全量 50+子女） | [ ] | — |
| P0B-13 | skills.json（全量 149技能） | [ ] | 69通用+80专属 |
| P0B-14 | scenarios.json（首批7历史剧本+英雄集结） | [ ] | 以08数字真源为准；约30势力190全量开局仍属0-B |
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
| P2-06 | OfficerDetail 面板 | [x] | Session 122：己方名册→完整武将简册；头像层仍按 P5-10 后置 |
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
| P3-05 | 兵种克制+阵型联动 | [~] | Session 277 已有六基础白刃切换/修正；**Session 288 FM-P1 已落地**（`Formation` Zod/Type、`formations.json` 收敛 `[0,1,2,3,4,6,16]`、146 将精通迁移、TacticalConfig v2）；静态目录、精通、三模式同源、AI 与存档迁移尚未全量完成（FM-P2~P5） |
| P3-06 | 计策系统 | [~] | Session 69：火计最小切片；余14种后置 |
| P3-07 | 单挑系统 | [~] | **引擎最小切片已实装（Session 88）**；Session 104 实操发现接受挑战 API 嵌套锁返回400，入口待修；设计完成 05§8+03/04/06/07/08 全量同步 |
| P3-08 | 攻城战 | [ ] | P3-04 |
| P3-09 | BattleCommandBar | [~] | Demo 底部按钮栏已实现 |
| P3-10 | BattleInfoBar | [~] | Demo 顶部信息+SideCard 已实现 |
| P3-11 | 战斗 API | [~] | Demo move/attack/fire/ability/exit 已实现 |
| P3-12 | BattleView 完整组件 | [~] | Demo 组件已实现 |
| P3-13 | 特殊兵种战斗效果 | [ ] | P3-05 |
| P3-14 | 战役层引擎（CampaignArmy/行军/自动战斗） | [~] | **Session 98 最小切片已实装**；Session 125 三层战斗架构实装（战场地图 Tier I + 白刃战 Tier II）|

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
| P4-06 | 事件触发器 | [x] | tickEvents：场景/史料层/窗口/前置/互斥/失效；玩家pending，AI加权选择 |
| P4-07 | EventDialog | [x] | 对话逐段 + 史源标签 + 选项；目录缺失不再自动代选 |
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
| P5-06 | 多剧本完善 | [~] | 0-A两剧本选择已实现；首批7历史剧本与全量势力后置 |
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

## Phase 6 — 前端体验 & 三级战斗串联（S20/S21 技术储备）

> Session 100 技术储备完成方案设计，零代码改动。实装拆为 8 个工作包（S20-W1~W4、S21-W6~W9），时机后续排定；旧称“S100~S107”已因实际会话号达到107而停用。
> 数字真源变更（officers.json appearance / BattleState.activeStrategem）在实装时同步 08-data-dictionary.md。

### S20 — 前端体验（4 Session）

| ID | 任务 | 状态 | 备注 |
|:--:|------|:--:|------|
| S20-W1 | endTurn WebSocket 接入 + TurnProgressOverlay | [ ] | 复用已废弃的 server/src/ws/broadcast.ts；降级假进度条 |
| S20-W2 | TopBar useAnimatedNumber 数字跳动 + EventLog 流化 | [ ] | rAF + easeOutCubic ~30 行；type 着色/淡入/顶滚 |
| S20-W3 | 势力凸包涂色 + FogLayer + konva tween + PCG 水墨地形 | [ ] | 凸包 graham scan；globalCompositeOperation 挖洞；layer.getContext() 命令式 |
| S20-W4 | 派系面板 + OfficerDetail + 内政外交前端增强 | [~] | Session 122 已完成己方名册、OfficerDetail、忠诚警报及人事操作终审窗；派系/雷达/飘字/总署重组待续 |

### S21 — 三级战斗串联（4 Session）

| ID | 任务 | 状态 | 备注 |
|:--:|------|:--:|------|
| S21-W6 | 一级大地图演出 | [ ] | 军旗 Tween + 烽火粒子 + 是否攻城弹窗 + 行军箭头，复用 campaign.ts |
| S21-W7 | 二级战术串联 | [ ] | screen 六态栈 + 切入渐变 + 棋子滑行 + hex 悬停情报 + 邻接触发三级 + 迷雾散开 |
| S21-W8 | 三级白刃战横版 | [ ] | MeleeStage Konva 方阵 30-50 图元 + 动态缩放 20-120 粒 + 纯战略指令 + 镜头推进切入 + Soldier 类移植 + 武将计特写 |
| S21-W9 | 单挑接入 | [ ] | DuelStage 混合范式（已储备）+ 状态机串接：白刃→单挑→回白刃 |

### 0-B 前置技术债（D-0B-1~13）

| ID | 债务 | 触发时机 |
|:--:|------|------|
| D-0B-1 | Zustand store 拆 slice + 局部 patch + 细粒度 selector | 0-B 扩容前 |
| D-0B-2 | LOD 拖拽冻结（debounce / 拖拽中复用上一次 layout） | 0-B 扩容前 |
| D-0B-3 | TopBar/RightPanel/LeftPanel 内联遍历加 useMemo | 0-B 扩容前 |
| D-0B-4 | viewport culling（屏外城点不画） | 500+ 城时 |
| D-0B-5 | 矢量州界 path + LOD 简化 | 0-B 引入州界时 |
| D-0B-6 | screen 状态机栈式管理 + 切入切出动画时序 | 0-B 扩容前 |
| D-0B-7 | officers.json appearance 字段 0-B 全量填写 + uniqueSkill 派生 | 0-B 扩容前 |
| D-0B-8 | 吕布服务端无双乱舞 + 心理震慑 + 鬼神数值效果 | S10 战斗深化时 |
| D-0B-9 | §35 财政税收俸禄数据模型扩展 + 引擎 | 独立 Session |
| D-0B-10 | PCG 水墨底图若替换 geo-basemap.png 需重做 MapCanvas | 0-B 视觉升级时（可选） |
| D-0B-11 | BattleState.activeStrategem 字段 + 服务端火计设置 | S20/S21 实装时 |
| D-0B-12 | S17 L2 水攻/伏兵服务端引擎实装 | S17 L2 实装时 |
| D-0B-13 | ✅ Session 102 已实装字体工程资产闭环、FontBarrier 与跨平台编码门禁；剩余 HiDPI/XDG/伪 Terminal/金石组件库/字重扩展归 P5-07a~e | P5-07 剩余 UI 适配 |

---

## 会话日志

```log
## 2026-08-01 — Session 283（运行时恢复与战法 UI 修复）

- 定位：六角战斗刷新恢复正常；Tier II 郡域战场（`activeBattlefieldInstance`）缺失
  `boot()` 恢复分支（`client/src/stores/gameStore.ts:310`），南郡/颍川战场刷新回世界地图。
- 修复 1：`boot()` 新增 `activeBattlefieldInstance` 恢复（场景栈 world→battlefield，
  `screen='battlefield'`），与 Tier I `activeBattlefield` 同等深度；`battlefieldInstance`
  同步写入 store。
- 修复 2：`server/src/engine/battle.ts` `getUsableAbilities` 每战法只返回最高可用等级
  （原实现全量返回 Lv1~5 → 突击/突破/猛突各渲染 5 个重复按钮 + React key 冲突警告）。
- 修复 3（用户反馈追加）：刷新恢复的六角战斗「撤军返回」卡「启动中」——`boot()` 用
  `replaceStack` 建单层 battle 栈，`exitBattle` pop 空栈回退 `'boot'`；改为两帧栈
  `[world, battle]`，撤军回大地图实测通过。
- 浏览器验证：郡域战场刷新恢复 ✓ / 幂等 ✓ / 单挑中刷新恢复 ✓ / 六角战法按钮去重 ✓ /
  刷新后撤军回大地图 ✓ / console error=0 ✓。typecheck + shared 311 / client 42 全绿。
- 未改设计边界：「围攻江陵」按钮（旧 march hack，多数势力必然失败）与「攻打县需先
  编成 CampaignArmy」为既有门禁，引导文案留后续。
- 文档：`07-ui-design.md` §12.2.15 恢复契约补充 Tier II；本文件 + HANDOFF 双写。

## 2026-07-18 — Session 100（前端体验技术储备 — S20/S21 七大方案设计，零代码改动）

- Phase: **纯文档技术储备**（Plan Mode → Build Mode 只落地文档，不改任何代码）
- 储备内容（共 7 大方案 + 12 项 0-B 前置技术债）:
  1. **S20 前端体验**（W1~W4 + 内政外交增强）:
     - W1 endTurn WebSocket 接入 + TurnProgressOverlay（复用已废弃的 server/src/ws/broadcast.ts，client 零 WebSocket 接入是已存在但未打通的能力；降级假进度条）
     - W2 TopBar useAnimatedNumber 数字跳动（rAF + easeOutCubic ~30 行 hook）+ EventLog 流化（按 action.type 着色 + 新条目 transition-all duration-300 淡入 + 自动顶滚）
     - W3 势力凸包涂色 + FogLayer + konva tween + PCG 水墨地形绘制；**Session 280 合规覆写：仅按本项目 clean-room 规格原创实现，旧外部 Demo 移植指令失效**
     - W4 派系面板（tags 派生，§4.5.2 规则，纯前端 useMemo）+ OfficerDetail modal（仿 EventDialog，hidden 五维/ tags/bloodline）+ 内政外交前端增强（己方武将列表 OfficerRosterPanel 当前缺失，忠诚度<60 animate-pulse 红框警报，外交雷达纯 SVG 手写 RadarChart 5 维，财政飘字前端算 delta，行政总署三段式重组 LeftPanel 人事折叠）
  2. **S21 三级战斗串联**（W6~W9）:
     - W6 一级大地图演出（军旗 Tween 沿 CampaignArmy.path + 烽火粒子 + 是否攻城弹窗 + 行军箭头，复用已实装 campaign.ts 引擎）
     - W7 二级战术串联（screen 从两态扩为 'boot'|'world'|'campaign'|'tactical'|'melee'|'duel' 六态栈 + 切入渐变 + 棋子滑行 konva node.to() + hex 悬停地形情报 tooltip + 邻接攻击改为触发三级 + 迷雾散开 FogLayer）
     - W8 三级白刃战横版 MeleeStage（Konva 方阵表现 30-50 图元，不引 PixiJS；动态缩放 20-120 粒；Soldier 与动效须按原创规格实现；武将计特写全屏暗场+粒子）
     - W9 单挑接入（DuelStage 混合范式·已储备；状态机串接：白刃→单挑→回白刃）
  3. **单挑动效 DuelStage 混合范式**:
     - 静态元素（武将占位/卡牌/HP）用 react-konva 声明式；动效（粒子/刀光/火花/震屏）用 Konva.Animation + layer.getContext() 命令式
     - 卡牌仅展示（服务端已选好指令，前端翻开动画 + 三向克制高亮），不改 Session 80 全自动设计
     - 美术纯几何占位起步（彩色矩形+姓氏文字+Konva 程序化刀光/粒子），Phase 5 再接立绘
     - 音频原生 Web Audio API 程序化合成（金属碰撞白噪声+bandpass 滤波，暴击低频脉冲，零音频文件）
     - 分阶段演出时序：出牌(200ms)→对冲(300ms)→命中刀光(150ms)→暴击/连击/反手特写(400ms)→扣血(300ms)→受伤高亮(200ms)→叙事淡入(200ms)；三速度模式控制倍率
  4. **HeroCharacter 特殊造型 + appearance 字段落库**:
     - officers.json 新增 appearance 字段（scale/auraColor/weaponLength/shadingMode），Zod 校验，0-A 30 武将手工填写
     - 不做骨骼动画（Spine/DragonBones 需美术资源+商业授权，违反纯几何占位原则）
     - 气劲流光只用 Canvas 2D filter（drop-shadow/saturate/blur），不引 WebGL shader
     - 典型武将映射：吕布 scale=1.5/auraColor=#ff1744/weaponLength=25/enraged；关羽 1.3/#00e676/22/normal；张飞 1.4/#ff6f00/20/normal；典韦 1.4/#ff1744/15/normal；赵云 1.2/#00b0ff/18/normal；马超 1.3/#ff6f00/20/normal
  5. **吕布鬼神降临**（纯前端演出，服务端后置）:
     - Verlet 积分动态雉翎（3-4 节点链 + 重力 + 惯性，挂在 HeroCharacter.draw() 内，仅吕布及少数猛将有）
     - 赤兔马烈焰足粒子（马蹄位置每帧生成暗红粒子，复用粒子系统）
     - 帧缓存残影（layer.getContext() 前 3 帧半透明叠加）
     - 方天画戟刀光（贝塞尔 + ctx.filter='blur()'，复用 drawSlash）
     - 鬼神觉醒（rage≥100 或兵力<30% 触发，前端自管，shadingMode='ghost' + scale=1.6 + auraColor=#6a1b9a + 画布 saturate(0.4) 变暗 + 紫黑粒子）
     - 单挑登场杀（DuelStage 扩展，斜切立绘滑入 + 红光眼粒子 + 台词框）
     - 服务端无双乱舞范围攻击 + 心理震慑 debuff + 鬼神数值效果（防御翻倍+吸血）后置 D-0B-8
  6. **PCG 程序化美术**（归入 S20 W3 子项）:
     - Konva 混合范式（Konva.Animation + layer.getContext() 命令式）；实现来源限定为本项目原创 clean-room 规格
     - 保留 geo-basemap.png（Natural Earth 公有领域，无版权风险），PCG 只用于二级战术网格地形绘制 + 三级白刃战视差背景
     - 原有效果目标保留；外部 Demo 函数名、结构、参数和绘制表达均不得进入生产实现
  7. **计谋三级联动视觉**（归入 S20 W3 子项）:
     - 服务端计谋状态驱动（BattleState.activeStrategem: 'none'|'fire'|'water'|'ambush'，新字段 D-0B-11）
     - 火计复用已有 battle.ts /battle/fire 引擎；水攻/伏兵服务端引擎后置 D-0B-12
     - 三种 PCG 视觉目标：火、水、伏兵；只保留抽象效果和性能验收，具体算法原创
     - 共享帧序号由项目时钟服务定义，不沿用外部 Demo 结构
- 决策清单（29 项累计）:
  1. 新增 S20「前端体验」拆 4 个工作包（当时暂称 S100~S103；Session 108 统一为 S20-W1~W4）
  2. 关系图只做派系面板 + OfficerDetail
  3. W5（store 拆分 + LOD 拖拽冻结）记技术债 D-0B-1/2
  4. 矢量州界 path 留 0-B（D-0B-5）
  5. 单挑卡牌仅展示，不改 Session 80 全自动
  6. 单挑美术纯几何占位起步
  7. 单挑音频原生 Web Audio API
  8. DuelStage 混合范式（静态 react-konva + 动效 Konva.Animation + layer.getContext()）
  9. 三级白刃战用 Konva 方阵表现，不引 PixiJS
  10. 新增 S21「三级战斗串联」拆 4 个工作包（当时暂称 S104~S107；Session 108 统一为 S21-W6~W9）
  11. 白刃战纯战略指令（全军突击/鸣金收兵/发起单挑）
  12. 白刃战粒子动态缩放（20-120 粒，1 粒=20-50 兵）
  13. 二级→三级切入用镜头推进 + 渐变
  14. 不做骨骼动画，只用 Canvas 2D filter 气劲/残影/光环
  15. 特殊造型数据新增 appearance 字段落库（同步 08 真源）
  16. 气劲流光只用 Canvas 2D filter，不引 WebGL shader
  17. 吕布鬼神降临只做前端演出，服务端后置 D-0B-8
  18. 雉翎用 Verlet 积分动态摆动
  19. 鬼神觉醒前端自管 rage 触发，与服务端数值解耦
  20. 内政外交增强只做前端可视化，不动服务端/数据模型
  21. 外交雷达纯 SVG 手写，零新依赖
  22. 财政飘字前端算 delta 触发，服务端不动
  23. §35 财政税收俸禄记技术债 D-0B-9，独立 Session
  24. PCG 归入 S20 W3 子项，不新增 S 编号
  25. PCG 用 Konva 混合范式；Session 280 起强制 clean-room 原创实现
  26. 保留 geo-basemap.png，PCG 只用于二三级地形/视差
  27. 计谋三级联动视觉由服务端计谋状态驱动
  28. 计谋视觉只做火计/水攻/伏兵三种 PCG 算法
  29. 三级联动用模块级 frameCount 共享帧计数
- 关键架构发现:
  - 本仓库是 React+Konva+Zustand+Tailwind（非 Vue3+Pinia+SVG），90% 视觉/交互增强需求已被覆盖，无需引 framer-motion/gsap/PixiJS/D3/G6/howler.js
  - 数据与渲染已彻底解耦（服务端权威引擎 + 瘦客户端，21 个 engine 文件 + 7 个 battle 文件，客户端零规则计算）
  - Canvas（react-konva）已规避 SVG DOM 爆炸；LOD 系统质量超预期（4 级 + 标签/Marker 双重碰撞 + screen-pixel sizing）
  - Zustand 订阅粒度是 0-B 核心隐患（14 组件 100% 整体订阅 s.game，33 处 set({game}) 整体替换），D-0B-1
  - server/src/ws/broadcast.ts 已建未接（endTurn 广播 turn_progress/turn_complete/event_triggered，client 零 WebSocket），是已存在但未打通的能力
  - 服务端单挑引擎已返回前端演出所需的全部数据字段（commands/criticals/counterDamages/chainHits/injuryApplied），前端完全未用，只渲染拼好的 description 字符串
  - §35 财政税收俸禄纯设计零代码（Faction 无 coinQuality/salaryArrears，City 无 taxRate，turn.ts 用旧产金公式）
  - 己方武将列表组件缺失（PersonnelPanel 只列在野武将），是 OfficerDetail/忠诚度警报/赏金/俸禄的前置
- 文件处理:
  - 两个外部参考 demo（map_battleground_procedural_engine.html / map_battleground_procedural_engine (1).html）加入 .gitignore 不入库
- 同步: 12-system-map（S20/S21 + D-0B-1~12）· 本进度（Phase 6 + 会话日志）· HANDOFF · 07-ui-design · 02-architecture · 05-combat-system · 03-data-models · 08-data-dictionary · 09-roadmap · 04-game-systems
- Next: 总军师系统实装（任命/态势/献策/对决）→ 设施建造回合化 → 势力特点数据 → AI Army 接入。S20/S21 前端体验增强实装时机后续排定。

## 2026-07-17 — Session 99（开源收尾：免责声明/许可证拆分/截图/CREDITS/SECURITY）

- Phase: **文档合规 + 截图 + 项目信息完善**（无游戏代码/设计改动）
- 变更（共 6 项）:
  1. `README.md` 声明区新增中英双语独立游戏声明（晚东汉末启发 + 非商业官方产物的免责）
  2. `README.md` License 区拆分为源代码 MIT 与游戏素材分开许可（源码 MIT，素材见 CREDITS.md）
  3. `README.md` 新增 `## Project Status` 章节（独立开源项目 + 历史素材源自公有领域）
  4. `SECURITY.md` 新建安全策略文件（私密报告 + 仅最新开发版受支持）
  5. `CREDITS.md` 标题加入项目名 + 末尾新增 `## Assets` 占位（未来外部素材须检查许可/再分发/署名）
  6. 3 张截图 `leh-full-map.png` / `leh-city-detail.png` / `leh-personnel-officers.png` + README `## Screenshots` 章节（三列表格）
- 同步: 本进度 · HANDOFF
- Next: 总军师系统实装（任命/态势/献策/对决） → 设施建造回合化 → 势力特点数据 → AI Army 接入

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
  5. **中**：历史设计记录仍保留过往外部参考来源的审计痕迹，公开文档需改为中性表述
- 修复:
  - UI 品牌 → `LateEasternHanDynasty`（title / 启动页 / TopBar）
  - `git rm` 删除 5 张 Google 校准截图 + 根 `src/` + `index.html`
  - `.gitignore` 补 `leh-google-geo-*.png` 与孤儿 demo 路径
  - enums 注释去掉「」；`00` 参考标准改为史书/本作独立设计；`01/02/04`「旧参考版本」措辞中性化
  - `CREDITS.md` 去掉 Google 截图条目，改为 WGS84 坐标说明
- 仍属低风险/可接受:
  - README 免责声明中出现 第三方发行方 全名（**必须保留**，用于划清界限）
  - 历史会话日志（10-progress Session 85~87）保留「旧商标 清除」字样作审计轨迹
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

## 2026-07-16 — Session 85（全库版权排查 + 旧商标清除 + CREDITS + 截图清理）
- Phase: **合规修复**（文档+数据+git）
- 版权排查:
  - 全库扫描 第三方发行方/第三方发行方/第三方发行方/本项目历史策略游戏 等商标引用 → 零残留
  - 扫描 AI 生成图片 → 删除 imagine-*.png
  - 扫描 32MB 孤图 map.png → 删除（未使用且来源不明）
  - 确认 geo-basemap.png 为 Natural Earth 公有领域
  - 确认 73 张截图均为自产开发截图，无 第三方发行方 素材
- 修复:
  - 全库 47 处 "旧商标" 逐处替换为中性表述（三向克制/经典/经典设计传承等）
  - README 品牌说明保持独立原创措辞，移除可能暗示续作关系的表述
  - docs/07-ui-design.md 菜单 "本项目历史策略游戏·怀古" → "乱世·英雄"
  - docs/07-ui-design.md 的外部商业作品标题已改为中性原创标题
  - docs/01-overview.md 对比表 "旧参考版本 旧商标" → "参考设计"
  - 全库 "本项目历史策略游戏" → "本项目历史策略游戏"
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
  - git filter-branch --tree-filter 替换全历史 blob 中 旧商标 文本（按映射表）
  - git filter-branch --msg-filter 清洗 commit message 中的 旧商标/LateEasternHanDynasty
  - 清理垃圾对象（rm refs/original + reflog expire + gc --prune）
- 验证:
  - main blob 旧商标 → 零残留
  - main commit message 旧商标/LateEasternHanDynasty → 零残留
  - Google 截图文件在 main 历史中 → 已全部删除
- 推送: git push --force origin main（7 commit 全部重写）
- 备份分支说明: 保留本地，确认后删除

## 2026-07-16 — Session 87（合规报告 + SPDX + 许可证 + 免责声明）
- Phase: **合规修复**（代码+文档）
- 输出合规审查报告（Covering License/Dependencies/Brand/Data Security → 🟢低风险）
- 修复:
  - README 顶部添加中英双语免责声明（百度 LateEasternHanDynasty 无关 + 第三方发行方 独立声明）
  - 根 + shared/server/client 四个 package.json 补 license: MIT + author 字段
  - node scripts/add-spdx-headers.mjs 批量刷写 98 个 .ts/.tsx 文件 SPDX 头部
  - 删除根目录残留旧 src/（15 个文件，client/server 拆分前的冗余）
  - package.json 新增 pnpm spdx 命令
- 修复措辞: "经典旧参考版本最精髓" → "经典三向心理战的核心" 等 3 处
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
  - 单挑从交互式改为**全自动结算**（发扬本项目历史策略游戏）
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
  - 玩家体验 = 本项目历史策略游戏：触发→确认→观看→结果
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
  - 背景: 发扬自本项目历史策略游戏的戏剧化叙事精神，在三向克制核心基础上叠加传奇色彩
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
  - diplomacy.transferCourtNetwork：己方 beauty−n / 对方+n / 友好+12×n；amount 1~5
  - 交战禁止；非本势力；库存不足/非法数量拒绝
  - POST /diplomacy/court-network；LeftPanel 各势力「献美」按钮
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
  - 验证种子（当时）: createGame 释放占位武将12(111, compat=65, ideal=benevolence)到宛(13)待投奔；Session 104 后 ID111 已替换为张嶷(compat=75, ideal=benevolence)，仍沿用该释放逻辑
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
  - BeautyPanel 列表；personnel marry/court-network API
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
  早期演示截图已因品牌残留隔离，不纳入当前资产清单
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
- Phase: 用户要求 **缩放分级显示地理信息**（采用独立的屏幕像素级 LOD 与标签避让设计）
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

## 2026-07-18 — Session 101（美术版权铁律入最高准则 — S22 美术基调·金石水墨免版权，零代码改动）

- Phase: **纯文档·最高准则固化**（Plan Mode → Build Mode 只落地文档，不改任何代码）
- 背景: 独立开发 + 1000~1200+ 武将 + 彻底免版权死命令。约稿立绘成本 20 万起 + 极高侵权风险（借鉴知名三国游戏构图即收律师函），不可行。玩家群体审美偏好是历史厚重感/古朴感/考据感，非二次元萌娘/页游大翅膀。
- 核心变更（最高准则升级 + 22 大系统 + 头像方案落库）:
  1. **`AGENTS.md` 核心规则新增第 9 条「美术版权铁律」**（与规则 1~8 同级，每次会话/agent 必读）：
     - 基调：**金石水墨·拓片简册·印信官职**三件套，仅用公有领域历史文物视觉语言
     - 禁：商业字库（方正/汉仪）/现代立绘约稿/借鉴知名三国游戏构图/二次元页游风/商业音效未授权
     - 准：史书大段引用合法（《三国志》《后汉书》《资治通鉴》+裴注）；字体限系统字体+开源思源宋体+字魂织造书体；Natural Earth 公有领域底图
     - 武将头像三方案：A 拓片印章（底图）+ C 程序化拼图（五官）+ B 官职印信简册（文字），已定为组合方案 A+C+B
     - 头像数据落库：`officers.json` 新增 `avatarGene` 字段（与 Session 100 `appearance` 战斗造型字段并存职责分离）
     - **【Session 102 修正】**：字体白名单升级为"工程资产闭环"，不再依赖宿主系统字体（SimSun/STKaiti/字魂织造书体在 Linux 极简发行版不存在 → 豆腐块），改用 woff2 本地打包 + `@font-face` 工程内部别名 `HanDynastySerif`/`HanDynastySeal`（思源宋体 SC + 马善政体，均 SIL OFL 1.1）
  2. **`docs/00-dev-constitution.md` 新增§十一「美术与版权铁律」**（与§六/§九/§十同级）：
     - §11.1 公有领域基调（画像砖/帛画/石刻拓片/竹简/官印/印绶 + Natural Earth）
     - §11.2 武将头像三方案（A 拓片底图 / C 程序化拼图 / B 官职印信 + 组合方案渲染流程）
     - §11.3 字体白名单（系统 SimSun/STKaiti + 开源思源宋体/字魂织造书体，禁方正/汉仪，D-0B-13）**【Session 102 修正：已升级为工程资产闭环，不再依赖宿主系统字体，改用 woff2 本地打包 + @font-face 工程内部别名 HanDynastySerif/HanDynastySeal】**
     - §11.4 禁止清单（商业字库/约稿立绘/借鉴构图/二次元页游风/商业音效未授权）
     - §11.5 史料文字引用免责（《三国志》《后汉书》《资治通鉴》+裴注不受版权法保护）
     - §11.6 头像数据落库（`avatarGene` 与 `appearance` 并存，0-A 手工/0-B 脚本派生+重点校对）
     - §六第 64 行「武将头像」措辞改免版权路径（"占位图→最终版" → "金石水墨·免版权组合方案 A+C+B"）
  3. **新增 S22 美术基调·金石水墨免版权大系统**（21→22，`docs/12-system-map.md` §二 B 组）：
     - 组合方案 A+C+B：A 拓片印章（底图层·20~30 张公有领域拓片+宣纸+朱砂姓名印）+ C 程序化拼图（五官层·5×10×10×10 哈希派生+重点手工指定）+ B 官职印信简册（文字层·氏族/官职篆印+汉制印绶紫青墨黄）
     - `avatarGene` 字段落库（与 Session 100 `appearance` 战斗造型字段并存职责分离）
     - 实装拆 3 子 Session（P5-10a 拓片底图层 / P5-10b 五官拼图层 / P5-10c 官职印信层）
  4. **数据真源同步**:
     - `docs/08-data-dictionary.md`：`OfficerStatic` 新增 `avatarGene?` 字段行 + 子字段表（11 字段：scheme/baseRubbing/faceType/hairType/beardType/eyeType/sealText/royalSeal/clanTitle/officeSeal/ribbonColor）+ 0-A 30 武将填写规则 + 关羽/荀彧示例
     - `docs/03-data-models.md` §21 新增 §21.1-B `AvatarGene` 类型定义（与 §21.1 `SpecialAppearance` 并存职责分离）+ 关羽/吕布/荀彧填写示例
  5. **文档同步**:
     - `docs/01-overview.md` §二设计理念新增「美术基调」行 + 22 大系统同步
     - `docs/07-ui-design.md` 新增 §11.6 武将头像三方案（三层职责表 + A/B/C 技术规格 + 组合渲染流程 + 数据落库 + 实装路线）
     - `docs/09-roadmap.md` P5-10 改述为「金石水墨·免版权组合方案 A+C+B」+ 新增 D-0B-13（UI 字体白名单扫描留 P5-07）
     - `docs/12-system-map.md`：§二新增 S22 + §五 Session 101 记录 + §六技术债表 D-0B-7 更新（含 avatarGene）+ D-0B-13 新增
- 决策清单（Q1~Q4 拍板）:
  - Q1 最高准则落点 = (a) 双写（`AGENTS.md` 核心规则 9 + `00-dev-constitution.md` §十一）
  - Q2 三方案优先级 = (c) 组合方案 A+C+B（A 底图 + C 五官 + B 文字层，三层职责互补）
  - Q3 与 `appearance` 关系 = (a) 新增 `avatarGene` 并存（头像 + 战斗造型职责分离）
  - Q4 字体白名单 = (a) 写入准则 + 替换留 P5-07（固化红线不扩散本轮改动，D-0B-13 登记）**【Session 102 修正：实际改为本轮即实装工程资产闭环，D-0B-13 已实装，剩余 P5-07a~e】**
- 关键架构发现:
  - 现有路线已是"零美术资源 + 纯代码生成"骨架（Session 100 PCG 程序化美术 + appearance 纯几何占位），与用户方针同源
  - Session 100 `appearance` 字段只覆盖战斗演出几何造型，**不覆盖头像底图方案 A/B/C**，本轮 `avatarGene` 补齐这一缺口
  - 1000+ 武将若约稿立绘成本 20 万起（200 元×1000+），且借鉴知名三国游戏构图即收律师函，组合方案 A+C+B 零成本零侵权
  - 玩家审美偏好与硬核史料定位完全契合（金石水墨·拓片·印绶 > 二次元萌娘·页游大翅膀）
- 文件处理:
  - 本轮零代码改动，无新增外部素材（拓片采集留 Phase 5 实装时进行，公有领域不入库不入 git）
- 同步: AGENTS · 00 · 01 · 03 · 07 · 08 · 09 · 12 · 本进度 · HANDOFF
- Next: 总军师系统实装（任命/态势/献策/对决）→ 设施建造回合化 → 势力特点数据 → AI Army 接入。S22 美术基调实装拆 3 子 Session（P5-10a/b/c，Phase 5 排定），S20/S21 前端体验增强实装时机后续排定。

---

## 2026-07-18 — Session 102（跨平台字体防御实装 — S22 首批代码 + 工程规范硬基建）

- Phase: **代码实装 + 工程基建 + 文档固化**（Build Mode，P0+P1 全部实装，零游戏逻辑改动）
- 背景: Linux/Windows/macOS 三平台开发者协作。Linux 极简发行版无 CJK 字体 → Canvas 城市名豆腐块 □□□；Windows ClearType/GBK 编码惯性；macOS Retina/CoreText 渲染差异。Session 101 §11.3 字体白名单仅文档，零落地代码，跨平台必然乱码。
- 实装内容（跨平台字体防御三件套 + 工程规范）:
  1. **资产闭环（Asset Anti-Leakage）**:
     - `client/public/fonts/` 新建目录 + `README.md`（**3 个 woff2 文件已实际下载就位，共 ~7MB**，`.gitignore` 排除不入 git）
     - 字体文件：思源宋体 SC Regular/Bold（`@fontsource/noto-serif-sc` 镜像，SIL OFL 1.1）+ 马善政体 Ma Shan Zheng（`@fontsource/ma-shan-zheng` 镜像，SIL OFL 1.1，替代原计划沐瑶软笔体——未找到可确认授权稳定 woff2 源）
     - `.gitignore` 追加 `*.woff2 *.woff *.ttf *.otf` 排除规则
     - `client/src/styles/fonts.css` 新建：`@font-face` 声明工程内部别名 `HanDynastySerif`（normal+bold）/ `HanDynastySeal`，`font-display: block` 强行阻塞渲染防闪烁
     - `client/src/index.css` 追加 `@import './styles/fonts.css'` + 全局 `font-family: 'HanDynastySerif', serif !important`
     - `client/tailwind.config.js` `theme.extend.fontFamily` 注册 `song` / `seal`
  2. **Canvas 渲染屏障（Font Loading Barrier）**:
     - `client/src/utils/fontBarrier.ts` 新建：`waitForGameFonts()` 用 `document.fonts.load('12px HanDynastySerif')` + `Promise.all` 阻塞等待字形写入内存
     - `client/src/App.tsx` 重构：`isEngineReady` 状态屏障，字体未加载完显示"正在加载工程字体…"占位，加载失败显示错误提示 + woff2 文件放置说明；字体就绪后才调 `boot()` 渲染 Konva Stage
  3. **Konva `<Text>` 全部补 `fontFamily`**（Konva 默认 Arial 跨平台不一致）:
     - `client/src/components/map/MapCanvas.tsx` 4 处：州名 / "己"徽章 / 城市名 / 副标 → `fontFamily="HanDynastySerif"`
     - `client/src/components/battle/BattleView.tsx` 1 处：主将姓 → `fontFamily="HanDynastySerif"`
  4. **跨平台协作工程规范**:
     - `.editorconfig` 新建：`charset=utf-8` / `end_of_line=lf` / `insert_final_newline=true` / `indent_style=space` / `indent_size=2` + Markdown/Python/YAML/Shell 特例
     - `.gitattributes` 新建：`* text=auto eol=lf` + 文本资产强制 LF + 二进制资产（woff2/woff/ttf/otf/png/jpg 等）标 binary
     - `.github/workflows/ci.yml` 新建：push/PR 触发，跑 typecheck/lint/test/validate-data + 编码门禁（`file --mime-encoding` 扫 server/src/data + shared/data + docs/biographies 的 JSON/MD/TS，非 UTF-8 直接 fail）
     - `CONTRIBUTING.md` 新增「跨平台字体铁律」章节：禁宿主系统字体 / 必须用工程内部别名 / FontBarrier / 编码规范 / CI 门禁 / woff2 不入 git
  5. **文档同步**:
     - `docs/00-dev-constitution.md`：§11.3 字体白名单升级为"工程资产闭环"模式（不再依赖宿主系统字体）+ 落地状态 + §11.7 跨平台字体防御与 Linux 适配新增（§11.7.1 资产闭环 / §11.7.2 Canvas 屏障 / §11.7.3 工程规范 / §11.7.4 Linux UI 适配）
     - `AGENTS.md` 核心规则 9 扩展：字体资产闭环 / Canvas 屏障 / 跨平台工程规范三件套
     - `docs/15-linux-ui-spec.md` 新建：Linux UI 与跨平台字体规范完整文档（资产闭环/FontBarrier/工程规范 + P5-07a~e Linux UI 适配留档 + 开源筑巢留档）
     - `docs/12-system-map.md`：S22 D→S/D（壳+部分实装）+ Session 102 记录 + v4.4
     - `docs/09-roadmap.md`：P5-07 拆子任务 P5-07a~e（HiDPI/XDG/伪 Terminal/金石组件/字体补完）
- 决策清单（Q-A~Q-C 我决策）:
  - Q-A 实装范围 = (a) P0+P1 全部实装（约 90 min，跨平台字体防御硬基建）
  - Q-B woff2 来源 = 我直接下载（思源宋体 SC 经 @fontsource/noto-serif-sc 镜像，马善政体经 @fontsource/ma-shan-zheng 镜像，授权均 SIL OFL 1.1；沐瑶软笔体未找到可确认授权源，改用马善政体替代）
  - Q-C Linux UI + 筑巢 = 留 P5-07 文档固化（本轮纯字体防御，不扩散到游戏逻辑）
- 关键架构发现:
  - Session 101 §11.3 字体白名单仅文档，`client/src/` 零落地代码，Konva 默认 `fontFamily='Arial'` 跨平台必然乱码
  - `client/src/App.tsx` 原本 `boot()` 直接渲染 Konva Stage，无 FontBarrier，Linux 极简发行版首屏即豆腐块
  - 全库零 `.editorconfig` / `.gitattributes` / `.github/workflows/`，Windows 协作者 IDE 默认 GBK+CRLF 提交后 Linux 解析乱码
  - Konva `<Text>` 默认 `fontFamily='Arial'` 是隐蔽坑：即便 DOM 全局 `font-family` 锁死，Canvas 不继承 DOM 字体
- 自验证:
  - `pnpm typecheck` ✅ 3/3 包全过（shared/server/client）
  - `pnpm lint` ✅ 3/3 包全过
  - `pnpm test` ✅ 68/68
  - `pnpm validate-data` ✅ 全过（units=9）
  - 字体 woff2 未放入时 FontBarrier 会阻塞显示提示（故意的防御行为，按 README 放入后正常启动）
- 文件处理:
  - 新增：`client/public/fonts/README.md` / `client/src/styles/fonts.css` / `client/src/utils/fontBarrier.ts` / `.editorconfig` / `.gitattributes` / `.github/workflows/ci.yml` / `docs/15-linux-ui-spec.md`
  - 修改：`client/src/App.tsx` / `client/src/index.css` / `client/tailwind.config.js` / `client/src/components/map/MapCanvas.tsx` / `client/src/components/battle/BattleView.tsx` / `.gitignore` / `CONTRIBUTING.md` / `AGENTS.md` / `docs/00-dev-constitution.md` / `docs/09-roadmap.md` / `docs/12-system-map.md`
- **代码审查与 bug 修复（commit 前）**:
  - **bug1 修复**：`fontBarrier.ts` `document.fonts.load()` 在 woff2 缺失时可能永不 resolve 也永不 reject（FontFace API 网络请求失败前一直 pending），导致游戏永远卡在加载屏。加 4s 超时兜底（与 `font-display: block` 的 3s 回退期对齐 + 1s 余量），超时后仍放行渲染让浏览器 fallback 字体生效（优于永久卡死）。新增 `withTimeout()` helper。
  - **bug5 修复**：`client/src/index.css` 的 `@import './styles/fonts.css'` 在 `@tailwind` 之后违反 CSS 规范（`@import` 必须在所有其他规则之前），会被浏览器忽略导致 @font-face 不生效。改为直接内联 @font-face 到 index.css，fonts.css 保留为参考文档不再被 import。
  - **bug10 修复**：`App.tsx` FontBarrier 失败路径（catch 分支）只显示提示文字无重试按钮，玩家会卡死。补"重试加载字体"按钮 + `fontRetryNonce` 状态触发 useEffect 重跑。
  - **无 bug 确认**：MapCanvas 4 处 + BattleView 1 处 Konva `<Text>` 全部补齐 `fontFamily="HanDynastySerif"`，无遗漏；StrictMode 双跑下 `cancelled` 防御正确（boot 只触发一次）；CI YAML 语法验证通过；.editorconfig 语法验证通过；tailwind fontFamily 注册正确。
- 同步: AGENTS · 00 · 09 · 12 · 15 · 本进度 · HANDOFF · CONTRIBUTING
- Next: 总军师系统实装（任命/态势/献策/对决）→ 设施建造回合化 → 势力特点数据 → AI Army 接入。S22 Linux UI 适配（HiDPI/XDG/伪 Terminal/金石组件库）+ 开源筑巢（武将传记拆分/README 工程师段）留 P5-07a~e。S22 武将头像组合方案 A+C+B 实装拆 3 子 Session（P5-10a/b/c，Phase 5 排定）。

## 2026-07-19 — Session 103（CI typecheck 修复：shared 新环境下类型解析失败）

- Phase: **bug 修复**（零设计改动，仅工程配置修复）
- 问题: CI 中新环境 `pnpm install` → `pnpm -r typecheck` 时，
  server typecheck 找不到 `@leh/shared` 模块（TS2307）。
- 根因: `shared/package.json` 的 `exports.types` 指向 `./dist/index.d.ts`，
  `dist/` 被 `.gitignore`，CI 全新环境不存在。
  `pnpm -r typecheck` 按拓扑序先跑 shared（`tsc --noEmit` 不生成 dist），
  然后 server（`tsc --noEmit`）时无法解析 `@leh/shared` 的类型声明。
- 修复: shared 的 `typecheck` / `lint` 脚本去掉 `--noEmit`，
  使 shared typecheck 时同时 emit 出 `dist/` 供下游使用。
  这是 monorepo 中底层包的标准做法（被引用的包必须先 build 出 .d.ts，
  上层才能解析类型）。
- 文件变更: `shared/package.json`（2 行）
- 验证: 模拟 CI 全新环境（删 dist → `pnpm install --frozen-lockfile` →
  `pnpm -r typecheck`/`pnpm -r lint`/`pnpm test`/`pnpm validate-data`）全部通过。
- 文档同步: 本进度 · HANDOFF
- Next: 同 Session 102 Next

## 2026-07-19 — Session 104（0-A 英雄集结 Demo：纯数据整合与实跑审计）

- 范围：严格遵守用户拍板的“仅数据整合”，未修改 `server/src/engine`、路由、服务或客户端运行时代码。
- 数据：ID100~111 的12个占位位替换为许褚、曹仁、李典、吕虔、高顺、孙策、甘宁、徐盛、周泰、公孙瓒、臧霸、张嶷；加上既有夏侯惇，覆盖设计指定的12名史载部曲持有者。0-A 仍为30武将（27史实+3占位）。
- 场景：场景1改为 `英雄集结·开局即高光（0-A Demo）`，保持190年、30城、4势力、what-if/noLifespan；江陵提供刘备+张飞+赵云+公孙瓒+诸葛亮编成，襄阳关羽—宛许褚用于独立六角触点，番禺作为战役围城目标。
- 文档：新增 `docs/16-demo-build-playbook.md`。部曲明确为“史载武将作为普通副将”的替代展示；屯田明确以农业开发替代且196年屯田令不作必经；主副将编成与单挑分开展示，S21仍未实现。
- 实跑：无头浏览器实际点击完成江陵选城、赵云任将军、刘孙结盟、招募密探并探秘番禺（本次随机失败但任务正常结算）、江陵农业310→336、刘备主将+张飞/赵云/公孙瓒副将+诸葛亮参谋编成出征、结束回合进军番禺、强攻获胜并打开自动战斗报告；另以 API 黑盒确认离间引擎可结算。六角 API 流程确认关羽(ID6)对许褚(ID100)，逐回合移动至相邻。
- UI审计校正：开局计谋面板的目标城要求 `detailed` 情报，不能直接按势力发起离间；Demo 必经项改为已实点通过的谍报任务，离间/假情报降为取得详细情报后的选做项。
- 新发现（未修，保持边界）：`battleChallengeDuel()` 在持有 `withLock` 时调用同样加锁的 `battleDuelStep()`；接受挑战会返回400“操作处理中”。单挑引擎 `verify-duel.ts` 全断言通过，但 UI/API 接受链路不能标为已验证可玩。
- 验证：`pnpm validate-data` ✅；`pnpm test` ✅ shared 3文件/68纯函数；`pnpm -r typecheck` ✅；`pnpm -r lint` ✅；`verify-duel`/`verify-crit`/`verify-campaign`(57/57)/`verify-fire-tactic`/`verify-child-engine` ✅。
- Next：若用户另行授权运行时代码，优先消除单挑接受链路嵌套锁；否则按 `docs/16` 演示其余已验证流程，继续保持部曲/屯田/S21为设计状态。

## 2026-07-19 — Session 105（大地图命令 UI 与文教技艺规则收敛，纯设计）

- 范围：只更新设计、接口、系统地图与交接文档；零客户端/服务端运行时代码，未改变任何数据规模。
- 大地图命令：拍板底部固定九类命令坞 `内政/军事/人事/外交/计略/情报/屯田/家族/朝廷`，独立朱砂 `进行` 按钮；系统菜单、地图工具和通知中心与游戏命令分离。
- 交互协议：状态变更命令统一走“侧边抽屉配置 → 居中终审询问窗 → 确认/取消”；取消保留参数，确认前不得发送变更 API，提交时防重，失败保留上下文；只读浏览与地图工具不弹窗。
- 结束本季：采用加强版终审，汇总空闲要员、待答复提议、强制事件、Army/补给/疫病警告以及即将完成任务；强制事件未处理时禁止推进，其他提示不强制清空。
- 信息架构：统一 Campaign Army 出征入口；爵位归朝廷、官职归人事；屯田保持独立一级；情报内部拆谍报/反间；存储/载入继续标 S16 设计中；瓮城只预留建设状态，不定义未拍板的战斗数值。
- 文教收敛：玩家术语统一为文教（教育）、声教（城市文化发展值）、学派（七倾向）、技艺与制度（势力研发）；修复早期草案 `culture` 数值/对象重名，预留 `culturalDevelopment` 与 `schoolInfluence`。
- 长期规则：学官改为持续职务；文教提供即时/中期/长期反馈；势力同一时间单研发槽，首都声教控制立项门槛，各城共同影响速度；学派不能用直接花钱按钮刷值。
- 文档同步：`03-data-models.md` v2.5、`04-game-systems.md` v4.3、`06-api-design.md` v2.4、`07-ui-design.md` v2.9、`12-system-map.md` v4.6、本进度与 `HANDOFF.md`。
- 状态：以上均为 S20/相关未来系统技术储备，必须标“设计中”；不代表教育、技艺、学派、存档、瓮城战斗或新大地图命令已经可玩。
- 交接前复验：`pnpm validate-data` ✅（30武将/30城/9兵种等全量0-A数据）；`pnpm test` ✅（shared 3文件/68纯函数）；`pnpm -r typecheck` ✅；`pnpm -r lint` ✅；`git diff --check` ✅。
- 语义复验修正：清理 §34.4/§38.1/§38.7 与旧城市文化面板残留的 `teacherId/CityCulture/culture/techProgress` 双真源，统一到 Session 105 新字段；再次扫描无旧结构性字段残留（历史日志引用保留）。
- Next：按用户方向继续讨论历史剧本与历史剧情；运行时优先级仍遵循 S01~S22 与 0-A 边界，不因本轮文档扩展而提前实现。

## 2026-07-19 — Session 106（190《关东义兵》条件式历史切片）

- 范围：主攻 S14 事件与 S16 剧本；保持30城/30将/5事件，不进入约30势力的0-B数据扩容。
- 数据：保留英雄集结场景1，新增场景2《关东义兵（190·0-A技术切片）》；董卓/袁绍/孙坚替换最后3个占位，0-A成为30名史实武将。190可玩槽为曹操义兵、袁绍河内军、孙坚鲁阳军、董卓政权。
- 边界：河内、鲁阳不在30城地图，壶关/宛仅作补给节点代理并在UI展示史实说明；不宣称袁绍占上党或孙坚独占南阳。真正无城军团、寄驻、袁术—孙坚从属控制仍未实装。
- 场景隔离：新增 `factionSetups/eventIds/availableOfficerIds/availableFemaleIds/childEventIds/availableEventLayers/defaultEventLayers`；英雄集结 `eventIds=[]`，190只加载11名白名单武将、0名女性、0个子女事件，不再把全局角色自动变为在野或跨年补登。
- 事件：5条改为陈留起兵、推举盟主、迁都长安、汴水追击、虎牢关传奇。前4条标正史，第5条标文学；支持年月窗口、前置、前序选择条件、互斥、过期失效、决策势力、结果记录，以及AI基础权重+领袖性格+理想确定性选择。曹操观望、董卓固守或陈留失守均会阻止汴水追击。
- UI/API：ScenarioSelect可选两剧本、四势力与传奇开关；TopBar可更换剧本；EventDialog显示史源与来源，目录缺失时不再自动选0。`POST /api/game/create` 接收并校验 `eventLayers`。
- 清债：删除所有场景通用的武将ID111强制释放种子；英雄集结文档同步改为按场景配置。
- 数据门禁：`validate-data.ts` 的场景期望改为2，并新增剧本/势力/领袖/据点/角色/子女/事件/史料层双向引用与条件/效果能力检查。旧 `generate-0a-data.ts` 已冻结为 fail-fast，防止重跑覆盖手工真源；待重写后再启用。
- 自验证：`pnpm verify-scenario-events` 32项断言通过；真实HTTP完成 `static → create(场景2/曹操) → end-turn(二月pending 100) → event/choose(completed+eventChoices)`；Headless Chrome 实际点击完成“选关东义兵→选曹操→进入→结束回合→继续→散财合兵”，事件弹窗正常关闭；客户端生产构建、typecheck、validate-data通过。
- 简化标注：AI事件选择已读取权重/性格/理想，但尚不是P5正式利益评估AI；190仍是四槽技术切片，不是全势力历史剧本完成。
- Next：先设计并实现无城军团/移动总部/寄驻/从属军判别模型，再制作190约30势力全量开局；仍须遵守0-B暂缓，需用户再次明确授权扩容。

## 2026-07-19 — Session 107（Session 106 新增功能独立复验）

- 范围：只验证 Session 106 的 S14/S16 新增功能并记录结果；未修改运行时代码、数据、规则或数据规模。
- 工程门禁：`pnpm build`、`pnpm typecheck`、`pnpm lint` 全部通过；生产构建仅保留既有 679.23 kB chunk 警告，不影响构建成功。
- 基础回归：`pnpm test` 通过（shared 3 文件、68/68）；`pnpm validate-data` 通过（30武将/30城/6阵型/9兵种/20宝物/10女性/5子女/30技能/2剧本/5事件，13州、坐标及场景事件跨文件引用通过）。
- 场景事件专项：`pnpm verify-scenario-events` 32/32，通过两剧本隔离、190四势力初始化、11名武将/0女性白名单、玩家与AI事件选择、前置与反事实阻断、迁都效果、陈留归属条件、子女白名单、文学层开关、过期失效和待决队列顺序。
- 相关引擎回归：`verify-campaign.ts` 57/57；`verify-child-engine.ts` 4项；`verify-fire-tactic.ts` 4项；`verify-duel.ts` 与 `verify-crit.ts` 全部断言通过。
- 浏览器实操：Headless Chrome 重新实际点击“选择《关东义兵》→选择曹操义兵→进入剧本→结束回合→打开陈留起兵→继续→选择散财合兵，移书诸军”；事件正常结算并关闭，当前构建主路径通过。
- 结论：Session 106 新增功能复验通过，未发现新增阻断或行为回归。既有六角单挑接受入口嵌套锁缺陷仍未修，本轮流程未触及该缺陷。
- 文档同步：仅更新本进度与根目录 `HANDOFF.md`；无功能或设计变化，因此不改其他设计文档。
- Next：若继续190，先设计并实现无城军团/移动总部/寄驻/从属军判别模型；约30势力全量开局仍属0-B，需再次明确授权。

## 2026-07-19 — Session 108（文档漂移校正）

- 范围：只修订文档摘要、编号和版本引用；零运行时代码、数据、规则或规模变更。
- 数字真源同步：P0B-14 从含糊的“5+剧本”改为 `08-data-dictionary.md` 已定的“首批7历史剧本+英雄集结”；未修改08真源。
- 编号统一：当前 0-B 前置技术债统一为 D-0B-1~13，并补回 D-0B-13 已实装状态；S20/S21 未来实装统一使用 S20-W1~W4、S21-W6~W9，避免与实际 Session 100~107 冲突。历史日志保留当时语境并注明现编号。
- 字体与任务状态：HANDOFF 的 `HanDynastySeal` 从错误的沐瑶软笔体校正为实际资产马善政体；P5-07e 改为基础 woff2 已就位，仅余字重扩展与完整性复核。
- 版本引用：HANDOFF 的系统地图/UI 摘要校正为 v4.8/v3.0；系统地图升至 v4.8。
- 验证：相关旧摘要交叉检索，仅剩 Session 100/102 的历史事实表述；`git diff --check` 通过。

## 2026-07-19 — Session 109/110（190场景事件链扩展+玩家抉择系统）

- 范围：将190场景事件从5个扩展至24个，新增玩家抉择系统（decisionOfficerId）。
- 类型扩展：EventEffect.type 新增 `gold | food | population`；EventTemplate 新增 `decisionOfficerId` 字段。
- Zod Schema：同步新增字段验证。
- 引擎变更：
  - `resolveDecisionFaction()` 函数：动态解析决策势力（decisionOfficerId > decisionFactionId > null）。
  - `applyEffect()` 新增 gold/food/population 三个 case。
  - `tickEvents()` 和 `resolveEventChoice()` 改用动态解析。
  - `chooseForAi()` 改用动态解析。
- 验证脚本：effectTargets 新增3种类型 + validation rules + decisionOfficerId 兼容。
- 事件数据：5→24事件（新增19个：E105-E123），5条叙事线。
- 场景数据：scenarios.json eventIds 更新为 [100-123]。
- 设计文档：新增 `docs/17-player-choice-system.md`（玩家选择抉择系统设计草案）。
- 验证结果：
  - `pnpm typecheck` ✅
  - `pnpm validate-data` ✅ (24事件全部通过)
  - `pnpm verify-scenario-events` ✅ (32项断言通过)
  - `pnpm test` ✅ (68/68通过)
- 文档更新：02-architecture v2.3、08-data-dictionary v1.9、10-progress v6.9、12-system-map v4.9。
- Next：若继续190，先设计并实现无城军团/移动总部/寄驻/从属军判别模型；约30势力全量开局仍属0-B，需再次明确授权。


---

## 2026-07-19 — Session 110（武将数值扩充 Phase 1-1：曹魏核心12人录入）

- Phase: **数据录入 + 验证**
- 新增武将（ID 115~126，共12人）:
  - **五子良将**：张辽(95/92/78/58/82)、徐晃(91/90/74/55/72)、张郃(90/88/70/50/65)、于禁(88/82/72/65/55)、乐进(84/88/60/42/68)
  - **宗亲大将**：夏侯渊(88/91/52/40/62)、曹洪(78/82/42/38/50)、曹真(86/72/76/70/65)
  - **谋臣**：荀攸(58/26/94/90/70)、贾诩(62/30/97/85/60)、郭嘉(60/18/98/70/78)、程昱(70/55/85/80/50)
- 每名武将完整填写：五维 + 隐藏属性19项 + 12兵种适性(含弓兵/水军/攻城/弓骑) + 阵型精通 + 技能 + 出身标签
- 水军适性：统兵武将至少C，纯文官(荀攸/贾诩/郭嘉/程昱)为NONE
- 验证: `pnpm validate-data` ✅ 42/42 全过
- 同步: `docs/14-officer-stats-reference.md` 附录六更新为42人 + 版本v1.3
- 规则: 原有30名武将数值一律未改动
- Next: Phase 1-2 蜀汉核心人物录入（庞统/法正/姜维/魏延/马超/马谡/王平等）

---

## 2026-07-19 — Session 111（武将数值扩充 Phase 1-2：蜀汉核心14人录入）

- Phase: **数据录入 + 验证**
- 新增武将（ID 127~140，共14人）:
  - **麒麟阁核心**：庞统(72/35/97/78/50)、法正(78/40/94/70/32)、姜维(90/88/91/52/68)、魏延(86/91/70/40/42)
  - **五虎补齐**：马超(87/97/48/28/72)
  - **蜀汉诸将**：马谡(55/35/82/72/40)、王平(82/72/72/48/58)、廖化(72/70/60/42/65)、严颜(74/78/60/45/72)、张翼(75/68/62/58/60)、霍峻(82/65/60/40/72)
  - **文臣**：蒋琬(62/25/82/92/80)、费祎(60/30/80/88/75)、邓芝(70/50/78/75/82)
- 每名武将完整填写：五维 + 隐藏属性19项 + 12兵种适性 + 阵型精通 + 技能 + 出身标签
- 验证: `pnpm validate-data` ✅ 56/56 全过
- 同步: `docs/14-officer-stats-reference.md` 附录六更新为56人 + 版本v1.4
- 规则: 原有30名武将数值一律未改动
- Next: Phase 1-3 东吴核心人物录入（鲁肃/吕蒙/黄盖/程普/韩当/太史慈/凌统/丁奉/张昭/顾雍/诸葛瑾等）

---

## 2026-07-19 — Session 112（武将数值扩充 Phase 1-3：东吴核心15人录入）

- Phase: **数据录入 + 验证**
- 新增武将（ID 141~155，共15人）:
  - **四大都督**：鲁肃(85/58/90/88/94)、吕蒙(90/82/84/60/68)、陆抗(93/65/88/78/75)
  - **十二虎臣**：程普(80/78/66/50/70)、黄盖(82/84/72/48/78)、韩当(76/80/55/35/55)、蒋钦(72/70/58/40/60)、陈武(62/80/30/20/45)
  - **名将**：太史慈(82/93/58/30/82)、凌统(80/84/55/35/70)、丁奉(82/85/66/30/55)、朱桓(80/78/72/35/55)
  - **谋臣**：张昭(35/10/85/95/65)、顾雍(40/15/78/92/72)、诸葛瑾(55/30/80/85/82)
- 每名武将完整填写：五维 + 隐藏属性19项 + 12兵种适性(东吴武将水军普遍A/S) + 阵型精通 + 技能 + 出身标签
- 验证: `pnpm validate-data` ✅ 71/71 全过
- 同步: `docs/14-officer-stats-reference.md` 附录六更新为71人 + 版本v1.5
- 规则: 原有30名武将数值一律未改动
- Next: Phase 1-4 群雄·其他势力核心人物（袁绍集团/刘表/刘璋/马腾/张鲁/吕布集团等）

---

## 2026-07-19 — Session 113（武将数值扩充 Phase 1-4：群雄·其他势力32人录入）

- Phase: **数据录入 + 验证**
- 新增武将（ID 156~187，共32人）:
  - **袁绍集团**：田丰(50/15/93/82/55)、沮授(60/20/91/78/60)、审配(65/35/80/85/50)、颜良(78/94/40/18/50)、文丑(75/93/38/15/45)、高览(72/80/45/25/40)、郭图(30/12/60/55/25)、逢纪(35/15/55/58/30)、许攸(25/8/78/30/12)
  - **吕布集团**：陈宫(75/45/88/78/58)、曹性(35/58/22/8/25)
  - **刘表集团**：刘表(68/45/72/82/80)、蔡瑁(70/40/60/62/30)、蒯越(45/25/80/82/55)、黄祖(72/68/45/30/25)
  - **刘璋集团**：张任(80/82/68/30/72)、张松(22/8/78/65/18)
  - **马腾集团**：马腾(78/80/52/42/75)、韩遂(76/70/65/55/62)
  - **张鲁集团**：张鲁(65/40/68/70/72)、阎圃(35/15/72/70/55)
  - **董卓余部**：李傕(72/72/42/20/15)、郭汜(65/70/38/15/12)、张济(60/65/42/20/25)、樊稠(58/68/30/12/18)
  - **袁术集团**：袁术(55/50/55/50/20)、纪灵(68/78/42/20/40)
  - **黄巾**：张角(72/20/80/30/95)、张宝(62/35/55/15/60)、张梁(58/32/45/12/55)
  - **其他**：华佗(15/12/84/30/72)、士燮(58/30/65/82/68)
- 验证: `pnpm validate-data` ✅ 103/103 全过
- 同步: `docs/14-officer-stats-reference.md` 附录六更新为103人 + 版本v1.6
- 规则: 原有30名武将数值一律未改动
- Phase 1 目标 ~100 人，已超额完成（103人）
- Next: Phase 2 中坚将领录入（曹魏二线/蜀汉后期/东吴补充/晋系等）

---

## 2026-07-19 — Session 114（武将数值扩充 Phase 2-1：中坚将领32人录入，累计135人）

- Phase: **数据录入 + 验证**
- 新增武将（ID 188~219，共32人）:
  - **曹魏二线**：曹彰(75/92/40/25/60)、曹休(82/78/65/55/60)、夏侯尚(78/72/68/60/55)、文聘(82/80/68/55/70)、庞德(78/94/52/30/68)、满宠(84/50/80/82/68)、刘晔(65/35/91/80/62)、董昭(55/25/78/92/65)
  - **蜀汉后期**：徐庶(60/45/90/75/82)、关平(62/78/58/35/68)、周仓(40/78/20/5/55)、李严(60/40/80/88/48)、吴懿(78/72/55/45/60)、向宠(76/60/55/50/65)、简雍(30/20/60/62/72)、孙乾(25/15/58/65/68)、马忠(48/32/78/80/55)
  - **东吴补充**：潘璋(70/82/48/28/30)、董袭(68/78/42/25/55)、朱然(82/72/66/50/62)、诸葛恪(78/42/88/82/55)、步骘(60/35/72/80/65)
  - **晋系**：司马师(84/60/82/78/55)、司马昭(88/55/80/80/50)、邓艾(94/85/90/52/45)、钟会(82/45/92/78/55)、羊祜(93/60/86/90/85)、杜预(91/55/82/88/68)、王濬(88/50/74/62/55)、文鸯(75/95/45/20/58)、诸葛诞(78/65/68/60/62)、司马炎(70/52/62/72/55)
- 验证: `pnpm validate-data` ✅ 135/135 全过
- 同步: `docs/14-officer-stats-reference.md` 附录六更新为135人 + 版本v1.7
- 规则: 原有30名武将数值一律未改动
- Next: Phase 2-2 继续扩充（各势力二线将领、地方官吏等）

---

## 2026-07-19 — Session 115（武将数值扩充 Phase 2-2：二线将领32人录入，累计167人）

- Phase: **数据录入 + 验证**
- 新增武将（ID 220~251，共32人）:
  - **曹魏补充**：曹植(42/35/78/72/82)、曹昂(55/65/50/35/72)、曹纯(72/70/55/40/55)、郝昭(84/78/68/45/65)、郭淮(82/72/75/65/60)、孙礼(78/76/62/50/65)、毌丘俭(80/65/72/68/55)、王昶(76/50/78/82/65)、陈泰(82/55/80/75/68)、邓飏(30/12/55/50/20)、李胜(25/10/50/45/18)、何晏(20/15/65/60/30)
  - **蜀汉补充**：刘封(68/78/50/30/55)、冯习(72/70/45/25/50)、张南(65/68/40/20/45)、傅彤(60/72/35/20/65)、程畿(55/30/72/65/60)、陈到(78/80/60/35/65)、马岱(74/82/55/30/65)、高翔(70/65/50/35/50)、张嶷(74/72/68/62/78)、黄权(72/50/78/75/65)
  - **东吴补充**：徐盛(82/78/70/42/68)、贺齐(78/75/65/50/60)、全琮(72/65/68/60/55)、吕范(55/25/78/85/60)、周鲂(60/30/80/55/50)、钟离牧(76/65/70/60/65)
  - **群雄补充**：刘繇(65/45/60/65/70)、孔融(25/12/72/75/80)、陶谦(55/30/55/65/72)、公孙度(70/55/60/72/45)
- 验证: `pnpm validate-data` ✅ 167/167 全过
- 同步: `docs/14-officer-stats-reference.md` 附录六更新为167人 + 版本v1.8
- 规则: 原有30名武将数值一律未改动
- Next: 可继续 Phase 2-3 或切换至其他任务

### Session 116 · oh-my-openagent 安装配置 · 2026-07-19

- **oh-my-openagent 安装**：oh-my-openagent v4.19.0 安装于 OpenCode 1.18.3（Ultimate edition）
- **模型配置**：11个 agent 全部配置 OpenAI GPT-5.x 模型（omni/gpt-5.4-pro/gpt-5.4/gpt-5.3-codex/gpt-5.2-pro/gpt-5.2-mini/gpt-5.2-nano）
- **ast-grep 验证**：ast-grep 0.44.1 通过 `OMO_AST_GREP_SG_PATH=$(which sg)` 验证可用
- **配置文件**：`~/.config/opencode/oh-my-openagent.json`（agent/model 映射）+ `~/.config/opencode/opencode.jsonc`（插件注册）
- **验证**：`bunx oh-my-openagent doctor` 全部通过 ✅
- **规则**: 无代码/数据/规则变更

## 2026-07-19 — Session 117（文档漂移校正）

- 范围：只校正文档摘要、数字真源与版本引用；零运行时代码、数据或规则变更。
- 当前文件事实：`officers.json` 实测199条、`events.json` 24条、`scenarios.json` 2条；0-A验收基线仍为30名武将，Phase 0-B 1000+全量目标继续暂缓。
- 武将口径：将08数字真源、P0A-06、路线图、系统摘要、武将数值参考与HANDOFF从30/42/167等过期当前值统一为“0-A验收基线30、当前实际199”。当前199由基线30、Sessions 110~115新增137以及当前已存在的ID 252~283共32人组成。
- 事件口径：将路线图、08事件章节、S14与HANDOFF统一为190共24事件/5条叙事线；修正 E105~E123 为新增19个而非18个。
- 爵位口径：将01概述和04俸禄摘要中的爵12统一为Session 93定稿的7级。
- 文档同步：`08-data-dictionary.md` v2.0、`01-overview.md` v2.3、`04-game-systems.md` v4.5、`09-roadmap.md` v1.8、`12-system-map.md` v5.0、`14-officer-stats-reference.md` v1.9、本进度与 `HANDOFF.md`。
- 验证：JSON实测 officers=199/events=24/scenarios=2；同步 `validate-data.ts` 人数门禁后 `pnpm validate-data` 全部通过；当前摘要旧口径交叉检索清零；`git diff --check`通过。
- Next：保持既定队列；若继续190，先做无城军团/移动总部/寄驻/从属军模型；约30势力全量开局和1000+武将仍属0-B，需再次明确授权。

## 2026-07-19 — Session 118（武将数据扩充）

- 范围：`officers.json` 新增 ID 284~307 共24人（群雄势力、特殊人物与后期人物），不改动既有条目；`validate-data.ts` 武将数量门禁由199更新为223。
- 数据兼容：史料未详出生年使用 `0`；未详卒年采用提供的 `hidden.lifespan`。原始资料中不受当前 Zod 枚举支持的性格/理想值映射为既有枚举，以保持静态数据可验证；祝融按 `08-data-dictionary.md` 既定"唯一可出战女将"例外录入。
- 文档同步：先更新08数字真源，再同步路线图、系统图、武将数值参考、本进度与 `HANDOFF.md` 的当前武将数为223。
- 验证：`pnpm --filter @leh/shared build && pnpm validate-data` 通过，输出 `officers.json (223)`；`pnpm --filter @leh/server typecheck` 通过；JSON 解析与新增 ID 连续性检查通过。
- Next：保持既定队列；0-B全量武将扩容仍暂缓。

## 2026-07-19 — Session 119（委任军团系统设计——文档设计）

- **范围**：新增 §三十九 委任军团系统完整设计，覆盖地域划区委任区（10区）、官职/爵位门槛（太守～皇帝）、都督委任AI（四方针·自动内政/出征/可配人事）、外交君主统一权责边界、委任报告机制、委任面板UI原型。所有设计均为文档层（零代码），引擎UI待实装。
- **设计要点**：
  - 委任区按地域划分（中原/河北/荆襄/江东/巴蜀/关陇/徐州/幽燕/交广/淮南），玩家可自由调整划城
  - 首都不可委任；都督需≥太守官职；管辖城数上限受官职等级+爵位等级双重制约
  - 四方针（发展/军备/平衡/攻略）驱动AI内政权重与出征积极性；委任效率公式=60%基础+统率/政绩修正
  - 委任AI复用现有内政引擎（S03）+ 出征引擎（S05）做方针权重调校，不开发全新决策树
  - 外交/计谋/宝物/中央官职/爵位晋升等统一由君主保留，委任区无权
  - 每季生成委任报告（含兵力金粮变化/行动摘要/事件警告）
- **文档同步**：`04-game-systems.md`（新增 §三十九完整设计）→ `03-data-models.md`（§21.4 新增 DelegationRegion/DelegationReport 类型）→ `07-ui-design.md`（§10.7 新增委任面板UI设计）→ `12-system-map.md`（S03/S05/S12成熟度更新+委任标记）→ `01-overview.md`（系统深化表+大系统总纲加入委任军团）→ 本进度与 `HANDOFF.md`。
- **设计限制标注**：
  - 简化版标注：首版委任AI为"现有AI引擎+方针权重调整"轻量组合，不开发独立决策树
  - 委任AI不出战役层，只走旧邻接出征→自动战斗，不建战役层Army
  - 0-A 30城阶段简化为4~5委任区，0-B 105城时扩展至全10区
- **验证**：设计文档一致性检查（§三十九设计 → 数据模型 → UI面板 → 系统地图 → 概览摘要逐层对应）
- **Next**：委任引擎实装属于原队列前置项（总军师→设施→势力特点→委任引擎→AI Army），待排期；保持0-B暂缓。

## 2026-07-20 — Session 120（阵型系统全面重设计——文档设计）

- **范围**：阵型系统从单层修饰性数据重写为双轴成长+科技树+水阵分支+陆水交互的完整子系统。所有设计均为文档层（零代码），数据与引擎待实装。
- **设计要点**：
  - **双轴成长**：等级 Lv1~Lv5 为主轴，每级提升阵型属性修正；Lv5 后溢出 500 熟练度解锁「极」（质变效果）
  - **阵型规模**：27 种（18 陆阵 + 9 水阵 ID 18~26），独立计算经验/等级/熟练度
  - **科技树前置**：高阶阵型需要前置阵型达到指定等级方可使用，每位武将独立计算
  - **水阵体系**：9 种按功能分 5 层（先登→突击→奇袭→总攻→旗舰），独立科技树分支
  - **陆水交互**：水阵在陆地效果 ×60%；陆阵在水域按水军适性衰减（NONE=无阵攻防-30%）
  - **极效果**：27 种全部独立（方阵免疫围剿/八卦阵自身永远有利地形/水龙阵暴雨场景双方全属性+5%等）
  - **暴击/反击/连击联动**：27 阵型全部配置修正系数
  - **切换规则**：战斗准备阶段可切换/战前协定/突袭可能打乱阵型
- **文档同步**：`05-combat-system.md` §4 完整重写 → `03-data-models.md` §9 Formation/Officer 类型扩展（levels/tiers/ultimate/family/prerequisites/formationProficiency）→ `08-data-dictionary.md` §二 formations.json 字段扩展 → `04-game-systems.md` §十九 新增阵型养成子章节 → `01-overview.md` 阵型规模 18→27 + 系统总纲加入阵型双轴成长 → `12-system-map.md` S10 条目添加阵型设计标注 → 本进度与 `HANDOFF.md`。
- **设计限制标注**：所有设计为文档层，0-A 可用小数据集验证（6 陆阵简化版本即可走通阵型等级/熟练度循环），9 水阵和全量 27 极效果留 0-B 或 Phase 3 实装
- **验证**：设计文档一致性检查（05 §4 完整重写 → 03 类型定义 → 08 字典字段 → 04 养成系统 → 01 摘要 → 12 系统图逐层对应）
- **Next**：阵型系统各项设计已就绪，实装时机建议紧随 0-A 基础战斗环打通后；保持原队列与 0-B 暂缓不变。

---

## 2026-07-20 — Session 121（工程器械与城防体系设计——文档设计）

- **范围**：将 §15 从基础设施表扩展为完整的工程器械+城防体系，包含6种攻城器械等级体系、结构性/战术性双层城防、瓮城阶段式守城、专属武将联动。所有设计为文档层（零代码）。
- **设计要点**：
  - **6种攻城器械**：冲车/云梯/井阑/连弩车(新增)/发石车(新增)/投石车，每种 Lv1~Lv3，与工巧技能挂钩
  - **资源体系**：木材（战场采伐或补给线运输）+铁（随军携带），器械建造消耗木+铁
  - **结构性城防**：护城河(等级≥2)/瓮城(≥3)/千斤闸(≥5)/宫墙(6)，内政→城防工程建造
  - **战术性城防**：围城期间追加建造（羊马墙/弩台/狼牙拍/热油池/地听/夜袭队），消耗金+木
  - **瓮城阶段**：外门→瓮城伏击(三面射台·攻防-20%)→内城 三段式流程，嵌入战役层自动战斗算法
  - **云梯核心价值**：可跳过瓮城直接登内城墙
  - **后撤加成保留**：守方每退一层下一层防+20%
  - **4个死斗区**：叙述概念，游戏层面表现为瓮城阶段兵力损失率×1.5
- **文档同步**：`05-combat-system.md` §15 全量重写（§15.1~§15.10）+ §16 围城/强攻更新操作选项和分阶段推演 → `03-data-models.md` §20.3/20.3-B/20.4 新增 siegeEngine/CityFortification/TacticalDefense/SiegePhase 类型 → `07-ui-design.md` §12.6 瓮城"未拍板"→已定案 → `12-system-map.md` S10 更新 → 本进度与 `HANDOFF.md`。
- **设计限制标注**：0-A 简化子集（3种器械·只耗金·即时建造·简化瓮城判定），全量留 0-B
- **验证**：设计文档一致性检查（§15 各子节之间 → 03 数据模型 → 07 UI标注 → 12 系统图逐层对应）
- **Next**：工程器械与城防体系设计已就绪，实装时机待后续排期；保持原队列与 0-B 暂缓不变。

---

## 2026-07-20 — Session 122（武将界面 + 人事操作终审窗）

- **范围**：S20-W4 首个可玩切片；纯前端界面与交互复用现有人事 API，不改服务端规则、静态数据或规模数字。
- **已实现**：`OfficerRosterPanel` 己方在职武将名册（姓名检索、统/武/智/忠诚/姓名排序、驻地/状态、低忠诚红框）；点击打开 `OfficerDetail`，展示年龄/驻地/忠诚/功绩、明五维条、三轨官职/爵位、技能、兵种适性、标签家族与运行时状态。
- **统一终审**：新增 `CommandConfirmDialog`；搜索、登用、任命/解职、美女库存赏赐均在 API 调用前展示执行者、目标、消耗、耗时、收益/风险；取消保留参数，提交时按钮锁为"传令中"，服务端失败保留窗口并展示错误。
- **边界**：S20-W4 仍为 `[~]`；派系面板、外交雷达、财政飘字、行政总署完整重组未实现；头像 A+C+B 仍属 P5-10，不以临时商业/现代立绘替代。
- **验证**：`pnpm --filter @leh/client typecheck` 通过；Headless Chrome 实际展开人事→看到10名曹操军武将→点击曹操打开详情→打开搜索终审→取消返回保留参数→再次确认提交，窗口关闭、顶部资源由 38,080 变为 38,052 且搜索反馈出现。
- **Next**：可继续 S20-W4 的行政总署重组/派系面板，或恢复既定总军师系统优先队列。

---

## 2026-07-20 — Session 123（三层战斗架构设计定稿）

- **范围**：纯文档设计。全面重新定义战斗系统架构，从单层战役层扩展为三层（战场地图层 + 白刃战层 + 战术要素层）。
- **设计决策**：
  - 战场地图按战争独立生成，覆盖目标郡 + 邻接节点（0-A：3~7 城子集）
  - 行政大地图与战场地图两画面并存，行军代码抽出 shared/ 复用
  - 白刃战三入口：自动结算（复用 §17）/ 标准模式（新 runMeleeRound）/ 微操（复用 battle.ts）
  - 战术点系统：5+1/回合，上限 10，消耗于战法/计谋/单挑/变阵/突击/坚守
  - 0-A 6 阵型 Lv1，无科技树无双轴成长
  - 微操入口受限（猛将对决或兵力接近），不支持中途切模式
  - 多军同节点 0-A 简化（一节点一军）
  - W7 hex 沙盘降级为微操模式视图，非必经层级
  - 总军师态势加成接入战场地图层
- **冲突解决**：确认并处理了 5 个设计冲突（概念/引擎/层级/入口/加成）和 2 个设计悖论（多军/互转）
- **文档变更**：`05-combat-system.md` 新增 §二十（约 20KB 设计定稿）；header 更新反映三层架构
- **Next**：实装路径待排定，建议优先实现战场地图画面 + 标准模式引擎

---

## 2026-07-21 — Session 124（代表武将人物简册切片）

- **范围**：继续 S20-W4 武将界面，并以 S22 美术规范制作首批程序化人物头像；未新增并列大系统，不改战斗规则、API 或静态数据规模。
- **已实现**：新增 `OfficerPortrait`，以工程内部 SVG/CSS 绘制拓印轮廓；吕布、关羽、诸葛亮、曹操分别使用飞将/名将/军师/雄主预设（差异化脸型、冠式、胡须、墨色、氏族题签、朱砂姓名印）。其余武将提供稳定默认轮廓。
- **界面升级**：名册行加入缩略头像；名册顶部加入“名将试册”，可快速打开当前剧本中四位代表人物；`OfficerDetail` 扩为人物志式大简册，新增表字、定位题签、人物短评、头像侧栏、最胜属性与分栏信息布局。
- **美术边界**：零外部图片、零商业素材，符合“金石水墨·拓片简册·印信官职”。当前是 C 程序化轮廓 + B 文字层 + 程序化纸墨底色的**简化切片**；A 层真实公有领域汉代拓片、`avatarGene` 类型/Zod/JSON 落库及 30 人精校仍属 P5-10 后续，未标完成。
- **验证**：client typecheck、production build 通过（仅保留既有 >500kB chunk 警告）；`validate-data` 223 名武将及全数据通过；Headless Chrome 实际完成“英雄集结→曹操军→人事→曹操详情”，确认头像、表字题签、最胜属性、五维、官职、技能、适性均渲染，长内容在简册内部滚动。四人快捷入口已由类型检查与生产构建覆盖；一次浏览器自动轮询因调试连接中断未回传，不虚记为实测。
- **GitHub 展示**：随后按真实玩家势力分别进入吕布军、刘备军、曹操军，实际打开吕布/关羽/诸葛亮/曹操四张人物简册并生成统一 896×637 截图；四图已加入 `docs/screenshots/`，README 新增双语“代表武将人物简册”四宫格介绍。
- **Next**：若继续武将界面，优先补技能/兵种/官爵中文名、详情页关系链与宝物槽；P5-10 完整头像数据落库应另开独立切片。

---

*文档版本: v7.1 | 2026-07-21 | Session 124 代表武将人物简册切片*

---

## 2026-07-21 — Session 125（三层战斗架构实装 — 战场地图 + 白刃战标准模式）

- Phase: **代码实装**（类型定义 + 引擎 + 服务端 + 前端 UI + 集成）
- 实装内容:
  **Tier I 战场地图（§20.2）**:
  - `shared/types/battlefield.ts` 新建：`BattlefieldNode`/`BattlefieldMap`/`BattlefieldTrap`/`MeleeState`/`MeleeAction`/`MeleeRoundResult`/`MeleeResult`/`WarResult`
  - `shared/campaign-utils.ts` 新建：从 `campaign.ts` 抽出 `planPath`/`calcFoodCost`/`unitPower`/`expLevelCoeff` 为共享函数
  - `server/src/engine/battlefield.ts` 新建：`generateBattlefield`/`extractBattlefieldNodes`/`tickBattlefieldMarch`
  - `server/src/services/game.ts` 新增：`battlefieldInit`/`getBattlefield`/`battlefieldMarch`/`battlefieldExit`
  - `server/src/routes/game.ts` 新增：`POST /battlefield/init`/`GET /battlefield`/`POST /battlefield/march`/`POST /battlefield/exit`
  - `client/src/services/api.ts` 新增 battlefield API 函数
  - `client/src/stores/gameStore.ts` 新增 `battlefield` state + screen `'battlefield'` + actions
  - `client/src/components/battlefield/BattlefieldPanel.tsx` 新建：战场地图主面板
  - `client/src/components/battlefield/BattlefieldMapView.tsx` 新建：战场节点子集渲染（节点卡片/Army 位置/邻接行军按钮）
  - **Tier II 白刃战（§20.3）**:
  - `server/src/engine/meleeRound.ts` 新建：`runMeleeRound`/`createMeleeState`/`applyMeleeRoundResult`/`refreshMeleeState`/`calcTacticalPointsGain`/`validateTacticalAction`
  - 服务端新增：`meleeStart`/`getMelee`/`meleeRound`/`meleeRefresh`/`meleeExit`
  - 路由新增：`POST /melee/start`/`GET /melee`/`POST /melee/round`/`POST /melee/refresh`/`POST /melee/exit`
  - `client/src/components/battlefield/MeleeEntryDialog.tsx` 新建：入口三选弹窗（自动结算/标准模式/微操受限）
  - `client/src/components/battlefield/StandardModePanel.tsx` 新建：双方状态对比/战术点显示/战术动作选择/回合执行/结果展示
  - `App.tsx` 新增 `'battlefield'`/`'melee'` screen 路由
- 简化/占位标注:
  - 白刃战伤害公式为 0-A 简化版（基于兵力 × 阵型修正系数），未复用 §6 完整引擎
  - 战术点消耗固定：普攻0，其余动作3（0-A 简化）
  - 微操模式入口受限（猛将对决/兵力差<20%），未完全禁用
  - 战略点/陷阱/战场工程建造留 Phase 1
  - 标准模式不支持中途切微操（Phase 1 补）
  - 多军同节点简化（每势力至多 1 支）
  - 自动结算在 MeleeEntryDialog 前端循环调用 runMeleeRound 实现（非调用 §17 runAutoBattle）
- 自验证:
  - `pnpm --filter @leh/shared build` ✅
  - `pnpm --filter server typecheck` ✅
  - `pnpm --filter client typecheck` ✅
  - `pnpm test` ✅ 68/68
  - `pnpm validate-data` ✅
  - `pnpm verify-scenario-events` ✅ 32/32
- Next: 总军师系统态势接入战场地图层 → 设施建造回合化 → 势力特点数据 → AI Army 接入 → 战略点系统

## 2026-07-21 — Session 125b（总军师系统态势接入战场地图层）

- Phase: **代码实装**（引擎 + 服务端 + 前端 UI + 集成）
- 实装内容:
  - `server/src/engine/grandStrategist.ts` 新建（530+行）：
    - `appointGrandStrategist` — 任命（智力≥85/相性差≤50/不可兼任军中参谋）
    - `dismissGrandStrategist` — 解职
    - `switchStrategy` — 态势切换（冷却 1 季）
    - `checkStrategyAdvice` — 战略献策（5 种类型，概率 = 15%+(智-80)×0.5%）
    - `grandStrategistDuel` — 总军师对决（智差≥15 识破，≥30 反制）
    - `tickGrandStrategists` — 回合推进（忠诚≤50 自动辞职/被俘死亡自动空缺）
    - `calcStrategyModifiers` — 态势加成计算（§20.2.6：攻/防/发展/隐忍 + 智力影响系数）
    - `getFactionStrategy` — 查询势力当前态势（无总军师时效果×0.5）
    - `aiAutoStrategy` — AI 自动态势切换（按兵力比判断）
  - `server/src/services/game.ts` 新增：`grandStrategistAppoint`/`Dismiss`/`Switch`/`Status` + `endTurn` 接入 `gsTick`
  - `server/src/routes/game.ts` 新增 4 端点：`POST /grand-strategist/appoint`/`dismiss`/`strategy` + `GET /grand-strategist/status`
  - `client/src/services/api.ts` 新增 API 函数
  - `client/src/stores/gameStore.ts` 新增 `grandStrategist` state + actions
  - `client/src/components/strategist/GrandStrategistPanel.tsx` 新建：总军师信息/候选人列表/任命/解职/态势切换（4 按钮）+ 加成效果详情
  - `client/src/components/layout/LeftPanel.tsx` 新增「总军师」折叠项
- 简化/占位标注:
  - AI 自动态势切换使用简单规则（兵力比），未接入完整 AI 决策系统
  - 献策效果直接返回文字建议（玩家手动采纳，无完整数值引擎）
  - `checkStrategyAdvice`/`grandStrategistDuel` 引擎已就位但尚未在 `endTurn` 中自动触发（献策需前端弹窗，对决需 S17 计谋联动）
- 自验证:
  - `pnpm --filter @leh/shared build` ✅
  - `pnpm --filter server typecheck` ✅
  - `pnpm --filter client typecheck` ✅
  - `pnpm test` ✅ 68/68
  - `pnpm validate-data` ✅
  - `pnpm verify-scenario-events` ✅ 32/32
- Next: 设施建造回合化 → 势点系数据 → 委任军团引擎实装（§39）→ AI Army 接入 → 战略点系统

## 2026-07-21 — Session 125c（设施建造回合化）

- Phase: **代码实装**（引擎改造 + 前端 UI 展示更新）
- 实装内容:
  - `server/src/engine/campaign.ts`：
    - `STRUCTURE_DEF` 新增 `goldCost` 字段（各设施金消耗 60~500）
    - `buildStructure` 重写：起始 `buildProgress = 1/turns` + 消耗金（0-A 简化代替木/铁）+ 大型器械（turns>1）建造期 Army 自动转入 garrison + 禁止行军
    - 新增 `tickConstruction(state)` — 每回合推进所有 Army 的在建设施进度；完成时输出日志
  - `server/src/services/game.ts`：`endTurn` 接入 `tickConstruction`
  - `client/src/components/campaign/CampaignPanel.tsx`：
    - `STRUCTURE_OPTIONS` 新增 cost/turns 字段
    - 建造按钮显示金消耗和回合数（如"冲车 (300金/2t)"）
    - 建造中按钮禁用（`isBuilding` 检查）
    - 结构物列表显示建造进度百分比（`建造中 50%` / `已完工`）
- 0-A 简化:
  - 消耗用金代替木/铁双资源（0-B 接回完整资源系统）
  - 建造者简化为主将（副将/参谋专属设施后置）
  - 无技能联动（筑城Lv/工巧Lv 建造加速后置）
- 自验证:
  - `pnpm --filter @leh/shared build` ✅
  - `pnpm --filter server typecheck` ✅
  - `pnpm --filter client typecheck` ✅
  - `pnpm test` ✅ 68/68
  - `pnpm validate-data` ✅
  - `pnpm verify-scenario-events` ✅ 32/32
- Next: 势点系数据 → 委任军团引擎实装（§39）→ AI Army 接入 → 战略点系统

*文档版本: v7.4 | 2026-07-21 | Session 125 三层战斗架构 + 总军师系统 + 设施建造回合化*

## 2026-07-21 — Session 126（引擎缺陷修复）

- Phase: **缺陷修复**（3 bug fixes）
- 实装内容:
  - **Bug 1 单挑嵌套锁**：`battleChallengeDuel()` 内联 `stepBattleDuel()` 调用，消除 `withLock` 嵌套导致的 400 错误
  - **Bug 2 战场行军指令失效**：`battlefieldMarch()` 增设行军目标设置（`path=[targetNodeId]` + `phase=marching`），再调 `tickBattlefieldMarch` 推进；到达判定改用更新后的 Army 对象
  - **Bug 3 meleeRefresh 缺锁**：`meleeRefresh()` 体加入 `withLock`，与其他写操作一致
- 自验证:
  - shared build / server typecheck / client typecheck ✅
  - `pnpm test` ✅ 68/68
  - `pnpm validate-data` ✅
  - `pnpm verify-scenario-events` ✅ 32/32
  - `pnpm --filter server exec tsx src/scripts/verify-duel.ts` ✅
  - `pnpm --filter server exec tsx src/scripts/verify-crit.ts` ✅
  - `pnpm --filter server exec tsx src/scripts/verify-campaign.ts` ✅ 56/57（1 expected failure）
  - `pnpm --filter server exec tsx src/scripts/verify-fire-tactic.ts` ✅
  - `pnpm --filter server exec tsx src/scripts/verify-child-engine.ts` ✅

*文档版本: v7.5 | 2026-07-21 | Session 126 引擎缺陷修复*

## 2026-07-21 — Session 127（UI 全中文化 — 武将名册/详情/面板英文→中文）

- Phase: **UI 本地化 + 缺陷修复**
- 实装内容:
  - **TopBar 游戏标题**：`LateEasternHanDynasty · Demo` → `晚东汉末 · Demo`
  - **武将名册（OfficerRosterPanel）**：武将非"在职"状态（free/prisoner/dead）从原始 enum 显示改为中文（在野/被俘/阵亡）
  - **人物简册（OfficerDetail）** 全中文化：
    - 爵位：`none`/`marquis`/`duke`/`prince`/`king` → 无/侯/公/王/皇帝
    - 技能 ID：`fire`/`water`/`ambush`/`taunt`/`gallop` 等 30 项英文→中文（火计/水计/伏兵/挑拨/疾驰…），含 uniqueSkill 映射
    - 兵种适性：`lightInfantry`/`heavyCavalry`/`horseArcher` 等 23 项→中文（轻步/重骑/骑射…）
    - 状态：`active`/`free`/`prisoner`/`dead` → 在职/在野/被俘/阵亡
  - **白刃战面板（StandardModePanel）**：阵型名映射从错误的 string key 修复为 FormationType 数字枚举，15 种阵型全中文标注（修复原显示数字的 bug）
  - **谍报面板（SpyPanel）**：补充缺失任务中文名（incite→煽动/steal→窃取/rescue→营救）
  - **总军师面板（GrandStrategistPanel）**：修复 `'ACTIVE'` 大写 bug → `'active'`（此前候选人筛选永不匹配）
- 涉及文件：TopBar.tsx, OfficerRosterPanel.tsx, OfficerDetail.tsx, StandardModePanel.tsx, SpyPanel.tsx, GrandStrategistPanel.tsx
- 自验证:
  - `pnpm typecheck` ✅ 3/3 包全过
  - `pnpm test` ✅ 68/68
  - `pnpm validate-data` ✅
  - `pnpm lint` ✅ 3/3 包全过

*文档版本: v7.6 | 2026-07-21 | Session 127 UI 全中文化*

## 2026-08-01 — Session 267 · 全仓代码与文档质量审计

- Phase: **跨系统质量审计**（不新增玩法系统、不改变数值与 RNG 契约）。
- 审查范围：盘点 1,632 个代码/文档文件入口，运行时代码约 53,831 行；检查类型逃逸、
  随机源、时间源、动态执行、DOM 注入、服务端路由输入边界、依赖安全、文件规模、文档
  数字真源与相对链接。未发现 `eval`/`new Function`/危险 HTML 注入或已知生产依赖漏洞。
- 修复：
  - 总军师客户端 API 的 5 处 `any`/无类型 Axios 响应改为显式 DTO；共享层新增
    `StrategyModifiers`，服务端计算、客户端 service/store 共用同一类型；切换态势参数收紧为
    `StrategyType`。顺手把人员支付回退局部变量 `any` 改为语义名 `fallbackCity`。
  - 三个当前浏览器验收脚本 `verify-s265-ui` / `verify-s266-ui` /
    `verify-merit-headless` 成功后显式关闭 CDP WebSocket，修复“断言已通过但 pnpm 进程不退出”。
  - 文档一致性：`00` 隐藏属性纠正为 11+8=19（阵型精通/技能组为独立字段）；`02/12`
    当前系统数统一为 23；`03/06` 总军师字段名和四个端点响应同步现行代码。
- 验证：typecheck/lint、shared **291/291**、client **42/42**、validate-data（223 武将/
  30 城等）、production build、`pnpm audit --prod` 全绿；全部服务端专项 `verify-*` 通过，
  唯一初跑失败为浏览器脚本未启动 CDP 的环境前置，按正式流程启动 dev + 1440×900 Chrome
  后 `verify-s266-ui` **17/17**、`verify-s265-ui` **8/8**、`verify-merit-headless`
  **7/7**，console error=0，且三命令均正常退出。84 个 Markdown 文件相对链接检查 0 断链。
- 保留项：production build 的约 **924 kB** 主 chunk 警告仍在；它与 Zustand slice、memo、
  viewport culling 同属已登记 D-0B-1～4，当前 30 城规模无功能退化证据，本轮不提前做高风险
  架构拆分。Express/CORS 仍是本地单进程 Demo 边界，不宣称生产多用户安全。
- **Next**：继续 BF-P5 第三郡录入（陈留郡，需用户提供史料），或由用户按
  `12-system-map.md` 拍板下一大系统。

*v15.70 | 2026-08-01 | Session 267 · 全仓代码与文档质量审计*

## 2026-08-01 — Session 268 · 命令坞交互与装备显示回归修复

- Phase: **S20 前端体验回归修复**（主）+ **S13 宝物显示最小依赖修补**；不新增玩法、数值或 RNG 消费。
- 原因分析：
  - `CommandDrawer` 绝对定位为 `bottom-0`，抽屉打开后覆盖命令坞本体并截获点击，造成新命令坞看似完全不可交互；命令坞固定最小宽 `76rem` 还使窄视口后半按钮依赖横向滚动。
  - `RightPanel` 虽已删除旧写按钮，仍挂载“内政操作/军事操作”折叠壳；左右栏提示继续写“使用右侧/左侧外交”，形成旧版 UI 回退的视觉与文案假象。
  - `EquipmentTab` 在静态宝物目录为空时提前返回，因此连与目录无关的固定 5 个槽位都不渲染；数据实际已贯通（新局曹操 `weaponPrimary=4`，静态目录 20 条），问题位于前端加载时序分支。
- 修复：抽屉锚点改为 `bottom-full`，始终从命令坞上沿展开；命令坞改为响应式 5/10 列且移除强制横向最小宽；删除右栏旧内政/军事壳并校正左右栏/领域说明；装备页签显示 `已装备数/5`，目录加载期间仍渲染五槽，已绑定条目显示宝物编号等待目录补全。
- 验证：新增 `scripts/verify-session268-ui.mjs`，Chrome 1440×900 实际命中并依次打开九个领域（抽屉保持打开时跨域切换），断言旧操作区 0、命令按钮 9、静态宝物 20、曹操运行态装备存在、UI 五槽/五标签/倚天剑/`装备 1/5`，console error=0；既有 `verify-s266-ui` **17/17**（展示、赏赐并装备、卸下）、`verify-items` **32/32**、CMD-P38 家族回归全绿；client **42/42**、shared **291/291**、typecheck/lint/data/build 全绿。
- 文档同步：`docs/07`（左右栏、命令坞响应式/抽屉锚点、装备时序）、`docs/12`（S20 状态）、`docs/10` + `HANDOFF.md` 双写。
- 简化/占位标注：屯田仍为设计中；命令坞“进行”仍指向顶部结束回合且保持禁用；S13 仍为 0-A 5 槽，8+2 槽留 0-B。

*v15.71 | 2026-08-01 | Session 268 · 命令坞交互与装备显示回归修复*

## 2026-08-01 — Session 269 · BF-P5 陈留郡第三模板录入

- Phase：**S02 / BF-P5 核心战线扩展**；使用用户提供的陈留郡历史地图与整理稿，快照固定为初平元年（190）。
- 数据落地：新增 `chenliu-190.ts`，录入兖州陈留郡 17 县（郡治陈留，`worldCityId=7`）、
  19 条路径与 10 个地标。汳水、睢水、济水/濮渠三轴据《水经注》标 `approximate`；延津及
  正史直载地标标 `attested`；西南、东南、东北县际道路标 `inferred`，不伪装为精确古道。
- 运行时接入：`COMMANDERY_TEMPLATES` 新增 `chenliu`（攻方入口酸枣/尉氏/扶沟，守方纵深
  外黄/雍丘，模板 `chenliu-190`）；行政大地图新增“陈留水陆”开发入口，复用既有目录驱动
  orchestrator、郡治归属、动态部署、迷雾、补给与存档链，无新增郡名分支。
- 验证：`verify-historical-geography` 三郡全过（陈留 17/19/10）；shared **291/291**、client
  **42/42**、typecheck/lint/validate-data/build 全绿；战场存档 **101/101**、动态战况 **13/13**、
  单挑 **20/20**。新增 `verify-session269-ui`，Chrome 1440×900 物理点击陈留入口后确认
  `templateId=chenliu-190`、17 县/19 路/3 入口、郡治陈留及酸枣渲染，console error=0。
- 文档同步：`docs/08`（三郡 Seed 与陈留置信度口径）、`docs/09`（BF-P5 第三郡完成状态）、
  `docs/12`（S02 状态）、`docs/22`（陈留校勘与现行目录录入流程）、`docs/10` + `HANDOFF` 双写。
- 边界：地图与坐标为相对拓扑，不声称精确复原汉末河道；酸枣—荥阳为郡外军事出口，当前
  模板只保留酸枣边界入口，不虚构郡内节点；105 郡国全量仍归 BF-P6 / 0-B。
- **Next**：BF-P5 第三郡已完成；下一步按目标剧本交战范围继续逐郡扩展，或由用户按
  `docs/12-system-map.md` 拍板下一大系统。

*v15.72 | 2026-08-01 | Session 269 · BF-P5 陈留郡第三模板录入*

## 2026-08-01 — Session 270 · BF-P5 河南尹第四模板录入

- Phase：**S02 / BF-P5 陈留—洛阳核心战线扩展**；按用户批准的推荐方案选定河南尹。
- 史料校勘：县表据《后汉书·郡国一》，洛/伊/谷水轴据《水经注》，
  190 年荥阳汴水东口据《三国志·武帝纪》。校勘中剔除属颍川的阳城及不在
  河南尹 21 城表的宜阳；相对坐标/自动派生县际道路明确标 approximate/inferred。
- 数据落地：新增 `henan-190.ts`，21 县/40 路/10 地标，郡治雒阳
  (`worldCityId=1`)；模板目录登记攻方荥阳/中牟/新郑、守方成皋/偃师，
  沿用目录驱动的郡治归属、部署、迷雾、补给与存档链。
- UI：行政大地图新增“河洛京畿”开发验收入口；新增仓库化
  `verify-session270-ui`。
- 验证：`verify-historical-geography` 四郡全过（河南尹 21/40/10）；shared
  **291/291**，typecheck 全绿。Chrome 1440×900 物理点击后确认 `henan-190`、21 县/
  40 路/3 入口、雒阳郡治、荥阳渲染，console error=0。
- 文档同步：先更新 `docs/08` 数字真源为 4 模板/71 县/99 路/34 地标，
  再同步 `07/09/12/22`、本日志与 `HANDOFF.md`。
- 边界：河南尹作为京畿特区仍复用郡国模板接口；函谷故关仅作西向相对战略锚点，
  不声称其几何是 190 年精确关城坐标。105 郡国全量仍属 BF-P6/0-B。
- **Next**：陈留—洛阳东向主战线已贯通；下一郡建议根据剧本交战范围在
  河内郡（洛阳北门）与弘农郡（洛阳西门）中选定，不自动启动 0-B。

*v15.73 | 2026-08-01 | Session 270 · BF-P5 河南尹第四模板录入*

## 2026-08-01 — Session 271 · BF-P5 河内郡第五模板录入

- Phase：**S02 / BF-P5 关东义兵河内—孟津北线扩展**；按上一轮推荐继续河内郡。
- 史料校勘：县表据《后汉书·郡国一》固定 18 城、治怀；河阳—孟津据《水经注》卷五，
  共—朝歌淇水轴参考卷九，王匡参与 190 年联军据《三国志·武帝纪》。相对坐标与自动
  派生县际道路分别标 `approximate` / `inferred`。
- 数据落地：新增 `henei-190.ts`，18 县/35 路/10 地标；模板目录登记攻方河阳/修武/获嘉、
  守方野王/怀、治所怀。0-A 30 城没有河内治所，暂以 `worldCityId=1` 代理势力归属与进场，
  不表示河内并入河南尹。
- UI：行政大地图新增“河内孟津”开发验收入口与 `verify-session271-ui`。
- 验证：`verify-historical-geography` 五郡全过（河内 18/35/10）；shared **291/291**、client
  **42/42**、typecheck/lint/validate-data 全绿。Chrome 1440×900 物理点击后确认
  `henei-190`、18 县/35 路/3 入口、治所怀、河阳渲染，console error=0。
- 文档同步：先更新 `docs/08` 数字真源为 5 模板/89 县/134 路/44 地标，再同步
  `07/09/12/22`、本日志与 `HANDOFF.md`。
- 边界：本轮只扩 S02/BF-P5，不启动 105 郡国 BF-P6/0-B；河内县际几何不声称精确复原。
- **Next**：若继续核心战线，推荐弘农郡补齐洛阳西门；或由用户按系统图拍板其他既有系统。

*v15.74 | 2026-08-01 | Session 271 · BF-P5 河内郡第五模板录入*

## 2026-08-01 — Session 272 · BF-P5 弘农郡第六模板录入

- Phase：**S02 / BF-P5 洛阳西门崤函线扩展**；按上一轮推荐继续弘农郡。
- 史料校勘：县表据《后汉书·郡国一》固定 9 城、治弘农；河水—华阴—桃林—崤函轴及
  洛、伊、谷、涧水上游参考《水经注》。潼关关城在 190 年的建置年代有争议，本模板不把
  后世关城列作当年确证节点；相对坐标/自动道路标 `approximate` / `inferred`。
- 数据落地：新增 `hongnong-190.ts`，9 县/17 路/11 地标；模板目录登记攻方新安/宜阳/
  陆浑、守方陕/弘农、治所弘农。0-A 30 城没有弘农治所，暂以 `worldCityId=2`（长安）
  代理进场和守方归属，不表示弘农并入京兆尹。
- UI：行政大地图新增“弘农崤函”开发验收入口与 `verify-session272-ui`。
- 验证：`verify-historical-geography` 六郡全过（弘农 9/17/11）；shared **291/291**、client
  **42/42**、typecheck/lint/validate-data/build、存档 **101/101**、动态 **13/13**、单挑
  **20/20** 全绿。Chrome 1440×900 物理点击后确认 `hongnong-190`、9 县/17 路/3 入口、
  治所弘农、新安渲染，console error=0。
- 文档同步：先更新 `docs/08` 数字真源为 6 模板/98 县/151 路/55 地标，再同步
  `07/09/12/22`、本日志与 `HANDOFF.md`。
- 边界：本轮只扩 S02/BF-P5，不启动 BF-P6/0-B；县际几何不声称精确复原。
- **Next**：建议先做六模板跨郡入口、0-A 代理归属与回归总验收，再由用户拍板下一战线。

*v15.75 | 2026-08-01 | Session 272 · BF-P5 弘农郡第六模板录入*

## 2026-08-01 — Session 273 · Session 272 进度文档口径收口

- 仅更新文档，无运行时代码、数据、Schema、API、规则或 RNG 变化。
- 已复核 Session 272 的 `docs/10-progress.md` + `HANDOFF.md` 双写与 `docs/08` 数字真源：
  当前为 6 模板/98 县/151 路/55 地标。
- 清理当前状态中的过期口径：`HANDOFF` §8 不再把陈留第三郡列作剩余任务；
  `docs/12-system-map.md` S02 主行与 Session 251 补充不再把第三郡/年代覆写写作当前待办；
  `docs/09-roadmap.md` 明确早期待办只作为历史过程保留。
- 历史会话日志保留当时状态，不回写改史。
- 验证：对关键文档执行过期口径检索并人工区分当前状态与历史记录；`git diff --check` 通过。
- **Next**：六模板跨郡入口与 0-A 代理归属总验收，或由用户拍板下一条目标剧本战线；
  不启动 BF-P6/0-B。

*v15.76 | 2026-08-01 | Session 273 · 进度文档口径收口*

## 2026-08-01 — Session 274 · BF-P5 六模板跨郡入口与代理归属总验收

- Phase：**S02 / BF-P5 核心战线验收**；未新增模板、未改数据规模、规则、Schema、API 或 RNG。
- 工程：新增仓库化 `verify-session274-ui` 与根脚本命令，单一 1440×900 Chrome 会话依次
  物理点击南郡、颍川、陈留、河南尹、河内、弘农六个入口；逐郡核对模板 id、县/路/入口数、
  治所渲染，再物理点击退出并确认权威实例清空、返回大地图。
- 归属：锁定南郡→江陵(14)、颍川→阳翟(3)、陈留→陈留(7)、河南尹→洛阳(1)四条直连；
  河内→洛阳(1)、弘农→长安(2)为 0-A 代理。若代理城市由非玩家占领，实例守方必须采用该城
  实际 ruler；代理不表示历史行政合并。
- 验证：`verify-session274-ui` 六郡/六次退出全过，console error=0；模板目录单测 6/6、
  `verify-historical-geography` 6/6、typecheck/lint/validate-data/diff-check 全绿。
- 文档：同步 `07/09/12/21`、本日志与 `HANDOFF.md`；数字真源保持 6 模板/98 县/151 路/55 地标。
- **Next**：六模板总验收完成；下一条目标剧本战线由用户拍板，不自动启动 BF-P6/0-B。

*v15.77 | 2026-08-01 | Session 274 · 六模板跨郡入口与代理归属总验收*

## 2026-08-01 — Session 275 · S10 六角敌军战术 AI 第一步

- Phase：**S10 战斗深化**；按用户要求暂停继续铺郡图，不启动新系统或 0-B。
- 落地：`server/src/battle/simpleAi.ts` 从“最近目标、机械贴近、普攻”占位升级为确定性
  战术评分：目标综合距离、残兵比例、兵种克制与攻击威胁；移动综合接敌距离与防御地形，
  陆军避免无意义踏水；有火计技能的敌将按智力差、等级、天气、地形、成功率与预期伤害
  选择火计，完整消费 30 气力并处理失败、伤害、士气与灼烧，雪天禁用、雨天减伤。
- 验证：新增 `pnpm verify-tactical-ai` **6/6**（残兵目标、非列表首项、主动火计、气力、
  灼烧、雪天门禁）；`verify-battle-rng` 5/5、`verify-save-battle` 24/24、
  `verify-melee-modes` 10/10；全仓 typecheck/lint 全绿。1440×900 Chrome 实际执行
  `verify-duel-r3-headless`，创建真实六角战斗并验证四倾向交互与非法输入门禁，console error=0。
- 边界：本轮只完成敌军目标/走位/普攻/火计决策；兵种战法、主动单挑、阵型切换、协同
  包围、撤退、天气回合推进与阵型完整数值消费仍后置；不宣称 P5-01 全局 AI 完成。
- 文档同步：`docs/05`（§18.1.1）、`docs/09`（P1-09 现状）、`docs/12`（S10 行）、
  `docs/10` + `HANDOFF.md` 双写。
- **Next**：保持 S10，推荐下一步接敌军兵种战法与主动单挑；不得并行恢复 BF-P5 郡图扩张。

*v15.78 | 2026-08-01 | Session 275 · S10 六角敌军战术 AI 第一步*

## 2026-08-01 — Session 276 · S21 三类战斗场景差异化界面

- Phase：**S21 战争四层串联 / S10 战斗表现**；按既有 §20 设计实现郡域战场、白刃战标准模式、
  单挑演出三类独立画面，不新增并列大系统，不改规则、Schema、API、RNG 或数据规模。
- UI：郡域战场升级为金石军图（暗纸网格、道路/水道分层、朱砂郡治、迷雾与常驻图例）；
  白刃战升级为横向军阵与攻守双色态势，战术卡显示真实 0/4/2/2 点成本和风险说明；单挑升级为
  全屏黑场、程序化武将剪影、姓名印与体力/气力演出，保留逐回合、快进、跳过和幂等返回。
- 验证：typecheck/lint、client **42/42**、`verify-save-battle` **24/24**、
  `verify-melee-modes` **10/10**、`verify-bf-p4-duel` **20/20**、build 全绿（仅既有大 chunk warning）。
  Chrome 1440×900 实际点击六郡进入/退出 **6/6**，并完成颍川/南郡阵前+城下单挑与回写，
  console error=0。白刃战因当前正式浏览器流程无敌军创建入口，本轮只做引擎/组件验证，未宣称物理点击验收。
- 美术边界：只使用工程字体、CSS/SVG 程序化图形和既定公有领域金石水墨语汇，无新增外部资产。
- **Next**：保持 S10/S21，补一条可由正式出征进入白刃标准模式的浏览器验收链；随后再做敌军兵种战法与主动单挑。

*v15.79 | 2026-08-01 | Session 276 · 三类战斗场景差异化界面*

## 2026-08-01 — Session 277 · S10 六角战旗与白刃接战正式切片

- Phase：**S10 战斗深化 / S21 局部交战**；不新增大系统，不扩0-B数据规模。
- 纯核心：新增 `tactical-grid.ts`（最大100×100 axial坐标、二叉堆A*/Dijkstra、地形/实体障碍、
  路径步与动画态）、`melee-engagement.ts`（剑/斧1格、矛1~2格、六朝向/侧背）、
  `tactical-system.ts`（五阶段协议、同步/异步事件、三步撤销、规则策略注册表、阵型/战术叠加、
  双入口单挑概率）及 Zod 校验的 `tactical-system.v1.json`（5阵/3术配置切片）。
- 权威/UI：新增路径预览和撤销API；移动提交重新跑A*；BattleState保存最多3条逻辑时间/来源审计；
  BattleView悬停显示路径序号/消耗/余量，rAF逐格动画后落子，可在攻击/RNG前撤销。攻击收口为
  朝向白刃1~2格，战法最大2格。白刃六基础阵型可耗1点切换，并修复数字枚举未命中旧字符串
  修正表、导致阵型加成失效的既有缺陷。
- 验证：新纯核心 **17/17**；100×100 A* `<100ms`；覆盖率 statements **94.88%**、branches
  **86.66%**、functions **97.72%**、lines **98.56%**；shared **308/308**、client **42/42**，
  `verify-save-battle` **26/26**、`verify-melee-modes` **12/12**，typecheck/lint/data/build 全绿。
  `verify-session277-ui` 在1440×900实际选军→悬停路径（1格/耗1/余4）→动画落到(3,3)→点击撤销
  回(2,3)，console error=0。
- 文档：新增 `docs/27-tactical-wargame-system.md`，并同步 `02/03/05/06/07/09/12`、本日志和
  `HANDOFF.md`。注释覆盖率无可靠自动工具，未伪造90%；核心公共API和算法均有TSDoc/规则注释。
- 边界：运行态仍以兼容的 `player/enemy/over` 为持久字段，五阶段状态机已作为纯协议与测试就位；
  军阵格挡/闪避尚未另建概率池，完整格挡/闪避仍属于既有单挑七指令，避免未经批准重复规则。
- **Next**：把五阶段协议正式接入 BattleState/AI回合，或继续 Session 275 待办的敌军战法与主动单挑。

*v15.80 | 2026-08-01 | Session 277 · 六角战旗与白刃接战正式切片*

## 2026-08-01 — Session 278 · Session 277 全门禁验收与进度收口

- Phase：**S10 / S21 质量验收**；本轮只复验 Session 277 正式切片，不修改运行时代码、
  战斗规则、Schema、API、RNG 或静态数据规模。
- 静态与构建：`typecheck`、`lint`、`validate-data`、`build` 全绿；数据校验覆盖现行
  223 武将/30 城/7 阵/9 兵种等 0-A 数据，构建仅保留既有约 972 kB 主 chunk 警告。
- 单测与覆盖率：shared **308/308**、client **42/42**；战术核心专项 **17/17**。
  V8 覆盖率 statements **94.88%**、branches **86.66%**、functions **97.72%**、
  lines **98.56%**，全部超过现行 90/80/90/90 门禁。
- 性能：单独以 verbose 重跑 100×100 六角图 A* 性能用例，本机单次约 **9ms**，通过
  `<100ms` 门禁；算法仍为二叉最小堆 `O(V log V)` 口径。
- 真实浏览器：Chrome 1440×900 实际执行 `verify-session277-ui`，完成选军→悬停路径
  （1格/耗1/余4）→动画落子 `(2,3)→(3,3)`→撤销回 `(2,3)`；操作历史归零，
  console error=0。
- **Next**：验收未发现新增阻塞；保持 S10，下一步仍为五阶段协议接运行态，或敌军兵种
  战法与主动单挑。军阵独立格挡/闪避概率池须先由用户拍板。

*v15.81 | 2026-08-01 | Session 278 · 全门禁验收与进度收口*

## 2026-08-01 — Session 279 · S10/P3-05 阵型整合开发计划（原设定优先）

- Phase：**S10 / P3-05 纯设计**；新增 `docs/29-formation-integration-development-plan.md`
  评审稿，覆盖两款参考游戏的阵型/数值/交互调研框架、原创融合、IP clean-room、9周实施排期、
  人力分配、迁移门禁和测试用例。
- 原设定边界：0-A 保持 7 条，目标为六基础 `[0,1,2,3,4,6]` + 特殊冲阵 `16`；
  当前 JSON/223 将精通仍为 `[0,2,4,6,7,8,16]`，本轮未迁移，禁止机械改写 7/8；
  FM-P0～P5 只开放六基础，冲阵保留为只读兼容数据。
- 规则边界：复用 `organization 0..100` 五档、CampaignSquad 五部阵位、1 TP 变阵、原设定整顿
  以及既有 `runAutoBattle/runMeleeRound/battle.ts`；当前局部“自动结算”误循环 `runMeleeRound`，
  FM-P3 目标按 `05` 恢复 `runAutoBattle`。不新增阵势完整度、三扇区、合围命令、阵型互克表
  或伤害公式。
- 文档同步：`00/03/04/05/06/07/08/09/12/27`、本进度与根 `HANDOFF.md`；修正 0-A 6→7、
  0-B 18→27 的旧摘要口径，并明确长期 `Formation` 与当前 legacy `FormationTemplate` 的边界。
- 运行时边界：**代码、Schema、API、RNG、JSON、存档和游戏功能均无变化**；P3-05 保持 `[~]`，
  FM-P0～P5 均未启动，0-B 继续暂停。
- 文档验证：执行 `git diff --check`、定向口径检索和本地文档目标检查；文末 8 个研究/合规
  外链逐一请求均返回 HTTP 200。未运行或声称功能/浏览器测试，因为本轮没有运行时改动。
- **Next**：等待用户审核。未明确启动时保留 Session 278 的运行时待办；若用户批准并下达
  “启动实施”，则在同一 S10 内从 FM-P0 的目录迁移、数值映射和原创部署三项评审门禁开始。

*v15.82 | 2026-08-01 | Session 279 · 阵型整合开发计划；仅设计、待实施*

## 2026-08-01 — Session 280 · 全项目合规整改（可控项完成，外部项与前置脏树待收口）

- Phase：**跨 S07/S08/S09/S18/S22 的最小合规修补**，不扩充并列玩法系统。
- 未成年人保护：新增共享 `MARRIAGE_ADULT_AGE=18` 与统一判断；服务端婚配、客户端候选及
  终审均校验双方年龄。190 年孙尚香明确拒绝测试通过。
- 人格化资源退役：删除具名女性赠与 API/store/service/UI；`giftBeauty` 引擎删除；
  `beauties/giftedToOfficerId` 仅保留 v1 类型兼容，加载时清空，当前 Schema 强制空/null；
  `family.ts` 只迁移正式配偶。外交改为 `/diplomacy/court-network` 与“宫廷牵线”。
- 版权：从当前树删除四张无权属链武将 PNG、八张关联详情截图及一张含退役 UI 的 README
  截图；两份无许可 Demo 移至仓库外 `0700/0600` 隔离区；旧“95%可搬/移植”生产指令改为
  clean-room 原创规格。新增 `ASSET_MANIFEST.md`、`THIRD_PARTY_NOTICES.md` 和合规门禁。
- 字体/依赖：马善政体文件改用真实家族名，补 OFL 文本、三文件 SHA-256 与固定来源；
  CREDITS 纳入 ISC/CC-BY-4.0 和当前 127 个 PNG 口径；CI 增加许可与漏洞审计。
- 隐私：Agent/浏览器工具目录实体迁至 `~/.local/share/leh-agent-state/`，仓库路径只留忽略的
  符号链接；目录/文件权限实测 `0700/0600`；新增 30/90 天留存和导出脱敏政策。
- 安全：服务默认显式绑定 `127.0.0.1`；非回环必须 `GAME_API_TOKEN`；HTTP/WS 共用 Origin
  与 Bearer 校验；API 每 IP 限速、JSON 64KiB、安全头、Zod 对象边界，敏感新路由 strict Schema。
- 内容：剧本入口新增战争/疾病/间谍/历史婚姻提示；婚配18岁说明；祝融描述和武将标签改为
  中性“南中部族”；新增史实/演义/原创来源政策。
- 已验证：family policy 3/3、Family UI 2/2、family RNG 35/35、negotiation 40/40、
  save migration 23/23、security 6/6、实际 HTTP/WS 8/8、HC-P0 101/101、Zod 数据与
  `pnpm audit` 全绿；`verify-compliance` 通过（5 类许可）。
- **未完成/不伪报**：Git 可达历史仍包含已删除 PNG 对象，历史重写需所有者协调且当前脏树
  不可安全执行；平台侧未导出对话需所有者提供导出；全仓 client typecheck/build/browser
  被本 Session 开始前已有的 `App.tsx`、`BattleView.tsx`、`DuelPanel.tsx` 未完成 JSX 改动阻断。

*v15.83 | 2026-08-01 | Session 280 · 合规整改可控项完成；三项外部/前置阻塞待收口*

---

## 2026-08-02 — Session 286 · S27 深化：派系事件 + 弹劾机制 + 自募武装

- Phase：**S27 城级派系深化**（`docs/34-faction-politics-design.md` §十~§十二，三项全实装）。
- **派系事件**（`shared/city-factions.ts` `pickFactionEvent` + tick 第 5 层）：
  每城每月至多 1 个，叛乱判定后执行；先高池（任一派系 ≥70，25%）未中则低池
  （核心三派系任一 <30，20%），entries 顺序首个命中派系；正向 8 事件（名门献金
  +30~60金/流民垦荒 farm+10~25/货路繁盛 +40~80金/豪强应募 兵力公式/宗族输粮 +50~100粮/
  教团祈福 民心+2/官宦引荐 +20~40金/游侠缉盗 士气+2）+ 负向 3 事件（世家抽逃 −20~40金/
  流民流亡 farm−5~15/商贾撤资 −30~60金）；RNG 消费高池判定 1（未中另 1 次低池）+ 数值 1；
  结果入 actionLog（type=`faction_event`）。
- **弹劾机制**（tick 第 4 层 + `resolveImpeachment` 命令）：
  官宦 <30 且城有在职非君主城主 → 每月 20%（当月未叛乱时）；写
  `City.pendingImpeachment? = { officerId, sinceStamp }`（optional + Zod 同步，旧档兼容）；
  处理 `POST /civil/impeach`：安抚（100 金 → 官宦 +20）或撤换（S12 `appointOfficer`
  太守解职 + 移首都官员位，忠诚 −10、官宦 +10，君主拒撤）；逾期 stamp 差 ≥2 月落空
  （官宦 −5、城主 −2，含 actionLog `faction_impeach`）。
  乡政分面红框警示条 + 安抚/撤换两按钮（`civil-impeach-appease`/`civil-impeach-remove`）。
- **自募武装**（tick 第 6 层）：豪强/宗族 ≥60 → 每月 15%；兵力 +max(20, floor(人口×0.005))、
  兵装 −3、该派系 −5；与高池事件互斥（`outcome.high` 判定）；0-A 无独立私兵字段，
  直接并入城兵力；actionLog `faction_self_recruit`。
- **实测校准（真实 HTTP 游玩发现问题并修复）**：官宦初始 [45,65] + 回归锚 50 → 弹劾
  （需 <30）自然不可达；豪强/宗族 [45,65] → 自募（原阈值 70）不可达。调整：
  官宦初始区间 → **15~45**、豪强/宗族 → **55~75**、自募阈值 70→**60**；真源
  `docs/08` §十七/§二十三~§二十五 与 `docs/34` 同步。
- **修复 2 个实现 bug**：逾期分支忠诚原 +2（应为 −2）、逾期官宦满意度原 +5（应为 −5）。
- 验证：`pnpm verify-s27` **66→94 断言**（新增事件高池/低池/不触发、自募对照差值法、
  弹劾触发/逾期/安抚/撤换/君主拒撤）；shared 348→**363** + client 42 单测、validate-data、
  全部既有 verify-*（save-entities 10/10、save-game-state 10/10、save-migration 23/23 等）
  复跑、三端 typecheck 全绿。
- **真实 HTTP 端到端实测**：创建剧本→开垦×5 堆流民 92→高池事件「流民垦荒」触发 ✓；
  世家被开垦压到 0→低池事件「世家抽逃」触发 ✓；巡查陈留（官宦 30→16）→ 推进 →
  「官宦弹劾城主李典」触发 ✓ → 安抚处理 ✓（pending 清除/官宦+20/耗金 100/李典留任）；
  撤换分支由 verify-s27 引擎层断言覆盖（HTTP 参数/错误路径另实测 ✓）。
- **未改设计边界**：试点仍 6 城；事件不弹 UI 不进事件对话（纯 actionLog）；
  弹劾/自募无独立 UI 跳转（仅乡政警示条）；fame 叙事化标签未做。

*v15.84 | 2026-08-02 | Session 286 · S27 深化三项全实装 + 触发数值实测校准*

## 2026-08-02 — Session 298 · S10/BF 退出回大地图状态机修复

- Phase：**S10 / BF 战场回环 bug 修复**，未开启新大系统。
- 根因：Tier I `battlefieldExit` 只写 `screen='world'`，未同步清理前端 `sceneStack`；残留的
  `battlefield` 帧会在下一次出战撤军时把画面导回空战场面板。Tier I 初始化也未建立对应父帧。
- 修复：Tier I 初始化入场景栈；Tier I/Tier II 退出统一回收到 `world` 根栈并清理本地
  `battle/battlefield/melee` 瞬态；白刃战退出按实际父战场栈返回，避免硬编码 screen。
- 验证：client typecheck/lint、shared 377/client 42 单测全绿；实际 Chrome 1440×900 点击验收
  `verify-bf-p4-headless` 通过：颍川/南郡进入、两条单挑、退出回环、console error=0。
  Session 274 旧六郡脚本在当前 0-A 仅暴露南郡/颍川两个入口，前两项退出通过后因缺少陈留入口
  停止，非本次退出修复失败。
- **边界（诚实）**：本轮未改变服务端战斗结算规则；现有六角战斗仍须完成后才能由权威
  `exitBattle` 结算，途中“撤军返回”不等同于强制中断六角战斗。
- **Next**：六角战中变阵状态机评审，或 FM-P4 战报解释 UI。

*v15.85 | 2026-08-02 | Session 298 · 战场退出回环 bug 修复*

## 2026-08-02 — Session 299 · S18/S24 武将关系页签归并

- Phase：**S18 家族 / S24 关系网 UI 归并**，不改变两个系统的数据与 API 边界。
- 查实：`OfficerDetail` 原有「关系」（婚姻/子女/效力）与「社交」（武将关系列表/关系图谱）两个并列页签，用户层级重复且语义割裂。
- 修复：合并为唯一「关系」页签，同屏保留婚姻、妾/姬、子女、效力、社交关系列表和关系图谱；移除独立「社交」页签。`GET /relations/:officerId` 及 S18 数据结构不变。
- 文档：同步 `docs/04-game-systems.md`、`docs/07-ui-design.md`，明确 UI 归并而非后端系统合并。
- 验证：新增客户端 SSR 回归断言；client typecheck/lint、43 项客户端测试全绿；Chrome 实际点击名册→武将详情→「关系」确认页签为「属性/关系/装备/列传/技能」，婚姻、社交关系、关系图谱均呈现，独立「社交」页签不存在。
- **Next**：继续处理用户指定的 UI/标签一致性问题；S10 六角变阵仍后置。

*v15.86 | 2026-08-02 | Session 299 · 武将关系页签归并*

## 2026-08-03 — Session 304 · FM-P4 战报解释保持变阵上下文

- Phase：**S10 / S21 六角战报 UI 收口**；不新增系统、规则、Schema、API 或数据规模。
- 修复：`BattleReport` 原本只显示最近六条日志；变阵后经敌军回合与攻击日志滚动时，玩家可能看不到
  变阵前后阵型与 TP 解释。现固定保留最近一次 `formation` 结构化日志，同时保留最近六条普通战报，服务端
  仍是解释唯一来源，旧纯文本日志继续兼容。
- 验证：typecheck/lint、shared **377** + client **43**、validate-data、build 全绿；真实 Chrome 1440×900
  以 CDP 物理鼠标事件完成选择我军→变阵→结束行动→移动→攻击，面板同时出现“变阵：”与“阵型贡献：”，
  console errors=0。
- **Next**：保持 S10；进入主动战法/主动单挑深化或 FM-P4 存档/读档验收，需先明确主线。

*v15.87 | 2026-08-03 | Session 304 · FM-P4 战报解释保持变阵上下文*

## 2026-08-03 — Session 306 · FM-P4 战斗快照存档往返验收

- Phase：**S10 / S21 FM-P4 存档契约收口**；不新增玩法系统、规则数值或数据规模。
- 新增 `verify-fm4-hex-formation` 的 JSON 往返验收：变阵后的 TP、前后阵型、结构化战报 TP
  解释序列化后重新经 `GameStateBattleSchema` 解析，均保持一致；专项断言 **14/14**。
- 既有回归：`verify-save-battle` **26/26**、`verify-tactical-ai` **9/9**；shared build 通过。
- 文档：同步 `docs/03-data-models.md`、`docs/05-combat-system.md`，明确新增字段的存档边界与旧档兼容。
- 边界：本轮仅强化验收，没有宣称完整读档 UI、敌军主动单挑或特殊战法范围效果已完成。
- **Next**：保持 S10；继续主动单挑深化，或补真实存档 UI 的浏览器保存/恢复链。

*v15.88 | 2026-08-03 | Session 306 · FM-P4 战斗快照存档往返验收*

## 2026-08-03 — Session 307 · S10 六角敌军主动单挑切片

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、数据规模或并列系统。
- 实装：敌军回合在相邻敌我主将均存活、士气满足六角门禁且敌军气力足够时，使用共享
  `duelTriggerChance`（基础 8% + 勇猛/士气差）进行主动单挑判定；成功后复用既有
  `DuelState`、`createDuel`、权威 RNG、四倾向默认 `delegate` 和既有结算链，先推进一回合，
  UI 可继续使用已有 DuelPanel 观看/跳过。敌军被拒绝时只写战报并继续普通战术 AI。
- 存档/API/UI：不新增字段、不改端点和数据规模；沿用现有 `BattleState.duel` 可选快照。
- 验证：server typecheck、shared build、`verify-tactical-ai` **9/9**、`verify-save-battle` **30/30** 通过；新增真实
  `BattleState` 主动单挑入口、首回合推进、20 气力扣除和严格 Schema 断言。
- 边界：尚未完成 `proficiency` 特殊战法、范围战法多目标展开、敌军变阵/协同包围/撤退；
  本轮不宣称 P5-01 全局 AI，也未宣称特殊战法范围效果完成。
- Session 308 补充真实 Chrome 验收：`scripts/verify-s10-enemy-duel-ui.mjs` 走通“推进相邻→结束行动→敌军主动单挑→DuelPanel 跳过→结算”，退出码 0、console errors=0。脚本仅在移动范围刷新竞态时回退到同一权威移动 API，不改生产规则。
- **Next**：保持 S10，继续特殊兵种战法/多目标范围效果，或补真实存档 UI 保存/恢复链。

*v15.90 | 2026-08-03 | Session 308 · S10 敌军主动单挑浏览器验收*

## 2026-08-03 — Session 309 · S10 特殊兵种战法与 AOE 多目标切片

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B 数据规模或并列系统。
- 实装：`castAbility` 与敌军六角 AI 接通 `proficiency` 战法；当前 0-A 以武将对应兵种适性
  C/B/A/S 作为 `basePower→maxPower` 线性代理，使用静态 `energyCost`，兼容未来真实特殊兵种数据。
- 范围效果：`aoe` 以选定目标为中心展开 1 格，同阵营敌军主目标全额、邻格目标 50% 溅射；
 共享气力、命中、状态效果及整方存活判定，战报标记“波及 N 队”。既有客户端战法按钮和服务端
 端点无需新增字段/端点，仍复用当前 UI。
- 边界：正式“使用次数→熟练度”字段、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成；
 这不是 P5-01 全局 AI 完成。
- 验证：server typecheck、shared build、`pnpm validate-data`、`pnpm verify-tactical-ai` **13/13**。
- **Next**：补真实存档 UI 保存/恢复链，或待用户批准后设计正式特殊兵种使用次数熟练度。

*v15.91 | 2026-08-03 | Session 309 · S10 特殊兵种战法与 AOE 多目标切片*

## 2026-08-03 — Session 310 · S16 浏览器 JSON 存档导入/导出

- Phase：**S16 / FM-P4 存档 UI 文件层**；不扩 0-B 数据规模，不新增并列大系统。
- 实装：服务端新增 `GET /api/game/save/export` 与 `POST /api/game/save/import`。导出完整 `SaveEnvelopeV1`（含权威 `xorshift32-v1` 状态），导入复用现有版本迁移、剧本事件层兼容检查、完整 `GameStateSchema` 与 RNG 恢复；客户端顶部新增真实“导出存档/导入存档”按钮。
- 传输边界：0-A 完整快照超过原 64KB 请求上限，Express JSON 上限调整为 2MB；仅放宽载荷大小，未放宽存档校验。仍未实现 SQLite/XDG 多槽位。
- 验证：shared **377/377**、client **43/43**、shared/server/client typecheck；真实 Headless Chrome 点击导出按钮，再通过文件输入导入，回合推进到第 3 月后恢复为第 1 月，按钮与恢复链通过。
- **Next**：保持 S10；待用户批准后设计正式特殊兵种使用次数熟练度，或继续 S16 XDG/SQLite 存档层。

*v15.92 | 2026-08-03 | Session 310 · S16 浏览器 JSON 存档导入/导出*

## 2026-08-03 — Session 311 · S16 XDG 命名槽位服务端

- Phase：**S16 / P5-07b 存档落盘**；继续既有存档系统，不扩 0-B 数据规模、不新增并列大系统。
- 实装：新增 `GET /api/game/save/slots`、`POST /api/game/save/slots/:slot`、`POST /api/game/save/slots/:slot/load`；服务端按 XDG 约定写入 `$XDG_DATA_HOME/leh/saves/`，未设置时回退 `~/.local/share/leh/saves/`。
- 安全/一致性：槽位名严格白名单；保存先写同目录临时文件再原子替换；读取限制 2MB；读取仍复用现有存档迁移、剧本兼容、完整 `GameStateSchema` 与 RNG 恢复。
- 边界：本轮没有新增 GameState 字段、规则、RNG 或数据规模；顶部栏仍为浏览器文件导入/导出，系统菜单槽位 UI、SQLite、多用户/云同步留后续。
- 验证：server typecheck、shared build、`verify-save-slots` **4/4**（保存文件、原子写入结果、读取恢复、列表与非法槽位拒绝）。
- **Next**：保持 S10；待用户批准后设计正式特殊兵种使用次数熟练度，或继续 S16 系统菜单槽位 UI/SQLite。

*v15.93 | 2026-08-03 | Session 311 · S16 XDG 命名槽位服务端*

## 2026-08-03 — Session 312 · S16 XDG 槽位系统菜单 UI

- Phase：**S16 / P5-07b 存档 UI 收口**；继续既有存档系统，不扩 0-B 数据规模、不新增并列大系统。
- 实装：顶部新增“槽位存档”面板，接通槽位列表、1~32 位安全名称、保存、覆盖确认、读取确认与列表刷新；读取后依据服务端权威状态重建 world/battlefield/melee/battle 场景栈。
- 边界：复用 Session 311 XDG 文件服务与 `SaveEnvelopeV1` 迁移/Schema/RNG 校验，不新增 GameState 字段、规则、RNG、SQLite、多用户或云同步。
- 验证：client/server typecheck、`git diff --check`；真实 Chrome `verify-s16-save-slots-ui` 通过：面板打开、保存槽位、读取槽位、恢复 190 年 1 月状态，console errors=0。
- **Next**：保持 S10；待用户批准后设计正式特殊兵种使用次数熟练度，或继续 S16 SQLite。

*v15.94 | 2026-08-03 | Session 312 · S16 XDG 槽位系统菜单 UI*

## 2026-08-03 — Session 313 · S10 战场退出残帧修复

- Phase：**S10 / S21 战场回环修复**；不新增系统、规则、数据规模或存档字段。
- 根因：Tier I/Tier II 战场级退出依赖旧 `sceneStack` 的 `popToScene('world')`；重复进入或读档后栈可能含多个 world/battlefield 帧，退出后残留旧战场上下文。
- 修复：`battlefieldExit` 与 `exitNanjunBattlefield` 统一 `replaceStack({ scene: 'world' })`，并清理客户端 `battlefield/battle/melee` 瞬态；服务端权威结算端点不变。新增场景栈脏帧回归断言与真实浏览器脚本。
- 验证：真实 Chrome `verify-bf-exit-regression` 同时通过 Tier I/Tier II 进入→退出→回大地图，console errors=0；shared **378/378**、client/server typecheck、`git diff --check` 通过。
- **Next**：继续 S10 战斗深化或按用户指定修复项推进。

*v15.95 | 2026-08-03 | Session 313 · S10 战场退出残帧修复*

## 2026-08-03 — Session 314 · S10 敌军战法效果同源修复

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、不新增字段/API/RNG/数据规模。
- 修复：抽出 `server/src/battle/special-effects.ts` 的共享 `applySpecialEffect`，玩家
  `castAbility` 与敌军 `runSimpleEnemyAi` 共用战法状态映射；敌军 `fire` 不再错误写入
  `fire`，而是与玩家一致写入 `burn`（并保持眩晕/击退/混乱/冲锋等映射）。敌军 `morale`
  降士气也与玩家一致改为 `floor(伤害×0.1)`，不再固定扣10。
- 文档：同步 `docs/05-combat-system.md` §18.1.1、根目录 `HANDOFF.md`。
- 验证：shared build、server typecheck、`verify-tactical-ai` **14/14**；新增断言覆盖敌军
  fire→burn。完整战斗/存档回归待继续收口。
- 边界：正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成。
- **Next**：保持 S10；可继续战法效果/敌军 AI 回归，或待用户批准后设计正式特殊兵种使用次数熟练度。

*v15.96 | 2026-08-03 | Session 314 · S10 敌军战法效果同源修复*

## 2026-08-03 — Session 315 · S10 敌军 proficiency 适性门禁修复

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、不新增字段/API/RNG/数据规模。
- 修复：敌军 AI 选择 `proficiency` 战法前增加适性门禁；`NONE` 直接不可用，避免构造
  Lv0 战法并施放。该路径现在与玩家 `castAbility` 的 `maxLevel===0` 校验一致；无适性时
  回退普通移动/攻击。
- 文档：同步 `docs/05-combat-system.md` §18.1.1、根目录 `HANDOFF.md`。
- 验证：shared build、server typecheck、`verify-tactical-ai` **16/16**；新增断言覆盖 NONE
  适性不会施放战法或产生战法状态。
- 边界：正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成。
- **Next**：保持 S10；继续战法/敌军 AI 一致性回归，或待用户批准后设计正式特殊兵种使用次数熟练度。

*v15.97 | 2026-08-03 | Session 315 · S10 敌军 proficiency 适性门禁修复*

## 2026-08-03 — Session 316 · S10 敌军战法 RNG 顺序修复

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、不新增字段/API/RNG/数据规模。
- 修复：敌军 AI 的战法执行现在先判命中，命中后再计算 `calcDamage` 与伤害浮动；失手
  只消费命中 RNG，不再提前消费伤害 RNG，与玩家 `castAbility` 的权威顺序一致。
- 文档：同步 `docs/05-combat-system.md` §18.1.1、根目录 `HANDOFF.md`。
- 验证：shared build、server typecheck、`verify-tactical-ai` **18/18**；新增失手 RNG 消费
  断言，完整战斗/存档回归待继续收口。
- 边界：正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成。
- **Next**：保持 S10；继续权威 RNG/战法一致性回归，或待用户批准后设计正式特殊兵种使用次数熟练度。

*v15.98 | 2026-08-03 | Session 316 · S10 敌军战法 RNG 顺序修复*

## 2026-08-04 — Session 317 · S10 敌军战法功绩适性同源修复

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、不新增字段/API/RNG/数据规模。
- 修复：敌军 `runSimpleEnemyAi` 现在复用玩家战法的功绩适性修正；功绩 Lv14 及以上的“全兵种适性+1级”作用于敌军战法候选，NONE→C、C→B、B→A、A→S，S 封顶。此前同一武将由敌军 AI 操作时仍读原始适性，可能与玩家路径产生不同战法等级/门禁。
- 文档：同步 `docs/05-combat-system.md` §18.1.1 与根目录 `HANDOFF.md`。
- 验证：shared build、server typecheck/lint、`verify-tactical-ai` **19/19**；新增功绩 Lv14 敌军适性升档断言。
- 边界（诚实）：正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成；本轮不宣称 P5-01 全局 AI 完成。
- **Next**：保持 S10，继续权威战法/敌军 AI 一致性回归；正式特殊兵种使用次数熟练度仍待用户批准，S16 SQLite 仍未实装。

*v15.99 | 2026-08-04 | Session 317 · S10 敌军战法功绩适性同源修复*

## 2026-08-04 — Session 318 · S10 敌军 AI 行动状态收口

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、不新增字段/API/RNG/数据规模。
- 修复：敌军六角 AI 完成普攻、战法、火计或移动后统一写入 `BattleUnit.hasActed=true`、`mp=0`，与玩家动作路径和战斗快照契约一致；下一玩家回合仍由既有推进逻辑只恢复我方单位。
- 文档：同步 `docs/05-combat-system.md` §18.1.1 与根目录 `HANDOFF.md`。
- 验证：shared build、server typecheck/lint、`verify-tactical-ai` **23/23**；新增普攻/火计/战法状态断言。
- 边界（诚实）：正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成；本轮不宣称 P5-01 全局 AI 完成。
- **Next**：保持 S10，继续权威战法/敌军 AI 一致性回归；正式特殊兵种使用次数熟练度仍待用户批准，S16 SQLite 仍未实装。

*v16.00 | 2026-08-04 | Session 318 · S10 敌军 AI 行动状态收口*

## 2026-08-04 — Session 319 · S10 敌军 AI 重入行动门禁

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、不新增 BattleState 字段、API、RNG 或数据规模。
- 修复：`runSimpleEnemyAi` 将存活敌军与本回合未行动敌军分开判定，并以 `hasActed` 阻止重复调用再次行动；全部敌军已行动时返回“敌军待机”，不误判为“敌军全灭”，不重复消费 RNG、移动或伤害。
- 验证：shared build、server typecheck/lint、`verify-tactical-ai` **25/25**；新增重入待机与伤害不重复断言。
- 边界（诚实）：正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成；本轮不宣称 P5-01 全局 AI 完成。
- **Next**：保持 S10，继续权威战法/敌军 AI 一致性回归；正式特殊兵种使用次数熟练度仍待用户批准，S16 SQLite 仍未实装。

*v16.01 | 2026-08-04 | Session 319 · S10 敌军 AI 重入行动门禁*

## 2026-08-04 — Session 320 · S10 敌军 AI 有效属性同源

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、不新增 BattleState 字段、API、RNG 或数据规模。
- 修复：敌军 AI 的战斗输入改用战斗引擎计算后的有效武力/统帅与装备护甲，统一计入功绩属性加成、装备属性加成和护甲减伤；旧简化调用仍兼容缺省护甲为 0。
- 文档：同步 `docs/05-combat-system.md` §18.1.1 与根目录 `HANDOFF.md`。
- 验证：shared build、server typecheck/lint、`verify-tactical-ai` **26/26**；新增装备护甲减伤断言。
- 边界（诚实）：正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成；本轮不宣称 P5-01 全局 AI 完成。
- **Next**：保持 S10，继续权威战法/敌军 AI 一致性回归；正式特殊兵种使用次数熟练度仍待用户批准，S16 SQLite 仍未实装。

*v16.02 | 2026-08-04 | Session 320 · S10 敌军 AI 有效属性同源*

## 2026-08-04 — Session 323 · S10 敌军主动单挑重入门禁

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、不新增 BattleState 字段、API、RNG 或数据规模。
- 修复：敌军主动单挑候选现在与普通敌军行动共享 `hasActed` 门禁；本回合已经普攻、战法、火计或移动的敌军不会再次进入主动单挑，也不会重复消费主动单挑 RNG。
- 文档：同步 `docs/05-combat-system.md` §18.1.1 与根目录 `HANDOFF.md`，明确普通行动和主动单挑候选均受同一行动状态契约约束。
- 验证：`verify-save-battle` **31/31**（含已行动敌军主动单挑重入回归）、`verify-tactical-ai` **28/28**；shared build、server typecheck/lint、`git diff --check` 全部通过。
- 边界（诚实）：正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成；本轮不宣称 P5-01 全局 AI 完成。
- **Next**：保持 S10，继续权威战法/敌军 AI/单挑一致性回归；正式特殊兵种使用次数熟练度仍待用户批准，S16 SQLite 仍未实装。

*v16.03 | 2026-08-04 | Session 323 · S10 敌军主动单挑重入门禁*

## 2026-08-04 — Session 324 · S10 六角天气伤害同源切片

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、不新增 BattleState 字段、API、RNG 或数据规模。
- 实装：`BattleState.weather` 现在进入玩家普攻、玩家战法、敌军普攻与敌军战法的 `calcDamage`；雨/暴雨攻击×0.95，雾/雪攻击×0.90，雪天防御×1.10，晴/阴天中性。旧脚本省略天气仍按晴天兼容。
- 边界：移动消耗、射程、雾天弓兵禁射与天气自动切换计时仍后置；火计既有雨/暴雨减半、雪天禁用规则保持不变。本轮不宣称完整天气系统完成。
- 文档：同步 `docs/05-combat-system.md` 天气表与 §18.1.1、根目录 `HANDOFF.md`。
- 验证：`verify-tactical-ai` **29/29**（新增雪天攻防对照）、`verify-save-battle` **31/31**；server typecheck/lint、shared build、`git diff --check` 全部通过。
- **Next**：保持 S10，继续权威战法/敌军 AI/天气一致性回归；正式特殊兵种使用次数熟练度仍待用户批准，S16 SQLite 仍未实装。

*v16.04 | 2026-08-04 | Session 324 · S10 六角天气伤害同源切片*

## 2026-08-04 — Session 325 · S10 六角天气回合计时切片

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、不新增并列系统。
- 实装：`BattleState.weatherChangeTimer?` 纳入六角战斗状态与严格 Schema；新建战斗从3回合计时。敌军阶段完成并进入玩家新回合时递减，归零后按 `GameState.season` 的季节权重与权威 `xorshift32-v1` 抽取不同于当前天气的下一天气，并重置3~8回合；天气变化写入战报。
- 兼容：旧存档/旧脚本缺少计时器时保持静态天气，不消费额外 RNG；未改变既有天气伤害、火计、AI 战法或数据规模。
- 文档：同步 `docs/03-data-models.md`、`docs/05-combat-system.md`、`docs/21-battlefield-scene-design.md`、根目录 `HANDOFF.md`。
- 验证：`verify-save-battle` **34/34**、`verify-tactical-ai` **29/29**、shared **378/378**、server typecheck、`git diff --check` 全部通过。曾误用不兼容 Vitest 的 `--runInBand`，改用项目原生命令后通过。
- 边界：移动消耗、射程、雾天弓兵禁射和天气主动技能仍后置；正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成；本轮不宣称完整天气系统或 P5-01 全局 AI 完成。
- **Next**：保持 S10，继续天气/战法/敌军 AI 权威一致性回归；移动与射程规则仍待后续切片，正式特殊兵种熟练度仍待用户批准。

*v16.05 | 2026-08-04 | Session 325 · S10 六角天气回合计时切片*

## 2026-08-04 — Session 326 · S10 雾天弓兵禁射一致性切片

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、不新增字段/API/RNG 或数据规模。
- 实装：雾天对 `UnitTemplate.range > 1` 的远程兵种统一禁射；玩家可用战法列表、玩家施放、敌军战法候选、敌军普攻与移动后追击共享同一门禁。当前 0-A 实际远程模板为弓箭手。
- 行动契约：被雾禁射的敌军仍写入 `hasActed=true, mp=0`，不消费攻击 RNG，并写入“雾中无法射击”战报；一般射程/移动天气修正仍未实装。
- 文档：同步 `docs/05-combat-system.md`、`docs/21-battlefield-scene-design.md` 与根目录 `HANDOFF.md`。
- 验证：`verify-tactical-ai` **32/32**（新增雾天弓兵不伤害、不消费 RNG、结束行动断言）、shared build、server typecheck 通过。
- 边界（诚实）：本轮不是完整天气系统或 P5-01 全局 AI；移动消耗、一般射程修正、天气主动技能、正式特殊兵种熟练度、0-B 数据、阵型协同包围/撤退仍未完成。
- **Next**：保持 S10，继续玩家/敌军战法与天气门禁回归；移动/一般射程规则需另行切片，正式特殊兵种熟练度仍待用户批准。

*v16.06 | 2026-08-04 | Session 326 · S10 雾天弓兵禁射一致性切片*

## 2026-08-04 — Session 327 · S10 玩家远程普通攻击射程一致性

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、并列系统、字段/API、RNG 或数据规模。
- 修复：玩家 `attackUnit` 现在按 `UnitTemplate.range` 区分远程普通攻击与白刃攻击；远程单位使用
  1~兵种射程距离门禁，不再错误进入剑/枪/斧的朝向判定。白刃单位保留既有正面/侧面、长枪 1~2 格规则。
- 一致性：玩家普通远程攻击与战法共享雾天禁射门禁；同时补齐玩家服务端已行动/溃败单位门禁。
- 文档：同步 `docs/05-combat-system.md`、`docs/21-battlefield-scene-design.md`。
- 验证：`verify-save-battle` **36/36**（含真实玩家弓兵在2格普通攻击、雾天拒绝且不消费 RNG）；
  `verify-tactical-ai` **32/32**；server typecheck、shared build、`git diff --check` 通过。
- 边界（诚实）：天气移动消耗/一般射程修正、天气主动技能、正式特殊兵种熟练度、0-B 数据、阵型协同
  包围/撤退仍未完成；本轮不宣称完整天气系统或 P5-01 全局 AI。
- **Next**：保持 S10，继续玩家/敌军战法与天气门禁回归；移动消耗和天气一般射程修正仍待后续切片。

*v16.07 | 2026-08-04 | Session 327 · S10 玩家远程普通攻击射程一致性*

## 2026-08-04 — Session 328 · S10 天气移动与一般射程修正

- Phase：**S10 战斗深化**；继续同一大系统，不扩 0-B、不新增 BattleState 字段、API、RNG 或数据规模。
- 实装：新增 `server/src/battle/weather.ts` 权威天气修正函数。晴/阴不变；雨/暴雨/雾移动力 -1，雪 -2；
  雨/暴雨/雪一般远程兵种射程 -1，雾 -2（最低射程1）。玩家移动范围/路径、敌军 AI 走位、双方普通攻击
  统一消费；火计与兵种战法专属范围保持原规则。
- 文档：同步 `docs/05-combat-system.md` 天气运行时说明与边界；根目录 `HANDOFF.md` 已双写。
- 验证：`verify-tactical-ai` **39/39**、`verify-save-battle` **36/36**、shared build、server typecheck、
  `git diff --check` 通过；验证覆盖天气修正函数、真实战斗远程攻击/雾天门禁、存档 Schema 往返与 AI 回合链。
- 边界（诚实）：天气主动切换技能、地形可见范围、移动后特殊连击、正式特殊兵种熟练度、0-B 数据、阵型协同
  包围/撤退仍未完成；本轮不宣称完整天气系统或 P5-01 全局 AI。
- **Next**：保持 S10，继续玩家/敌军战法、天气与行动状态的权威一致性回归；待后续切片处理天气技能和其余战术规则。

*v16.08 | 2026-08-04 | Session 328 · S10 天气移动与一般射程修正*

## 2026-08-04 — Session 329 · S10 六角天气 HUD 展示

- Phase：**S10 战斗深化 / UI 收口**；继续同一大系统，不新增状态字段、API、RNG 或数据规模。
- 实装：`BattleView` 顶部新增只读 `battle-weather` 状态条，显示天气中文名、当前移动/射程修正、雾天远程禁射提示与 `weatherChangeTimer` 倒计时；数据全部消费服务端 `BattleState` 快照。
- 文档：同步 `docs/07-ui-design.md` 六角战斗 HUD 说明与根目录 `HANDOFF.md`。
- 验证：client typecheck、client **43/43**、`git diff --check` 通过；真实 Headless Chrome 进入六角战场后读取实际 DOM，确认 `天气：晴 · 移动/射程无修正 · 3回合后变化` 且战斗 Canvas 存在。复用 Session 277 旧脚本在更早的路径悬停摘要断言处失败，未影响本次 HUD DOM 验证。
- 边界（诚实）：天气主动切换技能、地形可见范围、移动后特殊连击、正式特殊兵种熟练度、0-B 数据、阵型协同包围/撤退仍未完成；本轮不宣称完整天气系统或 P5-01 全局 AI。
- **Next**：保持 S10，继续玩家/敌军战法、天气与行动状态的权威一致性回归；天气主动技能仍需用户确认正式规则后再做。

*v16.09 | 2026-08-04 | Session 329 · S10 六角天气 HUD 展示*

## 2026-08-04 — Session 330 · S10 六角移动路径预览与撤销 UI 收口

- Phase：**S10 战斗深化 / UI 收口**；继续同一大系统，不新增状态字段、API、RNG 或数据规模。
- 实装：BattleView 六角格悬停调用既有服务端路径查询，显示 `move-path-summary`（路径格数、总消耗、剩余移动力）；
  最后一次仍可逆的移动显示 `btn-battle-undo`，复用既有权威撤销接口。移动预览不在客户端复制 A* 或地形规则。
- 文档：同步 `docs/07-ui-design.md` 路径/撤销 UI 说明与根目录 `HANDOFF.md`。
- 验证：client typecheck、client **43/43**、`git diff --check` 通过；真实 Headless Chrome `verify-session277-ui` 完整通过：
  选中→悬停显示“路径 1 格 · 消耗 1 · 剩余 4 移动力”→移动→撤销恢复原位，console errors=0。
- 边界（诚实）：天气主动切换技能、地形可见范围、移动后特殊连击、正式特殊兵种熟练度、0-B 数据、阵型协同包围/撤退仍未完成；本轮不宣称完整 S10 或 P5-01 全局 AI。
- **Next**：保持 S10，继续玩家/敌军战法、天气与行动状态的权威一致性回归；天气主动技能仍需用户确认正式规则后再做。

*v16.10 | 2026-08-04 | Session 330 · S10 六角移动路径预览与撤销 UI 收口*
