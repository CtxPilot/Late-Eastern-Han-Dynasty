# Session 240 · CMD-P35 家族迁移前审计与浏览器基线

> 范围：S20 / S18 既有家族入口审计。本轮不迁移、不删除生产入口，不修改规则、API、
> 数值、RNG、Schema 或存档。

## 一、结论

旧 `FamilyPanel` 同时承载只读女眷/姻亲/固定子女、确定性婚配，以及会消费权威 RNG 的
手动跟随检查。后续不能整块复制，须先拆出只读摘要，再分别迁移婚配与跟随。

## 二、现有读写链与归属

| 链路 | 入口 / API / 引擎 | 归属与边界 |
|---|---|---|
| 女眷名册 | `GameState.females` | S18 历史女角；不是 S09 `beautyStock`，不可由寻访或人事搜索获得 |
| 姻亲与子女摘要 | `enabledChildEventIds` + `/static` children + `GameState.officers` | S18；仅显示剧本白名单内固定子女，父辈/完整族谱未实装 |
| 婚配 | store `marry` → `/personnel/marry` → `marryFemale()` | S18，借用 personnel 路由前缀；仅历史女角，金300、忠诚+18、确定性且不消费 RNG |
| 手动跟随检查 | store `followCheck` → `/personnel/follow-check` → `tickFollowCheck()` | S18；当前点击即提交，会消费单一权威 RNG |
| 月度自动投奔 | `advanceTurn()` → `tickFollowCheck()` | S18 共享结算，不是玩家按钮 |
| 人事登用后的入势力 | `personnel.ts` → `joinFaction()` | S11 触发、S18 维护妻随夫/城市/势力关系；迁家族 UI 时不得复制登用 |
| 释放后的随迁 | `releaseOfficer()` | S18 内部关系同步；当前没有家族玩家入口 |
| 固定子女登场 | `child.ts` `catchUpChildren/tickChildrenAppear` | S18 年度/开局结算；固定身份、年份、属性与母教，不消费 RNG |

## 三、必须保持的系统边界

- S09 `beautyStock/beautySeekLeft` 是“宫廷人脉机会库存”，不产生历史女角，不进入婚配选择器。
- S11 人事只负责男将搜索、登用、任官与赏罚；`/personnel/*` 路由前缀不改变婚配/跟随的 S18 归属。
- 历史女角除祝融外不可像男将任职、出战；祝融权限来自静态 `canCommand`。
- 父辈、完整族谱、随机出生、性别抽签、属性继承、纳妾、离婚和继承均未实装，不提供占位按钮。

## 四、审计发现的迁移前技术债

`family.ts` 的 `findWivesOfOfficer()` 当前同时匹配 `husbandId` 与 `giftedToOfficerId`，因此
“已赏赐女角”也会随武将加入或释放；其注释却称“妻子”。这属于既有运行时语义，不在
P35 静默改动。P37 迁移跟随前须先依据 S09/S18 边界补引擎回归并决定是保留“随侍随迁”
还是收窄为正式婚姻。

## 五、后续固定实施顺序

1. **CMD-P36**：命令坞家族建立 `总览｜姻亲｜婚配｜跟随` 四分面，只接同源只读摘要，新写入口0。
2. **CMD-P37**：先拍板并验证随侍随迁语义，再迁婚配与手动跟随；婚配进统一终审，随机跟随也须增加终审，取消不得消费 RNG。
3. **CMD-P38**：删除旧 `FamilyPanel` 与左栏家族折叠，复验婚配、手动跟随、S11 登用触发妻随夫、年度固定子女以及唯一入口。

## 六、可复现浏览器基线

`CDP_PORT=9238 pnpm verify-cmd-p35-headless` 固定 1440×900、英雄集结曹操局：

- 旧 `FamilyPanel` 恰好1个；婚配、手动跟随入口各1；命令坞家族新写入口0。
- 实际选择历史女角与己方无妻武将：取消后完整权威状态不变；确认后扣金300、忠诚+18、
  双向婚姻关系与 `marry` 日志成立。
- 浏览器 console error 为0。
