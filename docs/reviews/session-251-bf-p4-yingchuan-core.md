# Session 251 — BF-P4 颍川第二郡对照核心

## 结果

- 新增颍川 190 模板：17 县、29 条全陆路、4 地貌锚点，郡治阳翟。
- 新增通用 `generateCommanderyBattlefield`；南郡包装也改走该核心，生成器不按郡名分支。
- `POST /battlefield-instance/enter` 支持 `nanjun | yingchuan`，省略仍进入南郡。
- UI 提供“南郡水网 / 颍川平原”双入口；颍川保持只读对照，不误开放南郡县攻打链。
- 数字真源已登记当前 2 郡、33 县、40 路线、14 地貌锚点。

## 史料与诚实边界

颍川十七县名据《后汉书·郡国二》；坐标、邻接和路线是战场可读性所需的人工相对布局，
全部标记 approximate/inferred，不作为精确古城址或汉代道路测绘。

BF-P4 尚未完成城下/阵前单挑共享 duel 引擎与结果回写，因此路线图保持 `[~]`，不得进入
BF-P5 批量扩展。

## 验证

- historical geography + commandery generator + Nanjun regression：55/55。
- typecheck、lint、validate-data、build、BF-P3 dynamic 13/13、旧存档/县攻打 45/45 全绿。
- 1440×900 Headless 实际点击颍川→退出→南郡：颍川 17 县/29 路/阳翟，南郡
  16 县/11 路/江陵，console error=0。
