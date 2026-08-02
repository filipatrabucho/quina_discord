export default function GuessGrid({ attempts, wordLength, maxAttempts, currentGuess, done }) {
  const rows = [];

  for (let i = 0; i < maxAttempts; i++) {
    if (i < attempts.length) {
      rows.push(<GridRow key={i} letters={attempts[i].feedback} wordLength={wordLength} />);
    } else if (i === attempts.length && !done) {
      rows.push(<CurrentRow key={i} guess={currentGuess} wordLength={wordLength} />);
    } else {
      rows.push(<EmptyRow key={i} wordLength={wordLength} />);
    }
  }

  return <div className="guess-grid">{rows}</div>;
}

function GridRow({ letters, wordLength }) {
  return (
    <div className="grid-row">
      {letters.map((l, i) => (
        <div key={i} className={`tile ${l.status}`}>
          {l.letter.toUpperCase()}
        </div>
      ))}
      {Array.from({ length: Math.max(0, wordLength - letters.length) }).map((_, i) => (
        <div key={`pad-${i}`} className="tile" />
      ))}
    </div>
  );
}

function CurrentRow({ guess, wordLength }) {
  const letters = guess.padEnd(wordLength, ' ').split('').slice(0, wordLength);
  return (
    <div className="grid-row">
      {letters.map((l, i) => (
        <div key={i} className={`tile ${l.trim() ? 'filled' : ''}`}>
          {l.trim().toUpperCase()}
        </div>
      ))}
    </div>
  );
}

function EmptyRow({ wordLength }) {
  return (
    <div className="grid-row">
      {Array.from({ length: wordLength }).map((_, i) => (
        <div key={i} className="tile" />
      ))}
    </div>
  );
}
