# LateEasternHanDynasty — 三国题材策略游戏

> 受经典三国策略游戏启发，从零构建的现代回合制三国策略游戏。
> 融合历代三国策略游戏的设计精华（单挑三角克制·单挑大会·部曲私兵·屯田质任），加入原创设计（主副将与参谋编成·爵位加成·战法·人际关系·子女家族·计谋谍报·货币成色·出身派系）。
>
> **声明 · Disclaimer**
>
> 🀄 本项目是一款基于 React + Canvas 构建的三国题材独立策略游戏。**与百度开源前端框架 San 无任何关联**。
>
> 🇺🇸 This project is an independent strategy game inspired by the Three Kingdoms period. **It is NOT affiliated with Baidu's San front-end framework.**
>
> 🎮 本项目为完全独立的原创作品，与株式会社光荣特库摩（Koei Tecmo）及其旗下《三国志》《信长之野望》等任何游戏系列无任何商业关联、授权或合作关系。游戏中所有三国人物及历史事件素材均来源于《三国志》（陈寿·西晋）、《后汉书》（范晔·南朝宋）、《三国演义》（罗贯中·元末明初）等公有领域古籍。
>
> 🇺🇸 This project is an independent work. It is NOT affiliated with, endorsed by, or associated with Koei Tecmo Holdings Co., Ltd. or any of its game series (including *Romance of the Three Kingdoms* / *Nobunaga's Ambition*). All historical references are derived from public-domain classical texts.
>
> 🀄 本项目是一款受东汉末年历史与经典策略游戏启发的独立历史策略游戏，并非任何商业游戏公司或游戏系列的官方产品、重制版、克隆版或衍生作品。
>
> 🇺🇸 This project is an independent historical strategy game inspired by the late Eastern Han period and classic strategy games. It is not an official product, remake, clone, or derivative work of any commercial game company or franchise.

**日本語** — 三国時代を舞台にしたターン制ストラテジーゲーム。古典的な三国戦略ゲームの設計精神を受け継ぎ、ゼロから構築されたモダンな作品です。武将システム（主副將・部曲・部隊品質・教育・出身派閥）、経済システム（貨幣純度・税収・俸禄・屯田）、戦闘システム（単挑三角相克・武魁大会・戦法エンジン）など、奥深いオリジナル設計が特徴です。

**한국어** — 삼국시대를 배경으로 한 턴제 전략 게임. 고전 삼국 전략 게임의 설계 정신을 계승하여 처음부터 구축한 현대적인 작품입니다. 무장 시스템(주부장·부곡·부대품질·교육·출신파벌), 경제 시스템(화폐순도·세수·봉록·둔전), 전투 시스템(단도삼각상극·무쾌대회·전법엔진) 등 깊이 있는 오리지널 설계가 특징입니다.

![Phase](https://img.shields.io/badge/phase-0--A%20(Demo)-blue)
![Systems](https://img.shields.io/badge/systems-19-orange)
![Platform](https://img.shields.io/badge/platform-Web-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

## Project Status

This project is an independent open-source development project.

Historical names, events, and cultural references are based on public historical sources.

---

## Screenshots · 游戏截图

> Map / territory overview, city details with economy & operations, and personnel interface.

| 地图全景 · Map Overview | 城池详情 · City Detail | 人事界面 · Personnel |
|:---:|:---:|:---:|
| ![Map](docs/screenshots/leh-full-map.png) | ![City](docs/screenshots/leh-city-detail.png) | ![Personnel](docs/screenshots/leh-personnel-officers.png) |

---

## 快速启动

```bash
pnpm install
pnpm --filter @leh/shared build
pnpm dev
# 服务 :3001  前端 :5173（代理 /api）
# 数据校验: pnpm validate-data
# 单元测试: pnpm test
```

硬刷新 `Ctrl+Shift+R`。开局默认刘备军（成都）。

---

## 21 大系统总览

| ID | 系统 | 成熟度 | 一句话 |
|:--:|------|:------:|--------|
| S01 | 回合 | M+ | 年月季推进·全势力金粮同步 |
| S02 | 地图 | M | Natural Earth 底图·30 城·LOD |
| S03 | 内政 | M | 农/商/城/民心/文化/工艺/交通/卫生 + **民屯田** |
| S04 | 人口经济 | M | 四桶 demographics + 粮耗·征兵池 |
| S05 | 军事 | M+ | 邻接出征→六角战→占城·**主副将与参谋编成**·**爵位加成** |
| S06 | 迷雾 | M+ | UI + 服务端裁剪 `maskGameStateForPlayer` |
| S07 | 谍报 | M+ | 女间谍·驻守反间·流言联动 |
| S08 | 外交 | M+ | 进贡/结盟/献美·友好度体系 |
| S09 | 美女资源 | M | 寻访/抢夺/赏赐·非历史女 |
| S10 | 战斗 | **M+** | 六角+克制+火计+**战法引擎**+三级水军+**暴击/反击/连击引擎(§6.2~6.5·专属·防循环·阵型修正)**+**单挑引擎(全自动结算·7指令·三向克制·专属·无双保护)**+**主副将与参谋编成(独立槽位·爵位加成·上限9~10人)**+**部队品质**+**战役层引擎(§12~§17)** |
| S11 | 人事 | M+ | 搜索/登用/赏赐/任命三轨·仅男将 |
| S12 | 官职功绩体力 | S/M | 0-A 精简任命·体力完整·功绩字段代码待补 |
| S13 | 宝物 | S | 20 件 (0-A) |
| S14 | 事件 | M+ | tickEvents + EventDialog |
| S15 | AI | M+ | 内政占位·出征占城·计谋谍报相位 |
| S16 | 存档 | D | SQLite 未实现 |
| S17 | 计谋 | M+ | 美人计/离间/假情报/空城·+四面楚歌联动 |
| S18 | 家族 | M+ | 婚配/跟随/子女引擎·祝融唯一女将 |
| S19 | 单挑大会 | D | 设计完成·16人淘汰·押注·武魁称号·引擎待实现 |
| S20 | 前端体验 | D | Session 100 技术储备方案完成（零代码）：endTurn WS 接入/数字跳动/EventLog 流化/势力凸包涂色/FogLayer/konva tween/PCG 水墨地形/派系面板/OfficerDetail/己方武将列表/忠诚度警报/外交雷达 SVG/财政飘字/行政总署三段式。零新依赖 |
| S21 | 三级战斗串联 | D | Session 100 技术储备方案完成（零代码）：一级大地图演出/二级战术串联/三级白刃战 MeleeStage Konva 方阵/单挑接入 DuelStage 混合范式/screen 六态栈 |

---

## 特色玩法

### 🔥 单挑系统（引擎已实装 · 全自动结算）
- 7 指令三向克制：猛攻→牵制→必杀→猛攻，全自动引擎内部推演
- 隐藏属性(8项) × 体力 × 性格的多维博弈
- **无双保护**（不屈不斩·仅吕布）+ **专属技能**（武圣/龙胆/咆哮/天义/恶来/刚烈/虎痴/骑神/火神）
- 宿命对决（设计完成，待实装）· **单挑大会 S19**（设计完成，待实装）

### ⚔️ 主副将与参谋·爵位加成·部曲·部队品质（设计完成）
- **主将 + 副将 + 参谋（独立槽位·智力≥85·幕僚不带兵·智略加成）+ 副参谋**
- **爵位编成加成**：关内侯→皇帝 7 级，叠加于武官官职之上，上限大将军 9 人/君主 10 人
- 18 种阵型 × 兵种组合产生差异化表现 + **暴击/反击/连击阵型修正**
- **部曲系统**：许褚·高顺·公孙瓒等 12 位史载武将拥有私兵，随人走
- **部队经验** Lv1~7（新卒→铁军），**组织度** 0~100，士气深化

### 🌾 屯田与家属（设计完成）
- **军屯田**：驻军耕作自给，训练减半
- **民屯田**：人口分配型农业，不花金，平行于 farm 开发
- **家属质任制**：士兵家属在征兵城 → 敌占城士气崩盘 → 曹魏式迁家属到首都

### 🕵️ 计谋与谍报
- 美人计·离间计·假情报·空城疑兵
- 女间谍训练 + 枕边风
- 流言 + 四面楚歌联动家属系统

---

## 技术栈

| 层 | 技术 |
|:---|:-----|
| 前端 | React 18 + TypeScript + Vite + Konva.js + Tailwind CSS |
| 状态 | Zustand |
| 后端 | Express + TypeScript + WebSocket (ws) |
| 校验 | Zod（运行时 JSON 校验） |
| 测试 | Vitest（68 单测） |
| 包管理 | pnpm workspace (Monorepo) |

---

## 项目结构

```
Late-Eastern-Han-Dynasty/
├── shared/            # 类型·Zod·纯函数工具
│   ├── types/         # 24 个类型定义文件
│   ├── enums/         # 全部枚举
│   ├── validators/    # Zod schema
│   ├── stamina.ts     # 体力系统
│   ├── ceiling.ts     # 五维天花板
│   ├── demographics.ts # 人口结构
│   ├── city-roads.ts  # 0-A 30城官道邻接
│   ├── mask-state.ts  # 视野裁剪
│   ├── intel.ts       # 谍报可见性
│   └── positions.ts   # 三轨官职
├── server/            # Express 后端
│   ├── src/
│   │   ├── engine/    # 20 个引擎模块
│   │   ├── battle/    # 7 个战斗子模块
│   │   ├── services/  # 游戏编排器
│   │   ├── routes/    # REST API
│   │   ├── data/      # JSON 10 文件 + loader
│   │   ├── scripts/   # 8 个验证/生成脚本
│   │   ├── middleware/ # 错误处理
│   │   └── ws/        # WebSocket 广播
│   └── ...
├── client/            # Vite + React 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/   # 10 面板组件
│   │   │   ├── map/      # 地图 (Konva)
│   │   │   ├── battle/   # 战斗 + 单挑面板
│   │   │   ├── events/   # 事件弹窗
│   │   │   └── ui/       # 通用折叠
│   │   ├── stores/     # Zustand
│   │   └── services/   # API 客户端
│   └── ...
├── scripts/            # 工具脚本 (SPDX/底图)
├── docs/              # 15 份设计文档
│   ├── 00-dev-constitution.md
│   ├── 01-overview.md
│   ├── 05-combat-system.md   # 战斗·单挑·阵型·部曲·屯田
│   ├── 12-system-map.md      # 21 大系统总图
│   └── ...
├── package.json        # Monorepo 根 package
├── pnpm-workspace.yaml # pnpm workspace 定义
├── tsconfig.base.json  # TypeScript 基础配置
├── tsconfig.json       # TypeScript 配置
├── vite.config.ts      # Vite 配置
├── LICENSE             # MIT 许可证
├── AGENTS.md          # AI 助手规则
├── CONTRIBUTING.md    # 贡献指南
├── CREDITS.md         # 第三方致谢
└── HANDOFF.md         # 会话交接
```

---

## 设计哲学

1. **玩法优先 · 小数据集验证**：先 30 城/9 兵种/30 将跑通架构，再 0-B 全量扩容
2. **数字真源**：`docs/08-data-dictionary.md` 是所有规模数字的唯一真源
3. **Zod 先于 JSON**：运行时校验确保数据完整性
4. **完成即文档**：每个新功能必须同步更新受影响的设计文档
5. **一次一个大系统**：对照 `12-system-map.md` 选定 Sxx，不并行

---

## 开发路线

```
Phase 0-A → 架构骨架 + 30城小数据（当前）
Phase 0-B → 全量数据（105城/1000将/21兵种）
Phase 1  → 地图 & 回合
Phase 2  → 内政 & 人事
Phase 3  → 战斗系统深化（单挑引擎·武魁大会·战法UI）
Phase 4  → 外交 & 事件 & 婚姻
Phase 5  → AI & 打磨
```

**当前重点**：总军师系统实装（任命/态势/献策/对决）→ 设施建造回合化 → 势力特点数据 → AI Army 接入。**S20/S21 前端体验增强方案技术储备完成，实装时机后续排定**。

---

## 贡献

参见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## License · 许可证

**Source code** is licensed under the [MIT License](./LICENSE).

**Game assets** (images, audio, fonts, and other media) may have separate licenses. Please refer to [CREDITS.md](./CREDITS.md) for details.

---

**源代码** 以 [MIT 协议](./LICENSE) 授权。

**游戏素材**（图片、音频、字体及其他媒体）可能适用不同的许可协议，详见 [CREDITS.md](./CREDITS.md)。
