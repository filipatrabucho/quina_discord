import { useState } from 'react';

// Only used outside Discord (plain browser) so people can test the game
// without going through the full Activity install/OAuth flow. Room codes
// let two browser tabs join the same match to simulate two players.
export default function LocalDevJoin({ onJoin }) {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('teste');

  function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !room.trim()) return;
    const id = `local-${username.trim().toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;
    onJoin({ id, username: username.trim(), avatar: null }, room.trim());
  }

  return (
    <div className="app-shell centered">
      <h1>Quina <span className="subtitle">descobre a palavra</span></h1>
      <p className="subtitle-text">
        Modo de teste local (fora do Discord). Abre este link em várias abas com o
        mesmo código de sala para simular vários jogadores.
      </p>
      <form className="join-form" onSubmit={handleSubmit}>
        <label>
          O teu nome
          <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} required />
        </label>
        <label>
          Código da sala
          <input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={20} required />
        </label>
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}
