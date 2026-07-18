// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * P1-01~03 MapCanvas — 地形底图 + 城点 + 交互（缩放/平移/点击）
 * 面板 UI 在 GameLayout 左/右侧，本组件只负责地图。
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Circle, Text, Group, Rect, Line, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import {
  PROVINCE_LABELS,
  allRoadEdges,
  formatTroopsForView,
  getCityVisibility,
  lonLatToPixel,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import {
  MAP_LOD_META,
  getMapLod,
  layoutCityMarkers,
  provinceLodView,
  type CityRenderPlan,
} from './mapLod';
import {
  MAP_W,
  MAP_H,
  clampPos,
  coverCenter,
  coverScale,
  maxScale as maxZoomScale,
} from './mapViewport';

function GeoBaseLayer({
  mapImg,
  scale,
  minScale,
}: {
  mapImg: HTMLImageElement | null;
  scale: number;
  minScale: number;
}) {
  const provinces = useMemo(
    () => PROVINCE_LABELS.map((p) => ({ ...p, ...lonLatToPixel(p.lon, p.lat) })),
    [],
  );
  const pl = provinceLodView(scale, minScale);

  return (
    <Group listening={true}>
      <Rect width={MAP_W} height={MAP_H} fill="#121c2a" listening={true} />
      {mapImg && (
        <KonvaImage image={mapImg} width={MAP_W} height={MAP_H} listening={true} />
      )}
      {pl.show &&
        provinces.map((p) => (
          <Text
            key={p.name}
            x={p.x}
            y={p.y}
            text={p.name}
            fontFamily="HanDynastySerif"
            fontSize={pl.fontSize}
            fill="#c9b882"
            opacity={pl.opacity}
            offsetX={(p.name.length * pl.fontSize) / 2}
            offsetY={pl.fontSize / 2}
            listening={false}
            shadowBlur={Math.max(2, pl.fontSize * 0.08)}
            shadowColor="#000"
          />
        ))}
    </Group>
  );
}

function CityMarkerNode({
  city,
  plan,
  color,
  selected,
  onSelect,
  troopsLabel,
  showFactionColor,
}: {
  city: { id: number; name: string; adminName?: string; troops: number };
  plan: CityRenderPlan;
  color: string;
  selected: boolean;
  onSelect: () => void;
  /** 谍报后的兵力文案；null 不显示 */
  troopsLabel: string | null;
  showFactionColor: boolean;
}) {
  if (!plan.showMarker) return null;
  const nameY = plan.labelDir < 0 ? plan.labelDy - plan.nameFont : plan.labelDy;
  const subLines: { text: string; fill: string }[] = [];
  if (plan.showAdmin && city.adminName && city.adminName !== city.name) {
    subLines.push({ text: city.adminName, fill: '#a89870' });
  }
  if (plan.showTroops && troopsLabel != null) {
    subLines.push({
      text: troopsLabel === '???' ? '???' : `${troopsLabel}${/^\d+$/.test(troopsLabel) ? '兵' : ''}`,
      fill: troopsLabel === '???' ? '#666' : '#8aaa90',
    });
  }
  const fillColor = showFactionColor ? color : '#4a4a4a';

  return (
    <Group
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
    >
      <Circle radius={plan.hitR} fill="transparent" />
      <Circle
        radius={plan.drawR}
        fill={fillColor}
        opacity={showFactionColor ? 0.95 : 0.75}
        stroke={selected ? '#ffd700' : plan.showMineBadge ? '#e8d48b' : '#0a0a0a'}
        strokeWidth={plan.strokeW}
      />
      {plan.showMineBadge && (
        <Text
          text="己"
          fontFamily="HanDynastySerif"
          fontSize={Math.min(plan.drawR * 1.1, plan.nameFont * 0.85)}
          fill="#fff"
          fontStyle="bold"
          offsetX={plan.drawR * 0.38}
          offsetY={plan.drawR * 0.42}
          listening={false}
        />
      )}
      {plan.showName && (
        <Text
          text={city.name}
          x={plan.labelDx}
          y={nameY}
          fontFamily="HanDynastySerif"
          fontSize={plan.nameFont}
          fill={plan.showMineBadge ? '#ffe9a8' : '#fff8e7'}
          fontStyle="bold"
          offsetX={(city.name.length * plan.nameFont) / 2}
          listening={false}
          shadowBlur={4}
          shadowColor="#000"
          shadowOpacity={0.85}
        />
      )}
      {plan.showName &&
        subLines.map((line, i) => {
          const yy =
            plan.labelDir < 0
              ? nameY - (i + 1) * (plan.adminFont + 2)
              : nameY + plan.nameFont + 2 + i * (plan.adminFont + 2);
          return (
            <Text
              key={line.text}
              text={line.text}
              x={plan.labelDx}
              y={yy}
              fontFamily="HanDynastySerif"
              fontSize={plan.adminFont}
              fill={line.fill}
              offsetX={(line.text.length * plan.adminFont) / 2}
              listening={false}
              shadowBlur={3}
              shadowColor="#000"
            />
          );
        })}
    </Group>
  );
}

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [mapImg, setMapImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(0.2);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const didInit = useRef(false);

  const game = useGameStore((s) => s.game);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const selectCity = useGameStore((s) => s.selectCity);
  const mapFocusCityId = useGameStore((s) => s.mapFocusCityId);
  const clearMapFocus = useGameStore((s) => s.clearMapFocus);

  const minScale = coverScale(size.w, size.h);
  const lod = getMapLod(scale, minScale);
  const lodMeta = MAP_LOD_META[lod];

  useEffect(() => {
    const img = new window.Image();
    img.src = '/geo-basemap.png';
    img.onload = () => setMapImg(img);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize({ w, h });
      const min = coverScale(w, h);
      setScale((prev) => {
        const next = Math.max(min, Math.min(maxZoomScale(w, h), prev));
        setPos((p) => clampPos(next, p, w, h));
        return next;
      });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fitFullMap = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scale: s, pos: p } = coverCenter(el.clientWidth, el.clientHeight);
    setScale(s);
    setPos(p);
  }, []);

  // first load: cover full screen + select capital
  useEffect(() => {
    if (!game || didInit.current) return;
    didInit.current = true;
    const capitalId = game.factions[game.playerFactionId]?.capitalCityId;
    if (capitalId != null) selectCity(capitalId);
    fitFullMap();
  }, [game, selectCity, fitFullMap]);

  // external focus request (LeftPanel)
  useEffect(() => {
    if (mapFocusCityId == null || !game) return;
    const city = game.cities[mapFocusCityId];
    const el = containerRef.current;
    if (!city || !el) {
      clearMapFocus();
      return;
    }
    const min = coverScale(el.clientWidth, el.clientHeight);
    const max = maxZoomScale(el.clientWidth, el.clientHeight);
    const s = Math.min(max, Math.max(scale, min * 2.5));
    const nextPos = clampPos(
      s,
      {
        x: el.clientWidth / 2 - city.x * s,
        y: el.clientHeight / 2 - city.y * s,
      },
      el.clientWidth,
      el.clientHeight,
    );
    setScale(s);
    setPos(nextPos);
    clearMapFocus();
  }, [mapFocusCityId, game, scale, clearMapFocus]);

  const cityPlans = useMemo(() => {
    if (!game) return new Map<number, CityRenderPlan>();
    const inputs = Object.values(game.cities).map((c) => ({
      id: c.id,
      name: c.name,
      adminName: c.adminName,
      x: c.x,
      y: c.y,
      tier: c.tier,
      isCapital: c.isCapital,
      isPlayer: c.ruler === game.playerFactionId,
      isSelected: c.id === selectedCityId,
      troops: c.troops,
    }));
    return new Map(layoutCityMarkers(scale, inputs, minScale).map((p) => [p.id, p]));
  }, [game, scale, selectedCityId, minScale]);

  const onWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const el = containerRef.current;
    if (!stage || !el) return;
    const viewW = el.clientWidth;
    const viewH = el.clientHeight;
    const min = coverScale(viewW, viewH);
    const max = maxZoomScale(viewW, viewH);
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const scaleBy = 1.08;
    const newScale = Math.min(
      max,
      Math.max(min, e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy),
    );
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const raw = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    setScale(newScale);
    setPos(clampPos(newScale, raw, viewW, viewH));
  }, []);

  if (!game) return null;

  const cities = Object.values(game.cities);
  const sortedCities = [...cities].sort((a, b) => {
    const sa = (a.id === selectedCityId ? 1000 : 0) + (a.ruler === game.playerFactionId ? 100 : 0);
    const sb = (b.id === selectedCityId ? 1000 : 0) + (b.ruler === game.playerFactionId ? 100 : 0);
    return sa - sb;
  });

  return (
    <div ref={containerRef} className="w-full h-full relative bg-stone-950" data-testid="map-canvas">
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        draggable
        onWheel={onWheel}
        onDragEnd={(e) => {
          const el = containerRef.current;
          if (!el) return;
          setPos(
            clampPos(
              e.target.scaleX(),
              { x: e.target.x(), y: e.target.y() },
              el.clientWidth,
              el.clientHeight,
            ),
          );
        }}
        onDragMove={(e) => {
          const el = containerRef.current;
          if (!el) return;
          const c = clampPos(
            e.target.scaleX(),
            { x: e.target.x(), y: e.target.y() },
            el.clientWidth,
            el.clientHeight,
          );
          e.target.position(c);
        }}
        onClick={(e) => {
          const cls = e.target.getClassName();
          if (e.target === e.target.getStage() || cls === 'Image' || cls === 'Rect') {
            selectCity(null);
          }
        }}
      >
        <Layer>
          <GeoBaseLayer mapImg={mapImg} scale={scale} minScale={minScale} />
          {/* 官道：出征邻接真源 CITY_ROAD_EDGES */}
          {game &&
            allRoadEdges().map(([a, b]) => {
              const ca = game.cities[a];
              const cb = game.cities[b];
              if (!ca || !cb) return null;
              return (
                <Line
                  key={`road-${a}-${b}`}
                  points={[ca.x, ca.y, cb.x, cb.y]}
                  stroke="#8a7355"
                  strokeWidth={Math.max(1.5, 2.2 / scale)}
                  opacity={0.45}
                  dash={[8 / scale, 6 / scale]}
                  listening={false}
                />
              );
            })}
          {sortedCities.map((city) => {
            const plan = cityPlans.get(city.id);
            if (!plan?.showMarker) return null;
            const faction = city.ruler != null ? game.factions[city.ruler] : null;
            const vis = getCityVisibility(game, city.id);
            const troopsLabel = plan.showTroops
              ? formatTroopsForView(city, vis)
              : null;
            return (
              <Group key={city.id} x={city.x} y={city.y}>
                <CityMarkerNode
                  city={city}
                  plan={plan}
                  color={faction?.color ?? '#666'}
                  selected={city.id === selectedCityId}
                  onSelect={() => selectCity(city.id)}
                  troopsLabel={troopsLabel}
                  showFactionColor={vis.showFaction || vis.kind === 'own'}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>

      <div
        className="absolute bottom-3 right-3 z-10 rounded-lg border border-amber-900/50 bg-stone-950/90 px-3 py-2 text-xs shadow-xl"
        data-testid="map-lod-indicator"
      >
        <div className="flex items-center gap-2">
          <span className="text-stone-500">视野</span>
          <span className="text-amber-300 font-semibold">{lodMeta.label}</span>
          <span className="text-stone-500">·</span>
          <span className="text-stone-400">{lodMeta.hint}</span>
        </div>
        <div className="mt-1.5 flex gap-1">
          {(['strategic', 'operational', 'tactical', 'local'] as const).map((lv) => (
            <div
              key={lv}
              className={`h-1.5 w-8 rounded-full ${lv === lod ? 'bg-amber-500' : 'bg-stone-700'}`}
            />
          ))}
        </div>
        <button
          type="button"
          className="mt-1.5 text-[10px] text-stone-400 hover:text-amber-300 underline"
          onClick={() => fitFullMap()}
        >
          重置全图
        </button>
      </div>
    </div>
  );
}

/** @deprecated use MapCanvas */
export { MapCanvas as WorldMap };
