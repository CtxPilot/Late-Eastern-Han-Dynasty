# 开发路线图 & 里程碑

## 分布实施主线（Session 335 固化 · Session 336 续推）

用户批准顺序见 [`35-phased-implementation-roadmap.md`](35-phased-implementation-roadmap.md)：

1. **S10 战斗收口** → 2. 关系网/技能树/天命深化 + 单挑大会/四层串联 → 3. L2 计谋与屯田（**339–347：L2 十一计 + 民屯/军屯齐**） → 4. 存档 SQLite（**340**） → 5. **0-B 暂缓**。

- Session 335：S10「单挑战场暂停门禁」与「敌军主动单挑结算后续行」。
- Session 336：S10「撤销恢复 facing」与「同回合审计序号/ID 唯一」。
- S10 剩余：~~天气主动技能~~（Session 349）· ~~正式特殊兵种熟练度~~（Session 350）·
  ~~协同包围/玩家战术撤退 0-A 最小切片~~（Session 352）· ~~敌军走位朝向前置修补~~（Session 353）·
**敌军协同包围/受围突围走位最小切片**（Session 354~355）· **撤退态活跃单位语义收口**（Session 356）· **敌军主动撤退最小切片**（Session 357）· **相邻截击门禁**（Session 358）· **截击后相邻目标优先**（Session 360）· **BattleView 撤退态 UI 活跃边界**（Session 361）· **刚烈反击暴击一次性结算**（Session 366）· **追击伤害 0-A 切片**（Session 367）· **攻城守城与城门突围 0-A 切片**（Session 368）；多军团撤退后置。
- Session 351：完成 S18 家属质任处置 C 切片；进入同一场战役/屯田交叉规则收口，不启动 0-B。

### Session 378 · S10 战术视野（用户拍板方案）

- 用户拍板：基线 4 格 / 山+1 / 林−1 / 雾−2 / 雪−3 / 下限 1；AI 全知仅玩家侧投影。
- 实装：`shared/battle-sight.ts` 纯函数 + BattleView `filterVisibleTacticalUnits` 渲染/点击/红标记三处过滤；零存档字段、零 RNG、零 API 变化。
- **验证**：shared battle-sight 单测 **12/12**、client battleViewState **56 全量**含 2 新投影用例；回归 tactical-ai 86 / save-battle 62；typecheck/lint 三端、validate-data、compliance 全绿。Konva canvas 无法 DOM 断言，以纯函数/投影单测为验收口径（诚实标注无浏览器点击验收）。
- **Next**：S10 多军团协同缺设计规格待拍板；技艺研发待拍板；0-B 暂缓。

### Session 377 · S10 锥形阵骑兵突击收口

- `resolveChargeBonus` 接入锥形阵(2) `charge=50 cavalry_only`（formations.json 数据早已定义、引擎未消费的后置债）；玩家 attackUnit 与敌军 AI doAttack 同源生效，骑神连击联动自动覆盖。
- 数值真源：08 §二十九 新增一行；05 §18.1 边界行移出后置清单。
- **验证**：`verify-cavalry-charge` **29/29**（新增锥形轻骑 70% / 重骑 120% / 森林仅阵型 50% 三断言）；回归 tactical-ai 86 / save-battle 62 / tactical-retreat 18 / fm4 14 / shared 422 / client 54 全绿。
- **Next**：S10 地形可见范围与多军团缺设计规格待拍板；0-B 继续暂缓。

### Session 376 · 离线覆盖扩充 III（郡域实例写链收口）

- worker 镜像 enterNanjunBattlefield/exitNanjunBattlefield/engageCounty 与阵前单挑四链（含 settleBattlefieldDuel 功绩/俘杀/继承者规则）；至此 **114 个接口离线全覆盖，无在线回退面**。
- **验证**：新增 `verify-s376-offline-commandery` **27/27**（南郡沙盘进入→战况条→阵前单挑 step×2/skip 终局/close→攻打当阳占领「驻N」→退出回世界屏，XHR 钩子零回退）；回归 s374 44 / s375 32 / s372 11 / s373(重建) 14 全绿。
- 边界：0-B 继续暂缓。

### Session 375 · 离线覆盖扩充 II（读链与轻写链 14 接口收口）

- worker 镜像总军师 ×4 / 技能树 ×5 / getOfficerRelations / getFactionOverview / campaignNodes / getBattlefieldInstance / searchBeauty；虚拟模块补 `skill-trees.json`。
- **验证**：新增 `verify-s375-offline-reads-writes` **32/32**（势力总览渲染→总军师任命/冷却拒绝/解职→关系 14 行→技能加点与重置，XHR 钩子零 `/api/` 回退）；重建产物 s373 复测 14/14、s372 11/11；shared 422 + client 54、typecheck/compliance 全绿。
- 边界：郡域 battlefield-instance ×7 为最后缺口（切片 III）；0-B 继续暂缓。

### Session 374 · 离线覆盖扩充 I（Tier I 战场 + 白刃战 11 接口）

- Worker 镜像 Tier I 战场 ×4 与白刃战 ×7 指令 + `getKingRequirements`；离线接口缺口 33→21。
- 修补：worker 启动补五处阵型目录/TacticalConfig v2 注入（此前离线战斗数值被静默清零）；`store.meleeStart` 停留战场屏修复三选弹窗不可达（在线同有的既有缺陷）；标准面板补「刷新战术点」接线既有 `meleeRefresh`。
- **验证**：新增 `verify-s374-offline-melee` **44/44**（信封注入构造两军接战→进军往返→六角微操撤退回流→标准模式姿态/变阵/突击/TP 记账/刷新回补→自动结算→撤兵，XHR 钩子断言零 `/api/` 回退）；s372 复测 11/11、s373 生产构建复测 14/14；shared 422 + client 54、typecheck/validate-data/compliance 全绿。
- 边界：郡域 battlefield-instance、总军师、技能树、势力总览/relations 等约 21 接口未覆盖；`battlefieldInit` 无 UI 入口仅镜像审查；0-B 继续暂缓。

### Session 373 · PWA 完全离线冷启动（Phase 4）

- `leh-pwa-precache` 构建期生成 `sw.js`：预缓存全量产物（清单哈希命名缓存），导航网络优先回退缓存，`/api/*` 放行；`main.tsx` 仅生产注册。零新依赖。
- **验证**：`verify-s373-offline-coldstart` **14/14**——CDP 断网仿真下刷新冷启动：剧本屏/字体/世界屏/结束回合推进月份/IndexedDB 存读全部离线可用；s372 循环复测 11/11 无回归。
- **Next**：离线接口覆盖扩充或 S10 后置债由用户拍板；0-B 继续暂缓。

### Session 372 · 离线可玩版最小闭环（Worker + IndexedDB）

- Phase 0~3：权威 RNG 双端化（去 `Math.random` 默认参）→ `save-limits`/`save-idb` 存档双轨 →
  `state-pipeline.ts` 编排下沉（在线/离线同源结算）→ `game.worker.ts` 权威引擎 + `gateway` 策略网关。
- Pages 构建注入 `VITE_OFFLINE=1`：访客无需后端即可游玩；本地 dev 保持在线、`?offline=1` 切换调试。
- **验证**：新增 `verify-s372-offline-loop` **11/11**（真实 Chrome 端到端：boot→剧本→回合推进→IndexedDB 存读档）；
  回归全绿（shared 422 + client 54、save-battle 62、campaign 71 等）。
- 边界：melee/郡域/总军师等约 30 接口离线未覆盖（回退在线）；PWA 预缓存（完全离线冷启动）为 Phase 4 后置。

### Session 371 · S10 移动后冲锋（骑兵冲锋最小切片）

- 轻/重骑兵本回合已移动（`hasMovedThisTurn` 同源语义）的普攻触发冲锋：平原+20%、重骑+50%、冲阵(16)+80% 加法叠乘；pct=0 不触发。骑神冲锋连击率+20%、冲阵连击×1.2；战报「冲锋」标签；零额外 RNG。
- 玩家 `attackUnit` 与敌军 AI `doAttack` 普攻路径同源接入；战法/火计/追击不触发。
- 数值真源：`docs/08-data-dictionary.md` 新增 §二十九；`05` §5.6.3/边界行同步。
- **验证**：新增 `verify-cavalry-charge` **26/26**（纯函数叠加、骑神联动、敌军 AI 与玩家路径固定 RNG 伤害比、森林不触发、步兵不触发）；回归 `verify-tactical-ai` **86/86**、`verify-save-battle` **62/62**、`verify-battle-rng` **5/5**、`verify-tactical-retreat` **18/18**、`verify-fm4-hex-formation` **14/14**；shared **420/420**、client **54/54**；typecheck/build/validate-data/compliance 全绿。
- **Next**：S10 地形可见范围与多军团仍后置；0-B 继续暂缓。

### Session 370 · GitHub Pages 静态预览部署

- `vite base` 由 `GITHUB_PAGES_BASE` 注入（缺省 `/` 本地不变）；构建期插件重写产物 CSS 内 `/fonts/` 引用；MapCanvas 底图改 `BASE_URL` 拼接。
- 新增 `.github/workflows/deploy.yml`：Release `assets-fonts-v1` 固定下载 woff2（SHA-256 校验同 fonts README）→ 构建 → Pages 发布。
- Pages 版为**构建产物预览不可玩**（引擎在服务端），启动失败态补静态预览提示文案；离线可玩版后置。
- 验证：本地子路径静态伺服冒烟 5/5（字体加载/启动屏/console 干净）；typecheck、shared 420 + client 54、validate-data、compliance 全绿。
- **Next**：S10 多军团等后置债或离线可玩版切片由用户拍板；0-B 继续暂缓。

### Session 369 · 浏览器真实点击验收补课（S03/S18）

- 浏览器环境恢复可用（Chrome CDP 9242）；一次性清偿 Session 351~365 期间被阻塞的真实 DOM 点击验收债。
- 新增三个验收脚本并登记 package.json：`verify-s369-culture-ui` **36/36**（发展文化全链+完成+60）、
  `verify-s369-family-genealogy-ui` **14/14**（族谱曹丕记录/空态）、`verify-s369-family-treatment-ui` **17/17**
  （待决弹窗三选一/TopBar 门禁/结束后合恢复）。console errors 均为 0。
- 纯验收轮：无生产代码、规则、字段、API、RNG 或静态数据改动；回归 shared **420** + client **54** 全绿。
- **Next**：继续 S10 多军团等后置债；BattleView 完整对局级点击验收后置；0-B 继续暂缓。

### Session 368 · S10 攻城守城与城门突围 0-A 切片

- `isSiege` 时守方 `formationDef` +3（约 +30% 有效防御，`hexFormationMods` 外的攻城修正，enemy AI 的 `calcDamage` 含 `isSiege` 分支）。
- 攻方战术撤退：`isSiege` 且攻方单位位于地图边缘（城门）时，`RETREAT_SURROUNDED` 对该单位放宽，仍可突围但照常承受相邻守军 0.6 系数追击；非攻城或非边缘受围仍阻断。
- 不新增字段/API/存档/RNG；数值真源见 `08` §二十八。
- **验证**：`verify-tactical-ai` **86/86**（含守城追击减伤）、`verify-tactical-retreat` **18/18**（含边缘突围与守城对比）、`verify-save-battle` **62/62**、`verify-battle-rng` **5/5**、`verify-fm4-hex-formation` **14/14**；shared **420/420**、client **54/54**；typecheck/build/validate-data/verify-compliance、`git diff --check` 全绿。
- **Next**：继续 S10 多军团等后置债；0-B 继续暂缓。

### Session 367 · S10 追击伤害 0-A 切片

- 敌军被截击时由最强相邻截击者追加一次追击：`calcDamage` 中位值×0.6，必中、至少 1，不触发暴击/反击/连击，士气 −2；若追击致溃则标记 `isDestroyed` 并结束该单位本回合行动链。
- 玩家 `retreatBattle` 成功时，对每支与活跃守军相邻的攻方退兵按同系数追加一次追击，多名截击者时仅最强一名出手。
- 不新增字段/API/存档/RNG 消费；数值真源见 `08` §二十七。
- **验证**：`verify-tactical-ai` **84/84**（含截击追击与残血溃灭）、`verify-tactical-retreat` **15/15**（含相邻/非相邻追击对比）、`verify-save-battle` **62/62**、`verify-battle-rng` **5/5**、`verify-fm4-hex-formation` **14/14**；shared **420/420**、client **54/54**；workspace typecheck/build/validate-data/verify-compliance、`git diff --check` 全绿。
- **Next**：继续 S10 攻城突围/多军团等后置债；0-B 继续暂缓。

### Session 366 · S10 刚烈反击暴击一次性结算

- `resolveAttack` 合并独立反击暴击与刚烈必暴状态后统一套用一次暴击倍率；独立 roll 仍消费，保持既有 RNG 顺序。
- 新增确定性回归：刚烈反击在独立暴击 roll 命中/落空两条路径的最终伤害一致；不新增字段、API、存档或数据规模。
- **验证**：`verify-crit` 全部断言通过；`verify-tactical-ai` **78/78**；`verify-save-battle` **62/62**；`verify-battle-rng` **5/5**；`verify-fm4-hex-formation` **14/14**；shared **420/420**、client **54/54**；typecheck/build/validate-data/verify-compliance、`git diff --check` 全绿。
- **Next**：继续 S10 后置追击/截击等设计债；0-B 继续暂缓。

### Session 364 · S03 文化门槛只读预览 UI 收口

- 产业分面新增原生文化进度条 `command-civil-culture-progress`，显示共享上限内的当前文化/999；门槛等级、下一门槛和差值仍由 `cultureThresholdProgress` 同源派生。
- 不新增 API、存档字段、RNG、静态数据规模或正式技艺/人才效果消费；浏览器运行时无连接，未宣称 DOM 点击验收。
- **Next**：浏览器连接恢复后补产业分面真实点击，再由用户决定正式技艺研发/人才吸引切片或回到 S10/S18；0-B 继续暂缓。

### Session 363 · S03 文化门槛只读预览

- 共享 `cultureThresholdProgress` 固化既有技艺门槛 `[100,250,500,700,900]` 的只读投影；文化值先夹紧到0～999。
- 内政·产业显示文化进度条、已达 `LvN/5`、下一门槛和差值；不新增 API、存档字段、RNG 或任何技艺/人才效果消费。
- 验证：共享专项 **3/3**、文化持续项目 **10/10**、R5 预算 **17/17**、全仓 shared **420/420** + client **54/54**；
  workspace typecheck/build、validate-data、compliance、`git diff --check` 全绿。浏览器运行时无连接，未宣称 DOM 点击验收。
- 边界：正式技艺研发、文化对人才吸引的加成及浏览器点击验收仍后置；0-B 继续暂缓。

### Session 362 · S03 文化持续投入 0-A

- `DevelopmentProject.kind` 新增 `culture`，共享数值真源为总成本360金、首付120金、工期6个月、完成文化+60（封顶999）。
- 服务端复用既有持续开发的人员门禁、月费、暂停/进度损失与完整 GameState Schema；客户端产业分面新增文化数值与统一终审入口。
- 启动、月结、完成均不消费 RNG；技术研发/人才吸引消费、工艺/交通/卫生与 0-B 数据扩容仍后置。
- 验证：`verify-culture-development` **10/10**、共享文化配置单测 **1/1**、R5 预算 **17/17**、即时内政 RNG **9/9**；浏览器运行时仍无连接，未宣称真实 DOM 点击验收。

### Session 397 · S03 工艺持续投入 0-A

- `DevelopmentProject.kind` 新增 `craft`，数值真源对齐文化：360金/首付120/6月/工艺+60（封顶999，见 `08`）。
- `City.stats.craft?` 旧档缺省；API `POST /civil/develop` 接受 `kind:'craft'`；产业分面展示与终审。
- 征兵质量与器械建造速度消费、交通/卫生、正式技艺研发仍后置；零 RNG。
- 验证：`verify-craft-development` **10/10**、shared civil-development **2/2**、CivilOverviewDrawer **3/3**。

### Session 398 · S03 交通持续投入 0-A

- `DevelopmentProject.kind` 新增 `transport`，数值真源对齐文化：360金/首付120/6月/交通+60（封顶999，见 `08`）。
- `City.stats.transport?` 旧档缺省；API `POST /civil/develop` 接受 `kind:'transport'`；产业分面展示与终审。
- 行军速度与运输损耗消费、卫生、正式技艺研发仍后置；零 RNG。
- 验证：`verify-transport-development` **10/10**、shared civil-development **3/3**、CivilOverviewDrawer **3/3**。

### Session 399 · S03 卫生持续投入 0-A

- `DevelopmentProject.kind` 新增 `sanitation`，数值真源对齐文化：360金/首付120/6月/卫生+60（封顶999，见 `08`）。
- `City.stats.sanitation?` 旧档缺省；API `POST /civil/develop` 接受 `kind:'sanitation'`；产业分面展示与终审。
- 瘟疫抗性与人口增长率消费、正式技艺研发仍后置；零 RNG。四项持续投入落库链已齐。
- 验证：`verify-sanitation-development` **10/10**、shared civil-development **4/4**、CivilOverviewDrawer **3/3**。

### Session 400 · S03∩S11 文化→登用成功率

- `cultureRecruitModifier`：技艺门槛每级 +2 百分点（顶 +10）；`playerCultureForRecruit` 读城；`resolveRecruitChance` 合成辩才+文化。
- `recruitOfficer` / 招贤 UI 同源；不新增存档字段/API/RNG；技艺研发仍后置。
- 验证：`verify-culture-recruit`；shared culture 单测；`verify-personnel-rng` / `verify-negotiation-r2` 回归。

### Session 401 · S03 工艺→征兵士气

- `craftConscriptMoraleBonus`：质量门槛同文化，每级征兵后 `troopsMorale` +2（顶 +10）；`conscript` 确定性写入。
- 0-A 以部队士气代理正式兵质；器械建造速度仍后置；不新增存档字段/API/RNG。
- 验证：`verify-craft-conscript`；shared craft 单测；CivilOverviewDrawer / 军备终审文案。

### Session 402 · S03 交通→行军粮耗

- `transportMarchFoodMul` / `armyTransportForMarch`：路网门槛同文化，每级行军粮耗 −2%（顶 −10%）；`tickCampaignMarch` 乘区。
- 行军速度仍后置；不新增存档字段/API/RNG。
- 验证：`verify-transport-march`；shared transport 单测；CivilOverviewDrawer；`verify-campaign` 回归。

### Session 354 · S10 敌军协同包围走位最小切片

- `runSimpleEnemyAi` 在已有一支敌军从有效接战方向贴住目标、但尚未形成受围时，优先寻找另一个可达且未占用的邻接格；落子后朝向目标。
- 候选按剩余移动力、方向和坐标稳定排序，决策不消费 RNG；没有可行包抄位时保持原有距离/地形评分。
- 验证：`verify-tactical-ai` **55/55**；`verify-save-battle` **59/59**；`verify-tactical-retreat` **9/9**；`verify-battle-rng` **5/5**；`verify-fm4-hex-formation` **14/14**；shared **416** + client **51**；typecheck/lint/build/validate-data/verify-compliance 全绿，`git diff --check` 通过。未新增字段、API、数据规模或 UI；浏览器当前无连接，未宣称真实 DOM 点击验收。
- 边界：只覆盖“已有一翼→寻找第二翼”的敌军走位；完整敌军包围/撤退 AI、追击/截击、攻城突围、多军团协同与 0-B 仍后置。

### Session 355 · S10 受围敌军突围走位最小切片

- `runSimpleEnemyAi` 发现自身由 `resolveHexSurround` 派生为受围时，优先寻找可达且未占用、能将有效接战方向降到一支以内的空格；移动后更新朝向、重新选目标并复用既有战法/火计/普攻链。
- 候选按接战方向数、剩余移动力和坐标稳定排序；不消费 RNG；没有合法落点时回退原有攻击/距离评分。
- 验证：`verify-tactical-ai` **59/59**；未新增字段、API、数据规模或 UI；完整回归已通过（详见 `docs/10-progress.md`）。
- 边界：这是解除一次派生包围的走位切片，不写 `isRetreated`、不直接结束战斗；完整敌军撤退/追击/截击、攻城突围、多军团协同与 0-B 仍后置。

### Session 357 · S10 敌军主动撤退最小切片

- `runSimpleEnemyAi` 在每支敌军行动、目标选择前检查：未受协同包围且士气≤20，或兵力≤最大兵力25%时，复用 `isRetreated=true` 标记撤出，写入 `hasActed=true/mp=0`，不消费 RNG。
- 全部敌军成为非活跃单位时立即判定玩家胜利；受围低士气/重创单位不跳过既有突围走位，先沿原突围/战法/火计/普攻链行动。
- 未新增 `BattleState`/`BattleUnit` 字段、API、RNG 或静态数据规模；追击/截击、攻城突围、多军团撤退仍后置。阈值真源为 `docs/08-data-dictionary.md` §二十七。
- 验证：`verify-tactical-ai` **72/72**；S10 回归 `verify-save-battle` **62/62**、`verify-tactical-retreat` **9/9**、`verify-battle-rng` **5/5**、`verify-fm4-hex-formation` **14/14**；浏览器连接为空，未宣称真实 DOM 点击验收。

### Session 358 · S10 敌军主动撤退相邻截击门禁

- 敌军满足主动撤退门槛但与任一活跃敌对单位相邻（1 格）时，不直接标记 `isRetreated`；写入“被截击”战报后继续既有战法、火计或普攻链。
- 未被截击的低士气/重创敌军、受围突围、撤退终局与 `isRetreated` 非活跃语义保持不变；不新增 `BattleState`/`BattleUnit` 字段、API、RNG 或静态数据规模。
- 验证：`verify-tactical-ai` **75/75**；浏览器连接仍为空，未宣称真实 DOM 点击验收；完整追击/截击、攻城突围与多军团撤退仍后置。

### Session 359 · S18 0-A 直系族谱只读分面

- `FamilyOverviewDrawer` 新增“族谱”分面，按当前剧本启用的 `children` 目录派生父、母、子女、登场状态、生年/登场年与史料层。
- 只显示至少一条直系关系连接到玩家势力的记录；不把 `hidden.bloodline` 当父子关系，不新增 API、存档字段、随机流程或静态数据规模。
- 验证：`FamilyOverviewDrawer.test.ts` **3/3**、client 全量 **52/52**、client typecheck 通过；浏览器连接仍为空，未宣称真实 DOM 点击验收。
- 边界：完整多代族谱、武将 `fatherId`/`motherId`、父兄跟随与 0-B 50+ 子女数据仍后置。

### Session 360 · S10 截击后相邻目标优先

- `runSimpleEnemyAi` 在相邻截击门禁成立时，先在相邻活跃敌对部队中按既有确定性评分选取行动目标；无相邻候选才回退全局目标评分。
- 仍复用既有战法、火计、普攻与 RNG 顺序；不新增追击状态、`BattleState`/`BattleUnit` 字段、API、额外 RNG 或静态数据规模。
- 验证：`verify-tactical-ai` **78/78**；浏览器连接仍为空，未宣称真实 DOM 点击验收；完整追击/截击、攻城突围和多军团撤退仍后置。

### Session 361 · S10 BattleView 撤退态活跃单位边界

- BattleView 复用既有 `isRetreated` 语义筛选活跃部队；撤退单位不再进入地图选择、攻击目标、红色可攻击标记或协同包围来源，残留 `selectedUnitId` 不会恢复成可操作选择。
- 结束态仍展示未击破撤退部队的兵力摘要；不新增字段、API、RNG、规则数字或静态数据规模。
- 验证：`battleViewState.test.ts` 2/2、client 全量 54/54、shared 416/416、`verify-tactical-ai` 78/78、workspace typecheck/build/validate-data/diff-check 全绿；浏览器连接为空，未宣称真实 DOM 点击验收。

### Session 356 · S10 撤退态活跃单位语义收口

- `isRetreated=true` 的现有单位从敌军 AI/战斗 `sideAlive`、目标选择、寻路占位、AOE、灼烧、敌军回合恢复、主动单挑和玩家六角动作门禁中统一排除；战后既有兵力快照与 50% 回流保持不变。
- 验证：`verify-tactical-ai` 66/66、`verify-save-battle` 62/62、`verify-tactical-retreat` 9/9、`verify-battle-rng` 5/5、`verify-fm4-hex-formation` 14/14；全仓静态/构建/数据/合规检查通过。
- 边界：不新增字段、API、RNG、数据规模或 UI；完整敌军撤退/追击/截击、攻城突围、多军团协同和 0-B 仍后置。浏览器当前无连接，未宣称真实 DOM 点击验收。

### Session 353 · S10 敌军走位朝向与协同包围前置

- `runSimpleEnemyAi` 移动后写回 `facing`，方向以新位置到当前目标为准；目标重选后按实际出手目标校正。
- 该修补仅统一既有六角朝向语义，不新增存档字段、API、RNG 或静态数据规模。
- 验证：`verify-tactical-ai` 51/51、`verify-save-battle` 59/59、`verify-tactical-retreat` 9/9；浏览器连接仍不可用，未宣称 DOM 点击验收。

### Session 352 · S10 六角协同包围与战术撤退

- `shared/hex-positioning.ts` 按六角邻接、朝向和存活状态派生包围，不新增 BattleState 字段；至少两个不同接战方向才成立。
- 受围部队由服务端限制为方阵，暴击/反击接收既有 `isSurrounded` 判定；BattleView 显示受围数量与撤退阻断原因。
- `POST /api/game/battle/retreat` 成功后标记存活攻方 `isRetreated`、战斗结束且不消费 RNG；`/battle/exit` 按 50% 回流率结算。
- 验证：共享纯函数 4/4、战术撤退脚本 9/9、真实 HTTP 出征→撤退→退出链通过；浏览器运行环境无可用实例，未宣称 DOM 点击验收。
- 边界：敌军主动包围/撤退 AI、追击/截击、攻城突围、多军团协同与 0-B 仍后置。

### Session 351 · 家属质任处置

- `pendingFamilyTreatment` 是攻城后的玩家待决项；`POST /api/game/civil/family-treatment` 只处理当前权威项。
- 善待/中立/镇压写入 `City.familyTreatment`；季度善待余波、S27 叛乱倍率、战役自动攻城倍率读取同一状态。
- 全局弹窗与 TopBar 回合门禁已接线；普通家族抽屉仍只展示家属位置与当前处置，不复制规则。
- 暂后：六角直接战斗的镇压倍率、流言/四面楚歌/将忠联动、0-B。

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
| P0A-08 | formations.json（小） | 7阵型；目标 `[0,1,2,3,4,6,16]`（六基础+特殊冲阵）；Session 288 FM-P1 已迁移落地 |
| P0A-09 | units.json（小） | 9兵种（6陆+走舸/蒙冲/楼船 Session71） |
| P0A-10 | items.json（小） | 20宝物 |
| P0A-11 | females.json（小） | 10女性 |
| P0A-12 | children.json（小） | 5子女事件 |
| P0A-13 | skills.json（小） | 30通用技能(暂不含专属技) |
| P0A-14 | scenarios.json（小） | 2个：英雄集结 what-if Demo + 190《关东义兵》四势力技术切片；ScenarioSelect 已可用 |
| P0A-15 | events.json（小） | 24个190事件；5条叙事线+玩家抉择，支持场景/史料层隔离 |

**0-A 验收标准**：Zod 校验全部通过；**世界屏层级卡片可渲染**（Session 379 起世界屏改层级战略卡片，原「能渲染地图」口径随大地图退役更新，Session 406 校正）、能推进至少1回合、能完成1次内政操作、能打通1场最简战斗。

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
> **Session 269 状态覆盖：**上述 BF-P5 历史段中的“第三郡待史料/待录入”已完成：陈留郡
> 190 年模板现为 17 县、19 路、10 地标，并已接通目录、郡治归属、攻守入口、补给、迷雾
> 与真实浏览器入口。BF-P5 后续仅按目标剧本交战范围继续逐郡扩展；105 郡国全量归 BF-P6。
> **Session 270 续实施：**按陈留—洛阳主战线新增河南尹 190 第四模板（21 县/
> 40 路/10 地标）；攻方从荥阳/中牟/新郑入场，守方部署成皋/偃师，郡治雒阳。
> 县表、水系与 190 年荥阳军事入口分级标注，没有将相对拓扑伪装为精确古道。
> **Session 271 续实施：**按关东义兵北线新增河内郡 190 第五模板（18 县/35 路/
> 10 地标），攻方入口河阳/修武/获嘉、守方野王/怀、治所怀，并接通“河内孟津”入口。
> 0-A 大地图无河内治所，暂借洛阳节点承载势力归属与进场，不表示行政合并。

| BF-P6 | 0-B 全量 | 与 105 行政治所一一对应的 105 郡国模板；版本治理与性能优化 | 全量校验、来源/版权、并发战争、存档与渲染性能通过 |

> **Session 272 BF-P5 状态覆盖：**新增弘农郡第六模板（9 县/17 路/11 地标），六模板
> 合计 98 县/151 路/55 地标；0-A 暂借长安节点代理弘农进场与归属，未启动 BF-P6/0-B。
> **Session 273 进度口径：**BF-P5 行内早期“第三郡/年代覆写待办”仅保留为历史过程，
> 当前均已完成。现行 Next 为六模板跨郡入口与 0-A 代理归属总验收，或按目标剧本继续
> 逐郡扩展；105 郡国全量仍严格归 BF-P6/0-B。
> **Session 274 总验收：**六模板已在同一 1440×900 浏览器会话逐一真实点击进入并退出；
> 模板、县/路/入口、治所渲染及大地图归属全部通过。南郡/颍川/陈留/河南尹为直连，
> 河内→洛阳、弘农→长安为显式 0-A 代理；下一目标战线由用户拍板。

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
| P1-09 | AI 基础框架（大地图基础框架；六角敌军已于 Session 275/305/307 升级为目标/地形/火计/leveled兵种战法/主动单挑战术评分） | P1-05 |

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
| P3-05 | 兵种克制 + 阵型加成（Session 277 已有六基础白刃切换/修正；目录、精通、三模式、AI 尚未全量同源） | P3-04, P0-08, P0-09 |
| P3-06 | 计策系统(15种) — 火/水/落石/伏兵/挑拨等 | P3-04 |
| P3-07 | 单挑系统(7指令+三向克制+武器分化+部位受伤+AI+UI) 设计完成 | P3-04 |
| P3-08 | 攻城战引擎 — 城墙/城门/器械 | P3-04 |
| P3-09 | BattleCommandBar — 底部操作栏 | P3-01 |
| P3-10 | BattleInfoBar — 战斗信息栏 | P3-01 |
| P3-11 | 战斗 API (move/attack/tactic/duel/retreat) | P3-04~P3-08 |
| P3-12 | BattleView 完整组件 | P3-09~P3-11 |
| P3-13 | 特殊兵种战斗效果(藤甲/象兵/虎豹骑 etc) | P3-05 |

### S10-FM：P3-05 阵型联动 0-A 子路线

> 本子路线不新增大系统编号。Session 279 完成原设定优先开发计划；Session 287 启动并产出 FM-P0 材料；
> Session 288 批准 Gate M/N1/D 并落地 FM-P1（Schema + 数据迁移）。详细 Gate、排期和验收见
> `29-formation-integration-development-plan.md`。

| ID | 任务 | 状态 | 前置/边界 |
|:--:|------|:--:|-----------|
| FM-PLAN | 调研、融合、IP、实施、测试评审稿提交 | [x] | 仅文档，不改变运行时；待用户审核 |
| FM-P0 | 权威契约、目录/逐将迁移表、数值映射与部署语义冻结 | [x] | 材料产出 + Gate M/N1/D 批准（Session 288） |
| FM-P1 | `Formation` Zod/Type、TacticalConfig v2、7阵目录与 146 将精通迁移 | [x] | 已实装（Session 288）；v1 只读兼容 |
| FM-P2 | 共享合法性、阵型贡献、五部部署与解释纯函数 | [x] | 已实装（Session 289）`shared/formation-core.ts`；不创建第四套伤害公式 |
| FM-P3 | 标准/自动/Campaign/六角同源消费与幂等回写 | [~] | crit + melee 注入 + 变阵幂等 + **自动入口恢复 runAutoBattle**（290）+ **标准模式点值迁移**（291，`tiers[0]` 点值 + 组织度执行档，`meleePercent` 退役）+ **自动战斗阵型贡献**（292，`autoFormationMods` 点值战力修正 + 五部侧击）+ **六角战斗阵型贡献**（295，`hexFormationMods` 点值投影，三模式点值同源闭环）+ **标准模式战术协同矩阵**（296，`MeleeState.tactic?` 持久战术 + TacticalConfig v2 T_base/synergy + `/melee/tactic`）+ **六角协同包围/玩家撤退最小切片**（352）+ **敌军协同包围与受围突围走位最小切片**（354~355）+ **撤退态活跃单位语义收口**（356）+ **敌军主动撤退与相邻截击最小切片**（357~358）；完整追击/截击/攻城突围与多军团仍后置 |
| FM-P4 | 公平 AI、阵型 UI、浏览器流程与存档迁移 | [~] | Session 302~312 已完成战报解释、变阵存档往返、敌军主动单挑浏览器链、浏览器 JSON 导入/导出及 XDG 槽位 UI；**Session 340 槽位介质改为 SQLite**；完整公平 AI 仍后置 |
| FM-P5 | 平衡、独特性、经典体验、IP 与文档总验收 | [ ] | 通过后仍不代表 0-B 完成 |
| FM-P6 | 27阵/水阵/双轴成长扩展 | [ ] | 仅 0-A 验收完成且用户重启 0-B 后可做 |

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
| P4-08 | 宝物转移引擎(装备/剥夺/缴获/传承) | P1-05, P0-10 | **装备/卸下/赏赐已实装（Session 266，`server/src/engine/items.ts` + `/items/equip|unequip|grant` + OfficerDetail 装备 tab）**；剥夺/缴获/传承留 0-B |
| P4-09 | 外交/婚姻/事件 API | P4-01~P4-08 |
| P4-10 | 关押系统引擎 + UI(监狱4级/审讯/囚心理/劫狱/处决) | P2-05, P3-11 |
| P4-11 | 伤病系统引擎(5级伤情/6种受伤来源/5种疾病/后遗症) | P3-04 |
| P4-12 | 伤兵系统引擎(伤亡分流/恢复率/容量/战后统计) | P4-11, P3-11 |

---

## Phase 5 — AI & 打磨

| ID | 任务 | 依赖 |
|:--:|------|------|
| P5-01 | AI 决策引擎(内政/军事/人事/外交 智能；六角敌军目标/走位/普攻/火计/leveled兵种战法/主动单挑切片已落地，完整 AI 未完成) | P1-09 |
| P5-02 | AI 战争决策 + 兵力分配 | P5-01 |
| P5-03 | AI 外交决策(弱势求盟) | P5-01 |
| P5-04 | 套装系统计算引擎 | P4-08 |
| P5-05 | 存档/读档(SQLite) | **Session 340 完成首切片**：命名槽位 `saves.db` + 遗留 JSON 迁移；多用户后置 | P0-04 |
| P5-06 | 多剧本完善 | P0-14 |
| P5-07 | UI 美化(Tailwind主题+动画) | P1~P4 |
| P5-07a | HiDPI/Wayland 缩放适配（`utils/hidpi.ts` + MapCanvas/BattleView 接入 `stage.scale(dpr)`） | P5-07 |
| P5-07b | XDG 存档（服务端写 `$XDG_DATA_HOME/leh/saves.db` + 前端一键导入导出 Blob） | **完成：Session 311/312 槽位 API/UI；Session 340 介质改为 SQLite；多用户留后续** | P5-05 |
| P5-07c | 伪 Terminal 文言战报（`EventLog` 改造，`#1c1a17` 宣纸暗色 + 等宽 + 思源宋体混排 + `[ 丰/警/凶/喜 ]` 状态色） | P5-07 |
| P5-07d | 金石黑框组件库（`StonePanel`/`SealButton`/`ConfirmDialog`，朱砂+黑框+宣纸黄）**→ 执行批次②，见 `ArtDirection.md` §九** | P5-07 |
| P5-07e | 工程字体资产闭环补完（基础 woff2 已就位；剩余字重扩展与资产完整性复核）**→ 引擎1（批次①/②顺带）** | P5-07 |
| P5-08 | Canvas 动画(行军/着火/水流/落石) **→ 执行批次④（程序化几何特效）** | P1-03, P3-01 |
| P5-09 | 音效系统 **→ 批次⑤ Session 409 首切片完成**（战鼓/铜磬/号角 Web Audio 合成；音色打磨后置） | P5-07 |
| P5-10 | 武将头像（**金石水墨·免版权组合方案 A+C+B**；Session 124 已有四名代表人物 C+B 简化切片，待补 A 拓片层、`avatarGene` 落库与 30 人精校；详见 `00-dev-constitution.md` §十一、`07-ui-design.md` §11.6；禁止约稿立绘）**→ 批次③ Session 409 完成**：avatarGene 落库（4 原型策展+哈希派生+消解表）+ A′拓影/C 6×10×8×7/B 印信层（清 D-0B-7；officeSeal 动态官职印后置） | P0-06 |
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
### Session 277 · S10 战旗移动深化

- [x] 100×100 六角坐标、A*/Dijkstra、障碍矩阵与 `<100ms` 性能门禁
- [x] 路径预览、剩余移动力、逐格动画、权威复验与攻击前移动撤销
- [x] 剑/斧1格、矛1~2格朝向接战；战法收口白刃2格
- [x] 六基础阵型正式切换并修复阵型修正键漂移
- [x] 版本化 JSON、Zod、事件总线、阶段/撤销/规则策略纯核心与覆盖率门禁
- [ ] 阶段细分字段正式写入 BattleState（当前纯核心协议已就位，运行态仍兼容 player/enemy/over）
- [ ] 军阵格挡/闪避若要独立于单挑指令系统，须先由用户批准概率池与数值

### Session 279 · S10/P3-05 阵型整合计划

- [x] 按原设定优先完成 `docs/29-formation-integration-development-plan.md` 评审稿。
- [x] **Session 287**：启动实施 + FM-P0 评审材料（目录迁移 + 146 将 CSV）。
- [x] **Session 288**：补全 N1 数值映射表 + D 五部部署草稿；**Gate M/N1/D 批准**；FM-P1 落地
      （`Formation` Zod/Type + `FormationDeployment`、TacticalConfig v2 + v1→v2 夹具、
      `formations.json` 收敛 `[0,1,2,3,4,6,16]`、146 将精通迁移、validate-data 跨引用）。
- [x] **Session 289（FM-P2）**：`shared/formation-core.ts` 共享解析器——`getAvailableFormations` /
      `resolveFormationContribution`（读 tiers[0] + effects 暴击链）/ `resolveFormationDeployment` /
      `explainFormationResolution` / `organizationBandFor` / `applyOrganizationExecution`；暴击/反击/连击
      贡献结构化入库 `effects`（单一内容源）；formation-core 单测 7 项。
- [~] **Session 290（FM-P3 crit + meleeRound 注入 + 变阵幂等）**：crit.ts 暴击/反击/连击/反击系数改从 `formations.json` `effects`
      注入（`setFormationCatalog` + 服务端启动注入 + 未注入回退硬编码），行为等价（verify-fm3-crit 5 断言）；
      `meleeRound` 百分比表外移到 `formations.json` `meleePercent`（`setMeleeFormationCatalog` + 回退），
      白刃伤害/先手不变（verify-fm3-melee 4 断言）；**动作级幂等（§7.5）**：`MeleeState.commandCache` +
      `meleeRound(commandId, expectedRound)`（同 ID 同轮重试返回首次结果/不二次扣 TP 推进、过期拒绝；
      verify-fm3-idempotency 5 断言）；**自动入口恢复 `runAutoBattle`（§2.2/§7.4 清债）**：局部自动结算由
      `runMeleeRound` 循环改为调用既有 `runAutoBattle`（结果桥接回 melee 一次回写，verify-fm3-auto-battle 4 断言）；
      `generate-0a-data.ts` 同步。
- [~] **Session 291（FM-P3a 标准模式点值迁移）**：`runMeleeRound` 唯一量纲收敛到 `tiers[0]` 点值——经
      等价性单点换算（`MELEE_ATK/DEF_GAIN=0.1`、`MOB_GAIN=0.5`、`MOB_BASE=1.0`，模块常量）消费，
      正面增量按组织度执行档缩放（`MeleeState.attackerOrganization/defenderOrganization?`，旧档缺省 orderly×1.0 中性）；
      `meleePercent` 过渡字段退役（类型/Zod/formations.json/generate-0a-data 移除，单一内容源收口）；
      `standardMeleeMods` 导出供战报复算；StandardModePanel 阵型说明同步新数值；
      验证 `verify-fm3-melee-inject.ts` 重写为点值语义（16 断言 + 迁移对比表）。
- [~] **Session 292（FM-P3 自动战斗阵型贡献）**：`runAutoBattle` 的 `formationMod` 由 `autoFormationMods`
      生成（`tiers[0]` 攻防点值 ×0.1 合并加性战力修正 + 五部侧击 +10%；组织度执行档只缩放正面增量、
      负修正原值保留；`mobility/range` 点值不参与自动战力）；`setAutoFormationCatalog` 服务端注入 +
      中性回退；`squadFlankBonus`/`autoFormationMods` 导出供复算；守城守方无 Army 无阵型贡献（城墙惩罚
      表达守势；与 `orgCoeff` 分项不双乘）；验证 `verify-fm3-auto-formation.ts` 13 断言（系数/组织度/
      侧击/中性/端到端注入生效与确定性）。
- [~] **Session 295（FM-P3 六角战斗阵型贡献）**：新增 `server/src/battle/hex-formation.ts` `hexFormationMods`
      （`tiers[0]` 攻点值×2 进 baseAttack / 防点值×2.5 进 baseDefense，模式专用投影，负原值保留，orderly 中性）
      + `setHexFormationCatalog` 服务端注入 + 中性回退；battle.ts 普攻（attackUnit）与战法（castAbility）、
      simpleAi 评估三处 calcDamage 同源传参，crit 反击/连击按 baseDamage 继承自动覆盖；
      DamageInput 加可选 formationAtk/formationDef 且不影响既有字段；验证 `verify-fm3-hex-formation.ts`
      11 断言（系数锚定/逐阵投影/calcDamage 方向性/端到端注入生效/固定 rng 复现）。
- [~] **Session 296（FM-P3 标准模式战术协同矩阵）**：`MeleeState.tactic?`（assault/hold/ambush，持久字段，旧档
      缺省中性，Zod 同步）；`shared/tactical-system.ts` 新增 `resolveTacticSynergy`/`tacticModifiers`/`ACTIVE_TACTIC_IDS`
      纯函数 + synergy 常量（1.1/1.0；0-A 无 0.9 触发源并诚实标注）；`runMeleeRound` 消费 T_base（攻/防/先手，
      不受组织度缩放）+ synergy（对敌阵 ×1.1/×1.0），战报 events 记「战术·强攻」等；`POST /melee/tactic`
      路由 + `meleeSetTactic` service（运行时校验非法值）+ client api/store + StandardModePanel 战术姿态 UI
      （强攻/固守/奇袭/无，不耗 TP）；`data/loader.ts` 新增 `loadTacticalSystemV2`（shared/data v2 真源 + Zod）；
      验证 `verify-fm3-tactic.ts` 9 断言 + shared 单测 +2（376 项）。
- [~] **Session 297（FM-P3 六角部署注入）**：`shared/formation-core.ts` 新增 `projectHexDeployment`，由
      `CampaignArmy.squads` 按阵型 `deployment.slots` 生成多个 `BattleUnit`，攻方保持模板方向、守方镜像，
      缺部不造虚构 unit，越界/碰撞按固定邻接顺序收缩；`createBattle` 保留无 Army 双 unit 兼容入口，
      tactical melee 入口接入攻守 Army。客户端仍消费 `units[]`，simple AI 逐 unit 决策；普攻/战法/火计/
      灼烧按整方存活 unit 判定终局。验证 `verify-fm3-hex-deployment` 13/13、battle-commanders 111，
      shared 377 + client 42、三端 typecheck、validate-data、client build 全绿。六角战中变阵状态机与战报解释 UI 后置。
- [ ] 下一步：六角战中变阵状态机评审（TP/阶段/每回合一次门禁）或 FM-P4 战报解释 UI。
- 0-B、27 阵、双轴成长、科技树和水阵继续暂停。

### Session 284 · S24 关系网 + S25 技能树 + S26 天命人心

- [x] **S24 关系网系统**：`shared/relations.ts` pairAffinity/relationState/evolveAffinity 纯函数；`server/src/data/relations.json` 首批 31 对重点关系（史源分层）；服务端 `GET /api/game/relations/:officerId`；客户端 OfficerDetail 新增「社交」tab（关系列表 + SVG 径向图谱）；家族 tab 更名为「关系」，婚姻区块扩展妾/姬（`Officer.consortIds`）
- [x] **S25 技能树系统**：`shared/types/skill-tree.ts` 类型；`server/src/data/skill-trees.json` 5 棵子树（战略计策/战术计策/单挑技能/统军/内政），30 技能按战斗层映射；技能点绑定 merit 等级，特性点每 5 级 +1；服务端 5 个 API 端点；客户端 OfficerDetail 新增「技能」tab（子树切换 + 节点列表 + 加点按钮 + 特性点概览）
- [x] **Session 337 · S25 效果消费**：`shared/skill-consume.ts` + 加点同步 `officer.skills`；内政/人事/医术/结盟辩才接通；`pnpm verify-skill-consume` 19/19
- [x] **S26 天命人心系统**：`shared/mandate-popular.ts` 纯函数（computeMandate/computePopularWill）；Faction 新增 mandate/popularWill 字段；turn.ts 月度结算接入；服务端 `GET /api/game/faction/overview`；命令坞新增「势力」入口（FactionOverviewDrawer 双轨进度条 + 效果预览）
- [x] 数据层：Officer 新增 skillTreeState/skillPointsSpent/traitLevels/traitPointsSpent/consortIds（全部 optional，旧档兼容）；Zod schema 同步
- [x] 回归：typecheck / test（shared 311 + client 42）全绿
- [x] 文档：`30-skill-tree-design.md` / `31-mandate-popular-system.md` 定稿；`12-system-map.md` 注册 S24+S25+S26（23→27）；`03-data-models.md` / `06-api-design.md` / `07-ui-design.md` / `08-data-dictionary.md` / `09-roadmap.md` / `10-progress.md` / `HANDOFF.md` 同步

*文档版本: v5.0 | 2026-08-01 | Session 284 · S24/S25/S26 首轮实装*
