# Session 244 · R3 单挑四倾向验收

## 结论

R3 完成。玩家四倾向、AI 独立选择、服务端权威快照、存档 Schema、自动演算与演出摘要
已贯通；吕布仍为统计最强档，但真实败局可复现，传奇保护只改写败后斩俘处置。

## 关键修复

- `DuelState.stances` 保存双方倾向，同 seed 可确定续玩。
- 强攻/持重/诱敌分别改变七指令权重；委任保持武将原生决策。
- 吕布三连衰减为 0.55/0.35，单回合总伤害上限 75%，受必杀额外 20% 化解。
- 修复挑战方获胜时 `loserId` 错写为挑战方的原有缺陷。
- 进行中六角战斗刷新后恢复 BattleView。

## 验证

- `verify-duel`：四倾向分布与 5000 seed 吕布败局/重伤撤退通过。
- `verify-duel-rng`：3/3。
- shared 198/198、client 36/36、typecheck、lint、validate-data、build、diff-check 全绿。
- `verify-duel-r3-headless`：1440×900 实点四倾向并选中诱敌；非法倾向返回 400；
  console error=0。

仅有既有构建大 chunk 警告，无新增错误。
