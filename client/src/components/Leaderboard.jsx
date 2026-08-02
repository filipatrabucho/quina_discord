import { useEffect, useState } from 'react';

export default function Leaderboard({ emit, onClose }) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    let cancelled = false;
    emit('profile:leaderboard').then((ack) => {
      if (!cancelled && ack?.ok) setEntries(ack.leaderboard);
    });
    return () => {
      cancelled = true;
    };
  }, [emit]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Classificação global</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {!entries ? (
          <p className="subtitle-text">A carregar...</p>
        ) : entries.length === 0 ? (
          <p className="subtitle-text">Ainda ninguém jogou nenhuma partida.</p>
        ) : (
          <ol className="leaderboard-list">
            {entries.map((entry, i) => (
              <li key={entry.playerId}>
                <span className="leaderboard-rank">#{i + 1}</span>
                {entry.avatar ? (
                  <img className="avatar" src={entry.avatar} alt="" />
                ) : (
                  <span className="avatar avatar-fallback">{(entry.username ?? '?').charAt(0).toUpperCase()}</span>
                )}
                <span className="leaderboard-name">{entry.username}</span>
                <span className="leaderboard-level">Nv. {entry.level}</span>
                <span className="leaderboard-xp">{entry.totalXp} XP</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
