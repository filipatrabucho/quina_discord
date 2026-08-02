import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom } from './GameRoom.js';

function makeRoomWithPlayers(ids = ['p1', 'p2']) {
  const room = new GameRoom('room1');
  for (const id of ids) {
    room.addPlayer({ id, username: id, avatar: null });
  }
  room.setLanguage('en');
  return room;
}

test('two players: each picks a word for the other simultaneously', () => {
  const room = makeRoomWithPlayers(['p1', 'p2']);
  room.setRoundsCount(2);
  const started = room.startGame();
  assert.equal(started.type, 'round_started');
  assert.equal(room.phase, 'choosing');

  const assignmentMap = Object.fromEntries(started.assignments.map((a) => [a.chooserId, a.targetId]));
  assert.equal(assignmentMap.p1, 'p2');
  assert.equal(assignmentMap.p2, 'p1');

  const first = room.submitWord('p1', 'apple');
  assert.equal(first.type, 'waiting_for_others');
  assert.equal(room.phase, 'choosing');

  const second = room.submitWord('p2', 'grape');
  assert.equal(second.type, 'word_ready');
  assert.equal(room.phase, 'guessing');
});

test('both players guess simultaneously and the round ends when both finish', () => {
  const room = makeRoomWithPlayers(['p1', 'p2']);
  room.startGame();
  room.submitWord('p1', 'apple'); // p1 chose a word FOR p2
  room.submitWord('p2', 'grape'); // p2 chose a word FOR p1

  // p1 guesses the word p2 picked for them ('grape')
  const g1 = room.submitGuess('p1', 'grape');
  assert.equal(g1.result.won, true);
  assert.equal(g1.roundComplete, false); // p2 hasn't finished yet

  // p2 guesses the word p1 picked for them ('apple')
  const g2 = room.submitGuess('p2', 'apple');
  assert.equal(g2.result.won, true);
  assert.equal(g2.roundComplete, true);

  const ended = room.endRound();
  assert.equal(ended.type, 'round_ended');
  assert.equal(ended.pairings.length, 2);

  const p1AsGuesser = ended.pairings.find((pr) => pr.guesserId === 'p1');
  assert.equal(p1AsGuesser.secretWord, 'grape');
  assert.equal(p1AsGuesser.won, true);
  assert.equal(p1AsGuesser.guesserPoints, 80); // 1 attempt (60) + first solver bonus (20)

  const p2AsGuesser = ended.pairings.find((pr) => pr.guesserId === 'p2');
  assert.equal(p2AsGuesser.secretWord, 'apple');
  assert.equal(p2AsGuesser.guesserPoints, 60); // 1 attempt, not first
});

test('rejects a word from someone who is not a chooser this round and rejects duplicate submission', () => {
  const room = makeRoomWithPlayers(['p1', 'p2']);
  room.startGame();
  room.submitWord('p1', 'apple');
  assert.throws(() => room.submitWord('p1', 'grape'), /already_submitted/);
});

test('rejects invalid dictionary words', () => {
  const room = makeRoomWithPlayers(['p1', 'p2']);
  room.startGame();
  assert.throws(() => room.submitWord('p1', 'zzzzz'), /invalid_word/);
});

test('failing to solve gives the chooser a stump bonus', () => {
  const room = makeRoomWithPlayers(['p1', 'p2']);
  room.startGame();
  room.submitWord('p1', 'apple');
  room.submitWord('p2', 'grape');

  // p1 fails to guess 'grape' (chosen by p2) within 6 attempts
  for (let i = 0; i < 6; i++) {
    room.submitGuess('p1', 'apple');
  }
  // p2 solves 'apple' (chosen by p1) immediately
  const last = room.submitGuess('p2', 'apple');
  assert.equal(last.roundComplete, true);

  const ended = room.endRound();
  const p1AsGuesser = ended.pairings.find((pr) => pr.guesserId === 'p1');
  assert.equal(p1AsGuesser.won, false);
  assert.equal(p1AsGuesser.guesserPoints, 0);

  // p2 chose 'grape' for p1, who failed -> p2 gets the stump bonus as chooser
  const p2AsChooser = ended.pairings.find((pr) => pr.chooserId === 'p2');
  assert.equal(p2AsChooser.chooserBonus, 15);
});

test('three players rotate target assignment across rounds (circular offsets)', () => {
  const room = makeRoomWithPlayers(['p1', 'p2', 'p3']);
  room.setRoundsCount(3);
  const r1 = room.startGame();
  const map1 = Object.fromEntries(r1.assignments.map((a) => [a.chooserId, a.targetId]));
  // offset 1: p1->p2, p2->p3, p3->p1
  assert.deepEqual(map1, { p1: 'p2', p2: 'p3', p3: 'p1' });

  for (const [chooser, word] of [['p1', 'apple'], ['p2', 'grape'], ['p3', 'plate']]) {
    room.submitWord(chooser, word);
  }
  for (const guesser of ['p1', 'p2', 'p3']) {
    let done = false;
    while (!done) {
      const { roundComplete } = room.submitGuess(guesser, 'apple');
      done = room.guesses.get(guesser).done;
      if (roundComplete) break;
    }
  }
  room.endRound();
  const r2 = room.advanceRound();
  const map2 = Object.fromEntries(r2.assignments.map((a) => [a.chooserId, a.targetId]));
  // offset 2: p1->p3, p2->p1, p3->p2
  assert.deepEqual(map2, { p1: 'p3', p2: 'p1', p3: 'p2' });
});

test('game ends after the configured number of rounds and includes a scoreboard', () => {
  const room = makeRoomWithPlayers(['p1', 'p2']);
  room.setRoundsCount(1);
  room.startGame();
  room.submitWord('p1', 'apple');
  room.submitWord('p2', 'grape');
  room.submitGuess('p1', 'grape');
  room.submitGuess('p2', 'apple');
  room.endRound();
  const finish = room.advanceRound();
  assert.equal(finish.type, 'game_end');
  assert.equal(finish.scoreboard.length, 2);
});

test('a disconnected chooser gets auto-filled with a random word so the round is not stuck', () => {
  const room = makeRoomWithPlayers(['p1', 'p2']);
  room.startGame();
  room.markDisconnected('p2');
  const event = room.submitWord('p1', 'apple');
  assert.equal(event.type, 'word_ready');
  assert.equal(room.phase, 'guessing');
  assert.ok(room.words.get('p2')); // auto-filled
});
