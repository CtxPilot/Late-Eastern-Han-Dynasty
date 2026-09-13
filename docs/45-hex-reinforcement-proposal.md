# 回合中途增援入场 · 实装设计规格（Session 443 纯设计轮）

> 前置：docs/43 S1（433 围城合流）/S2（434 六角多军 + 亲统攻城）均已落地；docs/44 S4a~S4d 切片收官。
> 本规格收口 docs/43 §八「回合中途增援入场另行立项」——援军行军抵达战斗现场即时入场。
> 体例沿 docs/43 与 docs/44（Session 437）：实勘行号 + D 拍板点（含推荐值）+ R 不变量 + 验收方案 + 切片。
> 状态：**S5a（策应军手动入场）已实装**（Session 444，D2~D5/D8/D9 按推荐值落地，`verify-s45a-manual-reinforce` 39/39 + UI 23/23）；**S5b（行军到达自动入场）已实装**（Session 445，D6/D7 按推荐值落地：双向同规则自动 + AI 守方上限 2，D10 F11 复核；`verify-s45b-arrival-reinforce` 42/42）；S5c 后置。

## 一、范围界定

增援 = **战斗进行中**（六角战未结算）**新增参战军**。按来源分成两类：

| 来源 | 说明 | 本规格 |
|------|------|--------|
| 策应军 | 开战时因 8 帽未入战、屯于城下继续围城的同城同势力军（S2 既有 `sidelined`） | ✅ S5a（手动入场） |
| 到达军 | 战斗进行中行军抵达战场城市、当月转围城的军（F3） | ✅ S5b（自动入场） |
| 城驻军出击 | 城 troops 直接参战（无 Army 编成） | ❌ 数据缺口，S5c 后置 |

只覆盖**围城亲统战**（`battle.fromCityId == null`，D2）；`engaged` 野战、白刃战 melee 延续 docs/43 D2 的 1v1 不动。

## 二、现状实勘（证据行号，Session 443 复核）

| # | 事实 | 证据 |
|---|------|------|
| F1 | 单列约束：同时至多一场六角战斗；已有未结算战斗拒绝新建 | `server/src/services/game.ts:1244`（`doCampaignSiegeStorm`）、`:218-222`（`getActiveBattle` 取 `[0]`） |
| F2 | 月结不管战斗：`endTurn` 无 activeBattles 门禁；管线 `advanceTurn→tickCampaignMarch→tickCampaignGarrison→tickConstruction→gsTick→tickBattlefieldInstance` 无 activeBattles 读写 | `services/game.ts:240-251`，`server/src/engine/state-pipeline.ts:233-241` |
| F3 | 到达无视激战：`tickCampaignMarch` 到达敌城即转 `sieging`（D5 join，不重置），不查 activeBattles——援军可在激战中到达并转围城，但战斗快照冻结在开战时刻 | `server/src/engine/campaign.ts:605-625` |
| F4 | 快照冻结：`createBattle` 时编组固定；`BattleState` 无增援/队列字段（id/turn/phase/winner/units/log + duel 暂停） | `server/src/engine/battle.ts:323-338`，`shared/types/battle.ts:80-113` |
| F5 | 参战卫士现成：`armyInActiveBattle`（units 含该军 id 即参战）；强攻/劝降/撤退三处拒绝参战军；siege-storm 单列拒绝 | `campaign.ts:1348-1352`，`:1270/:1695/:1753`，`services/game.ts:1244` |
| F6 | 结算天然覆盖：`resolveStormArmies` 按「同势力 + sieging + target==cityId」解析攻方单位 armyId——到达转围城的增援军一旦入场，`exitBattle` 自动纳入结算；未入场（无单位）自动排除，零结算改动 | `campaign.ts:1370-1387`（`collectSiegeStormGroup :1361` 经 `exitBattle` 调用） |
| F7 | 容量与部署现成：多军侧单位帽 8（单军不限）；第 N 军锚点 r 轴偏移 ±4N；碰撞复用 `projectHexDeployment`；满帽整军策应 + 战报「屯于城下策应」 | `battle.ts:163/297`（`HEX_SIDE_UNIT_CAP=8`）、`:165/309`（`HEX_ARMY_ANCHOR_R_STEP=4`）、`:282-321`（`buildSideUnits`）、`services/game.ts:1269-1272` |
| F8 | 撤退按军现成：`retreatBattle(armyId?)` 只标记该军活跃单位，其余各军继续战斗 | `battle.ts:1067-1076` |
| F9 | 战斗回合边界现成：敌方阶段结算后 `turn+1`、`hasActed=false`、mp/energy 恢复、天气 tick；变阵置 `hasActed=true, mp=0` 为「入场即不可动」提供先例 | `battle.ts:1808-1852`，`:624`（docs/44 F7 同源） |
| F10 | 郡域增援先例：`maybeReinforceCommandery`——上限 2、`phase='garrison'` 不占军额、决策 RNG（0.3 + 攻方每占 1 县 +0.1，上限 0.7）、守方纵深部署 | `server/src/engine/aiMilitary.ts:234-279` |
| F11 | **风险**：AI 无守方避让——`aiMilitary.ts` 零 activeBattle 引用；`largestEnemyArmyAt` 按 `currentNodeId` 选取敌军，不滤参战军。S5b 实装前必须复核双重结算 | `campaign.ts:1660-1675`；S5b 切片含此复核（D10） |
| F12 | 单挑暂停：`duel` 非空时战场暂停（S4d 门禁先例）；增援不得在单挑中入场 | `shared/types/battle.ts:111` |

## 三、设计原则（沿 docs/43 R 纪律 + docs/44 P 纪律）

- **P1 零新随机源**：入场资格/军序/部署全确定性（沿 docs/43 D8/D9、docs/44 P2）。
- **P2 整军原子**：满帽整军不入战，不挤掉、不拆分、不合成单位（沿 D8 策应口径，F7）。
- **P3 结算零改**：入场军经 `resolveStormArmies` 自然结算（F6）；未入场在场军不受影响；`campaignArmies` 仍是唯一真源。
- **P4 手动先行、自动次之**：S5a 玩家手动（零月结改动）→ S5b 到达自动；AI 对称性交 D7 拍板（沿 docs/44 P4 的 AI 切片纪律）。

## 四、拍板点（D1~D10，各附推荐值）

| # | 拍板点 | 推荐值 |
|---|--------|--------|
| **D1** | 切片划分 | **S5a 策应军手动入场**（新端点五镜像 + BattleView 按钮；战斗内立即注入）→ **S5b 行军到达自动入场**（月结到达分支识别战斗城市 → 直接 units 追加）→ **S5c 后置**（城驻军出击 / AI 差异化 / 平衡轮） |
| **D2** | 入场资格 | 同势力 + `(targetNodeId ?? currentNodeId)==battle.cityId` + 该 `armyId` 不在 `battle.units` 中 + 未单挑暂停 + 仅围城亲统战（`battle.fromCityId==null`）；攻方军须 `phase='sieging'`、守方军 `sieging`/`garrison`（解围军抵达己方被围城即转驻守）入对应侧。野战出征/白刃不支持 |
| **D3** | 容量 | 沿 D8：入场后该侧军数 > 1 即 8 帽；`used + 该军单位数 > 8` 则整军继续策应 + 战报一行，不挤在场单位（P2） |
| **D4** | 部署 | 沿 D9：N = 该侧已入战军数，锚点 r 偏移 ±4N（攻 +／守 −，越界夹紧）；`occupied` = 在场单位位置累积；零 RNG |
| **D5** | 入场单位状态 | `hasActed=true、mp=0`（沿 F9 变阵先例），本回合不可动；兵力/士气沿 `unitsFromArmy` 取军现值 |
| **D6** | 到达自动时机（S5b） | `tickCampaignMarch` 到达分支内：目标城有未结算亲统战斗（`cityId` 一致、`fromCityId==null`）→ 转 `sieging` 后立即按 D2~D5 尝试入场，战报追加「X 军赶到战场」；单挑暂停中只转围城不入场（下月结或 S5a 手动补入）。同月多军到达按 `campaignArmies` 数组序（确定性） |
| **D7** | AI 对称 | **双向同规则自动**（沿 S1「AI/玩家同规则」纪律），AI 守方增援受上限（沿 F10 郡域先例 `MAX_AI_DEFENDER_REINFORCEMENTS=2`，按在场 `reinforcedArmyIds` 计数）——防添油战术；玩家/AI 攻方不受限。Session 445 落地 |
| **D8** | 新端点（S5a） | `POST /battle/reinforce`（body `{armyId}`）：玩家回合/未单挑暂停/D2 资格/D3 容量门禁 → units 追加（D4/D5）+ 战报/日志。走五处镜像（routes→services→worker→api/offline-api→store，D-0B-1 纪律）+ `verify-s416-worker-parity` 别名 |
| **D9** | UI（S5a） | 军令/战斗面板「增援入场」按钮（仅 D2 资格军可见）+ 入场战报行 + 军旗条按 `armyId` 区分（沿 docs/43 D12，434 已有军旗条） |
| **D10** | 前置修补 | S5b 实装前复核 F11：若 AI 自动战可选中参战军为 `enemyArmy`（双重结算），则 `largestEnemyArmyAt` 排除参战军——小修补随 S5b 立项，单独断言背书 |

## 五、不变量（R1~R5，供验收断言）

- **R1 零 RNG**：入场判定/军序（兵力降序 + armyId 回退，沿 `byTroopsDescThenId`）/部署零 RNG 消费；同种子双局逐字节一致。
- **R2 无增援路径逐字节不变**：单军/无到达月全链路与现状一致，由 turn-golden 护城（金样无六角战，零变化；若未来金样含六角战，按 433 流程删金样重举并明示原因）。
- **R3 存档兼容**：不新增必填字段（资格由 `campaignArmies` + `battle.units[].armyId` 派生；S5b 为 D7 上限增可选 `reinforcedArmyIds?: string[]`，旧档缺省按无增援兼容）；旧档缺省无增援行为。
- **R4 结算守恒**：入场军纳入 `resolveStormArmies`；未入场在场军（策应/帽满）不纳入；战后各军兵力按军归集守恒（沿 docs/43 R2 接力）。
- **R5 整军原子 + 卫士延续**：满帽整军不入；增援军入场后自动受 `armyInActiveBattle` 三拒绝保护（units 入列即生效，无需新卫士）。

## 六、验收方案

| 片 | 专项脚本 | 关键断言 |
|----|----------|----------|
| S5a | `verify-s45a-manual-reinforce`（engine 级）+ headless UI（沿 s434-ui 体例） | D2 资格正反（异势力/非围城/已入战/单挑暂停拒绝）/ 帽满整军策应 + 战报 / 部署无重叠 / 入场 `hasActed=true` 本回合不可动 / 结算纳入（`resolveStormArmies` 含增援军）/ 增援军独立撤退 / 双局确定性 / Schema / UI console 0 error |
| S5b | `verify-s45b-arrival-reinforce`（engine + 月结级） | 月结到达注入（攻方/守方）/ D7 上限 / 单挑暂停门禁（只转围城）/ 帽满留围城 + 下月可补 / F11 复核断言（参战军不被自动战重复结算）/ 双局确定性 / turn-golden 3/3 零变化 / Schema |
| 回归矩阵 | 沿 docs/44 §六体例 | turn-golden 3/3、campaign 71、ai-military 38、cadence 28、saves、s432/s433/s434/s435/s436/s44a~s44d、shared、server、client、三端 typecheck、parity、compliance、diff-check |

## 七、实施顺序与文档同步

S5a → S5b，每片一片一会话；每片双写 `04`（增援规则）+ `05`（六角增援段）+ `06`（新端点）+ `07`（UI）+ `10-progress` + `HANDOFF` + 本文件状态节 + `12` S10 行 + `35` 主线。S5c（城驻军出击/AI 差异化/平衡）另行立项——**已由 `docs/46-garrison-sortie-proposal.md` 收口：S5c 城驻军出击已于 Session 446 实装（`verify-s46-garrison-sortie` 23/23），S5d AI 差异化后置，平衡轮归 0-B**。

> **本文件状态**：Session 443 纯设计轮落盘；**S5a 已于 Session 444 实装**（策应军手动入场，引擎 `reinforceActiveBattle` + `POST /battle/reinforce` 五镜像 + BattleView 按钮/选择器，零新存档字段，入场军经 `resolveStormArmies` 天然纳入结算；`verify-s45a-manual-reinforce` 39/39 + `-ui` 23/23，金样零扰动）；**S5b 已于 Session 445 实装**（行军到达自动入场：`tickCampaignMarch` 到达分支注入 + D7 双向自动/AI 守方上限 2 + D10/F11 复核，可选 `reinforcedArmyIds` 记录，`verify-s45b-arrival-reinforce` 42/42，金样 3/3 零变化）；S5c 后置。

## 八、明确不做

- `engaged` 野战增援、白刃战 melee 增援（docs/43 D2 的 1v1 不动）。
- 城驻军主动出击（城 troops 无 Army 编成，数据缺口，S5c 后置）。
- 单挑暂停中入场；挤掉/替换在场单位；增援到达立即行动（首轮一律 `hasActed=true`）。
- 协同数值加成、合围战术分（沿 docs/43 D6，0-B 平衡轮）。
- AI 增援策略差异化（S5c 后置；首轮按 D7 同规则+上限）。
- 自然死亡/手动没收等 docs/44 数据门与 D7（各归其轮，不在本规格）。
