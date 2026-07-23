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

### 郡县历史地理资料（BF-P0 南郡 190 切片）

| 资料 | 公共入口 | 本项目用途 | 当前状态 |
|:----|:---------|:----------|:---------|
| 司马彪《续汉书·郡国志》（收入《后汉书》卷一百一十二，志第二十二·郡国四） | [维基文库](https://zh.wikisource.org/zh/%E5%BE%8C%E6%BC%A2%E6%9B%B8/%E5%8D%B7112)、[中国哲学书电子化计划](https://ctext.org/hou-han-shu/zh) | 南郡十七城、郡治、侯国身份及部分山泽津渡注 | 2026-07-23 已逐条用于南郡基线；维基文库页有未校对提示，两入口属同一原典传统 |
| 陈寿《三国志》卷六《刘表传》及裴注 | [维基文库](https://zh.wikisource.org/zh/%E4%B8%89%E5%9C%8B%E5%BF%97/%E5%8D%B706) | 190 年前后刘表军襄阳的年代复核 | 2026-07-23 已校勘；不据“军襄阳”推定当年另置襄阳郡 |
| 陈寿《三国志》卷五十四《周瑜传》及裴注 | [维基文库](https://zh.wikisource.org/zh/%E4%B8%89%E5%9C%8B%E5%BF%97/%E5%8D%B754) | 208 年后南郡、江陵战争的年代边界 | 2026-07-23 已校勘；不倒写进 190 县表 |
| 郦道元《水经注》卷三十二《沮水》 | [维基文库](https://zh.wikisource.org/zh/%E6%B0%B4%E7%B6%93%E6%B3%A8/32) | 临沮—当阳—枝江的沮水/漳水相对次序 | 2026-07-23 已用于路线与地貌 |
| 郦道元《水经注》卷三十四《江水》 | [维基文库](https://zh.wikisource.org/zh/%E6%B0%B4%E7%B6%93%E6%B3%A8/34) | 巫—秭归—夷陵—夷道—枝江—江陵沿江次序、荆门虎牙、江津 | 2026-07-23 已用于路线与地标 |
| 郦道元《水经注》卷三十五《江水》 | [维基文库](https://zh.wikisource.org/zh/%E6%B0%B4%E7%B6%93%E6%B3%A8/35) | 华容、夏水、涌水及东南水网 | 2026-07-23 已用于路线与地貌 |

以上原典本体属于公有领域；不同网站的现代标点、排版、扫描图和整理成果可能另有权利。
本项目只记录自行校勘所得的结构化事实与人工相对布局，不再分发网站扫描图或现代地图。
详细字段级判断、版本风险和存疑见 `docs/22-nanjun-historical-geography-collation.md`。

## 地理坐标

城池治所 `lon/lat` 取自公开地理常识与 WGS84 公开坐标（开发时曾对照在线地图校验），**不包含任何第三方地图瓦片、截图或专有数据文件**。底图仅使用上方 Natural Earth 公有领域数据。BF-P0 南郡县级数据未填写未经充分核验的 `lon/lat`；其 `localX/localY` 与点线面均为本项目人工编订的归一化示意，并逐条标注 `approximate` / `inferred`。

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
