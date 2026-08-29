// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Web Audio 程序化合成音效（批次⑤ · Session 409，P5-09 最小切片，ArtDirection.md §9.3 引擎5）。
 * 零音频文件（verify-compliance 白名单不动）；AudioContext 惰性创建（首用户手势后）；
 * 合成失败静默降级（无障碍与自动化脚本不受影响）。正式音色打磨仍后置。
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

const VOLUME_KEY = 'leh-sfx-volume';
const VOLUME_STEPS = [0, 0.25, 0.6, 1] as const;

/** 音量设置（美术批次⑤余项 · Session 418）：0=静音，档位持久化 localStorage。 */
let volume: number = (() => {
  try {
    const raw = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.6;
  } catch {
    return 0.6;
  }
})();

export function getSfxVolume(): number {
  return volume;
}

export function setSfxVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* 隐私模式忽略 */ }
  if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
}

/** 循环切换音量档（TopBar 按钮）：静音 → 25% → 60% → 100%。 */
export function cycleSfxVolume(): number {
  const idx = VOLUME_STEPS.findIndex((v) => Math.abs(v - volume) < 0.01);
  const next = VOLUME_STEPS[(idx + 1) % VOLUME_STEPS.length] ?? 0.6;
  setSfxVolume(next);
  return next;
}

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function env(node: AudioNode, ac: AudioContext, peak: number, decay: number): GainNode {
  const gain = ac.createGain();
  const t = ac.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  node.connect(gain);
  gain.connect(master ?? ac.destination);
  return gain;
}

/** 战鼓：低频正弦 + 噪声瞬态（结束回合/出征）。 */
export function playDrum(): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(52, t + 0.22);
  env(osc, ac, 0.28, 0.3);
  osc.start(t);
  osc.stop(t + 0.32);
  // 打磨（Session 418）：弱拍回声（双击鼓点）
  const echo = ac.createOscillator();
  echo.type = 'sine';
  echo.frequency.setValueAtTime(120, t + 0.14);
  echo.frequency.exponentialRampToValueAtTime(48, t + 0.34);
  env(echo, ac, 0.1, 0.2);
  echo.start(t + 0.14);
  echo.stop(t + 0.36);
  // 皮革瞬态噪声
  const len = Math.floor(ac.sampleRate * 0.06);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  env(noise, ac, 0.1, 0.08);
  noise.start(t);
}

/** 铜磬：泛音叠加（占城/大事件喜音）。 */
export function playChime(): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  [523, 786, 1049].forEach((f, i) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f; // 轻微失谐泛音（打磨）
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.14 / (i + 1), t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1 - i * 0.2);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 1.2);
  });
}

/** 号角：锯齿 + 滤波（进入战场）。 */
export function playHorn(): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(196, t);
  osc.frequency.linearRampToValueAtTime(233, t + 0.18);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  osc.connect(filter);
  env(filter, ac, 0.12, 0.5);
  osc.start(t);
  osc.stop(t + 0.55);
}
