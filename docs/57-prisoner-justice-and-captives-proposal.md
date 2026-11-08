# Phase 7-04 立项设计提案：战俘处置与刑赏牢狱体系全栈落地

> **立项状态**：已全量落地并通过验收 (Session 480 · 专案门禁 60/60 全绿 · turn-golden 零漂移)  
> **关联架构**：`docs/04-game-systems.md` §二十二（关押系统）、`docs/08-data-dictionary.md`、`docs/09-roadmap.md`、`docs/35-phased-implementation-roadmap.md`  
> **对齐准则**：数字真源在 `docs/08`；绝对零 RNG 漂移（`turn-golden.test.ts` 3/3 保持一致）；全量契约受严格 Zod Schema 校验。

---

## 一、背景与设计动机

1. **现有系统短板**：
   既有单挑结算（`battle.ts`）与战役破城（`campaign.ts`）已接入击败败将标俘机制（`status = OfficerStatus.PRISONER`），并实现了被俘装备按概率没收（Session 440 S4c）。但俘获后的武将此前处于“只标俘、无处置”的悬空状态：
   - 无法对战俘进行招降（如关羽降汉不降曹、张辽降曹）；
   - 无法进行宽宥释放以结善缘（如张飞义释严颜、诸葛亮七擒孟获）；
   - 无法索要赎金（以充国库军资）；
   - 无法依法明正典刑军法处决（如白门楼斩吕布陈宫、临沮斩关羽），且处决缺少历史厚重的声望惩罚与宿仇联动。

2. **设计目标**：
   依据 `docs/04-game-systems.md` §二十二，构建完整的战俘羁押、处置（招降/义释/索赎/斩决）与月度流转生命周期，提供服务端路由、离线 Web Worker 镜像与全息门禁保障。

---

## 二、数据契约与 Schema 扩展

### 2.1 Officer 实体扩充
在 `Officer` 运行时接口扩充战俘相关字段：
```ts
export interface Officer extends OfficerStatic {
  // ...既有字段
  /** 羁押/扣押此战俘的势力 ID（当 status === OfficerStatus.PRISONER 时生效） */
  captiveByFactionId?: number;
  /** 已羁押月数（影响越狱率与屈服招降几率） */
  imprisonedMonths?: number;
}
```

### 2.2 Zod Schema 严格对齐
- `shared/game-state-entity-schema.ts`: 在 `OfficerRuntimeSchema` 中注册：
  - `captiveByFactionId: z.number().int().positive().optional()`
  - `imprisonedMonths: z.number().int().nonnegative().optional()`

---

## 三、算法模型与纯函数设计

### 3.1 战俘招降几率模型（`calculatePrisonerSurrenderChance`）
招降成功率取决于：
1. **俘虏心理防御**：
   - 义理（`hidden.righteousness`）：义理极高者（如关羽、审配）极难招降；
   - 原势力忠诚度（`loyalty`）：忠诚越高招降阻力越大；
2. **羁押心理演进**：
   - 关押月数（`imprisonedMonths`）：久羁牢狱，锐气日销，每关押 1 个月几率 +2%（最多 +30%）；
3. **招降方威望与才德**：
   - 劝降君主魅力（`charisma`）与政治（`politics`）；
   - 亲和度（`pairAffinity`）：相性相近者更易归心；
   - 势力声望加成（`fame`）；
4. **几率夹紧**：基础区间 [5%, 85%]。

### 3.2 赎金定价模型（`calculatePrisonerRansomValue`）
依据官员才德五维、门阀品阶及功绩等级计算金钱赎金：
- 基础赎金：300 金；
- 五维加成：五维总和超过 350 部分，每 10 点 +20 金；
- 品阶加成：1~3 品公卿上卿 +300 金，4~6 品 +150 金；
- 功绩加成：功绩等级每级 +20 金；
- 封顶：最高不超过 1500 金。

---

## 四、四大处置指令与业务规则

1. **招抚归顺（`persuadePrisonerSurrender`）**：
   - 成功时：`officer.status = OfficerStatus.ACTIVE`，`officer.faction = captorFactionId`，`officer.captiveByFactionId = undefined`，初始忠诚度由招降评价给定；
   - 失败时：战俘态度坚决拒绝归降，记录日志，继续关押。

2. **宽宥义释（`releasePrisoner`）**：
   - 施恩释怀归国：`officer.status = OfficerStatus.ACTIVE`，返回原所属势力治所城池；
   - 释放方获声望 +15；
   - 被释武将对释放方君主建立感恩义理，亲和度提升 +30；
   - 两国友好度增加 +15。

3. **索要赎金（`ransomPrisoner`）**：
   - 向战俘所属原势力索取赎金；
   - 原势力若国库充足，扣缴金钱并支付给俘获方势力；
   - 战俘回国恢复自由；俘获方金库入账。

4. **军法处决（`executePrisoner`）**：
   - 斩决战俘：`officer.status = OfficerStatus.DEAD`，记录殁年；
   - 斩杀方声望遭受严惩（-50，名士名将 -100）；
   - 与原势力外交友好度断崖式下跌 -50；
   - 死者至亲与原势力君主建立深仇宿敌（`RuntimeRelation` 登记仇怨）；
   - 俘获方麾下其余在押战俘恐惧震慑，短期招降难度调整。

5. **月度羁押流转（`tickPrisonersMonth`）**：
   - 在 `turn.ts` 月结中，已俘武将 `imprisonedMonths` 递增；
   - 高智力武将在城防低下的城池中存在小几率（1%~3%）越狱逃亡回国。

---

## 五、验收方案与门禁矩阵

专项门禁脚本：`server/src/scripts/verify-s480-prisoner-captives.ts`
1. 验证 `Officer` 实体与 Schema 对 `captiveByFactionId` / `imprisonedMonths` 校验合法性；
2. 验证招降几率计算模型与赎金定价模型的纯函数数值边界；
3. 验证招降成功与失败的状态转换及归属转移；
4. 验证宽宥义释的双向友好增进与声望奖励；
5. 验证索取赎金的金钱交割与安全回国；
6. 验证军法处决的声望扣减、死者死亡状态与外交恶化；
7. 验证 24 个月全息推演中战俘月度羁押流转与越狱演进；
8. 验证 `turn-golden.test.ts` 3/3 严格匹配零 RNG 漂移。

---

## 六、落地验收成果（Session 480）

1. **纯函数与模型层（`@leh/shared`）**：
   - 字段挂载：`captiveByFactionId` 与 `imprisonedMonths` 注册至 `Officer` 及 `OfficerRuntimeSchema`；
   - 算法模型：`calculatePrisonerSurrenderChance`（义理/忠诚抵抗、久羁锐气消解、君主德望感召，夹紧在 [5, 85] 区间）、`calculatePrisonerRansomValue`（五维溢价、九品品阶、功绩等级折算法定赎金 100~1500 金）、`isPrisoner`、`getFactionPrisoners` 纯函数；
   - 单测覆盖：`shared/prisoner.test.ts` 7/7 绿灯。
2. **引擎层全息生命周期（`@leh/server`）**：
   - `battle.ts` 与 `campaign.ts`：败将被俘处准确写入 `captiveByFactionId = victorFactionId` 与 `imprisonedMonths = 0`；
   - `prisoner.ts`：实现四大处置能力 `persuadePrisonerSurrender`、`releasePrisoner`、`ransomPrisoner`、`executePrisoner` 与月度流转 `tickPrisonersMonth`；
   - `turn.ts`：月结管线挂载 `tickPrisonersMonth`，无战俘时遵循 COW 零分配零 RNG 调用保证零漂移。
3. **服务层、路由与离线 Web Worker 镜像**：
   - `server/src/services/game.ts` 与 `server/src/routes/game.ts`：挂载 `/prisoner/list`、`/prisoner/persuade`、`/prisoner/release`、`/prisoner/ransom`、`/prisoner/execute`；
   - `client/src/workers/game.worker.ts`：全量打通离线 PWA 模式对应战俘 5 大方法。
4. **验证门禁指标**：
   - 专属门禁：`verify-s480-prisoner-captives` 60/60 全部通过；
   - 既有门禁：`verify-s479` (66/66)、`verify-s478` (69/69)、`verify-s477` (107/107)、`verify-d0b9` (40/40) 全绿；
   - 零漂移：`turn-golden.test.ts` 3/3 严格匹配；
   - 全套构建与校验通过：`pnpm build`、`pnpm test`（107 套件 725 单测全绿）、`validate-data`、`verify-compliance.mjs`。
