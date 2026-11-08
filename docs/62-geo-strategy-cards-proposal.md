# Phase 7-09 百城地缘战略卡片与宏观沙盘联动深化设计提案

> **提案编号**：docs/62  
> **所属路线**：Phase 7 — 政治体制、宏观地缘与军事要塞深度拓展  
> **关联章节**：`docs/04-game-systems.md` §六-A（百城地缘战略沙盘）、`docs/07-ui-design.md` §5.2（世界屏战略卡片）、`docs/35-phased-implementation-roadmap.md`  
> **目标会话**：Session 485  

---

## 一、背景与设计宗旨

Session 484 已落地 25 座主地图关隘的要塞生命周期与险阻模型，但世界屏仍以「州卡片 → 城卡片」的基础聚合为主：城池只显示金粮兵口与邻接名称，关隘归属、敌关封锁、异族边患、商路状态与战略价值没有进入宏观沙盘，玩家难以在天下层面快速判断「何处是枢纽、何处是危城」。

本提案在**不新增存档字段、不修改引擎状态、不消费 RNG**的前提下，新增一层纯只读地缘派生模型，把既有 `GameState` 中的城池、官道、关隘、异族、商路聚合为：

1. **106 郡国逐城地缘画像**：战略层级、临敌态势、战略评分、地缘标签；
2. **25 座名关防御联动**：归属控制、守备兵力、险阻加成、所扼官道、敌关封锁；
3. **州部与天下两级宏观聚合**：州部战略节点、关隘态势、封锁官道、边患；
4. **离线/在线同源只读 API 与 Worker 镜像**：服务端 `GET /geopolitics/overview`；
5. **世界屏与右侧郡邑详情 UI**：天下要冲面板、城卡地缘徽记、地缘战略分面。

---

## 二、纯函数与数据契约（`shared/geopolitics.ts`）

### 2.1 枚举

```ts
export type GeoStrategicTier =
  | 'capital'      // 京畿重镇：州治/都城
  | 'chokepoint'   // 锁钥要冲：关隘城或拥雄关拱卫
  | 'hub'          // 通衢枢纽：官道邻接 ≥5 或关联 ≥2 关隘
  | 'frontier'     // 边陲前线：接壤敌对势力
  | 'heartland'    // 腹地安稳：邻城皆为友方
  | 'remote';      // 偏远僻壤：无有效邻接

export type GeoExposure = 'safe' | 'watch' | 'frontline';
export type PassControl = 'friendly' | 'hostile' | 'neutral' | 'empty';
```

### 2.2 关隘联动

`getPassControl(pass, playerFactionId)` 判定顺序：空关（`troops <= 0`）→ 己方（`factionId === player`）→ 中立（`factionId <= 0`）→ 敌对。

单城关联关隘的判定沿用 Phase 7-08 数据契约：`pass.blocksRoutes` 或 `pass.providesIntel` 包含该城即视为关联。每个 `GeoPassLink` 输出：

- `control` / `controlLabel`：己方掌控 / 敌控锁关 / 中立 / 空关；
- `defenseBonusPct`：调用既有 `calculatePassDefenseModifier`，雄关 +50、普通 +30、破关 0；
- `cavalryPenaltyPct`：山地关隘骑兵攻坚 −40；
- `wallPct`、`troops`、`morale`、`commanderName`；
- 所扼官道对通过 `blocksRoutes` 解析为城名。

`GeoBlockedRoute` 仅收录**敌对控制且驻军 >0** 的关隘所封锁的官道；同一对城被多座关隘封锁时按城际官道去重，避免宏观清单重复。

### 2.3 战略评分

评分是确定性整数，夹紧 `[0, 100]`，权重集中于 `GEO_SCORE_WEIGHTS`：

| 因子 | 权重 |
|------|:----:|
| 战略层级 capital / chokepoint / hub / frontier / heartland / remote | 20 / 10 / 8 / 6 / 2 / 0 |
| 每邻接城 | +2 |
| 每友方邻城 | +1 |
| 每敌对邻城 | +6 |
| 每关联关隘 | +8 |
| 每敌控关联关隘 | +5 |
| 每雄关关联 | +4 |
| 每活跃商路 | +3 |
| 每城特产 | +2 |
| 州级以上城等 / 郡级城等 | +6 / +3 |
| 异族骚动 / 劫掠 / 入侵 | +4 / +8 / +12 |

### 2.4 公开纯函数

| 函数 | 作用 |
|------|------|
| `resolveGamePasses(game)` | 读取 `game.passes`；旧档缺省回落 `DEFAULT_PASSES` 25 座 |
| `getPassControl(pass, playerId)` | 关隘控制状态 |
| `evaluateCityGeopolitics(game, cityId)` | 单城画像；城池不存在返回 `null` |
| `buildProvinceGeoSummary(game, province)` | 州部聚合；无城池返回 `null` |
| `buildRealmGeoOverview(game)` | 天下总览（106 城级） |
| `getPassControlLabel` / `getTribeThreatLabel` / `getGeoTierLabel` | 文案映射 |

---

## 三、服务层与镜像

- `server/src/services/game.ts`：`doGetGeopoliticsOverview()` 基于 `getClientGame()`（迷雾裁剪后）计算，不回传权威全量；
- `server/src/routes/game.ts`：`GET /api/game/geopolitics/overview`；
- `client/src/workers/game.worker.ts`：`getGeopoliticsOverview()` 离线镜像，同样消费 `getClientGame()`。

由于是纯只读派生，**无新存档字段、无 Zod Schema 变更、无 RNG 消费、回合金样零漂移**。

---

## 四、UI 联动

### 4.1 世界屏 · 天下形势

新增 `geo-realm-summary` 地缘大势面板：

- 四格指标：敌踞名关 / 敌关封锁官道 / 临敌郡国 + 警讯 / 边患最剧；
- 「天下要冲」战略节点前 6 名（按评分降序），展示层级、州部、地势、临敌态势与关联关隘；
- 点击节点直接下钻州部并选中该城。

### 4.2 州部城卡

`geo-card-<cityId>` 徽记：

- 战略层级徽章 + 临敌态势与评分；
- 地缘标签（敌关锁道 N / 敌踞关隘 / 雄关拱卫 / 异族劫掠 / 商路 N / 特产）；
- 关联关隘控制与险阻加成；
- 敌关封锁的城际官道。

### 4.3 右侧郡邑 · 地缘战略分面

新增可折叠「地缘战略」分面（`geo-profile`）：地缘层级、临敌态势、地势、邻境敌我中立计数、关联关隘守备与加成、敌关封锁、异族边患、商路活跃/封锁、州部特产。

---

## 五、验收

- 单元测试：`shared/geopolitics.test.ts` 10 项；
- 专案门禁：`verify-s485-geo-strategy.ts` 64 项断言（真实 190 年 106 城 / 13 州 / 25 关）；
- UI 冒烟：`scripts/verify-s485-geo-strategy-ui.mjs` 28 项断言（离线 106 城剧本，真实点击）；
- 既有门禁 s481~s484 与 `turn-golden.test.ts` 零漂移回归。
