// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useRef, useState, useMemo } from 'react';
import { Stage, Layer, Shape, Group, Rect, Text } from 'react-konva';
import {
  type DuelState,
  DUEL_COMMAND_LABEL,
  getDuelCardMatchup,
} from '@leh/shared';
import {
  playClash,
  playCritImpact,
  playFinisherCharge,
  playHorseGallop,
} from '../../utils/sfx';

export interface DuelStageProps {
  duel: DuelState;
  roundIndex?: number;
  speedMode?: 'full' | 'fast' | 'skip';
  resolveName?: (id: number) => string | undefined;
  width?: number;
  height?: number;
}

type DuelAnimPhase = 'card_reveal' | 'charging' | 'clash' | 'strike_resolve' | 'settled';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

export function DuelStage({
  duel,
  roundIndex,
  speedMode = 'full',
  resolveName,
  width = 680,
  height = 260,
}: DuelStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  const [animPhase, setAnimPhase] = useState<DuelAnimPhase>('settled');
  const [shake, setShake] = useState({ x: 0, y: 0 });
  const sparksRef = useRef<Spark[]>([]);

  // 响应式自适应
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

  const rounds = duel.roundHistory ?? [];
  const currentIdx = roundIndex !== undefined ? roundIndex : Math.max(0, rounds.length - 1);
  const currentRound = rounds[currentIdx];

  const challengerName = resolveName?.(duel.challengerId) ?? `武将${duel.challengerId}`;
  const defenderName = resolveName?.(duel.defenderId) ?? `武将${duel.defenderId}`;
  const atkSurname = challengerName.slice(0, 1) || '攻';
  const defSurname = defenderName.slice(0, 1) || '守';

  // 提取本回合出牌与克制态势
  const roundCommands = useMemo(() => {
    if (!currentRound || !currentRound.commands) {
      return {
        cmdAtk: 'fierce_attack',
        cmdDef: 'restrain',
        labelAtk: '猛攻',
        labelDef: '牵制',
        matchup: getDuelCardMatchup('fierce_attack', 'restrain'),
      };
    }
    const cmdAtk = currentRound.commands[0] ?? 'fierce_attack';
    const cmdDef = currentRound.commands[1] ?? 'restrain';
    const labelAtk = DUEL_COMMAND_LABEL[cmdAtk] ?? cmdAtk;
    const labelDef = DUEL_COMMAND_LABEL[cmdDef] ?? cmdDef;
    const matchup = getDuelCardMatchup(cmdAtk, cmdDef);
    return { cmdAtk, cmdDef, labelAtk, labelDef, matchup };
  }, [currentRound]);

  // 判断是否出现暴击/反手/重创特写
  const hasSpecialEffect = useMemo(() => {
    if (!currentRound) return false;
    const isCrit = Object.values(currentRound.criticals ?? {}).some(Boolean);
    const isCounter = Object.values(currentRound.counterDamages ?? {}).some((d) => d > 0);
    const hasInjury = Object.values(currentRound.injuryApplied ?? {}).some(Boolean);
    const hasChain = Object.values(currentRound.chainHits ?? {}).some((c) => c && c.length > 0);
    return isCrit || isCounter || hasInjury || hasChain;
  }, [currentRound]);

  // 回合切换动效时序
  useEffect(() => {
    if (!currentRound || speedMode === 'skip') {
      setAnimPhase('settled');
      return;
    }

    const scale = speedMode === 'fast' ? 0.4 : 1.0;
    setAnimPhase('card_reveal');
    playHorseGallop?.();

    if (roundCommands.cmdAtk === 'finisher' || roundCommands.cmdDef === 'finisher') {
      playFinisherCharge?.();
    }

    const t1 = setTimeout(() => {
      setAnimPhase('charging');
    }, 200 * scale);

    const t2 = setTimeout(() => {
      setAnimPhase('clash');
      playClash?.();
      // 碰撞震屏
      setShake({ x: 5, y: -3 });
      setTimeout(() => setShake({ x: -4, y: 4 }), 60 * scale);
      setTimeout(() => setShake({ x: 0, y: 0 }), 140 * scale);

      // 生成碰撞火花
      const cx = dimensions.width / 2;
      const cy = dimensions.height * 0.65;
      const sparks: Spark[] = [];
      for (let s = 0; s < 24; s++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 5;
        sparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          color: s % 3 === 0 ? '#fde047' : s % 3 === 1 ? '#f97316' : '#ffffff',
          alpha: 1.0,
          size: 1.5 + Math.random() * 2,
        });
      }
      sparksRef.current = sparks;
    }, 500 * scale);

    const t3 = setTimeout(() => {
      setAnimPhase('strike_resolve');
      if (hasSpecialEffect) {
        playCritImpact?.();
        setShake({ x: 8, y: -6 });
        setTimeout(() => setShake({ x: -6, y: 5 }), 80 * scale);
        setTimeout(() => setShake({ x: 0, y: 0 }), 200 * scale);
      }
    }, 750 * scale);

    const t4 = setTimeout(() => {
      setAnimPhase('settled');
    }, 1150 * scale);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [currentRound, currentIdx, speedMode, roundCommands, hasSpecialEffect, dimensions]);

  // 火花与粒子物理步进
  const animFrameRef = useRef(0);
  useEffect(() => {
    let animId: number;
    const loop = () => {
      animFrameRef.current += 1;
      const list = sparksRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // 重力
        p.alpha -= 0.04;
        if (p.alpha <= 0) {
          list.splice(i, 1);
        }
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 双方武将对冲 X 坐标计算
  const midX = dimensions.width / 2;
  const groundY = dimensions.height * 0.68;

  let atkX = dimensions.width * 0.22;
  let defX = dimensions.width * 0.78;

  if (animPhase === 'charging') {
    atkX = dimensions.width * 0.38;
    defX = dimensions.width * 0.62;
  } else if (animPhase === 'clash') {
    atkX = midX - 22;
    defX = midX + 22;
  } else if (animPhase === 'strike_resolve' || animPhase === 'settled') {
    // 交马错身而过
    atkX = midX + 60;
    defX = midX - 60;
  }

  return (
    <div
      ref={containerRef}
      data-testid="duel-stage-container"
      className="relative w-full h-full flex flex-col bg-stone-950 overflow-hidden select-none"
      style={{
        transform: `translate(${shake.x}px, ${shake.y}px)`,
        transition: 'transform 40ms ease-out',
      }}
    >
      {/* Konva 中央演出画布 */}
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
      >
        {/* 1. 决斗台水墨沙盘背景 */}
        <Layer listening={false}>
          <Shape
            sceneFunc={(context) => {
              const ctx = context._context;
              const w = dimensions.width;
              const h = dimensions.height;

              // 暮色斜阳背景
              const grad = ctx.createLinearGradient?.(0, 0, 0, h);
              if (grad) {
                grad.addColorStop(0, '#1c1917');
                grad.addColorStop(0.65, '#292524');
                grad.addColorStop(1, '#0f0e0d');
                ctx.fillStyle = grad;
              } else {
                ctx.fillStyle = '#1c1917';
              }
              ctx.fillRect?.(0, 0, w, h);

              // 决战场沙土地面
              ctx.fillStyle = '#171412';
              ctx.fillRect?.(0, groundY + 10, w, h - groundY);

              // 地平线墨痕
              ctx.strokeStyle = '#44403c';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo?.(0, groundY + 10);
              ctx.lineTo?.(w, groundY + 10);
              ctx.stroke?.();

              // 对冲阶段速度线 (Speed Lines)
              if (animPhase === 'charging' || animPhase === 'clash') {
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
                ctx.lineWidth = 1.2;
                for (let l = 0; l < 8; l++) {
                  const ly = groundY - 40 + (l * 12);
                  const lx = (animFrameRef.current * 18 + l * 80) % w;
                  ctx.beginPath();
                  ctx.moveTo?.(lx, ly);
                  ctx.lineTo?.(lx + 45, ly);
                  ctx.stroke?.();
                }
              }
            }}
          />
        </Layer>

        {/* 2. 攻守双方武将交马与对冲 (声明式 Group + 命令式武器) */}
        <Layer listening={false}>
          {/* 攻方武将 (左侧向右冲锋) */}
          <Group x={atkX} y={groundY}>
            {/* 战马占位 */}
            <Rect x={-18} y={-8} width={36} height={18} fill="#57534e" cornerRadius={4} />
            {/* 武将主牌 */}
            <Rect x={-12} y={-38} width={24} height={30} fill="#b91c1c" stroke="#f59e0b" strokeWidth={1.5} cornerRadius={2} />
            <Text x={-8} y={-33} text={atkSurname} fontSize={16} fontStyle="bold" fill="#fef08a" />
            {/* 兵刃金光 */}
            <Shape
              sceneFunc={(context) => {
                const ctx = context._context;
                ctx.strokeStyle = '#fef08a';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo?.(12, -22);
                ctx.lineTo?.(28, -26);
                ctx.stroke?.();
              }}
            />
          </Group>

          {/* 守方武将 (右侧向左冲锋) */}
          <Group x={defX} y={groundY}>
            {/* 战马占位 */}
            <Rect x={-18} y={-8} width={36} height={18} fill="#44403c" cornerRadius={4} />
            {/* 武将主牌 */}
            <Rect x={-12} y={-38} width={24} height={30} fill="#1e3a5f" stroke="#38bdf8" strokeWidth={1.5} cornerRadius={2} />
            <Text x={-8} y={-33} text={defSurname} fontSize={16} fontStyle="bold" fill="#f8fafc" />
            {/* 兵刃流光 */}
            <Shape
              sceneFunc={(context) => {
                const ctx = context._context;
                ctx.strokeStyle = '#bae6fd';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo?.(-12, -22);
                ctx.lineTo?.(-28, -26);
                ctx.stroke?.();
              }}
            />
          </Group>

          {/* 碰撞瞬间金色刀光与火星粒子 */}
          <Shape
            sceneFunc={(context) => {
              const ctx = context._context;
              // 绘制弧形刀光 (Bezier Slash Line)
              if (animPhase === 'clash' || animPhase === 'strike_resolve') {
                ctx.save?.();
                ctx.strokeStyle = hasSpecialEffect ? '#ef4444' : '#fde047';
                ctx.lineWidth = hasSpecialEffect ? 4 : 2.5;
                ctx.shadowColor = hasSpecialEffect ? '#dc2626' : '#f59e0b';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.moveTo?.(midX - 35, groundY - 45);
                ctx.quadraticCurveTo?.(midX, groundY - 15, midX + 35, groundY - 45);
                ctx.stroke?.();
                ctx.restore?.();
              }

              // 绘制火花粒子
              for (const sp of sparksRef.current) {
                ctx.save?.();
                ctx.globalAlpha = Math.max(0, sp.alpha);
                ctx.fillStyle = sp.color;
                ctx.beginPath();
                ctx.arc?.(sp.x, sp.y, sp.size, 0, Math.PI * 2);
                ctx.fill?.();
                ctx.restore?.();
              }
            }}
          />
        </Layer>
      </Stage>

      {/* 3. 中央出牌卡牌对撞展示区 (三向克制高亮: 猛攻克牵制 / 牵制克必杀 / 必杀克猛攻) */}
      <div
        data-testid="duel-cards-overlay"
        className="pointer-events-none absolute inset-x-0 top-3 flex items-center justify-center gap-4 z-20"
      >
        {/* 攻方指令卡牌 */}
        <div
          data-testid="duel-card-challenger"
          className={`flex flex-col items-center justify-center px-4 py-2 rounded-lg border-2 shadow-lg transition-all duration-300 ${
            roundCommands.matchup.advantage === 1
              ? 'border-amber-400 bg-rose-950/90 scale-105 shadow-[0_0_16px_rgba(251,191,36,0.5)]'
              : 'border-rose-800 bg-stone-900/85'
          }`}
        >
          <span className="text-[10px] text-stone-400 tracking-widest">{challengerName}</span>
          <span className="text-base font-extrabold text-amber-200 mt-0.5">{roundCommands.labelAtk}</span>
          {roundCommands.matchup.advantage === 1 && (
            <span className="text-[10px] font-bold text-amber-300 px-1.5 rounded bg-amber-900/60 mt-1">
              克制!
            </span>
          )}
        </div>

        {/* 阵前相克裁决徽章 */}
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full border border-amber-600/70 bg-stone-950 flex items-center justify-center text-xs font-serif font-bold text-amber-300 shadow-md">
            克
          </div>
          <span
            data-testid="duel-matchup-label"
            className="text-[11px] font-bold mt-1 px-2 py-0.5 rounded border"
            style={{
              color: roundCommands.matchup.color,
              borderColor: roundCommands.matchup.color,
              backgroundColor: 'rgba(0,0,0,0.6)',
            }}
          >
            {roundCommands.matchup.label}
          </span>
        </div>

        {/* 守方指令卡牌 */}
        <div
          data-testid="duel-card-defender"
          className={`flex flex-col items-center justify-center px-4 py-2 rounded-lg border-2 shadow-lg transition-all duration-300 ${
            roundCommands.matchup.advantage === -1
              ? 'border-blue-400 bg-blue-950/90 scale-105 shadow-[0_0_16px_rgba(59,130,246,0.5)]'
              : 'border-blue-800 bg-stone-900/85'
          }`}
        >
          <span className="text-[10px] text-stone-400 tracking-widest">{defenderName}</span>
          <span className="text-base font-extrabold text-blue-200 mt-0.5">{roundCommands.labelDef}</span>
          {roundCommands.matchup.advantage === -1 && (
            <span className="text-[10px] font-bold text-blue-300 px-1.5 rounded bg-blue-900/60 mt-1">
              克制!
            </span>
          )}
        </div>
      </div>

      {/* 4. 技能暴击/反手/重创全屏暗场特写 (Skill Cutscene) */}
      {animPhase === 'strike_resolve' && hasSpecialEffect && (
        <div
          data-testid="duel-crit-overlay"
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/75 animate-[ink-fade-in_150ms_ease-out]"
        >
          <div className="px-6 py-3 rounded-lg border-2 border-red-600 bg-stone-950/95 shadow-[0_0_30px_rgba(239,68,68,0.6)] text-center">
            <div className="text-[10px] tracking-[0.3em] text-amber-400 font-serif">【绝技破阵 · 锋芒毕露】</div>
            <div className="text-xl lg:text-2xl font-black text-rose-300 tracking-[0.16em] mt-1 font-serif">
              {currentRound?.criticals?.[duel.challengerId]
                ? `${challengerName} · 暴击！`
                : currentRound?.criticals?.[duel.defenderId]
                  ? `${defenderName} · 暴击！`
                  : '绝杀碰撞！'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
