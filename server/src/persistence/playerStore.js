import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, '../data/players.json');

const XP_PER_LEVEL = 200;

function loadFromDisk() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveToDisk(data) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to persist player store:', err);
  }
}

export class PlayerStore {
  constructor() {
    this.data = loadFromDisk();
  }

  getProfile(playerId) {
    const entry = this.data[playerId] ?? { totalXp: 0, gamesPlayed: 0, wins: 0 };
    return { ...entry, ...levelInfo(entry.totalXp) };
  }

  // Adds each player's final match score to their lifetime XP, bumps games
  // played, and credits the top scorer with a win. Persists immediately —
  // game-end events are infrequent, so there's no need to batch writes.
  recordGameResult(scoreboard, winnerId) {
    for (const entry of scoreboard) {
      const current = this.data[entry.playerId] ?? { totalXp: 0, gamesPlayed: 0, wins: 0 };
      current.totalXp += entry.score;
      current.gamesPlayed += 1;
      current.username = entry.username;
      current.avatar = entry.avatar;
      if (entry.playerId === winnerId) current.wins += 1;
      this.data[entry.playerId] = current;
    }
    saveToDisk(this.data);
  }

  topPlayers(limit = 10) {
    return Object.entries(this.data)
      .map(([playerId, entry]) => ({ playerId, username: entry.username, avatar: entry.avatar, ...entry, ...levelInfo(entry.totalXp) }))
      .sort((a, b) => b.totalXp - a.totalXp)
      .slice(0, limit);
  }
}

function levelInfo(totalXp) {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = totalXp % XP_PER_LEVEL;
  return { level, xpIntoLevel, xpForNextLevel: XP_PER_LEVEL };
}
