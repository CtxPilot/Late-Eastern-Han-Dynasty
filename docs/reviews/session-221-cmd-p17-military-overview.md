# Session 221：CMD-P17 军事只读军情总览

> 范围：S20 / S05、S10、S21。命令坞军事接入四分面只读摘要；旧战役与右栏军事继续是
> 唯一写入口。本轮不处理两套出征归并，不新增 API、规则、终审或存档字段。

## 一、交付

- 新增 `MilitaryOverviewDrawer`，固定展示 `军备｜编成｜军令｜战报`。
- “军备”从当前 `GameState` 派生己方城池驻军、士气、粮、金、在城己方武将数，以及
  城池+Campaign Army 总兵力/总粮草。
- “编成”只读展示己方 Campaign Army 的主将、阶段、位置/目标、兵粮、士气和组织。
- “军令”只读展示各 Army 当前阶段、位置、兵粮、士气、组织和疲劳；不提供强攻、劝降、
  撤退、建造或参谋行动按钮。
- “战报”复用 store 的 `lastBattleResult` 和当前 `actionLog` 军事记录，不创建第二份战报缓存。
- 命令坞军事标记为“军情总览可用”；正文持续明确写操作仍在原城池/战役面板。

## 二、权威与迷雾边界

- 权威：`game.cities`、`game.officers`、`game.campaignArmies`、`game.actionLog`。
- 临时客户端状态：仅当前分面；不持久化、不进入存档。
- 只筛选 `ruler/factionId === playerFactionId` 的己方城与己方 Army，不聚合敌方隐藏军情。
- `lastBattleResult` 是既有客户端最近结算结果，刷新后为空时诚实显示“本次会话尚无结果”；
  持久军事记录仍以服务端 `actionLog` 为准。
- 无 API 请求、业务 action、终审或写按钮；旧入口操作后由同一 Zustand `game` 快照即时刷新。

## 三、验证

- 新增纯模型测试：排除敌城/敌 Army，验证城池排序、Army 主将/位置/阶段，以及总兵力、
  总粮草和平均驻军士气。
- `pnpm verify-cmd-p17-headless` 在 1440×900 英雄集结曹操局遍历四分面：
  17 个己方城摘要、新写按钮 0；随后从旧“战役”真实编成出征并创建“夏侯惇军”，重新打开
  命令坞后“编成/军令/战报”即时同步；旧战役入口仍为1，最终新写按钮仍为0，console error=0。
- client 9 文件22项、typecheck、lint 通过。

## 四、后续

CMD-P18 启动前必须先处理 `marchOnCity` 旧简化出征与 `campaignStart` Campaign Army
完整战役链的归并决策。P17 不构成对任一写路径的认可或下线授权。
