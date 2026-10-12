import { useEffect, useState } from 'react';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I, easy to read aloud

function randomRoomCode() {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

// The standalone web experience shown outside Discord: create a room and
// share its link with a friend (1 vs 1, or more if you share it further),
// or join one someone sent you.
export default function WebJoin({ onJoin }) {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [invitedRoom, setInvitedRoom] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromLink = params.get('room');
    if (roomFromLink) {
      const code = roomFromLink.trim().toUpperCase();
      setRoom(code);
      setInvitedRoom(code);
    }
  }, []);

  function join(roomCode) {
    const name = username.trim();
    if (!name || !roomCode.trim()) return;
    const id = `web-${name.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;
    onJoin({ id, username: name, avatar: null }, roomCode.trim());
  }

  function handleJoinSubmit(e) {
    e.preventDefault();
    join(room);
  }

  function handleCreateRoom() {
    join(randomRoomCode());
  }

  return (
    <div className="app-shell centered">
      <h1>Quina</h1>
      <p className="subtitle-text">descobre a palavra</p>

      {invitedRoom ? (
        <p className="subtitle-text">Foste convidado para a sala <strong>{invitedRoom}</strong>!</p>
      ) : (
        <p className="subtitle-text">Joga 1 vs 1 (ou em grupo) com amigos, direto no browser, sem Discord.</p>
      )}

      <form className="join-form" onSubmit={handleJoinSubmit}>
        <label>
          O teu nome
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            autoFocus
            required
          />
        </label>

        {invitedRoom ? (
          <button type="submit" disabled={!username.trim()}>Entrar na sala</button>
        ) : (
          <>
            <button type="button" onClick={handleCreateRoom} disabled={!username.trim()}>
              Criar sala e convidar um amigo
            </button>
            <div className="join-divider">ou entra com um código</div>
            <label>
              Código da sala
              <input
                value={room}
                onChange={(e) => setRoom(e.target.value.toUpperCase())}
                maxLength={20}
              />
            </label>
            <button type="submit" disabled={!room.trim() || !username.trim()}>
              Entrar
            </button>
          </>
        )}
      </form>
    </div>
  );
}
