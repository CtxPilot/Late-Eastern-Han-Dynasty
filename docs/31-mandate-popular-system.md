# 天命-人心双轨系统设计

> 对应 S26 天命人心系统（注册 26→27 大系统）。  
> 关联：04-game-systems.md（忠诚/民心/功绩）、26-hegemony-court-design.md（HC-P2 天命）、12-system-map.md

---

## 一、设计定位

**上层封装**：不替换现有忠诚/民心/legitimacy 系统，双轨从现有数据派生/聚合，减少破坏性。

| 维度 | 本质 | 范围 | 获取方式 | 影响 |
|------|------|------|----------|------|
| **天命值** | 势力宏观运势 | 势力级，0~100 | 统一州郡+5/郡、完成历史功绩+10、民心≥80 每季+1、控制天子+20、称王+30、称帝+50 | 外交权重修正、AI 态度权重、禅让/称帝事件触发门槛 |
| **人心值** | 微观人际关系聚合 | 势力级，0~100 | 善待武将（赏赐/任命/不杀俘）+1~3、公正赏罚（功绩发放）+1、战场同生共死（一同出征）+1、施米（民心≥70）+1/季 | 武将叛逃概率修正、城池抵抗强度、募兵效率 |

---

## 二、数据模型

### 2.1 Faction 新增字段

```ts
interface Faction {
  // ... 现有字段
  /** 天命值 0~100，势力宏观运势 */
  mandate: number;
  /** 人心值 0~100，微观人际关系聚合 */
  popularWill: number;
}
```

### 2.2 派生公式（纯函数，shared/mandate-popular.ts）

**天命值** = 基础值 + 统一郡县加成 + 历史功绩加成 + 政治阶段加成 + 民心加成

```ts
function computeMandate(faction: Faction, game: GameState): number {
  let base = 0;
  // 统一州郡：每控制一个郡 +5
  const ownedCommanderies = countOwnedCommanderies(faction.id, game);
  base += ownedCommanderies * 5;
  // 历史功绩：merit 事件累计
  base += faction.totalMeritEvents * 10;
  // 政治阶段
  if (faction.politicalStage === 'emperor') base += 50;
  else if (faction.politicalStage === 'king') base += 30;
  else if (faction.politicalStage === 'hegemon') base += 20;
  // 控制天子
  if (faction.controlsEmperor) base += 20;
  // 民心加成：全势力城池民心均值 ≥ 80 时每季 +1
  const avgPopular = averageCityPopular(faction.id, game);
  if (avgPopular >= 80) base += 1;
  return Math.min(100, Math.max(0, base));
}
```

**人心值** = 武将忠诚均值 × 0.5 + 城池民心均值 × 0.3 + 关系网状态 × 0.2

```ts
function computePopularWill(faction: Faction, game: GameState): number {
  const avgLoyalty = averageOfficerLoyalty(faction.id, game);
  const avgPopular = averageCityPopular(faction.id, game);
  const relationScore = averageRelationScore(faction.id, game);
  return Math.min(100, Math.max(0,
    avgLoyalty * 0.5 + avgPopular * 0.3 + relationScore * 0.2
  ));
}
```

### 2.3 月度结算（turn.ts）

每回合自动重算天命值和人心值（派生，不存储增量）。

---

## 三、效果接入

### 3.1 天命值效果

| 天命值区间 | 外交权重修正 | AI 态度 | 特殊 |
|:----------:|:----------:|:--------:|:----:|
| 0~20 | -20% | 轻视 | — |
| 21~40 | -10% | 普通 | — |
| 41~60 | 0% | 普通 | — |
| 61~80 | +10% | 敬畏 | 称帝事件前置条件之一 |
| 81~100 | +20% | 畏惧 | 禅让事件可触发 |

### 3.2 人心值效果

| 人心值区间 | 叛逃概率修正 | 城池抵抗 | 募兵效率 |
|:----------:|:----------:|:--------:|:--------:|
| 0~20 | +50% | 抵抗+30% | -40% |
| 21~40 | +20% | 抵抗+15% | -20% |
| 41~60 | 0% | 标准 | 0% |
| 61~80 | -20% | 抵抗-15% | +20% |
| 81~100 | -40% | 抵抗-30% | +40% |

---

## 四、UI 展示

### 4.1 势力总览（FactionOverviewDrawer）

命令坞新增「势力」入口，打开后显示：

1. **天命值**：进度条 + 数值 + 当前区间标签（天命未显/天命初显/天命渐盛/天命所归/天命在身）
2. **人心值**：进度条 + 数值 + 当前区间标签（人心涣散/人心浮动/人心安定/人心所向/众志成城）
3. **明细**：天命来源（郡县数/功绩/政治阶段/天子控制/民心）各贡献值；人心来源（忠诚均值/民心均值/关系均值）各贡献值
4. **效果预览**：当前天命/人心值对应的外交修正/叛逃概率/募兵效率

### 4.2 技术实现

- 纯展示组件，无交互操作
- 数据从 `GET /api/game/faction/overview` 获取
- 与现有命令坞抽屉风格一致

---

## 五、实施计划

### Phase 1 — 数据与引擎

1. `shared/types/faction.ts` 新增 mandate/popularWill
2. `shared/mandate-popular.ts` 纯函数（computeMandate/computePopularWill）
3. `shared/validators` 同步 schema
4. 服务端 `turn.ts` 月度结算接入

### Phase 2 — 前端

1. 服务端 `GET /api/game/faction/overview` 端点
2. 客户端 `FactionOverviewDrawer.tsx` 组件
3. 命令坞注册「势力」入口

### Phase 3 — 文档

1. 本文档定稿
2. `12-system-map.md` 注册 S26（26→27）
3. `04-game-systems.md` / `06-api-design.md` / `07-ui-design.md` 同步
4. 双写 `10-progress.md` / `HANDOFF.md`

---

## 六、边界与后置

| 项 | 状态 | 说明 |
|----|:----:|------|
| 天命影响 AI 外交决策 | ❌ 后置 | 属 S15 AI 深化 |
| 禅让/废立事件链 | ❌ 后置 | HC-P2 范畴 |
| 人心影响城池自发抵抗 | ❌ 后置 | 需城池攻防引擎扩展 |
| 天命/人心历史曲线图 | ❌ 后置 | 前端增强 |
