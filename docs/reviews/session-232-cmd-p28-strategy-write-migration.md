# Session 232 · CMD-P28 计略四计写链迁移

## 结论

S17 美人计、离间计、假情报、空城疑兵的草稿与统一终审已迁入命令坞“计略·发起”。
P28 属迁移阶段：左侧旧 `PlotPanel` 暂保留一个写入口，待 P29 原子下线。

## 实现边界

- 复用现有 `launchPlot` store action、`POST /api/game/plot/launch` 与 S17 权威引擎。
- 未修改 API、规则、数值、RNG、Schema 或存档。
- 客户端按最新 `GameState` 复验：进行中上限4、单城支付金、detailed 情报、美女库存、
  女间谍空闲状态、离间目标存续/非己方/非盟友、空城归属/兵力/粮草。
- 取消终审保留草稿；成功后清除目标与女间谍选择。
- 探秘与女间谍业务仍归 S07；P29 只补跨域导航，不复制情报写链。

## 验证

- `pnpm --filter @leh/client test -- StrategyOverviewDrawer.test.ts`：3/3。
- `pnpm verify-plot-spy-rng`：34/34，覆盖四计权威创建与确定续玩。
- `CDP_PORT=9238 pnpm verify-cmd-p28-headless`：1440×900 实点通过。
  - 四计选项齐全；美人计/假情报/空城显示明确禁用原因。
  - 新离间计取消后草稿保留且权威状态不变。
  - 确认后扣金200，生成 `sowDiscord / prep`，进行中摘要即时同步。
  - 新旧写入口各1；控制台错误0。
- shared 19文件198项、client 11文件31项全过；typecheck、lint、validate-data、build、
  `git diff --check` 全绿。构建仅有既有大 chunk warning。

## Next

CMD-P29：加入计略→情报的正式跨域导航，删除旧 `PlotPanel`，并完成四计原子总验收。
