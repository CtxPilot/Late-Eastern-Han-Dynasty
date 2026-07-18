# 工程字体资产目录（跨平台防御铁律）

> **铁律**：本目录是项目唯一允许的字体来源。禁止在任何 CSS/Canvas/Konva 代码中引用宿主系统字体。
> 详见 `docs/00-dev-constitution.md` §11.3、`AGENTS.md` 核心规则 9、`CONTRIBUTING.md` 跨平台字体铁律条款。

## 需要手动放入的 woff2 文件

字体文件**不入 git**（`.gitignore` 排除 `*.woff2`），由开发者本地放入本目录。

| 文件名 | 字体 | 授权 | 用途 | 工程内部别名 |
|---|---|---|---|---|
| `NotoSerifCJKsc-Regular.woff2` | 思源宋体 SC Regular | SIL OFL 1.1 | 正文/古籍史料 | `HanDynastySerif` (normal) |
| `NotoSerifCJKsc-Bold.woff2` | 思源宋体 SC Bold | SIL OFL 1.1 | 标题加粗 | `HanDynastySerif` (bold) |
| `MuYaoSoftBrush.woff2` | 马善政体 (Ma Shan Zheng) | SIL OFL 1.1 | 官印/篆书/大标题 | `HanDynastySeal` |

> **说明**：原计划用沐瑶软笔体，但未找到可确认授权的稳定 woff2 源，改用 Google Fonts 的
> `马善政体 (Ma Shan Zheng)`——SIL OFL 1.1 授权明确、CDN 稳定、毛笔楷书风格接近印章/篆书需求。
> 文件名保留 `MuYaoSoftBrush.woff2` 以维持工程内部别名稳定，避免改 @font-face 与全库引用。

## 下载来源（开源免版权）

- **思源宋体 SC**：https://github.com/notofonts/noto-cjk/releases （SIL OFL 1.1）
  - 本目录已通过 `@fontsource/noto-serif-sc` npm 包镜像下载
- **马善政体 (Ma Shan Zheng)**：Google Fonts 开源字体，SIL OFL 1.1
  - 本目录已通过 `@fontsource/ma-shan-zheng` npm 包镜像下载

## 本目录文件已就位（Session 102 实装）

3 个 woff2 文件已实际下载到位（共 ~7MB）：
- `NotoSerifCJKsc-Regular.woff2` (~2.0MB)
- `NotoSerifCJKsc-Bold.woff2` (~2.1MB)
- `MuYaoSoftBrush.woff2` (~2.7MB)

`.gitignore` 已排除 `*.woff2`，字体不入 git，但本目录文件可在本地直接使用。

## 字体未放入时的行为

`client/src/utils/fontBarrier.ts` 使用 `document.fonts.load('12px HanDynastySerif')` 阻塞等待。
- 若 woff2 文件缺失，FontFace API 抛 `Failed to load font` 异常，游戏**拒绝启动**并显示错误提示（防乱码/豆腐块）。
- 这是故意的防御行为，不是 bug。请按上表放入 woff2 文件后重启。

## 为什么不打包进 git

- 思源宋体 SC 全字重约 10MB，打包进 git 会让仓库膨胀，影响贡献者 clone 体验。
- `.gitattributes` 标 `*.woff2 binary`，若日后决定入 git，git 不会做行尾转换破坏二进制。
- 未来可考虑 git-lfs 管理（需 `git lfs install`），但会增加贡献者门槛。