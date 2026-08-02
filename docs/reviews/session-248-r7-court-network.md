# Session 248 · R7 S09 宫廷人脉语义与字段迁移

## 结果

- 势力权威字段改为 `courtNetwork`，城市字段改为 `courtNetworkOpportunities`。
- 新局、运行时、Schema、迷雾投影、API 响应与新存档均不再写
  `beautyStock/beautySeekLeft/beautyPool`。
- v1 旧存档加载前幂等迁移旧字段，并在严格 GameState 校验前删除旧键。
- 开局城市机会按商业、民心与首都地位派生：
  `max(1, 1 + floor(commerce/250) + morale≥75?1:0 + isCapital?2:0)`。
- 地方结交成功率固定为 65%，不读取成年女性数量；结交无论成败都不修改人口四桶。
- 战后文案改为“接管地方人脉”，笼络、外交牵线、女间谍掩护和美人计统一消费宫廷人脉。
- 历史女角仍只来自剧本、事件、亲属跟随和联姻；本轮不修改 S18 实体或来源。

## 兼容边界

`/civil/seek-beauty`、`/personnel/reward-beauty`、`/diplomacy/court-network` 等旧 API 路径
暂时保留，避免既有客户端断裂；它们只编排新字段和新语义，不会把旧键写回状态。

## 验证

- S09 确定续玩 25/25。
- v1 存档迁移、严格解析和运行时恢复 23/23。
- S07/S17 计谋谍报 34/34；外交 40/40；AI 谍报决策 4/4；Campaign 71/71。
- 1440×900 Headless 实际创建新局并执行一次地方结交：扣金60，人脉/机会同步，
  人口四桶不变，旧字段0、控制台错误0。
