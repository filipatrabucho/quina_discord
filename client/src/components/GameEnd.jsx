export default function GameEnd({ me, gameEnded, lobbyState, emit }) {
  const isHost = me.id === lobbyState.hostId;
  const winner = gameEnded.scoreboard.find((s) => s.playerId === gameEnded.winnerId);
  const myResult = gameEnded.scoreboard.find((s) => s.playerId === me.id);
  const myProfile = gameEnded.leaderboard?.find((p) => p.playerId === me.id);

  return (
    <div className="panel centered">
      <h2>Fim do jogo!</h2>
      {winner && <p className="winner-text">🏆 {winner.username} venceu com {winner.score} pontos!</p>}

      {myResult && (
        <p className="subtitle-text">
          Ganhaste <strong>+{myResult.score} XP</strong> nesta partida
          {myProfile ? ` — agora nível ${myProfile.level} com ${myProfile.totalXp} XP no total` : ''}.
        </p>
      )}

      <ol className="scoreboard">
        {gameEnded.scoreboard.map((s, i) => (
          <li key={s.playerId} className={i === 0 ? 'first-place' : ''}>
            <span>{s.username}</span>
            <span>{s.score} pts</span>
          </li>
        ))}
      </ol>

      {isHost ? (
        <button onClick={() => emit('game:start')}>Jogar outra vez</button>
      ) : (
        <p className="subtitle-text">À espera que o anfitrião comece um novo jogo...</p>
      )}
    </div>
  );
}
