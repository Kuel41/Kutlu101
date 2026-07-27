import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { initializeGame } from './utils/gameLogic';
import { GameState, TileData, PlayerState, RackSlot } from './types';
import { isTilePlayable } from './utils/ruleEngine';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

interface Room {
  id: string;
  players: { socketId: string, username: string, gamePlayerId: string }[];
  gameState: GameState | null;
}

const rooms: Record<string, Room> = {};

function sanitizeState(state: GameState, myGamePlayerId: string): GameState {
  const sanitized = JSON.parse(JSON.stringify(state)) as GameState;
  
  for (const pid in sanitized.players) {
    if (pid !== myGamePlayerId) {
      sanitized.players[pid].rack = sanitized.players[pid].rack.map(slot => ({
        ...slot,
        tile: slot.tile ? { id: slot.tile.id, color: 'none', value: 0, isOkey: false, isFalseOkey: false } : null
      })) as any;
    }
  }
  return sanitized;
}

function broadcastState(roomId: string) {
  const room = rooms[roomId];
  if (!room || !room.gameState) return;
  
  for (const player of room.players) {
    const sanitized = sanitizeState(room.gameState, player.gamePlayerId);
    io.to(player.socketId).emit('gameState', sanitized);
  }
}

io.on('connection', (socket: Socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinRoom', ({ username, roomId }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { id: roomId, players: [], gameState: null };
    }
    const room = rooms[roomId];

    if (room.players.length >= 4) {
      socket.emit('error', 'Oda dolu!');
      return;
    }

    const gamePlayerId = `player${room.players.length + 1}`;
    room.players.push({ socketId: socket.id, username, gamePlayerId });
    socket.join(roomId);

    io.to(roomId).emit('roomUpdate', room.players.map(p => ({ username: p.username, gamePlayerId: p.gamePlayerId, socketId: p.socketId })));

    if (room.players.length === 4) {
      room.gameState = initializeGame(1);
      room.players.forEach(p => {
        if (room.gameState) {
          room.gameState.players[p.gamePlayerId].name = p.username;
        }
      });
      broadcastState(roomId);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(roomId).emit('roomUpdate', room.players.map(p => ({ username: p.username, gamePlayerId: p.gamePlayerId, socketId: p.socketId })));
        if (room.players.length === 0) {
          delete rooms[roomId];
        }
      }
    }
    console.log('User disconnected:', socket.id);
  });

  socket.on('action', ({ roomId, action, payload }) => {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const state = room.gameState;
    const myId = player.gamePlayerId;

    if (action === 'DRAW_DECK') {
      if (state.currentPlayerId !== myId || state.hasDrawn) return;
      const drawnTile = state.deck.pop();
      if (!drawnTile) return;

      const emptySlotIndex = state.players[myId].rack.findIndex((s: any) => s.tile === null);
      if (emptySlotIndex !== -1) {
        state.players[myId].rack[emptySlotIndex].tile = drawnTile;
        state.hasDrawn = true;
        broadcastState(roomId);
      }
    } else if (action === 'DISCARD_TILE') {
      if (state.currentPlayerId !== myId || !state.hasDrawn) return;
      
      const sourceIndex = state.players[myId].rack.findIndex((s: any) => s.tile?.id === payload.tileId);
      if (sourceIndex === -1) return;
      
      const discardedTile = state.players[myId].rack[sourceIndex].tile!;
      state.players[myId].rack[sourceIndex].tile = null;
      
      const remainingTiles = state.players[myId].rack.filter((s: any) => s.tile !== null).length;
      if (remainingTiles === 0) {
        io.to(roomId).emit('gameFinished', { winner: myId, okeyFinish: discardedTile.isOkey });
      }

      state.discardPiles[myId] = [...(state.discardPiles[myId] || []), discardedTile];
      
      const turnOrder = ['player1', 'player4', 'player3', 'player2'];
      const nextIndex = (turnOrder.indexOf(myId) + 1) % 4;
      state.currentPlayerId = turnOrder[nextIndex];
      state.hasDrawn = false;
      
      broadcastState(roomId);
    } else if (action === 'OPEN_HAND') {
      if (state.currentPlayerId !== myId) return;
      state.tableMelds = [...state.tableMelds, ...payload.melds];
      state.players[myId].rack = payload.newRack;
      state.hasOpenedHand[myId] = true;
      broadcastState(roomId);
    } else if (action === 'UPDATE_RACK') {
      state.players[myId].rack = payload.newRack;
      broadcastState(roomId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

