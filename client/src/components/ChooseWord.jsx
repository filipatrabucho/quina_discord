import { useState } from 'react';

export default function ChooseWord({ me, roundInfo, lobbyState, choosingProgress, emit }) {
  const [word, setWord] = useState('');
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const myAssignment = roundInfo.assignments.find((a) => a.chooserId === me.id);
  const target = lobbyState.players.find((p) => p.id === myAssignment?.targetId);
  const totalPlayers = roundInfo.assignments.length;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const ack = await emit('word:submit', { word });
    if (ack?.ok) {
      setSubmitted(true);
    } else {
      setError(translateError(ack?.error));
    }
  }

  if (submitted) {
    return (
      <div className="panel centered">
        <h2>Palavra escolhida!</h2>
        <p className="subtitle-text">
          À espera que os outros jogadores escolham a palavra deles
          {choosingProgress ? ` (${choosingProgress.submitted}/${choosingProgress.total})` : '...'}
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Escolhe uma palavra para {target?.username ?? 'o próximo jogador'}</h2>
      <p className="subtitle-text">
        Uma palavra de {roundInfo.wordLength} letras em{' '}
        {roundInfo.language === 'pt' ? 'português' : 'inglês'}. {target?.username ?? 'Ele/ela'} não a
        vai ver, só o resultado de cada tentativa. Todos escolhem ao mesmo tempo
        {totalPlayers > 2 ? ` (${totalPlayers} jogadores nesta ronda)` : ''}.
      </p>
      <form className="join-form" onSubmit={handleSubmit}>
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          maxLength={roundInfo.wordLength}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {error && <p className="error-text">{error}</p>}
        <button type="submit">Confirmar palavra</button>
      </form>
    </div>
  );
}

function translateError(code) {
  if (code === 'invalid_word') return 'Essa palavra não existe no dicionário ou não tem o tamanho certo.';
  return 'Não foi possível confirmar a palavra. Tenta novamente.';
}
