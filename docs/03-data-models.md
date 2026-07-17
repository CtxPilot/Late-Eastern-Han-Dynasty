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

  // 阵型精通 (可用阵型ID列表，0~17)
  formationMastery: number[];

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
 * City.population ≡ total；City.beautyPool ∝ adultFemale
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
  countyCount: number;           // 郡下辖县数（决定战斗地图小城数）

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

```typescript
export interface Formation {
  id: FormationType;
  name: string;
  description: string;
  historicalSource: string;      // 史料出处

  // 属性修正
  modifiers: {
    attack: number;
    defense: number;
    mobility: number;
    range: number;
  };

  // 特殊效果
  effects: FormationEffect[];

  // 兵种限制
  allowedUnits: UnitType[];      // 可用兵种
  bestUnits: UnitType[];         // 最佳兵种(额外加成)
  restrictedUnits: UnitType[];   // 禁用兵种

  // 地形适应
  terrainModifiers: Partial<Record<TerrainType, number>>;
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
  type: string;            // 'year' | 'faction' | 'officer' | 'city' | 'relation' | 'item' | 'random'
  field: string;
  operator: 'equals' | 'gte' | 'lte' | 'in' | 'hasItem' | 'notHas' | 'probability';
  value: unknown;
}

export interface EventChoice {
  label: string;
  effects: EventEffect[];
  aiWeight?: number;       // AI选择权重 0~100
}

export interface EventEffect {
  type: string;
  target: string;          // 'faction' | 'officer' | 'city' | 'global'
  targetId?: number;
  field: string;
  value: unknown;
}

export interface GameEvent {
  id: number;
  name: string;
  description: string;
  category: 'historical' | 'random' | 'marriage' | 'diplomacy' | 'battle';

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

export interface Scenario {
  id: number;
  name: string;
  type: 'historical' | 'whatif';         // 史实/假想
  description: string;
  startYear: number;
  endYear: number;
  startState: ScenarioStartingState;
  playableFactions: FactionId[];
  recommendedFaction?: FactionId;
  whatIfRules?: {                         // 英雄集结等假想剧本独有
    allOfficersAlive: boolean;
    noHistoryEvents: boolean;
    freeForAll: boolean;
    equalStart: boolean;
  };
}
```

---

## 十七、存档 SaveData

```typescript
export interface GameState {
  scenarioId: number;
  currentYear: number;
  currentMonth: number;
  season: Season;
  playerFactionId: FactionId;

  // 实体
  officers: Record<number, Officer>;
  cities: Record<number, City>;
  factions: Record<number, Faction>;
  females: Record<number, FemaleCharacter>;
  beauties: Beauty[];
  passes: Record<number, Pass>;
  minorities: Record<EthnicGroup, MinorityState>;

  // 资源
  factionResources: Record<number, ResourceStock>;

  // 活跃部队
  armys: Army[];

  // 进行中的战斗
  activeBattles: BattleState[];

  // 事件状态
  completedEvents: number[];
  pendingEvents: number[];
  eventCooldowns: Record<number, number>;

  // 城市升级记录
  cityUpgradeLogs: CityUpgradeLog[];

  // 宝物归属
  itemOwnership: Record<number, number>;

  // 消耗品库存
  consumableStock: Record<number, Record<number, number>>;

  // 操作日志
  actionLog: GameAction[];
}

export interface SaveData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  scenarioName: string;
  year: number;
  month: number;
  playerFaction: string;
  gameState: GameState;
}

export interface GameAction {
  turn: number;
  actionType: string;
  actorId: number;         // 操作者武将ID 或 factionId
  targetIds: number[];
  description: string;
  result: object;
}
```

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

```typescript
export type DuelPhase = 'pre_duel' | 'dueling' | 'resolving' | 'resolved';

export type DuelOutcome = 'killed' | 'captured' | 'escaped' | 'draw' | 'surrendered';

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
  | 'supply_depot' | 'trap' | 'watchtower'
  | 'palisade' | 'trench' | 'pontoon_bridge';

interface CampStructure {
  type: StructureType;
  builderId: number;
  buildProgress: number;
  durability: number;
  effect: string;
  nodeId: number;
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
    type: 'duel' | 'rout' | 'breach' | 'stratagem' | 'advisor';
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

### 20.7 学派与信仰

```typescript
interface CityCulture {
  confucian: number;   // 儒 0-100
  daoist: number;      // 道
  buddhist: number;    // 佛
  mohist: number;      // 墨
  legalist: number;    // 法
  strategist: number;  // 纵横
  medical: number;     // 医
}

// City 接口扩展：
//   culture: CityCulture;
//   cultureFacilities: string[];
//   culturePolicy?: string;
//
// Faction 接口扩展：
//   culturalPolicy?: string;
```

---

*文档版本: v2.2 | 2026-07-17 | 新增 §20.7 学派与信仰数据类型（CityCulture）*

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

---

*文档版本: v2.3 | 2026-07-18 | Session 100 新增 §21 前端体验技术储备数据字段（OfficerStatic.appearance + BattleState.activeStrategem + gameStore.floatingDelta。零代码改动，方案文档化）*
