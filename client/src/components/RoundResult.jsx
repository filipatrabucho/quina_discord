export default function RoundResult({ me, roundEnded, lobbyState, emit }) {
  const chooser = lobbyState.players.find((p) => p.id === roundEnded.chooserId);
  const isHost = me.id === lobbyState.hostId;

  return (
    <div className="panel">
      <h2>Fim da ronda</h2>
      <p className="subtitle-text">
        A palavra era <strong>{roundEnded.secretWord.toUpperCase()}</strong>
        {chooser ? ` (escolhida por ${chooser.username})` : ''}.
      </p>

      <ul className="results-list">
        {roundEnded.results.map((r) => {
          const player = lobbyState.players.find((p) => p.id === r.playerId);
          return (
            <li key={r.playerId}>
              <span>{player?.username ?? '???'}</span>
              <span>{r.won ? `acertou em ${r.attempts} tentativa(s)` : 'não acertou'}</span>
              <span className="points">+{r.points} pts</span>
            </li>
          );
        })}
        {roundEnded.chooserBonus > 0 && (
          <li>
            <span>{chooser?.username ?? '???'} (bónus por dificultar)</span>
            <span></span>
            <span className="points">+{roundEnded.chooserBonus} pts</span>
          </li>
        )}
      </ul>

      <h3>Classificação</h3>
      <ol className="scoreboard">
        {roundEnded.scoreboard.map((s) => (
          <li key={s.playerId}>
            <span>{s.username}</span>
            <span>{s.score} pts</span>
          </li>
        ))}
      </ol>

      {isHost ? (
        <button onClick={() => emit('game:nextRound')}>
          {roundEnded.isFinalRound ? 'Ver resultado final' : 'Próxima ronda'}
        </button>
      ) : (
        <p className="subtitle-text">À espera que o anfitrião avance para a próxima ronda...</p>
      )}
    </div>
  );
}
