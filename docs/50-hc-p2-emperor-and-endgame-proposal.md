# HC-P2 称帝主线与天下一统终局胜负条件实施方案

> 系统归属：S08 外交 / S11 人事 / S12 官职爵位 / S26 天命人心的终极闭环。  
> 上游方案：`docs/26-hegemony-court-design.md` §HC-P2、`docs/28-hc-p1-king-design.md`、`docs/40-game-evaluation.md` §二「目标与戏剧性」。  
> 核心目标：实装 HC-P2 称帝主线（双路径：受禅让即位 vs 自主称帝，国号年号、天命跃升、帝国官职）与战役级终局胜负条件（天下一统开国史诗结算 vs 身死国灭终局），彻底解决项目缺乏终局胜利的重大短板。

---

## 一、现状与设计动机

### 1. 现状实勘
1. **政治阶段断层**：
   - `politicalStage` 目前支持 `vassal`（诸侯）、`hegemon`（霸府）、`king`（王），但 `emperor`（皇帝）阶段未开放操作；
   - 称王（HC-P1）已完备（领城≥25%、霸府沉淀≥12月、皇权≥80、王国六职、王命封爵公），但称王后政治进程停滞，无法问鼎九五。
2. **缺乏战役级终局胜负**：
   - `docs/40-game-evaluation.md` 明确指出：目前全项目只有单场战斗的 victory/defeat，当玩家扫平天下所有割据势力、占领全部城池后，游戏依然无休止推进月份，没有天下一统开国大典，缺乏成就感与叙事终点；
   - 同样，当玩家势力全城沦陷灭亡时，游戏亦缺乏明确的战败终局结算。

---

## 二、架构设计与核心规则

### 2.1 HC-P2 称帝条件（Emperor Requirements）

严格遵循线性政治阶段进阶：`vassal` → `hegemon` → `king` → `emperor`（不可跳级、不可逆）。

1. **前置阶段**：`politicalStage === 'king'`（已称王）。
2. **城池规模门槛**：
   $$cityThreshold = \text{scenario.emperorRequirements?.minCities} \mathbin{??} \max(5, \lceil contestableCityCount \times 0.50 \rceil)$$
   - 称王需开局争夺城池的 25%，称帝需开局争夺城池的 50%（如 190 切片需 4 城，英雄集结需 15 城）。
3. **称王时间沉淀（politicalStageAgeMonths）**：
   - 称王阶段必须维持 $\ge 12$ 个月（4 季），阻止刚称王立即称帝，确保政治沉淀。
4. **皇权点数（imperialAuthority）**：
   - 基础门槛 90 点（可受传国玉玺/兵符/相国印等威信宝物加成 `equipAuthorityBonusFor`）；称帝成功后扣除 90 点。
5. **双路径即位判定（禅让 vs 自主即位）**：
   - **受禅代汉（Abdication）**：若本势力控制汉献帝（`controlsEmperor`）或持存《传国玉玺》（Item ID 15），则为「承汉天命，受禅登基」，全势力忠诚稳定，天下正统承认；
   - **自主称帝 / 改元（Autonomous）**：若未控天子且无玉玺，则为「自主登基 / 僭号」，天命虽立，但所有未承认势力好感 -20，原汉臣忠诚震荡。

### 2.2 称帝状态转移与帝国特权

称帝确认后：
- `politicalStage = 'emperor'`；
- `politicalTitle = '{kingdomName}帝'`（如魏帝、蜀帝、吴帝、汉帝、晋帝等）；
- 确立开国年号（`eraName`，如黄初、章武、黄龙、建安、太始等，若剧本未配置则派生默认年号）；
- `politicalStageChangedYear = state.currentYear`，`politicalStageAgeMonths = 0`；
- **天命跃升**：天命值直接提升至 80~100（`mandate-popular.ts` 中天然 `+50`）；
- **外交天命威慑**：结盟率提升 `+15` 百分点，进贡/献美收益 `×1.5`（`hegemonyAllianceModifier` 接入）；
- **臣属封爵极值**：臣属封爵上限由公（Duke）提升至王（King，封异姓王/宗室王）；
- **解锁帝国九卿与三公官制**。

---

### 2.3 天下一统与身死国灭终局体系（Endgame System）

#### 1. 终局条件定义
- **天下一统（Unification Victory）**：
  - 玩家势力存活（`isAlive === true`）；
  - 天下所有其他割据势力均已灭亡（`Object.values(state.factions).filter(f => f.isAlive && f.id !== playerFactionId).length === 0`）；
  - 或玩家势力领有全部纳入争夺的城市（`cityIds.length >= contestableCityCount`）。
- **身死国灭（Defeat Game Over）**：
  - 玩家势力丧失全部城池（`cityIds.length === 0`），标记为 `isAlive = false`，且军团全部覆灭。

#### 2. 状态模型（GameState.endgameResult）
```ts
export interface EndgameResult {
  type: 'unification_victory' | 'defeat';
  achievedYear: number;
  achievedMonth: number;
  rulerName: string;
  rulerOfficerId: number;
  factionName: string;
  kingdomName?: string;
  politicalTitle?: string;
  eraName?: string;
  totalYearsElapsed: number;
  totalCitiesConquered: number;
  capitalCityName: string;
  topMeritOfficers: Array<{
    name: string;
    meritLevel: number;
    title: string;
  }>;
  chronicle: string[]; // 霸业年谱纪要
}
```

#### 3. 权威月结与即时检查
- 在 `turn.ts` 月结管线中，月度推进与所有 AI/战役结算完成后执行 `checkEndgameStatus(state)`；
- 在占领最后一城后即时触发；
- 若已产生终局，将 `endgameResult` 写入 `state` 并记录史诗级 `actionLog`；
- 旧存档缺省兼容，零 RNG 消耗，金样测试零漂移。

#### 4. UI 呈现
- 当 `game.endgameResult` 存在且弹窗未关闭时，以古典金石朱砂巨幅卷轴呈现「天下一统·开国纪年」大典；
- 包含：开国皇帝御玺印信、改元诏书、开国第一功臣表、天下版图一统年表、通关评语；
- 提供「永存留念（返回主界面）」与「继续推演（沙盒模式）」选项。

---

## 三、实施计划（分步落子）

1. **`@leh/shared` 基础架构扩展**：
   - `shared/types/hegemony.ts`：增加 `EmperorRequirements`、`EmperorRequirement` 接口；
   - `shared/types/game.ts`：声明 `EndgameResult` 类型；
   - `shared/game-state-entity-schema.ts`：在 `GameStateSchema` 中纳管可选 `endgameResult` 字段。
2. **服务端引擎实现（`server/src/engine/`）**：
   - `server/src/engine/hegemony.ts`：实现 `getEmperorRequirements(state, factionId)` 与 `proclaimEmperor(state, factionId, eraName)`；
   - `server/src/engine/endgame.ts`：实现 `checkEndgameStatus(state)`，汇总年谱与开国功臣；
   - `server/src/engine/turn.ts`：在月结尾部集成终局检查（无任何 RNG 消费，保护金样指纹）；
   - `server/src/engine/campaign.ts` 与 `march.ts`：破城灭国后联动终局检查。
3. **API 与网络镜像通道**：
   - 添加 `GET /api/game/hegemony/emperor-requirements`；
   - 添加 `POST /api/game/hegemony/proclaim-emperor`；
   - 同步更新 routes、services、worker、api、store。
4. **客户端 UI 呈现**：
   - `CourtCommandDrawer.tsx`：当势力处于 `king` 阶段时显示「称帝进程」与门槛进度，支持选择开国年号、送交称帝终审确认；
   - `EndgameModal.tsx`：天下一统开国大典与身死国灭史诗弹窗。
5. **专项验收与全仓回归**：
   - 新增 `server/src/scripts/verify-s50-emperor-and-endgame.ts`；
   - 验证：双路径称帝、国号年号、天命跃升、全图统一终局、战败终局、严格零 RNG 漂移（`turn-golden.test.ts` 3/3 绿）；
   - 双写文档更新。
