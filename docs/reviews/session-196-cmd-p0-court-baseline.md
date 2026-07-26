# Session 196 · CMD-P0 朝廷旧入口测试基线

> 日期：2026-07-26  
> 范围：迁移前旧 `LeftPanel → 君主` 手风琴；1440×900 Headless Chrome 真实点击。  
> 目的：为 CMD-P2/P4 验证功能对等提供不可变对照，不代表新命令坞已接入朝廷业务。

## 一、权威来源与旧入口映射

| 能力/展示 | 旧 UI 路径 | 当前来源/提交点 | 迁移后必须保持 |
|---|---|---|---|
| 君主姓名、政治头衔 | 左栏 → 君主 | `game.factions[playerFactionId]` + `game.officers[rulerId]` | 姓名、头衔即时一致 |
| 汉帝控制门槛 | 左栏 → 君主 | shared `controlsEmperor(game, factionId)` | 未控制时显示具体原因 |
| 政治阶段 | 左栏 → 君主 | `Faction.politicalStage ?? 'vassal'` | 诸侯/霸府状态不复制计算 |
| 皇权、伪诏冷却 | 左栏 → 君主 | `imperialAuthority ?? 0`、`imperialDecreeCooldown ?? 0` | 数值与服务端快照一致 |
| 开霸府 | 君主 → 开霸府 → 终审 | store `establishHegemony()` | 取消不提交；确认后 `hegemon`、皇权 100 |
| 伪诏宣战 | 君主 → 目标按钮 → 终审 | store `falseDecreeWar(targetId)` | 取消不扣皇权；确认后扣 40、冷却 8、关系 war |
| 霸府官职 | 人事 → 任命（旧君主项无写入口） | 既有 `AppointPanel`/appoint action | 朝廷只读总览不得复制任命 |

## 二、Headless Chrome 可复现路径

### A. 董卓：开霸府

1. 打开 `/`，点击“190 关东义兵”。
2. 选择“董卓政权”，点击“进入剧本”。
3. 点击左栏“君主”；看到董卓及“开霸府 / 迎奉天子·自立丞相”。
4. 点击“开霸府”；终审必须显示诸侯→霸府、不可撤销、皇权 100。
5. 点击“返回修改”；再次读取 `/api/game/state`，`politicalStage` 不变。
6. 再次打开终审并点击“确认下令”；状态变为 `hegemon`，君主项显示皇权 100、冷却就绪。

董卓在 190 开局已与可见目标交战，因此此路径只作为开府基线，不强行伪造可用伪诏目标。

### B. 英雄集结曹操：伪诏宣战

1. 点击“更换剧本”，选择“英雄集结”与“曹操军”，进入剧本。
2. 打开“君主”，按上述终审流程建立霸府。
3. 点击首个未交战且可用的 `[data-testid^="btn-false-decree-"]`。
4. 终审必须显示目标、战争状态、皇权 40、冷却 8 季。
5. 点击“返回修改”；皇权仍为 100，目标关系不变。
6. 迁移后的完整对等测试还须确认提交：皇权 100→60、冷却 0→8、目标关系→`war`。
   CMD-P0 为避免污染最终截图，只实际验证到取消；提交权威结果已有 HC-P0 确定性测试覆盖。

## 三、选择器基线与迁移要求

| 当前定位方式 | 稳定性 | CMD-P4 目标 |
|---|---|---|
| 中文按钮“君主” | 脆弱（按钮含展开箭头，无 test id） | `command-domain-court` |
| 中文按钮“开霸府” | 脆弱 | `command-court-establish-hegemony` |
| `btn-false-decree-{factionId}` | 已稳定 | 新入口保留语义兼容或同步脚本 |
| `command-confirm-dialog` | 已稳定 | 原位升级，不另造终审选择器 |
| 中文“返回修改/确认下令” | 中等 | CMD-P3 再补稳定选择器 |

原子切换验收时，除更新上述路径外，必须断言 DOM 中开霸府与伪诏各只有一个可提交入口。

## 四、本次证据

截图目录：`docs/screenshots/session-196-cmd-p0-baseline/`

| 文件 | 内容 |
|---|---|
| `01-old-monarch-entry.png` | 190 董卓旧“君主”入口与开府门槛 |
| `02-establish-hegemony-final-review.png` | 开霸府终审：不可逆与皇权 100 |
| `03-old-monarch-after-hegemony.png` | 提交后霸府、皇权与冷却状态 |
| `04-false-decree-final-review.png` | 英雄集结曹操伪诏终审：目标、40 皇权、8 季与战争 |

实测结果：四张截图成功保存；开府取消无状态变化、确认后变为霸府且皇权 100；伪诏取消不扣皇权；
浏览器脚本未观察到控制台错误。迁移后以相同权威断言逐项对比，而不是只比较截图。

## 五、CMD-P4 迁移结果（Session 199）

基线路径已迁为：
`command-domain-court → command-court-establish-hegemony / command-court-false-decree-* → command-confirm-*`。
可重复脚本为 `scripts/verify-cmd-p4-headless.mjs`。脚本完整提交开府与伪诏，断言
`vassal→hegemon`、皇权 `100→60`、冷却 `0→8`、目标关系 `war`、官制跳往人事，并在流程
前后两次断言旧“君主”按钮不存在、`btn-false-decree-*` 数量为 0。所有缺失目标或选择器均
直接抛错，没有条件跳过分支。
