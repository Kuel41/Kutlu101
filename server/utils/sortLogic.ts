import type { TileData, RackSlot } from '../types';

export const autoSortSeries = (rack: RackSlot[]): RackSlot[] => {
  // 1. Extract all tiles
  const allTiles = rack.map(s => s.tile).filter((t): t is TileData => t !== null);
  
  if (allTiles.length === 0) return rack;

  // Separate okeys and false okeys for now, or just keep them in the pool?
  // Let's just keep them in the pool based on their literal value.
  // Wait, false okeys are value 0. They cannot form a set. We must put them in leftovers.
  const falseOkeys = allTiles.filter(t => t.isFalseOkey);
  const pool = allTiles.filter(t => !t.isFalseOkey);

  const sets: TileData[][] = [];
  
  // STEP A: Find Groups (Same Value, Different Colors)
  // For each value 1..13, try to form groups of 3 or 4
  for (let val = 1; val <= 13; val++) {
    let tilesOfVal = pool.filter(t => t.value === val);
    
    // We might be able to form multiple groups if we have a lot of duplicates, 
    // but typically we just form one group of 3 or 4.
    while (tilesOfVal.length >= 3) {
      const colors = new Set<string>();
      const group: TileData[] = [];
      
      for (const t of tilesOfVal) {
        if (!colors.has(t.color)) {
          colors.add(t.color);
          group.push(t);
        }
      }
      
      if (group.length >= 3) {
        sets.push(group);
        // Remove from pool
        for (const t of group) {
          const idx = pool.findIndex(pt => pt.id === t.id);
          if (idx !== -1) pool.splice(idx, 1);
        }
        // Update tilesOfVal for next iteration
        tilesOfVal = pool.filter(t => t.value === val);
      } else {
        break; // Cannot form a valid group
      }
    }
  }

  // STEP B: Find Runs (Same Color, Sequential)
  const colors = ['red', 'black', 'blue', 'yellow'];
  for (const color of colors) {
    let colorTiles = pool.filter(t => t.color === color).sort((a, b) => a.value - b.value);
    
    while (colorTiles.length >= 3) {
      // Find the longest run starting from the first tile
      let currentRun: TileData[] = [colorTiles[0]];
      let prevValue = colorTiles[0].value;
      
      for (let i = 1; i < colorTiles.length; i++) {
        const tile = colorTiles[i];
        if (tile.value === prevValue) {
          continue; // duplicate, skip for this run
        } else if (tile.value === prevValue + 1) {
          currentRun.push(tile);
          prevValue = tile.value;
        } else {
          // Break the run if gap is found
          // Wait, if we break, we should check if currentRun is valid (>=3).
          // If not, maybe the run starts from the NEXT tile?
          // We need a better algorithm to find ALL runs.
          break;
        }
      }
      
      // Check for 12-13-1 wrap if the run ends in 13
      if (prevValue === 13) {
        // Look for a 1 of the same color in the pool
        const oneTile = colorTiles.find(t => t.value === 1);
        if (oneTile) {
           // We cannot already have 1 in this run because the run goes strictly upwards 
           // and 1 is at the beginning of colorTiles.
           // Actually, if colorTiles[0].value === 1, it's at the start.
           // Let's make sure it's not already in the run.
           if (!currentRun.some(t => t.id === oneTile.id)) {
              currentRun.push(oneTile);
           }
        }
      }

      if (currentRun.length >= 3) {
        sets.push(currentRun);
        for (const t of currentRun) {
          const idx = pool.findIndex(pt => pt.id === t.id);
          if (idx !== -1) pool.splice(idx, 1);
        }
        colorTiles = pool.filter(t => t.color === color).sort((a, b) => a.value - b.value);
      } else {
        // Remove the first tile and try again to find runs starting from the next tile
        colorTiles.shift(); 
      }
    }
  }

  // Leftovers: The remaining tiles in the pool + false okeys
  // Let's sort leftovers by color then value for neatness
  const leftovers = [...pool, ...falseOkeys].sort((a, b) => {
    if (a.color !== b.color) return a.color.localeCompare(b.color);
    return a.value - b.value;
  });

  // STEP C: Layout the result into a 32-slot rack
  // We place sets consecutively, leaving 1 empty space between them.
  // Leftovers go at the very end.
  const newSlots: RackSlot[] = [];
  const prefix = rack[0]?.id.split('-')[0] || 'p1'; // get player prefix

  for (let i = 0; i < 32; i++) {
    newSlots.push({ id: `${prefix}-slot-${i}`, tile: null });
  }

  let currentIndex = 0;

  for (const set of sets) {
    // If we don't have enough space for this set, just break and dump to leftovers
    // We need set.length spaces. If it's not the first set, we need 1 space + set.length
    if (currentIndex + set.length > 32) {
      leftovers.push(...set);
      continue;
    }
    
    for (const tile of set) {
      newSlots[currentIndex].tile = tile;
      currentIndex++;
    }
    // Leave an empty space
    currentIndex++;
  }

  // Place leftovers, skipping to next available slot, or just appending
  // Often players want leftovers at the far right of the bottom row.
  // Let's just put them contiguously after the sets.
  for (const tile of leftovers) {
    if (currentIndex < 32) {
      newSlots[currentIndex].tile = tile;
      currentIndex++;
    } else {
      // Rack is completely full, shouldn't happen with 21 tiles and 32 slots
      // but just in case, find any empty slot
      const emptySlot = newSlots.find(s => s.tile === null);
      if (emptySlot) emptySlot.tile = tile;
    }
  }

  return newSlots;
};

export const autoSortPairs = (rack: RackSlot[]): RackSlot[] => {
  const allTiles = rack.map(s => s.tile).filter((t): t is TileData => t !== null);
  if (allTiles.length === 0) return rack;

  const pairs: TileData[][] = [];
  const leftovers: TileData[] = [];
  
  // Create a map to find identical tiles (color + value)
  const map = new Map<string, TileData[]>();
  
  for (const t of allTiles) {
    const key = `${t.color}-${t.value}-${t.isFalseOkey}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }

  // Extract exactly pairs (2 of the same)
  for (const [_key, tiles] of map.entries()) {
    while (tiles.length >= 2) {
      // Take 2 identical tiles to form a pair
      const pair = [tiles.shift()!, tiles.shift()!];
      pairs.push(pair);
    }
    // Any remaining (1 tile) goes to leftovers
    leftovers.push(...tiles);
  }

  // Layout the pairs onto the 32-slot rack
  const newSlots: RackSlot[] = [];
  const prefix = rack[0]?.id.split('-')[0] || 'p1';

  for (let i = 0; i < 32; i++) {
    newSlots.push({ id: `${prefix}-slot-${i}`, tile: null });
  }

  let currentIndex = 0;

  for (const pair of pairs) {
    if (currentIndex + pair.length > 32) {
      leftovers.push(...pair);
      continue;
    }
    
    newSlots[currentIndex].tile = pair[0];
    currentIndex++;
    newSlots[currentIndex].tile = pair[1];
    currentIndex++;
    
    // 1 empty space between pairs
    currentIndex++;
  }

  // Place leftovers
  for (const tile of leftovers) {
    if (currentIndex < 32) {
      newSlots[currentIndex].tile = tile;
      currentIndex++;
    } else {
      const emptySlot = newSlots.find(s => s.tile === null);
      if (emptySlot) emptySlot.tile = tile;
    }
  }

  return newSlots;
};
