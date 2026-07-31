# Session 234 · CMD-P29 计略原子切换与跨情报导航总验收

## 结论

S17 美人计、离间计、假情报、空城疑兵已完成原子切换。命令坞“计略”现为四计唯一玩家
入口；左栏旧 `PlotPanel` 已从组件树和源码物理删除。

## 实现边界

- “计略·发起”新增“前往情报·探秘”，通过命令壳 `select-command` 切换到 `intel/recon`
  导航意图。
- S07 探秘、女间谍及其权威写链没有复制进计略；情报域仍明确指向当前左栏谍报面板。
- 复用既有 `launchPlot`、`POST /api/game/plot/launch` 与 S17 引擎；未改 API、规则、
  数值、RNG、Schema 或存档。

## 验证

- client 11 文件 31 项全过；client typecheck、全仓 lint、validate-data、diff-check 全绿。
- `verify-plot-spy-rng` 34/34，覆盖四计权威创建与确定续玩。
- `CDP_PORT=9238 pnpm verify-cmd-p29-headless` 在 1440×900 实际点击通过：
  - 旧 `PlotPanel` DOM=0、旧 `btn-plot-launch`=0；新写入口恰好1个。
  - 四计选项完整；美人计缺情报时显示具体前置并可正式切到情报域。
  - 离间计终审取消保留草稿且不写状态；确认扣金200，生成 `sowDiscord / prep`，
    “进行中”即时同步。
  - console error=0。

## Next

保持 S20，一次只迁移一个大系统。下一域先做 CMD-P30 情报迁移前审计与浏览器基线，
固化 S07 招募、训练、派遣、俘虏处置以及与 S17 的边界；本轮不直接搬写链。
