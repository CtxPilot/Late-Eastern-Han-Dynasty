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
const battlefield: SceneFrame = { scene: 'battlefield', battlefieldId: 'bf-1' };
const tactical: SceneFrame = { scene: 'tactical', battleId: 'b-1' };

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
});
