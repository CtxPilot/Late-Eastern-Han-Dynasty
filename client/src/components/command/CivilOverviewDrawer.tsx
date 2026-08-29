// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import { useEffect, useMemo, useState } from 'react';
import {
  CULTURE_RUNTIME_MAX,
  DEVELOPMENT_PROJECT_CONFIG,
  OPTIONAL_DEVELOP_STAT_MAX,
  developmentInitialGoldCost,
  cultureThresholdProgress,
  craftQualityThresholdProgress,
  transportRouteThresholdProgress,
  type City,
  type DevelopmentProject,
  type DevelopmentProjectKind,
  type GameState,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';
import { gameApi } from '../../services/gateway';
import type { AnnualBudget } from '../../services/api';

export type CivilCitySummary = {
  cityId: number;
  name: string;
  administration: string;
  province: string;
  gold: number;
  food: number;
  population: number;
  farm: number;
  commerce: number;
  wall: number;
  culture: number;
  cultureMax: number;
  cultureLevel: number;
  cultureNextThreshold: number | null;
  cultureRemaining: number;
  craft: number;
  craftMax: number;
  craftLevel: number;
  craftNextThreshold: number | null;
  craftRemaining: number;
  transport: number;
  transportMax: number;
  transportLevel: number;
  transportNextThreshold: number | null;
  transportRemaining: number;
  sanitation: number;
  sanitationMax: number;
  morale: number;
  adultMale: number;
  adultFemale: number;
  child: number;
  elder: number;
  activeDevelopment?: DevelopmentProject;
};

export function selectCivilCities(game: GameState): CivilCitySummary[] {
  return Object.values(game.cities)
    .filter((city) => city.ruler === game.playerFactionId)
    .sort((a, b) => a.id - b.id)
    .map(toSummary);
}

function toSummary(city: City): CivilCitySummary {
  const culturePreview = cultureThresholdProgress(city.stats.culture ?? 0);
  const craftPreview = craftQualityThresholdProgress(city.stats.craft ?? 0);
  const transportPreview = transportRouteThresholdProgress(city.stats.transport ?? 0);
  return {
    cityId: city.id,
    name: city.name,
    administration: city.adminName ?? city.name,
    province: city.province,
    gold: city.gold,
    food: city.food,
    population: city.population,
    farm: city.stats.farm,
    commerce: city.stats.commerce,
    wall: city.stats.wall,
    culture: culturePreview.current,
    cultureMax: CULTURE_RUNTIME_MAX,
    cultureLevel: culturePreview.reachedLevels,
    cultureNextThreshold: culturePreview.nextThreshold,
    cultureRemaining: culturePreview.remaining,
    craft: craftPreview.current,
    craftMax: CULTURE_RUNTIME_MAX,
    craftLevel: craftPreview.reachedLevels,
    craftNextThreshold: craftPreview.nextThreshold,
    craftRemaining: craftPreview.remaining,
    transport: transportPreview.current,
    transportMax: CULTURE_RUNTIME_MAX,
    transportLevel: transportPreview.reachedLevels,
    transportNextThreshold: transportPreview.nextThreshold,
    transportRemaining: transportPreview.remaining,
    sanitation: Math.min(OPTIONAL_DEVELOP_STAT_MAX, Math.max(0, Math.floor(city.stats.sanitation ?? 0))),
    sanitationMax: OPTIONAL_DEVELOP_STAT_MAX,
    morale: city.stats.morale,
    adultMale: city.demographics.adultMale,
    adultFemale: city.demographics.adultFemale,
    child: city.demographics.child,
    elder: city.demographics.elder,
    activeDevelopment: city.activeDevelopment,
  };
}

type CivilFacet = 'overview' | 'industry' | 'construction' | 'relief' | 'faction';
export type CivilOrder = DevelopmentProjectKind | 'relief' | 'reclaim' | 'patrol';

function projectOrder(kind: DevelopmentProjectKind, label: string, summary: string) {
  const config = DEVELOPMENT_PROJECT_CONFIG[kind];
  return {
    label,
    cost: `首付${developmentInitialGoldCost(kind)}金 / 总计${config.totalGoldCost}金`,
    summary,
  };
}

const ORDER_CONFIG: Record<CivilOrder, {
  label: string;
  cost: string;
  summary: string;
}> = {
  farm: projectOrder('farm', '开发农业', '持续9个月；完成后农业+100。'),
  commerce: projectOrder('commerce', '开发商业', '持续6个月；完成后商业+100。'),
  wall: projectOrder('wall', '开发城防', '持续12个月；完成后城防+100。'),
  culture: projectOrder('culture', '发展文化', '持续6个月；完成后文化+60。已达技艺门槛提升登用成功率；技艺研发仍后置。'),
  craft: projectOrder('craft', '发展工艺', '持续6个月；完成后工艺+60。已达质量门槛提升征兵士气；器械建造速度仍后置。'),
  transport: projectOrder('transport', '发展交通', '持续6个月；完成后交通+60。已达路网门槛减免行军粮耗；行军速度仍后置。'),
  sanitation: projectOrder('sanitation', '发展卫生', '持续6个月；完成后卫生+60。瘟疫抗性与人口增长率消费后置。'),
  relief: { label: '施米安民', cost: '150粮', summary: '民心由权威随机流提升8～12，上限100。' },
  reclaim: { label: '开垦荒地', cost: '50金', summary: '耗金50；智≥60武将执行：farm+20~40，流民满意度+8~15，世家−10~20。' },
  patrol: { label: '巡查缉捕', cost: '30金', summary: '耗金30；武≥60武将执行：商贾满意度+5~10，小势力−8~15，本月免叛乱判定。' },
};

export function validateCivilOrder(
  game: GameState,
  cityId: number,
  order: CivilOrder,
): string | null {
  const city = game.cities[cityId];
  if (!city || city.ruler !== game.playerFactionId) return '所选城市已不存在或归属已经变化。';
  if (order === 'relief') {
    return city.food < 150 ? `城市粮不足（需150，当前${city.food}）。` : null;
  }
  if (order === 'reclaim') {
    return city.gold < 50 ? `城市金不足（需50，当前${city.gold}）。` : null;
  }
  if (order === 'patrol') {
    return city.gold < 30 ? `城市金不足（需30，当前${city.gold}）。` : null;
  }
  if (city.activeDevelopment) return `该城已有${city.activeDevelopment.kind}持续项目。`;
  const goldCost = developmentInitialGoldCost(order);
  return city.gold < goldCost ? `城市金不足（需${goldCost}，当前${city.gold}）。` : null;
}

export function validateBeautySeek(game: GameState, cityId: number): string | null {
  const city = game.cities[cityId];
  if (!city || city.ruler !== game.playerFactionId) return '所选城市已不存在或归属已经变化。';
  if ((city.courtNetworkOpportunities ?? 0) < 1) return `${city.name}人脉机会已尽。`;
  return city.gold < 60 ? `城市金不足（需60，当前${city.gold}）。` : null;
}

const FACETS: readonly { id: CivilFacet; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'industry', label: '产业' },
  { id: 'construction', label: '城建' },
  { id: 'relief', label: '赈济' },
  { id: 'faction', label: '乡政' },
];

export function CivilOverviewDrawer() {
  const game = useGameStore((state) => state.game);
  const selectedCityId = useGameStore((state) => state.selectedCityId);
  const selectCity = useGameStore((state) => state.selectCity);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const develop = useGameStore((state) => state.develop);
  const relief = useGameStore((state) => state.relief);
  const reclaimLand = useGameStore((state) => state.reclaimLand);
  const patrolCity = useGameStore((state) => state.patrolCity);
  const resolveImpeachment = useGameStore((state) => state.resolveImpeachment);
  const seekBeauty = useGameStore((state) => state.seekBeauty);
  const [facet, setFacet] = useState<CivilFacet>('overview');
  const [draft, setDraft] = useState<CivilOrder | null>(null);
  const [seekDraft, setSeekDraft] = useState(false);
  const [officerId, setOfficerId] = useState<number | null>(null);
  const [budget, setBudget] = useState<AnnualBudget | null>(null);
  const cities = useMemo(() => game ? selectCivilCities(game) : [], [game]);
  const effectiveCityId = cities.some((city) => city.cityId === selectedCityId)
    ? selectedCityId
    : cities[0]?.cityId;
  const city = cities.find((candidate) => candidate.cityId === effectiveCityId);
  const cityEntity = city ? game?.cities[city.cityId] : undefined;
  const eligibleOfficers = cityEntity
    ? cityEntity.officers.map((id) => game?.officers[id]).filter((officer) => officer?.status === 'active')
    : [];
  useEffect(() => {
    if (!game) return;
    void gameApi.getAnnualBudget().then(setBudget).catch(() => setBudget(null));
  }, [game]);
  useEffect(() => {
    setOfficerId(eligibleOfficers[0]?.id ?? null);
  }, [effectiveCityId, eligibleOfficers[0]?.id]);

  if (!game) return <p data-testid="command-civil-empty">尚未载入剧本。</p>;
  if (!city) return <p data-testid="command-civil-empty">当前势力没有可治理城市。</p>;

  return (
    <div
      className="flex h-[min(34rem,calc(100vh-12rem))] min-h-0 flex-1 flex-col"
      data-testid="command-civil-drawer"
    >
      <label className="mb-3 text-xs text-stone-500">
        治理城市
        <select
          data-testid="command-civil-city-select"
          value={city.cityId}
          onChange={(event) => selectCity(Number(event.target.value))}
          className="mt-1 block w-full border border-stone-700 bg-stone-900 px-2 py-1.5 text-xs text-stone-200"
        >
          {cities.map((option) => (
            <option key={option.cityId} value={option.cityId}>
              {option.name} · {option.province}
            </option>
          ))}
        </select>
      </label>

      <nav className="mb-3 grid grid-cols-5 gap-1" aria-label="内政分面">
        {FACETS.map((item) => (
          <InkButton
            key={item.id}
            type="button"
            data-testid={`command-civil-facet-${item.id}`}
            aria-current={facet === item.id ? 'page' : undefined}
            onClick={() => setFacet(item.id)}
            className={`border py-1.5 ${
              facet === item.id
                ? 'border-amber-700 bg-amber-950/35 text-amber-100'
                : 'border-stone-800 text-stone-400'
            }`}
          >
            {item.label}
          </InkButton>
        ))}
      </nav>

      <p className="mb-3 text-xs leading-relaxed text-stone-500">
        S03 城市治理在此统一提交；总览另提供明确标注的 S09 跨系统结交入口。
      </p>

      <section className="min-h-0 space-y-2 overflow-y-auto" data-testid={`command-civil-panel-${facet}`}>
        {facet === 'overview' ? (
          <>
            <Fact label="治所" value={city.administration} />
            <Fact label="州域" value={city.province} />
            <Fact label="金" value={city.gold} />
            <Fact label="粮" value={city.food} />
            <Fact label="人口" value={city.population} />
            <Fact label="民心" value={city.morale} />
            {city.activeDevelopment ? (
              <div className="border border-amber-900/70 bg-amber-950/10 px-3 py-2" data-testid="civil-active-project">
                <strong className="text-amber-200">
                  持续项目 · {DEVELOPMENT_PROJECT_CONFIG[city.activeDevelopment.kind]?.label ?? city.activeDevelopment.kind}
                </strong>
                <p className="text-xs text-stone-400">
                  {city.activeDevelopment.status === 'paused' ? '暂停' : '推进中'}
                  {' · '}剩余{city.activeDevelopment.remainingMonths}个月
                  {' · '}已付{city.activeDevelopment.goldPaid}/{city.activeDevelopment.totalGoldCost}金
                </p>
                <p className="text-xs text-stone-500">
                  暂停{city.activeDevelopment.pausedMonths}月 · 已损失{city.activeDevelopment.progressLostMonths}月进度
                </p>
              </div>
            ) : null}
            {budget ? (
              <div className="border border-stone-800 px-3 py-2" data-testid="civil-annual-budget">
                <strong className="text-stone-200">未来12月预算 · {budget.cityCount}城</strong>
                <p className="text-xs text-stone-400">
                  金收入{budget.goldIncome}－项目{budget.projectGold}－行政{budget.administrativeGold}
                  －俸禄{budget.salaryGold}＝净{budget.netGold}
                </p>
                <p className="text-xs text-stone-400">
                  粮产{budget.foodProduced}－民军耗粮{budget.civilianAndMilitaryFood}＝净{budget.netFood}
                </p>
              </div>
            ) : null}
            <div
              className="mt-3 border border-paper-700/80 bg-paper-100/5 px-3 py-2"
              data-testid="command-civil-s09-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-paper-300">S09 · 宫廷人脉</strong>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    地方结交：消耗60金；成功时宫廷人脉+1、此城机会−1。
                  </p>
                  <p className="mt-1 text-xs text-stone-400">
                    当前人脉 {game.factions[game.playerFactionId]?.courtNetwork ?? 0}
                    {' · '}本城机会 {game.cities[city.cityId]?.courtNetworkOpportunities ?? 0}
                  </p>
                </div>
                <InkButton
                  type="button"
                  data-testid="command-civil-seek-beauty"
                  data-command-write="true"
                  onClick={() => setSeekDraft(true)}
                  className="shrink-0 border border-paper-700 bg-paper-100/10 px-3 py-2 text-paper-100"
                >
                  结交
                  <span className="mt-0.5 block text-xs text-stone-500">60金</span>
                </InkButton>
              </div>
            </div>
          </>
        ) : facet === 'industry' ? (
          <>
            <Fact label="农业开发" value={city.farm} testId="command-civil-value-farm" />
            <Fact label="商业开发" value={city.commerce} testId="command-civil-value-commerce" />
            <Fact label="文化积累" value={city.culture} testId="command-civil-value-culture" />
            <Fact label="工艺积累" value={city.craft} testId="command-civil-value-craft" />
            <Fact label="交通积累" value={city.transport} testId="command-civil-value-transport" />
            <Fact label="卫生积累" value={city.sanitation} testId="command-civil-value-sanitation" />
            <div className="border border-stone-800 px-3 py-2" data-testid="command-civil-culture-progress">
              <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                <span>文化进度</span>
                <span>{city.culture}/{city.cultureMax}</span>
              </div>
              <progress
                aria-label={`${city.name}文化积累进度`}
                value={city.culture}
                max={city.cultureMax}
                className="h-1.5 w-full accent-amber-700"
              />
            </div>
            <div className="border border-stone-800 px-3 py-2" data-testid="command-civil-craft-progress">
              <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                <span>工艺进度</span>
                <span>{city.craft}/{city.craftMax}</span>
              </div>
              <progress
                aria-label={`${city.name}工艺积累进度`}
                value={city.craft}
                max={city.craftMax}
                className="h-1.5 w-full accent-amber-700"
              />
            </div>
            <div className="border border-stone-800 px-3 py-2" data-testid="command-civil-transport-progress">
              <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                <span>交通进度</span>
                <span>{city.transport}/{city.transportMax}</span>
              </div>
              <progress
                aria-label={`${city.name}交通积累进度`}
                value={city.transport}
                max={city.transportMax}
                className="h-1.5 w-full accent-amber-700"
              />
            </div>
            <div className="border border-stone-800 px-3 py-2" data-testid="command-civil-sanitation-progress">
              <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                <span>卫生进度</span>
                <span>{city.sanitation}/{city.sanitationMax}</span>
              </div>
              <progress
                aria-label={`${city.name}卫生积累进度`}
                value={city.sanitation}
                max={city.sanitationMax}
                className="h-1.5 w-full accent-amber-700"
              />
            </div>
            <Fact label="技艺门槛预览" value={`Lv${city.cultureLevel}/5`} testId="command-civil-culture-level" />
            <p
              className="border border-stone-800 px-3 py-2 text-xs text-stone-500"
              data-testid="command-civil-culture-threshold"
            >
              {city.cultureNextThreshold == null
                ? '已达 Lv5 门槛；登用成功率文化加成已满（+10百分点）。技艺研发仍后置。'
                : `距 Lv${city.cultureLevel + 1} 门槛 ${city.cultureNextThreshold} 还需 ${city.cultureRemaining} 点；已达等级为登用成功率 +${city.cultureLevel * 2} 百分点。技艺研发仍后置。`}
            </p>
            <Fact label="工艺质量门槛" value={`Lv${city.craftLevel}/5`} testId="command-civil-craft-level" />
            <p
              className="border border-stone-800 px-3 py-2 text-xs text-stone-500"
              data-testid="command-civil-craft-threshold"
            >
              {city.craftNextThreshold == null
                ? '已达 Lv5 门槛；征兵部队士气加成已满（+10）。器械建造速度仍后置。'
                : `距 Lv${city.craftLevel + 1} 门槛 ${city.craftNextThreshold} 还需 ${city.craftRemaining} 点；已达等级为征兵士气 +${city.craftLevel * 2}。器械建造速度仍后置。`}
            </p>
            <Fact label="交通路网门槛" value={`Lv${city.transportLevel}/5`} testId="command-civil-transport-level" />
            <p
              className="border border-stone-800 px-3 py-2 text-xs text-stone-500"
              data-testid="command-civil-transport-threshold"
            >
              {city.transportNextThreshold == null
                ? '已达 Lv5 门槛；行军粮耗减免已满（−10%）。行军速度仍后置。'
                : `距 Lv${city.transportLevel + 1} 门槛 ${city.transportNextThreshold} 还需 ${city.transportRemaining} 点；已达等级为行军粮耗 −${city.transportLevel * 2}%。行军速度仍后置。`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <CivilButton order="farm" onClick={() => setDraft('farm')} />
              <CivilButton order="commerce" onClick={() => setDraft('commerce')} />
              <CivilButton order="culture" onClick={() => setDraft('culture')} />
              <CivilButton order="craft" onClick={() => setDraft('craft')} />
              <CivilButton order="transport" onClick={() => setDraft('transport')} />
              <CivilButton order="sanitation" onClick={() => setDraft('sanitation')} />
            </div>
            <label className="block text-xs text-stone-500">
              指派武将
              <select
                value={officerId ?? ''}
                onChange={(event) => setOfficerId(Number(event.target.value))}
                className="mt-1 w-full border border-stone-700 bg-stone-950 p-2 text-stone-200"
                data-testid="civil-project-officer"
              >
                {eligibleOfficers.map((officer) => (
                  <option key={officer!.id} value={officer!.id}>{officer!.name}</option>
                ))}
              </select>
            </label>
            <p className="border border-stone-800 px-3 py-2 text-stone-600">
              文化→登用、工艺→征兵士气、交通→行军粮耗已接通；卫生效果与技艺研发/器械速度/行军速度仍后置。
              农业开发不等同于屯田（民屯请用命令坞「屯田」）。
            </p>
          </>
        ) : facet === 'construction' ? (
          <>
            <Fact label="城防开发" value={city.wall} testId="command-civil-value-wall" />
            <CivilButton order="wall" onClick={() => setDraft('wall')} />
            <label className="block text-xs text-stone-500">
              指派武将
              <select
                value={officerId ?? ''}
                onChange={(event) => setOfficerId(Number(event.target.value))}
                className="mt-1 w-full border border-stone-700 bg-stone-950 p-2 text-stone-200"
              >
                {eligibleOfficers.map((officer) => (
                  <option key={officer!.id} value={officer!.id}>{officer!.name}</option>
                ))}
              </select>
            </label>
            <p className="border border-stone-800 px-3 py-2 text-stone-600">
              当前数值是城市城防开发度，不代表战役城墙耐久；修缮与设施建设尚未实装。
            </p>
          </>
        ) : facet === 'relief' ? (
          <>
            <Fact label="民心" value={city.morale} testId="command-civil-value-morale" />
            <Fact label="成年男丁" value={city.adultMale} />
            <Fact label="成年女子" value={city.adultFemale} />
            <Fact label="孩童" value={city.child} />
            <Fact label="老者" value={city.elder} />
            <CivilButton order="relief" onClick={() => setDraft('relief')} />
            <p className="border border-stone-800 px-3 py-2 text-stone-600">
              施米只影响民心；人口四桶保持不变。
            </p>
          </>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-stone-500">
              S27 城级派系：满意度月度向 50 回归；商贾≥70 商业+15%、&lt;30 −15%；
              流民≥70 征兵上限+20%；世家&lt;30 守军士气−15%（暗通）；
              小势力&lt;30 有月度叛乱风险（巡查可免）。
            </p>
            {cityEntity?.pendingImpeachment ? (
              <div
                className="space-y-1.5 border border-rose-900/80 bg-rose-950/25 px-3 py-2"
                data-testid="civil-impeachment-warning"
              >
                <p className="text-xs text-rose-200">
                  官宦弹劾城主：
                  {game?.officers[cityEntity.pendingImpeachment.officerId]?.name ?? '城主'}
                  —— 2 个月内需安抚或撤换，逾期官宦更不满。
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <InkButton
                    type="button"
                    data-testid="civil-impeach-appease"
                    onClick={() => resolveImpeachment(city.cityId, 'appease')}
                    className="border border-stone-700 bg-stone-900 px-2 py-1.5 text-xs text-stone-200 hover:border-amber-700"
                  >
                    安抚（100金）
                  </InkButton>
                  <InkButton
                    type="button"
                    data-testid="civil-impeach-remove"
                    onClick={() => resolveImpeachment(city.cityId, 'remove')}
                    className="border border-stone-700 bg-stone-900 px-2 py-1.5 text-xs text-stone-200 hover:border-rose-800"
                  >
                    撤换城主
                  </InkButton>
                </div>
              </div>
            ) : null}
            {(cityEntity?.cityFactions?.length ?? 0) > 0 ? (
              <div className="space-y-1.5" data-testid="command-civil-faction-entries">
                {cityEntity!.cityFactions!.map((entry) => (
                  <div
                    key={entry.kind}
                    className={`flex justify-between border px-3 py-1.5 ${
                      entry.satisfaction < 30
                        ? 'border-rose-900/80 bg-rose-950/20'
                        : entry.satisfaction >= 70
                          ? 'border-emerald-900/80 bg-emerald-950/20'
                          : 'border-stone-800'
                    }`}
                  >
                    <span className="text-stone-300">{entry.name}</span>
                    <strong className="text-stone-200">
                      {entry.satisfaction}
                      <span className="ml-1 text-xs text-stone-500">/100</span>
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="border border-stone-800 px-3 py-2 text-stone-600">
                本城暂无城级派系（0-A 试点城市为洛阳/长安/阳翟/汝南/邺/陈留）。
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <CivilButton order="reclaim" onClick={() => setDraft('reclaim')} />
              <CivilButton order="patrol" onClick={() => setDraft('patrol')} />
            </div>
            <label className="block text-xs text-stone-500">
              指派武将（开垦需智≥60 / 巡查需武≥60）
              <select
                value={officerId ?? ''}
                onChange={(event) => setOfficerId(Number(event.target.value))}
                className="mt-1 w-full border border-stone-700 bg-stone-950 p-2 text-stone-200"
                data-testid="civil-faction-officer"
              >
                {eligibleOfficers.map((officer) => (
                  <option key={officer!.id} value={officer!.id}>{officer!.name}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </section>
      <CommandConfirmDialog
        open={draft != null}
        category="内政"
        command={`确认在${city.name}${draft ? ORDER_CONFIG[draft].label : '执行命令'}`}
        summary={draft ? ORDER_CONFIG[draft].summary : ''}
        items={[
          { label: '城市', value: `${city.name} · ${city.province}` },
          ...(draft && draft !== 'relief'
            ? [{ label: '指派武将', value: eligibleOfficers.find((officer) => officer?.id === officerId)?.name ?? '未选择' }]
            : []),
          { label: '当前资源', value: `${city.gold}金 / ${city.food}粮` },
          { label: '资源消耗', value: draft ? ORDER_CONFIG[draft].cost : '—', tone: 'warning' },
        ]}
        loading={loading}
        error={error}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          return !latest || !draft
            ? '内政草稿已失效，请返回修改。'
            : validateCivilOrder(latest, city.cityId, draft);
        }}
        onCancel={() => setDraft(null)}
        onConfirm={async () => {
          if (!draft) return;
          if (draft === 'relief') await relief(city.cityId);
          else if (draft === 'reclaim') {
            if (officerId == null) return;
            await reclaimLand(city.cityId, officerId);
          } else if (draft === 'patrol') {
            if (officerId == null) return;
            await patrolCity(city.cityId, officerId);
          } else {
            if (officerId == null) return;
            await develop(draft, city.cityId, officerId);
          }
          if (!useGameStore.getState().error) setDraft(null);
        }}
      />
      <CommandConfirmDialog
        open={seekDraft}
        category="S09 宫廷人脉"
        command={`确认在${city.name}结交人脉`}
        summary="由 S09 权威随机流判定；无论成败均消耗60金，成功时人脉+1、城市机会−1。"
        items={[
          { label: '城市', value: `${city.name} · ${city.province}` },
          {
            label: '当前状态',
            value: `${city.gold}金 / 机会${game.cities[city.cityId]?.courtNetworkOpportunities ?? 0} / 人脉${game.factions[game.playerFactionId]?.courtNetwork ?? 0}`,
          },
          { label: '资源消耗', value: '60金', tone: 'warning' },
        ]}
        loading={loading}
        error={error}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          return !latest ? '结交草稿已失效，请返回修改。' : validateBeautySeek(latest, city.cityId);
        }}
        onCancel={() => setSeekDraft(false)}
        onConfirm={async () => {
          await seekBeauty(city.cityId);
          if (!useGameStore.getState().error) setSeekDraft(false);
        }}
      />
    </div>
  );
}

function CivilButton({ order, onClick }: { order: CivilOrder; onClick: () => void }) {
  const config = ORDER_CONFIG[order];
  return (
    <InkButton
      type="button"
      data-testid={`command-civil-${order}`}
      data-command-write="true"
      onClick={onClick}
      className="border border-amber-900 bg-amber-950/20 px-3 py-2 text-amber-100"
    >
      {config.label}
      <span className="mt-0.5 block text-xs text-stone-500">{config.cost}</span>
    </InkButton>
  );
}

function Fact({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <div className="flex justify-between border-b border-stone-800 px-2 py-1.5">
      <span className="text-stone-500">{label}</span>
      <strong className="text-stone-200" data-testid={testId}>{value}</strong>
    </div>
  );
}
