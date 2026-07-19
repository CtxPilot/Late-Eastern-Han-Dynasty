// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { Router, type Router as ExpressRouter } from 'express';
import type { EventSourceClass } from '@leh/shared';
import * as gameService from '../services/game.js';

export const gameRouter: ExpressRouter = Router();

gameRouter.get('/static', (_req, res) => {
  res.json(gameService.listStatic());
});

gameRouter.post('/create', (req, res) => {
  try {
    const scenarioId = Number(req.body.scenarioId ?? 1);
    const playerFactionId = Number(req.body.playerFactionId ?? 2);
    const eventLayers = Array.isArray(req.body.eventLayers)
      ? req.body.eventLayers.map(String) as EventSourceClass[]
      : undefined;
    if (!Number.isInteger(scenarioId) || !Number.isInteger(playerFactionId)) {
      throw new Error('剧本与势力参数必须是整数');
    }
    const state = gameService.createGame(scenarioId, playerFactionId, eventLayers);
    res.json(state);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'create failed' });
  }
});

gameRouter.get('/state', (_req, res) => {
  try {
    res.json(gameService.getClientGame());
  } catch (e) {
    res.status(404).json({ error: e instanceof Error ? e.message : 'no game' });
  }
});

gameRouter.post('/end-turn', (_req, res) => {
  try {
    res.json(gameService.endTurn());
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'end turn failed' });
  }
});

/** S14 事件选项：{ eventId, choiceIndex } → GameState */
gameRouter.post('/event/choose', (req, res) => {
  try {
    res.json(
      gameService.doEventChoice(Number(req.body.eventId), Number(req.body.choiceIndex)),
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'event choose failed' });
  }
});

gameRouter.post('/civil/develop-farm', (req, res) => {
  try {
    const cityId = Number(req.body.cityId);
    res.json(gameService.doDevelopFarm(cityId));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'develop failed' });
  }
});

gameRouter.post('/civil/develop', (req, res) => {
  try {
    const cityId = Number(req.body.cityId);
    const kind = String(req.body.kind ?? 'farm') as 'farm' | 'commerce' | 'wall';
    res.json(gameService.doDevelop(cityId, kind));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'develop failed' });
  }
});

gameRouter.post('/civil/conscript', (req, res) => {
  try {
    res.json(gameService.doConscript(Number(req.body.cityId)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'conscript failed' });
  }
});

gameRouter.post('/civil/relief', (req, res) => {
  try {
    res.json(gameService.doRelief(Number(req.body.cityId)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'relief failed' });
  }
});

gameRouter.post('/civil/train', (req, res) => {
  try {
    res.json(gameService.doTrain(Number(req.body.cityId)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'train failed' });
  }
});

gameRouter.post('/civil/seek-beauty', (req, res) => {
  try {
    res.json(gameService.doSeekBeauty(Number(req.body.cityId)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'seek beauty failed' });
  }
});

/** 兼容旧路径 → 寻访 */
gameRouter.post('/civil/search-beauty', (req, res) => {
  try {
    res.json(gameService.doSeekBeauty(Number(req.body.cityId)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'seek beauty failed' });
  }
});

gameRouter.post('/personnel/reward-beauty', (req, res) => {
  try {
    res.json(
      gameService.doRewardBeautyStock(
        Number(req.body.officerId),
        req.body.amount != null ? Number(req.body.amount) : undefined,
      ),
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'reward beauty failed' });
  }
});

gameRouter.post('/personnel/marry', (req, res) => {
  try {
    res.json(
      gameService.doMarry(Number(req.body.femaleId), Number(req.body.officerId)),
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'marry failed' });
  }
});

gameRouter.post('/personnel/gift-beauty', (req, res) => {
  try {
    res.json(
      gameService.doGiftBeauty(Number(req.body.femaleId), Number(req.body.officerId)),
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'gift failed' });
  }
});

/** S11 搜索：己方城耗金寻访在野男将 */
gameRouter.post('/personnel/search', (req, res) => {
  try {
    res.json(gameService.doSearchTalent(Number(req.body.cityId)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'search failed' });
  }
});

/** S11 登用：在野男将 */
gameRouter.post('/personnel/recruit', (req, res) => {
  try {
    res.json(
      gameService.doRecruitOfficer(
        Number(req.body.officerId),
        req.body.recruiterId != null ? Number(req.body.recruiterId) : undefined,
      ),
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'recruit failed' });
  }
});

/** S11/S12 任命：三轨 { officerId, track, position, cityId? } */
gameRouter.post('/personnel/appoint', (req, res) => {
  try {
    const track = String(req.body.track) as 'civil' | 'local' | 'military';
    res.json(
      gameService.doAppoint(
        Number(req.body.officerId),
        track,
        String(req.body.position),
        req.body.cityId != null ? Number(req.body.cityId) : undefined,
      ),
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'appoint failed' });
  }
});

gameRouter.get('/march/can-reach/:targetCityId', (req, res) => {
  try {
    res.json({ ok: gameService.canMarchTo(Number(req.params.targetCityId)) });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'check failed' });
  }
});

gameRouter.post('/intel/recruit', (req, res) => {
  try {
    res.json(gameService.doRecruitSpies(Number(req.body.cityId)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'recruit failed' });
  }
});

gameRouter.post('/intel/recruit-female', (req, res) => {
  try {
    res.json(gameService.doTrainFemaleSpy(Number(req.body.cityId)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'recruit-female failed' });
  }
});

/** 献美→点化女间谍（掩护线） */
gameRouter.post('/intel/plant-female', (req, res) => {
  try {
    res.json(
      gameService.doPlantFemale(
        Number(req.body.targetFactionId),
        req.body.homeCityId != null ? Number(req.body.homeCityId) : undefined,
      ),
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'plant-female failed' });
  }
});

gameRouter.post('/intel/mission', (req, res) => {
  try {
    const { agentId, type, targetCityId, targetOfficerId } = req.body as {
      agentId: string;
      type: string;
      targetCityId: number;
      targetOfficerId?: number;
    };
    res.json(
      gameService.doSpyMission(
        String(agentId),
        String(type),
        Number(targetCityId),
        targetOfficerId != null ? Number(targetOfficerId) : undefined,
      ),
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'mission failed' });
  }
});

gameRouter.post('/intel/station', (req, res) => {
  try {
    res.json(
      gameService.doStationCounter(String(req.body.agentId), Number(req.body.cityId)),
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'station failed' });
  }
});

gameRouter.post('/intel/unstation', (req, res) => {
  try {
    res.json(gameService.doUnstationCounter(Number(req.body.cityId)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'unstation failed' });
  }
});

gameRouter.post('/intel/captive', (req, res) => {
  try {
    res.json(
      gameService.doResolveCaptive(String(req.body.agentId), String(req.body.action)),
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'captive failed' });
  }
});

gameRouter.post('/plot/launch', (req, res) => {
  try {
    const { type, targetFactionId, targetCityId, targetOfficerId, agentId } = req.body as {
      type: string;
      targetFactionId?: number;
      targetCityId?: number;
      targetOfficerId?: number;
      agentId?: string;
    };
    res.json(
      gameService.doLaunchPlot(
        String(type),
        targetFactionId != null ? Number(targetFactionId) : undefined,
        targetCityId != null ? Number(targetCityId) : undefined,
        targetOfficerId != null ? Number(targetOfficerId) : undefined,
        agentId ? String(agentId) : undefined,
      ),
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'plot launch failed' });
  }
});

gameRouter.post('/personnel/join-faction', (req, res) => {
  try {
    const { officerId, factionId, cityId } = req.body as {
      officerId: number;
      factionId: number;
      cityId?: number;
    };
    res.json(
      gameService.doJoinFaction(Number(officerId), Number(factionId), cityId != null ? Number(cityId) : undefined),
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'join failed' });
  }
});

gameRouter.post('/personnel/release-officer', (req, res) => {
  try {
    res.json(gameService.doReleaseOfficer(Number(req.body.officerId)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'release failed' });
  }
});

gameRouter.post('/personnel/follow-check', (_req, res) => {
  try {
    res.json(gameService.doFollowCheck());
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'follow check failed' });
  }
});

gameRouter.post('/diplomacy/tribute', (req, res) => {
  try {
    res.json(gameService.doTribute(Number(req.body.targetFactionId)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'tribute failed' });
  }
});

/** S08∩S09 献美：转移 beautyStock，友好+12/点 */
gameRouter.post('/diplomacy/gift-beauty', (req, res) => {
  try {
    res.json(
      gameService.doGiftBeautyDip(
        Number(req.body.targetFactionId),
        req.body.amount != null ? Number(req.body.amount) : undefined,
      ),
    );
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'gift beauty failed' });
  }
});

gameRouter.post('/diplomacy/alliance', (req, res) => {
  try {
    res.json(gameService.doAlliance(Number(req.body.targetFactionId)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'alliance failed' });
  }
});

gameRouter.post('/battle/start', (req, res) => {
  try {
    const cityId = Number(req.body.cityId);
    const fromCityId =
      req.body.fromCityId != null ? Number(req.body.fromCityId) : undefined;
    res.json(gameService.startBattle(cityId, fromCityId));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'battle start failed' });
  }
});

/** Demo 出征：扣兵粮 + 开战，返回 { game, battle } */
gameRouter.post('/march', (req, res) => {
  try {
    const targetCityId = Number(req.body.targetCityId ?? req.body.cityId);
    const fromCityId =
      req.body.fromCityId != null ? Number(req.body.fromCityId) : undefined;
    const troopCount =
      req.body.troopCount != null ? Number(req.body.troopCount) : undefined;
    res.json(gameService.startMarch(targetCityId, fromCityId, troopCount));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'march failed' });
  }
});

gameRouter.get('/march/suggest-from/:targetCityId', (req, res) => {
  try {
    const id = gameService.suggestFromCity(Number(req.params.targetCityId));
    res.json({ fromCityId: id });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'suggest failed' });
  }
});

gameRouter.get('/battle', (_req, res) => {
  const b = gameService.getBattle();
  if (!b) return res.status(404).json({ error: 'no battle' });
  res.json(b);
});

gameRouter.get('/battle/move-range/:unitId', (req, res) => {
  res.json({ keys: gameService.battleMoveRange(req.params.unitId) });
});

gameRouter.post('/battle/move', (req, res) => {
  try {
    const { unitId, q, r } = req.body as { unitId: string; q: number; r: number };
    res.json(gameService.battleMove(unitId, Number(q), Number(r)));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'move failed' });
  }
});

gameRouter.post('/battle/attack', (req, res) => {
  try {
    const { attackerId, defenderId } = req.body as { attackerId: string; defenderId: string };
    res.json(gameService.battleAttack(attackerId, defenderId));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'attack failed' });
  }
});

gameRouter.post('/battle/fire', (req, res) => {
  try {
    const { attackerId, targetId } = req.body as { attackerId: string; targetId: string };
    res.json(gameService.battleFire(attackerId, targetId));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'fire failed' });
  }
});

/** S10 查询可用战法 */
gameRouter.get('/battle/abilities/:unitId', (req, res) => {
  try {
    res.json({ abilities: gameService.battleUsableAbilities(req.params.unitId) });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'abilities failed' });
  }
});

/** S10 施放战法 */
gameRouter.post('/battle/ability', (req, res) => {
  try {
    const { attackerId, targetId, abilityId } = req.body as {
      attackerId: string;
      targetId: string;
      abilityId: string;
    };
    res.json(gameService.battleAbility(attackerId, targetId, abilityId));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'ability failed' });
  }
});

gameRouter.post('/battle/finish-player', (_req, res) => {
  try {
    res.json(gameService.battleFinishPlayer());
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'finish failed' });
  }
});

/** S10 §8 玩家发起单挑 */
gameRouter.post('/battle/duel/challenge', (req, res) => {
  try {
    const { challengerUnitId, targetUnitId } = req.body as { challengerUnitId: string; targetUnitId: string };
    res.json(gameService.battleChallengeDuel(challengerUnitId, targetUnitId));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'duel challenge failed' });
  }
});

/** S10 §8 推进单挑一回合 (观看演出) */
gameRouter.post('/battle/duel/step', (_req, res) => {
  try {
    res.json(gameService.battleDuelStep());
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'duel step failed' });
  }
});

/** S10 §8 跳过单挑动画直接结算 */
gameRouter.post('/battle/duel/skip', (_req, res) => {
  try {
    res.json(gameService.battleDuelSkip());
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'duel skip failed' });
  }
});

gameRouter.post('/battle/enemy-phase', (_req, res) => {
  try {
    res.json(gameService.battleEnemyPhase());
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'enemy phase failed' });
  }
});

gameRouter.post('/battle/exit', (_req, res) => {
  try {
    // 结算占城/残兵后返回最新 GameState
    res.json(gameService.exitBattle());
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'exit failed' });
  }
});

// ====== 战役层 API（05 §十二~§十七 · 06 §2.14） ======

gameRouter.post('/campaign/start', (req, res) => {
  try {
    const body = req.body as {
      commanderId: number;
      subCommanderIds: number[];
      advisorId?: number;
      subAdvisorId?: number;
      fromNodeId: number;
      targetNodeId: number;
      unitType: string;
      formation: number;
      troopCount: number;
      food: number;
    };
    const { game, army } = gameService.campaignStart({
      commanderId: Number(body.commanderId),
      subCommanderIds: Array.isArray(body.subCommanderIds) ? body.subCommanderIds.map(Number) : [],
      advisorId: body.advisorId != null ? Number(body.advisorId) : undefined,
      subAdvisorId: body.subAdvisorId != null ? Number(body.subAdvisorId) : undefined,
      fromNodeId: Number(body.fromNodeId),
      targetNodeId: Number(body.targetNodeId),
      unitType: body.unitType as import('@leh/shared').UnitType,
      formation: Number(body.formation) as import('@leh/shared').FormationType,
      troopCount: Number(body.troopCount),
      food: Number(body.food),
    });
    res.json({ game, army });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'campaign start failed' });
  }
});

gameRouter.post('/campaign/:armyId/march', (req, res) => {
  try {
    const targetNodeId = Number(req.body.targetNodeId);
    res.json(gameService.campaignMarch(req.params.armyId, targetNodeId));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'campaign march failed' });
  }
});

gameRouter.post('/campaign/:armyId/build', (req, res) => {
  try {
    const structureType = String(req.body.structureType) as import('@leh/shared').StructureType;
    res.json(gameService.campaignBuild(req.params.armyId, structureType));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'campaign build failed' });
  }
});

gameRouter.post('/campaign/:armyId/assault', (req, res) => {
  try {
    res.json(gameService.doCampaignAssault(req.params.armyId));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'campaign assault failed' });
  }
});

gameRouter.post('/campaign/:armyId/siege/surrender', (req, res) => {
  try {
    res.json(gameService.campaignSiegeSurrender(req.params.armyId));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'campaign surrender failed' });
  }
});

gameRouter.post('/campaign/:armyId/retreat', (req, res) => {
  try {
    res.json(gameService.campaignRetreat(req.params.armyId));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'campaign retreat failed' });
  }
});

gameRouter.post('/campaign/:armyId/advisor/action', (req, res) => {
  try {
    const action = String(req.body.action) as 'inspire' | 'trap' | 'retreat' | 'scout';
    res.json(gameService.campaignAdvisor(req.params.armyId, action));
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'advisor action failed' });
  }
});

gameRouter.get('/campaign/nodes', (_req, res) => {
  try {
    res.json({ nodes: gameService.campaignNodes() });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'campaign nodes failed' });
  }
});
