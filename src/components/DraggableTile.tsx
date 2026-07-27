import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Tile } from './Tile';
import type { TileData } from '../types';

interface DraggableTileProps {
  tile: TileData;
}

export const DraggableTile: React.FC<DraggableTileProps> = ({ tile }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: tile.id,
    data: tile, // Pass the tile data so we can access it on drop
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        opacity: isDragging ? 0.3 : 1, // Dim the original while dragging (overlay handles the floating one)
        touchAction: 'none',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    >
      <Tile tile={tile} />
    </div>
  );
};
