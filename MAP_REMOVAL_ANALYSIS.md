# 大地图退役分析（MAP_REMOVAL_ANALYSIS）

> Session 379 · Phase 1 只读分析固化。**本轮替换的是 L0 世界屏 UI，不是删除历史地理数据。**
> 后续 Phase 2~7（WorldGraph 形式化 / 荆州深挖 / legacy 物理搬迁）见实施计划，不在本文件执行范围内。

---

## 1. 当前地图架构（五层）

| 层 | 名称 | 空间模型 | 主文件 | 与连续大地图关系 |
|----|------|----------|--------|------------------|
| L0 | 行政世界屏 | 30 城像素坐标 + Natural Earth 底图 | `client/src/components/map/MapCanvas.tsx` | **本轮退役目标** |
| L1 | 战役行军 | 数字 `cityId` 图 + `CITY_ROAD_EDGES` BFS | `server/src/engine/campaign.ts`、`shared/city-roads.ts` | 已解耦 |
| L2 | 郡域战场 | 字符串县 id + `localX/Y` 抽象 SVG | `BattlefieldSceneView.tsx`、`historical-geography/*` | 保留（非全国轮廓） |
| L3 | Tier I 战场 | 节点卡片网格 | `BattlefieldMapView.tsx` | 保留 |
| L4 | 六角战术 | 100×100 hex | `BattleView.tsx` | 保留（局部网格） |

补充：

- **无**运行时 GeoJSON / 州郡界 Polygon 涂色；势力色在城点 `Circle.fill`。
- GeoJSON 仅存在于 `scripts/render-geo-basemap.py` 离线生成 `client/public/geo-basemap.png`。
- 荆州 Pilot 粒度实为 **南郡 190**（`nanjun-190.ts`），非荆州七郡全量县级图。

---

## 2. 依赖链（L0）

```
GameLayout
  └─ MapCanvas (Konva)
       ├─ geo-basemap.png
       ├─ MAP_GEO / lonLatToPixel / PROVINCE_LABELS (cities-geo-reference)
       ├─ allRoadEdges() (city-roads)
       ├─ mapLod / mapViewport
       └─ gameStore: selectedCityId, mapFocusCityId, clearMapFocus

LeftPanel → focusMapOnCity → mapFocusCityId → MapCanvas zoom-to-city
MapCanvas click city → selectCity → RightPanel / 命令坞选城契约
```

间接消费 `selectedCityId`（**不得断裂**）：CivilOverviewDrawer、MilitaryReadinessPanel、CampaignPanel、IntelOverviewDrawer、PersonnelRecruitDrawer、FarmingOverviewDrawer、AppointPanel 等。

PWA：`leh-pwa-precache` 仍会缓存 `geo-basemap.png`（本轮暂留资产，后续 Phase 再摘预缓存）。

---

## 3. A / B / C / D 分类

### A. 可直接废弃（UI / 别名）

| 项 | 说明 |
|----|------|
| `MapCanvas` 作为世界屏主交互 | 改由 `StrategicWorldView` 挂载 |
| `WorldMap.tsx` | 已 `@deprecated` re-export |
| `mapLod.ts` / `mapViewport.ts` | 仅服务 MapCanvas；迁 legacy 后无运行时调用 |
| 旧插画 `map.png`（若仍残留文档引用） | 已被 geo-basemap 取代 |

### B. 地理数据必须保留

| 项 | 说明 |
|----|------|
| `shared/data/cities-geo-reference.ts` | WGS84 / 像素投影 / 州名锚点 / 0-B 105 清单 |
| `shared/data/historical-geography/*` | 六郡 bundle、Zod schema、年代过滤 |
| `server/src/data/cities.json` 的 `x`/`y`/`province` | 静态真源；本轮不删坐标字段 |
| `client/public/geo-basemap.png` + `scripts/render-geo-basemap.py` | 开发参考 / 未来复用 |
| `validFromYear` / `validToYear` / `variantOf` / `scenarioYear` | 历史时间能力 |

### C. 可重构 / 已是图（后续 WorldGraph Adapter）

| 项 | 说明 |
|----|------|
| `shared/city-roads.ts` | 宏观无向边；已可映射 RouteEdge |
| `HistoricalRouteDefinition` + `adjacentCountyIds` | 郡域 Node+Edge |
| `army-county-mapping.ts` BFS | 补给路径 |
| `CampaignArmy.path` / `planPath` | 宏观行军 |

### D. 其他系统仍依赖（不可随 L0 删除）

| 项 | 说明 |
|----|------|
| `selectedCityId` 契约 | 命令坞 / 右栏 |
| `CITY_ROAD_EDGES` | 出征邻接、AI、战役 |
| `Officer.location`（city id） | 人事可达性 |
| 郡域 `BattlefieldSceneView` | S21 / 离线验收 s376 |
| `BattleView` Konva | S10；仍需 fontBarrier |
| `generate-0a-data.ts` / validate-data | 数据管线 |

---

## 4. 本轮（P0）改造边界

**做：**

- 世界屏主区：`MapCanvas` → `StrategicWorldView`（天下→州→城卡片）
- store：`strategicView`；`focusMapOnCity` 改为驱动卡片层级 + `selectedCityId`
- MapCanvas 簇标记 deprecated / 移入 `map/legacy/`，**不物理删除**
- 文档：`07` §5.2、`10`/`12`/`35`/`HANDOFF`

**不做：**

- 删除 lon/lat/polygon/geometry 字段或 geo 脚本
- 七郡县级全量录入、`LocationNode` 大规模改名
- 人物/军队引擎重写
- 从 PWA 移除 geo-basemap（后置）

---

## 5. 潜在风险

| 风险 | 缓解 |
|------|------|
| 命令坞选城断裂 | 卡片点击必须写 `selectedCityId` |
| 验收脚本断言 `map-canvas` | 仓库 scripts 当前无命中；新 testid `strategic-world-view` |
| LeftPanel `focusMapOnCity` 空操作 | 改为 `openStrategicProvince` + selectCity |
| 地理认知下降 | 州/城卡展示邻道、控制势力、聚合资源；后续 Phase 4 可加抽象节点图 |
| fontBarrier 仍为 BattleView 所需 | 保留；注释改为不单服务 MapCanvas |

---

## 6. 结论

项目早已是 **节点图驱动玩法**；连续大地图主要是 L0 展示层。退役 MapCanvas 并切到层级卡片，是把 UI 真源对齐到 Historical World Graph 方向的最小安全切片，且不破坏历史数据资产。


---

## 7. Session 380 进度

- `shared/world-graph.ts` Adapter 已落地（宏观 / 郡域 / 荆州试点）。
- PWA 预缓存已排除 `geo-basemap.png`；文件仍在 `client/public/` 供开发参考。
