# 资产清单与准入状态

> 更新日期：2026-08-01。`pnpm verify-compliance` 会按当前 Git 跟踪文件逐项展开并校验本清单规则。

| 路径/集合 | 数量 | 来源与作者 | 许可 | 修改/生成方式 | 审批状态 |
|---|---:|---|---|---|---|
| `client/public/geo-basemap.png` | 1 | Natural Earth 50m；Natural Earth contributors | 公有领域 | `scripts/render-geo-basemap.py` 原创渲染 | 允许发布 |
| `docs/screenshots/**/*.png` | 125 | 本项目开发者在本项目 UI 中自产 | 项目 MIT；嵌入的 Natural Earth 仍为公有领域 | Playwright/浏览器本地截图 | 允许归档；`session-*` 不得作为当前营销图，新增逐次复核 |
| `client/public/fonts/NotoSerifCJKsc-*.woff2` | 2（本地、忽略） | notofonts / Adobe；通过 Fontsource 镜像 | SIL OFL 1.1 | WOFF2 打包 | 允许随 OFL 和校验表发布 |
| `client/public/fonts/MaShanZheng-Regular.woff2` | 1（本地、忽略） | Google Fonts / Ma Shan Zheng 作者；通过 Fontsource 镜像 | SIL OFL 1.1 | WOFF2 打包 | 允许随 OFL 和校验表发布 |

禁止项：`client/public/portraits/*.png`、商业游戏截图、无来源 Demo 截图、博物馆扫描图（无数字文件再分发许可时）、商业音效和未登记字体。

`assets/portraits/` 为禁止目录，即使被 `.gitignore` 排除也不得存在非空文件；合规门禁会主动检查该目录。

## 单文件可复核信息

- Natural Earth 输出 SHA-256：`6a1870cfb2ec530b7447b7f1d6138a05ab639424b3ac547f9c2e4e190fa7bce1`。
- 字体单文件 SHA-256、固定来源与取得日期见 `client/public/fonts/README.md`。
- 截图的逐文件路径和内容哈希由以下命令从发布基线生成，结果必须作为发布附件保存：
  `git ls-files 'docs/screenshots/*.png' | sort | xargs sha256sum`。
- 任一新增二进制在 PR 中必须补：路径、来源 URL、作者/机构、具体许可、取得日期、SHA-256、
  修改说明、生成工具/模型/提示词（若适用）、条款快照及审批人。
