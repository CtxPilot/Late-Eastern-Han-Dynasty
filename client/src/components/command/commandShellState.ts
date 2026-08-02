// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

export const COMMAND_DOMAINS = [
  'civil',
  'military',
  'personnel',
  'diplomacy',
  'strategy',
  'intel',
  'farming',
  'family',
  'court',
  'faction',
] as const;

export type CommandDomain = (typeof COMMAND_DOMAINS)[number];

export type CommandDraft = {
  commandId: string;
  parameters: Readonly<Record<string, unknown>>;
};

export type CommandShellState = {
  activeDomain: CommandDomain | null;
  activeCommand: string | null;
  draftByDomain: Partial<Record<CommandDomain, CommandDraft>>;
};

export const INITIAL_COMMAND_SHELL_STATE: CommandShellState = {
  activeDomain: null,
  activeCommand: null,
  draftByDomain: {},
};

export type CommandShellAction =
  | { type: 'toggle-domain'; domain: CommandDomain }
  | { type: 'close-drawer' }
  | { type: 'select-command'; domain: CommandDomain; commandId: string; parameters?: Readonly<Record<string, unknown>> }
  | { type: 'update-draft'; domain: CommandDomain; parameters: Readonly<Record<string, unknown>> }
  | { type: 'clear-draft'; domain: CommandDomain }
  | { type: 'submit-succeeded'; domain: CommandDomain }
  | { type: 'reset' };

function withoutDomainDraft(
  drafts: CommandShellState['draftByDomain'],
  domain: CommandDomain,
): CommandShellState['draftByDomain'] {
  const next = { ...drafts };
  delete next[domain];
  return next;
}

export function commandShellReducer(
  state: CommandShellState,
  action: CommandShellAction,
): CommandShellState {
  switch (action.type) {
    case 'toggle-domain': {
      if (state.activeDomain === action.domain) {
        return {
          activeDomain: null,
          activeCommand: null,
          draftByDomain: withoutDomainDraft(state.draftByDomain, action.domain),
        };
      }
      return {
        activeDomain: action.domain,
        activeCommand: null,
        draftByDomain: state.activeDomain
          ? withoutDomainDraft(state.draftByDomain, state.activeDomain)
          : state.draftByDomain,
      };
    }
    case 'close-drawer':
      return {
        activeDomain: null,
        activeCommand: null,
        draftByDomain: state.activeDomain
          ? withoutDomainDraft(state.draftByDomain, state.activeDomain)
          : state.draftByDomain,
      };
    case 'select-command':
      return {
        ...state,
        activeDomain: action.domain,
        activeCommand: action.commandId,
        draftByDomain: {
          ...state.draftByDomain,
          [action.domain]: {
            commandId: action.commandId,
            parameters: action.parameters ?? {},
          },
        },
      };
    case 'update-draft': {
      const draft = state.draftByDomain[action.domain];
      if (!draft) return state;
      return {
        ...state,
        draftByDomain: {
          ...state.draftByDomain,
          [action.domain]: {
            ...draft,
            parameters: { ...draft.parameters, ...action.parameters },
          },
        },
      };
    }
    case 'clear-draft':
    case 'submit-succeeded':
      return {
        ...state,
        activeCommand: state.activeDomain === action.domain ? null : state.activeCommand,
        draftByDomain: withoutDomainDraft(state.draftByDomain, action.domain),
      };
    case 'reset':
      return INITIAL_COMMAND_SHELL_STATE;
  }
}
