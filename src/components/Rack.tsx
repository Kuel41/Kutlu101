import React from 'react';
import type { RackSlot } from '../types';
import { DroppableSlot } from './DroppableSlot';
import './Rack.css';

interface RackProps {
  slots: RackSlot[];
}

export const Rack: React.FC<RackProps> = ({ slots }) => {
  return (
    <div className="rack-transparent-overlay">
      <div className="rack-side-metal left"></div>
      <div className="rack-side-metal right"></div>
      {/* Top Ledge */}
      <div className="rack-row">
        {slots.slice(0, 16).map((slot) => (
          <DroppableSlot key={slot.id} slot={slot} />
        ))}
      </div>

      {/* Bottom Ledge */}
      <div className="rack-row">
        {slots.slice(16, 32).map((slot) => (
          <DroppableSlot key={slot.id} slot={slot} />
        ))}
      </div>
    </div>
  );
};
