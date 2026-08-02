export default function Lobby({ me, lobbyState, emit }) {
  const isHost = me.id === lobbyState.hostId;
  const connectedCount = lobbyState.players.filter((p) => p.connected).length;
  const canStart = connectedCount >= 2;

  return (
    <div className="panel">
      <h2>Sala de espera</h2>
      <ul className="player-list">
        {lobbyState.players.map((p) => (
          <li key={p.id} className={p.connected ? '' : 'disconnected'}>
            {p.avatar && <img className="avatar" src={p.avatar} alt="" />}
            <span>{p.username}</span>
            {p.id === lobbyState.hostId && <span className="badge">anfitrião</span>}
            {!p.connected && <span className="badge muted">desligado</span>}
          </li>
        ))}
      </ul>

      {isHost ? (
        <div className="host-controls">
          <label>
            Idioma das palavras
            <select
              value={lobbyState.settings.language}
              onChange={(e) => emit('lobby:setLanguage', { language: e.target.value })}
            >
              <option value="pt">Português</option>
              <option value="en">Inglês</option>
            </select>
          </label>

          <button disabled={!canStart} onClick={() => emit('game:start')}>
            {canStart ? 'Começar jogo' : 'À espera de mais jogadores (mín. 2)'}
          </button>
        </div>
      ) : (
        <p className="subtitle-text">À espera que o anfitrião comece o jogo...</p>
      )}

      <p className="rules">
        Cada jogador escolhe, à vez, uma palavra secreta de 5 letras para os outros
        adivinharem, estilo Wordle/Termo. Ganhas pontos por adivinhar com poucas
        tentativas, e quem escolhe a palavra ganha pontos extra se conseguir
        dificultar a vida aos adversários.
      </p>
    </div>
  );
}
