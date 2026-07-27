import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Tile } from './Tile';
import type { TileData } from '../types';

interface TableMeldGroupProps {
  meld: TileData[];
  index: number;
}

export const TableMeldGroup: React.FC<TableMeldGroupProps> = ({ meld, index }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `table-meld-${index}`,
    data: { type: 'table-meld', index }
  });

  return (
    <div
      ref={setNodeRef}
      className={`table-meld-group ${isOver ? 'is-over' : ''}`}
      style={{
        boxShadow: isOver ? 'inset 0 0 10px rgba(0,230,118,0.8)' : 'inset 0 2px 4px rgba(0,0,0,0.3)',
        transition: 'all 0.2s'
      }}
    >
      {meld.map(tile => (
        <Tile key={tile.id} tile={tile} className="table-tile" />
      ))}
    </div>
  );
};
