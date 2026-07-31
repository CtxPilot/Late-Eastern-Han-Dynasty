# Session 239 — CMD-P34 情报原子切换总验收

## 结论

旧 `SpyPanel` 源码、左栏挂载与 DOM 已全部归零。命令坞“情报”成为 S07 普通招募、
女间谍训练、献美点化、五类任务、反间驻防/撤防及俘虏处决/释放的唯一玩家入口。
计略“前往情报·探秘”已实际落到可提交任务的 `intel/recon` 分面。

## 代码

- 删除 `client/src/components/layout/SpyPanel.tsx`。
- `LeftPanel` 删除谍报折叠项、import 与 accordion 状态。
- `CommandDock` 情报说明更新为 S07 唯一入口。
- 新增 `verify-cmd-p34-headless` 原子总验收脚本。
- 未改 API、服务端引擎、规则、数值、RNG、Schema 或存档。

## 真实 UI 验证

1440×900 Headless Chrome 实际完成：

1. 确认旧 `spy-panel`、左栏谍报折叠项与旧任务入口均为0。
2. 确认人员分面招募/训练/点化各唯一，并从新入口确认招募。
3. 从计略发起分面点击“前往情报·探秘”，确认进入任务分面且任务提交入口唯一。
4. 选择密探与官道邻接敌城并确认探秘，生成 `spy_mission`。
5. 在反间分面确认驻防和撤防，生成 `spy_station`、`spy_unstation`。
6. 控制台错误为0。

俘虏处决/释放按有俘虏条件渲染；P33 已用模型测试覆盖其状态/扣押归属复验，本轮不添加
制造俘虏的测试后门。

## 回归

shared 198/198、client 34/34、plot/spy 34/34；lint、validate-data、build、diff-check
全绿。构建仅有既有大 chunk warning。

## Next

保持 S20。CMD-P35 建议先做家族迁移前审计与 Headless 基线；屯田仍未实装，不能用农业
开发替代或伪造运行时入口。
