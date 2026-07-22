# CREDITS — Late Eastern Han Dynasty 第三方素材来源声明

## 地图数据

| 素材 | 来源 | 许可证 |
|:----|:-----|:------|
| `client/public/geo-basemap.png` | [Natural Earth](https://www.naturalearthdata.com) 50m 地理数据，通过 `scripts/render-geo-basemap.py` 渲染 | **公有领域**（Natural Earth 明确声明无版权限制） |

## 古籍/历史文献引用

本项目中以下古籍内容属公有领域，引用仅作设计参考：

- **《孙膑兵法》**——阵型定义与名称来源（formations.json historicalSource）
- **《武经总要》**——阵型定义补充来源
- **《三国志》（陈寿）**——历史武将生平、子女数据来源
- **《后汉书》《资治通鉴》**——历史事件参考
- **《三国演义》（罗贯中）**——演义典故、单挑名场面、人物形象参考

## 地理坐标

城池治所 `lon/lat` 取自公开地理常识与 WGS84 公开坐标（开发时曾对照在线地图校验），**不包含任何第三方地图瓦片、截图或专有数据文件**。底图仅使用上方 Natural Earth 公有领域数据。

## 开发截图

`docs/screenshots/` 仅保留 Natural Earth 底图时代的自产 UI/调试图（约 18 张）。早期未知来源插画底图的校准截图、Google Maps 校准截图均已移出仓库与 git 历史。

## 第三方代码库

本项目使用以下开源库，遵循各自许可证（均为 MIT/BSD/Apache-2.0，与项目 MIT 协议兼容）：

| 库 | 许可证 |
|:---|:------|
| React | MIT |
| Vite | MIT |
| Express | MIT |
| Zustand | MIT |
| Konva.js | MIT |
| react-konva | MIT |
| Tailwind CSS | MIT |
| axios | MIT |
| Zod | MIT |
| vitest | MIT |
| ws | MIT |
| cors | MIT |
| TypeScript | Apache-2.0 |

## Assets

All third-party assets will be documented here.

Before using external assets, verify:
- license compatibility
- redistribution permission
- attribution requirements

### 新增视觉素材登记字段

每个外部图片、拓片切片或生成式候选素材必须记录：文件路径、来源 URL、作者/机构、具体许可、获取日期、SHA-256，以及必要的生成工具/模型/提示词和条款快照。古代文物本体进入公有领域，不代表博物馆网站提供的照片或扫描文件自动采用 CC0；无法证明具体数字文件再分发权时不得入库。

生成式图片同样不自动等于 CC0，也不承诺零侵权风险。本项目正式头像资产默认优先采用自行编写的 SVG/Canvas/CSS 程序化图形。
