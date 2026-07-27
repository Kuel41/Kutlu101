import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { initializeGame } from './utils/gameLogic';
import { GameState } from './types';
import { playBotLogic, getBotDiscardDecision } from './utils/botAI';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const BOT_NAMES = ['Bot Ahmet', 'Bot Mehmet', 'Bot Ayşe'];
const TURN_ORDER = ['player1', 'player4', 'player3', 'player2'];

interface RoomPlayer {
  socketId: string;
  username: string;
  gamePlayerId: string;
  isBot: boolean;
}

interface Room {
  id: string;
  players: RoomPlayer[];
  gameState: GameState | null;
  botTimers: ReturnType<typeof setTimeout>[];
}

const rooms: Record<string, Room> = {};

function sanitizeState(state: GameState, myGamePlayerId: string): GameState {
  const sanitized = JSON.parse(JSON.stringify(state)) as GameState;
  for (const pid in sanitized.players) {
    if (pid !== myGamePlayerId) {
      sanitized.players[pid].rack = sanitized.players[pid].rack.map((slot: any) => ({
        ...slot,
        tile: slot.tile ? { id: slot.tile.id, color: 'none', value: 0, isOkey: false, isFalseOkey: false } : null
      })) as any;
    }
  }
  return sanitized;
}

function calculateEndRoundScores(state: GameState, winner: string | null, okeyFinish: boolean) {
  for (const pid in state.players) {
    if (pid === winner) {
      state.players[pid].score -= (okeyFinish ? 202 : 101);
    } else {
      if (state.hasOpenedHand[pid]) {
        let sum = 0;
        state.players[pid].rack.forEach((s: any) => {
          if (s.tile) sum += s.tile.value;
        });
        state.players[pid].score += sum;
      } else {
        state.players[pid].score += 200;
      }
    }
  }
}

function broadcastState(roomId: string) {
  const room = rooms[roomId];
  if (!room || !room.gameState) return;
  for (const player of room.players) {
    if (player.isBot) continue;
    const sanitized = sanitizeState(room.gameState, player.gamePlayerId);
    io.to(player.socketId).emit('gameState', sanitized);
  }
}

function scheduleBotTurn(roomId: string) {
  const room = rooms[roomId];
  if (!room || !room.gameState) return;

  const state = room.gameState;
  const currentId = state.currentPlayerId;
  const currentPlayer = room.players.find(p => p.gamePlayerId === currentId);

  if (!currentPlayer || !currentPlayer.isBot) return;
  if (state.deck.length === 0) return;

  const timer = setTimeout(() => {
    const r = rooms[roomId];
    if (!r || !r.gameState) return;
    const s = r.gameState;
    if (s.currentPlayerId !== currentId) return;

    // Bot draws a tile if needed
    const botRack = s.players[currentId].rack;
    const currentTileCount = botRack.filter((sl: any) => sl.tile !== null).length;
    
    if (currentTileCount < 22) {
      if (s.deck.length === 0) {
        calculateEndRoundScores(s, null, false);
        broadcastState(roomId);
        io.to(roomId).emit('gameFinished', { winner: null, reason: 'deck_empty' });
        return;
      }
      const drawnTile = s.deck.pop()!;
      const emptyIdx = botRack.findIndex((sl: any) => sl.tile === null);
      if (emptyIdx !== -1) botRack[emptyIdx].tile = drawnTile;
      s.hasDrawn = true;
    }

    // Bot plays logic
    const playResult = playBotLogic(
      botRack,
      s.tableMelds,
      s.hasOpenedHand[currentId] || false
    );
    s.players[currentId].rack = playResult.newRack;
    s.tableMelds = playResult.newTableMelds;
    if (playResult.hasOpenedNow) s.hasOpenedHand[currentId] = true;

    // Bot discards
    const discardTile = getBotDiscardDecision(s.players[currentId].rack, s.tableMelds);
    const discardIdx = s.players[currentId].rack.findIndex((sl: any) => sl.tile?.id === discardTile.id);
    if (discardIdx !== -1) s.players[currentId].rack[discardIdx].tile = null;

    if (!s.discardPiles[currentId]) s.discardPiles[currentId] = [];
    s.discardPiles[currentId].push(discardTile);

    const remaining = s.players[currentId].rack.filter((sl: any) => sl.tile !== null).length;
    if (remaining === 0) {
      calculateEndRoundScores(s, currentId, discardTile.isOkey);
      broadcastState(roomId); // Broadcast final scores
      io.to(roomId).emit('gameFinished', { winner: currentId, okeyFinish: discardTile.isOkey });
      return; // Stop bot loop if game ended
    }

    const nextIndex = (TURN_ORDER.indexOf(currentId) + 1) % TURN_ORDER.length;
    s.currentPlayerId = TURN_ORDER[nextIndex];
    s.hasDrawn = false;

    broadcastState(roomId);
    scheduleBotTurn(roomId);
  }, 1500);

  room.botTimers.push(timer);
}

function startGame(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;

  // Fill remaining slots with bots
  let botIndex = 0;
  const playerIds = ['player1', 'player2', 'player3', 'player4'];
  const usedIds = room.players.map(p => p.gamePlayerId);

  for (const pid of playerIds) {
    if (!usedIds.includes(pid)) {
      room.players.push({
        socketId: '',
        username: BOT_NAMES[botIndex] || `Bot ${botIndex + 1}`,
        gamePlayerId: pid,
        isBot: true
      });
      botIndex++;
    }
  }

  room.gameState = initializeGame(1);

  // Set player names
  for (const p of room.players) {
    room.gameState.players[p.gamePlayerId].name = p.username;
  }

  // Broadcast initial state to real players
  broadcastState(roomId);

  // Send room update so clients know bots filled in
  io.to(roomId).emit('roomUpdate', room.players.map(p => ({
    username: p.username,
    gamePlayerId: p.gamePlayerId,
    socketId: p.socketId,
    isBot: p.isBot
  })));

  // Schedule bot turn if first turn is a bot
  scheduleBotTurn(roomId);
}

io.on('connection', (socket: Socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinRoom', ({ username, roomId }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { id: roomId, players: [], gameState: null, botTimers: [] };
    }
    const room = rooms[roomId];

    if (room.gameState) {
      socket.emit('error', 'Oyun zaten başladı!');
      return;
    }

    const realPlayers = room.players.filter(p => !p.isBot);
    if (realPlayers.length >= 4) {
      socket.emit('error', 'Oda dolu!');
      return;
    }

    const gamePlayerId = `player${realPlayers.length + 1}`;
    room.players.push({ socketId: socket.id, username, gamePlayerId, isBot: false });
    socket.join(roomId);

    io.to(roomId).emit('roomUpdate', room.players.map(p => ({
      username: p.username,
      gamePlayerId: p.gamePlayerId,
      socketId: p.socketId,
      isBot: p.isBot
    })));
  });

  socket.on('startGame', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;
    if (room.gameState) return; // already started
    startGame(roomId);
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const idx = room.players.findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.players.filter(p => !p.isBot).length === 0) {
          // Clear bot timers and delete room
          room.botTimers.forEach(t => clearTimeout(t));
          delete rooms[roomId];
        } else {
          io.to(roomId).emit('roomUpdate', room.players.map(p => ({
            username: p.username,
            gamePlayerId: p.gamePlayerId,
            socketId: p.socketId,
            isBot: p.isBot
          })));
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
      const currentTileCount = state.players[myId].rack.filter((s: any) => s.tile !== null).length;
      if (currentTileCount >= 22) return; // 22 taşı varsa çekemez
      if (state.deck.length === 0) {
        calculateEndRoundScores(state, null, false);
        broadcastState(roomId);
        io.to(roomId).emit('gameFinished', { winner: null, reason: 'deck_empty' });
        return;
      }
      const drawnTile = state.deck.pop();
      if (!drawnTile) return;
      const emptySlotIndex = state.players[myId].rack.findIndex((s: any) => s.tile === null);
      if (emptySlotIndex !== -1) {
        state.players[myId].rack[emptySlotIndex].tile = drawnTile;
        state.hasDrawn = true;
        broadcastState(roomId);
      }
    } else if (action === 'DISCARD_TILE') {
      const tileCount = state.players[myId].rack.filter((s: any) => s.tile !== null).length;
      const canDiscard = state.hasDrawn || tileCount >= 22;
      if (state.currentPlayerId !== myId || !canDiscard) return;
      const sourceIndex = state.players[myId].rack.findIndex((s: any) => s.tile?.id === payload.tileId);
      if (sourceIndex === -1) return;
      const discardedTile = state.players[myId].rack[sourceIndex].tile!;
      state.players[myId].rack[sourceIndex].tile = null;
      const remainingTiles = state.players[myId].rack.filter((s: any) => s.tile !== null).length;
      if (remainingTiles === 0) {
        calculateEndRoundScores(state, myId, discardedTile.isOkey);
        broadcastState(roomId); // Broadcast final scores
        io.to(roomId).emit('gameFinished', { winner: myId, okeyFinish: discardedTile.isOkey });
        return; // Early return to avoid changing turn if game is over
      }
      state.discardPiles[myId] = [...(state.discardPiles[myId] || []), discardedTile];
      const nextIndex = (TURN_ORDER.indexOf(myId) + 1) % TURN_ORDER.length;
      state.currentPlayerId = TURN_ORDER[nextIndex];
      state.hasDrawn = false;
      broadcastState(roomId);
      scheduleBotTurn(roomId);
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
