// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** Enums aligned with docs/03-data-models.md */

export enum Season {
  SPRING = 0,
  SUMMER = 1,
  AUTUMN = 2,
  WINTER = 3,
}

export enum TerrainType {
  PLAIN = 'plain',
  FOREST = 'forest',
  MOUNTAIN = 'mountain',
  WATER = 'water',
  WALL = 'wall',
  CITY = 'city',
  SWAMP = 'swamp',
}

export enum Weather {
  CLEAR = 'clear',
  CLOUDY = 'cloudy',
  RAIN = 'rain',
  STORM = 'storm',
  FOG = 'fog',
  SNOW = 'snow',
}

export enum UnitType {
  LIGHT_INFANTRY = 'lightInfantry',
  HEAVY_INFANTRY = 'heavyInfantry',
  SPEARMAN = 'spearman',
  ARCHER = 'archer',
  CROSSBOWMAN = 'crossbowman',
  LIGHT_CAVALRY = 'lightCavalry',
  HEAVY_CAVALRY = 'heavyCavalry',
  HORSE_ARCHER = 'horseArcher',
  /** 走舸 — 轻水军 */
  LIGHT_NAVY = 'lightNavy',
  /** 蒙冲 — 中水军 */
  MEDIUM_NAVY = 'mediumNavy',
  /** 楼船 — 重水军 */
  HEAVY_NAVY = 'heavyNavy',
  SIEGE = 'siege',
  TIGER_LEOPARD = 'tigerLeopard',
  QINGZHOU = 'qingzhouTroops',
  TRAPPED_CAMP = 'trappedCamp',
  WHITE_HORSE = 'whiteHorse',
  XILIANG_IRON = 'xiliangIron',
  DANYANG = 'danyangTroops',
  JIEFAN = 'jiefanTroops',
  WHITE_EAR = 'whiteEar',
  WUDANG_FLYING = 'wudangFlying',
  RATTAN_ARMOR = 'rattanArmor',
  ELEPHANT = 'elephant',
  YELLOW_TURBAN = 'yellowTurban',
}

export enum UnitProficiency {
  S = 'S',
  A = 'A',
  B = 'B',
  C = 'C',
  NONE = 'NONE',
}

export enum GrowthPotential {
  LOW = 'low',
  MID = 'mid',
  HIGH = 'high',
}

export enum Personality {
  BRAVE = 'brave',
  CALM = 'calm',
  BOLD = 'bold',
  CAUTIOUS = 'cautious',
  RECKLESS = 'reckless',
  GENTLE = 'gentle',
}

export enum Ideal {
  HEGEMONY = 'hegemony',
  BENEVOLENCE = 'benevolence',
  SEPARATIST = 'separatist',
  CHIVALRY = 'chivalry',
  FAME = 'fame',
}

export enum OfficerStatus {
  FREE = 'free',
  ACTIVE = 'active',
  PRISONER = 'prisoner',
  DEAD = 'dead',
}

export enum CeilingAttribute {
  LEADERSHIP = 'leadership',
  WAR = 'war',
  INTELLIGENCE = 'intelligence',
  POLITICS = 'politics',
  CHARISMA = 'charisma',
}

export enum FormationType {
  SQUARE = 0,
  CIRCLE = 1,
  WEDGE = 2,
  GOOSE = 3,
  CRANE_WING = 4,
  FISH_SCALE = 5,
  ARROWHEAD = 6,
  CRESCENT = 7,
  LONG_SNAKE = 8,
  YOKE = 9,
  SPARSE = 10,
  DENSE = 11,
  HOOK = 12,
  MYSTERIOUS = 13,
  CHARIOT_WHEEL = 14,
  EIGHT_TRIGRAMS = 15,
  CHARGE = 16,
  CLOUD = 17,
}

export enum ItemCategory {
  WEAPON_PRIMARY = 'weapon_primary',
  WEAPON_SECONDARY = 'weapon_secondary',
  ARMOR = 'armor',
  MOUNT = 'mount',
  BOOK = 'book',
  SPECIAL = 'special',
  CONSUMABLE = 'consumable',
}

export enum ItemQuality {
  COMMON = 'common',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

export enum PrimaryWeaponSubType {
  SWORD = 'sword',
  BLADE = 'blade',
  SPEAR = 'spear',
  HALBERD = 'halberd',
  BLUNT = 'blunt',
}

export enum SecondaryWeaponSubType {
  BOW = 'bow',
  CROSSBOW = 'crossbow',
  THROWING = 'throwing',
}

export enum ArmorSubType {
  CLOTH = 'cloth',
  LEATHER = 'leather',
  METAL = 'metal',
  SPECIAL = 'specialArmor',
}

export enum AcquisitionMethod {
  INITIAL = 'initial',
  SEARCH = 'search',
  SHOP = 'shop',
  EVENT = 'event',
  CRAFT = 'craft',
  LOOT = 'loot',
  INHERIT = 'inherit',
}

export enum FamilyTier {
  IMPERIAL = 'imperial',
  GREAT_CLAN = 'greatClan',
  LOCAL_POWER = 'localPower',
  COMMONER = 'commoner',
}

export enum MaritalStatus {
  SINGLE = 'single',
  BETROTHED = 'betrothed',
  MARRIED = 'married',
  WIDOW = 'widow',
}

export enum SpouseInfluenceType {
  HOUSEHOLD = 'household',
  COUNSEL = 'counsel',
  MARTIAL = 'martial',
  PRESTIGE = 'prestige',
  FORTITUDE = 'fortitude',
  SCHOLARSHIP = 'scholarship',
}

export enum SkillCategory {
  TACTICS = 'tactics',
  COMMAND = 'command',
  CIVIL = 'civil',
  PERSONAL = 'personal',
  UNIQUE = 'unique',
}

export enum DipRelation {
  WAR = 'war',
  HOSTILE = 'hostile',
  NEUTRAL = 'neutral',
  FRIENDLY = 'friendly',
  ALLIED = 'allied',
}

export enum CityTier {
  PASS = 1,
  COUNTY = 2,
  COMMANDERY = 3,
  PROVINCE = 4,
  CAPITAL = 5,
  PALACE = 6,
}

export enum ResourceType {
  WOOD = 'wood',
  IRON = 'iron',
  WARHORSE = 'warhorse',
}

export enum CityFacility {
  GRANARY = 'granary',
  MARKET = 'market',
  BARRACKS = 'barracks',
  STABLES = 'stables',
  WORKSHOP = 'workshop',
  ACADEMY = 'academy',
  TEMPLE = 'temple',
  HARBOR = 'harbor',
  WALL_UPGRADE = 'wallUpgrade',
  PALACE = 'palace',
}

export enum CityPolicy {
  FARMING = 'farming',
  COMMERCE = 'commerce',
  MILITARY = 'military',
  DEFENSE = 'defense',
  RECRUIT = 'recruit',
  TRAIN = 'train',
  CULTURE = 'culture',
  DIPLOMACY = 'diplomacy',
  TAX = 'tax',
  RELIEF = 'relief',
}

export enum EthnicGroup {
  XIONGNU = 'xiongnu',
  XIANBEI = 'xianbei',
  Qiang = 'qiang',
  DI = 'di',
  SHANYUE = 'shanyue',
  NANMAN = 'nanman',
}

export enum CivilPosition {
  NONE = 'none',
  CLERK = 'clerk',
  MAGISTRATE = 'magistrate',
  PREFECT = 'prefect',
  GOVERNOR = 'governor',
  CHANCELLOR = 'chancellor',
}

export enum LocalPosition {
  NONE = 'none',
  ADVISOR = 'advisor',
  INTENDANT = 'intendant',
  PREFECT = 'prefect',
}

export enum MilitaryPosition {
  NONE = 'none',
  CAPTAIN = 'captain',
  COLONEL = 'colonel',
  GENERAL = 'general',
  GRAND_GENERAL = 'grandGeneral',
}

export enum NobilityRank {
  NONE = 'none',
  MARQUIS = 'marquis',
  DUKE = 'duke',
  PRINCE = 'prince',
  KING = 'king',
}

export enum ArmyStatus {
  IDLE = 'idle',
  MOVING = 'moving',
  BESIEGING = 'besieging',
  IN_BATTLE = 'inBattle',
}

/** 谍报人员状态 */
export enum SpyStatus {
  IDLE = 'idle',
  DEPLOYED = 'deployed',
  CAPTIVE = 'captive',
  DEAD = 'dead',
  RECOVERING = 'recovering',
  /** 驻守反间 */
  COUNTER_DUTY = 'counter_duty',
}

/** 进攻/支援任务类型 */
export enum SpyMissionType {
  RECON = 'recon',
  SABOTAGE = 'sabotage',
  ASSASSINATE = 'assassinate',
  INCITE = 'incite',
  STEAL = 'steal',
  RESCUE = 'rescue',
  /** 女间谍专属：枕边风 — 目标城武将忠诚下降 (S07∩S09) */
  PILLOW_TALK = 'pillowTalk',
  /** 女间谍专属：离间流言 — 两势力友好下降 (S07∩S09, 接 S17) */
  SOW_DISCORD = 'sowDiscord',
}

/** 俘虏处置 */
export enum SpyCaptiveAction {
  HOLD = 'hold',
  EXECUTE = 'execute',
  RELEASE = 'release',
  EXCHANGE = 'exchange',
}

/** 计谋类型 (S17) */
export enum PlotType {
  /** 美人计 — beauty≥2 + 金；目标将忠诚− 或目标势力友好对第三方− */
  HONEY_TRAP = 'honeyTrap',
  /** 离间计 — 金 + 特工探秘双方；两势力友好对砍 */
  SOW_DISCORD = 'sowDiscord',
  /** 假情报 — 金 + 目标城 detailed；ACTIVE 期诱导 AI 优先攻该城 */
  FALSE_INTEL = 'falseIntel',
  /** 空城疑兵 — 粮 + 己方寡兵城；ACTIVE 期敌 AI 暂缓攻此城；识破则优先攻 */
  EMPTY_FORT = 'emptyFort',
}

/** 计谋阶段 */
export enum PlotStage {
  PREP = 'prep',
  ACTIVE = 'active',
  RESOLVED = 'resolved',
}

export type FactionId = number;

/** Common skill ids used in 0-A (30 generic). Full SkillType expands in 0-B. */
export type SkillType = string;
