# Session 215：CMD-P11 外交现状审计与可复现基线

> 范围：S20 / S08 既有外交入口迁移前审计。本文只记录当前行为与后续信息架构，
> 不新增入口、不改变规则、不迁移运行时 JSX。
>
> **后续状态回注（Session 216）**：CMD-P12 已将只读势力选择与关系摘要接入命令坞；
> 旧左栏仍是进贡、献美、结盟唯一写入口，本文其余内容继续作为迁移对照基线。

## 一、结论与边界

现有唯一生产入口是左栏“外交”手风琴，以目标势力卡片纵向排列进贡、献美、点化、结盟。
权威状态来自 Zustand `game` 快照，写操作经既有 store action 调既有 `/api/game` 端点。

后续外交抽屉建议拆为：

```text
势力｜交涉｜盟约
```

- **势力**：先选目标，再查看关系、友好与可用动作，避免“势力数 × 动作数”卡片膨胀。
- **交涉**：承接已实装的进贡、献美；未来动作只登记设计，不造假按钮。
- **盟约**：承接已实装的结盟及成功率说明；停战、互不侵犯、求援等未实装能力不造假按钮。
- **点化女间谍**：虽混排在旧外交卡片，权威端点是 `/intel/plant-female`，归属 S07 情报。
  外交迁移不得复制其表单；后续应以跨域导航意图打开“情报·点化”。

本批不迁移运行时 UI，不新增外交玩法，不改变成功率、成本、外交阶段加成或存档结构。

## 二、旧入口完整清单

| 能力 | 权威来源/派生 | 客户端草稿与门槛 | 唯一 store action → API |
|---|---|---|---|
| 目标卡片 | `factions`、`diplomacy`；关系标签、友好、势力颜色 | 无；仅存终审目标 id | 只读 |
| 进贡 | 任一己方城金、友好、政治阶段倍率 | `confirm={tribute,target}`；需总金≥200；战争会转敌对 | `tribute()` → `POST /diplomacy/tribute` |
| 献美 | 双方 `beautyStock`、友好、`intel.plantableBeauty` | `confirm={gift-beauty,target}`；库存≥1、非战争 | `giftBeautyDip()` → `POST /diplomacy/gift-beauty` |
| 结盟 | 关系、友好、shared `calculateAllianceChance` | `confirm={alliance,target}`；非战争/非同盟、友好≥30、金≥500 | `formAlliance()` → `POST /diplomacy/alliance` |
| 点化（跨域） | `intel.plantableBeauty`、目标库存、金 | `confirm={plant-female,target}`；点化额度≥1、目标库存≥1、金≥80 | `plantFemale()` → `POST /intel/plant-female` |

所有终审继续复用唯一 `CommandConfirmDialog`，取消不提交；确认前从最新 Zustand 快照复验目标、
关系和资源，服务端再次执行最终校验。结盟无论成败均扣金并消费一次权威 RNG。

## 三、可复现浏览器基线

`pnpm verify-cmd-p11-headless` 固定 1440×900、英雄集结曹操局，覆盖：

- 旧外交入口和 3 个目标卡片存在；
- 战争目标献美/结盟禁用并显示原因；
- 进贡终审取消权威状态不变；按初始友好连续确认至 30、日志为 `tribute`；
- 结盟终审显示成本与成功率；取消不消费 RNG/金，确认后日志为 `alliance`；
- 3 个点化按钮存在，但明确只作为跨域混排基线，不算外交写入口；
- 控制台 error 为 0；缺元素或断言不符直接失败，不静默跳过。

献美的库存增减、点化额度与政治阶段倍率，以及结盟成功/失败固定 seed，继续由
`verify-negotiation-r2`（40/40）覆盖；P11 不为浏览器制造测试专用库存或 RNG 接口。

## 四、后续迁移约束

1. 先接只读势力选择与关系摘要，再迁进贡/献美，最后迁结盟。
2. 新旧入口短暂对照时必须读取同一权威快照并调用同一 store action/API。
3. 点化改为跨域导航，不在外交抽屉复制 S07 表单。
4. 原子切换时物理删除旧外交 JSX、本地 `confirm` 分支和 action 绑定，并断言旧 DOM=0、
   进贡/献美/结盟各自可提交入口恰为 1。
