import type { TileData, RackSlot } from '../types';

export interface BlockValidationResult {
  isValid: boolean;
  type: 'run' | 'group' | 'pair' | 'invalid';
  points: number;
}

export interface RackPointsResult {
  totalSeriesPoints: number;
  totalPairs: number;
  isValidSeriesOpening: boolean; // >= 101 points
  isValidPairsOpening: boolean;  // >= 5 pairs
  validBlocks: TileData[][];
  invalidBlocks: TileData[][];
}

export const getRackBlocks = (rack: RackSlot[]): TileData[][] => {
  const blocks: TileData[][] = [];
  
  const extractBlocksFromRow = (rowSlots: RackSlot[]) => {
    let currentBlock: TileData[] = [];
    
    for (const slot of rowSlots) {
      if (slot.tile !== null) {
        currentBlock.push(slot.tile);
      } else {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock);
          currentBlock = [];
        }
      }
    }
    if (currentBlock.length > 0) {
      blocks.push(currentBlock);
    }
  };

  extractBlocksFromRow(rack.slice(0, 16));
  extractBlocksFromRow(rack.slice(16, 32));

  return blocks;
};

export const validateBlock = (block: TileData[]): BlockValidationResult => {
  if (block.length < 2) return { isValid: false, type: 'invalid', points: 0 };

  if (block.length === 2) {
    const [t1, t2] = block;
    let isPair = false;
    if (t1.isOkey || t2.isOkey) {
        isPair = true;
    } else if (t1.value === t2.value && t1.color === t2.color && t1.isFalseOkey === t2.isFalseOkey) {
        isPair = true;
    }
    if (isPair) return { isValid: true, type: 'pair', points: 0 };
    return { isValid: false, type: 'invalid', points: 0 };
  }

  const anchorIdx = block.findIndex(t => !t.isOkey);
  if (anchorIdx === -1) return { isValid: false, type: 'invalid', points: 0 };

  const anchorTile = block[anchorIdx];
  const anchorVal = anchorTile.value;
  const anchorColor = anchorTile.color;

  let isGroup = true;
  let groupPoints = 0;
  const usedColors = new Set<string>();

  if (block.length > 4) {
    isGroup = false;
  } else {
    for (const t of block) {
      if (t.isOkey) {
         groupPoints += anchorVal;
      } else {
         if (t.value !== anchorVal) {
            isGroup = false;
            break;
         }
         if (usedColors.has(t.color)) {
            isGroup = false;
            break;
         }
         usedColors.add(t.color);
         groupPoints += t.value;
      }
    }
  }

  let isRun = true;
  let runPoints = 0;
  
  if (!isGroup) {
      for (let j = 0; j < block.length; j++) {
        const t = block[j];
        let expectedVal = anchorVal + (j - anchorIdx);
        
        if (expectedVal === 14) expectedVal = 1;
        if (expectedVal > 14 || expectedVal < 1) {
            isRun = false;
            break;
        }

        if (t.isOkey) {
            runPoints += expectedVal;
        } else {
            if (t.color !== anchorColor || t.value !== expectedVal) {
                isRun = false;
                break;
            }
            runPoints += t.value;
        }
      }
  } else {
      isRun = false;
  }

  if (isGroup) return { isValid: true, type: 'group', points: groupPoints };
  if (isRun) return { isValid: true, type: 'run', points: runPoints };

  return { isValid: false, type: 'invalid', points: 0 };
};

export const calculateRackPoints = (rack: RackSlot[]): RackPointsResult => {
  const blocks = getRackBlocks(rack);
  
  let totalSeriesPoints = 0;
  let totalPairs = 0;
  const validBlocks: TileData[][] = [];
  const invalidBlocks: TileData[][] = [];

  for (const block of blocks) {
    const res = validateBlock(block);
    if (res.isValid) {
      validBlocks.push(block);
      if (res.type === 'pair') {
        totalPairs++;
      } else {
        totalSeriesPoints += res.points;
      }
    } else {
      invalidBlocks.push(block);
    }
  }

  return {
    totalSeriesPoints,
    totalPairs,
    isValidSeriesOpening: totalSeriesPoints >= 101,
    isValidPairsOpening: totalPairs >= 5,
    validBlocks,
    invalidBlocks
  };
};

/**
 * Checks if a single tile can be appended to an existing meld on the table.
 * Returns the valid insert position ('start', 'end', 'any') or 'invalid'.
 */
export const canAppendToMeld = (meld: TileData[], tile: TileData): { valid: boolean, position: 'start' | 'end' | 'any' | 'invalid' } => {
  if (meld.length < 2) return { valid: false, position: 'invalid' }; 

  const res = validateBlock(meld);

  if (res.type === 'group') {
     const testGroup = [...meld, tile];
     if (validateBlock(testGroup).isValid) return { valid: true, position: 'any' };
     return { valid: false, position: 'invalid' };
  }

  if (res.type === 'run') {
    const testEnd = [...meld, tile];
    if (validateBlock(testEnd).isValid) return { valid: true, position: 'end' };

    const testStart = [tile, ...meld];
    if (validateBlock(testStart).isValid) return { valid: true, position: 'start' };

    return { valid: false, position: 'invalid' };
  }

  return { valid: false, position: 'invalid' };
};

/**
 * Checks if a tile is 'islek' (playable) on ANY of the current table melds.
 * Also returns true if the tile is Okey, because Okey is always 'islek'.
 */
export const isTilePlayable = (tableMelds: TileData[][], tile: TileData): boolean => {
  if (tile.isOkey) return true;
  for (const meld of tableMelds) {
    if (canAppendToMeld(meld, tile).valid) {
      return true;
    }
  }
  return false;
};
