import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

import { discordAuthRouter } from './discordAuth.js';
import { RoomManager } from './game/RoomManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const rooms = new RoomManager();

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', discordAuthRouter);

const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const socketMeta = new Map(); // socket.id -> { roomId, playerId }

function broadcastState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit('lobby:state', room.publicState());
}

io.on('connection', (socket) => {
  socket.on('lobby:join', ({ roomId, player }, ack) => {
    try {
      if (!roomId || !player?.id) throw new Error('invalid_join');
      const room = rooms.getOrCreate(roomId);
      room.addPlayer(player);
      socket.join(roomId);
      socketMeta.set(socket.id, { roomId, playerId: player.id });
      ack?.({ ok: true, state: room.publicState() });
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
      } else if (event.type === 'round_ended') {
        io.to(meta.roomId).emit('round:ended', event);
        maybeAdvanceOrFinish(meta.roomId, room);
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
        maybeAdvanceOrFinish(meta.roomId, room);
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
    io.to(meta.roomId).emit(event.type === 'game_end' ? 'game:ended' : 'round:started', event);
    broadcastState(meta.roomId);
  });

  socket.on('disconnect', () => {
    const meta = socketMeta.get(socket.id);
    if (!meta) return;
    socketMeta.delete(socket.id);
    const room = rooms.get(meta.roomId);
    if (!room) return;
    room.markDisconnected(meta.playerId);
    broadcastState(meta.roomId);
    rooms.removeIfEmpty(meta.roomId);
  });
});

function maybeAdvanceOrFinish(roomId, room) {
  // Round results stay on screen until players are ready; the client
  // triggers the next round via 'game:nextRound'. Nothing to do here yet,
  // this hook exists for future auto-advance/timer logic.
  void roomId;
  void room;
}

server.listen(PORT, () => {
  console.log(`Quina server listening on port ${PORT}`);
});
