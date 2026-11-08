# Phase 7-07 边疆异族羁縻、朝贡互市与寇边讨伐体系全栈设计提案

> **提案编号**：docs/60  
> **所属路线**：Phase 7 — 政治体制与朝廷官制深度拓展（宏观边疆治理）  
> **关联章节**：`docs/04-game-systems.md` §7（少数民族系统）、§4.1（边地出身标签）、`docs/08-data-dictionary.md`  
> **目标会话**：Session 483  

---

## 一、背景与设计宗旨

三国时代边疆治理是影响中原割据格局的重大地缘要素：
1. **六大边疆少数民族**（匈奴、鲜卑、羌、氐、山越、南蛮）分据并州、幽州、凉州、扬州、南中等要地；
2. **张力与边疆威胁（Tension）**：边境承平日久且互市通畅时，异族朝贡名马珍奇并供给精锐佣兵；一旦边防空虚或矛盾激化，张力累积至临界将爆发小股袭扰、寇边劫掠乃至大举入侵；
3. **诸侯多轨应对策谋**：
   - **宣抚和亲与进贡羁縻（Pacification）**：以金帛粮草或通商互市抚慰，降低紧张度，维系边境安宁；
   - **派驻宿将镇边（Border Warden）**：选派统武出众之名臣良将（如曹仁、满宠、马超、田豫、牵招）出镇边塞，月度自然压制化解张力；
   - **发兵讨伐深入平定（Subjugation）**：遣名将统重兵深入险阻扫荡巢穴，大破敌部迫其降服，清空紧张度并赢得数年顺服威慑期与丰厚战利品；
   - **羁縻借兵征募（Tribal Levy）**：在亲和顺服时从边境城池直接征募特色异族精锐（匈奴突骑、鲜卑骑射、羌族山地兵、山越锐卒、南蛮藤甲兵）；
4. **确定性与零漂移铁律**：
   - 全息推进中严格遵循零 RNG 漂移标准，无异族事件或非活跃回合必须遵从严格 COW 保持原引用。

---

## 二、数据模型与契约扩充 (`@leh/shared`)

### 2.1 异族枚举与实体契约
```ts
export type MinorityTribeId = 'xiongnu' | 'xianbei' | 'qiang' | 'di' | 'shanyue' | 'nanman';

export enum TribeThreatLevel {
  PACIFIED = 0,   // 羁縻顺服 (0~29)：安居互市，可进贡、可征募特种兵
  UNSETTLED = 1,  // 暗流骚动 (30~59)：风声鹤唳，偶有轻微袭扰
  RAIDING = 2,    // 寇边劫掠 (60~79)：洗劫边城金粮，损耗民心
  INVASION = 3,   // 大举入侵 (80~100)：猛攻边寨，损伤城防与驻军
}

export interface MinorityTribe {
  id: MinorityTribeId;
  name: string;               // 匈奴 / 鲜卑 / 羌 / 氐 / 山越 / 南蛮
  regionName: string;         // '并州' | '幽州' | '凉州' | '凉/益' | '扬州' | '益州/交州'
  relatedProvinces: string[]; // 关联汉地州郡列表
  tension: number;            // 紧张度 0~100
  specialUnitName: string;    // 特色兵种（匈奴突骑、鲜卑突骑、羌兵、氐族步兵、山越兵、藤甲兵）
  specialtyTribute: string;   // 朝贡特产（战马、角弓、良马、药材、生铜、象牙）
  isSubdued?: boolean;        // 是否处于大捷讨平威慑期
  subduedMonths?: number;     // 威慑平静期剩余月数
  tributeCooldown?: number;   // 进贡冷却月数
}
```

### 2.2 纯函数模型
1. `calculateTribeTensionDelta`: 结合季节偏转、驻城宿将镇守、边城商业互市、驻军厚实度推导月度紧张度增减；
2. `getTribeThreatLevel`: 依据紧张度 `[0, 100]` 夹紧并映射至 4 档威胁等级；
3. `calculatePacificationEffect`: 纯函数计算宣抚羁縻工本与降张力幅度；
4. `canRecruitTribeTroops`: 校验当前城池与异族是否符合征募条件。

---

## 三、引擎层与月度演化管线 (`server/src/engine/minority.ts` & `turn.ts`)

1. **宣抚羁縻（`pacifyMinorityTribe`）**：
   - 消耗城池资金（300金），降低目标异族紧张度 25 点，生成宣抚公文日志；
2. **遣将征讨（`subjugateMinorityTribe`）**：
   - 派遣统武≥75的大将出征边地，结合兵力与武将战力结算讨伐大捷；
   - 获胜后紧张度归零，赋予 24 个月威慑平静期，缴获战马与异邦珍宝，主将累功 +50；
3. **羁縻征募（`recruitMinorityTroops`）**：
   - 当 `threatLevel === PACIFIED` 时允许在边境城池消耗资金招纳异族精锐扩充驻军，微幅上升 5 点紧张度；
4. **月结管线演化（`tickMinorityTribesMonth`）**：
   - 严格 COW 保持原引用零 RNG 消耗；
   - 演进威慑月数衰减；
   - 结算宿将镇边压制与边境安宁；
   - 周期性触发异族朝贡好感回馈。

---

## 四、服务层与离线 Web Worker 镜像

- `doPacifyMinorityTribe`
- `doSubjugateMinorityTribe`
- `doRecruitMinorityTroops`
- `doGetMinorityTribesSummary`

---

## 五、验收标准与门禁

- 建立专项门禁 `server/src/scripts/verify-s483-minority-tribes.ts`（不少于 50 项断言）；
- 核心金样 `turn-golden.test.ts` 3/3 严格匹配零漂移；
- 全仓单测与构建 100% 绿色通过。

---

## 六、实施与验收结论 (Session 483 完成)

1. **专案门禁全绿**:
   - `pnpm verify-s483-minority-tribes` 71/71 项断言 100% 通过（覆盖纯函数、初始化、宣抚羁縻、统武大将深入讨平、借兵扩编、月度演化威慑衰减、空虚寇边袭掠、正月顺服朝贡、服务层路由与离线 Web Worker）。
2. **核心金样零漂移验证**:
   - `pnpm test turn-golden.test.ts` 3/3 通过，零漂移铁律完全守住。
3. **既有门禁回归**:
   - `verify-s482` (66/66), `verify-s481` (54/54), `verify-s480` (60/60), `verify-s479` (66/66), `verify-d0b9` (40/40) 全部绿色。
4. **全仓构建与合规**:
   - 110 个单测套件 763 项单测 100% 通过；全仓 `pnpm -r build` 0 错误；`verify-compliance.mjs` (958 files) 0 错误。

