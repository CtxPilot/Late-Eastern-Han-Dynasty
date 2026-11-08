# Phase 7-05 立项设计提案：商路贸易网络、十三州特产与跨国关税经济体系全栈落地

> **立项状态**：✅ **已圆满完成全栈落地与验收**（Session 481）  
> **关联架构**：`docs/04-game-systems.md` §2.6/§2.7（贸易网络与特产溢价）、§1461（贸易路线与关税）、`docs/08-data-dictionary.md`、`docs/09-roadmap.md`、`docs/35-phased-implementation-roadmap.md`  
> **对齐准则**：数字真源在 `docs/08`；绝对零 RNG 漂移（`turn-golden.test.ts` 3/3 保持一致）；全量契约受严格 Zod Schema 校验；专案门禁 `verify-s481-trade-network` 54/54 项断言 100% 绿色通过。

---

## 一、背景与设计动机

1. **宏观经济与地理沙盘深化需求**：
   在完成朝廷官制（Phase 7-01）、深度外交（Phase 7-02）、天下大势与九品中正（Phase 7-03）以及战俘刑赏（Phase 7-04）之后，宏观治理维度亟需突破单一的「静态农商开发与税赋抽取」模型。
   三国时期经济不仅取决于本郡田赋，更高度依赖区域特产流通与干线商道：
   - **益州蜀锦**：独步天下，“决敌之资，唯仰锦耳”，诸葛亮以锦市换取魏吴军资战马；
   - **北疆战马**：幽州、并州、凉州所产良马源源南下，中原诸侯竞相以绢帛换购；
   - **青徐海盐与江淮鱼米**：通商四方，商贾络绎；
   - **关税与战时禁运**：两国通好则商道畅达彼此抽税分润；一旦兵戎相见，边境榷场与商路立即断绝。

2. **设计目标**：
   依据 `docs/04-game-systems.md` §2.6、§2.7 及 §1459，打通十三州特色产物、基于城池道路拓扑的贸易路线（`TradeRoute`）、特产异地溢价、水运干线加成、跨势力关税分润、战时自动封锁禁运，以及季首商税统算入账全栈体系。

---

## 二、数据契约与 Schema 扩展

### 2.1 十三州特产静态矩阵 (`PROVINCE_SPECIALTIES`)
在 `@leh/shared` 中定义标准十三州特产与基准价格表：
- 幽州：战马 (40)、人参 (80)、貂皮 (60)
- 并州：战马 (35)、铁矿 (25)
- 凉州：良马 (50)、玉石 (100)、皮毛 (40)
- 冀州：铁器 (30)、陶器 (20)、盐 (15)
- 司隶：绢帛 (45)、漆器 (50)、铜器 (40)
- 兖州：布帛 (25)、兵器 (55)
- 豫州：铁具 (30)、布帛 (25)
- 徐州：海盐 (20)、铁 (30)、布 (20)
- 青州：海盐 (18)、鱼货 (15)、贝 (30)
- 荆州：生漆 (35)、竹器 (20)、铜矿 (30)
- 扬州：茶叶 (40)、瓷器 (45)、珍珠 (80)
- 益州：蜀锦 (120，蜀中独有绝品)、井盐 (25)、丹砂 (70)、药材 (50)
- 交州：珍珠 (80)、玳瑁 (90)、象牙 (100)、香料 (70)

### 2.2 商路路线实体 (`TradeRoute`)
```ts
export type TradeRouteStatus = 'active' | 'blockaded' | 'suspended';

export interface TradeRoute {
  id: string; // 唯一路由标识，如 "route_1_2"
  fromCityId: number;
  toCityId: number;
  distance: number; // 道路拓扑跳数或距离
  isWaterWay?: boolean; // 是否经由长江/黄河水运干线 (收入 x1.3)
  isCrossFaction: boolean;
  factionA: number;
  factionB: number;
  status: TradeRouteStatus;
  assignedMerchantOfficerId?: number; // 主管经管文官 ID
  establishedYear: number;
  establishedMonth: number;
}
```

### 2.3 GameState 根级注册与 Zod Schema
- 在 `shared/types/game.ts` 和 `GameState` 扩充 `tradeRoutes?: TradeRoute[]`；
- 在 `shared/game-state-entity-schema.ts` 注册 `TradeRouteRuntimeSchema`，并在 `ROOT_KEYS` 严格同步。

---

## 三、纯函数算法模型 (`shared/trade.ts`)

1. **特产异地溢价推导 (`calculateSpecialtyPriceMultiplier`)**：
   - 同州同地无溢价（1.0）；
   - 跨州运销根据地理拓扑距离递增：`1.0 + min(1.0, distance * 0.15)`；
   - 益州蜀锦独有绝品异地溢价 +50%~100%；交州南珠珍宝异地溢价 +60%~120%。

2. **商路季收益模型 (`calculateTradeRouteQuarterlyIncome`)**：
   - 基础商贸额：`floor((commerceA + commerceB) / 200 * roadMultiplier)`；
   - 水道干线加成：途经水运干线享受 `× 1.3` 倍率；
   - 跨势力关税折损与友好度修复：
     - 同势力城际商道：无损通关（1.0），双方城池各得 50% 纯利；
     - 跨势力商道：边关榷场验货，基准折扣 `× 0.70`，友好度每 10 点恢复 1%（最高友好 100 时达到 80%）；
     - 文官大贾经管加成：若指定经管武将政治/智谋高，收益提升 `max(0, floor((politics - 60) * 0.5))%`；
   - 战时封锁：若双方势力处于交战状态（`DipRelation.WAR`），收益清零并标置 `blockaded`。

---

## 四、引擎层与生命周期 (`server/src/engine/trade.ts` & `turn.ts`)

1. **建立商路 (`establishTradeRoute`)**：
   - 校验：两城连通性（经 `city-roads.ts` 可达）、城池商路上限（默认每城至多 3 条商路）、交战方不得通商；
   - 跨势力商路：需要友好度 $\ge -20$，且非交战状态；
   - 扣除开辟商路经费（200 金）。
2. **解散商路 (`cancelTradeRoute`)**：
   - 主动撤除商路，释放商路名额与主管官员。
3. **季度商税核算与入账 (`tickTradeQuarter`)**：
   - 每逢季度首月（1月、4月、7月、10月），全图遍历活跃商路；
   - 若双方交战则自动触发禁运封锁，和平恢复则解封；
   - 核算双方城池贸易利润并直接注入城池/国库资金；
   - COW 零冗余分配：无商路变动或非季度月时直接返回原引用，零 RNG 消耗，确保 `turn-golden.test.ts` 零漂移。

---

## 五、验收方案与门禁矩阵

专项门禁脚本：`server/src/scripts/verify-s481-trade-network.ts`
1. 验证十三州特产矩阵、基准价与异地溢价算法纯函数自洽；
2. 验证商路季收益计算模型（水运加成、跨势力关税、友好度增益与经管官员加成）；
3. 验证商路开辟与撤销逻辑（连通性检查、配额上限拦截、外交敌对拦截）；
4. 验证战时自动禁运封锁与停火自动复通；
5. 验证季首商税结算国库与城池资金注入；
6. 验证 24 个月全息推演闭环、无内存泄漏无 NaN；
7. 验证 `turn-golden.test.ts` 3/3 严格匹配零漂移。

---

## 六、实装验收交付结论（Session 481）

- **数据契约与 Schema**：
  - `TradeRoute`、`SpecialtyItem`、`PROVINCE_SPECIALTIES`（十三州独有产物与基价）；
  - `calculateSpecialtyPriceMultiplier`（蜀锦 1.8x、交州珍奇 1.7x、凉州良马 1.6x、同州 1.0x）；
  - `calculateTradeRouteQuarterlyIncome`（水系 1.3x、跨国关税折损 30%、友好度修复、经管文官才德加成、战时封锁归零）；
  - `canEstablishTradeRoute`（上限 3 条、重复自连拦截）、`getCityActiveTradeRoutes`；
  - `GameState.tradeRoutes?: TradeRoute[]` 注册入 `ROOT_KEYS` 与全 Schema 引用完整性校验。
- **引擎与事务**：
  - `establishTradeRoute`、`cancelTradeRoute`、`tickTradeQuarter`（季首核算入账、文官累绩、友好度+1、交战封锁、无商路严格 COW 零分配零 RNG）。
- **服务层、路由与离线 Web Worker**：
  - `doGetTradeRoutes`、`doEstablishTradeRoute`、`doCancelTradeRoute`；
  - `server/src/routes/game.ts` 提供 `GET /trade/routes`, `POST /trade/establish`, `POST /trade/cancel`；
  - `client/src/workers/game.worker.ts` 镜像提供离线端点。
- **门禁验证表现**：
  - 专属门禁 `verify-s481-trade-network` 54/54 项断言 100% 绿色通过；
  - 核心月结确定性 `turn-golden.test.ts` 3/3 严格匹配零漂移；
  - 历史门禁 `verify-s480` (60/60)、`verify-s479` (66/66)、`verify-s478` (69/69)、`verify-s477` (107/107)、`verify-d0b9` (40/40) 全绿；
  - 全仓单测 108 个套件 736 项用例 100% 通过；全仓 `pnpm build` 与合规检查 0 错误。

