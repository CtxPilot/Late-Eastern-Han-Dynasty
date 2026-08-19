# API 接口设计

## 一、基础规范

```
Base URL:    /api/v1
协议:        REST (操作) + WebSocket (推送)
数据格式:    JSON (Content-Type: application/json)
认证:        Session (单机模式下简化，sessionId 标识游戏实例)
```

### 1.1 统一响应格式

```typescript
// 成功
{
  "success": true,
  "data": { ... },
  "meta": { ... }
}

// 错误
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "人类可读错误信息"
}
```

### 1.2 错误码

| 状态码 | 错误码 | 说明 |
|:--:|------|------|
| 400 | BAD_REQUEST | 参数校验失败 |
| 404 | NOT_FOUND | 目标不存在 |
| 409 | INVALID_STATE | 操作与当前状态冲突 |
| 422 | INSUFFICIENT_RESOURCES | 资源不足(金/粮/行动力) |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

---

## 二、REST API 列表

### 2.1 游戏生命周期

```
POST   /api/v1/games
  创建新游戏
  Body: { scenarioId: number, factionId: number }
  Response: { gameId: string, gameState: GameState }

GET    /api/v1/games/:id
  获取完整游戏状态
  Response: { gameState: GameState }

PUT    /api/v1/games/:id/turn
  推进回合(结束当前回合)
  Body: {}
  Response: { gameState: GameState }
  Note: 此为批量操作，触发所有AI势力的行动，耗时较长。
        期间通过 WebSocket 推送中间状态。

POST   /api/v1/games/:id/save
  保存游戏
  Body: { name: string }
  Response: { saveId: string }

GET    /api/v1/games/:id/saves
  获取存档列表
  Response: { saves: SaveMeta[] }

POST   /api/v1/games/:id/load/:saveId
  读取存档
  Response: { gameState: GameState }
```

> **实现状态（Session 311/312/340）**：浏览器文件层仍可用；命名槽位 API 不变：`GET /api/game/save/slots` 列表，`POST /api/game/save/slots/:slot` 保存，`POST /api/game/save/slots/:slot/load` 读取并复用同一迁移、剧本兼容、完整 Schema 与 RNG 校验链。**Session 340** 起服务端介质为 `$XDG_DATA_HOME/leh/saves.db`（`better-sqlite3`，未设置 XDG 时为 `~/.local/share/leh/saves.db`）；旧目录 `leh/saves/*.json` 在首次打开库时迁入并改名为 `*.json.migrated`。顶部系统菜单槽位 UI 已接通。槽位名限制为 1~32 位字母/数字/`_`/`-`，单档 ≤2MB；多用户和云同步仍未实现。

### 2.2 内政

```
POST   /api/v1/games/:id/cities/:cityId/develop
  城市开发
  Body: { officerId: number, type: 'farm' | 'commerce' | 'wall' | 'morale' }
  Response: { city: City, officerActionUsed: boolean }

POST   /api/v1/games/:id/cities/:cityId/recruit
  征兵
  Body: { officerId: number, count: number }
  Response: { city: City, newTroops: number, costGold: number, costPopulation: number }

POST   /api/v1/game/:id/cities/:cityId/train
  训练
  Body: { officerId: number }
  Response: { city: City, moraleGain: number }
```

#### Demo 现行路径（非 /v1，2026-07 实现）— **全部已实现**

> **状态**：以下 30+ 个端点均为活跃实现，覆盖 S01~S11/S17/S18 全部 Demo 功能。  
> 正式 API 仍以 `/api/v1` 为目标设计（见 §2.1~2.13）；当前 monorepo Demo 使用 `/api/game` 简化路径。  
> **S06**：所有返回 `GameState` 的接口经 `maskGameStateForPlayer` 脱敏（迷雾/同盟/侦查档）；服务端内存仍持全量。

```
GET    /api/game/static              → { scenarios, events, cities, units, ... }
  scenarios 含剧本级 factionSetups、年月、推荐势力、可用/默认事件史料层
POST   /api/game/create              { scenarioId, playerFactionId, eventLayers? } → GameState
  校验势力可玩且已登场；eventLayers 必须是该剧本允许的非空子集
GET    /api/game/state               → GameState（经 mask）
POST   /api/game/end-turn            → GameState
  每次只推进 1 月；含人口生育衰老、结构粮耗、产粮、AI、事件 tick
  每月 actionLog 写 end_turn；新月份为 1/4/7/10 时写 quarter_start；
  跨年至 1 月时同时写 year_start
  有 pendingEvents 时 400「请先处理待决事件」
POST   /api/game/event/choose        { eventId, choiceIndex } → GameState
  // S14：只允许处理 pendingEvents[0]；应用效果并写 completedEvents/eventChoices

POST   /api/game/civil/develop       { cityId, kind: 'farm'|'commerce'|'wall' }
POST   /api/game/civil/develop-farm  { cityId }   // 兼容
POST   /api/game/civil/conscript     { cityId }   // 扣 adultMale，见 04§28
POST   /api/game/civil/relief        { cityId }   // 施米
POST   /api/game/civil/train         { cityId }   // 士气
// CMD-P20：征兵/训练玩家 UI 统一迁入“军事·军备”，显式选择己方 cityId；
// 右栏旧提交按钮已删除。两条命令进入统一终审，并在确认前复验城市归属、金粮、
// 可征成年男丁或最低驻军。复用以上端点，请求/响应、权威 RNG、数值与 Schema 均未变化。
// CMD-P21：军事域总验收确认以上军备端点与 campaign 端点均只有命令坞玩家入口；
// /march 仍仅供 S21 现有场景兼容调用，无玩家 UI。总验收没有新增或修改端点。
// CMD-P22：内政迁移前审计确认 develop/relief 属 S03；现有右栏四按钮均点击即提交，
// 尚无统一终审。下一阶段只读总览不会新增端点；写链迁移继续复用以上 API。
// CMD-P23：内政只读抽屉直接读取当前 GameState 的己方城市列表与城市字段，不新增 API；
// 四分面无提交入口，右栏旧写链保持不变。CMD-P24 才迁移 develop/relief。
// CMD-P24：develop/relief 玩家入口迁入命令坞对应分面并统一终审，显式提交 cityId；
// 确认前复验归属和100/100/120金或150粮。复用既有端点，API/响应/权威 RNG 均不变。
POST   /api/game/civil/seek-beauty       { cityId }           // 兼容路由：地方结交；60金；成功 courtNetwork+1、城市机会−1
POST   /api/game/civil/search-beauty     { cityId }           // 兼容 → seek-beauty
// 注意：seek-beauty 路由前缀为历史兼容，业务引擎真源是 S09 beauty.ts，不属于 S03；
// CMD-P25：用户批准在“内政·总览”提供明确标注为“S09 宫廷人脉”的跨系统入口；
// 统一终审并显式提交 cityId，确认前复验归属、人脉机会≥1与金≥60。右栏旧入口删除。
// R7 已将权威字段迁为 courtNetwork/courtNetworkOpportunities；旧路由名暂作客户端兼容。
POST   /api/game/personnel/reward-beauty { officerId, amount? } // 兼容路由：动用宫廷人脉→忠诚

POST   /api/game/personnel/marry       { femaleId, officerId }  // 婚配 300金
POST   /api/game/personnel/join-faction  { officerId, factionId, cityId? }  // S18 跟随：入势力，妻跟随
POST   /api/game/personnel/search          { cityId }              // S11 搜索：己方城 80金
POST   /api/game/personnel/recruit         { officerId, recruiterId? } // S11 登用在野男将 200金；R2 UI 显式提交君主并显示共享成功率
  // CMD-P10：命令坞“人事”已成为名册/招贤/任官/赏罚唯一入口；
  // 搜索、登用仍复用上述端点和同一 store action。UI 只保存城市/候选草稿，
  // 确认前重校验，未新增 API 或业务缓存；旧人事手风琴已物理删除。
POST   /api/game/personnel/appoint         { officerId, track: civil|local|military, position, cityId? }
                                      // S11/S12 任命；position=none 解职；太守等 needsCity
POST   /api/game/court/grant-nobility      { officerId, targetRank }
                                      // HC-P1-4 王命封爵；逐级且臣属最高公
POST   /api/game/personnel/release-officer { officerId }  // S18 跟随：释放为在野
POST   /api/game/personnel/follow-check  {}  // S18 跟随：手动触发投奔检定
// CMD-P35：婚配与手动跟随虽沿用 personnel 路由，业务归属均为 S18；命令坞家族新写入口为0。
// join-faction/release-officer 是 S11/占城等流程调用的关系同步能力，不作为家族 UI 命令复制。
// 子女登场是开局/年度共享结算，无独立 API。后续迁移继续复用现有端点与权威 RNG。
// CMD-P36：命令坞家族四分面只从当前 GameState + /static children 摘要派生，
// 无请求、无提交；上述既有端点仍只由旧 FamilyPanel/共享流程调用。
// CMD-P37：marry 与 follow-check 玩家入口迁入 FamilyOverviewDrawer 并统一终审；
// 确认前复验双方归属、婚姻状态、18岁门槛、正妻、支付或在野候选状态。
// 具名女性赠与端点已删除；旧 giftedToOfficerId 只在读档迁移中清空。
// CMD-P38：旧 FamilyPanel 与左栏入口物理删除；marry/follow-check 仅余命令坞玩家入口。
// join-faction/release-officer 与子女年度结算仍为共享流程，不新增或复制玩家按钮。

POST   /api/game/intel/recruit         { cityId }  // 招募：人数/等级∝男成+驻军
POST   /api/game/intel/recruit-female  { cityId }  // 训练女间谍：耗 courtNetwork 2+金100，agentKind='female'
POST   /api/game/intel/plant-female    { targetFactionId, homeCityId? }  // 牵线点化：plantable≥1+对方courtNetwork≥1+金80
POST   /api/game/intel/mission         { agentId, type: recon|sabotage|assassinate|pillowTalk|sowDiscord, targetCityId }  // pillowTalk/sowDiscord 仅限女间谍
POST   /api/game/intel/station         { agentId, cityId }  // 驻守反间
POST   /api/game/intel/unstation       { cityId }
POST   /api/game/intel/captive         { agentId, action: hold|execute|release|exchange }

// CMD-P30：上述 S07 端点继续由左栏 SpyPanel 唯一调用，命令坞情报新写入口为0。
// CMD-P31：IntelOverviewDrawer 仅消费已迷雾裁剪的 /game/state，不新增端点；
// 上述写端点仍由 SpyPanel 唯一调用，待 P32/P33 分批迁移。
// CMD-P32：/intel/recruit、/intel/recruit-female、/intel/plant-female 的玩家入口已迁至
// IntelOverviewDrawer“人员”；端点与引擎契约不变。敌方 courtNetwork 受迷雾裁剪，
// plant-female 的目标库存条件只由服务端权威复验。
// CMD-P33：/intel/mission、/intel/station、/intel/unstation、/intel/captive 的玩家入口已迁至
// IntelOverviewDrawer“任务/反间”；五类任务、驻防/撤防与处决/释放统一终审并复验最新状态。
// CMD-P34：旧 SpyPanel 源码/DOM 已删除；上述 S07 端点仅由 IntelOverviewDrawer 玩家入口调用。
// 计略跨域 intel/recon 只切换到任务分面，不新增或复制 API。
// 本轮只迁移入口、草稿、终审与确认前复验，不改端点、引擎、RNG 或存档契约。
// /intel/plant-female 是 S07∩S08∩S09 交叉链；外交只积累额度，情报负责点化。

POST   /api/game/plot/launch          { type: honeyTrap|sowDiscord|falseIntel|emptyFort|undermine|secretCrossing|..., targetFactionId?, targetCityId?, feintCityId?, targetOfficerId?, agentId? }
                                     // L1 战术计谋：honeyTrap(美人计)·sowDiscord(离间)·falseIntel(假情报)·emptyFort(空城)
                                     // CMD-P29：四计仅由命令坞抽屉复用本端点；旧左栏入口已删除
                                     // 客户端终审前复验上限/情报/盟友/资源/目标，服务端仍作最终权威校验
                                     // L2 战略计谋：undermine(釜底抽薪 · Session 339)·secretCrossing(暗渡陈仓 · Session 341；feintCityId=明修、targetCityId=暗渡)
                                     //             ·blossom(树上开花 · Session 342；己方城、金150+粮100，无情报前置)
                                     //             ·killChicken(指桑骂槐 · Session 343；即时、金100、己方低忠诚≥2；可选 targetOfficerId)
                                     //             ·strikeWhileHot(趁火打劫 · Session 344；即时、金150、目标同时交战≥2；targetFactionId；首击×1.2)
                                     //             ·lureTiger(调虎离山 · Session 346；金200+50×2、detailed+女间谍必派、可选 targetOfficerId；PREP→诱离 ACTIVE 城防×0.5)
                                     //             ·instigate(借刀杀人 · Session 347；金300+女间谍、detailed、feintCityId=第三方源城、secondaryFactionId)
                                     //             ·poach(秘密挖角 · Session 347；金100~500+50×2、detailed、targetOfficerId 必填)
                                     //             ·watchFire(隔岸观火 · Session 347；金400+80×3、targetFactionId+secondaryFactionId、友好≥40)
                                     //             ·swapPillar(偷梁换柱 · Session 347；金300+密探、detailed)
                                     //             ·edict(借尸还魂 · Session 347；金300、targetFactionId；无献帝识破+25)
                                     // L2 投入规则：prep 消耗按月扣 · progress 进度条 · 可提前终止（指桑骂槐/趁火打劫即时 RESOLVED 无需终止）
                                     // Session 341：暗渡陈仓须两邻接敌城 surface；成功后明修牵制 + 暗渡自动战攻防×1.2
                                     // Session 342：树上开花成功后该城 AI 攻击权重×0.4、迷雾兵力虚报×2~3（按城市 ID 派生）
                                     // Session 343：指桑骂槐即时成功；儆猴忠诚−15；其余在职非君主+5~8
                                     // Session 344：趁火打劫即时成功（无识破、不可取消）；效果窗口=目标当前仍≥2家交战；自动战首回合 defLoss×1.2
                                     // Session 347：L2 十一计收口；launch 可带 secondaryFactionId；借刀/挖角/观火/换柱/还魂已实装

POST   /api/game/plot/cancel          { plotId }
                                     // Session 339：提前终止 L2 战略计谋，沉没成本不返还

GET    /api/game/plot/progress        → { plots: Plot[], progress: { [plotId]: number } }
                                     // L2 执行进度（亦可直接读 GameState.plots[].progress）

POST   /api/game/civil/civilian-farming { cityId, households }
                                     // Session 339：民屯田分配（0~上限）；每城每季限一次；无金消耗

POST   /api/game/civil/military-farming { cityId, enabled }
                                     // Session 345：军屯田开关；每城每季限一次；开启需兵力>0/非围攻/非出征
                                     // 月结产粮 floor(troops×(farm/100)×seasonMul×0.5)；季度首月士气−3；训练收益减半

POST   /api/game/civil/relocate-families { fromCityId, toCityId }
                                     // Session 348：质任迁家属；金500；每城每季一次；家属口迁入后方城

POST   /api/game/policy/set           { type: prepareDefense|befriendFarFightNear|playFool|guestHost|highWallsGrain|strikeWeak|scorchedEarth|hideStrength, targetCityId? }
                                     // Session 348：L3 国策切换；当前策立即结束；新策下月生效；冷却 6 月
                                     // scorchedEarth 须 targetCityId=己方边境城
GET    /api/game/policy/current       → { activePolicies: NationalPolicy[], pending: NationalPolicy|null, cooldown: number }

POST   /api/game/diplomacy/tribute     { targetFactionId }  // 进贡 200金，友好+15
POST   /api/game/diplomacy/court-network { targetFactionId, amount? }  // 宫廷人脉−n/对方+n，友好+12×n（1~5）
POST   /api/game/diplomacy/alliance    { targetFactionId }  // 结盟 500金，友好≥30；R2 权威概率判定，成败均扣金

// CMD-P13：命令坞外交“交涉”已复用 tribute / court-network 两条既有端点及统一终审；
// CMD-P14：命令坞“盟约”复用 alliance 端点、shared 成功率和权威 RNG。均未新增 API；
// CMD-P15：旧外交入口已删除；/intel/plant-female 在谍报面板成为点化唯一入口。
// 客户端仅复验目标存活、plantable 与己方金钱；受迷雾裁剪的敌方 beauty 由服务端权威校验。

POST   /api/game/march               { targetCityId, fromCityId?, troopCount? }
  → { game, battle }  // 须道路邻接；默认邻接己方城；服务端以未脱敏权威状态校验目标归属/守军
                    // battle.units[].commanderName 是正式交战后揭示的姓名快照；
                    // 不要求 game.officers 放宽非交战区域的 S06 迷雾
GET    /api/game/march/suggest-from/:targetCityId → { fromCityId }
GET    /api/game/march/can-reach/:targetCityId → { ok: boolean }
// CMD-P16：上述旧简化出征与 /campaign/start 完整 Campaign Army 编成是两套生产链；
// 本轮只审计并建立浏览器基线。军事命令坞写按钮仍为0，未新增/改动任何端点；
// P18 前必须先决定归并与兼容下线路径，禁止把两套出征同时迁入新抽屉。
// CMD-P17：军事命令坞的军备/编成/军令/战报仅从现有 GameState 与 lastBattleResult
// 派生只读摘要；未调用或新增军事 API，新写按钮仍为0，旧入口仍是唯一提交路径。
// CMD-P18：玩家正式出征已统一到 /campaign/start；命令坞“军事·编成”复用该端点与
// campaignStart store action。右栏 /march 玩家按钮和左栏旧编成表单均已删除。
// /march 暂保留给 S21 engageJiangling 兼容适配，不再是玩家 UI 生产入口；本轮无端点变更。
// CMD-P19：/campaign/assault、/campaign/surrender、/campaign/retreat、
// /campaign/build、/campaign/advisor 及对应 store action 统一由“军事·军令”调用。
// 左栏战役写按钮已删除；所有动作进入统一终审并在提交前复验最新阶段/参谋/资源。
// 本轮复用既有端点，无请求、响应、Schema、规则或数值变化。
POST   /api/game/battle/start        { cityId, fromCityId? }  // 兼容，内部走出征
POST   /api/game/battle/move|attack|fire|finish-player|enemy-phase
  // fire: { attackerId, targetId } 火计，耗气30
GET    /api/game/battle/abilities/:unitId → { abilities: UsableAbility[] }  // S10 可用战法
POST   /api/game/battle/ability   { attackerId, targetId, abilityId }  // S10 施放战法
POST   /api/game/battle/exit         → GameState  // 结算占城或残兵回流
```

征兵响应中的人口变化：`demographics.adultMale` 下降、`population` 同步；S09 人脉不变。
地方结交只消耗金和 `courtNetworkOpportunities`，不扣成年女性、不生成历史女角。
出征胜：目标 `ruler` 改玩家、残兵驻防、敌同城武将→在野、**全部存活攻方主将**迁入、拆敌反间；败/撤：部分兵力回 `fromCityId`。  
进贡/结盟/回合末：扣 **城金** 后 `syncFactionResources` 写回 `faction.gold/food`。

### 2.3 人事

```
POST   /api/v1/games/:id/cities/:cityId/search
  搜索(在野武将/宝物)
  Body: { officerId: number }
  Response: { found: Officer | Item | null, foundType: 'officer' | 'item' | 'none' }
  > Session 266：宝物分支已由纯功绩模拟改为真宝物入库（`searchTreasureIntoInventory` 入势力库存，零新增 RNG 消费），现行路径 `POST /api/game/personnel/search`（Body `{ cityId }`，返回 GameState）。

POST   /api/v1/games/:id/officers/:officerId/recruit
  登用在野武将
  Body: { recruiterId: number }
  Response: { success: boolean, recruitedOfficer?: Officer, loyalty: number }

POST   /api/v1/games/:id/officers/:officerId/reward
  赏赐
  Body: { gold: number, itemId?: number }
  Response: { officer: Officer, loyaltyGain: number }

POST   /api/v1/games/:id/officers/:officerId/appoint
  任命
  Body: { position: string, cityId?: number }
  Response: { officer: Officer }
```

Demo 实际 `POST /api/game/personnel/appoint` 的 `track='hegemony'` 继续编排同一任命引擎。
HC-P1-3 后 `position` 可取霸府三职或王国六职；王国六职仅允许 `king/emperor`，均为势力唯一，
同一人物的新朝职覆盖旧 `hegemonyPosition`。服务/API/store 不另建王国任命旁路。

HC-P1-4 `POST /court/grant-nobility` 只编排权威 `grantNobility`。`targetRank` 必须等于受封者
当前爵位的下一等级；服务端拒绝诸侯/霸府阶段、君主、异势力、非在职、越级、超过公及皇权不足。
成功原子写爵位、扣皇权并记录 `grant_nobility`；不存在撤销端点。

### 2.4 军事

```
POST   /api/v1/games/:id/armies/march
  出征/编队
  Body: {
    commanderId: number,
    subCommanderIds: number[],
    advisorId?: number,       // 参谋（新增）
    subAdvisorId?: number,    // 副参谋（新增）
    fromCityId: number,
    targetCityId: number,
    unitType: UnitType,
    formation: FormationType,
    troopCount: number,
    food: number
  }
  Response: { army: Army }

POST   /api/v1/games/:id/armies/:armyId/transport
  运输(粮草/金钱)
  Body: { destinationCityId: number, gold?: number, food?: number }
  Response: { army: Army }

POST   /api/v1/games/:id/armies/:armyId/recall
  召回部队
  Body: {}
  Response: { army: Army }
```

### 2.5 战斗

```
POST   /api/v1/games/:id/battles/start
  发起战斗(两军相遇自动触发或主动攻击)
  Body: { attackerArmyId: number, defenderArmyId: number }
  Response: { battle: BattleState }

GET    /api/v1/games/:id/battles/:battleId
  获取战斗状态
  Response: { battle: BattleState }

POST   /api/v1/games/:id/battles/:battleId/move
  移动部队
  Body: { armyId: number, targetHex: { x: number, y: number } }
  Response: { battle: BattleState }

POST   /api/v1/games/:id/battles/:battleId/attack
  攻击
  Body: { attackerArmyId: number, targetArmyId: number }
  Response: { battle: BattleState, combatLog: BattleLogEntry }

POST   /api/v1/games/:id/battles/:battleId/tactic
  使用计策
  Body: { casterArmyId: number, tactic: SkillType, targetHex?: { x: number, y: number } }
  Response: { battle: BattleState, result: string }

POST   /api/v1/games/:id/battles/:battleId/duel/challenge
   发起单挑 ✅ 已实装（Session 88）
   Body: { challengerUnitId, targetUnitId, stance: 'assault'|'steady'|'bait'|'delegate' } ✅ R3 已实装
   Response: { duelState: DuelState }
   说明: 发起方消耗20气力；非法/缺失 stance 返回400；target自动/拒绝见 §8.3.2；接受后引擎自动推进首回合

POST   /api/v1/games/:id/battles/:battleId/duel/respond
   回应单挑挑战（目标规则允许玩家应战时选择倾向；当前 0-A 仍由 challenge 内部自动处理）
   目标 Body: { accept: boolean, stance?: 'assault'|'steady'|'bait'|'delegate' }
   Response: { duelState: DuelState | null }

POST   /api/v1/games/:id/battles/:battleId/duel/action
   提交逐回合单挑指令（废止：目标规则不让玩家逐回合点牌；仅保留兼容说明）
   Body: { action: DuelAction }
   Response: { duelState: DuelState, roundResult: DuelRound }

POST   /api/v1/games/:id/battles/:battleId/duel/step  ✅ 已实装（Session 88）
   推进单挑一回合（观看演出模式逐回合）
   Response: { duelState: DuelState }

POST   /api/v1/games/:id/battles/:battleId/duel/skip  ✅ 已实装（Session 88）
   跳过动画直接结算（fast/skip）
   Body: { mode: 'fast' | 'skip' }
   Response: { duelState: DuelState, finalResult: DuelResult }

GET    /api/v1/games/:id/battles/:battleId/duel/state
   查询当前单挑状态（可从 battle.duel 读取）
   Response: { duelState: DuelState }

POST   /api/v1/games/:id/battles/:battleId/changeFormation
  切换阵型
  Body: { armyId: number, newFormation: FormationType }
  Response: { battle: BattleState }

POST   /api/v1/games/:id/battles/:battleId/retreat
  撤退
  Body: { armyId: number }
  Response: { battle: BattleState, retreatSuccess: boolean }
```

#### 独立郡域战场 API（P1～P3 规划，BF-P2 已实装子集）

> Q1～Q8 已批准；以下为正式接口方向。**BF-P2 已实装（Session 174~176）：**
> 以下 4 个 Demo 端点在 `/api/game/battlefield-instance/*` 路径下已可用：
> - `POST /api/game/battlefield-instance/enter` — 进入南郡郡域战场（Q10）
> - `POST /api/game/battlefield-instance/exit` — 退出清空 activeBattlefieldInstance（Q10）
> - `GET /api/game/battlefield-instance` — 获取当前实例（Q10）
> - `POST /api/game/battlefield-instance/engage-county` — 攻打首批 3 县（Q9，Body: `{ countyId }`）
>
> 现有 Demo `/api/game/battlefield/*`（Tier I 大地图层）与 `/api/game/battlefield-instance/*`（Tier II 郡域层）并存，场景栈强制互斥。

```text
POST /api/v1/games/:id/battlefields
  创建战争与战场实例
  Body: { campaignArmyId, targetCommanderyId, entryRouteId }
  Response: { battlefield: BattlefieldInstance }

POST /api/v1/games/:id/battlefields/:battlefieldId/enter
  Army 到达郡界后从已校验入口进入
  Body: { armyId, entryNodeId }
  Response: { battlefield: BattlefieldInstance }

POST /api/v1/games/:id/battlefields/:battlefieldId/armies/:armyId/march
  郡域节点间行军
  Body: { targetNodeId }
  Response: { battlefield: BattlefieldInstance, encounter?: Encounter }

POST /api/v1/games/:id/battlefields/:battlefieldId/encounters
  同节点接触、攻击驻军或强攻城池时创建接战
  Body: { nodeId, attackerArmyIds, defenderArmyIds }
  Response: { encounter: Encounter }

POST /api/v1/games/:id/battlefields/:battlefieldId/encounters/:encounterId/start
  从同一战前快照选择自动/标准/六角微操
  Body: { mode: 'auto' | 'standard' | 'tactical' }
  Response: { encounter: Encounter, melee?: MeleeState, battle?: BattleState }

POST /api/v1/games/:id/battlefields/:battlefieldId/encounters/:encounterId/settle
  接战结果幂等回写郡域实例
  Body: { result: EncounterResult }
  Response: { battlefield: BattlefieldInstance }

POST /api/v1/games/:id/battlefields/:battlefieldId/settle
  战争结束后原子回写行政大地图
  Body: { expectedVersion, settlementId }
  Response: { settlement: BattlefieldSettlement, gameState: GameState }
```

权威边界：

- 服务端校验外交、Army 归属、入口、节点邻接、接战双方和结算版本；客户端不得直接提交控制权或伤亡差值。
- `settlementId` 必须幂等；一支 Army 不得同时属于两个活动战场。
- P2 起 `BattlefieldInstance` / `Encounter` 进入完整 `GameState` 快照；场景栈、镜头和动画不进入 API 存档负载。
- P3 所有动态生成及战场 AI 行动选择统一消费权威 `xorshift32-v1`，禁止客户端或端点私建随机源。
- Session 250：进入南郡端点响应中的实例可含 `dynamicSituation` 与完整生成审计；无新增端点。

### 2.6 外交

```
POST   /api/v1/games/:id/diplomacy/alliance
  提议同盟
  Body: { targetFactionId: number, terms: AllianceTerms }
  Response: { success: boolean, newRelation: DiplomaticRelation }

POST   /api/v1/games/:id/diplomacy/marriage
  政治联姻
  Body: { femaleId: number, targetFactionId: number, targetOfficerId?: number }
  Response: { success: boolean }

POST   /api/v1/games/:id/diplomacy/tribute
  进贡
  Body: { targetFactionId: number, gold: number, food: number }
  Response: { newFavorability: number }

POST   /api/v1/games/:id/diplomacy/persuade
  劝降
  Body: { targetFactionId: number }
  Response: { success: boolean }

POST   /api/v1/games/:id/diplomacy/requestAid
  请求援军
  Body: { targetFactionId: number, targetCityId: number }
  Response: { success: boolean }
```

### 2.7 人事·婚姻

```
POST   /api/v1/games/:id/marriage/propose
  求亲
  Body: { femaleId: number, officerId: number }
  Response: { success: boolean, asConcubine: boolean }

POST   /api/v1/games/:id/marriage/concubine
  纳妾
  Body: { femaleId: number, officerId: number }
  Response: { success: boolean, officer: Officer }

POST   /api/v1/games/:id/marriage/bestow
  君主赐婚
  Body: { femaleId: number, officerId: number }
  Response: { success: boolean }

POST   /api/v1/games/:id/marriage/divorce
  休妻(七出之内)
  Body: { officerId: number, reason: string }
  Response: { success: boolean, fameChange: number }
```

### 2.8 宝物/装备

> **Session 266 实装（S13 0-A）**：装备/卸下/赏赐已实装，路径为现行 `POST /api/game/items/equip|unequip|grant`（Body `{ officerId, itemId }`，返回 `GameState`）；`use`（消耗品）仍 0-B。

```
POST   /api/game/items/equip
  装备宝物（库存→武将槽位；门槛/槽冲突校验）【已实装】
  Body: { officerId: number, itemId: number }
  Response: { ...GameState }

POST   /api/game/items/unequip
  卸下宝物（回势力库存）【已实装】
  Body: { officerId: number, itemId: number }
  Response: { ...GameState }

POST   /api/game/items/grant
  赏赐宝物（忠诚+5~20 按品质 + 自动装备；君主特例拒绝）【已实装】
  Body: { officerId: number, itemId: number }
  Response: { ...GameState }

POST   /api/v1/games/:id/items/:itemId/use
  使用消耗品（0-B）
  Body: { officerId: number }
  Response: { result: string, remaining: number }
```

### 2.9 内政·设施 & 资源

```
POST   /api/v1/games/:id/cities/:cityId/develop/start
  开始持续开发任务
  Body: { officerId: number, type: 'farm'|'commerce'|'culture'|'craft'|'transport'|'sanitation' }
  Response: { developmentProgress }

POST   /api/v1/games/:id/cities/:cityId/facilities/build
  建造设施
  Body: { facility: CityFacility }
  Response: { city }

POST   /api/v1/games/:id/cities/:cityId/policy
  设置政策
  Body: { policy: CityPolicy }
  Response: { city }

POST   /api/v1/games/:id/trade
  贸易调配
  Body: { fromCityId: number, toCityId: number, resource: ResourceType, amount: number }
  Response: { fromCity, toCity }

GET    /api/v1/games/:id/resources
  查询势力资源
  Response: { resources: ResourceStock }
```

### 2.10 关隘

```
POST   /api/v1/games/:id/passes/:passId/garrison
  关隘驻军
  Body: { officerId: number, troopCount: number }
  Response: { pass }

GET    /api/v1/games/:id/passes
  查询所有关隘状态
  Response: { passes: Pass[] }
```

### 2.11 少数民族

```
POST   /api/v1/games/:id/minorities/:group/interact
  夷狄交互
  Body: { action: 'attack'|'marry'|'tribute'|'governor'|'migrate', payload: object }
  Response: { minority: MinorityState }

GET    /api/v1/games/:id/minorities
  查询所有民族状态
  Response: { minorities: Record<EthnicGroup, MinorityState> }
```

### 2.12 城市升级

```
POST   /api/v1/games/:id/cities/:cityId/upgrade
  城市升级
  Body: { targetTier: CityTier }
  Response: { city, upgradeLog }
```

### 2.13 静态数据查询

```
GET    /api/v1/data/officers?page=1&pageSize=50&factionId=1
  Response: { officers: Officer[], pagination: Pagination }

GET    /api/v1/data/officers/:id
  Response: { officer: Officer }

GET    /api/v1/data/cities
  Response: { cities: City[] }

GET    /api/v1/data/formations
  Response: { formations: Formation[] }

GET    /api/v1/data/units
  Response: { units: UnitTemplate[] }

GET    /api/v1/data/items
  Response: { items: Item[] }

GET    /api/v1/data/females
  Response: { females: FemaleCharacter[] }

GET    /api/v1/data/skills
  Response: { skills: Skill[] }
```

### 2.14 关系网 API（S24）

```
GET    /api/game/relations/:officerId
  获取武将关系列表（Session 338：亲和度优先读 GameState.relationAffinities 运行时覆写，
  缺省回退 pairAffinity 基线；状态由 relationState 派生）
  Response: OfficerRelation[]
```

### 2.15 技能树 API（S25）

```
GET    /api/game/skill-trees
  获取技能树定义（静态）
  Response: SkillTreeDef[]

GET    /api/game/officer/:id/skills
  获取武将技能树状态与点数
  Response: { skillTreeState, skillPointsSpent, totalSkillPoints, traitLevels, traitPointsSpent, totalTraitPoints }

POST   /api/game/skill-tree/upgrade
  技能树加点；成功后同步 `officer.skills`（跨树同 skillId 取 max(基线, 树等级)），供战斗/内政消费
  Body: { officerId: number, nodeId: string }
  Response: OfficerSkillState

POST   /api/game/trait/upgrade
  特性加点
  Body: { officerId: number, traitId: string }
  Response: OfficerSkillState

POST   /api/game/skill-tree/reset
  重置技能树与特性点，并将 `officer.skills` 恢复为静态基线与空树合并结果
  Body: { officerId: number }
  Response: OfficerSkillState
```

### 2.16 天命人心 API（S26）

```
GET    /api/game/faction/overview
  获取势力总览（含天命/人心）
  Response: { factionId, factionName, mandate, mandateLabel, mandateDiplomacyModifier, popularWill, popularWillLabel, popularWillDesertionModifier, popularWillRecruitModifier, cityCount, officerCount, commanderyCount }
```

> Session 338 效果消费：`calculateAllianceChance` 含 `mandateModifier`（天命权重×100 百分点）；
> `conscript` 乘以 `1 + popularWillRecruitModifier`；月度 `tickPopularWillDesertion`（基率 2%×人心叛逃修正）。

### 2.17 城级派系与门阀 API（S27）

```
POST   /api/game/civil/reclaim
  开垦（乡政派系命令）
  Body: { cityId: number, officerId: number }
  约束：执行人须为本城己方可行动武将且智≥60；城金≥50
  Response: GameState（全量）

POST   /api/game/civil/patrol
  巡查（乡政派系命令）
  Body: { cityId: number, officerId: number }
  约束：执行人须为本城己方可行动武将且武≥60；城金≥30；当月免叛乱
  Response: GameState（全量）

POST   /api/game/faction/buy-arms
  兵装采购（势力级）
  Body: { amount: number }  // 正整数，10 金/件
  Response: GameState（全量）

POST   /api/game/civil/impeach   [S27 深化，Session 286]
  弹劾处理（乡政派系命令）
  Body: { cityId: number, action: 'appease' | 'remove' }
  约束：本城存在 pendingImpeachment；appease 需城金≥100；
        remove 不支持君主；仅玩家城市可处理
  Response: GameState（全量）
```

> `GET /api/game/faction/overview` 响应于 S27 起新增 `fame`、`arms` 字段。

---

## 三、WebSocket 事件

### 3.1 连接

```
ws://localhost:3001/ws?gameId={gameId}
```

### 3.2 服务端 → 客户端推送

```typescript
// 回合推进进度
{
  type: 'turn_progress',
  payload: {
    phase: 'ai_thinking' | 'ai_executing' | 'complete',
    currentFaction?: string,
    progress: number  // 0~100
  }
}

// AI 完成事件
{
  type: 'turn_complete',
  payload: {
    changes: {
      cityChanges: City[],
      armyMovements: Army[],
      battleResults: BattleResult[]
    }
  }
}

// 事件触发（史源见 static.events.sourceClass/sources）
{
  type: 'event_triggered',
  payload: {
    eventId: number,
    dialogues: Dialogue[],
    choices: EventChoice[]
  }
}

// 战斗邀请(AI攻打玩家)
{
  type: 'battle_started',
  payload: {
    battleId: number,
    attacker: string,
    defender: string,
    location: string
  }
}

// 外交通知
{
  type: 'diplomacy_notification',
  payload: {
    type: 'alliance_proposal' | 'marriage_proposal' | 'tribute_request' | 'war_declaration',
    fromFaction: string,
    details: string
  }
}

// 错误
{
  type: 'error',
  payload: {
    code: string,
    message: string
  }
}
```

### 3.3 客户端 → 服务端

```typescript
// 确认事件选择
{
  type: 'event_choice',
  payload: { eventId: number, choiceIndex: number }
}

// 心跳
{ type: 'ping' }
```

---

## 四、接口使用举例

### 4.1 创建游戏 → 游戏主界面

```
1. 当前Demo调用 GET /api/game/static → 拿到剧本、势力与史料层目录
2. 玩家选剧本+势力+传奇开关 → POST /api/game/create → 返回 gameState
3. Client 渲染：(MapCanvas + TopBar + LeftPanel)
4. 同时连接 WebSocket，接收后续 AI 推送
```

### 4.2 一个内政回合

```
1. 玩家在 LeftPanel 选择"开发农业" → POST .../develop
2. Server 返回更新后的 city 数据
3. Zustand store 更新 city → MapCanvas 局部重绘城市信息
4. 玩家重复其他内政指令
5. 最终点击"结束回合" → PUT .../turn
6. WebSocket 推送 AI 进度 → 高亮变化
```

### 4.3 一场战斗

```
1. 两军交战 → Server 自动触发 POST /battles/start
2. Client 切换路由 → /game/battle/:battleId
3. 玩家点击己方一支部队 → 显示移动/技能面板
4. 玩家选择移动 → POST /battles/:bid/move
5. 玩家选择攻击 → POST /battles/:bid/attack
6. 战斗结束 → battle.state = 'resolved' → 切换回大地图
```

**当前 Demo 权威状态约束（Session 141）**：`/api/game/battle/*`、`/battlefield/*`、`/melee/*` 仍采用“当前单场”接口，不要求客户端传 battleId。服务端分别以 `GameState.activeBattles[0]`、`activeBattlefield`、`activeMelee` 为唯一真源；退出白刃战保留父战场，退出战场级联清除白刃战。战场初始化要求己方出发城和有敌方统治者的目标城；`melee/start` 要求双方是当前战场内、同节点、不同势力且不同 ID 的 CampaignArmy；未知行动或战术点不足在修改状态前拒绝。当前不得据这些字段推断已支持并发战争。

---

### 2.14 战役

```
POST   /api/v1/games/:id/campaign/start
   编成出征
   Body: {
     commanderId: number,
     subCommanderIds: number[],
     advisorId?: number,
     subAdvisorId?: number,
     fromNodeId: number,
     targetNodeId: number,
     unitType: UnitType,
     formation: FormationType,
     troopCount: number,
     food: number
   }
   Response: { army: CampaignArmy }

POST   /api/v1/games/:id/campaign/:armyId/march
   行军指令
   Body: { targetNodeId: number }
   Response: { army: CampaignArmy }

POST   /api/v1/games/:id/campaign/:armyId/build
   建造设施
   Body: { structureType: StructureType }
   Response: { army: CampaignArmy }

POST   /api/v1/games/:id/campaign/:armyId/assault
   强攻
   Body: {}
   Response: { result: AutoBattleResult }

POST   /api/v1/games/:id/campaign/:armyId/siege/surrender
   劝降
   Body: {}
   Response: { success: boolean, army: CampaignArmy }

POST   /api/v1/games/:id/campaign/:armyId/retreat
   撤退
   Body: {}
   Response: { army: CampaignArmy }

POST   /api/v1/games/:id/campaign/:armyId/advisor/action
   参谋行动
   Body: { action: 'inspire' | 'trap' | 'retreat' | 'scout' }
   Response: { army: CampaignArmy }

GET    /api/v1/games/:id/campaign/nodes
   获取战役地图节点状态
   Response: { nodes: CampaignNode[] }
```

### 2.15 总军师

```
POST   /api/v1/games/:id/grand-strategist/appoint
   任命总军师
   Body: { officerId: number }
   Response: { game: GameState, strategist: GrandStrategist }

POST   /api/v1/games/:id/grand-strategist/dismiss
   解职总军师
   Body: {}
   Response: { game: GameState, log: string }

POST   /api/v1/games/:id/grand-strategist/strategy
   切换态势
   Body: { strategy: 'offense' | 'defense' | 'development' | 'endurance' }
   Response: { game: GameState, log: string }

GET    /api/v1/games/:id/grand-strategist/status
   获取总军师状态
   Response: {
     strategist: GrandStrategist | null,
     modifiers: StrategyModifiers,
     hasStrategist: boolean
   }
```

### 2.16 势力特点

```
GET    /api/v1/games/:id/faction/trait
   获取本势力特点
   Response: { trait: FactionTrait }

GET    /api/v1/static/faction-traits
   获取全量势力特点定义
   Response: { traits: FactionTrait[] }
```

---

### 2.17 文教、声教、学派与技艺（技术储备，未实装）

> 本组接口只定义未来契约。所有 POST 必须在客户端终审询问窗确认后才发送，服务端仍须独立校验资源、
> 执行者占用、权限和目标状态，不能信任客户端预览值。

```
GET    /api/v1/games/:id/cities/:cityId/culture
   获取城市文教、声教、学派与设施
   Response: {
     education: number,
     culturalDevelopment: number,
     schoolInfluence: CitySchoolInfluence,
     facilities: string[],
     educationOfficerIds: number[]
   }

POST   /api/v1/games/:id/cities/:cityId/education/invest
   兴办教育
   Body: { officerId: number, gold: number }
   Response: { city: City }

POST   /api/v1/games/:id/cities/:cityId/education/appoint
   任命持续学官
   Body: { officerId: number }
   Response: { city: City }

POST   /api/v1/games/:id/cities/:cityId/education/dismiss
   撤换学官
   Body: { officerId: number }
   Response: { city: City }

POST   /api/v1/games/:id/cities/:cityId/culture/build
   建造文化设施
   Body: { facilityType: string }
   Response: { city: City }

POST   /api/v1/games/:id/cities/:cityId/culture/policy
   设置城市文化政策
   Body: { policy: string }
   Response: { city: City }

GET    /api/v1/games/:id/faction/research
   查看五条技艺路线与当前研发
   Response: { techLevels: TechLevels, activeResearch?: ActiveResearch }

POST   /api/v1/games/:id/faction/research/start
   立项研发（同一势力仅一项）
   Body: { branch: TechBranch, targetLevel: number }
   Response: { faction: Faction }

POST   /api/v1/games/:id/faction/research/cancel
   中止研发并保留一半已完成进度
   Response: { faction: Faction }

POST   /api/v1/games/:id/faction/cultural-policy
   设置势力文化政策
   Body: { policy: string }
   Response: { faction: Faction }
```

### HC-P0-6 伪诏宣战

`POST /api/game/hegemony/false-decree-war`

请求体：`{ targetFactionId: number }`。服务端校验已开府、皇权≥40、冷却为0、目标存活且
尚未交战；成功返回完整 `GameState`，目标关系直接设为 `war`，皇权扣40、冷却置8季，
必要时声望扣30。失败返回 400 与可直接用于禁用态/错误提示的原因文案。

### HC-P1-2 称王

`GET /api/game/hegemony/king-requirements`

返回当前玩家势力的权威称王门槛、当前值、是否通过、剧本争夺城池总数，以及有限王号候选与
运行局占用状态。HC-P1-5 朝廷抽屉在载入及权威 `GameState` 更新后重新读取；该端点只读，
不取得写锁、不修改状态。

`POST /api/game/hegemony/proclaim-king`

请求体：`{ kingdomName: string }`。服务端在请求锁内只编排权威
`proclaimKing(state, playerFactionId, kingdomName)`：重新校验势力存活、霸府阶段、城池门槛、
阶段年龄12月、皇权80及有限王号候选/运行局唯一性；成功返回完整 `GameState`，扣皇权80并写入
`politicalStage='king'`、`politicalTitle='{王号}王'`、固定 `kingdomName`、阶段年份和年龄0。
任何失败返回400且权威状态零副作用。HC-P1-5 已将其接入朝廷称王草稿与深红重大终审；
客户端终审先按最新快照复核阶段、城池、沉淀、皇权和王号占用，服务端提交时仍执行最终权威校验。

HC-P1-6 没有新增业务端点；仓库化 `verify-hc-p1-headless` 只串联上述公开 API：
开府、结束回合、称王、任官、封爵与进贡，验证不存在测试专用写接口。

CMD-P28 没有新增或修改接口。命令坞四计继续复用既有
`POST /api/game/plot/launch` 与完整 `GameState` 响应；客户端终审前的上限、情报、盟友、
资源与目标条件复验只提供即时反馈，服务端 S17 引擎仍是最终权威。

---

*文档版本: v5.0 | 2026-08-01 | Session 267 总军师四端点响应同步现行代码*

Session 245 新增 `POST /api/game/melee/mode`，请求 `{ mode: 'auto'|'standard'|'tactical' }`。
缺失或非法模式返回 400；已选其他模式返回 400；重复提交同一模式幂等返回当前结果。
自动模式在该请求内完成推演与 Army 回写；标准模式后续只允许 `/melee/round`；六角模式
返回关联 `battle`，完成后由既有 `/battle/exit` 幂等回写白刃战与 Army。

Session 246 将 `POST /api/game/civil/develop` 请求改为
`{ cityId, kind: 'farm'|'commerce'|'wall', officerId }`。成功只启动持续项目并扣首付，
不再即时增加开发度；项目冲突、非己方城、武将不可用或首付不足返回400。旧
`/civil/develop-farm` 仅作兼容入口，自动使用本城首名武将。

新增只读 `GET /api/game/civil/budget`，返回当前玩家势力12月预算：
`cityCount / goldIncome / foodProduced / civilianAndMilitaryFood / projectGold /
administrativeGold / salaryGold / warLossGold / netGold / netFood / notes`。

### Session 251 · BF-P4 郡域战场选择

`POST /api/game/battlefield-instance/enter` 新增可选请求体
`{ commandery: 'nanjun' | 'yingchuan' }`；省略时保持旧行为进入南郡，非法值返回 400。
响应仍为同一 `GameState.activeBattlefieldInstance` 契约，不新增存档字段。颍川实例使用
`yingchuan-190`，南郡旧客户端与旧存档无需迁移。

### Session 252 · BF-P4 阵前/城下单挑

- `POST /api/game/battlefield-instance/duel/start`
  `{ kind: 'formation_front'|'city_front', nodeId, stance }`
- `POST /api/game/battlefield-instance/duel/step`
- `POST /api/game/battlefield-instance/duel/skip`
- `POST /api/game/battlefield-instance/duel/close`

四端点都返回最新 `GameState`。start 校验入口/郡治语境与敌方；step/skip 统一消费权威
RNG，完成时幂等回写；close 只允许已结算上下文。重复 skip 不会二次回写。
### Session 277 · 六角路径与撤销 API

```text
GET  /api/game/battle/move-path/:unitId/:q/:r → PathResult
POST /api/game/battle/undo                     → BattleState
POST /api/game/melee/round { actionType, targetFormation? }
```

`move-path` 是非权威预览；`battle/move` 提交时服务端重新执行同一 A*。`undo` 仅接受当前玩家回合
最后一条同回合、来源为玩家的可逆移动；攻击/技能/结束行动或进入敌军阶段后返回400。
Session 334 新增 `UNDO_TURN_LOCKED` 与 `UNDO_STATE_MISMATCH` 失败语义，所有拒绝均保持战斗快照不变。
Session 335：当 `BattleState.duel` 存在且未 `resolved` 时，`battle/move|undo|attack|fire|ability|formation|finish`
返回 400/`DUEL_BATTLE_PAUSED`（状态不变）；`move-range`/`move-path`/`abilities` 返回空；`battle/enemy`
保持暂停不推进单挑。单挑仅经 `duel/step` 与 `duel/skip` 推进；敌军主动单挑在 `skip`/`step` 结算后服务端
以 `afterDuel` 续行剩余敌军 AI 再交回玩家回合。
Session 336：`battle/move` 审计写入 `beforeFacing`；`battle/undo` 在字段存在时恢复朝向。审计 `id`/
`logicalTimestamp` 按同回合最大序号 +1 分配，窗口满 3 条后仍唯一。
白刃 `change_formation` 仅接受0-A六基础阵型，消耗1战术点。详细返回结构、错误码与调用示例见
`27-tactical-wargame-system.md` §2.1。

### Session 279 · 阵型整合 API 规划边界

本轮只完成 `29-formation-integration-development-plan.md`，**未新增或修改 API**。

> **Session 290 已实装（FM-P3 动作级幂等）**：`POST /api/game/melee/round` 现接受可选
> `commandId` 与 `expectedRound`。同一 `commandId` + 同 `expectedRound` 的重试返回首次结果，
> 不二次扣 TP/推进；同 ID 但 `expectedRound` 过期（与缓存轮次不符）拒绝；不同 ID 各自正常执行。
> 服务端以 `MeleeState.commandCache` 有界去重。旧客户端不传这两个字段仍兼容（无幂等承诺）。
>
> 六角变阵若需命令入口，须在 FM-P3 评审后接入既有战斗命令编排，不另建重复阵法服务；
> 其只能消耗/推进 `battle.ts` 自身行动或战术阶段，不得调用 `runMeleeRound` 或结算白刃回合。
> 所有入口都必须服务端复验并保证非法请求不改状态、不扣 TP、不消费 RNG。
