# 17 · 玩家选择抉择系统（已实装）

> **状态**：Session 109 已实装；190事件链已使用 `decisionOfficerId` 动态解析决策势力。
> **目的**：当历史事件涉及的武将属于玩家势力时，玩家可亲自抉择；否则由 AI 自动选择。
> **关联**：`shared/types/event.ts`、`server/src/engine/event.ts`、`shared/types/faction.ts`

---

## 一、问题

### 1.1 改造前现状

改造前事件系统仅通过 `EventTemplate.decisionFactionId` 决定谁来抉择：

```typescript
// Session 109 改造前逻辑
const playerDecides = evt.decisionFactionId == null || evt.decisionFactionId === s.playerFactionId;
if (evt.autoChoice == null && playerDecides) {
  pending.add(evt.id);  // 玩家抉择
} else {
  const choiceIndex = evt.autoChoice ?? chooseForAi(s, evt);  // AI 自动选择
}
```

**问题**：`decisionFactionId` 是**静态绑定**到固定势力的。以190场景为例：

| 事件 | decisionFactionId | 玩家选刘备时 |
|------|-------------------|-------------|
| E112 曹操崛起 | 1（曹操） | AI 自动选择，玩家无法介入 |
| E115 曹操收编黄巾 | 1（曹操） | AI 自动选择 |
| E106 阳人之战 | 3（孙坚） | AI 自动选择 |
| E109 联军瓦解 | 2（袁绍） | AI 自动选择 |

这意味着**玩家选任何非曹操势力，曹操线事件全部由 AI 代劳**，失去了"扮演曹操"的体验。

### 1.2 目标

- 当事件涉及的**历史武将**属于**玩家势力**时 → 玩家抉择
- 当该武将属于 **AI 势力**时 → AI 自动选择
- 支持**动态归属**：武将可能在游戏过程中转换势力

---

## 二、设计方案

### 2.1 核心思路：`decisionOfficerId` 动态解析

在 `EventTemplate` 中新增可选字段 `decisionOfficerId`，运行时根据该武将的**当前所属势力**动态决定谁来抉择。

```
优先级：decisionOfficerId（动态）> decisionFactionId（静态）> 无人决定
```

### 2.2 类型变更

#### shared/types/event.ts

```typescript
export interface EventTemplate {
  // ...existing fields...

  /** 静态绑定：指定势力决策（旧逻辑，保留兼容） */
  decisionFactionId?: number;

  /** 动态绑定：指定武将决策，运行时解析其当前所属势力 */
  decisionOfficerId?: number;
}
```

### 2.3 引擎变更

#### server/src/engine/event.ts — resolveDecisionFaction()

```typescript
function resolveDecisionFaction(state: GameState, evt: EventTemplate): number | undefined {
  // 优先级1：decisionOfficerId（动态）
  if (evt.decisionOfficerId != null) {
    const officer = state.officers[evt.decisionOfficerId];
    if (officer?.faction != null) {
      return officer.faction;
    }
    // 武将不在任何势力 → fallback 到 decisionFactionId
  }

  // 优先级2：decisionFactionId（静态）
  return evt.decisionFactionId;
}
```

#### tickEvents() 修改

```typescript
const decidingFaction = resolveDecisionFaction(state, evt);
const playerDecides = decidingFaction == null || decidingFaction === s.playerFactionId;
```

#### resolveEventChoice() 修改

```typescript
const decidingFaction = resolveDecisionFaction(state, evt);
if (decidingFaction != null && decidingFaction !== state.playerFactionId) {
  throw new Error('该事件不由玩家势力决策');
}
```

### 2.4 Zod Schema 变更

#### shared/validators/index.ts

```typescript
const EventTemplateSchema = z.object({
  // ...existing fields...
  decisionFactionId: z.number().int().positive().optional(),
  decisionOfficerId: z.number().int().positive().optional(),  // 新增
  // ...
});
```

---

## 三、边界情况处理

| 情况 | 处理方式 |
|------|----------|
| 武将死亡（faction=null） | fallback 到 decisionFactionId；若也没有，任何玩家可抉择 |
| 武将被俘（faction=俘获势力） | 按俘获势力判断，俘获方玩家可抉择 |
| 武将叛逃到第三方势力 | 动态跟随新势力，新势力玩家可抉择 |
| 多玩家模式（未来） | 每个玩家独立判断：自己势力是否为决策方 |
| decisionOfficerId + decisionFactionId 都没有 | 无势力绑定，任何玩家可抉择（全局事件） |

---

## 四、后续影响评估

### 4.1 确定影响
- 事件触发逻辑变化：`tickEvents()` 中 `playerDecides` 判断条件改变
- 前端 UI：需要显示"谁在抉择"（可能需要武将头像/名字）

### 4.2 待确认影响
- **多人模式**：未来若支持多玩家，每个玩家需独立判断决策方
- **事件日志**：`actionLog` 中需记录"谁做了选择"
- **存档兼容**：`eventChoices` 记录格式是否需要扩展
- **AI 性格权重**：`aiPersonalityWeights` 是否需要根据武将当前势力动态调整

### 4.3 风险点
- 武将频繁换势力可能导致事件决策方混乱
- 需要确保 `resolveDecisionFaction()` 在 `conditions` 检查之前执行（避免条件依赖错误的决策方）
