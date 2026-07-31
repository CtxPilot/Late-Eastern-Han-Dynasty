# Session 252 · BF-P4 阵前/城下单挑收口复核

## 结论

BF-P4 验收项已闭合。颍川/南郡继续共享数据驱动生成器；阵前与城下两种语境共享既有
S10 单挑引擎、权威随机流和演出组件，未引入平行伤害规则。

## 权威边界

- `BattlefieldInstance.activeDuel?` 是郡域单挑的可序列化真源。
- start 只负责语境、节点和双方选择；step/skip 调用既有 duel 引擎。
- `settlementApplied` 防止网络重试导致功绩、士气、驻军或武将状态重复写回。
- 挑战方获胜时守点驻军减少15%；败方死亡/被俘/逃脱分别写回既有武将状态语义。
- 生成器创建日期由场景年月注入，消除 `new Date()` 破坏确定性测试的问题。

## 验证证据

- `pnpm verify-bf-p4-duel`：20/20（含结算后完整 GameState 存档校验）。
- shared：198/198；client：36/36。
- typecheck、lint、validate-data、build、diff-check：通过。
- 1440×900 Chrome：阵前逐回合后跳过、城下跳过、两次返回战场、颍川→南郡往返；
  console error=0。

## 后续

BF-P5 应先解决模板录入/校勘工具和 CampaignArmy—县节点位置映射，再扩充核心战线；
郡域迷雾与真实补给路径仍按既有 BF-P5 债务处理。
