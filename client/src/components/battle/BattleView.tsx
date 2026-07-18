// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Circle, Text, Group, Line, RegularPolygon } from 'react-konva';
import { TerrainType } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { DuelPanel } from './DuelPanel';

const HEX_SIZE = 28;
const ORIGIN = { x: 50, y: 50 };

const TERRAIN_COLOR: Record<string, string> = {
  [TerrainType.PLAIN]: '#c8d9a0',
  [TerrainType.FOREST]: '#4a7c4e',
  [TerrainType.WATER]: '#5b9bd5',
  [TerrainType.MOUNTAIN]: '#8a7a5a',
  [TerrainType.SWAMP]: '#6b7a4a',
  [TerrainType.WALL]: '#666',
  [TerrainType.CITY]: '#a08060',
};

function hexToPixel(q: number, r: number, size: number) {
  return {
    x: size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
    y: size * ((3 / 2) * r),
  };
}

function hexCorners(size: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(size * Math.cos(angle), size * Math.sin(angle));
  }
  return pts;
}

function hexDist(a: { q: number; r: number }, b: { q: number; r: number }) {
  return (
    (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
  );
}

export function BattleView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const battle = useGameStore((s) => s.battle);
  const game = useGameStore((s) => s.game);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const moveRange = useGameStore((s) => s.moveRange);
  const selectUnit = useGameStore((s) => s.selectUnit);
  const moveTo = useGameStore((s) => s.moveTo);
  const attack = useGameStore((s) => s.attack);
  const castFire = useGameStore((s) => s.castFire);
  const castAbility = useGameStore((s) => s.castAbility);
  const finishPlayer = useGameStore((s) => s.finishPlayer);
  const exitBattle = useGameStore((s) => s.exitBattle);
  const usableAbilities = useGameStore((s) => s.usableAbilities);
  const duelChallenge = useGameStore((s) => s.duelChallenge);
  const [fireMode, setFireMode] = useState(false);
  const [abilitySel, setAbilitySel] = useState<string | null>(null);
  const [duelMode, setDuelMode] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const corners = useMemo(() => hexCorners(HEX_SIZE - 1), []);

  if (!battle || !game) return null;

  const playerTurn = battle.phase === 'player';
  const selected = battle.units.find((u) => u.id === selectedUnitId);
  const attacker = battle.units.find((u) => u.side === 'attacker' && !u.isDestroyed);
  const defender = battle.units.find((u) => u.side === 'defender' && !u.isDestroyed);

  const onHex = (q: number, r: number) => {
    if (!playerTurn) return;
    const occ = battle.units.find(
      (u) => u.position.q === q && u.position.r === r && !u.isDestroyed && u.troopCount > 0,
    );
    if (occ?.side === 'attacker') {
      setFireMode(false);
      setAbilitySel(null);
      setDuelMode(false);
      void selectUnit(occ.id);
      return;
    }
    if (occ?.side === 'defender' && selected?.side === 'attacker') {
      if (fireMode) {
        setFireMode(false);
        void castFire(occ.id);
        return;
      }
      if (abilitySel) {
        const abId = abilitySel;
        setAbilitySel(null);
        void castAbility(occ.id, abId);
        return;
      }
      if (duelMode) {
        setDuelMode(false);
        void duelChallenge(selected.id, occ.id);
        return;
      }
      void attack(occ.id);
      return;
    }
    if (moveRange.includes(`${q},${r}`)) {
      setFireMode(false);
      setAbilitySel(null);
      setDuelMode(false);
      void moveTo(q, r);
      return;
    }
    setFireMode(false);
    setAbilitySel(null);
    setDuelMode(false);
    void selectUnit(null);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#1a2218]">
      <Stage width={size.w} height={size.h} draggable>
        <Layer x={ORIGIN.x} y={ORIGIN.y}>
          {battle.hexGrid.terrain.map((row, r) =>
            row.map((tid, q) => {
              const { x, y } = hexToPixel(q, r, HEX_SIZE);
              const key = `${q},${r}`;
              const inMove = playerTurn && moveRange.includes(key);
              const occ = battle.units.find(
                (u) =>
                  u.position.q === q &&
                  u.position.r === r &&
                  !u.isDestroyed &&
                  u.troopCount > 0,
              );
              return (
                <Group key={key} x={x} y={y} onClick={() => onHex(q, r)}>
                  <Line
                    points={corners}
                    closed
                    fill={inMove ? '#7ec8e3' : TERRAIN_COLOR[tid] ?? '#888'}
                    stroke={inMove ? '#2a8fcf' : '#2a3020'}
                    strokeWidth={inMove ? 2 : 1}
                    opacity={0.92}
                  />
                  {occ && (
                    <>
                      <Circle
                        radius={HEX_SIZE * 0.55}
                        fill={occ.side === 'attacker' ? '#3d7a4a' : '#8b3a3a'}
                        stroke={occ.id === selectedUnitId ? '#ffd700' : '#111'}
                        strokeWidth={occ.id === selectedUnitId ? 3 : 1.5}
                      />
                      <Text
                        text={game.officers[occ.commanderId]?.name.slice(0, 1) ?? '?'}
                        fontFamily="HanDynastySerif"
                        fontSize={14}
                        fill="#fff"
                        fontStyle="bold"
                        offsetX={7}
                        offsetY={7}
                      />
                    </>
                  )}
                </Group>
              );
            }),
          )}
          {playerTurn &&
            selected &&
            battle.units
              .filter((u) => u.side === 'defender' && !u.isDestroyed)
              .filter((u) => hexDist(selected.position, u.position) <= 1)
              .map((u) => {
                const { x, y } = hexToPixel(u.position.q, u.position.r, HEX_SIZE);
                return (
                  <RegularPolygon
                    key={`atk-${u.id}`}
                    x={x}
                    y={y}
                    sides={6}
                    radius={HEX_SIZE}
                    stroke="#ff4444"
                    strokeWidth={2}
                    dash={[4, 3]}
                    listening={false}
                  />
                );
              })}
        </Layer>
      </Stage>

      <div className="absolute top-3 left-3 right-3 flex justify-between pointer-events-none">
        <div className="pointer-events-auto max-w-lg rounded-lg border border-amber-900/50 bg-stone-950/90 p-3 text-sm">
          <div
            className={
              battle.phase === 'enemy'
                ? 'text-red-400 mb-1'
                : battle.phase === 'over'
                  ? 'text-amber-400 mb-1'
                  : 'text-emerald-400 mb-1'
            }
          >
            {battle.phase === 'enemy'
              ? '【敌军行动中】'
              : battle.phase === 'over'
                ? '【战斗结束】'
                : '【我方回合】'}
          </div>
          {battle.message}
          {battle.phase === 'over' && (
            <div className="mt-1 text-amber-300">
              {battle.winner === 'attacker'
                ? battle.fromCityId != null
                  ? '胜利！返回大地图将占领此城'
                  : '胜利！（演示战，不改归属）'
                : '败北… 残部将退回出发城'}
            </div>
          )}
          {battle.phase !== 'over' && battle.fromCityId != null && (
            <div className="mt-1 text-stone-400 text-xs">
              中途返回 = 撤军（约半数残兵回流）
            </div>
          )}
        </div>
        <div className="flex gap-2 pointer-events-auto">
          {attacker && (
            <SideCard
              title={`我军 · ${game.officers[attacker.commanderId]?.name}`}
              troops={attacker.troopCount}
              morale={attacker.morale}
              energy={attacker.energy ?? 100}
            />
          )}
          {defender && (
            <SideCard
              title={`敌军 · ${game.officers[defender.commanderId]?.name}`}
              troops={defender.troopCount}
              morale={defender.morale}
              energy={defender.energy ?? 100}
            />
          )}
        </div>
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 flex-wrap justify-center max-w-[90%]">
        {playerTurn && (
          <>
            <button
              className="px-3 py-1.5 rounded bg-stone-800 border border-stone-600 text-sm"
              onClick={() => void finishPlayer()}
            >
              结束行动（敌军自动出手）
            </button>
            {attacker && (
              <button
                className="px-3 py-1.5 rounded bg-emerald-900 border border-emerald-600 text-sm"
                onClick={() => {
                  setFireMode(false);
                  void selectUnit(attacker.id);
                }}
              >
                选择我军
              </button>
            )}
            {attacker && selected?.id === attacker.id && !attacker.hasActed && (
              <button
                data-testid="btn-fire-tactic"
                className={`px-3 py-1.5 rounded border text-sm ${
                  fireMode
                    ? 'bg-orange-700 border-orange-400 text-orange-50'
                    : 'bg-orange-950 border-orange-700 text-orange-200'
                }`}
                disabled={(attacker.energy ?? 0) < 30}
                onClick={() => { setFireMode((v) => !v); setAbilitySel(null); setDuelMode(false); }}
                title="消耗气力30；再点敌军格施放"
              >
                {fireMode ? '火计·点敌军' : `火计（气${attacker.energy ?? 100}）`}
              </button>
            )}
            {attacker && selected?.id === attacker.id && !attacker.hasActed && (attacker.energy ?? 0) >= 20 && (
              <button
                data-testid="btn-duel"
                className={`px-3 py-1.5 rounded border text-sm ${
                  duelMode
                    ? 'bg-yellow-700 border-yellow-400 text-yellow-50'
                    : 'bg-yellow-950 border-yellow-700 text-yellow-200'
                }`}
                onClick={() => { setDuelMode((v) => !v); setFireMode(false); setAbilitySel(null); }}
                title="消耗气力20；需与敌将相邻；全自动结算"
              >
                {duelMode ? '单挑·点敌将' : '单挑'}
              </button>
            )}
            {attacker && selected?.id === attacker.id && !attacker.hasActed && usableAbilities.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {usableAbilities.map((ab) => {
                  const active = abilitySel === ab.id;
                  const enoughEnergy = (attacker.energy ?? 0) >= ab.energyCost;
                  return (
                    <button
                      key={ab.id}
                      data-testid={`btn-ability-${ab.id}`}
                      className={`px-2 py-1 rounded border text-xs ${
                        active
                          ? 'bg-purple-700 border-purple-400 text-purple-50'
                          : enoughEnergy
                            ? 'bg-purple-950 border-purple-700 text-purple-200'
                            : 'bg-stone-900 border-stone-700 text-stone-500'
                      }`}
                      disabled={!enoughEnergy}
                      title={`${ab.name} Lv${ab.level}（耗气${ab.energyCost}，威力${ab.power}x，${ab.specialEffect}）`}
                      onClick={() => { setAbilitySel(active ? null : ab.id); setFireMode(false); }}
                    >
                      {ab.name}·{['', '初', '通', '精', '极', '神'][ab.level]}
                    </button>
                  );
                })}
                {abilitySel && (
                  <span className="text-purple-300 text-xs self-center">→ 点敌军施放</span>
                )}
              </div>
            )}
          </>
        )}
        <button
          data-testid="btn-exit-battle"
          className="px-3 py-1.5 rounded bg-amber-900 border border-amber-600 text-sm"
          onClick={() => void exitBattle()}
        >
          {battle.phase === 'over' && battle.winner === 'attacker'
            ? '返回并占城'
            : battle.phase === 'over'
              ? '返回大地图'
              : '撤军返回'}
          </button>
      </div>

      {battle.duel && <DuelPanel duel={battle.duel} />}
    </div>
  );
}

function SideCard({
  title,
  troops,
  morale,
  energy,
}: {
  title: string;
  troops: number;
  morale: number;
  energy: number;
}) {
  return (
    <div className="rounded-lg border border-amber-900/50 bg-stone-950/90 p-2 text-xs min-w-[140px]">
      <div className="text-amber-400 mb-1">{title}</div>
      <div>兵力 {troops}</div>
      <div>士气 {morale}</div>
      <div>气力 {energy}</div>
    </div>
  );
}

