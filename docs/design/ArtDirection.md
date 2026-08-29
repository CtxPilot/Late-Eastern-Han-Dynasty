# ArtDirection — 视觉真源（金石水墨）

> **地位**：本文档是游戏全部视觉决策的**唯一真源**。`07-ui-design.md` §一中与本文件冲突的行
> （配色 `#8B6914/#1A1206/#E8D5B7/#C62828`、正文「思源黑体」、数字「等宽字体」、图标「像素风格」）
> **自本文件建立之日起废止**；`00-dev-constitution.md` §十一（美术与版权铁律）继续有效且优先级更高。
> 建立缘由：Session 184 美术审查发现三套并存色板（07 §一 / 00 §11.7 / 代码事实 stone+amber），
> 无单一真源。本文件合并三者并收口为一套语义 token。
>
> 美术基调：**金石水墨 · 拓片简册 · 印信官职**（公有领域唯一，见 `00-dev-constitution.md` §11.1）。

---

## 一、色彩规范

### 1.1 核心 token（语义命名，禁止在组件中直接写裸 hex）

| Token | 值 | 用途 | 现况映射 |
|---|---|---|---|
| `ink-950` 玄 | `#0C0A09` | 应用底色 | stone-950 ✅ 沿用 |
| `ink-900` 烟 | `#1C1917` | 面板/卡片底 | stone-900 ✅ 沿用 |
| `ink-800` 灰 | `#292524` | 内嵌卡/hover | stone-800 ✅ 沿用 |
| `ink-700` 黛 | `#44403C` | 边框/分隔线 | stone-700 ✅ 沿用 |
| `paper-100` 宣纸 | `#F5EBD0` | 纸面材质（头像/简册/战报纸） | 现 `#e4d2a4` 渐变带统一 |
| `paper-300` 宣影 | `#C7AE7A` | 纸面阴影/旧化 | 现 `#c7ae7a` ✅ 沿用 |
| `seal-600` 朱砂 | `#A61919` | **第一强调色**：主按钮、印章、危险前置 | 00 §11.7 定值，UI 现几乎未用 ⭕ |
| `seal-400` 朱晖 | `#C6402A` | 朱砂 hover/提亮 | 新增 |
| `gold-400` 金印 | `#D7AA62` | 第二强调：金边、选中描边、爵位金 | 现 `#d7aa62`/`#ffd700` 两处统一 |
| `gold-200` 金文 | `#FDE68A` | 高亮文字、标题点缀 | amber-200 ✅ 沿用 |
| `text-100` 墨文 | `#E8E0CE` | 深色底主文字（暖白） | 现 stone-200 微调偏暖 |
| `text-300` 沉文 | `#A8A29E` | 次要文字 | stone-400 ✅ 沿用 |
| `ally` 己方 | emerald-400/900 | 己方势力、成功 | ✅ 沿用 |
| `enemy` 敌方 | red-400/900 | 敌方势力、战斗负反馈 | ✅ 沿用 |
| `danger` 深朱 | `#7F1D1D` | 不可逆操作（宣战/处决/覆盖存档） | 现 red-900 统一 |

### 1.2 使用纪律

- **朱砂是稀缺资源**：一屏至多 1~2 处朱砂元素（主按钮或印章）。满屏朱砂 = 没有朱砂。
- 功能色**固定语义**：军事=朱红系、内政/资源=金系、人事=宣色系、谍报情报=青灰系、家族=桃系。
  禁止按 section 顺序轮换色相（现状左栏 amber/cyan/rose/green 无语义跳色即反例）。
- 新增颜色必须先登记本表再使用；组件内出现裸 hex 视为 review 不通过（Konva/SVG 场景允许在
  `shared/theme.ts`（待建）集中定义后引用）。
- Tailwind 落法：扩展 `tailwind.config.js` `theme.extend.colors`，把上表注册为具名色
  （`ink`/`paper`/`seal`/`gold`），逐步替换 stone/amber 直写。

---

## 二、字体规范

| 用途 | 字体 | 字重 | 说明 |
|---|---|---|---|
| 正文 / 数字 / 表格 | `HanDynastySerif` | 400 | 唯一正文及数字字体（废止 07 §一「正文思源黑体/数字等宽」——未打包且违反资产闭环） |
| 强调正文 / 重要数值 | `HanDynastySerif` | 700 | 金粮兵数、五维数值、按钮 |
| 大标题 / 印章 / 城池州名 / 战役标题 | `HanDynastySeal` | 400 | **必须真正用起来**。现状：2.7MB woff2 每次启动加载但全游戏零像素渲染（仅死 CSS `.portrait-seal` 引用） |
| 竖排文字 | 两者皆可 | — | 仅限印信/氏族/简册；`writing-mode: vertical-rl` |

**字级阶梯**（现状 10~11px 密排废止）：正文 ≥13px；面板正文 14px；次级说明 ≥12px；
分组标题 15~16px；界面大标题 22~32px（HanDynastySeal）。120% 缩放下无截断。

**姓名印序**（铁律）：印章/竖排姓名一律 **姓在上、名在下**（如「吕／布」）。
S179 截图中「布吕／羽关／操曹／亮葛诸」为颠倒事故，B 层重建时不得复现。

---

## 三、UI 规范

### 3.1 面板（Panel）

- 标准配方：`ink-900 底 + 1px ink-700 边 + 圆角 ≤4px`。禁用大圆角、毛玻璃以外的拟物。
- 分组标题：`15px HanDynastySerif 700 + 2px 朱砂左缘竖条`（替代现状无语义彩色标题）。
- 层级最多三层（面板 → 分组 → 字段），超过三层改用页签或抽屉。

### 3.2 按钮（Button）

| 级 | 样式 | 用途 |
|---|---|---|
| 主令（Seal） | 朱砂底 `seal-600` + 金文 + `2px double gold-400` 双方框 | 确认下令 / 结束回合 / 进入剧本，一屏 ≤1 |
| 次令（Ink） | `ink-800` 底 + `ink-700` 边 + `text-100` | 普通操作 |
| 危令（Danger） | `danger` 底 + 朱砂边 | 宣战/处决/解盟/覆盖存档（07 §12.4 深红危险样式） |
| 禁用 | 透明度 40% + **必须附原因文案**（07 §12.1：不得仅置灰） | — |

### 3.3 交互与动效

- 反馈基调「墨晕」：弹窗/页签 150~250ms 淡入+微位移；数值变化 tween；禁止弹性/弹簧物理。
- 战报/日志走 P5-07c 伪终端文言流（逐行淡入）。ASCII 条（█░）**仅限**该语境；
  其余场景（CampaignPanel 士气/疲劳等）改用统一 `<Bar>` 组件。
- 状态变更命令一律走 §12.4 终审询问窗，视觉同源（CommandConfirmDialog 已实现，保持）。

### 3.4 信息层级

- TopBar：势力 > 年月 > 核心资源（金/粮/兵，配印信图标） > 辅助（城池数）。
  「美女」属 S09 小众资源，**移出顶栏**归入人事/家族面板。
- 每屏回答：玩家 1 秒内看到核心状态，3 秒内找到主操作，其余信息默认折叠。

---

## 四、图标规范

- **印信格系统**：资源/属性图标 = 18~20px 朱砂或墨色方印 + HanDynastySeal 单字
  （金/粮/兵/城/口/忠/勇…）。这是本项目原创度最高、成本最低的图标语言。
- **兵种篆字符**：步/骑/弓/弩/水 单字 + 底纹区分轻重级（走舸/蒙冲/楼船以水波纹 1~3 道分级）。
- **阵型简笔**：18 陆阵各配一枚 ≤24px 单线 SVG 阵形示意（方阵=□、锥形=△、雁行=人字…），
  与 `shared/labels.ts` FORMATION_LABEL 同源建设。
- **适性芯片**：S/A/B/C 沿用现 chips，颜色按 印绶色系（S=金、A=紫青、B=墨、C=黄）区分。
- **禁止**：emoji 作为正式图标（⚔️🎭 等限过渡）、像素风图标（废止 07 §一）、外部图标库
  （零新依赖原则；自绘单线 SVG）。

---

## 五、人物（头像）规范

> 组合方案 **A′ + C + B**（A′ 为对原 A 的修订：放弃扫描拓片 PNG，改程序化拓片风纹理，
> 免除 §11.1.1 逐件许可举证负担）。数据真源：`officers.json avatarGene` 字段
> （**当前断供**：client 零消费，渲染走 HERO_PRESETS 硬编码 + id%2/id%3 哈希，必须接通）。

| 层 | 内容 | 规格 |
|---|---|---|
| L0 纸底 | 宣纸渐变 + PCG 旧化噪点 | 现 `.officer-portrait` CSS ✅ 保留 |
| A′ 拓影 | 按文武分型（warrior/scholar）的程序化拓片剪影纹，`multiply` 混合，透明度 ≤0.18 | 待建（原 A 层 4 张 PNG 已于 S181 退役） |
| C 五官 | 脸型 4→6 / 冠冕 4→10 / 胡须 4→8 / 眉眼 7 表情 × 常态，由 `avatarGene` 驱动 | 现有 4 脸型/4 冠/4 须骨架，扩容并接数据 |
| B 印信 | 上：氏族简册竖排；右下：官职姓名印（**姓上名下**、朱砂底金双框、HanDynastySeal）；底：印绶色条（紫/青/墨/黄，联动 NobilityRank） | 待重建（S181 摘除后未恢复；死 CSS `.portrait-seal/.portrait-clan/.portrait-ribbon` 清理由重建一并处理） |
| L2 表情调 | S23 七状态色调层 | ✅ 已实装，保留 |

**人物分级策展**（223→1000+ 规模纪律）：
- S 级（≈20 人，四圣/雄主/顶级名将）：手工指定 avatarGene 全字段 + 专属 quote + 称号。
- A 级（≈80 人，一线）：手工指定冠/须/脸 + 哈希其余。
- B/C 级（其余）：`getAvatarGene(officerId)` 哈希派生，保证两两可辨（脸型×冠×须碰撞检测脚本）。

---

## 六、地图规范

- **基调**：短期沿用暗色 NE 栅格底图；中期目标「纸墨舆图」——陆地纸色做旧、水域玄墨、
  海岸/河流墨线晕染（程序化，不引外部素材）。
- **城池印信分级**（替代现状均等圆点）：县城=4px 墨点；郡治=6px 方印金边；州治=8px 朱砂方印；
  都城/玩家本据=朱砂印 + 金双框。选中态=金印描边 + 墨晕扩散，停用 `#ffd700` 裸金。
- **军队**：三角旗帜 + 主将姓氏篆字（HanDynastySeal），行军虚线改墨线渐隐。
- **迷雾**：数据脱敏之上加视觉层——未探明区域墨色加深 + 纸纹遮蔽，与已探明区可一眼区分。
- **地形装饰**（战术级缩放出现）：山=单线皴法三角、林=墨点簇、河=双线墨；全部程序化 SVG。
- **季节**（P2）：Konva 全图色调叠加（春无/夏暖/秋金/冬冷灰），不做动态云层与河流流动
  （投入产出比过低，见 Session 184 审查报告 §5）。

---

## 七、战斗视觉规范

- **六角地格统一为水墨浊色系**（废止现亮粉彩 `#c8d9a0/#5b9bd5` 等）：
  平原 `#8B8B6A` / 林 `#4A5A44` / 水 `#4A5E6A` / 山 `#6A5F4C` / 泽 `#5A5A44` / 城垣 `#7A6A58`。
- 单位：旗帜形标记（姓氏 + 兵种篆字 + 兵力条），废止圆形+首字。
- 选中=金印描边；移动范围=墨青 `#3E5A5E`；可攻击=朱砂描边。
- 火计/战法必须有最小视觉反馈（格内焰色脉动 + 伤害浮字），无反馈的指令视为未完成。

---

## 八、工程合规（与 00 §11.7 对齐）

- 字体仅 `HanDynastySerif`/`HanDynastySeal` 工程别名；禁宿主字体名；woff2 不入 git。
- 素材优先级：本项目原创程序化 SVG/Canvas/CSS > 证据完整 CC0 > 其他明确兼容许可。
- 清理项（随本文件建立登记）：`.portrait-seal/.portrait-clan/.portrait-ribbon` 死 CSS、
  `WorldMap.tsx` 死文件、`font-song/font-seal` 未用 Tailwind 别名、`index.css` 与
  `styles/fonts.css` 双份 @font-face、App.tsx 南郡调试按钮（构建守卫隐藏）。

---

## 九、执行手册（个人开发者 · 程序化美术版）

> **Session 405 拍板（2026-08-28）**：本项目由个人开发者维护、无美术功底，美术路线全面程序化；
> **当前阶段禁用一切 AI 生成图片素材**（未来如解禁，须先修订 `00-dev-constitution.md` §11.1.1
> 「AI 生成≠CC0」并逐张走 `ASSET_MANIFEST.md` 全登记 + `verify-compliance.mjs` 白名单扩容）。
> 本章不改变一~八章任何规范，只回答两件事：**怎么用代码实现**、**按什么顺序做**。

### 9.1 总路线：「不画一幅画」

金石水墨的数字化本质 = **材质感 + 官制符号 + 留白**，三者全部可由代码产生：
排版（引擎1）+ CSS/SVG 纹理（引擎2）+ 印信几何图标（引擎3）+ 程序化头像（引擎4）+
几何特效与 Web Audio 合成音效（引擎5）。零绘画、零位图、零新增二进制资产——
`verify-compliance.mjs` 二进制白名单保持不动，合规负担为零。

### 9.2 现状漂移清单（批次①收敛的验收基准，Session 405 实勘）

| # | 漂移 | 证据 | 批次①目标 |
|---|---|---|---|
| 1 | Tailwind v3.4 ESM 下 `extend.colors` 不合并，具名色/语义色未实际生效，组件裸写 stone-/amber- | `client/tailwind.config.js:15-22`（自注）、`client/src/index.css:15-18`（`--accent-*` 代理） | 修复合并或显式落地 CSS 变量 token，新增样式一律走语义 token |
| 2 | 抽屉跳色无语义（违 §1.2 固定语义） | `DiplomacyOverviewDrawer.tsx:27-28,281,313`（rose/sky/emerald）、`IntelOverviewDrawer.tsx:520,544`（sky）、`FamilyOverviewDrawer.tsx:437`（emerald）、`PersonnelRecruitDrawer.tsx:124`（rose） | rose/sky/emerald 跳色归零，收敛到四语义色 |
| 3 | 裸 `<button>` 无层级（违 §3.2），111 处；禁用仅置灰无原因（违 §3.2 禁用行） | 全 client 计数；`DiplomacyOverviewDrawer.tsx:296` | 收口到主令/次令/危令三级；禁用必须附原因文案 |
| 4 | 大圆角（违 §3.1 ≤4px） | `BattleView.tsx:64`、DuelPanel、EventDialog、MeleeEntryDialog、FamilyTreatmentDialog、DiplomacyOverviewDrawer | 圆角合规 |
| 5 | 印章字体近零使用（违 §二「必须真正用起来」）、字号阶梯违例、英文残留 | HanDynastySeal 仅 `BattlefieldSceneView.tsx`/`StandardModePanel.tsx` 2 文件引用；`text-[10px]` 多处（如 `StrategicWorldView.tsx:76,219`）；`StrategicWorldView.tsx:76` 英文「Strategic Realm」 | 大标题启用印章字体、字号阶梯合规、英文文案中性化为中文 |
| 6 | 战斗用色为已废止亮粉彩 + 裸金（违 §七） | `BattleView.tsx:14`（`#c8d9a0/#5b9bd5`）、`:63`（`#ffd700/#ff4444`）、`BattlefieldSceneView.tsx:150,168`（`#ffd700`）、`canvasTokens.ts`（`#ffd700`/暗蓝 `#121c2a`） | 废止色 grep 归零，走 §七 水墨浊色 + 金印描边（批次④主责，①先收 canvasTokens 入口） |
| 7 | 头像仅 4 脸型×4 冠×4 须 + HERO_PRESETS 4 人硬编码，`avatarGene` 全链路零实现（§五「断供」） | `OfficerPortrait` 组件、`HERO_PRESETS:76`（id 1/4/5/6） | 批次③按 §五规格扩容接通（同时清 D-0B-7） |
| 8 | 死 CSS 与双轨色残留（§八清理项未执行） | `index.css:99-101`（`.portrait-clan/.portrait-seal/.portrait-ribbon`）、`AccSection.tsx:38-49`（legacy amber/rose/emerald/sky 双轨）、index.css 与 styles/fonts.css 双份 @font-face | 删除或归一 |
| 9 | 音频零文件零代码 | 全库无音频资产与 Web Audio 引用 | 批次⑤按 P5-09 程序化合成补位 |

### 9.3 五大程序化引擎

1. **排版即美术**：大标题/剧本名/势力名启用 `HanDynastySeal`（已打包，零成本）；
   简册题签用 `writing-mode: vertical-rl` 竖排；字重扩展（P5-07e）；字号阶梯按 §二收敛。
   验收：世界屏/抽屉/战斗三处标题层级截图对比。
2. **CSS/SVG 纹理库**：把现有宣纸噪点（`index.css:87-88`）与竹简竖纹（`:57-60`）提炼为
   `.tex-paper` / `.tex-bamboo` / `.tex-rubbing` 三个工具类 + SVG `feTurbulence` 拓片颗粒滤镜；
   纯文本资产，不进二进制白名单。
3. **印信几何图标**（§四落地）：18~20px 方印/圆印 + HanDynastySeal 单字
   （金/粮/兵/口/谍/计/礼/爵 + 事件「丰/警/凶/喜」）+ 按 id 哈希的确定性缺角磨损；
   语义色四系 + 印绶色（紫/青/墨/黄）复用 §1.1 token；替换 TopBar 资源行/页签/事件标记的文字前缀。
4. **程序化头像**：按 §五 A′+C+B 规格实施（C 层脸型 4→6/冠 4→10/须 4→8/眉眼 7），
   `avatarGene` 落库（S 级手工/A 级半手工/BC 哈希+碰撞检测），Konva 分层渲染 + toCanvas 缓存。
5. **几何特效 + 合成音效**：§七换肤经 `canvasTokens.ts` 集中收口（刀光=弧线渐变、
   墨晕=径向渐变粒子、火计=橙红粒子+脉动，`07` §九「纯几何占位起步」原设计）；
   声音走 Web Audio 纯合成（鼓=低频+噪声瞬态、磬=泛音叠加、号角=锯齿+滤波、翻简=噪声簇），
   5~8 个事件音，零音频文件。

### 9.4 实施批次路线图（按 视觉收益 ÷ 难度 排序）

| 批次 | 内容 | 预估 | 依赖 | 对应既有规划 |
|---|---|---|---|---|
| ① 收敛 ✅ Session 407 | §9.2 表 1~5、8 项：token 收口、跳色/裸按钮/圆角/字号合规、死 CSS 清理、英文残留中性化 | 1~2 Session | 无 | §八清理项 + §3.1/§3.2 纪律收口 |
| ② 金石组件库 ✅ Session 408 | StonePanel / SealButton / SealBadge / 竖排简册面板（SlipPanel）四组件入 `client/src/components/ui/`；印信图标 13 枚（金粮兵口城谍计礼爵丰警凶喜 + 十域章） | 2 Session | ① | **P5-07d**（+§四图标系统首批） |
| ③ 头像三方案 ✅ Session 409 | §9.3 引擎 4 全量：avatarGene 落库 + A′/C/B 三层重建 | 3~4 Session | ② 印信层 | **P5-10 a/b/c**（清 D-0B-7） |
| ④ 战斗换肤 ✅ Session 409；**余项 ✅ Session 418**（灼烧「焰」字 Konva.Animation 脉动 + 攻击/火计/战法伤害浮字） | §七全条目：水墨浊色、旗帜形单位、金印选中、墨晕/刀光/火计粒子 | 2 Session | ① | §七 + `07` §九演出 |
| ⑤ 声音 ✅ Session 409；**打磨 ✅ Session 418**（鼓双击回声/磬失谐泛音 + TopBar 音量四档循环开关持久化） | Web Audio 合成 5~8 音效 + 底噪 | 1~2 Session | 无 | **P5-09** |
| ⑥ 封面标题屏 ✅ Session 409（篆书题+朱砂印） | 篆书大字 + 拓影剪影 + 印章构图（免立绘） | 1 Session | ② | P5-07e 后的视觉门面 |

每批完成即按 `00-dev-constitution.md` 规则 5 同步 `10-progress.md` 与 `HANDOFF.md`；
批次①验收命令化：`grep -rn "ffd700\|ff4444\|c8d9a0\|5b9bd5" client/src` 归零 +
rose/sky/emerald 抽屉跳色归零。

**批次①（Session 407）完成记录与余项**：
- ✅ token 结构修复：色组移入 `theme.extend.colors`（根因是嵌套笔误，非 Session 185 所诊
  「ESM 合并问题」），`bg-seal-600`/`font-seal`/`text-wen-100` 等类名已入构建产物；
  `text-100/text-300` 按 §1.1 注册为 `wen` 组（避开 Tailwind 字号 `text-*` 命名冲突）。
- ✅ 废止色收口：BattleView/BattlefieldSceneView 全部裸 hex 收进 `theme/canvasTokens.ts`
  BATTLE_TOKENS（值等价，§七换肤时只改该文件）；`ffd700/ff4444/c8d9a0/5b9bd5` 在组件层归零。
- ✅ 圆角合规（8 处→`rounded`≤4px）、印章字体启用（世界屏大标题 `font-seal`）、
  英文「Strategic Realm」→「天下大势」、死 CSS（.portrait-clan/.portrait-seal/.portrait-ribbon）
  删除、@font-face 去重（唯一声明处 `styles/fonts.css`，经 main.tsx JS import）。
- ✅ S09 宫廷人脉域色从临时 rose 统一为**宣色系**（内政抽屉 S09 卡 + 外交抽屉「宫廷牵线/缔结同盟」
  → `paper-*`）。**复核修正**：§9.2 行 2 中部分 rose/sky/emerald 属反馈语义色（成功/失败/满意度）
  与核准域色（谍=青、家族=桃），予保留——批次①真正清除的是「无语义域身份跳色」。
- ✅ 三级按钮骨架 `ui/buttons.tsx`（Seal/Ink/Danger，禁用必须传 reason）+ 高流量入口
  （TopBar 结束回合 SealButton）。
- ⏳ 余项（归批次②）：全量约 111 处裸 `<button>` 换三级组件；其余 ~250 处 `text-[10px]`
  字号阶梯收敛；容器 `bg-[#…]` 任意值类收口 StonePanel。

**批次②（Session 408）完成记录**：
- ✅ 四组件落地 `client/src/components/ui/`：`StonePanel`（§3.1 标准配方：ink-900 底 + ink-700 边 +
  ≤4px 圆角 + 标题 15px/700 + 2px 朱砂左缘）、`SealBadge`（方/圆印 + HanDynastySeal 单字 +
  哈希确定性磨损虚线，色板内聚 §1.1 等值，新增 `family` 桃系）、`SealIcon`（13 语义印：
  金/粮/兵/口/城/谍/计/礼/爵/丰/警/凶/喜）、`SlipPanel`（竖排简册题签 + 竹简纹）。
- ✅ 印信图标接入：TopBar 资源行（金/粮/兵/礼/城）+ 命令坞十域章（政/军/人/交/计/谍/田/家/朝/势，
  语义色固定 §1.2）。
- ✅ 裸按钮清零：codemod 全量 **149 处/40 文件** → `InkButton`（组件重设计为「结构基座」：
  只统一 flex/圆角/禁用行为，颜色类留在调用点，与条件态类零冲突；`forwardRef` 兼容 ref 调用点；
  `{...rest}` 先展开保证 data-testid 序列化顺序不破坏既有测试）；真实 `<button>` 在 components
  层仅剩 `ui/buttons.tsx` 内部实现。
- ✅ 字号阶梯全量收敛：`text-[10px]/[9px]/[11px]` → `text-xs`（12px 底线）全仓归零。
- ✅ 容器任意值收口：战场 6 处 `bg-[#…]` → `canvasTokens.ts` 新增 shell/header/field/melee 等
  token + 内联样式；非 legacy `bg-[#…]` 归零。
- 验收：typecheck + client **66/66** + 构建 token 类名验证 + `verify-s379` **21/21** +
  `verify-s407` **22/22** + compliance（756 files）+ `git diff --check` 全绿；
  截屏目检：顶栏五印、坞十域章、篆书州名、主令朱砂按钮全部上屏。
- 工程注记：dev 服务器需重启才会吃到新 tailwind 配置（PostCSS 插件不热载 config），
  复现「类名不生效」先重启 vite 再排查。

**批次③④⑤⑥（Session 409）完成记录**：

**批次③/④/⑤ 余项（Session 418）清偿记录**：
- officeSeal 动态官职印：在职官职取单字篆印（尉/校/将/帅/吏/令/守/牧/相），无官职回落姓名；royalSeal=君主印金三重框（`useIsRuler`）；A′ 拓影细分 royal/servant（君主环纹/无势力细密短纹，存储基因不变、渲染层解析）。
- 灼烧焰色脉动：statusEffects burn 单位挂「焰」字章（Konva.Animation 正弦脉动）；伤害浮字：attack/fire/ability 后兵力差 → 目标格 -N 浮字上飘淡出（`battleFeedback` 瞬态）。
- 音色打磨：鼓双击回声、磬失谐泛音；音量四档循环（TopBar 按钮+localStorage 持久化，masterGain 路由）。
- ✅ 批次③ 头像三方案（P5-10，清 D-0B-7）：`shared/avatar-gene.ts`（getAvatarGene 哈希派生 +
  deriveAvatarGeneTable 名册级碰撞消解「策展优先→id 序→须/冠/脸探测」，零 RNG）+ Zod/类型/officers.json
  （4 原型手工策展：曹操帝冠圆脸短须、诸葛纶巾长脸山羊须、吕布武冠尖脸乱须、关羽武圣冠方脸长髯）；
  OfficerPortrait C 层扩容 6 脸/10 冠/8 须/7 眉眼 + A′ 拓影层（multiply 0.16）+ B 层（氏族题签/姓名印
  姓上名下篆书金双框/印绶色条联动 NobilityRank）；ExpressionPortrait 同接基因与姓名印。
  08 真源 avatarGene 节更新为已实装。验收：shared avatar-gene **7/7**（含 460 消解碰撞）、
  shared 全量 52 文件 **470**、validate-data、client 66/66、s379 21/21、s407 22/22、详情页截屏目检。
- ✅ 批次④ 战斗换肤（§七）：六角地格水墨浊色（平原#8B8B6A/林#4A5A44/水#4A5E6A/山#6A5F4C/
  泽#5A5A44/城垣#7A6A58）、单位废止圆形改**旗帜形**（纸面旗 + 主将姓氏 + 兵种篆字 + 兵力条）、
  选中金印描边 #D7AA62、移动范围墨青 #3E5A5E、可攻击朱砂描边 #A61919。验收：`verify-s374-offline-melee`
  **44/44**（六角全流程无回归）。余项：火计焰色脉动/伤害浮字（需战斗状态渲染消费）。
- ✅ 批次⑤ 声音（P5-09 最小切片）：`utils/sfx.ts` Web Audio 纯合成——战鼓（低频+噪声瞬态，结束回合）、
  铜磬（泛音叠加，备用）、号角（锯齿+滤波，进战）；零音频文件、白名单不动、合成失败静默降级。
  听感未自动验收（无头环境无音频出口），console 零错误由 s379/s407 覆盖。
- ✅ 批次⑥ 封面标题屏：剧本选择页标题篆书化（font-seal「晚东汉末」+ 朱砂「汉」印）。

---

*文档版本: v1.1 | 2026-08-28 | Session 184 美术总监审查建立（视觉真源唯一化）；Session 405 增补 §九 执行手册（个人开发者·程序化美术版，AI 素材禁用拍板）*
