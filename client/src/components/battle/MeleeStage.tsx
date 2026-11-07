// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useRef, useState, useMemo } from 'react';
import { Stage, Layer, Shape, Group, Rect, Text } from 'react-konva';
import {
  UnitType,
  FORMATION_LABEL,
  getUnitMeleeBadge,
  getUnitMatchupInfo,
  type BattleState,
  type MeleeState,
  type GameState,
  type StrategemType,
} from '@leh/shared';
import { BATTLE_TOKENS as BT } from '../../theme/canvasTokens';
import { useGameStore } from '../../stores/gameStore';
import { InkButton } from '../ui/buttons';
import { renderMeleeParallaxBackground } from '../../battle/meleeBackground';
import { drawLevel3StrategemOverlays } from '../../battle/meleeStrategem';
import { SoldierSwarm, type SwarmCommand } from '../../battle/soldier';
import { playDrum } from '../../utils/sfx';

export interface MeleeStageProps {
  battle?: BattleState | null;
  melee?: MeleeState | null;
  game?: GameState | null;
  onExit?: () => void;
  onDuel?: () => void;
  onAssault?: () => void;
  containerWidth?: number;
  containerHeight?: number;
}

export function MeleeStage({
  battle: propBattle,
  melee: propMelee,
  game: propGame,
  onExit: propOnExit,
  onDuel: propOnDuel,
  onAssault: propOnAssault,
  containerWidth = 960,
  containerHeight = 600,
}: MeleeStageProps) {
  const storeGame = useGameStore((s) => s.game);
  const storeBattle = useGameStore((s) => s.battle);
  const storeMelee = useGameStore((s) => s.melee);
  const pushSceneFrame = useGameStore((s) => s.pushSceneFrame);
  const meleeExit = useGameStore((s) => s.meleeExit);

  const game = propGame ?? storeGame;
  const battle = propBattle !== undefined ? propBattle : storeBattle;
  const melee = propMelee !== undefined ? propMelee : storeMelee;

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: containerWidth, height: containerHeight });
  const [activeCommand, setActiveCommand] = useState<SwarmCommand>('assault');
  const [transitionOpacity, setTransitionOpacity] = useState(1.0); // 进场水墨黑屏淡出
  const [isSkillActive, setIsSkillActive] = useState(false);
  const [skillBanner, setSkillBanner] = useState<{ general: string; title: string } | null>(null);
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });

  // 1. 提取攻防双方主帅与部队数据
  const combatInfo = useMemo(() => {
    // 优先从 battle 场景推导
    if (battle && battle.units && battle.units.length > 0) {
      const atkUnit = battle.units.find((u) => u.side === 'attacker' && !u.isDestroyed) ?? battle.units.find((u) => u.side === 'attacker') ?? battle.units[0];
      const defUnit = battle.units.find((u) => u.side === 'defender' && !u.isDestroyed) ?? battle.units.find((u) => u.side === 'defender') ?? battle.units[1] ?? battle.units[0];

      const atkOfficer = game?.officers ? game.officers[atkUnit.commanderId] : null;
      const defOfficer = game?.officers ? game.officers[defUnit.commanderId] : null;

      return {
        attacker: {
          commanderName: atkUnit.commanderName ?? atkOfficer?.name ?? '关羽',
          unitType: atkUnit.unitType ?? UnitType.SPEARMAN,
          troops: atkUnit.troopCount ?? 3500,
          maxTroops: atkUnit.maxTroops ?? 5000,
          morale: atkUnit.morale ?? 90,
          formation: atkUnit.formation ?? 6,
          color: BT.unitAttacker ?? '#c2410c',
        },
        defender: {
          commanderName: defUnit.commanderName ?? defOfficer?.name ?? '曹仁',
          unitType: defUnit.unitType ?? UnitType.HEAVY_INFANTRY,
          troops: defUnit.troopCount ?? 3200,
          maxTroops: defUnit.maxTroops ?? 5000,
          morale: defUnit.morale ?? 85,
          formation: defUnit.formation ?? 1,
          color: BT.unitDefender ?? '#2563eb',
        },
        activeStrategem: (battle.activeStrategem ?? 'none') as StrategemType,
      };
    }

    // 其次从 melee 场景推导
    if (melee) {
      const atkArmy = game?.campaignArmies?.find((a) => a.id === melee.attackerArmyId);
      const defArmy = game?.campaignArmies?.find((a) => a.id === melee.defenderArmyId);
      const atkOfficer = atkArmy && game?.officers ? game.officers[atkArmy.commanderId] : null;
      const defOfficer = defArmy && game?.officers ? game.officers[defArmy.commanderId] : null;

      return {
        attacker: {
          commanderName: atkOfficer?.name ?? atkArmy?.name ?? '主将',
          unitType: (atkArmy?.unitType as UnitType) ?? UnitType.SPEARMAN,
          troops: atkArmy?.troops ?? 3000,
          maxTroops: 5000,
          morale: atkArmy?.morale ?? 80,
          formation: 6,
          color: BT.unitAttacker ?? '#c2410c',
        },
        defender: {
          commanderName: defOfficer?.name ?? defArmy?.name ?? '敌将',
          unitType: (defArmy?.unitType as UnitType) ?? UnitType.HEAVY_INFANTRY,
          troops: defArmy?.troops ?? 2800,
          maxTroops: 5000,
          morale: defArmy?.morale ?? 75,
          formation: 1,
          color: BT.unitDefender ?? '#2563eb',
        },
        activeStrategem: 'none' as StrategemType,
      };
    }

    // 兜底默认对垒
    return {
      attacker: {
        commanderName: '关羽',
        unitType: UnitType.SPEARMAN,
        troops: 4000,
        maxTroops: 5000,
        morale: 95,
        formation: 6,
        color: BT.unitAttacker ?? '#c2410c',
      },
      defender: {
        commanderName: '曹仁',
        unitType: UnitType.HEAVY_INFANTRY,
        troops: 3600,
        maxTroops: 5000,
        morale: 88,
        formation: 1,
        color: BT.unitDefender ?? '#2563eb',
      },
      activeStrategem: 'none' as StrategemType,
    };
  }, [battle, melee, game]);

  // 2. 实例化原创 SoldierSwarm 军团群体模拟
  const swarmRef = useRef<SoldierSwarm | null>(null);
  if (!swarmRef.current) {
    swarmRef.current = new SoldierSwarm();
  }

  // 3. 监听容器尺寸响应式自适应
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions({ width: clientWidth, height: clientHeight });
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // 4. 重置军团方阵粒子散布
  useEffect(() => {
    if (swarmRef.current && dimensions.width > 0 && dimensions.height > 0) {
      swarmRef.current.init(
        {
          troops: combatInfo.attacker.troops,
          unitType: combatInfo.attacker.unitType,
          color: combatInfo.attacker.color,
          name: combatInfo.attacker.commanderName,
        },
        {
          troops: combatInfo.defender.troops,
          unitType: combatInfo.defender.unitType,
          color: combatInfo.defender.color,
          name: combatInfo.defender.commanderName,
        },
        dimensions,
      );
    }
  }, [combatInfo, dimensions]);

  // 5. 进场遮罩淡入 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setTransitionOpacity(0);
    }, 40);
    return () => clearTimeout(timer);
  }, []);

  // 6. 动画驱动循环 (Konva requestAnimationFrame / Animation)
  const frameRef = useRef(0);
  const combatLayerRef = useRef<any>(null);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      frameRef.current += 1;
      if (swarmRef.current) {
        swarmRef.current.update(1, dimensions);
      }
      if (combatLayerRef.current) {
        combatLayerRef.current.batchDraw?.();
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [dimensions]);

  // 7. 指令响应：全军突击
  const handleAssault = () => {
    setActiveCommand('assault');
    if (swarmRef.current) {
      swarmRef.current.setCommand('assault');
    }
    playDrum?.();
    propOnAssault?.();
  };

  // 8. 指令响应：鸣金收兵 (回退二级沙盘)
  const handleRetreat = () => {
    setActiveCommand('retreat');
    if (swarmRef.current) {
      swarmRef.current.setCommand('retreat');
    }
    setTransitionOpacity(1); // 水墨淡出
    setTimeout(() => {
      if (propOnExit) {
        propOnExit();
      } else {
        void meleeExit();
      }
    }, 320);
  };

  // 9. 指令响应：发起单挑 (切入四级单挑)
  const handleDuel = () => {
    if (propOnDuel) {
      propOnDuel();
      return;
    }
    // 压入单挑场景
    pushSceneFrame({ scene: 'duel' });
  };

  // 10. 指令响应：施放武将计特写
  const handleGeneralSkill = () => {
    if (isSkillActive) return;
    setIsSkillActive(true);
    setSkillBanner({
      general: combatInfo.attacker.commanderName,
      title: `${combatInfo.attacker.commanderName} · 青龙偃月破阵！`,
    });
    playDrum?.();

    // 震屏动效
    setShakeOffset({ x: 6, y: -4 });
    setTimeout(() => setShakeOffset({ x: -4, y: 5 }), 80);
    setTimeout(() => setShakeOffset({ x: 3, y: -2 }), 160);
    setTimeout(() => setShakeOffset({ x: 0, y: 0 }), 280);

    // 施放暴击冲击波
    if (swarmRef.current) {
      const center = { x: dimensions.width * 0.65, y: dimensions.height * 0.7 };
      swarmRef.current.applySkillBlast('attacker', 85, center, 190);
    }

    setTimeout(() => {
      setIsSkillActive(false);
      setSkillBanner(null);
    }, 1400);
  };

  // 提取徽标与克制状态
  const atkWBadge = getUnitMeleeBadge(combatInfo.attacker.unitType);
  const defWBadge = getUnitMeleeBadge(combatInfo.defender.unitType);
  const matchup = getUnitMatchupInfo(combatInfo.attacker.unitType, combatInfo.defender.unitType);

  const atkSurname = combatInfo.attacker.commanderName.slice(0, 1) || '将';
  const defSurname = combatInfo.defender.commanderName.slice(0, 1) || '敌';

  return (
    <div
      ref={containerRef}
      data-testid="melee-stage-container"
      className="relative w-full h-full flex flex-col bg-stone-950 text-stone-200 overflow-hidden select-none"
      style={{
        transform: `translate(${shakeOffset.x}px, ${shakeOffset.y}px)`,
        transition: 'transform 50ms ease-out',
      }}
    >
      {/* 顶部军情旗牌卡 */}
      <div
        data-testid="melee-top-header"
        className="relative z-10 flex items-center justify-between px-6 py-2.5 border-b border-amber-900/60 shadow-[0_6px_24px_rgba(0,0,0,0.65)]"
        style={{ background: BT.panelHeader ?? 'rgba(28,25,23,0.92)' }}
      >
        {/* 攻方主将卡片 */}
        <div className="flex items-center gap-3">
          <div
            data-testid="attacker-commander-seal"
            className="w-10 h-10 rounded border-2 border-amber-600 bg-rose-950/80 flex items-center justify-center font-bold text-amber-200 text-lg shadow-[0_0_8px_rgba(245,158,11,0.3)]"
          >
            {atkSurname}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-100 text-base">{combatInfo.attacker.commanderName}</span>
              <span className="text-xs px-1.5 py-0.5 rounded border border-rose-800 bg-rose-950/60 text-rose-300">
                {atkWBadge.char} · {atkWBadge.name}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded border border-amber-800 bg-amber-950/40 text-amber-300">
                {FORMATION_LABEL[combatInfo.attacker.formation] ?? '军阵'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-stone-400 mt-0.5">
              <span>兵力: {combatInfo.attacker.troops.toLocaleString()}</span>
              <span>士气: {combatInfo.attacker.morale}</span>
            </div>
          </div>
        </div>

        {/* 中央战况与克制徽记 */}
        <div className="flex flex-col items-center">
          <div className="text-xs tracking-[0.28em] text-stone-400 font-serif">三级白刃 · 两军对垒</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              data-testid="melee-matchup-badge"
              className="px-2 py-0.5 rounded text-xs font-bold border"
              style={{
                color: matchup.color,
                borderColor: matchup.color,
                backgroundColor: 'rgba(0,0,0,0.4)',
              }}
            >
              兵种相克：{matchup.label} (×{matchup.modifier})
            </span>
            {combatInfo.activeStrategem !== 'none' && (
              <span className="px-2 py-0.5 rounded text-xs bg-amber-900/60 border border-amber-600 text-amber-200">
                计谋：{combatInfo.activeStrategem}
              </span>
            )}
          </div>
        </div>

        {/* 守方主将卡片 */}
        <div className="flex items-center gap-3 flex-row-reverse text-right">
          <div
            data-testid="defender-commander-seal"
            className="w-10 h-10 rounded border-2 border-stone-500 bg-blue-950/80 flex items-center justify-center font-bold text-stone-200 text-lg shadow-[0_0_8px_rgba(59,130,246,0.3)]"
          >
            {defSurname}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-row-reverse">
              <span className="font-bold text-stone-200 text-base">{combatInfo.defender.commanderName}</span>
              <span className="text-xs px-1.5 py-0.5 rounded border border-blue-800 bg-blue-950/60 text-blue-300">
                {defWBadge.char} · {defWBadge.name}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded border border-stone-700 bg-stone-900 text-stone-300">
                {FORMATION_LABEL[combatInfo.defender.formation] ?? '军阵'}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-row-reverse text-xs text-stone-400 mt-0.5">
              <span>兵力: {combatInfo.defender.troops.toLocaleString()}</span>
              <span>士气: {combatInfo.defender.morale}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 中央主战场 Stage */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <Stage
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0"
        >
          {/* 1. 四层视差水墨背景 */}
          <Layer listening={false}>
            <Shape
              sceneFunc={(context) => {
                const ctx = context._context;
                renderMeleeParallaxBackground(ctx, {
                  width: dimensions.width,
                  height: dimensions.height,
                  cameraX: 0,
                  frame: frameRef.current,
                });
              }}
            />
          </Layer>

          {/* 2. 计谋环境粒子层 (火星/暴雨/伏兵幽暗) */}
          {combatInfo.activeStrategem !== 'none' && (
            <Layer listening={false}>
              <Shape
                sceneFunc={(context) => {
                  const ctx = context._context;
                  drawLevel3StrategemOverlays(
                    ctx,
                    dimensions.width,
                    dimensions.height,
                    combatInfo.activeStrategem,
                    frameRef.current,
                  );
                }}
              />
            </Layer>
          )}

          {/* 3. 两军大将大纛帅旗与阵列标记 */}
          <Layer listening={false}>
            {/* 攻方主帅军旗 (左侧) */}
            <Group x={35} y={dimensions.height * 0.44}>
              <Rect width={4} height={120} fill="#78350f" />
              <Rect x={4} y={0} width={38} height={48} fill={combatInfo.attacker.color} cornerRadius={[0, 4, 4, 0]} opacity={0.9} />
              <Text x={14} y={12} text={atkSurname} fontSize={22} fontStyle="bold" fill="#fef08a" />
            </Group>

            {/* 守方主帅军旗 (右侧) */}
            <Group x={dimensions.width - 75} y={dimensions.height * 0.44}>
              <Rect width={4} height={120} fill="#78350f" />
              <Rect x={-38} y={0} width={38} height={48} fill={combatInfo.defender.color} cornerRadius={[4, 0, 0, 4]} opacity={0.9} />
              <Text x={-28} y={12} text={defSurname} fontSize={22} fontStyle="bold" fill="#f8fafc" />
            </Group>
          </Layer>

          {/* 4. 小兵方阵群体对砍与飘字层 */}
          <Layer ref={combatLayerRef} listening={false}>
            <Shape
              sceneFunc={(context) => {
                const ctx = context._context;
                if (swarmRef.current) {
                  swarmRef.current.draw(ctx, frameRef.current);
                }
              }}
            />
          </Layer>
        </Stage>

        {/* 武将计全屏暗场与篆印特写 Banner */}
        {isSkillActive && skillBanner && (
          <div
            data-testid="melee-skill-overlay"
            className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/75 animate-[ink-fade-in_200ms_ease-out]"
          >
            <div className="relative px-8 py-5 rounded-lg border-2 border-amber-500 bg-stone-950/95 shadow-[0_0_40px_rgba(245,158,11,0.5)] text-center">
              <div className="text-xs tracking-[0.4em] text-amber-400 font-serif mb-1">【武将计 · 天威绝响】</div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-amber-200 tracking-[0.2em] font-serif shadow-sm">
                {skillBanner.title}
              </h1>
              <div className="mt-2 text-sm text-stone-300">破军裂阵 · 敌军遭受毁灭性范围重创！</div>
            </div>
          </div>
        )}

        {/* 切入/退出渐变水墨遮罩 */}
        <div
          data-testid="melee-transition-overlay"
          className="pointer-events-none absolute inset-0 z-40 bg-stone-950 transition-opacity duration-300"
          style={{ opacity: transitionOpacity }}
        />
      </div>

      {/* 底部古典纯战略指令控制台 */}
      <div
        data-testid="melee-command-bar"
        className="relative z-10 flex items-center justify-between px-6 py-3 border-t border-amber-900/60 shadow-[0_-6px_24px_rgba(0,0,0,0.55)]"
        style={{ background: BT.panelHeader ?? 'rgba(28,25,23,0.95)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400 tracking-wider">战略军令：</span>
          <InkButton
            data-testid="btn-melee-assault"
            className={`px-4 py-1.5 rounded text-sm font-bold border transition-colors ${
              activeCommand === 'assault'
                ? 'bg-rose-900 border-rose-500 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                : 'bg-stone-900/80 border-stone-700 text-stone-300 hover:border-rose-700'
            }`}
            onClick={handleAssault}
          >
            全军突击
          </InkButton>
          <InkButton
            data-testid="btn-melee-retreat"
            className="px-4 py-1.5 rounded text-sm border border-stone-600 bg-stone-900/80 text-stone-300 hover:border-amber-700 hover:text-amber-200"
            onClick={handleRetreat}
          >
            鸣金收兵
          </InkButton>
          <InkButton
            data-testid="btn-melee-duel"
            className="px-4 py-1.5 rounded text-sm border border-amber-700/80 bg-amber-950/60 text-amber-200 hover:bg-amber-900/80"
            onClick={handleDuel}
          >
            发起单挑
          </InkButton>
        </div>

        <div className="flex items-center gap-3">
          <InkButton
            data-testid="btn-melee-skill"
            className="px-4 py-1.5 rounded text-sm font-bold border border-yellow-600 bg-gradient-to-r from-amber-900 to-yellow-800 text-yellow-100 shadow-[0_0_12px_rgba(234,179,8,0.35)] hover:brightness-110"
            onClick={handleGeneralSkill}
          >
            施放武将计
          </InkButton>
        </div>
      </div>
    </div>
  );
}
