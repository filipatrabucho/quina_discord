import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom } from './GameRoom.js';

function makeRoomWithPlayers() {
  const room = new GameRoom('room1');
  room.addPlayer({ id: 'p1', username: 'Ana', avatar: null });
  room.addPlayer({ id: 'p2', username: 'Bruno', avatar: null });
  room.setLanguage('en');
  return room;
}

test('full round flow: choose word, guess, end round, advance', () => {
  const room = makeRoomWithPlayers();
  const started = room.startGame();
  assert.equal(started.type, 'round_started');
  assert.equal(started.chooserId, 'p1');
  assert.equal(room.phase, 'choosing');

  const wordReady = room.submitWord('p1', 'apple');
  assert.equal(wordReady.type, 'word_ready');
  assert.equal(room.phase, 'guessing');

  // wrong guest attempt then correct
  const { progress: p1, roundComplete: rc1 } = room.submitGuess('p2', 'plate');
  assert.equal(p1.won, false);
  assert.equal(rc1, false);

  const { result, roundComplete } = room.submitGuess('p2', 'apple');
  assert.equal(result.won, true);
  assert.equal(roundComplete, true);

  const ended = room.endRound();
  assert.equal(ended.type, 'round_ended');
  assert.equal(ended.secretWord, 'apple');
  const p2Result = ended.results.find((r) => r.playerId === 'p2');
  assert.equal(p2Result.won, true);
  assert.equal(p2Result.attempts, 2);
  assert.ok(p2Result.points > 0);
  assert.equal(ended.isFinalRound, false);

  const next = room.advanceRound();
  assert.equal(next.type, 'round_started');
  assert.equal(next.chooserId, 'p2'); // rotates to the other player
});

test('rejects word submission from non-chooser', () => {
  const room = makeRoomWithPlayers();
  room.startGame();
  assert.throws(() => room.submitWord('p2', 'apple'), /not_your_turn/);
});

test('rejects invalid dictionary words', () => {
  const room = makeRoomWithPlayers();
  room.startGame();
  assert.throws(() => room.submitWord('p1', 'zzzzz'), /invalid_word/);
});

test('running out of attempts marks guesser done without winning', () => {
  const room = makeRoomWithPlayers();
  room.startGame();
  room.submitWord('p1', 'apple');
  let roundComplete = false;
  for (let i = 0; i < 6; i++) {
    ({ roundComplete } = room.submitGuess('p2', 'plate'));
  }
  assert.equal(roundComplete, true);
  const ended = room.endRound();
  const p2Result = ended.results.find((r) => r.playerId === 'p2');
  assert.equal(p2Result.won, false);
  assert.equal(p2Result.points, 0);
  assert.equal(ended.chooserBonus, 15);
});

test('game ends after each player has been chooser once by default', () => {
  const room = makeRoomWithPlayers();
  room.startGame(); // round 1, p1 chooses
  room.submitWord('p1', 'apple');
  room.submitGuess('p2', 'apple');
  room.endRound();
  const next = room.advanceRound(); // round 2, p2 chooses
  assert.equal(next.chooserId, 'p2');
  room.submitWord('p2', 'plate');
  room.submitGuess('p1', 'plate');
  room.endRound();
  const finish = room.advanceRound();
  assert.equal(finish.type, 'game_end');
  assert.ok(finish.scoreboard.length === 2);
});
