# 上下文管理策略

## 一、目的

本项目数据量大：
- 1000+ 武将（5属性 + 12隐藏属性 + 21兵种适性 + 阵型精通 + 技能）
- 105 城市
- 165 宝物（7品类：主/副武器+盔甲+坐骑+书籍+特殊+消耗品，含先秦珍藏已归入对应品类）
- 149 技能（69通用 × 5级 + 80专属）
- 90+ 女性
- 50+ 子女事件
- 21 兵种
- 18 阵型

开发上下文极易溢出。此文档用于在会话之间维持开发连续性，确保每次开始都能迅速定位和继续。

---

## 二、核心上下文文件（每次会话必加载）

这些文件定义了系统的"骨架"，每次开发会话开始时应作为上下文参考：

| 文件 | 内容 | 大小(估) |
|------|------|:--:|
| `HANDOFF.md` | 一分钟接手：阶段/怎么跑/人口约定/Next | ~4KB |
| `docs/10-progress.md` | 当前阶段 & 已完成/阻塞的 task | ~5KB |
| `docs/12-system-map.md` | **大系统清单 + 成熟度 + 扩充顺序** | ~6KB |
| `docs/09-roadmap.md` | 路线图 & 里程碑（工程任务层） | ~3KB |
| `docs/03-data-models.md` | 所有 TypeScript 类型定义（含 CityDemographics） | ~15KB |
| `docs/05-combat-system.md` | 战斗公式参考(伤害/克制/计策/单挑) | ~8KB |
| `docs/04-game-systems.md` | 内政/婚姻/子女/AI/**§28 人口结构** | ~12KB |
| `docs/01-overview.md` | 名词术语表 & 系统清单 | ~3KB |
| `shared/demographics.ts` | 人口/粮耗/衰老/美女资源 **代码真源常量** | ~4KB |
| `shared/ceiling.ts` | 属性天花板隐藏加成/第二档起点 **代码真源** | ~1KB |

### 快速加载策略

```
# 会话启动 → 执行：
1. Read HANDOFF.md（根目录）→ 一分钟接手：怎么跑 / 约定 / Next
2. Read docs/10-progress.md → 定位当前 WIP 与会话日志
3. Read docs/12-system-map.md → 大系统清单与扩充顺序（先定系统再动手）
4. Read 01-overview.md → 快速回顾系统全景
5. Read 09-roadmap.md → 确认工程 Phase 任务
6. Read 03-data-models.md → 加载类型体系
7. Read 04-game-systems.md / 05-combat-system.md → 按当前大系统切换
```

---

## 三、按需加载（进入该 Phase 时加载）

不是所有文档都需要在每次会话都加载。按开发阶段选择性加载：

| 正在执行的 Phase | 必加载的文档 |
|:--:|------|
| **P0** (骨架) | `08-data-dictionary.md`（数据 Schema） |
| **P1** (地图) | `07-ui-design.md`（MapCanvas 部分） |
| **P2** (内政/人口) | `04` §28、`shared/demographics.ts`、`07` RightPanel、`06` Demo API |
| **P3** (战斗) | `05-combat-system.md` 全文 |
| **P4** (外交/婚姻) | `04-game-systems.md`（外交/婚姻/事件 章节）、`06-api-design.md` |
| **P5** (AI/打磨) | `04-game-systems.md`（AI 章节） |

---

## 四、会话启动流程

```
1. 读取 docs/10-progress.md
   → 找到所有 [~] 状态的 task
   → 找到最近一次会话日志的 "Next" 行

2. 读取核心上下文文件(第二节列出的6个文件)

3. 读取当前 Phase 按需加载文件(第三节列出的对应文件)

4. 开始开发
   - 从最近的一个 [~] task 开始
   - 如果是新的 task，先在 10-progress.md 中标记 [~]
```

---

## 五、会话结束流程

```
1. 更新 docs/10-progress.md：
   - 将完成的 task 标记为 [x]
   - 新增本次会话发现的额外 task 到对应 Phase
   - 标记任何阻塞项([!])

2. 在 10-progress.md 底部"会话日志"中追加本次记录：
   - 时间段
   - Phase 范围
   - 完成的具体内容
   - 关键决策
   - 阻塞项
   - Next（下一次会话要做什么）

3. 【强制】同步更新根目录 HANDOFF.md：
   - 现在在哪 / 怎么跑 / 关键约定 / 已完成与未完成 / 建议 Next
   - 与 10-progress 同次提交，禁止只改进度表不改交接文件
   - 规则真源：docs/00-dev-constitution.md「进度双写」

4. 【强制】更新本功能触及的相关设计/接口/UI 文档（完成即文档）：
   - 规则/公式 → `04` / `05` / 代码真源注释
   - API → `06-api-design.md` Demo 附录或正式节
   - 面板交互 → `07-ui-design.md`
   - 类型字段 → `03-data-models.md`（若有变更）
   - 禁止只写代码 + 进度而不改被影响的设计说明

5. 如有架构级别决策变更：
   - 更新 docs/00-dev-constitution.md 中的决策记录
   - 更新受影响的 docs/ 文件

6. 如无变化，保持其他文档不变
```

### 完成即文档（与 00 / AGENTS 对齐）

**每完成一个新功能**（含 Demo 切片），同次收尾必须：验证通过 → `10-progress` + `HANDOFF` + 相关 docs。
不确定设计先问用户；有好提议可写入会话日志「提议」栏供拍板。

---

## 六、关键常量速查表

为避免每次会话都翻阅大文档，以下是最常用的常量：

### 五维属性

```
统帅(leadership)  武力(war)  智力(intelligence)  政治(politics)  魅力(charisma)
```

### 兵种适性

```
S(120%)  A(100%)  B(80%)  C(60%)  NONE(不可带队)
```

- **C**：能带队，属性×60%（「逼急了也能下水」）  
- **NONE**：禁止指挥该兵种  
- **原则（Session 71）**：会统兵的武将水军适性 **≥C**；NONE 仅留给纯文官（如荀彧）。吕布水军已改 C。

### 20项隐藏属性

**原有11项**：
```
相性(0~150)  义理(0~15)  野心(0~15)  勇猛(0~7)  冷静(0~7)
寿命(年)  成长(low/mid/high)  性格  理想  血缘(int[])  天花板加成(CeilingBonus)
```

**新增8项（1~100标度，用于单挑/舌战）**：
```
力量(power)  爆发(burst)  敏捷(agility)  运气(luck)
直觉(intuition)  威压(awe)  谋略(strategy)  奇谋(tactics)
```

### 宝物品类

```
weapon_primary(主武器)   → 5子类: sword/blade/spear/halberd/blunt
weapon_secondary(副武器) → 3子类: bow/crossbow/throwing
armor(盔甲)  → 4子类: cloth/leather/metal/specialArmor
mount(坐骑)  book(书籍)  special(特殊)  consumable(消耗品)
品质: common/rare/epic/legendary
```

### 6类女性影响力

```
household(治家→收入)  counsel(参谋→计策)  martial(习武→武力加成)
prestige(德望→征兵/登用)  fortitude(韧性→守城)  scholarship(学识→子女)
```

### 13州

```
司隶 豫州 冀州 兖州 徐州 青州 荆州 扬州 益州 凉州 并州 幽州 交州
```

### 关键公式速查

```
伤害 = (攻×克制系数×阵型×地形×兵力系数×士气系数) - 防御力
征兵数 = (统/50)×100×(魅/100)×季节修正
登用率 = 40%+(魅差)×0.3+(1-｜相性差｜/150)×40%+技能修正
单挑触发 = 勇猛×10%
暴击率 = 5%+武/50%+兵种修正+适性修正+技能修正+宝物修正
火计伤害 = 智×等级系数(1.0~2.5)
```

---

## 七、数据文件加载策略

```
武将数据(officers.json)    >200KB  → 仅加载出生年±50年内的武将（场景筛选）
宝物数据(items.json)       ~15KB   → 全量加载
城市数据(cities.json)      ~10KB   → 全量加载
阵型(formations.json)      ~5KB    → 全量加载
兵种(units.json)           ~5KB    → 全量加载
女性(females.json)         ~10KB   → 全量加载
子女(children.json)        ~5KB    → 全量加载
技能(skills.json)          ~30KB   → 全量加载
剧本(scenarios.json)       ~10KB   → 仅加载当前选择剧本
事件(events.json)          ~20KB   → 全量加载(需快速遍历条件匹配)
套装(itemsets.json)        ~3KB    → 全量加载
```

---

*文档版本: v1.4 | 最后更新: 2026-07-16（加载列表含 ceiling.ts / 天花板定稿）*
