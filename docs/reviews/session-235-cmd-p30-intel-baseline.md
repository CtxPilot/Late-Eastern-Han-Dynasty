# Session 235 · CMD-P30 情报迁移前审计与浏览器基线

> 范围：S20 / S07 既有情报入口审计。本轮不迁移、不删除生产入口，不修改规则、API、
> 数值、RNG、Schema 或存档。

## 一、结论

情报是计略原子切换后的下一迁移域。现有 `SpyPanel` 同时承载人员建设、进攻任务、防守
反间、俘虏处置及跨 S08/S09 的献美点化，不能整块复制；后续须按业务边界分步迁移。

## 二、现有写链与归属

| 写链 | store → API | 权威引擎 | 归属与边界 |
|---|---|---|---|
| 招募普通密探 | `recruitSpies` → `/intel/recruit` | `recruitSpies()` | S07；人数1～3，按成年男+驻军与编制计算 |
| 训练女间谍 | `trainFemaleSpy` → `/intel/recruit-female` | `trainFemaleSpy()` | S07∩S09；耗美女2、单城金100 |
| 献美点化 | `plantFemale` → `/intel/plant-female` | `plantFemaleFromGift()` | S07∩S08∩S09；外交只积累额度，情报唯一点化 |
| 派遣任务 | `spyMission` → `/intel/mission` | `dispatchMission()` | S07；探秘/破坏/刺杀及女间谍枕边风/离间 |
| 驻守/撤回反间 | `stationCounter` / `unstationCounter` | 同名端点与引擎 | S07 防守；当前为即时提交，尚未进统一终审 |
| 俘虏处决/释放 | `resolveCaptive` → `/intel/captive` | `resolveCaptive()` | S07；已有重大/普通终审；`hold/exchange` 无玩家按钮 |

S17 美人计、假情报只读取 S07 产生的 detailed 情报，四计已归“计略”；不得把四计写链
重新并入情报。S08 献美仍归外交，S09 寻访仍是宫廷人脉来源。

## 三、建议迁移顺序

情报抽屉固定为 `态势｜人员｜任务｜反间`：

1. CMD-P31 只接己方特工、编制、情报报告、点化额度、反间与俘虏摘要，新写入口保持0。
2. CMD-P32 迁人员建设：普通招募、女间谍训练、献美点化。
3. CMD-P33 迁任务、驻守/撤回与俘虏处置；所有状态变更进入统一终审。
4. CMD-P34 删除旧 `SpyPanel`，复验计略→情报 `recon` 落点与情报全链唯一入口。

未实装的煽动、窃取、营救、多月潜伏、非邻接潜入、策反、俘虏交换不提供占位按钮。

## 四、可复现浏览器基线

`CDP_PORT=9238 pnpm verify-cmd-p30-headless` 固定 1440×900、英雄集结曹操局：

- 左栏旧 `SpyPanel` 恰好1个；普通招募、女间谍训练、点化、派遣四个核心入口各1。
- 命令坞情报仍为迁移提示，新写入口0。
- 实际点击普通招募：取消后金、粮、特工数不变；确认后新增1～3名己方密探，按每人
  金120/粮60扣费，并写 `spy_recruit` 行动日志。
- console error=0。
