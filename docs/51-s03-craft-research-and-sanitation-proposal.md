# S03 内政深度：技艺研发系统（Craft R&D）与城池卫生疫病闭环方案立项

> **会话**：Session 453 | **大系统**：S03 内政系统 / S08 朝廷制度  
> **文档定位**：系统设计与规格立项（遵循 `docs/00-dev-constitution.md`、`docs/04-game-systems.md` §2、§23、§28、§34 与 `docs/08-data-dictionary.md`）

---

## 一、背景与动机

在此前的内政系统建设中：
1. **四大持续投入项已全部落库（Session 362~399）**：文化（culture）、工艺（craft）、交通（transport）、卫生（sanitation）均已实现按月推进、暂停及 0~999 运行时积累。
2. **三项数值消费已闭环（Session 400~402）**：文化消费于在野人才登用成功率（每级 +2 百分点，顶 +10）、工艺消费于征兵部队士气（每级 +2，顶 +10）、交通消费于行军粮耗减免（每级 -2%，顶 -10%）。
3. **唯独遗留两大系统性缺口**：
   - **技术研发（Tech / Craft R&D）始终处于“后置”状态**：`docs/04 §34.6` 规划的农政、工商、军备、城防、教化五大“技艺与制度”路线从未落地，势力软实力的长期演进与差异化积累缺失；
   - **卫生（Sanitation）与疫病（Plague）始终未接入消费**：卫生仅能单向积累，缺少正向人口抚育反馈与负向低卫生灾害（夏秋瘟疫）的危机感，使得卫生投入缺乏战略紧迫性。

本方案在 **零 RNG 漂移（Zero RNG Perturbation）**、**数据与存档向后兼容**、**双端离线同源** 的严格前提下，全栈贯通技艺研发体系与城池卫生疫病闭环。

---

## 二、架构设计与核心规则

### 1. 技艺与制度体系（Faction Tech / Craft R&D）

严格遵循 `docs/04 §34.6`（正式术语“技艺与制度”，代码称 techLevels / activeResearch）：

#### 1.1 五大研发路线与级数效果（1~5 级）

| 路线 | 代码键 | 各级解锁效果 | 消费挂接引擎 |
|------|--------|--------------|--------------|
| **农政** | `farming` | **Lv1**: 农业产出 +10%<br>**Lv2**: 农业产出累积 +20%，民屯额外产粮 +20%<br>**Lv3**: 农业产出累积 +30%，冬季与灾月免减产<br>**Lv4**: 领内全城与部队月度粮耗 -10%<br>**Lv5**: 农政大成，每年秋季首月（8月）领内全城粮食大熟额外产出 +25% | `server/src/engine/economy.ts`<br>`turn.ts`<br>`demographics.ts` |
| **工商** | `commerce` | **Lv1**: 商业产出 +10%<br>**Lv2**: 商业产出累积 +20%<br>**Lv3**: 商业产出累积 +30%，每月商税收益 +10%<br>**Lv4**: 持续内政开发与修筑项目金钱花费 -15%<br>**Lv5**: 工商大成，领内每月金收入额外增发 +20% | `server/src/engine/economy.ts`<br>`civil.ts` |
| **军备** | `military` | **Lv1**: 征兵部队士气额外 +5<br>**Lv2**: 训练部队经验与士气增益 +25%<br>**Lv3**: 六角战与战役全军攻击力 +5%<br>**Lv4**: 出征部队行军粮耗 -15%<br>**Lv5**: 军备大成，全兵种攻防 +10%，部队基础士气上限提升至 105 | `server/src/engine/civil.ts`<br>`battle.ts`<br>`campaign.ts` |
| **城防** | `fortification` | **Lv1**: 城防项目（wall）开发完成进度 +20%<br>**Lv2**: 守城部队防御力 +15%<br>**Lv3**: 城池初始城墙耐久与城门减伤 +20%<br>**Lv4**: 守城方远程射程 +1（守军弓弩射击纵深）<br>**Lv5**: 金汤大成，攻城方围城每月额外损耗 +25% | `server/src/engine/civil.ts`<br>`battle.ts`<br>`campaign.ts` |
| **教化** | `cultivation` | **Lv1**: 武将每月经验获取 +20%<br>**Lv2**: 人才登用成功率额外 +5 百分点<br>**Lv3**: 武将忠诚自然衰减完全豁免（非叛逃将忠诚不自动下降）<br>**Lv4**: 势力声望（fame）每季自然衰减豁免<br>**Lv5**: 教化大成，领内城池民心每月自动 +1 | `server/src/engine/turn.ts`<br>`personnel.ts`<br>`factionPolitics.ts` |

#### 1.2 研发门槛、费用与工期真源

| 等级 | 文化门槛（势力城池最高文化） | 总金耗 | 首付（1/3） | 工期（月数） |
|:----:|:----------------------------:|:------:|:-----------:|:------------:|
| **Lv1** | 100 | 200 金 | 67 金 | 2 个月 |
| **Lv2** | 250 | 400 金 | 134 金 | 4 个月 |
| **Lv3** | 500 | 800 金 | 267 金 | 6 个月 |
| **Lv4** | 700 | 1600 金 | 534 金 | 8 个月 |
| **Lv5** | 900 | 3200 金 | 1067 金 | 12 个月 |

- **指派学者/谋臣**：研发项目须指派一名智力或政治 $\ge 60$ 的本势力在职武将（status: 'active'）。武将的高智政能力可提供研发专注度，若武将阵亡/被俘，研发暂停。
- **并发约束**：同一势力同时只能研发 1 项技艺（`Faction.activeResearch` 单例）。

---

### 2. 城池卫生与疫病闭环（Sanitation & Plague Mechanism）

#### 2.1 卫生对人口自然增殖与死亡率的消费（`demographics.ts`）

城池卫生值（0~999）按标准门槛 `[100, 250, 500, 700, 900]` 划分为 Lv0~5 级：
- **卫生增益（Lv1~5）**：
  - 儿童死亡率下降：`1 - reachedLevels * 0.1`（最高降低 50% 夭折率）
  - 老人自然衰老死亡率下降：`1 - reachedLevels * 0.08`（最高降低 40% 死亡率）
  - 成人本底疾病死亡率下降：`1 - reachedLevels * 0.08`（最高降低 40% 死亡率）
  - 生育环境增益：`1 + reachedLevels * 0.02`（最高提升 10% 新生儿出生率）
- **卫生低下惩罚（卫生 < 100，即 Lv0）**：
  - 儿童死亡率上升 $+30\%$
  - 老人死亡率上升 $+25\%$

#### 2.2 瘟疫爆发条件与判定（零 RNG 确定性逻辑）

- **爆发条件**：
  1. 季节为夏季或秋季（Season 1 或 2，湿热潮湿）；
  2. 城市人口 $> 10,000$（密集人口环境）；
  3. 城市卫生 $< 100$（恶劣卫生条件）；
  4. 城市当前未处于瘟疫状态（`city.plague == null`）；
  5. 恶化触发：若城池连续处于卫生 $< 60$ 的极端恶劣状态，则必爆发重度瘟疫（`severity: 'severe'`，持续 3 个月）；若卫生在 $60 \sim 99$ 则爆发轻度瘟疫（`severity: 'mild'`，持续 2 个月）。
  - **免疫底线**：城市卫生 $\ge 150$ 时天然绝对免疫瘟疫。

#### 2.3 瘟疫惩罚后果（月度结算 `turn.ts`）

处于瘟疫状态的城池每月结算：
1. **人口额外死亡**：重度瘟疫全城扣除 $1.5\%$ 人口，轻度扣除 $0.8\%$ 人口，四桶同比例减员；
2. **武将体力损耗**：城中驻留的所有武将体力扣除 15 点（若体力耗尽归 0 提示轻度疫病）；
3. **守军士气低迷**：守军士气每月 $-3$ 点；
4. **征兵禁令**：疫病肆虐期间，该城 `conscript` 征兵指令被直接阻绝（提示“疫气未散，禁止征发丁卒”）。

#### 2.4 治愈与阻绝途径

1. **自然消退**：每月月结 `remainingMonths -= 1`，归 0 时宣告疫病平息；
2. **赈济抚民（Relief）**：执行内政「赈济」时，若本城存在瘟疫，除提升民心外，立即额外清除 1 个月瘟疫剩余时间，并为城内武将恢复 10 点体力；
3. **大力修缮卫生（Develop Sanitation）**：当本城的持续卫生项目（sanitation）完成结项时，若城内有疫病，直接立即彻底清空疫病（`delete city.plague`）并记录“除秽清源，疫病彻底拔除”战报！

---

## 三、数据模型设计

```typescript
// shared/types/city.ts
export interface CityPlague {
  remainingMonths: number;
  severity: 'mild' | 'severe';
}

export interface CityRuntimeStats {
  // ...既有字段
  sanitation?: number; // 0~999 卫生值
}

export interface City extends CityStatic {
  // ...
  plague?: CityPlague | null;
}

// shared/types/faction.ts
export interface TechLevels {
  farming: number;
  commerce: number;
  military: number;
  fortification: number;
  cultivation: number;
}

export type TechBranch = keyof TechLevels;

export interface ActiveResearch {
  branch: TechBranch;
  targetLevel: number;
  assignedOfficerId: number;
  totalMonths: number;
  remainingMonths: number;
  totalGoldCost: number;
  goldPaid: number;
}

export interface Faction {
  // ...
  techLevels?: TechLevels;
  activeResearch?: ActiveResearch | null;
}
```

---

## 四、验证计划

1. **专项验证脚本**：`server/src/scripts/verify-s51-craft-research-and-sanitation.ts`（注册 `pnpm verify-s51-craft-research-and-sanitation`）：
   - 验证 5 大路线研发门槛校验、金钱首付与月费扣除、工期推进与完成升级；
   - 验证 5 大路线各级数值效果消费（农产增益、商税增益、军备士气与攻防、城防工期、教化登用与忠诚衰减豁免）；
   - 验证卫生对 demographics 出生率与死亡率的确定性数学增益与恶化；
   - 验证夏秋低卫生瘟疫爆发、持续时间、人口与体力扣减、征兵禁令门禁；
   - 验证赈济缩短疫病与卫生完成彻底拔除疫病；
   - 验证重复执行幂等与零 RNG 漂移。
2. **月结金样确定性指纹**：`turn-golden.test.ts` 3/3 必须 100% 保持完全一致（0 漂移）。
3. **离线 Worker 对齐**：`scripts/verify-s416-worker-parity.mjs` 5/5 全绿。
4. **全套全仓门禁**：`typecheck`、`test`、`lint`、`validate-data`、`verify-compliance` 全绿。
