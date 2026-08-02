export default function OpponentsPanel({ players, opponents, maxAttempts, excludeIds = [] }) {
  const others = players.filter((p) => !excludeIds.includes(p.id) && p.connected);
  if (others.length === 0) return null;

  return (
    <div className="opponents-panel">
      <h3>Outros jogadores</h3>
      <ul>
        {others.map((p) => {
          const progress = opponents[p.id];
          const attemptsUsed = progress?.attemptsUsed ?? 0;
          const done = progress?.done ?? false;
          const won = progress?.won ?? false;
          return (
            <li key={p.id}>
              <span className="opponent-name">{p.username}</span>
              <span className="opponent-dots">
                {Array.from({ length: maxAttempts }).map((_, i) => (
                  <span key={i} className={`dot ${i < attemptsUsed ? 'used' : ''}`} />
                ))}
              </span>
              {done && <span className={`badge ${won ? 'success' : 'muted'}`}>{won ? 'acertou!' : 'esgotou tentativas'}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
