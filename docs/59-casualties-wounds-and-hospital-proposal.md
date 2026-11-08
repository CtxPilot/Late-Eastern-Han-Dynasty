# Phase 7-06 立项设计提案：战阵创伤、伤兵营收治与杏林医馆体系全栈落地

> **立项状态**：正式通过并进入落地阶段（Session 482）  
> **关联架构**：`docs/04-game-systems.md` §23（伤病系统）、§24（伤兵系统）、`docs/08-data-dictionary.md`、`docs/09-roadmap.md`、`docs/35-phased-implementation-roadmap.md`  
> **对齐准则**：数字真源在 `docs/08`；绝对零 RNG 漂移（`turn-golden.test.ts` 3/3 保持一致）；全量契约受严格 Zod Schema 校验。

---

## 一、背景与设计动机

1. **战后生机与军事后勤闭环需求**：
   在完成战俘刑赏（Phase 7-04）与商路特产（Phase 7-05）后，宏观军事后勤与伤员收治机制亟待完善。
   目前战斗战损直接将兵力销蚀扣减，缺乏古代战争中最重要的「战伤分流、伤兵收治、城池后方休养回流」逻辑：
   - 古代战阵战损通常分为**当场阵亡**（约 30%~40%）与**负伤失去战斗力**（约 60%~70%）；
   - 伤兵随军归城后，若后方医馆充盈、卫生良好、有药材调理，大多可逐步痊愈重披战甲；若不予照料或暴发疫病，伤兵则会恶化甚至死亡；
   - 武将临阵中箭负伤（如关羽刮骨疗毒、夏侯惇拔矢啖睛、孙策遇刺重创），分为轻伤、中伤、重伤、濒死，直接影响武力、统帅与出征单挑能力；
   - 药材经济联动：Phase 7-05 中益州川芎当归、幽州辽东老参等药材特产，正式成为医馆治伤调理的重要战略资源。

2. **设计目标**：
   依据 `docs/04-game-systems.md` §23 与 §24，打通：
   - 战场战损分流纯函数（阵亡 40%、伤兵 60%）；
   - 城池伤兵营数据契约（`City.woundedTroops`）与医馆拨款注资（`City.hospitalFundedMonths`）；
   - 武将创伤评级体系（`Officer.injury` 0~4 级）与战力削减判定；
   - 月度伤兵自然回流与药材/医术/卫生协同加成；
   - 医馆调理政令、金疮药紧急救治与创伤消解演进；
   - 绝对零 RNG 漂移：无伤员城池时严格 COW 保持原引用，零 RNG 调用。

---

## 二、数据契约与 Schema 扩展 (`@leh/shared`)

### 2.1 武将实体扩展 (`Officer`)
```ts
export interface Officer {
  // ... 既有字段 ...
  injury?: number; // 创伤等级：0=健康, 1=轻伤, 2=中伤, 3=重伤, 4=濒死
  injuryMonths?: number; // 负伤已累计月数（达到康复周期后创伤自动降级或痊愈）
}
```

- **创伤等级惩罚表（docs/04 §23.1）**：
  - `0 - 健康`：无惩罚；
  - `1 - 轻伤`：武力 -5%，统帅 -5%，不可过度操劳；
  - `2 - 中伤`：武力 -15%，统帅 -10%，**禁止出阵单挑**；
  - `3 - 重伤`：全属性 -20%，**禁止出征行军与单挑**；
  - `4 - 濒死`：全属性 -40%，仅可卧床休养，丧失全部行动能力。

### 2.2 城池实体扩展 (`City`)
```ts
export interface City {
  // ... 既有字段 ...
  woundedTroops?: number; // 城中伤兵营在册伤兵数
  hospitalFundedMonths?: number; // 医馆太医署官办注资剩余月数（期间享有 +10% 恢复加速）
}
```

### 2.3 纯函数模型
1. **战损分流计算（`calculateCasualtySplit`）**：
   - 输入总损耗兵力，按 40% 阵亡永久损失、60% 转入伤兵：
   ```ts
   dead = Math.round(totalLoss * 0.4);
   wounded = totalLoss - dead;
   ```
2. **月度伤兵回流率计算（`calculateMonthlyWoundedRecoveryRate`）**：
   - 基础回流率：`10%` / 月；
   - 官办医馆拨款（`hospitalFundedMonths > 0`）：`+10%`；
   - 城市卫生良好（`city.stats.sanitation > 80`）：`+5%`；
   - 驻城武将特技（拥有「悬壶」或「医术」）：最高 `+10%`；
   - 药材特产扶持（本城特产或与药材产地有通畅商路）：`+5%`；
   - 回流率夹紧在 `[10%, 40%]`。
3. **武将创伤战力修正（`calculateInjuryPenalty`）**：
   - 纯函数计算武将因伤削弱的有效武力与统帅，并返回单挑/行军行动许可。

---

## 三、引擎层与月结演进 (`server/src/engine/hospital.ts` & `turn.ts`)

1. **战斗战损结算接入**：
   - 在战斗胜利/溃散入城时，守方与撤回攻方的有效残存伤兵按 60% 计入归宿城池 `city.woundedTroops`。
2. **月度伤兵与创伤演进（`tickCasualtiesAndHospitalMonth`）**：
   - 保证 COW 零漂移铁律：
     - 若全图无任何城池存在 `woundedTroops > 0`，且全图无任何武将 `injury > 0`，且无 `hospitalFundedMonths > 0`，直接返回原引用 `state`，零开销零 RNG 调用！
   - 伤兵回流：遍历有伤兵城池，计算当月康复兵员，自 `woundedTroops` 扣减并增加入城中 `troops`；若有官办医馆拨款则 `hospitalFundedMonths` 减 1；
   - 武将创伤康复：负伤武将 `injuryMonths` 自增；轻伤满 2 月、中伤满 4 月、重伤满 6 月创伤等级自动递减 1 级直至痊愈恢复健康。
3. **医馆拨款注资政令（`fundCityHospital`）**：
   - 扣除发起城池 100 贯资金，设置 `hospitalFundedMonths = 3`，发布太医署官办医疗政令日志。
4. **派医诊治武将创伤（`cureOfficerInjury`）**：
   - 消耗城池资金（中伤 100 金，重伤 200 金），立即使武将创伤等级降级或加速康复 2 个月。

---

## 四、服务层、路由与离线 Web Worker 镜像

1. **服务层 (`server/src/services/game.ts`)**：
   - `doFundCityHospital(cityId: number)`
   - `doCureOfficerInjury(officerId: number)`
   - `doGetHospitalSummary(cityId?: number)`
2. **HTTP 路由 (`server/src/routes/game.ts`)**：
   - `POST /hospital/fund`
   - `POST /hospital/cure`
   - `GET /hospital/summary`
3. **离线 Web Worker (`client/src/workers/game.worker.ts`)**：
   - 全量镜像提供相同 3 大方法。

---

## 五、验收方案与门禁矩阵

专项门禁脚本：`server/src/scripts/verify-s482-casualties-hospital.ts`
1. 验证战损 40%/60% 分流纯函数数值精度；
2. 验证武将创伤 0~4 级属性削弱与单挑/出征行动封锁门禁；
3. 验证伤兵回流率模型（基础、医馆拨款、城池卫生、药材特产、医术特性加成）；
4. 验证引擎医馆注资（100 贯扣费、3 个月状态时效）与派医诊治闭环；
5. 验证月度回流与创伤自然康复（非伤病局严格 COW 保持原引用零 RNG 开销）；
6. 验证 24 个月全息推演生命周期、零内存泄漏与金样确定性；
7. 确保 `turn-golden.test.ts` 3/3 严格匹配零漂移。

---

## 六、验收交付结论（Session 482）

1. **门禁断言 100% 通过**：`pnpm verify-s482-casualties-hospital` 66/66 项断言全部绿色通过；
2. **零漂移铁律严格保持**：`turn-golden.test.ts` 3/3 严格匹配通过，无伤员局完全遵守 COW 零分配，零 RNG 消耗；
3. **全仓套件单测通过**：109 个套件 756 项测试 100% PASS；
4. **既有全量门禁兼容**：`verify-s481` (54/54)、`verify-s480` (60/60)、`verify-s479` (66/66)、`verify-s478` (69/69)、`verify-s477` (107/107)、`verify-d0b9` (40/40) 全部绿色通过；
5. **构建与合规校验**：全仓 `pnpm build` 与 `node scripts/verify-compliance.mjs` 0 错误通过。Phase 7-06 验收圆满达成。

