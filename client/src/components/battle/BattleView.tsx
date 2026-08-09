// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Circle, Text, Group, Line, RegularPolygon } from 'react-konva';
import { FORMATION_LABEL, FormationType, TerrainType, Weather, tacticalTurnFromTimestamp, type Officer, type BattleSideContext, type BattleLogExplanation, type DuelStance } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { DuelPanel } from './DuelPanel';
import { ExpressionPortrait } from '../officer/ExpressionPortrait';

const HEX_SIZE = 28;
const ORIGIN = { x: 50, y: 50 };
const TERRAIN_COLOR: Record<string, string> = { [TerrainType.PLAIN]: '#c8d9a0', [TerrainType.FOREST]: '#4a7c4e', [TerrainType.WATER]: '#5b9bd5', [TerrainType.MOUNTAIN]: '#8a7a5a', [TerrainType.SWAMP]: '#6b7a4a', [TerrainType.WALL]: '#666', [TerrainType.CITY]: '#a08060' };
const HEX_FORMATIONS: readonly FormationType[] = [FormationType.SQUARE, FormationType.CIRCLE, FormationType.WEDGE, FormationType.GOOSE, FormationType.CRANE_WING, FormationType.ARROWHEAD];
const WEATHER_LABEL: Record<Weather, string> = { [Weather.CLEAR]: '晴', [Weather.CLOUDY]: '阴', [Weather.RAIN]: '雨', [Weather.STORM]: '暴雨', [Weather.FOG]: '雾', [Weather.SNOW]: '雪' };
function weatherEffectLabel(weather: Weather): string {
  if (weather === Weather.SNOW) return '移动−2 · 射程−1';
  if (weather === Weather.FOG) return '移动−1 · 射程−2 · 远程禁射';
  if (weather === Weather.RAIN || weather === Weather.STORM) return '移动−1 · 射程−1';
  return '移动/射程无修正';
}
const hexToPixel = (q: number, r: number, size: number) => ({ x: size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r), y: size * (3 / 2 * r) });
function hexCorners(size: number) { const pts: number[] = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); pts.push(size * Math.cos(a), size * Math.sin(a)); } return pts; }
function hexDist(a: { q: number; r: number }, b: { q: number; r: number }) { return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2; }

export function BattleView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const [fireMode, setFireMode] = useState(false);
  const [abilitySel, setAbilitySel] = useState<string | null>(null);
  const [duelMode, setDuelMode] = useState(false);
  const [formationMode, setFormationMode] = useState(false);
  const [duelStance, setDuelStance] = useState<DuelStance>('delegate');
  const battle = useGameStore((s) => s.battle); const game = useGameStore((s) => s.game); const error = useGameStore((s) => s.error); const selectedUnitId = useGameStore((s) => s.selectedUnitId); const moveRange = useGameStore((s) => s.moveRange); const movePath = useGameStore((s) => s.movePath); const selectUnit = useGameStore((s) => s.selectUnit); const previewMoveTo = useGameStore((s) => s.previewMoveTo); const moveTo = useGameStore((s) => s.moveTo); const undoBattleAction = useGameStore((s) => s.undoBattleAction); const attack = useGameStore((s) => s.attack); const castFire = useGameStore((s) => s.castFire); const castAbility = useGameStore((s) => s.castAbility); const finishPlayer = useGameStore((s) => s.finishPlayer); const changeBattleFormation = useGameStore((s) => s.changeBattleFormation); const exitBattle = useGameStore((s) => s.exitBattle); const usableAbilities = useGameStore((s) => s.usableAbilities); const duelChallenge = useGameStore((s) => s.duelChallenge);
  useEffect(() => { const el = containerRef.current; if (!el) return; const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); return () => ro.disconnect(); }, []);
  const corners = useMemo(() => hexCorners(HEX_SIZE - 1), []);
  if (!battle || !game) return null;
  const playerTurn = battle.phase === 'player'; const selected = battle.units.find((u) => u.id === selectedUnitId); const attacker = battle.units.find((u) => u.side === 'attacker' && !u.isDestroyed); const defender = battle.units.find((u) => u.side === 'defender' && !u.isDestroyed); const selectedArmy = selected ? game.campaignArmies.find((army) => army.id === selected.armyId) : undefined; const mainAttacker = attacker ? battle.units.find((unit) => unit.side === 'attacker' && unit.commanderId === (game.campaignArmies.find((army) => army.id === unit.armyId)?.commanderId ?? unit.commanderId)) ?? attacker : undefined; const lastBattleAction = battle.actionHistory?.at(-1); const canUndoMove = Boolean(playerTurn && lastBattleAction?.source === 'player' && lastBattleAction.reversible && lastBattleAction.kind === 'move' && tacticalTurnFromTimestamp(lastBattleAction.logicalTimestamp) === battle.turn); const canChangeFormation = Boolean(playerTurn && selected && mainAttacker?.id === selected.id && !selected.hasActed && (battle.tacticalPoints ?? 5) >= 1 && (battle.tacticalPointsUsed ?? 0) < 1);
  // Keep the latest formation explanation pinned in the compact report. A formation
  // change is followed by the enemy phase and may otherwise scroll out after one
  // attack, leaving the player unable to understand the next damage result.
  const recentStart = Math.max(0, battle.log.length - 6);
  let latestFormationIndex = -1;
  battle.log.forEach((entry, index) => {
    if (entry.explanation?.kind === 'formation') latestFormationIndex = index;
  });
  const reportIndices = Array.from(new Set([...
    Array.from({ length: battle.log.length - recentStart }, (_, offset) => recentStart + offset),
    ...(latestFormationIndex >= 0 ? [latestFormationIndex] : []),
  ])).sort((a, b) => b - a);
  const reportEntries = reportIndices.map((index) => battle.log[index]);
  const onHex = (q: number, r: number) => { if (!playerTurn) return; const occ = battle.units.find((u) => u.position.q === q && u.position.r === r && !u.isDestroyed && u.troopCount > 0); if (occ?.side === 'attacker') { setFireMode(false); setAbilitySel(null); setDuelMode(false); void selectUnit(occ.id); return; } if (occ?.side === 'defender' && selected?.side === 'attacker') { if (fireMode) { setFireMode(false); void castFire(occ.id); return; } if (abilitySel) { const id = abilitySel; setAbilitySel(null); void castAbility(occ.id, id); return; } if (duelMode) { setDuelMode(false); void duelChallenge(selected.id, occ.id, duelStance); return; } void attack(occ.id); return; } if (moveRange.includes(`${q},${r}`)) { setFireMode(false); setAbilitySel(null); setDuelMode(false); void moveTo(q, r); return; } setFireMode(false); setAbilitySel(null); setDuelMode(false); void selectUnit(null); };
  return <div ref={containerRef} className="w-full h-full relative bg-[#1a2218]"><Stage width={size.w} height={size.h} draggable><Layer x={ORIGIN.x} y={ORIGIN.y}>{battle.hexGrid.terrain.map((row, r) => row.map((tid, q) => { const { x, y } = hexToPixel(q, r, HEX_SIZE); const key = `${q},${r}`; const inMove = playerTurn && moveRange.includes(key); const occ = battle.units.find((u) => u.position.q === q && u.position.r === r && !u.isDestroyed && u.troopCount > 0); return <Group key={key} x={x} y={y} onMouseEnter={() => { if (inMove) void previewMoveTo(q, r); }} onClick={() => onHex(q, r)}><Line points={corners} closed fill={inMove ? '#7ec8e3' : TERRAIN_COLOR[tid] ?? '#888'} stroke={inMove ? '#2a8fcf' : '#2a3020'} strokeWidth={inMove ? 2 : 1} opacity={0.92} />{occ && <><Circle radius={HEX_SIZE * .55} fill={occ.side === 'attacker' ? '#3d7a4a' : '#8b3a3a'} stroke={occ.id === selectedUnitId ? '#ffd700' : '#111'} strokeWidth={occ.id === selectedUnitId ? 3 : 1.5} /><Text text={occ.commanderName.slice(0, 1)} fontFamily="HanDynastySerif" fontSize={14} fill="#fff" fontStyle="bold" offsetX={7} offsetY={7} /></>}</Group>; }))}{playerTurn && selected && battle.units.filter((u) => u.side === 'defender' && !u.isDestroyed && hexDist(selected.position, u.position) <= 1).map((u) => { const p = hexToPixel(u.position.q, u.position.r, HEX_SIZE); return <RegularPolygon key={`atk-${u.id}`} x={p.x} y={p.y} sides={6} radius={HEX_SIZE} stroke="#ff4444" strokeWidth={2} dash={[4, 3]} listening={false} />; })}</Layer></Stage>
    <div className="absolute top-3 left-3 right-3 flex justify-between pointer-events-none"><div className="pointer-events-auto max-w-lg rounded-lg border border-amber-900/50 bg-stone-950/90 p-3 text-sm"><div className={battle.phase === 'enemy' ? 'text-red-400 mb-1' : battle.phase === 'over' ? 'text-amber-400 mb-1' : 'text-emerald-400 mb-1'}>{battle.phase === 'enemy' ? '【敌军行动中】' : battle.phase === 'over' ? '【战斗结束】' : '【我方回合】'}</div><div data-testid="battle-weather" className="mb-1 border-b border-stone-700 pb-1 text-amber-300">天气：{WEATHER_LABEL[battle.weather]} · {weatherEffectLabel(battle.weather)}{battle.weatherChangeTimer != null && <span> · {battle.weatherChangeTimer}回合后变化</span>}</div>{battle.message}{battle.phase === 'over' && <div className="mt-1 text-amber-300">{battle.winner === 'attacker' ? battle.fromCityId != null ? '胜利！返回大地图将占领此城' : '胜利！（演示战，不改归属）' : '败北… 残部将退回出发城'}</div>}</div><div className="flex gap-2 pointer-events-auto">{attacker && <SideCard title={`我军 · ${attacker.commanderName}`} troops={attacker.troopCount} morale={attacker.morale} energy={attacker.energy ?? 100} portrait={game.officers[attacker.commanderId]} battleSide={{ side: attacker.side, winner: battle.winner, morale: attacker.morale, isDestroyed: attacker.isDestroyed, isRetreated: attacker.isRetreated }} />}{defender && <SideCard title={`敌军 · ${defender.commanderName}`} troops={defender.troopCount} morale={defender.morale} energy={defender.energy ?? 100} portrait={game.officers[defender.commanderId]} battleSide={{ side: defender.side, winner: battle.winner, morale: defender.morale, isDestroyed: defender.isDestroyed, isRetreated: defender.isRetreated }} />}</div></div>
    <BattleReport entries={reportEntries} error={error} />
    {movePath?.found && <div data-testid="move-path-summary" className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded border border-sky-700 bg-stone-950/95 px-3 py-1 text-xs text-sky-200">路径 {movePath.path.length - 1} 格 · 消耗 {movePath.totalCost} · 剩余 {movePath.path.at(-1)?.remaining ?? 0} 移动力</div>}
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 flex-wrap justify-center max-w-[90%]">
      {playerTurn && <>
        <button data-testid="btn-finish-player" className="px-3 py-1.5 rounded bg-stone-800 border border-stone-600 text-sm" onClick={() => void finishPlayer()}>结束行动（敌军自动出手）</button>
        {attacker && <button data-testid="btn-select-attacker" className="px-3 py-1.5 rounded bg-emerald-900 border border-emerald-600 text-sm" onClick={() => { setFireMode(false); void selectUnit(attacker.id); }}>选择我军</button>}
        {canChangeFormation && <button data-testid="btn-battle-formation" className="px-3 py-1.5 rounded border text-sm bg-indigo-950 border-indigo-700 text-indigo-200" onClick={() => { setFormationMode((value) => !value); setFireMode(false); setAbilitySel(null); setDuelMode(false); }}>{formationMode ? '收起变阵' : `变阵（${battle.tacticalPoints ?? 5} TP）`}</button>}
        {formationMode && canChangeFormation && <div data-testid="battle-formation-picker" className="flex gap-1 flex-wrap rounded border border-indigo-800 bg-stone-950/95 p-1">{HEX_FORMATIONS.map((formation) => <button key={formation} data-testid={`battle-formation-${formation}`} disabled={selectedArmy?.formation === formation || selected?.formation === formation} className="rounded border border-stone-700 px-2 py-1 text-xs text-stone-200 disabled:opacity-40" onClick={() => { setFormationMode(false); void changeBattleFormation(formation); }}>{FORMATION_LABEL[formation]}</button>)}</div>}
        {attacker && selected?.id === attacker.id && !attacker.hasActed && <button data-testid="btn-fire-tactic" className="px-3 py-1.5 rounded border text-sm bg-orange-950 border-orange-700 text-orange-200" disabled={(attacker.energy ?? 0) < 30} onClick={() => { setFireMode((v) => !v); setAbilitySel(null); setDuelMode(false); }}>{fireMode ? '火计·点敌军' : `火计（气${attacker.energy ?? 100}）`}</button>}
        {attacker && selected?.id === attacker.id && !attacker.hasActed && (attacker.energy ?? 0) >= 20 && <button data-testid="btn-duel" className="px-3 py-1.5 rounded border text-sm bg-yellow-950 border-yellow-700 text-yellow-200" onClick={() => { setDuelMode((v) => !v); setFireMode(false); setAbilitySel(null); }}>单挑</button>}
        {duelMode && <div data-testid="duel-stance-picker" className="flex gap-1">{(['assault', 'steady', 'bait', 'delegate'] as const).map((v) => <button key={v} className="rounded border px-2 py-1 text-xs" onClick={() => setDuelStance(v)}>{v === 'assault' ? '强攻' : v === 'steady' ? '持重' : v === 'bait' ? '诱敌' : '委任'}</button>)}</div>}
        {attacker && selected?.id === attacker.id && !attacker.hasActed && usableAbilities.length > 0 && <div className="flex gap-1 flex-wrap">{usableAbilities.map((ab) => <button key={ab.id} data-testid={`btn-ability-${ab.id}`} className="px-2 py-1 rounded border text-xs" disabled={(attacker.energy ?? 0) < ab.energyCost} onClick={() => { setAbilitySel(abilitySel === ab.id ? null : ab.id); setFireMode(false); }}>{ab.name}</button>)}</div>}
      </>}
      {canUndoMove && <button data-testid="btn-battle-undo" title="仅可撤销本回合尚未攻击、施法、结束行动或消耗 RNG 的最后一次移动" className="px-3 py-1.5 rounded bg-sky-950 border border-sky-700 text-sm text-sky-200" onClick={() => void undoBattleAction()}>撤销移动</button>}
      <button data-testid="btn-exit-battle" className="px-3 py-1.5 rounded bg-amber-900 border border-amber-600 text-sm" onClick={() => void exitBattle()}>{battle.phase === 'over' && battle.winner === 'attacker' ? '返回并占城' : battle.phase === 'over' ? '返回大地图' : '撤军返回'}</button>
    </div>
    {battle.duel && <DuelPanel duel={battle.duel} />}
  </div>;
}

function formationName(value?: FormationType) { return value == null ? '—' : FORMATION_LABEL[value] ?? `阵型${value}`; }
function blockReason(value: string) {
  const labels: Record<string, string> = { not_mastered: '武将未精通', restricted_unit: '兵种受限', unit_not_allowed: '兵种不可用', surrounded: '被围不可变阵', already_changed: '本回合已变阵', unknown: '当前条件不允许' };
  return labels[value] ?? value;
}
function signed(value?: number) { return value == null ? '0' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}`; }
function BattleReport({ entries, error }: { entries: Array<{ turn: number; message: string; explanation?: BattleLogExplanation }>; error: string | null }) {
  return <div data-testid="battle-report" className="absolute right-3 top-[150px] w-[270px] max-h-[38%] overflow-auto rounded-lg border border-stone-700 bg-stone-950/90 p-2 text-xs text-stone-200 pointer-events-auto">
    <div className="mb-1 border-b border-stone-700 pb-1 text-amber-300">战报·阵型解释</div>
    {error && <div data-testid="battle-report-error" className="mb-1 rounded border border-red-800/70 bg-red-950/40 p-1 text-red-300">阻断：{error.includes('（') ? blockReason(error.slice(error.indexOf('（') + 1, error.lastIndexOf('）'))) : error}</div>}
    {entries.map((entry, index) => <div key={`${entry.turn}-${index}`} className="mb-1 border-b border-stone-800 pb-1 last:border-0">
      <div className="text-stone-400">第{entry.turn}回合 · {entry.message}</div>
      {entry.explanation?.kind === 'formation' && <div className="text-indigo-300">变阵：{formationName(entry.explanation.formationBefore)} → {formationName(entry.explanation.formationAfter)}；TP {entry.explanation.tacticalPointsBefore} → {entry.explanation.tacticalPointsAfter}</div>}
      {entry.explanation?.kind === 'attack' && <div className="text-emerald-300">阵型贡献：攻 {signed(entry.explanation.formationAttack)} · 防 {signed(entry.explanation.formationDefense)}（{formationName(entry.explanation.attackerFormation)} vs {formationName(entry.explanation.defenderFormation)}）</div>}
    </div>)}
  </div>;
}

function SideCard({ title, troops, morale, energy, portrait, battleSide }: { title: string; troops: number; morale: number; energy: number; portrait?: Officer | null; battleSide?: BattleSideContext }) { return <div className="rounded-lg border border-amber-900/50 bg-stone-950/90 p-2 text-xs min-w-[140px]"><div className="text-amber-400 mb-1 flex items-center gap-1.5">{portrait && battleSide && <ExpressionPortrait officer={portrait} battle={battleSide} compact />}<span>{title}</span></div><div>兵力 {troops}</div><div>士气 {morale}</div><div>气力 {energy}</div></div>; }
