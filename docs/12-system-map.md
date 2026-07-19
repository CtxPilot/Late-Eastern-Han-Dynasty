# 大系统地图（总纲）

> **用途**：先定大系统，再逐步扩充 / Debug。  
> **一次主攻 1 个 Sxx**。数字真源：`08-data-dictionary.md`。

---

## 成熟度

| 标记 | 含义 |
|:----:|------|
| D | 仅设计 | S | 壳 | M | Demo 可玩 | C | 主路径完整 | P | 打磨 |

策略：玩法优先 · 30 城 · **暂缓 0-B**。

---

## 一、概念定稿（Session 43~45）

| 概念 | 定义 |
|------|------|
| **美女资源 S09** | 势力库存，像金；寻访/抢夺/赏赐 |
| **历史女角** | 具名；**不可**人事登用、**不可**寻访获得 |
| **家族 S18** | 血缘姻亲网；女角/婚姻/子女挂此下 |
| **计谋 S17** | 战略阴谋 ≠ 战场计策 |
| **祝融** | 唯一可出战/「工作」的历史女角 |

---

## 二、22 大系统

> v4.3 起 22 大系统（v4.3 新增 S22 美术基调·金石水墨免版权，v4.4 S22 D→S/D 部分实装）。

### A. 战略主环

| ID | 系统 | 成熟度 | 要点 |
|:--:|------|:------:|------|
| S01 | 回合 | M+ | turn.ts；**全势力金粮同步** |
| S02 | 地图 | M | 官道邻接 |
| S03 | 内政 | M | 已实装农/商/城即时开发+施米；军屯/民屯仅设计 |
| S04 | 人口经济 | M | 四桶粮耗；城金为真源 |
| S05 | 军事 | M+ | 出征占城；战役 Army 主/副将/参谋编成；爵位加成未接入 |
| S06 | 迷雾 | **M+** | UI+**服务端裁剪** maskGameStateForPlayer |
| S07 | 谍报 | M+ | 女间谍；**献美点化**；失城/亡国清理 |
| S08 | 外交 | M+ | 进贡/结盟/**献美**+金同步 |
| S09 | **美女资源** | M | stock+可寻；**非历史女** |
| S10 | 战斗最简 | **M+引擎/入口有缺陷** | **已实装：**六角+克制+火计+战法+暴击/反击/连击；完整单挑引擎冒烟通过，但接受挑战 API 有嵌套锁错误；战役层 Army 编成/行军/补给/围城/自动战斗可玩。**仅设计：**部曲、军屯/民屯、爵位编成加成、战役层完整单挑复用与 S21 串联 |

### B. 人 / 家族 / 阴谋

| ID | 系统 | 成熟度 | 要点 |
|:--:|------|:------:|------|
| S11 | 人事 | **M+** | **仅男将**搜索/登用；赏赐；**任命三轨** |
| S12 | 官职功绩体力 | **S/M** | **0-A 精简任命**；功绩等级字段代码未实现，表在文档；功绩门槛未联动任命；体力已完整接入（Session 63/65）
| S13 | 宝物 | S | — |
| S14 | 事件 | **M+** | 场景/史料层隔离 + 年月窗口/前置/互斥/失效 + 玩家/AI选择 + EventDialog来源标签；190共24事件/5条叙事线 |
| S15 | AI | **M+** | 内政占位 + 谍报/计谋 + **出征占城** |
| S16 | 存档剧本 | **M/D** | 两剧本目录、选择、场景级势力/角色/事件白名单已可玩；SQLite存档仍D |
| S17 | **计谋** | **S/M+** | **三层体系**：L1 美人计/离间/假情报/空城 ✅ · L2 釜底抽薪/调虎离山/暗渡陈仓/树上开花/借刀杀人/趁火打劫/秘密挖角/隔岸观火/偷梁换柱/借尸还魂/指桑骂槐（设计完成）· L3 以逸待劳/远交近攻/假痴不癫/反客为主/高筑墙广积粮/避实击虚/坚壁清野/深藏不露（设计完成）· 行政↔战场联动 |
| S18 | **家族** | **M+** | 女眷/婚配/跟随 ✅；**子女登场引擎** ✅；父辈/族谱 ❌ |
| S19 | **单挑大会** | **D** | 独立锦标赛系统：赛制/押注/称号/叙事/数据结构设计完成，引擎待实现 |
| S20 | **前端体验** | **D** | 视觉与交互增强（零新依赖，React+Konva+Zustand+Tailwind 覆盖 90% 需求）：W1 endTurn WebSocket 接入+进度overlay（复用已废弃的 ws/broadcast.ts）· W2 TopBar useAnimatedNumber 数字跳动+EventLog 流化（type 着色/淡入/顶滚）· W3 势力凸包涂色+ FogLayer(globalCompositeOperation 挖洞)+konva tween(聚焦/缩放/城色渐变)+PCG 水墨地形绘制(二三级·Konva.Animation+layer.getContext()命令式)· W4 派系面板(tags 派生)+OfficerDetail modal+内政外交前端增强(己方武将列表/忠诚度警报 animate-pulse/外交雷达纯SVG手写/财政飘字前端算delta/行政总署三段式重组)。0-B 前置技术债 D-0B-1~5、D-0B-9~10 |
| S21 | **三级战斗串联** | **D** | 战役→战术→白刃→单挑 四级状态机串联：W6 一级大地图演出(军旗 Tween+烽火粒子+是否攻城弹窗+行军箭头，复用已实装 campaign.ts)· W7 二级战术串联(screen 六态栈+切入渐变+棋子滑行+hex 悬停情报+邻接触发三级+迷雾散开)· W8 三级白刃战横版(MeleeStage Konva 方阵表现 30-50 图元·动态缩放 20-120 粒·纯战略指令全军突击/鸣金收兵/发起单挑·镜头推进+渐变切入·Soldier 类移植·武将计特写)· W9 单挑接入(DuelStage 混合范式·已储备)。screen 扩展为 'boot'\|'world'\|'campaign'\|'tactical'\|'melee'\|'duel' 六态栈。0-B 前置技术债 D-0B-6 |
| S22 | **美术基调·金石水墨免版权** | **S/D** | 独立开发+彻底免版权死命令下的版权护城河。基调固定「金石水墨·拓片简册·印信官职」三件套，仅用公有领域历史文物视觉语言（汉代画像砖/帛画/石刻拓片/竹简/官印/印绶）。**武将头像组合方案 A+C+B**（Phase 5 实装）：A 拓片印章（底图层·20~30 张公有领域拓片切片+宣纸纹理+朱砂姓名印）+ C 程序化拼图（五官层·5 脸型×10 冠冕×10 胡须×10 眉眼·按 officer.id 哈希派生+重点人物手工指定）+ B 官职印信简册（文字层·氏族/官职篆印+汉制印绶颜色紫青墨黄）。officers.json 新增 `avatarGene` 字段（与 Session 100 `appearance` 战斗造型字段并存职责分离）。**Session 102 实装**：**跨平台字体防御三件套**（资产闭环 @font-face + Canvas 屏障 FontBarrier + .editorconfig/.gitattributes/CI 编码门禁）——工程内部别名 `HanDynastySerif`（思源宋体 SC）/ `HanDynastySeal`（马善政体 Ma Shan Zheng）woff2 本地打包（3 文件已就位 ~7MB），`font-display: block`，`App.tsx` `isEngineReady` 屏障，Konva `<Text>` 全部补 `fontFamily`，GitHub Actions CI 编码门禁。详见 `00-dev-constitution.md` §11.3+§11.7、`07-ui-design.md` §11.6、`15-linux-ui-spec.md`、`AGENTS.md` 核心规则 9。头像实装拆 3 子 Session（P5-10a/b/c），Linux UI 适配拆 P5-07a~e |

### C. 归并

| 内容 | 归入 |
|------|------|
| 子女 / 婚姻 / 历史女角 | **S18 家族** |
| 出身血缘 | S18 + S11 |
| 女间谍 | S07∩S09（资源训，非历史女） |
| 美人计 | S17∩S09∩S07 |
| 战场计策 | S10 / 05 |
| 美女赏赐 | S09 |
| 金宝赏赐 | S11 |

---

## 三、历史女角获得（禁止项明确）

| ❌ 禁止 | ✅ 允许 |
|---------|---------|
| 人事搜索/登用 | **相关男性**（夫/父兄/主公）跟随、联姻 |
| 美女寻访/抢夺/库存 | **历史事件** S14 |
| 当 beauty 点花掉 | **剧本开局**；特殊有出处奇遇 |

**能力**：除**祝融**外，不任军政职、不出战；影响力经丈夫/家族间接生效。

---

## 四、扩充顺序

1. **第 1 环 Debug**：S05/S07/S06/S01 → ✓（含 **S06 服务端裁剪 Session 56**）  
2. **第 1.5**：S09 ✓ → S18 ✓ → 女间谍 ✓ → S17 ✓ → 跟随 ✓ → Debug ✓  
3. **第 2**：~~S11~~ ✓ · ~~S14 事件引擎+选项 UI~~ ✓ · ~~外交献美~~ ✓ · ~~点化~~ ✓ · ~~S17 假情报/空城~~ ✓ · ~~S06 裁剪~~ ✓ · ~~兵种克制~~ ✓ · ~~AI 占城~~ ✓  
4. **第 3~4**：~~任命~~ ✓ · 战斗加深 · 主副将编成(Squad+阵型联动) · 单挑大会 · 0-B  

---

## 五、当前建议

- 锁定 **22 系统**（v4.3 新增 S22 美术基调·金石水墨免版权）。  
- **Session 70~72**：战法数据 + 三级水军 + **战法引擎最小切片**。  
- **Session 73**：暴击/反击/连击 × 技能·特性·专属联动设计完成（战场§6 + 单挑§8.8）。  
- **Session 74**：单挑系统全面设计完成（§8 全量重写：状态机/伤害公式/武器/技能特性/AI/UI）。  
- **Session 75**：单挑系统 经典化重写（§8 核心三角克制：猛攻/牵制/必杀 + 辅助链 + 经典叙事文本）。  
- **Session 81**：单挑大会 S19 设计（赛制/押注/称号/叙事/数据结构）。  
- **Session 88**：单挑引擎最小切片实装（§8 全自动结算·7指令三向克制·专属/无双保护·DuelPanel UI·API+store·verify-duel 冒烟全过）。  
- **Session 89**：暴击/反击/连击引擎最小切片实装（§6.2~6.5·crit.ts+resolveAttack接入attackUnit/simpleAi·阵型修正·专属·防循环·verify-crit全过·dev实战触发）。  
- **Session 82**：主副将编成系统（Squad + 阵型联动 + 关系加成 + 祝融火神专属）。  
- **Session 83（纯设计）**：部队组织大系统——经验Lv1-7+组织度0-100+士气深化+部曲12将+军屯田+家属质任+民屯田9维；部曲与屯田运行时未实装。
- **Session 84**：出身标签落地（officers.json 30将）+ 教育/科技/文化 + 货币/税收/俸禄。  
- **Session 93**：部队编成体系全面重设计——**参谋独立槽位（智力≥85·幕僚不带兵·智略综合）** + **副参谋** + **爵位编成加成（精简7级·关内侯→皇帝）** + **编成上限硬顶（大将军9/君主10）**；05 §5.5 重写·03 NobilityRank 精简·04/06/07/01/12 同步。
- **Session 97**：**战役/战术分层全面设计** — 战斗系统重构为 Part I 战役层 + Part II 战术层设计保留。**战役层**：§12 战役地图节点 · §13 Army 实体与编成（Squad 五部阵位·参谋战役角色·补给系统）· §14 总军师系统（战略态势·献策·总军师对决）· §15 设施与机关系统（副将建造·参谋陷阱·技能联动·混合建造模型）· §16 战役状态机（行军·围城·强攻·战后）· §17 自动战斗算法（战力公式·多回合推演·郡国归属算法）。**04 新增**：§36 势力特点（12势力完整设定·核心理念+修正+能力+负面）· §37 总军师系统规则（三层角色区分·任命·对决联动）。**03/06/07** 同步更新数据模型/API/UI。**命名规范**写入 00-dev-constitution.md §十。
- **Session 98**：**战役层引擎最小切片实装**（`server/src/engine/campaign.ts` 800+行 + `shared/types/campaign.ts` 类型）。§12 节点生成/同步 · §13 编成出征（主将+副将+参谋+Squad 五部阵位+校验）· §13 行军（BFS 路径+补给消耗+缺粮士气+经己方城补粮）· §15 设施建造（即时简化）· §13.6 参谋行动（激励/陷阱/撤退休整/斥候）· §16 状态机（marching/sieging/assaulting/garrison 转换）· §16.5 劝降 · §16.6 强攻 · §17 自动战斗算法（战力公式+多回合推演+单挑事件+伤亡判定+郡国归属）· §17.5 AutoBattleResult 完整结构 · §16.7 战后结算（占城/武将迁移/势力重算/清反间/抢美女）。8 API 端点 + CampaignPanel UI + verify-campaign 57/57 + dev 实操全流程（编成→行军→围城→激励→造冲车→强攻→占城+单挑触发）。**简化标注**：设施即时建造、单挑快速判定、阵型联动=0、总军师态势未接入公式、AI Army 后置。
- **Session 100（技术储备，未实装）**：**前端体验 + 三级战斗串联 + 单挑演出 + 武将特殊造型 + 内政外交增强 + PCG 程序化美术 + 计谋三级联动视觉** 七大方案设计完成。新增 **S20 前端体验**（W1~W4 + 内政外交增强）+ **S21 三级战斗串联**（W6~W9）两大系统（19→21）。**零新依赖**原则：React+Konva+Zustand+Tailwind+原生 WebSocket+原生 Web Audio API 覆盖 90% 需求，不引 framer-motion/gsap/PixiJS/D3/G6/howler.js。**DuelStage 混合范式**：静态元素 react-konva 声明式 + 动效 Konva.Animation + layer.getContext() 命令式（用户 demo 95% 可搬）。**HeroCharacter 特殊造型**：appearance 字段落库（scale/auraColor/weaponLength/shadingMode/pheasantPlume/mount/ghostForm），吕布鬼神降临前端自管 rage 触发，Verlet 雉翎 + 烈焰足粒子 + 帧缓存残影 + Canvas 2D filter 气劲。**计谋三级联动**：服务端计谋状态驱动（BattleState.activeStrategem），火计/水攻/伏兵三种 PCG 视觉算法，模块级 frameCount 共享帧。登记 0-B 前置技术债 D-0B-1~12。两个外部参考 demo（map_battleground_procedural_engine*.html）加入 .gitignore 不入库。
- **Session 101（美术版权铁律入最高准则，未实装）**：**美术基调·金石水墨免版权** 升级为最高开发准则。`AGENTS.md` 核心规则新增第 9 条「美术版权铁律」+ `00-dev-constitution.md` 新增§十一（公有领域基调/三方案/字体白名单/禁止清单/史料免责/头像落库）。新增 **S22 美术基调·金石水墨免版权** 大系统（21→22）。**武将头像组合方案 A+C+B**：A 拓片印章（底图层·公有领域汉代拓片 20~30 张+宣纸+朱砂印）+ C 程序化拼图（五官层·5×10×10×10 哈希派生+重点手工指定）+ B 官职印信简册（文字层·氏族/官职篆印+汉制印绶紫青墨黄）。`officers.json` 新增 `avatarGene` 字段（与 Session 100 `appearance` 战斗造型字段并存职责分离）。字体白名单（当时设计：系统 SimSun/STKaiti + 开源思源宋体/字魂织造书体，禁方正/汉仪）。登记技术债 D-0B-13（UI 字体扫描留 P5-07）。零代码改动，方案文档化。**【Session 102 修正】**：字体白名单升级为"工程资产闭环"，不再依赖宿主系统字体（SimSun/STKaiti/字魂织造书体在 Linux 极简发行版不存在 → 豆腐块），改用 woff2 本地打包 + `@font-face` 工程内部别名 `HanDynastySerif`/`HanDynastySeal`（思源宋体 SC + 马善政体，均 SIL OFL 1.1）。D-0B-13 已实装，剩余 P5-07a~e。
- **Session 102（跨平台字体防御实装，S22 首批代码）**：**跨平台字体防御三件套**实装，S22 从 D→S/D（壳+部分实装）。**资产闭环**：`client/public/fonts/` + `client/src/styles/fonts.css` @font-face 声明工程内部别名 `HanDynastySerif`（思源宋体 SC，SIL OFL 1.1）/ `HanDynastySeal`（马善政体 Ma Shan Zheng，SIL OFL 1.1，替代原计划沐瑶软笔体——未找到可确认授权稳定 woff2 源），`font-display: block`，**3 个 woff2 文件已实际下载就位共 ~7MB**（不入 git 由 `.gitignore` 排除）。**Canvas 屏障**：`client/src/utils/fontBarrier.ts` `waitForGameFonts()` + `App.tsx` `isEngineReady` 屏障，字体未加载完拒绝渲染 Konva Stage，防 Linux 极简发行版豆腐块。**Konva `<Text>` 全部补 `fontFamily`**：MapCanvas 4 处 + BattleView 1 处。**工程规范**：`.editorconfig` UTF-8 LF + `.gitattributes` `eol=lf`/`*.woff2 binary` + `.github/workflows/ci.yml` CI 编码门禁 + `CONTRIBUTING.md` 跨平台字体铁律条款。**文档**：`00` §11.3 字体白名单升级为工程资产闭环 + §11.7 跨平台字体防御与 Linux 适配新增；`AGENTS` 核心规则 9 扩展；`15-linux-ui-spec.md` 新建；`09-roadmap` P5-07a~e 子任务拆分。**验证**：typecheck/lint/test 68/validate-data 全过 + dev server 实测 woff2 HTTP 200 OK。Linux UI 适配（HiDPI/XDG/伪 Terminal/金石组件库）+ 开源筑巢（武将传记拆分/README 工程师段）留 P5-07a~e。

- **Session 105（大地图命令 UI 技术储备，未实装）**：S20 新增九类固定命令坞（内政/军事/人事/外交/计略/情报/屯田/家族/朝廷）+ 侧边参数抽屉 + 居中终审询问窗；所有状态变更命令确认后才提交，取消保留参数；`进行`采用加强版结束本季检查。文教/声教/学派/技艺术语与归属收敛，瓮城只预留状态不定义战斗数值，S16 存档继续标设计中。纯文档，零运行时代码。
- **Session 106/109（S14/S16 190历史切片）**：保留英雄集结并新增《关东义兵》四势力技术切片；场景级势力/角色/子女/事件白名单、史源分层、年月窗口、前置/前序选择/互斥/失效、玩家/AI性格理想权重、ScenarioSelect与传奇开关已实装。24事件=5条叙事线+玩家抉择系统；专用验证32项+HTTP+浏览器流程通过。约30势力全量开局、真正无城/寄驻/从属军仍未做。
**S10 描述更新**：
```
S10 | 战斗 | **M+/战役实装** | hex 战术设计保留 | 
战役层: 30节点地图 · Army · 总军师 · 设施/机关 · 自动战斗算法 (引擎最小切片已实装)
(05 §十二~十八 · 04 §三十六/三十七 · 03 §二十)
```

- **原则**：武将水军适性≥C；NONE 仅文官。  
- **下一优先**：总军师系统实装（任命/态势切换/献策/对决）→ 设施建造回合化（大型器械消耗完整回合）→ 势力特点数据实装 → AI Army 接入 → 战役 UI 扩展（行军箭头/围城视觉）。**前端体验增强（S20/S21）为技术储备方案，实装时机后续排定**。
- 暂缓 0-B · 连携 · 造船。战术层（hex battle）设计保留，代码存续。

### 六、0-B 前置技术债（D-0B-1~13）

> Session 100 技术储备 + Session 101 美术铁律登记，0-B 扩容前必须先清。

| ID | 债务 | 触发时机 |
|:--:|------|------|
| D-0B-1 | Zustand store 拆 slice（cities/officers/factions/intel 独立）+ 局部 patch + 细粒度 selector | 0-B 扩容前 |
| D-0B-2 | LOD 拖拽冻结（debounce / 拖拽中复用上一次 layout） | 0-B 扩容前 |
| D-0B-3 | TopBar/RightPanel/LeftPanel 内联遍历加 useMemo | 0-B 扩容前 |
| D-0B-4 | viewport culling（屏外城点不画） | 500+ 城时 |
| D-0B-5 | 矢量州界 path + LOD 简化（strategic 粗 / local 细） | 0-B 引入州界时 |
| D-0B-6 | screen 状态机栈式管理 + 切入切出动画时序 | 0-B 扩容前 |
| D-0B-7 | officers.json `appearance` + `avatarGene` 字段 0-B 全量武将填写 + uniqueSkill 落库后从 uniqueSkill 派生 auraColor + avatarGene 按 officer.id 哈希派生 faceType/hairType/beardType/eyeType + 重点人物人工校对 sealText/clanTitle/officeSeal/ribbonColor | 0-B 扩容前 |
| D-0B-8 | 吕布服务端无双乱舞范围攻击 + 心理震慑 debuff + 鬼神数值效果（防御翻倍+吸血） | S10 战斗深化时 |
| D-0B-9 | §35 财政税收俸禄数据模型扩展（Faction 加 coinQuality/salaryArrears，City 加 taxRate，turn.ts 改产金公式，新建俸禄引擎） | 独立 Session |
| D-0B-10 | PCG 水墨底图若 0-B 要替换 geo-basemap.png，需重做 MapCanvas 底图层 + 算法参数调优 | 0-B 视觉升级时（可选） |
| D-0B-11 | BattleState.activeStrategem 字段 + 服务端火计引擎设置该字段 | S20/S21 实装时 |
| D-0B-12 | S17 L2 水攻/伏兵服务端引擎实装（plot.ts 扩展） | S17 L2 实装时 |
| D-0B-13 | ✅ Session 102 已实装：字体白名单升级为"工程资产闭环"——`@font-face` 工程内部别名 `HanDynastySerif`/`HanDynastySeal` + woff2 本地打包 + FontBarrier + .editorconfig/.gitattributes/CI 编码门禁。**剩余 P5-07a~e**：HiDPI / XDG 存档 / 伪 Terminal 战报 / 金石组件库 / 字重扩展。详见 `00-dev-constitution.md` §11.3+§11.7 | P5-07 剩余 UI 适配 |

---

*v5.0 | Session 117（文档漂移校正：当前199名武将、190共24事件、爵位7级）*
