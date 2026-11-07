// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import React, { useEffect, useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { BattleUnit } from '@leh/shared';
import Konva from 'konva';
import { BATTLE_TOKENS as BT } from '../../theme/canvasTokens';

const UNIT_CHAR: Record<string, string> = {
  lightInfantry: '步',
  heavyInfantry: '甲',
  spearman: '枪',
  archer: '弓',
  crossbowman: '弩',
  lightCavalry: '轻',
  heavyCavalry: '重',
  horseArcher: '射',
  lightNavy: '走',
  mediumNavy: '蒙',
  towerShip: '楼',
};

export interface TacticalUnitPieceProps {
  unit: BattleUnit;
  targetPixel: { x: number; y: number };
  isSelected: boolean;
  isMultiArmyStorm?: boolean;
  armyName?: string;
  onClick?: () => void;
}

/**
 * S21-W7 战术棋子组件：
 * 支持棋子移动滑行动画 (node.to({ x, y, duration }) 替换瞬切)
 */
export const TacticalUnitPiece: React.FC<TacticalUnitPieceProps> = ({
  unit,
  targetPixel,
  isSelected,
  isMultiArmyStorm,
  armyName,
  onClick,
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const prevPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    if (
      prevPosRef.current &&
      (prevPosRef.current.x !== targetPixel.x || prevPosRef.current.y !== targetPixel.y)
    ) {
      // 从上一次位置平滑滑行到目标像素位置
      group.position(prevPosRef.current);
      if (typeof group.to === 'function') {
        group.to({
          x: targetPixel.x,
          y: targetPixel.y,
          duration: 0.35,
          easing: Konva.Easings?.EaseInOut,
        });
      } else {
        group.position(targetPixel);
      }
    } else {
      group.position(targetPixel);
    }
    prevPosRef.current = targetPixel;
  }, [targetPixel.x, targetPixel.y]);

  const hpRatio = Math.max(0, Math.min(1, unit.troopCount / Math.max(1, unit.maxTroops)));

  return (
    <Group
      ref={groupRef}
      x={targetPixel.x}
      y={targetPixel.y}
      name={`unit-piece-${unit.id}`}
      onClick={onClick}
      onTap={onClick}
    >
      <Rect
        x={-9}
        y={-13}
        width={18}
        height={24}
        cornerRadius={2}
        fill={unit.side === 'attacker' ? BT.unitAttacker : BT.unitDefender}
        stroke={isSelected ? BT.unitSelected : unit.side === 'attacker' ? BT.flagEdgeA : BT.flagEdgeD}
        strokeWidth={isSelected ? 2.5 : 1.2}
      />
      <Text
        text={unit.commanderName.slice(0, 1)}
        x={-9}
        width={18}
        y={-12}
        align="center"
        fontFamily="HanDynastySerif"
        fontSize={13}
        fontStyle="bold"
        fill={BT.flagText}
      />
      <Text
        text={UNIT_CHAR[unit.unitType] ?? '军'}
        x={-9}
        width={18}
        y={1}
        align="center"
        fontFamily="HanDynastySeal"
        fontSize={9}
        fill={BT.flagSeal}
      />
      <Rect x={-9} y={11} width={18} height={3} fill={BT.hpBack} opacity={0.7} />
      <Rect x={-9} y={11} width={Math.max(2, 18 * hpRatio)} height={3} fill={BT.hpFill} />
      {isMultiArmyStorm && armyName && (
        <Text
          text={armyName}
          x={-20}
          width={40}
          y={15}
          align="center"
          fontFamily="HanDynastySerif"
          fontSize={8}
          fill={BT.flagText}
        />
      )}
    </Group>
  );
};
