# 数据字典

> 本文档定义所有静态 JSON 数据文件的 Schema 和格式。
> 实际数据文件位于 `server/src/data/`。

## 目录

1. [cities.json — 城市数据](#一citiesjson--城市数据)
2. [formations.json — 阵型数据](#二formationsjson--阵型数据)
3. [units.json — 兵种模板](#三unitsjson--兵种模板)
4. [items.json — 宝物数据](#四itemsjson--宝物数据)
5. [officers.json — 武将数据](#五officersjson--武将数据)
6. [females.json — 女性角色](#六femalesjson--女性角色)
7. [children.json — 子女生育事件](#七childrenjson--子女生育事件)
8. [skills.json — 技能定义](#八skillsjson--技能定义)
9. [scenarios.json — 剧本](#九scenariosjson--剧本)
10. [events.json — 历史事件](#十eventsjson--历史事件)
11. [itemsets.json — 套装定义](#十一itemsetsjson--套装定义)
12. [郡县历史地理模板（规划）](#十五郡县历史地理模板规划)

---

## 一、cities.json — 城市数据

**105条记录**，对应东汉13州全部郡国。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 城市ID(1~105) |
| name | string | 城市名 |
| province | string | 所属州(13州) |
| x | number | 地图X坐标(Canvas像素) |
| y | number | 地图Y坐标(Canvas像素) |
| maxPopulation | number | 人口上限（总人口承载力） |
| initialDemographics | object? | 可选开局四桶 `{ adultMale, adultFemale, child, elder }`；缺省由 `floor(maxPopulation*0.7)` 按 `DEFAULT_DEMO_RATIO`(0.30/0.27/0.29/0.14) 拆分（见 04§28 / `shared/demographics.ts`） |
| isCapital | boolean | 是否为州治 |
| isPass | boolean | 是否为关隘 |
| specialProduct | string\|null | 特产(如"丝绸""良马") |
| resourceOutput | Record | 每季资源产出(wood/iron/warhorse) |
| tier | CityTier | 城市等级 1~6 |
| latitudeIndex | number | 纬度指数 1~5(南→北，影响骑兵/水军造价) |
| specialties | string[] | 地域特产(如["蜀锦","井盐","丹砂"]) |
| countyCount | number | 下辖县数 |
| facilities | CityFacility[] | 已建设施 |
| policy | CityPolicy\|null | 当前政策 |
| developmentProgress | object | 持续开发进度 |
| recruitableUnits | UnitType[] | 可招募兵种列表 |
| initialStats | { farm, commerce, wall } | 初始开发值 |

**运行时由引擎写入（非 cities.json 静态必填）**：

| 字段 | 类型 | 说明 |
|------|------|------|
| population | number | ≡ sum(demographics) |
| demographics | CityDemographics | 四桶；征兵改 adultMale；生育加 child；衰老改 elder |
| beautyPool | number | **旧 Demo 兼容字段**：当前仍为 `floor(adultFemale/400)`；S09 R7 迁移后废止，不得作为目标规则 |
| gold / food / troops / stats | … | 既有；粮耗见 04§28.3 |

### 示例 (2条)

```json
[
  {
    "id": 1,
    "name": "河南尹",
    "province": "司隶",
    "x": 450,
    "y": 380,
    "maxPopulation": 50000,
    "isCapital": true,
    "isPass": false,
    "specialProduct": null,
    "recruitableUnits": ["lightInfantry", "heavyInfantry", "spearman", "archer", "crossbowman", "lightCavalry"],
    "initialStats": { "farm": 400, "commerce": 500, "wall": 300 }
  },
  {
    "id": 55,
    "name": "汉中郡",
    "province": "益州",
    "x": 280,
    "y": 400,
    "maxPopulation": 20000,
    "isCapital": false,
    "isPass": true,
    "specialProduct": "药材",
    "recruitableUnits": ["lightInfantry", "heavyInfantry", "spearman", "archer", "lightCavalry"],
    "initialStats": { "farm": 200, "commerce": 150, "wall": 250 }
  }
]
```

### 13州城市清单

```
司隶(7): 河南尹, 河内郡, 河东郡, 弘农郡, 京兆尹, 左冯翊, 右扶风
豫州(6): 颍川郡, 汝南郡, 梁国, 沛国, 陈国, 鲁国
冀州(9): 魏郡, 钜鹿郡, 常山国, 中山国, 安平国, 河间国, 清河国, 赵国, 勃海郡
兖州(8): 陈留郡, 东郡, 东平国, 任城国, 泰山郡, 济北国, 山阳郡, 济阴郡
徐州(5): 东海郡, 琅邪国, 彭城国, 广陵郡, 下邳国
青州(6): 济南国, 平原郡, 乐安国, 北海国, 东莱郡, 齐国
荆州(7): 南阳郡, 南郡, 江夏郡, 零陵郡, 桂阳郡, 武陵郡, 长沙郡
扬州(6): 九江郡, 丹阳郡, 庐江郡, 会稽郡, 吴郡, 豫章郡
益州(12): 汉中郡, 巴郡, 广汉郡, 蜀郡, 犍为郡, 牂牁郡, 越巂郡, 益州郡, 永昌郡, 广汉属国, 蜀郡属国, 犍为属国
凉州(12): 陇西郡, 汉阳郡, 武都郡, 金城郡, 安定郡, 北地郡, 武威郡, 张掖郡, 酒泉郡, 敦煌郡, 张掖属国, 居延属国
并州(9): 上党郡, 太原郡, 上郡, 西河郡, 五原郡, 云中郡, 定襄郡, 雁门郡, 朔方郡
幽州(11): 涿郡, 广阳郡, 代郡, 上谷郡, 渔阳郡, 右北平郡, 辽西郡, 辽东郡, 玄菟郡, 乐浪郡, 辽东属国
交州(7): 南海郡, 苍梧郡, 郁林郡, 合浦郡, 交趾郡, 九真郡, 日南郡
```

---

## 二、formations.json — 阵型数据

**0-A：7条**（6 基础陆阵 + 1 特殊冲阵 id 16）· **0-B 全量：27条**（18 陆阵 + 9 水阵）。数量不得因本轮计划改变，详见 `05-combat-system.md §4`。

> **Session 288 FM-P1 已迁移（Gate M/N1/D 通过）**：0-A 目标目录已落地为
> `[0,1,2,3,4,6,16]`（方/圆/锥/雁/鹤/锋六基础 + 特殊冲阵 16）；普通标准模式卡只含
> `[0,1,2,3,4,6]`。冲阵在 FM-P0～P5 仅作静态/精通兼容，不进入三模式候选；未来启用须
> 另行批准。`formations.json` 与 223 将精通数据实际目录已收敛为 `[0,1,2,3,4,6,16]`；
> 圆阵(1)/雁行(3) 已补齐，7 偃月/8 长蛇移出可选集（稳定 ID 保留不复用、不改号，0-B 仍用）。
> 迁移前实际目录为 `[0,2,4,6,7,8,16]`；146 将逐人迁移表见
> `docs/officer-formation-mastery-migration.csv`（已审核通过并落地）。详见
> `29-formation-integration-development-plan.md` Gate M/N1。

### 字段说明

> **Session 288~291 FM-P1~P3a 已实装**：`formations.json` 已迁移到长期目标 `Formation` 结构
> （`family`/`tiers`/`ultimate`/`prerequisites?`/`deployment?`），不再使用 legacy `modifiers`。
> 数值以 `05 §4.5.1` Lv1 点值为准校勘；`deployment` 为 Gate D 五部部署草稿；
> **唯一运行量纲 = `tiers[0]` 点值 + `effects` 暴击链，三模式同源消费；`meleePercent` 过渡字段
> 已在 Session 291 退役（并发起等价性单点换算，见 §二运行量纲说明）。**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | FormationType 枚举值（陆阵 0~17，水阵 18~26） |
| name | string | 阵型名 |
| description | string | 说明 |
| historicalSource | string | 史料出处 |
| family | 'land' \| 'water' | 体系：陆阵/水阵 |
| tiers | FormationLevelData[] | Lv1~Lv5 每级属性（attack/defense/mobility/range/specialEffects） |
| ultimate | FormationUltimate | 极效果（attackBonus/defenseBonus/effect/proficiencyRequired） |
| effects | FormationEffect[] | 特殊效果（含暴击/反击/连击贡献，crit.ts 单一内容源） |
| allowedUnits | UnitType[] | 可用兵种 |
| bestUnits | UnitType[] | 最佳兵种（额外+10%） |
| restrictedUnits | UnitType[] | 禁用兵种 |
| terrainModifiers | Record | 地形适应修正 |
| prerequisites | FormationPrerequisite[]? | 科技树前置条件（非基础阵型必填） |
| specialUnlock | object? | 特殊解锁条件（智力/水军适性/兵种限定） |
| deployment | FormationDeployment? | Gate D 五部部署草稿（slots/fallbackOrder/symmetry） |

### 运行量纲说明（FM-P3a Session 291）

- 唯一运行量纲 = `tiers[0]`（0-A 固定 Lv1）`attack/defense/mobility/range` 点值 + `effects`
  暴击链（`crit_rate`/`counter_rate`/`counter_coeff`/`chain_rate`）——三模式（自动/标准/六角）同源消费。
- 标准模式 `runMeleeRound` 由等价性单点换算消费点值（`MELEE_ATK_GAIN=0.1`、`MELEE_DEF_GAIN=0.1`、
  `MELEE_MOB_GAIN=0.5`、`MELEE_MOB_BASE=1.0`，见 `server/src/engine/meleeRound.ts`），正面增量再按
  组织度执行档缩放（负修正原值保留）。**Session 290 的 `meleePercent` 过渡字段已退役**
  （类型/JSON/generate-0a-data 全部移除），不再存在第二套阵型数值表。
- 冲阵 16 保留静态/精通（不含标准候选），无 `tiers[0]` 消费。

### 示例（方阵·新版结构）

```json
{
  "id": 0,
  "name": "方阵",
  "description": "攻守均衡之基本阵型，前后左右均可应敌。",
  "historicalSource": "孙膑兵法·十阵",
  "family": "land",
  "tiers": [
    { "level": 1, "attack": 1, "defense": 1, "mobility": 0, "range": 0 },
    { "level": 2, "attack": 2, "defense": 2, "mobility": 0, "range": 0 },
    { "level": 3, "attack": 3, "defense": 3, "mobility": 1, "range": 0, "specialEffects": ["被包围时仍可发挥100%战力"] },
    { "level": 4, "attack": 4, "defense": 4, "mobility": 1, "range": 0 },
    { "level": 5, "attack": 5, "defense": 5, "mobility": 1, "range": 0 }
  ],
  "ultimate": {
    "attackBonus": 0,
    "defenseBonus": 0,
    "mobilityBonus": 0,
    "rangeBonus": 0,
    "effect": "免疫一次围剿（被包围时仍可发挥100%战力）",
    "proficiencyRequired": 500
  },
  "effects": [],
  "allowedUnits": ["lightInfantry", "heavyInfantry", "spearman", "archer", "crossbowman"],
  "bestUnits": ["heavyInfantry", "spearman"],
  "restrictedUnits": [],
  "terrainModifiers": { "plain": 0, "forest": -1, "mountain": -2, "water": -3 }
}
```

---

## 三、units.json — 兵种模板

**0-A：9条**（6 陆兵 + 3 级水军：走舸/蒙冲/楼船）· **0-B 全量：约 21+**（扩弩/骑射/攻城 + 12 特殊；水军保持三级）。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| type | UnitType | 兵种类型ID |
| name | string | 兵种名 |
| isSpecial | boolean | 是否特殊兵种 |
| attack | number | 基础攻击力 |
| defense | number | 基础防御力 |
| mobility | number | 基础机动力(格数) |
| range | number | 射程(1=近战) |
| traits | UnitTrait[] | 兵种被动特性 |
| strongAgainst | UnitType[] | 克制单位 |
| weakAgainst | UnitType[] | 被克制单位 |
| recruitRequirement | object\|null | 招募条件(特殊兵种) |
| terrainModifiers | Record | 地形修正 |
| recruitCost | { gold, food, population } | 招募单兵消耗 |
| **abilities** | CombatAbilityDef[] | **兵种战法**（Session 70） |

### abilities — 战法结构（`shared/types/combatAbility.ts`）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 战法ID |
| name / description | string | 显示名与说明 |
| leveling | `'leveled' \| 'proficiency'` | **leveled**=基础兵种 Lv1~5；**proficiency**=特殊兵种无等级、靠熟练度 |
| perLevel | CombatAbilityLevel[5]? | leveled 必填：5 级参数 |
| energyCost / basePower / maxPower / hitRateBonus | number? | proficiency 必填（气力、初始/满熟练威力、命中加成） |
| specialEffect | enum | knockback/stun/charge/pierce/aoe/fire/morale/confusion/none |
| effectValue | number? | 击退格/眩晕回合/AOE半径等 |
| minRange / maxRange | number | 射程 |
| coopAllowed | boolean | **连携预留**（关系/亲密度引擎后置） |

`CombatAbilityLevel`：`{ level:1~5, energyCost, power, hitRateBonus, requiredProficiency }`  
适性门槛惯例：C→B→A→S→S。

### 示例（轻步兵战法节选）

```json
{
  "type": "lightInfantry",
  "name": "轻步兵",
  "isSpecial": false,
  "attack": 5,
  "defense": 4,
  "mobility": 4,
  "range": 1,
  "traits": [
    { "name": "轻便", "description": "无地形惩罚", "modifier": { "type": "terrain_ignore", "value": 1 } }
  ],
  "strongAgainst": ["archer"],
  "weakAgainst": ["heavyCavalry"],
  "recruitRequirement": null,
  "terrainModifiers": { "plain": 0, "forest": 0, "mountain": 0, "water": -3 },
  "recruitCost": { "gold": 80, "food": 50, "population": 1 },
  "abilities": [
    {
      "id": "inf_strike",
      "name": "奋战",
      "description": "全力近战一击，伤害随等级提升",
      "leveling": "leveled",
      "perLevel": [
        { "level": 1, "energyCost": 15, "power": 1.15, "hitRateBonus": 0, "requiredProficiency": "C" },
        { "level": 5, "energyCost": 30, "power": 1.8, "hitRateBonus": 20, "requiredProficiency": "S" }
      ],
      "specialEffect": "none",
      "minRange": 1,
      "maxRange": 1,
      "coopAllowed": true
    }
  ]
}
```

> 0-A 已入库 **9** 兵种（6 陆 + **走舸/蒙冲/楼船** 三级水军，参考经典三级水军设计）全战法。  
> `UnitType`：`lightNavy` / `mediumNavy` / `heavyNavy`（已废止单一 `navy`）。  
> 特殊兵种 `proficiency` 战法见 `05`§5.4（0-B）。

---

## 四、items.json — 宝物数据

**0-A 20 条（Session 266 起已接运行时：装备/卸下/赏赐/搜索入库/初始宝配）；全量 165 条 0-B**。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 宝物ID |
| name | string | 宝物名 |
| category | ItemCategory | 品类(weapon_primary/weapon_secondary/armor/mount/book/special/consumable) |
| quality | ItemQuality | 品质(common/rare/epic/legendary) |
| primaryWeaponSubType? | PrimaryWeaponSubType | 主武器子类(仅weapon_primary) |
| secondaryWeaponSubType? | SecondaryWeaponSubType | 副武器子类(仅weapon_secondary) |
| armorSubType? | ArmorSubType | 盔甲子类(仅armor) |
| baseStats | Partial<OfficerStats> | 基础属性加成 |
| baseEffect | ItemEffect[] | 基础效果 |
| equipRequirement | ItemEquipRequirement | 装备门槛 |
| bond? | ItemBond | 专属共鸣 |
| sets? | number[] | 所属套装ID |
| consumable? | object | 消耗品配置 |
| acquisition | AcquisitionMethod[] | 获取途径 |
| shopPrice? | number | 商店价格 |
| description | string | 说明 |

> **单挑武器映射**：`primaryWeaponSubType`/`secondaryWeaponSubType` 到单挑武器威力/修正的完整映射表见 `05-combat-system.md §8.9`。`baseEffect` 中 `duel_*` 类型效果（如 `duel_boost`/`duel_first_strike`/`duel_invincible`）在单挑引擎中按 §8.9.4 规则生效。

### 示例 (3条)

```json
[
  {
    "id": 6,
    "name": "青龙偃月刀",
    "category": "weapon_primary",
    "quality": "legendary",
    "primaryWeaponSubType": "blade",
    "baseStats": { "war": 16 },
    "baseEffect": [
      { "type": "duel_boost", "value": 40, "description": "单挑伤害+40%" },
      { "type": "charge_boost", "value": 15, "description": "部队突击+15%" }
    ],
    "equipRequirement": { "minStats": { "war": 90 } },
    "bond": {
      "officerId": 120,
      "resonance": {
        "stats": { "war": 5, "leadership": 3 },
        "effects": [
          { "type": "crit_damage", "value": 100, "description": "【武圣】暴击伤害×2" }
        ],
        "description": "青龙偃月刀在关羽手中如天神下凡，一刀生威寒敌胆。"
      }
    },
    "sets": [4],
    "acquisition": ["initial"],
    "description": "关羽所持之青龙偃月刀，八十二斤寒铁铸就。"
  },
  {
    "id": 41,
    "name": "赤兔马",
    "category": "mount",
    "quality": "legendary",
    "baseStats": {},
    "baseEffect": [
      { "type": "mobility", "value": 5, "description": "机动力+5" },
      { "type": "charge_boost", "value": 30, "description": "突击+30%" }
    ],
    "equipRequirement": { "minStats": { "war": 90 } },
    "bond": {
      "officerId": 80,
      "resonance": {
        "stats": { "war": 3, "leadership": 2 },
        "effects": [
          { "type": "free_move_after_attack", "value": 1, "description": "【飞将】冲锋后仍可移动3格" }
        ],
        "description": "人中吕布，马中赤兔。吕奉先执电戟踏红云，天下无敌。"
      }
    },
    "sets": [3],
    "acquisition": ["initial", "inherit"],
    "description": "日行千里，夜走八百之神驹。"
  },
  {
    "id": 101,
    "name": "金疮药",
    "category": "consumable",
    "quality": "common",
    "baseStats": {},
    "baseEffect": [],
    "equipRequirement": {},
    "consumable": {
      "effect": {
        "type": "heal",
        "value": 30,
        "description": "武将伤势恢复30%"
      },
      "maxStack": 5
    },
    "acquisition": ["shop"],
    "shopPrice": 200,
    "description": "行军必备之伤药。"
  }
]
```

---

## 五、officers.json — 武将数据

**1000+条记录**。此处给出格式，实际数据用脚本批量生成后再人工校对。

**0-A 验收基线（Session 106）**：30条，已全部替换为史实武将。Session 104 用许褚、曹仁、李典、吕虔、高顺、孙策、甘宁、徐盛、周泰、公孙瓒、臧霸、张嶷替换 ID 100~111；Session 106 再以董卓、袁绍、孙坚替换 ID 112~114，服务 190《关东义兵》技术切片。该覆盖仅是静态人物数据，`personalTroops` 等部曲字段仍未进入共享类型/Zod/运行时。

**当前实际数据（Session 118）**：`officers.json` 实测 **223条史实武将**，由0-A验收基线30人、Sessions 110~115累计新增137人、已存在的 ID 252~283 共32人，以及本次新增 ID 284~307 共24人组成。此处只记录当前文件事实；Phase 0-B 的1000+全量目标仍未启动，继续保持暂缓。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 武将ID |
| name | string | 姓名 |
| birthYear | number | 出生年；史料未详时为 `0` |
| deathYear | number | 死亡年 |
| stats | { leadership, war, intelligence, politics, charisma } | 五维属性(1~100) |
| hidden | OfficerHidden | 隐藏属性 |
| unitProficiency | Record<UnitType, UnitProficiency> | 兵种适性 |
| formationMastery | number[] | 可用阵型ID |
| skills | { skillId: SkillType, level: number }[] | 初始技能(不含使用次数) |
| uniqueSkill? | SkillType | 专属技 |
| tags | string[] | 出身标签（社会·地域·职业·政治·特殊） |
| appearance? | SpecialAppearance | **Session 100 技术储备新增**：武将特殊造型（scale/auraColor/weaponLength/shadingMode/pheasantPlume/mount/ghostForm）。0-A 30 武将手工填写，0-B 全量填写记技术债 D-0B-7 |
| avatarGene? | AvatarGene | **Session 101 技术储备新增**：武将头像底图基因（scheme/baseRubbing/faceType/hairType/beardType/eyeType/sealText/clanTitle/officeSeal/ribbonColor/royalSeal）。与 `appearance` 战斗造型字段并存，职责分离。0-A 30 武将手工填差异化 / 0-B 1000+ 武将脚本派生 + 重点人工校对。详见 `docs/07-ui-design.md` §11.6、`docs/00-dev-constitution.md` §十一 |

#### appearance 字段（Session 100 技术储备，未实装）

> 本字段为 Session 100 技术储备，实装时需同步 `shared/types/officer.ts` + `shared/validators/index.ts` Zod 校验 + 本真源。详见 `docs/07-ui-design.md` §11.3。

| 子字段 | 类型 | 说明 |
|------|------|------|
| scale | number | 体型缩放（吕布 1.5 / 关羽 1.3 / 文官 1.0） |
| auraColor | string | 专属气劲颜色（吕布 #ff1744 血红 / 关羽 #00e676 青龙青） |
| weaponLength | number | 武器长度（影响 Canvas 上攻击光束判定，吕布 25 方天画戟） |
| shadingMode | 'normal' \| 'ghost' \| 'enraged' | 外观特效模式 |
| pheasantPlume? | boolean | 是否有雉翎（吕布/关羽/张飞/赵云 true） |
| mount? | 'redHare' \| ... | 专属坐骑（吕布 redHare 烈焰足粒子） |
| ghostForm? | { trigger: {rage, hpRatio}, scale, auraColor, shadingMode } | 鬼神觉醒配置（吕布专属，前端自管 rage 触发） |

**0-A 30 武将填写规则**：猛将（吕布/关羽/张飞/典韦/赵云/马超）手工填写差异化 appearance；文官（荀彧等）填默认值（scale=1.0/auraColor=空/weaponLength=5/normal）。详见 `docs/07-ui-design.md` §11.3 典型武将映射表。

#### avatarGene 字段（Session 101 技术储备，未实装）

> 本字段为 Session 101 技术储备，实装时需同步 `shared/types/officer.ts` + `shared/validators/index.ts` Zod 校验 + 本真源。详见 `docs/07-ui-design.md` §11.6、`docs/00-dev-constitution.md` §十一美术铁律。
> 与 `appearance` 字段职责分离：`appearance` 服务战斗演出几何造型（MeleeStage/DuelStage），`avatarGene` 服务头像底图渲染（OfficerRosterPanel/OfficerDetail/派系面板）。

| 子字段 | 类型 | 说明 |
|------|------|------|
| scheme | 'rubbing' \| 'seal' \| 'procedural' | 头像方案（A 拓片 / B 印信 / C 拼图，组合方案下默认 'procedural' 含三层） |
| baseRubbing? | 'warrior' \| 'scholar' \| 'servant' \| 'royal' | 方案 A 拓片底图类型（按武将文/武/龙套/皇室切换） |
| faceType? | number | 方案 C 脸型（0~4：甲/由/申/国/风字脸） |
| hairType? | number | 方案 C 冠冕/发髻（0~9：平天冠/进贤冠/武冠/帻巾/帢帽/...） |
| beardType? | number | 方案 C 胡须（0~9：虬髯/美髯/八字胡/山羊胡/...） |
| eyeType? | number | 方案 C 眼神/眉毛（0~9：丹凤眼/细眼/环眼/卧蚕眉/...） |
| sealText? | string | 方案 A/B 姓名印章文字（2~4 字，朱砂红 + 隶书，2 字断行） |
| royalSeal? | boolean | 是否皇室金边（刘备/曹操/孙权等主公 true） |
| clanTitle? | string | 方案 B 籍贯氏族（"琅琊诸葛氏"、"河东关氏"、"五原郡吕氏"，静态按出身） |
| officeSeal? | string | 方案 B 当前官职篆印（"荡寇将军"、"荆州刺史"，动态随 `Officer.position` 变化） |
| ribbonColor? | 'purple' \| 'cyan' \| 'black' \| 'yellow' | 方案 B 印绶颜色（按汉制官品，动态随 `NobilityRank` 变化：紫绶/青绶/墨绶/黄绶） |

**0-A 30 武将填写规则**：
- 猛将/主公（吕布/关羽/张飞/典韦/赵云/刘备/曹操/孙权等 27 名史实武将）→ 手工填差异化 `avatarGene`
  - 例：关羽 → `{scheme:'procedural', baseRubbing:'warrior', faceType:3, hairType:2, beardType:1, eyeType:0, sealText:'关羽', royalSeal:false, clanTitle:'河东关氏', officeSeal:'荡寇将军', ribbonColor:'cyan'}`
  - 例：荀彧 → `{scheme:'procedural', baseRubbing:'scholar', faceType:0, hairType:1, beardType:3, eyeType:1, sealText:'荀彧', royalSeal:false, clanTitle:'颍川荀氏', officeSeal:'尚书令', ribbonColor:'cyan'}`
- 董卓、袁绍、孙坚（ID 112~114）→ Phase 5 实装头像时按重点人物手工配置，不再使用占位默认值
- 0-B 1000+ 武将 → 脚本按 officer.id 哈希派生 faceType/hairType/beardType/eyeType + 重点人物人工校对 sealText/clanTitle/officeSeal/ribbonColor

**规模说明**：optional 字段，不影响 officers.json 总条数（0-A验收基线30，当前实际223，0-B目标1000+）。实装时记技术债 D-0B-7（与 appearance 同条，0-B 全量填写时一并处理）。

### 示例

```json
{
  "id": 120,
  "name": "关羽",
  "birthYear": 162,
  "deathYear": 220,
  "stats": {
    "leadership": 95,
    "war": 98,
    "intelligence": 75,
    "politics": 63,
    "charisma": 94
  },
  "hidden": {
    "compatibility": 75,
    "righteousness": 14,
    "ambition": 6,
    "valor": 7,
    "composure": 4,
    "lifespan": 220,
    "growth": "low",
    "personality": "brave",
    "ideal": "benevolence",
    "bloodline": [121, 122]
  },
  "unitProficiency": {
    "lightInfantry": "A",
    "heavyInfantry": "A",
    "spearman": "B",
    "archer": "B",
    "crossbowman": "C",
    "lightCavalry": "S",
    "heavyCavalry": "S",
    "horseArcher": "A",
    "navy": "C",
    "siege": "B"
  },
  "formationMastery": [2, 6, 16],
  "skills": [
    { "skillId": "fire", "level": 1 },
    { "skillId": "gallop", "level": 3 },
    { "skillId": "inspire", "level": 2 }
  ],
  "uniqueSkill": "unique_warrior_god"
}
```

### 武将录入策略

```
Phase 1 — 脚本生成骨架
  使用爬虫/API从公开数据源(如维基)获取武将基本属性 + 生卒年
  自动填充到 officers.json 模板

Phase 2 — 人工校对
  逐条校对五维属性(横比其他武将是否合理)
  补充隐藏属性(查阅三国志/演义原文推断)
  补充阵型精通和初始技能

Phase 3 — 持续维护
   随着研究进展不断修正
   新增发现的历史武将

Phase 4 — 特殊人物审核
   方士/术士/纯传说人物（左慈、于吉、管辂、祢衡等）不录入
   officers.json。剧情引用通过事件系统（S14）实现。
   例外：祝融（唯一可出战女将）。
   华佗已存在属既有事实，后续不再新增同类。
```

---

## 六、females.json — 女性角色

**90+条记录**。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 女性ID |
| name | string | 姓名 |
| birthYear | number | 出生年 |
| deathYear | number | 死亡年 |
| family | FamilyTier | 出身阶层 |
| clanName | string | 家族名 |
| factionId | number\|null | 初始所属势力 |
| locationId | number | 初始所在城市 |
| fatherId? | number | 父 |
| motherId? | number | 母 |
| initialStatus | MaritalStatus | 初始婚配状态 |
| initialHusbandId? | number | 初始夫君 |
| influence | Record<string, number> | 六维影响力 |
| statBonus | Partial<OfficerStats> | 属性加成 |
| teachableSkills | SkillType[] | 可传授技能 |
| enhanceableSkills | { skill, bonus }[] | 可增强技能 |
| talents | SpouseTalent[] | 天赋 |
| relatedEvents | number[] | 关联事件ID |
| marriageRequirements? | object | 婚配门槛 |
| canCommand | boolean | 是否可出战 |
| description | string | 人物简介 |

### 示例

```json
{
  "id": 201,
  "name": "黄月英",
  "birthYear": 185,
  "deathYear": 250,
  "family": "greatClan",
  "clanName": "黄",
  "factionId": null,
  "locationId": 42,
  "fatherId": 851,
  "motherId": null,
  "initialStatus": "single",
  "influence": { "household": 5, "counsel": 15, "martial": 0, "prestige": 2, "fortitude": 2, "scholarship": 12 },
  "statBonus": { "intelligence": 10 },
  "teachableSkills": ["fire", "trap", "calm"],
  "enhanceableSkills": [
    { "skill": "fire", "bonus": 20 },
    { "skill": "trap", "bonus": 15 }
  ],
  "talents": ["childEducator", "siegeBrewer"],
  "relatedEvents": [200, 201],
  "canCommand": false,
  "description": "诸葛亮之妻，黄承彦之女。虽貌异，然才堪比夫君，精通机关术。"
}
```

---

## 七、children.json — 子女生育事件

**全量设计 ~50+ 条；0-A 实际 5 条**（诸葛瞻/关兴/张苞/曹丕/孙登）。  
**玩法**：`appearYear` 正月由 `child.ts` 动态生成武将；姻亲 UI 显示状态；可不预置 officers。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| childId | number | 子女武将ID（运行时动态入库用；可不在 officers.json） |
| childName | string | 子女名 |
| fatherId | number | 父武将ID |
| motherId | number | 母女性ID |
| birthYear | number | 出生年 |
| appearYear | number | 登场年(16岁) |
| source | "history"\|"romance"\|"folklore" | 出处 |
| baseStats | OfficerStats | 基础能力值 |
| motherBonus? | object | 母教加成 |

### 示例

```json
{
  "childId": 950,
  "childName": "诸葛瞻",
  "fatherId": 890,
  "motherId": 201,
  "birthYear": 227,
  "appearYear": 243,
  "source": "history",
  "baseStats": { "leadership": 55, "war": 48, "intelligence": 68, "politics": 65, "charisma": 70 },
  "motherBonus": {
    "fromScholarship": { "intelligence": 5, "politics": 3 },
    "fromBloodline": {},
    "extraSkills": ["calm"],
    "extraTalents": []
  }
}
```

---

## 八、skills.json — 技能定义

**69条通用 + 80条专属 = 149条**。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SkillType | 技能ID |
| name | string | 技能名 |
| category | SkillCategory | 分类 |
| description | string | 总体描述 |
| maxLevel | number | 最大等级(通用5/专属1) |
| levels | SkillLevel[] | 各等级效果 |

### 示例

```json
{
  "id": "fire",
  "name": "火计",
  "category": "tactics",
  "description": "在战场施放火焰攻击敌军。高级可蔓延至多格并附带灼烧。",
  "maxLevel": 5,
  "levels": [
    {
      "level": 1,
      "name": "火计·初",
      "effects": [
        { "type": "fire_damage", "value": 1.0, "range": 1, "description": "1格起火，伤害=智×1.0" }
      ],
      "requirement": { "minStats": { "intelligence": 60 } }
    },
    {
      "level": 2,
      "name": "火计·通",
      "effects": [
        { "type": "fire_damage", "value": 1.3, "range": 1, "condition": "spread_25", "description": "1格，伤害×1.3，25%蔓延" }
      ],
      "requirement": { "minStats": { "intelligence": 65 }, "useCount": 3 }
    },
    {
      "level": 3,
      "name": "火计·精",
      "effects": [
        { "type": "fire_damage", "value": 1.6, "range": 2, "condition": "spread_30", "description": "2格，伤害×1.6，30%蔓延" }
      ],
      "requirement": { "minStats": { "intelligence": 70 }, "useCount": 8 }
    },
    {
      "level": 4,
      "name": "火计·极",
      "effects": [
        { "type": "fire_damage", "value": 2.0, "range": 2, "condition": "burn_2turns", "description": "2格，伤害×2.0，灼烧2回合" }
      ],
      "requirement": { "minStats": { "intelligence": 78 }, "useCount": 20 }
    },
    {
      "level": 5,
      "name": "火计·神",
      "effects": [
        { "type": "fire_damage", "value": 2.5, "range": 3, "condition": "spread_50+guaranteed", "description": "3格，伤害×2.5，50%蔓延，必中" }
      ],
      "requirement": { "minStats": { "intelligence": 88 }, "useCount": 50, "itemRequired": 101 }
    }
  ]
}
```

---

## 九、scenarios.json — 剧本

**长期首批目标：7个历史剧本（184/190/194/200/208/219/234）+ 英雄集结假想剧本。当前0-A为2个可选剧本。**

**0-A 实际数据（Session 106/109）**：2个场景。场景1为 `英雄集结·开局即高光` what-if Demo，`eventIds=[]`，不会串入历史事件；场景2为 `关东义兵（190·0-A 技术切片）`，正月开局，含董卓、袁绍、曹操、孙坚四个可玩指挥集团与24事件（5→24，Session 109扩展）。后者不是约30势力全量开局：河内、鲁阳不在30城地图中，壶关/宛只作补给节点代理，场景说明不得宣称袁绍占上党或孙坚独占南阳。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 剧本ID |
| name | string | 剧本名 |
| description | string | 背景介绍 |
| type | 'historical' \| 'whatif' | 史实/假想 |
| noLifespan? | boolean | 假想剧本是否忽略生卒年 |
| startYear | number | 起始年 |
| endYear | number | 终止年 |
| startState | ScenarioStartingState | 初始状态(见03-data-models) |
| factionSetups | ScenarioFactionSetup[] | 剧本级势力名、颜色、领袖、据点、模式与史实说明 |
| eventIds | number[] | 本剧本可扫描的事件白名单 |
| availableOfficerIds / availableFemaleIds | number[] | 场景角色白名单；未列入者不进入运行态 |
| childEventIds | number[] | 场景可补登的子女事件白名单；历史切片为空 |
| availableEventLayers / defaultEventLayers | EventSourceClass[] | 可用/默认史料层 |
| scopeNote? | string | 技术切片或玩法抽象边界 |
| playableFactions | number[] | 可选势力ID |
| recommendedFaction? | number | 推荐势力 |

### 示例

```json
{
  "id": 4,
  "name": "三顾茅庐",
  "type": "historical",
  "noLifespan": false,
  "description": "建安十二年(207年)，刘备三顾茅庐请出诸葛亮为军师。曹操一统北方，孙权威震江东。荆州刘表老迈，益州刘璋暗弱。天下三分之势，初见端倪...",
  "startYear": 207,
  "endYear": 280,
  "factionSetups": [ ... ],
  "eventIds": [120],
  "availableOfficerIds": [50, 890],
  "availableFemaleIds": [],
  "childEventIds": [],
  "availableEventLayers": ["official_history", "annotated_history", "literature"],
  "defaultEventLayers": ["official_history", "annotated_history"],
  "startState": {
    "year": 207,
    "month": 1,
    "factions": [1, 2, 3, 4, 5, 6],
    "activeFactionIds": [1, 2, 3, 4, 5, 6],
    "cityOwnership": { ... },
    "officerPositions": [ ... ],
    "femalePositions": [ ... ],
    "initialDiplomacy": [ ... ],
    "completedEvents": []
  },
  "playableFactions": [1, 2, 3, 4, 5],
  "recommendedFaction": 2
}
```

---

## 十、events.json — 历史事件

**0-A 当前实际数据（Session 106/109）**：共 **24条**，均属于场景2。Session 106先建立陈留起兵、推举盟主、迁都长安、汴水追击、虎牢关传奇5个核心事件，Session 109再新增 E105~E123 共19个事件，形成5条叙事线与玩家抉择系统；英雄集结无事件。事件运行态支持场景隔离、史料层过滤、年月窗口、前置、前序选项条件、互斥、过期失效、玩家决策与AI性格/理想权重。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 事件ID |
| name | string | 事件名 |
| description | string | 简介 |
| category | string | 类别 |
| sourceClass | EventSourceClass | `official_history/annotated_history/literature/legend/gameplay` |
| sources | string[] | 史料或文学来源，不把演义标成正史 |
| scenarioIds | number[] | 所属剧本；须与 Scenario.eventIds 双向一致 |
| dateWindow | {startYear,startMonth,endYear,endMonth} | 有效年月窗口；年份不能单独保证触发 |
| decisionFactionId? | number | 决策势力；玩家控制时弹窗，AI控制时自动加权选择 |
| prerequisiteEventIds? | number[] | 前置事件 |
| mutexGroup? | string | 互斥组；同组已有完成事件则失效 |
| conditions | EventCondition[] | 触发条件 |
| dialogues | Dialogue[] | 对话段 |
| choices | EventChoice[] | 选项 |

### 示例

```json
{
  "id": 100,
  "name": "三顾茅庐",
  "description": "刘备三次拜访诸葛亮于隆中草庐，请之出山。",
  "category": "historical",
  "sourceClass": "official_history",
  "sources": ["《三国志·蜀书·诸葛亮传》"],
  "scenarioIds": [4],
  "dateWindow": { "startYear": 207, "startMonth": 1, "endYear": 208, "endMonth": 12 },
  "decisionFactionId": 2,
  "conditions": [
    { "type": "year", "field": "currentYear", "operator": "equals", "value": 207 },
    { "type": "faction", "field": "rulerId", "targetId": 2, "operator": "equals", "value": 50 },
    { "type": "city", "field": "controllerId", "targetId": 42, "operator": "equals", "value": 2 },
    { "type": "officer", "field": "officerId", "operator": "in", "value": [890] },
    { "type": "officer", "field": "status", "operator": "equals", "value": "free" }
  ],
  "dialogues": [
    { "speakerId": 50, "speakerName": "刘备", "text": "孔明先生，备三顾草庐，诚心请教天下大计。" },
    { "speakerId": 890, "speakerName": "诸葛亮", "text": "将军以仁德之心待天下，亮愿效犬马之劳。" }
  ],
  "choices": [
    {
      "label": "请孔明出山",
      "effects": [
        { "type": "recruit", "target": "officer", "targetId": 890, "field": "faction", "value": 2 }
      ],
      "aiWeight": 100
    }
  ]
}
```

---

## 十一、passes.json — 关隘数据

共 25 条。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 关隘ID |
| name | string | 关隘名 |
| x | number | 地图X坐标 |
| y | number | 地图Y坐标 |
| maxGarrison | number | 最大驻军 3000~5000 |
| maxWallDurability | number | 城墙耐久 2000~5000 |
| blocksRoutes | number[][] | 封锁的城市间道路 |
| providesIntel | number[] | 可侦察的周边城市ID |
| isMountainPass | boolean | 山地关隘(骑兵不可攻) |
| isRiverPass | boolean | 水关(需水军或造船) |
| isFortressPass | boolean | 雄关(守防+50%) |
| province | string | 所属州 |

### 示例

```json
{
  "id": 1,
  "name": "虎牢关",
  "x": 460, "y": 390,
  "maxGarrison": 5000,
  "maxWallDurability": 5000,
  "blocksRoutes": [[1, 2]],
  "providesIntel": [1, 2],
  "isMountainPass": false,
  "isRiverPass": false,
  "isFortressPass": true,
  "province": "司隶"
}
```

---

## 十二、minorities.json — 少数民族

共 6 组(每组3~4个据点，合计19个据点)。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| group | EthnicGroup | 民族ID |
| activeSeason | Season | 最活跃季节 |
| strongholdCount | number | 据点数量 |
| initialTension | number | 初始紧张度 |
| strongholds | object[] | 据点坐标 |

### 示例

```json
{
  "group": "xiongnu",
  "activeSeason": 3,
  "strongholdCount": 3,
  "initialTension": 30,
  "strongholds": [
    { "x": 380, "y": 180, "respawnTimer": 0 },
    { "x": 420, "y": 170, "respawnTimer": 0 },
    { "x": 400, "y": 200, "respawnTimer": 0 }
  ]
}
```

---

## 十三、resources.json — 资源产出

105城的资源产出配置。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| cityId | number | 城市ID |
| wood | number | 每季木材产出 |
| iron | number | 每季铁产出 |
| warhorse | number | 每季战马产出 |

### 示例

```json
{ "cityId": 49, "wood": 80, "iron": 0, "warhorse": 0 }
{ "cityId": 67, "wood": 0, "iron": 50, "warhorse": 0 }
{ "cityId": 93, "wood": 0, "iron": 0, "warhorse": 40 }
```

---

## 十四、itemsets.json — 套装定义

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 套装ID |
| name | string | 套装名 |
| ownerId | number | 专属武将ID |
| description | string | 套装说明 |
| tiers | SetTier[] | 渐进效果(2件/3件/4件) |

### 示例

```json
{
  "id": 3,
  "name": "鬼神吕布",
  "ownerId": 80,
  "description": "方天画戟配赤兔马，人中吕布天下无敌。",
  "tiers": [
    {
      "piecesRequired": 2,
      "description": "单挑必定先手 + 首击必暴击",
      "effects": [
        { "type": "duel_first_strike", "value": 100 },
        { "type": "first_hit_crit", "value": 100 }
      ]
    },
    {
      "piecesRequired": 3,
      "description": "单挑高先手与三连击 + 每战一次败后重伤撤退保护（不改写胜负）+ 冲锋后仍可自由行动",
      "effects": [
        { "type": "duel_invincible", "value": 1 },
        { "type": "free_move_after_charge", "value": 1 }
      ]
    }
  ]
}
```

---

## 十五、郡县历史地理模板（规划）

> **状态：BF-P0 已完成；南郡首批采用类型化 TS 静态常量。** 实施以
> `docs/21-battlefield-scene-design.md` 的 P0～P6 为准；BF-P1～P3 已接运行时，
> BF-P4 当前完成第二郡核心、待单挑链收口。

规划静态数据集：

| 数据集 | 记录语义 | P0 | P6 / 0-B 目标 |
|------|------|:--:|:--:|
| `commanderies` | 郡国定义、治所、年代有效期、模板版本与来源 | **南郡/颍川/陈留/河南尹/河内郡/弘农郡 190 切片共 6 条** | **105 个郡国** |
| `counties` | 属县/侯国/前沿节点、郡内相对位置、置信度与来源 | **16 + 17 + 17 + 21 + 18 + 9 = 98 个战场县节点** | 随 105 郡国逐批补齐；全量县总数待后续校勘，不预设 |
| `historicalRoutes` | 郡内道路、水路、关渡及季节性 | **11 + 29 + 19 + 40 + 35 + 17 = 151 条** | 随模板覆盖扩展 |
| `battlefieldLandmarks` | 河湖、山口、渡桥、港口等地貌锚点 | **10 + 4 + 10 + 10 + 10 + 11 = 55 条** | 随模板覆盖扩展 |

**105 口径说明（数字真源）**：`cities.json` 的 0-B 目标仍为 **105 个行政大地图治所节点**，每个节点代表一个郡国；独立战场的 `CommanderyDefinition` 全量目标亦为与这些治所一一关联的 **105 个郡国模板**。这不是“105 城 + 另加 105 郡国”，也不代表县级节点只有 105 个。县级总记录数须在 P0/P4 校勘与 Schema 验证后另行登记，当前不得估填。

每条历史地理记录必须带稳定 ID、年代有效期（适用时）、`sourceRefs` 与 `attested | approximate | inferred` 置信度。静态县名、隶属、相对位置与路线骨架不得由 RNG 补齐；动态部署等随机点只允许消费服务端权威 `xorshift32-v1`。

**BF-P0 现状（Session 163）**：正式 Schema 与南郡数据位于
`shared/data/historical-geography/`。17 是南郡 190 年史载城数；按”大地图战略节点与史实
郡县分离”原则，襄阳保留为独立大地图节点，南郡战场只生成其余 16 个县节点，并以北津
边界入口指向襄阳。该数字不得外推为 105 郡国全量县数。`cities.json` 江陵
`countyCount` 已清理旧占位值并更新为史料摘要 17；此字段当前不参与战场节点生成或数值公式。

**BF-P5 Seed 层（Session 253 新增）**：为简化录入流程，在 Zod schema（校验层）之上新增
**seed 层**（`shared/data/historical-geography/seed-schema.ts`），提供人友好的
`CommanderySeed` → `buildHistoricalGeographyBundle` 纯函数构建器。南郡、颍川、陈留、河南尹、河内郡与弘农郡
均已由 seed 生成，`pnpm verify-historical-geography` 逐郡校验。陈留 190 切片为 17 县、
19 条路径、10 个地标：行政县表以《后汉书·郡国三》为 A 级真源；汳水、睢水、济水/
濮渠三轴据《水经注》录为 approximate 水路；其余县际道路明确标 inferred，不与水经
明载线路混同。河南尹 190 切片为 21 县、40 路、10 地标；县表据
《后汉书·郡国一》，洛/伊/谷水轴据《水经注》，荥阳东口据《三国志·武帝纪》；
道路自动派生项统一标 `inferred`。河内郡 190 切片为 18 县、35 路、10 地标；县表据
《后汉书·郡国一》，河阳—孟津据《水经注》卷五，共—朝歌淇水轴据卷九，王匡参与
关东联军据《三国志·武帝纪》；0-A 30 城没有河内治所，运行时暂借洛阳大地图节点承载
进场与守方归属，不表示河内并入河南尹。
弘农郡 190 切片为 9 县、17 路、11 地标；县表据《后汉书·郡国一》，河水—崤函—
桃林/华阴与洛伊上游参考《水经注》。190 年潼关建置年代有争议，模板不把后世潼关关城
列为确证节点；0-A 暂借长安大地图节点代理进场与守方归属，不表示弘农并入京兆尹。

**BF-P5 郡国模板目录（Session 255 新增，Session 258 扩展）**：`shared/commandery-templates.ts`
为运行时郡国战场模板的唯一登记入口（bundle/templateId/entryNodeIds/
**defenderEntryNodeIds**/instancePrefix/warPrefix/UI 标签）。orchestrator
`enterNanjunBattlefield`、路由校验、`verify-historical-geography` 逐郡校验与前端标签
均从此目录驱动；新增郡国只需登记一条目录条目，并保证 `entryNodeIds` 引用模板内
县节点即可。`defenderEntryNodeIds` 为**守方 Army 部署节点**（R6 守方 Army 入郡域
场景，Session 258）：南郡=州陵/夷道、颍川=舞阳/父城、陈留=外黄/雍丘、河南尹=成皋/偃师、河内郡=野王/怀、弘农郡=陕/弘农，守方势力驻留郡治城市的现役
Army 入场时部署到这些守方纵深前沿县（缺省回退郡治 seat）。南郡兼容包装
`generateNanjunBattlefield` 亦从目录取数。

**BF-P5 年代覆写（Session 257 新增）**：`seed-schema.ts` 的
`CountySeed`/`LandmarkSeed`/`RouteSeed`/`CommanderySeed` 均支持
`validFromYear`/`validToYear`（缺省 = `scenarioYear`，即单一年代条目）；自动派生
road 的有效期取两端县有效期的交集。运行时按年份取模板用纯函数
`resolveBundleForYear(bundle, year)`（`year-overrides.ts`）：过滤出该年有效子集并
重新跑 Zod 校验，请求年份无有效郡国定义或过滤后引用断裂时**抛错**（无静默回退）。
六个 190 切片均为单一年代，多年代能力由测试夹具演示。

| Seed 类型 | 核心字段 | 说明 |
|------|------|------|
| `CommanderySeed` | id/name/province/seatCountyId/worldCityId/scenarioYear/sourceRefs/counties/landmarks?/routes?/autoFillRoads? | 郡国聚合入口；`autoFillRoads` 控制是否从县邻接自动派生 road 路径（缺省 true；南郡水路为主设 false）；支持 `validFromYear`/`validToYear`（缺省=scenarioYear） |
| `CountySeed` | id/name/x/y/adjacent/role?/terrain?/landmarks?/confidence?/sourceRefs? | `role` 可选 seat/county/marquisate/frontier（缺省 county）；`terrain` 可选8种地形标签（缺省 plain）；支持 `validFromYear`/`validToYear` |
| `LandmarkSeed` | id/name/kind/geometry/tacticalTags?/confidence?/sourceRefs? | 实体嵌入式地标（消灭旧「seed只放id、实体另写」半自动模式）；`geometry` 支持 point/polyline/polygon；支持 `validFromYear`/`validToYear` |
| `RouteSeed` | id/from/to/kind?/movementCost?/seasonal?/confidence?/sourceRefs? | 显式 per-edge 路径覆盖；端点可引用县 id 或地标 id；缺省回退 road/1/all/inferred；支持 `validFromYear`/`validToYear` |

数字真源：南郡 16/11/10、颍川 17/29/4、陈留 17/19/10、河南尹 21/40/10、
河内郡 18/35/10、弘农郡 9/17/11（县/路线/地标）；合计 **98 县、151 路线、55 地标**。

---

*文档版本: v2.4 | 2026-07-23 | Session 164 南郡战略节点映射与 countyCount 清债*

---

## 附：Session 100 真源同步说明（未实装，方案文档化）

> 本节为 Session 100 技术储备，零代码改动。实装时需同步本真源 + `shared/types` + Zod 校验 + 全量 JSON。

### 1. officers.json appearance 字段

见上文 §五 字段说明表。0-A 30 武将手工填写，0-B 全量填写记技术债 D-0B-7。

### 1-B. officers.json avatarGene 字段（Session 101 新增）

见上文 §五 字段说明表 + avatarGene 子字段表。0-A 30 武将手工填差异化，0-B 1000+ 武将脚本派生 + 重点人工校对，记技术债 D-0B-7（与 appearance 同条）。与 appearance 职责分离：appearance 服务战斗演出几何造型，avatarGene 服务头像底图渲染。详见 `docs/07-ui-design.md` §11.6、`docs/00-dev-constitution.md` §十一。

### 2. BattleState.activeStrategem 字段（计谋三级联动视觉驱动）

**新增字段**（实装时加到 `shared/types/battle.ts`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| activeStrategem | 'none' \| 'fire' \| 'water' \| 'ambush'? | 计谋三级联动视觉驱动。火计复用已有 `/battle/fire` 引擎设置；水攻/伏兵服务端引擎后置 D-0B-12；前端未收到时默认 'none' |

**规模说明**：非数据规模字段，运行时状态字段，不影响 JSON 数据规模。实装时记技术债 D-0B-11。

---

### 3. 霸府/称王/称帝主线新字段（docs/26/28，HC-P0 与 HC-P1-1～6 已实装）

**新增字段**（均为 optional 追加且未提升 schema 版本；旧存档按各字段契约降级）：

| 字段 | 所属类型 | 类型 | Q | 实装 | 说明 |
|------|:----:|------|:-:|:----:|------|
| `emperorLocation` | GameState | `number \| null?` | Q1 | ✅ HC-P0-1 | 汉献帝所在城池 id；null=未迎奉；随事件/占领迁移 |
| `politicalStage` | Faction | `'vassal'\|'hegemon'\|'king'\|'emperor'?` | Q5 | ✅ HC-P0-2 | 政治阶段状态机，默认 vassal |
| `politicalTitle` | Faction | `string?` | Q7 | ✅ HC-P0-3 | 政治头衔，与 politicalStage 一一对应（vassal→无/hegemon→丞相大将军/king→X王/emperor→X帝） |
| `politicalStageChangedYear` | Faction | `number?` | — | ✅ HC-P0-3 | 开府/称王/称帝年份记录 |
| `politicalStageAgeMonths` | Faction | `number?` | K2 | ✅ HC-P1-1 | 当前政治阶段持续月数；阶段转移归零，非 vassal 每次完整月结 +1，旧档缺失按0 |
| `kingdomName` | Faction | `string?` | K4 | ✅ HC-P1-2 | 首次称王确认后固定的王号；迁都或失地不自动改变 |
| `fame` | Faction | `number?` | — | ✅ HC-P0-6 | 势力声望 0~1000；新局100，旧存档缺失按0 |
| `imperialAuthority` | Faction | `number?` | Q4 | ✅ HC-P0-6 | 皇权点数 0~100；开府100、季度+10、伪诏消耗40 |
| `imperialDecreeCooldown` | Faction | `number?` | Q4 | ✅ HC-P0-6 | 伪诏宣战剩余冷却季数；使用后8，每季度-1 |
| `tags` | Faction | `string[]?` | Q5 | ⏳ 后续 | 势力级叙事立场 tag（匡扶汉室/篡汉/割据等，与 Officer.tags 同体系） |
| `hegemonyPosition` | Officer | `HegemonyPosition?` | Q2/K5 | ✅ HC-P0-4 + HC-P1-3 | 单值朝职轨道：霸府三职加王国六职；三职可由 hegemon/king/emperor 任命，六职仅 king/emperor；每职势力唯一，同一人物改任会覆盖旧朝职 |

**剧本可选配置**：`ScenarioStatic.kingRequirements?.minCities`（正整数）用于覆写相对城池门槛；
`ScenarioFactionSetup.preferredKingdomName?` 提供王号首选。两者均已在 HC-P1-1/2 实装并由严格
Zod 校验。

**规模说明**：非数据规模字段，运行时状态字段，不影响 JSON 数据规模。设计真源 `docs/26-hegemony-court-design.md`，实装分期 HC-P0/P1/P2。

---

## 十六、relations.json — 关系网数据（S24）

**31条记录**（首批），对应 0-A 武将重点关系。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `fromId` | number | 关系发起方武将 ID |
| `toId` | number | 关系接收方武将 ID |
| `type` | string | 关系类型：`sworn`(义兄弟) / `master_disciple`(师徒) / `parent_child`(父子) / `siblings`(兄弟) / `spouse`(夫妻) / `best_friend`(挚友) / `enemy`(宿敌) / `lord_retainer`(君臣) |
| `source` | string | 史源：`official`(正史) / `romance`(演义) |
| `note` | string? | 史源注 |

### 规模说明

首批 31 对，覆盖桃园三义、曹操-曹丕父子、诸葛亮-姜维师徒、孙策-周瑜挚友、各势力敌对关系。0-B 扩展至全量武将。

## 十七、skill-trees.json — 技能树定义（S25）

**5棵子树**，覆盖 0-A 30 通用技能。

### 子树列表

| 子树 ID | 名称 | 技能数 | 生效层 |
|---------|------|:------:|--------|
| `strategy` | 战略计策 | 8 | 六角战场 |
| `tactics` | 战术计策 | 3 | 六角战场 + 白刃战 |
| `duel` | 单挑技能 | 3 | 单挑 |
| `command` | 统军 | 10 | 六角战场 + 白刃战 + 战役 |
| `civil` | 内政 | 8 | 内政 |

### 规模说明

0-A 30 技能映射完毕。0-B 扩展至 69 通用技能 + 80 专属技能（专属不树化）。

## 十八、Officer 运行时新增字段（S24/S25）

| 字段 | 类型 | 说明 |
|------|------|------|
| `skillTreeState` | `Record<string, number>?` | 技能树状态，nodeId → 当前等级（0=未解锁） |
| `skillPointsSpent` | `number?` | 已消耗的技能点数 |
| `traitLevels` | `Record<string, number>?` | 特性等级状态，traitId → 当前等级 |
| `traitPointsSpent` | `number?` | 已消耗的特性点数 |
| `consortIds` | `{id, rank}[]?` | 妾/姬列表（女性实体引用），rank=`concubine`(妾) / `ji`(姬) |

## 十九、Faction 运行时新增字段（S26）

| 字段 | 类型 | 说明 |
|------|------|------|
| `mandate` | `number?` | 天命值 0~100，势力宏观运势 |
| `popularWill` | `number?` | 人心值 0~100，微观人际关系聚合 |

## 二十、系统 ID 真源

| 系统 | ID | 成熟度 | 说明 |
|------|:--:|:------:|------|
| 关系网 | S24 | D | 社交图谱 + 亲和度引擎，Session 284 首轮实装 |
| 技能树 | S25 | D | 技能树化 + 点数加点，Session 284 首轮实装 |
| 天命人心 | S26 | D | 双轨系统，Session 284 首轮实装 |
| 城级派系与门阀 | S27 | **M/D** | 城级派系 + 声望兵装，Session 285 首轮实装（试点 6 城，效果全接入） |

## 二十一、城级派系与门阀数字真源（S27）

> **数字真源**：本节为 S27 唯一数字真源。实现位置 `shared/city-factions.ts`（派生/效果纯函数）+
> `server/src/engine/factionPolitics.ts`（命令+月度结算）。改数值必须先改本节，再同步代码。

### 一、城级派系

| 项 | 数值 | 说明 |
|----|------|------|
| 核心派系 | 世家 / 流民 / 商贾 | 试点城市必有 |
| 随机池 | 豪强 / 宗族 / 教团 / 官宦 / 游侠 | 每城 0~2 个（45%/35%/20%） |
| 初始满意度 | 核心 40~60；小势力 45~65（特例：官宦 15~45、豪强/宗族 55~75）；名门 60~75 | 按城市 ID 哈希派生（确定性） |
| 试点城市 | 洛阳(1) / 长安(2) / 阳翟(3) / 汝南(4) / 邺(5) / 陈留(7) | 0-A 边界，其余城市为空 |
| 名门特例 | 阳翟 → 颍川荀氏·颍川陈氏；汝南 → 汝南袁氏 | 仅出现在郡望城市 |
| 满意度回归 | 每月向 50 移动 ±1 | 月度结算 |

### 二、命令效果

| 命令 | 费用 | 执行人门槛 | 效果 | 功绩 | RNG 消费 |
|------|------|-----------|------|:----:|----------|
| 开垦 | 50 金 | 智谋型（智≥60） | 流民 +8~15；世家 −10~20；farm +20~40 | +4 | 3 次 |
| 巡查 | 30 金 | 武官（武≥60） | 商贾 +5~10；各随机池小势力 −8~15；当月该城免叛乱 | +4 | 1+小势力数 次 |
| 兵装采购 | 10 金/件 | —（势力级） | 兵装库存 +N | — | 0 |

### 三、效果换算

| 效果 | 数值 | 说明 |
|------|------|------|
| 世家 <30 | 守军士气 −15% | 防守己方城市（无守方 Army 时） |
| 商贾 ≥70 / <30 | 商业产出 ×(1+15%) / ×(1−15%) | 接入 turn.ts 产金公式 |
| 小势力 <30 | 每月 10% 叛乱 | 兵力 −10%、民心 −5、不满小势力满意度重置 50；巡查当月豁免 |
| 流民 ≥70 | 征兵兵源 +20% | 征兵上限（maxMen）提升 |
| 名门（世家） | 征兵每 100 兵 −1 兵装 | 名门支援军备，不足则照常征兵 |
| 民兵 | floor(人口 ×0.02 × 民心/100) | 民心 ≥60 时加入守军（战斗/战役/攻防通用） |
| 训练 | 每次 −5 兵装 | 兵装不足则照常训练 |
| 农业完成 | 世家 +3 | 开发完成联动 |
| 商业完成 | 商贾 +3 | 开发完成联动 |
| 施米 | 流民 +3、声望 +2 | 与 S03 既有施米叠加 |

### 四、声望（fame）

| 项 | 数值 | 说明 |
|----|------|------|
| 范围 | 0~1000 | 初始 100 |
| 破城 | +20 | 武力夺取 |
| 占城（投降） | +10 | siege_surrender |
| 灭国 | +50 | 势力灭亡时 |
| 结盟 | +10 | 结盟成功 |
| 施米 | +2 | 每次施米 |
| 每季衰减 | −2 | 季度首月（1/4/7/10）全势力 |
| 武将投奔加成 | 基数 ×1.1/×1.2/×1.35 | fame ≥300/≥600/≥900，接 S11 登用 |
| 叙事化标签 | 5 档文言 | `fameLabel`：≥900 威震天下 / ≥600 名扬海内 / ≥300 声名鹊起 / ≥100 崭露头角 / <100 名不见经传（Session 287，纯展示） |

### 五、兵装（arms）

| 项 | 数值 | 说明 |
|----|------|------|
| 采购 | 10 金/件 | 势力级命令 |
| 首都月产 | +8/月 | 每座城防 ≥150 的城再 +2/月 |
| 战斗战力 | 满配(arms×100≥兵力) +5%；缺口过半(且已有库存) −10% | 六角/战役通用 |
| 战斗消耗 | 损失按 0.5× 兵力损失折算 | battle.ts 结算 |
| 训练消耗 | 每次 −5 | 见上表 |

## 二十二、S27 运行时新增字段

| 字段 | 载体 | 类型 | 说明 |
|------|------|------|------|
| `cityFactions` | City | `CityFactionEntry[]?` | 城级派系列表（kind/name/satisfaction），旧档缺省按城市 ID 派生 |
| `factionPatrolStamp` | City | `number?` | 巡查时间戳（年×12+月），当月免叛乱判定 |
| `arms` | Faction | `number?` | 兵装库存 |
| `fame` | Faction | `number?` | 声望 0~1000（S26 起已存在，S27 起活跃使用） |
| `CityFactionEntry` | Zod | enum CITY_FACTION_KINDS | 8 类派系 kind 白名单 |

## 二十三、派系事件数字真源（S27 深化，Session 286）

> 每城每月至多 1 事件：先高满意度池（任一 ≥70，25%），未中则低满意度池
> （核心三派系任一 <30，20%）；事件在叛乱判定之后执行。命中派系取 entries 顺序首个。
> 实现：`shared/city-factions.ts` `pickFactionEvent` + `server/src/engine/factionPolitics.ts`。

| 派系 | 条件 | 事件名 | 效果 | RNG |
|------|------|--------|------|-----|
| 世家 | ≥70 | 名门献金 | 城金 +30~60 | 1 次 |
| 流民 | ≥70 | 流民垦荒 | farm +10~25 | 1 次 |
| 商贾 | ≥70 | 货路繁盛 | 城金 +40~80 | 1 次 |
| 豪强 | ≥70 | 豪强应募 | 兵力 +3%（至少 +20） | 0 次（确定性公式） |
| 宗族 | ≥70 | 宗族输粮 | 城粮 +50~100 | 1 次 |
| 教团 | ≥70 | 教团祈福 | 民心 +2 | 0 次 |
| 官宦 | ≥70 | 官宦引荐 | 城金 +20~40 | 1 次 |
| 游侠 | ≥70 | 游侠缉盗 | 守军士气 +2 | 0 次 |
| 世家 | <30 | 世家抽逃 | 城金 −20~40 | 1 次 |
| 流民 | <30 | 流民流亡 | farm −5~15 | 1 次 |
| 商贾 | <30 | 商贾撤资 | 城金 −30~60 | 1 次 |
| — | — | 触发判定 | — | 高池 1 次（未中另 1 次低池判定，最大 2 次）+ 数值 1 次 |

## 二十四、弹劾数字真源（S27 深化，Session 286）

> 触发：`eunuchs` 满意度 <30（Session 286 实测校准：官宦初始区间降至 15~45，
> 部分城开局即有触发可能）且城有城主（`city.officers[0]` 在职非君主）→ 每月 20%
> （仅当该月叛乱判定未触发时）；写 `City.pendingImpeachment`。
> 处理：`appease` 耗金 100 → 官宦 +20；`remove` → 城主解职（S12 appointOfficer）忠诚 −10、
> 官宦 +10。逾期 2 月：官宦 −5、城主忠诚 −2。
> 实现：`server/src/engine/factionPolitics.ts` + POST `/civil/impeach`。

| 项 | 数值 |
|----|------|
| 弹劾触发概率 | 每月 20% |
| 安抚花费 | 100 金 |
| 安抚效果 | 官宦满意度 +20 |
| 撤换效果 | 城主解职、忠诚 −10、官宦满意度 +10 |
| 逾期时限 | 2 个月 |
| 逾期效果 | 官宦满意度 −5、城主忠诚 −2 |

## 二十五、自募武装数字真源（S27 深化，Session 286）

> 触发：`militia`/`clan` 满意度 ≥60（Session 286 实测校准：初始区间 55~75 + 回归锚 50，
> 原 ≥70 阈值自然游玩不可达）→ 每月 15%；兵力 +max(20, floor(人口×0.005))、
> 兵装 −3、该派系满意度 −5。与当月高满意度事件互斥（事件层先判定）。
> 实现：`shared/city-factions.ts` `canSelfRecruit` + `server/src/engine/factionPolitics.ts`。

| 项 | 数值 |
|----|------|
| 自募触发概率 | 每月 15% |
| 触发满意度阈值 | 豪强/宗族 ≥60 |
| 兵力增量 | max(20, floor(人口 ×0.005)) |
| 兵装消耗 | 3 件 |
| 满意度回吐 | 该派系 −5 |
