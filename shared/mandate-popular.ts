import type { GameState } from './types/game.js';
import type { Faction } from './types/faction.js';

export function computeMandate(faction: Faction, game: GameState): number {
  let base = 0;
  const ownedCommanderies = countOwnedCommanderies(faction.id, game);
  base += ownedCommanderies * 5;
  if (faction.fame != null && faction.fame > 500) base += 10;
  if (faction.politicalStage === 'emperor') base += 50;
  else if (faction.politicalStage === 'king') base += 30;
  else if (faction.politicalStage === 'hegemon') base += 20;
  if (faction.imperialAuthority != null && faction.imperialAuthority > 0) base += 20;
  const avgPopular = averageCityPopular(faction.id, game);
  if (avgPopular >= 80) base += 1;
  return Math.min(100, Math.max(0, base));
}

export function computePopularWill(faction: Faction, game: GameState): number {
  const avgLoyalty = averageOfficerLoyalty(faction.id, game);
  const avgPopular = averageCityPopular(faction.id, game);
  const relationScore = averageRelationScore(faction.id, game);
  return Math.min(100, Math.max(0,
    Math.round(avgLoyalty * 0.5 + avgPopular * 0.3 + relationScore * 0.2)
  ));
}

function countOwnedCommanderies(factionId: number, game: GameState): number {
  const owned = new Set<string>();
  for (const city of Object.values(game.cities)) {
    if (city.ruler === factionId) {
      owned.add(city.adminName ?? city.province);
    }
  }
  return owned.size;
}

function averageCityPopular(factionId: number, game: GameState): number {
  const cities = Object.values(game.cities).filter((c) => c.ruler === factionId);
  if (cities.length === 0) return 50;
  let total = 0;
  for (const c of cities) {
    total += c.stats.morale;
  }
  return total / cities.length;
}

function averageOfficerLoyalty(factionId: number, game: GameState): number {
  const officers = Object.values(game.officers).filter((o) => o.faction === factionId);
  if (officers.length === 0) return 50;
  let total = 0;
  for (const o of officers) {
    total += o.loyalty;
  }
  return total / officers.length;
}

function averageRelationScore(factionId: number, game: GameState): number {
  const officers = Object.values(game.officers).filter((o) => o.faction === factionId);
  if (officers.length < 2) return 50;
  let total = 0;
  let count = 0;
  for (let i = 0; i < officers.length; i++) {
    for (let j = i + 1; j < officers.length; j++) {
      const a = officers[i];
      const b = officers[j];
      const diff = Math.abs((a.hidden?.compatibility ?? 50) - (b.hidden?.compatibility ?? 50));
      const affinity = (1 - diff / 150) * 100;
      total += affinity;
      count++;
    }
  }
  return count > 0 ? total / count : 50;
}

export function mandateLabel(mandate: number): string {
  if (mandate >= 81) return '天命在身';
  if (mandate >= 61) return '天命所归';
  if (mandate >= 41) return '天命渐盛';
  if (mandate >= 21) return '天命初显';
  return '天命未显';
}

export function popularWillLabel(pw: number): string {
  if (pw >= 81) return '众志成城';
  if (pw >= 61) return '人心所向';
  if (pw >= 41) return '人心安定';
  if (pw >= 21) return '人心浮动';
  return '人心涣散';
}

export function mandateDiplomacyModifier(mandate: number): number {
  if (mandate >= 81) return 0.2;
  if (mandate >= 61) return 0.1;
  if (mandate >= 41) return 0;
  if (mandate >= 21) return -0.1;
  return -0.2;
}

export function popularWillDesertionModifier(pw: number): number {
  if (pw >= 81) return -0.4;
  if (pw >= 61) return -0.2;
  if (pw >= 41) return 0;
  if (pw >= 21) return 0.2;
  return 0.5;
}

export function popularWillRecruitModifier(pw: number): number {
  if (pw >= 81) return 0.4;
  if (pw >= 61) return 0.2;
  if (pw >= 41) return 0;
  if (pw >= 21) return -0.2;
  return -0.4;
}
