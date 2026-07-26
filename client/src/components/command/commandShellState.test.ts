// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { commandShellReducer, INITIAL_COMMAND_SHELL_STATE } from './commandShellState';

describe('commandShellReducer', () => {
  it('opens and closes a domain without retaining its draft', () => {
    const open = commandShellReducer(INITIAL_COMMAND_SHELL_STATE, {
      type: 'toggle-domain',
      domain: 'court',
    });
    expect(open.activeDomain).toBe('court');

    const drafted = commandShellReducer(open, {
      type: 'select-command',
      domain: 'court',
      commandId: 'false-decree',
      parameters: { targetFactionId: 2 },
    });
    const closed = commandShellReducer(drafted, {
      type: 'toggle-domain',
      domain: 'court',
    });

    expect(closed).toEqual(INITIAL_COMMAND_SHELL_STATE);
  });

  it('clears the previous domain draft when switching domains', () => {
    const drafted = commandShellReducer(
      commandShellReducer(INITIAL_COMMAND_SHELL_STATE, {
        type: 'select-command',
        domain: 'court',
        commandId: 'establish-hegemony',
      }),
      {
        type: 'update-draft',
        domain: 'court',
        parameters: { acknowledged: true },
      },
    );
    const switched = commandShellReducer(drafted, {
      type: 'toggle-domain',
      domain: 'military',
    });

    expect(switched.activeDomain).toBe('military');
    expect(switched.activeCommand).toBeNull();
    expect(switched.draftByDomain.court).toBeUndefined();
  });

  it('merges draft parameters and clears them only after successful submission', () => {
    const selected = commandShellReducer(INITIAL_COMMAND_SHELL_STATE, {
      type: 'select-command',
      domain: 'diplomacy',
      commandId: 'alliance',
      parameters: { targetFactionId: 2 },
    });
    const updated = commandShellReducer(selected, {
      type: 'update-draft',
      domain: 'diplomacy',
      parameters: { envoyId: 7 },
    });

    expect(updated.draftByDomain.diplomacy?.parameters).toEqual({
      targetFactionId: 2,
      envoyId: 7,
    });
    expect(
      commandShellReducer(updated, { type: 'submit-succeeded', domain: 'diplomacy' })
        .draftByDomain.diplomacy,
    ).toBeUndefined();
  });

  it('resets all transient state at a world-session boundary', () => {
    const state = commandShellReducer(INITIAL_COMMAND_SHELL_STATE, {
      type: 'select-command',
      domain: 'personnel',
      commandId: 'appoint',
    });
    expect(commandShellReducer(state, { type: 'reset' })).toBe(INITIAL_COMMAND_SHELL_STATE);
  });
});
