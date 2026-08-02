import { useState } from 'react';

export default function ChooseWord({ roundInfo, emit }) {
  const [word, setWord] = useState('');
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

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
        <p className="subtitle-text">À espera que os outros jogadores adivinhem...</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>É a tua vez de escolher a palavra</h2>
      <p className="subtitle-text">
        Escolhe uma palavra de {roundInfo.wordLength} letras em{' '}
        {roundInfo.language === 'pt' ? 'português' : 'inglês'}. Os outros jogadores não a
        vão ver — só o resultado de cada tentativa deles.
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
