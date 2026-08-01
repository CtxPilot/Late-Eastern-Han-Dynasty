# BF-P0 南郡 190 年历史地理校勘记录

> 状态：BF-P0 首批校勘完成（2026-07-23）。本文件记录资料判断与不确定性；代码真源为
> `shared/data/historical-geography/nanjun-190.ts`，Zod 真源为同目录 `schema.ts`。

## 一、切片与方法

- 剧本切片采用现有“英雄集结·开局即高光”明确的 `startYear: 190`。该剧本本身是假想玩法，
  行政地理仍采用 190 年可支持的史料口径。
- 基线取司马彪《续汉书·郡国志》、今收入《后汉书》卷一百一十二的南郡条。
- 《三国志》卷六《刘表传》证明灵帝崩后刘表代任荆州刺史并“军襄阳”，但这只是军政活动，
  不能单独证明 190 年已析置襄阳郡。因此史料口径仍认定南郡十七城；游戏模板按已批准的
  “战略节点与史实边界分离”原则，将襄阳表达为北部边界入口而非可争夺属县节点。
- 《三国志》卷五十四《周瑜传》的南郡、江陵战争发生在建安十三年（208）之后，只用作
  年代边界复核；不把 208 年后的战争格局倒写进 190 切片。
- 《水经注》成书晚于东汉，水系相对次序可用作地貌校核，但其中三国以后城戍、河道与地名
  不能自动视作 190 年行政事实。

## 二、属县结论

《郡国志》南郡条明载“十七城”，依次为：江陵、巫、秭归、中卢、编、当阳、华容、襄阳、
邔、宜城、鄀、临沮、枝江、夷道、夷陵、州陵、很山。史实清单完整保留在来源记录中；战场
可争夺县节点收录其中 16 个，襄阳因大地图独立战略节点而不重复生成：

- 郡治：江陵 1。
- 侯国：中卢、华容、邔、宜城、鄀、临沮、枝江 7。
- 一般县节点：秭归、编、当阳、夷道、夷陵、州陵 6。
- 边界节点：巫、很山 2；“frontier”是战场模板角色，不是原典行政等级。
- 边界入口：襄阳方向（北津入口）1；它保留襄阳史实方位与通路语义，不是
  `CountyDefinition`，也不是第二个可争夺襄阳实体。

县名、南郡隶属和原典明确标出的侯国身份属于 **attested 事实**。不过 `confidence` 同时覆盖
位置表达；由于 P0 没有采用未经核验的现代古城址坐标，县记录整体均标为 `approximate` 或
`inferred`，不能把该字段误读为“县名本身存疑”。

## 三、位置与地貌判断

- `localX/localY` 是人工编订的 0..1 郡域布局，不是 WGS84 古城址坐标；本批 `lon/lat` 全部留空。
- 有明确水系相对次序的江陵、巫、秭归、当阳、华容、临沮、枝江、夷道、夷陵标
  `approximate`。
- 中卢、编、邔、宜城、鄀、州陵、很山只有较弱的相对位置支撑，标 `inferred`。
- 很山最存疑：《郡国志》只补注“故属武陵”；其南部山地边界位置仅为原型连通布局。
- 华容“云梦泽在南”有明文，但古云梦泽范围、名称所指与后世河湖变迁复杂，因此泽区多边形
  标 `inferred`，不得作为精确岸线。
- `coast` 未使用：南郡为内陆江河湖沼环境，“沿江”不等于“沿海”。

## 四、路线与地标

共录 11 条路线：

- 8 条 `attested` 水路：长江沿巫—秭归—夷陵—夷道—枝江—江陵—华容的相对链，
  以及沮水沿临沮—当阳—枝江入江的链。
- 3 条 `inferred` 陆路：襄阳方向入口—宜城—当阳—江陵骨架。它们是让 P1 原型连通的保守人工编订，
  原典只支撑节点与大方向，不支撑一条已测绘的东汉道路。

共录 10 个地标：江水、沮水、漳水、沔水、夏水、云梦泽、荆山、荆门虎牙、江津、襄阳北津。
所有点、线、面几何均为示意。原典可直接确认名称/相对关系时，几何仍因非测绘而标
`approximate`；云梦范围标 `inferred`。

## 五、版本差异与后续门禁

1. 维基文库卷一百一十二页面自身标有“未校对”提示，本批以中国哲学书电子化计划作异站入口
   复核，但两者仍属于同一原典传统，不能算两份独立史料。
2. 简繁字形存在“很山/佷山”“邔”等显示差异；稳定 ID 不依赖显示字形。P4/P5 批量录入前
   应再对中华书局点校本或可靠影印本逐字核验，但不得把受版权保护的现代整理文本复制入库。
3. **已决议（2026-07-23）**：190 年史料口径下襄阳确属南郡；游戏大地图为保留其荆州
   军事、政治与交通可玩性，继续把襄阳作为独立战略节点。南郡战场不收录襄阳
   `CountyDefinition`，仅用“襄阳方向（北津入口）”连接大地图节点。这是有意的玩法偏离，
   不是史料错误；同一地点不得生成两个权威控制实体。
4. **已解决（2026-07-23）**：江陵 `countyCount` 已由演示占位 7 更新为史料口径 17。
   全仓引用审计确认该字段当前只存在于静态数据、类型、Zod 与生成脚本，不参与 UI 展示、
   内政、补给、战斗或其他运行时公式；战场实际节点仍以独立模板为准。

## 六、验收对照

| P0 验收项 | 结果 |
|------|------|
| 郡治、属县、方位、来源逐条可追溯 | 达成；史载 17 城完整记录，16 个战场县节点均有 `sourceRefs` 与位置说明，襄阳另作可追溯边界入口 |
| Zod、交叉引用、有效期、坐标、邻接对称性 | 达成；专用测试覆盖合法与非法样本 |
| 同一模板预览稳定、零 RNG | 达成；只读 preview 仅排序复制，无 RNG 依赖 |
| CREDITS 史料与地理来源登记 | 达成 |

## 七、Seed 录入规约（BF-P5 通用化）

> 本节从南郡与颍川的实际录入经验中提取通用流程，供后续郡国录入参考。
> 完整类型定义见 `shared/data/historical-geography/seed-schema.ts`。

### 7.1 文件结构

每个郡国一个 TS 文件：`shared/data/historical-geography/<commandery>-<year>.ts`。文件导出
`<commandery><year>: HistoricalGeographyBundle`，内部用 `CommanderySeed` +
`buildHistoricalGeographyBundle(seed, sources)` 构建。

### 7.2 录入步骤

1. **创建 CommanderySeed 壳**：填 id/name/province/seatCountyId/worldCityId/scenarioYear/sourceRefs。
2. **逐县录入 CountySeed**：
   - `id` 使用语义化稳定 ID（如 `nanjun_jiangling`）。
   - `role` 按史料选择：`seat`（郡治）、`county`（一般县）、`marquisate`（侯国）、`frontier`（边县/边界节点）。
   - `terrain` 从 8 种标签中选取（缺省 plain）。
   - `adjacent` 列出邻接县 ID，需双向对称。
3. **录入 LandmarkSeed（若有）**：
   - `geometry` 支持三种：`point`（关隘/渡口）、`polyline`（河流，≥2 点）、`polygon`（山脉/沼泽，≥3 点）。
   - `tacticalTags` 可标记 `boundary_entry` 等战场语义。
4. **配置路径**：
   - 纯陆路郡：不设 `routes`，`autoFillRoads` 缺省 true → 构建器从 adjacency 自动派生 road 路径。
   - 水路/关渡郡（如南郡）：显式录入 `RouteSeed[]`，设 `autoFillRoads: false`。
   - 混合郡：显式录入特殊路径，`autoFillRoads: true` 让构建器补全剩余 road。
   - `RouteSeed.from/to` 可引用县 id 或地标 id。
5. **补充 `HistoricalSource[]`**：每条必含 id/title/volume/entry/edition/url/accessedAt。
6. **运行校验**：`pnpm verify-historical-geography` 确认 OK + preview 一致。
7. **在 `index.ts` 注册**：将新 bundle 加入聚合导出数组，并同步更新 `verify-historical-geography.ts`
   的 bundles 数组。

### 7.3 命名规约

| 元素 | ID 格式 | 示例 |
|------|------|------|
| 郡 | `<province>_<commandery>_<year>` | `jing_nanjun_190` |
| 县 | `<commandery>_<county>` | `nanjun_jiangling` |
| 地标 | `<commandery>_<landmark>` | `nanjun_xiangyang_ferry` |
| 路径（自动） | `road_<from>__<to>` | `road_yingchuan_a__yingchuan_b` |
| 路径（显式） | `route_<descriptor>` | `route_yangtze_wu_zigui` |
| 史源 | `src_<序号或缩写>` | `src_xuhanshujunzhi` |

### 7.4 年代覆写（BF-P5，Session 257 实装）

> docs/21 Q4 方案 B 的最小 Schema 落地：以《郡国志》为基线，按剧本年份应用
> 建安改置覆写。**南郡/颍川 190 切片仍为单一年代**（全部条目 validFrom=To=190）；
> 多年代能力由测试夹具演示，不主张任何真实行政区划变更。

- `CountySeed`/`LandmarkSeed`/`RouteSeed`/`CommanderySeed` 均支持
  `validFromYear`/`validToYear`（**缺省 = `scenarioYear`**，即单一年代条目）。
- 自动派生 road（`autoFillRoads`）的有效期取两端县有效期的**交集**，
  避免越界年份产生悬空端点。
- 运行时按年份取模板用纯函数 `resolveBundleForYear(bundle, year)`
  （`shared/data/historical-geography/year-overrides.ts`）：
  过滤出该年有效子集并重新跑 Zod 校验。
- 语义要点：
  - 存活县的 `adjacentCountyIds`/`landmarkIds` 中，指向「存在但该年已过期」的
    引用会被剔除（裁撤后不可能仍相邻）；指向 bundle 内根本不存在 id 的引用
    不剔除、交由 Zod 拦截（防手误被静默吞掉）。
  - 郡治 `seatCountyId` 该年已过期 → 抛错。
  - 路径声明全时段而端点限时 → Zod 拦截（数据须声明一致的逐年代集合）。
- **严格性（BF-P5「无静默抽象回退」）**：请求年份无有效郡国定义、或过滤后
  引用断裂时抛错，不做静默回退。

### 7.5 校验脚本

```bash
pnpm verify-historical-geography
```

输出 `OK <郡名> (N counties, M routes, K landmarks)` 或 `FAIL`。退出码 1 表示失败。
新增郡国只需在 `verify-historical-geography.ts` 的 `bundles` 数组追加即可自动纳入。
