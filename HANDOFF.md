# HANDOFF — 会话交接

> **接手必读**：本文件 + `docs/10-progress.md` + `docs/12-system-map.md`  
> 勿从聊天历史推断。数字真源：`docs/08-data-dictionary.md`。

---

## 1. 现在在哪

| 项 | 状态 |
|----|------|
| 会话 | **Session 316 收口**（S10 敌军战法 RNG 顺序修复；S16 槽位 UI 保持） |
| 阶段 | Phase 0-A + Demo 玩法环；**暂缓 0-B**；系统数 **27 大** |
| 代码最新 | Session 316：敌军战法先判命中、后算伤害，修复失手额外消费伤害 RNG；Session 315 适性门禁、Session 314 效果同源、Session 313 战场退出及 S16 槽位 UI 保持 |
| 文档最新 | `05`/`10-progress` 与本交接已同步战法 RNG 顺序修复；S16 文档保持槽位 UI 边界，SQLite、多用户仍未实装 |
| 本交接用途 | 六角初始部署、多 unit、变阵状态机、战报解释 UI、浏览器变阵→攻击链及敌军 leveled 兵种战法已闭环；三模式点值同源、标准战术矩阵仍保持 |
| 下一步 | 保持 S10；可待用户批准后设计正式特殊兵种使用次数熟练度，或继续 S16 SQLite；**未提交提醒**：Session 301~316 改动尚未 commit |

### Session 316 交接要点

- 修复敌军 `proficiency/leveled` 战法 RNG 顺序：先消费命中判定，命中后才进入 `calcDamage` 与伤害浮动；失手不再提前消费伤害 RNG，与玩家 `castAbility` 路径一致。
- 不改变战法伤害、气力、效果、字段或数据规模；仅修正权威 RNG 消费顺序。
- 验证：shared build、server typecheck、`verify-tactical-ai` **18/18**；完整战斗/存档回归待本轮收口后复跑。
- 边界：正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成。

### Session 315 交接要点

- 修复敌军 `runSimpleEnemyAi`：`proficiency` 战法候选现在先检查当前兵种适性，`NONE` 直接不可用；与玩家 `castAbility` 的 `maxLevel===0` 门禁一致。
- 不新增 BattleState 字段、API、RNG 或数据规模；无适性敌军回退普通攻击/移动逻辑。
- 验证：shared build、server typecheck、`verify-tactical-ai` **16/16**；`verify-save-battle` **30/30**，shared **378/378**。
- 边界：正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成。

### Session 314 交接要点

- 修复 S10 六角敌军 AI 与玩家 `castAbility` 的战法效果分叉：抽出共享 `applySpecialEffect`，确保 `fire` 统一写入 `burn`，并保持眩晕/击退/混乱/冲锋等状态映射一致。
- 敌军 `morale` 战法降士气改为与玩家路径一致的 `floor(伤害×0.1)`；不新增 BattleState 字段、API、RNG 或数据规模。
- 验证：shared build、server typecheck、`verify-tactical-ai` **14/14**；完整战斗/存档回归待本轮收口后复跑。
- 边界：正式特殊兵种使用次数熟练度、0-B 特殊兵种数据、阵型切换/协同包围/撤退仍未完成。

### Session 313 交接要点

- 修复 Tier I `撤兵` 与 Tier II `退出战场`：不再从可能污染的旧 `sceneStack` 中 `popToScene`，而是强制重建唯一 `[world]` 根栈。
- 同步清理前端 `battlefield/battle/melee` 瞬态，服务端退出端点与战斗规则不变。
- 验证：真实 Chrome `verify-bf-exit-regression` 同时走通 Tier I、Tier II 进入→退出→回大地图，console errors=0；shared 378/378、typecheck、diff-check 通过。

### Session 312 交接要点

- S16 系统菜单槽位 UI 已实装：顶部“槽位存档”打开面板，支持安全槽位名、列表刷新、保存、覆盖确认和读取确认。
- 读取后按服务端权威状态重建 world/battlefield/melee/battle 场景栈；不新增 GameState 字段、规则、RNG 或数据规模。
- 验证：client/server typecheck；真实 Chrome `verify-s16-save-slots-ui` 通过（面板、保存、读取、190年1月恢复、console errors=0）。
- 边界：SQLite、多用户/云同步仍未实装。

### Session 311 交接要点

- S16 XDG 服务端槽位已实装：`GET /api/game/save/slots`、`POST /api/game/save/slots/:slot`、`POST /api/game/save/slots/:slot/load`。
- 文件目录为 `$XDG_DATA_HOME/leh/saves/`，未设置时回退 `~/.local/share/leh/saves/`；槽位名限制 1~32 位安全字符，保存先写同目录临时文件再原子 rename，读取限制 2MB。
- 槽位读取统一复用浏览器导入的 `migrateSaveEnvelopeToCurrent`、剧本兼容、`GameStateSchema` 和 RNG 恢复；无新 GameState 字段、规则、数据规模。
- 验证：server typecheck、shared build、`verify-save-slots` **4/4**；尚未实现系统菜单槽位 UI、SQLite、多用户/云同步。

### Session 310 交接要点

- S16 浏览器文件存档已实装：`GET /api/game/save/export` 返回完整 `SaveEnvelopeV1`（含权威 RNG），`POST /api/game/save/import` 复用现有迁移、剧本兼容检查、完整 `GameStateSchema` 和 RNG 恢复。
- 顶部栏新增“导出存档/导入存档”；导出为 `leh-YYYY-MM.json` 下载，导入为用户选择的 JSON 文件。完整 0-A 快照已将 Express JSON 请求上限从 64KB 调至 2MB，内容校验不放宽。
- 边界：仅浏览器文件层，不是 SQLite/XDG 多槽位；不进入 0-B，也未新增 GameState 字段。
- 验证：shared 377/client 43 tests、三端 typecheck/lint；真实 Headless Chrome 点击导出按钮、选择并触发导入文件，月份从 3 恢复到 1，按钮与恢复链通过。

### Session 309 交接要点

- `castAbility` 与敌军六角 AI 现在都支持 `proficiency` 战法：0-A 暂以当前兵种适性 C/B/A/S
  作为 `basePower→maxPower` 线性代理，消耗静态 `energyCost`，不新增字段或数据规模。
- `aoe` 以目标为中心展开 1 格范围，主目标全额、邻格敌军 50% 溅射，状态效果和整方存活判定保持同一结算链。
- 真实 0-B 特殊兵种数据和正式使用次数熟练度仍未落库；不宣称特殊兵种全量或 P5-01 全局 AI 完成。
- 验证：server typecheck、shared build、validate-data、`verify-tactical-ai` **13/13**；未新增浏览器 UI，原因是既有战法按钮/战报链可复用。

### Session 307 交接要点

- 敌军回合新增主动单挑最小切片：从相邻敌我单位中稳定选择候选，使用共享 `duelTriggerChance`
  （六角 8% 基础率 + 勇猛/士气差），通过 `canChallenge` 门禁后复用既有 `createDuel`、权威 RNG、
  四倾向默认 `delegate` 和 `applyDuelOutcome`；首次回合立即推进，随后由已有 DuelPanel 观看/跳过。
- 玩家侧沿用现有自动接受策略；拒绝时写战报并继续普通敌军 AI，不新增 BattleState 字段或数据规模。
- 边界：`proficiency` 特殊战法、范围战法多目标、敌军变阵/包围/撤退仍未完成；不宣称 P5-01 全局 AI。
- 验证：server typecheck、shared build、`verify-tactical-ai` **9/9**、`verify-save-battle` **30/30**；Session 308 已补真实 Chrome 敌军主动单挑物理点击链，`verify-s10-enemy-duel-ui` 退出码 0、console errors=0。

### Session 306 交接要点

- `verify-fm4-hex-formation` 现在会对变阵后的战斗切片执行 JSON 序列化/反序列化，再经
  `GameStateBattleSchema` 恢复；TP、变阵前后阵型和战报 TP 解释均保持。
- 验证：FM-P4 **14/14**、`verify-save-battle` **30/30**、`verify-tactical-ai` **9/9**、shared build 通过。
- 边界：本轮为存档契约验收，不是完整存档 UI；主动单挑、多目标特殊战法仍未完成。

### Session 305 交接要点

- 敌军六角回合现在会在目标进入 1~2 格时读取兵种 `leveled` 战法，按兵种适性和气力选择最高可用层级。
- 结算复用既有六角伤害、阵型点值与权威 RNG；成功施放会写伤害/状态效果并结束行动，失手只扣气力。
- `verify-tactical-ai` 9/9、`verify-battle-rng` 5/5、`verify-save-battle` 26/26、server typecheck 通过。
- `proficiency` 特殊战法、多目标范围展开、敌军主动单挑/变阵/包围/撤退仍未做，不宣称 P5-01 完成。

### Session 304 交接要点

- `BattleReport` 仍展示最近六条日志，但额外固定展示最近一次结构化 `formation` 解释；因此变阵后经过敌军回合和攻击，仍可见“变阵：前阵→后阵；TP 前→后”。
- 真实 Chrome 1440×900 已再次完成选择我军→变阵→结束行动→移动→攻击；报告面板同时命中“变阵：”与“阵型贡献：”，console errors=0。
- 验证：`verify-fm4-report-ui`、`verify-fm4-hex-formation` 11/11、typecheck/lint/test/build/validate-data 全绿。

### Session 303 交接要点

- `verify-fm4-report-ui` 使用 CDP `Input.dispatchMouseEvent`，读取当前页面实际可用阵型，兼容不同主将精通表。
- 浏览器实际完成进入六角战场、选中我军、变阵、结束行动、逐步移动、攻击；面板同时显示“变阵：…”与“阵型贡献：…”，console errors=0。
- 验证：`verify-fm4-hex-formation` 11/11；shared 377/client 43；typecheck/test/build 全绿。

### Session 302 交接要点

- `BattleState.log[]` 的可选 `explanation` 由服务端生成，旧存档/旧日志无需迁移；客户端不自行计算规则。
- `BattleReport` testid 为 `battle-report`，阻断原因 testid 为 `battle-report-error`；当前面板展示最近六条记录。
- 验证：`verify-fm4-hex-formation` 11/11；typecheck/lint/build；Chrome 1440×900 进入六角战场检查面板出现、console error=0。

### Session 301 交接要点

- **六角变阵状态机**：`BattleState` 维护 TP（初始 5，智力 ≥80 +1，上限 10）和本回合已用 TP；`POST /battle/formation` 服务端校验玩家阶段、主将未行动、1 TP、每回合一次、精通/兵种/被围条件。
- **状态变更**：成功后同步攻方存活 `BattleUnit` 阵型，主将 `hasActed=true`、MP 清零，仍留在六角玩家阶段；敌军阶段完成后 TP 增长并重置门禁。
- **结算/UI**：退出六角时将实际阵型写回 `MeleeState.attackerFormation`；`BattleView` 提供六基础阵型按钮，按钮仅展示服务端状态。
- **验证**：`verify-fm4-hex-formation` 9/9；typecheck 已通过；完整测试、构建和浏览器实测待收口。

### Session 300 交接要点

- **版权残留清理**：隔离疑似带商业品牌标识的早期演示截图，当前跟踪截图从 126 张收敛为 125 张；`CREDITS.md`、`ASSET_MANIFEST.md` 与 `verify-compliance.mjs` 同步。
- **中性化表达**：移除生产代码及公开进度文档中的商业作品参考名称；所有本地分支、远程跟踪引用和提交说明完成同义替换历史重写。
- **合规门禁**：补齐 `FactionOverviewDrawer.tsx`、`mandate-popular.ts`、`relations.ts`、`skill-tree.ts` 的 SPDX 标识。
- **Agent 状态**：本项目专属的空状态目录已清除；共享 Codex 全局状态未整目录删除，避免影响其他项目。发行包仍必须排除所有 Agent 状态、会话、数据库、WAL、认证文件。
- **验证边界**：版权清理完成后仍需运行 `pnpm verify-compliance`、类型检查、测试、构建和 Git 全历史扫描；远端仓库需按历史重写结果强制更新。

### Session 299 交接要点

- **查实并修复标签重复**：`OfficerDetail` 原有「关系」和「社交」两个并列页签；现统一为唯一「关系」页签，内容包含婚姻、妾/姬、子女、效力、社交关系列表和关系图谱。
- **边界**：仅调整前端归类；S18 家族数据、S24 `GET /api/game/relations/:officerId` 与关系引擎继续分域。
- **验证**：新增 SSR 标签断言；client typecheck/lint、43 tests 全绿；Chrome 实点名册→武将详情→关系，确认五个页签中仅一个关系页签，婚姻/社交关系/关系图谱均显示。

### Session 298 交接要点

- **修复战场撤出回环**：Tier I `battlefieldInit` 现在入 `sceneStack`；Tier I/Tier II 退出均回收到
  `world` 根栈，清理前端 `battle/battlefield/melee` 瞬态；白刃战退出根据父战场栈返回，不再硬编码
  `screen='battlefield'`。根因是旧 Tier I 退出只改 screen，残留 battlefield 帧会污染下一次出战撤军。
- **验证**：client typecheck/lint；shared 377/client 42；Chrome 1440×900 实测 `verify-bf-p4-headless`
  颍川/南郡进入、阵前+城下单挑、退出回环、console error=0 全过。旧 Session 274 脚本在当前 0-A
  仅有南郡/颍川入口，前两项退出通过后因缺少陈留入口停止，非本修复失败。
- **边界**：未改变服务端战斗结算；六角进行中仍须先完成后才能由 `exitBattle` 权威结算，不能强制
  中断。相关设计已同步 `docs/21-battlefield-scene-design.md` §10.1.1。

### Session 297 交接要点

- **六角部署投影**：`shared/formation-core.ts` 新增纯函数 `projectHexDeployment`；按阵型 `deployment.slots`
  以中军锚点投影 20×15 六角场，攻方保持方向、守方镜像，缺部不造虚构 unit，越界/碰撞按固定邻接顺序收缩。
- **多 unit 创建**：`createBattle` 新增可选 `attackerArmy/defenderArmy`；tactical melee 入口传入攻守
  `CampaignArmy`，按 `squads` 生成 BattleUnit，主将 center；无 Army 旧入口仍生成 `atk-1/def-1` 双 unit。
- **多 unit 终局**：六角普攻、战法、火计、simple AI、灼烧均按整方存活 unit 判胜负；客户端现有 `units[]`
  交互无需专门改写。六角变阵状态机、组织度执行档、战报解释 UI 未做。
- **验证**：`verify-fm3-hex-deployment` 13/13；`verify-battle-commanders` 111；shared 377/client 42；
  三端 typecheck、validate-data、client build 全绿。

### Session 296 交接要点

- **战术协同矩阵（标准模式）**：`MeleeState.tactic?`（optional 旧档兼容，Zod 同步）；`shared/tactical-system.ts`
  新增 `resolveTacticSynergy`（敌阵 ∈ strongAgainstFormationIds → 1.1，否则 1.0；null 中性）/`tacticModifiers`（T_base，
  不受组织度缩放）/`ACTIVE_TACTIC_IDS`；synergy 常量 1.1 / 1.0 / **0.9 保留（0-A 无反向关系表不触发，诚实标注）**
- **消费**：runMeleeRound 先手+initiative、攻方伤害 `(F+T_base)×synergy`、我方减伤+战术防；战报 events 记「战术·强攻」
- **持久/UI**：`POST /melee/tactic`（null 清除）+ `meleeSetTactic` 运行时校验非法值 + client api/store +
  StandardModePanel「战术姿态」四按钮（强攻/固守/奇袭/无）
- **data**：`loader.loadTacticalSystemV2()`（shared/data v2 + Zod）；index.ts 注入 `setMeleeTacticalConfig`
- **验证**：verify-fm3-tactic 9 断言 + shared 单测 +2（376）；tsc/lint 三端、376+42、validate-data、client build、
  verify-melee-modes 12、fm3-* 全系、verify-campaign 71 全绿
- **边界（诚实）**：synergy 0.9 不触发（无反向表）；战报解释 UI 未做（FM-P4）；六角部署注入未做（多 unit/BattleState
  org/状态机评审待拍板）

### Session 295 交接要点

- **六角战斗阵型贡献**（`server/src/battle/hex-formation.ts`）：攻点值×2 进 baseAttack / 防点值×2.5 进
  baseDefense（六角公式量纲模式专用投影，计划 §5.1 允许）；负修正原值保留；组织度 60（orderly×1.0）中性；
  未注入中性回退；`hexFormationMods` 导出供战报复算/验证。
- **接入点**：calcDamage 三处同源（普攻 attackUnit / 战法 castAbility / AI 评估 simpleAi）；crit 反击连击
  继承 baseDamage 自动覆盖；`DamageInput` 只在尾部加可选字段，不影响既有调用。
- **验证**：verify-fm3-hex-formation 11 断言全过；tsc/lint/test(374+42)/validate-data/client build +
  verify-campaign 71 / melee-modes 12 / fm3-* / battle-rng 5 / tactical-ai 6 / items 32 / save-battle 26 全绿。
- **边界（诚实）**：六角部署注入未做（多 unit 支持需客户端/AI 大改、六角变阵状态机未评审冻结、BattleState
  无组织度字段→六角 org 执行档后置）；战术协同矩阵运行时（synergy 1.1/0.9/1.0）与战报解释 UI 未做（FM-P4）。

### Session 294 交接要点

- **纯文档**：README 重写为游戏项目自述；重要章节（The Game / Honest scope / Who it's for / Architecture /
  Copyright & assets / Roadmap）中英双语（先 EN 后 ZH）；Quick Start/截图/徽章保留；验证命令清单与长 CI
  断言段压缩为一句 sanity checks + 指引 CONTRIBUTING.md；相对链接逐一核对无死链；`git diff --check` 通过。
- **未提交提醒**：git HEAD 停在 6ed054b（S13，Session 266）；Session 267~293 的生产代码/文档仍未提交，
  本次 push 范围需用户明确。

### Session 293 交接要点

- **纯文档**：`README.md` 按当前进度重写 status/limitations/validation/CI 描述/roadmap；断言数字全部实测
  （见上表），`pnpm test` 更新为 shared 374 + client 42；validation 命令清单补充 s27/items/merit*/hc*/bf*/melee-modes/tactical-ai/r8。
- **零代码/数据/规则改动**：`git diff --check` 通过，仅 README.md + 进度双写。

### Session 292 交接要点

- **自动战斗阵型贡献（`server/src/engine/campaign.ts`）**：
  - `autoFormationMods(formationId, org, squads)`：`tiers[0]` 攻防点值 ×0.1 合并加性战力修正、
    组织度执行档（`resolveFormationContribution` 五档仅缩放正面增量、负原值保留）、五部侧击 +10%
  - `squadFlankBonus`：己方有左/右翼 Squad → +10%（05 §13.3，0-A 简化不判敌展开结构）
  - `ArmyPowerInput.formationMod?`（缺省 0）+ `computePower` `commandMod` 加性项（与全局 orgCoeff 分项不双乘）
  - `runAutoBattle` 4 处 computePower 注入（攻方每回合按当回合 atkOrg；守城无 Army → formationMod 0）
  - `mobility/range` 点值不参与自动战力（自动无走向/射程概念）
- **单一内容源**：`setAutoFormationCatalog(staticData.formations)` 服务端启动注入；null 回退中性
- **验证**：verify-fm3-auto-formation 13 断言（系数/组织度/侧击/中性/端到端注入生效/固定 rng 复现）；
  typecheck/lint 三端、verify-campaign 71/71、verify-fm3-auto-battle 4、verify-fm3-idempotency 5、
  verify-fm3-melee-inject、verify-fm3-crit-inject、verify-melee-modes 12/12、verify-ai-military-rng 38/38
- **边界（诚实）**：六角 `battle.ts` 阵型贡献/部署注入未做（多 unit 支持需客户端/AI 大改、六角变阵
  状态机未评审冻结）；战术协同矩阵运行时（synergy 1.1/0.9/1.0）与战报解释 UI 未做（FM-P4）

### Session 291 交接要点

- **标准模式点值迁移（用户拍板：等价性换算）**：
  - `MELEE_ATK_GAIN=0.1`/`MELEE_DEF_GAIN=0.1`/`MELEE_MOB_GAIN=0.5`/`MELEE_MOB_BASE=1.0` 模块常量；
    `standardMeleeMods(formation, organization?)` 导出（战报复算可复用）
  - 逐阵（orderly ×1.0 基准）：方 +0.10/+0.10/1.0、圆 -0.20/+0.30/0.0、锥 +0.20/-0.20/1.0、
    雁 0/-0.10/1.5、鹤 0/0/1.5、锋 +0.10/-0.10/1.5（vs 旧 meleePercent 登记基线，见 migration doc §4.2）
  - **诚实标注**：点值与旧百分比分布不同不逐点相等（方阵纯防御→均衡、锥形先手最快→中性、
    鹤翼攻防兼→机动型，符合 05 §4.5.1 语义）
- **组织度执行档（§4.4）**：`MeleeState.attackerOrganization/defenderOrganization?` optional 旧档兼容
  （Zod 同步）；`meleeStart` 从 Army 快照；`resolveFormationContribution` 五档执行只缩放正面增量、
  负修正原值保留；缺省 orderly ×1.0 中性（旧档不漂移）
- **meleePercent 退役（单一内容源收口）**：类型/Zod/formations.json/generate-0a-data 移除；
  未注入 catalog 回退中性（无第二数值表）
- **验证**：verify-fm3-melee-inject 16 断言全过 + 迁移对比表；typecheck/lint 三端、validate-data、
  shared 374 + client 42、verify-melee-modes 12/12、verify-fm3-crit-inject/idempotency 5/auto-battle 4、
  verify-crit/campaign 71/duel/tactical-ai 6/save-battle 26、client build 全绿
- **边界（诚实）**：自动 `runAutoBattle` formationMod=0、六角 `battle.ts` WEDGE/SQUARE 硬编码与部署注入
  未动；战术协同矩阵运行时（synergy 1.1/0.9/1.0）与战报解释 UI 未做（FM-P4）

### Session 290 交接要点

- **crit.ts 单一内容源注入（行为等价）**：
  - `setFormationCatalog(catalog|null)` + `catalogFormationMods` + `formationModsResolved`（未注入回退旧硬编码）
  - 4 处 `formationMods` → `formationModsResolved`；`server/src/index.ts` 启动注入 `staticData.formations`
  - `verify-fm3-crit-inject.ts` 5 断言（7 阵 crit/counter/coeff/chain 注入 vs 硬编码浮点等价；鹤翼/冲阵生效）
- **meleeRound 百分比表外移（用户拍板，行为不变）**：
  - `Formation` 类型 + Zod 新增可选 `meleePercent { atk, def, mobility }`；03 §9 同步
  - `formations.json` 六基础补 meleePercent（冲阵无，不入标准候选）；`generate-0a-data.ts` 同步
  - `meleeRound.ts` `setMeleeFormationCatalog` + `meleeMods`（未注入回退旧 `FORMATION_MODS`）；伤害/先手不变
  - `verify-fm3-melee-inject.ts` 4 断言（6 对阵伤害/先手注入 vs 硬编码一致）
- **白刃战动作级幂等（§7.5）**：
  - `MeleeState.commandCache?` + schema；`meleeRound` service 增参 commandId/expectedRound（同 ID 同轮重试返回首次结果、过期拒绝）
  - route + client api/store 自动生成 commandId；`verify-fm3-idempotency.ts` 5 断言
- **自动入口恢复 `runAutoBattle`（§2.2/§7.4 清债）**：
  - 局部自动结算由 `runMeleeRound` 循环改为调用既有 `runAutoBattle`（结果桥接回 melee 一次回写）
  - `verify-fm3-auto-battle.ts` 4 断言（phase 终局 + 单次回写 + 走 runAutoBattle 语义）
  - 验证：三端 typecheck/lint、validate-data、shared 374 + client 42、client build、
    verify-crit/melee-modes 12/campaign 71/duel/merit-consume 17/tactical-ai 6/fm3-* 全绿
  - **边界（诚实）**：meleeRound 百分比（0.30）与 tiers 点值（def=1）量纲不同，**点值迁移未做**
    （需单独平衡）；六角 `battle.ts` 部署注入未做

### Session 289 交接要点

- **FM-P2 共享阵型解析器**（`shared/formation-core.ts`，纯函数，零 RNG/零状态）：
  - `organizationBandFor` + `ORGANIZATION_BANDS`（组织度五档 80/60/40/20 边界）
  - `getAvailableFormations`：0-A 候选 `[0,1,2,3,4,6]`，逐阵 available + blockReason（未精通/兵种/被围/已变阵/未知）
  - `resolveFormationContribution`：读 `tiers[0]` 攻防机射 + `effects` 暴击链 + 组织度执行档
  - `applyOrganizationExecution`：负修正原值保留、正修正按档缩放
  - `resolveFormationDeployment` / `explainFormationResolution`（Gate D / 战报复算）
  - 暴击链结构化入库 `formations.json` effects（单一内容源，05 §4.7）；`generate-0a-data.ts` 同步
  - 验证：shared 374（+7 formation-core）+ client 42、三端 typecheck/lint、validate-data、
    verify-melee-modes 12/12、verify-campaign 71/71、verify-crit 全绿
  - **边界**：FM-P2 仅纯函数 + 数据真源，未接引擎；三模式/AI/UI/存档迁移属 FM-P3~P5

### Session 288 交接要点

- **FM-P1 实装（Schema/数据迁移，Zod 先行）**：
  - `shared/types/formation.ts` → 长期目标 `Formation`（family/tiers/ultimate/prerequisites?/deployment?）+ `FormationDeployment`/`HexOffset` + `ZERO_A_PLAYABLE_FORMATION_IDS=[0,1,2,3,4,6]`；`FormationTemplate` 标 deprecated
  - `shared/validators` `FormationSchema` 替换旧 `FormationTemplateSchema`；`server/loader` 类型同步
  - TacticalConfig v2（`shared/data/tactical-system.v2.json` + `parseTacticalConfigV2` + `migrateTacticalV1ToV2`）；v1 只读保留
  - `formations.json`：7 阵 `[0,1,2,3,4,6,16]`；圆阵(1)/雁行(3) 补齐、7/8 移出可选集；数值按 05 §4.5.1 校勘；填 family/tiers/ultimate/deployment
  - `officers.json`：146 将精通按已审 CSV 迁移；10 名骑兵将保留冲阵 16 精通（不入候选）
  - `validate-data` 新增 formations 目录 + officer 精通跨引用；`generate-0a-data.ts` 同步
  - 验证：validate-data、三端 typecheck/lint、shared 367 + client 42、client build、verify-melee-modes 12/12、verify-campaign 71/71、verify-crit/duel 全绿
  - **边界**：运行时硬编码（`meleeRound`/`battle`/`runAutoBattle`/`crit`）退役归 FM-P2/P3 共享解析器注入；FM-P2~P5 未启动

### Session 286 交接要点

- **S27 深化三项全实装**（设计 `docs/34` §十~§十二，真源 `docs/08` §二十三~§二十五）：
  - **派系事件**（每城每月至多 1 个，叛乱判定后）：先高池（任一派系 ≥70，25%），未中则
    低池（核心三派系任一 <30，20%）；取 entries 顺序首个命中派系；正负事件 11 种
    （名门献金/流民垦荒/货路繁盛/豪强应募/宗族输粮/教团祈福/官宦引荐/游侠缉盗 +
    世家抽逃/流民流亡/商贾撤资），RNG 消费：高池判定 1（未中另 1 次低池）+ 数值 1；
    `pickFactionEvent` 纯函数，actionLog type=`faction_event`。
  - **弹劾**：`eunuchs` <30 且城有在职非君主城主 → 每月 20%（仅当月未叛乱时）；写
    `City.pendingImpeachment? = { officerId, sinceStamp }`（optional，Zod 同步，旧档兼容）；
    处理二选一（`POST /civil/impeach`）：安抚（100 金 → 官宦 +20）或撤换（S12 appointOfficer
    解职移首都，忠诚 −10、官宦 +10，君主拒撤）；逾期 stamp 差 ≥2 月落空（官宦 −5、城主 −2）。
    乡政分面红框警示条 + 两按钮（testid `civil-impeach-appease`/`civil-impeach-remove`）。
  - **自募武装**：豪强/宗族 ≥60 → 每月 15%；兵力 +max(20, floor(人口×0.005))、兵装 −3、
    该派系 −5；与高池事件互斥；0-A 不产生独立私兵字段，直接并入城兵力。
  - **Session 286 实测校准（真实 HTTP 游玩发现并修复）**：初始官宦满意度 [45,65] 与回归锚
    50 使弹劾（需 <30）自然不可达，豪强/宗族 [45,65] 使自募（原需 ≥70）不可达；
    调整官宦初始区间 45~65→**15~45**、豪强/宗族 45~65→**55~75**、自募阈值 70→**60**
    （docs/08 §十七/§二十三/§二十四/§二十五 与 docs/34 同步），实测：开局平舆官宦 26、
    邺宗族 61；巡查压官宦（−8~15）可稳定触发弹劾。
  - 修复 2 个实现 bug：逾期分支忠诚原为 +2（应为 −2）、逾期官宦满意度原为 +5（应为 −5）。
  - 验证：`pnpm verify-s27` **94 断言**（含事件高池/低池/不触发、自募对照差值法、弹劾触发/
    逾期/安抚/撤换/君主拒撤）；shared 363 + client 42 单测、validate-data、全部既有
    verify-* 复跑、三端 typecheck 全绿；**真实 HTTP 端到端**：创建→开垦堆流民→高池事件
    （流民垦荒）触发 ✓、压世家→低池事件（世家抽逃）触发 ✓、巡查压官宦→弹劾触发 ✓→
    安抚处理 ✓（100 金/官宦+20/警示清除）；撤换分支由 verify-s27 引擎层覆盖。
  - **未改设计边界**：试点范围仍 6 城；弹劾/自募无独立 UI 跳转（仅乡政警示条）；
    事件不弹 UI 不进事件对话（纯 actionLog）；fame 叙事化标签未做。

### Session 285 交接要点

- **S27 城级派系与门阀**（注册 26→27 大系统，设计见 `docs/34-faction-politics-design.md`）：
  - 试点 6 城（洛阳/长安/阳翟/汝南/邺/陈留）必有核心三派系（世家/流民/商贾）+ 随机池 0~2
    （豪强/宗族/教团/官宦/游侠）；名门特例：阳翟→颍川荀氏·颍川陈氏、汝南→汝南袁氏；
    满意度 0~100 月度向 50 回归 ±1，派生确定性（按城市 ID 哈希）。
  - 命令：开垦（50金/智≥60 → 流民+8~15·世家−10~20·farm+20~40，功绩+4）、
    巡查（30金/武≥60 → 商贾+5~10·小势力−8~15·当月免叛乱 `factionPatrolStamp`，功绩+4）、
    兵装采购（10金/件，势力级）。
  - 效果全接入：世家<30 守军士气−15%（campaign/battle）、商贾≥70/<30 商业±15%（turn 产金）、
    小势力<30 月 10% 叛乱（兵力−10%/民心−5/重置 50）、流民≥70 征兵+20%、民兵
    floor(人口×0.02×民心/100)、训练−5 兵装、开发完成联动（农业→世家+3/商业→商贾+3）、
    施米 fame+2；fame：破城+20/占城投降+10/灭国+50/结盟+10/每季−2，投奔三档×1.1/1.2/1.35；
    兵装：首都+8/月、城防≥150 城+2/月、战斗满配+5%/−10%、损失 0.5×折算。
  - 类型与兼容：`City.cityFactions?`/`factionPatrolStamp?`、`Faction.arms?`/`fame?` 全部 optional
    （沿用 activeBattlefieldInstance 无损追加模式，不升 schema 版本）；旧档缺省按城市 ID 派生补种。
  - 验证：`pnpm verify-s27` 66 断言全过；shared 348 + client 42 单测、validate-data、
    全部既有 verify-* 复跑、三端 typecheck+lint 全绿。
  - **未改设计边界**：试点范围仅 6 城（非试点城市 cityFactions 为空，UI 有提示）；
    派系事件/弹劾/自募武装等 S27 深化设计项未实装；fame 暂无独立 UI 进度条以外的叙事化标签。

### Session 283 交接要点

- **修复 1**：`client/src/stores/gameStore.ts` `boot()` 新增 `activeBattlefieldInstance` 恢复分支——
  南郡/颍川郡域战场（Tier II）刷新后恢复 `screen='battlefield'` + 场景栈（world→battlefield），
  含进行中的阵前单挑；六角战斗/白刃战恢复本已正常（实测复核）。
- **修复 2**：`server/src/engine/battle.ts` `getUsableAbilities` 每战法只返回最高可用等级，
  修复六角战斗中突击/突破/猛突各渲染 5 个重复按钮 + React key 冲突警告刷屏；
  与 `castAbility`「可用最高层」口径一致。
- **修复 3**：刷新恢复的六角战斗点「撤军返回」卡死在「启动中」——根因是 `boot()` 恢复
  `activeBattle` 用 `replaceStack` 建单层栈，`exitBattle` pop 后栈空回退 `'boot'`；
  改为 `[world, battle]` 两帧栈（与正常 march 一致），撤军实测回到大地图 ✓。
- 实测：郡域战场刷新恢复 16 县 ✓ / 重复刷新幂等 ✓ / 单挑中刷新恢复 ✓ / 战法按钮去重 ✓ /
  刷新后撤军回大地图 ✓ / 撤军→世界→战场往返 ✓ / console error=0 ✓。typecheck +
  `pnpm test`（shared 311/client 42）全绿。
- **未改设计边界**：「围攻江陵」按钮复用旧 `marchOnCity` hack，190 剧本袁绍等多数势力
  必然失败（非新回归）；「攻打县」需先在大地图编成 `CampaignArmy`——两者均为既有门禁，
  按钮引导文案/禁用留后续。
- 服务器纯内存：tsx watch 重启会清空进行中的游戏（复现时需重新 create game）。

### Session 282 交接要点

- `CourtCommandDrawer` 的朝廷官制标题改为“霸府官制 · 只读总览”，修复 CMD-P4 文案契约失败。
- `pnpm verify-cmd-p4-headless`：开霸府、伪诏、取消回滚、人事跳转、console error=0，全部通过。
- `pnpm verify-cmd-p7-headless`：1440×900 名册、独立滚动、焦点恢复及 1,000 条合成名册性能通过。
- `pnpm typecheck` 与 `pnpm test`（shared 311/client 42）通过。
- `pnpm verify-cmd-p6-headless` 失败原因已确认是迁移前脚本仍查找已删除的 `personnel-panel`/旧人事四段 DOM；当前运行时按 CMD-P10 设计使用命令坞人事唯一入口。

### Session 280 交接要点

- 当前可验证合规项已专项通过：共享成年规则 3/3、Family UI 2/2、family RNG 35/35、
  negotiation 40/40、save migration 23/23、security 6/6、真实 HTTP/WS 8/8、HC-P0 101/101、
  validate-data 与依赖审计全绿。
- `pnpm verify-compliance` 覆盖私有工具目录、未登记素材、SPDX、外部 Demo 旧指令、
  Natural Earth/字体哈希、敏感模式及依赖许可集合。
- 授权后已清理四张 PNG 及关联截图的全部 Git 可达历史对象，并在工作区外保留原始 bundle；平台未导出的 Agent 对话仍无法由当前工作区读取。`App/BattleView/DuelPanel` 已恢复，client typecheck/build 全绿。
- Session 281 复审将忽略的 `assets/portraits` 四张来源不明 PNG 移至权限受限隔离区；阵型计划的商业作品名称/链接及 README、历史进度中的关联措辞已中性化。`verify-compliance` 现在会阻断被忽略头像目录和外部 Demo 文件。

### Session 279 交接要点

- 原设定优先：六基础为方/圆/锥/雁/鹤/锋；冲阵 id 16 是特殊骑兵阵，FM-P0～P5 只保留
  静态/精通兼容，不进入战役初选、标准或六角候选。
- 复用组织度五档和 CampaignSquad 五部阵位；不新增阵势完整度、三扇区、合围命令或伤害引擎。
- 当前局部“自动结算”误循环 `runMeleeRound`；原设定要求 `runAutoBattle`，列入 FM-P3 清债，
  本 Session 未改代码。
- `05` 长期点值与 `27` 当前百分比必须先过 Gate N1，当前不得叠加；7/8 精通不得机械映射。
- 详细计划、9 周排期、IP clean-room 和测试矩阵见 `docs/29-formation-integration-development-plan.md`。

> 下文保留历次实现与交接记录；本节“现在在哪”与 Session 279 要点是当前入口。

typecheck/lint/data/build/diff-check 全绿。**边界**：0-A 简化——收复县驻军取守方
Army 兵力（再攻时守军=驻军+Army 名义重复，视为协同放大）；守方 Army 参战走 defArmy
分支无城墙惩罚（野战迎击）；大地图 AI 增援（选项 C）后置；第三郡录入仍需史料。
docs/25 §2.6.4 新增 + 验证 74→88、23 R6 剩余标记解决、12 S15 行、09 BF-P5 行、
docs/10 + HANDOFF 双写。

Session 260 增量（用户拍板：选项 C 大地图 AI 向郡域增援）：`aiMilitary.ts` 新增
`export maybeReinforceCommandery` 接入 `runAiMilitary`（置于常规出征之前，守土优先；
增援军 phase='garrison' 不占双线名额）。条件链（任一不满足 RNG 零消费）：① 郡域
战场 active 且该 AI 势力为守方；② 郡域内守方 Army < 2；③ 模板可解析且郡治大地图
端到端）、verify-campaign **71/71**（校验拆分后顺序保持）、verify-ai-military-rng
功绩表（`MERIT_LEVELS`）+ `meritLevelFor`（merit→Lv 反查）+ `meritTitle/meritTroopBonus/
meritAttrBonus/meritNextThreshold`（展示查询）+ `applyMeritDecay`（70+/75+/80+ 每季
-0.3%/-0.5%/-1.0%，保底 min(10, peakMeritLevel)）+ `deriveMeritPath`（按官职轨道
派生文武分岔）+ `grantMerit/syncMerit`（统一发放与三字段同步，peak 只升不降）。
`Officer` 新增 `meritLevel/meritPath/peakMeritLevel`（optional 旧档兼容，Schema 同步）。
`game.ts` 开局 syncMerit 填字段 + stamina 改传 `meritLevelFor`（修复 6.4-1 临时方案）；
`battle.ts` 战场单挑与 duel 结算发放改走 grantMerit 并**落地君主守卫**（§6.5）；
任命功绩门槛激活（`PositionReq.meritLevel` 四轨填 0-A 精简数值、`appoint.ts` 属性/
功绩两段判定、**君主任命豁免功绩门槛**、AppointPanel 门槛展示与复验同步）；
`turn.ts` 季度衰减（`applyMeritDecayQuarter`，actionLog 写 `merit_decay`）；
OfficerDetail 功绩等级/称号/进度条/带兵+ 展示（君主仍显示国力指标）。
验证：`shared/merit.test.ts` 17/17、`verify-merit` **25/25**（初始化/门槛拒绝与放行/
季度衰减/保底/advanceTurn 日志/三字段过完整 Schema）、`verify-merit-headless` **7/7**
| S01 | 回合 | M+ | `turn.ts`；全势力金粮同步 |
| S02 | 地图 | M | Natural Earth；官道；LOD |
| S03 | 内政 | M | 农/商/城、征兵、训练、施米；**军屯/民屯未实装** |
| S04 | 人口经济 | M | 四桶 demographics + 粮耗 |
**适配**：verify-hc-p0（8c/8i 夏侯惇/曹仁夹具补 Lv6 功绩）、verify-hc-p1-3（maxOfficer
夹具补 Lv6 功绩）。**后置**：等级表属性/技能/特殊效果数值消费（体力保持 meritLevel×2
| S07 | 谍报 | M+ | 女间谍 / 献美点化 |
| S08 | 外交 | M+ | 进贡/结盟/献美 |
| S09 | 美女资源 | M | stock；**非历史女** |
| S10 | 战斗 | **M+（三层架构已实装）** | 六角战斗、单挑引擎、暴击/反击/连击与战役 Army 编成/行军/围城/自动战斗 + **三层战斗架构实装**：战场地图画面（Tier I 节点子集渲染/行军/交战） + 白刃战标准模式（Tier II 战术点系统/阵型选择/runMeleeRound引擎） + 入口三选弹窗。**单挑嵌套锁已修复**，战役单挑仍是简化事件。**已设计**：阵型双轴成长体系（§4, Session 120）+ 工程器械6种Lv1~Lv3+城防体系+瓮城阶段式守城（§15, Session 121）。**部曲、军屯/民屯、爵位加成、S21串联、战略点、战场工程建造、陷阱系统未实装** |
| S11 | 人事 | **M+** | 搜索/登用 + 任命三轨 |
| S12 | 官职功绩体力 | **S/M** | 精简任命；meritLevel 未实现；体力完整 |
| S13 | 宝物 | S | 薄 |
```bash
| S15 | AI | M+ | 内政占位 + 出征占城 + **总军师自动态势切换** |
| S16 | 剧本/存档 | **M/D** | 两剧本选择与白名单已可玩；无 SQLite |
| S17 | 计谋 | **S/M+** | **三层体系设计完成**：L1 美人计/离间/假情报/空城 ✅ · L2 釜底抽薪/调虎离山/暗渡陈仓等 11 计 · L3 以逸待劳/远交近攻等 8 国策 · 行政↔战场联动总表；文档 §31 全量重写；战役层自动战斗算法已预留 S17 计谋修正项 |
| S18 | 家族 | **M+** | 婚配/跟随/子女引擎 ✅；父辈/族谱 ❌ |
# 迷雾出征: pnpm verify-march-fog        # 7项权威边界断言
| S20 | **前端体验** | **S/D** | Session 122 已实装己方武将名册、OfficerDetail、低忠诚警报及人事统一终审窗；Session 124 将详情升级为人物简册，并加入吕布/关羽/诸葛亮/曹操首批程序化头像与快捷入口。W4 其余子项与 W1~W3 仍为设计中，详见 `07-ui-design.md` §11.1.4/§12 |
| S21 | **三级战斗串联** | **D** | Session 100 技术储备方案设计完成（零代码）。**§20.6 已重新映射**：W7 hex 沙盘降级为微操模式视图（非必经层级），W6→战场地图行军、W8→标准模式表现、W9→单挑演出 |
# 回合节拍: pnpm verify-turn-cadence # 连续12回合，月/季/年 28/28
# 功绩等级: pnpm verify-merit         # 初始化/门槛/衰减 25/25
# 功绩数值消费: pnpm verify-merit-consume # 出征上限/属性/单挑/暴率/开发/内政/体力恢复/君主守卫 18/18
# 功绩 UI: pnpm verify-s265-ui       # 六维 +N/功绩区块（需 dev + CDP 9239）8/8
# 谈判公式: pnpm verify-negotiation-r2 # 登用/结盟边界、单调、seed、UI同源 20/20
# BF-P0 南郡: pnpm --filter @leh/shared test -- schema.test.ts
- `pnpm test` 当前只跑 **shared 层3个测试文件、68个纯函数测试**，不代表全仓/服务端引擎全量测试；另跑 `pnpm validate-data` · `tsx src/scripts/verify-duel.ts`（单挑冒烟）· `tsx src/scripts/verify-crit.ts`（暴击/反击/连击冒烟）· **`tsx src/scripts/verify-campaign.ts`（战役层 57 断言）** · `tsx src/scripts/verify-fire-tactic.ts` · `tsx src/scripts/verify-child-engine.ts`
# 称王状态转移/王号: pnpm verify-hc-p1-2  # 36项断言
# 王国六职: pnpm verify-hc-p1-3             # 41项断言
```

首次进入先选择剧本与势力；当前有英雄集结和190《关东义兵》四槽切片。硬刷新 `Ctrl+Shift+R`。

结构：`shared/` · `server/` · `client/`（pnpm workspace）  
人类贡献指南：`CONTRIBUTING.md`

---

## 3. 已交付能力总表

| ID | 系统 | 成熟度 | 代码/要点 |
|:--:|------|:------:|-----------|
| S01 | 回合 | **M+** | `turn.ts`；1回合=1月，季度首月/年度显式节拍；12回合验证28/28；全势力金粮同步 |
| S02 | 地图 | M | Natural Earth；官道；LOD；**郡域迷雾已实装（BF-P5 Session 256）**：`shared/commandery-fog.ts` + mask 投影；**守方 Army 入郡域场景已完成（R6，Session 258）**：揭示源并入守方 Army 所在县 |
| S03 | 内政 | **M+** | 农/商/城已迁持续项目；一城一项、月费、人员暂停和进度损失；征兵/训练/施米仍即时；文化/工艺/交通/卫生、**军屯/民屯未实装** |
| S04 | 人口经济 | **M+** | 四桶 demographics + 民军粮耗 + 12月金粮预算 + 递增多城行政成本；俸禄仍未实装 |
| S05 | 军事 | M+ | 邻接出征→战→占城；战役 Army 主/副将/参谋；**爵位加成未接入** |
| S06 | 迷雾 | **M+** | UI + 服务端 `maskGameStateForPlayer` |
| S07 | 谍报 | M+ | 招募/女间谍训练/献美点化/任务结算接权威 PRNG；枕边风与离间流言确定续玩；四面楚歌未实装 |
| S08 | 外交 | M+ | 进贡/献美；R2 结盟共享百分点公式+权威 RNG+UI 同源；声望/戒备仍按0的 Demo |
| S09 | **宫廷人脉** | **M+** | `courtNetwork/courtNetworkOpportunities` 已实装；与成年女性人口脱钩；旧 v1 `beauty*` 无损迁移；历史女角边界不变 |
| S10 | 战斗 | **M+（三层架构已实装）** | 六角战斗与完整单挑均统一权威 PRNG，确定续玩 5/5 + 3/3；其余三层战斗、战役 Army 与设计边界保持不变 |
| S11 | 人事 | **M+** | 搜索/登用接权威 PRNG，确定续玩 32/32；R2 修复义理/野心 100 倍量纲错误并与 UI 同源；现有赏赐/任命确定性 |
| S12 | 官职功绩体力 | **M+** | 精简任命；**功绩等级系统已实装（Session 261）**：`shared/merit.ts` 20 级表/映射/衰减/文武分岔 + `Officer.meritLevel/meritPath/peakMeritLevel` + 任命功绩门槛（君主任命豁免）+ 季度衰减 + OfficerDetail 等级/进度条展示；**6.1 获取点 100% 实装（Session 262+263+264）**：`meritGrant.ts` 统一守卫发放（君主不发）+ 内政（开发/施米/征兵/训练，城主）+ 人事（搜索寻才+8/宝物 5% 稀有+5/登用+4/联姻+10）+ 外交（同盟+10 使节君主不出使/劝降+30）+ 军事（破城+30/守城+8/灭国+50/计策+5 + 野战击破溃散+20/险胜+10/守方击退+10，`militaryMerit.ts` + `Plot.casterOfficerId` 缺省军师）；**数值消费 100% 实装（Session 265）**：`meritAttrBonusFor` 属性加成（Lv16 文武分岔）计入有效属性（体力/单挑/六角/暴率/战役战力）+ `meritEffects` 特殊效果（单挑+/开发+/暴率+/内政效率/被俘-/适性+/体力恢复）接入 duel/civil/crit/campaign/battle/turn + `formationTroopCap` 带兵+ 接出征上限（AI 同规则）+ 君主特例切片 C（任命忠诚±/赏赐/赐婚/笼络守卫）；`verify-merit-consume` 18/18 + `verify-s265-ui` 8/8。体力完整。**后置**：等级表依赖未实装引擎的效果（搜索宝物已由 S13 改为真宝物入库，Session 266） |
| S13 | 宝物 | **M** | **0-A 完整闭环已实装（Session 266）**：`shared/items.ts` 纯函数 + `Officer.equipment` 5 槽 + `Faction.inventory`；装备/卸下/赏赐（忠诚+5~20 按品质）/搜索真宝物入库（零新增 RNG）/初始宝配；六维加成进有效属性 + baseEffect 可落地（defense/crit_rate/duel_boost 机制）；`/items/equip|unequip|grant` API；OfficerDetail 装备 tab + 六维装+N；verify-items 32/32 + verify-s266-ui 17/17。**后置（0-B）**：8+2 槽/套装/专属共鸣/消耗品/缴获传承/items 全量 |
| S14 | 事件 | **M+** | 场景/史料层隔离、窗口/前置/互斥/失效、玩家/AI选择、EventDialog来源标签；190共24事件/5条叙事线 |
| S15 | AI | **M+** | 军事 AI 最多双线、动态留守；停战/两月粮不足/兵力低于守军55%主动撤退；无五维作弊且固定 seed 复现；**守方 Army 入郡域场景已完成（R6，Session 258）**；**县级主动 AI 已完成（Session 259）**：`commandery-defender-ai.ts` 决策（收复/移动/撤退）+ `engageCounty` 参战溃退闭环；**大地图 AI 向郡域增援已完成（Session 260）**：`maybeReinforceCommandery` 郡治城编成增援军直接入场（上限 2、概率随占县提升、接权威 RNG） |
| S16 | 剧本/存档 | **M/D** | v1 信封、完整 Schema/跨引用、迁移、受锁内存恢复及可序列化 `xorshift32-v1` 已实装；所有行动后结算 RNG 已收口；S15 行为复现、生产存取与 SQLite 未做 |
| S17 | 计谋 | **S/M+** | L1 美人计/离间/假情报/空城创建与结算接权威 PRNG（S07/S17 合并 30/30）；L2 11计/L3 8国策仍设计；AI 发起决策仍属 S15 |
| S18 | 家族 | **M+** | 正妻/随侍随迁与默认忠诚接权威 PRNG，确定续玩 36/36；婚配与固定子女登场零随机；父辈/族谱 ❌ |
| S19 | **单挑大会** | **D** | §8.17 独立锦标赛：赛制/押注/称号/叙事/数据结构设计完成，引擎待实现 |
| S20 | **前端体验** | **M+** | CMD-P0～P38 完成；现有运行时域命令坞迁移阶段收口，家族旧壳归零；屯田仍设计中。详见 `07-ui-design.md` §11.1.4/§12 |
| S21 | **战争四层串联** | **S/M** | 四层命名统一；自动/标准/六角微操已接唯一模式选择、幂等结算和 Army 回写 |
| S22 | **美术基调·金石水墨免版权** | **S/D** | Session 101 美术版权铁律入最高准则（零代码）+ Session 102 跨平台字体防御实装（首批代码）。基调「金石水墨·拓片简册·印信官职」三件套，公有领域唯一。**武将头像组合方案 A+C+B**（P5-10a/b/c）：A 拓片印章（底图层·20~30 张公有领域拓片+宣纸+朱砂姓名印）+ C 程序化拼图（五官层·5×10×10×10 哈希派生+重点手工指定）+ B 官职印信简册（文字层·氏族/官职篆印+汉制印绶紫青墨黄）。`officers.json` 新增 `avatarGene` 字段（与 Session 100 `appearance` 战斗造型字段并存职责分离）。**Session 102 已实装**：跨平台字体防御三件套——资产闭环 `@font-face` 工程内部别名 `HanDynastySerif`/`HanDynastySeal`（思源宋体 SC + 马善政体 Ma Shan Zheng，woff2 不入 git）+ Canvas 屏障 `fontBarrier.ts` + `App.tsx` `isEngineReady` + Konva `<Text>` 全部补 `fontFamily` + `.editorconfig`/`.gitattributes`/CI 编码门禁 + `CONTRIBUTING.md` 字体铁律条款。**留 P5-07a~e**：HiDPI / XDG 存档 / 伪 Terminal 文言战报 / 金石黑框组件库 / 字重扩展。详见 `00-dev-constitution.md` §11.3+§11.7、`07-ui-design.md` §11.6、`15-linux-ui-spec.md`、`AGENTS.md` 核心规则 9 |

### 关键路径

- 内政 · 出征占城 · 火计（气力≥30）· **战法施放（气力≥energyCost）** · **单挑引擎（冒烟通过；嵌套锁已修复）** · **暴击/反击/连击（攻击自动触发）** · 任命 · 家族子女 · EventDialog
- **战役层**：编成出征（主将+副将+参谋+Squad）→ 行军（BFS 路径+补给消耗）→ 围城/野战 → 劝降/强攻（自动战斗算法）→ 占城/残兵回流  
- Session 196 起根 `pnpm test` 同时运行 **shared 19文件197项** 与 **client 2文件7项**；
  客户端首批覆盖命令坞/抽屉渲染及草稿状态机。默认 CI 另跑既有战役/存档域检查，以及战斗、
  单挑、内政、计谋谍报、人事、R2谈判、家族、美女资源、总军师、AI军事等确定续玩检查与数据校验；
  专用脚本仍需按改动范围单独运行，不代表全仓端到端覆盖。
- **BF-P0 静态地理**：`shared/data/historical-geography/` 已有严格 Zod、南郡 190 年
  1 郡/16 个战场县节点/11 路线/10 地标与零 RNG 只读预览；史载 17 城中的襄阳保留为
  独立大地图节点，并由北部边界入口引用；未接任何运行时。字段级校勘见
  `docs/22-nanjun-historical-geography-collation.md`。
- **场景/事件**：`pnpm verify-scenario-events`（32项）覆盖两剧本隔离、四势力开局、玩家/AI决策、反事实选项阻断、角色/子女白名单、迁都、传奇开关、过期失效与队列顺序；Session 107 独立复验时，生产构建/类型/lint/数据/68项共享测试/相关引擎回归全部通过，Headless Chrome 再次实际点击“选剧本→选曹操→结束回合→处理事件”通过。
- **字体首次运行**：3 个 woff2 文件已实际就位 `client/public/fonts/`（思源宋体 SC Regular/Bold + 马善政体，共 ~7MB，不入 git）；启动直接可用

---

## 4. 关键概念（勿混）

### 4.1 美女 vs 历史女角

| | 美女 S09 | 历史女角 S18 |
|--|---------|--------------|
| 获得 | 寻访/抢夺/献美 | 跟随/事件/剧本 |
| 禁止 | — | 不可搜索登用、不可寻访 |
| 出战 | — | 仅祝融 |

### 4.2 计策 vs 战法 vs 计谋

| | 战场计策（火计） | 兵种战法 | 战略计谋 S17 |
|--|----------------|----------|--------------|
| 层 | 六角 | 六角 | 大地图 |
| 状态 | 火计 ✅ 引擎 | **✅ 引擎最小切片** | 四计 ✅ |

### 4.3 兵种适性 S/A/B/C/**NONE**（真源 `11-context-management.md`）

```
S 120% · A 100% · B 80% · C 60% · NONE = 不可带队
```

| 值 | 含义 |
|----|------|
| **C** | 能带，属性只发挥 60%（「逼急了也能下水」） |
| **NONE** | **禁止**指挥该兵种 |

**用户定稿原则（Session 71 末）**：
- **武将**（会统兵）→ 水军适性 **至少 C**，不要 NONE  
- **纯文官**（如荀彧）→ 可 **NONE**  
- 例：吕布 已从 NONE 改为 **C**（「赤兔马也会游泳」）  
- 其它武将水军适性可后续微调；**勿再给猛将 NONE**

---

## 5. Session 70~71 交付摘要

### 5.1 战法数据（Session 70）

| 文件 | 内容 |
|------|------|
| `shared/types/combatAbility.ts` | `leveled` / `proficiency` · `specialEffect` · `coopAllowed` |
| `UnitTemplate.abilities` | 必填 |
| Zod | leveled 必须恰好 5 级 |

**双体系**：
- **leveled**：基础兵种，显示 Lv1~5，适性门槛 C→B→A→S→S  
- **proficiency**：特殊兵种（0-B），**不显示等级**，熟练度 `basePower`→`maxPower`  

**连携**：仅 `coopAllowed` 布尔预留；关系网/亲密度引擎 **后置**（参考经典系列设计）。

### 5.2 三级水军（Session 71 · 参考经典三级水军设计）

| 级 | type | 名 | 攻/防/机 | 战法 |
|:--:|------|-----|:--------:|------|
| 轻 | `lightNavy` | **走舸** | 5/3/7 | 疾驶 · 激流 · 火箭 |
| S | 周瑜、陆逊、孙权 |
| A | 关羽 |
| B | 曹操、诸葛亮 |
| C | 吕布、刘备、张飞、赵云、黄忠、夏侯惇、典韦、司马懿、占位… |
| NONE | **仅荀彧**（纯文官） |

### 5.3 暴击/反击/连击 × 技能·特性·专属联动（Session 73）+ 单挑全面设计（Session 74）

**设计变更范围**：

- `05-combat-system.md`：§6.2~6.5 完全重写（暴击/反击/连击/三者联动）+ §4.2 阵型联动扩展 + §5.4/§8.3/§8.6 对齐
- `04-game-systems.md`：§26.3 五类42项特性全部补联动列 + §26.5 角色表同步 + §26.8 SkillEffect type 扩展

**核心设计原则**：

1. 暴击/反击/连击 ≠ 一刀切通用公式，而是 **特性(被动) + 通用技能(可培养) + 专属(独有)** 三者交汇的结果
2. 四层防循环保障：连击→不再触连击/反击；反击→不再触反击；战法不触发三者
3. 新增8种 SkillEffect type（`critRate`/`critDamage`/`counterRate`/`counterDamage`/`chainRate`/`chainDamage`/`chainPreserve`/`counterCritRate`）
4. 24个专属技能/42个特性/7个通用技能的联动数值在设计中完整落地

**范围确认**：暴击/反击/连击设计仅作用于**战场部队系统**（`05-combat-system.md` §6.2~6.5）。单挑拥有独立系统（`05-combat-system.md` §8 全量设计），与战场互不干扰。

**Session 74（单挑全面设计）补充**（后经 Session 75 经典化重写为 7指令+三向克制+全自动结算）：
- 05 §8 全量重写（§8.1~8.16）：状态机(6状态) + 触发/发起 + 7指令+三向克制 + 全量伤害公式(含隐藏属性) + 受伤系统 + 武器分化(14宝物映射) + 技能·特性·专属集成(5通用技能/10特性/9专属/3套装) + 独立暴击/反击/连击 + UI面板 + AI决策 + 特殊情况
- 同步文档：03 §19 类型扩展 + 04 §26.1/§32.4 + 06 单挑API(5端点) + 07 §6.3 单挑面板 + 08 武器映射交叉引用

**武将差异化例（战场部队）**：
| 武将 | 风格 | 核心机制 |
|:----:|------|----------|
| 张飞 | 反击爆发 | 刚烈必反必暴 + 咆哮连击 |
| 典韦 | 双反击护卫 | 恶来×2次反击 + 铁壁 |
| 马超 | 冲锋连击 | 骑神+猛进+西凉铁骑→高暴高连 |
| 关羽 | 单发高暴 | 武圣×2.5暴伤 + 击败后必连 |
| 赵云 | 单骑全能 | 龙胆双向反击 + 连击累加 |

### 5.4 近期会话索引

| 会话 | 交付 |
|------|------|
| 257 | **BF-P5 年代覆写机制实装**。`seed-schema.ts` 扩展 `CountySeed`/`LandmarkSeed`/`RouteSeed`/`CommanderySeed` 支持 `validFromYear`/`validToYear`（缺省=scenarioYear）；构建器透传，自动派生 road 取两端县有效期交集；新建 `year-overrides.ts` 纯函数 `resolveBundleForYear(bundle, year)` 按年份过滤并重新 Zod 校验，无效年份或引用断裂**抛错**（无静默回退）；对过期县/地标引用自动剔除、对不存在 id 引用保留给 Zod 拦截（防手误）。新建 `year-overrides.test.ts` 12 项：190 基线、208 县析置/裁撤、自动道路交集、郡有效期截止抛错、seat 过期抛错、零 RNG 确定性、入参不变，以及 `nanjun190`/`yingchuan190` 190 回归/其他年份抛错。南郡/颍川生产数据仍为 190 单一年代（机制由测试夹具演示，不编造历史）。验证：shared 244/244、server/client typecheck、client 36/36、lint、validate-data、`verify-historical-geography` 2 郡全绿。docs/22 §7.4、08 §十五、09 BF-P5 行、12 S02、10+HANDOFF 双写） |
| 256 | **BF-P5 郡域迷雾设计+实装**（BF-P2 Q9 视野扩张攻占效果完整落地）。新建 `shared/commandery-fog.ts`：`computeRevealedNodeIds`（揭示集 = 入口县 ∪ 郡治 ∪ 攻方 Army 所在县 ∪ 攻方已占领县，每源 + 一跳邻接）+ `maskBattlefieldInstanceForPlayer`（未揭示节点 garrison/wall/armyIds 清零、deployments 过滤，返回新实例）；`BattlefieldInstance.foggedNodeIds?: string[]` 为 **mask 投影专属**（Zod optional 不入存档）；`maskGameStateForPlayer` 集成；客户端迷雾渲染（深色/`?`/seat 未知/不可攻打）。新增 fog 单测 8/8（shared 224→232）；`verify-save-battlefield-instance` f8 14 条 → 63/63。真实 API：enter 初始 7 迷雾（含州陵）→ engage-county(华容) → 6 迷雾、州陵揭示、华容占驻 858；Headless Chrome：进场 7 `?` → 点华容 → 州陵 `?` 消失、华容「驻738」、巫仍迷雾、consoleErrors=0。全量回归绿。**0-A 边界**：守方 Army 入郡域场景揭示归属留 R6（迷雾层已就绪）；颍川通用。docs/21 §5.2.1、25 §2.6.2、09 BF-P5 待办(2)、12 S02、23 R6、10+HANDOFF 双写） |
| 255 | **BF-P5 orchestrator 去硬编码**（郡国模板目录驱动）。新建 `shared/commandery-templates.ts`（`COMMANDERY_TEMPLATES` 登记南郡/颍川：bundle/templateId/entryNodeIds/instancePrefix/warPrefix/UI 标签 + 5 个查找助手）；`enterNanjunBattlefield` 由"nanjun/yingchuan 双 if 分支 + 硬编码 bundle/入口/前缀"改为目录查找（未登记抛错）；`generateNanjunBattlefield` 南郡兼容包装从目录取数；路由校验用 `getCommanderyIds()`；客户端 api 参数类型放宽、`gameStore`/`BattlefieldSceneView` 标签目录驱动；`verify-historical-geography` 遍历目录（单一真源）。新增 `shared/commandery-templates.test.ts` 6/6（shared 218→224）；回归 verify-save-battlefield-instance 49/49、verify-campaign 71/71、bf-p3 13/13、bf-p4 20/20、typecheck/lint/data/build 全绿（仅既有大 chunk warning）。**0-A 边界**：江陵席城按钮与 `FIRST_BATCH_COUNTY_IDS` 全局门禁仍为南郡专属（郡级可攻打清单未拆）；第三郡录入（需用户史料）、郡域迷雾留后续。docs/09 BF-P5 行、12 S02、08 目录登记说明同步） |
| 254 | **BF-P5 补给线真实路径判定**（替换 BF-P2 Q9 全局简化）。`shared/army-county-mapping.ts` 四纯函数（resolveArmyCountyNodeId/shortestCountyPath/isCountyPathBlockedBy/monthlyArmyFoodCost）；`generateCommanderyBattlefield` 部署写 nodeStates[].armyIds（RNG 零消费）；`tickBattlefieldInstance` 逐军判定（补给线 = seat → Army 当前县最短路径，经过攻方控制县 → 粮耗×2 + 士气-5）；verify-save-battlefield-instance f6/f6b 真实路径断言 49/49；shared 218/218；verify-campaign 71/71、bf-p3 13/13、bf-p4 20/20；docs/25 §2.6.1 改写、docs/09 BF-P5 待办(1)勾除、12-system-map S02/S15/S16 同步。0-A 边界：守方 Army 入郡域场景随 R6） |
| 173 | **BF-P1 静态郡域场景+六角引擎最小闭环**（world→战场→六角接战→回写全链路 Headless 通过；shared/scenes 场景栈 + BattlefieldInstance 类型/Zod + generateNanjunBattlefield + BattlefieldSceneView + engageJiangling 复用 createBattle。存档契约可序列化结构+往返单测已落地，不接 GameState schema 留 P2。回归 62/29/38/172 无破坏。补提交 negotiation.ts 解 R2 遗漏依赖） |
| 174 | **BF-P2 Q10：activeBattlefieldInstance 无损追加至 GameState 存档契约**（按已批准方案 A，GameState 加 optional 字段；battle schema superRefine 互斥护栏 activeBattlefield 与 activeBattlefieldInstance 不可同时非 null；full schema ROOT_KEYS + 跨域引用校验；服务端 enterNanjunBattlefield/exitNanjunBattlefield/getBattlefieldInstance orchestrator + 3 个 API 路由；client gameStore 改造 enter 调 API、退出战场调 exit 清字段；新 verify-save-battlefield-instance.ts 27/27 全过 5 类断言含跨存档版本兼容；零回归；Headless Chrome 闭环重测 enter→16 县渲染+服务端字段写入→exit→字段清 null 全验证。Q9/Q11/Q12 仍待实施） |
| 175 | **BF-P2 Q11+Q12：类型归并文档化 + AI 攻县依赖声明**（Q11：BattlefieldMap Tier I 19 调用点 vs BattlefieldInstance Tier II 6 调用点保持独立不合并不废弃，结论落地至 02-architecture/03-data-models/12-system-map/25-bf-p2-design；Q12：R6 范围补"县级攻打决策不属于 BF-P2/P3，归 R6"，09-roadmap BF-P3 同步范围边界；3 处代码注释补 RNG 边界为 BF-P3 预留说明；修正 03-data-models 两处过时口径"BattlefieldInstance 尚未实装"+ GameState 缺字段。git diff --check + typecheck/lint 全过。Q9 仍待实施） |
| 176 | **BF-P2 Q9：首批 3 县可攻打落地，BF-P2 实施阶段完成（初判）**（当阳/华容/枝江 + 江陵 seat = 4 县可攻打节点。BattlefieldNodeState 加 controlTurns；turn.ts tickBattlefieldInstance 月度 tick——驻军消耗掉控制 + 补给线切断简化版守方 morale -5；engageCounty orchestrator 复用 runAutoBattle 自动结算（不调 createBattle 六角，县级无 cityId 映射），手动更新 nodeStates + CampaignArmy；路由 + client API + gameStore action + BattlefieldSceneView 3 县可点击 + 占领绿色高亮 + "驻N"文本；verify-save-battlefield-instance 44/44 含 f 类县级攻打状态流转+补给线+驻军掉控制；全量回归零破坏；Headless Chrome 完整验证 enter→click 当阳→占领→UI 绿色+驻858。**BF-P2 Q10+Q11+Q12+Q9 四项全部落地，初判完成；但四项攻占效果实现程度不一（两项完整/两项简化占位），老实标注见 Session 177）** |
| 177 | **BF-P2 Q9 老实标注 + 正式签发 BF-P2 完成**（纯文档/注释澄清，零代码逻辑改动。Session 176 报告将四项攻占效果统一标"✓ 通过"，但实际两项是简化替代/占位。本轮老实分级：补给线切断=简化替代实现——设计原意糧耗×2 路径判定，实际是"占领任意首批县→守方全军 morale -5"全局士气流失，简化因 Army-数字cityId 与郡域县节点-字符串countyId 无位置映射，真正路径判定留 R6/BF-P5；视野扩张=未实现，当前为占位视觉反馈——郡域场景无迷雾遮蔽，占领后只是节点变绿+驻军数字，不存在"揭示"动作，郡域迷雾是新发现缺口（此前从未被任何阶段排期覆盖）；驻军消耗+战场推进=✅完整实现。文档改动 5 处：25-bf-p2-design §二状态块+§2.4+新增§2.6 老实标注；23 R6 补登记两项待办依赖；09-roadmap BF-P2/BF-P3/BF-P5 行+版本号；verify-save-battlefield-instance f6 注释扩展+check label 诚实化（断言布尔条件不变）；10-progress Session 177+HANDOFF。**正式 BF-P2 完成声明：四项攻占效果中两项（驻军消耗、战场推进）为完整实现，两项（补给线切断、视野扩张）为简化替代/占位，详见 25 号文档 §2.6，不能笼统说四项全部完整落地。** typecheck/lint 确认无破坏） |
| 178 | **武将详情界面修复（用户指派独立需求，不归属 R3/R8）**（先诊断后修复，4 commit。诊断：Headless Chrome 实测 5 名武将 + 代码/数据/网络层穷尽分析，确认 4 类问题——阵型只显数量"6 项"且 10 名骑兵武将引用不存在的 id 16、经验/体力重复、19 hidden 字段全未渲染+标题误导、非原型称号取 tags 末项。修复：①`fix(data)` 补录 formations.json id 16 **冲阵**——判定漏录非错误引用（08-data-dictionary id 区间 0~17、05 §4 L238 id 16=冲阵、FormationType.CHARGE=16、crit.ts 已含 CHARGE、10 名引用武将全骑兵系），按 05 §4 设计值补完整定义，战斗不受影响（硬编码 FORMATION_MODS 不读 formations.json），validate-data 6→7，文档数字真源双写；②`feat(shared)` 新建 shared/labels.ts 导出 FORMATION_LABEL(18 陆阵)+PERSONALITY_LABEL(6)+IDEAL_LABEL(5)；③`fix(officer-detail)` 阵型 chip 用 FORMATION_LABEL 渲染+移除状态区块经验/体力（保留 aside）+拆"技能与特性"→"技能"+"性格"（性格区块展示 personality+ideal 文字，数值类 hidden 按设计决策保持隐藏）；④`fix(officer-portrait)` getOfficerProfile fallback title 改 deriveFallbackTitle 从五维派生（万人敌/神算/猛将/谋主/宿将/谋士/战将/统帅/干吏/名士/时势英杰），4 原型 HERO_PRESETS 不动。Headless 验证：张飞→万人敌+方阵/锥形阵/锋矢阵/偃月阵+性·刚烈/志·侠义+状态仅在职；诸葛亮→卧龙经略保留+性·沉稳/志·仁政；吕布→虓虎无双保留+**阵型含冲阵(id 16 关键验证)**+性·刚烈/志·名利。全量回归 shared 172/172+validate-data(7)+typecheck/lint/build+verify-save-battlefield-instance 45/0 全绿。新发现既有 bug 未修：CampaignPanel/StandardModePanel 把 ARROWHEAD(6,锋矢阵)误标"冲阵"且漏 id 16，建议后续统一用 FORMATION_LABEL 根治。未做：头像图片本身（用户已换新版需另外核对）；hidden 数值类字段（设计决策保持隐藏）） |
| 172 | **S23 人物状态表情系统**（新增 S23 大系统 22→23，挂 S22 美术基调 C 层状态化扩展；本轮用户指派独立需求，不抢占 R3。**Commit 1+2 完成**：设计文档 `24-...` + `shared/expression.ts` 纯函数 + 28 单测（147/147）+ `ExpressionPortrait.tsx` 程序化 SVG 分层 + BattleView SideCard/OfficerDetail 接入。状态词表精简 7 词；优先级负伤>战斗瞬时态>忠诚>士气>默认；单一主表情+独立背景色调层；衰减用 activeBattles 判定；3 原型各 4 条属性规则；stamina 代理负伤。Plan 阶段确认 4 抉择：文档编号 24-*/渲染=程序化 SVG 分层/负伤=stamina 代理/UI=SideCard+Detail。Headless Chrome 7 状态实测全过（胜/败/低忠诚/负伤/互斥）。验证限制：zustand store 不可外部 setState + 敌方城点迷雾不可点击，瞬时态改用真实吕布 officer+Vite 动态 import 组件+createRoot 独立挂载验证，等价覆盖。本轮占位非成品美术。详见 `docs/24-character-expression-system-design.md`） |
| 121 | **工程器械与城防体系设计**（文档层）：05 §15 全量重写（6种器械Lv1~Lv3+城防体系+瓮城阶段+专属武将联动）；03 §20.3/20.3-B/20.4 类型扩展（SiegeEngine/CityFortification/TacticalDefense/SiegePhase）；07 §12.6 瓮城"未拍板"→已定案；12 S10 更新。 |
| 120 | **阵型系统全面重设计**（文档层）：05 §4 完整重写（27阵型18陆+9水/双轴成长Lv1~Lv5+熟练度·极/科技树前置/陆水交互/暴击反击连击联动/切换规则）；03 §9 Formation/Officer 类型扩展；08 §二 formations.json 字段 6→27；04 §十九 新增阵型养成子章节；01/12同步。 |
| 118 | **武将数据扩充**：新增ID 284~307共24人（群雄势力/特殊人物/后期人物），`validate-data.ts` 武将门禁199→223；shared build、数据校验223/223与server typecheck全过。史料未详出生年统一为0，未详卒年使用提供的lifespan；祝融按既定唯一可出战女将例外录入；08数字真源、09/10/12/14及HANDOFF同步。 |
| 117 | **文档漂移校正**：按当前JSON实测统一0-A验收基线30人/当前199名武将、190共24事件（核心5+新增19）与爵位7级口径；08数字真源、01/04/09/10/12/14及HANDOFF同步；零代码/数据/规则变更 |
| 116 | **oh-my-openagent 安装配置**：oh-my-openagent v4.19.0 安装于 OpenCode 1.18.3，配置 OpenAI GPT-5.x 模型（11个 agent），ast-grep 0.44.1 验证通过；文档同步 |
| 115 | **武将数值扩充 Phase 2-2**：二线32人录入（曹植/曹昂/曹纯/郝昭/郭淮/孙礼/毌丘俭/王昶/陈泰/邓飏/李胜/何晏/刘封/冯习/张南/傅彤/程畿/陈到/马岱/高翔/张嶷/黄权/徐盛/贺齐/全琮/吕范/周鲂/钟离牧/刘繇/孔融/陶谦/公孙度）；validate-data 167/167 全过 |
| 114 | **武将数值扩充 Phase 2-1**：中坚32人录入（曹彰/曹休/夏侯尚/文聘/庞德/满宠/刘晔/董昭/徐庶/关平/周仓/李严/吴懿/向宠/简雍/孙乾/马忠/潘璋/董袭/朱然/诸葛恪/步骘/司马师/司马昭/邓艾/钟会/羊祜/杜预/王濬/文鸯/诸葛诞/司马炎）；validate-data 135/135 全过；原有30人未改动 |
| 113 | **武将数值扩充 Phase 1-4**：群雄32人录入（袁绍集团9人/吕布集团2人/刘表4人/刘璋2人/马腾2人/张鲁2人/董卓余部4人/袁术2人/黄巾3人/华佗+士燮2人）；validate-data 103/103 全过；Phase 1 目标100人超额完成 |
| 112 | **武将数值扩充 Phase 1-3**：东吴核心15人录入（鲁肃/吕蒙/程普/黄盖/韩当/太史慈/凌统/丁奉/张昭/顾雍/诸葛瑾/朱桓/陆抗/蒋钦/陈武）；validate-data 71/71 全过；原有30人未改动 |
| 111 | **武将数值扩充 Phase 1-2**：蜀汉核心14人录入（庞统/法正/姜维/魏延/马超/马谡/王平/廖化/严颜/张翼/霍峻/蒋琬/费祎/邓芝）；validate-data 56/56 全过；原有30人未改动 |
| 110 | **武将数值扩充 Phase 1-1**：曹魏核心12人录入（张辽/徐晃/张郃/于禁/乐进/夏侯渊/曹洪/曹真/荀攸/贾诩/郭嘉/程昱）；validate-data 42/42 全过；原有30人未改动 |
| 109 | 190《关东义兵》条件式历史切片扩展：5→24事件+5叙事线+玩家抉择系统+gold/food/population效果+史源分层+场景隔离+反事实阻断+32项断言+Headless Chrome 验证通过 |
| 总军师系统 | 数据结构已就绪（GrandStrategist），任命/态势/献策/对决逻辑后置 |
| 108 | **文档漂移校正**（零代码/数据/规则变更）：P0B-14 摘要对齐08真源“首批7历史剧本+英雄集结”；D-0B 当前编号统一为1~13；S20/S21 未来任务统一采用 S20-W1~W4、S21-W6~W9；HanDynastySeal 校正为马善政体；P5-07e、系统地图/UI版本引用同步。交叉检索与 `git diff --check` 通过 |
| 107 | **Session 106 新增功能独立复验**（零代码/数据改动）：build/typecheck/lint、68项共享测试、validate-data、场景事件32项、战役57项及子女/火计/单挑/暴击回归全部通过；Headless Chrome 再次实际点击历史剧本主路径通过。仅保留既有生产 chunk 警告与已知六角单挑入口锁缺陷 |
| 战役层设施回合化 | 大型器械即时建造简化，"消耗完整回合"约束后置 |
| AI Army | 当前仅玩家 Army，AI 军事仍走旧 aiMilitary.ts |
| 101 | **美术版权铁律入最高准则**（S22 美术基调·金石水墨免版权，零代码改动，方案文档化。`AGENTS.md` 核心规则新增第 9 条 + `00-dev-constitution.md` 新增§十一。新增 S22 大系统 21→22。武将头像组合方案 A+C+B：A 拓片印章底图 + C 程序化拼图五官 + B 官职印信简册文字。`officers.json` 新增 `avatarGene` 字段（与 Session 100 `appearance` 并存职责分离）。字体白名单（系统+开源，禁方正/汉仪，D-0B-13）。P5-10 改述。实装拆 3 子 Session P5-10a/b/c，Phase 5 排定） |
| 102 | **跨平台字体防御实装 + bug 修复**（S22 首批代码 + 工程规范硬基建，零游戏逻辑改动。资产闭环：`client/public/fonts/` **3 个 woff2 文件已实际下载就位**（思源宋体 SC Regular/Bold + 马善政体 Ma Shan Zheng，均 SIL OFL 1.1，共 ~7MB，沐瑶软笔体无稳定授权源改用马善政体） + `styles/fonts.css` @font-face 工程内部别名 `HanDynastySerif`/`HanDynastySeal` + `font-display: block` + tailwind 注册 + .gitignore 排除 woff2。Canvas 屏障：`utils/fontBarrier.ts` `waitForGameFonts()` + 4s 超时兜底（防 woff2 缺失永久卡死）+ `App.tsx` `isEngineReady` 屏障 + 失败重试按钮。Konva `<Text>` 全部补 `fontFamily`：MapCanvas 4 处 + BattleView 1 处。工程规范：`.editorconfig` UTF-8 LF + `.gitattributes` `eol=lf`/`*.woff2 binary` + `.github/workflows/ci.yml` 编码门禁 + `CONTRIBUTING.md` 字体铁律条款。文档：00 §11.3 升级+§11.7 新增 + AGENTS 核心规则 9 扩展 + `15-linux-ui-spec.md` 新建 + 09 P5-07a~e + 12 v4.4 + README systems-22 + 文档冲突修正。**bug 修复**：fontBarrier 超时兜底 / index.css @import 规范化（改内联 @font-face）/ FontBarrier 失败重试按钮。验证 typecheck/lint/test 68/validate-data 全过。Linux UI 适配 + 开源筑巢留 P5-07a~e） |
| 103 | **CI typecheck 修复**（全新环境 `pnpm install` → `pnpm -r typecheck` 时 server 找不到 `@leh/shared` 类型。根因：shared 的 `exports.types` 指向 `dist/`，CI 无 dist；shared typecheck 用 `--noEmit` 不生成 dist。修复：shared 的 typecheck/lint 脚本去掉 `--noEmit`，使底层包 emit 出 `.d.ts` 供下游解析。模拟 CI 验证全过） |
| 106 | **190《关东义兵》条件式历史切片**：保留英雄集结并新增四槽历史场景；场景势力/角色/事件/子女白名单、史源分层、窗口/前置/互斥/失效、反事实选择、玩家/AI性格理想权重、ScenarioSelect/传奇开关实装；30将全部史实；32项+HTTP+浏览器实际点击验证通过。**简化**：壶关/宛是河内/鲁阳补给节点代理，无城/寄驻/从属军未实装 |
| 99 | **开源收尾**（免责声明/许可证拆分/截图/CREDITS/SECURITY） |
| 98 | **战役层引擎最小切片实装**（§12节点·§13 Army编成+行军+补给·§15设施·§16状态机·§17自动战斗算法·CampaignPanel UI·8 API端点·57断言全过·dev实操占城） |
| 97c | **学派与信仰设计**（04 §38 全量写：7学派/设施/任教/冲突/初始倾向 + 03/06/07/01同步） |
| 97b | **命名合规维护**（补规则缺口 + 修5处重名：units.json 激励→振奋/铁壁→坚垒/远射→劲射/蒙冲→铁撞/楼船→巨舰） |
| 97 | **战役/战术分层全面设计**（05 §十二~§十八 战役层 + §十四总军师 + §十五设施机关 + §十七自动战斗算法；04 §36 势力特点 + §37 总军师规则；03/06/07 同步；00 命名规范） |
| 95 | **旧品牌残留清零**（截图前缀→leh-* · gitignore · 会话日志字面清除 · 全库验证） |
| 94 | **品牌重命名**（旧代号→LateEasternHanDynasty，旧 npm scope→@leh/，63文件·含UI/import/pkg scope/文档全量替换） |
| 93 | **部队编成体系全面重设计**（参谋独立槽位·智≥85·幕僚不带兵·副参谋·爵位编成加成·7级爵位精简·上限大将军9/君主10） |
| 92 | **文档一致性修正**（02-architecture.md + README.md 文件数/列表与实际对齐） |
| 91 | **合规深清**（删 46 张旧底图/调试截图·仅留 18 张 NE/UI·git 历史清洗 Google/LateEasternHanDynasty/旧截图·force-push） |
| **S20 前端体验** | S/D：Session 122 已实装武将名册/详情、低忠诚警报与首批人事终审窗；S20-W4 其余子项及 W1~W3 待续 |
| **S21 三级战斗串联** | Session 100 技术储备方案完成，实装拆 4 个工作包（S21-W6~W9），时机后续排定 |
| 88 | **单挑引擎最小切片实装**（§8全自动结算·7指令三向克制·专属/无双保护·DuelPanel UI·API+store·verify-duel 冒烟全过） |
| 87 | **合规完成**（SPDX头98文件+许可证+免责声明+CREDITS+历史清洗+旧商标零残留） |
| 86 | **git 历史重写**（filter-branch 清洗 Google截图+旧商标 blob+commit message） |
| 85 | **全库版权排查**（旧商标 47处替换+CREDITS+截图清理+商标清除） |
| 83 | **部队组织大系统纯设计**（经验Lv1-7+组织度+士气深化+部曲12将+军屯田+家属质任+民屯田9维；部曲/屯田运行时未实装） |
| meritLevel 运行时 | stamina 临时用 merit |
| S18 父辈/族谱 | 子女已做 |
| 0-B 全量 | **暂缓** |
| 存档 SQLite | 未做 |
| **190全势力开局** | 当前只有董卓/袁绍/曹操/孙坚四槽技术切片；约30势力名单、营地/寄驻/从属军和全量事件池未入库 |
| **S20 前端体验** | M：CMD-P0～P25 已完成命令壳及朝廷、人事、外交、军事、内政原子迁移；总览含明确标注的 S09 跨系统寻访 |
| `docs/12-system-map.md` | **22 系统**（v4.8：Session 108 文档漂移校正；含 S22 与 D-0B-13） |
| **S22 美术基调·金石水墨免版权** | Session 101 最高准则固化 + 方案设计完成，实装拆 3 子 Session（P5-10a/b/c，Phase 5 排定） |
| **D-0B-1~13 技术债** | 0-B 扩容前必须先清（store 拆分/LOD 拖拽冻结/useMemo/viewport culling/矢量州界/screen 状态机/appearance+avatarGene 全量填写/吕布服务端无双/§35 财政俸禄/PCG 底图替换/activeStrategem 字段/S17 L2 水攻伏兵引擎/UI 字体白名单扫描） |

---

## 6.5 武将详情页 UI 迭代收口声明（强制边界）

| `docs/07-ui-design.md` | UI 设计（**v3.4：武将名册/详情 + 人事终审窗已实装；§12 其余命令 UI 仍设计中**） |

**后续对此界面的改动应基于具体的新功能需求**（如列传扩展、俸禄系统实装后的展示接入），**而非继续审计既有展示是否"完整"**——已知的技术债（特性系统/俸禄系统/装备系统/兵种缺口/列传扩展/阵型缺口）均已登记，按各自技术债编号（D-0B-9 等）在对应系统实装时一并解决，**不再单独为 UI 展示发起审计**。

---

## 6.6 已知技术债清单（汇总）

| 项 | 现状 | 归属阶段/编号 |
|---|---|---|
| 特性系统（trait） | 设计完整（04 §26 共 42 项×5 级），代码零实装（OfficerTrait/traitId 在 shared 层零存在） | 0-B（D-0B-7 范畴） |
| **1** | **若继续190：无城军团/移动总部/寄驻/从属军判别模型**；完成前不得把节点代理当正式史实领地 |
| 2 | 190约30势力逐项审定与全量开局（属于0-B，需再次明确授权） |
| 3 | 原队列：总军师系统实装 → 设施建造回合化 → 势力特点数据 → **委任军团引擎实装（§39 设计完成）** → AI Army 接入 |
| `docs/12-system-map.md` | **23 系统**（v11.6：HC-P1 与 CMD-P0～36 完成；下一步家族写链迁移） |
| `docs/02-architecture.md` | **v2.0** 架构总图 + 20引擎 + 5战斗子模块 + 数据流 + shared工具链（Session 75 全面重写） |
| `docs/05-combat-system.md` | §5.4 战法+三级水军 · §5.5 **主副将与参谋编成**+爵位加成 · §七 计策 · §6 暴击反击连击(战场) · §8 单挑经典化设计(§8.1~8.16 核心三角+叙事+**宿命对决详表**) |
| `docs/00-dev-constitution.md` | 开发总则（**v1.6 §十一 美术与版权铁律**） |
| `docs/08-data-dictionary.md` | **规模真源**（0-A units=9；officers `appearance` + `avatarGene` 字段） |
| `docs/11-context-management.md` | 适性 S~NONE 系数 |
*Session 126 交接 | 2026-07-21 | 引擎缺陷修复：单挑嵌套锁（Bug 1）、战场行军指令实效（Bug 2）、meleeRefresh 缺锁（Bug 3）；全部验证通过 | 三层战斗架构 + 总军师系统 + 设施建造回合化已实装*
  上限、受必杀 +20% 化解与败而重伤撤退完成，并修复挑战方胜时 loserId 归属错误。
- **R5 已实装并验收**：农/商/城按9/6/12月持续推进，总成本300/400/500金；首付1/3、
  余款按月扣，人员或资源不足暂停，第三月起损失进度；预算覆盖12月金粮、项目、行政费，
  俸禄/战争损失未实装项明确列0。专项验证17/17。
- **R6 已实装并验收**：每势力至多双线，源城按邻敌动态留守；停战、两月粮不足或兵力
  低于守军55%时撤回。武将五维不变，固定 seed 双线计划复现，专项38/38。
- **R7 已实装并验收**：新状态只用 `courtNetwork/courtNetworkOpportunities`，删除成年女性
  换算与成功率加成；旧 v1 字段无损迁移，历史女角来源不变。浏览器实点地方结交通过。
- **R8 已实装并验收**：四入口为人物成长/军团战备/阵型精通/战役态势；固定
  3城/10将/2战真实推进24个月，每月均有至少两项可行选择并记录机会成本，专项54/54。
  属性/技能自动升级、功绩等级和阵型双轴成长仍后置。
- 当前 Next：一致性修复 R1～R8 已收口；按 `12-system-map.md` 选择一个已登记系统。

### Session 252 · BF-P4 总验收

- 阵前/城下挑战均复用既有 S10 duel 引擎、权威 RNG 与 `DuelPanel`；郡域实例保存完整
  上下文，重复结算有幂等保护。
- 结果写回功绩、败方状态、挑战方 Army 士气，挑战方胜时守军-15%；无 Army 的开发入口
  不伪造军团，只使用玩家势力在职武将。
- 专项20/20；shared 198/198、client 36/36、静态检查与构建全绿；1440×900 两种挑战、
  两郡往返和 console error=0。BF-P4 已完成，Next 为 BF-P5 工具与位置映射。

*Session 239 交接 | 2026-07-30 | CMD-P34 情报原子切换完成；下一步 P35 家族迁移前审计*

### Session 246 · R5 补充

- 农/商/城项目为9/6/12月、300/400/500金；一城一项，首付1/3、余款逐月扣。
- 人员或资源不足暂停；第3个暂停月起损失进度。预算覆盖12月金粮、民军粮耗、项目余款、
  递增行政费；俸禄和基线战争损失显式列0。
- 专项17/17及全仓回归绿色。Next 固定 R6 S15，不并行启动 R7。

### Session 247 · R6 补充

- AI 主动攻击 Army 由一支扩为最多两支；实际受不同前线城、可用主将、兵粮、3500最低
  出征兵和动态守备约束，同一源城同月不重复出军。
- 源城保留至少500兵，受威胁时保留相邻最大敌军25%；围城/接战军在停战、粮不足两月
  或兵力低于目标守军55%时主动撤回并写军情。
- 不修改武将五维、不增隐藏兵力或战斗倍率；军事决策继续走权威 RNG，专项38/38。
  Campaign 71/71、战役存档9/9、回合节拍28/28、shared 198/198、client 36/36及
  typecheck/lint/data/build/diff-check 全绿。县级主动 AI、Army—县位置映射、真实路径
  补给和郡域迷雾仍后置。Next 固定 R7 S09。

### Session 248 · R7 补充

- 新局、Schema、运行时、迷雾、API 响应与新存档只写 `courtNetwork` 和
  `courtNetworkOpportunities`；旧 v1 `beauty*` 由加载迁移器无损改名并删除旧键。
- 开局机会由商业/民心/首都地位派生，结交固定65%基础成功率，不读取或扣除成年女性；
  历史女角仍只走剧本、事件、亲属跟随和联姻。
- S09 25/25、存档23/23、计谋谍报34/34、外交40/40、AI谍报4/4、Campaign71/71；
  Headless 实点地方结交通过，旧字段0、人口不变、console error=0。Next 固定 R8。
