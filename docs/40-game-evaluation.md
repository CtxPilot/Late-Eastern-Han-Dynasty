# 全项目评估与修改意见（可玩性 × 开发难度）

> **地位**：Session 406 全项目体检报告。以「游戏可玩性」与「开发难易度」双轴评估整个项目，
> 给出按 ROI 排序的修改意见。评估方法：三路代码/文档实勘（系统清单与状态、玩家体验链路、
> 引擎深度与工程风险）+ 承重结论逐条代码核实。所有 file:line 均为实勘证据。
>
> **战略拍板（2026-08-28）**：**先好玩再做大**——0-B 数据扩容继续暂缓，先落体验修补与
> AI 对手可信化，经一轮「乐趣实测」确认好玩后再授权 0-B。
>
> 美术专项另见 `design/ArtDirection.md` §九 执行手册（Session 405，程序化美术六批次路线）。

---

## 一、总评

**一句话**：这是一个「高纪律、高耦合、低弹性」的工程骨架，装载了一套「宽而浅、有骨架缺灵魂」
的玩法系统——403+ 个 Session 全部在**加宽系统**，还没有一个环节验证过**「一局是否好玩」**。

### 可玩性评分

| 维度 | 评分 | 依据 |
|---|---|---|
| 核心循环完整度 | 6.5/10 | 内政→出征→战斗→回合闭环在线+离线全通；114 个接口离线可玩（Session 376 收口）+ PWA 冷启动（373），同类项目罕见亮点 |
| 对手压力（AI） | 3/10 | 内政 AI 是占位（`server/src/engine/ai.ts:5` 自注 P1-09 占位；`turn.ts:433` 写死 `type:'ai_placeholder'`）；军事 AI 阈值化（`aiMilitary.ts:28-36` 出征≥3500/双线上限2/撤退0.55，无目标评估）；六角 AI 885 行无前瞻且全知（`server/src/battle/simpleAi.ts`） |
| 目标与戏剧性 | 4/10 | **无战役级胜负条件**（全引擎仅单场战斗 victory/defeat，如 `meleeRound.ts:271-280`；势力灭亡只作前置校验；`hegemony.ts` 称王链存在但无终局）。单挑/比武大会/15 计策是现成戏剧性资产，但未串成「霸业叙事」 |
| 反馈与节奏 | 4.5/10 | 无月度报告；TurnProgressOverlay 仅存在于设计稿（`07:825-831`）未实装；月结结果散落 actionLog；错误提示持久不消失（`TopBar.tsx:129`、`RightPanel.tsx:256-260`） |
| 上手引导 | 2.5/10 | 零教程（全库 tutorial/新手/引导 零命中）；10 域抽屉×3~5 分面≈30+ 子页签；程序员文案泄漏（`StrategicWorldView.tsx:83`、`CommandDock.tsx:75-83`、`App.tsx:58`）；右上调试跳关按钮裸露（`App.tsx:72-75`） |
| 内容量 | 5/10 | 郡域 6 模板 98 县/151 路（`12-system-map.md` S02）、190 年 24 事件、武将基线 30 |
| **可玩性综合** | **4.5/10** | 系统密度已是商业 Demo 级，「好玩密度」不足 |

### 工程评分

| 维度 | 评分 | 依据 |
|---|---|---|
| 架构分层纪律 | 8.5/10 | shared 纯函数真源 + Zod Strict + 权威 RNG 可回放 + 双端同源离线 Worker |
| 测试纪律 | 9/10 | shared **48 文件 501 用例**；verify 脚本约 **160** 个（scripts/ 67 + server/src/scripts 95）；server 自身 0 单测（靠 verify 补位） |
| 变更成本 | 4/10 | 一个接口要改 5 处（`api.ts`→`routes/game.ts`→`services/game.ts`→`game.worker.ts` 镜像→`gameStore.ts` 69 处 `set({game})`）；新增 GameState 字段联动 7 域 Schema+`ROOT_KEYS`+8 个存档 verify |
| 规模弹性 | 3/10 | 月结 O(N) 全量拷贝（`turn.ts:354-385`）、全量 JSON 快照 2MB 上限（`save-limits.ts:22`）、客户端每 action 全量 `set({game})`、Konva 300 六角单层无缓存（`BattleView.tsx:63`） |
| **工程综合** | **6/10** | 适合继续 0-A 收口，**不适合直接 0-B 扩容** |

---

## 二、可玩性诊断：四大症结

### 症结 1 · 没有「为什么而战」（最高杠杆）

无胜利/失败条件、无中期目标、无年终局势反馈。玩家做完内政打完仗，没有「离霸业还有多远」
的读数。现有可挂载资产：S26 天命/人心（`hegemony.ts` 称王链）、S01 回合、城池计数。
把系统堆叠变成游戏的第一步，就是定义「霸业目标 + 失败条件 + 局势简报」。

### 症结 2 · 对手不存在感

AI 三层都是「规则执行器」而非「对手」：经济 AI 空转意味着玩家的内政优势是免费的；
军事 AI 阈值化意味着威胁可预测、无博弈；六角 AI 全知且无前瞻意味着战术胜利靠规则而非智力。

### 症结 3 · 反馈断层

玩家每月做 5~8 个操作后，月结发生了什么（收支、AI 动向、事件后果）只散落在 actionLog
一行行文字里；无「月报/年报」聚合视图；回合结算期间无过程反馈。

### 症结 4 · 上手陡峭 + 程序员痕迹

第一局 10 分钟要自己摸出「点城→开抽屉→终审→结束回合」（唯一引导是 `LeftPanel.tsx:52-58`
一句话）。开发态残留直接面向玩家：调试跳关按钮（`App.tsx:72-75`）、`pnpm dev / ?offline=1`
报错文案（`App.tsx:58`）、「不再使用连续疆域大地图」（`StrategicWorldView.tsx:83`）、
命令坞灰色占位（`CommandDock.tsx:75-83`）。
另有实现层风险：江陵攻打硬编码（`gameStore.ts:299-306` 借 `marchOnCity` 固定 cityId=14/5000 兵）、
未选人时静默回退 `officers[0]`（`gameStore.ts:526,589`，易误耗每月 1 次行动）。

### 必须保住的亮点

命令坞「唯一入口」聚合设计、离线 PWA 可玩、三层战斗+阵前单挑+比武大会的戏剧性资产、
权威 RNG 确定性回放、~160 个 verify 验收脚本纪律。

---

## 三、开发难度诊断

### 资产

- RNG 消费序即契约 + 10 个 `verify-*-rng` 守护（`shared/runtime-rng.ts` 单例入存档）；
- Zod Strict Schema 兼容链（`game-state-full-schema.ts:17-20` ROOT_KEYS）；
- ~160 个确定性验收脚本（含浏览器真实点击全链）。

### 负债（后续开发最易踩坑 top5）

1. **五处一改同步**：漏改 worker 即「离线版暂未实装指令」（`game.worker.ts:1959`；自注镜像说明 `:5-9`）；
2. **worker 跨包 import server 源码**（`game.worker.ts:85-179`）+ Vite 插件重定向 data loader，目录结构变动即碎；
3. **Strict Schema**：AI 临时字段泄漏会导致存档恢复被拒（`turn.ts:292-295` 自注警告）；
4. **月结 15+ tick 顺序硬编码且互相依赖**（`turn.ts:222-439`），子系统改序即回归；
5. **双位置真源**：`nodeStates[].armyIds` 与 `dynamicSituation.deployments` 手工同步（`turn.ts:503`）。

### 0-B（105 郡国 / 1000+ 武将）硬前置

| 缺口 | 现状证据 | 所需改造 |
|---|---|---|
| 状态增量化 | `turn.ts:354-385` officers/factions 整体 spread；`gameStore.ts` 69 处全量 `set({game})` | store slice + 局部 patch + selector（D-0B-1/3） |
| 存档瘦身 | 全量 JSON 快照 + 2MB 上限（`save-limits.ts:22`）；1000 将必爆 | 字段裁剪/引用化/分片，双端介质同步 |
| UI 增量化 | OfficerDetail/名册无虚拟化；Konva 无缓存层 | 列表虚拟化 + Konva Layer 缓存（D-0B-2/4） |
| AI 月扫剪枝 | `tickSameCityRelations` 同城配对潜在 O(N²) | 分批/剪枝 |
| 军团层 | 无委任军团系统（全库仅单挑倾向同名 `delegate`）；`aiMilitary.ts:28-36` 写死 maxActiveFronts:2 | ✅ Session 419 规格落盘 `docs/42`；**Session 420 S1 实装**（D1 军上限公式替代硬编码 + 委任区 CRUD×4 端点五镜像 + 军团域 UI）；委任内政/军事 AI（S2/S3）待实装 |

郡域数据侧（seed builder/年代覆写/迷雾机制）已就绪，瓶颈是 ~105 郡史料录入量而非代码。

---

## 四、修改意见（按 可玩性ROI ÷ 开发难度 排序）

### P0 体验速赢（难度低~中，合计约 5~7 Session）

> **执行状态（Session 407）**：P0-1/P0-2/P0-3/P0-4/P0-6 ✅ 已实装（验收 `pnpm verify-s407-playability-art` **22/22** + 回归 `verify-s379` 21/21 + client 66/66）；P0-5 ✅ 于 Session 406 完成。P1 起按批次另行立项。

| # | 项 | 难度 | 说明 |
|---|---|---|---|
| P0-1 | **战役目标 0-A 版**：霸业进度（占城数/天命/称王链）+ 失败条件（君主亡且无继承）+ 年终局势简报 | 中 | 可玩性第一杠杆；服务端只读聚合 + 客户端面板，不动存档结构 |
| P0-2 | 新手首小时引导：首回合任务清单（选城→内政→出征→结束回合），高亮式非弹窗式 | 低 | 纯客户端 |
| P0-3 | 回合结算反馈：TurnProgressOverlay 实装 + 月度收支/AI 动向摘要卡 | 低中 | 复用 actionLog 聚合 |
| P0-4 | 程序员痕迹清理：调试按钮折叠「开发工具」、文案中性化、错误 toast 化自动消失、officers[0] 静默回退改显式报错 | 低 | 纯客户端 |
| P0-5 | 文档体检（本轮已执行，见 §五） | 低 | — |
| P0-6 | **建立「乐趣实测」制度**：完整自玩 10 年（120 回合）记录无聊点清单，作为后续批次输入 | 低 | 产品视角最便宜的一手数据 |

### P1 对手可信化（难度中，约 5~8 Session）

> **执行状态（Session 408）**：P1-1 ✅ 已实装（`engine/ai.ts` 三规则启发式：缺粮屯田/低金经商/低民心巡安+条件征兵，零 RNG；日志类型 `ai_placeholder`→`ai_civil`；验收 `verify-ai-decision-plot` 4/4、`verify-ai-decision-integration` 4/4、`verify-ai-military-rng` 38/38、`verify-campaign` 71/71）。

- **P1-1** ✅ Session 408 AI 经济三规则启发式（缺粮城开垦/低民心巡查/低金商贸），替换 `ai_placeholder`；
- **P1-2** ✅ Session 410 AI 军事目标评估：`aiMilitary.ts` 评分升级为「孱弱×富庶×城防×威胁响应」（肘腋之患 ×1.5 / 威胁我方他城 ×1.15 / 城防减分 / 金粮加成），危城（邻敌≥我 120%）本月按兵不动（离间强攻除外）；零新增 RNG，`verify-ai-military-rng` 38/38、`verify-campaign` 71/71、AI 决策重放 4/4×2；
- **P1-3** ✅ Session 411 手动战斗激励差：六角微操结算纯函数 `settleTacticalMeleeTroops`（engine/battle.ts，双镜像同源）——攻方胜利伤兵归队 15%（确定性零 RNG，撤退 50% 等价不变），与自动战公式伤亡形成真实收益差；**俘获率加成 ✅ Session 418**：`collectAnnihilatedDefenderCommanders` 战场生擒（攻方胜利且守方单位被歼→主将径直 PRISONER，确定性无掷点，绕开新 RNG 消费点约束），services 单点接线 + s411 15/15；专项 `verify-s411-manual-victory-bonus` 15/15、`verify-save-battle` 62/62、`verify-tactical-ai` 86/86、`verify-s374-offline-melee` 44/44；
- **P1-4** ✅ Session 412 六角 AI 半知化：`simpleAi.ts` 目标选择消费 `computeVisibleEnemyUnitIds` 守方视野投影（视野内无目标→待机，零 RNG）；`verify-tactical-ai` 86/86（两处测试布阵按半知语义调整为视野内）、`verify-save-battle` 62/62、`verify-battle-rng` 5/5、s374 44/44。

### P2 0-B 前置基建（难度高，约 6~10 Session；启动 0-B 前必须完成）

- **P2-1** ✅ Session 413 状态增量化（服务端热点）：`turn.ts` 月度军官重置改 copy-on-write（仅 actionsPerMonth/体力实际变化者克隆），`verify-s413-state-cow` 5/5 实测 12 个月身份翻转率 5%（基线 100%）且终态逐字节确定；gameStore 全量 `set({game})` 的根治依赖 worker→client 补丁通道，与 P2-4 协议/生成化改造合并推进（D-0B-1 客户端部分移入 P2-4 范围）。
- **P2-2** ✅ Session 414 存档瘦身：officers 静态回声键（biography/hidden/unitProficiency/formationMastery/tags/avatarGene/appearance）保存侧剥离、加载侧 `rejoinSaveStaticEchoes` 静态名录回注（单点 `adoptSaveEnvelope`，旧档幂等兼容）；实测 officers 段 **-53%**、1000 武将投影信封 678KB<2MB；顺带修复存量缺陷——v1 爵位迁移表把新七级 `king` 误升格 `emperor`；`verify-s414-save-slim` 7/7、save-slots 10/10、save-battle 62/62、save-game-state 10/10、save-battlefield-instance 101/101、s372 11/11；
- **P2-3** ✅ Session 415 列表虚拟化 + Konva 缓存（D-0B-2/4）：零依赖 `ui/VirtualList`（223~1000 人名册恒挂载视口±overscan 行）+ BattleView 拆「静态地形缓存层（listening=false + cache() 位图化）/动态交互层」（移动高亮改动态层叠加，视觉等价）；回归 s379 21/21、s407 22/22、s374 44/44、client 66/66。
- **P2-4** ✅ Session 416 worker 生成化第一支柱 + 差分补丁垂直切片：①奇偶校验门禁 `verify-s416-worker-parity` 3/3（services 122 导出 ↔ worker 115 handler，77 条改名别名契约 + 服务端专属清单，漂移即红）；②endTurn 差分补丁通道（worker COW 身份差分 `computeGamePatch` → 响应 meta → store `applyGamePatch` 合并，game-patch.test 5/5 往返/引用共享/删除语义断言）；扩展到全部 113 端点与「仅传补丁不传整态」✅ Session 418（RPC 分发单点对 GameState 形响应通用差分 + patchOnly 协议 v2：对局动作不再整态传线；`rejoinSaveStaticEchoes` 式离线 RPC 面 111 名全覆盖入 parity 5/5）。别名契约 AST 自动生成后置（显式 77 条契约已可检测）。

### P2-5 ✅ Session 417 server 单测起步

- `server/vitest.config.ts` + `pnpm --filter @leh/server test`（根 `pnpm test` 三包链）；
- `engine/turn-golden.test.ts`：12 个月金样（逐月指纹+终态摘要哈希，`__fixtures__/turn-golden-12.json` 入库，缺省自举）、双局 24 个月终态确定性、节拍/行动次数重置/actionLog 不变量；
- 顺带修正 shared `save.test.ts` 对旧缺陷（king→emperor）的错误预期并补回归断言。

### P3 战略路线（已拍板「先好玩再做大」）

- 0-B 继续暂缓：P0+P1 落地并经一轮 P0-6 乐趣实测确认好玩后，再授权 0-B
  （届时按 P2 基建 → 数据录入顺序推进）；
- 多军团/委任军团 ✅ Session 419 规格落盘 `docs/42`；Session 420（「继续」视为批准）**S1 实装完成**
  （军上限 D1+委任区 CRUD+UI，验收 s420-crud 36/36 + s420-ui 21/21 + parity 5/5 + 回归矩阵全绿）；
  S2 委任内政 AI / S3 委任军事 AI+季度报告 待后续会话；美术批次①~⑥ ✅（`ArtDirection.md` §九）；
- S02「荆州七郡全量县级录入」属 0-B 规模，随 0-B 一并拍板。

---

## 五、文档体检修正记录（Session 406 已执行）

1. `12-system-map.md` 系统总数口径统一为 **27**（原 L35「28 大系统」、L145「共 25 系统」两处旧口径）；
2. `09-roadmap.md` 0-A 验收口径更新：「能渲染地图」→「世界屏层级卡片可渲染」（Session 379 已取消大地图）；
3. `09-roadmap.md` 删除重复的 Session 376 条目（原 L30~40 整段出现两次）；
4. `12-system-map.md` D-0B-12 复核注记：全代码 grep 无水攻/伏兵引擎实现，债务仍有效（未勾除）；
5. `12-system-map.md` S15 状态行补「内政 AI 占位为已知最大可玩性缺口」引注；
6. `HANDOFF.md` §6.6 清出旧版残留（L1349~1405：过期文档状态行与 Session 126/239/246~248 孤段）。

---

*文档版本: v1.2 | 2026-08-28 Session 406 评估建立；2026-08-29 Session 407~417 增补 P0/P1/P2 各批次执行状态标注（P0/P1/P2-1~4 已实施，P2-5 单测起步完成）*
