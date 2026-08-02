import { useState } from 'react';
import Leaderboard from './Leaderboard.jsx';

export default function ProfileHeader({ player, emit }) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const profile = player?.profile ?? { level: 1, xpIntoLevel: 0, xpForNextLevel: 200, totalXp: 0 };
  const progress = Math.round((profile.xpIntoLevel / profile.xpForNextLevel) * 100);

  return (
    <>
      <button className="profile-chip" onClick={() => setShowLeaderboard(true)}>
        <span
          className="profile-avatar-ring"
          style={{ '--progress': `${progress}%` }}
        >
          {player?.avatar ? (
            <img className="profile-avatar" src={player.avatar} alt="" />
          ) : (
            <span className="profile-avatar profile-avatar-fallback">
              {(player?.username ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
          <span className="profile-level-badge">{profile.level}</span>
        </span>
        <span className="profile-info">
          <span className="profile-name">{player?.username}</span>
          <span className="profile-xp">{profile.totalXp} XP</span>
        </span>
      </button>

      {showLeaderboard && (
        <Leaderboard emit={emit} onClose={() => setShowLeaderboard(false)} />
      )}
    </>
  );
}
