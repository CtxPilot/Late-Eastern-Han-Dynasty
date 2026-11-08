# Phase 7-08 主地图关隘要塞防御要冲体系全栈设计提案

> **提案编号**：docs/61  
> **所属路线**：Phase 7 — 政治体制、宏观地缘与军事要塞深度拓展  
> **关联章节**：`docs/04-game-systems.md` §6（关隘系统）、`docs/08-data-dictionary.md` §十一（passes.json）、`docs/35-phased-implementation-roadmap.md`  
> **目标会话**：Session 484  

---

## 一、背景与设计宗旨

三国时代地缘博弈中，名关险隘是控扼咽喉、以弱胜强的战略命脉：
1. **25 大主地图战略关隘**：
   - 司隶 7 关：虎牢关、汜水关、函谷关、武关、孟津、大谷关、旋门关；
   - 凉州 3 关：散关、萧关、陇关；
   - 益州 6 关：阳平关、剑阁、白水关、葭萌关、江关、绵竹关；
   - 荆州 2 关：夏口、夷陵；
   - 扬州 3 关：濡须口、合肥、牛渚；
   - 并州 2 关：壶关、雁门关；
   - 冀州 2 关：界桥、井陉关。
2. **关隘与常规城市本质差异（严格遵循 `docs/04` §5.2）**：
   - **人口**：关隘无常规民政人口，仅有守备军旅；
   - **内政**：不可开发农业、商业，仅限修葺城墙工事；
   - **征兵**：不可在关隘本地募兵，兵力必须由依托之后方大城调拨进驻；
   - **驻军上限**：常规关隘 3000~5000 人（大关上限 5000）；
   - **战场险阻加成**：关隘地势狭窄，守军享有极高防御减免（普通关隘 +30%，雄关 `isFortressPass` +50%）；山地关隘（`isMountainPass`）骑兵攻关衰减 40% 攻力；水关（`isRiverPass`）受江防战力加持；
3. **要冲锁钥与过所通关阻绝**：
   - 关隘锁控特定两城间直通官道（如虎牢关锁洛阳—陈留，函谷关锁洛阳—长安，剑阁锁汉中—成都）；
   - 当关隘被敌对势力驻军控制时，阻遏敌军无阻通行与商路；
4. **确定性与零漂移铁律**：
   - 全息推演中严格遵循零 RNG 漂移标准，无关隘字典或未启用状态必须遵从严格 COW 保持原引用。

---

## 二、数据模型与契约扩充 (`@leh/shared`)

### 2.1 关隘实体契约 (`shared/types/pass.ts`)
```ts
export interface PassEntity {
  id: number;                   // 关隘唯一ID (1~25)
  name: string;                 // 关隘名称（如"虎牢关"、"剑阁"）
  province: string;             // 所属州（如"司隶"、"益州"）
  x: number;                    // 大地图坐标 X (0~5000)
  y: number;                    // 大地图坐标 Y (0~4000)
  factionId: number;            // 占领势力 ID (0 为中立汉廷/无主)
  troops: number;               // 关隘当前驻军 (0 ~ maxGarrison)
  morale: number;               // 驻军士气 (0 ~ 100)
  wall: number;                 // 当前城防耐久 (0 ~ maxWall)
  maxWall: number;              // 最大城防耐久 (2000 ~ 5000)
  maxGarrison: number;          // 最大驻军容量 (3000 ~ 5000)
  commanderId?: number;         // 驻防守将 ID
  isMountainPass: boolean;      // 是否山地关隘 (骑兵攻城衰减 40%)
  isRiverPass: boolean;         // 是否水关津渡 (江淮要冲)
  isFortressPass: boolean;      // 是否雄关 (守军防御 +50%，普通关隘 +30%)
  blocksRoutes: [number, number][]; // 封锁的城际道路对
  providesIntel: number[];      // 警戒侦察辐射城池 ID 列表
}
```

### 2.2 根级状态挂载 (`shared/types/game.ts` & `shared/game-state-full-schema.ts`)
```ts
export interface GameState {
  // ...
  passes?: Record<number, PassEntity>;
}
```
并在 `ROOT_KEYS` 中严格注册 `"passes"`。

---

## 三、纯函数运算模型 (`shared/pass.ts`)

1. **关隘攻坚防御修饰器 (`calculatePassDefenseModifier`)**：
   - 输入关隘状态与攻方是否为骑兵；
   - 输出守军防御加成（普通关隘 +30%，雄关 +50%）与攻方骑兵惩罚（山地关隘骑兵攻击 -40%）；城防为 0 时防御加成失效。
2. **路线阻绝检查 (`isRouteBlockedByPass`)**：
   - 检查路线 `[cityA, cityB]` 是否被中立/非己方且有驻军（troops > 0）的关隘所封锁。
3. **驻军调拨校验 (`canGarrisonPass`)**：
   - 检查调出城池兵力是否充裕（至少保留 1000 守备防暴乱），关隘调拨后驻军是否不超过 `maxGarrison`。
4. **城防修缮工本 (`calculatePassWallRepairCost`)**：
   - 单次修缮城墙耗费 200 贯，修补 +300 耐久（上限为 `maxWall`）。

---

## 四、引擎层生命周期 (`server/src/engine/pass.ts` & `turn.ts`)

1. **关隘初始化 (`initPasses`)**：
   - 载入 25 座历史关隘静态基准实体，注入 `state.passes`。
2. **关隘驻军调拨 (`dispatchGarrisonToPass`)**：
   - 从依托城池划拨兵力进驻关隘，若指定守将同时完成派驻；若关隘原为中立空关，确立所有权为该势力。
3. **兵力撤回后方 (`recallGarrisonFromPass`)**：
   - 将关隘守备撤回后方大城，若驻军全数撤空则守军归零。
4. **修葺险要工事 (`repairPassWall`)**：
   - 依托城池金库扣除 200 贯，关隘城防恢复 300 点。
5. **攻占破关易手 (`capturePass`)**：
   - 击溃守军后关隘所有权易主，剩余幸存部队转为新占领军。
6. **月结管线演化 (`tickPassesMonth`)**：
   - **严格 COW 与零漂移**：无关隘字典或未启用局，直接返回原引用；
   - 统帅≥75名将驻守关隘，驻军士气每月 +2（上限 100）；
   - 无将领驻守时士气每月微降 -1（下限 50）；
   - 彻底空关城防每月自然风化 -10（不低于 500）；
   - 全程零 RNG 消费，确保核心金样 `turn-golden.test.ts` 零漂移。

---

## 五、服务层、路由与离线 Web Worker 镜像

- `doInitPasses` -> `POST /pass/init`
- `doDispatchGarrison` -> `POST /pass/dispatch`
- `doRecallGarrison` -> `POST /pass/recall`
- `doRepairPassWall` -> `POST /pass/repair`
- `doGetPassesSummary` -> `GET /pass/summary`
- Worker 镜像：在 `client/src/workers/game.worker.ts` 中同步提供相同 5 大操作。

---

## 六、验收标准与门禁

- 建立专案门禁 `server/src/scripts/verify-s484-mountain-passes.ts`（不少于 60 项断言）；
- 核心金样 `turn-golden.test.ts` 3/3 严格匹配零漂移；
- 回归既有门禁（`verify-s483`, `verify-s482`, `verify-s481`, `verify-s480`, `verify-s479`, `verify-d0b9`）；
- 全仓单测与构建 100% 绿色通过。

---

## 七、实施与验收结论 (Session 484 完成)

1. **专案门禁全绿**:
   - `pnpm verify-s484-mountain-passes` 67/67 项断言 100% 通过（涵盖 25 座名关地缘全覆盖、纯函数险阻防御加成与骑兵削弱、路线阻绝检查、驻军调拨治安防暴防御、城防修缮工本、五大要塞政令闭环、月度演化风化与名将士气提升、24 个月全息推演、服务层与离线 Web Worker 接口）。
2. **核心金样零漂移验证**:
   - `pnpm test turn-golden.test.ts` 3/3 通过，零漂移铁律完全守住。
3. **既有门禁回归**:
   - `verify-s483` (71/71), `verify-s482` (66/66), `verify-s481` (54/54), `verify-s480` (60/60), `verify-s479` (66/66), `verify-d0b9` (40/40) 全部绿色。
4. **全仓构建与合规**:
   - 111 个单测套件 767 项单测 100% 通过；全仓 `pnpm -r build` 0 错误；`validate-data` 通过；`verify-compliance.mjs` (964 files) 0 错误。

