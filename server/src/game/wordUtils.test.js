import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidWord, computeFeedback, isWinningFeedback, normalize } from './wordUtils.js';

test('normalize strips accents and lowercases', () => {
  assert.equal(normalize('ÁÇAÍ'), 'acai');
  assert.equal(normalize('Órgão'), 'orgao');
});

test('isValidWord accepts real dictionary words regardless of accents/case', () => {
  assert.equal(isValidWord('abade', 'pt'), true);
  assert.equal(isValidWord('ABADE', 'pt'), true);
  assert.equal(isValidWord('abaci', 'en'), true);
  assert.equal(isValidWord('zzzzz', 'en'), false);
  assert.equal(isValidWord('ab', 'en'), false);
});

test('computeFeedback marks correct/present/absent like Wordle', () => {
  const feedback = computeFeedback('apple', 'plate');
  const statuses = feedback.map((f) => f.status);
  // guess a-p-p-l-e vs secret p-l-a-t-e
  // pos4 'e' matches positionally -> correct; remaining pool from unmatched
  // secret positions: {p:1, l:1, a:1, t:1}
  // i0 'a' -> present, i1 'p' -> present, i2 'p' -> pool exhausted -> absent, i3 'l' -> present
  assert.deepEqual(statuses, ['present', 'present', 'absent', 'present', 'correct']);
});

test('computeFeedback handles duplicate letters correctly', () => {
  // guess 'lilac' vs secret 'llama'
  // secret: l l a m a
  // guess:  l i l a c
  const feedback = computeFeedback('lilac', 'llama');
  const statuses = feedback.map((f) => f.status);
  assert.equal(statuses[0], 'correct'); // l vs l
  assert.equal(statuses[1], 'absent'); // i not in secret
  assert.equal(statuses[3], 'present'); // a in secret elsewhere
});

test('isWinningFeedback true only when all letters correct', () => {
  const win = computeFeedback('plate', 'plate');
  const lose = computeFeedback('apple', 'plate');
  assert.equal(isWinningFeedback(win), true);
  assert.equal(isWinningFeedback(lose), false);
});
