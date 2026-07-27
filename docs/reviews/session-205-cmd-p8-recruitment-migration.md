# Session 205：CMD-P8 招贤写流程迁移

> 范围：把人才搜索与在野男将登用接入命令坞人事抽屉“招贤”分面。旧人事手风琴暂留作迁移
> 对照；任官、赏罚和旧入口原子下线仍分别留 CMD-P9/P10。

## 一、同源接入

- 新分面不实现第二套规则：搜索调用既有 Zustand `searchTalent(cityId)` →
  `POST /api/game/personnel/search`；登用调用既有 `recruitOfficer(officerId, rulerId)` →
  `POST /api/game/personnel/recruit`。
- 搜索城市、在野候选、执行者、支付能力与成功率均从当前 `GameState` 派生；成功率继续调用
  shared `calculateRecruitChance`。没有业务缓存、服务端或存档变更。
- 搜索城市是本地草稿。取消终审只关闭 `CommandConfirmDialog`，保留城市与当前“招贤”分面；
  成功提交后关闭终审并清除城市草稿，回落当前地图己方城/首都。
- 登用候选是由权威快照派生的草稿。取消后候选仍在原列表；请求成功后终审关闭，权威快照即时
  刷新。服务端拒绝时终审与草稿保留，错误显示在终审中。

## 二、门槛与确认前重校验

送审前明确显示并禁用：

1. 无在野候选；
2. 无可用搜索武将/说客；
3. 搜索城金不足80，或无己方城能够支付登用金200。

确认搜索前重新读取 Zustand 最新快照，复验执行者、城池归属与金80；确认登用前复验目标仍为
`FREE` 且无势力、并存在可支付金200的己方城。服务端仍是最终权威，任何前端快照之后发生的
状态变化会由原 API 拒绝并原地展示。

## 三、浏览器验收

`pnpm verify-cmd-p8-headless` 在 1440×900 下可复现：

- 旧/新搜索入口各一，证明过渡入口仍在；新分面没有任官/赏罚控件；
- 190 曹操初始真实局显示“暂无在野武将”；
- 搜索取消权威状态不变、城市草稿保留；成功后扣金80、写 `personnel_search`、终审关闭且
  城市草稿清除；
- 通过原搜索 API 耗尽选中城，复验金不足禁用；
- `cmdP8RecruitmentFixture=no-executor` 是仅开发态的派生 UI 夹具，只令
  `hasSearcher=false/ruler=null`，不写 Zustand 或服务端；用于 Headless 复验无执行者禁用；
- 通过既有 `release-officer` 建立真实在野夏侯惇，固定初始种子下由曹操以约81%成功率登用；
  断言 `faction===playerFactionId` 且 `status==='active'`，不是只看日志；
- 终审打开后经既有 `join-faction` 改变目标权威状态，再提交显示“该武将已有所属势力”，
  终审和草稿均保留；浏览器控制台错误为0。

开发态无执行者夹具只服务于不可由当前 0-A 初始局自然构造的 UI 门槛展示，不改变生产构建行为。
