// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 引擎层：商路贸易网络生命周期（Phase 7-05）
 *
 * 1. 开辟商路（establishTradeRoute）
 * 2. 撤销商路（cancelTradeRoute）
 * 3. 季首商税核算与入账（tickTradeQuarter）
 * 4. 零漂移保证：无商路或非季首时直接返回原引用，零 RNG 调用，零冗余分配。
 */

import {
  type GameAction,
  type GameState,
  type TradeRoute,
  calculateTradeRouteQuarterlyIncome,
  canEstablishTradeRoute,
  findDiplomacy,
  DipRelation,
  areCitiesRoadAdjacent,
  TRADE_ROUTE_SETUP_COST,
} from '@leh/shared';

export { TRADE_ROUTE_SETUP_COST };

export interface EstablishTradeRouteResult {
  state: GameState;
  route: TradeRoute;
  message: string;
}

/**
 * 开辟新的商路贸易路线。
 */
export function establishTradeRoute(
  state: GameState,
  fromCityId: number,
  toCityId: number,
  assignedMerchantOfficerId?: number,
  isWaterWay?: boolean,
): EstablishTradeRouteResult {
  const cityA = state.cities[fromCityId];
  const cityB = state.cities[toCityId];
  if (!cityA || !cityB) {
    throw new Error('通商城池不存在');
  }

  // 连通性检查（必须有陆路或水路相通）
  const adjacent = areCitiesRoadAdjacent(fromCityId, toCityId);
  if (!adjacent && !isWaterWay) {
    throw new Error(`城池 ${cityA.name} 与 ${cityB.name} 之间无直达道路相通`);
  }

  // 配额与重复检查
  const check = canEstablishTradeRoute(state.tradeRoutes, fromCityId, toCityId);
  if (!check.allowed) {
    throw new Error(check.reason ?? '无法开辟此商路');
  }

  // 外交关系检查：若跨势力且处于交战状态，禁止通商
  const isCrossFaction = cityA.ruler !== cityB.ruler;
  if (isCrossFaction && cityA.ruler != null && cityB.ruler != null) {
    const link = findDiplomacy(state.diplomacy, cityA.ruler, cityB.ruler);
    if (link?.relation === DipRelation.WAR) {
      throw new Error('两国交战兵戎相见，关隘封闭禁止通商');
    }
  }

  // 扣除开辟商路经费（发起方城池出资）
  if (cityA.gold < TRADE_ROUTE_SETUP_COST) {
    throw new Error(`开辟商路需 ${TRADE_ROUTE_SETUP_COST} 金开通经费，城中金钱不足`);
  }

  const updatedCityA = {
    ...cityA,
    gold: cityA.gold - TRADE_ROUTE_SETUP_COST,
  };

  const minId = Math.min(fromCityId, toCityId);
  const maxId = Math.max(fromCityId, toCityId);
  const routeId = `route_${minId}_${maxId}`;

  const newRoute: TradeRoute = {
    id: routeId,
    fromCityId,
    toCityId,
    distance: 1,
    isWaterWay: isWaterWay ?? false,
    isCrossFaction,
    factionA: cityA.ruler ?? 0,
    factionB: cityB.ruler ?? 0,
    status: 'active',
    assignedMerchantOfficerId,
    establishedYear: state.currentYear,
    establishedMonth: state.currentMonth,
  };

  const logEntry: GameAction = {
    year: state.currentYear,
    month: state.currentMonth,
    type: 'trade_route_established',
    message: `【开辟商道】${cityA.name} 与 ${cityB.name} 正式通商，商贾云集，商税互通！`,
  };

  const nextState: GameState = {
    ...state,
    cities: {
      ...state.cities,
      [cityA.id]: updatedCityA,
    },
    tradeRoutes: [...(state.tradeRoutes ?? []), newRoute],
    actionLog: [logEntry, ...(state.actionLog ?? [])].slice(0, 80),
  };

  return {
    state: nextState,
    route: newRoute,
    message: `成功开辟 ${cityA.name} 至 ${cityB.name} 的通商商路！`,
  };
}

/**
 * 撤销/解散既有商路。
 */
export function cancelTradeRoute(state: GameState, routeId: string): GameState {
  const existing = (state.tradeRoutes ?? []).find((r) => r.id === routeId);
  if (!existing) {
    throw new Error(`商路 ${routeId} 不存在`);
  }

  const updatedRoutes = (state.tradeRoutes ?? []).filter((r) => r.id !== routeId);

  const cityA = state.cities[existing.fromCityId];
  const cityB = state.cities[existing.toCityId];
  const nameA = cityA?.name ?? `城池${existing.fromCityId}`;
  const nameB = cityB?.name ?? `城池${existing.toCityId}`;

  const logEntry: GameAction = {
    year: state.currentYear,
    month: state.currentMonth,
    type: 'trade_route_cancelled',
    message: `【停废商道】撤除 ${nameA} 至 ${nameB} 的商贸通商路线。`,
  };

  return {
    ...state,
    tradeRoutes: updatedRoutes,
    actionLog: [logEntry, ...(state.actionLog ?? [])].slice(0, 80),
  };
}

/**
 * 季度商税与贸易收益统算入账（在 turn.ts 月结季首结算时调用）。
 *
 * 保证 COW 零漂移铁律：
 * 若非季首首月，或全图无任何商路，直接返回原引用 state，零开销零 RNG 调用。
 */
export function tickTradeQuarter(state: GameState, isQuarterStart: boolean): GameState {
  if (!isQuarterStart) {
    return state;
  }

  const routes = state.tradeRoutes;
  if (!routes || routes.length === 0) {
    return state;
  }

  let hasChanges = false;
  const updatedCities = { ...state.cities };
  let updatedOfficers = state.officers;
  let updatedDiplomacy = state.diplomacy;
  const updatedRoutes: TradeRoute[] = [];
  const logs: GameAction[] = [];
  let totalRevenueThisQuarter = 0;

  for (const route of routes) {
    const cityA = updatedCities[route.fromCityId];
    const cityB = updatedCities[route.toCityId];
    if (!cityA || !cityB) {
      updatedRoutes.push(route);
      continue;
    }

    // 动态同步所属势力
    const currentFactionA = cityA.ruler ?? 0;
    const currentFactionB = cityB.ruler ?? 0;
    const isCrossFaction = currentFactionA !== currentFactionB;

    let diplomacyLink = null;
    if (isCrossFaction && currentFactionA > 0 && currentFactionB > 0) {
      diplomacyLink = findDiplomacy(updatedDiplomacy, currentFactionA, currentFactionB);
    }

    const isAtWar = diplomacyLink?.relation === DipRelation.WAR;
    let nextStatus = route.status;
    if (isAtWar && route.status !== 'blockaded') {
      nextStatus = 'blockaded';
      hasChanges = true;
    } else if (!isAtWar && route.status === 'blockaded') {
      nextStatus = 'active';
      hasChanges = true;
    }

    const currentRoute: TradeRoute = {
      ...route,
      factionA: currentFactionA,
      factionB: currentFactionB,
      isCrossFaction,
      status: nextStatus,
    };
    updatedRoutes.push(currentRoute);

    if (nextStatus !== 'active') {
      continue;
    }

    // 计算收益
    const merchantOfficer = route.assignedMerchantOfficerId
      ? updatedOfficers[route.assignedMerchantOfficerId]
      : null;

    const calc = calculateTradeRouteQuarterlyIncome({
      route: currentRoute,
      cityA,
      cityB,
      diplomacyLink,
      merchantOfficer,
    });

    if (calc.totalIncome > 0) {
      updatedCities[cityA.id] = {
        ...cityA,
        gold: cityA.gold + calc.incomeA,
      };
      updatedCities[cityB.id] = {
        ...cityB,
        gold: cityB.gold + calc.incomeB,
      };
      totalRevenueThisQuarter += calc.totalIncome;
      hasChanges = true;

      // 主管文官经商功绩累加 (+15)
      if (route.assignedMerchantOfficerId && updatedOfficers[route.assignedMerchantOfficerId]) {
        const off = updatedOfficers[route.assignedMerchantOfficerId];
        updatedOfficers = {
          ...updatedOfficers,
          [off.id]: {
            ...off,
            merit: (off.merit ?? 0) + 15,
          },
        };
      }

      // 跨势力商路和平通商，季首双边友好度+1
      if (isCrossFaction && diplomacyLink && diplomacyLink.relation !== DipRelation.WAR) {
        const nextFavor = Math.min(100, (diplomacyLink.favorability ?? 50) + 1);
        if (nextFavor !== diplomacyLink.favorability) {
          updatedDiplomacy = updatedDiplomacy.map((link) =>
            link === diplomacyLink ? { ...link, favorability: nextFavor } : link,
          );
        }
      }
    }
  }

  if (!hasChanges) {
    return state;
  }

  if (totalRevenueThisQuarter > 0) {
    logs.push({
      year: state.currentYear,
      month: state.currentMonth,
      type: 'trade_quarterly_settlement',
      message: `【季首商税】全域商路榷场通市结算完毕，累计分润商税 ${totalRevenueThisQuarter} 金！`,
    });
  }

  return {
    ...state,
    cities: updatedCities,
    officers: updatedOfficers,
    diplomacy: updatedDiplomacy,
    tradeRoutes: updatedRoutes,
    actionLog: [...logs, ...(state.actionLog ?? [])].slice(0, 80),
  };
}
