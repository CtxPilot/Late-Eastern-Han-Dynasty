// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { PolicyType } from '../enums/index.js';

/** L3 国策态势（docs/04 §31.6） */
export interface NationalPolicy {
  id: string;
  type: PolicyType;
  factionId: number;
  /** false=已下月待生效；true=当月生效中 */
  active: boolean;
  sinceYear: number;
  sinceMonth: number;
  /** 距下次可切换剩余月数；新切当月为 6 */
  cooldown: number;
  /** 坚壁清野指定边境城 */
  targetCityId?: number;
  /** 焦土粮产归零截止（year*12+month，含当月） */
  scorchedUntilStamp?: number;
}
