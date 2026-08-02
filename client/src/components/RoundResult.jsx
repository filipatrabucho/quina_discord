export default function RoundResult({ me, roundEnded, lobbyState, emit }) {
  const isHost = me.id === lobbyState.hostId;

  return (
    <div className="panel">
      <h2>Fim da ronda</h2>

      <ul className="results-list">
        {roundEnded.pairings.map((pr) => (
          <li key={pr.guesserId} className="pairing-result">
            <div className="pairing-word">
              <strong>{pr.secretWord.toUpperCase()}</strong>
              <span className="subtitle-text"> escolhida por {pr.chooserUsername}</span>
            </div>
            <div className="pairing-outcome">
              <span>{pr.guesserUsername} {pr.won ? `acertou em ${pr.attempts} tentativa(s)` : 'não acertou'}</span>
              <span className="points">+{pr.guesserPoints} pts</span>
            </div>
            {pr.chooserBonus > 0 && (
              <div className="pairing-outcome">
                <span>{pr.chooserUsername} dificultou a vida a {pr.guesserUsername}</span>
                <span className="points">+{pr.chooserBonus} pts</span>
              </div>
            )}
          </li>
        ))}
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
