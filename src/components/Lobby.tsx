import React, { useState } from 'react';
import './Lobby.css';

interface LobbyProps {
  onJoin: (username: string, roomId: string) => void;
  error: string | null;
}

export const Lobby: React.FC<LobbyProps> = ({ onJoin, error }) => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && roomId.trim()) {
      onJoin(username.trim(), roomId.trim());
    }
  };

  return (
    <div className="lobby-container">
      <div className="lobby-card">
        <h1>101 KUTLU</h1>
        <h2>Çevrimiçi Lobi</h2>
        <form onSubmit={handleSubmit} className="lobby-form">
          <input
            type="text"
            placeholder="Kullanıcı Adı"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={12}
            required
          />
          <input
            type="text"
            placeholder="Oda Kodu (örn: 1453)"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            maxLength={8}
            required
          />
          <button type="submit">Odaya Katıl</button>
        </form>
        {error && <p className="lobby-error">{error}</p>}
      </div>
    </div>
  );
};
