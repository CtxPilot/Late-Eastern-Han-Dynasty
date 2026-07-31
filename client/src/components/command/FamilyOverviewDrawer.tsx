// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import {
  MaritalStatus,
  OfficerStatus,
  panelStatsDisplay,
  type GameState,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';

export type FamilyChildEntry = {
  childId: number;
  childName: string;
  fatherId: number;
  motherId: number;
  birthYear: number;
  appearYear: number;
  source: string;
};

export type FamilyOverview = ReturnType<typeof buildFamilyOverview>;

export type MarriageDraft = {
  femaleId: number | null;
  officerId: number | null;
};

function isMarriageAvailable(status: MaritalStatus | string): boolean {
  return status === MaritalStatus.SINGLE
    || status === MaritalStatus.WIDOW
    || status === 'single'
    || status === 'widow';
}

export function buildFamilyOverview(
  game: GameState,
  childrenCatalog: readonly FamilyChildEntry[],
) {
  const factionId = game.playerFactionId;
  const females = Object.values(game.females)
    .filter((female) => female.factionId === factionId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const officers = Object.values(game.officers)
    .filter((officer) => officer.faction === factionId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const enabledIds = new Set(game.enabledChildEventIds);
  const enabledChildren = childrenCatalog.filter((child) => enabledIds.has(child.childId));
  const branches = officers.map((officer) => {
    const wives = females.filter(
      (female) => female.husbandId === officer.id || officer.wifeId === female.id,
    );
    const attendants = females.filter(
      (female) => female.giftedToOfficerId === officer.id && female.husbandId !== officer.id,
    );
    const children = enabledChildren
      .filter((child) =>
        child.fatherId === officer.id || wives.some((wife) => wife.id === child.motherId))
      .map((child) => {
        const live = game.officers[child.childId];
        return {
          ...child,
          status: live
            ? live.faction === factionId
              ? '已登场·本势力'
              : live.faction == null
                ? '已登场·在野'
                : '已登场·他势力'
            : '待登场',
        };
      });
    return {
      officerId: officer.id,
      officerName: officer.name,
      loyalty: officer.loyalty,
      war: panelStatsDisplay(officer.stats).war,
      wives: wives.map((wife) => ({ id: wife.id, name: wife.name, canCommand: wife.canCommand })),
      attendants: attendants.map((attendant) => ({
        id: attendant.id,
        name: attendant.name,
        canCommand: attendant.canCommand,
      })),
      children,
    };
  }).filter(
    (branch) => branch.wives.length > 0
      || branch.attendants.length > 0
      || branch.children.length > 0,
  );
  const ruler = game.officers[game.factions[factionId]?.rulerId];
  const freeOfficers = Object.values(game.officers)
    .filter((officer) => officer.faction == null && officer.status === OfficerStatus.FREE)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    .map((officer) => {
      const compatibilityDiff = ruler
        ? Math.abs(officer.hidden.compatibility - ruler.hidden.compatibility)
        : null;
      const sameBenevolence = ruler != null
        && officer.hidden.ideal === ruler.hidden.ideal
        && officer.hidden.ideal === 'benevolence';
      const kinInFaction = (officer.hidden.bloodline ?? []).some(
        (id) => game.officers[id]?.faction === factionId,
      );
      return {
        id: officer.id,
        name: officer.name,
        location: officer.location == null ? '未知' : game.cities[officer.location]?.name ?? '未知',
        compatibility: officer.hidden.compatibility,
        compatibilityDiff,
        sameBenevolence,
        kinInFaction,
        hasTrigger: (compatibilityDiff != null && compatibilityDiff < 20)
          || sameBenevolence
          || kinInFaction,
      };
    });
  const marriageFemales = females.filter(
    (female) => isMarriageAvailable(female.status) && female.husbandId == null,
  );
  const marriageOfficers = officers.filter(
    (officer) => officer.wifeId == null || !game.females[officer.wifeId],
  );

  return {
    females: females.map((female) => ({
      id: female.id,
      name: female.name,
      clanName: female.clanName,
      role: female.canCommand
        ? '祝融特例·可出战'
        : female.husbandId != null
          ? `正室·${game.officers[female.husbandId]?.name ?? female.husbandId}`
          : female.giftedToOfficerId != null
            ? `随侍·${game.officers[female.giftedToOfficerId]?.name ?? female.giftedToOfficerId}`
          : String(female.status) === 'widow'
            ? '寡居'
            : '待字',
      city: game.cities[female.locationId]?.name ?? '—',
    })),
    branches,
    enabledChildCount: enabledChildren.length,
    appearedChildCount: enabledChildren.filter((child) => game.officers[child.childId]).length,
    marriageFemales: marriageFemales.map((female) => ({ id: female.id, name: female.name })),
    marriageOfficers: marriageOfficers.map((officer) => ({ id: officer.id, name: officer.name })),
    freeOfficers,
  };
}

export function validateMarriageDraft(game: GameState | null, draft: MarriageDraft): string | null {
  if (!game || draft.femaleId == null || draft.officerId == null) {
    return '请选择女角与夫君。';
  }
  const female = game.females[draft.femaleId];
  const officer = game.officers[draft.officerId];
  if (!female || female.factionId !== game.playerFactionId) return '女角已不属于本势力。';
  if (!isMarriageAvailable(female.status) || female.husbandId != null) return '女角婚姻状态已经变化。';
  if (
    female.giftedToOfficerId != null
    && female.giftedToOfficerId !== draft.officerId
  ) return '女角已随侍其他武将，不能直接婚配。';
  if (!officer || officer.faction !== game.playerFactionId) return '目标武将已不属于本势力。';
  if (officer.wifeId != null && game.females[officer.wifeId]) return '目标武将已有正妻。';
  const canPay = Object.values(game.cities).some(
    (city) => city.ruler === game.playerFactionId && city.gold >= 300,
  );
  return canPay ? null : '没有己方城池能够支付婚配所需金300。';
}

export function validateFollowCheck(game: GameState | null): string | null {
  if (!game) return '当前剧本状态已失效。';
  const hasFreeOfficer = Object.values(game.officers).some(
    (officer) => officer.faction == null && officer.status === OfficerStatus.FREE,
  );
  return hasFreeOfficer ? null : '当前没有可检定的在野武将。';
}

type FamilyFacet = 'overview' | 'kinship' | 'marriage' | 'follow';

const FACETS: readonly { id: FamilyFacet; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'kinship', label: '姻亲' },
  { id: 'marriage', label: '婚配' },
  { id: 'follow', label: '跟随' },
];

export function FamilyOverviewDrawer() {
  const game = useGameStore((state) => state.game);
  const childrenCatalog = useGameStore((state) => state.childrenCatalog);
  const marry = useGameStore((state) => state.marry);
  const followCheck = useGameStore((state) => state.followCheck);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const [facet, setFacet] = useState<FamilyFacet>('overview');
  const [marriageDraft, setMarriageDraft] = useState<MarriageDraft>({
    femaleId: null,
    officerId: null,
  });
  const [confirm, setConfirm] = useState<'marriage' | 'follow' | null>(null);
  const overview = useMemo(
    () => game ? buildFamilyOverview(game, childrenCatalog) : null,
    [game, childrenCatalog],
  );

  if (!game || !overview) return <p data-testid="command-family-empty">尚未载入剧本。</p>;

  return (
    <div
      className="flex h-[min(34rem,calc(100vh-12rem))] min-h-0 flex-1 flex-col"
      data-testid="command-family-drawer"
    >
      <nav className="mb-3 grid grid-cols-4 gap-1" aria-label="家族分面">
        {FACETS.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`command-family-facet-${item.id}`}
            aria-current={facet === item.id ? 'page' : undefined}
            onClick={() => setFacet(item.id)}
            className={`border py-1.5 ${
              facet === item.id
                ? 'border-amber-700 bg-amber-950/35 text-amber-100'
                : 'border-stone-800 text-stone-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <p className="mb-3 text-[10px] leading-relaxed text-stone-500">
        S18 家族总署：婚配与手动跟随均在此配置，并经统一终审后提交。
      </p>

      <section
        className="min-h-0 space-y-2 overflow-y-auto"
        data-testid={`command-family-panel-${facet}`}
      >
        {facet === 'overview' ? (
          <>
            <Fact label="历史女角" value={overview.females.length} testId="command-family-female-count" />
            <Fact label="姻亲支" value={overview.branches.length} />
            <Fact
              label="固定子女"
              value={`${overview.appearedChildCount}/${overview.enabledChildCount} 已登场`}
            />
            <Fact label="在野候选" value={overview.freeOfficers.length} />
            <div className="space-y-1 pt-1">
              {overview.females.map((female) => (
                <div key={female.id} className="border border-stone-800 px-3 py-2">
                  <strong className="text-stone-200">{female.name}</strong>
                  <span className="ml-1 text-stone-600">{female.clanName}氏</span>
                  <p className="text-[10px] text-stone-500">{female.role} · {female.city}</p>
                </div>
              ))}
            </div>
          </>
        ) : facet === 'kinship' ? (
          overview.branches.length > 0 ? overview.branches.map((branch) => (
            <div
              key={branch.officerId}
              className="border border-stone-800 px-3 py-2"
              data-testid={`command-family-branch-${branch.officerId}`}
            >
              <strong className="text-amber-200">{branch.officerName}</strong>
              <span className="ml-2 text-[10px] text-stone-500">
                武{branch.war} 忠{branch.loyalty}
              </span>
              {branch.wives.map((wife) => (
                <p key={wife.id} className="pl-2 text-[10px] text-stone-400">
                  └ 妻 {wife.name}{wife.canCommand ? '（可出战）' : ''}
                </p>
              ))}
              {branch.attendants.map((attendant) => (
                <p key={attendant.id} className="pl-2 text-[10px] text-stone-400">
                  └ 随侍 {attendant.name}{attendant.canCommand ? '（可出战）' : ''}
                </p>
              ))}
              {branch.children.map((child) => (
                <p key={child.childId} className="pl-2 text-[10px] text-stone-500">
                  └ 子 {child.childName} · {child.appearYear}登场 · {child.status}
                </p>
              ))}
            </div>
          )) : <Empty>尚无姻亲支。</Empty>
        ) : facet === 'marriage' ? (
          <>
            <Fact
              label="可婚配女角"
              value={overview.marriageFemales.length}
              testId="command-family-marriage-female-count"
            />
            <Fact label="无正妻武将" value={overview.marriageOfficers.length} />
            <div className="border border-stone-800 px-3 py-2">
              <strong className="text-stone-300">女角候选</strong>
              <p className="mt-1 text-[10px] text-stone-500">
                {overview.marriageFemales.map((female) => female.name).join('、') || '无'}
              </p>
            </div>
            <div className="border border-stone-800 px-3 py-2">
              <strong className="text-stone-300">武将候选</strong>
              <p className="mt-1 text-[10px] text-stone-500">
                {overview.marriageOfficers.map((officer) => officer.name).join('、') || '无'}
              </p>
            </div>
            <select
              className="w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
              value={marriageDraft.femaleId ?? ''}
              data-testid="command-family-female-select"
              onChange={(event) => setMarriageDraft((draft) => ({
                ...draft,
                femaleId: event.target.value ? Number(event.target.value) : null,
              }))}
            >
              <option value="">选择女角…</option>
              {overview.marriageFemales.map((female) => (
                <option key={female.id} value={female.id}>{female.name}</option>
              ))}
            </select>
            <select
              className="w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
              value={marriageDraft.officerId ?? ''}
              data-testid="command-family-officer-select"
              onChange={(event) => setMarriageDraft((draft) => ({
                ...draft,
                officerId: event.target.value ? Number(event.target.value) : null,
              }))}
            >
              <option value="">选择夫君…</option>
              {overview.marriageOfficers.map((officer) => (
                <option key={officer.id} value={officer.id}>{officer.name}</option>
              ))}
            </select>
            <button
              type="button"
              data-testid="command-family-marry"
              data-command-write="true"
              disabled={loading || validateMarriageDraft(game, marriageDraft) != null}
              title={validateMarriageDraft(game, marriageDraft) ?? '送交婚配重大终审'}
              className="w-full rounded border border-amber-700 bg-amber-950 px-3 py-2 text-amber-100 disabled:opacity-40"
              onClick={() => setConfirm('marriage')}
            >
              赐婚 / 婚配 · 送交终审
            </button>
          </>
        ) : (
          <>
            <Fact label="在野武将" value={overview.freeOfficers.length} />
            {overview.freeOfficers.length > 0 ? overview.freeOfficers.map((officer) => (
              <div key={officer.id} className="border border-stone-800 px-3 py-2">
                <strong className="text-stone-200">{officer.name}</strong>
                <span className="ml-2 text-[10px] text-stone-600">{officer.location}</span>
                <p className="text-[10px] text-stone-500">
                  相性{officer.compatibility}
                  {officer.compatibilityDiff != null ? ` · 与君主差${officer.compatibilityDiff}` : ''}
                  {officer.sameBenevolence ? ' · 仁德理想一致' : ''}
                  {officer.kinInFaction ? ' · 血亲在势力' : ''}
                </p>
                <p className={`text-[10px] ${officer.hasTrigger ? 'text-emerald-500' : 'text-stone-600'}`}>
                  {officer.hasTrigger ? '具备一项投奔触发条件；仍须满足邻接并由权威 RNG 判定' : '暂无已知投奔触发条件'}
                </p>
              </div>
            )) : <Empty>当前没有在野武将。</Empty>}
            <Empty>月度检查仍自动发生；手动检查会消费权威 RNG，且可能无人投奔。</Empty>
            <button
              type="button"
              data-testid="command-family-follow-check"
              data-command-write="true"
              disabled={loading || validateFollowCheck(game) != null}
              title={validateFollowCheck(game) ?? '送交手动跟随终审'}
              className="w-full rounded border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-emerald-100 disabled:opacity-40"
              onClick={() => setConfirm('follow')}
            >
              手动跟随检查 · 送交终审
            </button>
          </>
        )}
      </section>
      <CommandConfirmDialog
        open={confirm === 'marriage'}
        category="家族"
        command={`确认婚配：${
          marriageDraft.femaleId != null ? game.females[marriageDraft.femaleId]?.name ?? '未选女角' : '未选女角'
        } × ${
          marriageDraft.officerId != null ? game.officers[marriageDraft.officerId]?.name ?? '未选武将' : '未选武将'
        }`}
        summary="婚配会立即建立正妻关系；若女角原为该武将随侍，将转为正妻。当前版本不能撤销。"
        items={[
          { label: '立即消耗', value: '金 300', tone: 'warning' },
          { label: '主要收益', value: '武将忠诚 +18，建立姻亲支' },
          { label: '随迁语义', value: '正妻与随侍均随所系武将迁移' },
          { label: '可否撤销', value: '当前版本不可撤销', tone: 'warning' },
        ]}
        loading={loading}
        danger
        error={error}
        validateBeforeConfirm={() =>
          validateMarriageDraft(useGameStore.getState().game, marriageDraft)}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (marriageDraft.femaleId == null || marriageDraft.officerId == null) return;
          await marry(marriageDraft.femaleId, marriageDraft.officerId);
          if (!useGameStore.getState().error) {
            setConfirm(null);
            setMarriageDraft({ femaleId: null, officerId: null });
          }
        }}
      />
      <CommandConfirmDialog
        open={confirm === 'follow'}
        category="家族"
        command="确认手动跟随检查"
        summary="立即对全体在野武将执行一次投奔检定；结果可能无人投奔。"
        items={[
          { label: '检定对象', value: `${overview.freeOfficers.length} 名在野武将` },
          { label: '已知条件', value: '相性、仁德理想、血亲及邻接' },
          { label: '随机性', value: '消费权威 RNG，取消终审不消费', tone: 'warning' },
          { label: '家眷迁移', value: '投奔者的正妻与随侍一并随迁' },
        ]}
        loading={loading}
        error={error}
        validateBeforeConfirm={() => validateFollowCheck(useGameStore.getState().game)}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await followCheck();
          if (!useGameStore.getState().error) setConfirm(null);
        }}
      />
    </div>
  );
}

function Fact({
  label,
  value,
  testId,
}: {
  label: string;
  value: string | number;
  testId?: string;
}) {
  return (
    <div className="flex justify-between border-b border-stone-800 px-2 py-1.5">
      <span className="text-stone-500">{label}</span>
      <strong className="text-stone-200" data-testid={testId}>{value}</strong>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border border-stone-800 px-3 py-2 text-stone-600">{children}</p>;
}
