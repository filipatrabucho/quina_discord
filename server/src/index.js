import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

import { discordAuthRouter } from './discordAuth.js';
import { RoomManager } from './game/RoomManager.js';
import { PlayerStore } from './persistence/playerStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const rooms = new RoomManager();
const playerStore = new PlayerStore();

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', discordAuthRouter);

const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const socketMeta = new Map(); // socket.id -> { roomId, playerId }

function withProfiles(state) {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, profile: playerStore.getProfile(p.id) })),
  };
}

function broadcastState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit('lobby:state', withProfiles(room.publicState()));
}

io.on('connection', (socket) => {
  socket.on('lobby:join', ({ roomId, player }, ack) => {
    try {
      if (!roomId || !player?.id) throw new Error('invalid_join');
      const room = rooms.getOrCreate(roomId);
      room.addPlayer(player);
      socket.join(roomId);
      socketMeta.set(socket.id, { roomId, playerId: player.id });
      ack?.({ ok: true, state: withProfiles(room.publicState()) });
      broadcastState(roomId);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('lobby:setLanguage', ({ language }, ack) => {
    const meta = socketMeta.get(socket.id);
    const room = meta && rooms.get(meta.roomId);
    if (!room) return ack?.({ ok: false, error: 'no_room' });
    try {
      room.setLanguage(language);
      ack?.({ ok: true });
      broadcastState(meta.roomId);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('lobby:setRoundsCount', ({ roundsCount }, ack) => {
    const meta = socketMeta.get(socket.id);
    const room = meta && rooms.get(meta.roomId);
    if (!room) return ack?.({ ok: false, error: 'no_room' });
    try {
      room.setRoundsCount(roundsCount);
      ack?.({ ok: true });
      broadcastState(meta.roomId);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('game:start', (_payload, ack) => {
    const meta = socketMeta.get(socket.id);
    const room = meta && rooms.get(meta.roomId);
    if (!room) return ack?.({ ok: false, error: 'no_room' });
    try {
      const event = room.startGame();
      ack?.({ ok: true });
      io.to(meta.roomId).emit('round:started', event);
      broadcastState(meta.roomId);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('word:submit', ({ word }, ack) => {
    const meta = socketMeta.get(socket.id);
    const room = meta && rooms.get(meta.roomId);
    if (!room) return ack?.({ ok: false, error: 'no_room' });
    try {
      const event = room.submitWord(meta.playerId, word);
      ack?.({ ok: true });
      if (event.type === 'word_ready') {
        io.to(meta.roomId).emit('round:wordReady', event);
      } else {
        io.to(meta.roomId).emit('round:choosingProgress', event);
      }
      broadcastState(meta.roomId);
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('guess:submit', ({ guess }, ack) => {
    const meta = socketMeta.get(socket.id);
    const room = meta && rooms.get(meta.roomId);
    if (!room) return ack?.({ ok: false, error: 'no_room' });
    try {
      const { result, progress, roundComplete } = room.submitGuess(meta.playerId, guess);
      socket.emit('guess:result', result);
      socket.to(meta.roomId).emit('opponent:progress', progress);
      ack?.({ ok: true });

      if (roundComplete) {
        const endEvent = room.endRound();
        io.to(meta.roomId).emit('round:ended', endEvent);
        broadcastState(meta.roomId);
      }
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('game:nextRound', (_payload, ack) => {
    const meta = socketMeta.get(socket.id);
    const room = meta && rooms.get(meta.roomId);
    if (!room) return ack?.({ ok: false, error: 'no_room' });
    if (room.phase !== 'round_end') return ack?.({ ok: false, error: 'not_round_end' });
    const event = room.advanceRound();
    ack?.({ ok: true });
    if (event.type === 'game_end') {
      playerStore.recordGameResult(event.scoreboard, event.winnerId);
      io.to(meta.roomId).emit('game:ended', { ...event, leaderboard: playerStore.topPlayers() });
    } else {
      io.to(meta.roomId).emit('round:started', event);
    }
    broadcastState(meta.roomId);
  });

  socket.on('profile:leaderboard', (_payload, ack) => {
    ack?.({ ok: true, leaderboard: playerStore.topPlayers() });
  });

  socket.on('disconnect', () => {
    const meta = socketMeta.get(socket.id);
    if (!meta) return;
    socketMeta.delete(socket.id);
    const room = rooms.get(meta.roomId);
    if (!room) return;

    const { choosingCompleted, roundCompleted } = room.markDisconnected(meta.playerId);
    if (choosingCompleted) {
      io.to(meta.roomId).emit('round:wordReady', { type: 'word_ready' });
    }
    if (roundCompleted) {
      const endEvent = room.endRound();
      io.to(meta.roomId).emit('round:ended', endEvent);
    }
    broadcastState(meta.roomId);
    rooms.removeIfEmpty(meta.roomId);
  });
});

server.listen(PORT, () => {
  console.log(`Quina server listening on port ${PORT}`);
});
