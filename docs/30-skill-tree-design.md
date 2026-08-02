# 技能树与天赋点数系统设计

> 对应 S25 技能树系统（注册 24→25 大系统）。  
> 关联：04-game-systems.md §26（特性系统）、12-system-map.md、09-roadmap.md

---

## 一、设计目标

1. **技能树化**：通用技能从平级列表改为树状结构，节点间有前置依赖，玩家逐层解锁
2. **点数自由加点**：通过 merit 等级获得技能点，玩家自主分配，可有限重置
3. **特性点数化**：特性（被动天赋）保持独立体系，但改为点数购买等级（不再自动随属性解锁）
4. **与现有系统兼容**：不推翻既有 skills.json 数据，不改变专属技能/兵种战法/阵型精通

---

## 二、五层能力模型（更新版）

| 层 | 本质 | 点数化 | 树状 | 说明 |
|------|------|:------:|:----:|------|
| **通用技能** | 主动施放的战术 | ✅ 技能点购买/升级 | ✅ 树状前置 | 本系统核心 |
| **专属技能** | 一人独有招牌 | ❌ 保持固有 | ❌ | 不树化，不点数化 |
| **特性（被动天赋）** | 被动·条件触发 | ✅ 特性点购买等级 | ❌ 独立列表 | 点数化但不树化 |
| 隐藏属性 | 纯数值 | ❌ | ❌ | 保持固有 |
| 出身标签 | 身份分类 | ❌ | ❌ | 保持固有 |

---

## 三、技能树模型

### 3.1 树结构定义

每棵技能树由节点（Node）和有向边（Edge）组成：

```ts
interface SkillTreeNode {
  id: string;                    // 唯一标识，如 'fire', 'fire_adv'
  skillId: string;               // 关联 skills.json 的 id（叶节点必填，中间节点可选）
  name: string;
  description: string;
  category: 'tactics' | 'strategy' | 'governance' | 'charisma' | 'logistics';
  maxLevel: number;              // 该节点可加点次数（通常 1 或 5）
  costPerLevel: number;          // 每级消耗技能点数
  prerequisites: string[];       // 前置节点 id 列表（全部满足才可解锁）
  /** 节点类型 */
  nodeType: 'skill' | 'passive' | 'gate';
  /** 效果（skill 节点：引用 skills.json 的 levels；passive 节点：直接定义效果） */
  effects?: {
    type: string;
    value: number;
    description: string;
  }[];
  /** 图标/视觉分类 */
  icon?: string;
}
```

### 3.2 初始技能树（0-A 30 技能）

0-A 30 通用技能按**生效战斗层**分为 5 棵子树：

| 子树 | 技能 | 生效层 |
|------|------|--------|
| **战略计策树** | 火计/水计/落石/伏兵/离间/妖术/幻术 | 六角战场 |
| **战术计策树** | 挑拨/沉着/激励 | 六角战场 + 白刃战 |
| **单挑技能树** | 勇武/急攻/固守/沉着 | 单挑 |
| **统军树** | 疾驰/强行军/急攻/固守/远射/布阵/重整/奇袭/骑术/弓术 | 六角战场 + 白刃战 + 战役层 |
| **内政树** | 农政/商政/筑城/征兵/训练/寻访/辩才/医术 | 内政 |

> **布阵**（阵型切换/布阵加成）→ 统军树，六角战场 + 白刃战 + 战役层生效。  
> **洞察**（识破伏兵/计策）→ 战略计策树，六角战场 + 白刃战生效。  
> **沉着**（免疫挑衅/威压）→ 战术计策树 + 单挑技能树（跨树节点，两树均可加点）。  
> **急攻/固守**（连击/格挡）→ 统军树 + 单挑技能树（跨树节点，两树均可加点）。

每棵树 3~4 层深度，根节点为入门技能（无前置），叶节点为进阶/精通技能。

### 3.3 示例：战略计策树

```
Lv1: 火计 ──→ Lv2: 火攻 ──→ Lv3: 火海
  │
  ├──→ Lv2: 水计 ──→ Lv3: 水攻 ──→ Lv4: 水淹
  │
  ├──→ Lv2: 伏兵 ──→ Lv3: 伏击
  │
  └──→ Lv2: 洞察 ──→ Lv3: 识破
```

### 3.4 节点跨区标注

每个技能节点标注生效层，用于 UI 展示和引擎路由：

```ts
interface SkillTreeNode {
  // ... 其他字段
  /** 生效战斗层 */
  domains: ('battlefield' | 'melee' | 'duel' | 'campaign' | 'civil')[];
}
```

### 3.4 与现有 skills.json 的关系

- `skills.json` 保持不动（数据真源）
- 技能树节点通过 `skillId` 引用 skills.json
- 节点 `maxLevel` 与 skills.json 的 `maxLevel` 解耦（树节点可设 maxLevel=1 表示"解锁即 Lv1"，或 maxLevel=5 表示"可加点至 Lv5"）
- 运行时：`Officer.skillTreeState: Record<string, number>` 记录每个节点的当前等级（0=未解锁）

---

## 四、点数系统

### 4.1 技能点来源

绑定 **merit 等级**（已有 20 级系统）：

| merit 等级 | 获得技能点 | 累计 |
|:----------:|:----------:|:----:|
| 1~5 | 每级 +1 | 5 |
| 6~10 | 每级 +2 | 15 |
| 11~15 | 每级 +3 | 30 |
| 16~20 | 每级 +4 | 50 |

**公式**：`skillPoints = sum(max(0, meritLevel - 4) for each level) + 5`  
简化：`skillPoints = floor(meritLevel * (meritLevel + 1) / 10) + 4`（近似）

**初始**：开局时根据武将初始 merit 等级一次性结算技能点。  
**新增**：merit 升级时立即获得对应技能点。

### 4.2 特性点来源

与技能点**同源**（merit 等级），但分配池独立：

- 每 5 级 merit 获得 1 特性点（Lv5/10/15/20 各 +1，共 4 点）
- 特性点只能用于购买/升级特性等级

### 4.3 重置规则

- **技能点重置**：消耗金 500 + 行动力 1，全量返还技能点（树状态清空）
- **特性点重置**：消耗金 300 + 行动力 1，全量返还特性点
- **限制**：每季度最多重置 1 次（防止反复试错刷最优解）
- **免费重置**：武将更换势力时免费重置一次

### 4.4 运行时存储

```ts
// Officer 新增字段
interface Officer {
  // ... 现有字段
  /** 技能树状态：nodeId → 当前等级（0=未解锁） */
  skillTreeState?: Record<string, number>;
  /** 已消耗的技能点数（用于校验，防止溢出） */
  skillPointsSpent?: number;
  /** 特性等级状态：traitId → 当前等级（0=未拥有） */
  traitLevels?: Record<string, number>;
  /** 已消耗的特性点数 */
  traitPointsSpent?: number;
}
```

所有字段 optional，旧档兼容。

---

## 五、特性点数化（调整方案）

### 5.1 现状

04§26 设计：42 项特性×5 级，属性天花板封顶（不可超越）。原设计是"自动随属性解锁"。

### 5.2 调整后

- 特性保持 42 项×5 级、5 大类、属性天花板封顶不变
- **改为点数购买**：每级消耗 1 特性点，达到属性天花板后不可继续加点
- 特性点来源：merit Lv5/10/15/20 各 +1（共 4 点，可升满 4 个 Lv1 或 1 个 Lv4）
- 特性不树化（无前置依赖），保持独立列表

### 5.3 特性点消耗

| 特性等级 | 消耗特性点 | 属性天花板要求 |
|:--------:|:----------:|:--------------:|
| Lv1 | 1 | 无 |
| Lv2 | 1 | 对应属性 ≥ 60 |
| Lv3 | 1 | 对应属性 ≥ 80 |
| Lv4 | 1 | 对应属性 ≥ 90 |
| Lv5 | 1 | 对应属性 ≥ 97 |

---

## 六、UI 设计

### 6.1 OfficerDetail 新增「技能」tab

与 stats/关系/装备/列传 并列，显示名「技能」。

**布局**（自上而下）：

1. **技能点概览**：当前技能点 / 已消耗 / 总点数 + 重置按钮
2. **技能树面板**（主区域）：
   - 顶部 tab 切换 5 棵子树（战术/谋略/内政/人事/统军）
   - 每棵子树以**树状图**展示（SVG 自绘，节点=技能，连线=前置依赖）
   - 已解锁节点高亮（等级数字），可加点节点闪烁提示，未满足前置节点灰色锁定
   - 点击节点弹出详情（名称/描述/当前等级/效果/消耗/加点按钮）
3. **特性面板**（下方折叠区域）：
   - 特性点概览
   - 42 项特性按 5 大类分组列表
   - 已拥有特性高亮，可购买特性显示消耗+属性要求
   - 点击特性弹出详情（效果/当前等级/加点按钮）

### 6.2 交互

- 加点：点击节点/特性 → 弹出确认 → 消耗点数 → 即时生效
- 重置：点击重置按钮 → 确认弹窗（显示消耗） → 全量返还
- 树状图支持缩放/平移（节点多时）

### 6.3 技术实现

- 树状图：纯 SVG 自绘，递归布局（从上到下分层），零新依赖
- 节点状态通过 `skillTreeState` 驱动
- 点数校验在客户端预检 + 服务端二次校验

---

## 七、数据 Schema 变更

### 7.1 shared/types/officer.ts

```ts
// Officer 新增
skillTreeState?: Record<string, number>;  // nodeId → level
skillPointsSpent?: number;
traitLevels?: Record<string, number>;     // traitId → level
traitPointsSpent?: number;
```

### 7.2 shared/types/skill-tree.ts（新文件）

```ts
export interface SkillTreeNodeDef {
  id: string;
  skillId?: string;
  name: string;
  description: string;
  category: 'tactics' | 'strategy' | 'governance' | 'charisma' | 'logistics';
  maxLevel: number;
  costPerLevel: number;
  prerequisites: string[];
  nodeType: 'skill' | 'passive' | 'gate';
  effects?: { type: string; value: number; description: string }[];
  icon?: string;
}

export interface SkillTreeDef {
  id: string;
  name: string;
  nodes: SkillTreeNodeDef[];
}
```

### 7.3 shared/validators/index.ts

- OfficerSchema 新增 skillTreeState/skillPointsSpent/traitLevels/traitPointsSpent（均为 optional）
- 新增 SkillTreeNodeSchema / SkillTreeDefSchema

### 7.4 存档兼容

所有新字段 optional，旧档加载时缺失 = 空对象/0，按初始 merit 补发技能点。

---

## 八、服务端

### 8.1 数据文件

`server/src/data/skill-trees.json`：5 棵子树定义（节点+前置+消耗）

### 8.2 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/game/skill-trees` | 返回技能树定义（静态） |
| GET | `/api/game/officer/:id/skills` | 返回武将技能树状态+点数 |
| POST | `/api/game/skill-tree/upgrade` | 加点：`{officerId, nodeId}` |
| POST | `/api/game/trait/upgrade` | 特性加点：`{officerId, traitId}` |
| POST | `/api/game/skill-tree/reset` | 重置技能点：`{officerId}` |
| POST | `/api/game/trait/reset` | 重置特性点：`{officerId}` |

### 8.3 加点逻辑

```ts
function upgradeSkillNode(state, officerId, nodeId) {
  const officer = state.officers[officerId];
  const tree = getSkillTreeDef();
  const node = findNode(tree, nodeId);
  // 校验：前置已满足、点数足够、未达 maxLevel
  // 扣除点数，更新 skillTreeState
  // 如果 node.skillId 存在且 nodeType='skill'，同步更新 officer.skills
}
```

### 8.4 初始化

- 开局/武将加入时：根据 merit 等级计算应得技能点，初始化 skillTreeState（空）
- 旧档加载：缺失字段补默认值，按 merit 补发技能点

---

## 九、与现有系统的衔接

| 系统 | 关系 | 处理 |
|------|------|------|
| **merit 功绩** | 点数来源 | merit 升级时触发技能点发放（`grantMerit` 扩展） |
| **skills.json** | 技能定义真源 | 技能树节点引用 skillId，加点时同步 officer.skills |
| **专属技能** | 不受影响 | 保持固有，不树化 |
| **兵种战法** | 不受影响 | 保持适性驱动 |
| **阵型精通** | 不受影响 | 保持双轴成长 |
| **04§26 特性** | 被替换 | 原"自动随属性解锁"改为点数购买，42 项×5 级+属性天花板不变 |
| **merit Lv10 自选技能** | 被吸收 | 技能树加点自然覆盖此效果 |
| **S18 子女技能继承** | 不受影响 | 子女初始技能点由出生时 merit 决定 |

---

## 十、实施计划

### Phase 1 — 数据与引擎（本轮）

1. 新建 `shared/types/skill-tree.ts`（SkillTreeNodeDef / SkillTreeDef）
2. 新建 `server/src/data/skill-trees.json`（5 棵子树，0-A 30 技能映射）
3. `shared/validators/index.ts` 新增 schema
4. `shared/types/officer.ts` 新增字段
5. 引擎 `shared/skill-tree.ts`：加点/校验/点数计算/重置纯函数
6. 引擎 `shared/trait-points.ts`：特性点计算/加点校验
7. 服务端 API 5 个端点 + 初始化逻辑
8. `grantMerit` 扩展：升级时发放技能点/特性点

### Phase 2 — 前端（本轮）

1. OfficerDetail 新增「技能」tab
2. 技能树 SVG 组件（树状图渲染）
3. 加点/重置交互
4. 特性面板（折叠列表）
5. 点数概览

### Phase 3 — 文档（本轮）

1. 本文档定稿
2. `12-system-map.md` 注册 S25（24→25）
3. `04-game-systems.md` §26 更新（特性点数化标记）
4. `03-data-models.md` / `06-api-design.md` / `07-ui-design.md` / `08-data-dictionary.md` 同步
5. `09-roadmap.md` 排期行
6. 双写 `10-progress.md` / `HANDOFF.md`

### Phase 4 — 验证

- shared 单测：点数公式/加点校验/前置依赖/重置/旧档兼容
- `verify-skill-tree` 脚本：数据完整性（节点引用存在/无环/前置可达）
- Headless Chrome：技能 tab 渲染/加点/重置/特性面板/console error=0
- 回归：typecheck / test / lint / validate-data

---

## 十一、边界与后置

| 项 | 状态 | 说明 |
|----|:----:|------|
| 专属技能树化 | ❌ 后置 | 专属技能保持一人独有，不树化 |
| 兵种战法树化 | ❌ 后置 | 保持适性驱动体系 |
| 阵型精通树化 | ❌ 后置 | 保持双轴成长体系 |
| 技能树全量 69 技能 | ❌ 0-B | 0-A 只映射 30 通用技能 |
| 特性全量 42 项 | ❌ 0-B | 0-A 只实现首批特性（数量待定） |
| 洗点消耗品/道具 | ❌ 后置 | 重置消耗固定金+行动力 |
| 技能树动画/特效 | ❌ 后置 | 本轮纯 SVG 静态树状图 |
| AI 自动加点 | ❌ 后置 | 本轮仅玩家手动加点 |
