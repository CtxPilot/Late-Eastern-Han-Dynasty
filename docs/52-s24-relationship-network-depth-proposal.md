# S24 关系网深度闭环：义兄弟结义、宿敌誓仇与师徒授业方案立项

> **会话**：Session 454 | **大系统**：S24 关系网系统 / S11 人事系统 / S10 战斗系统  
> **文档定位**：系统设计与规格立项（遵循 `docs/00-dev-constitution.md`、`docs/04-game-systems.md` §4 与 `docs/12-system-map.md`）

---

## 一、背景与动机

在此前的关系网建设中：
1. **静态与亲和度模型已就位（Session 284 & 338）**：
   - 建立了 `relations.json` 静态关系表与 `GameState.relationAffinities` 运行时亲和度覆写机制；
   - 实现了同城（same_city）、出征（joint_expedition）、被俘（captured）、获释（rescued）与联姻（married）的基础亲和度演变。
2. **然而关系网长期缺乏核心玩法消费与战略闭环**：
   - **不可主动缔结深层关系**：玩家无法在游戏中主动促成武将「义结金兰」或「拜师授业」，人物人脉缺乏养成与经营乐趣；
   - **缺乏战场协同与羁绊激燃**：刘关张同生共死的「桃园之誓」与同袍死战在六角战中毫无体现；
   - **缺乏宿敌恩仇与血仇锁闭**：武将在战阵被杀后家属同袍毫无反应，宿敌在野或被俘时依然可以被仇敌君主轻易招降（如关羽斩颜良后袁绍依然可平价登用关羽），违背历史演义常理；
   - **师徒传承未有实际点拨**：诸葛亮传授姜维兵书等典故缺乏成长提携机制。

本方案在 **零 RNG 漂移（Zero RNG Perturbation）**、**数据与存档向后完全兼容**、**双端离线 Worker 同源** 的严格宪法前提下，全栈落地义兄弟、宿敌誓仇与师徒授业三大核心机制，全面闭环战场羁绊、人事锁闭与人脉养成。

---

## 二、架构设计与核心规则

### 1. 义兄弟（Sworn Brotherhood · 桃园之誓）

#### 1.1 缔结门槛与约束
- **发起条件**：
  1. 两人同属于玩家势力，且当前处于同一城池（status: 'active'）；
  2. 两人当前不是仇敌（`!isNemesis`），且亲和度 $\ge 80$（达到「亲密」状态）；
  3. 两人此前未结为义兄弟，且双方当前已结义兄弟数均 $< 2$（一人一生最多 2 位结义兄弟，即最高形成桃园「三结义」格局）；
  4. 扣除城池国库 200 金（置办乌牛白马、金兰酒席）。
- **建立结果**：
  - 写入 `state.runtimeRelations`（type: `'sworn'`，双向互通）；
  - 亲和度锁定提升至 $100$（亲密顶格）；
  - 写入大事记 `actionLog`（如：“【金兰之契】关羽与张飞义结金兰，誓同生死，祸福相共！”）。

#### 1.2 机械效果闭环
- **六角战场羁绊（Battle Synergy）**：
  - **并肩作战**：同战场存活的义兄弟单位普攻与反击伤害各 $+5\%$，暴击率 $+5\%$；
  - **同袍死战（Blood Oath Fury）**：当同战场有任一义兄弟单位溃退/阵亡（`isDestroyed`），存活的义兄弟立即进入「同袍死战」状态：
    - 士气瞬间暴涨 $+15$ 点（上限突破至 120）；
    - 攻击力额外提升 $+10\%$；
    - 免疫混乱与动摇，战报特别标明 `〔同袍死战〕`！
- **忠诚永固（Unyielding Loyalty）**：
  - 同处一势力时，武将季度忠诚自然衰减 $100\%$ 豁免；
- **义不降敌（Refusal to Surrender）**：
  - 若武将被俘，而其结义兄弟仍在原势力存活且效力，则敌方登用判定直接锁定拒绝（“吾有结义兄弟在彼，宁死不降！”）。

---

### 2. 宿敌誓仇（Nemesis & Blood Feud · 血仇不仕）

#### 2.1 结仇来源
1. **静态历史宿敌**：
   - 诸葛亮 ↔ 司马懿、曹操 ↔ 袁绍、关羽 ↔ 庞德、孙策 ↔ 黄祖等；
2. **战阵击斩结仇（Dynamic Blood Feud）**：
   - 当武将在战役/战棋战阵中被敌军击斩（killed）时，死者的**结义兄弟**、**师徒**与**直系父子**，自动与行刑者/击杀主将建立 `enemy` 宿敌关系；
   - 亲和度骤降至 $-100$（仇敌底线）；
   - 写入大事记（如：“【血海深仇】张飞誓杀庞德，誓报同袍关羽之仇！”）。

#### 2.2 机械效果闭环
- **血仇不仕（Unforgiving Blood Feud）**：
  - 人事登用（`recruitOfficer`）时，若招揽方势力君主或说客是该在野/俘虏武将的宿敌，招揽立即强制拦截失败，提示“血仇未雪，誓不事仇寇！”；
- **战意激荡（Nemesis Duel & Strike）**：
  - 六角战中攻击目标若为宿敌单位，暴击率额外 $+10\%$，反击率 $+10\%$，战报显式批注 `〔宿敌血战〕`；
- **势同水火**：
  - 若因城陷迫不得已同处一势力同城，每季忠诚额外自然扣除 10 点，直至有人离开或下野。

---

### 3. 师徒授业（Master & Disciple Mentorship · 授业传经）

#### 3.1 拜师门槛与约束
- **发起条件**：
  1. 师徒两人同属玩家势力，且同在一城（status: 'active'）；
  2. 师傅最高属性（武力/统帅/智力/政治）$\ge 75$，且至少有一项属性高于徒弟 $\ge 10$ 点；
  3. 徒弟当前无师傅（每人仅限 1 位师傅），师傅当前收徒 $< 2$ 人；
  4. 双方非宿敌，亲和度 $\ge 40$（友好或以上）；
  5. 扣除城池国库 100 金（束脩拜师之礼）。
- **建立结果**：
  - 写入 `state.runtimeRelations`（type: `'master_disciple'`，有向师 $\to$ 徒）；
  - 亲和度提升至 $90$；
  - 写入大事记（如：“【名师高足】姜维正式拜入诸葛亮门下，执弟子礼，授业传道！”）。

#### 3.2 机械效果闭环
- **授业点拨（Mentorship Annual Growth）**：
  - 每年正月（1 月月结），若师徒同城，师傅为徒弟进行一次传道解惑点拨：
    - 徒弟在师傅高于自身的优势属性中，随机一项永久 $+1$ 点（每年最多 1 点，成长上限为师傅对应属性 $-2$ 点）；
    - 产生大事记叙事（如：“诸葛亮授姜维以兵法韬略，姜维统帅提升 1 点！”）；
- **经纬协同（Cooperative Guidance）**：
  - 师徒同队出征或同城政务时，内政开发效率 $+10\%$，计策成功率与识破率 $+10\%$；
- **桃李归心**：
  - 师傅登用自己的在野徒弟时，成功率直接额外 $+30\%$。

---

## 三、数据模型设计

```typescript
// shared/relations.ts
export interface RuntimeRelation {
  fromId: number;
  toId: number;
  type: RelationType;
  establishedYear?: number;
  establishedMonth?: number;
  note?: string;
}

// shared/types/game.ts
export interface GameState {
  // ...既有字段
  runtimeRelations?: RuntimeRelation[];
}
```

---

## 四、接口与端点契约

### 1. HTTP 路由
- `POST /api/game/relations/swear-brotherhood`
  - Body: `{ officerAId: number, officerBId: number }`
  - Response: `{ success: true, game: GameState }`
- `POST /api/game/relations/appoint-mentorship`
  - Body: `{ masterId: number, discipleId: number }`
  - Response: `{ success: true, game: GameState }`

### 2. 双端 Worker 与 API 映射
- `client/src/workers/game.worker.ts` 实现 `swearBrotherhood` 与 `appointMentorship`
- `client/src/services/api.ts` 与 `offline-api.ts` 导出同名异步接口
- `scripts/verify-s416-worker-parity.mjs` 5/5 门禁对齐

---

## 五、验收标准与门禁

1. **专项验证**：新建 `server/src/scripts/verify-s52-relationship-network-depth.ts`，注册 `pnpm verify-s52-relationship-network-depth`，覆盖：
   - 门槛校验（亲和/同城/金钱/上限/属性优势）；
   - 义兄弟建立、亲和锁定与忠诚自然衰减豁免；
   - 六角战义兄弟并肩伤害加成与「同袍死战」激燃；
   - 战阵击斩动态结仇（nemesis 生成）与亲和坠跌；
   - 宿敌「血仇不仕」登用硬门禁拦截；
   - 六角战宿敌战意暴击增益；
   - 师徒拜师、每年正月授业点拨成长闭环；
   - 离线 Worker 镜像与持久化 Schema 校验。
2. **回归门禁**：
   - `turn-golden.test.ts` 3/3 严格匹配零漂移；
   - `node scripts/verify-s416-worker-parity.mjs` 5/5 全通；
   - `pnpm typecheck` 全项目 0 错误；
   - `pnpm test` 全项目测试全通；
   - `pnpm validate-data` 全量通过；
   - `pnpm verify-compliance` 合规扫描全通。

---

## 六、落地状态（Session 454 实装）

### 6.1 已交付

| 模块 | 落点 |
|------|------|
| 数据模型 | `shared/relations.ts` `RuntimeRelation` / `RuntimeRelationSchema` / `GameState.runtimeRelations?`；`GameStateEntitiesSchema` 严格校验（悬空武将、自指拒绝） |
| 资格与查询（共享） | `checkSwornBrotherhoodEligibility` / `checkMentorshipEligibility` / `mentorshipGrowthTarget` / `swornAllyBattleBonus` / `nemesisBattleBonus` / `hasFallenSwornBrother` / `applySwornFury` / `findRecruitNemesis` / `bloodFeudAvengerIds` / `hasSwornBrotherInFaction` |
| 引擎 | `server/src/engine/relationDepth.ts`：`swearBrotherhood` / `appointMentorship` / `tickMentorshipAnnual` / `tickNemesisCoexistenceQuarter` / `registerBloodFeud` |
| 月结 | `turn.ts`：每年正月授业点拨、季度宿敌同城忠诚惩罚；`mandateEffects.ts`：义兄弟忠诚自然衰减豁免 |
| 人事 | `personnel.ts`：血仇不仕硬门禁（掷点/扣金前，零 RNG） |
| 战斗 | `engine/battle.ts` + `battle/simpleAi.ts` + `battle/crit.ts`：义兄弟伤害/暴击、宿敌暴击/反击、同袍死战；单挑与战役阵斩触发血仇 |
| 服务/端点 | `doSwearBrotherhood` / `doAppointMentorship` + `POST /api/game/relations/swear-brotherhood`、`/appoint-mentorship`；Worker 双镜像 + parity 别名 |
| UI | OfficerDetail 关系 tab `BondTab`：运行时关系回显 + 同城缔结入口 |
| 验证 | `verify-s52-relationship-network-depth` **53/53**；`verify-s52-relationship-network-ui` **7/7**（真实 Chrome，console 0） |

### 6.2 与原案的偏差（诚实边界）

1. **授业点拨属性选择**：原案「随机一项 +1」改为**确定性取师傅领先最多的属性**（并列按统/武/智/政/魅固定序），避免引入新 RNG 消费点、守护金样零漂移；`lastGrowthYear` 保证每年每对最多 1 点。
2. **同袍死战士气上限**：原案「突破至 120」与 `BattleUnit.morale` Zod 上限 100 冲突，实装封顶 100。
3. **免疫混乱/动摇**：未实装（需逐条改状态施加点），另行切片。
4. **加成范围**：义兄弟/宿敌数值仅作用于六角**普攻**（玩家与敌军 AI），战法/火计/白刃三选不生效。
5. **义不降敌（被俘拒绝招降）**：当前无「俘虏登用」入口，未实装；「血仇不仕」已在在野登用路径生效。
6. **静态历史关系同样纳入消费**：`relations.json` 的 sworn/enemy 与运行时关系合并使用（刘关张、诸葛亮↔司马懿开箱即生效）。
7. **血仇生成边界**：仅对已标 `DEAD` 的阵亡者生成；残部退守「被斩未标死」路径不触发（沿 Session 439 口径）。

### 6.3 后续可选

- 同袍死战免疫混乱/动摇、战法路径羁绊加成；
- 被俘登用与「义不降敌」；
- 关系面板的筛选/图谱联动运行时关系；
- AI 主动结义/收徒（策略层）。
