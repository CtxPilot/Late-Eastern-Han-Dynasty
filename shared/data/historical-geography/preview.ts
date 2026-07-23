// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { HistoricalGeographyBundle } from './schema.js';

export interface HistoricalGeographyPreview {
  sliceId: string;
  scenarioYear: number;
  commandery: string;
  counties: Array<{ id: string; name: string; x: number; y: number; confidence: string }>;
  routes: Array<{ id: string; from: string; to: string; kind: string }>;
  landmarks: Array<{ id: string; name: string; kind: string }>;
}

/**
 * Read-only P0 preview projection. It only sorts and copies static records:
 * no runtime state, no renderer, and no RNG dependency or draw.
 */
export function createHistoricalGeographyPreview(
  bundle: HistoricalGeographyBundle,
): HistoricalGeographyPreview {
  const commandery = bundle.commanderies[0];
  if (!commandery) throw new Error('historical geography bundle has no commandery');

  return {
    sliceId: bundle.sliceId,
    scenarioYear: bundle.scenarioYear,
    commandery: commandery.name,
    counties: bundle.counties
      .map(({ id, name, localX: x, localY: y, confidence }) => ({
        id,
        name,
        x,
        y,
        confidence,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    routes: bundle.routes
      .map(({ id, fromNodeId: from, toNodeId: to, kind }) => ({ id, from, to, kind }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    landmarks: bundle.landmarks
      .map(({ id, name, kind }) => ({ id, name, kind }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}
