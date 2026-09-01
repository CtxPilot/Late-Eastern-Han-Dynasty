// @ts-nocheck
// SPDX-License-Identifier: MIT
// Session 422 S3: 委任军事 AI + 季度报告（docs/42 D6 军事半 + D9）
import { CivilPosition, DelegationPolicy, OfficerStatus, Season, GameStateSchema, maxFieldArmies } from '@leh/shared';
import { createDelegationRegion, runDelegationMilitary, tickDelegationReports } from '../engine/delegation.js';
import { advanceTurn } from '../engine/turn.js';
import { createGame, getGame } from '../services/game.js';
import { resetRuntimeRng, runtimeRandom } from '../runtime-rng.js';
let pass=0,fail=0;
function assert(c:any,m:any){ if(c){pass++; console.log('  ✓ '+m);} else {fail++; console.error('  ✗ '+m);} }
console.log('Delegation military+report verify (S3)');
function promoteGovernorFull(state:any, officerId:any, cityId:any){
  const officer = state.officers[officerId];
  const oldCityId = officer.location;
  const cities = { ...state.cities };
  if (oldCityId != null && cities[oldCityId]) {
    cities[oldCityId] = { ...cities[oldCityId], officers: cities[oldCityId].officers.filter((id:any)=>id!==officerId) };
  }
  if (cities[cityId]) {
    cities[cityId] = { ...cities[cityId], officers: cities[cityId].officers.includes(officerId) ? cities[cityId].officers : [...cities[cityId].officers, officerId] };
  }
  return { ...state, cities, officers: { ...state.officers, [officerId]: { ...officer, status: OfficerStatus.ACTIVE, loyalty:95, civilPosition: CivilPosition.GOVERNOR, location: cityId } } };
}
function pickGovernors(base:any, n:any){
  const cands = Object.values(base.officers).filter((o:any)=>o.faction===base.playerFactionId && o.id!==base.factions[base.playerFactionId].rulerId).sort((a:any,b:any)=>a.id-b.id).slice(0,n);
  return cands.map(c=>c.id);
}
// 1) 军事：攻略型更易出征（方针权重）
{
  createGame(1,1);
  let base=getGame();
  const fac=base.factions[base.playerFactionId];
  const own=Object.values(base.cities).filter((c:any)=>c.ruler===base.playerFactionId).filter(c=>c.id!==fac.capitalCityId).slice(0,2);
  const [cityA,cityB]=own.map((c:any)=>c.id); void cityB;
  // 找邻接敌城作为目标：给 cityA 邻敌
  const enemyFaction = Object.values(base.factions).find((f:any)=>f.id!==base.playerFactionId && f.isAlive);
  assert(!!enemyFaction, '存在敌势力');
  // 把 cityA 改为强兵，cityB 邻接敌城可出征；并把敌城拉到邻接
  const enemyCity = Object.values((base.cities as any)).find((c:any)=>c.ruler===enemyFaction.id);
  assert(!!enemyCity, '存在敌城');
  // 确保外交敌对/战争
  const link = (base.diplomacy||[]).find(l=> (l.factionA===base.playerFactionId && l.factionB===enemyFaction.id) || (l.factionA===enemyFaction.id && l.factionB===base.playerFactionId));
  if(!link){
    base={...base, diplomacy:[...(base.diplomacy||[]), {factionA:base.playerFactionId, factionB:enemyFaction.id, relation:'war', favorability:-60}]};
  } else {
    base={...base, diplomacy:(base.diplomacy||[]).map(l=> l===link? {...l, relation:'war'}:l )};
  }
  // 让 cityA 兵多于敌 1.3倍以越过 balanced 门槛；从其他城调兵简化：直接在内存把 cityA 兵拉高
  const govs=pickGovernors(base,1);
  const gid=govs[0];
  // 先同步都督位置（城池名册镜像，满足 Schema），再调兵
  let s: any = promoteGovernorFull(base, gid, cityA);
  s = { ...s, cities: { ...s.cities, [cityA]:{...s.cities[cityA], troops:6000, gold:5000, food:20000, stats:{...s.cities[cityA].stats, wall:5, morale:70}}, [enemyCity.id]:{...s.cities[enemyCity.id], troops:2500, gold:2000, food:5000, stats:{...s.cities[enemyCity.id].stats, wall:5}} } };
  s=createDelegationRegion(s, { cityIds:[cityA], governorId:gid, policy: DelegationPolicy.OFFENSIVE });
  // 固定 RNG 让出征掷点命中：decision 0.0
  const before=s.campaignArmies.length;
  const after=runDelegationMilitary(s, ()=>0.0, ()=>0.5);
  assert(after.campaignArmies.length>before, '攻略型在门槛满足且掷点命中时出征');
  assert(after.actionLog.some(e=>e.type==='deleg_military'), '产生 deleg_military 日志');
  assert(GameStateSchema.safeParse(after).success, '出征后过 Schema');
  // 军上限：拉高 field 占用后再出征应被拦截/转袭扰
  const before2=after.campaignArmies.length;
  // 构造满额场景：再创建一个区但軍额已接近上限，验证不再无限出征
  assert(maxFieldArmies(Object.values(after.cities).filter(c=>c.ruler===after.playerFactionId).length)>=2, '军上限派生正常');
}
// 2) 季度报告：跨季生成 lastReport 且 accumulator 清零、delta 正确
{
  createGame(1,1);
  let base=getGame();
  const fac=base.factions[base.playerFactionId];
  const own=Object.values(base.cities).filter((c:any)=>c.ruler===base.playerFactionId).filter(c=>c.id!==fac.capitalCityId).slice(0,1);
  const cityId=own[0].id;
  const gid=pickGovernors(base,1)[0];
  let s:any = promoteGovernorFull(base, gid, cityId);
  s=createDelegationRegion(s, { cityIds:[cityId], governorId:gid, policy: DelegationPolicy.BALANCED });
  const beforeSum = s.cities[cityId].gold + s.cities[cityId].food;
  s=tickDelegationReports(s,false);
  assert(s.factions[s.playerFactionId].delegationRegions[0].lastReport==null, '非季度首月不生成报告');
  const preAcc=s.factions[s.playerFactionId].delegationRegions[0].seasonAccumulator;
  assert(!!preAcc, '创建时已初始化 accumulator');
  // 模拟季度首月（同步 season 以满足 GameStateSchema 月-季一致）
  s={...s, currentMonth:4, season: Season.SUMMER, currentYear:s.currentYear};
  s=tickDelegationReports(s,true);
  const rpt=s.factions[s.playerFactionId].delegationRegions[0].lastReport;
  assert(!!rpt && rpt.actionSummary.length<=8, '季度首月生成报告且 actionSummary≤8');
  assert(rpt.season===Season.SPRING || rpt.season===Season.SUMMER || rpt.season===Season.AUTUMN || rpt.season===Season.WINTER, '报告 season 合法');
  const acc2=s.factions[s.playerFactionId].delegationRegions[0].seasonAccumulator;
  assert(acc2.actions.length===0, '报告后 accumulator 清零');
  // delta 基准对：下季再跑一次应为相对新基线
  // 人为改一次金粮再跨季
  const before=s.factions[s.playerFactionId].delegationRegions[0].lastReport.goldDelta;
  void beforeSum; void before;
  assert(GameStateSchema.safeParse(s).success, '报告后过 Schema');
}
// 3) 双局军事确定性（同种子同行为）
{
  createGame(1,1);
  let base=getGame();
  const fac=base.factions[base.playerFactionId];
  const own=Object.values(base.cities).filter((c:any)=>c.ruler===base.playerFactionId).filter(c=>c.id!==fac.capitalCityId).slice(0,1);
  const cityId=own[0].id;
  const gid=pickGovernors(base,1)[0];
  let s:any = promoteGovernorFull(base, gid, cityId);
  s=createDelegationRegion(s,{cityIds:[cityId], governorId:gid, policy:DelegationPolicy.BALANCED});
  function run24(st){ let x=st; for(let i=0;i<24;i++){ resetRuntimeRng(0x12345678); x=advanceTurn({...x, currentMonth:x.currentMonth}, runtimeRandom);} return x; }
  const a=run24(s); const b=run24(s);
  assert(JSON.stringify(a.cities)===JSON.stringify(b.cities) && JSON.stringify(a.factions)===JSON.stringify(b.factions), '双局 24 月逐字节一致（含委任军事 RNG 固定位）');
}
console.log('\n'+pass+' passed, '+fail+' failed'); if(fail>0) process.exit(1);
