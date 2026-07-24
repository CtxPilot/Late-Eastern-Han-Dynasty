// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 场景栈纯函数（`docs/21-battlefield-scene-design.md` §6.5 已批准方案）
 *
 * 不新增浏览器路由；沿用 Zustand，但升级为明确的场景栈。
 * 场景栈是前端瞬态状态（不进存档）；服务端 GameState 仍是权威。
 *
 * `boot` / 加载错误属于应用壳状态，**不进入游戏场景栈**；
 * 栈为空时 `screenOf` 返回 `'boot'`。
 *
 * 所有操作返回新数组（不可变），便于 Zustand set 与单测。
 */

export type Scene =
  | 'scenario'
  | 'world'
  | 'battlefield'
  | 'melee'
  | 'tactical'
  | 'duel';

/** 应用壳状态（不在 Scene 联合中，仅作为 screenOf 的空栈回退） */
export type Screen = Scene | 'boot';

export interface SceneFrame {
  scene: Scene;
  /** 关联的郡域战场实例 id（scene='battlefield' 时必填） */
  battlefieldId?: string;
  /** 关联的接战 id（scene='tactical'/'duel' 时可填） */
  encounterId?: string;
  /** 关联的六角战斗 id（scene='tactical' 时可填，复用 BattleState.id） */
  battleId?: string;
}

/** 空栈的 screen 回退值 */
export const BOOT_SCREEN: Screen = 'boot';

/** 栈顶 frame；空栈返回 null */
export function topScene(stack: readonly SceneFrame[]): SceneFrame | null {
  return stack.length ? stack[stack.length - 1] : null;
}

/** 栈顶 scene；空栈返回 'boot' */
export function screenOf(stack: readonly SceneFrame[]): Screen {
  return topScene(stack)?.scene ?? BOOT_SCREEN;
}

/** 入栈：返回新栈（原栈不动） */
export function pushScene(stack: readonly SceneFrame[], frame: SceneFrame): SceneFrame[] {
  return [...stack, frame];
}

/** 出栈：返回新栈（空栈不变） */
export function popScene(stack: readonly SceneFrame[]): SceneFrame[] {
  return stack.length ? stack.slice(0, -1) : [...stack];
}

/**
 * 弹栈到指定 scene 的 frame（保留该 frame 及其下层）。
 * 若栈中不存在该 scene，返回原栈（不变）。
 */
export function popToScene(stack: readonly SceneFrame[], scene: Scene): SceneFrame[] {
  const idx = stack.map((f) => f.scene).lastIndexOf(scene);
  return idx >= 0 ? stack.slice(0, idx + 1) : [...stack];
}

/** 替换整个栈为单一 frame（用于 scenario→world 这种"进入游戏"的根切换） */
export function replaceStack(frame: SceneFrame): SceneFrame[] {
  return [frame];
}

/** 清空栈（回到 boot 壳） */
export function clearStack(): SceneFrame[] {
  return [];
}
