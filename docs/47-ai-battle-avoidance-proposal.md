# AI 对六角激战的感知与避让 · 实装设计规格（Session 447 纯设计轮）

> 前置：docs/43 S2（六角多军）、docs/45 S5a/S5b（回合中途增援）、docs/46 S5c（城驻军出击）均已落地。
> 本规格收口 docs/46 D9「AI 差异化」中**确定性**的部分：AI/委任军事对 `activeBattles` 零感知导致的避让缺口。
> 体例沿 docs/43~46：实勘行号 + D 拍板点（含推荐值）+ R 不变量 + 验收方案。
> 状态：**S5d 已实装**（Session 447，D1 用户拍板＝仅确定性避让，D2/D3 按推荐值落地；`verify-s47-ai-battle-avoidance` 15/15）；AI 主动反应后置。

## 一、范围界定

- **S5d（本片）** = AI 与委任军事对**进行中六角战**的感知与**避让**（确定性、零 RNG）：激战城不作为出征源、激战军不被 AI/委任误动。
- **不在本片**：AI **主动反应**决策（是否派援、是否让守军出击、是否提前撤退）——属行为/平衡差异化，留平衡轮或另立项。

## 二、现状实勘（证据行号，Session 447 复核）

| # | 事实 | 证据 |
|---|------|------|
| F1 | `aiMilitary.ts` 对 `activeBattles` **零引用**（grep=0）——AI 完全不知六角战进行中 | `aiMilitary.ts`（全文） |
| F2 | `runAiMilitary` 逐势力只遍历 `phase==='sieging'||'engaged'` 的军；`garrison` 军不入内 | `aiMilitary.ts:182-184` |
| F3 | `aiMilitaryTurn` 从 `myCities`（按城 troops）选出征源，**不查 activeBattles** → 被围城可被抽兵出征（legacy 守军路径 `city.troops` 未扣减）→ 同批兵既作场上守军又在战场外行军（双重占用） | `aiMilitary.ts:382-412`、`:463-472` |
| F4 | `assaultForFaction` 对激战军**抛错**（`该军正在六角激战中`）——AI 若选中激战军将**中断月结管线**（当前切片形状下不易达，属脆弱面） | `campaign.ts`（`armyInActiveBattle` 卫士）、`aiMilitary.ts:211` |
| F5 | 委任 `runDelegationMilitary` 同 F3（玩家被围城可被委任抽兵），且无 activeBattles 感知 | `delegation.ts:795-925`、`:38` |
| F6 | 单列约束：同时至多一场六角战；「激战城」判据 = 存在 `!settled && phase!=='over' && cityId===id` | `services/game.ts:218-223`、`shared/types/battle.ts:80-113` |
| F7 | S5b 到达自动增援 / S5c 城驻军出击已覆盖「守方增援/守军参战」，但均**与 AI 决策无关**（S5c 为开战即纳入，S5b 为到达即入） | docs/45、docs/46 |
| F8 | `maybeReinforceCommandery` 属 Tier II 郡域层（引用 `activeBattlefieldInstance`），不在本片 | `aiMilitary.ts:251-339` |

## 三、设计原则

- **P1 零随机源**：避让为纯门禁，零 RNG 消费（沿 docs/43~46）。
- **P2 只读不改战**：仅读 `activeBattles` 作门禁，不改战斗状态、不改 AI 评分/概率公式。
- **P3 最小避让**：只加「不做什么」的门禁，不新增 AI 行为。

## 四、拍板点（D1~D6，各附推荐值）

| # | 拍板点 | 推荐值 |
|---|--------|--------|
| **D1** | **切片范围** | **仅确定性避让**（激战城/激战军门禁）；AI 主动反应（派援/出击/撤退决策差异化）后置 |
| **D2** | 避让对象 | ① 出征源城排除有未结算六角战者（`aiMilitaryTurn` + `runDelegationMilitary`）；② `runAiMilitary` engaged 循环跳过激战军（安全门禁，防 F4 抛错中断月结） |
| **D3** | 判据 | 城有未结算 activeBattle（`cityId` 一致）→ 该城不作为出征源；军 id 出现在任一未结算 `battle.units[].armyId` → 跳过（复用 `armyInActiveBattle` 口径） |
| **D4** | 守军主动出击 | **不做**：S5c 已让守军参战；守军出城另起独立野战属行为差异化，归平衡轮 |
| **D5** | 内政冻结 | **不做**：只限军事出征源；内政/征兵无 activeBattles 关联，风险低 |
| **D6** | AI 主动反应 | 后置（S5e/平衡轮）：AI 是否派邻近军解围、是否让守军弃城/死守 |

## 五、不变量（R1~R3）

- **R1 零 RNG**：避让门禁零 RNG 消费；同种子双局逐字节一致。
- **R2 无激战路径逐字节不变**：无 `activeBattles` 时 `runAiMilitary`/`runDelegationMilitary` 全链路与现状一致（turn-golden / ai-military-rng 护城）。
- **R3 存档兼容**：零新字段；判据全由 `activeBattles` 派生。

## 六、验收方案

| 片 | 专项脚本 | 关键断言 |
|----|----------|----------|
| S5d | `verify-s47-ai-battle-avoidance`（engine + 月结级） | 激战城不被 AI 选为出征源（有足够兵+邻敌时）/ 委任同理 / 激战军被 engaged 循环跳过（不抛错）/ 无激战路径零变化（对照）/ R1 双局确定性 / R2 turn-golden 3/3 零变化 |
| 回归矩阵 | 沿 docs/46 §六体例 | turn-golden 3/3、campaign 71、ai-military 38、cadence 28、saves、s432~s436、s44a~s44d、s45a/s45b/s46、shared、server、client、三端 typecheck、parity、compliance、diff-check |

## 七、明确不做

- AI 主动反应决策（派援/出击/弃城）、守军出城独立野战、内政/征兵冻结、平衡数值调整。
- Tier II 郡域层（`maybeReinforceCommandery` 既有逻辑）。
- 玩家侧手动面（玩家已有全部操作权）。

> **本文件状态**：Session 447 落盘并**同轮实装 S5d**（D1 用户拍板＝仅确定性避让）：`campaign.ts` 增 `cityInActiveBattle`；`aiMilitary.ts` `runAiMilitary` engaged 循环跳过激战军 + `aiMilitaryTurn` 出征源排除激战城；`delegation.ts` `runDelegationMilitary` 出征源排除激战城。`verify-s47-ai-battle-avoidance` 15/15（含强对照：无激战则出征），turn-golden 3/3 零变化。
