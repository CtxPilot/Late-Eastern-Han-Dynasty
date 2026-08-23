# 六角战旗与白刃接战系统

> S10 / S21 当前运行技术边界。Session 277 首个正式切片。
> Session 279 仅补充原设定优先的整合边界；运行时代码、Schema、API、RNG 和静态数据均未改变。
> Session 334 收紧同回合撤销、交权封闭和旧档 stale 记录的运行时降权边界。
> 后续实施计划见 `29-formation-integration-development-plan.md`，须经用户另行明确启动。

## 一、设计目标与边界

本系统不是新增一套远程战斗游戏，而是把传统战旗的“远程普攻/技能射程”收口为三国军阵语义：

```text
郡域战场（战略节点）
  └─ 局部六角战旗（行军、朝向、接敌）
       ├─ 相邻1格：剑、斧白刃接战
       ├─ 1~2格：长矛隔格接战
       ├─ 1~2格：兵种战法（不再无限远射）
       └─ 单挑：暂停军阵，进入独立 DuelStage
```

火计属于战场计谋而非武器远射，继续使用自身智力、天气和地形规则。服务端 `GameState`、
权威 RNG 与幂等结算仍是唯一真源；客户端只负责预览和动画。

## 二、分层架构

| 层 | 模块 | 职责 | 禁止事项 |
|:--|:--|:--|:--|
| 坐标/移动 | `shared/tactical-grid.ts` | 坐标、A*、范围、地形和障碍 | 不读角色/伤害数据 |
| 接战范围 | `shared/melee-engagement.ts` | 武器1~2格、六方向、侧背判定 | 不计算最终伤害 |
| 编排协议 | `shared/tactical-system.ts` | 阶段、事件、撤销、配置、规则插件 | 不依赖 React/Express |
| 权威规则 | `server/src/engine/battle.ts` | 复验路径、落子、攻击、技能、单挑 | 不相信客户端路径 |
| 表现 | `BattleView.tsx` | 高亮、悬停预览、动画、反馈 | 不修改权威状态 |

### 2.1 交互接口

```http
GET /api/game/battle/move-range/:unitId
-> { keys: ["q,r", ...] }

GET /api/game/battle/move-path/:unitId/:q/:r
-> { found, path:[{coord,step,cost,spent,remaining,animation}], totalCost, visited, reason? }

POST /api/game/battle/move { unitId, q, r }
-> BattleState                         # 服务端重新跑 A*

POST /api/game/battle/undo {}
-> BattleState                         # 失败为 400 + {error}

POST /api/game/melee/round { actionType, targetFormation? }
-> { game, melee, result }
```

错误码/消息：`INVALID_GRID`、`OUT_OF_BOUNDS`、`BLOCKED`、`UNREACHABLE`、
`UNDO_EMPTY`、`UNDO_PHASE_LOCKED`、`UNDO_TURN_LOCKED`、`UNDO_IRREVERSIBLE:<kind>`、
`UNDO_STATE_MISMATCH`。Express 统一映射为 HTTP 400；
校验失败前不得修改状态。

## 三、坐标、索引与转换

采用尖顶 axial 六角坐标：横轴 `q` 向右，纵轴 `r` 向右下，隐含第三轴 `s=-q-r`。
网格数组索引固定为 `cells[r][q]`，合法范围为 `0≤q<width`、`0≤r<height`，最大 100×100。

```text
          (q,r-1)  (q+1,r-1)
              ╲     ╱
       (q-1,r) — (q,r) — (q+1,r)
              ╱     ╲
        (q-1,r+1)  (q,r+1)
```

距离：`(|dq| + |dq+dr| + |dr|) / 2`。

像素转换（尖顶）：

```text
x = originX + size × √3 × (q + r/2)
y = originY + size × 3/2 × r
```

反向转换先求浮点 axial，再做 cube-round。公共 API 为 `tacticalHexToPixel`、
`tacticalPixelToHex`、`tacticalHexDistance`、`tacticalHexKey`。

## 四、A*、范围与障碍

### 4.1 算法

A* 使用二叉最小堆；`g` 为累计地形消耗，`h` 为六角距离×最小通行成本，保证 admissible。
移动范围用同一最小堆执行 Dijkstra，输出每格**剩余移动力**。复杂度均为 `O(V log V)`，
V≤10,000。`tactical-grid.test.ts` 对空白 100×100 从 `(0,0)` 到 `(99,99)`执行 `<100ms` 门禁。

### 4.2 通行矩阵

| 地形 | 基础消耗 | 步/骑 | 水军 | 两栖 |
|:--|--:|:--:|:--:|:--:|
| 平原 | 1 | ✓ | × | ✓ |
| 森林 | 2 | ✓ | × | ✓ |
| 山地 | 3 | ✓ | × | ✓ |
| 水域 | 4 | × | ✓ | ✓ |
| 沼泽 | 3 | ✓ | × | ✓ |
| 城地 | 2 | ✓ | × | ✓ |
| 墙体 | ∞ | × | × | × |

实体障碍 `building/tree/barricade/unit` 默认均阻挡；特定单位可经 `ignoredObstacles` 显式豁免。

```text
目标格 → 越界? ─是→ OUT_OF_BOUNDS
  │否
  ├─实体阻挡且无豁免? ─是→ BLOCKED
  ├─地形与 mobility 不兼容? ─是→ BLOCKED
  ├─累计消耗>剩余移动力? ─是→ 不入 open set
  └─更新 best/cameFrom → 入最小堆
```

客户端悬停只请求预览；点击后动画按 `PathStep.animation` 播放，完成才提交 `/move`。服务端
再次寻路，防止地图变化、占位变化或伪造客户端路径。

## 五、动画状态机与回调

```text
idle → turning → walking ─┬→ climbing → walking
                          ├→ wading  → walking
                          └→ arrived → commit → idle
```

当前 `BattleView` 使用 `requestAnimationFrame`，每格 140ms；浏览器刷新率驱动，验收下限 30fps。
路径步携带 `walk/turn/climb/wade` 事件类型。扩展动画器应遵循：

```ts
type AnimationCallback = (event: {
  unitId: string;
  state: 'turn'|'walk'|'climb'|'wade'|'arrived';
  step: number;
  coord: TacticalHex;
}) => void;
```

`arrived` 回调前不得改变权威位置；动画取消时不得提交落子。

## 六、白刃范围、阵型与战术

### 6.1 武器范围和朝向

| 武器 | 距离 | 正面弧 | 侧击 | 背后 |
|:--|:--:|:--:|:--:|:--:|
| 剑 | 1 | 朝向±1 | 攻+12% | 不可攻击 |
| 矛 | 1~2 | 朝向±1 | 攻+8% | 不可攻击 |
| 斧 | 1 | 正前 | 攻+18% | 不可攻击 |

朝向为 `0..5` 六方向；移动后由前后坐标计算新朝向。边界、距离、朝向统一经
`checkMeleeTarget` 判定；客户端红色攻击提示与服务端攻击校验共用该函数。

### 6.2 0-A 六基础阵型

| 阵型 | 攻 | 防 | 机动 | 主要弱点 |
|:--|--:|--:|--:|:--|
| 方阵 | 0 | +30% | 0.8 | 进攻能力弱 |
| 圆阵 | -10% | +20% | 0.7 | 易失先手 |
| 锥形 | +25% | -10% | 1.3 | 侧翼薄弱 |
| 雁行 | +15% | -5% | 1.1 | 怕强攻突破 |
| 鹤翼 | +10% | +15% | 0.9 | 怕奇袭中军 |
| 锋矢 | +20% | -15% | 1.2 | 怕固守消耗 |

切阵消耗1战术点并执行一个白刃回合。Session 277 修复了旧实现数字枚举与字符串修正键不匹配、
导致阵型加成失效的问题。

> 上述“执行一个白刃回合”只属于标准白刃 `change_formation`。Session 279 计划中的
> **Session 301 FM-P4 六角变阵状态机**：六角战开放服务端权威变阵命令——每回合每方至多一次、
> 消耗 1 TP、仅玩家阶段主将未行动时可用；变阵后主将 `hasActed=true`，只结束主将行动，不调用
> `runMeleeRound`，也不结算白刃回合。合法性复用 `getAvailableFormations`，客户端按钮仅作入口提示。

> **Session 288 FM-P1 已迁移**：普通六基础目录已落地 `[0,1,2,3,4,6]`；冲阵 id 16
> 是骑兵高阶/特殊精通，FM-P0～P5 只保留数据兼容，不进入战役初选、标准或六角候选。
> `formations.json` 已收敛为 `[0,1,2,3,4,6,16]`，圆阵(1)/雁行(3) 补齐、7 偃月/8 长蛇移出可选集，
> 146 将精通逐人迁移完成。本表是 Session 277 白刃运行百分比（回归基线），不等同于
> `05-combat-system.md §4.5` 的长期 Lv1 点值；两套数值在 Gate N1 前不得叠加。

> **Session 291 FM-P3a 点值迁移**：标准模式 `runMeleeRound` 已不再消费本表百分比（`meleePercent`
> 过渡字段退役，类型/JSON/生成器均移除）。唯一运行量纲改为 `formations.json` `tiers[0]` 点值，
> 经等价性单点换算（`MELEE_ATK/DEF_GAIN=0.1`、`MOB_GAIN=0.5`、`MOB_BASE=1.0`，见
> `server/src/engine/meleeRound.ts`）消费，正面增量再按组织度执行档缩放（负修正原值保留）。
> 本表继续作为 Session 277 回归基线登记；逐阵迁移前后差异见 `formation-catalog-migration.md` §4.2。

> **Session 295 FM-P3 六角阵型贡献**：六角 `battle.ts`（普攻/战法/AI 评估）经
> `server/src/battle/hex-formation.ts` `hexFormationMods` 消费 `tiers[0]` 点值——攻点值 ×2 进
> `baseAttack`、防点值 ×2.5 进 `baseDefense`（六角公式量纲的模式专用投影，负修正原值保留，
> 组织度因 BattleState 暂无该字段按 orderly 中性解析，随部署注入一并接入）。三模式
> （自动/标准/六角）点值同源消费至此闭环。

> **Session 297 FM-P3 六角部署注入**：六角微操从 `CampaignArmy.squads` 生成多个 `BattleUnit`，由共享
> `projectHexDeployment` 读取阵型 `deployment.slots` 投影初始格；攻方保持模板方向、守方轴向镜像，
> 缺阵位不补虚构部队，越界/碰撞按固定邻接顺序收缩。客户端仍按 `BattleState.units[]` 选择/移动，
> AI 逐个存活 unit 决策，终局按整方是否仍有存活部队判定。Session 301 已补齐六角变阵资源/阶段门禁。

> **Session 305 敌军战法切片**：六角敌军回合在目标进入 1~2 格时读取当前兵种的 `leveled` 战法，
> 按武将兵种适性和剩余气力选择最高可用层级；结算复用六角 `calcDamage`、阵型点值和权威 RNG，
> 成功施放写入已有状态效果并结束该部队行动，失手只消费气力。`proficiency` 特殊战法和多目标
> 范围展开仍后置，不改变五阶段协议或 BattleState 字段。

> **Session 296 FM-P3 标准模式战术协同矩阵**：本表的强攻/固守/奇袭三战术运行时已接入标准白刃模式——
> `MeleeState.tactic?` 持久姿态（白刃面板选择、不耗 TP）经 `shared/data/tactical-system.v2.json` 单一真源消费：
> 战术攻/防/先手修正为 T_base（不受组织度缩放），synergy 按 "敌阵 ∈ `strongAgainstFormationIds` → ×1.1，
> 否则 ×1.0"；**冲突 0.9 因 0-A 无战术×阵型反向关系表不产生触发源（计划 §4.6 不扩 6×6 矩阵）**，常量保留供
> 0-B 反向关系扩展。设置/清除经 `POST /melee/tactic`；回合战报 events 记录「战术·强攻」等。

### 6.3 战术—阵型矩阵

| 战术 | 攻 | 防 | 先手 | 协同/克制 |
|:--|--:|--:|--:|:--|
| 强攻 | +25% | -15% | +10% | 克方圆/雁行 |
| 固守 | -10% | +30% | -10% | 克锋矢/长蛇 |
| 奇袭 | +15% | -5% | +30% | 克长蛇/鹤翼 |

叠加顺序：`(阵型修正 + 战术修正) × 协同区`；协同为1.1、冲突0.9、中性1.0。
`shared/data/tactical-system.v1.json` 是 5 个字符串阵型 + 3 战术的纯协议/测试切片，
由 Zod v1 Schema 校验，但不是 `formations.json` 的目录或属性真源。**Session 288 FM-P1** 已新增
TacticalConfig v2（`shared/data/tactical-system.v2.json` + `migrateTacticalV1ToV2`）：v2 只保留
网格、单挑、战术和数字 ID 关系（`strongAgainstFormationIds`），不再复制阵型名称/攻防机射值；
v1 文件只读保留为兼容/迁移夹具。`square_circle` 拆为方/圆、长蛇关系后置、锥形保持中性的具体表见
`29` §4.6。

### 6.4 伤害主链

```text
基础攻 = 兵种攻 + 有效武力/10
基础防 = 兵种防 + 有效统率/10 + 装备防御
兵力系数 = 0.3 + 0.7×当前兵/最大兵
士气系数 = 0.6 + 0.4×士气/100
最终攻 = 基础攻×兵种克制×地形×兵力×士气×侧击
最终防 = 基础防×防守地形
伤害 = max(1, round(max(1.5, 最终攻-最终防+2)×兵力/30×随机0.9~1.1))
```

暴击、反击、连击继续由 `crit.ts` 事件链结算；单人格挡/闪避属于独立单挑指令系统，
不与军阵单位的兵力伤害混成一个概率池。

## 七、状态、事件、撤销与持久化

阶段图：

```text
turn_start → move → attack → skill → turn_end → enemy ─┬→ turn_start
              └──────────────→ turn_end                └→ over
```

非法跳段抛 `INVALID_PHASE_TRANSITION`。状态事件使用逻辑时间 `turn×1000+sequence`，记录
`player/ai/system` 来源，不使用墙钟时间破坏确定性回放。事件总线同步处理权威归约，异步处理
动画/遥测；异步失败不得回滚已提交事件。

`BattleState.actionHistory` 随存档保存最近三条操作。移动保存前后坐标和移动力，只可在创建它的
当前玩家回合、攻击/施法/结束行动之前撤销；攻击写入 `reversible=false` 审计记录，因为它已经消费
RNG 并揭示结果。进入任一 `player → enemy` 边界时，历史不删除，但所有尚可逆记录均封闭。

服务端撤销必须依次满足：当前为玩家阶段；最后记录来源为 `player`、种类为 `move`、
`reversible=true`；`floor(logicalTimestamp/1000) === BattleState.turn`；单位为存活攻方，当前位置匹配
`afterPosition`，`beforePosition` 在图内且未被其他存活单位占用，`beforeMp` 不超过单位上限。
回合不符返回 `UNDO_TURN_LOCKED`，快照不符返回 `UNDO_STATE_MISMATCH`；拒绝前不改坐标、MP、历史或战报。
修复前已保存的 stale `reversible=true` 记录仍按原 Schema 读取，仅在运行时拒绝，不升存档版本。
这是撤销的明确安全边界，而非客户端任意回滚。

## 八、规则插件与扩展指南

所有新规则实现：

```ts
interface BattleRuleStrategy<C, Command, Result> {
  id: string;
  initialize(context: C): C;
  execute(context: C, command: Command): Result;
  settle(context: C, results: readonly Result[]): C;
}
```

使用 `BattleRuleRegistry.register/resolve` 注册；重复 ID 和未知 ID 均失败。插件不得直接读取
全局 RNG、写 React store 或绕过 Zod 配置。新增阵型/战术的流程：先升级配置 Schema 版本，
补 JSON 与迁移说明，再注册策略，最后补纯函数、服务层和浏览器三层测试。

## 九、单挑双入口

`duelTriggerChance`：

```text
P = clamp(配置基础率 + 勇猛×1% + (挑战方士气-守方士气)×0.2%, 0, 95%)
```

共同门禁：双方主将存活且满足位置条件；白刃入口额外要求双方士气≥40。郡域战场的阵前/城下
挑战与六角相邻挑战均复用既有 DuelState、四倾向、权威 RNG 和全屏 DuelPanel。

当前正式单挑仍采用最多10回合的七指令深度规则；配置中的3回合用于未来“快速军阵单挑”策略，
不得静默替换既有完整单挑。结果回写功绩、伤病、俘虏、部队士气与守军震动，幂等保护不变。

## 十、可访问性与视觉规范

- 可移动格使用蓝色填充+描边+点号，不只依赖颜色；路径有序号与文字摘要。
- 可攻击目标使用红色虚线六边形并保留实际点击目标；不可攻击格不闪烁。
- 所有按钮有文字、禁用态和 `title` 原因；文本/背景按 WCAG 2.1 AA 对比目标设计。
- 伤害与结果同时进入战报文字，动画不是唯一信息源；`prefers-reduced-motion` 后续接入时可跳过逐格插值但仍展示路径。

## 十一、测试门禁

| 门禁 | 指标 |
|:--|:--|
| 纯核心 | `tactical-grid/tactical-system/melee-engagement` 17项 |
| 性能 | 100×100 A* `<100ms` |
| 覆盖率 | statements≥90%、functions≥90%、lines≥90%、branches≥80% |
| 权威集成 | `verify-save-battle`：A*落子、同回合撤销、交权封闭、旧档跨回合拒绝、快照不变 |
| 白刃模式 | `verify-melee-modes`：三模式、变阵、非法阵型 |
| 浏览器 | `verify-session277-ui`：同回合撤销→交权→新回合隐藏/端点拒绝→新移动再可撤 |

注释覆盖率没有可靠自动测量工具，本项目不伪造“90%注释率”；核心公共 API 与关键算法均使用
TSDoc/行内规则注释，按代码审查门禁执行。

### Session 302 · FM-P4 战报解释 UI

`BattleReport` 展示最近六条六角战报，并固定保留最近一次变阵解释；变阵条目显示 TP 与前后阵型，攻击条目显示
攻/守阵型贡献，非法变阵显示服务端阻断原因。面板不在客户端重算规则，旧日志无需迁移；浏览器 1440×900 实测
面板出现且 console error=0。

### Session 354 · 敌军协同包围走位最小切片

六角敌军 AI 在原有目标/地形走位之前增加一条确定性包抄优先级：若目标已有一支敌军从有效接战方向相邻贴住，
且 `resolveHexSurround` 尚未判定受围，则在当前可达且未占用的格子中寻找目标另一邻接方向。候选按剩余移动力、
方向和坐标稳定排序；落子后 `facing` 指向目标，随后仍沿原有战法/普攻链结算。没有可行邻接格时保持既有距离/地形评分，
不消费 RNG，不增加 `BattleState`/`BattleUnit` 字段或 API。该切片只覆盖形成第二个接战方向，完整敌军撤退、追击/截击、
攻城突围和多军团协同仍后置。

### Session 355 · 受围敌军突围走位最小切片

当敌军单位本身由 `resolveHexSurround` 派生为受围时，AI 在当前可达且未占用的空格中寻找能将有效接战方向降到一支以内的落点，
按接战方向数、剩余移动力和坐标稳定排序；移动后更新 `facing`，重新选目标并复用既有战法、火计、普攻链。没有合法落点时回到原有
攻击/距离评分；该切片不消费 RNG、不写 `isRetreated`、不直接结束战斗，也不扩展 BattleState/BattleUnit/API。完整敌军撤退、
追击/截击、攻城突围和多军团协同仍后置。

### Session 356 · 撤退态活跃单位语义收口

复用既有 `BattleUnit.isRetreated`，不新增战场模型：撤退单位保留兵力快照供结算，但六角运行时不再把它算作活跃部队。
敌军 AI 与存活判定、目标选择、寻路占位、AOE、灼烧、敌军回合恢复和主动单挑候选均排除撤退单位；玩家变阵、移动、撤销、普攻、火计、
观天、战法和单挑也不能再次操作撤退单位。该切片不消费新 RNG、不改 API/Schema/数据规模；完整敌军撤退、追击/截击、攻城突围和多军团协同仍后置。

### Session 357 · 敌军主动撤退最小切片

敌军 AI 在每支部队行动前检查既有 `isSurrounded` 派生态势。未受协同包围且士气≤20，或当前兵力≤最大兵力25%时，
复用 `isRetreated=true` 标记单位退出，写入 `hasActed=true`、`mp=0`，不消费 RNG；全体敌军退出后六角战进入玩家胜利终局。
受围低士气/重创单位不跳过既有突围走位，仍先寻找解除派生包围的空格并继续原有战法/火计/普攻链。该切片不新增字段、API、
RNG 或数据规模；追击/截击、攻城突围、多军团撤退仍后置。

### Session 358 · 敌军主动撤退相邻截击门禁

当敌军满足 Session 357 的低士气/重创撤退门槛，但与任一活跃敌对单位相邻（1 格）时，
`runSimpleEnemyAi` 不直接复用 `isRetreated` 终态；先写入“被截击”战报，再继续既有战法、火计或普攻链。
该门禁只阻断瞬时脱离，不新增追击状态、不消费额外 RNG、不扩展 `BattleState`/`BattleUnit`/API 或静态数据规模；
未被截击的撤退单位、受围单位和战后既有 50% 回流语义保持不变。完整追击/截击、攻城突围和多军团撤退仍后置。

### Session 360 · 截击后相邻目标优先

当 Session 358 的相邻截击门禁成立时，`runSimpleEnemyAi` 先从相邻且活跃的敌对部队中按既有确定性目标评分选取行动目标；
仅当相邻候选不存在时才回退普通全局目标评分。这样“被截击”不再只是战报标签，低士气/重创敌军会先处理贴身截击者，
随后仍复用既有战法、火计、普攻、暴击/反击链与权威 RNG 顺序。该修补不新增追击状态、BattleState/BattleUnit 字段、API、
额外 RNG 或数据规模；完整追击/截击、攻城突围和多军团撤退仍后置。

### Session 361 · BattleView 撤退态活跃单位边界

BattleView 复用既有 `isRetreated` 非活跃语义：撤退部队不再进入地图选择、攻击目标、红色可攻击标记或协同包围来源；
残留 `selectedUnitId` 也不会恢复成可操作选择。结束态双方摘要仍可显示未击破撤退部队的兵力快照，便于对应
`/battle/exit` 的 50% 回流结算。该修补不新增 BattleState/BattleUnit 字段、API、RNG 或数据规模，客户端不复制服务端合法性判定。

### Session 367 · 追击伤害 0-A 切片

在 Session 358/360 的“被截击”门禁与目标优先级之上，为被截击的撤退单位补入一次追击伤害：敌军 AI 被截击时，
由相邻活跃截击者中按既有目标评分择优的一名截击者结算 `calcDamage` 中位值×0.6（必中、至少 1，不触发暴击/反击/连击，
士气 −2，不消费权威 RNG）；若追击致溃则标记 `isDestroyed` 并结束该单位本回合行动链。玩家经 `POST /battle/retreat`
成功战术撤退时，对每支与活跃守军相邻的攻方退兵按同系数追加一次追击，多名截击者时仅最强一名出手；无相邻守军时无追击。
数值真源见 `docs/08-data-dictionary.md` §二十七；本轮仍不含攻城突围与多军团规则，不新增字段/API/存档。

### Session 368 · 攻城守城与城门突围 0-A 切片

`BattleState.isSiege` 时守方 `formationDef` +3（约 +30% 有效防御，`hexFormationMods` 外的攻城修正），
攻方战术撤退的 `RETREAT_SURROUNDED` 对位于地图边缘（`q==0/width-1/r==0/height-1`，城门）且受围的单位放宽——仍可突围，
突围时照常承受相邻守军 0.6 系数追击。非攻城或非边缘受围仍按既有阻断；不新增字段/API/存档/RNG，数值真源见 `08` §二十八。

*v1.7 | 2026-08-21 | Session 368 · 攻城守城与城门突围 0-A 切片*

### Session 377 · 锥形阵骑兵突击接入冲锋乘区

- `resolveChargeBonus` 新增锥形阵(2) 来源：骑兵+已移动普攻 +50%，与平原 +20%/重骑 +50%/冲阵(16) +80% 加法叠乘；玩家与敌军 AI 同源（simpleAi 复用同函数）。
- 森林等非平原地形仅消去平原来源，阵型来源独立触发；骑神连击联动按 `chargePct>0` 自动覆盖锥形阵冲锋。
- 数值真源：`docs/08-data-dictionary.md` §二十九 新增一行（formations.json effects 同值）。验证 `verify-cavalry-charge` **29/29**。

### Session 378 · 战术视野（玩家侧信息投影）

- `shared/battle-sight.ts`：`effectiveSightRange`（基线4 + 所在格山+1/林−1 + 雾−2/雪−3，下限1）与 `computeVisibleEnemyUnitIds`（敌军与任一存活我方单位六角距离 ≤ 视野即整队可见；已溃/重创不进集）。
- BattleView 经 `battleViewState.filterVisibleTacticalUnits` 投影：视野外守方单位不渲染、不可选中、无红可攻标记（点击视为空地）；顶部双方摘要卡仍显示敌军主将（非战场单位情报，边界保留）。
- 0-A 边界：敌军 AI 全知；服务端权威态不改写、攻击门禁不加视野校验。数值真源 08 §三十；单测 shared battle-sight 12 项 + client battleViewState 2 项。
