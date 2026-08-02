// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useCallback, useReducer, useRef } from 'react';
import { CommandDock, COMMAND_DOCK_ITEMS } from './CommandDock';
import { CommandDrawer } from './CommandDrawer';
import {
  commandShellReducer,
  INITIAL_COMMAND_SHELL_STATE,
  type CommandDomain,
} from './commandShellState';
import { CourtCommandDrawer } from './CourtCommandDrawer';
import { PersonnelRosterDrawer } from './PersonnelRosterDrawer';
import { DiplomacyOverviewDrawer } from './DiplomacyOverviewDrawer';
import { MilitaryOverviewDrawer } from './MilitaryOverviewDrawer';
import { CivilOverviewDrawer } from './CivilOverviewDrawer';
import { StrategyOverviewDrawer } from './StrategyOverviewDrawer';
import { IntelOverviewDrawer } from './IntelOverviewDrawer';
import { FamilyOverviewDrawer } from './FamilyOverviewDrawer';
import { FactionOverviewDrawer } from './FactionOverviewDrawer';

export function CommandShell() {
  const [state, dispatch] = useReducer(commandShellReducer, INITIAL_COMMAND_SHELL_STATE);
  const triggerRefs = useRef<Partial<Record<CommandDomain, HTMLButtonElement | null>>>({});
  const activeItem = COMMAND_DOCK_ITEMS.find((item) => item.domain === state.activeDomain);
  const closeDrawer = useCallback(() => dispatch({ type: 'close-drawer' }), []);

  return (
    <section className="relative shrink-0" data-testid="command-shell">
      {activeItem ? (
        <CommandDrawer
          title={activeItem.label}
          availability={activeItem.availability}
          onClose={closeDrawer}
          triggerElement={triggerRefs.current[activeItem.domain]}
        >
          {activeItem.domain === 'civil' ? (
            <CivilOverviewDrawer />
          ) : activeItem.domain === 'strategy' ? (
            <StrategyOverviewDrawer dispatch={dispatch} />
          ) : activeItem.domain === 'intel' ? (
            <IntelOverviewDrawer shellState={state} />
          ) : activeItem.domain === 'family' ? (
            <FamilyOverviewDrawer />
          ) : activeItem.domain === 'court' ? (
            <CourtCommandDrawer shellState={state} dispatch={dispatch} />
          ) : activeItem.domain === 'personnel' ? (
            <PersonnelRosterDrawer shellState={state} />
          ) : activeItem.domain === 'diplomacy' ? (
            <DiplomacyOverviewDrawer />
          ) : activeItem.domain === 'military' ? (
            <MilitaryOverviewDrawer />
          ) : activeItem.domain === 'faction' ? (
            <FactionOverviewDrawer onClose={closeDrawer} />
          ) : (
            <>
              <p>{activeItem.reason}。</p>
              <p className="mt-2 text-stone-600">
                通用容器已就位；本阶段不复制旧操作，也不提供可提交的占位命令。
              </p>
            </>
          )}
        </CommandDrawer>
      ) : null}
      <div className="overflow-x-auto">
        <CommandDock
          activeDomain={state.activeDomain}
          onDomainToggle={(domain) => dispatch({ type: 'toggle-domain', domain })}
          registerButton={(domain, element) => {
            triggerRefs.current[domain] = element;
          }}
        />
      </div>
    </section>
  );
}
