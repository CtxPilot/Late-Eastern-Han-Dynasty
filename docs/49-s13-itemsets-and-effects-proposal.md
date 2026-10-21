# S13 装备与宝物系统终局深化 · 套装体系（Set L3）与未接入装备词条消费闭环实施规格（Session 451）

> 依据：`docs/04` §12.2（L3 套装效力）、`docs/44` §四（D9 套装、D11 未接入 effect 清单）、`docs/48`（Session 450 8 槽位与 Bond L2）与用户拍板指令。
> 阶段：Phase 0-B 数据守恒与系统闭环；大系统 ID：S13（宝物与装备）。
> 目标：在保持 165 件宝物真源守恒、零 RNG 扰动、旧档完全向后兼容的前提下，实现套装（Set / L3）体系与未接入核心词条（`charge_damage` / `mobility` / `range` / `recruit_bonus` / `authority`）在战斗、内政与外交引擎的消费点闭环，实现 S13 终局完全成熟闭环。

---

## 一、现状与事实实勘（F1~F10）

| # | 事实 | 证据 |
|---|------|------|
| F1 | 8 槽位与 L2 专属羁绊已于 Session 450 全栈实装 | `shared/items.ts`、`server/src/engine/items.ts`、`verify-s48` 54/54 |
| F2 | `shared/types/item.ts` 既有字段 `sets?: number[]` 已声明但 `items.json` 165 条中 `sets` 填充率为 0 | `server/src/data/items.json` grep 0 命中 |
| F3 | `docs/04 §12.2` 明确定义 L3 套装阶梯：2件套 1.2倍、3件套 1.5倍+特技、4件套 2.0倍+终极特技 | `docs/04` lines 1562-1567 |
| F4 | `items.json` 中已存在 25 类词条，其中 `charge_damage`（6条）、`mobility`（12条）、`range`（4条）、`recruit_bonus`（2条）、`authority`（9条）未接真实消费点 | `items.json` 统计 |
| F5 | 六角战斗 `battle.ts` 移动后冲锋已接入 `resolveChargeBonus`，但未叠乘武将装备 `charge_damage` 效果 | `battle.ts:1014` |
| F6 | 六角战斗 `battle.ts` 单位机动力（`mp` / `maxMp`）仅读兵种模板与国策，武将坐骑 `mobility` 未计入 | `battle.ts:259-262` |
| F7 | 六角战斗 `battle.ts` 远程兵种射程仅读 `effectiveUnitRange(atkT.range)`，宝弓神弩 `range` 未计入 | `battle.ts:988-992` |
| F8 | 内政征兵 `civil.ts` `conscript` 募兵量计算包含城主功绩、技能与民心，装备 `recruit_bonus` 未计入 | `civil.ts:280-283` |
| F9 | 外交谈判 `negotiation.ts` 结盟成功率包含使节魅力、辩才与天命，重宝威信 `authority` 未计入 | `negotiation.ts:214-224` |
| F10 | `turn-golden.test.ts` 守护 12 个月指纹与 24 个月双局确定性，任何引擎改动不得引起月结自律演进漂移 | `turn-golden-12.json` |

---

## 二、设计原则（P1~P5）

- **P1 数据真源守恒**：`items.json` 严格保持 165 件记录守恒，不新增、不删减任何 item ID；仅在既有宝物条目上配置 `sets: [setId]`。
- **P2 零 RNG 扰动**：所有套装乘区与装备特效均为纯函数、确定性数值计算，不额外消费任何随机数，保障金样指纹 100% 保持。
- **P3 效力层级正交叠乘**：严格落实 `docs/04 §12.2` 的效力叠加规则 `L1 × L2(如有) × L3(如有)`。基础效果在共鸣与套装均激活时，享受双重叠乘并在末端追加全部隐藏特技词条。
- **P4 共享类型唯一源**：套装定义 `ItemSet` 及常量数据置于 `@leh/shared`（`shared/item-sets.ts`），前端 UI 与服务端引擎直接共享，杜绝异步 I/O 风险。
- **P5 优雅降级与旧档兼容**：武将未装备整套宝物时不触发 L3；既有旧存档无需数据迁移，自动派生。

---

## 三、拍板决策（D1~D10）

### 1. 套装定义模型与计算（D1~D4）

- **D1 套装结构（ItemSet）**：
  ```typescript
  export interface ItemSetTier {
    count: number; // 2, 3, 4
    statMultiplier?: number; // 1.2, 1.5, 2.0
    bonusStats?: Partial<OfficerStats>;
    bonusEffects?: ItemEffect[];
    name: string;
    description: string;
  }
  export interface ItemSet {
    id: number;
    name: string;
    itemIds: number[];
    description: string;
    tiers: ItemSetTier[];
  }
  ```
- **D2 套装件数激活与叠加**：
  - 武将身上属于同一套装的装备件数达到 $n$（$n \ge 2$）时，激活对应阶梯；
  - 乘区 `statMultiplier` 取最高达成的阶梯（2件套 1.2倍、3件套 1.5倍、4件套 2.0倍），仅作用于属于该套装的部件基础属性与效果；
  - 隐藏属性 `bonusStats` 与效果 `bonusEffects` 累加已解锁各阶梯之和。
- **D3 L2 Bond 与 L3 Set 复合乘区规则**：
  - 部件属性 = `Math.floor(baseStat * bondMultiplier * setMultiplier) + bondBonusStat + setBonusStat`；
  - 词条效果数值 = `Math.floor(baseEffect.value * bondMultiplier * setMultiplier)`；
  - 隐藏词条列表 = `[...baseEffects, ...bondBonusEffects, ...setBonusEffects]`。
- **D4 十大史实经典名品套装规划**：
  1. **【威震华夏】** (关羽·3件套)：青龙偃月刀(1) + 赤兔马(10) + 假节钺(117)
  2. **【天下无双】** (吕布·4件套)：方天画戟(2) + 兽面吞头连环铠(67) + 三叉紫金冠(73) + 赤兔马(10)
  3. **【魏武雄风】** (曹操·4件套)：倚天剑(4) + 绝影(12) + 孟德新书(14) + 锦袍金带(123)
  4. **【昭烈仁德】** (刘备·3件套)：雌雄双股剑(5) + 的卢(11) + 玉带诏(115)
  5. **【卧龙天机】** (诸葛亮·4件套)：诸葛连弩(7) + 孙子兵法(13) + 纶巾(126) + 木牛流马(127)
  6. **【常胜龙胆】** (赵云·3件套)：龙胆亮银枪(46) + 白银铠(68) + 宝雕弓(6)
  7. **【江东霸业】** (孙坚/孙策·3件套)：古锭刀(22) + 赤罽帻(128) + 铁胎弓(51)
  8. **【万人莫敌】** (张飞·3件套)：丈八蛇矛(3) + 锁子甲(66) + 铁兜鍪(79)
  9. **【锦马银枪】** (马超·3件套)：虎头湛金枪(47) + 红锦战袍(75) + 熟铜盔(70)
  10. **【社稷正朔】** (帝王正统·3件套)：传国玉玺(15) + 兵符(18) + 金印紫绶(120)

### 2. 未接入 Effect 消费点落地（D5~D9）

- **D5 `charge_damage`（突击伤害加成）**：
  - 引擎 helper：`equipChargeBonusFor(officer)`；
  - 消费点：[`server/src/engine/battle.ts`](file:///home/ctxpilot/Late-Eastern-Han-Dynasty/server/src/engine/battle.ts) 普攻冲锋计算处，当 `attackerMoved` 时叠加：`charge.bonusPct += equipChargeBonusFor(atkO)`。
- **D6 `mobility`（战术机动力加成）**：
  - 引擎 helper：`equipMobilityBonusFor(officer)`；
  - 消费点：[`server/src/engine/battle.ts`](file:///home/ctxpilot/Late-Eastern-Han-Dynasty/server/src/engine/battle.ts) `buildSideUnits` 中计算 squad 基础机动力时：`prepareDefenseHexMobility(template.mobility + equipMobilityBonusFor(officer), ...)`。
- **D7 `range`（远程射程加成）**：
  - 引擎 helper：`equipRangeBonusFor(officer)`；
  - 消费点：[`server/src/engine/battle.ts`](file:///home/ctxpilot/Late-Eastern-Han-Dynasty/server/src/engine/battle.ts) 攻击距离校验中：`effectiveUnitRange(atkT.range + equipRangeBonusFor(atkO), battle.weather)`。
- **D8 `recruit_bonus`（募兵效率加成）**：
  - 引擎 helper：`equipRecruitBonusFor(officer)`；
  - 消费点：[`server/src/engine/civil.ts`](file:///home/ctxpilot/Late-Eastern-Han-Dynasty/server/src/engine/civil.ts) `conscript` 征兵量公式中作为附加乘区 `+ equipRecruitBonusFor(lord) / 100`。
- **D9 `authority`（外交威信加成）**：
  - 引擎 helper：`equipAuthorityBonusFor(officer)`；
  - 消费点：[`shared/negotiation.ts`](file:///home/ctxpilot/Late-Eastern-Han-Dynasty/shared/negotiation.ts) `calculateAllianceChance` 中，出使使节或主公所带威严效果转化为盟约加成百分点。

### 3. UI 呈现规范（D10）

- **D10 OfficerDetail 装备 tab 增强**：
  - 在 8 槽列表下方增加「套装激活（套装效果）」模块；
  - 每一激活套装展示套装名、达成件数徽章（如 `【昭烈仁德 (2/3)】`）；
  - 逐行展示各阶级效果，当前达成阶级呈高亮暗金/翡翠水墨色，未达成阶级呈浅灰提示色；
  - 槽位卡片上带有套装归属小标（如 `[威震华夏]`）。

---

## 四、实施不变量（R1~R5）

- **R1 守恒**：`items.json` 保持严格 165 条，`validate-data.ts` 0 异常。
- **R2 零扰动**：所有战力与属性计算不改变随机数流，`turn-golden.test.ts` 3/3 通过。
- **R3 兼容**：旧档武将装备对象不含套装额外字段，由引擎纯函数实时派生。
- **R4 闭环**：十大套装的每一件宝物 ID 均在 `items.json` 中真实存在且类别正确。
- **R5 验收门禁**：新增专用验收脚本 `verify-s49-itemsets-and-effects.ts` 覆盖率 100%。
