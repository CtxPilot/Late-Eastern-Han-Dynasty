// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import { calculateAllianceChance, findDiplomacy } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { controlsEmperor } from '@leh/shared';
import { BeautyPanel } from './BeautyPanel';
import { FamilyPanel } from './FamilyPanel';
import { SpyPanel } from './SpyPanel';
import { PlotPanel } from './PlotPanel';
import { PersonnelPanel } from './PersonnelPanel';
import { AppointPanel } from './AppointPanel';
import { OfficerRosterPanel } from './OfficerRosterPanel';
import { CampaignPanel } from '../campaign/CampaignPanel';
import { GrandStrategistPanel } from '../strategist/GrandStrategistPanel';
import { AccSection } from '../ui/AccSection';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';

type AccordionKey =
  | 'campaign'
  | 'personnel'
  | 'family'
  | 'intel'
  | 'plot'
  | 'strategist'
  | 'diplomacy'
  | 'monarch'
  | 'cities'
  | null;

const REL_LABEL: Record<string, string> = {
  war: '交战',
  hostile: '敌对',
  neutral: '中立',
  friendly: '友好',
  allied: '同盟',
};

/**
 * 左侧政务：导航、人事、外交（与谍报联动）；不重复右侧内政。
 * 所有折叠默认收起。
 */
export function LeftPanel() {
  const game = useGameStore((s) => s.game);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const selectCity = useGameStore((s) => s.selectCity);
  const focusMapOnCity = useGameStore((s) => s.focusMapOnCity);
  const clearError = useGameStore((s) => s.clearError);
  const tribute = useGameStore((s) => s.tribute);
  const establishHegemony = useGameStore((s) => s.establishHegemony);
  const falseDecreeWar = useGameStore((s) => s.falseDecreeWar);
  const giftBeautyDip = useGameStore((s) => s.giftBeautyDip);
  const plantFemale = useGameStore((s) => s.plantFemale);
  const formAlliance = useGameStore((s) => s.formAlliance);
  const loading = useGameStore((s) => s.loading);
  const error = useGameStore((s) => s.error);
  const [open, setOpen] = useState<AccordionKey>(null);
  const [confirm, setConfirm] = useState<
    | { type: 'alliance'; factionId: number }
    | { type: 'tribute'; factionId: number }
    | { type: 'gift-beauty'; factionId: number }
    | { type: 'plant-female'; factionId: number }
    | { type: 'establish-hegemony' }
    | { type: 'false-decree'; factionId: number }
    | null
  >(null);

  const familyCount = useMemo(() => {
    if (!game) return 0;
    return Object.values(game.females).filter((f) => f.factionId === game.playerFactionId)
      .length;
  }, [game]);

  const armyCount = useMemo(() => {
    if (!game) return 0;
    return game.campaignArmies.filter((a) => a.factionId === game.playerFactionId).length;
  }, [game]);

  const beautyStock = game?.factions[game.playerFactionId]?.beautyStock ?? 0;

  if (!game) return null;

  const playerCities = Object.values(game.cities).filter(
    (c) => c.ruler === game.playerFactionId,
  );
  const selected = selectedCityId != null ? game.cities[selectedCityId] : null;
  const isPlayerCity = selected != null && selected.ruler === game.playerFactionId;

  const toggle = (k: AccordionKey) => {
    clearError();
    setOpen((prev) => (prev === k ? null : k));
  };

  return (
    <aside
      className="w-60 shrink-0 border-r border-amber-900/40 bg-stone-950/95 flex flex-col text-xs overflow-hidden"
      data-testid="left-panel"
    >
      <div className="px-3 py-2 border-b border-stone-800 text-amber-500/90 font-semibold tracking-wide">
        政务
      </div>

      <div className="px-2 py-1.5 text-[10px] text-stone-500 border-b border-stone-900 leading-snug">
        {isPlayerCity
          ? `当前城：${selected!.name}（内政请用右侧）`
          : selected
            ? `已选：${selected.name}`
            : '先选己方城，再在右侧做内政/军事'}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <AccSection
          title="战役"
          badge={armyCount}
          accent="military"
          open={open === 'campaign'}
          onToggle={() => toggle('campaign')}
        >
          <CampaignPanel />
        </AccSection>

        <AccSection
          title="谍报"
          accent="intel"
          open={open === 'intel'}
          onToggle={() => toggle('intel')}
        >
          <SpyPanel />
        </AccSection>

        <AccSection
          title="计谋"
          accent="intel"
          open={open === 'plot'}
          onToggle={() => toggle('plot')}
        >
          <PlotPanel />
        </AccSection>

        <AccSection
          title="总军师"
          accent="military"
          open={open === 'strategist'}
          onToggle={() => toggle('strategist')}
        >
          <div className="px-2 py-1">
            <GrandStrategistPanel />
          </div>
        </AccSection>

        <AccSection
          title="家族"
          badge={familyCount}
          accent="personnel"
          open={open === 'family'}
          onToggle={() => toggle('family')}
        >
          <FamilyPanel />
        </AccSection>

        <AccSection
          title="人事"
          badge={beautyStock > 0 ? `美${beautyStock}` : undefined}
          accent="personnel"
          open={open === 'personnel'}
          onToggle={() => toggle('personnel')}
        >
          <div className="px-3 py-1 text-[10px] text-rose-400/80 font-medium">
            武将名册
          </div>
          <OfficerRosterPanel />
          <div className="border-t border-stone-800 mt-0.5 pt-0.5">
            <div className="px-3 py-1 text-[10px] text-rose-400/80 font-medium">
              搜索与登用
            </div>
          <PersonnelPanel />
          </div>
          <div className="border-t border-stone-800 mt-0.5 pt-0.5">
            <div className="px-3 py-1 text-[10px] text-rose-400/80 font-medium">
              任命
            </div>
            <AppointPanel />
          </div>
          <div className="border-t border-stone-800 mt-0.5 pt-0.5">
            <div className="px-3 py-1 text-[10px] text-rose-400/80 font-medium">
              美女资源
            </div>
            <BeautyPanel />
          </div>
        </AccSection>

        <AccSection
          title="外交"
          accent="civil"
          open={open === 'diplomacy'}
          onToggle={() => toggle('diplomacy')}
        >
          <p className="px-3 py-1 text-[10px] text-stone-600 leading-snug">
            进贡抬友好；<strong className="text-rose-400/80">献美</strong>
            耗美女库存+友好；献美后可<strong className="text-pink-400/80">点化</strong>
            为女间谍；友好≥30 可结盟。库存 {beautyStock}。
          </p>
          <div className="px-2 space-y-1.5 pb-1">
            {Object.values(game.factions)
              .filter((f) => f.id !== game.playerFactionId && f.isAlive)
              .map((f) => {
                const link = findDiplomacy(
                  game.diplomacy,
                  game.playerFactionId,
                  f.id,
                );
                const rel = (link?.relation as string) ?? 'neutral';
                const fav = link?.favorability ?? 0;
                const atWar = rel === 'war';
                const plantable =
                  game.intel?.plantableBeauty?.[f.id] ?? 0;
                const allianceEligible = !atWar && rel !== 'allied' && fav >= 30;
                const alliance =
                  allianceEligible
                    ? calculateAllianceChance(game, f.id)
                    : null;
                const allianceDisabledReason =
                  rel === 'allied'
                    ? '已同盟'
                    : atWar
                      ? '交战中不可结盟'
                      : fav < 30
                        ? `友好不足（需≥30，当前${fav}）`
                        : null;
                return (
                  <div
                    key={f.id}
                    className="rounded border border-stone-800 bg-stone-900/60 px-2 py-1.5"
                    data-testid={`dip-faction-${f.id}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-stone-200 font-medium">{f.name}</span>
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: f.color }}
                      />
                    </div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      {REL_LABEL[rel] ?? rel} · 友好 {fav}
                      {alliance
                        ? ` · 结盟率 ${Math.round(alliance.chance)}%`
                        : ''}
                      {plantable > 0 ? ` · 可点化${plantable}` : ''}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <button
                        type="button"
                        disabled={loading}
                        className="flex-1 min-w-[3.5rem] px-1.5 py-1 rounded border border-amber-900/60 text-[10px] text-amber-100 hover:bg-amber-950 disabled:opacity-40"
                        title="200金，友好+15"
                        onClick={() => setConfirm({ type: 'tribute', factionId: f.id })}
                      >
                        进贡
                      </button>
                      <button
                        type="button"
                        data-testid={`btn-gift-beauty-${f.id}`}
                        disabled={loading || beautyStock < 1 || atWar}
                        className="flex-1 min-w-[3.5rem] px-1.5 py-1 rounded border border-rose-900/60 text-[10px] text-rose-100 hover:bg-rose-950 disabled:opacity-40"
                        title="献美×1：友好+12，需美女库存≥1"
                        onClick={() => setConfirm({ type: 'gift-beauty', factionId: f.id })}
                      >
                        献美
                      </button>
                      <button
                        type="button"
                        data-testid={`btn-plant-female-${f.id}`}
                        disabled={loading || plantable < 1}
                        className="flex-1 min-w-[3.5rem] px-1.5 py-1 rounded border border-pink-900/60 text-[10px] text-pink-100 hover:bg-pink-950 disabled:opacity-40"
                        title="点化女间谍：需先献美，耗金80"
                        onClick={() => setConfirm({ type: 'plant-female', factionId: f.id })}
                      >
                        点化
                      </button>
                      <button
                        type="button"
                        disabled={loading || allianceDisabledReason != null}
                        className="flex-1 min-w-[3.5rem] px-1.5 py-1 rounded border border-sky-900/60 text-[10px] text-sky-100 hover:bg-sky-950 disabled:opacity-40"
                        title={
                          allianceEligible && alliance
                            ? `500金，友好≥30；使者魅力${alliance.envoyCharisma}，成功率${Math.round(alliance.chance)}%`
                            : allianceDisabledReason ?? '500金，友好≥30'
                        }
                        onClick={() => setConfirm({ type: 'alliance', factionId: f.id })}
                      >
                        {rel === 'allied' ? '已同盟' : '结盟'}
                        {allianceDisabledReason && rel !== 'allied' ? (
                          <span className="block text-[9px] text-stone-500">
                            {allianceDisabledReason}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </AccSection>

        <AccSection
          title="君主"
          open={open === 'monarch'}
          onToggle={() => toggle('monarch')}
        >
          {(() => {
            if (!game) return null;
            const fid = game.playerFactionId;
            const faction = game.factions[fid];
            if (!faction) return null;
            const ruler = game.officers[faction.rulerId];
            const stage = faction.politicalStage ?? 'vassal';
            const controlsHan = controlsEmperor(game, fid);
            const authority = faction.imperialAuthority ?? 0;
            const decreeCooldown = faction.imperialDecreeCooldown ?? 0;
            const decreeReason =
              stage === 'vassal'
                ? '需先开霸府'
                : authority < 40
                  ? `皇权不足（需40，当前${authority}）`
                  : decreeCooldown > 0
                    ? `冷却中（剩余${decreeCooldown}季）`
                    : null;
            return (
              <div className="px-2 py-1 space-y-1">
                {ruler && (
                  <div className="text-[11px] text-stone-400">
                    {ruler.name}
                    {faction.politicalTitle ? <span className="ml-1 text-amber-300">· {faction.politicalTitle}</span> : null}
                  </div>
                )}
                {stage === 'vassal' && controlsHan && (
                  <MenuBtn
                    label="开霸府"
                    hint="迎奉天子·自立丞相"
                    disabled={loading}
                    onClick={() => setConfirm({ type: 'establish-hegemony' })}
                  />
                )}
                {stage === 'vassal' && !controlsHan && (
                  <div className="text-[10px] text-stone-600 px-2">未控制汉献帝（需占领汉帝所在城池）</div>
                )}
                {stage !== 'vassal' && (
                  <>
                    <div className="text-[10px] text-stone-500 px-2">
                      皇权 {authority}/100 · 伪诏冷却 {decreeCooldown > 0 ? `${decreeCooldown}季` : '就绪'}
                    </div>
                    <div className="px-2 pt-1 space-y-1">
                      {Object.values(game.factions)
                        .filter((target) => target.id !== fid && target.isAlive)
                        .map((target) => {
                          const relation = findDiplomacy(game.diplomacy, fid, target.id)?.relation as string | undefined;
                          const reason = relation === 'war' ? '已交战' : decreeReason;
                          return (
                            <button
                              key={target.id}
                              type="button"
                              data-testid={`btn-false-decree-${target.id}`}
                              disabled={loading || reason != null}
                              title={reason ?? `消耗40皇权，对${target.name}直接宣战；冷却8季`}
                              onClick={() => setConfirm({ type: 'false-decree', factionId: target.id })}
                              className="w-full rounded border border-red-900/60 px-2 py-1 text-left text-[10px] text-red-200 hover:bg-red-950/50 disabled:text-stone-600 disabled:opacity-60"
                            >
                              伪诏宣战 · {target.name}
                              {reason ? <span className="ml-1 text-stone-600">（{reason}）</span> : null}
                            </button>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </AccSection>

        <AccSection
          title="己方城池"
          badge={playerCities.length}
          accent="civil"
          open={open === 'cities'}
          onToggle={() => toggle('cities')}
        >
          <div className="px-2 flex flex-col gap-0.5 max-h-56 overflow-y-auto">
            {playerCities.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`text-left px-2 py-1.5 rounded border text-[11px] ${
                  c.id === selectedCityId
                    ? 'border-amber-500 bg-amber-950 text-amber-100'
                    : 'border-stone-800 bg-stone-900/80 text-stone-300 hover:border-emerald-800'
                }`}
                onClick={() => {
                  selectCity(c.id);
                  focusMapOnCity(c.id);
                }}
              >
                {c.name}
                <span className="text-stone-500 ml-1">
                  农{c.stats.farm} 兵{c.troops}
                </span>
              </button>
            ))}
          </div>
        </AccSection>
      </div>
      <CommandConfirmDialog
        open={
          confirm?.type === 'tribute' ||
          confirm?.type === 'gift-beauty' ||
          confirm?.type === 'plant-female'
        }
        category={confirm?.type === 'plant-female' ? '谍报' : '外交'}
        command={
          confirm?.type === 'tribute'
            ? '进贡'
            : confirm?.type === 'gift-beauty'
              ? '献美'
              : '点化女间谍'
        }
        summary={
          confirm?.type === 'tribute'
            ? '将立即支付金钱以改善双方关系。'
            : confirm?.type === 'gift-beauty'
              ? '将永久转移一份美女库存给目标势力。'
              : '将消耗献美积累的点化额度与目标美女库存，生成一名女间谍。'
        }
        items={
          confirm &&
          (confirm.type === 'tribute' ||
            confirm.type === 'gift-beauty' ||
            confirm.type === 'plant-female')
            ? [
                { label: '目标势力', value: game.factions[confirm.factionId]?.name ?? '—' },
                {
                  label: '立即消耗',
                  value:
                    confirm.type === 'tribute'
                      ? '金 200'
                      : confirm.type === 'gift-beauty'
                        ? '美女库存 1'
                        : '金 80、点化额度 1、目标美女库存 1',
                  tone: 'warning',
                },
                {
                  label: '主要效果',
                  value:
                    confirm.type === 'tribute'
                      ? '友好 +15（霸府阶段按外交加成修正）'
                      : confirm.type === 'gift-beauty'
                        ? '友好 +12（霸府阶段按外交加成修正），获得点化额度 1'
                        : '生成女间谍并进入己方谍报体系',
                },
              ]
            : []
        }
        loading={loading}
        error={error}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm || confirm.type === 'alliance' || confirm.type === 'establish-hegemony' || confirm.type === 'false-decree') return;
          if (confirm.type === 'tribute') await tribute(confirm.factionId);
          if (confirm.type === 'gift-beauty') await giftBeautyDip(confirm.factionId, 1);
          if (confirm.type === 'plant-female') await plantFemale(confirm.factionId);
          if (!useGameStore.getState().error) setConfirm(null);
        }}
      />
      <CommandConfirmDialog
        open={confirm?.type === 'alliance'}
        category="外交"
        command="缔结盟约"
        summary="结盟交涉无论成败都会立即消耗金钱，并消费一次外交判定。"
        items={confirm?.type === 'alliance' ? (() => {
          const target = game.factions[confirm.factionId];
          const chance = calculateAllianceChance(game, confirm.factionId);
          return [
            { label: '目标势力', value: target?.name ?? '—' },
            { label: '立即消耗', value: '金 500', tone: 'warning' as const },
            { label: '成功率', value: `${Math.round(chance.chance)}%` },
            { label: '成功后果', value: '双方关系变为同盟，共享部分城池情报' },
            { label: '失败后果', value: '金钱不返还' },
          ];
        })() : []}
        loading={loading}
        error={error}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.type !== 'alliance') return;
          await formAlliance(confirm.factionId);
          if (!useGameStore.getState().error) setConfirm(null);
        }}
      />
      <CommandConfirmDialog
        open={confirm?.type === 'establish-hegemony'}
        category="朝廷"
        command="开霸府"
        summary="开霸府后政治阶段永久改变，当前版本不可撤销。确认迎奉天子、自领丞相？"
        items={[
          { label: '政治阶段', value: '诸侯 → 霸府', tone: 'warning' },
          { label: '政治头衔', value: '丞相' },
          { label: '皇权', value: '获得初始皇权 100' },
          { label: '解锁', value: '霸府官职、伪诏宣战、外交加成' },
          { label: '可否撤销', value: '不可撤销', tone: 'warning' },
        ]}
        loading={loading}
        danger
        error={error}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.type !== 'establish-hegemony') return;
          await establishHegemony();
          if (!useGameStore.getState().error) setConfirm(null);
        }}
      />
      <CommandConfirmDialog
        open={confirm?.type === 'false-decree'}
        category="朝廷"
        command="伪诏宣战"
        summary="将绕过常规外交前置，立即与目标势力进入战争状态。"
        items={confirm?.type === 'false-decree' ? [
          { label: '目标势力', value: game.factions[confirm.factionId]?.name ?? '—' },
          { label: '立即消耗', value: '皇权 40', tone: 'warning' },
          { label: '外交后果', value: '双方关系立即变为战争', tone: 'warning' },
          { label: '冷却', value: '8 季' },
          { label: '额外风险', value: '若目标匡扶汉室，声望 −30' },
        ] : []}
        loading={loading}
        danger
        error={error}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.type !== 'false-decree') return;
          await falseDecreeWar(confirm.factionId);
          if (!useGameStore.getState().error) setConfirm(null);
        }}
      />
    </aside>
  );
}

function MenuBtn({
  label,
  hint,
  disabled,
  onClick,
  emphasize,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick?: () => void;
  emphasize?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 border-b border-stone-900/80 ${
        disabled
          ? 'text-stone-600 cursor-not-allowed'
          : emphasize
            ? 'text-amber-200 hover:bg-amber-950/40'
            : 'text-stone-300 hover:bg-stone-900'
      }`}
      title={hint}
    >
      {label}
      {hint && <span className="text-stone-600 ml-1 text-[10px]">{hint}</span>}
    </button>
  );
}
