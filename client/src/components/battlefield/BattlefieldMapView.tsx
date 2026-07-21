// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 战场地图节点视图（Tier I）
 * 显示战场节点子集、Army 位置、操作按钮
 */
import { useGameStore } from '../../stores/gameStore';
import { MeleeEntryDialog } from './MeleeEntryDialog';

export function BattlefieldMapView() {
  const battlefield = useGameStore((s) => s.battlefield);
  const game = useGameStore((s) => s.game);
  const battlefieldMarch = useGameStore((s) => s.battlefieldMarch);
  const meleeStart = useGameStore((s) => s.meleeStart);

  if (!battlefield || !game) return null;

  const playerArmies = game.campaignArmies.filter(
    (a) => a.factionId === game.playerFactionId && battlefield.armyIds.includes(a.id),
  );

  // 检查是否存在两军对峙（同节点有敌我 Army）
  const contestedNodes = battlefield.nodes.filter((n) => {
    const armiesHere = battlefield.armyIds.filter((aid) => {
      const a = game.campaignArmies.find((ca) => ca.id === aid);
      return a?.currentNodeId === n.id;
    });
    const factions = new Set(armiesHere.map((aid) => {
      const a = game.campaignArmies.find((ca) => ca.id === aid);
      return a?.factionId;
    }));
    return factions.size >= 2;
  });

  return (
    <div className="space-y-4">
      <div className="text-sm text-stone-400">
        战场包含 {battlefield.nodes.length} 个节点
        {contestedNodes.length > 0 && (
          <span className="text-red-400 ml-2">· {contestedNodes.length} 处接战</span>
        )}
      </div>

      {/* 节点列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {battlefield.nodes.map((node) => {
          const armiesHere = game.campaignArmies.filter(
            (a) => a.currentNodeId === node.id && battlefield.armyIds.includes(a.id),
          );
          const isPlayerNode = node.ruler === game.playerFactionId;
          const isEnemyNode = node.ruler != null && node.ruler !== game.playerFactionId;
          const hasEnemy = armiesHere.some((a) => a.factionId !== game.playerFactionId);

          return (
            <div
              key={node.id}
              className={`rounded border p-3 ${
                isPlayerNode
                  ? 'bg-stone-800 border-stone-600'
                  : isEnemyNode
                    ? 'bg-red-950 border-red-800'
                    : 'bg-stone-800 border-stone-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-amber-300">{node.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  isPlayerNode ? 'bg-blue-900 text-blue-200' :
                  isEnemyNode ? 'bg-red-900 text-red-200' :
                  'bg-stone-700 text-stone-300'
                }`}>
                  {isPlayerNode ? '己方' : isEnemyNode ? '敌方' : '中立'}
                </span>
              </div>

              <div className="text-xs text-stone-400 space-y-1">
                <div>驻军：{node.garrison}</div>
                {node.wallDurability > 0 && (
                  <div>城防：{node.wallDurability}/{node.maxWallDurability}</div>
                )}
              </div>

              {/* 在此节点的 Army */}
              {armiesHere.length > 0 && (
                <div className="mt-2 space-y-1">
                  {armiesHere.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-xs bg-stone-900 rounded px-2 py-1">
                      <span className={a.factionId === game.playerFactionId ? 'text-blue-300' : 'text-red-300'}>
                        {a.name}
                      </span>
                      <span className="text-stone-400">{a.troops}兵</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 操作按钮 */}
              <div className="mt-2 flex flex-wrap gap-1">
                {playerArmies
                  .filter((a) => a.currentNodeId === node.id)
                  .map((a) => (
                    <div key={a.id} className="flex gap-1 flex-wrap">
                      {node.adjacentNodeIds.map((adjId) => {
                        const adjNode = battlefield.nodes.find((n) => n.id === adjId);
                        if (!adjNode) return null;
                        return (
                          <button
                            key={adjId}
                            type="button"
                            className="text-xs px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300"
                            onClick={() => battlefieldMarch(a.id, adjId)}
                          >
                            进军{adjNode.name}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                {hasEnemy && (
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-red-800 hover:bg-red-700 text-red-200"
                    onClick={() => {
                      const atk = armiesHere.find((a) => a.factionId === game.playerFactionId);
                      const def = armiesHere.find((a) => a.factionId !== game.playerFactionId);
                      if (atk && def) meleeStart(atk.id, def.id);
                    }}
                  >
                    交战
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 弹出白刃战入口选择 */}
      <MeleeEntryDialog />
    </div>
  );
}
