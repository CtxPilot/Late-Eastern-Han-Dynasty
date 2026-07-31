# HANDOFF — 会话交接

> **接手必读**：本文件 + `docs/10-progress.md` + `docs/12-system-map.md`  
> 勿从聊天历史推断。数字真源：`docs/08-data-dictionary.md`。

---

## 1. 现在在哪

| 项 | 状态 |
|----|------|
| 会话 | **Session 253：BF-P5 录入/校勘工具（第一步）** |
| 阶段 | Phase 0-A + Demo 玩法环；**暂缓 0-B**；系统数 **23 大** |
| 代码最新 | **BF-P5 录入/校勘工具第一步已完成：**seed-schema.ts + 两郡迁移 + verify 脚本 + 16 单元测试 |
| 文档最新 | 当前状态已同步至 Session 253 / BF-P5 录入工具 `[x]`；历史会话口径按原时点保留 |
| 本交接用途 | BF-P5 录入/校勘工具完成后的下一子步骤选择 |
| 玩法下一步 | 继续 **BF-P5** 剩余子步骤：Army—县位置映射、第三郡录入（需用户提供史料）、orchestrator 去硬编码、郡域迷雾 |

CMD-P4 回归基线：shared 197/197、client 12/12、HC-P0 101/101、Campaign 70/70、
AI军事29/29、negotiation 40/40，根 31 个 `verify-*` 全过；typecheck/lint/data/build/SPDX 全绿。
另有 `pnpm verify-cmd-p4-headless`：旧君主 DOM=0、开府/伪诏取消与确认、皇权/冷却/战争、
官制跳人事、控制台错误=0。

Session 201 回归基线：shared 197/197、client 14/14、Campaign 71/71、plot/spy RNG 34/34、
HC-P0 101/101，根目录 31 个非浏览器 `verify-*` 全过；typecheck/lint/data/build 全绿。

CMD-P8 回归基线：shared 197/197、client 19/19、根目录 33 个非浏览器 `verify-*` 全过；
Campaign 71/71、人事32/32、negotiation 40/40、turn-cadence 28/28、存档迁移19/19；
CMD-P7/P8 Headless 与 typecheck/lint/data/build 全绿。

Session 206 仅同步文档口径：`08/09/12/26` 已从“HC-P1 尚未开工、CMD 人事待迁移”更新为
HC-P1-1～3、CMD-P6～8 已完成；无运行时代码变化，沿用 Session 205 全量回归结果。

Session 210 回归基线：shared 198/198、client 20/20、根 35 个非浏览器 `verify-*` 全过；
HC-P1-4 26/26；CMD-P8/P9 Headless 全绿（1440×900，正式跨抽屉跳转、任官取消/确认、
赏罚边界、console error=0）；typecheck/lint/data/build/diff-check 全绿。

Session 211 增量基线：`verify-hc-p1-5` 12/12；shared 198/198、client 20/20；
typecheck/lint/build/diff-check 全绿。1440×900 Headless 实测朝廷政治进程、称王门槛 API、
王号候选与王国官职阶段隐藏，console error=0。完整跨12月/攻城链留 HC-P1-6。

Session 212 基线：`verify-hc-p1` 20/20，英雄集结与190沿官道攻城称王、新旧档往返全过；
1440×900 仓库化 Headless 实际推进12月并完成称王重大终审、任王国相、封关内侯、进贡
`+18`，旧君主入口0、console error=0。总验收同时修复敌方首都失守但势力尚存时君主错误
流落在野、导致存档非法的边界。shared 198/198、client 20/20、37 个非浏览器 verify、
typecheck/lint/data/build/diff-check 全绿；仅既有大 chunk warning。

Session 213 基线：`verify-cmd-p10-headless` 在 1440×900 下确认旧人事 DOM=0，名册详情、
搜索取消/确认、任官、赏罚唯一入口与朝廷→人事·任官·朝职往返全过，console error=0；
旧兼容导航事件已删除。shared 198/198、client 20/20、37 个非浏览器 verify、typecheck、
lint、validate-data、build、diff-check 全绿；仅既有大 chunk warning。

Session 214 仅做全量文档进度同步，无运行时代码、数据、Schema、API 或测试逻辑变化；
沿用 Session 213 全量回归基线。

Session 215 无运行时行为变化；新增 `verify-cmd-p11-headless` 与外交基线审计，明确进贡/
献美/结盟属于 S08，旧卡片“点化女间谍”属于 S07，后续只能跨域导航。

Session 216 增量基线：client 21/21；`verify-cmd-p12-headless` 在 1440×900 下遍历3目标、
确认新写按钮0，并从旧入口进贡后验证新摘要友好即时+15，console error=0；typecheck/lint/
diff-check 全绿。

Session 217 增量：`verify-cmd-p13-headless` 实测新进贡/献美取消与确认、正式寻访建库存、
战争门禁，结盟/点化新写入口0，console error=0；敌方库存受迷雾裁剪不在浏览器越权断言。

Session 218 增量：`verify-cmd-p14-headless` 用新进贡4次达到友好30，结盟取消不变、确认
扣金500并消费权威判定，本次成功转同盟；战争门禁、未实装条约按钮0、console error=0。

Session 219 增量：`verify-cmd-p15-headless` 正式寻访→新外交献美→谍报点化取消/确认全过；
旧外交 DOM=0，新外交献美与情报点化入口各1，确认后额度−1并生成女间谍，console error=0。

Session 220 无业务行为变化；`verify-cmd-p16-headless` 在 1440×900 下确认命令坞军事写按钮0，
旧战役编成取消权威状态不变，确认后长安扣兵5000、生成“夏侯惇军”并写 `campaign_start`，
console error=0。军事三入口与简化出征/Campaign Army 双链边界已审计。

Session 221 增量：client 22/22；`verify-cmd-p17-headless` 在 1440×900 遍历军事四分面，
17个己方城摘要、新写按钮0；旧战役创建“夏侯惇军”后编成/军令/战报即时同步，旧入口1、
console error=0。无 API、规则、数值或存档变化。

Session 222 增量：client 23/23；`verify-cmd-p18-headless` 在 1440×900 确认右栏简化出征0、
左栏旧编成0、新 Campaign 编成入口1；取消保留草稿且权威状态不变，确认生成“夏侯惇军”并
扣兵5000/粮1500、写 `campaign_start`，console error=0。Campaign 71/71、shared 198/198、
client 23/23、typecheck/lint/data/build/diff-check 全绿；`/march` 仅留 S21 场景兼容。

Session 223 增量：client 24/24；`verify-cmd-p19-headless` 在 1440×900 实际创建带参谋军团，
左栏旧军令按钮0；激励取消状态不变，确认士气+15/体力−15，营寨确认扣金100并生成设施，
console error=0。强攻/劝降/撤退/营建/参谋行动现以“军事·军令”为唯一玩家入口。
shared 198/198、client 24/24、Campaign 71/71、typecheck/lint/data/build/diff-check 全绿。

Session 224 增量：client 25/25；`verify-cmd-p20-headless` 在 1440×900 确认右栏征兵/训练
按钮0，征兵取消状态不变，确认得兵437且男丁同步−437、金−80/粮−120，训练士气+9/粮−60，
console error=0。军事·军备成为两条现有正式军备命令的唯一玩家入口。shared 198/198、
client 25/25、civil RNG 12/12、typecheck/lint/data/build/diff-check 全绿。

Session 225 无业务行为变化；新增 `verify-cmd-p21-headless`，在 1440×900 展开左右旧面板
确认旧军事写 DOM=0、四分面各唯一，并实点征兵/编成/激励三条取消与确认链：取消状态不变，
确认得兵437、创建“曹仁军”、士气+15，战报汇总完整，console error=0。shared 198/198、
client 25/25、Campaign 71/71、civil RNG 12/12、typecheck/lint/data/build/diff-check 全绿。

Session 226 无业务行为变化；新增 `verify-cmd-p22-headless`，在 1440×900 确认命令坞
内政写按钮0，并实际点击右栏农业/商业/城防/施米/寻访五条即时提交链：农业+23、商业+26、
城防+17、民心+11，寻访耗金60并成功库存+1/额度−1，console error=0。审计确认前四项属于
S03，寻访引擎真源属于 S09；后续不得按 `/civil` 路由前缀机械归类。

Session 227 增量：client 新增内政只读模型测试；`verify-cmd-p23-headless` 在 1440×900
确认17座己方城、`总览｜产业｜城建｜赈济` 四分面各唯一、新写按钮0；右栏农业开发+23后
产业摘要即时同步，console error=0。无 API、引擎、规则、数值、RNG、Schema 或存档变化。

Session 228 增量：S03 农业/商业/城防开发/施米迁入内政三分面并统一终审，右栏四个旧
按钮归零、S09 寻访保留。`verify-cmd-p24-headless` 实测取消状态不变，确认农业+23、
商业+26、城防+17、民心+11，console error=0。

Session 229 增量：用户批准在内政总览加入明确标注的 `S09 · 宫廷人脉` 跨系统寻访卡片，
右栏寻访旧入口删除，五个旧内政/寻访写 DOM=0。`verify-cmd-p25-headless` 实测寻访取消
不变、确认扣金60且本次库存+1/额度−1，并完整复验 S03 四命令，console error=0。

Session 230 无业务行为变化；新增 `verify-cmd-p26-headless`，在 1440×900 确认左栏旧
计谋面板/发起入口各1、命令坞计略写入口0；对刘备军离间取消后状态不变，确认扣金200、
新增 `sowDiscord / prep` 并写 `plot_launch`，console error=0。

Session 231 增量：命令坞计略新增 `态势｜发起｜进行中` 三分面，只读派生资源、前置与
己方计谋记录，新写入口0。`verify-cmd-p27-headless` 实测旧入口对刘备军发起离间后，
新进行中即时显示 `sowDiscord / prep`，console error=0；shared 198/198、client 29/29、
typecheck/lint/data/build/diff-check 全绿。

Session 232 增量：计略“发起”迁入 S17 四计草稿、禁用原因、统一终审与确认前复验。
`verify-cmd-p28-headless` 实测四计选项与门禁、离间取消保留草稿、确认扣金200并生成
`sowDiscord / prep`、进行中即时同步；迁移期新旧写入口各1，console error=0。
plot/spy 34/34、shared 198/198、client 31/31、typecheck/lint/data/build/diff-check 全绿。

Session 233 仅做全量文档同步：修正 `01` 当前总览、`02` S20 组件实装表、`06` 计略端点
现行入口注释、README 测试规模、HANDOFF 文档地图与进度版本；无运行时代码/规则变化，
沿用 Session 232 全量验证结果。

Session 234 增量：计略“前往情报·探秘”正式切到 `intel/recon` 导航意图，左栏旧
`PlotPanel` 源码与 DOM 归零，四计仅余命令坞一个提交入口。`verify-cmd-p29-headless`
在 1440×900 实测跨域导航、离间取消/确认、扣金200、`sowDiscord / prep` 与进行中同步，
console error=0；client 31/31、plot/spy 34/34、typecheck/lint/data/diff-check 全绿。

Session 235 无业务行为变化：审计 S07 普通招募、女间谍训练、献美点化、任务、反间与
俘虏处置，并固定后续四分面迁移顺序。`verify-cmd-p30-headless` 在 1440×900 实测旧
`SpyPanel` 1、四个核心写入口各1、命令坞新写入口0；招募取消不变，确认新增密探1名、
扣金120/粮60并写 `spy_recruit`，console error=0。

Session 236 增量：client 新增情报只读模型测试；`verify-cmd-p31-headless` 在 1440×900
确认四分面各1、新写入口0、旧四核心写入口各1；从旧入口确认招募1名密探后，新人员摘要
即时同步，console error=0。shared 198/198、client 32/32、typecheck、lint、data、
build、diff-check 全绿（仅既有大 chunk warning）。

Session 237 增量：普通招募、女间谍训练、献美点化迁入“情报·人员”，旧三入口归零。
`verify-cmd-p32-headless` 实测新三入口各1、招募取消不变，确认招募1名，训练与点化各
生成1名女间谍、额度−1，旧派遣仍1，console error=0。shared 198/198、client 33/33、
plot/spy 34/34、lint/data/build/diff-check 全绿（仅既有大 chunk warning）。

Session 238 增量：五类任务、驻防/撤防、俘虏处决/释放迁入“情报·任务/反间”，旧
`SpyPanel` 按钮与选择器归零，仅留只读名册。`verify-cmd-p33-headless` 实点驻防、撤防、
探秘取消/确认并取得下邳详报，俘虏空态正确，console error=0。shared 198/198、
client 34/34、plot/spy 34/34、lint/data/build/diff-check 全绿（仅既有大 chunk warning）。

Session 239 增量：旧 `SpyPanel` 源码、左栏谍报折叠项与 DOM 归零，命令坞情报成为
S07 全链唯一玩家入口。`verify-cmd-p34-headless` 实点新入口招募、计略→`intel/recon`
探秘、驻防与撤防，四类日志正确，各新入口唯一，console error=0。shared 198/198、
client 34/34、plot/spy 34/34、lint/data/build/diff-check 全绿（仅既有大 chunk warning）。

Session 240 无业务行为变化：审计 S18 女眷、姻亲/固定子女、婚配、手动/月度跟随及
S11 登用/释放关系同步，固定 P36～38 顺序。`verify-cmd-p35-headless` 在 1440×900
实测旧面板1、婚配/跟随入口各1、新写入口0；婚配取消状态不变，确认扣金300并建立
双向关系，console error=0。family RNG 32/32、shared 198/198、client 34/34、
typecheck/lint/data/build 全绿（仅既有大 chunk warning）。

Session 241 增量：命令坞家族新增 `总览｜姻亲｜婚配｜跟随` 四分面与纯派生读模型，
新写入口0，旧婚配/跟随仍各1。`verify-cmd-p36-headless` 实际从旧入口婚配后确认新
婚配候选1→0、荀彧姻亲支即时出现，console error=0。shared 198/198、client 35/35、
family RNG 32/32、typecheck/lint/data/build/diff-check 全绿（仅既有大 chunk warning）。

Session 242 增量：用户批准保留 `giftedToOfficerId` 随侍随迁，统一家眷语义并将 family
RNG 回归扩至36/36；婚配与手动跟随迁入命令坞统一终审，旧写入口0。Headless 实测两链
取消状态不变、婚配双向关系与跟随确认，console error=0；旧只读壳留 P38。

Session 243 增量：物理删除旧 `FamilyPanel` 与左栏家族折叠；命令坞家族成为唯一入口。
Headless 实测旧入口/DOM 0/0、唯一婚配、释放/重新加入时正妻随迁，console error=0；
child engine 4/4、family RNG 36/36、shared 198/198、client 36/36、全仓检查绿色。

Session 253 增量：BF-P5 录入/校勘工具第一步。新建 `shared/data/historical-geography/
seed-schema.ts`（`CommanderySeed` → `buildHistoricalGeographyBundle` 纯函数构建器 +
7 种类型 + 4 接口）；南郡/颍川均迁移至 seed 生成，导出 bundle 逐字段等价；新建
`server/src/scripts/verify-historical-geography.ts`（两郡 OK + preview 一致性）并在
server/root 两层注册 npm script；新建 `seed-schema.test.ts` 16/16。docs/08 新增 seed
层字段表，docs/09 BF-P5 标"录入工具第一步已完成"，docs/10 + HANDOFF 双写。shared 214/214、
typecheck/build/validate-data 全绿。Army—县映射、orchestrator 去硬编码、郡域迷雾留后续。

---

## 2. 怎么跑

```bash
pnpm --filter @leh/shared build && pnpm dev
# 服务 :3001  前端 :5173（代理 /api；端口占用时可能 5175）
# 数据校验: pnpm validate-data   # scenarios=2, events=24, units=9
# 场景事件: pnpm verify-scenario-events   # 32项断言
# 迷雾出征: pnpm verify-march-fog        # 7项权威边界断言
# 战斗守将: pnpm verify-battle-commanders # 全剧本/玩家视角关联与交战揭示边界
# AI 军事: pnpm verify-ai-military-rng # 双线/守备/撤退/公平/确定续玩 38/38
# 回合节拍: pnpm verify-turn-cadence # 连续12回合，月/季/年 28/28
# 谈判公式: pnpm verify-negotiation-r2 # 登用/结盟边界、单调、seed、UI同源 20/20
# BF-P0 南郡: pnpm --filter @leh/shared test -- schema.test.ts
# BF-P4 两郡浏览器验收（需 dev + 1440×900 CDP 9238）: pnpm verify-bf-p4-headless
# 单元测试: pnpm test
# CMD-P4 浏览器验收（需先启动 dev 与 CDP 9234）: pnpm verify-cmd-p4-headless
# CMD-P6 旧人事基线（需先启动 dev 与 1440×900 CDP 9234）: pnpm verify-cmd-p6-headless
# CMD-P7 人事只读名册（同上；含100/1000条合成夹具）: pnpm verify-cmd-p7-headless
# CMD-P8 招贤写流程（同上；取消/成功/失败+三类禁用）: pnpm verify-cmd-p8-headless
# CMD-P10 人事原子切换（需先启动 dev 与 1440×900 CDP 9238）: pnpm verify-cmd-p10-headless
# 称王门槛/阶段年龄: pnpm verify-hc-p1-1   # 15项断言
# 称王状态转移/王号: pnpm verify-hc-p1-2  # 36项断言
# 王国六职: pnpm verify-hc-p1-3             # 41项断言
```

首次进入先选择剧本与势力；当前有英雄集结和190《关东义兵》四槽切片。硬刷新 `Ctrl+Shift+R`。

结构：`shared/` · `server/` · `client/`（pnpm workspace）  
人类贡献指南：`CONTRIBUTING.md`

---

## 3. 已交付能力总表

| ID | 系统 | 成熟度 | 代码/要点 |
|:--:|------|:------:|-----------|
| S01 | 回合 | **M+** | `turn.ts`；1回合=1月，季度首月/年度显式节拍；12回合验证28/28；全势力金粮同步 |
| S02 | 地图 | M | Natural Earth；官道；LOD |
| S03 | 内政 | **M+** | 农/商/城已迁持续项目；一城一项、月费、人员暂停和进度损失；征兵/训练/施米仍即时；文化/工艺/交通/卫生、**军屯/民屯未实装** |
| S04 | 人口经济 | **M+** | 四桶 demographics + 民军粮耗 + 12月金粮预算 + 递增多城行政成本；俸禄仍未实装 |
| S05 | 军事 | M+ | 邻接出征→战→占城；战役 Army 主/副将/参谋；**爵位加成未接入** |
| S06 | 迷雾 | **M+** | UI + 服务端 `maskGameStateForPlayer` |
| S07 | 谍报 | M+ | 招募/女间谍训练/献美点化/任务结算接权威 PRNG；枕边风与离间流言确定续玩；四面楚歌未实装 |
| S08 | 外交 | M+ | 进贡/献美；R2 结盟共享百分点公式+权威 RNG+UI 同源；声望/戒备仍按0的 Demo |
| S09 | **宫廷人脉** | **M+** | `courtNetwork/courtNetworkOpportunities` 已实装；与成年女性人口脱钩；旧 v1 `beauty*` 无损迁移；历史女角边界不变 |
| S10 | 战斗 | **M+（三层架构已实装）** | 六角战斗与完整单挑均统一权威 PRNG，确定续玩 5/5 + 3/3；其余三层战斗、战役 Army 与设计边界保持不变 |
| S11 | 人事 | **M+** | 搜索/登用接权威 PRNG，确定续玩 32/32；R2 修复义理/野心 100 倍量纲错误并与 UI 同源；现有赏赐/任命确定性 |
| S12 | 官职功绩体力 | **S/M** | 精简任命；meritLevel 未实现；体力完整 |
| S13 | 宝物 | S | 薄 |
| S14 | 事件 | **M+** | 场景/史料层隔离、窗口/前置/互斥/失效、玩家/AI选择、EventDialog来源标签；190共24事件/5条叙事线 |
| S15 | AI | **M+** | 军事 AI 最多双线、动态留守；停战/两月粮不足/兵力低于守军55%主动撤退；无五维作弊且固定 seed 复现；县级主动 AI 与郡域补给/迷雾后置 |
| S16 | 剧本/存档 | **M/D** | v1 信封、完整 Schema/跨引用、迁移、受锁内存恢复及可序列化 `xorshift32-v1` 已实装；所有行动后结算 RNG 已收口；S15 行为复现、生产存取与 SQLite 未做 |
| S17 | 计谋 | **S/M+** | L1 美人计/离间/假情报/空城创建与结算接权威 PRNG（S07/S17 合并 30/30）；L2 11计/L3 8国策仍设计；AI 发起决策仍属 S15 |
| S18 | 家族 | **M+** | 正妻/随侍随迁与默认忠诚接权威 PRNG，确定续玩 36/36；婚配与固定子女登场零随机；父辈/族谱 ❌ |
| S19 | **单挑大会** | **D** | §8.17 独立锦标赛：赛制/押注/称号/叙事/数据结构设计完成，引擎待实现 |
| S20 | **前端体验** | **M+** | CMD-P0～P38 完成；现有运行时域命令坞迁移阶段收口，家族旧壳归零；屯田仍设计中。详见 `07-ui-design.md` §11.1.4/§12 |
| S21 | **战争四层串联** | **S/M** | 四层命名统一；自动/标准/六角微操已接唯一模式选择、幂等结算和 Army 回写 |
| S22 | **美术基调·金石水墨免版权** | **S/D** | Session 101 美术版权铁律入最高准则（零代码）+ Session 102 跨平台字体防御实装（首批代码）。基调「金石水墨·拓片简册·印信官职」三件套，公有领域唯一。**武将头像组合方案 A+C+B**（P5-10a/b/c）：A 拓片印章（底图层·20~30 张公有领域拓片+宣纸+朱砂姓名印）+ C 程序化拼图（五官层·5×10×10×10 哈希派生+重点手工指定）+ B 官职印信简册（文字层·氏族/官职篆印+汉制印绶紫青墨黄）。`officers.json` 新增 `avatarGene` 字段（与 Session 100 `appearance` 战斗造型字段并存职责分离）。**Session 102 已实装**：跨平台字体防御三件套——资产闭环 `@font-face` 工程内部别名 `HanDynastySerif`/`HanDynastySeal`（思源宋体 SC + 马善政体 Ma Shan Zheng，woff2 不入 git）+ Canvas 屏障 `fontBarrier.ts` + `App.tsx` `isEngineReady` + Konva `<Text>` 全部补 `fontFamily` + `.editorconfig`/`.gitattributes`/CI 编码门禁 + `CONTRIBUTING.md` 字体铁律条款。**留 P5-07a~e**：HiDPI / XDG 存档 / 伪 Terminal 文言战报 / 金石黑框组件库 / 字重扩展。详见 `00-dev-constitution.md` §11.3+§11.7、`07-ui-design.md` §11.6、`15-linux-ui-spec.md`、`AGENTS.md` 核心规则 9 |

### 关键路径

- 内政 · 出征占城 · 火计（气力≥30）· **战法施放（气力≥energyCost）** · **单挑引擎（冒烟通过；嵌套锁已修复）** · **暴击/反击/连击（攻击自动触发）** · 任命 · 家族子女 · EventDialog
- **战役层**：编成出征（主将+副将+参谋+Squad）→ 行军（BFS 路径+补给消耗）→ 围城/野战 → 劝降/强攻（自动战斗算法）→ 占城/残兵回流  
- Session 196 起根 `pnpm test` 同时运行 **shared 19文件197项** 与 **client 2文件7项**；
  客户端首批覆盖命令坞/抽屉渲染及草稿状态机。默认 CI 另跑既有战役/存档域检查，以及战斗、
  单挑、内政、计谋谍报、人事、R2谈判、家族、美女资源、总军师、AI军事等确定续玩检查与数据校验；
  专用脚本仍需按改动范围单独运行，不代表全仓端到端覆盖。
- **BF-P0 静态地理**：`shared/data/historical-geography/` 已有严格 Zod、南郡 190 年
  1 郡/16 个战场县节点/11 路线/10 地标与零 RNG 只读预览；史载 17 城中的襄阳保留为
  独立大地图节点，并由北部边界入口引用；未接任何运行时。字段级校勘见
  `docs/22-nanjun-historical-geography-collation.md`。
- **场景/事件**：`pnpm verify-scenario-events`（32项）覆盖两剧本隔离、四势力开局、玩家/AI决策、反事实选项阻断、角色/子女白名单、迁都、传奇开关、过期失效与队列顺序；Session 107 独立复验时，生产构建/类型/lint/数据/68项共享测试/相关引擎回归全部通过，Headless Chrome 再次实际点击“选剧本→选曹操→结束回合→处理事件”通过。
- **字体首次运行**：3 个 woff2 文件已实际就位 `client/public/fonts/`（思源宋体 SC Regular/Bold + 马善政体，共 ~7MB，不入 git）；启动直接可用

---

## 4. 关键概念（勿混）

### 4.1 美女 vs 历史女角

| | 美女 S09 | 历史女角 S18 |
|--|---------|--------------|
| 获得 | 寻访/抢夺/献美 | 跟随/事件/剧本 |
| 禁止 | — | 不可搜索登用、不可寻访 |
| 出战 | — | 仅祝融 |

### 4.2 计策 vs 战法 vs 计谋

| | 战场计策（火计） | 兵种战法 | 战略计谋 S17 |
|--|----------------|----------|--------------|
| 层 | 六角 | 六角 | 大地图 |
| 状态 | 火计 ✅ 引擎 | **✅ 引擎最小切片** | 四计 ✅ |

### 4.3 兵种适性 S/A/B/C/**NONE**（真源 `11-context-management.md`）

```
S 120% · A 100% · B 80% · C 60% · NONE = 不可带队
```

| 值 | 含义 |
|----|------|
| **C** | 能带，属性只发挥 60%（「逼急了也能下水」） |
| **NONE** | **禁止**指挥该兵种 |

**用户定稿原则（Session 71 末）**：
- **武将**（会统兵）→ 水军适性 **至少 C**，不要 NONE  
- **纯文官**（如荀彧）→ 可 **NONE**  
- 例：吕布 已从 NONE 改为 **C**（「赤兔马也会游泳」）  
- 其它武将水军适性可后续微调；**勿再给猛将 NONE**

---

## 5. Session 70~71 交付摘要

### 5.1 战法数据（Session 70）

| 文件 | 内容 |
|------|------|
| `shared/types/combatAbility.ts` | `leveled` / `proficiency` · `specialEffect` · `coopAllowed` |
| `UnitTemplate.abilities` | 必填 |
| Zod | leveled 必须恰好 5 级 |

**双体系**：
- **leveled**：基础兵种，显示 Lv1~5，适性门槛 C→B→A→S→S  
- **proficiency**：特殊兵种（0-B），**不显示等级**，熟练度 `basePower`→`maxPower`  

**连携**：仅 `coopAllowed` 布尔预留；关系网/亲密度引擎 **后置**（参考经典系列设计）。

### 5.2 三级水军（Session 71 · 参考经典三级水军设计）

| 级 | type | 名 | 攻/防/机 | 战法 |
|:--:|------|-----|:--------:|------|
| 轻 | `lightNavy` | **走舸** | 5/3/7 | 疾驶 · 激流 · 火箭 |
| 中 | `mediumNavy` | **蒙冲** | 7/5/5 | 冲撞 · 火船 · 激流 |
| 重 | `heavyNavy` | **楼船** | 10/8/3 | 火船 · 冲撞 · 齐射 |

- 废止单一 `navy`  
- `units.json` **9** 条；`validate-data` expected **9**  
- 陆地 terrain 对水军 -99（数据层）；**移动引擎未接**  

**0-A 水军适性现状**（可后续调）：

| 适性 | 武将 |
|:----:|------|
| S | 周瑜、陆逊、孙权 |
| A | 关羽 |
| B | 曹操、诸葛亮 |
| C | 吕布、刘备、张飞、赵云、黄忠、夏侯惇、典韦、司马懿、占位… |
| NONE | **仅荀彧**（纯文官） |

### 5.3 暴击/反击/连击 × 技能·特性·专属联动（Session 73）+ 单挑全面设计（Session 74）

**设计变更范围**：

- `05-combat-system.md`：§6.2~6.5 完全重写（暴击/反击/连击/三者联动）+ §4.2 阵型联动扩展 + §5.4/§8.3/§8.6 对齐
- `04-game-systems.md`：§26.3 五类42项特性全部补联动列 + §26.5 角色表同步 + §26.8 SkillEffect type 扩展

**核心设计原则**：

1. 暴击/反击/连击 ≠ 一刀切通用公式，而是 **特性(被动) + 通用技能(可培养) + 专属(独有)** 三者交汇的结果
2. 四层防循环保障：连击→不再触连击/反击；反击→不再触反击；战法不触发三者
3. 新增8种 SkillEffect type（`critRate`/`critDamage`/`counterRate`/`counterDamage`/`chainRate`/`chainDamage`/`chainPreserve`/`counterCritRate`）
4. 24个专属技能/42个特性/7个通用技能的联动数值在设计中完整落地

**范围确认**：暴击/反击/连击设计仅作用于**战场部队系统**（`05-combat-system.md` §6.2~6.5）。单挑拥有独立系统（`05-combat-system.md` §8 全量设计），与战场互不干扰。

**Session 74（单挑全面设计）补充**（后经 Session 75 经典化重写为 7指令+三向克制+全自动结算）：
- 05 §8 全量重写（§8.1~8.16）：状态机(6状态) + 触发/发起 + 7指令+三向克制 + 全量伤害公式(含隐藏属性) + 受伤系统 + 武器分化(14宝物映射) + 技能·特性·专属集成(5通用技能/10特性/9专属/3套装) + 独立暴击/反击/连击 + UI面板 + AI决策 + 特殊情况
- 同步文档：03 §19 类型扩展 + 04 §26.1/§32.4 + 06 单挑API(5端点) + 07 §6.3 单挑面板 + 08 武器映射交叉引用

**武将差异化例（战场部队）**：
| 武将 | 风格 | 核心机制 |
|:----:|------|----------|
| 张飞 | 反击爆发 | 刚烈必反必暴 + 咆哮连击 |
| 典韦 | 双反击护卫 | 恶来×2次反击 + 铁壁 |
| 马超 | 冲锋连击 | 骑神+猛进+西凉铁骑→高暴高连 |
| 关羽 | 单发高暴 | 武圣×2.5暴伤 + 击败后必连 |
| 赵云 | 单骑全能 | 龙胆双向反击 + 连击累加 |

### 5.4 近期会话索引

| 会话 | 交付 |
|------|------|
| 173 | **BF-P1 静态郡域场景+六角引擎最小闭环**（world→战场→六角接战→回写全链路 Headless 通过；shared/scenes 场景栈 + BattlefieldInstance 类型/Zod + generateNanjunBattlefield + BattlefieldSceneView + engageJiangling 复用 createBattle。存档契约可序列化结构+往返单测已落地，不接 GameState schema 留 P2。回归 62/29/38/172 无破坏。补提交 negotiation.ts 解 R2 遗漏依赖） |
| 174 | **BF-P2 Q10：activeBattlefieldInstance 无损追加至 GameState 存档契约**（按已批准方案 A，GameState 加 optional 字段；battle schema superRefine 互斥护栏 activeBattlefield 与 activeBattlefieldInstance 不可同时非 null；full schema ROOT_KEYS + 跨域引用校验；服务端 enterNanjunBattlefield/exitNanjunBattlefield/getBattlefieldInstance orchestrator + 3 个 API 路由；client gameStore 改造 enter 调 API、退出战场调 exit 清字段；新 verify-save-battlefield-instance.ts 27/27 全过 5 类断言含跨存档版本兼容；零回归；Headless Chrome 闭环重测 enter→16 县渲染+服务端字段写入→exit→字段清 null 全验证。Q9/Q11/Q12 仍待实施） |
| 175 | **BF-P2 Q11+Q12：类型归并文档化 + AI 攻县依赖声明**（Q11：BattlefieldMap Tier I 19 调用点 vs BattlefieldInstance Tier II 6 调用点保持独立不合并不废弃，结论落地至 02-architecture/03-data-models/12-system-map/25-bf-p2-design；Q12：R6 范围补"县级攻打决策不属于 BF-P2/P3，归 R6"，09-roadmap BF-P3 同步范围边界；3 处代码注释补 RNG 边界为 BF-P3 预留说明；修正 03-data-models 两处过时口径"BattlefieldInstance 尚未实装"+ GameState 缺字段。git diff --check + typecheck/lint 全过。Q9 仍待实施） |
| 176 | **BF-P2 Q9：首批 3 县可攻打落地，BF-P2 实施阶段完成（初判）**（当阳/华容/枝江 + 江陵 seat = 4 县可攻打节点。BattlefieldNodeState 加 controlTurns；turn.ts tickBattlefieldInstance 月度 tick——驻军消耗掉控制 + 补给线切断简化版守方 morale -5；engageCounty orchestrator 复用 runAutoBattle 自动结算（不调 createBattle 六角，县级无 cityId 映射），手动更新 nodeStates + CampaignArmy；路由 + client API + gameStore action + BattlefieldSceneView 3 县可点击 + 占领绿色高亮 + "驻N"文本；verify-save-battlefield-instance 44/44 含 f 类县级攻打状态流转+补给线+驻军掉控制；全量回归零破坏；Headless Chrome 完整验证 enter→click 当阳→占领→UI 绿色+驻858。**BF-P2 Q10+Q11+Q12+Q9 四项全部落地，初判完成；但四项攻占效果实现程度不一（两项完整/两项简化占位），老实标注见 Session 177）** |
| 177 | **BF-P2 Q9 老实标注 + 正式签发 BF-P2 完成**（纯文档/注释澄清，零代码逻辑改动。Session 176 报告将四项攻占效果统一标"✓ 通过"，但实际两项是简化替代/占位。本轮老实分级：补给线切断=简化替代实现——设计原意糧耗×2 路径判定，实际是"占领任意首批县→守方全军 morale -5"全局士气流失，简化因 Army-数字cityId 与郡域县节点-字符串countyId 无位置映射，真正路径判定留 R6/BF-P5；视野扩张=未实现，当前为占位视觉反馈——郡域场景无迷雾遮蔽，占领后只是节点变绿+驻军数字，不存在"揭示"动作，郡域迷雾是新发现缺口（此前从未被任何阶段排期覆盖）；驻军消耗+战场推进=✅完整实现。文档改动 5 处：25-bf-p2-design §二状态块+§2.4+新增§2.6 老实标注；23 R6 补登记两项待办依赖；09-roadmap BF-P2/BF-P3/BF-P5 行+版本号；verify-save-battlefield-instance f6 注释扩展+check label 诚实化（断言布尔条件不变）；10-progress Session 177+HANDOFF。**正式 BF-P2 完成声明：四项攻占效果中两项（驻军消耗、战场推进）为完整实现，两项（补给线切断、视野扩张）为简化替代/占位，详见 25 号文档 §2.6，不能笼统说四项全部完整落地。** typecheck/lint 确认无破坏） |
| 178 | **武将详情界面修复（用户指派独立需求，不归属 R3/R8）**（先诊断后修复，4 commit。诊断：Headless Chrome 实测 5 名武将 + 代码/数据/网络层穷尽分析，确认 4 类问题——阵型只显数量"6 项"且 10 名骑兵武将引用不存在的 id 16、经验/体力重复、19 hidden 字段全未渲染+标题误导、非原型称号取 tags 末项。修复：①`fix(data)` 补录 formations.json id 16 **冲阵**——判定漏录非错误引用（08-data-dictionary id 区间 0~17、05 §4 L238 id 16=冲阵、FormationType.CHARGE=16、crit.ts 已含 CHARGE、10 名引用武将全骑兵系），按 05 §4 设计值补完整定义，战斗不受影响（硬编码 FORMATION_MODS 不读 formations.json），validate-data 6→7，文档数字真源双写；②`feat(shared)` 新建 shared/labels.ts 导出 FORMATION_LABEL(18 陆阵)+PERSONALITY_LABEL(6)+IDEAL_LABEL(5)；③`fix(officer-detail)` 阵型 chip 用 FORMATION_LABEL 渲染+移除状态区块经验/体力（保留 aside）+拆"技能与特性"→"技能"+"性格"（性格区块展示 personality+ideal 文字，数值类 hidden 按设计决策保持隐藏）；④`fix(officer-portrait)` getOfficerProfile fallback title 改 deriveFallbackTitle 从五维派生（万人敌/神算/猛将/谋主/宿将/谋士/战将/统帅/干吏/名士/时势英杰），4 原型 HERO_PRESETS 不动。Headless 验证：张飞→万人敌+方阵/锥形阵/锋矢阵/偃月阵+性·刚烈/志·侠义+状态仅在职；诸葛亮→卧龙经略保留+性·沉稳/志·仁政；吕布→虓虎无双保留+**阵型含冲阵(id 16 关键验证)**+性·刚烈/志·名利。全量回归 shared 172/172+validate-data(7)+typecheck/lint/build+verify-save-battlefield-instance 45/0 全绿。新发现既有 bug 未修：CampaignPanel/StandardModePanel 把 ARROWHEAD(6,锋矢阵)误标"冲阵"且漏 id 16，建议后续统一用 FORMATION_LABEL 根治。未做：头像图片本身（用户已换新版需另外核对）；hidden 数值类字段（设计决策保持隐藏）） |
| 172 | **S23 人物状态表情系统**（新增 S23 大系统 22→23，挂 S22 美术基调 C 层状态化扩展；本轮用户指派独立需求，不抢占 R3。**Commit 1+2 完成**：设计文档 `24-...` + `shared/expression.ts` 纯函数 + 28 单测（147/147）+ `ExpressionPortrait.tsx` 程序化 SVG 分层 + BattleView SideCard/OfficerDetail 接入。状态词表精简 7 词；优先级负伤>战斗瞬时态>忠诚>士气>默认；单一主表情+独立背景色调层；衰减用 activeBattles 判定；3 原型各 4 条属性规则；stamina 代理负伤。Plan 阶段确认 4 抉择：文档编号 24-*/渲染=程序化 SVG 分层/负伤=stamina 代理/UI=SideCard+Detail。Headless Chrome 7 状态实测全过（胜/败/低忠诚/负伤/互斥）。验证限制：zustand store 不可外部 setState + 敌方城点迷雾不可点击，瞬时态改用真实吕布 officer+Vite 动态 import 组件+createRoot 独立挂载验证，等价覆盖。本轮占位非成品美术。详见 `docs/24-character-expression-system-design.md`） |
| 121 | **工程器械与城防体系设计**（文档层）：05 §15 全量重写（6种器械Lv1~Lv3+城防体系+瓮城阶段+专属武将联动）；03 §20.3/20.3-B/20.4 类型扩展（SiegeEngine/CityFortification/TacticalDefense/SiegePhase）；07 §12.6 瓮城"未拍板"→已定案；12 S10 更新。 |
| 120 | **阵型系统全面重设计**（文档层）：05 §4 完整重写（27阵型18陆+9水/双轴成长Lv1~Lv5+熟练度·极/科技树前置/陆水交互/暴击反击连击联动/切换规则）；03 §9 Formation/Officer 类型扩展；08 §二 formations.json 字段 6→27；04 §十九 新增阵型养成子章节；01/12同步。 |
| 118 | **武将数据扩充**：新增ID 284~307共24人（群雄势力/特殊人物/后期人物），`validate-data.ts` 武将门禁199→223；shared build、数据校验223/223与server typecheck全过。史料未详出生年统一为0，未详卒年使用提供的lifespan；祝融按既定唯一可出战女将例外录入；08数字真源、09/10/12/14及HANDOFF同步。 |
| 117 | **文档漂移校正**：按当前JSON实测统一0-A验收基线30人/当前199名武将、190共24事件（核心5+新增19）与爵位7级口径；08数字真源、01/04/09/10/12/14及HANDOFF同步；零代码/数据/规则变更 |
| 116 | **oh-my-openagent 安装配置**：oh-my-openagent v4.19.0 安装于 OpenCode 1.18.3，配置 OpenAI GPT-5.x 模型（11个 agent），ast-grep 0.44.1 验证通过；文档同步 |
| 115 | **武将数值扩充 Phase 2-2**：二线32人录入（曹植/曹昂/曹纯/郝昭/郭淮/孙礼/毌丘俭/王昶/陈泰/邓飏/李胜/何晏/刘封/冯习/张南/傅彤/程畿/陈到/马岱/高翔/张嶷/黄权/徐盛/贺齐/全琮/吕范/周鲂/钟离牧/刘繇/孔融/陶谦/公孙度）；validate-data 167/167 全过 |
| 114 | **武将数值扩充 Phase 2-1**：中坚32人录入（曹彰/曹休/夏侯尚/文聘/庞德/满宠/刘晔/董昭/徐庶/关平/周仓/李严/吴懿/向宠/简雍/孙乾/马忠/潘璋/董袭/朱然/诸葛恪/步骘/司马师/司马昭/邓艾/钟会/羊祜/杜预/王濬/文鸯/诸葛诞/司马炎）；validate-data 135/135 全过；原有30人未改动 |
| 113 | **武将数值扩充 Phase 1-4**：群雄32人录入（袁绍集团9人/吕布集团2人/刘表4人/刘璋2人/马腾2人/张鲁2人/董卓余部4人/袁术2人/黄巾3人/华佗+士燮2人）；validate-data 103/103 全过；Phase 1 目标100人超额完成 |
| 112 | **武将数值扩充 Phase 1-3**：东吴核心15人录入（鲁肃/吕蒙/程普/黄盖/韩当/太史慈/凌统/丁奉/张昭/顾雍/诸葛瑾/朱桓/陆抗/蒋钦/陈武）；validate-data 71/71 全过；原有30人未改动 |
| 111 | **武将数值扩充 Phase 1-2**：蜀汉核心14人录入（庞统/法正/姜维/魏延/马超/马谡/王平/廖化/严颜/张翼/霍峻/蒋琬/费祎/邓芝）；validate-data 56/56 全过；原有30人未改动 |
| 110 | **武将数值扩充 Phase 1-1**：曹魏核心12人录入（张辽/徐晃/张郃/于禁/乐进/夏侯渊/曹洪/曹真/荀攸/贾诩/郭嘉/程昱）；validate-data 42/42 全过；原有30人未改动 |
| 109 | 190《关东义兵》条件式历史切片扩展：5→24事件+5叙事线+玩家抉择系统+gold/food/population效果+史源分层+场景隔离+反事实阻断+32项断言+Headless Chrome 验证通过 |
| 108 | **文档漂移校正**（零代码/数据/规则变更）：P0B-14 摘要对齐08真源“首批7历史剧本+英雄集结”；D-0B 当前编号统一为1~13；S20/S21 未来任务统一采用 S20-W1~W4、S21-W6~W9；HanDynastySeal 校正为马善政体；P5-07e、系统地图/UI版本引用同步。交叉检索与 `git diff --check` 通过 |
| 107 | **Session 106 新增功能独立复验**（零代码/数据改动）：build/typecheck/lint、68项共享测试、validate-data、场景事件32项、战役57项及子女/火计/单挑/暴击回归全部通过；Headless Chrome 再次实际点击历史剧本主路径通过。仅保留既有生产 chunk 警告与已知六角单挑入口锁缺陷 |
| 100 | **前端体验技术储备**（S20 前端体验 + S21 三级战斗串联 七大方案设计，零代码改动，方案文档化。新增 S20/S21 两大系统 19→21，登记 D-0B-1~12 技术债。零新依赖原则：React+Konva+Zustand+Tailwind+原生 WS+原生 Web Audio 覆盖 90%。DuelStage 混合范式 + HeroCharacter 特殊造型 + 吕布鬼神降临 + PCG 程序化美术 + 计谋三级联动视觉） |
| 101 | **美术版权铁律入最高准则**（S22 美术基调·金石水墨免版权，零代码改动，方案文档化。`AGENTS.md` 核心规则新增第 9 条 + `00-dev-constitution.md` 新增§十一。新增 S22 大系统 21→22。武将头像组合方案 A+C+B：A 拓片印章底图 + C 程序化拼图五官 + B 官职印信简册文字。`officers.json` 新增 `avatarGene` 字段（与 Session 100 `appearance` 并存职责分离）。字体白名单（系统+开源，禁方正/汉仪，D-0B-13）。P5-10 改述。实装拆 3 子 Session P5-10a/b/c，Phase 5 排定） |
| 102 | **跨平台字体防御实装 + bug 修复**（S22 首批代码 + 工程规范硬基建，零游戏逻辑改动。资产闭环：`client/public/fonts/` **3 个 woff2 文件已实际下载就位**（思源宋体 SC Regular/Bold + 马善政体 Ma Shan Zheng，均 SIL OFL 1.1，共 ~7MB，沐瑶软笔体无稳定授权源改用马善政体） + `styles/fonts.css` @font-face 工程内部别名 `HanDynastySerif`/`HanDynastySeal` + `font-display: block` + tailwind 注册 + .gitignore 排除 woff2。Canvas 屏障：`utils/fontBarrier.ts` `waitForGameFonts()` + 4s 超时兜底（防 woff2 缺失永久卡死）+ `App.tsx` `isEngineReady` 屏障 + 失败重试按钮。Konva `<Text>` 全部补 `fontFamily`：MapCanvas 4 处 + BattleView 1 处。工程规范：`.editorconfig` UTF-8 LF + `.gitattributes` `eol=lf`/`*.woff2 binary` + `.github/workflows/ci.yml` 编码门禁 + `CONTRIBUTING.md` 字体铁律条款。文档：00 §11.3 升级+§11.7 新增 + AGENTS 核心规则 9 扩展 + `15-linux-ui-spec.md` 新建 + 09 P5-07a~e + 12 v4.4 + README systems-22 + 文档冲突修正。**bug 修复**：fontBarrier 超时兜底 / index.css @import 规范化（改内联 @font-face）/ FontBarrier 失败重试按钮。验证 typecheck/lint/test 68/validate-data 全过。Linux UI 适配 + 开源筑巢留 P5-07a~e） |
| 103 | **CI typecheck 修复**（全新环境 `pnpm install` → `pnpm -r typecheck` 时 server 找不到 `@leh/shared` 类型。根因：shared 的 `exports.types` 指向 `dist/`，CI 无 dist；shared typecheck 用 `--noEmit` 不生成 dist。修复：shared 的 typecheck/lint 脚本去掉 `--noEmit`，使底层包 emit 出 `.d.ts` 供下游解析。模拟 CI 验证全过） |
| 106 | **190《关东义兵》条件式历史切片**：保留英雄集结并新增四槽历史场景；场景势力/角色/事件/子女白名单、史源分层、窗口/前置/互斥/失效、反事实选择、玩家/AI性格理想权重、ScenarioSelect/传奇开关实装；30将全部史实；32项+HTTP+浏览器实际点击验证通过。**简化**：壶关/宛是河内/鲁阳补给节点代理，无城/寄驻/从属军未实装 |
| 99 | **开源收尾**（免责声明/许可证拆分/截图/CREDITS/SECURITY） |
| 98 | **战役层引擎最小切片实装**（§12节点·§13 Army编成+行军+补给·§15设施·§16状态机·§17自动战斗算法·CampaignPanel UI·8 API端点·57断言全过·dev实操占城） |
| 97c | **学派与信仰设计**（04 §38 全量写：7学派/设施/任教/冲突/初始倾向 + 03/06/07/01同步） |
| 97b | **命名合规维护**（补规则缺口 + 修5处重名：units.json 激励→振奋/铁壁→坚垒/远射→劲射/蒙冲→铁撞/楼船→巨舰） |
| 97 | **战役/战术分层全面设计**（05 §十二~§十八 战役层 + §十四总军师 + §十五设施机关 + §十七自动战斗算法；04 §36 势力特点 + §37 总军师规则；03/06/07 同步；00 命名规范） |
| 95 | **旧品牌残留清零**（截图前缀→leh-* · gitignore · 会话日志字面清除 · 全库验证） |
| 94 | **品牌重命名**（旧代号→LateEasternHanDynasty，旧 npm scope→@leh/，63文件·含UI/import/pkg scope/文档全量替换） |
| 93 | **部队编成体系全面重设计**（参谋独立槽位·智≥85·幕僚不带兵·副参谋·爵位编成加成·7级爵位精简·上限大将军9/君主10） |
| 92 | **文档一致性修正**（02-architecture.md + README.md 文件数/列表与实际对齐） |
| 91 | **合规深清**（删 46 张旧底图/调试截图·仅留 18 张 NE/UI·git 历史清洗 Google/LateEasternHanDynasty/旧截图·force-push） |
| 90 | **开源后合规复扫**（LateEasternHanDynasty UI 残留清除·Google 截图出库·孤儿 src 删除·enums/文档中性化·CREDITS/.gitignore） |
| 89 | **暴击/反击/连击引擎最小切片实装**（§6.2~6.5·crit.ts+resolveAttack接入attackUnit/simpleAi·阵型修正·专属·防循环·verify-crit全过·dev实战触发） |
| 88 | **单挑引擎最小切片实装**（§8全自动结算·7指令三向克制·专属/无双保护·DuelPanel UI·API+store·verify-duel 冒烟全过） |
| 87 | **合规完成**（SPDX头98文件+许可证+免责声明+CREDITS+历史清洗+external reference零残留） |
| 86 | **git 历史重写**（filter-branch 清洗 Google截图+external reference blob+commit message） |
| 85 | **全库版权排查**（external reference 47处替换+CREDITS+截图清理+商标清除） |
| 83 | **部队组织大系统纯设计**（经验Lv1-7+组织度+士气深化+部曲12将+军屯田+家属质任+民屯田9维；部曲/屯田运行时未实装） |
| 82 | **主副将编成系统**（Squad+阵型联动+关系加成+祝融火神） |
| 81 | **新增 S19 单挑大会**（赛制/押注/称号/叙事/数据结构） |
| 80 | **单挑全自动结算（经典自动结算模式）**：去指令按钮+演出面板+速度模式切换 |
| 79 | **吕布无双规则补完**（必杀不可化解·化解一切必杀·核心三角在吕布身上只有两条边） |
| 78 | **新增天下无双型 — 仅吕布·无敌**（唯一风格+碾压数值+专属叙事） |
| 77 | **隐藏属性单挑深化 + 武将风格5分类**（猛将/技巧/铁壁/智将/豪杰+隐藏×体力联动） |
| 76 | **宿命对决详表 + 叙事系统深化**（三英战吕布/裸衣斗马超/赵云长坂坡/太史慈vs孙策/关羽斩颜良/张飞据水断桥） |
| 75 | **单挑 经典化重写**（核心三角克制 + 叙事文本） |
| 74 | **单挑系统全面设计文档**（05§8+03/04/06/07/08 同步） |
| 73 | 暴击/反击/连击 × 技能·特性·专属联动设计 |
| 72 | P0 修复（安全/一致性/死锁/请求锁）+ 战法引擎最小切片 |
| 71 | 三级水军数据；吕布水军 C |
| 70 | 战法 schema + 6 陆兵战法 |
| 69 | 火计 + energy |
| 68 | 子女引擎 |
| 66 | GitHub 私有库 |
| 65~63 | 体力 / 隐藏属性 / 舌战 |

**注意**：`generate-0a-data.ts` 已冻结为 fail-fast；旧实现会抹掉手工兵种、30史实武将与两剧本结构，未重写前禁止启用。

---

## 6. 未做 / 债

| 项 | 说明 |
|----|------|
| 六角单挑接受入口 | ✅ Session 126 已修复：`battleChallengeDuel()` 内联 `stepBattleDuel()`，消除嵌套锁 |
|| 战役层单挑演出 | 单挑事件快速判定，未复用 duel.ts 完整演出 |
| AI Army 深化 | ✅ 基础出征/行军/围城/自动结算已接入；副将/参谋择优、多线战略、难度修正与外交变化撤围仍未做 |
| 势力特点数据 | 12 势力完整 JSON 未入库 |
| 参谋/副参谋引擎（战术层编成） | 文档设计完成(Session 93)，代码未实现 |
| 爵位编成加成逻辑 | `NobilityRank` 字段/枚举已有，`campaign.ts` 的副将上限未读取爵位 |
| 水域移动（仅三级水军可进水） | 数据 terrain-99；引擎未接 |
| 造船 / 港口行军 | 0-B |
| 连携 | 仅 coopAllowed |
| 战法 UI 选层 | 当前自动选最高可用层 |
| 战法 AI 施放 | AI 不施放战法 |
| 余14战场计策 | 未做 |
| meritLevel 运行时 | stamina 临时用 merit |
| S18 父辈/族谱 | 子女已做 |
| 0-B 全量 | **暂缓** |
| 存档 SQLite | 未做 |
| **190全势力开局** | 当前只有董卓/袁绍/曹操/孙坚四槽技术切片；约30势力名单、营地/寄驻/从属军和全量事件池未入库 |
| **S20 前端体验** | M：CMD-P0～P25 已完成命令壳及朝廷、人事、外交、军事、内政原子迁移；总览含明确标注的 S09 跨系统寻访 |
| **S21 战争四层串联** | Session 100 技术储备方案完成；Session 168 统一为四层/三模式，实装仍拆 W6~W9 |
| **S22 美术基调·金石水墨免版权** | Session 101 最高准则固化 + 方案设计完成，实装拆 3 子 Session（P5-10a/b/c，Phase 5 排定） |
| **D-0B-1~13 技术债** | 0-B 扩容前必须先清（store 拆分/LOD 拖拽冻结/useMemo/viewport culling/矢量州界/screen 状态机/appearance+avatarGene 全量填写/吕布服务端无双/§35 财政俸禄/PCG 底图替换/activeStrategem 字段/S17 L2 水攻伏兵引擎/UI 字体白名单扫描） |

---

## 6.5 武将详情页 UI 迭代收口声明（强制边界）

武将详情页（OfficerDetail）UI 迭代阶段性完成（Session 178 + 179 共 11 个 commit，已推送 `33accc9`），达到与设计文档一致的展示标准。

**后续对此界面的改动应基于具体的新功能需求**（如列传扩展、俸禄系统实装后的展示接入），**而非继续审计既有展示是否"完整"**——已知的技术债（特性系统/俸禄系统/装备系统/兵种缺口/列传扩展/阵型缺口）均已登记，按各自技术债编号（D-0B-9 等）在对应系统实装时一并解决，**不再单独为 UI 展示发起审计**。

会话中如发现 OfficerDetail 既有字段未渲染或显示不全，应先核对是否属于 §6.6 已登记技术债范围；若是，按对应编号归档而非新发起修复任务，避免陷入"审计→发现新问题→再审计"循环。

---

## 6.6 已知技术债清单（汇总）

| 项 | 现状 | 归属阶段/编号 |
|---|---|---|
| 特性系统（trait） | 设计完整（04 §26 共 42 项×5 级），代码零实装（OfficerTrait/traitId 在 shared 层零存在） | 0-B（D-0B-7 范畴） |
| 俸禄系统 | 设计完整（04 §35 年俸表/欠俸忠诚后果/货币成色），零代码实装 | D-0B-9 独立 Session |
| 装备系统 | OfficerDetail 装备页签 5 槽占位，Officer.equipped 代码层无字段 | 0-B（D-0B-7） |
| 兵种缺口 | 设计 21 兵种（含弩兵等 14 项未建数据），当前 9 兵种 | 0-B（P0B-09） |
| 人物列传扩展 | 4 原型试点（曹操/诸葛亮/吕布/关羽），30 基线武将扩展 ~7.5-9.5h（merge 脚本+UI 已就绪，仅需写 Markdown + 运行 merge） | 后续会话渐进 |
| 阵型缺口 | 设计 27 阵型（18 陆+9 水），当前 7 条；formationProficiency 代码层零存在（只有 formationMastery id 清单） | 0-B（P0B-08） |
| 补给线糧耗×2 真实路径判定 | 当前简化为"占领任意首批县→守方全军 morale -5"全局士气流失；真实路径判定需 Army 在郡域内移动 + 路径图论算法 | R6/BF-P5（前置：Army-郡域位置映射） |
| 郡域场景迷雾机制 | 当前郡域场景无迷雾层（占领后仅视觉反馈，非"揭示"动作）；此前从未被任何阶段排期覆盖，是新发现缺口 | R6/BF-P5 |

详细内容已在各自历史 session 记录里，本清单仅作汇总与边界提醒，不展开细节。

---

## 6.7 未来构想登记（待审计）

> 本节登记用户已提出、但尚未启动现状审计与设计文档的玩法/系统构想。性质为"记录以防遗忘"，**不等于已排期任务**。每条构想在正式启动时，应比照 BF-P0 模式先做现状审计（查文档确认是否已有相关设计、是否与已有系统冲突），再出设计文档与开放问题清单，拍板后才进入实施。

| 构想 | 来源 | 核心内容 | 当前状态 | 处理顺序 |
|:----:|:----:|------|:------:|------|
| **城市设施系统** | Session 188 用户提出 | 城市可建商铺/米铺/铁匠铺/书馆/医官/马馆等设施；设施分级（可升级，有等级上限）；产出与城市特产/规模关联；具体设施种类待正式审计时补充 | 仅记录构想，尚未审计现状、尚未出设计文档、尚未拍板任何细节 | 排在「霸府/称王/称帝」主线（docs/26 号文档）HC-P0 落地后，再启动本构想的现状审计 |
| **头像辨识度增强——三层区分体系（方案 B 补充候选）** | 用户提出；详见 `docs/design/avatar-identifiability-tier-system-proposal.md` | 势力色 → 身份型头饰 → 个人符号；候选分层为 50 核心武将全参数定制、173 次要武将模板 + seed 微变 | 仅记录方法论，未审计现状、未拍板任何细节、未推翻方案 B；方案 B“功能性区分、不追求高保真”仍有效。启动前必须审计：色板冲突、现有 SVG 参数体系现状、战场渲染系统现状 | 排在 HC-P1（称王）和 CMD（人事域 UI 迁移）两条工程线均收尾之后，由用户决定是否启动 |

---

## 7. 文档地图

| 文件 | 角色 |
|------|------|
| `HANDOFF.md` | 本文件 |
| `docs/10-progress.md` | 任务表 + 会话日志 |
| `docs/12-system-map.md` | **23 系统**（v11.6：HC-P1 与 CMD-P0～36 完成；下一步家族写链迁移） |
| `docs/02-architecture.md` | **v2.0** 架构总图 + 20引擎 + 5战斗子模块 + 数据流 + shared工具链（Session 75 全面重写） |
| `docs/05-combat-system.md` | §5.4 战法+三级水军 · §5.5 **主副将与参谋编成**+爵位加成 · §七 计策 · §6 暴击反击连击(战场) · §8 单挑经典化设计(§8.1~8.16 核心三角+叙事+**宿命对决详表**) |
| `docs/00-dev-constitution.md` | 开发总则（**v1.6 §十一 美术与版权铁律**） |
| `docs/08-data-dictionary.md` | **规模真源**（0-A units=9；officers `appearance` + `avatarGene` 字段） |
| `docs/11-context-management.md` | 适性 S~NONE 系数 |
| `docs/04-game-systems.md` | 规则大全 |
| `docs/06-api-design.md` | 含 `/battle/fire` + `/battle/ability` |
| `docs/07-ui-design.md` | UI 设计（**v6.9：情报原子切换完成**） |
| `docs/15-linux-ui-spec.md` | **v1.0** Linux UI 与跨平台字体规范（Session 102 新建） |
| `docs/16-demo-build-playbook.md` | 0-A Demo 12回合流程；严格标注已验证、引擎受阻、替代展示与设计中能力 |
| `docs/24-character-expression-system-design.md` | S23 人物状态表情系统设计（Session 172；3 原型占位，程序化 SVG 分层；状态→图层映射纯函数 + 背景色调层） |
| `docs/design/ArtDirection.md` | **视觉唯一真源**（Session 184 新建）：色彩/字体/UI/图标/人物/地图/战斗/工程合规八章；07 §一冲突行（#8B6914 色板/思源黑体/等宽/像素图标）废止；头像 A′+C+B 方案与分级策展 |
| `AGENTS.md` | 0-A：30城/9兵种…；**核心规则 9 美术版权铁律 + 跨平台字体防御三件套** |

---

## 8. Next（给下一模型）

| 优先级 | 事项 |
|:------:|------|
| **1（当前 Next）** | **HC-P1-1～6 与 CMD-P0～38 均已完成**。CMD 现有运行时域迁移阶段收口；下一大系统须按 `12-system-map.md` 由用户拍板，屯田仍设计中不得伪造。 |
| **Session 203 CMD-P6 已完成** | 人事旧入口、权威/草稿/门槛/终审/action/API 清单与 1440×900 Headless 基线已仓库化；分面固定为“名册｜招贤｜任官｜赏罚”，调动仅设计中。下一步 CMD-P7 只迁名册读路径；旧手风琴仍是唯一生产入口。 |
| **Session 200 英雄集结审查已完成** | 17城链路稳定；friendly 不野战、Army ID 不复制、结盟禁用三项复验通过。待修：CampaignPanel 目标候选按全局前线而非当前出发城过滤；友军城 `garrison` 语义；多方计谋日志“失败；成功”合并歧义。当前仅4势力/玩家可见10将，不能声称完成0-B规模压力验证。报告与24张截图见 `docs/reviews/session-200-hero-gathering-demo-full-flow-audit.md`。 |
| **Session 196 CMD-P0 已完成** | `07-ui-design.md` §12 已固化布局、动画、状态机、草稿与焦点契约；旧朝廷路径基线见 `docs/reviews/session-196-cmd-p0-court-baseline.md`，4张截图见 `docs/screenshots/session-196-cmd-p0-baseline/`。 |
| **Session 196 CMD-P1 已完成** | 通用 `CommandDock`/`CommandDrawer`/`CommandShell` + 瞬时草稿 reducer 已挂入 world；九类均为原面板/设计中说明，无业务提交入口。client 7/7 + shared 197/197 + 31个根 verify + HC-P0 101/101 全绿。下一步 CMD-P2。 |
| **2（可并行）** | 君主特例切片 C（引擎守卫：giftBeauty/marryFemale/rewardBeautyStock/appoint/battle/duel 加君主守卫拒绝改忠诚/功绩）。与 HC-P0 改动点不重叠（Q11 已批准可并行），但需单独验证回归。 |
| **3（保持待启动）** | R3：S10 单挑四倾向 + 吕布规则内最强但可败（`23-design-consistency-remediation.md`）。HC-P0 与 R3 的先后次序由用户定。 |
| **Session 188 HC-P0-5 已完成** | HC-P0-5 霸府外交权重加成（1 commit 待提交）：`hegemonyAllianceModifier`/`hegemonyFavorMultiplier` 分档纯函数（vassal=0/1.0, hegemon=+5/×1.1, king=+8/×1.2, emperor=+12/×1.3，称王/称帝分档预留）+ `calculateAllianceChance` 接入结盟成功率修正 + `AllianceChanceBreakdown.hegemonyModifier` 字段 + `tributeGold`/`giftBeautyStock` 进贡/献美友好增量放大 + verify-negotiation-r2 40/40（既有 20 项不变）+ verify-hc-p0 86/86（25 项新增）。加成方向：仅发起方单边修正。 |
| **Session 189 HC-P0-6 已完成** | 皇权100/季度+10/消耗40/冷却8季；对匡扶汉室目标声望-30；引擎/API/君主 UI/存档；verify-hc-p0 101/101 + 全量回归 + Headless 实点。HC-P0 阶段性完成。 |
| **Session 191 已完成** | 旧手风琴高风险安全补丁：进贡/献美/点化/结盟、开霸府/伪诏、两套出征与战役强攻/劝降/撤退、计谋、密探高风险操作、俘虏处置、婚配统一接 `CommandConfirmDialog`；核心四项 Headless 取消+确认通过，离线全量回归绿色。 |
| **Session 193 已完成** | 战役军事阻塞修复：shared `isHostileOrAtWar` 统一 AI/战役接战口径（仅 hostile/war）；野战结算先移除攻守 Army 再各回写至多一次，完整 Schema 拒绝重复 ID；CampaignPanel/StandardModePanel/OfficerDetail 统一 `FORMATION_LABEL`（6=锋矢阵、16=冲阵）；Campaign 70/70、AI 29/29，190 孙坚与曹操同盟军洛阳共处 Headless 通过。 |
| **Session 188 HC-P0-4 已完成** | HC-P0-4 霸府专属官职（`d558eb5`）：`Officer.hegemonyPosition?` 独立轨道（Q2 方案B）+ `HegemonyPosition` 枚举 3 官职（大司马/录尚书事/都督中外诸军事）+ `HEGEMONY_LABELS/REQ` 门槛表（均势力唯一）+ `appoint.ts` 引擎扩展（含诸侯状态前置拒绝）+ `/personnel/appoint` 路由透传 + `AppointPanel.tsx` 霸府轨道按钮（仅霸府阶段势力显示）+ `OfficerDetail.tsx` 官职区块条件展示 + verify-hc-p0 61/61（17 项新增）+ Headless Chrome 端到端（董卓开霸府→任命吕布大司马→OfficerDetail 展示）。 |
| **Session 188 HC-P0-1~3 已完成** | HC-P0-3 开霸府操作（1 commit `67d0aba`）：`Faction.politicalTitle` + `politicalStageChangedYear` 字段、`establishHegemony` 引擎（前置校验 controlsEmperor+vassal→转移+actionLog）、`POST /hegemony/establish` 路由、LeftPanel 君主折叠项开府按钮+头衔展示、OfficerDetail 头衔追加、verify-hc-p0 41/41。HC-P0-1+2（`4820d11`）：`GameState.emperorLocation` + `Faction.politicalStage` 字段+Zod+24项测试。 |
| **Session 188 文档同步** | Q1~Q11 批准 + 8 文档同步（1 commit `0ce044e`）；README 吕布四页签截图替换。 |
| **Session 184 已完成** | 全项目美术总监审查（纯文档零代码）：TOP10 问题清单（4×P0/4×P1/2×P2）+ 新建 `docs/design/ArtDirection.md` 视觉唯一真源 + 头像 A′+C+B 重建与分级策展方案。**待拍板**：美术实装批次（高收益首批=色板 token 化+金石组件库+战斗层换色+头像管线接通）与 R3 的先后次序由用户定。 |
| **Session 185 已完成** | 美术第一梯队 Step 1 色板 token 化 + 跳色统一（4 commit）。Tailwind 注册 ink/paper/seal/gold + military/civil/personnel/intel 语义别名；MapCanvas 14 处裸 hex 收口至 canvasTokens.ts；左栏 9 + 右栏 4 section 跳色改语义色；07 §一废止说明。Headless 5 张截图存 `docs/screenshots/session-184-color-tokens/`。**遗留并存**（Step 4 收口）：25 文件 200+ 处 amber-/stone- 直写类名 + AccSection 旧 accent 键。**下一 Step**：Step 2 战斗层换色 / Step 3 工程残留清理 / Step 4 金石组件库，三者与 R3 的次序待用户定。 |
| **Session 186 已完成** | 体力基础值缩放（吕布168→100，STAMINA_SCALE_FACTOR=100/168）+ 行动次数系统 actionsPerMonth（月度重置1，与体力独立）+ 体力消耗不对称 deriveRole/staminaCost（本行×1.0跨界×1.5）+ staminaEffectFactor（<10→0.6/<30→0.8/≥30→1.0）。4 commit；17 项新单测；存档兼容 optional 字段处理。 |
| **Session 187 已完成** | 体力并入六维区块统一进度条展示（1 commit `e984ceb`）。STAT_ROWS 加体力第六项，aside 移除独立体力卡片，标题五维→六维，超100标 `100(+N)`。07 §7.3/§5.3 文档同步。Headless 验证吕布体力100 在六维区块。 |
| **Session 178 已完成** | 武将详情界面修复（阵型显名称/经验体力去重/性格区块/非原型称号派生 + formations.json 补录 id 16 冲阵）；4 commit 本地领先 origin/main 未推送。详见 10-progress Session 178。**未做**：头像图片本身需另外核对（用户已换新版）；CampaignPanel/StandardModePanel 的 ARROWHEAD↔冲阵 既有误标 bug 待后续用 FORMATION_LABEL 根治。 |
| **Session 170 已完成** | R2：登用/结盟共享百分点公式，结盟接权威 RNG，UI/日志同源；专项验证 20/20 |
| **Session 166 已完成** | 吕布、关羽、诸葛亮、曹操四张新头像接入人物简册与名册缩略图；非重点人物保留程序化回退；README 四张人物截图已用真实浏览器流程重拍 |
| **Session 167 已完成** | README 将四张完整人物简册从单行四列改为 2×2 大图，确保新头像与五维、技能、兵种适性、官职整合界面在 GitHub 可辨读；图片 URL 增加版本参数刷新缓存 |
| **Session 165 已完成** | 自 `89adabf` 起 18 个提交顺序核对；最终全量回归绿色；普通 push 成功，`main` / `origin/main` 同为 `958e0ed`。仅 `.omo/run-continuation/...json` 保持未提交 |
| **Session 164 已完成** | 襄阳按“独立战略节点 + 南郡北部边界入口”处理；江陵 `countyCount` 更新为 17；BF-P0 前置冲突清零 |
| **Session 162 已完成** | Q1～Q8 于 2026-07-23 全部按推荐方案批准；同步 21/08/03/05/06/07/02/09/12/CREDITS/10/HANDOFF，统一 105 为“105 行政治所 ↔ 105 郡国模板”，县总数待校勘 |
| **Session 161 已完成** | S15 军事 AI：外交排除、君主激进度、真实 CampaignArmy 出征/围城/自动战斗、行动日志战报；专用验证 29/29 |
| **Session 160 已修复** | 敌将 `undefined` 根因已修：BattleUnit 携带正式交战姓名快照，未放宽大地图迷雾；Headless Chrome 实测宛城守将显示“许褚” |
| 2 | 继续分类现有 `verify-*.ts`，只将确定性、无端口依赖的检查逐个接入 CI |
| 3 | S16 生产存取/API/UI/SQLite 仍是独立后续任务，不与本轮 RNG 收口完成状态混淆 |
| 后置 | **继续 S20-W4**（派系/雷达/飘字/行政总署）及 S20-W1~W3 · **S21 三级战斗串联实装**（S21-W6~W9）· **0-B 前置技术债 D-0B-1~13 清理** · 单挑事件接入 duel.ts 完整演出 · 兵种战法接入战役层 · 数字平衡调整 · 战术层（可选hex） · S17 计谋接入战役层 · 0-B · 存档 |

**规则**：改 `10-progress` 必同步 `HANDOFF`；规模数字先改 `08`；破坏性操作先确认；**勿 0-B**。

---

## 9. Session 168～171 一致性修复（实施前必读）

- 批准基线：`docs/23-design-consistency-remediation.md`，R1～R8 必须逐项实现、验证和双写文档。
- R1～R8 已完成；R8 是现有字段的解释性 UI 收敛与固定情景平衡验收，不等于完整成长引擎。
- 时间：1 回合=1 月，3 回合=1 季，12 回合=1 年。
- 战争：四层（行政大地图/郡域战场/局部交战/单挑演出），三种交战结算模式（自动/标准/六角微操）。
- **R1 已实装并验收**：每回合推进 1 月；季度首月为 1/4/7/10；跨年至 1 月同时触发年度节拍。
  `quarter_start/year_start` 只是统一调度信号，不代表 R5 的季度内政或年度预算已实现。
- **R2 已实装并验收**：登用义理/野心百分点修正；结盟共享公式、权威 RNG、日志/UI 同源，
  专项验证 20/20。声望、戒备和利益冲突字段仍未实装，当前按 0 的 Demo 处理。
- **R3 已实装并验收**：四倾向权威快照、UI/API/存档贯通；吕布三连衰减、75% 单回合
  上限、受必杀 +20% 化解与败而重伤撤退完成，并修复挑战方胜时 loserId 归属错误。
- **R5 已实装并验收**：农/商/城按9/6/12月持续推进，总成本300/400/500金；首付1/3、
  余款按月扣，人员或资源不足暂停，第三月起损失进度；预算覆盖12月金粮、项目、行政费，
  俸禄/战争损失未实装项明确列0。专项验证17/17。
- **R6 已实装并验收**：每势力至多双线，源城按邻敌动态留守；停战、两月粮不足或兵力
  低于守军55%时撤回。武将五维不变，固定 seed 双线计划复现，专项38/38。
- **R7 已实装并验收**：新状态只用 `courtNetwork/courtNetworkOpportunities`，删除成年女性
  换算与成功率加成；旧 v1 字段无损迁移，历史女角来源不变。浏览器实点地方结交通过。
- **R8 已实装并验收**：四入口为人物成长/军团战备/阵型精通/战役态势；固定
  3城/10将/2战真实推进24个月，每月均有至少两项可行选择并记录机会成本，专项54/54。
  属性/技能自动升级、功绩等级和阵型双轴成长仍后置。
- 当前 Next：一致性修复 R1～R8 已收口；按 `12-system-map.md` 选择一个已登记系统。

### Session 252 · BF-P4 总验收

- 阵前/城下挑战均复用既有 S10 duel 引擎、权威 RNG 与 `DuelPanel`；郡域实例保存完整
  上下文，重复结算有幂等保护。
- 结果写回功绩、败方状态、挑战方 Army 士气，挑战方胜时守军-15%；无 Army 的开发入口
  不伪造军团，只使用玩家势力在职武将。
- 专项20/20；shared 198/198、client 36/36、静态检查与构建全绿；1440×900 两种挑战、
  两郡往返和 console error=0。BF-P4 已完成，Next 为 BF-P5 工具与位置映射。

*Session 239 交接 | 2026-07-30 | CMD-P34 情报原子切换完成；下一步 P35 家族迁移前审计*

### Session 246 · R5 补充

- 农/商/城项目为9/6/12月、300/400/500金；一城一项，首付1/3、余款逐月扣。
- 人员或资源不足暂停；第3个暂停月起损失进度。预算覆盖12月金粮、民军粮耗、项目余款、
  递增行政费；俸禄和基线战争损失显式列0。
- 专项17/17及全仓回归绿色。Next 固定 R6 S15，不并行启动 R7。

### Session 247 · R6 补充

- AI 主动攻击 Army 由一支扩为最多两支；实际受不同前线城、可用主将、兵粮、3500最低
  出征兵和动态守备约束，同一源城同月不重复出军。
- 源城保留至少500兵，受威胁时保留相邻最大敌军25%；围城/接战军在停战、粮不足两月
  或兵力低于目标守军55%时主动撤回并写军情。
- 不修改武将五维、不增隐藏兵力或战斗倍率；军事决策继续走权威 RNG，专项38/38。
  Campaign 71/71、战役存档9/9、回合节拍28/28、shared 198/198、client 36/36及
  typecheck/lint/data/build/diff-check 全绿。县级主动 AI、Army—县位置映射、真实路径
  补给和郡域迷雾仍后置。Next 固定 R7 S09。

### Session 248 · R7 补充

- 新局、Schema、运行时、迷雾、API 响应与新存档只写 `courtNetwork` 和
  `courtNetworkOpportunities`；旧 v1 `beauty*` 由加载迁移器无损改名并删除旧键。
- 开局机会由商业/民心/首都地位派生，结交固定65%基础成功率，不读取或扣除成年女性；
  历史女角仍只走剧本、事件、亲属跟随和联姻。
- S09 25/25、存档23/23、计谋谍报34/34、外交40/40、AI谍报4/4、Campaign71/71；
  Headless 实点地方结交通过，旧字段0、人口不变、console error=0。Next 固定 R8。
