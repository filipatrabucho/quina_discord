import {
  WORD_LENGTH,
  MAX_ATTEMPTS,
  SUPPORTED_LANGUAGES,
  isValidWord,
  canonicalize,
  computeFeedback,
  isWinningFeedback,
  getRandomWord,
} from './wordUtils.js';

const WIN_POINTS_BY_ATTEMPT = [null, 60, 50, 40, 30, 20, 10]; // index = attempts used (1-6)
const FIRST_SOLVER_BONUS = 20;
const CHOOSER_STUMP_BONUS = 15;
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 10;
const DEFAULT_ROUNDS = 3;

/**
 * Everyone plays every round: each player simultaneously picks a secret word
 * for one target (a circular assignment that rotates offset each round so
 * pairings vary), then everyone guesses the word chosen for them at the same
 * time, watching each other's live progress.
 */
export class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = new Map(); // playerId -> { id, username, avatar, connected, score }
    this.hostId = null;
    this.order = [];
    this.settings = { language: 'pt', roundsCount: DEFAULT_ROUNDS };
    this.phase = 'lobby'; // lobby | choosing | guessing | round_end | game_end
    this.currentRoundIndex = -1;
    this.chooserToGuesser = new Map();
    this.guesserToChooser = new Map();
    this.words = new Map(); // chooserId -> secret word chosen for their target
    this.guesses = new Map(); // guesserId -> { attempts, won, done, wonAt }
    this.roundSolveOrderCounter = 0;
  }

  get playerList() {
    return [...this.players.values()];
  }

  addPlayer({ id, username, avatar }) {
    const existing = this.players.get(id);
    if (existing) {
      existing.connected = true;
      existing.username = username ?? existing.username;
      existing.avatar = avatar ?? existing.avatar;
      return existing;
    }
    const player = { id, username, avatar, connected: true, score: 0 };
    this.players.set(id, player);
    if (!this.hostId) this.hostId = id;
    if (!this.order.includes(id)) this.order.push(id);
    return player;
  }

  // A disconnect can unblock whatever the room was waiting on (e.g. everyone
  // else had already submitted a word, or already finished guessing). Tells
  // the caller which transition just happened so it can broadcast it.
  markDisconnected(playerId) {
    const player = this.players.get(playerId);
    if (player) player.connected = false;

    if (this.phase === 'choosing' && this.tryCompleteChoosingPhase()) {
      return { choosingCompleted: true };
    }
    if (this.phase === 'guessing' && this.isRoundComplete()) {
      return { roundCompleted: true };
    }
    return {};
  }

  setLanguage(language) {
    if (!SUPPORTED_LANGUAGES.includes(language)) throw new Error('invalid_language');
    if (this.phase !== 'lobby' && this.phase !== 'game_end') throw new Error('game_in_progress');
    this.settings.language = language;
  }

  setRoundsCount(count) {
    const n = Number(count);
    if (!Number.isInteger(n) || n < MIN_ROUNDS || n > MAX_ROUNDS) throw new Error('invalid_rounds_count');
    if (this.phase !== 'lobby' && this.phase !== 'game_end') throw new Error('game_in_progress');
    this.settings.roundsCount = n;
  }

  canStart() {
    const phaseOk = this.phase === 'lobby' || this.phase === 'game_end';
    return phaseOk && this.playerList.filter((p) => p.connected).length >= 2;
  }

  totalRounds() {
    return this.settings.roundsCount;
  }

  startGame() {
    if (!this.canStart()) throw new Error('cannot_start');
    this.currentRoundIndex = -1;
    for (const p of this.players.values()) p.score = 0;
    return this.advanceRound();
  }

  advanceRound() {
    this.currentRoundIndex += 1;
    if (this.currentRoundIndex >= this.totalRounds()) {
      this.phase = 'game_end';
      return { type: 'game_end', scoreboard: this.scoreboard(), winnerId: this.winnerId() };
    }

    this.phase = 'choosing';
    this.words = new Map();
    this.guesses = new Map();
    this.roundSolveOrderCounter = 0;

    const n = this.order.length;
    const offset = n > 1 ? 1 + (this.currentRoundIndex % (n - 1)) : 0;
    this.chooserToGuesser = new Map();
    this.guesserToChooser = new Map();

    for (let i = 0; i < n; i++) {
      const chooserId = this.order[i];
      const guesserId = this.order[(i + offset) % n];
      this.chooserToGuesser.set(chooserId, guesserId);
      this.guesserToChooser.set(guesserId, chooserId);
      this.guesses.set(guesserId, { attempts: [], won: false, done: false, wonAt: null });
    }

    return {
      type: 'round_started',
      round: this.currentRoundIndex + 1,
      totalRounds: this.totalRounds(),
      assignments: [...this.chooserToGuesser.entries()].map(([chooserId, targetId]) => ({
        chooserId,
        targetId,
      })),
      language: this.settings.language,
      wordLength: WORD_LENGTH,
    };
  }

  submitWord(playerId, word) {
    if (this.phase !== 'choosing') throw new Error('not_choosing_phase');
    if (!this.chooserToGuesser.has(playerId)) throw new Error('not_a_chooser');
    if (this.words.has(playerId)) throw new Error('already_submitted');
    if (!isValidWord(word, this.settings.language)) throw new Error('invalid_word');

    this.words.set(playerId, canonicalize(word, this.settings.language));
    const allReady = this.tryCompleteChoosingPhase();

    return allReady
      ? { type: 'word_ready', wordLength: WORD_LENGTH }
      : { type: 'waiting_for_others', submitted: this.words.size, total: this.chooserToGuesser.size };
  }

  // Fills in a random dictionary word for any chooser who disconnected before
  // submitting, so the round isn't stuck waiting on someone who left. Once
  // every chooser has a word (submitted or auto-filled), flips to 'guessing'.
  tryCompleteChoosingPhase() {
    if (this.phase !== 'choosing') return this.phase !== 'choosing';
    for (const chooserId of this.chooserToGuesser.keys()) {
      if (this.words.has(chooserId)) continue;
      const chooser = this.players.get(chooserId);
      if (!chooser?.connected) {
        this.words.set(chooserId, getRandomWord(this.settings.language));
      } else {
        return false;
      }
    }
    this.phase = 'guessing';
    return true;
  }

  submitGuess(playerId, guess) {
    if (this.phase !== 'guessing') throw new Error('not_guessing_phase');
    const chooserId = this.guesserToChooser.get(playerId);
    const secretWord = chooserId && this.words.get(chooserId);
    const state = this.guesses.get(playerId);
    if (!state || !secretWord) throw new Error('not_a_guesser');
    if (state.done) throw new Error('already_done');
    if (!isValidWord(guess, this.settings.language)) throw new Error('invalid_word');

    const feedback = computeFeedback(guess, secretWord);
    const won = isWinningFeedback(feedback);
    state.attempts.push({ guess: canonicalize(guess, this.settings.language), feedback });
    state.won = won;
    state.done = won || state.attempts.length >= MAX_ATTEMPTS;
    if (won) {
      this.roundSolveOrderCounter += 1;
      state.wonAt = this.roundSolveOrderCounter;
    }

    const result = {
      type: 'guess_result',
      playerId,
      attempts: state.attempts,
      done: state.done,
      won: state.won,
      maxAttempts: MAX_ATTEMPTS,
    };

    const progress = {
      type: 'opponent_progress',
      playerId,
      attemptsUsed: state.attempts.length,
      done: state.done,
      won: state.won,
    };

    return { result, progress, roundComplete: this.isRoundComplete() };
  }

  isRoundComplete() {
    for (const [playerId, state] of this.guesses) {
      const player = this.players.get(playerId);
      if (!state.done && player?.connected) return false;
    }
    return true;
  }

  endRound() {
    this.phase = 'round_end';
    const pairings = [];

    for (const [chooserId, guesserId] of this.chooserToGuesser) {
      const state = this.guesses.get(guesserId);
      const secretWord = this.words.get(chooserId);
      let guesserPoints = 0;

      if (state.won) {
        const attemptsUsed = state.attempts.length;
        guesserPoints = WIN_POINTS_BY_ATTEMPT[attemptsUsed] ?? 10;
        if (state.wonAt === 1) guesserPoints += FIRST_SOLVER_BONUS;
      }

      const chooserBonus = state.won ? 0 : CHOOSER_STUMP_BONUS;

      const guesserPlayer = this.players.get(guesserId);
      const chooserPlayer = this.players.get(chooserId);
      if (guesserPlayer) guesserPlayer.score += guesserPoints;
      if (chooserPlayer) chooserPlayer.score += chooserBonus;

      pairings.push({
        chooserId,
        chooserUsername: chooserPlayer?.username ?? '???',
        guesserId,
        guesserUsername: guesserPlayer?.username ?? '???',
        secretWord,
        won: state.won,
        attempts: state.attempts.length,
        guesserPoints,
        chooserBonus,
      });
    }

    return {
      type: 'round_ended',
      pairings,
      scoreboard: this.scoreboard(),
      isFinalRound: this.currentRoundIndex + 1 >= this.totalRounds(),
    };
  }

  scoreboard() {
    return this.playerList
      .map((p) => ({ playerId: p.id, username: p.username, avatar: p.avatar, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  winnerId() {
    const board = this.scoreboard();
    return board.length ? board[0].playerId : null;
  }

  isEmpty() {
    return this.playerList.every((p) => !p.connected);
  }

  publicState() {
    return {
      phase: this.phase,
      players: this.playerList,
      hostId: this.hostId,
      settings: this.settings,
      round: this.currentRoundIndex + 1,
      totalRounds: this.totalRounds(),
      wordLength: WORD_LENGTH,
      maxAttempts: MAX_ATTEMPTS,
      scoreboard: this.scoreboard(),
    };
  }
}
