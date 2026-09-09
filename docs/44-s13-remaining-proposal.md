# S13 剩余后置逐项立项 · 实装设计规格（Session 437 纯设计轮）

> 前置：S13 已落地 432（消耗品运行时）/435（快捷槽分配携带）/436（装备缴获）；
> docs/43 S1/S2 已收官。0-B 闸门（`docs/41` §三真人游玩）仍未过，本规格只立项、不扩数据。
> 体例沿 docs/43：实勘行号 + D 拍板点（含推荐值）+ R 不变量 + 验收方案 + 切片。

## 一、范围界定

S13（宝物与装备，`docs/12` S13 行）剩余 8 项，按依赖分成三组：

- **缴获链收口**（复用 436 模式，零新数据、数值沿既有口径）：T2 消耗品缴获 / T3 阵亡回库（传承）/ T4 被俘没收。
- **战斗中使用**（T1，需新端点 + 行动力语义，类型范围是主要决策面）。
- **数据门**（T5 8 槽剩余三槽 / T6 套装 L3 / T7 共鸣 L2 / T8 未接入 effect——全部缺数据或数值，一律只登记、不实装）。

## 二、现状实勘（证据行号，Session 437 复核）

| # | 事实 | 证据 |
|---|------|------|
| F1 | 5 槽装备栏位：`weaponPrimary/weaponSecondary/armor/mount/tome`，`EQUIP_SLOT_ORDER` 即全部 | `shared/items.ts:85-100` |
| F2 | 运行时语义仅 3 类：stamina/heal→体力、morale→所在城士气、food→所在城军粮；cure 等 6 类明确拒绝 | `server/src/engine/items.ts:452`（`useConsumable`） |
| F3 | 快捷槽 `consumableSlots?`（≤2 种×≤99），分配/卸下/扣槽优先回退库存 | `server/src/engine/items.ts:254/299`，`shared/types/officer.ts:124` |
| F4 | 装备缴获：阵亡主将/副将每件独立 30%，无装备不掷点，战报追加 | `server/src/engine/campaign.ts:93/1809-1826`，结算点 `:1862/1886/1906` |
| F5 | 436 既定边界：**被俘不缴、六角无主将伤亡不缴、残部退守不缴** | `docs/05` §11.2 实装注 |
| F6 | 阵亡以 `commanderStatus['killed']` 经 `applyBattleResultToState` 结算 | `campaign.ts:1065/1175/1183/1213/1223` |
| F7 | 六角单位行动门禁：`hasActed`（变阵置 `hasActed=true, mp=0` 为先例） | `server/src/engine/battle.ts:590/624/646` |
| F8 | `items.json` 165 条 **`bond` 出现 0 次**；`shared/items.ts` 无 bond 消费 | `server/src/data/items.json`（grep 0 命中） |
| F9 | 自然死亡写入点**未定位**：`turn.ts` 仅功绩衰减（70 岁起）+ `status!=='dead'` 读取（`:389`）；`'dead'` 字面在引擎/服务层无写入点 | Session 437 grep 实勘 |
| F10 | 赏赐已实装（`grantTreasure` 按品质忠诚+5~20 自动装备），其**反向（手动没收）不存在** | `server/src/engine/items.ts:331`，`unequipItem`（`:221`）仅卸下回库、无忠诚语义 |
| F11 | 战斗中使用规格句：仅「战斗中可在行动回合使用（消耗 1 次行动力）」+ 四例（金疮药恢复本队 15% 兵力/火油/锦囊/解毒草），**无一例有运行时语义** | `docs/04` §12.3 使用规则/典型例 |
| F12 | 消耗品缴获规格句：获取方式列有「战斗缴获（击败携带消耗品敌军）」，**无概率** | `docs/04` §12.3 获取方式 |

## 三、设计原则（沿 docs/43 R 纪律）

P1 **缴获链沿 436 口径**：无标的即不掷点（零 RNG 扰动）、固定军序槽序、缴获入胜者库存、战报追加。
P2 **战斗中使用零 RNG**：恢复量取确定性值（沿 432 体力上限口径），不引入新随机源。
P3 **数据门不开**：T5~T8 任一实装前须先有数据批次（items.json 新品类/bond/itemsets）+ 数值拍板，本轮只给推荐值。
P4 **AI 不用消耗品**（沿天气主动技能「敌军 AI 不改」先例、`docs/35` ㊺ P1-2/㊼ P1-4 的 AI 改动均走独立切片纪律）。

## 四、拍板点（D1~D12，各附推荐值）

### T1 战斗中使用

- **D1 可用类型范围**：推荐**仅 stamina/heal**（唯一在战斗中有意义的已实装语义：恢复主将体力，沿 432 上限 `calcStaminaMax`）。morale/food 在六角无着落点（士气/军粮是城属性）→ 明确拒绝；cure 等 6 类沿 432 拒绝；金疮药「恢复本队 15% 兵力」/火油/锦囊/解毒草因**兵力恢复与状态系统均无数值拍板**，拆入 T1b 另行立项。
- **D2 行动力代价**：推荐**消耗整次行动**（置 `hasActed=true`，沿 F7 变阵先例 battle.ts:624；与规格句「消耗 1 次行动力」对齐）。已行动/非活跃/敌方单位拒绝。
- **D3 扣减来源与入口**：推荐扣槽优先回退库存（沿 435 `useConsumable` 口径，参战武将 `consumableSlots` 可读）；新端点 `battle/use-consumable` 走**五处镜像**（routes→services→worker→api/offline-api→store，D-0B-1 纪律），日志沿 `item_use`。

### T2 消耗品缴获

- **D4 概率与粒度**：推荐**阵亡者快捷槽每种独立 30% 整叠转移**（`LOOT_CONSUMABLE_CHANCE=0.3`，与 F4 装备件独立 30% 同口径；整叠而非按个数掷点，避免 RNG 消费量与叠数耦合）；无槽不掷点；缴获入胜者库存；战报追加（沿 F4）。概率值待用户拍板（默认 0.3）。

### T3 阵亡回库（传承）

- **D5 范围与归属**：推荐**战斗阵亡者未被缴获的装备 + 快捷槽余量全部回原势力库存**（`commanderStatus['killed']` 结算处，F6；阵亡者装备不再凭空消失）。自然死亡因 F9 未定位流转，**首轮不做**，待实勘到写入点后另行切片。

### T4 被俘没收

- **D6 自动没收**：推荐解 F5「被俘不缴」边界——被俘主将/副将装备**按件独立 30% 归俘获方库存**（沿 F4 口径；未中件被俘者保留，随招降/赎回流转另行立项）。
- **D7 手动没收**：推荐**只立项不实装**——君主强制卸下麾下装备回库涉及忠诚惩罚数值（类比赏赐 +5~20 的反向），无规格，需用户拍板数值后再切。

### T5~T8 数据门

- **D8 8 槽剩余**（兜鍪/冠、战袍/绶带、配饰/印信）：推荐分两步——T5a 数据批次（items.json 新品类条目 + `EquipSlot` 类型扩展 + `EQUIP_SLOT_ORDER/LABELS` 扩展位预留）；T5b 引擎 + UI（`equipRequirement`/`equipBonusFor`/`equipItem` 按新槽生效 + OfficerDetail 新增三槽位）。两步均需用户先批数据规模。
- **D9 套装 L3**：`SetTier[n-2]` 数值已有但 **itemsets 数据（setId 归属表）为零**，推荐数据批次先行，数值沿 `docs/04` §12.2。
- **D10 共鸣 L2**：150% + 隐藏词条数值已有（`docs/04` §12.2），但 F8 实锤 **bond 数据为零**；推荐 bond 数据批次先行（165 条逐条指定专属武将 + 出处），隐藏词条内容需逐条设计（又是数据工作量）。
- **D11 未接入 effect 清单**（逐项立项，全部需引擎消费点 + 数值拍板）：mobility / charge_damage / authority / legitimacy / recruit_bonus / poison / medicine / logistics + 0-B 风味类型。推荐按「有现成消费点」排序：recruit_bonus（征兵链）> authority/legitimacy（任命/外交权重链）> 其余。

### 通用

- **D12 切片顺序**：推荐 **S4a 消耗品缴获 → S4b 阵亡回库 → S4c 被俘没收**（缴获链收口，全复用 436 模式，最低风险）→ **S4d 战斗中使用**（新端点 + BattleView 按钮）→ 数据门（T5a→T5b→T6/T7/T8 按 D8~D11）待拍板。

## 五、不变量（R1~R4，供验收断言）

- **R1 零扰动**：无阵亡/无槽/无装备时零 RNG 消费；战斗中使用零 RNG；单军路径逐字节不变（沿 docs/43 R4）。
- **R2 确定性**：新增掷点固定军序槽序、走权威 `xorshift32` 流；同种子双局逐字节一致。
- **R3 存档兼容**：不新增必填字段（沿 `consumableSlots?` optional 先例）；旧档缺省可解析。
- **R4 金样门禁**：任一切片若前移 RNG 流，按 433/422 流程删金样重举（须 1~10 月逐字节不变 + 合法性说明）；零扰动切片须 3/3 保持。

## 六、验收方案

每切片独立 `server/src/scripts/verify-s43x-*.ts`（沿 436 体例：确定性双局 + 守恒 + Schema + 金样扫描）+ 复用 436 回归矩阵（turn-golden 3/3、campaign 71、ai-military 38、cadence 28、saves、s432/s433/s434/s435/s436、shared 481、server 3、client 71、三端 typecheck、parity、compliance、diff-check）。UI 切片（S4d）另附 headless CDP 点击脚本（沿 s434-ui 27/27 体例）。

## 七、实施顺序与文档同步

S4a→S4b→S4c→S4d，每片双写 `04 §12.3` + `05 §11.2`（缴获链）/ `06`（新端点）/ `07`（UI）+ `10-progress` + `HANDOFF` + 本文件状态节。数据门切片另起数据批次文档。

> **本文件状态**：Session 437 纯设计轮落盘；**Session 438 S4a 已落地**（`seizeKilledConsumables` + `verify-s44a` 12/12 + 回归矩阵全绿 + 金样零扰动；05 残部注勘误）。**Session 439 S4b 已落地**（`returnKilledRemains` + `verify-s44b` 16/16 + `verify-s44a` 守恒口径同步 + 回归矩阵全绿 + 金样零扰动；实勘沉淀：全歼双掷点 quirk / 退守斩杀留活口，另行立项才动）。下一步按 D12 开 S4c。

## 八、明确不做

- 任何数值拍板（D4/D6 的 0.3 均为推荐值，用户可改）；AI 使用消耗品（P4）；回合中途增援（docs/43 §八）；自然死亡回库（F9，待实勘）；手动没收忠诚惩罚（D7）；8 槽/套装/共鸣/effect 的数据与数值（D8~D11）。
