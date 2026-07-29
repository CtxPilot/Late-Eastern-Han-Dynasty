# Session 220：CMD-P16 军事现状审计与可复现基线

> 范围：S20 / S05、S10、S21 既有军事入口迁移前审计。本轮只建立边界、迁移顺序和
> Headless 基线，不把军事写操作接入命令坞，不删除旧入口，不改变规则、API 或存档。

## 一、结论

军事不是一个旧面板，而是三组不同层级的入口：

1. **右栏“军事操作”**：城池上下文内的征兵、训练与旧简化出征攻城；
2. **左栏“战役”**：Campaign Army 的编成、军队列表、强攻、劝降、撤退、参谋行动和设施；
3. **S21 战争场景**：大地图→郡域→局部交战→六角/自动结算，仍处 BF-P1 后续演进期。

因此不能像人事、外交一样把一个旧手风琴整段搬进抽屉。后续军事抽屉先固定为：

```text
军备｜编成｜军令｜战报
```

- **军备**：承接城池征兵、训练；先选己方城，不复制右栏城池状态。
- **编成**：承接 Campaign Army 出征草稿和既有权威校验。
- **军令**：承接已存在 Army 的阶段合法操作；只呈现当前阶段可用命令。
- **战报**：只读汇总 Army 状态、最近自动战斗结果与场景入口。
- 右栏旧“出征攻城”与 Campaign Army 是两套不同写路径，必须先做规则归并决策，不能双迁。
- S21 郡域/局部交战继续通过场景导航进入，不把战场微操塞进命令抽屉。

## 二、现有入口与权威写路径

| 入口/能力 | 草稿与门槛 | store action → API | 终审现状 |
|---|---|---|---|
| 右栏征兵 | 选中己方城、非 loading | `conscript()` → `/civil/conscript` | 无终审 |
| 右栏训练 | 选中己方城、非 loading | `trainTroops()` → `/civil/train` | 无终审 |
| 右栏简化出征 | 选中他方城、官道邻接己城兵≥1000 | `marchOnCity()` → `/march` | 统一终审，确认前复验 |
| 战役编成出征 | 出发城、主/副将、参谋、目标、兵种、阵型、兵粮 | `campaignStart()` → `/campaign/start` | 统一终审，确认前复验 |
| Army 行军 | 目标节点 | `campaignMarch()` → `/campaign/:id/march` | store/API 已有；当前 `CampaignPanel` 无独立提交控件 |
| 设施建造 | Army、设施类型 | `campaignBuild()` → `/campaign/:id/build` | 当前直接提交，无终审 |
| 强攻 | Army 为 `sieging/engaged` | `campaignAssault()` → `/campaign/:id/assault` | 统一危险终审 |
| 劝降 | Army 为 `sieging` | `campaignSiegeSurrender()` → `/campaign/:id/siege/surrender` | 统一终审 |
| 撤退 | Army 为 `marching/garrison` | `campaignRetreat()` → `/campaign/:id/retreat` | 统一终审 |
| 参谋行动 | 激励/陷阱/休整/斥候 | `campaignAdvisorAction()` → `/campaign/:id/advisor/action` | 当前直接提交，无终审 |

`campaignStart/assault/surrender/retreat` 已使用唯一 `CommandConfirmDialog`；设施与参谋行动
仍直接提交。迁移时必须先按风险决定是否补终审，不能因换壳默默改变既有交互。

## 三、迁移前必须解决的边界

1. **两套出征不可双活迁移**：`marchOnCity` 是城市→即时战斗旧简化链，
   `campaignStart` 是城市→Campaign Army→战役结算链。P17 只做只读军情，不迁任一写流程；
   P18 前须明确生产主路径和兼容下线方式。
2. **征兵/训练归属**：规则引擎/API 位于内政域，但玩家任务语义属于军备。军事抽屉可导航或复用
   唯一写表单，禁止与未来“内政”抽屉同时保留两份提交入口。
3. **场景边界**：S21 的郡域、局部交战与六角战斗是场景，不是抽屉页签。军事抽屉只负责下令、
   查看状态与进入场景。
4. **阶段驱动军令**：强攻、劝降、撤退、建造和参谋行动必须由最新 Army phase 派生；
   不得让玩家在抽屉里维护第二份 Army 状态。
5. **旧入口不是单点删除**：最终切换至少涉及 `LeftPanel` 战役手风琴、`RightPanel` 军事操作
   与所有地图/战场快捷入口，必须分批迁移后一次做负断言，不能提前删其中一条。

## 四、可复现浏览器基线

`pnpm verify-cmd-p16-headless` 固定 1440×900、英雄集结曹操局：

- 命令坞军事保持 `legacy`，展示“仍在战役与城池面板”，军事写按钮为 0；
- 自动寻找有兵粮且邻接敌城的己方城，打开旧“战役”并填写真实编成；
- 出征终审取消后城市、武将、Army、日志和 RNG 权威快照不变；
- 再次确认后实际扣除出发城 5000 兵、创建 Campaign Army，并写入 `campaign_start`；
- 旧战役入口保持 1；控制台 error 为 0；任一元素或断言缺失直接失败。

本基线只选择完整 Campaign Army 编成作为代表写链。简化出征、战役结算、场景回写和确定续玩
继续由既有 `verify-march-fog`、`verify-campaign`、BF/存档专项覆盖，不为 P16 制造测试接口。

## 五、建议拆分

- **CMD-P17**：只读军情总览；展示己方城军备、Campaign Army 和阶段摘要，新写按钮 0。
- **CMD-P18**：完成两套出征归并决策后，迁移“编成”唯一写链。
- **CMD-P19**：迁移 Army 阶段军令与战报/场景导航，不复制战场 UI。
- **CMD-P20**：迁移军备写链与跨域导航，明确征兵/训练唯一归属。
- **CMD-P21**：旧军事入口原子切换，旧 DOM=0、每项生产写入口=1，并重跑完整战争回归。

下一步仅执行 P17；不得在未处理两套出征语义前直接进入 P18。
