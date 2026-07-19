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
| beautyPool | number | `floor(adultFemale/400)`，与女成强制同步 |
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

**18条记录**。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | FormationType 枚举值 (0~17) |
| name | string | 阵型名 |
| description | string | 说明 |
| historicalSource | string | 史料出处 |
| modifiers | { attack, defense, mobility, range } | 属性修正 |
| effects | FormationEffect[] | 特殊效果 |
| allowedUnits | UnitType[] | 可用兵种 |
| bestUnits | UnitType[] | 最佳兵种(额外+10%) |
| restrictedUnits | UnitType[] | 禁用兵种 |
| terrainModifiers | Record | 地形适应修正 |

### 示例 (2条)

```json
[
  {
    "id": 0,
    "name": "方阵",
    "description": "攻守均衡之基本阵型，前后左右均可应敌。",
    "historicalSource": "孙膑兵法·十阵",
    "modifiers": { "attack": 1, "defense": 1, "mobility": 0, "range": 0 },
    "effects": [],
    "allowedUnits": ["lightInfantry", "heavyInfantry", "spearman", "archer", "crossbowman"],
    "bestUnits": ["heavyInfantry", "spearman"],
    "restrictedUnits": [],
    "terrainModifiers": { "plain": 0, "forest": -1, "mountain": -2, "water": -3 }
  },
  {
    "id": 15,
    "name": "八卦阵",
    "description": "诸葛亮所创八阵图，天地风云龙虎鸟蛇，变化无穷。",
    "historicalSource": "三国志·诸葛亮传",
    "modifiers": { "attack": 2, "defense": 2, "mobility": 1, "range": 0 },
    "effects": [
      { "name": "八门", "description": "全兵种+15%全属性", "modifier": { "type": "all_stats", "value": 15 } }
    ],
    "allowedUnits": ["lightInfantry", "heavyInfantry", "spearman", "archer", "crossbowman", "lightCavalry", "heavyCavalry"],
    "bestUnits": ["heavyInfantry", "archer"],
    "restrictedUnits": ["siege"],
    "terrainModifiers": { "plain": 5, "forest": 5, "mountain": 3, "water": -2 }
  }
]
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

**165条记录**。

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

**当前实际数据（Session 117 文档校正）**：`officers.json` 实测 **199条史实武将**，由0-A验收基线30人、Sessions 110~115累计新增137人，以及当前已存在的 ID 252~283 共32人组成。此处只记录当前文件事实；Phase 0-B 的1000+全量目标仍未启动，继续保持暂缓。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 武将ID |
| name | string | 姓名 |
| birthYear | number | 出生年 |
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

**规模说明**：optional 字段，不影响 officers.json 总条数（0-A验收基线30，当前实际199，0-B目标1000+）。实装时记技术债 D-0B-7（与 appearance 同条，0-B 全量填写时一并处理）。

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
  "formationMastery": [0, 2, 4, 6, 7, 8, 16],
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
      "description": "单挑不败 + 冲锋后仍可自由行动",
      "effects": [
        { "type": "duel_invincible", "value": 1 },
        { "type": "free_move_after_charge", "value": 1 }
      ]
    }
  ]
}
```

---

*文档版本: v2.0 | 2026-07-19 | Session 117 文档漂移校正：0-A验收基线30人、当前实际199名史实武将、2个0-A剧本、24个190事件*

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
