import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WORD_LISTS = {
  pt: JSON.parse(fs.readFileSync(path.join(__dirname, '../data/words_pt.json'), 'utf-8')),
  en: JSON.parse(fs.readFileSync(path.join(__dirname, '../data/words_en.json'), 'utf-8')),
};

const WORD_SETS = {
  pt: new Set(WORD_LISTS.pt),
  en: new Set(WORD_LISTS.en),
};

export const WORD_LENGTH = 5;
export const MAX_ATTEMPTS = 6;
export const SUPPORTED_LANGUAGES = ['pt', 'en'];

export function normalize(word) {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// Portuguese dictionary keeps accented letters; build a lookup from normalized -> canonical
const NORMALIZED_LOOKUP = {
  pt: buildNormalizedLookup(WORD_LISTS.pt),
  en: buildNormalizedLookup(WORD_LISTS.en),
};

function buildNormalizedLookup(list) {
  const map = new Map();
  for (const w of list) {
    const key = normalize(w);
    if (!map.has(key)) map.set(key, w);
  }
  return map;
}

export function isValidWord(word, language) {
  if (typeof word !== 'string') return false;
  const key = normalize(word);
  if (key.length !== WORD_LENGTH) return false;
  const lookup = NORMALIZED_LOOKUP[language];
  if (!lookup) return false;
  return lookup.has(key);
}

export function canonicalize(word, language) {
  const key = normalize(word);
  const lookup = NORMALIZED_LOOKUP[language];
  return lookup?.get(key) ?? word;
}

/**
 * Computes Wordle-style per-letter feedback, comparing normalized (accent-stripped)
 * letters so players don't need to type accents. Handles duplicate letters the
 * same way Wordle does (limited by remaining count in the secret word).
 * Returns an array of { letter, status } where status is 'correct' | 'present' | 'absent'.
 */
export function computeFeedback(guess, secret) {
  const guessLetters = normalize(guess).split('');
  const secretLetters = normalize(secret).split('');
  const result = new Array(guessLetters.length).fill(null);
  const remaining = {};

  for (let i = 0; i < secretLetters.length; i++) {
    if (guessLetters[i] === secretLetters[i]) {
      result[i] = 'correct';
    } else {
      remaining[secretLetters[i]] = (remaining[secretLetters[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < guessLetters.length; i++) {
    if (result[i]) continue;
    const letter = guessLetters[i];
    if (remaining[letter] > 0) {
      result[i] = 'present';
      remaining[letter] -= 1;
    } else {
      result[i] = 'absent';
    }
  }

  return guessLetters.map((letter, i) => ({ letter, status: result[i] }));
}

export function isWinningFeedback(feedback) {
  return feedback.every((f) => f.status === 'correct');
}

export function getRandomWord(language) {
  const list = WORD_LISTS[language];
  return list[Math.floor(Math.random() * list.length)];
}
