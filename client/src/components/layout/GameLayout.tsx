// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { TopBar } from './TopBar';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { StrategicWorldView } from '../strategic/StrategicWorldView';
import { EventDialog } from '../events/EventDialog';
import { FamilyTreatmentDialog } from '../family/FamilyTreatmentDialog';
import { CommandShell } from '../command/CommandShell';
import { FirstTurnGuide } from './FirstTurnGuide';
import { TurnProgressOverlay, MonthReportCard } from './TurnFeedback';

/** P1-06 主三栏布局 + 命令坞；中央为层级卡片战略屏（Session 379 取代 MapCanvas）。 */
export function GameLayout() {
  return (
    <div className="h-full flex flex-col bg-stone-950" data-testid="game-layout">
      <TopBar />
      <div className="flex-1 min-h-0 flex">
        <LeftPanel />
        <main className="flex-1 min-w-0 min-h-0 relative">
          <StrategicWorldView />
        </main>
        <RightPanel />
      </div>
      <CommandShell />
      <EventDialog />
      <FamilyTreatmentDialog />
      {/* 回合反馈与新手指引（P0-2/P0-3 · Session 407） */}
      <FirstTurnGuide />
      <TurnProgressOverlay />
      <MonthReportCard />
    </div>
  );
}
