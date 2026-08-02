// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { TopBar } from './TopBar';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';
import { MapCanvas } from '../map/MapCanvas';
import { EventDialog } from '../events/EventDialog';
import { CommandShell } from '../command/CommandShell';

/** P1-06 主三栏布局 + 命令坞；左右栏只保留只读态势与未迁移的战役/军师入口。 */
export function GameLayout() {
  return (
    <div className="h-full flex flex-col bg-stone-950" data-testid="game-layout">
      <TopBar />
      <div className="flex-1 min-h-0 flex">
        <LeftPanel />
        <main className="flex-1 min-w-0 min-h-0 relative">
          <MapCanvas />
        </main>
        <RightPanel />
      </div>
      <CommandShell />
      <EventDialog />
    </div>
  );
}
