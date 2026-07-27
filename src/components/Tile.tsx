import React from 'react';
import type { TileData } from '../types';
import './Tile.css';

interface TileProps {
  tile: TileData;
  className?: string;
}

export const Tile: React.FC<TileProps> = ({ tile, className = '' }) => {
  // Map color names to actual exact hex colors used in the screenshot
  const getColorCode = (color: string) => {
    switch (color) {
      case 'red': return '#c62828'; // Dark red
      case 'black': return '#1a1a1a'; // Black
      case 'yellow': return '#fbc02d'; // Mustard yellow
      case 'blue': return '#0277bd'; // Tealish blue
      default: return '#000';
    }
  };

  const isFalseOkey = tile.isFalseOkey;
  
  return (
    <div className={`okey-tile ${tile.isOkey ? 'is-okey' : ''} ${className}`}>
      <div className="tile-inner" style={{ color: getColorCode(tile.color) }}>
        {isFalseOkey ? (
          <div className="false-okey-icon">
            {/* The distinct black circle with star inside */}
            <div className="sahte-okey-circle">
               <span className="sahte-okey-star">✯</span>
            </div>
          </div>
        ) : (
          <>
            <span className="tile-value">{tile.value}</span>
            <div 
              className="tile-indicator-dot" 
              style={{ backgroundColor: getColorCode(tile.color) }}
            />
          </>
        )}
      </div>
    </div>
  );
};
