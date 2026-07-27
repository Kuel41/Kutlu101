import type { GameState, TileData, MatchState, RackSlot } from '../types';
import { autoSortSeries, autoSortPairs } from './sortLogic';
import { calculateRackPoints, canAppendToMeld, isTilePlayable } from './ruleEngine';

export const playBotLogic = (
  botId: string,
  rack: RackSlot[],
  tableMelds: TileData[][],
  hasOpened: boolean,
  matchState: MatchState
): {
  newRack: RackSlot[];
  newTableMelds: TileData[][];
  hasOpenedNow: boolean;
  openedSeries: boolean;
  openedPairs: boolean;
} => {
  let currentRack = [...rack];
  let currentMelds = [...tableMelds];
  let openedNow = hasOpened;
  let openedSeries = false;
  let openedPairs = false;

  // 1. Try to append to existing melds if already opened
  if (openedNow) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < currentRack.length; i++) {
        const slot = currentRack[i];
        if (!slot.tile) continue;
        
        for (let m = 0; m < currentMelds.length; m++) {
          const appendCheck = canAppendToMeld(currentMelds[m], slot.tile);
          if (appendCheck.valid) {
            if (appendCheck.position === 'start') {
              currentMelds[m] = [slot.tile, ...currentMelds[m]];
            } else {
              currentMelds[m] = [...currentMelds[m], slot.tile];
            }
            currentRack[i] = { ...currentRack[i], tile: null };
            changed = true;
            break;
          }
        }
      }
    }
  }

  // 2. If not opened, sort and check if can open
  if (!openedNow) {
    let sortedRack = autoSortSeries(currentRack);
    let pointsInfo = calculateRackPoints(sortedRack);
    
    const targetSeries = matchState.isKatlamali ? matchState.highestSeriesPoint + 1 : 101;
    const targetPairs = matchState.isKatlamali ? matchState.highestPairsPoint + 1 : 5;

    if (pointsInfo.isValidSeriesOpening && pointsInfo.totalSeriesPoints >= targetSeries) {
      openedNow = true;
      openedSeries = true;
      for (const block of pointsInfo.validBlocks) {
        currentMelds.push(block);
        for (const tile of block) {
          const s = sortedRack.find(s => s.tile?.id === tile.id);
          if (s) s.tile = null;
        }
      }
      currentRack = sortedRack;
    } else {
      sortedRack = autoSortPairs(currentRack);
      pointsInfo = calculateRackPoints(sortedRack);
      if (pointsInfo.isValidPairsOpening && pointsInfo.totalPairs >= targetPairs) {
        openedNow = true;
        openedPairs = true;
        for (const block of pointsInfo.validBlocks) {
          currentMelds.push(block);
          for (const tile of block) {
            const s = sortedRack.find(s => s.tile?.id === tile.id);
            if (s) s.tile = null;
          }
        }
        currentRack = sortedRack;
      }
    }

    if (openedNow && !hasOpened) {
      let changed = true;
      while (changed) {
        changed = false;
        for (let i = 0; i < currentRack.length; i++) {
          const slot = currentRack[i];
          if (!slot.tile) continue;
          for (let m = 0; m < currentMelds.length; m++) {
            const appendCheck = canAppendToMeld(currentMelds[m], slot.tile);
            if (appendCheck.valid) {
              if (appendCheck.position === 'start') {
                currentMelds[m] = [slot.tile, ...currentMelds[m]];
              } else {
                currentMelds[m] = [...currentMelds[m], slot.tile];
              }
              currentRack[i] = { ...currentRack[i], tile: null };
              changed = true;
              break;
            }
          }
        }
      }
    }
  }

  currentRack = autoSortSeries(currentRack);
  return { newRack: currentRack, newTableMelds: currentMelds, hasOpenedNow: openedNow, openedSeries, openedPairs };
};

export const getBotDiscardDecision = (rack: RackSlot[], tableMelds: TileData[][]): TileData => {
  const occupiedSlots = rack.filter(s => s.tile !== null);
  const nonIslekSlots = occupiedSlots.filter(s => !isTilePlayable(tableMelds, s.tile!));
  const pool = nonIslekSlots.length > 0 ? nonIslekSlots : occupiedSlots;
  pool.sort((a, b) => b.tile!.value - a.tile!.value);
  return pool[0].tile!;
};
