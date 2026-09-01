# 多军协同战斗（围城合流与六角多军）· 实装设计规格（S10 · Session 423）

> **来源**：`docs/12-system-map.md` S10「多军团仍后置」长债；`docs/42-multi-corps-delegation-design.md`
> §一表 3/§九明确「六角战场多军协同/增援入场另行切片」；HANDOFF Session 422「下一步」点名项。
> **状态**：纯设计规格轮，**D1~D12 均为推荐值，待用户批准（或改判）后进入实装**；批准前不写任何实装代码
> （沿 Session 419→420 先例）。数字真源：`docs/08-data-dictionary.md`（本规格暂不改数值真源；
> 若 D6/D8 数值被采纳，实装片再补 §真源条目）。

---

## 一、范围界定

`docs/42` §一已把「多军团」拆为两义：战役层多军并线（引擎已支持）／委任军团（docs/42 已实装）。
本规格处理第三义——**多支军在同一场战斗中协同**，分两层：

| 层 | 内容 | 现状 | 本规格 |
|----|------|------|--------|
| 战役层（自动战） | 同势力多军围同一敌城 → 合成一次自动战 + 围城进度共享 | ❌ 各军独立 siegeState、逐军各自 assault | ✅ S1 切片 |
| 战术层（六角） | 合流军全体入场同一六角战（玩家「亲统攻城」） | ❌ 六角恒单攻军/单守军 | ✅ S2 切片 |
| 战术层（增援入场） | 战斗进行中（回合中）援军入场 | ❌ | ❌ 另行立项（D1） |

**刻意不做**（§八）：engaged 野战多军合流、白刃战 melee 多军、回合中途增援、协同数值加成。

---

## 二、现状实勘（证据行号，Session 423 复核）

1. **围城无合流**：`tickCampaignMarch` 抵达敌城各军独立转 `phase:'sieging'`（`campaign.ts:500`）；
   行军终步新建**各自**的 `siegeState`（`campaign.ts:589-601`）——两支军围同城 = 两份独立
   wallDurability/siegeTurns，互不相干。附带发现：`campaign.ts:500` 到达分支**不初始化** siegeState
   （仅 589-601 行军终步初始化），属潜在缺口，S1 的 siegeState 归属主军规则将顺带修复（D5）。
2. **自动战单军**：`assaultForFaction` 每军独立调 `runAutoBattle`（`campaign.ts:1210-1252`）；
   守方口径 = 同节点**第一支**敌军 Army **或** 城驻军，二者取一不叠加（`campaign.ts:1228-1250`）；
   AI 月结逐军 assault（`aiMilitary.ts:183-205`）。两支军围同城 → 两场独立自动战，各自承受完整
   城防/守军，战力浪费且战报割裂。
3. **玩家无亲统攻城**：玩家围城军只有三途——`POST /campaign/:armyId/assault`（自动战，
   `routes/game.ts:974`）、`trySiegeSurrender`（劝降）、撤退；六角战入口仅 `startBattle`（城对城
   直接出征，legacy 双单位，`services/game.ts:780-793`）与白刃战 tactical（单军对单军，
   `services/game.ts:1846-1853`）。
4. **六角单军多队已支持**：`unitsFromArmy` 按 squads 生成多 `BattleUnit`（`battle.ts:200-253`，
   Session 297）；但 `createBattle` 仅接受单 `attackerArmy`/`defenderArmy`（`battle.ts:256-267`）。
5. **郡域成熟先例**：守方多军增援 `maybeReinforceCommandery`（上限 2、`phase='garrison'` 不占军额，
   `aiMilitary.ts:234-279`）；「合成副本迎战 + 按兵力占比回填残兵、尾差归最大支」
   （`engageCounty`，`services/game.ts:1625-1664`）——合成军与比例回流模式均有现成范式。
6. **多军并存已是常态**：D1 军上限 `maxFieldArmies=clamp(2+floor(城/5),2,6)`（Session 420 实装）+
   AI `maxActiveFronts` 动态化（Session 422）——军越多，「围城互不相干」的体验断层越放大。
7. **容量与结构**：六角网格 20×15=300 格（`battle.ts:81-82`）；`GameState.activeBattles` 已为数组；
   `BattleUnit.armyId` 字段现成，可按军归集结算。

---

## 三、设计原则（沿 docs/42 D7/D8 纪律）

- **先自动战后六角**：S1 收口战役层合流（AI+玩家同规则），S2 开六角多军入场；每片独立验收，
  一次会话一片。
- **确定性优先**：合流编组零新增 RNG（军序=兵力降序、尾差归主军、部署字典序回退）；
  `runAutoBattle` 内部 RNG 调用次数与顺序不变（合成军仅替换传参）。
- **真源不迁移**：`campaignArmies` 各军仍是真源；合成军是结算期临时对象（engageCounty 先例），
  结算按军比例回填，不新增存档字段。
- **单军路径逐字节不变**：无合流（单军围城）时一切行为与现状一致，由 turn-golden 护城。

---

## 四、拍板点（D1~D12，各附推荐值）

| # | 拍板点 | 推荐值 |
|---|--------|--------|
| **D1** | 切片划分 | **S1 战役层**：围城合流自动战 + siegeState 共享 + 按军比例回流（AI/玩家同规则）。**S2 战术层**：六角多军入场 + 新端点「亲统攻城」。回合中途增援入场不做，另行立项 |
| **D2** | 合流战斗范围 | 仅**围城**（`phase='sieging'` 攻城）合流；`engaged` 野战与白刃战 melee 保持 1v1 不动 |
| **D3** | 合流判定 | 同势力 + 同 `targetNodeId` + `phase='sieging'` 的全部 CampaignArmy **自动合流**，无需玩家编组操作；守方若同节点有多支 Army，取兵力最大一支迎战（口径对齐现状 1228-1234 行「第一支」→ 升级为「兵力最大」，更公平且确定性） |
| **D4** | 合成军口径（自动战/六角共用） | 不落库临时对象：`troops/food`=Σ；`morale/organization/fatigue`=按兵力加权（floor）；`formation/commanderId`=兵力最大军的；`squads`=各军 squads 拼接（军序=兵力降序，保 `squadFlankBonus`/`autoFormationMods` 语义）；各军真身不动 |
| **D5** | 围城进度共享 | `siegeState` 归属**主军**（同城合流军中兵力最大者）持有；后续军 join **不重置** wallDurability/siegeTurns（修复二·1 到达分支缺口）；主军撤退/溃败 → siegeState 转移给剩余最高兵力军；劝降 `trySiegeSurrender` 读主军 siegeState（围城月数共享） |
| **D6** | 协同数值加成 | **0-A 不引入**（合流本身即增益：集中兵力、共享围城进度、损耗一次结算）；加成/合围战术分留给 0-B 平衡轮 |
| **D7** | 自动战结算回流 | `attackerCasualties/defenderCasualties` 按各军兵力占比分摊（尾差归主军）；胜→占城走既有 `applyBattleResultToState`；战后各军 `troops = 原 troops − 分摊损耗`；R2 不变量兜底 |
| **D8** | 六角单位帽（S2） | 每侧 ≤ **8** BattleUnit；按军兵力降序逐军入战，满帽**整军不入战**（日志「X 军屯于城下策应」，该军不损耗不回流、继续围城）——不做军间合成单位（可解释性优先，0-B 再议压缩） |
| **D9** | 六角部署 | 主军 anchor 现状（攻 `{2,3}`／守 `{16,11}`）；第 N 军沿 r 轴偏移 4 格（攻 `r+4`、守 `r−4`，方向确定性），格占用复用既有 `projectHexDeployment` 碰撞收缩 + (q,r) 字典序回退搜索 |
| **D10** | 六角结算回流 | 胜利占城 = Σ各军存活兵力入城 + 各军解散（对齐单军现状）；败退/战术撤退 = 军内单位按既有 50%/存活规则聚合后**各军残兵回流各自 `fromNodeId` 城**（无 from 记录回流主军城）；单军撤退仅撤该军单位（`isRetreated` 单位级语义不变）；`settleTacticalMeleeTroops` 伤兵归队 15% 在军内单位层照旧 |
| **D11** | 亲统攻城端点（S2） | 新端点 `POST /api/game/campaign/siege-storm`（body `{armyId}`）：校验该军 sieging + 收集合流军（D3）→ 守方口径同 D3 → `createBattle` 多军 → `activeBattles`；走五处镜像 + `verify-s416-worker-parity` 自动盯；不新增存档字段（BattleState.units.armyId 已足） |
| **D12** | UI | 军列表/攻城终审标注「N 军合流 · 共 X 兵」；BattleView 军旗按 `armyId` 附加军名区分（多军可辨）；月结战报主语=「主军名等 N 支」；委任军团季报卡不改（单军评分链语义保持） |

---

## 五、不变量（R1~R4，供验收断言）

- **R1 军册真源**：`campaignArmies` 为唯一真源；合成军只在结算期存在，任何路径不得将其写回 state。
- **R2 比例守恒**：Σ各军分摊损耗 = 自动战总损耗（误差 ≤ 军数−1，尾差归主军）；回流后
  Σ各军兵力 = 合流前总兵力 − 总损耗。
- **R3 围城进度唯一**：同城同目标至多一份 siegeState（主军持有）；join/转移只迁移不重置。
- **R4 RNG 与单军等价**：`runAutoBattle` 内部 RNG 消费次数与顺序不变；**单军围城时全链路与
  现状逐字节一致**（turn-golden 护城）。

---

## 六、验收方案

| 片 | 专项脚本 | 关键断言 |
|----|----------|----------|
| S1 | `verify-s423-siege-merge`（engine 级） | 双军围同城 assault → 一次合成自动战（兵力=Σ）；损耗按比例分摊且尾差归主军；siegeState 共享/转移；劝降读主军围城月数；AI 对等（多军围城 AI 同样合成）；**单军路径与现状逐字节一致**；双局 24 月确定性；过完整 GameStateSchema |
| S2 | `verify-s424-hex-multi-army`（engine 级）+ headless UI | createBattle 多军编组（单位帽 8、满帽整军不入战日志、部署偏移无重叠）；`siege-storm` 端点五镜像 + parity 5/5；六角胜利按军解散入城 / 败退按军回流 from 城；单军路径等价；BattleView 军旗区分目检 |
| 回归矩阵 | turn-golden、campaign 71、ai-military-rng 38、save 全套、s374 44、parity 5/5 | **注意**：S1 改变「同城多军各打一场 → 合打一场」的 runAutoBattle 调用次数，若金样 12 月场景中存在同城多军围城，权威 RNG 流将前移——届时按既定流程**删金样重举**（同 Session 422），并在会话日志明示原因 |

---

## 七、实施顺序与文档同步

1. **S1**（Session 424 候选）：`engine/campaign.ts`（合流编组纯函数 + assaultForFaction 合流化 +
   tickCampaignMarch join 不重置）+ `engine/aiMilitary.ts`（逐军 assault 改合流 assault）+
   回流分摊；文档 04 §10.2/§17、05 攻城段、08（若数值落真源）、12 S10、10/HANDOFF 双写。
2. **S2**（S1 验收后）：`engine/battle.ts` createBattle 多军 + `services/routes/worker/offline-api/api/store`
   五处镜像 + BattleView/军列表 UI；文档 06（新端点）、07（CMD 域）、12、10/HANDOFF 双写。

## 八、明确不做

- 回合中途增援入场（援军行军抵达战斗现场即时入场）——牵动回合结构/RNG 顺序/平衡，另行立项。
- `engaged` 野战多军合流；白刃战 melee 多军（1v1 契约保持）。
- 协同数值加成、合围战术分、军团间指挥链（0-B 平衡轮）。
- 委任军团军事 AI 改多军协同调用（docs/42 S3 单军评分链保持，合流在其上层自然发生）。
- 双位置真源重构（R1~R4 成文约束即可，机制不动）。
- AI 势力委任化（docs/42 §九既定边界不变）。
