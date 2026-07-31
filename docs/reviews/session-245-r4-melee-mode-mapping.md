# Session 245 · R4 三模式映射验收

- 三入口运行时值：`auto / standard / tactical`。
- 同一 `MeleeState` 只能选定一种模式；同模式重复提交幂等，跨模式改选拒绝。
- 自动模式服务端一次推演；标准模式逐回合；六角模式关联既有 `BattleState`。
- 三条路径最终均经同一结算函数回写 CampaignArmy，并以 `settlementApplied` 防止重复扣兵。
- 验证：`verify-melee-modes` 10/10，`verify-save-battle` 24/24，shared 198/198，
  client 36/36，typecheck 通过。

范围说明：本轮不扩写标准模式玩法、不新增郡域模板、不实现县级主动 AI。
