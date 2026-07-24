# 24 — 人物状态表情系统设计（Character Expression System）

> **定位**：本系统是 **S22 美术基调·金石水墨** 既定头像组合方案 **A+C+B** 中
> **C 层（程序化五官拼图）的动态状态化扩展**。
>
> S22 的 C 层原本是「5 脸型 × 10 冠冕 × 10 胡须 × 10 眉眼，按 `avatarGene` 哈希派生」的**静态**五官拼图。
> 本系统把其中「眉眼」维度（以及新增的「口」维度）从**静态哈希派生**改为**由确定性游戏状态驱动切换**，
> 使武将头像随战斗胜负、忠诚、士气、体力等状态呈现不同表情。
>
> **不引入新美术语言**：基调仍是「金石水墨·拓片简册·印信官职」三件套（`00-dev-constitution.md` §11.1），
> 字体仍强制使用工程内部别名 `HanDynastySerif` / `HanDynastySeal`（§11.3 / §11.7），
> 不引用宿主系统字体，不引入商业字库、现代立绘、二次元萌娘或商业音效素材。
>
> **本轮范围（0-A 原型验证）**：仅吕布（id=5）、曹操（id=1）、诸葛亮（id=4）三人，
> 占位几何形状验证「分层合成 + 状态驱动切换」的可组合性与可替换性，**不产出成品美术**。
> 三人以外武将、全量覆盖、正式插画均不在本轮。
>
> **数字真源**：规模与字段定义以 `08-data-dictionary.md` 为准；本轮不新增 `officers.json` 字段、
> 不改 `OfficerStatus` 枚举、不引入新 RNG，所有表情状态由既有确定性数据派生。

---

## §1 状态数据模型

### §1.1 `ExpressionInput` 输入来源（逐字段标注既有系统）

表情系统是纯消费方，**不发明任何新数值来源**，只读取既有系统已经产出并落进 `GameState` 的字段。

| 输入字段 | 类型 | 既有数据来源 | 落点位置 | 持续/瞬时 |
|---|---|---|---|---|
| `officer.loyalty` | `number` 0–100 | **S11 人事**（赏赐/登用义理修正）/ **S18 家族**（跟随/默认忠诚接权威 PRNG） | `Officer.loyalty`（`shared/types/officer.ts:75`） | 持续 |
| `officer.stamina` | `number` 0–100 | **S12 官职功绩体力**（Session 63/65 完整接入） | `Officer.stamina`（`shared/types/officer.ts:84`） | 持续 |
| `officer.status` | `OfficerStatus` 枚举 `FREE`/`ACTIVE`/`PRISONER`/`DEAD` | **S11 人事**（登用/解职）/ **S10 战斗**（被俘/阵亡结算） | `Officer.status`（`shared/types/officer.ts:77`） | 持续 |
| `officer.stats` | `{leadership,war,intelligence,politics,charisma}` 0–100 | **静态数据** `officers.json` → `OfficerStatic.stats` | `Officer.stats` | 静态 |
| `officer.hidden` | `{righteousness,ambition,composure,valor,personality,ideal,...}` | **静态数据** `officers.json` → `OfficerStatic.hidden` | `Officer.hidden` | 静态 |
| `battle.winner` | `'attacker'\|'defender'\|null` | **S10 战斗结算**（六角战斗 `attackUnit` / `finishPlayer` 终局） | `BattleState.winner`（`shared/types/battle.ts:63`） | 瞬时 |
| `battle.phase` | `'player'\|'enemy'\|'over'` | **S10 战斗** | `BattleState.phase` | 瞬时 |
| `battleUnit.commanderId` | `number` | **S10 战斗**（`createBattle` 选取主将） | `BattleUnit.commanderId`（`shared/types/battle.ts:17`） | 瞬时 |
| `battleUnit.side` | `'attacker'\|'defender'` | **S10 战斗** | `BattleUnit.side` | 瞬时 |
| `battleUnit.morale` | `number` 0–100 | **S10 战斗**（攻击/反击后 `morale-3`、残兵回流） | `BattleUnit.morale`（`shared/types/battle.ts:29`） | 瞬时 |
| `battleUnit.isDestroyed` / `isRetreated` | `boolean` | **S10 战斗** | `BattleUnit.isDestroyed/isRetreated` | 瞬时 |
| `campaignArmy.morale` | `number` 0–100 | **S05 军事 / S83 部队组织大系统**（士气深化设计） | `CampaignArmy.morale`（`shared/types/campaign.ts:133`） | 持续（大地图） |
| `actionLog` | `GameAction[]` `{year,month,type,message}` | **S15 AI / 各引擎**（事件流；已见 `type:'strategist_resign'`） | `GameState.actionLog`（`shared/types/game.ts:61`） | 历史 |

#### §1.1.1 「健康/负伤状态」的处理（务实决策）

`OfficerStatus` 枚举（`shared/enums/index.ts:93`）只有 `FREE`/`ACTIVE`/`PRISONER`/`DEAD`，**没有「负伤」值**。
task 描述里提到的「健康/负伤状态」在现有数据里不存在。本轮处理：

- **用 `Officer.stamina` 代理负伤**：`stamina < 30` 视为「体力枯竭/负伤」态，触发 `ponder` 或 `anger`（按原型）。
- **不改 `OfficerStatus` 枚举**，不新增字段，零数据迁移。
- 与现有 `stamina` 系统（体力，S12）语义一致：体力是「连续行动消耗、休息恢复」的资源，低体力天然对应疲态。
- **后续可选增强**（不在本轮）：`AutoBattleResult.commanderStatus[id] === 'wounded'`（`shared/types/campaign.ts:175`）是自动战斗算法已有的 wounded 状态，
  若将来把它写入 `Officer` 运行时新字段，可成为更准确的负伤来源；本轮不接入，因它当前不落 `Officer`。

#### §1.1.2 「士气区间」的处理

武将本身**没有 `morale` 字段**，士气是**部队级**数据。表情系统按场景分别取值：

| 场景 | 士气数据源 | 反查方式 |
|---|---|---|
| 战斗中/战斗刚结束 | `BattleUnit.morale` | `battle.units.find(u => u.commanderId === officer.id)?.morale` |
| 大地图（OfficerDetail 等） | `CampaignArmy.morale` | `campaignArmies.find(a => a.commanderId === officer.id)?.morale` |
| 无部队（在野/被俘/无出征） | 无 | 跳过士气维度，仅用忠诚/stamina |

### §1.2 持续态 vs 瞬时态

| 类别 | 定义 | 数据源 | 衰减 |
|---|---|---|---|
| **持续态** | 武将「平时常驻」的状态，由慢变量决定 | `loyalty` 区间、`stamina` 区间、`status` | 不衰减，随数值自然变化 |
| **瞬时态** | 「刚发生某事件」的状态，几秒/几回合后应回退 | `battle.winner` + `battle.phase==='over'` | 见 §1.4 |

两者**共存于同一头像**：瞬时态在有效期时压制持续态，瞬时态失效后自动回退到持续态。

### §1.3 优先级与互斥规则

> 单一主表情：同一时刻只渲染**一个**表情层（不叠加多个表情），避免组合爆炸。
> 背景色调层**独立于**表情层叠加（见 §3.4），承担「叠加信号」职责。

**优先级（严重度递减，高者压制低者）**：

1. `status !== ACTIVE`（被俘/阵亡/在野特殊态）→ 锁定 `neutral`，背景 `grey`（阵亡）/ `cold`（被俘）
2. `stamina < 30`（负伤代理）→ `ponder` 或 `anger`（按原型 §4），背景 `grey`
3. 战斗瞬时态（`battle` 存在且 `phase==='over'` 且 `battle.units` 含该武将）→ 胜/败表情，背景 `gold`/`cold`
4. 忠诚区间持续态 → `suspicion`/`reluctant`，背景 `dark-red`
5. 士气区间持续态 → 低士气 `ponder`，高士气并入 `victory`
6. 默认 → `neutral`，背景 `neutral`

**互斥冲突示例**（规则可预期的关键场景）：

| 场景 | 输入 | 输出 | 理由 |
|---|---|---|---|
| 刚打胜仗但忠诚很低 | `winner=attacker` + `loyalty=40` | 表情 `victory` + 背景 `dark-red` | 瞬时态压制持续态，但背景层透出「虽胜犹疑」 |
| 刚打败仗且 stamina 极低 | `winner=defender` + `stamina=10` | 表情 `defeat` + 背景 `grey` | 负伤背景叠加，不切到 `anger`（败优先于负伤代理，因战斗上下文更具体） |
| 平时忠诚极低 | 无 battle + `loyalty=20` | 表情 `suspicion` + 背景 `dark-red` | 持续态正常显示 |
| 被俘 | `status=PRISONER` | 表情 `neutral` + 背景 `cold` | 规则 1 锁定，忽略其余 |

### §1.4 衰减机制（0-A 简化）

- **不引入回合计时器**：0-A 简化为「瞬时态有效期 = 该武将仍在 `activeBattles` 的某个 `BattleState.units` 中」。
- 战斗结算写入 `actionLog` + `exitBattle()` 清空 `activeBattles` 后，该武将的战斗瞬时态**立即失效**，回退到持续态。
- **后续增强留口**（不在本轮）：若要做「胜利表情持续 3 回合」，可在 `actionLog` 写入带 `officerId` 与 `decayTurn` 的事件条目，由回合引擎递减。
  当前 `GameAction` 无 `officerId` 字段（`shared/types/game.ts:18-23`），需扩展 schema——本轮不做。

---

## §2 状态词表（审视精简后 7 词）

> task 描述给出的示例词表是「平静/自信/不甘/怀疑/愤怒/震惊/沉思」。
> 经审视，在低分辨率头像（120×150 viewBox）上，以下相近态难以稳定区分，合并：
> - `自信` 并入 `平静`（强度由背景色调区分，不另开表情层）
> - `震惊` 并入 `挫败`（惨败 = 挫败的强度上限，不另开层）
> - `不安` 并入 `怀疑`（极低忠诚 = 怀疑的强度上限）
> - `振奋`（高士气）并入 `胜利`（高士气与胜仗表情特征重叠：眉扬嘴角上）

最终 7 词：

| `ExpressionId` | 中文 | 眉 | 口 | 触发场景 |
|---|---|---|---|---|
| `neutral` | 平静 | 平 | 平 | 默认；诸葛亮胜仗（不动声色）；曹操胜仗（自信变体） |
| `victory` | 胜利 | 扬 | 角上 | 胜仗；高士气；吕布胜仗（狂傲变体） |
| `defeat` | 挫败 | 蹙 | 角下 | 败仗；惨败（强度上限） |
| `anger` | 愤怒 | 竖 | 目瞪 | 败 + 野心高/stamina 低（吕布） |
| `reluctant` | 不甘 | 蹙 | 咬牙 | 败 + 义理低（吕布低忠诚） |
| `suspicion` | 怀疑 | 挑 | 眼斜 | 忠诚 < 60 |
| `ponder` | 沉思 | 拢 | 眼敛 | 败 + 智力高；stamina 低（曹操/诸葛亮） |

**为何是 7 个而非更多**：每个表情层在程序化 SVG 里是一组独立的 `<path>` 变体（眉 + 口），
层数 = 资源体积 + 对齐调试成本。7 词已覆盖「胜/败/平 × 忠诚/士气/负伤」的正交空间，
且 3 原型各只需实现 3–4 个变体（见 §4），不必每人都做全 7 个。

---

## §3 分层合成资源规范

### §3.1 图层结构

> 本轮对 3 原型采用**程序化 SVG 分层**方案（见 §5.1 取舍），不产出 PNG 整图。
> 现有 `client/public/portraits/{cao_cao,lv_bu,zhuge_liang,guan_yu}.png`（Session 166）保留给**静态名册/简册**使用；
> 表情系统激活时（有 `battle` 或非默认 `ExpressionState`），3 原型切换到程序化 SVG 渲染，**视觉与名册 PNG 不一致是本轮可接受的代价**（占位验证阶段）。

| 层 | 职责 | 本轮实现 | 以后可替换为 |
|---|---|---|---|
| **L0 基础脸** | 脸型轮廓 + 冠冕 + 胡须 + 衣袍底 | 程序化 SVG `<path>`（复用 `OfficerPortrait` 现有 `face`/`crown`/`beard` 分组） | A 层拓片印章底图（公有领域汉代拓片切片） |
| **L1 表情层** | 眉 + 眼 + 口（按 `ExpressionId` 切换 path 变体） | 程序化 SVG `<path>` 变体（本轮占位几何） | C 层完整 10×10 眉眼派生（`avatarGene`） |
| **L2 背景色调层** | 半透明色调蒙版 + 印章高亮 | CSS 变量 `--portrait-ink`/`--portrait-seal` 叠加 + `backgroundTone` 类 | B 层官职印信简册（氏族/官职篆印 + 印绶色） |

### §3.2 技术格式与锚点规则

- **格式**：单一 `<svg viewBox="0 0 120 150">`，所有层共用同一坐标系（不拆多文件）。
  - 不采用「多张 PNG 带透明通道叠加」：PNG 叠加需手调锚点，且本轮无美术资源。
  - 不采用「多个独立 SVG 文件」：与现有 `OfficerPortrait` 程序化分支风格不一致。
- **对齐基准点（锚点）**：所有表情层的眉/眼/口 `<path>` 以**鼻梁中点 (60, 70) 为原点**对齐。
  - 现有 `OfficerPortrait` 的 `portrait-brow`（y≈55）、`portrait-eye`（y≈61）、`portrait-faint`（鼻梁 y≈62–74）已隐式以此对齐。
  - 新增的 `portrait-mouth`（口）定位在 y≈78（`portrait-beard` 的 short 变体上沿）。
  - 每个表情变体只改眉/口的 `d` 属性，**不改坐标范围**，确保五官不跑偏。
- **胡须遮挡**：`portrait-beard` 在 `short`/`wild`/`long` 变体下会覆盖口部，口变体在胡须下方绘制（z-order：脸→口→眉→眼→胡须），视觉上长须武将的口部表情被部分遮挡是可接受的（吕布 wild 须只露咬牙轮廓，符合「不甘」语义）。

### §3.3 资源来源与目录结构（占位）

本轮**不产出美术资产文件**，全部表情变体是 `ExpressionPortrait.tsx` 内的 SVG path 字符串常量。目录结构留口：

```
client/public/portraits/          # 现有 4 张整图 PNG（静态名册用，本轮不动）
client/src/components/officer/
  OfficerPortrait.tsx             # 现有：PNG 优先 + 程序化 SVG 回退
  ExpressionPortrait.tsx          # 新增：分层合成（基础脸 + 表情层 + 背景色调）
shared/
  expression.ts                  # 新增：类型 + resolveExpression 纯函数
  expression.test.ts              # 新增：状态→表情映射单测
```

以后替换为正式美术时（A+C+B 全量，Phase 5）：
- L0 替换为 `client/public/portraits/rubbing/<officerId>.svg`（拓片底图）
- L1 替换为 `client/public/portraits/face-features/<faceType>/<expressionId>.svg`（五官变体）
- L2 替换为 `client/public/portraits/seals/<officerId>.svg`（官职印信）

`ExpressionPortrait` 的渲染接口（§5.2）保持不变，只换资源加载策略。

---

## §4 五维/性格 → 表情倾向规则（3 原型各 2–4 条）

> 不设计成通用公式覆盖所有武将（那是 0-B 全量覆盖时的工作）。
> 本轮为 3 原型各自定义差异化规则，作为 `resolveExpression` 的硬编码原型分支。

规则基于 `officer.hidden.{ambition, righteousness, composure}` + `officer.stats.{charisma, intelligence, war}`：
- `ambition` 高 → 胜仗更狂傲、败仗更愤怒
- `righteousness` 低 → 败仗不甘、低忠诚不甘
- `composure` 低 → 负伤更愤怒、败仗更外显
- `charisma` 高 → 胜仗更自信内敛
- `intelligence` 高 → 败仗更沉思、负伤更沉思
- `war` 极高 → 胜仗更张扬

### §4.1 吕布（id=5）

> `stats: war↑↑, hidden: ambition↑, righteousness↓, composure↓`

| # | 触发条件 | 表情 | 背景色调 | 依据 |
|---|---|---|---|---|
| L-1 | 胜仗（`battle.winner` 对应其 `side`） | `victory`（狂傲变体：眉更挑、嘴角更上扬） | `gold` | ambition↑ → 胜利张扬 |
| L-2 | 败仗 | `anger` | `cold` | composure↓ → 败则怒 |
| L-3 | 无 battle + `loyalty < 60` | `reluctant` | `dark-red` | righteousness↓ → 忠诚低时不甘（非怀疑） |
| L-4 | 无 battle + `stamina < 30` | `anger` | `grey` | composure↓ → 体力枯竭外显为怒 |

### §4.2 曹操（id=1）

> `stats: charisma↑, intelligence↑, hidden: ambition↑, composure 中`

| # | 触发条件 | 表情 | 背景色调 | 依据 |
|---|---|---|---|---|
| C-1 | 胜仗 | `neutral`（自信变体：眉微扬、口平） | `gold` | charisma↑ → 胜得从容，不外显 |
| C-2 | 败仗 | `ponder` | `cold` | intelligence↑ → 败则思 |
| C-3 | 无 battle + `loyalty < 60` | `suspicion` | `dark-red` | ambition↑ → 多疑 |
| C-4 | 无 battle + `stamina < 30` | `ponder` | `grey` | intelligence↑ → 疲则思 |

### §4.3 诸葛亮（id=4）

> `stats: intelligence↑↑, hidden: righteousness↑, composure↑`

| # | 触发条件 | 表情 | 背景色调 | 依据 |
|---|---|---|---|---|
| Z-1 | 胜仗 | `neutral`（不动声色：默认即可） | `gold` | composure↑ → 胜不形于色 |
| Z-2 | 败仗 | `ponder`（更深：眉更拢） | `cold` | intelligence↑↑ → 深思 |
| Z-3 | 无 battle + `loyalty < 60` | `suspicion` | `dark-red` | 义理高几乎不触发，但规则保留以验证互斥 |
| Z-4 | 无 battle + `stamina < 30` | `ponder` | `grey` | composure↑ → 疲仍沉思（不外显为怒） |

**三人区分度验证**：胜仗时吕布=`victory`狂傲、曹操=`neutral`自信、诸葛亮=`neutral`不动声色——
吕布与曹/亮区分（不同表情），曹与亮通过 `victory` 背景色调一致但口/眉 path 强度不同区分（自信变体 vs 默认）。败仗时吕布=`anger`、曹/亮=`ponder`——区分明显。

---

## §5 技术渲染方案

### §5.1 CSS 绝对定位叠加 vs SVG 内嵌 `<g>` 分组 —— 取舍

| 方案 | 优点 | 缺点 | 本轮选择 |
|---|---|---|---|
| **A. CSS 绝对定位叠加多张 PNG/SVG** | 各层可独立替换 | 五官对齐需手调锚点；多文件加载；与现有 `OfficerPortrait` 风格不一致 | ❌ |
| **B. 单一 SVG 内嵌多个可切换 `<g>` 分组** | 同坐标系零对齐成本；与现有 `OfficerPortrait` 程序化分支完全一致；无新资源文件 | 表情变体 path 需写在组件内 | ✅ |
| C. 多个独立 SVG 文件 | 资源可独立替换 | 本轮无美术资源；与程序化分支风格不一致 | ❌ |

**选 B**：扩展现有 `OfficerPortrait` 程序化 SVG 分支的天然分层（`portrait-face`/`portrait-crown`/`portrait-beard`/`portrait-brow`/`portrait-eye`），
新增 `portrait-mouth` 层，并把 `portrait-brow`/`portrait-eye`/`portrait-mouth` 的 `d` 属性改为按 `ExpressionId` 切换的变体。

### §5.2 渲染组件接口

```ts
// shared/expression.ts —— 纯函数 + 类型，server 不用但 client import（同 mask-state.ts 惯例）
export type ExpressionId =
  | 'neutral' | 'victory' | 'defeat' | 'anger' | 'reluctant' | 'suspicion' | 'ponder';

export type BackgroundTone = 'gold' | 'cold' | 'dark-red' | 'grey' | 'neutral';

export interface BattleSideContext {
  /** 该武将在本场战斗中的阵营 */
  side: 'attacker' | 'defender';
  /** 战斗胜方（null = 未分胜负/进行中） */
  winner: 'attacker' | 'defender' | null;
  /** 该武将所在单位的士气（用于士气区间判断） */
  morale: number;
  /** 是否已被歼灭/撤退（影响败仗强度） */
  isDestroyed?: boolean;
  isRetreated?: boolean;
}

export interface ExpressionInput {
  officerId: number;
  loyalty: number;
  stamina: number;
  status: OfficerStatus;
  stats: OfficerStats;
  hidden: OfficerHidden;
  /** 战斗上下文；无则 undefined（持续态场景） */
  battle?: BattleSideContext | null;
}

export interface ExpressionState {
  expression: ExpressionId;
  backgroundTone: BackgroundTone;
  /** 瞬时态标记：用于 UI 决定是否切换到 ExpressionPortrait（无瞬时态时仍可用 OfficerPortrait PNG） */
  transient: boolean;
}

/** 纯函数：给定状态输入，返回应渲染的表情与背景色调。
 *  完全确定性，不消耗 RNG。3 原型硬编码分支；其余武将走通用回退。 */
export function resolveExpression(input: ExpressionInput): ExpressionState;
```

```tsx
// client/src/components/officer/ExpressionPortrait.tsx
interface Props {
  officer: Officer;
  /** 战斗上下文（BattleView SideCard 传入）；OfficerDetail 不传则走持续态 */
  battle?: BattleSideContext | null;
  /** 紧凑模式（名册缩略图尺寸） */
  compact?: boolean;
}
// 内部：调用 resolveExpression(officer + battle) 得到 ExpressionState，
//       渲染程序化 SVG 分层（基础脸 + 表情层 path 变体 + 背景色调 CSS 类）。
//       不读 PNG（即使 officer.id 是 1/4/5 也走程序化分支）。
```

### §5.3 与现有 `OfficerPortrait` 的关系

- **不修改 `OfficerPortrait.tsx`**：它继续负责「PNG 优先 + 程序化 SVG 回退」的静态头像。
- **`ExpressionPortrait` 独立新增**：只在「需要表情」的接入点（BattleView SideCard、OfficerDetail 大头像）使用。
- 两者共享 `getOfficerProfile`（氏族/题签/印色）以保证视觉一致性，但 `ExpressionPortrait` 额外消费 `resolveExpression`。
- **以后合并**（不在本轮）：当 `avatarGene` 全量落库（D-0B-7）后，`OfficerPortrait` 与 `ExpressionPortrait` 可统一为一个组件，按 `avatarGene` 决定走 PNG 还是程序化分层。

---

## §6 与现有系统的挂钩点

### §6.1 数据源挂钩表（零硬编码）

| 接入点 | 输入数据 | 数据来源 | 现成度 |
|---|---|---|---|
| BattleView SideCard（攻方） | `officer=battle.units[attacker].commanderId 对应 Officer` + `battle={side:'attacker', winner:battle.winner, morale:attacker.morale, isDestroyed:attacker.isDestroyed}` | `BattleState` + `GameState.officers` | ✅ 现成 |
| BattleView SideCard（守方） | 同上，`side:'defender'` | 同上 | ✅ 现成 |
| OfficerDetail 大头像 | `officer` 本身（含 `loyalty`/`stamina`/`hidden`/`stats`） + `battle=null` | `GameState.officers[id]` | ✅ 现成 |
| OfficerDetail 大头像（士气补充） | `campaignArmies.find(a=>a.commanderId===officer.id)?.morale` | `GameState.campaignArmies` | ✅ 现成 |

**不接入的挂钩点**（本轮范围外）：
- `actionLog`：因 `GameAction` 无 `officerId` 字段，无法直接反查「哪个武将刚打了胜仗」。
  本轮用 `activeBattles` 直接判定（更准确），`actionLog` 留待 §1.4 增强时使用。
- EventDialog 对话头像：`EventDialogue.portrait?: string` 是静态字符串，本轮不动。
- 武将名册列表（OfficerRosterPanel）：compact 缩略图尺寸太小，表情难辨，本轮不接入。

### §6.2 UI 接入点（本轮 2 个最小验证场景）

| # | 接入点 | 验证什么 | 数据源类型 |
|---|---|---|---|
| 1 | **BattleView SideCard**（`client/src/components/battle/BattleView.tsx:233-250`） | 瞬时态：战斗胜/败后头像表情切换 | `battle.winner` + `commanderId` |
| 2 | **OfficerDetail 大头像**（`client/src/components/officer/OfficerDetail.tsx:89`） | 持续态：忠诚区间/stamina 区间表情 | `officer.loyalty` + `officer.stamina` |

**接入方式**：在上述两处把现有 `<OfficerPortrait officer={officer} />` 替换为
`<ExpressionPortrait officer={officer} battle={...} />`（BattleView 传 battle，OfficerDetail 不传）。
非 3 原型武将（id 不在 {1,4,5}）时，`resolveExpression` 走通用回退（仅 `neutral`/`suspicion`/`ponder`，无角色化变体），
`ExpressionPortrait` 仍渲染程序化 SVG（不读 PNG），保证功能不崩。

---

## §7 不在本轮做的事 / 留待后续

| 项 | 说明 | 留待 |
|---|---|---|
| 正式成品美术 | 本轮用程序化 SVG 几何占位 | 原型验证通过后决定（AI 生成/外包/公有领域拓片） |
| 3 人以外武将 | 仅吕布/曹操/诸葛亮 | 0-B 全量覆盖时抽象通用公式 |
| `actionLog` 衰减计时 | 0-A 用 `activeBattles` 判定瞬时态 | 需扩展 `GameAction` schema 加 `officerId`/`decayTurn` |
| `OfficerStatus` 加 `INJURED` | 用 `stamina` 代理 | 若后续需要更准确负伤语义 |
| `OfficerRosterPanel` 名册接入 | compact 尺寸表情难辨 | 正式美术到位后再接 |
| EventDialog 对话头像 | `EventDialogue.portrait` 是静态字符串 | 需改 schema 为 `officerId` 引用 |
| `avatarGene` 全量落库 | D-0B-7 技术债 | 0-B 扩容前 |
| 合并 `OfficerPortrait` 与 `ExpressionPortrait` | 等 `avatarGene` 落库后统一 | Phase 5 |

---

## §8 验证计划

### §8.1 单元测试（`shared/expression.test.ts`，走 `pnpm test`）

纯函数 `resolveExpression` 的状态→表情映射，**不测渲染像素**，只测「给定输入，输出 `ExpressionState` 符合 §4 规则」。

覆盖用例（3 原型 × 关键状态）：
- 吕布：胜仗→`victory`+gold；败仗→`anger`+cold；无 battle + loyalty=40→`reluctant`+dark-red；无 battle + stamina=20→`anger`+grey
- 曹操：胜仗→`neutral`+gold；败仗→`ponder`+cold；无 battle + loyalty=40→`suspicion`+dark-red；无 battle + stamina=20→`ponder`+grey
- 诸葛亮：胜仗→`neutral`+gold；败仗→`ponder`+cold；无 battle + loyalty=40→`suspicion`+dark-red；无 battle + stamina=20→`ponder`+grey
- 互斥规则：胜仗 + loyalty=40（吕布）→ `victory`+dark-red（瞬时态压制持续态，背景透出）
- 互斥规则：status=PRISONER → `neutral`+cold（规则 1 锁定）
- 通用回退：非 3 原型武将（如 id=2）→ 走 `neutral`/`suspicion`/`ponder`，无角色化变体
- 确定性：相同输入两次调用结果完全一致（不消耗 RNG）

### §8.2 静态检查

- `pnpm typecheck` / `pnpm lint`
- `pnpm test`（新增 expression.test.ts 进 shared 测试套件）
- `pnpm validate-data`（确认未误动 `officers.json`）

### §8.3 Headless Chrome 实测

> 不用 `pnpm test` 替代——必须实际触发战斗后看头像切换。

1. 启动 `pnpm dev`，选「英雄集结」剧本选曹操
2. 出征攻打相邻敌城，进入 BattleView
3. 打胜仗（歼灭守军）→ 确认 SideCard 曹操头像=胜利表情（`neutral` 自信变体 + gold 背景）、守将=挫败（`defeat` + cold 背景）
4. 重开打输（撤军/被反击致死）→ 确认反转：曹操=`ponder`+cold、守将=`victory`+gold（若守将是 3 原型之一，否则走通用回退）
5. 返回大地图，打开 OfficerDetail 选吕布（若吕布在己方）或选低忠诚武将 → 确认大头像=`suspicion`+dark-red
6. 实测确认通过后写进会话日志，标注「Headless Chrome 实测：表情切换符合设计」

---

## §9 与既有铁律的合规性自检

| 铁律 | 本设计如何遵守 |
|---|---|
| `00` §11.1 公有领域基调 | 不引入新美术语言，沿用金石水墨；占位用程序化 SVG 几何形状 |
| `00` §11.3 字体资产闭环 | `ExpressionPortrait` 若用 `<Text>` 必须显式 `fontFamily="HanDynastySerif"`（沿用 OfficerPortrait 惯例） |
| `00` §11.4 禁止清单 | 不用商业字库、不约稿立绘、不借鉴商业三国游戏构图、不做二次元萌娘 |
| `00` §11.6 头像数据落库 | 本轮不动 `avatarGene`/`appearance` 字段；表情变体内嵌在组件，不落 JSON |
| `AGENTS` 核心规则 5 完成即文档 | 本设计文档 + 进度双写 + 07/12 同步 |
| `AGENTS` 核心规则 6 自验证 | §8.3 Headless Chrome 实测，不只跑 typecheck |
| `AGENTS` 核心规则 7 不确定先问 | 已在 Plan 阶段确认 4 个抉择点（文档编号/渲染方案/负伤代理/UI 接入点） |
| `AGENTS` 核心规则 8 先系统后细节 | 本系统登记为 S23，挂 S22 美术基调下作为 C 层状态化扩展 |
| `AGENTS` 核心规则 9 美术版权 | 全程程序化 SVG + 工程字体，零外部美术素材 |

---

*v1.0 | 2026-07-24 | Session 172 · 人物表情系统设计（Commit 1：设计文档）*
