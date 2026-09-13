# 城驻军出击 · 实装设计规格（Session 446 纯设计轮）

> 前置：docs/45 S5a（策应军手动入场）/S5b（行军到达自动入场）均已落地（Session 444/445，仅覆盖**有 CampaignArmy 编成**的军）。
> 本规格收口 docs/45 §一/§八「城驻军出击（城 troops 直接参战，无 Army 编成）」数据缺口。
> 体例沿 docs/43~45（Session 443）：实勘行号 + D 拍板点（含推荐值）+ R 不变量 + 验收方案 + 切片。
> 状态：**S5c 已实装**（Session 446，D1/D2 用户拍板＝守方侧合成参战 / 开战即纳入 `createBattle`，D3~D10 按推荐值落地；`verify-s46-garrison-sortie` 23/23）；**S5d（AI 差异化）后置**。

## 一、范围界定

- **城驻军** = 城的常备守军，体现为纯数字 `City.troops` / `City.troopsMorale`；**无 CampaignArmy、无武将编队、不可行军**（F4）。
- **缺口**：六角亲统攻城守方口径 = 同节点兵力最大敌军 Army **或** 城驻军（legacy `def-1`），**二者取一不叠加**。当被围城内已有一支野战 Army 守城时，`city.troops` 常备守军被完全排除在战斗之外（F1/F2）——城内守军凭空消失。
- 本规格让城驻军在**围城亲统战**中以**无 Army 合成单位**直接参战（守方侧），并保证战后兵力守恒回写 `city.troops`。
- 不覆盖：`engaged` 野战、白刃战、Tier II 郡域实例层（`maybeReinforceCommandery` 已覆盖，F8）。

## 二、现状实勘（证据行号，Session 446 复核）

| # | 事实 | 证据 |
|---|------|------|
| F1 | 无 `defenderArmy` 时守方 = 合成 legacy 单位 `def-1`（`armyId:'d1'`、`side:'defender'`、heavyInfantry/SQUARE、位置 16,11），兵力 = `max(500, city.troops||4500) + 民兵` | `battle.ts:415-417`、`:451-474` |
| F2 | **二者取一不叠加**：`defTroops = opts.defendTroops ?? (defenderArmies ? Σtroops : …) ?? defenderArmy?.troops ?? max(500, city.troops…); + 民兵`——有守方 Army 时 `city.troops` **不计入**；守方选取 `largestEnemyArmyAt` 只认 `campaignArmies` | `battle.ts:415-417`；`campaign.ts:1721`；`services/game.ts:1278` |
| F3 | 民兵由人口×民心派生（非持久字段） | `shared/city-factions.ts:195` |
| F4 | 城驻军为纯数字，无实体 | `shared/types/city.ts:108-110`（`troops`/`troopsMorale`/`officers`） |
| F5 | 亲统结算从守方单位 `armyId` 反查真源军；legacy `'d1'` 反查不到 → `enemyArmy=undefined` → 走「城驻军」分支，胜负/撤退均把守军残值写回 `city.troops` | `campaign.ts:1501-1505`、`:1567-1599`、`:1652-1658`、`:1703-1714` |
| F6 | 自动战无同节点敌军 Army 时以 `{cityId, garrison: city.troops, wall}` 作守方；`runAutoBattle` 内守方 = `garrison + 民兵`，墙给 `wallPenalty` | `campaign.ts:1785`、`:1007-1018` |
| F7 | **从城 troops 编军 helper 现成**：`startCampaignForFaction` 支持 `phase='garrison'`（不占军额、`path=[]`），扣出发城兵力/粮草、选将编成 | `campaign.ts:445-530`（`:458-465`/`:480-487`/`:501-502`） |
| F8 | **最接近的成例**：`maybeReinforceCommandery` 从郡治城用 F7 编 garrison 军**直接注入 Tier II 实例**（不走路），上限 2、扣城兵/粮、纵深部署 | `aiMilitary.ts:251-339` |
| F9 | **AI 无守军出击**：`aiMilitary.ts` 对 `activeBattles` 零引用；只遍历 `sieging/engaged`（不含 `garrison` 军）；`delegation.ts:795` 同理 | `aiMilitary.ts:180-184`、`:463-472` |
| F10 | **单列约束 + 守方恒为 AI**：六角战仅由玩家 `doCampaignSiegeStorm` 创建（`createBattle` 调用点仅 legacy `:821` / storm `:1280` / tactical `:1965`）→ 围城亲统战的**守方恒为非玩家势力** | `services/game.ts:1256-1259`、`:1280` |
| F11 | 卫士/结算现成：`armyInActiveBattle`（units 含 id 即参战）、`resolveStormArmies`（仅按**有编成**攻方单位 armyId 解析） | `campaign.ts:1407`、`:1429` |
| F12 | 常量：`MIN_CAMPAIGN_TROOPS=1000`；守将选取口径 `pickCommander`（同城 ACTIVE、按 leadership×2+war） | `campaign.ts:92`；`aiMilitary.ts:90` |

## 三、设计原则

- **P1 零新随机源**：出击资格/规模/部署全确定性（沿 docs/43~45）。
- **P2 结算守恒**：守军入场扣 `city.troops`、战后按合成单位存活兵力 1:1 回写，恒等；不进入 `resolveStormArmies`（无 Army）。
- **P3 零新存档实体**：不新增 CampaignArmy、不新增必填字段；合成单位 id `garrison-<cityId>`，去重记录复用可选 `reinforcedArmyIds`。
- **P4 自动、可关**：六角战守方恒为 AI（F10）→ 无玩家手动面，出击为引擎自动行为；**AI 策略差异化**（是否出击/避让）归 S5d，本片只做确定性机械接入。
- **P5 无缺口不改**：无野战 Army 守城时 legacy `def-1` 已代表守军（F1），不重复出击；`city.troops < 下限` 不动。

## 四、拍板点（D1~D10，各附推荐值）

| # | 拍板点 | 推荐值 |
|---|--------|--------|
| **D1** | **语义（关键）** | **✅ 守方侧合成参战**（用户拍板）：被围城常备守军作为守方单位直接参战、无 Army 编成。备选 A「守军主动出击为独立野战/反击」（偏 AI 决策，归 S5d）；备选 B「只修 Tier II 郡域」（已由 F8 覆盖，无缺口） |
| **D2** | **触发时机** | **✅ 开战即纳入 `createBattle`**（用户拍板，`opts.garrisonSortie` 显式开启）——最简、确定性、直接闭合 F1/F2 缺口。备选「回合中途自动出击一次」未采纳 |
| **D3** | 资格 | 仅围城亲统战（`fromCityId==null`）、未结算未结束、城属 `battle.defenderFaction`、守方侧**为真实 Army**（否则 legacy `def-1` 已代表守军，防双计）、`city.troops ≥ 出击下限`、非单挑暂停（若 D2 选中途触发） |
| **D4** | 出击规模 | 推荐 **整城出击**（全部 `city.troops`，扣减至 0）；备选上限 `min(city.troops, 3000)`。出击下限推荐 `garrisonSortieMinTroops=500`（低于此不足一单位，仍留城） |
| **D5** | 编成/部署 | 合成单单位：`unitType heavyInfantry`、`formation SQUARE`；主将 = 城内 ACTIVE 武将（`pickCommander` 口径 F12，排除守方野战军主将与攻方主将），无则势力内补，仍无则**不生成**（保底不改现状）；`morale = city.troopsMorale`；部署锚点沿第 N 军 r 轴 −`HEX_ARMY_ANCHOR_R_STEP`（与在场单位避重、越界夹紧）；开战态 `hasActed=false`、正常移动力（非中途，不置待命） |
| **D6** | 结算守恒 | 合成单位存活兵力回写 `city.troops`，伤亡同步 `troopsMorale`；占城时清零（城已易主，走既有占城分支）；**不**进入 `resolveStormArmies` |
| **D7** | 去重/记录 | 合成 id `garrison-<cityId>` 每组战斗唯一（开战即注入，天然不重复），不进入 `campaignArmies`、**不**记入 `reinforcedArmyIds`（后者专用于回合中途增援 S5a/S5b）；零新字段 |
| **D8** | 自动战（非六角） | 推荐 **不动**：`runAutoBattle` 守方已含 `city.garrison`（F6），无缺口 |
| **D9** | AI 差异化 | 归 **S5d**（**已由 docs/47 Session 447 实装**：AI/委任对 `activeBattles` 感知与避让——激战军跳过/激战城不作出征源；AI 主动反应后置） |
| **D10** | 前置勘误 | docs/43:33「守方口径」引用 `campaign.ts:1228-1250` 已漂移（现为 `runAutoBattle` 单挑/士气），勘误为 `campaign.ts:1721 largestEnemyArmyAt` + `services/game.ts:1278`；随本片立项修正 |

## 五、不变量（R1~R5，供验收断言）

- **R1 零 RNG**：资格/规模/部署/结算零 RNG 消费；同状态双局逐字节一致。
- **R2 无缺口路径逐字节不变**：无野战 Army 守城（legacy 分支）/`city.troops < 下限`/`engaged` 野战/自动战——全链路与现状一致，turn-golden 护城。
- **R3 存档兼容**：不新增必填字段；合成守军开战即注入 `battle.units`（旧档无合成单位即无出击），不新增 `CampaignArmy`。
- **R4 结算守恒**：守军入场扣减 `city.troops` = 战后回写存活兵力 + 阵亡；跨占城/撤退/败北三径守恒。
- **R5 无实体不变量**：不新增 CampaignArmy；`resolveStormArmies`/`armyInActiveBattle` 对合成 id 不误认（合成 id 不属 `campaignArmies`）。

## 六、验收方案

| 片 | 专项脚本 | 关键断言 |
|----|----------|----------|
| S5c | `verify-s46-garrison-sortie`（engine 级，**已实装 23/23**） | D1/D2 合成守军入场（有野战 Army 守城场景）/ D3 资格正反（无 Army 时不重复、troops 不足、城不属守方、未开启）/ D4 整城扣减 / D5 编成（主将区分、无将保底不生成）/ D6 结算守恒三径（野胜/败北/撤退回写恒等）/ R1 双局确定性 / R3 Schema / R2 turn-golden 3/3 零变化 |
| S5d | `verify-s46-ai-sortie`（AI 决策级） | AI 主动出击门槛/避让/`activeBattles` 感知；零额外 RNG 或显式拍板 |
| 回归矩阵 | 沿 docs/45 §六体例 | turn-golden 3/3、campaign 71、ai-military 38、cadence 28、saves、s432~s436、s44a~s44d、s45a/s45b、shared、server、client、三端 typecheck、parity、compliance、diff-check |

## 七、实施顺序与文档同步

S5c（守方合成参战 + 结算守恒）→ S5d（AI 差异化）。每片一会话；双写 `05`（六角守方段）+ `08`（数值真源，若新增常量）+ `10-progress` + `HANDOFF` + 本文件状态节 + `12` S10 行 + `35` 主线。平衡轮归 0-B（暂缓）。

> **本文件状态**：Session 446 落盘并**同轮实装 S5c**（D1/D2 用户拍板，D3~D10 按推荐值落地）：`battle.ts` 增 `GARRISON_SORTIE_MIN_TROOPS/GARRISON_SORTIE_ARMY_PREFIX/isGarrisonSortieUnit` + `buildGarrisonSortieUnit` + `CreateBattleOpts.garrisonSortie`；`services/game.ts` `doCampaignSiegeStorm` 开启并扣减城 troops；`campaign.ts` `settleSiegeStormBattle` 单列合成守军、野胜/败北/撤退回写守恒。`verify-s46-garrison-sortie` 23/23，金样 3/3 零变化。D10 docs/43 行号勘误已随本片落定。

## 八、明确不做

- `engaged` 野战、白刃战、Tier II 郡域实例层的守军出击（F8 已覆盖 Tier II）。
- 守军出击为独立野战/反击战斗（若 D1 选备选 A，另归 S5d）。
- 玩家手动出击面（F10：六角战守方恒为 AI，无玩家防守方）。
- 新增必填存档字段、新增 CampaignArmy 实体、合成军参与 `resolveStormArmies`。
- 城防/民兵数值平衡调整（归 0-B 平衡轮）。
