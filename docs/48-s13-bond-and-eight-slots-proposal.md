# S13 宝物与装备系统 · 8 槽位扩展与专属羁绊（Bond / L2 共鸣）实装规格（Session 450）

> **前置**：S13 已落地 432（消耗品运行时）/ 435（快捷槽分配携带）/ 436（装备缴获）/ 438（消耗品缴获 S4a）/ 439（阵亡回库 S4b）/ 440（被俘没收 S4c）/ 441（战斗中使用 S4d）。
> 用户于 Session 449 后拍板：「推进 S13 装备与宝物羁绊深化：制定 165 件宝物的武将专属羁绊（Bond/共鸣 L2）与 8 槽位扩展方案」。
> 数字真源：`docs/08-data-dictionary.md` §四保持 165 条宝物总量不变。体例沿 docs/45~47：实勘行号 + D 拍板点 + R 不变量 + 验收方案。

---

## 一、范围界定

本阶段覆盖 `docs/44-s13-remaining-proposal.md` 中登记的两个核心数据门与机制门：

1. **T5 装备 8 槽位全量扩展**：
   - 从 0-A 精简 5 槽（主武器、副武器、铠甲、坐骑、兵书）扩展至 `docs/04` §12.1 规定的完整 **8 个装备槽**：
     - 主武器 (`weaponPrimary`)
     - 副武器 (`weaponSecondary`)
     - 兜鍪/冠 (`headwear`)
     - 铠甲 (`armor`)
     - 战袍/绶带 (`robe`)
     - 坐骑 (`mount`)
     - 兵书/典籍 (`tome`)
     - 配饰/印信 (`accessory`)
   - 结合 Session 435 已实装的 2 格消耗品快捷槽，形成标准的「8 装备槽 + 2 快捷槽」武将行囊架构。

2. **T7 专属羁绊与共鸣（Bond / L2 共鸣）运行时与数据**：
   - 落实 `docs/04` §12.2「L2 专属共鸣：`武将ID == Item.bond.officerId` → 150% 效果 + 解锁隐藏共鸣词条」；
   - 历史考据与人物契约：为三国传世名将与名品（如关羽与青龙偃月刀/赤兔、吕布与方天画戟/连环铠、张飞与丈八蛇矛、曹操与倚天剑/绝影/孟德新书、刘备与雌雄双股剑/的卢、赵云与亮银枪/青釭剑/白银铠、诸葛亮与连弩/兵法二十四篇、张角与太平要术、华佗与青囊书等）赋予专属 `bond` 契约与隐藏共鸣词条；
   - 引擎属性与效果算力打通：有效属性（effectiveWar / effectiveLeadership 等）、战斗暴击率、护甲防御、单挑加成全面支持 L2 共鸣；
   - 客户端 UI 展示与交互升级：`OfficerDetail` 展示 8 槽位、专属武将标识、共鸣激活高亮徽章与隐藏词条。

---

## 二、现状实勘（证据行号，Session 450 复核）

| # | 事实 | 证据 |
|---|------|------|
| F1 | `EquipSlot` 当前仅包含 5 槽：`weaponPrimary/weaponSecondary/armor/mount/tome` | `shared/types/item.ts:67-72` |
| F2 | `ItemCategory` 当前包含 7 种：`weapon_primary/weapon_secondary/armor/mount/book/special/consumable` | `shared/enums/index.ts:129-137` |
| F3 | `equipSlotFor(category)` 仅将 5 种映射到槽位，`special/consumable` 返回 `null` | `shared/items.ts:14-30` |
| F4 | `items.json` 165 条中 `bond` 字段存在率为 **0%**（165 条无一配置 bond） | `server/src/data/items.json`（grep 0 命中） |
| F5 | `items.json` 25 件 `special` 宝物中大量为印信/配饰（传国玉玺、大将军印、相国印、兵符、假节钺、丹书铁券等）或战袍（锦袍金带、蜀锦）；armor 中包含战袍（红锦战袍、赤锦战袍） | `server/src/data/items.json` |
| F6 | `shared/game-state-entity-schema.ts` 中 `equipment` 对象声明了 `.strict()`，仅允许 5 个可选键 | `shared/game-state-entity-schema.ts:104-113` |
| F7 | `shared/validators/index.ts` 中 `ItemStaticSchema` 的 `category` 仅接受 7 个字符串枚举 | `shared/validators/index.ts:332-340` |
| F8 | `equipmentStatBonus` 仅对 `baseStats` 简单累加，未接收 `officerId`，无任何 1.5 倍共鸣或 bond 判定 | `shared/items.ts:59-77` |
| F9 | `server/src/engine/items.ts` 的 `equipBonusFor`、`equipArmorDefenseFor`、`equipCritRateFor`、`duelEquipBonusFor` 未计算共鸣增益与 bonusEffect | `server/src/engine/items.ts:55-100` |
| F10 | `OfficerDetail.tsx` 写死「装备（5槽）」，仅遍历 5 个槽位，未渲染专属共鸣状态 | `client/src/components/officer/OfficerDetail.tsx:371-373` |

---

## 三、设计原则（沿 docs/43 R 纪律）

- P1 **规模真源守恒**：`items.json` 保持 165 件总量不变，`validate-data.ts` 与 `docs/08` 数据字典数字真源严格对齐。
- P2 **开局宝配零扰动（金样 3/3 保持）**：0-A 开局签名装备（关羽青龙刀、吕布画戟、张飞蛇矛、曹操倚天、刘备双股剑、赵云宝雕弓、诸葛亮兵法）及其初始入库状态完全保持，金样 `turn-golden-12.json` 逐字节不变。
- P3 **零 RNG 扰动**：专属共鸣与 8 槽位扩展为纯确定性映射与加权运算，不消耗任何随机数流。
- P4 **旧档无损兼容**：新槽位在存档中未装备时为 `undefined`，Zod Schema 设为 `.optional()`，支持任意旧存档平滑读取。
- P5 **考据严谨，文风金石**：专属武将契约以《三国志》、《后汉书》正史及裴松之注为基，辅以演义脍炙人口名物，共鸣词条文言典雅，严禁现代白话戏说。

---

## 四、核心拍板点（D1~D10）

### 1. 8 槽位定义与命名（D1）
- 槽位键名定义：
  - `weaponPrimary`: 主武器（近战刀枪剑戟矛）
  - `weaponSecondary`: 副武器（弓弩暗器）
  - `headwear`: 兜鍪/冠（盔帽冠巾）
  - `armor`: 铠甲（身甲）
  - `robe`: 战袍/绶带（袍服披风印绶）
  - `mount`: 坐骑（战马良驹）
  - `tome`: 兵书/典籍（兵法经史）
  - `accessory`: 配饰/印信（玉佩官印符节）
- 中文标签：
  `weaponPrimary` -> '主武器',
  `weaponSecondary` -> '副武器',
  `headwear` -> '兜鍪/冠',
  `armor` -> '铠甲',
  `robe` -> '战袍/绶带',
  `mount` -> '坐骑',
  `tome` -> '兵书/典籍',
  `accessory` -> '配饰/印信'

### 2. 品类枚举扩展与槽位映射（D2）
- `ItemCategory` 枚举扩充：
  - `HEADWEAR = 'headwear'`
  - `ROBE = 'robe'`
  - `ACCESSORY = 'accessory'`
- `equipSlotFor(category)` 映射：
  - `weapon_primary` -> `weaponPrimary`
  - `weapon_secondary` -> `weaponSecondary`
  - `headwear` -> `headwear`
  - `armor` -> `armor`
  - `robe` -> `robe`
  - `mount` -> `mount`
  - `book` -> `tome`
  - `accessory` -> `accessory`
  - `special` -> `accessory`（向后兼容：特殊类珍宝/印信默认映射至配饰/印信槽）
  - `consumable` -> `null`（不占装备槽）

### 3. 专属共鸣 L2 数学模型（D3）
- 判定条件：`isItemBondActive(item, officerId) = (item.bond?.officerId === officerId)`
- 当共鸣激活时：
  1. **基础属性 1.5 倍加成**：`statValue = Math.floor(baseStats[key] * 1.5)`；
  2. **额外羁绊属性**：若 `bond.bonusStats` 存在，累加至属性中；
  3. **基础效果 1.5 倍加成**：`effectValue = Math.floor(effect.value * 1.5)`；
  4. **隐藏共鸣效果解锁**：`bond.bonusEffect` 中的所有额外效果全部生效；
- 当非专属武将装备时：
  - 仅享受 100% 基础属性（`baseStats`）与 100% 基础效果（`baseEffect`），不享受共鸣加成，不解锁隐藏词条。

### 4. 专属羁绊（Bond）重点历史名品清单设计（D4）
在 165 件宝物中为核心三国人物量身配置契约：
- **关羽** (ID 6)：
  - 青龙偃月刀 (ID 1)：武力 10 → 共鸣 15；暴击率 +5% → +7%；解锁【武圣】单挑决斗战意 +20%；
  - 赤兔马 (ID 10)：机动力 +2 → +3；解锁【千里单骑】撤退损耗降低；
- **吕布** (ID 5)：
  - 方天画戟 (ID 2)：武力 12 → 共鸣 18；突击伤害 +15% → +22%；解锁【无双】暴击率 +10%；
  - 兽面吞头连环铠 (ID 67)：统率 +3 → +4；解锁【辕门威势】部队防御 +10；
  - 束发金冠 (ID 73)：武力 +2 → +3；解锁【飞将】移动力 +1；
- **张飞** (ID 7)：
  - 丈八蛇矛 (ID 3)：武力 8 → 共鸣 12；对骑加成 +10% → +15%；解锁【当阳怒吼】敌军士气削减 +5；
- **曹操** (ID 1)：
  - 倚天剑 (ID 4)：武力 8/统率 3 → 共鸣 12/4；威望 +5 → +7；解锁【唯才是举】登用成功率提升；
  - 绝影 (ID 12)：统率 2 → 共鸣 3；机动力 +1 → +1；解锁【神遁】免受伏击；
  - 爪黄飞电 (ID 80)：魅力 3 → 共鸣 4；解锁【许田射鹿】士气激励 +10；
  - 孟德新书 (ID 14)：统率 5/政治 3 → 共鸣 7/4；解锁【兵法注疏】计策气力消耗 -5；
- **刘备** (ID 2)：
  - 雌雄双股剑 (ID 5)：武力 6/魅力 3 → 共鸣 9/4；解锁【昭烈】麾下将领忠诚衰减降低；
  - 的卢 (ID 11)：魅力 2 → 共鸣 3；脱逃 +20% → +30%；解锁【檀溪跃马】水战/泥沼地形惩罚减免；
  - 玉带诏 (ID 115)：魅力 5/政治 3 → 共鸣 7/4；解锁【汉室宗亲】天命人心增益 +10；
- **赵云** (ID 10)：
  - 龙胆亮银枪 (ID 46)：武力 7/统率 2 → 共鸣 10/3；解锁【浑身是胆】反击伤害 +25%；
  - 宝雕弓 (ID 6)：武力 4 → 共鸣 6；射程 +1 → +1；解锁【截江夺阿斗】水上命中提升；
  - 白银铠 (ID 68)：统率 3/武力 1 → 共鸣 4/1；解锁【长坂突围】受围惩罚免疫；
- **诸葛亮** (ID 4)：
  - 诸葛连弩 (ID 7)：武力 5/智力 2 → 共鸣 7/3；破甲 +15% → +22%；解锁【武侯巧思】射程 +1；
  - 孙子兵法 (ID 13)：智力 8/统率 4 → 共鸣 12/6；战法威力 +10% → +15%；解锁【经天纬地】智力加权；
  - 木牛流马 (ID 127)：政治 4/智力 3 → 共鸣 6/4；解锁【转运不匮】行军粮耗降低 15%；
- **典韦** (ID 9)：
  - 双铁戟 (ID 23)：武力 7 → 共鸣 10；解锁【古之恶来】濒死攻击力翻倍；
- **孙坚** (ID 17)：
  - 古锭刀 (ID 22)：武力 6/统率 2 → 共鸣 9/3；解锁【江东猛虎】攻城破阵伤害 +15%；
- **董卓** (ID 3)：
  - 相国印 (ID 119)：政治 5/统率 3 → 共鸣 7/4；解锁【跋扈专权】势力内政压制；
- **张角** (ID 20)：
  - 太平要术 (ID 105)：智力 7/魅力 4 → 共鸣 10/6；解锁【黄天当立】民心煽动与妖术增益；
- **华佗** (ID 308)：
  - 青囊书 (ID 106)：智力 6/政治 2 → 共鸣 9/3；解锁【妙手回春】每月伤兵自愈加速；
- **姜维** (ID 101)：
  - 兵法二十四篇 (ID 129)：智力 6/统率 4 → 共鸣 9/6；解锁【继志九伐】战役战力强化。

### 5. 引擎数值消费接入（D5）
- `equipBonusFor(officer: Pick<Officer, 'id' | 'equipment'>)`：根据 `officer.id` 与各装备的 `bond`，计算 1.5 倍基础属性与 `bonusStats`；
- `equipArmorDefenseFor(officer)`：装备铠甲若激活共鸣，`defense` 效果享受 1.5 倍并叠加 bond 中的 defense 效果；
- `equipCritRateFor(officer)`：暴击率享受 1.5 倍并叠加 bond 中的 `crit_rate` 效果；
- `duelEquipBonusFor(officer)`：单挑加成计算共鸣后的武力与 `duel_boost`。

### 6. UI/UX 金石水墨呈现（D6）
- `OfficerDetail.tsx` 装备面板改造：
  - 标题调整为「装备（8 槽位）」，网格扩展支持 8 槽；
  - 未激活羁绊：卡片底部浅黛色小字提示「专属羁绊：关羽（未激活）」；
  - 已激活羁绊：卡片边框呈微金光晕，上方镶嵌朱砂「共鸣 150%」方印（`SealBadge`），数值以翡翠色展示（如 `武力 +10 → +15`），并以金石文风列出解锁的隐藏词条（如「【武圣】单挑决斗战意提升」）。

---

## 五、不变量（R1~R5，供验收断言）

- **R1 零扰动**：未装备/非专属武将装备时，计算结果与原先 100% 逐字节一致；初始开局装备不产生任何逻辑分叉。
- **R2 确定性**：同种子、同状态下共鸣数值计算完全确定，零随机数消费。
- **R3 存档兼容**：`GameState` 存档读写完全向下兼容旧档，未填槽位缺省，Zod Strict 严格校验通过。
- **R4 真源守恒**：`items.json` 保持 165 件，不增删条目数量，`validate-data.ts` 保持绿灯。
- **R5 契约闭环**：所有 `bond.officerId` 必须引用 `officers.json` 中真实存在的有效武将 ID。

---

## 六、验收方案

1. **共享核心与 Schema 单测**：
   - `shared/items.test.ts`：覆盖 8 槽映射、1.5 倍共鸣、隐藏词条解锁、反向不触发断言；
   - `shared/game-state-entity-schema.ts`：8 槽序列化/反序列化校验。
2. **专项验证脚本**：
   - 新建 `server/src/scripts/verify-s48-bond-and-eight-slots.ts`：
     - 断言 8 槽完整映射与中文标签；
     - 断言 关羽装备青龙刀激活共鸣（武力 10 → 15，暴击 5 → 7，解锁武圣）；
     - 断言 吕布装备青龙刀仅获得基础效果（武力 10，暴击 5，无武圣）；
     - 断言 8 槽位穿脱（headwear/robe/accessory 等）全流程；
     - 断言 完整 `GameStateSchema` 往返与旧档缺省兼容；
     - 断言 `items.json` 165 件全部合规且所有 bond.officerId 均在册。
3. **回归套件**：
   - `pnpm test`（shared 480+ / server 3 / client 71 全绿）；
   - `pnpm verify-items`（32/32 全绿）；
   - `pnpm verify-compliance`（814 文件全绿）；
   - `pnpm typecheck` & `pnpm lint`。
