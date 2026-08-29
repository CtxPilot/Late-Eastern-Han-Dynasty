# 多军团与委任军团 · 实装设计规格（S15/S16 · Session 419）

> **状态**：v1.1——Session 419 规格落盘；Session 420 用户「继续」视为批准，**S1 切片已实装并全绿**（CRUD+军上限+UI，见 §八）；S2/S3 待后续会话。
> **来源**：`docs/40-game-evaluation.md` P3「军团层：先出多军团/委任设计规格再实装」；
> 委任玩法设计真源为 `docs/04-game-systems.md` §三十九（已批准的设计，本文件只做实装规格化，
> 不推翻 §39 的玩法条款，只做口径对齐与落地决策）。
> **不启动 0-B**：本系统在 0-A 数据规模（30 城/30 武将）下即可成立并产生可玩性收益。

---

## 一、范围界定：「多军团」一词的两义拆分

| 术语 | 含义 | 现状 | 本规格是否覆盖 |
|------|------|:----:|:----:|
| **战役层多军并线** | 同一势力同时维持多支 `CampaignArmy`（行军/围城/接战） | 引擎已支持（见 §2.1），缺势力级上限与 UI 提示 | ✅ 补上限（D1）与提示 |
| **委任军团** | 玩家将城池划区委任都督，AI 代管内政+自动出征（§39） | 设计完成、零实装（全库 0 引用） | ✅ 实装规格化 |
| **六角战场多军协同** | 多支军在同一场六角战斗中协同（增援入场等） | 未实装，S10 记「多军团仍后置」 | ❌ 另行切片，本规格不涉及 |

---

## 二、现状勘定（实勘证据，Session 419）

### 2.1 引擎已支持多军并线，无势力级上限

- `server/src/engine/campaign.ts:328` `startCampaignForFaction` 直接 `campaignArmies: [...state.campaignArmies, army]`（append，无任何势力级军数上限）。
- 唯一约束是**人**不是**军**：`campaign.ts:218-220`「主将已在其他战役 Army 中」（一将一军）；`campaign.ts:241-247` 单将带兵帽 `formationTroopCap`。
- 结论：玩家今天就能手动组建多支远征军；缺的是「养多少支」的规则与 UI 明示。

### 2.2 AI 军事面

- `server/src/engine/aiMilitary.ts:34` `maxActiveFronts: 2` 硬编码；`activeFronts` 计非 `garrison`/`retreating` 军（`aiMilitary.ts:367-370`）；郡域增援军 `phase='garrison'` 不占额（`aiMilitary.ts:206-208` 注释明确）。
- 目标评分链（Session 410）：孱弱 × 计谋/国策 × 富庶(≤1.25) × 城防 100/(100+墙×2) × 威胁响应(1.5/1.15)；危城按兵不动。
- 结论：AI 出征引擎是成熟复用件，委任军事 AI 按设计的「现有引擎 + 方针权重」路线接入（§39.8 S15 行）。

### 2.3 位置真源现状（评估负债 #5 的军团面）

军册成员身份**没有独立字段**，由三处共同表达：
1. `campaignArmies[].commanderId/subCommanderIds/advisorId/subAdvisorId` —— 事实真源（`validateFormationSourceRest`、`pickCommander` 都靠扫描此列表判重）；
2. `officer.location` 镜像（编成时写 `fromNodeId`，`campaign.ts:394-398`）；
3. `city.officers` 列表移除（`campaign.ts:400-403`）。
郡域战场另有第四、五处：`nodeStates[].armyIds` 与 `dynamicSituation.deployments` 手工双写（`aiMilitary.ts:296-312`）。
**本规格不重构**，只把不变量成文化（§9 R1~R4），多军并行下维持现状机制。

### 2.4 月结顺序（评估负债 #4）

`server/src/engine/turn.ts:222-439` 硬编码顺序（摘要）：
`城池经济/项目` → `runAllAiTurns`（AI 内政，**跳过玩家**，`ai.ts:129`）→ `syncFactionResources` → 谍报/计谋/国策 → `runAiMilitary` → 质任/跟随/叛逃/城派系/子女/大会/事件 → 季度/月度重置。
**委任插入点（D7）**：内政紧随 `runAllAiTurns` 之后；军事紧随 `runAiMilitary` 之后。只做「紧邻插入」，不做 tick 重排。

### 2.5 委任设计现状

- `docs/04-game-systems.md:4221-4501` §三十九：分区表/都督条件/官职爵位帽/四方针/AI 行为/权限表/报告/数据结构/实装路径全部成文。
- 运行时零实装：`grep DelegationRegion|delegationRegions`（shared/server/client）= **0 处**。

---

## 三、拍板点（每条给推荐默认值，批准或改判后成为真源）

### D1 军团上限（玩家与 AI 同规则）

```
maxFieldArmies(faction) = clamp(2 + floor(ownCityCount / 5), 2, 6)
```

- 10 城=4 军，15 城=5，≥20 城=6（0-A 30 城天花板封 6，避免后期刷军）。
- AI 侧：`AI_MILITARY_CONFIG.maxActiveFronts` 由静态 2 改为按上式派生（函数 `maxFieldArmiesFor(state, factionId)`），AI 与玩家同规则是既有传统（带兵帽 Session 265 先例）。
- `garrison`（郡域增援）与 `retreating` 军不占额（维持 `aiMilitary.ts:367-369` 现状口径）。
- 超上限时 `startCampaignForFaction` 抛错：`'出征军数已达上限（x/y）'`——与既有错误文案风格一致。
- **理由**：给「多线作战」一个可感知的成长曲线，同时防止 0-B 规模下军数失控拖垮月结。

### D2 都督官职映射（不新增官职枚举）

§39.3 的「太守/都督/大将军/丞相」映射到现有 `CivilPosition`/`MilitaryPosition`：

| §39.3 原文 | 现有枚举 | 管辖城数上限 |
|------|------|:----:|
| 太守 | `civilPosition = prefect` 或以上 | 1 |
| 都督 | `militaryPosition = general`，或 `civilPosition = governor` | 2~4 |
| 大将军 | `militaryPosition = grandGeneral` | 2~6 |
| 丞相 | `civilPosition = chancellor` | 2~8 |

- 取该武将两轨官职中**可管辖上限更高者**（文武任一达标即可，符合三轨官职并行语义）。
- 未达 prefect/general 者**不可**任都督（硬门禁）；跨档时按最高档计。

### D3 委任区数量上限（对齐现有 NobilityRank 七级）

§39.3 原表与现有 `NobilityRank`（`shared/enums/index.ts:290`）一一对应：

| 君主角爵位 | 基准区数 |
|------|:----:|
| `guanneiMarquis` | 1 |
| `tingMarquis` | 2 |
| `xiangMarquis` | 3 |
| `xianMarquis` | 4 |
| `duke` | 5 |
| `king` | 6 |
| `emperor` | 无上限（以城数封顶） |

```
总委任区上限 = 爵位基准 + floor(势力城池总数 / 5)   （§39.3 原公式）
```

### D4 都督资格

| 条件 | 语义 |
|------|------|
| 官职 | D2 映射（硬门禁） |
| 忠诚 ≥ 80 | 硬门禁（§39.2；低于 80 可被策反带区独立，留 0-B 深化，首版不做） |
| 统 ≥ 70 / 政 ≥ 50 | **非门禁**，进效率公式（§39.5 委任效率） |
| 唯一性 | 一将同时只任一个区的都督（硬门禁）；都督可同时身在军中出征吗？→ **允许**（都督被任命时若已从军不拆军，但该区军事 AI 在都督从军期间照常运行，见 D6 注） |
| 在职 | `status === ACTIVE` 且未在 `campaignArmies` 中担任任何职务（ appoint 时校验；任命后都督被俘/死亡 → 区自动解散，城池回归直辖，actionLog 记录） |

### D5 方针（§39.4 原样落地）

四档 `development / armament / balanced / offensive`；切换**每季一次、下季生效**（与总军师切换冷却同构）。
实现为 `region.policy + region.policyChangedSeasonKey`（`'y<m>q<n>'`），同季已切过则 API 400。

### D6 委任 AI 行为（§39.5 的函数级落地）

**内政**（每月，区内每城，城市按 id 升序）：
1. 复用 `decideCityRule`（P1-1 三规则：缺粮屯田 / 低金经商 / 低民心巡安 + 条件征兵）——三规则是**病症驱动**，与方针无关，全部保留；
2. 三规则都不触发时，按方针选 fallback 开发（0-A 城防即时，不开城防项目）：
   `development`→农业+6；`armament`→征兵（不触发病症征兵条件时按余粮 60% 兵力比征一次）；`balanced`→现状 balanced 分支；`offensive`→征兵优先、余粮不足时训练；
3. **委任效率折损**：`efficiency = 0.6 + 统/1000 + 政/1000 + 方针系数(±0.1)`（§39.5 原公式，`balanced`=+0，`development`/`armament`=+0.05，`offensive`=+0.1）；所有内政增量与征兵数 `floor(基准 × efficiency)`；
4. 都督从军期间：内政照常（效率不变），**军事照常**（D4 决策）——都督是区的「能力半径」而非逐月操作员，这与 §39.5「委任AI = 现有引擎 + 权重」一致；
5. 日志类型 `deleg_civil`（月末聚合为一条，格式「【委任·荆襄】襄阳 农业+5 / 江陵 征兵+600」）。

**军事**（每月，每区一次决策机会，region id 升序）：
1. 复用 `aiMilitaryTurn` 的评分链（§2.2），但源城限定为**区内城池**（排除首都）；
2. 方针乘数：`offensive` 出征概率 ×1.4 / 兵力比门槛 1.0（§39.5「攻略型 ×1.0」）；`development` ×0.5 / 门槛 1.6；`armament` ×0.8 / 门槛 1.3；`balanced` ×1.0 / 门槛 1.3；
3. 危城按兵不动、空城疑兵、暗渡陈仓守土等**全部门禁原样保留**（与 AI 同规则）；
4. 出征仍受 D1 军团上限与 `formationTroopCap` 约束；`minCampaignTroops`、携粮 3 个月等 AI_MILITARY_CONFIG 常量共用；
5. 日志类型 `deleg_military`。

**人事**（autoRecruit/autoReward）：首切片**字段落库、引擎不消费**（简化标注，§39.10 步骤 4 随 0-B 人事扩容一并实装），UI 开关置灰并注明「0-B 启用」。

### D7 月结插入点（只做紧邻插入）

```
runAllAiTurns(...)                       // AI 内政（玩家跳过）
runDelegationCivilTurns(state)           // ★ 新增：玩家委任区内政（无需 RNG——三规则与征兵门槛均为确定性；见 D8）
…
runAiMilitary(nextState, rng, rng)       // AI 军事
runDelegationMilitary(nextState, rng)    // ★ 新增：玩家委任区军事（消费权威流，位置固定在 AI 之后）
```

- 确定性：region 按 id 升序、城按 id 升序、目标评分排序键与 `aiMilitaryTurn` 相同（score 降序 / fromId / targetId）。
- RNG 纪律：内政路径**零 RNG**（三规则+fallback 全确定性，与 `decideCityRule` 一致）；军事路径消费 `decisionRng`（出征概率掷点）与 `resolutionRng`（袭扰结算，若触发）——**沿用同一权威流、固定插入位**。
- **金样影响**：月结新增确定性 RNG 消费点 → `server/src/engine/__fixtures__/turn-golden-12.json` 需删除重举（Session 417 纪律：引擎有意变更时重举并提交）。

### D8 RNG 消费面精算（本规格新增消费点）

| 消费点 | 流 | 每月次数上界 |
|------|------|------|
| 区军事：出征概率 | decisionRng | 每区 1 次（不中即止，与 aiMilitaryTurn while 循环同构但单发） |
| 区军事：袭扰结算 | resolutionRng | 仅袭扰路径，0~2 次 |
| 区内政 | — | 0（零消费） |

存档兼容：RNG 状态本就在信封内，无新字段。

### D9 数据结构（§39.9 对齐工程惯例后的定稿）

```typescript
// shared（新文件 shared/delegation.ts 放常量与纯函数；类型并入 game-state schema）
enum DelegationPolicy { DEVELOPMENT='development', ARMAMENT='armament', BALANCED='balanced', OFFENSIVE='offensive' }

interface DelegationRegion {
  id: number;                      // 势力内自增（faction 内唯一即可，配合 factionId 全局定位）
  name: string;                    // 默认取核心城名（区 id 最小城的 name）
  cityIds: number[];               // 升序维护
  governorId: number;
  policy: DelegationPolicy;
  policyChangedSeasonKey?: string; // D5 冷却键
  autoRecruit: boolean;            // 首切片不消费（D6）
  autoReward: boolean;             // 同上
  createdYear: number;
  lastReport?: DelegationReport;
}

interface DelegationReport {       // 每季生成（季度首月，塞进 region.lastReport 覆盖旧值）
  season: Season; year: number;
  actionSummary: string[];         // ≤8 条（对齐 famineNotes 截断风格）
  troopDelta: number; goldDelta: number; foodDelta: number;
  battlesWon: number; battlesLost: number; citiesCaptured: number;
  warnings: string[];
}

interface Faction { /* 现有字段 */ delegationRegions?: DelegationRegion[]; }  // optional：旧档兼容
```

- Strict Schema 纪律：`DelegationRegion/DelegationReport` 全量入 `game-state-full-schema.ts` 并补 Zod；**无任何临时字段出引擎**（评估负债 #3 的教训写入验收）。
- 存档瘦身（P2-2）：`lastReport` 属运行态派生摘要，保留在存档内（体积可控：每区一条、季覆盖）。

### D10 委任区生命周期规则

| 事件 | 行为 |
|------|------|
| 城被攻占/叛离 | 自动移出 `cityIds`；区空则自动解散（都督免职回城） |
| 都督被俘/死亡/下野 | 区自动解散，城回归直辖，actionLog `deleg_disband` |
| 都督忠诚 < 80 | **不**自动免职（忠诚月检定已有 S26 叛逃链兜底）；创建/换届时才校验 80 |
| 玩家手动操作区内城 | 照常可操作（§39.6 权限表）；委任 AI 下月照常（不做「当回合抑制」账本，简化） |
| 首都 | 永不可划入（创建/划城校验拒绝） |
| 势力灭亡 | `delegationRegions` 随势力一起失效（无需清理，isAlive=false 后无人消费） |

### D11 API（端点全走镜像纪律：services → worker → offline-api → store）

| 端点 | 语义 |
|------|------|
| `POST /api/game/delegation/create` | `{name?, cityIds, governorId, policy}` → 全量校验（D2/D3/D4/D10） |
| `POST /api/game/delegation/update` | `{regionId, name?, policy?, autoRecruit?, autoReward?}`（方针受 D5 冷却） |
| `POST /api/game/delegation/assign-city` | `{regionId, cityId, remove?}` 划入/划出（受区帽 D2、城归属校验） |
| `POST /api/game/delegation/disband` | `{regionId}` |
| 读 | 不设独立读端点：`Faction.delegationRegions` 随 GameState 整态/patchOnly 补丁下发（P2-4 通道自动覆盖——`isGameStateLike` 探测含 factions 深层 diff，需在 game-patch 单测补一条深层路径用例） |

错误码风格沿用中文文案 throw（`'都督官职不足（须太守/将军及以上）'` 等），客户端错误翻译表补条目。

### D12 UI

1. **命令坞新增「军团」域**（`MilitaryOrdersPanel` 同层）：委任区卡片列表（名/都督印/方针徽/城数/军况摘要）→ 区详情（划城勾选列表、都督属性与效率、方针四选、autoRecruit/autoReward 置灰开关、季度报告折叠）；
2. **CampaignPanel**：军列表头部加「出征军 2/4」上限显示；超限按钮置灰 + 原因 title（InkButton 既有约定）；
3. **季度报告**：区详情内折叠卡（样式复用 StonePanel/SealBadge 组件族，§九美术基调，零新视觉资产）；
4. FirstTurnGuide 不动（委任是中期系统，首局不引导）。

---

## 四、与两条工程负债的关系（刻意不扩大重构面）

| 负债（评估 #4/#5） | 本规格的处置 |
|------|------|
| 月结 15+ tick 硬编码 | 只做紧邻插入（D7），不重构 tick 序；插入位写注释锚定 |
| 双位置真源 | 成文化不变量（§9 R1~R4）供验收断言，不改机制 |
| 五处一改同步（#1） | 4 个新端点 ×5 处镜像 + `verify-s416-worker-parity` handler 面自动盯（新端点漏镜像即红） |
| Strict Schema（#3） | D9 全量 Zod；验收含「存档→读档→再存档」往返 |

---

## 五、不变量（R1~R4，写进验收断言）

- **R1 军册真源**：任一武将至多属于一支 `campaignArmies`（含都督兼职场景）。
- **R2 镜像一致**：军中武将 `officer.location === army.fromNodeId`（编成时点），且不在任何 `city.officers` 列表。
- **R3 区归属唯一**：一城至多属于一个委任区；首都与灭势力城不在任何区。
- **R4 郡域双写同步**：委任军若入场郡域（增援语义复用），`nodeStates[].armyIds` 与 `deployments` 同步（复用 `maybeReinforceCommandery` 既有双写模式）。

---

## 六、验收方案

| 验证 | 覆盖 |
|------|------|
| `verify-s420-delegation-crud` | 创建/划城/方针冷却/解散 + 全部门禁拒绝路径（官职不足、忠诚<80、含首都、超区帽、超军帽、都督已任他区） |
| `verify-s421-delegation-civil` | 12 月推进：区内城被委任 AI 发展（病症三规则照触发）、效率折损数值正确、未委任城不受影响、零 RNG（双局指纹一致） |
| `verify-s422-delegation-military` | 布阵确定性：攻略型满足门槛自动出征（复用 aiMilitaryTurn 评分择优断言）、危城按兵不动保留、D1 上限拦截、金样重举后 turn-golden 3/3 |
| `verify-s422-delegation-report` | 季度报告生成/覆盖/字段正确；存档往返（存→读→再存逐字节） |
| parity | `verify-s416-worker-parity` 扩至新端点（+4 handler 与 offline 面同步） |
| 回归矩阵 | campaign 71 / ai-military-rng 38 / ai-decision-plot 4 + integration 4 / save-* 全套 / s372 / s407 / s374 / client 全量 / compliance |

---

## 七、可玩性论证（为什么现在做）

1. **中盘痛点**：0-A 玩到 40+ 回合通常坐拥 8~12 城，逐城点内政成为主要无聊源（评估四大症结之一的「想快进」）；委任把玩家注意力还给战略决策。
2. **多线作战**：D1 上限让「两线北伐 + 一线固守」成为显式资源分配，配合 P1-2 的 AI 威胁响应，形成真正的多军博弈。
3. **0-B 前置而非依赖**：§39 的分区表 0-A 自动按 `city.province` 聚合（约 4~5 区），0-B 105 城时同一套代码直接扩到 10 区——先实装是 0-B 的体验安全网。

---

## 八、实装切片（批准后执行，每片独立全绿+双写）

| 切片 | 内容 | 验证 |
|:----:|------|------|
| S1 | ✅ **Session 420 完成**：`shared/delegation.ts`+`types/delegation.ts`+`DelegationPolicy` 枚举+Zod+`Faction.delegationRegions?`；`engine/delegation.ts` CRUD + `startCampaignForFaction` D1 军上限（garrison 豁免）；4 端点×5 镜像；`DelegationOverviewDrawer`（命令坞第 11 域）+ CampaignPanel `campaign-army-cap`。验证：`verify-s420-delegation-crud` **36/36**、`verify-s420-delegation-ui` **21/21**、parity **5/5**（+4 别名契约）、回归矩阵全绿（campaign 71 / ai-military-rng 38 / ai-decision 4+4 / save 10+62+10+101 / shared 470 / client 71 / server 3 / s372 11 / s407 22 / s374 44 / validate-data / compliance 776 / diff-check） | （原计划）s420-crud + parity + 回归矩阵 |
| S2 | 委任内政 AI（D6 内政半）+ 月结插入 `runDelegationCivilTurns` + `deleg_civil` 日志 | s421-civil（零 RNG 双局） |
| S3 | 委任军事 AI + 季度报告 + `deleg_military` + 金样重举 | s422-military + report + turn-golden |

---

## 九、明确不做（本规格边界）

- 六角战场多军协同/增援入场（S10 战术层，另行切片）；
- AI 势力使用委任区（AI 已自管；委任是玩家 QoL 系统）；
- autoRecruit/autoReward 引擎消费（0-B 随人事扩容）；
- 委任区间自动运输（§39.6 运输玩家专属）；
- 都督叛离带区独立、委任区世袭（0-B 深化）；
- 0-B 数据规模本身（闸门：`docs/41-playtest-protocol.md` §三）。

---

*文档版本: v1.1 | 2026-08-28 Session 419 规格落盘；Session 420 S1 实装完成（D1/D2/D3/D5/D9/D10/D11/D12 已生效为规则真源；S2 内政 AI / S3 军事 AI+报告 待后续会话）。*
