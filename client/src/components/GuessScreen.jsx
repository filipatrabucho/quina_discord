import { useEffect, useMemo, useState } from 'react';
import GuessGrid from './GuessGrid.jsx';
import Keyboard from './Keyboard.jsx';
import OpponentsPanel from './OpponentsPanel.jsx';

const STATUS_RANK = { absent: 0, present: 1, correct: 2 };

export default function GuessScreen({ me, roundInfo, lobbyState, myGuessState, opponents, emit }) {
  const isChooser = me.id === roundInfo.chooserId;
  const wordLength = lobbyState.wordLength;
  const maxAttempts = lobbyState.maxAttempts;

  if (isChooser) {
    return (
      <div className="panel">
        <h2>Palavra em jogo!</h2>
        <p className="subtitle-text">Os outros jogadores estão a tentar adivinhar a tua palavra.</p>
        <OpponentsPanel
          players={lobbyState.players}
          opponents={opponents}
          maxAttempts={maxAttempts}
          excludeIds={[me.id]}
        />
      </div>
    );
  }

  return (
    <GuesserView
      me={me}
      lobbyState={lobbyState}
      roundInfo={roundInfo}
      myGuessState={myGuessState}
      opponents={opponents}
      wordLength={wordLength}
      maxAttempts={maxAttempts}
      emit={emit}
    />
  );
}

function GuesserView({ me, lobbyState, roundInfo, myGuessState, opponents, wordLength, maxAttempts, emit }) {
  const [currentGuess, setCurrentGuess] = useState('');
  const [error, setError] = useState(null);
  const { attempts, done, won } = myGuessState;

  const letterStatus = useMemo(() => {
    const map = {};
    for (const attempt of attempts) {
      for (const { letter, status } of attempt.feedback) {
        if (STATUS_RANK[status] > (STATUS_RANK[map[letter]] ?? -1)) {
          map[letter] = status;
        }
      }
    }
    return map;
  }, [attempts]);

  async function submitGuess(guess) {
    setError(null);
    const ack = await emit('guess:submit', { guess });
    if (!ack?.ok) {
      setError(translateError(ack?.error));
    }
  }

  function handleKey(key) {
    if (done) return;
    if (key === 'ENTER') {
      if (currentGuess.length !== wordLength) {
        setError(`A palavra tem de ter ${wordLength} letras.`);
        return;
      }
      submitGuess(currentGuess);
      setCurrentGuess('');
    } else if (key === 'BACKSPACE') {
      setCurrentGuess((g) => g.slice(0, -1));
    } else if (currentGuess.length < wordLength) {
      setCurrentGuess((g) => g + key);
    }
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (done) return;
      if (e.key === 'Enter') handleKey('ENTER');
      else if (e.key === 'Backspace') handleKey('BACKSPACE');
      else if (/^[a-zA-ZçÇãÃõÕáÁéÉíÍóÓúÚâÂêÊôÔàÀ]$/.test(e.key)) handleKey(e.key.toLowerCase());
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGuess, done, wordLength]);

  return (
    <div className="panel">
      <h2>Adivinha a palavra</h2>
      <GuessGrid
        attempts={attempts}
        wordLength={wordLength}
        maxAttempts={maxAttempts}
        currentGuess={currentGuess}
        done={done}
      />
      {error && <p className="error-text">{error}</p>}
      {done && (
        <p className={won ? 'success-text' : 'subtitle-text'}>
          {won ? 'Acertaste! 🎉' : 'Esgotaste as tentativas. À espera dos outros jogadores...'}
        </p>
      )}
      <Keyboard language={roundInfo.language} letterStatus={letterStatus} onKey={handleKey} />
      <OpponentsPanel
        players={lobbyState.players}
        opponents={opponents}
        maxAttempts={maxAttempts}
        excludeIds={[me.id, roundInfo.chooserId]}
      />
    </div>
  );
}

function translateError(code) {
  if (code === 'invalid_word') return 'Essa palavra não existe no dicionário.';
  if (code === 'already_done') return 'Já terminaste esta ronda.';
  return 'Não foi possível enviar a tentativa.';
}
