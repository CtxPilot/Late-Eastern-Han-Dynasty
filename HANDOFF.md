# HANDOFF — 会话交接

> **接手必读**：本文件 + `docs/10-progress.md` + `docs/12-system-map.md`  
> 勿从聊天历史推断。数字真源：`docs/08-data-dictionary.md`。

---

## 1. 现在在哪

| 项 | 状态 |
|----|------|
| 会话 | **Session 103 完成**（CI typecheck 修复：shared 新环境下类型解析失败） |
| 阶段 | Phase 0-A + Demo 玩法环；**暂缓 0-B**；系统数 **22 大** |
| 代码最新 | **9 兵种** + 全战法数据 + **战法/单挑/暴击反击连击引擎** + **战役层引擎** + **跨平台字体防御三件套**（@font-face + FontBarrier + Konva fontFamily + .editorconfig/.gitattributes/CI）；包 scope `@leh/` |
| 文档最新 | 本文件 · 10-progress 103 · 12-system-map v4.4 · AGENTS 核心规则 9 · 00 §11.3+§11.7 · 15-linux-ui-spec · 09 P5-07a~e |
| 本交接用途 | 跨平台字体防御硬基建闭环；下一优先仍为总军师系统实装 |
| 玩法下一步 | **总军师系统**（任命/态势/献策/对决） → 设施建造回合化 → 势力特点数据 → AI Army 接入。**S22 Linux UI 适配（HiDPI/XDG/伪 Terminal/金石组件库）+ 开源筑巢（武将传记拆分/README 工程师段）留 P5-07a~e；S22 武将头像 A+C+B 留 P5-10a/b/c（Phase 5）** |

---

## 2. 怎么跑

```bash
pnpm --filter @leh/shared build && pnpm dev
# 服务 :3001  前端 :5173（代理 /api；端口占用时可能 5175）
# 数据校验: pnpm validate-data   # units 期望 9
# 单元测试: pnpm test
```

开局默认刘备军（`playerFactionId=2`，成都 id=19）。硬刷新 `Ctrl+Shift+R`。

结构：`shared/` · `server/` · `client/`（pnpm workspace）  
人类贡献指南：`CONTRIBUTING.md`

---

## 3. 已交付能力总表

| ID | 系统 | 成熟度 | 代码/要点 |
|:--:|------|:------:|-----------|
| S01 | 回合 | M+ | `turn.ts`；全势力金粮同步 |
| S02 | 地图 | M | Natural Earth；官道；LOD |
| S03 | 内政 | M | 农/商/城、征兵、训练、施米 |
| S04 | 人口经济 | M | 四桶 demographics + 粮耗 |
| S05 | 军事 | M+ | 邻接出征→战→占城；多主将迁移 |
| S06 | 迷雾 | **M+** | UI + 服务端 `maskGameStateForPlayer` |
| S07 | 谍报 | M+ | 女间谍 / 献美点化 |
| S08 | 外交 | M+ | 进贡/结盟/献美 |
| S09 | 美女资源 | M | stock；**非历史女** |
| S10 | 战斗 | **M+/战役实装** | **2026-07-17：战役层引擎最小切片**。战役层：30节点·Army编成(主将+副将+参谋+Squad五部)·行军(BFS+补给)·自动战斗算法(战力公式+多回合推演+单挑事件+伤亡判定)·围城/劝降/强攻/战后占城·CampaignPanel UI。战术层（hex战斗）设计保留，代码存续 |
| S11 | 人事 | **M+** | 搜索/登用 + 任命三轨 |
| S12 | 官职功绩体力 | **S/M** | 精简任命；meritLevel 未实现；体力完整 |
| S13 | 宝物 | S | 薄 |
| S14 | 事件 | **M+** | tickEvents + EventDialog |
| S15 | AI | M+ | 内政占位 + 出征占城 |
| S16 | 存档 | D | 无 SQLite |
| S17 | 计谋 | **S/M+** | **三层体系设计完成**：L1 美人计/离间/假情报/空城 ✅ · L2 釜底抽薪/调虎离山/暗渡陈仓等 11 计 · L3 以逸待劳/远交近攻等 8 国策 · 行政↔战场联动总表；文档 §31 全量重写；战役层自动战斗算法已预留 S17 计谋修正项 |
| S18 | 家族 | **M+** | 婚配/跟随/子女引擎 ✅；父辈/族谱 ❌ |
| S19 | **单挑大会** | **D** | §8.17 独立锦标赛：赛制/押注/称号/叙事/数据结构设计完成，引擎待实现 |
| S20 | **前端体验** | **D** | Session 100 技术储备方案设计完成（零代码）：W1 endTurn WS 接入+overlay · W2 数字跳动+EventLog 流化 · W3 凸包涂色+FogLayer+tween+PCG 水墨地形 · W4 派系面板+OfficerDetail+内政外交增强（己方武将列表/忠诚度警报/外交雷达 SVG/财政飘字/行政总署三段式）。零新依赖（React+Konva+Zustand+Tailwind+原生 WS+原生 Web Audio 覆盖 90%） |
| S21 | **三级战斗串联** | **D** | Session 100 技术储备方案设计完成（零代码）：W6 一级大地图演出（军旗 Tween+烽火+攻城弹窗，复用 campaign.ts）· W7 二级战术串联（screen 六态栈+切入渐变+棋子滑行+hex 悬停情报+邻接触发三级）· W8 三级白刃战 MeleeStage（Konva 方阵 30-50 图元+动态缩放+纯战略指令+镜头推进切入+Soldier 类移植）· W9 单挑接入（DuelStage 混合范式）。screen 扩展为六态栈 |
| S22 | **美术基调·金石水墨免版权** | **S/D** | Session 101 美术版权铁律入最高准则（零代码）+ Session 102 跨平台字体防御实装（首批代码）。基调「金石水墨·拓片简册·印信官职」三件套，公有领域唯一。**武将头像组合方案 A+C+B**（P5-10a/b/c）：A 拓片印章（底图层·20~30 张公有领域拓片+宣纸+朱砂姓名印）+ C 程序化拼图（五官层·5×10×10×10 哈希派生+重点手工指定）+ B 官职印信简册（文字层·氏族/官职篆印+汉制印绶紫青墨黄）。`officers.json` 新增 `avatarGene` 字段（与 Session 100 `appearance` 战斗造型字段并存职责分离）。**Session 102 已实装**：跨平台字体防御三件套——资产闭环 `@font-face` 工程内部别名 `HanDynastySerif`/`HanDynastySeal`（思源宋体 SC + 沐瑶软笔体，woff2 不入 git）+ Canvas 屏障 `fontBarrier.ts` + `App.tsx` `isEngineReady` + Konva `<Text>` 全部补 `fontFamily` + `.editorconfig`/`.gitattributes`/CI 编码门禁 + `CONTRIBUTING.md` 字体铁律条款。**留 P5-07a~e**：HiDPI / XDG 存档 / 伪 Terminal 文言战报 / 金石黑框组件库 / 字体补完。详见 `00-dev-constitution.md` §11.3+§11.7、`07-ui-design.md` §11.6、`15-linux-ui-spec.md`、`AGENTS.md` 核心规则 9 |

### 关键路径

- 内政 · 出征占城 · 火计（气力≥30）· **战法施放（气力≥energyCost）** · **单挑（气力≥20+相邻·全自动结算）** · **暴击/反击/连击（攻击自动触发）** · 任命 · 家族子女 · EventDialog  
- **战役层**：编成出征（主将+副将+参谋+Squad）→ 行军（BFS 路径+补给消耗）→ 围城/野战 → 劝降/强攻（自动战斗算法）→ 占城/残兵回流  
- `pnpm test`（68）· `pnpm validate-data` · `tsx src/scripts/verify-duel.ts`（单挑冒烟）· `tsx src/scripts/verify-crit.ts`（暴击/反击/连击冒烟）· **`tsx src/scripts/verify-campaign.ts`（战役层 57 断言）**
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
| 100 | **前端体验技术储备**（S20 前端体验 + S21 三级战斗串联 七大方案设计，零代码改动，方案文档化。新增 S20/S21 两大系统 19→21，登记 D-0B-1~12 技术债。零新依赖原则：React+Konva+Zustand+Tailwind+原生 WS+原生 Web Audio 覆盖 90%。DuelStage 混合范式 + HeroCharacter 特殊造型 + 吕布鬼神降临 + PCG 程序化美术 + 计谋三级联动视觉） |
| 101 | **美术版权铁律入最高准则**（S22 美术基调·金石水墨免版权，零代码改动，方案文档化。`AGENTS.md` 核心规则新增第 9 条 + `00-dev-constitution.md` 新增§十一。新增 S22 大系统 21→22。武将头像组合方案 A+C+B：A 拓片印章底图 + C 程序化拼图五官 + B 官职印信简册文字。`officers.json` 新增 `avatarGene` 字段（与 Session 100 `appearance` 并存职责分离）。字体白名单（系统+开源，禁方正/汉仪，D-0B-13）。P5-10 改述。实装拆 3 子 Session P5-10a/b/c，Phase 5 排定） |
| 102 | **跨平台字体防御实装 + bug 修复**（S22 首批代码 + 工程规范硬基建，零游戏逻辑改动。资产闭环：`client/public/fonts/` **3 个 woff2 文件已实际下载就位**（思源宋体 SC Regular/Bold + 马善政体 Ma Shan Zheng，均 SIL OFL 1.1，共 ~7MB，沐瑶软笔体无稳定授权源改用马善政体） + `styles/fonts.css` @font-face 工程内部别名 `HanDynastySerif`/`HanDynastySeal` + `font-display: block` + tailwind 注册 + .gitignore 排除 woff2。Canvas 屏障：`utils/fontBarrier.ts` `waitForGameFonts()` + 4s 超时兜底（防 woff2 缺失永久卡死）+ `App.tsx` `isEngineReady` 屏障 + 失败重试按钮。Konva `<Text>` 全部补 `fontFamily`：MapCanvas 4 处 + BattleView 1 处。工程规范：`.editorconfig` UTF-8 LF + `.gitattributes` `eol=lf`/`*.woff2 binary` + `.github/workflows/ci.yml` 编码门禁 + `CONTRIBUTING.md` 字体铁律条款。文档：00 §11.3 升级+§11.7 新增 + AGENTS 核心规则 9 扩展 + `15-linux-ui-spec.md` 新建 + 09 P5-07a~e + 12 v4.4 + README systems-22 + 文档冲突修正。**bug 修复**：fontBarrier 超时兜底 / index.css @import 规范化（改内联 @font-face）/ FontBarrier 失败重试按钮。验证 typecheck/lint/test 68/validate-data 全过。Linux UI 适配 + 开源筑巢留 P5-07a~e） |
| 103 | **CI typecheck 修复**（全新环境 `pnpm install` → `pnpm -r typecheck` 时 server 找不到 `@leh/shared` 类型。根因：shared 的 `exports.types` 指向 `dist/`，CI 无 dist；shared typecheck 用 `--noEmit` 不生成 dist。修复：shared 的 typecheck/lint 脚本去掉 `--noEmit`，使底层包 emit 出 `.d.ts` 供下游解析。模拟 CI 验证全过） |
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
| 87 | **合规完成**（SPDX头98文件+许可证+免责声明+CREDITS+历史清洗+RTK5零残留） |
| 86 | **git 历史重写**（filter-branch 清洗 Google截图+RTK5 blob+commit message） |
| 85 | **全库版权排查**（RTK5 47处替换+CREDITS+截图清理+商标清除） |
| 83 | **部队组织大系统**（经验Lv1-7+组织度+士气深化+部曲12将+军屯田+家属质任+民屯田9维） |
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

**注意**：`generate-0a-data.ts` 重跑会抹掉 units 战法与水军——勿盲写。

---

## 6. 未做 / 债

| 项 | 说明 |
|----|------|
| 总军师系统 | 数据结构已就绪（GrandStrategist），任命/态势/献策/对决逻辑后置 |
| 战役层单挑演出 | 单挑事件快速判定，未复用 duel.ts 完整演出 |
| 战役层设施回合化 | 大型器械即时建造简化，"消耗完整回合"约束后置 |
| AI Army | 当前仅玩家 Army，AI 军事仍走旧 aiMilitary.ts |
| 势力特点数据 | 12 势力完整 JSON 未入库 |
| 参谋/副参谋引擎（战术层编成） | 文档设计完成(Session 93)，代码未实现 |
| 爵位编成加成逻辑 | 文档设计完成(Session 93)，NobilityRank 枚举待同步代码 |
| 水域移动（仅三级水军可进水） | 数据 terrain-99；引擎未接 |
| 造船 / 港口行军 | 0-B |
| 连携 | 仅 coopAllowed |
| 战法 UI 选层 | 当前自动选最高可用层 |
| 战法 AI 施放 | AI 不施放战法 |
| 单挑 / 余 14 计策 | 未做 |
| meritLevel 运行时 | stamina 临时用 merit |
| S18 父辈/族谱 | 子女已做 |
| 0-B 全量 | **暂缓** |
| 存档 SQLite | 未做 |
| **S20 前端体验** | Session 100 技术储备方案完成，实装拆 4 Session（S100~S103），时机后续排定 |
| **S21 三级战斗串联** | Session 100 技术储备方案完成，实装拆 4 Session（S104~S107），时机后续排定 |
| **S22 美术基调·金石水墨免版权** | Session 101 最高准则固化 + 方案设计完成，实装拆 3 子 Session（P5-10a/b/c，Phase 5 排定） |
| **D-0B-1~13 技术债** | 0-B 扩容前必须先清（store 拆分/LOD 拖拽冻结/useMemo/viewport culling/矢量州界/screen 状态机/appearance+avatarGene 全量填写/吕布服务端无双/§35 财政俸禄/PCG 底图替换/activeStrategem 字段/S17 L2 水攻伏兵引擎/UI 字体白名单扫描） |

---

## 7. 文档地图

| 文件 | 角色 |
|------|------|
| `HANDOFF.md` | 本文件 |
| `docs/10-progress.md` | 任务表 + 会话日志 |
| `docs/12-system-map.md` | **22 系统**（v4.3：新增 S22 美术基调·金石水墨免版权 + D-0B-13 字体白名单） |
| `docs/02-architecture.md` | **v2.0** 架构总图 + 20引擎 + 5战斗子模块 + 数据流 + shared工具链（Session 75 全面重写） |
| `docs/05-combat-system.md` | §5.4 战法+三级水军 · §5.5 **主副将与参谋编成**+爵位加成 · §七 计策 · §6 暴击反击连击(战场) · §8 单挑经典化设计(§8.1~8.16 核心三角+叙事+**宿命对决详表**) |
| `docs/00-dev-constitution.md` | 开发总则（**v1.6 §十一 美术与版权铁律**） |
| `docs/08-data-dictionary.md` | **规模真源**（0-A units=9；officers `appearance` + `avatarGene` 字段） |
| `docs/11-context-management.md` | 适性 S~NONE 系数 |
| `docs/04-game-systems.md` | 规则大全 |
| `docs/06-api-design.md` | 含 `/battle/fire` + `/battle/ability` |
| `docs/07-ui-design.md` | UI 设计（**v2.8 §11.6 武将头像三方案 A+C+B**） |
| `docs/15-linux-ui-spec.md` | **v1.0** Linux UI 与跨平台字体规范（Session 102 新建） |
| `AGENTS.md` | 0-A：30城/9兵种…；**核心规则 9 美术版权铁律 + 跨平台字体防御三件套** |

---

## 8. Next（给下一模型）

| 优先级 | 事项 |
|:------:|------|
| **1** | **总军师系统实装**（任命/解职/态势切换/献策/对决 — 数据结构已就绪 `GrandStrategist`，逻辑后置） |
| 2 | 设施建造回合化（大型器械消耗完整回合，§15.2 混合建造模型） |
| 3 | 势力特点数据实装（12势力完整 JSON + FactionTrait Zod 校验 + 接入自动战斗公式 stratagemMod） |
| 4 | AI Army 接入（AI 编成/行军/自动战斗，替代旧 aiMilitary.ts 出征占城） |
| 5 | 战役 UI 扩展（行军箭头/围城视觉/总军师面板/势力特点展示） |
| 后置 | **S20 前端体验实装**（S100~S103，时机后续排定）· **S21 三级战斗串联实装**（S104~S107，时机后续排定）· **0-B 前置技术债 D-0B-1~12 清理** · 单挑事件接入 duel.ts 完整演出 · 兵种战法接入战役层 · 数字平衡调整 · 战术层（可选hex） · S17 计谋接入战役层 · 0-B · 存档 |

**规则**：改 `10-progress` 必同步 `HANDOFF`；规模数字先改 `08`；破坏性操作先确认；**勿 0-B**。

---

*Session 103 交接 | 2026-07-19 | CI typecheck 修复：shared/package.json typecheck/lint 去掉 --noEmit 使底层包 emit 出 dist 供上游类型解析 | 用途：总军师系统实装*
