# Session 222 — CMD-P18 Campaign 编成归并与唯一入口

## 决策

- 玩家正式出征统一走 `Campaign Army` / `POST /api/game/campaign/start`。
- 右栏 `marchOnCity` 的“出征攻城”按钮物理删除；`/march` 暂留给 S21
  `engageJiangling` 场景兼容适配，不再是玩家 UI 入口。
- 左栏 `CampaignPanel` 的旧编成表单与“出征”提交物理删除；军团列表、强攻、劝降、
  撤退、建造与参谋行动暂留，待 CMD-P19 迁移。

## 落地

- 军事抽屉“编成”新增独立草稿：出发城、目标、主副将、参谋、兵种、阵型、兵力、粮草。
- 复用既有 `campaignStart` store/API/引擎与 `CommandConfirmDialog`，未新增 API、规则、
  Schema、数值、业务缓存或存档字段。
- 取消终审不调用 API 且保留草稿；确认前以最新 `GameState` 复验城市归属、官道目标、
  人物位置/状态/角色互斥、参谋智力与兵粮，成功后才清人物和目标草稿。

## 验证

- `verify-cmd-p18-headless`（1440×900）：右栏简化出征0、左栏旧出征0、新编成入口1；
  取消权威状态不变且草稿保留；确认生成“夏侯惇军”，扣兵5000、粮1500并写
  `campaign_start`；旧军团后续指令保留；console error=0。
- client 9文件23项、shared 19文件198项、Campaign 71/71、typecheck、lint、
  validate-data、build、diff-check 全绿。

## 边界与 Next

- 本轮只迁“编成出征”，征兵/训练仍在右栏，军团后续军令仍在左栏。
- CMD-P19 应迁 Campaign Army 军令，并先为建造/参谋行动补齐统一终审；不得在本轮顺带
  清理 S21 的 `/march` 兼容适配。
