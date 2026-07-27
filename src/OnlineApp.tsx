import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import type { GameState, TileData, RackSlot } from './types';
import { calculateRackPoints } from './utils/ruleEngine';
import { autoSortSeries, autoSortPairs } from './utils/sortLogic';
import { Rack } from './components/Rack';
import { DiscardArea } from './components/DiscardArea';
import { TableMeldGroup } from './components/TableMeldGroup';
import { Lobby } from './components/Lobby';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Tile } from './components/Tile';

// NOT: Uygulamayı Render'a yüklediğinde sana verilen linki (örn: https://kutlu-server.onrender.com) 
// aşağıdaki http://localhost:3001 yerine yapıştırıp pushlamalısın!
const SERVER_URL = 'https://kutlu101.onrender.com';

const Opponent: React.FC<{ position: string, name: string, tileCount: number, discard: string, isActive?: boolean }> = ({ position, name, tileCount: _tileCount, discard: _discard, isActive }) => {
  return (
    <div className={`opponent-${position} ${isActive ? 'active-turn' : ''}`}>
      <div className="flex-center" style={{ gap: '4px' }}>
        <div className="avatar">
          <div className="avatar-icon">P</div>
          <div>{name}</div>
        </div>
      </div>
    </div>
  );
};

export default function OnlineApp() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [_username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<{username: string, gamePlayerId: string}[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myGamePlayerId, setMyGamePlayerId] = useState<string | null>(null);
  const [activeTile, setActiveTile] = useState<TileData | null>(null);
  const [gameFinishedInfo, setGameFinishedInfo] = useState<{winner: string, okeyFinish: boolean} | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('roomUpdate', (players) => {
      setRoomPlayers(players);
      const me = players.find((p: any) => p.socketId === newSocket.id);
      if (me) {
        setMyGamePlayerId(me.gamePlayerId);
      }
    });

    newSocket.on('gameState', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('error', (msg: string) => {
      setError(msg);
    });

    newSocket.on('gameFinished', (info) => {
      setGameFinishedInfo(info);
    });

    return () => { newSocket.close(); };
  }, []);

  const handleJoin = (uname: string, room: string) => {
    if (!socket) return;
    setUsername(uname);
    setRoomId(room);
    socket.emit('joinRoom', { username: uname, roomId: room });
    setJoined(true);
  };

  const emitAction = (action: string, payload: any = {}) => {
    if (!socket || !roomId) return;
    socket.emit('action', { roomId, action, payload });
  };

  if (!joined || !myGamePlayerId) {
    return <Lobby onJoin={handleJoin} error={error} />;
  }

  if (!gameState) {
    return (
      <div style={{color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111'}}>
        <h2>Oda: {roomId}</h2>
        <p>Oyuncular bekleniyor... ({roomPlayers.length}/4)</p>
        <ul>
          {roomPlayers.map(p => <li key={p.gamePlayerId}>{p.username}</li>)}
        </ul>
      </div>
    );
  }

  const playerIds = ['player1', 'player2', 'player3', 'player4'];
  const myIndex = playerIds.indexOf(myGamePlayerId);
  const rightId = playerIds[(myIndex + 1) % 4];
  const topId = playerIds[(myIndex + 2) % 4];
  const leftId = playerIds[(myIndex + 3) % 4];

  const me = gameState.players[myGamePlayerId as keyof typeof gameState.players];
  const topOpponent = gameState.players[topId as keyof typeof gameState.players];
  const leftOpponent = gameState.players[leftId as keyof typeof gameState.players];
  const rightOpponent = gameState.players[rightId as keyof typeof gameState.players];

  const canDraw = gameState.currentPlayerId === myGamePlayerId && !gameState.hasDrawn;
  const p1TileCount = me.rack.filter((s: RackSlot) => s.tile !== null).length;
  const canDiscard = gameState.currentPlayerId === myGamePlayerId && (gameState.hasDrawn || p1TileCount === 22);

  const handleDrawDeck = () => {
    if (!canDraw) return;
    emitAction('DRAW_DECK');
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (gameFinishedInfo) return;
    const { active } = event;
    const tile = active.data.current as TileData;
    if (tile) setActiveTile(tile);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTile(null);
    if (gameFinishedInfo) return;
    const { active, over } = event;
    if (!over || !gameState) return;

    if (over.id === 'discard-area') {
      if (!canDiscard) {
        alert('Lutfen once ortadan tas cekin!');
        return;
      }
      emitAction('DISCARD_TILE', { tileId: active.id });
      return;
    }

    if (typeof over.id === 'string' && over.id.startsWith('table-meld-')) {
       alert("Masaya islemek su an online versiyonda gecici kapali.");
       return;
    }

    const activeSlotIndex = me.rack.findIndex((s: RackSlot) => s.tile?.id === active.id);
    const overSlotIndex = me.rack.findIndex((s: RackSlot) => s.id === over.id);
    if (activeSlotIndex !== -1 && overSlotIndex !== -1) {
      const newRack = [...me.rack];
      const activeSlot = newRack[activeSlotIndex];
      const overSlot = newRack[overSlotIndex];
      const tempTile = overSlot.tile;
      overSlot.tile = activeSlot.tile;
      activeSlot.tile = tempTile;
      emitAction('UPDATE_RACK', { newRack });
    }
  };

  const handleAutoSort = () => {
    const sorted = autoSortSeries(me.rack);
    emitAction('UPDATE_RACK', { newRack: sorted });
  };

  const handleAutoSortPairs = () => {
    const sorted = autoSortPairs(me.rack);
    emitAction('UPDATE_RACK', { newRack: sorted });
  };

  const handleOpenHand = () => {
    const points = calculateRackPoints(me.rack);
    if (points.totalSeriesPoints >= 101 || points.totalPairs >= 5) {
       emitAction('OPEN_HAND', { melds: points.validBlocks, newRack: (points as any).leftoverRack || me.rack.filter(_x => false) });
    }
  };

  const topDiscardPile = gameState.discardPiles[topId] || [];
  const leftDiscardPile = gameState.discardPiles[leftId] || [];
  const rightDiscardPile = gameState.discardPiles[rightId] || [];
  
  const topDiscard = topDiscardPile[topDiscardPile.length - 1];
  const leftDiscard = leftDiscardPile[leftDiscardPile.length - 1];
  const rightDiscard = rightDiscardPile[rightDiscardPile.length - 1];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={`game-container ${gameState.currentPlayerId !== myGamePlayerId ? 'not-my-turn' : ''}`}>
        
        {gameFinishedInfo && (
          <div className="modal-overlay">
            <div className="modal-content" style={{border: '2px solid #00e676'}}>
              <div className="modal-title" style={{color: '#00e676'}}>Oyun Bitti!</div>
              <p style={{marginBottom: '20px', fontSize: '20px'}}>Kazanan: {gameState.players[gameFinishedInfo.winner as keyof typeof gameState.players].name}</p>
              {gameFinishedInfo.okeyFinish && <p style={{color: 'red'}}>Okey ile Bitti! (x2 Ceza)</p>}
              <button className="modal-btn" onClick={() => window.location.reload()}>Yeniden Oyna</button>
            </div>
          </div>
        )}

        <div className="main-area">
          <div className="board-grid">
            <div className="board-logo-left">101<br/>KUTLU</div>
            <div className="board-logo-right">101<br/>KUTLU</div>
            
            <Opponent position="top" name={topOpponent.name.substring(0,8)} tileCount={topOpponent.rack.filter((s: RackSlot) => s.tile !== null).length} discard={topDiscard ? topDiscard.value.toString() : ''} isActive={gameState.currentPlayerId === topId} />
            <Opponent position="left" name={leftOpponent.name.substring(0,8)} tileCount={leftOpponent.rack.filter((s: RackSlot) => s.tile !== null).length} discard={leftDiscard ? leftDiscard.value.toString() : ''} isActive={gameState.currentPlayerId === leftId} />
            <Opponent position="right" name={rightOpponent.name.substring(0,8)} tileCount={rightOpponent.rack.filter((s: RackSlot) => s.tile !== null).length} discard={rightDiscard ? rightDiscard.value.toString() : ''} isActive={gameState.currentPlayerId === rightId} />
            
            <div className="table-melds-area">
              {gameState.tableMelds.map((meld, index) => (
                <TableMeldGroup key={index} meld={meld} index={index} />
              ))}
            </div>
          </div>

          <div className="sidebar">
            <div className="indicator-area" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ color: 'white', fontWeight: 'bold', marginBottom: '8px' }}>GOSTERGE</div>
              <div style={{ transform: 'scale(0.8)', pointerEvents: 'none' }}>
                <Tile tile={gameState.indicator} />
              </div>
            </div>

            <div 
              className="deck-placeholder flex-center" 
              onClick={handleDrawDeck} 
              style={{ cursor: canDraw ? 'pointer' : 'not-allowed', opacity: canDraw ? 1 : 0.4, marginTop: '10px' }}
            >
              <div className="deck-count">{gameState.deck.length}</div>
              <div style={{ fontSize: '12px', lineHeight: '1' }}>DESTE<br/>CEK</div>
            </div>
          </div>
        </div>

        <div className="player-area-wrapper">
          <div style={{ opacity: canDiscard ? 1 : 0.4, transition: 'opacity 0.2s', pointerEvents: canDiscard ? 'auto' : 'none' }}>
            <DiscardArea />
          </div>
          
          <div className="point-indicator">
            <div className={`point-badge ${gameState.hasOpenedHand[myGamePlayerId] || calculateRackPoints(me.rack).totalSeriesPoints >= 101 ? 'valid' : 'invalid'}`}>
              SERI: {calculateRackPoints(me.rack).totalSeriesPoints} / {gameState.hasOpenedHand[myGamePlayerId] ? 'ACIK' : '101'}
            </div>
            <div className={`point-badge ${gameState.hasOpenedHand[myGamePlayerId] || calculateRackPoints(me.rack).totalPairs >= 5 ? 'valid' : 'invalid'}`}>
              CIFT: {calculateRackPoints(me.rack).totalPairs} / {gameState.hasOpenedHand[myGamePlayerId] ? 'ACIK' : '5'}
            </div>
          </div>

          <div className="side-action-btn" onClick={handleAutoSortPairs}>
            <div className="btn-icon">5 5</div>
            CIFT<br/>DIZ
          </div>
          
          <div className="rack-and-open">
            {(gameState.hasOpenedHand[myGamePlayerId] ? calculateRackPoints(me.rack).validBlocks.length > 0 : (calculateRackPoints(me.rack).totalSeriesPoints >= 101 || calculateRackPoints(me.rack).totalPairs >= 5)) && (
              <button className="open-hand-btn" onClick={handleOpenHand}>ELI AC</button>
            )}
            <Rack slots={me.rack} />
          </div>

          <div className="side-action-btn" onClick={handleAutoSort}>
            <div className="btn-icon" style={{color:'#0288d1', width:'40px'}}>1 2 3</div>
            SERI<br/>DIZ
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTile ? <Tile tile={activeTile} className="dragging-overlay-tile" /> : null}
      </DragOverlay>
    </DndContext>
  );
}
