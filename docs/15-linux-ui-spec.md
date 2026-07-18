# Linux UI 与跨平台字体规范（Session 102 实装）

> 配套最高准则 `00-dev-constitution.md` §11.3 + §11.7、`AGENTS.md` 核心规则 9、`CONTRIBUTING.md` 跨平台字体铁律条款。
> 美术基调见 `00-dev-constitution.md` §十一、武将头像三方案见 `07-ui-design.md` §11.6。

---

## 一、跨平台字体防御三件套（已实装，Session 102）

### 1.1 资产闭环（Asset Anti-Leakage）

**绝对禁止**：在任何 CSS / SASS / Canvas / Konva 代码中引用宿主系统预装字体
（`"微软雅黑"` / `"Arial"` / `"华文行楷"` / `"PingFang SC"` 等）。
Linux 极简发行版（Arch 最小化安装）可能完全无 CJK 字体 → Canvas 城市名直接 `□□□`（豆腐块）。

**已实装**：

| 工件 | 位置 | 说明 |
|---|---|---|
| 字体目录 | `client/public/fonts/` | woff2 文件不入 git，开发者按 `README.md` 手动放入 |
| 字体声明 | `client/src/styles/fonts.css` | `@font-face` 声明工程内部别名 `HanDynastySerif` / `HanDynastySeal`，`font-display: block` |
| 全局覆盖 | `client/src/index.css` | `font-family: 'HanDynastySerif', serif !important` |
| Tailwind 主题 | `client/tailwind.config.js` | `fontFamily.song` / `fontFamily.seal` 注册 |
| .gitignore | `*.woff2 *.woff *.ttf *.otf` | 字体不入 git，防仓库膨胀 |
| .gitattributes | `*.woff2 binary` | 二进制保护，防 Git 行尾转换破坏 |

**工程内部别名**（绝不与宿主系统重名）：

| 别名 | 字体 | 授权 | 用途 |
|---|---|---|---|
| `HanDynastySerif` (normal) | 思源宋体 SC Regular (NotoSerifCJKsc-Regular.woff2) | SIL OFL 1.1 | 正文 / 古籍史料 |
| `HanDynastySerif` (bold) | 思源宋体 SC Bold (NotoSerifCJKsc-Bold.woff2) | SIL OFL 1.1 | 标题加粗 |
| `HanDynastySeal` | 马善政体 Ma Shan Zheng (MuYaoSoftBrush.woff2) | SIL OFL 1.1 | 官印 / 篆书 / 大标题 |

> **说明**：原计划用沐瑶软笔体，未找到可确认授权的稳定 woff2 源，改用 Google Fonts 的
> `马善政体 (Ma Shan Zheng)`——SIL OFL 1.1 授权明确、CDN 稳定、毛笔楷书风格接近印章/篆书需求。
> 文件名保留 `MuYaoSoftBrush.woff2` 以维持工程内部别名稳定。
>
> **3 个 woff2 文件已实际下载就位**（共 ~7MB，`.gitignore` 排除不入 git）：
> - `NotoSerifCJKsc-Regular.woff2` (~2.0MB，经 @fontsource/noto-serif-sc 镜像下载)
> - `NotoSerifCJKsc-Bold.woff2` (~2.1MB，经 @fontsource/noto-serif-sc 镜像下载)
> - `MuYaoSoftBrush.woff2` (~2.7MB，经 @fontsource/ma-shan-zheng 镜像下载)

### 1.2 Canvas 渲染屏障（Font Loading Barrier）

**问题**：Canvas 绘文字不经过 DOM 树，直接读字形数据。若字体未加载完就画第一帧，会用宿主默认字体绘制（Linux 无 CJK → 豆腐块）。Konva 无自动字体变更监听，画错第一帧后不会自动重绘。

**已实装**：

```typescript
// client/src/utils/fontBarrier.ts
export async function waitForGameFonts(): Promise<boolean> {
  if (!('fonts' in document)) return true;
  try {
    await Promise.all([
      document.fonts.load('12px HanDynastySerif'),
      document.fonts.load('12px HanDynastySeal'),
    ]);
    return true;
  } catch (error) {
    console.error('字体资产加载失败，为防止乱码，游戏拒绝启动:', error);
    return false;
  }
}
```

```typescript
// client/src/App.tsx
const [isEngineReady, setIsEngineReady] = useState(false);
useEffect(() => {
  (async () => {
    const ok = await waitForGameFonts();
    if (ok) { setIsEngineReady(true); void boot(); }
    else { setFontError('工程字体资产加载失败。请按 client/public/fonts/README.md 放入 woff2 文件后刷新。'); }
  })();
}, [boot]);
// isEngineReady 为 false 时不渲染 Konva Stage，显示"正在加载工程字体…"占位
```

**Konva `<Text>` 必须显式 `fontFamily`**：Konva 默认 `fontFamily='Arial'`，跨平台不一致。已补：
- `client/src/components/map/MapCanvas.tsx` — 4 处 `<Text>` 节点（州名 / "己"徽章 / 城市名 / 副标）
- `client/src/components/battle/BattleView.tsx` — 1 处 `<Text>` 节点（主将姓）

### 1.3 跨平台协作工程规范

| 规范 | 工具 | 防御 |
|---|---|---|
| 文件编码 UTF-8 (no BOM) | `.editorconfig` + `.github/workflows/ci.yml` 编码门禁 | Windows 协作者 IDE 默认 GBK 提交后 Linux 解析乱码 |
| 换行符 LF | `.editorconfig` (`end_of_line=lf`) + `.gitattributes` (`eol=lf`) | Windows CRLF 导致 JSON 字段尾部多 `\r`，Zod 校验失败 |
| 二进制保护 | `.gitattributes` (`*.woff2 binary` / `*.png binary` 等) | Git 误判字体/图片为文本，行尾转换破坏文件 |
| JSON 校验 | `pnpm validate-data` (Zod) + CI | 武将/城市数据合法性 |
| CI 门禁 | `.github/workflows/ci.yml` | PR 自动跑 typecheck/lint/test/validate-data + UTF-8 扫描，不通过拒绝合并 |
| 字体铁律 | `CONTRIBUTING.md` 跨平台字体铁律条款 | 协作者写 `font-family: '华文行楷'` 的 PR 被人工拦截 |

---

## 二、Linux UI 适配（P5-07 实装，本轮文档固化）

### 2.1 HiDPI / Wayland 缩放适配（P5-07a）

**问题**：现代 Linux 桌面（GNOME 40+, KDE Plasma 6）大步迈向 Wayland，策略游戏有海量密集文字和细线条地图。前端容器在 Linux 开启分数倍缩放（125% / 175%）时，Canvas 渲染的地图会一片模糊，字体带毛边。

**实装方案**（P5-07a）：
- `client/src/utils/hidpi.ts` 新增 `setupHiDPIStage(stage: Konva.Stage)`
- 读 `window.devicePixelRatio`，`stage.width/height × dpr` + `stage.scale({x:dpr,y:dpr})` + CSS 逻辑大小回缩
- `MapCanvas.tsx` / `BattleView.tsx` / `MeleeStage.tsx`（Phase 5）挂载时调用
- 监听 `window.matchMedia('(resolution: ...dppx)').change` 动态重设
- Konva 原生支持 dpr 缩放，零新依赖

### 2.2 XDG 规范存档（P5-07b）

**问题**：游戏存档仅写在浏览器 localStorage 里，Linux 玩家清理浏览器缓存或容器重启后通关存档灰飞烟灭。Linux 玩家重视数据主权，能肉眼看到 save.json 并用 vim 直接魔改武将数值是乐趣。

**实装方案**（P5-07b，混合架构）：
- 服务端写文件：`server/src/engine/save.ts` 写 `process.env.XDG_DATA_HOME || ~/.local/share/leh/saves/`
- 前端导出兜底：存档序列化为 JSON，前端 `Blob` 下载到玩家自选目录 + 一键导入
- 新增 `server/src/routes/save.ts`：`POST /save` / `GET /save/list` / `GET /save/:id` / `POST /save/:id/load` / `DELETE /save/:id`
- 新增 `client/src/components/ui/SaveLoadPanel.tsx`：存档列表 + 导入导出 + 显示文件路径

### 2.3 伪 Terminal 文言战报（P5-07c）

**理念**：古籍简册即"命令终端"。将 Linux CLI 的精干与史料文言的凝练结合，开发成本极低（纯文本排版），逼格突破天际。

**实装方案**（P5-07c）：
- 改造 `EventLog`：背景 `#1c1a17` 宣纸暗色，等宽字体 + 思源宋体混排
- 战报格式：
  ```
  [ 旬始 ] 岁在丙子，春正月，初吉。
  [ 内政 ] 下邳屯田完毕，得粮三千石 .................. [ 丰 ]
  [ 谍报 ] 兖州刺史曹操，引兵复袭徐州 .................. [ 警 ]
  [ 异象 ] 琅琊郡大风拔树，飞沙走石 .................. [ 凶 ]
  ```
- 状态色：`[ 丰 ]` 绿 / `[ 警 ]` 黄 / `[ 凶 ]` 红 / `[ 喜 ]` 金
- 一行行错落输出，复用 Session 100 W2 EventLog 流化（rAF + 淡入 + 顶滚）
- 零新依赖：纯 CSS + Konva.Text

### 2.4 金石黑框组件库（P5-07d）

**理念**：参考 Linux 监控工具（htop / lazygit）的模块划分。高对比度、边界清晰的"金石黑框组件"。

**实装方案**（P5-07d）：
- `client/src/components/ui/StonePanel.tsx`：黑框 + 朱砂边 + 宣纸底
- `client/src/components/ui/SealButton.tsx`：朱砂官印 Action 按钮
- `client/src/components/ui/ConfirmDialog.tsx`：终端 Dialog 风格 + 朱砂印确认
- Tailwind 主题色：`stone-950` 底 + `#a61919` 朱砂 + `#3e2723` 黑框 + `#fffde7` 宣纸黄

---

## 三、开源筑巢引凤（P5-07 实装，本轮文档固化）

### 3.1 武将传记拆分（P5-07e 协同）

**问题**：当前 `server/src/data/officers.json` 单文件 1000+ 武将，历史极客难 PR 补传记。

**实装方案**（混合架构）：
- 主 JSON 保持单文件（加载性能）+ `docs/biographies/g_guanyu.md` 独立传记 Markdown（PR 友好）
- `scripts/merge-biographies.ts` build 时合并 Markdown 进 `officers.json` 的 `biography` 字段
- 历史极客可 PR Markdown 传记，不懂前端也能贡献

### 3.2 README 工程师段

**实装方案**（P5-07e 协同）：
- README 新增 `## Engineering Highlights` 段（中英双语）：
  - 服务端权威 + 瘦客户端（21 引擎文件服务端跑，客户端零规则计算）
  - 数据驱动（`/shared` + `/server/data` 完全结构化，Zod 运行时校验，欢迎 PR 补 `biography`/`avatarGene`）
  - 零美术资源（金石水墨·拓片简册·印信官职，公有领域唯一，Konva 程序化 + Canvas 2D filter）
  - 零新依赖原则（React + Konva + Zustand + Tailwind + 原生 WS + 原生 Web Audio 覆盖 90%）
  - Linux 适配（HiDPI / XDG 存档 / 字体本地打包 / .editorconfig LF / CI 编码门禁）
- 修复 badges：`systems-19` → `systems-22`

---

## 四、实装路线总览

| 子任务 | Session | 状态 |
|:-:|---|:-:|
| 资产闭环（@font-face + tailwind + .gitignore） | 102 | ✅ |
| FontBarrier（`fontBarrier.ts` + App.tsx 屏障） | 102 | ✅ |
| Konva `<Text>` 补 fontFamily | 102 | ✅ |
| .editorconfig / .gitattributes / CI / CONTRIBUTING | 102 | ✅ |
| HiDPI / Wayland 缩放 | P5-07a | 待 |
| XDG 存档 | P5-07b | 待 |
| 伪 Terminal 文言战报 | P5-07c | 待 |
| 金石黑框组件库 | P5-07d | 待 |
| woff2 字重扩展 + README 工程师段 | P5-07e | 待 |

---

*文档版本: v1.0 | 2026-07-18 | Session 102 新建：Linux UI 与跨平台字体规范。资产闭环/FontBarrier/.editorconfig/.gitattributes/CI 已实装，Linux UI 适配 + 开源筑巢留 P5-07a~e*