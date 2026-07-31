# Session 243 · CMD-P38 家族原子切换总验收

## 结论

- `FamilyPanel.tsx` 已物理删除；`LeftPanel` 的家族 import、计数、折叠状态与挂载全部删除。
- 命令坞 `FamilyOverviewDrawer` 成为 S18 女角、姻亲/固定子女、婚配与手动跟随的唯一玩家入口。
- 未复制共享结算：S11 加入/释放继续调用 `joinFaction` / `releaseOfficer`，固定子女继续由
  开局补登与年度 `tickChildrenAppear` 处理。

## 验证

- `verify-cmd-p38-headless`（1440×900）：左栏家族按钮0、旧 `family-panel` DOM=0；
  四分面各1，婚配入口唯一；蔡琰×荀彧婚配成功；释放时正妻随迁流落、重新加入时随迁入府，
  姻亲支保持；console error=0。
- `verify-child-engine`：4 cases passed。
- `verify-family-rng`：36/36。
- shared 198/198，client 36/36；typecheck、lint、validate-data、build、diff-check 全绿。
  build 仅有既有大 chunk warning。

## 边界

- 没有新增 API、规则数值、RNG、Schema 或存档字段。
- 父辈/族谱、随机出生、纳妾/离婚及屯田仍未实装。
