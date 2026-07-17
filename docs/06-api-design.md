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
POST   /api/game/create              { scenarioId, playerFactionId } → GameState
GET    /api/game/state               → GameState（经 mask）
POST   /api/game/end-turn            → GameState
  含：人口生育衰老、结构粮耗、产粮、AI、事件 tick
  有 pendingEvents 时 400「请先处理待决事件」
POST   /api/game/event/choose        { eventId, choiceIndex } → GameState
  // S14：从 pending 取事件，应用 choices[i].effects，写入 completedEvents

POST   /api/game/civil/develop       { cityId, kind: 'farm'|'commerce'|'wall' }
POST   /api/game/civil/develop-farm  { cityId }   // 兼容
POST   /api/game/civil/conscript     { cityId }   // 扣 adultMale，见 04§28
POST   /api/game/civil/relief        { cityId }   // 施米
POST   /api/game/civil/train         { cityId }   // 士气
POST   /api/game/civil/seek-beauty       { cityId }           // 寻访：60金；成功 stock+1 可寻−1
POST   /api/game/civil/search-beauty     { cityId }           // 兼容 → seek-beauty
POST   /api/game/personnel/reward-beauty { officerId, amount? } // 赏赐美女库存→忠诚

POST   /api/game/personnel/marry       { femaleId, officerId }  // 婚配 300金
POST   /api/game/personnel/gift-beauty { femaleId, officerId }  // 赏赐 100金
POST   /api/game/personnel/join-faction  { officerId, factionId, cityId? }  // S18 跟随：入势力，妻跟随
POST   /api/game/personnel/search          { cityId }              // S11 搜索：己方城 80金
POST   /api/game/personnel/recruit         { officerId, recruiterId? } // S11 登用在野男将 200金
POST   /api/game/personnel/appoint         { officerId, track: civil|local|military, position, cityId? }
                                      // S11/S12 任命；position=none 解职；太守等 needsCity
POST   /api/game/personnel/release-officer { officerId }  // S18 跟随：释放为在野
POST   /api/game/personnel/follow-check  {}  // S18 跟随：手动触发投奔检定

POST   /api/game/intel/recruit         { cityId }  // 招募：人数/等级∝男成+驻军
POST   /api/game/intel/recruit-female  { cityId }  // 训练女间谍：耗 beauty2+金100，agentKind='female'
POST   /api/game/intel/plant-female    { targetFactionId, homeCityId? }  // 献美点化：plantable≥1+对方beauty≥1+金80
POST   /api/game/intel/mission         { agentId, type: recon|sabotage|assassinate|pillowTalk|sowDiscord, targetCityId }  // pillowTalk/sowDiscord 仅限女间谍
POST   /api/game/intel/station         { agentId, cityId }  // 驻守反间
POST   /api/game/intel/unstation       { cityId }
POST   /api/game/intel/captive         { agentId, action: hold|execute|release|exchange }

POST   /api/game/plot/launch          { type: honeyTrap|sowDiscord|falseIntel|emptyFort|..., targetFactionId?, targetCityId?, targetOfficerId?, agentId? }
                                     // L1 战术计谋：honeyTrap(美人计)·sowDiscord(离间)·falseIntel(假情报)·emptyFort(空城)
                                     // L2 战略计谋：undermine(釜底抽薪)·lureOut(调虎离山)·feint(暗渡陈仓)·bluff(树上开花)
                                     //             instigate(借刀杀人)·strikeWhileHot(趁火打劫)·poach(秘密挖角)
                                     //             watchFire(隔岸观火)·swapPillar(偷梁换柱)·edict(借尸还魂)·killChicken(指桑骂槐)
                                     // L2 投入规则：prep 消耗按月扣 · progress 进度条 · 可提前终止

POST   /api/game/plot/cancel          { plotId }
                                     // 提前终止 L2 战略计谋，沉没成本不返还

GET    /api/game/plot/progress        → { plots: Plot[], progress: { [plotId]: number } }
                                     // L2 执行进度，供 UI 进度条渲染

POST   /api/game/policy/set           { type: prepareDefense|befriendFarFightNear|playFool|guestHost|... }
                                     // L3 国策态势切换，单次冷却 6 月
GET    /api/game/policy/current       → { activePolicies: NationalPolicy[], cooldown: number }

POST   /api/game/diplomacy/tribute     { targetFactionId }  // 进贡 200金，友好+15
POST   /api/game/diplomacy/gift-beauty { targetFactionId, amount? }  // 献美：beauty−n/对方+n，友好+12×n（1~5）
POST   /api/game/diplomacy/alliance    { targetFactionId }  // 结盟 500金，友好≥30

POST   /api/game/march               { targetCityId, fromCityId?, troopCount? }
  → { game, battle }  // 须道路邻接；默认邻接己方城
GET    /api/game/march/suggest-from/:targetCityId → { fromCityId }
GET    /api/game/march/can-reach/:targetCityId → { ok: boolean }
POST   /api/game/battle/start        { cityId, fromCityId? }  // 兼容，内部走出征
POST   /api/game/battle/move|attack|fire|finish-player|enemy-phase
  // fire: { attackerId, targetId } 火计，耗气30
GET    /api/game/battle/abilities/:unitId → { abilities: UsableAbility[] }  // S10 可用战法
POST   /api/game/battle/ability   { attackerId, targetId, abilityId }  // S10 施放战法
POST   /api/game/battle/exit         → GameState  // 结算占城或残兵回流
```

征兵响应中的人口变化：`demographics.adultMale` 下降、`population` 同步、`beautyPool` 随女成重算。  
搜罗美人：`adultFemale −400`、`beautyPool −1`、`gold −80`；可能写入 `females[id].factionId`。  
出征胜：目标 `ruler` 改玩家、残兵驻防、敌同城武将→在野、**全部存活攻方主将**迁入、拆敌反间；败/撤：部分兵力回 `fromCityId`。  
进贡/结盟/回合末：扣 **城金** 后 `syncFactionResources` 写回 `faction.gold/food`。

### 2.3 人事

```
POST   /api/v1/games/:id/cities/:cityId/search
  搜索(在野武将/宝物)
  Body: { officerId: number }
  Response: { found: Officer | Item | null, foundType: 'officer' | 'item' | 'none' }

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
   Body: { challengerUnitId, targetUnitId }
   Response: { duelState: DuelState }
   说明: 发起方消耗20气力；target自动/拒绝见 §8.3.2；接受后引擎自动推进首回合

POST   /api/v1/games/:id/battles/:battleId/duel/respond
   回应单挑挑战（AI 自动决策，玩家不操作；本端点为设计预留，0-A 由 challenge 内部完成）
   Body: { accept: boolean }
   Response: { duelState: DuelState | null }

POST   /api/v1/games/:id/battles/:battleId/duel/action
   提交单挑指令（全自动模式下玩家不选指令；本端点为设计预留）
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

```
POST   /api/v1/games/:id/items/:itemId/equip
  装备宝物
  Body: { officerId: number }
  Response: { officer: Officer }

POST   /api/v1/games/:id/items/:itemId/unequip
  卸下宝物
  Body: { officerId: number }
  Response: { officer: Officer }

POST   /api/v1/games/:id/items/:itemId/use
  使用消耗品
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

// 历史事件触发
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
1. GET /api/v1/data/scenarios → 拿到剧本列表给玩家选择
2. 玩家选剧本+势力 → POST /api/v1/games → 返回 gameState
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
   Response: { grandStrategist: GrandStrategist }

POST   /api/v1/games/:id/grand-strategist/dismiss
   解职总军师
   Body: {}
   Response: { success: boolean }

POST   /api/v1/games/:id/grand-strategist/strategy
   切换态势
   Body: { strategy: 'offense' | 'defense' | 'development' | 'endurance' }
   Response: { grandStrategist: GrandStrategist, effect: string }

GET    /api/v1/games/:id/grand-strategist/status
   获取总军师状态
   Response: { grandStrategist: GrandStrategist, pendingAdvice?: string }
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

### 2.17 学派与文化

```
GET    /api/v1/games/:id/cities/:cityId/culture
   获取城市学派分布
   Response: { culture: CityCulture, facilities: string[] }

POST   /api/v1/games/:id/cities/:cityId/culture/build
   建造文化设施
   Body: { facilityType: string }   // 'academy'|'temple'|'shrine'|'workshop'|'lawcourt'|'strategist_hall'|'clinic'|'library'
   Response: { city: City }

POST   /api/v1/games/:id/cities/:cityId/culture/appoint
   指派学派导师
   Body: { officerId: number, school: string }
   Response: { city: City }

POST   /api/v1/games/:id/cities/:cityId/culture/policy
   设置城市文化政策
   Body: { policy: string }
   Response: { city: City }

POST   /api/v1/games/:id/faction/cultural-policy
   设置势力文化政策
   Body: { policy: string }
   Response: { faction: Faction }
```

---

*文档版本: v2.3 | 2026-07-17 | 新增 §2.17 学派与文化 API*
