export type TileColor = 'red' | 'black' | 'yellow' | 'blue';

export interface TileData {
  id: string;         // Unique identifier (e.g., 'red-5-1', 'red-5-2')
  color: TileColor;   // Color of the tile
  value: number;      // 1 to 13, 0 for false okey
  isOkey: boolean;    // Is this the actual okey tile?
  isFalseOkey: boolean; // Is this the false okey (sahte okey)?
}

export interface RackSlot {
  id: string; // e.g. 'slot-0', 'slot-1'
  tile: TileData | null;
}

export interface PlayerState {
  id: string;
  name: string;
  rack: RackSlot[]; // Fixed length array (e.g., 28 slots for a 2-tier rack)
  score: number;
}

export interface GameState {
  deck: TileData[];
  indicator: TileData;
  players: {
    player1: PlayerState;
    bot1: PlayerState;
    bot2: PlayerState;
    bot3: PlayerState;
  };
  tableMelds: TileData[][];
  currentPlayerId: string;
  hasDrawn: boolean;
  hasOpenedHand: Record<string, boolean>;
  discardPiles: Record<string, TileData[]>;
  tiles: TileData[]; // total available tiles pool if needed
}

export interface MatchState {
  currentRound: number;
  maxRounds: number;
  scores: Record<string, number>; // cumulative penalty points
  isRoundOver: boolean;
  isMatchOver: boolean;
  isKatlamali: boolean;
  highestSeriesPoint: number;
  highestPairsPoint: number;
}
