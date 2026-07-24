# 数据模型 & 类型定义

> 所有类型定义位于 `shared/types/`，运行时校验位于 `shared/validators/`

## 目录

1. [枚举定义](#一枚举定义)
2. [武将 Officer](#二武将-officer)
3. [城市 City](#三城市-city)
4. [关隘 & 少数民族](#四关隘--少数民族)
5. [势力 Faction](#五势力-faction)
6. [经济 Finance](#六经济-finance)
7. [部队 Army](#七部队-army)
8. [兵种模板 UnitTemplate](#八兵种模板-unittemplate)
9. [阵型 Formation](#九阵型-formation)
10. [宝物 Item](#十宝物-item)
11. [技能 Skill](#十一技能-skill)
12. [女性角色 FemaleCharacter](#十二女性角色-femalecharacter)
13. [赏赐美人 Beauty](#十三赏赐美人-beauty)
14. [子女生育事件 ChildBirthEvent](#十四子女生育事件-childbirthevent)
15. [历史事件 GameEvent](#十五历史事件-gameevent)
16. [剧本 Scenario](#十六剧本-scenario)
17. [存档 SaveData](#十七存档-savedata)
18. [战斗状态 BattleState](#十八战斗状态-battlestate)
19. [单挑类型 DuelTypes](#十九单挑类型-dueltypes)
20. [API 通用类型](#二十api-通用类型)
23. [独立郡域战场设计契约](#二十三独立郡域战场设计契约)

---

## 一、枚举定义

```typescript
// ========================
// 势力
// ========================
export type FactionId = number;

// ========================
// 兵种类型
// ========================
export enum UnitType {
  // 基础兵种
  LIGHT_INFANTRY = 'lightInfantry',       // 轻步兵
  HEAVY_INFANTRY = 'heavyInfantry',       // 重步兵
  SPEARMAN = 'spearman',                  // 长枪兵
  ARCHER = 'archer',                      // 弓箭手
  CROSSBOWMAN = 'crossbowman',            // 弩兵
  LIGHT_CAVALRY = 'lightCavalry',         // 轻骑兵
  HEAVY_CAVALRY = 'heavyCavalry',         // 重骑兵
  HORSE_ARCHER = 'horseArcher',           // 骑射手
  LIGHT_NAVY = 'lightNavy',               // 走舸（轻水军）
  MEDIUM_NAVY = 'mediumNavy',             // 蒙冲（中水军）
  HEAVY_NAVY = 'heavyNavy',               // 楼船（重水军）
  SIEGE = 'siege',                        // 攻城器械

  // 特殊兵种
  TIGER_LEOPARD = 'tigerLeopard',         // 虎豹骑 (魏)
  QINGZHOU_TROOPS = 'qingzhouTroops',     // 青州兵 (魏)
  TRAPPED_CAMP = 'trappedCamp',           // 陷阵营 (吕布)
  WHITE_HORSE = 'whiteHorse',             // 白马义从 (公孙瓒)
  XILIANG_IRON = 'xiliangIron',           // 西凉铁骑 (马腾)
  DANYANG_TROOPS = 'danyangTroops',       // 丹阳兵 (孙吴)
  JIEFAN_TROOPS = 'jiefanTroops',         // 解烦兵 (吴)
  WHITE_EAR = 'whiteEar',                 // 白耳兵 (蜀)
  WUDANG_FLYING = 'wudangFlying',         // 无当飞军 (蜀)
  RATTAN_ARMOR = 'rattanArmor',           // 藤甲兵 (南中)
  ELEPHANT = 'elephant',                  // 象兵 (南中)
  YELLOW_TURBAN = 'yellowTurban',         // 黄巾军
}

// ========================
// 兵种适性
// ========================
export type UnitProficiency = 'S' | 'A' | 'B' | 'C' | 'NONE';

// ========================
// 阵型精通
// ========================
export enum FormationType {
  // 陆阵（18 种）
  SQUARE = 0,         // 方阵
  CIRCLE = 1,         // 圆阵
  WEDGE = 2,          // 锥形
  GOOSE = 3,          // 雁行
  CRANE_WING = 4,     // 鹤翼
  FISH_SCALE = 5,     // 鱼鳞
  ARROWHEAD = 6,      // 锋矢
  CRESCENT = 7,       // 偃月
  LONG_SNAKE = 8,     // 长蛇
  YOKE = 9,           // 衡轭
  SPARSE = 10,        // 疏阵
  DENSE = 11,         // 数阵
  HOOK = 12,          // 钩形
  MYSTERIOUS = 13,    // 玄襄
  CHARIOT_WHEEL = 14, // 车悬
  EIGHT_TRIGRAMS = 15,// 八卦
  CHARGE = 16,        // 冲阵
  CLOUD = 17,         // 云阵
  // 水阵（9 种，ID 18~26）
  LINE = 18,          // 横阵
  COLUMN = 19,        // 纵阵
  GOOSE_RETURN = 20,  // 雁回阵
  ENCIRCLE = 21,      // 包围阵
  FIRE_ATTACK = 22,   // 火攻阵
  RAM = 23,           // 撞角阵
  CHAIN = 24,         // 连环阵
  RAID = 25,          // 突袭阵
  WATER_DRAGON = 26,  // 水龙阵
}

// ========================
// 技能
// ========================
export type SkillCategory = 'tactics' | 'command' | 'civil' | 'personal' | 'unique';

export enum SkillType {
  // 计略
  FIRE = 'fire',
  WATER = 'water',
  ROCKFALL = 'rockfall',
  AMBUSH = 'ambush',
  TAUNT = 'taunt',
  DISCORD = 'discord',
  CALM = 'calm',
  INSPIRE = 'inspire',
  SORCERY = 'sorcery',
  ILLUSION = 'illusion',
  FALSE_REPORT = 'falseReport',
  CHAIN = 'chain',
  TRAP = 'trap',
  FOG = 'fog',
  LIGHTNING = 'lightning',

  // 指挥
  GALLOP = 'gallop',
  FORCED_MARCH = 'forcedMarch',
  RAPID_ATTACK = 'rapidAttack',
  HOLD = 'hold',
  LONG_RANGE = 'longRange',
  FORMATION_CHANGE = 'formationChange',
  REORGANIZE = 'reorganize',
  LURE = 'lure',
  REARGUARD = 'rearguard',
  RAID = 'raid',
  NIGHT_FIGHT = 'nightFight',
  WATER_DRILL = 'waterDrill',

  // 内政
  FARMING = 'farming',
  COMMERCE = 'commerce',
  FORTIFY = 'fortify',
  RECRUIT = 'recruit',
  TRAIN = 'train',
  DISCOVER = 'discover',
  ELOQUENCE = 'eloquence',
  NETWORK = 'network',
  FLOOD_CONTROL = 'floodControl',
  MEDICINE = 'medicine',

  // 个人
  INSIGHT = 'insight',
  COUNTER_PLAN = 'counterPlan',
  COMPOSURE = 'composure',
  BRAVERY = 'bravery',
  TENACITY = 'tenacity',
  GUARD = 'guard',
  RIDING = 'riding',
  ARCHERY = 'archery',
  LONG_DRIVE = 'longDrive',
  ESCAPE = 'escape',
  GODSPEED = 'godspeed',
  HIDE = 'hide',

  // 专属 (示例，共80个)
  UNIQUE_VILLAIN = 'unique_villain',           // 奸雄 曹操
  UNIQUE_BERSERKER = 'unique_berserker',       // 刚烈 夏侯惇
  UNIQUE_FIERY_BOW = 'unique_fiery_bow',       // 烈弓 夏侯渊
  UNIQUE_TIGER_FOOL = 'unique_tiger_fool',     // 虎痴 许褚
  UNIQUE_ANCIENT_EVIL = 'unique_ancient_evil', // 古之恶来 典韦
  UNIQUE_RAIDER = 'unique_raider',             // 突袭 张辽
  UNIQUE_CLEVER = 'unique_clever',             // 巧变 张郃
  UNIQUE_SUPPLY_CUT = 'unique_supply_cut',     // 断粮 徐晃
  UNIQUE_HOLD_FAST = 'unique_hold_fast',       // 据守 曹仁
  // ... 共80个，详见数据字典
}

// ========================
// 宝物品类
// ========================
export type ItemCategory = 'weapon_primary' | 'weapon_secondary' | 'armor' | 'mount' | 'book' | 'special' | 'consumable';

export type PrimaryWeaponSubType = 'sword' | 'blade' | 'spear' | 'halberd' | 'blunt';
export type SecondaryWeaponSubType = 'bow' | 'crossbow' | 'throwing';
export type ArmorSubType = 'cloth' | 'leather' | 'metal' | 'specialArmor';
export type ItemQuality = 'common' | 'rare' | 'epic' | 'legendary';

// ========================
// 官职系统
// ========================
export enum CivilPosition {
  ADVISORY_GENTLEMAN = 1, PALACE_ATTENDANT, SHANGSHU_PUYE, ZHONGSHU_LING,
  YUSHI_ZHONGCHENG, TINGWEI, DASINONG, SHAOFU, TAICHANG, GUANGLUXUN,
  DAHONGLU, ZONGZHENG, WEIWEI, TAIPU, SIKONG, SITU, TAIWEI,
  SHANGSHU_LING_CHIEF, LU_SHANGSHU_SHI, CHANCELLOR,
}

export enum LocalPosition {
  COUNTY_PREFECT = 'county_prefect',       // 县令(1城)
  COMMANDERY_ASSISTANT = 'cmd_assist',     // 郡丞
  COMMANDERY_COMMANDANT = 'cmd_duwei',     // 都尉
  ADMINISTRATOR = 'administrator',         // 太守(1郡)
  PROV_INSPECTOR = 'inspector',            // 刺史(1州)
  PROV_GOVERNOR = 'governor',              // 州牧(全州)
}

export enum MilitaryPosition {
  JUNHOU = 1, JUNSIMA, BIEBU_SIMA, DUWEI, XIAOWEI, ZHONGLANGJIANG,
  DEPUTY_GENERAL, ASSISTANT_GENERAL, STANDARD_GENERAL,
  TAOKOU_GENERAL, POLU_GENERAL, DANGKOU_GENERAL,
  FENWEI_GENERAL, YANGWU_GENERAL, ZHENGLU_GENERAL,
  HUWEI_GENERAL, ZHECHONG_GENERAL, YINGYANG_GENERAL,
  FOUR_PING_E, FOUR_PING_W, FOUR_PING_S, FOUR_PING_N,
  FOUR_AN_E, FOUR_AN_W, FOUR_AN_S, FOUR_AN_N,
  FOUR_ZHEN_E, FOUR_ZHEN_W, FOUR_ZHEN_S, FOUR_ZHEN_N,
  FOUR_ZHENG_E, FOUR_ZHENG_W, FOUR_ZHENG_S, FOUR_ZHENG_N,
  REAR_GENERAL, FRONT_GENERAL, LEFT_GENERAL, RIGHT_GENERAL,
  GUARD_GENERAL, CHARIOT_GENERAL, SWIFT_CAVALRY_GENERAL,
  GRAND_GENERAL,
}

export enum NobilityRank {
  NONE = 0,
  GUANNEI_MARQUIS,   // 关内侯（无封地，不世袭）
  TING_MARQUIS,      // 亭侯
  XIANG_MARQUIS,     // 乡侯
  XIAN_MARQUIS,      // 县侯（列侯最高等）
  DUKE,              // 公
  KING,              // 王
  EMPEROR,           // 皇帝
}

// ========================
// 单挑
// ========================
export enum DuelAction {
  FIERCE_ATTACK = 'fierce_attack',  // 猛攻 (克牵制·被必杀克)
  RESTRAIN = 'restrain',            // 牵制 (克必杀·被猛攻克)
  FINISHER = 'finisher',            // 必杀 (克猛攻·被牵制克·无视闪避)
  PARRY = 'parry',                  // 格挡 (减伤+反手·被周旋克)
  DODGE = 'dodge',                  // 闪避 (免疫猛攻/牵制·被周旋克·被必杀无视)
  PROBE = 'probe',                  // 周旋 (克闪避/格挡·被猛攻克)
  SNEAK_ATTACK = 'sneak_attack',    // 暗袭 (副武器·1场1次·不参与克制)
}

// ========================
// 游戏常量
// ========================
export enum Season {
  SPRING = 0,   // 春
  SUMMER = 1,   // 夏
  AUTUMN = 2,   // 秋
  WINTER = 3,   // 冬
}

export enum OfficerStatus {
  FREE = 'free',           // 在野
  ACTIVE = 'active',       // 在职
  PRISONER = 'prisoner',   // 俘虏
  DEAD = 'dead',           // 死亡
}

// 理想
export type Ideal = 'hegemony' | 'benevolence' | 'separatist' | 'chivalry' | 'fame';

// 性格
export type Personality = 'brave' | 'calm' | 'bold' | 'cautious' | 'reckless' | 'gentle';

// 成长潜力
export type GrowthPotential = 'low' | 'mid' | 'high';

// 地形
export enum TerrainType {
  PLAIN = 'plain',
  FOREST = 'forest',
  MOUNTAIN = 'mountain',
  WATER = 'water',
  WALL = 'wall',
  CITY = 'city',
  SWAMP = 'swamp',
}

// 天气
export enum Weather {
  CLEAR = 'clear',
  RAIN = 'rain',
  FOG = 'fog',
  SNOW = 'snow',
}

// 外交关系
export enum DipRelation {
  NEUTRAL = 'neutral',
  ALLIED = 'allied',
  VASSAL = 'vassal',
  AT_WAR = 'atWar',
}

// ========================
// 特殊人物
// ========================
export enum SpecialNPC {
  HUATUO = 'huatuo', ZIPING = 'jiping', ZUOCI = 'zuoci', YUJI = 'yuji',
  ZIXU = 'zixu', GUANLU = 'guanlu', SIMAHUI = 'simahui',
  HUANGCY = 'huangcy', XUSHAO = 'xushao', CUIZP = 'cuizp',
  SHIGY = 'shigy', LIYI = 'liyi',
}

// ========================
// 出身标签
// ========================
export type TagCategory = 'social' | 'region' | 'career' | 'political' | 'special';

export interface OfficerTag {
  category: TagCategory;
  tag: string;
}

// ========================
// 关系网
// ========================
export type RelationState = 'intimate' | 'friendly' | 'neutral' | 'strained' | 'disliked' | 'hostile';

export interface OfficerRelation {
  affinity: number;
  staticCompat: number;
  dynamicModifier: number;
  state: RelationState;
  sharedBattles: number;
  sharedSeasons: number;
  lastSeason: number;
}

// ========================
// 装备/兵种熟练度
// ========================
export interface Proficiency {
  weaponPrimary: number;        // 0~100
  weaponSecondary: number;      // 0~100
  armor: number;                // 0~100
  mount: number;                // 0~100
  study: Record<number, {       // 书籍研读度
    level: number;              // 0~80
    masteryUnlocked: boolean;
  }>;
  ownership: Record<number, {   // 特殊物品持有期
    seasonsHeld: number;        // 0~120
    currentHolder: boolean;
  }>;
}

export interface UnitUsageRecord {
  unitType: UnitType;
  battlesUsed: number;
  breakpointsHit: number;
  bestFormationMatches: number;
}

// ========================
// 开局设定
// ========================
export interface GameSetup {
  scenarioId: number;
  factionId: number;
  rulerId: number;
  difficulty: 'easy' | 'normal' | 'hard' | 'extreme';
  battleDifficulty: 'easy' | 'normal' | 'hard';
  rules: {
    historicalEvents: boolean;
    officerLifespan: 'historical' | 'extended' | 'immortal';
    battleTimeLimit: 60 | 90 | -1;
    duelAnimation: 'full' | 'fast' | 'skip';
    fogOfWar: boolean;
    minorityActivity: 'low' | 'normal' | 'high';
    resourceAbundance: 'scarce' | 'normal' | 'abundant';
    rebellionFrequency: 'low' | 'normal' | 'high';
    autoSaveInterval: 'season' | 'year' | 'off';
  };
  startingBonus: {
    extraGold: 0 | 2000 | 5000;
    extraFood: 0 | 5000 | 15000;
    extraFame: 0 | 500 | 1000;
    techBoost: 0 | 1;
  };
  preset?: 'historical' | 'sandbox' | 'challenge' | 'casual' | 'custom';
}

// ========================
// 武将特性
// ========================
export enum TraitCategory {
  STRATEGY = 'strategy', TACTICS = 'tactics', COMBAT = 'combat',
  CIVIL = 'civil', PERSONALITY = 'personality',
}

export interface OfficerTrait {
  traitId: number;
  category: TraitCategory;
  level: number;             // 1~5
  ceiling: number;           // 属性天花板
}

// ========================
// 城市等级
// ========================
export enum CityTier {
  PASS = 1,          // 关隘
  COUNTY = 2,        // 县城
  COMMANDERY = 3,    // 郡治
  PROVINCE = 4,      // 州治
  CAPITAL = 5,       // 都城
  PALACE = 6,        // 宫城
}

// ========================
// 少数民族
// ========================
export enum EthnicGroup {
  XIONGNU = 'xiongnu',     // 匈奴
  XIANBEI = 'xianbei',     // 鲜卑
  QIANG = 'qiang',         // 羌
  DI = 'di',               // 氐
  SHANYUE = 'shanyue',     // 山越
  NANMAN = 'nanman',       // 南蛮
}

// ========================
// 资源
// ========================
export enum ResourceType {
  WOOD = 'wood',           // 木材
  IRON = 'iron',           // 铁
  WARHORSE = 'warhorse',   // 战马
}

// ========================
// 城市设施
// ========================
export enum CityFacility {
  GRANARY = 'granary',           // 粮仓
  MARKET = 'market',             // 市集
  ACADEMY = 'academy',           // 学院
  BLACKSMITH = 'blacksmith',     // 铁匠铺
  STABLE = 'stable',             // 马厩
  CLINIC = 'clinic',             // 医馆
  DOCK = 'dock',                 // 码头
  BEACON = 'beacon',             // 烽火台
  FORTIFICATION = 'fortification', // 城墙加固
  ROAD = 'road',                 // 驿道
  // 宫城专属
  ANCESTRAL_TEMPLE = 'ancestralTemple', // 太庙
  GRAND_HALL = 'grandHall',             // 大殿
  OBSERVATORY = 'observatory',          // 观星台
  UNIVERSITY = 'university',            // 大学
  ROYAL_GUARD = 'royalGuard',           // 虎贲营
  MINT = 'mint',                        // 铸币司
}

// ========================
// 城市政策
// ========================
export enum CityPolicy {
  LIGHT_TAX = 'lightTax',           // 轻徭薄赋
  HEAVY_TAX = 'heavyTax',           // 重税
  ELITE_RECRUIT = 'eliteRecruit',   // 募兵制
  MASS_RECRUIT = 'massRecruit',     // 征兵制
  FREE_MARKET = 'freeMarket',       // 市易自由
  PROMOTE_FARMING = 'promoteFarming', // 劝农
  MARTIAL = 'martial',              // 尚武
  SCHOLARLY = 'scholarly',          // 崇文
  REFUGEES = 'refugees',            // 招抚流民
  PACIFY = 'pacify',                // 安境
}
```

### 5-A. 谈判概率契约（R2）

`shared/negotiation.ts` 是 S11 登用与 S08 结盟的共享纯函数真源。输入、逐项修正与输出统一采用
`0~100` 的百分点数值，最后一次 clamp 到 `[5,90]`；UI 不保存第二份概率字段，而是从当前
`GameState` / `Officer` 即时派生，避免 DTO 百分比与服务端结算漂移。当前 `Faction` 尚无声望、
戒备和利益冲突字段，结盟分解中的这些项按 0 处理；这是明确的 Demo 缺口，不新增伪字段。

---

## 二、武将 Officer

```typescript
export interface OfficerStats {
  leadership: number;     // 统帅 裸属性 1~100（天花板仅1人=100）
  war: number;            // 武力 裸属性 1~100
  intelligence: number;   // 智力 裸属性 1~100
  politics: number;       // 政治 裸属性 1~100
  charisma: number;       // 魅力 裸属性 1~100
}

/** 五维天花板：统=曹操 武=吕布 智=诸葛亮 政=荀彧 魅=刘备 */
export type CeilingAttribute = 'leadership' | 'war' | 'intelligence' | 'politics' | 'charisma';

export interface CeilingBonus {
  attribute: CeilingAttribute;
  /** 见 shared/ceiling.ts CEILING_HOLDERS：吕50/诸葛20/曹15/荀10/刘5 */
  hiddenBonus: number;
  // 有效属性 = 面板属性 + hiddenBonus（仅天花板持有者）
}

export interface OfficerHidden {
  compatibility: number;     // 相性 0~150
  righteousness: number;     // 义理 0~15
  ambition: number;          // 野心 0~15
  valor: number;             // 勇猛 0~7
  composure: number;         // 冷静 0~7
  lifespan: number;          // 寿命年(死亡年)
  growth: GrowthPotential;   // 成长潜力
  personality: Personality;  // 性格
  ideal: Ideal;              // 理想
  bloodline: number[];       // 血缘武将ID(父子/兄弟)；0-A 数据不完整，非正式父子边
  // fatherId / motherId：设计可补（武将父辈）；运行时类型尚未实现，勿与 bloodline 混用
  /** 天花板隐藏加成；非天花板为 null */
  ceilingBonus: CeilingBonus | null;
}

export interface OfficerSkill {
  skillId: SkillType;
  level: number;        // 1~5
  useCount: number;     // 当前等级已使用次数
}

export interface Officer {
  id: number;
  name: string;
  portrait: number;
  birthYear: number;
  deathYear: number;

  // 公开属性
  stats: OfficerStats;

  // 隐藏属性 (玩家不可直接查看)
  hidden: OfficerHidden;

  // 兵种适应性
  unitProficiency: Record<UnitType, UnitProficiency>;

  // 阵型精通与熟练度（Session 120 重写：从二进制列表改为逐阵型等级/熟练度/极状态）
  formationMastery: number[];
  // ↑ 旧字段保留为"已解锁阵型 ID 列表"，运行时由以下结构派生：
  // formationProficiency: Record<number, {
  //   level: number;             // 当前等级 1~5
  //   experience: number;        // 当前经验值
  //   ultimateUnlocked: boolean; // 是否已解锁极
  //   postUltimateProficiency: number; // 达到极后的溢出熟练度
  // }>;

  // 技能
  skills: OfficerSkill[];
  uniqueSkill?: SkillType;  // 专属技

  // 当前状态
  faction: FactionId | null;
  location: number;            // 城市ID
  loyalty: number;             // 0~100
  experience: number;          // 经验
  status: OfficerStatus;
  wounds: number;              // 伤势 0~100

  // 三轨官职
  civilPosition: CivilPosition | null;
  localPosition: LocalPosition | null;
  militaryPosition: MilitaryPosition | null;
  nobilityRank: NobilityRank | null;

  // 功绩
  merit: number;               // 累计功绩 0~210000+

  // 功绩等级（以下3字段设计稿已定，运行时类型尚未实现，需在 shared/types/officer.ts 补全）
  // meritLevel: number;          // 功绩等级 1~20，由 merit 反查20级表得到
  // meritPath: 'warrior' | 'scholar' | 'neutral';
  // peakMeritLevel: number;      // 生涯最高等级，用于衰减退级底线

  // 体力
  stamina: {
    current: number;
    max: number;
    recovery: number;
    status: 'vigorous' | 'normal' | 'tired' | 'exhausted' | 'spent' | 'critical';
  };

  // 装备 (5槽)
  equipped: {
    weaponPrimary: number | null;    // 主武器 itemId
    weaponSecondary: number | null;  // 副武器 itemId
    armor: number | null;
    mount: number | null;
    auxiliary: number | null;        // 书籍/特殊
  };

  // 美人 / 婚配（Demo 运行时）
  wifeId?: number | null;       // 正妻女性 id
  beauties: number[];           // 赏赐美人（非婚配）女性 id
  beautyMaintenance?: number;   // 月均美人供养费（全量未做）

  // 出身标签 & 关系
  tags: OfficerTag[];
  relations: Record<number, OfficerRelation>;

  // 熟练度
  proficiency: Proficiency;
  unitUsageRecords: UnitUsageRecord[];

  // 特性
  traits: OfficerTrait[];
}
```

---

## 三、城市 City

```typescript
export interface CityStats {
  farm: number;        // 农业 0~1000
  commerce: number;    // 商业 0~1000
  wall: number;        // 城墙 0~1000
  morale: number;      // 民心 0~100
}

/**
 * 城市人口结构（见 04-game-systems §28；实现 shared/demographics.ts）
 * total = adultMale + adultFemale + child + elder
 * City.population ≡ total；City.beautyPool 是旧 Demo 兼容字段，R7 后不得由 adultFemale 派生
 */
export interface CityDemographics {
  adultMale: number;    // 成年男 — 征兵池、粮耗最高、劳力主力
  adultFemale: number;  // 成年女 — 生育/劳动；决定 beautyPool
  child: number;        // 儿童 — 新生只入此桶
  elder: number;        // 老人 — 自然衰老死亡主因
}

export interface City {
  id: number;
  name: string;
  province: string;
  x: number;
  y: number;
  terrain: TerrainType;
  maxPopulation: number;
  tier: CityTier;               // 城市等级 1~6
  countyCount: number;           // 史实郡国下辖县数摘要；不直接决定战场节点数或参与数值公式

  stats: CityStats;
  gold: number;
  food: number;
  /** 总人口（≡ sum(demographics)；写路径必须改桶再 withSyncedPopulation） */
  population: number;
  /** 人口四桶（Demo 运行时必填；开局由 total 按 DEFAULT_DEMO_RATIO 拆分） */
  demographics: CityDemographics;
  /**
   * 美女/美人资源量 = floor(adultFemale / 400)
   * 人口结算后强制同步；日后搜罗美人消耗此池
   */
  beautyPool: number;
  troops: number;
  troopsMorale: number;
  officers: number[];
  ruler: FactionId | null;

  // 设施与政策
  facilities: CityFacility[];    // 已建设施（最多=设施槽数）
  policy: CityPolicy | null;     // 当前政策

  // 持续开发进度
  developmentProgress: Partial<Record<'farm' | 'commerce' | 'wall' | 'culture' | 'craft' | 'transport' | 'sanitation', {
    progress: number;            // 0~100
    assignedOfficerId: number;
    hiatusQuarters: number;      // 中断季数(≥3季重置进度)
  }>>;

  isCapital: boolean;
  isPass: boolean;
  specialProduct: string | null;
  resourceOutput: Partial<Record<ResourceType, number>>;  // 每季资源产出
  recruitableUnits: UnitType[];
}
```

---

## 四、关隘 Pass

```typescript
export interface Pass {
  id: number;
  name: string;
  x: number;
  y: number;
  controller: FactionId | null;

  tier: CityTier;               // 固定为 PASS(1)

  // 驻军
  garrison: number;             // 驻军兵数
  maxGarrison: number;          // 3000~5000
  garrisonOfficers: number[];

  // 城防
  wallDurability: number;
  maxWallDurability: number;    // 2000~5000

  // 战略价值
  blocksRoutes: number[][];     // 封锁的城市间道路 [fromCityId, toCityId]
  providesIntel: number[];      // 可侦察的周边城市ID

  // 类型
  isMountainPass: boolean;
  isRiverPass: boolean;       // 水关(需水军或造船)
  isFortressPass: boolean;
}

export interface MinorityState {
  group: EthnicGroup;
  tension: number;              // 紧张度 0~100
  activeSeason: Season;          // 最活跃季节
  strongholdCount: number;       // 据点数量
  strongholds: {
    x: number;
    y: number;
    respawnTimer: number;        // 被灭后重生倒计时(季)
  }[];
  lastInteraction: number;       // 上次交互的年+季
  isHalfFaction: boolean;        // 南蛮为true
}

export interface ResourceStock {
  wood: number;
  iron: number;
  warhorse: number;
}

export interface CityUpgradeLog {
  cityId: number;
  fromTier: CityTier;
  toTier: CityTier;
  completedYear: number;
  completedQuarter: number;
  path: 'usurpEmperor' | 'dukePromotion' | 'kingProclamation' | 'default';
}
```

---

## 五、势力 Faction

```typescript
export interface Faction {
  id: number;
  name: string;
  color: string;               // 势力颜色(hex)
  ruler: number;                // 君主武将ID
  cities: number[];             // 拥有城市ID
  gold: number;                 // 势力总金
  food: number;                 // 势力总粮
  fame: number;                 // 声望 0~1000
  diplomacy: Record<number, DiplomaticRelation>;
  technology: TechnologyLevel;
  activePolicy: string | null;
}

export interface DiplomaticRelation {
  targetFaction: FactionId;
  relation: DipRelation;
  favorability: number;        // 友好度 0~100
  marriageBond: boolean;       // 是否有联姻关系
  marriageExpiresYear: number | null;
  truceUntilYear: number | null;
  tribute: {
    gold: number;
    target: FactionId;
    expiresYear: number;
  } | null;
}

export interface TechnologyLevel {
  agriculture: number;    // 1~5
  commerce: number;       // 1~5
  military: number;       // 1~5
  siege: number;          // 1~5
  naval: number;          // 1~5
}
```

---

## 六、经济 Finance

```typescript
export interface FactionFinance {
  gold: number;
  food: number;
  lastSeasonIncome: number;
  lastSeasonExpense: number;

  income: {
    commerceTax: number;
    agricultureTax: number;
    customsTax: number;
    tribute: number;
    other: number;
  };
  expense: {
    salaries: number;
    armyFood: number;
    armyEquipment: number;
    cityMaintenance: number;
    ruralMaintenance: number;
    transport: number;
    seasonal: number;
    other: number;
  };
}

export interface CityFinance {
  maintenanceCost: number;
  garrisonFoodCost: number;
  netIncome: number;
}
```

---

## 七、部队 Army

```typescript
export interface Army {
  id: number;
  commanderId: number;
  subCommanders: number[];
  advisorId?: number;       // 参谋（新增）
  subAdvisorId?: number;    // 副参谋（新增）
  unitType: UnitType;
  formation: FormationType;
  troopCount: number;
  maxTroopCount: number;
  morale: number;
  food: number;
  location: {
    cityId?: number;
    x?: number;
    y?: number;
  };
  status: 'garrison' | 'marching' | 'inBattle' | 'retreating' | 'destroyed';
  targetCityId?: number;
  arrivalTurn?: number;
}

export interface ArmySupply {
  foodPerSeason: number;
  equipmentDurability: number;   // 0~100
  equipmentRepairCost: number;
}
```

---

## 八、兵种模板 UnitTemplate

```typescript
export interface UnitTemplate {
  type: UnitType;
  name: string;
  isSpecial: boolean;

  // 基础属性
  attack: number;
  defense: number;
  mobility: number;
  range: number;

  // 特性
  traits: UnitTrait[];
  description: string;

  // 克制关系
  strongAgainst: UnitType[];   // 克制
  weakAgainst: UnitType[];     // 被克制

  // 招募条件
  recruitRequirement?: {
    minTech?: Partial<Record<keyof TechnologyLevel, number>>;
    factionId?: FactionId;
    officerId?: number;
    cityProvince?: string;
  };

  // 地形适应
  terrainModifiers: Partial<Record<TerrainType, number>>; // 倍率

  // 消耗
  recruitCost: {
    gold: number;
    food: number;
    population: number;
  };
}

export interface UnitTrait {
  name: string;
  description: string;
  modifier: {
    type: string;
    value: number;
    condition?: string;
  };
}
```

---

## 九、阵型 Formation

> Session 120 全面重写：新增等级/熟练度/极、水阵体系、科技树前置。以下类型对应运行时代码 `shared/types/formation.ts`。

```typescript
/** 单级阵型数据 */
export interface FormationLevelData {
  level: 1 | 2 | 3 | 4 | 5;
  attack: number;
  defense: number;
  mobility: number;
  range: number;
  specialEffects?: string[];
}

/** 极效果 */
export interface FormationUltimate {
  attackBonus: number;
  defenseBonus: number;
  mobilityBonus: number;
  rangeBonus: number;
  effect: string;                  // 极的质变描述
  proficiencyRequired: number;     // 熟练度门槛（默认 500）
}

/** 阵型前置条件（科技树） */
export interface FormationPrerequisite {
  formationId: number;
  requiredLevel: number;           // 1~5
}

/** 完整阵型模板（静态 JSON） */
export interface Formation {
  id: number;                      // 陆阵 0~17，水阵 18~26
  name: string;
  description: string;
  historicalSource: string;        // 史料出处

  family: 'land' | 'water';       // 体系：陆阵 / 水阵

  tiers: FormationLevelData[];     // Lv1~Lv5 每级数据

  ultimate: FormationUltimate;     // 极效果

  // 特殊效果（独立于等级）
  effects: FormationEffect[];

  // 兵种限制
  allowedUnits: UnitType[];        // 可用兵种
  bestUnits: UnitType[];           // 最佳兵种（额外加成）
  restrictedUnits: UnitType[];     // 禁用兵种

  // 地形适应
  terrainModifiers: Partial<Record<TerrainType, number>>;

  // 科技树前置（非基础阵型必填）
  prerequisites?: FormationPrerequisite[];

  // 特殊解锁条件
  specialUnlock?: {
    minIntelligence?: number;      // 智力门槛
    minNavalProficiency?: UnitProficiency;  // 水军适性门槛
    allowOnlyUnitTypes?: UnitType[]; // 限定兵种
  };
}

export interface FormationEffect {
  name: string;
  description: string;
  modifier: {
    type: string;
    value: number;
    condition?: string;
  };
}
```

---

## 十、宝物 Item

```typescript
export interface ItemEffect {
  type: string;
  value: number;
  range?: number;
  condition?: string;
  description?: string;
}

export interface ItemEquipRequirement {
  minStats?: Partial<OfficerStats>;
  requiredSkill?: SkillType;
  factionId?: FactionId;
  officerId?: number;
  officerType?: string;
}

export interface ItemBond {
  officerId: number;
  resonance: {
    stats: Partial<OfficerStats>;
    effects: ItemEffect[];
    description: string;
  };
}

export interface SetTier {
  piecesRequired: number;
  description: string;
  effects: ItemEffect[];
}

export interface ItemSet {
  id: number;
  name: string;
  ownerId: number;
  description: string;
  tiers: SetTier[];
}

export interface ConsumableEffect {
  type: 'heal' | 'boost' | 'tactic' | 'contract' | 'special';
  value: number;
  duration?: number;
  description: string;
}

export type AcquisitionMethod = 'initial' | 'search' | 'shop' | 'event' | 'craft' | 'loot' | 'inherit';

export interface Item {
  id: number;
  name: string;
  category: ItemCategory;
  quality: ItemQuality;

  // 武器专属 (主/副分槽)
  primaryWeaponSubType?: PrimaryWeaponSubType;
  secondaryWeaponSubType?: SecondaryWeaponSubType;

  // 盔甲专属
  armorSubType?: ArmorSubType;

  // 基础效果
  baseStats: Partial<OfficerStats>;
  baseEffect: ItemEffect[];

  // 装备门槛
  equipRequirement: ItemEquipRequirement;

  // 专属共鸣
  bond?: ItemBond;

  // 套装
  sets?: number[];

  // 消耗品专属
  consumable?: {
    effect: ConsumableEffect;
    maxStack: number;
  };

  // 获取
  acquisition: AcquisitionMethod[];
  shopPrice?: number;
  description: string;
}
```

---

## 十一、技能 Skill

```typescript
export interface SkillLevel {
  level: number;             // 1~5
  name: string;              // "火计·初", "火计·通", ...
  effects: SkillEffect[];
  requirement: {
    minStats?: Partial<OfficerStats>;
    useCount?: number;
    prevLevel?: number;
    itemRequired?: number;    // 道具ID
  };
}

export interface SkillEffect {
  type: string;
  value: number;
  range?: number;
  condition?: string;
  description: string;
}

export interface Skill {
  id: SkillType;
  name: string;
  category: SkillCategory;
  description: string;
  maxLevel: number;           // 通用5级，专属1级
  levels: SkillLevel[];
}
```

---

## 十二、女性角色 FemaleCharacter

```typescript
export type FamilyTier = 'imperial' | 'greatClan' | 'localPower' | 'commoner';
export type MaritalStatus = 'single' | 'betrothed' | 'married' | 'widow';
export type SpouseInfluenceType =
  | 'household' | 'counsel' | 'martial' | 'prestige' | 'fortitude' | 'scholarship';

export type SpouseTalent =
  | 'incorruptible' | 'cityDefender' | 'recruiter' | 'economicBoost'
  | 'moraleAnchor' | 'medicalKnowledge' | 'diplomaticGrace'
  | 'bloodlineWarrior' | 'bloodlineScholar' | 'bloodlineRuler'
  | 'captiveShield' | 'siegeBrewer' | 'nightRaid'
  | 'floodPreventer' | 'faminePreventer' | 'featherFan'
  | 'warCounsel' | 'loyaltyAura' | 'childEducator' | 'concubineHarmony';

export interface FemaleCharacter {
  id: number;
  name: string;
  birthYear: number;
  deathYear: number;
  portrait: number;

  // 出身
  family: FamilyTier;
  clanName: string;
  factionId: FactionId | null;
  locationId: number;

  // 家族关系（类型有；0-A females.json 未填；父辈 UI / 随父兄跟随均未接）
  fatherId?: number;
  motherId?: number;

  // 婚配状态
  initialStatus: MaritalStatus;
  initialHusbandId?: number;

  // 六维影响力
  influence: Record<SpouseInfluenceType, number>;

  // 属性加成（作用于夫君）
  statBonus: Partial<OfficerStats>;

  // 技能影响
  teachableSkills: SkillType[];
  enhanceableSkills: { skill: SkillType; bonus: number }[];

  // 天赋
  talents: SpouseTalent[];

  // 事件
  relatedEvents: number[];

  // 婚配门槛
  marriageRequirements?: {
    minRank?: string;
    minFame?: number;
    familyTier?: FamilyTier;
  };

  // 是否可出战(仅祝融为true)
  canCommand: boolean;

  description: string;
}
```

---

## 十三、赏赐美人 Beauty

```typescript
export interface Beauty {
  id: number;
  name: string;
  grade: 1 | 2 | 3 | 4 | 5 | 6;       // 良家女/歌伎/舞姬/侍姬/才女/绝世佳人
  source: 'conscripted' | 'tavern' | 'captured' | 'merchant' | 'recommended' | 'gifted' | 'event';

  instantEffect: { loyaltyBoost: number };
  ongoingEffect: {
    type: 'loyalty' | 'morale' | 'charm' | 'intelligence' | 'counsel' | 'aura';
    value: number;
    interval: 'month' | 'season';
  };

  ownerOfficerId: number | null;    // null = 在势力库存
  age: number;
}
```

---

## 十四、子女生育事件 ChildBirthEvent

> 代码类型名：`ChildBirthDef`（`shared/types/child.ts`）。  
> **实现状态（Session 68）**：0-A 5 条 JSON + Zod + `/static`；`child.ts` 按 `appearYear` 动态入库（可不预置 officers）；姻亲 UI 显示待/已登场。

```typescript
export interface ChildBirthEvent {
  childId: number;               // 子女武将ID（appearYear 时动态入库）
  childName: string;
  fatherId: number;
  motherId: number;
  birthYear: number;
  appearYear: number;            // 登场年(16岁)

  source: 'history' | 'romance' | 'folklore';

  baseStats: OfficerStats;       // 史书基础能力值

  motherBonus?: {
    fromScholarship: Partial<OfficerStats>;
    fromBloodline: Partial<OfficerStats>;
    extraSkills: SkillType[];
    extraTalents: SpouseTalent[];
  };
}
```

---

## 十五、历史事件 GameEvent

```typescript
export interface EventCondition {
  type: 'year' | 'faction' | 'officer' | 'city' | 'event';
  field: string;
  targetId?: number;       // 精确约束某势力/城市/武将；省略时才做集合检查
  operator: 'equals' | 'gte' | 'lte' | 'in' | 'hasItem' | 'notHas' | 'probability';
  value: unknown;
}

export interface EventChoice {
  label: string;
  effects: EventEffect[];
  aiWeight?: number;       // AI选择权重 0~100
  aiPersonalityWeights?: Partial<Record<Personality, number>>;
  aiIdealWeights?: Partial<Record<Ideal, number>>;
}

export interface EventEffect {
  type: 'recruit' | 'loyalty' | 'develop' | 'relation' | 'war' | 'capital' | 'troops';
  target: 'faction' | 'officer' | 'city' | 'global';
  targetId?: number;
  field: string;
  value: unknown;
}

export interface GameEvent {
  id: number;
  name: string;
  description: string;
  category: 'historical' | 'random' | 'marriage' | 'diplomacy' | 'battle';
  sourceClass: 'official_history' | 'annotated_history' | 'literature' | 'legend' | 'gameplay';
  sources: string[];
  scenarioIds: number[];
  dateWindow: { startYear: number; startMonth: number; endYear: number; endMonth: number };
  decisionFactionId?: FactionId;
  prerequisiteEventIds?: number[];
  mutexGroup?: string;

  // 触发条件
  conditions: EventCondition[];

  // 对话（多段）
  dialogues: {
    speakerId?: number;
    speakerName: string;
    text: string;
    portrait?: number;
  }[];

  // 选项
  choices: EventChoice[];
  autoChoice?: number;           // 如果只满足一条选择路径则自动执行
}
```

---

## 十六、剧本 Scenario

```typescript
export interface ScenarioStartingState {
  year: number;
  month: number;
  factions: number[];                  // 参与势力ID
  activeFactionIds: FactionId[];       // 活跃势力

  // 初始城市归属
  cityOwnership: Record<number, FactionId>;

  // 武将初始位置 (按势力分组)
  officerPositions: {
    officerId: number;
    cityId: number;
    factionId: FactionId;
    civilPosition?: CivilPosition;
    localPosition?: LocalPosition;
    militaryPosition?: MilitaryPosition;
    nobilityRank?: NobilityRank;
    merit?: number;
    loyalty: number;
  }[];

  // 女性初始状态
  femalePositions: {
    femaleId: number;
    cityId: number;
    status: MaritalStatus;
    husbandId?: number;
    factionId?: FactionId;
  }[];

  // 初始外交关系
  initialDiplomacy: {
    factionA: FactionId;
    factionB: FactionId;
    relation: DipRelation;
    favorability: number;
    marriageBond?: boolean;
  }[];

  // 已发生事件标记
  completedEvents: number[];
}

export interface ScenarioFactionSetup {
  id: FactionId;
  name: string;
  color: string;
  rulerId: number;
  capitalCityId: number;
  mode: 'territorial' | 'expeditionary' | 'hosted';
  headquartersLabel: string;
  historicalNote?: string;
}

export interface Scenario {
  id: number;
  name: string;
  type: 'historical' | 'whatif';         // 史实/假想
  description: string;
  startYear: number;
  endYear: number;
  startState: ScenarioStartingState;
  factionSetups: ScenarioFactionSetup[];
  eventIds: number[];
  availableOfficerIds: number[];
  availableFemaleIds: number[];
  childEventIds: number[];
  availableEventLayers: EventSourceClass[];
  defaultEventLayers: EventSourceClass[];
  scopeNote?: string;
  playableFactions: FactionId[];
  recommendedFaction?: FactionId;
  noLifespan?: boolean;
}
```

`factionSetups` 是势力名称/领袖/据点真源，服务端不再用全局硬编码四势力。0-A 的 `expeditionary/hosted` 仍需一个补给节点维持现有城市经济与命令入口；`historicalNote` 必须声明节点代理不等于史实郡县独占。真正无城军团、寄驻和从属军仍待判别式位置模型。

---

## 十七、存档 SaveData

```typescript
export interface GameState {
  scenarioId: number;
  enabledEventLayers: EventSourceClass[];
  enabledChildEventIds: number[];
  currentYear: number;
  currentMonth: number; // 1~12；每次结束回合只推进 1 月
  season: Season;       // 由月份派生：1~3春、4~6夏、7~9秋、10~12冬
  playerFactionId: FactionId;

  // 实体
  officers: Record<number, Officer>;
  cities: Record<number, City>;
  factions: Record<number, Faction>;
  females: Record<number, FemaleCharacter>;

  // 旧战术层与当前战役层
  armys: Army[];
  campaignArmies: CampaignArmy[];
  campaignNodes: CampaignNode[];
  grandStrategists: GrandStrategist[];
  activeBattles: BattleState[];
  activeBattlefield: BattlefieldMap | null;
  activeMelee: MeleeState | null;
  // BF-P2 Q10：郡域战场实例（Tier II）；与 activeBattlefield 场景栈互斥
  activeBattlefieldInstance?: BattlefieldInstance | null;
  diplomacy: DiplomacyLink[];
  intel: IntelState;
  plots: Plot[];

  // 事件状态
  completedEvents: number[];
  pendingEvents: number[];
  invalidatedEvents: number[];
  eventChoices: Record<number, number>;

  actionLog: GameAction[];
}

export interface GameAction {
  year: number;
  month: number;
  type: string;
  message: string;
}
```

S01 运行时不额外持久化季度计数；季度边界由新月份 `1/4/7/10` 唯一派生。每次月推进写
`end_turn` 日志，进入季度首月时另写 `quarter_start`，跨年至 1 月时再写 `year_start`。
这些日志是节拍信号，不代表尚未实装的季度内政、俸禄或委任报告已自动结算。

以上根字段以 `shared/types/game.ts` 为代码真源。早期设计中的 `beauties`、`passes`、
`minorities`、`factionResources`、升级记录与宝物库存尚未进入当前运行时 `GameState`，
不得在 v1 快照 Schema 中凭文档旧稿虚构。

---

## 十八、战斗状态 BattleState

```typescript
export interface HexCoord {
  x: number;               // 列
  y: number;               // 行
}

export interface BattleUnit {
  armyId: number;
  commanderId: number;
  commanderName: string;    // 正式交战时揭示的姓名快照；不依赖全局迷雾 officers 投影
  factionId: FactionId;
  unitType: UnitType;
  formation: FormationType;

  troopCount: number;
  maxTroops: number;
  morale: number;
  food: number;

  position: HexCoord;
  isRetreated: boolean;
  isDestroyed: boolean;

  // 状态效果
  statusEffects: BattleStatusEffect[];

  // 技能冷却
  skillCooldowns: Record<SkillType, number>;
}

export interface BattleStatusEffect {
  type: string;            // 'burning' | 'confused' | 'poisoned' | 'intimidated' | 'inspired'
  remainingTurns: number;
  modifier: {
    type: string;
    value: number;
  };
}

export interface BattleState {
  id: number;
  battlefieldId: string;     // 战场地图ID
  turn: number;
  weather: Weather;
  attackerFaction: FactionId;
  defenderFaction: FactionId;
  isSiege: boolean;
  cityId?: number;           // 攻城战时关联的目标城市

  // 部队
  units: BattleUnit[];
  currentTurnUnitIndex: number;

  // 战场网格
  hexGrid: {
    width: number;
    height: number;
    terrain: TerrainType[][];
  };

  // 城池数据(攻城战)
  siegeData?: {
    wallDurability: number;
    maxWallDurability: number;
    gateDurability: number;
  };

  // 天气倒计时
  weatherChangeTimer: number;

  // 战斗日志
  log: BattleLogEntry[];
}

export interface BattleLogEntry {
  turn: number;
  actorId: number;
  action: string;
  target?: number;
  result: BattleActionResult;
}

export interface BattleActionResult {
  type: 'attack' | 'tactic' | 'duel' | 'move' | 'retreat' | 'morale' | 'status';
  sourceUnitId: number;
  targetUnitId?: number;
  damage?: number;
  moraleChange?: number;
  statusApplied?: string;
  description: string;
}
```

---

## 十九、单挑类型 DuelTypes ✅ 已实装（Session 88，`shared/types/duel.ts`）

> 0-A 实装版本与下方设计稿基本一致，差异点：
> - `DuelAction` 枚举更名为 `DuelCommand`（避免与 BattleAction 混淆，语义不变）
> - 新增 `DuelCombatantState`（每方运行时快照，含 sneakUsed/consecutiveBlocks/lastCommand）
> - `DuelState.combatants: Record<number, DuelCombatantState>` 取代 `hp/energy/injury` 平铺字段
> - 新增 `DuelEngineConfig`（maxRounds/baseHp/challengeEnergyCost 可调）
> - **目标差异（Session 168 已批准、未实装）**：增加 `DuelStance` 与双方 stance 快照；
>   吕布传奇保护改为“败而重伤撤退”，不得改写胜负。

```typescript
export type DuelPhase = 'pre_duel' | 'dueling' | 'resolving' | 'resolved';

export type DuelOutcome = 'killed' | 'captured' | 'escaped' | 'draw' | 'surrendered';
export type DuelStance = 'assault' | 'steady' | 'bait' | 'delegate';

export interface DuelInjury {
  part: 'arm' | 'leg' | 'rib' | 'head' | 'severe';
  attackPenalty: number;
  dodgePenalty: number;
  blockPenalty: number;
  stunTurns: number;
}

export interface DuelDialog {
  speakerId: number;
  text: string;
  moraleEffect: number;
}

export interface DuelRound {
  round: number;
  attackerAction: DuelAction;
  defenderAction: DuelAction;
  hit: boolean;
  critical: boolean;
  damage: number;
  attackerHP: number;
  defenderHP: number;
  counterDamage?: number;
  counterCritical?: boolean;
  chainHits?: number[];
  injuryApplied?: DuelInjury;
  description: string;
}

export interface DuelState {
  battleId: string;
  phase: DuelPhase;
  initiatorId: number;       // 发起方
  targetId: number;          // 应战方
  round: number;
  hp: Record<number, number>;
  maxHp: Record<number, number>;
  energy: Record<number, number>;
  preDuelDone: boolean;
  sneakUsed: boolean;
  dialogueLog: DuelDialog[];
  roundHistory: DuelRound[];
  injury: Record<number, DuelInjury | null>;
  stance: Record<number, DuelStance>; // 目标字段；服务端权威记录
  autoResolve: boolean;
  turnOrder: number[];       // [先手Id, 后手Id]
  result?: DuelResult;
}

export interface DuelResult {
  winnerId: number;
  loserId: number;
  outcome: DuelOutcome;
  rounds: DuelRound[];
  moraleChange: { winner: number; loser: number };
  audienceMoraleChange: number;
  meritReward: number;
}
```

---

## 二十、API 通用类型

```typescript
// 分页
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

// API 统一响应
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: Pagination;
}

// WebSocket 消息
export interface WSMessage {
  type: 'turn_update' | 'battle_update' | 'event_triggered' | 'notification' | 'error';
  payload: unknown;
  timestamp: number;
}
```

---

## 二十、战役层数据类型

### 20.1 战役地图节点

```typescript
type NodeType = 'major_city' | 'county' | 'pass' | 'port' | 'facility';

interface CampaignNode {
  id: number;
  name: string;
  type: NodeType;
  x: number;
  y: number;
  ruler: number | null;
  commanderyId: number;
  adjacentNodeIds: number[];
  garrison: number;
  wallDurability: number;
  maxWallDurability: number;
  farm: number;
  commerce: number;
  population: number;
  morale: number;
  lockDirection?: number[];
}
```

### 20.2 战役 Army

```typescript
type CampaignPhase =
  | 'garrison' | 'marching' | 'engaged'
  | 'sieging' | 'assaulting' | 'retreating';

type SquadPosition = 'vanguard' | 'center' | 'left' | 'right' | 'rearguard';

interface CampaignSquad {
  officerId: number;
  role: 'main' | 'sub';
  position: SquadPosition;
  unitType: UnitType;
  troops: number;
  morale: number;
}

interface CampaignArmy {
  id: string;
  factionId: number;
  name: string;
  commanderId: number;
  subCommanderIds: number[];
  advisorId?: number;
  subAdvisorId?: number;
  unitType: UnitType;
  formation: FormationType;
  currentNodeId: number;
  targetNodeId?: number;
  path: number[];
  phase: CampaignPhase;
  troops: number;
  maxTroops: number;
  food: number;
  maxFood: number;
  morale: number;
  organization: number;
  experience: number;
  fatigue: number;
  squads: CampaignSquad[];
  structures: CampStructure[];
  siegeState?: SiegeState;
}

interface SiegeState {
  wallDurability: number;
  maxWallDurability: number;
  gateDurability: number;
  siegeTurns: number;
  attackerStructures: string[];
  defenderBonus: number;
  surrenderChance: number;
}
```

### 20.3 设施系统

```typescript
type StructureType =
  | 'camp' | 'ram' | 'ladder' | 'siege_tower' | 'catapult'
  | 'crossbow_cart' | 'stone_thrower'
  | 'supply_depot' | 'trap' | 'watchtower'
  | 'palisade' | 'trench' | 'pontoon_bridge';

interface CampStructure {
  type: StructureType;
  builderId: number;
  buildProgress: number;
  durability: number;
  effect: string;
  nodeId: number;
  /** Session 121: 工程器械等级 Lv1~Lv3 */
  level?: 1 | 2 | 3;
}

/** Session 121: 工程器械运行时数据 */
interface SiegeEngine {
  type: 'ram' | 'ladder' | 'siege_tower' | 'catapult' | 'crossbow_cart' | 'stone_thrower';
  level: 1 | 2 | 3;
  durability: number;
}

/** Session 121: 城防结构（结构性城防·内政建造） */
interface CityFortification {
  moat: boolean;         // 护城河
  barbican: boolean;     // 瓮城
  barbicanTurrets: 0 | 2 | 4;  // 弩台射位数
  portcullis: boolean;   // 千斤闸
  palaceWall: boolean;   // 宫墙
}

/** Session 121: 战术性城防（围城追加） */
interface TacticalDefense {
  sheepWall: boolean;     // 羊马墙
  ballistaTower: boolean; // 弩台
  wolfTooth: boolean;     // 狼牙拍
  hotOil: boolean;        // 热油池
  groundListen: boolean;  // 地听
  raiders: {              // 夜袭队
    deployed: boolean;
    leaderId?: number;
  };
}
```

### 20.3-B 围城状态（Session 121 扩展）

```typescript
interface SiegeState {
  wallDurability: number;
  maxWallDurability: number;
  gateDurability: number;
  siegeTurns: number;
  attackerStructures: string[];
  defenderBonus: number;
  surrenderChance: number;

  // Session 121: 瓮城/城防扩展
  fortification: CityFortification;       // 城防结构状态
  tacticalDefense: TacticalDefense;       // 战术城防状态
  siegePhase: 'outer_wall' | 'barbican' | 'inner_wall' | 'palace';
  barbicanTurns: number;                  // 瓮城已持续回合数
  barbicanBreachProgress: number;         // 瓮城突破进度 0~100
  ladderSkipBarbican: boolean;            // 云梯跳过标志
}
```

### 20.4 自动战斗结果

```typescript
interface AutoBattleResult {
  winner: 'attacker' | 'defender';
  rounds: number;
  battlefield: string;
  attackerCasualties: number;
  defenderCasualties: number;
  attackerRemaining: number;
  defenderRemaining: number;
  commanderStatus: Record<number, 'alive' | 'wounded' | 'captured' | 'killed'>;
  duels: {
    triggered: boolean;
    attacker: number;
    defender: number;
    winner: number;
    description: string;
  }[];
  attackerMoraleAfter: number;
  defenderMoraleAfter: number;
  prisoners: number;
  spoils: { gold: number; food: number };
  events: {
    round: number;
    type: 'duel' | 'rout' | 'breach' | 'stratagem' | 'advisor'
      | 'barbican_phase' | 'turret_suppressed' | 'night_raid'
      | 'hot_oil' | 'wall_breach' | 'gate_breach';
    description: string;
  }[];
}
```

### 20.5 总军师系统

```typescript
type StrategyType = 'offense' | 'defense' | 'development' | 'endurance';

interface GrandStrategist {
  factionId: number;
  officerId: number;
  appointedYear: number;
  strategy: StrategyType;
  lastStrategyChange: number;
  献策成功: number;
  识破次数: number;
  战略总评: number;
}
```

### 20.6 势力特点

```typescript
interface FactionTrait {
  factionId: number;
  name: string;
  source: string;
  modifiers: {
    type: string;
    value: number;
    description: string;
  }[];
  specialAbility?: {
    name: string;
    trigger: 'passive' | 'active';
    effect: string;
    cooldown?: number;
  };
  flaw?: {
    name: string;
    effect: string;
  };
}
```

---

### 20.7 文教、声教、学派与技艺（Session 105 技术储备，未实装）

```typescript
interface CitySchoolInfluence {
  confucian: number;   // 儒 0-100
  daoist: number;      // 道
  buddhist: number;    // 佛
  mohist: number;      // 墨
  legalist: number;    // 法
  strategist: number;  // 纵横
  medical: number;     // 医
}

interface CityEducationState {
  education: number;                    // 文教 0-1000
  culturalDevelopment: number;          // 声教 0-1000
  educationOfficerIds: number[];         // 学官，基础1席；太学后最多2席
  schoolInfluence: CitySchoolInfluence;  // 各学派独立0-100，合计不封顶
  cultureFacilities: string[];
  culturePolicy?: string;
}

interface ActiveResearch {
  branch: 'farming' | 'commerce' | 'military' | 'fortification' | 'cultivation';
  targetLevel: number;
  investedGold: number;
  completedProgress: number;
}

// Faction 接口扩展：
//   techLevels: Record<ActiveResearch['branch'], number>;
//   activeResearch?: ActiveResearch;
//   culturalPolicy?: string;
```

> 早期草案的 `City.culture: CityCulture` 已废止，避免与城市声教数值重名；未来实装统一使用
> `schoolInfluence`。本节字段不进入 0-A 静态 JSON 规模统计，实装时再同步 shared 类型、Zod 与状态裁剪。

---

*Session 105 修订：§20.7 统一文教/声教/学派/技艺模型命名（纯设计）*

---

## §21 Session 100 前端体验技术储备数据字段（未实装，方案文档化）

> 本章节为 Session 100 技术储备，零代码改动，实装时同步 `docs/08-data-dictionary.md` 真源。

### §21.1 OfficerStatic.appearance（武将特殊造型）

**新增字段**（实装时加到 `shared/types/officer.ts` + `officers.json` + Zod 校验）：

```typescript
interface SpecialAppearance {
  scale: number;          // 体型缩放（如巨型武将吕布 1.5）
  auraColor: string;      // 专属气劲颜色（如吕布 #ff1744 血红）
  weaponLength: number;   // 武器长度（影响 Canvas 上攻击光束判定）
  shadingMode: 'normal' | 'ghost' | 'enraged';  // 外观特效模式
  pheasantPlume?: boolean;   // 是否有雉翎（吕布及少数猛将）
  mount?: 'redHare' | ...;   // 专属坐骑（烈焰足粒子）
  ghostForm?: {              // 鬼神觉醒配置（吕布专属）
    trigger: { rage: number; hpRatio: number };
    scale: number;
    auraColor: string;
    shadingMode: 'ghost';
  };
}

interface OfficerStatic {
  // ... 现有字段
  appearance?: SpecialAppearance;  // 新增
}
```

**0-A 30 武将填写规则**：猛将（吕布/关羽/张飞/典韦/赵云/马超等）手工填写差异化 appearance；文官（荀彧等）填默认值（scale=1.0/auraColor=空/weaponLength=5/normal）。详见 `docs/07-ui-design.md` §11.3 典型武将映射表。

**0-B 全量填写**记技术债 D-0B-7。

### §21.1-B OfficerStatic.avatarGene（武将头像底图基因，Session 101 新增）

> 与 §21.1 `appearance` 战斗造型字段**并存，职责分离**：`appearance` 服务战斗演出几何造型（MeleeStage/DuelStage），`avatarGene` 服务头像底图渲染（OfficerRosterPanel/OfficerDetail/派系面板）。
> 详见 `docs/07-ui-design.md` §11.6、`docs/00-dev-constitution.md` §十一美术铁律、`AGENTS.md` 核心规则 9。

**新增字段**（实装时加到 `shared/types/officer.ts` + `officers.json` + Zod 校验）：

```typescript
type AvatarScheme = 'rubbing' | 'seal' | 'procedural';  // A 拓片 / B 印信 / C 拼图
type BaseRubbing = 'warrior' | 'scholar' | 'servant' | 'royal';
type RibbonColor = 'purple' | 'cyan' | 'black' | 'yellow';  // 汉制印绶：紫/青/墨/黄绶

interface AvatarGene {
  scheme: AvatarScheme;
  // 方案 A/B 共用
  baseRubbing?: BaseRubbing;
  sealText?: string;        // 姓名印章文字（2~4字，朱砂红 + 隶书，2字断行）
  royalSeal?: boolean;      // 皇室金边
  // 方案 B 专用
  clanTitle?: string;       // 籍贯氏族 "琅琊诸葛氏"（静态，按出身）
  officeSeal?: string;      // 当前官职篆印 "荡寇将军"（动态，随 Officer.position 变化）
  ribbonColor?: RibbonColor;  // 印绶颜色（动态，随 NobilityRank 变化）
  // 方案 C 专用
  faceType?: number;   // 0~4（甲/由/申/国/风字脸）
  hairType?: number;   // 0~9（平天冠/进贤冠/武冠/帻巾/帢帽/...）
  beardType?: number;  // 0~9（虬髯/美髯/八字胡/山羊胡/...）
  eyeType?: number;    // 0~9（丹凤眼/细眼/环眼/卧蚕眉/...）
}

interface OfficerStatic {
  // ... 现有字段
  appearance?: SpecialAppearance;  // Session 100 战斗造型
  avatarGene?: AvatarGene;          // Session 101 头像底图基因（新增）
}
```

**0-A 30 武将填写规则**：
- 猛将/主公（15 史实精校）手工填差异化
  - 关羽：`{scheme:'procedural', baseRubbing:'warrior', faceType:3, hairType:2, beardType:1, eyeType:0, sealText:'关羽', clanTitle:'河东关氏', officeSeal:'荡寇将军', ribbonColor:'cyan'}`
  - 吕布：`{scheme:'procedural', baseRubbing:'warrior', faceType:4, hairType:2, beardType:0, eyeType:3, sealText:'吕布', royalSeal:true, clanTitle:'五原郡吕氏', officeSeal:'左将军', ribbonColor:'purple'}`
  - 荀彧：`{scheme:'procedural', baseRubbing:'scholar', faceType:0, hairType:1, beardType:3, eyeType:1, sealText:'荀彧', clanTitle:'颍川荀氏', officeSeal:'尚书令', ribbonColor:'cyan'}`
- 15 占位武将默认值：`{scheme:'rubbing', baseRubbing:'warrior', sealText:姓名, clanTitle:'占位氏', ribbonColor:'yellow'}`
- 0-B 1000+ 武将：脚本按 officer.id 哈希派生 faceType/hairType/beardType/eyeType + 重点人物人工校对 sealText/clanTitle/officeSeal/ribbonColor

**0-B 全量填写**记技术债 D-0B-7（与 appearance 同条，0-B 扩容时一并处理）。

### §21.2 BattleState.activeStrategem（计谋三级联动视觉驱动）

**新增字段**（实装时加到 `shared/types/battle.ts`）：

```typescript
type StrategemKind = 'none' | 'fire' | 'water' | 'ambush';

interface BattleState {
  // ... 现有字段
  activeStrategem?: StrategemKind;  // 新增，计谋三级联动视觉驱动
}
```

**设置规则**：
- 火计：复用已有 `battle.ts` `/battle/fire` 引擎设置 `activeStrategem='fire'`
- 水攻/伏兵：服务端引擎后置 D-0B-12，S17 L2 实装时设置
- 前端未收到该字段时默认 `'none'`

**前端订阅**：`gameStore` 订阅 `battle.activeStrategem`，驱动三级 PCG 渲染（一级 MapCanvas 异象层 / 二级 BattleView 地貌侵蚀 / 三级 MeleeStage 全屏粒子）。详见 `docs/07-ui-design.md` §11.5。

### §21.3 gameStore.floatingDelta（财政飘字，纯前端字段）

**新增字段**（实装时加到 `client/src/stores/gameStore.ts`，非服务端字段）：

```typescript
interface FloatingDelta {
  gold: number;
  food: number;
  reason: string;
}

interface GameStore {
  // ... 现有字段
  floatingDelta: FloatingDelta[];  // 新增，财政飘字 delta
}
```

**触发**：gameStore 各 action 在 `set({game})` 时前端算 delta（newGame vs oldGame 的己方城池金粮汇总差），附带 `floatingDelta`。TopBar/RightPanel 订阅渲染 `+N/-N` 上浮淡出。**服务端不动**。

### §21.4 委任军团类型

**新增字段**（实装时加到 `shared/types/delegation.ts`）：

```typescript
// ========================
// 委任方针
// ========================
enum DelegationPolicy {
  DEVELOPMENT = 'development', // 发展优先
  ARMAMENT = 'armament',       // 军备优先
  BALANCED = 'balanced',       // 平衡型
  OFFENSIVE = 'offensive',     // 攻略型
}

// ========================
// 委任报告（每季生成）
// ========================
interface DelegationReport {
  regionId: string;
  season: number;
  year: number;
  governorId: number;
  actionSummary: string[];             // 本季行动摘要
  troopDelta: number;                  // 兵力变化
  goldDelta: number;                   // 金变化
  foodDelta: number;                   // 粮变化
  battlesWon: number;                  // 出战胜利次数
  battlesLost: number;                 // 出战失败次数
  citiesCaptured: number;              // 攻占城池数
  officersRecruited: number;           // 登用武将数
  warnings: string[];                  // 警告/事件
}

// ========================
// 委任区
// ========================
interface DelegationRegion {
  id: string;                          // 委任区 ID
  name: string;                        // 名称
  cityIds: number[];                   // 归属城池 ID
  governorId: number;                  // 都督武将 ID
  policy: DelegationPolicy;            // 委任方针
  autoRecruit: boolean;                // 自动搜录在野
  autoReward: boolean;                 // 自动赏赐低忠诚
  prohibitedTargets: number[];         // 禁止出征目标势力 ID
  createdYear: number;                 // 创建年份
  lastReport?: DelegationReport;       // 最近一次报告
}
```

**Faction 接口扩展**：

```typescript
interface Faction {
  // ...现有字段
  delegationRegions: DelegationRegion[];  // 委任区列表（§39）
}
```

**新增枚举文件**（`shared/enums/delegation.ts`）：

```typescript
enum DelegationPolicy {
  DEVELOPMENT = 'development',
  ARMAMENT = 'armament',
  BALANCED = 'balanced',
  OFFENSIVE = 'offensive',
}
```

---

## 二十二、存档版本信封（S16 · Gate 2 基础契约）

```typescript
const CURRENT_SAVE_SCHEMA_VERSION = 1;

interface SaveEnvelopeV1<TSnapshot = GameState> {
  schemaVersion: 1;
  createdAt: string;   // 带时区的 ISO 8601
  updatedAt: string;   // 带时区的 ISO 8601
  scenarioId: number;
  rng: {
    algorithm: 'xorshift32-v1';
    state: number;      // 当前非零 uint32 内部寄存器，不只是初始 seed
    draws: number;      // 已消费次数，供审计随机流漂移
  };
  snapshot: TSnapshot;
}
```

`shared/save.ts` 保留通用 `parseSaveEnvelopeV1(input, snapshotSchema)`，并新增 `migrateSaveEnvelopeToCurrent(input)` 与 `parseCurrentSaveEnvelope(input)`。入口先按 `schemaVersion` 显式分发，再以严格 v1 信封和完整 `GameStateSchema` 校验；当前首版就是 v1，因此 v1 分支为恒等迁移，未登记旧版本、未来版本、缺失或非数字版本一律抛出 `UnsupportedSaveVersionError`，不得猜测升级。通用解析器仍要求显式快照 Schema，生产路径禁止传入 `z.unknown()` 绕过快照校验。

`shared/game-state-schema.ts` 已增加首个可组合部件 `GameStateTimelineSchema`，覆盖剧本、年月、季节、玩家势力、事件层、事件账本与操作日志，并严格拒绝未知字段；月份与季节还必须符合 1~3月春、4~6月夏、7~9月秋、10~12月冬。它使用 `Pick<GameState, ...>` 与实际根类型绑定，但当前仍只是组合部件；计谋域补齐并完成全根组合与跨切片校验前，仍不得作为生产快照 Schema。

`shared/game-state-entity-schema.ts` 增加第二个组合部件 `GameStateEntitiesSchema`，覆盖运行时 `Officer`、`City`、`Faction`、`FemaleCharacter`。静态字段复用既有 Zod shape，运行时枚举使用 `z.nativeEnum` 与 TypeScript 类型对齐；记录键必须等于实体 `id`，城市 `population` 必须等于四桶人口之和，婚配与赏赐状态互斥。`pnpm verify-save-entities` 会实际创建两个现有剧本并解析服务端权威实体切片；这仍不等于完整存档可用。

`shared/game-state-campaign-schema.ts` 增加第三个组合部件 `GameStateCampaignSchema`，覆盖兼容保留的旧 `Army`、战役 `CampaignArmy`、`CampaignNode` 与 `GrandStrategist`，并细分 Squad、设施和围城状态 Schema。它拒绝兵力/军粮或城墙耐久超过上限、主副将/参谋重复任职、Squad 武将或阵位重复、节点自环/重复邻接，以及重复 Army/节点 ID 和同势力多个总军师。`pnpm verify-save-campaign` 会实际创建两个剧本，并在英雄集结中完成一次合法编成与一次总军师任命后解析权威战役切片；验证参数从当前状态动态选择，不绑定固定武将驻地。

`shared/game-state-battle-schema.ts` 增加第四个组合部件 `GameStateBattleSchema`，严格覆盖六角 `BattleState`、Tier I `BattlefieldMap` 与 Tier II `MeleeState`，包括嵌套战斗单位、节点、陷阱和单挑状态。除容量、坐标、阶段、归属与 ID 唯一性外，还要求每个六角战斗单位具有非空 `commanderName` 交战快照，并校验战场目标节点、节点 Army 引用，以及白刃战必须归属于当前战场且双方 Army 均在该战场。`pnpm verify-save-battle` 会实际建局并依次执行六角战斗、战场初始化、白刃战回合、分层退出和重新建局边界。

`shared/game-state-diplomacy-schema.ts` 增加第五个组合部件 `GameStateDiplomacySchema`，覆盖 `DiplomacyLink[]`。关系枚举与 `DipRelation` 真源对齐，友好度限制为 -100~100，禁止自外交，并以无向势力对识别 `1↔2` / `2↔1` 重复关系。`pnpm verify-save-diplomacy` 会解析两个真实剧本的初始外交状态，并真实执行两次进贡与一次缔盟后重新校验权威状态。关系中的势力 ID 是否存在属于跨切片引用，留待完整 `GameState` Schema 组合时校验。

`shared/game-state-intel-schema.ts` 增加第六个组合部件 `GameStateIntelSchema`，严格覆盖情报报告、特工、城级反间、任务日志、序号及献美点化额度。除日期、等级、技能和资源范围外，还校验特工 Record 键与 `id` 一致、被俘状态与俘获势力成对、死亡特工无所在城市，以及反间驻守记录与特工 `counter_duty` 状态/位置双向一致；同一特工不得驻守多城。`pnpm verify-save-intel` 会解析两个真实剧本，并实际执行招募、驻守反间、撤防后逐步重新解析权威状态。本轮同时修复 `pruneExpiredIntel()` 重建情报状态时漏掉 `plantableBeauty`、导致献美点化额度随回合清理丢失的问题。城市与势力引用是否存在仍属于完整组合 Schema 的跨切片职责。

`shared/game-state-plot-schema.ts` 增加第七个组合部件 `GameStatePlotSchema`，严格覆盖 `Plot[]`、成本与结算结果。计谋 ID 必须唯一；准备期必须有正数倒计时且无结果，生效期必须有正数倒计时和结果，已结算状态必须倒计时归零且有结果。四类计谋的目标形状也与当前引擎收口：离间计只指定目标势力，假情报指定敌势力与城市，空城疑兵只指定己方城市，美人计可额外指定武将及女间谍；`inverted` 仅属于空城疑兵。`pnpm verify-save-plot` 会解析两个真实剧本，并实际执行离间计发起、扣除 200 金和推进一回合结算，每一步重新解析权威状态。势力、城市、武将及特工引用是否存在仍由下一步完整组合 Schema 统一检查。

`shared/game-state-full-schema.ts` 将上述七个切片组合为严格 `GameStateSchema`：根字段禁止遗漏或混入瞬态字段，并统一校验城市、势力、武将、女性角色、战役节点、CampaignArmy、三级战斗、外交、谍报和计谋的跨切片引用；事件完成/待处理/失效三账本不得交叉。组合层复用各切片 Schema，不复制域内规则。`BattleUnit.armyId` 是六角战斗内部编组 ID，不是旧 `GameState.armys` 外键；出征后 `Officer.location` 可保留行政归属，因此城市驻留清单只采用“清单内武将必须指向本城”的单向一致性约束。`pnpm verify-save-game-state` 覆盖两剧本、真实计谋和 7 类非法跨引用/根字段，10/10；三级战斗验证另以真实进行中状态确认完整 Schema，24/24。

**当前持久化边界（Session 157）**：已采用“完整保存进行中战斗 + 确定性续玩”方案。六角战斗、战场地图、白刃战均以 `GameState` 为权威真源；v1 信封保存 `xorshift32-v1` 的内部寄存器与消费计数。玩家、共享结算及 AI 行动后的持久化结算均已接入该权威流；项目自身只在 S15 的三个 AI 文件保留独立决策随机，因此当前保证“同一已选行动后的结算可确定续玩”，不保证读档后的 AI 行为/整回合完全复现。生产存取入口和实际存储介质仍未完成。

后续加载顺序固定为：解析 JSON → 识别版本/迁移 → 当前信封校验 → 当前快照 Schema 校验 → 重建非持久化运行时上下文。连接、动画、选择框、网络重试等瞬态状态不得加入信封。

---

## 二十三、独立郡域战场设计契约

> **状态：BF-P0 静态历史地理契约已实装；BF-P1 最小闭环已打通；BF-P2 Q10 `BattlefieldInstance` 接入 GameState 已实装。** 正式 Zod 与推导类型位于
> `shared/data/historical-geography/schema.ts`；南郡 190 数据和只读预览位于同目录。
> `BattlefieldInstance` 已接入 `GameState.activeBattlefieldInstance`（Q10，Session 174），与 `activeBattlefield`（Tier I）场景栈互斥；`Encounter` 仍是 P2 设计记录，运行时为空数组。
>
> **双层数据模型（Q11 已落地）**：`BattlefieldMap`（Tier I，数字 cityId）与
> `BattlefieldInstance`（Tier II，字符串 countyId）保持独立、不合并不废弃——
> 详见 `docs/02-architecture.md` §独立郡域战场数据流 + `docs/25-bf-p2-design.md` §四。

```typescript
type HistoricalConfidence = 'attested' | 'approximate' | 'inferred';

interface CommanderyDefinition {
  id: string;
  name: string;
  province: string;
  seatCountyId: string;
  worldCityId: number;
  validFromYear?: number;
  validToYear?: number;
  variantOf?: string;
  countyIds: string[];
  localBounds: LocalBounds;
  sourceRefs: string[];
}

interface CountyDefinition {
  id: string;
  name: string;
  commanderyId: string;
  role: 'seat' | 'county' | 'marquisate' | 'frontier';
  validFromYear?: number;
  validToYear?: number;
  lon?: number;
  lat?: number;
  localX: number;
  localY: number;
  confidence: HistoricalConfidence;
  locationNote?: string;
  terrainTags: string[];
  adjacentCountyIds: string[];
  landmarkIds: string[];
  sourceRefs: string[];
}

interface HistoricalRouteDefinition {
  id: string;
  commanderyId: string;
  fromNodeId: string;
  toNodeId: string;
  kind: 'road' | 'river' | 'pass' | 'ferry';
  movementCost: number;
  seasonal?: 'all' | 'dry' | 'wet';
  validFromYear?: number;
  validToYear?: number;
  variantOf?: string;
  confidence: HistoricalConfidence;
  sourceRefs: string[];
}

interface BattlefieldLandmarkDefinition {
  id: string;
  commanderyId: string;
  name: string;
  kind: 'river' | 'lake' | 'marsh' | 'mountain' | 'pass' | 'ferry' | 'bridge' | 'port';
  validFromYear?: number;
  validToYear?: number;
  variantOf?: string;
  localGeometry: LocalPoint | LocalPolyline | LocalPolygon;
  tacticalTags: string[];
  confidence: HistoricalConfidence;
  locationNote?: string;
  sourceRefs: string[];
}

interface BattlefieldInstance {
  id: string;
  warId: string;
  templateId: string;
  templateVersion: number;
  scenarioDateAtCreation: string;
  targetCommanderyId: string;
  entryNodeIds: string[];
  nodeStates: BattlefieldNodeState[];
  routeStates: BattlefieldRouteState[];
  armyIds: string[];
  encounters: Encounter[];
  turn: number;
  phase: 'active' | 'settling' | 'resolved';
  generationAudit: {
    rngAlgorithm: 'xorshift32-v1';
    rngDrawStart: number;
    rngDrawEnd: number;
    decisions: string[];
  };
}

interface Encounter {
  id: string;
  battlefieldId: string;
  nodeId: string;
  attackerArmyIds: string[];
  defenderArmyIds: string[];
  mode?: 'auto' | 'standard' | 'tactical';
  phase: 'pending' | 'active' | 'resolved';
  result?: EncounterResult;
}
```

P0 定稿相对草案补充：

- 四类静态记录均采用 `.strict()`，稳定 ID 使用小写 snake_case。
- `sourceRefs` 是非空来源 ID 数组，指向同 bundle 的结构化 `HistoricalSource` 目录。
- `localX/localY` 与所有 geometry 坐标强制在 0..1；经纬度必须成对出现且在合法范围。
- `validFromYear <= validToYear`；`variantOf` 已预留于四类记录。
- bundle 级校验覆盖 ID 唯一、来源/郡/县/地标/路线端点引用和县邻接对称性。
- `confidence` 对县记录主要表达位置置信度；县名/隶属可有原典明文而位置仍为
  `approximate` / `inferred`。

契约边界：

- `CountyDefinition` 是静态历史地理，不等于完整行政 `City`；可争夺状态只存在于 `BattlefieldNodeState`。
- `BattlefieldInstance` 冻结 `templateVersion`，进入存档权威快照；场景栈、镜头和动画不入存档。
- `Encounter` 是郡域战场与自动/标准/六角三种接战入口的共同边界，三者输出统一结果后再回写战场实例。
- 所有动态随机函数显式注入权威 `xorshift32-v1`；静态模板解析零 RNG 消费。P3 进一步将战场 AI 行动选择纳入同一权威流，实现整场复现。

---

*文档版本: v4.7 | 2026-07-23 | Session 164 大地图节点与史实郡县口径分离*
