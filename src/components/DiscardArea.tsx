import React from 'react';
import { useDroppable } from '@dnd-kit/core';

export const DiscardArea: React.FC = () => {
  const { isOver, setNodeRef } = useDroppable({
    id: 'discard-area',
    data: { type: 'discard-area' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`discard-area-zone ${isOver ? 'is-over' : ''}`}
      style={{
        position: 'absolute',
        bottom: '220px',
        right: '100px',
        width: '120px',
        height: '140px',
        borderRadius: '16px',
        border: isOver ? '3px dashed #00e676' : '3px dashed rgba(255,255,255,0.3)',
        backgroundColor: isOver ? 'rgba(0, 230, 118, 0.2)' : 'rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '18px',
        transition: 'all 0.2s',
        zIndex: 5,
        textAlign: 'center'
      }}
    >
      TAŞ AT<br/>(Sırayı Sal)
    </div>
  );
};
