# BF-P2 设计：县级可争夺 + 存档接入 + 类型归并判断

> 状态：**设计阶段（待用户拍板）** — 本轮不写实现代码、不动 Schema 实现、不涉及 RNG。
> 范围：BF-P1 已完成南郡江陵围城的最小闭环验证，本文对 P1 自承留待 P2 的三项架构问题给出明确结论，并列出待拍板的开放问题。
> 前置：`docs/21-battlefield-scene-design.md` v1.3（Q1~Q8 已批准、P1 最小闭环已打通）。
> 编号：`21` 为战场系统设计、`22` 为南郡校勘、`23` 为一致性修订、`24` 为人物状态表情，故本文使用 `25`。

---

## 一、设计阶段定位

BF-P1 在 Session 173 已打通"大地图 → 进入南郡战场 → 围攻江陵 → 撤军返回 → 退出战场"的最小闭环，并在 §10 自承留待 P2 处理三项架构债：

1. **16 县节点独立可控/可争夺逻辑**（Q6 已批准"可控但不进全局经济"，但 P1 仅江陵 seat 实际可攻打）；
2. **BattlefieldInstance 接入 GameState schema**（进行中战场进存档；P1 故意不接以保护 CampaignArmy 62/62）；
3. **新 `BattlefieldInstance` 类型与旧 `BattlefieldMap` 的归并判断**（P1 §10.5 第 2 条已自承"数据不兼容，不强行合并"，但合并/废弃/保留三选一未拍板）。

本文**只做设计**，按 BF-P0/P1 既有模式产出决策文档，等用户拍板后再排入实现。理由与 P0/P1 一致：三项中任意一项都会显著影响后续工作量与架构方向，盲写代码会引发返工。

### 1.1 非目标

- 不写实现代码、不改 Schema 实现、不动 RNG。
- 不在 P2 启动 P3（AI 决策整场复现，已批准但暂缓）。
- 不引入第二郡（颍川属 P4）。
- 不废弃 `BattlefieldMap` 或 `BattlefieldPanel`（见 §五结论）。
- 不增加新大系统编号（仍属 S02/S05/S10/S16 的既有深化）。

### 1.2 现状事实基线（P1 落地后）

| 项 | 现状 |
|----|------|
| 南郡县节点 | 16 县 + 11 路线 + 10 地标，已在 `shared/data/historical-geography/` 落地 Zod + JSON，零 RNG 只读预览可用 |
| BattlefieldSceneView | 已渲染 16 县节点 + 江陵 seat 高亮；Headless Chrome 实测通过 |
| `engageJiangling` | 当前实现仅 `selectCity(14) + marchOnCity(5000)`，复用旧 `createBattle cityId=14` 路径；未走真正的郡域战场逻辑 |
| 其他 15 县 | 纯静态展示，无攻打入口、无驻军、无控制权字段 |
| `BattlefieldInstance` 类型 | 已落地 `shared/types/battlefield-instance.ts` + Zod + JSON 往返单测；**未接入 `GameState` schema** |
| 旧 `BattlefieldMap` | 19 个调用点活跃使用（`api.ts`/`engine/battlefield.ts`/`services/game.ts`/`game-state-battle-schema.ts` 等），承担 Tier I 大地图邻接切片战场职责 |
| `BattlefieldPanel` | 1 个 caller（`App.tsx`），仍是 Tier I 大地图层入口 |
| CampaignArmy 62/62 | P1 故意不接 `activeBattlefieldInstance` 字段以避免破坏此测试 |
| `BattlefieldNodeState` | 类型已定义（`shared/types/battlefield-instance.ts:13`），但 P1 未承载控制权/驻军/城防等县级玩法状态 |

---

## 二、Q6 深化：县级独立可争夺范围

> **状态：Q9 已实施（Session 176，2026-07-24）+ 老实标注（Session 177，2026-07-24）+ 补给线路径判定补全（BF-P5，2026-07-31）** — 首批 3 县（当阳/华容/枝江）+ 江陵 seat = 4 县可攻打节点已落地；`engageCounty(countyId)` orchestrator 复用 `runAutoBattle` 自动结算；`tickBattlefieldInstance` 月度 tick 实现驻军消耗掉控制 + **BF-P5 补给线真实路径判定**；`verify-save-battlefield-instance` 49/49 含 f 类断言；Headless Chrome 完整验证通过。
>
> **⚠️ 四项攻占效果实现程度分级（Session 177 老实标注 + BF-P5 更新，避免读者误判四条实现程度一致）**：
>
> | # | 攻占效果 | 实现程度 | 说明 |
> |:-:|----------|:--------:|------|
> | 1 | 补给线切断 | ✅ **完整实现（BF-P5 路径判定）** | 设计原意是"经过占领县的敌方 Army 糧耗×2 + 士气-5"（见 §2.4 第 1 条）。**BF-P5（2026-07-31）已落地真实路径判定**：`shared/army-county-mapping.ts` 建立 Army—郡域位置映射（`nodeStates[].armyIds` 权威 + deployments 回退），`tickBattlefieldInstance` 逐支守方 Army 求 seat → Army 当前县最短路径，路径经过攻方控制县 → 该 Army 粮耗×2 + 士气-5。0-A 边界：守方 Army 入郡域场景由 R6（S15 多线 AI）排期，路径判定机制由 `verify-save-battlefield-instance.ts` f6/f6b 构造场景完整验证。详见 §2.6.1。 |
> | 2 | 驻军消耗压力 | ✅ **完整实现** | 占县后 `garrison>0` 保留控制、`garrison==0` 月度 tick 掉控制（`rulerFactionId=null`）；`controlTurns` 累计。与设计原意一致。 |
> | 3 | 战场推进节点 | ✅ **完整实现** | 县攻打复用 `runAutoBattle` 自动结算，不同入侵入口→不同首攻县，县作为江陵外围防线。与设计原意一致。 |
> | 4 | 视野扩张 | ✅ **完整实现（BF-P5 迷雾层，2026-07-31）** | 郡域迷雾层落地：`shared/commandery-fog.ts` 纯函数 + `maskGameStateForPlayer` 集成，军情层按揭示集遮蔽、地理层恒可见；揭示集 = 入口县 ∪ 郡治 ∪ 攻方 Army 所在县 ∪ 攻方已占领县（每源 + 一跳邻接）。**占领某县后其 `rulerFactionId` 变为攻方 → 成为揭示源 → 邻接县破雾**，正是"视野扩张"动作本身。验证：占华容前迷雾 7 县（含州陵）→ 占后 6 县、州陵/当阳/枝江揭示、华容驻军可见（f8 14 条 + 真实 API + Headless Chrome）。详见 §2.6.2。 |
>
> **对比要点**：四项攻占效果现**全部为完整实现**。第 1 条 BF-P5 补全路径判定；第 4 条 BF-P5 Session 256 随郡域迷雾层完整落地。守方 Army 入郡域场景的揭示归属仍留待 R6（迷雾层已就绪，届时只需并入揭示源）。
>
> **BF-P2 实施阶段完成声明**：Q10+Q11+Q12+Q9 四项全部落地；Q9 的四项攻占效果于 **BF-P5 起全部为完整实现**（补给线路径判定 Session 254、视野扩张迷雾层 Session 256），详见 §2.6。此前"一项为占位视觉反馈"的诚实标注随迷雾层落地解除。

### 2.1 问题陈述

Q6 已批准"县城在原型中可占领/驻守并影响补给与战争结算，但不进入全局经济模拟"。但 P1 落地时只让江陵（seat）走旧 `createBattle` 路径成为可攻打目标，其余 15 县完全是静态展示——这违反了 Q6 的承诺，是技术债而非新功能。

本轮需明确：

1. 是否让部分/全部属县变成可攻打目标？
2. 如果是，攻占县的玩法价值是什么？需要说清楚，不为"可攻打"而做可攻打。
3. 实现范围：全部 15 县一次性做，还是先选 2~3 个战术要点验证？

### 2.2 玩法价值分析（必须能讲清楚给用户听）

P1 当前 15 县是纯背景标签，玩家无理由与它们交互。让县变成可攻打目标，需要至少落地一种玩法价值。以下为候选清单，按推荐度排序：

| # | 玩法价值 | 实现 | 0-A 可行性 | 推荐 |
|:-:|----------|------|:----------:|:----:|
| 1 | **补给线切断** | 攻占敌后方县 → 敌前线 Army 粮道被截 → 月度补给消耗翻倍或受惩罚 | 中（需在 `CampaignArmy` 月度 tick 加粮道判定） | ✅ 强推 |
| 2 | **驻军消耗压力** | 占县需留驻军 → 兵力分配压力（攻方不能全力压江陵） | 高（沿用现有 Squad/Army 抽兵机制） | ✅ 强推 |
| 3 | **战场推进节点** | 县作为江陵外围防线，逐县攻克是真实历史（刘备取南郡历经当阳/华容等） | 高（场景栈已支持） | ✅ 推荐 |
| 4 | **情报视野扩张** | 占县扩大战场视野，敌方 Army 位置透明（沿用 S06 迷雾逻辑） | 高（S06 已有 mask 机制） | 推荐 |
| 5 | **谈判筹码** | 围而不下江陵时，占县作为撤围条件 | 低（依赖尚未实装的声望/戒备字段） | 后置 |
| 6 | **AI 行为分支** | AI 守县是被动响应（守军）；AI 主动攻县留 P5/R6 | — | 见 §五 |

**核心判断**：玩法价值 1+2+3 组合即可成立"为何攻县"——攻县不只是为了占县，是为了让江陵更好打（断粮、分兵、推进）。这正是 BF-P1 设计文档 §五"县城是可占领、可驻守、可围攻的战役目标，不只是背景标签"的本意。P1 没实现这部分是债，P2 必须补。

### 2.3 实现范围建议：先选 3~4 个战术要点县验证

**不推荐全部 15 县一次性做**——0-A 哲学是"先小后大"，P1/P2 阶段验证架构优于铺量。一次性做 15 县会同时引发 15 个攻打入口、15 套驻军逻辑、15 套控制权字段，违反"一次主攻一个切片"原则。

**推荐首批选 3~4 个战术要点县**，校勘依据见 `docs/22-nanjun-historical-geography-collation.md`：

| 县 | 战术意义 | 史实/演义锚点 |
|----|----------|---------------|
| 当阳 | 江陵北部门户，接襄阳入口；张飞断桥故事原型 | 《三国志·张飞传》当阳长坂 |
| 华容 | 长江北岸水路要点；曹操败走华容故事原型 | 《三国志·武帝纪》裴注 |
| 枝江 | 汉水下游，水陆转运节点；属县中较稳定可考者 | 《后汉书·郡国志》 |
| 夷陵（可选） | 江陵西部屏障，长江三峡出口；陆逊烧连营故事原型 | 《三国志·陆逊传》 |

**首批 3 县（当阳/华容/枝江）+ 江陵（已实装）= 4 县可攻打节点**，足以验证：
- 县攻打入口与 `createBattle` 路径的桥接（复用 vs 新建）；
- 县占领后控制权写入 `BattlefieldNodeState`；
- 驻军分配与月度补给线判定；
- 战场推进的节点拓扑（不同入侵入口→不同首攻县）；
- 视野扩张（占县→点亮周边道路上的敌 Army）。

验证通过后，P3/P4 阶段再扩到剩余 11~12 县（含夷陵等）；P5/P6 全郡 16 县一次性补齐。

### 2.4 攻占县的具体效果（实现契约草案）

仅做设计，不动 Schema 实现。以下为 P2 实施时需遵守的契约：

```typescript
// P2 实施时新增到 BattlefieldNodeState（仅设计，不立即落地）
interface BattlefieldNodeState {
  // ... 既有字段
  rulerFactionId: number | null;     // null = 中立/无控制；非 null = 控制方势力
  garrisonArmyId?: string | null;    // 驻军 Army 引用（可选，沿用 CampaignArmy）
  fortification: number;             // 县城防 0~100（seat 默认 60，属县默认 20）
  controlTurns: number;              // 已被当前势力控制的回合数（用于整合期判定）
}
```

攻占县的玩法效果（沿用 Q6 "影响补给与战争结算，不进全局经济"）：

1. **补给线判定**（核心玩法价值 1）—— ✅ **BF-P5 真实路径判定已落地**（原为简化替代实现，见 §2.6.1）：
   - 设计原意：攻方占县 → 该县及邻接路线对攻方"友军"开放，对守方"敌后"；守方 Army 若其补给线（从己方边界入口到 Army 当前节点的最短路径）经过攻方控制县，月度粮耗 ×2，士气 -5；实施位置：`CampaignArmy` 月度 tick + `BattlefieldInstance.routeStates` 联合判定。
   - BF-P5 落地（2026-07-31）：`shared/army-county-mapping.ts` 位置映射 + `tickBattlefieldInstance` 逐军真实路径判定（详情见 §2.6.1）。0-A 边界：守方 Army 入郡域场景留 R6（S15 多线 AI）。

2. **驻军分配**（玩法价值 2）—— ✅ **完整实现**：
   - 攻占县后必须留驻军（最小 1 个 Squad 或 Army 拋部），否则下月控制权掉到 `null`（"无主"）；
   - 驻军消耗沿用 `TROOP_FOOD_EAT`；
   - 撤退不能撤到无驻军的己方县（沿用 §6.4 事务不变量"撤退必须落到可达且合法的己方/中立入口"）。

3. **战场推进**（玩法价值 3）—— ✅ **完整实现**：
   - 县攻打仍复用 `createBattle`（六角）或 `runAutoBattle`（自动）；
   - 不新建第三种战斗引擎，沿用 P1 `engageJiangling` 桥接模式扩展为 `engageCounty(countyId)`；
   - 县城防 20（vs 江陵 60），攻方需要的最小兵力相应降低。

4. **视野扩张**（玩法价值 4）—— ✅ **完整实现（BF-P5 Session 256，见 §2.6.2）**：
   - 设计原意：占县后该县及邻接路线视野对攻方透明；沿用 S06 `maskGameStateForPlayer` 在郡域战场层加一层 mask（已有迷雾机制，复用即可）。
   - 落地情况（Session 256）：郡域迷雾层已下沉到 `BattlefieldInstance`（`shared/commandery-fog.ts` + `maskGameStateForPlayer` 集成）。地理层恒可见，军情层按揭示集遮蔽；揭示集 = 入口县 ∪ 郡治 ∪ 攻方 Army 所在县 ∪ 攻方已占领县（每源 + 一跳邻接）。**占领某县 → `rulerFactionId` 变攻方 → 成为揭示源 → 邻接县破雾**，即"视野扩张"动作本身。验证：占华容前 7 迷雾（含州陵）→ 占后 6、州陵/当阳/枝江揭示、华容驻 858 可见。

5. **不进全局经济**（Q6 边界，强约束）：
   - 县占领不写入 `GameState.cities`（仍只是 30 城）；
   - 县占领不产生 `gold/food` 收入、不触发 `S03 内政`、不进 `S04 人口` 模拟；
   - 战争结算时通过 `BattlefieldSettlement.countyControlSummary` 汇总，但不改全局 `City` 状态（除非战争胜方占领 seat 触发 `cityControlChanges`，那仍走现有 §6.4 事务）。

### 2.5 对 P1 已提交代码的改动风险

**风险等级：HIGH（架构增量，但非破坏性）**

| P1 已提交文件 | 改动 | 风险 |
|---------------|------|------|
| `client/src/components/battlefield/BattlefieldSceneView.tsx` | 新增县节点可点击 → 触发 `engageCounty` | 增量，不破坏现有江陵入口 |
| `client/src/stores/gameStore.ts` | 新增 `engageCounty(countyId)` action；保留 `engageJiangling` 不动 | 增量 |
| `shared/types/battlefield-instance.ts` | 扩展 `BattlefieldNodeState`（加 `rulerFactionId`/`garrisonArmyId`/`fortification`/`controlTurns`） | **需修改 P1 已提交类型**，但向后兼容（新字段 optional 或 default） |
| `shared/nanjun-battlefield.ts` | `generateNanjunBattlefield` 初始化 4 县（首批）的控制权字段（其余仍 null） | 增量，不动 16 县生成骨架 |
| `shared/battlefield-instance-schema.ts` | Zod 扩展校验新字段 | 同步类型扩展 |
| `server/src/services/game.ts` | 新增 `POST /api/game/battlefield/engage-county` 路径（或扩展现有 march） | 增量 |

**关键判断**：P2 不需要回头修改 P1 已提交的 `engageJiangling`（保留作为"攻打 seat"的桥接入口）；新增 `engageCounty` 作为"攻打属县"入口。`BattlefieldNodeState` 类型扩展采用**向后兼容**（新字段 `optional` 或带默认值），不破坏 P1 已通过的 JSON 往返单测。

### 2.6 四项攻占效果的老实标注（Session 177，2026-07-24）

> 本节是对 §2.4 四项攻占效果实现程度的**诚实分级**，纠正 Session 176 报告中"四项均 ✓ 通过"的统一化表述。验证报告（`verify-save-battlefield-instance.ts` 现 88/88 + Headless Chrome）验证的是**实际落地的机制**。第 1 条（补给线）由 BF-P5 补全真实路径判定、第 4 条（视野）由 BF-P5 Session 256 随郡域迷雾层完整落地——**四项攻占效果现全部为完整实现**，本节保留了历史分级过程供追溯。

#### 2.6.1 补给线切断 —— BF-P5 真实路径判定已落地（替换简化替代实现）

> **状态更新（BF-P5，2026-07-31）**：§2.6.1 原为"简化替代实现"，BF-P5 已通过
> `shared/army-county-mapping.ts` 建立 Army—郡域位置映射并落地真实路径判定，
> 替换掉"占领任意首批县 → 守方全军士气 -5"的全局简化。本节按当前状态重写。

| 维度 | 内容 |
|------|------|
| §2.4 设计原意 | 攻方占领县 → 守方 Army 若其补给线（从己方边界入口到 Army 当前节点的最短路径）**经过攻方控制县**，月度**粮耗 ×2**，士气 -5。核心是"**路径判定**"——只有补给线真的穿过占领县的 Army 才受罚。 |
| 实际落地（Session 176 简化替代） | `tickBattlefieldInstance` 实现：攻方占领**至少 1 个首批县** → 守方**全部 CampaignArmy** morale -5。是"**全局士气流失**"，不是"路径糧耗×2"。 |
| **实际落地（BF-P5，2026-07-31，替换上一条）** | 位置映射：`shared/army-county-mapping.ts` 新增 `resolveArmyCountyNodeId`（`nodeStates[].armyIds` 权威来源 + `dynamicSituation.deployments` 回退）、`shortestCountyPath`（沿 `adjacentNodeIds` 无向图 BFS）、`isCountyPathBlockedBy`（路径上非入口节点被攻方控制即切断）、`monthlyArmyFoodCost`（0-A 复用行军公式）。生成侧：`generateCommanderyBattlefield` 把创建时 deployments 写入 `nodeStates[].armyIds`（BF-P3 确定性序列不变，RNG 零消费）。判定侧：`tickBattlefieldInstance` 逐支守方 Army 定位 countyId，补给线 = seat（守方边界入口）→ Army 当前县最短路径，路径经过攻方控制县 → 该 Army **粮耗×2 + 士气-5**；未定位在郡域内的守方 Army 不受影响。 |
| 简化原因（BF-P5 已消除） | `CampaignArmy` 在大地图层移动，位置用数字 `cityId` 表示；郡域县节点用字符串 `countyId` 表示。两者此前**无位置映射**——无法判断某个 Army 的补给线是否"经过"某个占领县。BF-P5 通过 `nodeStates[].armyIds` 位置映射消除该前置依赖。 |
| 0-A 边界（诚实标注） | 真实游戏流程中守方 Army 尚未纳入郡域定位（`enterNanjunBattlefield` 只收集攻方 Army；守方 Army 留在 Tier I 大地图层），因此补给定位于**测试构造场景**中完整验证：`verify-save-battlefield-instance.ts` f6（守方 Army 部署州陵，补给线 江陵→华容→州陵 经攻方控制的华容 → 粮耗×2 + 士气-5）与 f6b 对照（部署夷道，路径不经过占领县 → 不受罚）。守方 Army 进入郡域场景由 **R6（S15 多线 AI，见 `docs/23-design-consistency-remediation.md` §三）** 排期。 |
| 验证脚本对应 | `verify-save-battlefield-instance.ts` f6/f6b：真实路径判定断言（morale -5 + 粮耗×2 折算 + 仅守方受罚 + 对照不受罚），共享层单测见 `shared/army-county-mapping.test.ts`（BFS 路径/补给线判定/粮耗折算，218 passed 包含本模块）。 |

#### 2.6.2 视野扩张 —— ✅ 完整实现（BF-P5 郡域迷雾落地，2026-07-31）

| 维度 | 内容 |
|------|------|
| §2.4 设计原意 | 占领县后该县及邻接路线视野对攻方透明，复用 S06 `maskGameStateForPlayer` 在郡域战场层加一层 mask，揭示原本被遮蔽的敌方 Army。核心是"**揭示**"——原本看不见的东西，占领后能看见。 |
| 实际落地（Session 256，BF-P5） | 郡域迷雾层已下沉到 `BattlefieldInstance`（`shared/commandery-fog.ts` 纯函数 + `shared/mask-state.ts` 集成）。**地理层恒可见**（县名/位置/路线/郡治/入口），**军情层**（驻军/城防/驻守 Army/部署）按揭示集遮蔽。揭示集 = 入口县 ∪ 郡治 ∪ 攻方 Army 所在县 ∪ 攻方已占领县 ∪ **守方 Army 所在县（R6，Session 258）**（每源 + 一跳邻接）。**占领某县后其 `rulerFactionId` 变为攻方 → 成为揭示源 → 邻接县破雾**，正是"视野扩张"动作本身。验证：占华容前迷雾 7 县（含州陵），占后 6 县，州陵/当阳/枝江揭示可见（`verify-save-battlefield-instance.ts` f8 14 条 + 真实 API + Headless Chrome）。详见 `docs/21-battlefield-scene-design.md` §5.2.1。 |
| 实现方式 | `maskBattlefieldInstanceForPlayer` 为**mask 投影专属**：`foggedNodeIds` 由 `maskGameStateForPlayer` 填充，**不写入存档**（Zod optional 旧档兼容）；服务端真源永不携带。零 RNG 纯函数。 |
| 验证 | ① shared `commandery-fog.test.ts` 10/10；② `verify-save-battlefield-instance.ts` f8 14 条 + f9 守方 Army 入郡域 11 条 + **f10 县级主动 AI 14 条（Session 259）→ 88/88** 全过；③ 真实 API：`/battlefield-instance/enter` 返回 7 fogged → `/battlefield-instance/engage-county`(华容) → 6 fogged 且州陵揭示、华容占领驻 858；④ Headless Chrome：进场 7 `?` → dispatchEvent 点华容 → 州陵 `?` 消失、华容"驻738"、巫仍迷雾、consoleErrors=0。 |

##### 2.6.2.1 边界与留待

- 迷雾只覆盖**军情层**，地理层恒可见（可点攻打破雾），符合 §5.2.1 已批准方案；
- 守方 Army 进入郡域场景后的揭示归属 —— ✅ 已解决（R6，Session 258）：`enterNanjunBattlefield` 自动纳入郡治驻留守方 Army（部署到守方纵深前沿县），其所在县并入揭示源（`computeRevealedNodeIds` 第 5 条）；mask 投影保留其 `armyIds`（玩家可见驻军），`deployments` 快照仍不泄露守方部署历史。详见 `docs/23-design-consistency-remediation.md` §三 R6；
- 全郡（第二郡颍川等）迷雾沿用同一 `commandery-fog.ts`，无南郡硬编码。

#### 2.6.3 驻军消耗压力 + 战场推进节点 —— 完整实现（对比说明）

- **驻军消耗压力（第 2 条）**：✅ 完整实现。占领后 `garrison>0` 保留控制、`garrison==0` 月度 tick 掉控制（`rulerFactionId=null`）、`controlTurns` 累计——与 §2.4 设计原意一致。验证：`verify-save-battlefield-instance.ts` f7a/f7b。
- **战场推进节点（第 3 条）**：✅ 完整实现。县攻打复用 `runAutoBattle` 自动结算、不同入侵入口→不同首攻县、县作为江陵外围防线——与 §2.4 设计原意一致。验证：`verify-save-battlefield-instance.ts` f2/f4 + Headless Chrome 完整点击流。

**对比要点**：四项攻占效果现**全部为完整实现**。第 1 条补给线路径判定由 BF-P5 于 Session 254 补全（§2.6.1），第 4 条视野扩张由 BF-P5 于 Session 256 随郡域迷雾层完整落地（§2.6.2）。**不要把四项的实现时间混为一谈，但实现程度已一致。** 验证报告 88/88 全过指的是这四项各自实际落地的机制都按预期跑通；守方 Army 入郡域场景（含揭示归属）已于 Session 258（R6 范畴）落地，其所在县并入揭示源、补给线真实判定在真实流程触发；守方 Army 主动行动与玩家交战闭环已于 Session 259（§2.6.4）落地。

#### 2.6.4 县级主动 AI —— R6 后续 · S15 深化（Session 259，2026-08-01）

> 范围经用户拍板（2026-08-01）：**B 标准闭环**——守方 Army 可被玩家攻打（参战/兵力回填/溃退）+ 月度主动行动（向失地移动/收复失地/补给线断时撤退或回撤）；**不含**大地图 AI 向郡域增援（选项 C 后置）。
> 设计真源：`docs/12-system-map.md` S15 行 + 本节 + `docs/23-design-consistency-remediation.md` §三 R6。

| 维度 | 内容 |
|------|------|
| 背景缺口 | Session 258 之后守方 Army 已能入郡域（部署到守方纵深前沿县），但：① `engageCounty` 只打驻军（`garrison`），**无视** `nodeStates[].armyIds` 中的守方 Army——玩家看得见驻军却打不着，形成"鬼影"；② `tickBattlefieldInstance` 中守方 Army 只被动扣粮/士气，**无任何主动行为**。两项即本小节闭环目标。 |
| 交战闭环（玩家攻打） | `engageCounty` 攻打含守方 Army 的县时：**合成守军**——取兵力最大一支守方 Army 为 `defArmy` 参与 `runAutoBattle`（克隆副本 `troops = 守方总兵力 = Σ守方 Army.troops + 县 garrison`，不改动真身）；`AutoBattleResult.defenderRemaining/defenderMoraleAfter` 按比例回填各守方 Army 与县 garrison。玩家胜 → 守方 Army **溃退**：seat 未被攻方占 → 移驻 seat 县；已被占 → **撤出郡域**（`nodeStates[].armyIds` 与 `dynamicSituation.deployments` 同步移除，`currentNodeId` 本就是郡治大地图城市 id，无需改动）。玩家败 → 守方 Army 留原县，兵力/士气按回填更新。 |
| 月度主动行动 | `shared/commandery-defender-ai.ts` 纯函数 `decideDefenderArmyAction(inst, army, ctx, rng)`，逐支守方 Army 在 `tickBattlefieldInstance` 内（补给线惩罚结算后）执行，优先级：① **所在县被攻方占领** → 兵力优势（`troops ≥ garrison×1.2`）且经 RNG 判定（60%~100% 概率）→ **收复**（`rulerFactionId` 夺回为守方、驻军并入）；劣势或判定失败 → **撤退**。② **补给线被切断** → 士气 <60 → 撤退；否则向 seat 移动一格（最短路径首步；该步被攻方占则不移动，避免走进敌占县）。③ 存在攻方占领县 → 向**最近攻方占领县**移动一格（BFS 最短路径首步）。④ 否则原地驻守。 |
| 位置一致性 | 守方 Army 在郡域内的移动/收复/撤退均**同步更新** `nodeStates[].armyIds`（运行时权威表）与 `dynamicSituation.deployments`（回退表），避免 `resolveArmyCountyNodeId` 经 deployments 回退把已撤出/已移动的 Army 拉回旧位置。 |
| RNG 权威链 | 行动决策消费**权威 PRNG**（`runtimeRandom`，xorshift32-v1 信封）；`tickBattlefieldInstance` 签名由 `(state)` 改为 `(state, rng)`，`advanceTurn` 链路透传。**无守方 Army / 无可行动 / 无攻方占领县时 RNG 零新增消费**（f1~f9、verify-bf-p3-dynamic 13/13 确定性不变）。默认参数**不**用 `Math.random()`（铁律）。 |
| 结算顺序 | 驻军消耗（既有）→ 补给线惩罚（既有，f6/f9 断言优先结算）→ 守方行动（新增）。补给线被切断且士气正常（≥60）时守方 Army 只移动不撤退，保证 f6/f6b/f9 既有断言（morale/food 数值）不受行动影响。 |
| 验证 | ① shared 单测 `commandery-defender-ai.test.ts`（决策规则/RNG 消费/位置一致性）；② `verify-save-battlefield-instance.ts` **f10** 真实流程：玩家占 2 县 → tick 断言守方行动（向最近攻方县移动/补给线断撤退语义）；玩家 `engageCounty` 守方 Army 所在县 → 参战 + 溃退去向断言。 |
| 0-A 边界（诚实标注） | 大地图 AI 向郡域**增援**（选项 C）后置；守方 Army 移动不产生大地图 CampaignArmy 行军（郡域内移动仅改位置表）；「截断玩家补给线」无对应概念（攻方 Army 在大地图层，郡域内玩家无补给线），守方移动目标为最近攻方占领县形成围攻态势。 |

##### 2.6.4.1 大地图 AI 向郡域增援 —— ✅ 已落地（选项 C，Session 260，2026-08-01）

| 维度 | 内容 |
|------|------|
| 设计 | 县级主动 AI 落地后守方 Army 会在郡域内行动/撤退，但郡域守军得不到补充。增援管线 = 大地图 AI（`runAiMilitary`）月度决策 → 从郡治大地图城市编成新 Army → 直接入场部署到守方纵深前沿县（不走大地图行军）。 |
| 决策（`aiMilitary.ts` `maybeReinforceCommandery`，置于常规出征**之前**，守土优先） | 条件链任一不满足即返回原 state（**RNG 零消费**，保持既有 AI 军事流确定性）：① 郡域战场 active 且该 AI 势力为守方（`seat.rulerFactionId`）；② 郡域内守方 Army 数 < `maxReinforceArmies`（2）；③ 模板可解析且郡治大地图城市仍属该势力；④ 郡治城可调兵力（troops − 动态守备 `requiredReserve`）≥ `minReinforceTroops`（1000）；⑤ `decisionRng()` < 增援概率（基础 0.3 + 攻方每占 1 县 +0.1，上限 0.7）。 |
| 编成与入场 | 复用 `startCampaignForFaction` 新增 flags `{ skipTargetValidation, phase: 'garrison' }`（`validateFormation` 拆分为源侧/目标侧，完整校验顺序与历史一致；增援军 `targetNodeId` 无意义故跳过目标侧校验）——新 Army `phase='garrison'`、`path=[]`，**不走 `tickCampaignMarch`**；部署到 `defenderEntryNodeIds` 中首个未被攻方占领的县（全被占则 seat），`inst.armyIds`/`nodeStates[].armyIds`/`deployments` 三方同步；郡治城兵力/粮草扣减、武将 IN_BATTLE。增援军 `phase='garrison'` 不占双线名额（`activeFronts` 计算排除）。 |
| 验证 | `verify-save-battlefield-instance.ts` **f11** 13 条（88→**101/101**）：f11a 触发增援（新 Army/armyIds/部署州陵或夷道/deployments 同步/城兵扣减/日志）、f11b 判定失败零变更（同引用）、f11c 占县提升概率触发（0.35<0.4）、f11d 上限 2 不再增援、f11e `runAiMilitary` 端到端。全量回归：verify-campaign 71/71（编成校验顺序保持）、verify-ai-military-rng 38/38 确定性不变、bf-p3 13/13、shared 256/256、client 36/36。 |
| 0-A 边界（诚实标注） | 增援仅从郡治大地图城市编成（不跨城征调）；增援概率为启发式常数（未接军师/谋略系统加成）；郡域场景关闭后增援军滞留郡治城为 `phase='garrison'` 驻军（既有驻守语义）。 |

---

## 三、存档接入（`BattlefieldInstance` → `GameState`）

> **状态：Q10 已实施（Session 174，2026-07-24）** — 方案 A 无损追加已落地，`verify-save-battlefield-instance.ts` 27/27 全过；详见 `docs/10-progress.md` Session 174 条目。

### 3.1 现状

P1 §10.4 自承"BattlefieldInstance 接入 GameState schema（进行中战场进存档；现有 activeBattlefield/activeMelee/activeBattles 已覆盖大地图层）"留待 P2。当前：

- `BattlefieldInstance` 类型 + Zod + JSON 往返单测已落地（`shared/battlefield-instance-schema.ts`）；
- **未接入** `GameState` schema；
- P1 故意不接以保护 CampaignArmy 62/62 测试。

### 3.2 三种接入方案对比

| # | 方案 | 描述 | 优点 | 缺点 |
|:-:|------|------|------|------|
| A | **无损追加（推荐）** | `GameState` 新增可选字段 `activeBattlefieldInstance?: BattlefieldInstance \| null`；保留 `activeBattlefield: BattlefieldMap \| null` 不动 | 旧存档（无此字段）直接兼容；不需 schema 版本迁移；不破坏 62/62 | GameState 类型变长；需明确两字段并存时的优先级 |
| B | 替换 `activeBattlefield` | 把 `BattlefieldMap` 字段替换为 `BattlefieldInstance` 联合类型 | 类型清晰，单字段 | **破坏 62/62** + 19 个 BattlefieldMap 调用点；需要 v2 schema 迁移器 |
| C | 共存双字段 | 新旧两字段并存，按 `phase`/`scene` 判断使用哪个 | 零迁移成本 | 两个 battlefield 字段同时存在，语义模糊，长期累积技术债 |

### 3.3 推荐方案 A：无损追加

**理由**：

1. **沿用 PRNG 存档信封 v1 的处理经验**：之前接入 `xorshift32-v1` 时，schema 仍是 v1，通过"可选字段无损追加"接入，未做版本升级。本次同模式：新字段 optional + Zod 严格校验类型，旧存档加载时该字段为 `undefined`，游戏正常运行（玩家未进入南郡战场）。
2. **不破坏 62/62**：CampaignArmy 测试不依赖 `activeBattlefieldInstance` 字段；该字段 optional 后，旧测试无需修改。
3. **不需要 schema 版本迁移**：保持 `CURRENT_SAVE_SCHEMA_VERSION = 1`，无 v2 迁移器成本。
4. **类型清晰**：通过 Zod 严格校验新字段类型（不 optional 校验，类型 optional 但有值时必须合规），避免新存档格式漂移。
5. **可清晰回退**：若 P2 实施后发现设计问题，只需移除新字段，不影响现有 Tier I 大地图层存档。

### 3.4 设计契约（P2 实施时落地，本轮不动）

```typescript
// shared/types/game.ts - GameState 扩展（仅设计，不立即落地）
interface GameState {
  // ... 既有字段
  activeBattlefield: BattlefieldMap | null;              // 既有，Tier I 大地图层（不动）
  activeBattlefieldInstance?: BattlefieldInstance | null; // 新增，Tier II 郡域历史战场（可选）
}

// shared/game-state-full-schema.ts - Zod 扩展
const GameStateSchema = z.object({
  // ... 既有字段
  activeBattlefield: BattlefieldMapSchema.nullable(),
  activeBattlefieldInstance: BattlefieldInstanceSchema.nullable().optional(),
});
```

**字段并存时的优先级**（P2 实施时明确）：

- 玩家进入南郡战场 → 写 `activeBattlefieldInstance`，`activeBattlefield` 保持 null；
- 玩家退出南郡战场 → `activeBattlefieldInstance` 清 null；
- 两者不同时非 null（场景栈强制互斥）；
- 读档时优先读 `activeBattlefieldInstance`，若非 null 则恢复 BattlefieldSceneView。

### 3.5 确定性测试要求（沿用既有"存档→读档→序列一致"模式）

P2 实施时必须新增以下验证脚本，沿用 `verify-save-*` 系列模式：

| 脚本 | 断言 | 沿用先例 |
|------|------|----------|
| `verify-save-battlefield-instance.ts` | (1) 进入南郡战场 → 保存 → 读档 → 序列一致；(2) 占领县 → 保存 → 读档 → `BattlefieldNodeState.rulerFactionId` 一致；(3) 退出战场 → 保存 → 读档 → `activeBattlefieldInstance` 为 null | `verify-save-campaign.ts`（9 项） |
| 扩展 `verify-save-game-state.ts` | GameState 全字段交叉引用校验包含 `activeBattlefieldInstance`（当非 null 时） | 既有 10 项 |

**测试覆盖率要求**（沿用 PRNG 信封 v1 的"存档→读档→序列一致"验证模式）：

1. **空场进入**：玩家未进入南郡战场 → 存档 → 读档 → `activeBattlefieldInstance` 为 undefined/null → 游戏正常继续；
2. **进行中场存档**：进入南郡战场 + 围攻江陵中场 → 存档 → 读档 → `BattlefieldInstance` 全字段（`nodeStates`/`routeStates`/`armyIds`/`encounters`/`turn`/`phase`）序列一致；
3. **战争结束清档**：战争结算后 → 存档 → 读档 → `activeBattlefieldInstance` 为 null（结算已写回 `cityControlChanges`）；
4. **跨存档版本兼容**：旧存档（无 `activeBattlefieldInstance` 字段）→ 读档 → 该字段为 undefined → 不报错；
5. **Zod 严格校验**：构造非法 `activeBattlefieldInstance`（如 `nodeStates` 中 county id 重复）→ Zod 拒绝。

### 3.6 对 P1 已提交代码的改动风险

**风险等级：MEDIUM-LOW（增量扩展，向后兼容）**

| P1 已提交文件 | 改动 | 风险 |
|---------------|------|------|
| `shared/types/game.ts` | `GameState` 加 optional 字段 | 向后兼容，旧测试不受影响 |
| `shared/game-state-full-schema.ts` | Zod 加 `.nullable().optional()` | 同步类型扩展 |
| `shared/types/battlefield-instance.ts` | 配合 §2.4 扩展 `BattlefieldNodeState` | 向后兼容 |
| `shared/battlefield-instance-schema.ts` | Zod 扩展校验新字段 | 同步类型扩展 |
| `server/src/services/game.ts` | 进入/退出战场时写/清 `activeBattlefieldInstance` | 增量 |
| `server/src/scripts/verify-save-game-state.ts` | 扩展 10 项交叉引用覆盖新字段 | 增量 |
| 新增 `server/src/scripts/verify-save-battlefield-instance.ts` | 新脚本 | 沿用既有模式 |

**关键判断**：方案 A 是真正的"无损追加"，不破坏 P1 任何已通过的测试。CampaignArmy 62/62、save-diplomacy 11/11、save-game-state 10/10 等既有验证不受影响。

---

## 四、`BattlefieldInstance` 与 `BattlefieldMap` 归并判断

> **状态：Q11 已落地（Session 174，2026-07-24）** — 方案 C 保持独立已批准并文档化；结论同步至 `docs/02-architecture.md` §独立郡域战场数据流、`docs/03-data-models.md` §二十三、`docs/12-system-map.md` S02/S10/S16 系统条目。两类型并行不冗余，后续维护者不应误判为临时过渡态而尝试强行合并。

### 4.1 当前使用状态审计（基于 codegraph 全仓扫描）

| 类型 | 调用点数 | 主要调用方 | 使用状态 |
|------|:--------:|------------|----------|
| `BattlefieldMap` | **19** | `client/services/api.ts`、`server/engine/battlefield.ts`、`server/services/game.ts`、`shared/game-state-battle-schema.ts`、`client/stores/gameStore.ts`、`client/components/battlefield/BattlefieldPanel.tsx` 等 | **活跃**，承担 Tier I 大地图层（30 城邻接切片战场） |
| `BattlefieldPanel` | 1 | `client/src/App.tsx` | **活跃**，Tier I 大地图战场 UI 入口 |
| `BattlefieldInstance` | 6 | `shared/battlefield-instance-schema.ts`、`shared/nanjun-battlefield.ts`、`client/stores/gameStore.ts`、`client/components/battlefield/BattlefieldSceneView.tsx` 等 | **新增**，Tier II 郡域历史战场 |
| `BattlefieldSceneView` | 1 | `client/src/App.tsx` | **新增**，Tier II 郡域战场 UI 入口 |

### 4.2 三种归并选项

| # | 选项 | 描述 | 评估 |
|:-:|------|------|------|
| A | **合并为单一类型** | 把 `BattlefieldMap` 与 `BattlefieldInstance` 合并为一个联合类型 | ❌ **不可行**：P1 §10.5 第 2 条已自承"数据不兼容（县节点字符串 id vs 大地图数字 id）"。强行合并会破坏 19 个 BattlefieldMap 调用点 + 62/62 测试。 |
| B | **废弃 `BattlefieldMap`** | 用 `BattlefieldInstance` 完全替代 `BattlefieldMap` | ❌ **不可行**：`BattlefieldMap` 仍活跃使用，承担 Tier I 大地图层职责（30 城邻接切片战场），与新 `BattlefieldInstance`（郡域历史地理场景）服务不同功能。废弃会破坏现有出征→邻接城→白刃/六角流程。 |
| C | **保持独立，明确职责分离** | 两类型并存，文档明确职责边界，未来通过引用做一致性校验 | ✅ **推荐** |

### 4.3 推荐方案 C：保持独立，明确职责分离

**职责分离契约**（文档明确，代码不动）：

| 类型 | 层级 | 数据源 | 服务功能 | ID 体系 |
|------|:----:|--------|----------|---------|
| `BattlefieldMap` | Tier I | 30 城大地图邻接切片（`extractBattlefieldNodes`） | 出征→邻接城→白刃/六角（自动/标准/六角三模式） | 数字 cityId（如 14） |
| `BattlefieldInstance` | Tier II | 郡治+属县+水系+关隘（历史地理模板派生） | 进入郡域战场→县间行军→县攻打/围城→战争结算 | 字符串 countyId（如 `nanjun_jiangling`） |

**未来交互**（不强制实装，仅明确边界）：

- **大地图 ↔ 郡域数据一致性校验**：`BattlefieldInstance.targetCommanderyId` 可引用对应 `City.adminName`（如江陵 → 南郡）做校验，防止大地图节点 id 与郡域模板 id 漂移；
- **跨层引用**：`BattlefieldInstance.entryNodeIds` 可引用大地图邻接城（如襄阳北部入口对应 `worldCityId=21`），保证跨层切换时身份一致；
- **场景栈互斥**：玩家不可同时进入 Tier I 大地图战场与 Tier II 郡域战场（场景栈强制单战场实例），避免两类型字段同时非 null。

### 4.4 旧 `BattlefieldMap`/`BattlefieldPanel` 标记策略

**不立即标记废弃**：

- `BattlefieldMap`/`BattlefieldPanel` 仍是 Tier I 大地图层权威实现，没有替代品；
- `BattlefieldSceneView`（P1 新增）服务 Tier II 郡域层，两者职责互补；
- 仅在 P5/P6 阶段（全郡 105 模板覆盖 + 大地图节点升格）评估是否合并入口 UI。

**文档明确**（更新 `docs/02-architecture.md` 与 `docs/07-ui-design.md`）：

- Tier I 与 Tier II 并存是设计决策，不是技术债；
- `BattlefieldMap`/`BattlefieldPanel` 不是"旧实现待废弃"，而是"服务不同层级的并行实现"；
- 后续维护者不应误判为冗余代码而清理。

### 4.5 对 P1 已提交代码的改动风险

**风险等级：ZERO（保持现状，仅文档明确）**

| P1 已提交文件 | 改动 | 风险 |
|---------------|------|------|
| 0（代码层无改动） | 仅 `docs/02-architecture.md`、`docs/07-ui-design.md`、`docs/21-battlefield-scene-design.md` §10.5 第 2 条补充职责分离说明 | 零代码风险 |

---

## 五、对 P3（AI 决策整场复现）的影响评估

### 5.1 P3 边界回顾

Q8 路线明确 P3 范围："把战场 AI 行动选择也收口到权威 RNG，从'结算确定'提升为'整场复现'"。当前 S15 AI 决策粒度：

- **军事决策**：对郡治发起围城（单线进攻军限制是 0-A 安全阀）；
- **战场决策**：自动战斗算法 `runAutoBattle` 已接入权威 RNG（既有 7/7 验证通过）；
- **AI 攻县**：当前不存在此决策类型。

### 5.2 P2 引入县攻打后 AI 的角色

| 决策类型 | P2 后短期 | P3 后 | P5/R6 后 |
|----------|-----------|-------|----------|
| AI 攻打郡治 | 既有（围城） | RNG 收口到权威 | 多线化 |
| **AI 攻打县** | **不引入**（玩家主导） | 不引入 | 引入（多线 AI 范畴） |
| AI 守县（被动响应） | 既有守军机制（沿用 `runAutoBattle`） | RNG 收口 | 不变 |
| AI 撤围 | 后置 | 后置 | 引入（撤围外交响应） |

### 5.3 P2 不会提前牵动 P3 范围

**判断**：

1. P2 引入"玩家可攻打县 + AI 守县"逻辑，但**不引入新 AI 决策类型**——AI 攻县是新增决策类型，属 P5/R6（S15 多线 AI 与公平难度，见 `docs/23-design-consistency-remediation.md` §三 R6）范畴，不属于 P3。
2. P2 的县级攻打仍走 S10 `createBattle`（复用既有路径）+ `BattlefieldInstance.Encounter` 结构，RNG 消费点不变（仍是六角战斗+自动结算），与 P3 的"整场复现"目标不冲突。
3. P3 范围明确不变：仍是 RNG 收口，针对 AI 已有决策（出征/围城/自动战斗）。

### 5.4 对 P3 的依赖关系声明

虽然 P3 不因 P2 变更范围，但 P2 实施时需明确**未来 P3 的接入点**：

- P2 实施时，`engageCounty` 入口需保留 RNG 注入接口（沿用 `runtimeRandom`），不引入 `Math.random()`；
- `BattlefieldNodeState` 控制权写入必须是确定性纯函数（输入相同 → 输出相同）；
- P2 验证脚本（`verify-save-battlefield-instance.ts`）必须沿用 PRNG 信封 v1 模式，固定 seed 测试占县结果可复现；
- P3 实施时只需扩展验证脚本到"AI 守县决策 RNG 收口"，不需回头改 P2 的字段结构。

### 5.5 对 P1 已提交代码的改动风险

**风险等级：ZERO（纯依赖关系声明，无代码改动）**

P2 不引入新 AI 决策类型；P3 范围不变；P2 实施时遵循的 RNG 边界是既有约束（已写入 `docs/21-battlefield-scene-design.md` §九），不是新约束。

---

## 六、开放问题清单（Q9~Q12，待用户拍板）

以下问题沿用 BF-P0/P1 Q1~Q8 模式，每条标注对 P0/P1 现有实现的改动风险。

### Q9：县级攻打实现范围（首批县选择）

**问题**

- **A．推荐：首批选 3 个战术要点县验证**（当阳/华容/枝江 + 江陵 seat = 4 县可攻打节点）。
- B．全部 15 县一次性做，覆盖最广但违反 0-A"先小后大"原则。
- C．只做 1 个县（如当阳）验证最小闭环，但样本不足暴露拓扑差异。
- D．先做 2 县（当阳+华容）做"水陆双入口"验证，再扩。

**推荐方案**

推荐 **A：首批 3 县**。

**理由**

3 县 + 江陵足以验证玩法价值 1+2+3+4 全部（补给线/驻军/推进/视野），又留有 P3/P4 扩展空间。1 县样本不足以暴露不同入侵入口的拓扑差异；15 县一次铺完会同时引发 15 套攻打入口与驻军逻辑，违反"一次主攻一个切片"。

**对 P0/P1 现有实现的改动风险**

- **P0（数据/Schema 契约）**：零改动。16 县数据已落地，P2 只是让其中 3 县承载控制权字段。
- **P1（最小闭环）**：HIGH（架构增量但非破坏）。`BattlefieldNodeState` 类型扩展（向后兼容 optional 字段）；`engageCounty` 新增 action；`BattlefieldSceneView` 加县节点可点击。**不需要回头改 `engageJiangling`**。

### Q10：存档接入方案（A/B/C 三选一）

**问题**

- **A．推荐：无损追加 `activeBattlefieldInstance?: BattlefieldInstance | null`，保留 `activeBattlefield` 不动**（沿用 PRNG 信封 v1 经验，不升 schema 版本）。
- B．替换 `activeBattlefield` 为 `BattlefieldInstance` 联合类型（需 v2 schema 迁移器，破坏 62/62）。
- C．共存双字段，按 phase/scene 判断使用（语义模糊，长期技术债）。

**推荐方案**

推荐 **A：无损追加**。

**理由**

方案 A 是真正的"无损"，沿用既有 PRNG 信封 v1 处理经验，不破坏 CampaignArmy 62/62 与既有 `verify-save-*` 系列。旧存档（无新字段）直接兼容，新存档通过 Zod 严格校验类型，无需 schema 版本迁移。

**对 P0/P1 现有实现的改动风险**

- **P0**：零改动（南郡 Zod 已含 `BattlefieldInstance`）。
- **P1**：MEDIUM-LOW（GameState 加 optional 字段，向后兼容；新增 `verify-save-battlefield-instance.ts` 验证脚本，沿用既有模式）。

### Q11：`BattlefieldMap` 与 `BattlefieldInstance` 归并策略

**问题**

- A．合并为单一联合类型（P1 §10.5 第 2 条已自承数据不兼容，不可行）。
- B．废弃 `BattlefieldMap`，用 `BattlefieldInstance` 替代（破坏 19 个调用点 + 62/62，不可行）。
- **C．推荐：保持独立，明确职责分离，文档标注两者并行不冗余**。

**推荐方案**

推荐 **C：保持独立，明确职责分离**。

**理由**

两类型服务不同层级（Tier I 大地图邻接切片 vs Tier II 郡域历史地理），数据源、ID 体系、调用方均不同；废弃或合并都会破坏大量既有调用点。文档明确职责边界后，后续维护者不会误判为冗余代码。

**对 P0/P1 现有实现的改动风险**

- **P0/P1**：ZERO（仅文档更新，代码层无改动）。

### Q12：AI 县级攻打决策何时引入

**问题**

- **A．推荐：P2 不引入 AI 主动攻县；AI 县级攻打属 P5/R6（S15 多线 AI 与公平难度）范畴，不属于 P3**。
- B．P2 同步引入 AI 主动攻县，但会扩大 P2 验收面并提前牵动 P3 范围。
- C．P3 引入 AI 主动攻县，但 P3 边界已明确为"AI 已有决策 RNG 收口"，新增决策类型超出范围。

**推荐方案**

推荐 **A：P2 不引入 AI 主动攻县；明确属 P5/R6**。

**理由**

P3 范围明确为"AI 已有决策 RNG 收口"，新增"AI 攻县"决策类型超出此范围。P2 引入县攻打只需玩家可攻县 + AI 守县（被动响应，沿用既有 `runAutoBattle`）；AI 主动攻县属 P5/R6（S15 多线 AI）范畴，与 P3 解耦。

**对 P0/P1 现有实现的改动风险**

- **P0/P1**：ZERO（纯依赖关系声明，无代码改动）。

---

## 七、对 P1 已提交代码的改动风险总结

| Q | 风险等级 | 改动文件 | 破坏性 |
|:-:|:--------:|----------|:------:|
| Q9（县级攻打范围） | HIGH | `BattlefieldNodeState` 类型扩展、`engageCounty` 新增、`BattlefieldSceneView` 加可点击 | 非破坏（增量，向后兼容） |
| Q10（存档接入） | MEDIUM-LOW | `GameState` 加 optional 字段、Zod 扩展、新增验证脚本 | 非破坏（无损追加） |
| Q11（类型归并） | ZERO | 仅文档（`02-architecture`/`07-ui`/`21-battlefield-scene-design`） | 无 |
| Q12（AI 攻县时机） | ZERO | 仅依赖关系声明 | 无 |

**总体判断**：

- Q11/Q12 是纯文档与依赖声明，零代码风险；
- Q10 是无损追加，向后兼容，不破坏既有测试；
- Q9 是 HIGH 风险但非破坏性增量，新字段 optional + 新增 action，不需要回头改 P1 已通过的 `engageJiangling`。

**Q9 的关键护栏**（P2 实施时必须遵守）：

1. `engageJiangling` 保留不动，`engageCounty(countyId)` 作为新入口；
2. `BattlefieldNodeState` 新字段（`rulerFactionId`/`garrisonArmyId`/`fortification`/`controlTurns`）全部 optional 或带默认值；
3. `BattlefieldSceneView` 加县节点可点击时，保留现有江陵 seat 高亮逻辑；
4. 首批 3 县（当阳/华容/枝江）控制权初始为 `null`（中立/无主），玩家可攻打；其余 12 县保持纯静态展示，controlFactionId 字段为 `undefined`（与 null 区分：undefined 表示"该县不参与县级玩法"，null 表示"参与但当前无控制方"）。

---

## 八、实施建议（依赖顺序，仅设计不执行）

P2 实施时建议按以下依赖顺序分阶段落地（本轮不执行）：

1. **第一优先**：Q10（存档接入）—— 解决 P1 故意搁置的最大架构债，使进行中场可存档；
2. **第二优先**：Q11（类型归并文档化）—— 零代码风险，先明确职责分离，避免后续维护者误判；
3. **第三优先**：Q12（AI 攻县依赖声明）—— 同步更新 `docs/23-design-consistency-remediation.md` R6 范围说明；
4. **第四优先**：Q9（县级攻打首批 3 县）—— HIGH 风险但非破坏性，最后落地以利用前 3 项的稳定基础。

每项实施时遵守：

- 完成即文档（更新 `docs/10-progress.md` + `HANDOFF.md` + 相关设计文档）；
- 自验证（运行 `verify-save-battlefield-instance.ts` + 既有 `verify-save-*` 系列 + CampaignArmy 62/62 + BF-P0 schema 38/38 + shared 全量）；
- 不引入 `Math.random()`；
- 不破坏 P1 已通过的 Headless Chrome 闭环实测（`enterNanjunBattlefield` → `engageJiangling` → `exitBattle` → `popToScene('world')`）。

---

## 九、本轮设计阶段产出清单

本文档（`docs/25-bf-p2-design.md`）作为 BF-P2 设计阶段产出，包含：

1. **Q6 深化**：县级攻打玩法价值分析 + 首批 3 县推荐 + 攻占效果契约草案；
2. **存档接入**：A/B/C 三方案对比 + 推荐 A（无损追加）+ 确定性测试要求；
3. **类型归并判断**：A/B/C 三选项对比 + 推荐 C（保持独立）+ 职责分离契约；
4. **P3 影响评估**：明确 P2 不引入 AI 主动攻县，P3 范围不变；
5. **开放问题清单 Q9~Q12**：每条标注对 P0/P1 现有实现的改动风险；
6. **实施建议**：依赖顺序（Q10 → Q11 → Q12 → Q9）+ 关键护栏。

**待用户拍板**：Q9/Q10/Q11/Q12 各项推荐方案是否批准？批准后按 §八依赖顺序排入 P2 实施任务。

---

*正式版 v1.0 | 2026-07-24 | BF-P2 设计阶段产出，待用户拍板*
