# Phase 7-03 立项设计提案：天下大势演进与九品中正制门阀政治全栈落地

> **立项状态**：已全栈落地并通过验收门禁（Session 479 完成）  
> **关联架构**：`docs/04-game-systems.md` §九/§十/§27、`docs/08-data-dictionary.md`、`docs/09-roadmap.md`、`docs/35-phased-implementation-roadmap.md`  
> **对齐准则**：数字真源在 `docs/08`；绝对零 RNG 漂移（`turn-golden.test.ts` 3/3 保持一致）；全量类型契约受严格 Zod Schema 校验。

---

## 一、背景与设计动机

在东汉末年向魏晋演进的政治史中，政权合法性与官僚选拔的核心转折点是：
1. **天下大势演化（Historical Trends）**：
   天下政局经历了「初平群雄割据」（190~199）、「建安争锋霸业」（200~207）、「赤壁三分天下」（208~219）、「三国鼎立称制」（220~264）、「天下一统禅代」（265+）的宏观历史周期。不同大势阶段深刻影响着诸侯天命流变、士人归附意向与天下人心走向。
2. **九品官人法（九品中正制）**：
   延康元年（220 年），魏王曹丕采纳吏部尚书陈群之议，创立九品中正制。各州郡设中正官，考评士人体貌德行家世，评定「上品无寒门，下品无势族」之九品等级（一品至九品）。它既是士族阶层与皇权妥协的政治契约，也是中央朝廷任命官职、选拔公卿的关键门槛。
3. **现有系统短板**：
   既有政治阶段（`vassal`→`hegemony`→`king`→`emperor`）已具备开府称王称帝基础，但武将仕宦仍停留在纯功绩属性检定，缺少代表魏晋门阀政治灵魂的「九品中正定品」机制；同时全图缺少宏观大势阶段的显式标识与流转加成。

---

## 二、核心架构与数据契约扩展

### 2.1 九品官人法体系（Nine Ranks System）
每个在职武将引入中正定品评阶：
- **评阶枚举/数值（`RankGrade`）**：
  - `1`: 一品（极品，如公卿、辅政、三公重臣）
  - `2`: 二品（州牧、上卿、大将军、车骑将军）
  - `3`: 三品（刺史、六曹尚书、御史中丞、九卿、四征四镇）
  - `4`: 四品（四方将军、都督）
  - `5`: 五品（郡守太守、杂号将军）
  - `6`: 六品（偏将军、都尉）
  - `7`: 七品（县令、校尉）
  - `8`: 八品（从事、军司马）
  - `9`: 九品（书吏、军候、白身入仕初品）

- **评定算法（`evaluateOfficerRankGrade`）**：
  - 基础定品基于家世门第：武将含「士族」「名门」tag 者，基础起评直接进入高品（前 4 品）；
  - 寒门庶族武将起评为七~九品，需依靠高智政/高武统或功绩等级提升评品；
  - 中正定品评语生成与动态重估。

### 2.2 天下大势阶段（GeneralTrendStage）
定义全局宏观政局大势：
```ts
export enum GeneralTrendStage {
  WARLORDS_DISORDER = 'warlords_disorder', // 群雄并起割据（190~199）
  HEGEMONY_CONTEST = 'hegemony_contest',   // 中原争霸逐鹿（200~207）
  THREE_KINGDOMS_FORMING = 'three_kingdoms_forming', // 三分鼎立酝酿（208~219）
  THREE_KINGDOMS_RIVALRY = 'three_kingdoms_rivalry', // 三国称帝对峙（220~264）
  UNIFICATION_CLIMAX = 'unification_climax',         // 九州归一禅代（265+）
}
```

### 2.3 状态实体与 Schema 注册
- `Officer`: 扩充 `rankGrade?: number`（1~9 品，数值越小品阶越高）；
- `GameState`: 扩充 `trendStage?: GeneralTrendStage`；
- `shared/game-state-entity-schema.ts`: 在 `OfficerRuntimeSchema` 中注册 `rankGrade`；
- `shared/game-state-full-schema.ts`: 在 `ROOT_KEYS` 中注册 `trendStage`。

---

## 三、引擎层推进与业务逻辑

1. **大势判定（`deriveTrendStage`）**：
   - 纯函数根据当前年份（`currentYear`）及存活势力格局推导当前大势阶段；
   - 在 `turn.ts` 月结推进中自动更新 `nextState.trendStage`。
2. **中正官定品（`appointRankEvaluator` & `evaluateAllOfficersNineRanks`）**：
   - 势力进入霸府（`hegemony`）或以上阶段后，可任命大中正官；
   - 每年岁首统发前或中正重核时，自动为全境官员重新评定品级；
   - 品级加成武将声誉、对朝廷公卿官职的任命门槛生效。
3. **官职任命与中正品阶联动（`appointOfficer`）**：
   - 丞相/三公要求 `rankGrade <= 2`；
   - 州牧/刺史要求 `rankGrade <= 4`；
   - 太守要求 `rankGrade <= 6`；
   - 寒门若无相应功绩打破品阶限制，强行任命将触发士族不满与民心浮动。

---

## 四、验证方案与验收门禁

专属验证脚本：`server/src/scripts/verify-s479-political-trends-nine-ranks.ts`（66/66 全部通过）
1. 验证 `GeneralTrendStage` 枚举与大势根据年份/格局的推导正确性（断言 1~16）；
2. 验证中正定品算法 `evaluateOfficerRankGrade` 对名门士族 vs 寒门将领的品阶梯次（断言 17~33）；
3. 验证任命官职时的九品中正门槛校验与君主豁免机制（断言 34~53）；
4. 验证势力中正大巡查与官绅品阶分布摘要服务（断言 54~62）；
5. 验证 24 个月全息推演中天下大势演进与岁首定品重核平稳推进（断言 63~66）；
6. 既有门禁 `verify-s478-advanced-diplomacy` (69/69)、`verify-s477-official-ranks` (107/107)、`verify-d0b9-fiscal-salary` (40/40) 全绿；
7. 验证 `turn-golden.test.ts` 3/3 严格匹配零 RNG 漂移。
