import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { RackSlot } from '../types';
import { DraggableTile } from './DraggableTile';

interface DroppableSlotProps {
  slot: RackSlot;
}

export const DroppableSlot: React.FC<DroppableSlotProps> = ({ slot }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: slot.id,
    data: slot, // Pass the slot data so we know where we dropped
  });

  return (
    <div
      ref={setNodeRef}
      className={`rack-slot-transparent ${!slot.tile ? 'empty' : ''}`}
      style={{
        // Give a visual hint if dragging over this specific slot
        backgroundColor: isOver ? 'rgba(255, 255, 255, 0.2)' : undefined,
      }}
    >
      {slot.tile && <DraggableTile tile={slot.tile} />}
    </div>
  );
};
