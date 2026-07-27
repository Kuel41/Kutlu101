import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TileData } from '../types';
import { Tile } from './Tile';

interface SortableTileProps {
  tile: TileData;
}

export const SortableTile: React.FC<SortableTileProps> = ({ tile }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 1,
    opacity: isDragging ? 0.8 : 1,
    position: 'absolute' as const, // To fit in the slot correctly if dragging
  };

  // We add position relative to slot and absolute to tile to allow smooth animations
  // but for dnd-kit rectSortingStrategy to work best, we should maybe not use absolute here.
  // Actually, standard dnd-kit recommends returning the element directly with the transform.
  
  return (
    <div ref={setNodeRef} style={{ ...style, width: '100%', height: '100%' }} {...attributes} {...listeners}>
      <Tile tile={tile} />
    </div>
  );
};
