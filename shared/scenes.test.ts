// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  BOOT_SCREEN,
  clearStack,
  popScene,
  popToScene,
  pushScene,
  replaceStack,
  screenOf,
  topScene,
  type SceneFrame,
} from './scenes';

const world: SceneFrame = { scene: 'world' };
const campaign: SceneFrame = { scene: 'campaign', armyId: 'army-1' };
const battlefield: SceneFrame = { scene: 'battlefield', battlefieldId: 'bf-1' };
const tactical: SceneFrame = { scene: 'tactical', battleId: 'b-1' };
const melee: SceneFrame = { scene: 'melee' };
const duel: SceneFrame = { scene: 'duel', encounterId: 'enc-1' };

describe('scene stack — screenOf / topScene', () => {
  it('空栈 → screenOf=boot, topScene=null', () => {
    expect(screenOf([])).toBe(BOOT_SCREEN);
    expect(topScene([])).toBeNull();
  });
  it('单层 world → screenOf=world', () => {
    expect(screenOf([world])).toBe('world');
  });
});

describe('scene stack — pushScene / popScene', () => {
  it('入栈追加 frame，原栈不变', () => {
    const stack = [world];
    const next = pushScene(stack, battlefield);
    expect(next).toEqual([world, battlefield]);
    expect(stack).toEqual([world]);
  });
  it('出栈移除顶层', () => {
    const stack = [world, battlefield];
    expect(popScene(stack)).toEqual([world]);
  });
  it('空栈出栈不变', () => {
    expect(popScene([])).toEqual([]);
  });
});

describe('scene stack — popToScene', () => {
  it('弹到 world 保留 world 及其下层', () => {
    const stack = [world, battlefield, tactical];
    expect(popToScene(stack, 'world')).toEqual([world]);
  });
  it('弹到 battlefield 保留 world+battlefield', () => {
    const stack = [world, battlefield, tactical];
    expect(popToScene(stack, 'battlefield')).toEqual([world, battlefield]);
  });
  it('目标 scene 不在栈中 → 不变', () => {
    const stack = [world, battlefield];
    expect(popToScene(stack, 'duel')).toEqual([world, battlefield]);
  });
  it('多次同 scene 只弹到最近一次', () => {
    const w2: SceneFrame = { scene: 'world' };
    const stack = [world, battlefield, w2, tactical];
    expect(popToScene(stack, 'world')).toEqual([world, battlefield, w2]);
  });
});

describe('scene stack — replaceStack / clearStack', () => {
  it('replaceStack 用单一 frame 替换整个栈', () => {
    expect(replaceStack(world)).toEqual([world]);
  });
  it('clearStack 清空', () => {
    expect(clearStack()).toEqual([]);
  });
});

describe('scene stack — 典型闭环', () => {
  it('world → 入战场 → 接战 → 逐层出栈回 world', () => {
    let stack: SceneFrame[] = replaceStack(world);
    expect(screenOf(stack)).toBe('world');
    stack = pushScene(stack, battlefield);
    expect(screenOf(stack)).toBe('battlefield');
    stack = pushScene(stack, tactical);
    expect(screenOf(stack)).toBe('tactical');
    // 六角接战结束 → 回战场
    stack = popToScene(stack, 'battlefield');
    expect(screenOf(stack)).toBe('battlefield');
    // 退出战场 → 回大地图
    stack = popToScene(stack, 'world');
    expect(screenOf(stack)).toBe('world');
  });

  it('战场退出应允许调用方用 replaceStack 丢弃重复进入留下的脏帧', () => {
    const dirty = [world, battlefield, world, battlefield];
    const reset = replaceStack(world);
    expect(reset).toEqual([world]);
    expect(screenOf(reset)).toBe('world');
    expect(dirty).not.toEqual(reset);
  });

  it('S21 六态栈串联：world → campaign → tactical → melee → duel 逐层推进与出栈回退', () => {
    let stack: SceneFrame[] = replaceStack(world);
    expect(screenOf(stack)).toBe('world');

    // 1. 进入出征/战役大地图
    stack = pushScene(stack, campaign);
    expect(screenOf(stack)).toBe('campaign');

    // 2. 遭遇或亲统强攻进入二级战术六角
    stack = pushScene(stack, tactical);
    expect(screenOf(stack)).toBe('tactical');

    // 3. 邻接交战切入三级白刃战
    stack = pushScene(stack, melee);
    expect(screenOf(stack)).toBe('melee');

    // 4. 将领碰头/主动发起单挑切入四级
    stack = pushScene(stack, duel);
    expect(screenOf(stack)).toBe('duel');

    // 5. 单挑决出胜负回退至白刃战
    stack = popToScene(stack, 'melee');
    expect(screenOf(stack)).toBe('melee');

    // 6. 白刃战结算鸣金回退至二级六角战术
    stack = popToScene(stack, 'tactical');
    expect(screenOf(stack)).toBe('tactical');

    // 7. 六角战斗大胜回退至战役层或大地图
    stack = popToScene(stack, 'campaign');
    expect(screenOf(stack)).toBe('campaign');

    stack = popToScene(stack, 'world');
    expect(screenOf(stack)).toBe('world');
  });
});
