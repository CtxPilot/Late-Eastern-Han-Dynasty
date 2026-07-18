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
| P0A-06 | officers.json（小） | 30武将：15史实精校(曹操/刘备/孙权/诸葛亮/吕布/关羽/张飞/荀彧等) + 15占位 |
| P0A-07 | cities.json（小） | 30城(覆盖13州、含都城级样本) |
| P0A-08 | formations.json（小） | 6阵型 |
| P0A-09 | units.json（小） | 9兵种（6陆+走舸/蒙冲/楼船 Session71） |
| P0A-10 | items.json（小） | 20宝物 |
| P0A-11 | females.json（小） | 10女性 |
| P0A-12 | children.json（小） | 5子女事件 |
| P0A-13 | skills.json（小） | 30通用技能(暂不含专属技) |
| P0A-14 | scenarios.json（小） | 1剧本(覆盖0-A数据集) |
| P0A-15 | events.json（小） | 5历史事件 |

**0-A 验收标准**：Zod 校验全部通过；能渲染地图、能推进至少1回合、能完成1次内政操作、能打通1场最简战斗。

### Phase 0-B — 数据扩容至全量

| ID | 任务 | 产出 | 依赖 |
|:--:|------|------|:--:|
| P0B-06 | officers.json（全量） | 1000+武将 | P0A-06 |
| P0B-07 | cities.json（全量） | 105城(坐标+初始值) | P0A-07 |
| P0B-08 | formations.json（全量） | 18阵型 | P0A-08 |
| P0B-09 | units.json（全量） | 21兵种 | P0A-09 |
| P0B-10 | items.json（全量） | 165宝物 | P0A-10 |
| P0B-11 | females.json（全量） | 90+女性 | P0A-11 |
| P0B-12 | children.json（全量） | 50+子女事件 | P0A-12 |
| P0B-13 | skills.json（全量） | 149技能定义(69通用×5级+80专属) | P0A-13 |
| P0B-14 | scenarios.json（全量） | 5+剧本 | P0A-14 |
| P0B-15 | events.json（全量） | 历史事件全量 | P0A-15 |

**0-B 执行规则**：逐类生成，每类生成后立即跑 Zod 校验，不通过不得进入下一类；
专属技能不可空占位；女性/子女数据须遵守 `00-dev-constitution.md` 第九条历史出处红线。

> 后续 Phase（P1~P5）中原先引用 `P0-06`~`P0-15` 的依赖项，均指向 **P0B-xx**（全量数据就绪）。

### 0-B 前置技术债（D-0B-1~12，Session 100 登记）

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
| P2-06 | RightPanel — OfficerDetail(五维雷达图) | P1-06 |
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
| P5-07e | 工程字体资产闭环补完（woff2 文件入 `client/public/fonts/` + 字重扩展） | P5-07 |
| P5-08 | Canvas 动画(行军/着火/水流/落石) | P1-03, P3-01 |
| P5-09 | 音效系统 | P5-07 |
| P5-10 | 武将头像（**金石水墨·免版权组合方案 A+C+B**，详见 `00-dev-constitution.md` §十一、`07-ui-design.md` §11.6；禁止约稿立绘） | P0-06 |
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

*文档版本: v1.6 | 2026-07-18 | Session 102 跨平台字体防御实装（FontBarrier + @font-face + Konva fontFamily + .editorconfig/.gitattributes/CI）+ P5-07a~e 子任务拆分（Linux UI 适配）*
