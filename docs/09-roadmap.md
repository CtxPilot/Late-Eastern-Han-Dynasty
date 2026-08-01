# 开发路线图 & 里程碑

## Phase 0 — 文档 & 项目骨架

> Phase 0 分两轮执行：**0-A 用小数据集验证架构可行性**，跑通后再进入 **0-B 扩容至全量规模**。
> 0-B 各任务依赖对应 0-A 任务已完成（架构验证通过）。规则详见 `00-dev-constitution.md` 数字真源规则。

### Phase 0-A — 架构骨架 + 小数据集验证

| ID | 任务 | 产出 |
|:--:|------|------|
| P0-01 | Monorepo 初始化 | pnpm-workspace.yaml, package.json ×3 |
| P0-02 | shared/types 全部类型 | types/index.ts 等15个文件 |
| P0-03 | shared/validators Zod校验 | validators/index.ts（先于任何 JSON 数据生成完成） |
| P0-04 | Server 骨架 | Express + WebSocket + tsconfig |
| P0-05 | Client 骨架 | Vite + React + Konva + Zustand 初始化 |
| P0A-06 | officers.json（小） | 0-A验收基线30名史实武将；当前实际223名，0-B 1000+目标仍暂缓 |
| P0A-07 | cities.json（小） | 30城(覆盖13州、含都城级样本) |
| P0A-08 | formations.json（小） | 7阵型（6 基础 + 1 补录冲阵 id 16） |
| P0A-09 | units.json（小） | 9兵种（6陆+走舸/蒙冲/楼船 Session71） |
| P0A-10 | items.json（小） | 20宝物 |
| P0A-11 | females.json（小） | 10女性 |
| P0A-12 | children.json（小） | 5子女事件 |
| P0A-13 | skills.json（小） | 30通用技能(暂不含专属技) |
| P0A-14 | scenarios.json（小） | 2个：英雄集结 what-if Demo + 190《关东义兵》四势力技术切片；ScenarioSelect 已可用 |
| P0A-15 | events.json（小） | 24个190事件；5条叙事线+玩家抉择，支持场景/史料层隔离 |

**0-A 验收标准**：Zod 校验全部通过；能渲染地图、能推进至少1回合、能完成1次内政操作、能打通1场最简战斗。

### Phase 0-B — 数据扩容至全量

| ID | 任务 | 产出 | 依赖 |
|:--:|------|------|:--:|
| P0B-06 | officers.json（全量） | 1000+武将 | P0A-06 |
| P0B-07 | cities.json（全量） | 105城(坐标+初始值) | P0A-07 |
| P0B-08 | formations.json（全量） | 27阵型（18陆+9水） | P0A-08 |
| P0B-09 | units.json（全量） | 21兵种 | P0A-09 |
| P0B-10 | items.json（全量） | 165宝物 | P0A-10 |
| P0B-11 | females.json（全量） | 90+女性 | P0A-11 |
| P0B-12 | children.json（全量） | 50+子女事件 | P0A-12 |
| P0B-13 | skills.json（全量） | 149技能定义(69通用×5级+80专属) | P0A-13 |
| P0B-14 | scenarios.json（全量） | 首批7历史剧本+英雄集结；约30势力190全量开局仍属0-B | P0A-14 |
| P0B-15 | events.json（全量） | 历史事件全量 | P0A-15 |

**0-B 执行规则**：逐类生成，每类生成后立即跑 Zod 校验，不通过不得进入下一类；
专属技能不可空占位；女性/子女数据须遵守 `00-dev-constitution.md` 第九条历史出处红线。

> 后续 Phase（P1~P5）中原先引用 `P0-06`~`P0-15` 的依赖项，均指向 **P0B-xx**（全量数据就绪）。

### 独立战场子路线 P0～P6（2026-07-23 已批准）

> 为避免与项目总路线 Phase 0～5 混淆，工程任务 ID 使用 `BF-Px`；设计文档仍简称 P0～P6。顺序与门禁以 `docs/21-battlefield-scene-design.md` 为准。**BF-P0 已于 Session 164 完成；BF-P1 已于 Session 173 完成最小闭环。当前先执行一致性修复，R1/R2/R3/R4 已完成，下一步进入 R5。**

| ID | 阶段 | 主要产出 | 验收门禁 |
|:--:|------|---------|---------|
| BF-P0 | ✅ 资料与 Schema 契约 | 已完成：190 年南郡基线、年代复核、Commandery/County/Route/Landmark Zod、来源与零 RNG 只读预览；襄阳映射及江陵 `countyCount` 冲突已解决 | 逐条可追溯；引用/有效期/坐标/连通性通过；静态预览零 RNG ✅ |
| BF-P1 | ✅ 静态郡域战场 + 既有六角 | 大地图进入南郡；县节点行军；局部六角接战；结果回写 | **已完成 Session 173：**实际走通出征→郡域→接战→撤军→大地图（场景栈+Encounter 生成+六角复用全链路 Headless 通过）；占/守江陵完整胜负回写复用 S15（62/62）；存档契约留 P2 |
| BF-P2 | ✅ 实例管理 + 标准模式 + 场景栈 + 县级攻打 | `BattlefieldInstance`/`Encounter`；三入口统一；多实例、撤退/僵持、中途恢复；首批县可攻打 | **已完成 Session 174~176（+ Session 177 老实标注）：**Q10 `activeBattlefieldInstance` 无损追加至 GameState（27/27 含跨版本兼容）；Q11 双层数据模型保持独立文档化；Q12 AI 攻县依赖声明归 R6；Q9 首批 3 县（当阳/华容/枝江）可攻打——`engageCounty(countyId)` 复用 `runAutoBattle` 自动结算，`tickBattlefieldInstance` 月度 tick 实现驻军消耗掉控制 + 补给线切断**简化替代版**（44/44 含 f 类县级攻打状态流转）；全量回归零破坏；Headless Chrome 完整验证通过。**⚠️ 四项攻占效果中：驻军消耗、战场推进为完整实现；补给线切断为简化替代（全局士气-5，非设计原意的糧耗×2 路径判定，前置依赖 Army-郡域位置映射未解决，留 R6/BF-P5）；视野扩张为占位视觉反馈（郡域场景无迷雾层，是新发现缺口，留 R6/BF-P5）。详见 `docs/25-bf-p2-design.md` §2.6。不能笼统说"四项攻占效果全部完整落地"。** |
| BF-P3 | ✅ 动态战况与权威 RNG | 天气、部署、伏击/侦察、遭遇顺序、战场 AI、生成审计 | **Session 250 完成：**南郡按月份生成天气，Army 稳定排序后部署到合法入口，并冻结侦察、伏击、遭遇顺序；全部消费权威 `xorshift32-v1` 并记录抽数审计。动态专项13/13、既有 AI 保存点整场复现4/4。**边界：**县级主动目标选择不归本期；天气/伏击当前不含战斗数值修正；Tier II 迷雾仍留 BF-P5。 |
| BF-P4 | ✅ 第二郡地形对照 | 颍川 17 县/29 陆路、通用生成器、双入口；阵前/城下挑战复用 S10 duel 引擎并幂等回写 | **Session 251~252 完成：**两郡数据/渲染差异、无郡名分支、旧档、两种单挑语境与真实浏览器链均通过 |
| BF-P5 | 核心战线批量扩展（进行中） | 录入/校勘工具；年代覆写；县控接补给与郡国归属 | 目标剧本可达交战郡均有模板；无静默抽象回退。**录入/校勘工具第一步已完成（Session 253）：**`seed-schema.ts` 提供 `CommanderySeed` → `buildHistoricalGeographyBundle` 纯函数构建器；南郡/颍川均已迁移至 seed 生成；`pnpm verify-historical-geography` 逐郡校验 + preview 一致性；seed-schema 16/16 单元测试。**补给线真实路径判定已落地（Session 后续，2026-07-31）：**`shared/army-county-mapping.ts` 建立 Army—郡域位置映射（`resolveArmyCountyNodeId`/`shortestCountyPath`/`isCountyPathBlockedBy`/`monthlyArmyFoodCost`，nodeStates[].armyIds 权威 + deployments 回退），`generateCommanderyBattlefield` 把部署写入 nodeStates[].armyIds（BF-P3 确定性序列不变），`tickBattlefieldInstance` 逐支守方 Army 真实路径判定（补给线 = seat → Army 当前县最短路径，经过攻方控制县 → 粮耗×2 + 士气-5），替换"占领任意首批县→守方全军 morale -5"全局简化；验证 `shared/army-county-mapping.test.ts` + `verify-save-battlefield-instance.ts` f6/f6b（49/49）。**0-A 边界：**守方 Army 入郡域场景由 R6（S15 多线 AI）排期。**orchestrator 去硬编码已落地（Session 255）：**新建 `shared/commandery-templates.ts` 郡国模板目录（bundle/templateId/entryNodeIds/instancePrefix/warPrefix/UI 标签），`enterNanjunBattlefield` 由"nanjun/yingchuan 双 if 分支"改为目录查找，路由校验、`verify-historical-geography` 逐郡校验与前端标签均改为目录驱动；新增第三郡只需在目录登记一条即可，无需再改服务端分支（南郡兼容包装 `generateNanjunBattlefield` 亦从目录取数）。**剩余待办（Session 177 补登记）：**(1) ~~补给线糧耗×2 真实路径判定~~ —— ✅ 已由上述 BF-P5 位置映射解决，原全局简化替代已下线；(2) ~~郡域场景迷雾机制——新发现缺口~~ —— ✅ **已随 BF-P5 落地（Session 256，2026-07-31）**：`shared/commandery-fog.ts` 纯函数（`computeRevealedNodeIds`/`maskBattlefieldInstanceForPlayer`）+ `maskGameStateForPlayer` 集成，`foggedNodeIds` 为 mask 投影专属字段（Zod optional 不入存档）；地理层恒可见、军情层按揭示集遮蔽；揭示集 = 入口县 ∪ 郡治 ∪ 攻方 Army 所在县 ∪ 攻方已占领县（每源 + 一跳邻接）；**占领县→成为揭示源→邻接县破雾**，即 BF-P2 Q9 视野扩张攻占效果（现为完整实现，占华容前 7 迷雾含州陵 → 占后 6、州陵/当阳/枝江揭示、华容驻 858 可见）。验证：`shared/commandery-fog.test.ts` 8/8、`verify-save-battlefield-instance.ts` f8 14 条（63/63 全过）、真实 API + Headless Chrome 双端闭环。详见 `docs/21-battlefield-scene-design.md` §5.2.1 与 `docs/25-bf-p2-design.md` §2.6.2。**年代覆写机制已落地（Session 257，2026-07-31）：**`shared/data/historical-geography/seed-schema.ts` 的 `CountySeed`/`LandmarkSeed`/`RouteSeed`/`CommanderySeed` 均支持 `validFromYear`/`validToYear`（缺省 = `scenarioYear`，单一年代条目）；自动派生 road 取两端县有效期交集。新增纯函数 `resolveBundleForYear(bundle, year)`（`year-overrides.ts`）按年份过滤出该年有效子集并重新跑 Zod 校验，请求年份无有效郡国定义或过滤后引用断裂时**抛错**（无静默回退）。南郡/颍川 190 切片仍为单一年代；多年代能力由 `year-overrides.test.ts` 演示夹具验证（208 年乙县裁撤/丙县析置）。验证：shared 244/244、`pnpm verify-historical-geography` 2 郡通过。详见 `docs/22-nanjun-historical-geography-collation.md` §7.4。**剩余待办（Session 177 补登记）：**(1) ~~补给线糧耗×2 真实路径判定~~ ✅；(2) ~~郡域场景迷雾机制~~ ✅；(3) **年代覆写机制** ✅（机制已实装，具体历史改置待第三郡史料填入）；(4) **第三郡录入**（需要你提供郡的史料）；(5) **县控接补给与郡国归属**机制细节（随第三郡落地）。**守方 Army 入郡域场景已落地（R6 范畴，Session 258，2026-08-01）：**`enterNanjunBattlefield` 守方势力改为郡治大地图城市（`worldCityId`）实际占领势力（无主/属玩家时回退既有行为），驻留郡治城市的守方现役 Army 自动纳入战场，部署到模板新增 `defenderEntryNodeIds`（守方纵深前沿县，南郡=州陵/夷道、颍川=舞阳/父城）；迷雾揭示源并入守方 Army 所在县（`computeRevealedNodeIds` 第 5 条），mask 投影保留其 `armyIds`（玩家可见驻军）但 `deployments` 快照仍不泄露；补给线真实路径判定在真实流程触发（f9：占州陵→占华容→tick→粮耗×2+士气-5）。验证：shared 247/247、`verify-save-battlefield-instance.ts` **74/74**（f9 新增 11 条）、verify-bf-p3-dynamic 13/13 确定性不变。**县级主动 AI 已落地（R6 后续 · S15 深化，Session 259，2026-08-01）：**新建 `shared/commandery-defender-ai.ts` 决策纯函数（`decideDefenderArmyAction`，规则①被占县优势收复/劣势撤退、②补给线断士气<60 撤退否则向 seat 回撤一格、③向最近攻方占领县移动一格、④原地驻守，决策消费权威 PRNG，无可行动零消费）；`tickBattlefieldInstance` 签名加 rng、补给线惩罚后集成守方行动（位置变更同步 `nodeStates[].armyIds` 与 `dynamicSituation.deployments` 回退表）；`engageCounty` 守方 Army 参战（合成守军 + 按比例回填 + 攻方胜溃退移驻 seat/撤出郡域）。验证：shared **256/256**（+9 defender-ai）、`verify-save-battlefield-instance.ts` **88/88**（f10 新增 14 条：f10a 主动移动、f10c 交战溃退、f10b 补给线断撤退）、verify-bf-p3-dynamic 13/13 确定性不变、verify-campaign 71/71、bf-p4 20/20、verify-historical-geography 2 郡、client 36/36、typecheck/lint/data/build/diff-check 全绿。**边界：**大地图 AI 向郡域增援（选项 C）已随 Session 260 落地（见 §2.6.4.1）。 |
| BF-P6 | 0-B 全量 | 与 105 行政治所一一对应的 105 郡国模板；版本治理与性能优化 | 全量校验、来源/版权、并发战争、存档与渲染性能通过 |

依赖顺序固定为 BF-P0 → P1 → P2 → P3 → P4 → P5 → P6；完成 BF-P4 两郡对照前不得启动批量扩展。县级记录总数不在本阶段预估，待校勘后先更新 `08-data-dictionary.md` 数字真源。

### 霸府/称王/称帝子路线 HC-P0~P2（2026-07-25 Session 188 已批准 Q1~Q11）

> 设计真源：`docs/26-hegemony-court-design.md`。Q1~Q11 已全部批准，进入 HC-P0 实施。本子路线属 S08/S11/S12 既有深化，不新增大系统编号。与 BF 子路线独立，不互为前置。

| ID | 范围 | 验收标准 |
|:--:|------|------|
| HC-P0 | ✅ 挟天子判定 + 霸府最小原型 | HC-P0-1~6 全部完成：控制汉帝→开府→霸府官职→外交加成→伪诏宣战；optional 存档字段兼容，verify-hc-p0 101/101，Headless 全流程通过 |
| HC-P1 | ✅ 称王 + 王国官职 | **HC-P1-1～6 全部完成**：相对门槛/阶段年龄→原子称王/王号→王国六职→完整七级爵位与王命封爵→外交分档+朝廷 UI→两剧本/存档/仓库化 Headless 总验收。见 `28-hc-p1-king-design.md` |
| HC-P2 | 称帝 + 帝国 + 天命 | 更高门槛→称帝（`politicalStage='emperor'`）→帝国官职全开→天命/年号/国号（Q8 可选）→禅让事件链（Q9 可选，称帝先只支持自主称帝路径）→最高外交权重+天命压制 |

依赖顺序固定为 HC-P0 → P1 → P2。Q3/Q4/Q6 具体数值留待实战调参，不阻塞 HC-P0 启动。君主特例切片 C（04 §3.8 引擎守卫）与 HC-P0 可并行（Q11）。

### 命令坞迁移子路线（Session 220 已进入军事域）

> 设计与验收真源：`docs/07-ui-design.md` §12、`docs/reviews/session-195-command-dock-minimum-safe-loop-plan.md`
> 与 `docs/reviews/session-202-cmd-p5-next-domain-review-and-plan.md`。该路线属于 S20 前端体验，
> 只迁移入口、草稿、终审与跨域导航，不重写服务端业务规则。

| ID | 范围 | 当前状态 |
|:--:|------|------|
| CMD-P0～P5 | 通用命令壳 + 朝廷域迁移 + 复盘 | ✅ 已完成：旧君主入口原子下线，朝廷为唯一入口 |
| CMD-P6 | 人事迁移前审计与 Headless 基线 | ✅ 已完成 |
| CMD-P7 | 人事名册与人物简册只读路径 | ✅ 已完成 |
| CMD-P8 | 招贤：人才搜索与在野登用 | ✅ 已完成 |
| CMD-P9 | 五轨任官、宫廷人脉笼络、正式跨抽屉导航 | ✅ 已完成 |
| CMD-P10 | 人事旧入口原子下线与总验收 | ✅ 已完成：旧 DOM=0，人事抽屉为唯一入口 |
| CMD-P11 | 外交迁移前审计与 Headless 基线 | ✅ 已完成：进贡/献美/结盟权威链路与点化跨域边界已固化 |
| CMD-P12 | 外交势力选择与关系摘要 | ✅ 已完成：3目标只读浏览、零新写入口、旧入口写后同源刷新 |
| CMD-P13 | 外交交涉：进贡/献美 | ✅ 已完成：统一终审、取消/确认、资源/战争门禁；结盟/点化新入口0 |
| CMD-P14 | 外交盟约：结盟 | ✅ 已完成：同源成功率/使者、四类门禁、权威 RNG 取消/确认 |
| CMD-P15 | 外交原子切换 + 点化情报归域 | ✅ 已完成：旧外交 DOM=0；外交与情报点化各自唯一入口 |
| CMD-P16 | 军事迁移前审计与 Headless 基线 | ✅ 已完成：三入口/两套出征边界固化；命令坞军事写按钮0 |
| CMD-P17 | 军事只读军情总览 | ✅ 已完成：四分面同源摘要；旧战役写后即时刷新；新写按钮0 |
| CMD-P18 | 两套出征归并决策 + 编成写链 | ✅ 已完成：Campaign Army 为唯一正式玩家出征；旧两处编成入口0；`/march` 仅留S21兼容 |
| CMD-P19 | Campaign Army 军令迁移 | ✅ 已完成：强攻/劝降/撤退/营建/参谋行动唯一入口 + 统一终审 |
| CMD-P20 | 征兵/训练军备写链迁移 | ✅ 已完成：显式选城、统一终审、右栏旧按钮0 |
| CMD-P21 | 军事原子切换总验收 | ✅ 已完成：四分面完整链、旧写 DOM=0、三条取消/确认链与唯一入口总验收 |
| CMD-P22 | 内政迁移前审计与 Headless 基线 | ✅ 已完成：S03 四命令与 S09 寻访边界、旧入口即时提交基线固化 |
| CMD-P23 | 内政只读城市总览 | ✅ 已完成：显式选城、四分面同源摘要，新写按钮0 |
| CMD-P24 | S03 产业/城建/赈济写链迁移 | ✅ 已完成：四命令唯一入口、统一终审与确认前复验 |
| CMD-P25 | S09 寻访归属处理 + 内政原子切换 | ✅ 已完成：总览内明确 S09 跨系统卡片；右栏五旧写 DOM=0，总验收通过 |
| CMD-P26 | 计略迁移前审计与 Headless 基线 | ✅ 已完成：S17 四计、S07 情报前置与总军师归属边界固化；命令坞计略写按钮0 |
| CMD-P27 | 计略三分面只读态势 | ✅ 已完成：同源资源/前置/己方计谋摘要；旧入口写后即时同步，新写按钮0 |
| CMD-P28 | S17 四计写链迁移 | ✅ 已完成：四计草稿、禁用原因、统一终审与确认前最新状态复验；旧入口迁移期保留 |
| CMD-P29 | 计略原子切换与跨情报导航总验收 | ✅ 已完成：旧计谋 DOM=0、探秘跨域导航、四计唯一入口总验收 |
| CMD-P30 | 情报迁移前审计与 Headless 基线 | ✅ 已完成：S07 六类写链与跨 S08/S09/S17 边界固化；旧入口招募基线通过 |
| CMD-P31 | 情报四分面只读态势 | ✅ 已完成：态势/人员/任务/反间同源摘要、recon 只读落点，新写入口0 |
| CMD-P32 | 情报人员建设写链迁移 | ✅ 已完成：普通招募、女间谍训练、献美点化唯一入口与统一终审 |
| CMD-P33 | 情报任务/反间/俘虏写链迁移 | ✅ 已完成：五类任务、驻防/撤防、处决/释放统一终审与确认前复验 |
| CMD-P34 | 情报原子切换总验收 | ✅ 已完成：旧 SpyPanel 源码/DOM=0、recon 落点、全链唯一入口 |
| CMD-P35 | 家族迁移前审计与 Headless 基线 | ✅ Session 240：固化 S18 读写链、S09/人事边界与旧 UI 婚配取消/确认基线；不迁写链 |
| CMD-P36 | 家族四分面只读摘要 | ✅ Session 241：同源派生四分面；旧婚配后新摘要即时同步，新写入口0 |
| CMD-P37 | 家族婚配/手动跟随迁移 | ✅ Session 242：保留随侍随迁；两写链统一终审，旧写入口归零 |
| CMD-P38 | 家族原子切换总验收 | ✅ Session 243：旧壳源码/DOM/左栏入口归零；S11 家眷同步、固定子女与唯一入口总验收 |

### 0-B 前置技术债（D-0B-1~13，Sessions 100~102 登记）

> 0-B 扩容前必须先清。详见 `docs/12-system-map.md` §六。

| ID | 债务 | 触发时机 |
|:--:|------|------|
| D-0B-1 | Zustand store 拆 slice（cities/officers/factions/intel 独立）+ 局部 patch + 细粒度 selector | 0-B 扩容前 |
| D-0B-2 | LOD 拖拽冻结（debounce / 拖拽中复用上一次 layout） | 0-B 扩容前 |
| D-0B-3 | TopBar/RightPanel/LeftPanel 内联遍历加 useMemo | 0-B 扩容前 |
| D-0B-4 | viewport culling（屏外城点不画） | 500+ 城时 |
| D-0B-5 | 矢量州界 path + LOD 简化（strategic 粗 / local 细） | 0-B 引入州界时 |
| D-0B-6 | screen 状态机栈式管理 + 切入切出动画时序 | 0-B 扩容前 |
| D-0B-7 | officers.json appearance 字段 0-B 全量武将填写 + uniqueSkill 落库后从 uniqueSkill 派生 auraColor | 0-B 扩容前 |
| D-0B-8 | 吕布服务端无双乱舞范围攻击 + 心理震慑 debuff + 鬼神数值效果（防御翻倍+吸血） | S10 战斗深化时 |
| D-0B-9 | §35 财政税收俸禄数据模型扩展（Faction 加 coinQuality/salaryArrears，City 加 taxRate，turn.ts 改产金公式，新建俸禄引擎） | 独立 Session |
| D-0B-10 | PCG 水墨底图若 0-B 要替换 geo-basemap.png，需重做 MapCanvas 底图层 + 算法参数调优 | 0-B 视觉升级时（可选） |
| D-0B-11 | BattleState.activeStrategem 字段 + 服务端火计引擎设置该字段 | S20/S21 实装时 |
| D-0B-12 | S17 L2 水攻/伏兵服务端引擎实装（plot.ts 扩展） | S17 L2 实装时 |
| D-0B-13 | ✅ Session 102 已实装：字体白名单升级为"工程资产闭环"——`@font-face` 工程内部别名 `HanDynastySerif`/`HanDynastySeal`（思源宋体 SC + 马善政体，均 SIL OFL 1.1）+ woff2 本地打包 + FontBarrier + .editorconfig/.gitattributes/CI 编码门禁。**剩余 P5-07a~e**：HiDPI / XDG 存档 / 伪 Terminal 战报 / 金石组件库 / 字重扩展 | P5-07 剩余 UI 适配 |

---

## Phase 1 — 地图 & 回合

| ID | 任务 | 依赖 |
|:--:|------|------|
| P1-01 | MapCanvas — 地形底图层(Konva) | P0-05 |
| P1-02 | CityMarker — 105城市标注(势力色+资源条) | P1-01, P0-07 |
| P1-03 | MapCanvas 交互(点击/悬停/缩放/平移) | P1-02 |
| P1-04 | TopBar — 年月/季节/资源显示 | P0-05 |
| P1-05 | 回合引擎(turn.ts) — 推进/季节/死亡 | P0-04 |
| P1-06 | GameLayout — 主三栏布局 | P1-01, P1-04 |
| P1-07 | 初始 GameState 生成(读取剧本) | P1-05, P0-14 |
| P1-08 | GameService.createGame / .getGameState API | P1-07 |
| P1-09 | AI 基础框架(空决策/占位) | P1-05 |

---

## Phase 2 — 内政 & 人事

| ID | 任务 | 依赖 |
|:--:|------|------|
| P2-01 | LeftPanel — 手风琴政务菜单 | P1-06 |
| P2-02 | RightPanel — CityDetail | P1-06 |
| P2-03 | 内政引擎(civil.ts) — 开发/施米 | P1-05 |
| P2-04 | 军事引擎 — 征兵/训练 | P2-03 |
| P2-05 | 人事引擎 — 搜索/登用/赏赐/任命 | P2-03 |
| P2-06 | OfficerDetail + 己方武将名册（Session 122 已实装；Session 124 加入四名代表人物程序化简册头像；完整 A+C+B 数据层留 P5-10） | P1-06 |
| P2-07 | 内政 API (develop/recruit/train/search/reward/appoint) | P2-03~P2-05 |
| P2-08 | 前端服务层 API 客户端 | P2-07 |

---

## Phase 3 — 战斗系统

| ID | 任务 | 依赖 |
|:--:|------|------|
| P3-01 | BattleCanvas — 六角网格渲染 | P0-05 |
| P3-02 | BattleState 生成(开战初始化) | P1-05 |
| P3-03 | 移动范围 BFS 算法 | P3-01, P3-02 |
| P3-04 | 攻击引擎 — 伤害公式 | P3-03 |
| P3-05 | 兵种克制 + 阵型加成 | P3-04, P0-08, P0-09 |
| P3-06 | 计策系统(15种) — 火/水/落石/伏兵/挑拨等 | P3-04 |
| P3-07 | 单挑系统(7指令+三向克制+武器分化+部位受伤+AI+UI) 设计完成 | P3-04 |
| P3-08 | 攻城战引擎 — 城墙/城门/器械 | P3-04 |
| P3-09 | BattleCommandBar — 底部操作栏 | P3-01 |
| P3-10 | BattleInfoBar — 战斗信息栏 | P3-01 |
| P3-11 | 战斗 API (move/attack/tactic/duel/retreat) | P3-04~P3-08 |
| P3-12 | BattleView 完整组件 | P3-09~P3-11 |
| P3-13 | 特殊兵种战斗效果(藤甲/象兵/虎豹骑 etc) | P3-05 |

---

## Phase 4 — 外交 & 事件 & 婚姻

| ID | 任务 | 依赖 |
|:--:|------|------|
| P4-01 | 外交引擎 — 同盟/联姻/进贡/劝降 | P1-05 |
| P4-02 | DiplomacyModal — 外交弹窗 | P1-06 |
| P4-03 | 婚姻引擎 — 求亲/纳妾/赐婚/休妻 | P4-01 |
| P4-04 | 女性库加载 + 六维影响力计算 | P4-03, P0-11 |
| P4-05 | 子女引擎 — appearYear 登场+母教（最小切片已做 Session 68） | P4-04, P0-12 |
| P4-06 | 事件触发器(event.ts) | P1-05, P0-15 |
| P4-07 | EventDialog — 事件对话弹窗 | P4-06 |
| P4-08 | 宝物转移引擎(装备/剥夺/缴获/传承) | P1-05, P0-10 |
| P4-09 | 外交/婚姻/事件 API | P4-01~P4-08 |
| P4-10 | 关押系统引擎 + UI(监狱4级/审讯/囚心理/劫狱/处决) | P2-05, P3-11 |
| P4-11 | 伤病系统引擎(5级伤情/6种受伤来源/5种疾病/后遗症) | P3-04 |
| P4-12 | 伤兵系统引擎(伤亡分流/恢复率/容量/战后统计) | P4-11, P3-11 |

---

## Phase 5 — AI & 打磨

| ID | 任务 | 依赖 |
|:--:|------|------|
| P5-01 | AI 决策引擎(内政/军事/人事/外交 智能) | P1-09 |
| P5-02 | AI 战争决策 + 兵力分配 | P5-01 |
| P5-03 | AI 外交决策(弱势求盟) | P5-01 |
| P5-04 | 套装系统计算引擎 | P4-08 |
| P5-05 | 存档/读档(SQLite) | P0-04 |
| P5-06 | 多剧本完善 | P0-14 |
| P5-07 | UI 美化(Tailwind主题+动画) | P1~P4 |
| P5-07a | HiDPI/Wayland 缩放适配（`utils/hidpi.ts` + MapCanvas/BattleView 接入 `stage.scale(dpr)`） | P5-07 |
| P5-07b | XDG 存档（服务端写 `$XDG_DATA_HOME/leh/saves/` + 前端一键导入导出 Blob） | P5-05 |
| P5-07c | 伪 Terminal 文言战报（`EventLog` 改造，`#1c1a17` 宣纸暗色 + 等宽 + 思源宋体混排 + `[ 丰/警/凶/喜 ]` 状态色） | P5-07 |
| P5-07d | 金石黑框组件库（`StonePanel`/`SealButton`/`ConfirmDialog`，朱砂+黑框+宣纸黄） | P5-07 |
| P5-07e | 工程字体资产闭环补完（基础 woff2 已就位；剩余字重扩展与资产完整性复核） | P5-07 |
| P5-08 | Canvas 动画(行军/着火/水流/落石) | P1-03, P3-01 |
| P5-09 | 音效系统 | P5-07 |
| P5-10 | 武将头像（**金石水墨·免版权组合方案 A+C+B**；Session 124 已有四名代表人物 C+B 简化切片，待补 A 拓片层、`avatarGene` 落库与 30 人精校；详见 `00-dev-constitution.md` §十一、`07-ui-design.md` §11.6；禁止约稿立绘） | P0-06 |
| P5-11 | 平衡性测试 | P5-01~P5-06 |
| P5-12 | 性能优化(Canvas缓存/数据懒加载) | P5-09 |
| P5-13 | 打包构建(生产模式) | P0-05 |
| P5-14 | 部队等级系统(7级/经验获取/补员稀释/训练加速) | P2-04, P3-11 |
| P5-15 | 武将特性 + 属性天花板引擎（隐藏加成：吕50/诸葛20/曹15/荀10/刘5；武第二档97；常量 `shared/ceiling.ts`） | P2-06, P0B-06 |

---

## 里程碑

| 里程碑 | 内容 | 标志 |
|:--:|------|------|
| M0 | 项目骨架+文档完成 | 所有文档齐、Monorepo 可运行 |
| M1 | 地图可浏览 | 105城渲染、点击/缩放/平移交互 |
| M2 | 内政可玩 | 开发/征兵/搜人才 → 城市状态变化 |
| M3 | 战斗可玩 | 双方在六角网格对战，有计策和单挑 |
| M4 | 外交可玩 | 同盟/联姻/劝降 + 事件触发 |
| M5 | AI 可玩 | 电脑势力自主决策 |
| M6 | 完整游戏 | 存档/读档/UI美化/音效 |

---

*文档版本: v4.8 | 2026-07-30 | Session 243 CMD-P38 家族原子切换总验收*

### 一致性修复 R5（Session 246）

- [x] S03 农/商/城即时开发迁为一城一项持续项目
- [x] 月度分期、人员/资源暂停与第三月起进度损失
- [x] S04 未来12月金粮预算和递增多城行政成本
- [x] 1/3/10城专项验收17/17
- Session 247：R6 S15 最低验收完成（双线、动态守备、主动撤退、公平五维、固定 seed
  38/38）；县级主动 AI、Army—县位置映射、真实路径补给与郡域迷雾仍留 BF-P5/后续深化。
- Session 248：R7 S09 完成；运行时改用 `courtNetwork/courtNetworkOpportunities`，
  删除成年女性换算和成功率加成，旧 v1 `beauty*` 存档无损迁移。
- Next：R8 跨系统成长入口收敛与24回合情景平衡。
