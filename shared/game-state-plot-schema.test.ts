// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { PlotStage, PlotType } from './enums/index.js';
import { GameStatePlotSchema } from './game-state-plot-schema.js';

function validPlot() {
  return { plots: [{
    id: 'plot-1', type: PlotType.FALSE_INTEL, casterFactionId: 1,
    targetFactionId: 2, targetCityId: 8, stage: PlotStage.PREP,
    monthsLeft: 1, cost: { gold: 120, requiresIntel: 'detailed' as const },
    year: 190, month: 1,
  }] };
}

describe('GameStatePlotSchema', () => {
  it('parses valid preparation, active and resolved plots', () => {
    expect(GameStatePlotSchema.parse(validPlot())).toEqual(validPlot());
    const active = validPlot();
    active.plots[0] = { ...active.plots[0], type: PlotType.EMPTY_FORT, targetFactionId: undefined, stage: PlotStage.ACTIVE, monthsLeft: 2, result: { success: false, detected: true, inverted: true, message: '空城被识破' } };
    expect(() => GameStatePlotSchema.parse(active)).not.toThrow();
    const resolved = validPlot();
    resolved.plots[0] = { ...resolved.plots[0], stage: PlotStage.RESOLVED, monthsLeft: 0, result: { success: true, detected: false, message: '计谋已结算' } };
    expect(() => GameStatePlotSchema.parse(resolved)).not.toThrow();
  });

  it('rejects contradictory stage, countdown and result combinations', () => {
    const prep = validPlot();
    prep.plots[0].result = { success: true, detected: false, message: '过早结果' };
    expect(() => GameStatePlotSchema.parse(prep)).toThrow(/准备期/);
    const resolved = validPlot();
    resolved.plots[0].stage = PlotStage.RESOLVED;
    resolved.plots[0].monthsLeft = 0;
    expect(() => GameStatePlotSchema.parse(resolved)).toThrow(/已结算/);
  });

  it('rejects target shapes that contradict the plot type', () => {
    const discord = validPlot();
    discord.plots[0] = { ...discord.plots[0], type: PlotType.SOW_DISCORD, targetCityId: undefined };
    expect(() => GameStatePlotSchema.parse(discord)).not.toThrow();
    discord.plots[0].targetCityId = 8;
    expect(() => GameStatePlotSchema.parse(discord)).toThrow(/离间计不能指定目标城市/);
    const emptyFort = validPlot();
    emptyFort.plots[0] = { ...emptyFort.plots[0], type: PlotType.EMPTY_FORT, targetFactionId: undefined };
    expect(() => GameStatePlotSchema.parse(emptyFort)).not.toThrow();
    emptyFort.plots[0].targetFactionId = 2;
    expect(() => GameStatePlotSchema.parse(emptyFort)).toThrow(/不能指定目标势力/);
  });

  it('restricts agent, officer and inverted fields to supported plot types', () => {
    const agent = validPlot();
    agent.plots[0].agentId = 'spy-1';
    expect(() => GameStatePlotSchema.parse(agent)).toThrow(/只有美人计/);
    const officer = validPlot();
    officer.plots[0].targetOfficerId = 10;
    expect(() => GameStatePlotSchema.parse(officer)).toThrow(/目标武将/);
    const inverted = validPlot();
    inverted.plots[0] = { ...inverted.plots[0], stage: PlotStage.RESOLVED, monthsLeft: 0, result: { success: false, detected: true, inverted: true, message: '错误反转' } };
    expect(() => GameStatePlotSchema.parse(inverted)).toThrow(/识破反转/);
  });

  it('rejects duplicate IDs, invalid dates, negative costs and transient root fields', () => {
    const duplicate = validPlot();
    duplicate.plots.push({ ...duplicate.plots[0] });
    expect(() => GameStatePlotSchema.parse(duplicate)).toThrow(/不能重复/);
    const invalid = validPlot();
    invalid.plots[0].month = 13;
    invalid.plots[0].cost.gold = -1;
    expect(() => GameStatePlotSchema.parse(invalid)).toThrow();
    expect(() => GameStatePlotSchema.parse({ ...validPlot(), selectedPlotId: 'plot-1' })).toThrow();
  });
});
