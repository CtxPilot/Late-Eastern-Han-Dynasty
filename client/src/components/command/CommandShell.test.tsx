// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommandDock } from './CommandDock';
import { CommandDrawer } from './CommandDrawer';
import { CommandShell } from './CommandShell';

describe('command shell components', () => {
  it('renders the empty shell with eleven stable domains and no drawer', () => {
    const html = renderToStaticMarkup(<CommandShell />);

    expect(html).toContain('data-testid="command-dock"');
    expect(html).not.toContain('data-testid="command-drawer"');
    expect((html.match(/data-testid="command-domain-/g) ?? [])).toHaveLength(11);
    expect(html).toContain('data-testid="command-domain-delegation"');
    expect(html).toContain('仍在顶部');
  });

  it('renders active-domain expansion semantics', () => {
    const html = renderToStaticMarkup(
      <CommandDock activeDomain="court" onDomainToggle={() => undefined} />,
    );

    expect(html).toContain('data-testid="command-domain-court"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-controls="command-drawer"');
  });

  it('renders the reusable drawer empty state and explicit close control', () => {
    const html = renderToStaticMarkup(
      <CommandDrawer title="朝廷" availability="legacy" onClose={() => undefined}>
        <p>朝廷命令统一从此处下达。</p>
      </CommandDrawer>,
    );

    expect(html).toContain('data-testid="command-drawer"');
    expect(html).toContain('仍在原面板');
    expect(html).toContain('data-testid="command-drawer-close"');
    expect(html).toContain('朝廷命令统一从此处下达');
  });
});
