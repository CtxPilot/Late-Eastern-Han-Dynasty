# Session 250 — BF-P3 动态战况与权威 RNG

## 交付

- 南郡实例生成季节天气、合法入口部署、双方侦察、伏击与遭遇顺序。
- Army 候选先按稳定 ID 排序；实例 ID 由年月与 RNG draws 派生。
- `dynamicSituation` 无损追加进存档；`generationAudit` 记录抽数起止与决策。
- 南郡 UI 显示动态战况与 RNG 审计摘要。

## 验证

- 动态专项 13/13；郡域存档/攻县 45/45；AI 保存点整场复现 4/4。
- 1440×900 Headless 实际创建游戏并点击进入南郡，摘要可见，console error=0。
- shared 194/194、client 36/36；typecheck、lint、validate-data、build、diff-check 全绿。

## 边界

天气与伏击尚未接入伤害、移动或补给数值；县级主动 AI 与 Tier II 郡域迷雾不属于 BF-P3。
