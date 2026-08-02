import {
  WORD_LENGTH,
  MAX_ATTEMPTS,
  SUPPORTED_LANGUAGES,
  isValidWord,
  canonicalize,
  computeFeedback,
  isWinningFeedback,
} from './wordUtils.js';

const WIN_POINTS_BY_ATTEMPT = [null, 60, 50, 40, 30, 20, 10]; // index = attempts used (1-6)
const FIRST_SOLVER_BONUS = 20;
const CHOOSER_STUMP_BONUS = 15; // per guesser who failed to solve the word

export class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = new Map(); // playerId -> { id, username, avatar, connected, score }
    this.hostId = null;
    this.order = [];
    this.settings = { language: 'pt', roundsPerPlayer: 1 };
    this.phase = 'lobby'; // lobby | choosing | guessing | round_end | game_end
    this.currentRoundIndex = -1;
    this.currentChooserId = null;
    this.secretWord = null;
    this.guesses = new Map(); // playerId -> { attempts: [{guess, feedback}], won, done, wonAt }
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
    if (this.phase === 'lobby') {
      this.order.push(id);
    } else if (!this.order.includes(id)) {
      // Late joiners are queued in for future rounds, not the one in progress.
      this.order.push(id);
    }
    return player;
  }

  markDisconnected(playerId) {
    const player = this.players.get(playerId);
    if (player) player.connected = false;
  }

  setLanguage(language) {
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      throw new Error('invalid_language');
    }
    if (this.phase !== 'lobby' && this.phase !== 'game_end') throw new Error('game_in_progress');
    this.settings.language = language;
  }

  canStart() {
    const phaseOk = this.phase === 'lobby' || this.phase === 'game_end';
    return phaseOk && this.playerList.filter((p) => p.connected).length >= 2;
  }

  totalRounds() {
    return this.order.length * this.settings.roundsPerPlayer;
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
    this.secretWord = null;
    this.guesses = new Map();
    this.roundSolveOrderCounter = 0;
    this.currentChooserId = this.order[this.currentRoundIndex % this.order.length];

    for (const id of this.order) {
      if (id === this.currentChooserId) continue;
      this.guesses.set(id, { attempts: [], won: false, done: false, wonAt: null });
    }

    return {
      type: 'round_started',
      round: this.currentRoundIndex + 1,
      totalRounds: this.totalRounds(),
      chooserId: this.currentChooserId,
      language: this.settings.language,
      wordLength: WORD_LENGTH,
    };
  }

  submitWord(playerId, word) {
    if (this.phase !== 'choosing') throw new Error('not_choosing_phase');
    if (playerId !== this.currentChooserId) throw new Error('not_your_turn');
    if (!isValidWord(word, this.settings.language)) throw new Error('invalid_word');

    this.secretWord = canonicalize(word, this.settings.language);
    this.phase = 'guessing';

    // A round with no guessers (shouldn't normally happen) resolves immediately.
    if (this.guesses.size === 0) {
      return this.endRound();
    }

    return {
      type: 'word_ready',
      wordLength: WORD_LENGTH,
    };
  }

  submitGuess(playerId, guess) {
    if (this.phase !== 'guessing') throw new Error('not_guessing_phase');
    const state = this.guesses.get(playerId);
    if (!state) throw new Error('not_a_guesser');
    if (state.done) throw new Error('already_done');
    if (!isValidWord(guess, this.settings.language)) throw new Error('invalid_word');

    const feedback = computeFeedback(guess, this.secretWord);
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

    const roundComplete = this.isRoundComplete();
    return { result, progress, roundComplete };
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
    const results = [];
    let failedCount = 0;

    for (const [playerId, state] of this.guesses) {
      let points = 0;
      if (state.won) {
        const attemptsUsed = state.attempts.length;
        points = WIN_POINTS_BY_ATTEMPT[attemptsUsed] ?? 10;
        if (state.wonAt === 1) points += FIRST_SOLVER_BONUS;
      } else {
        failedCount += 1;
      }
      const player = this.players.get(playerId);
      if (player) player.score += points;
      results.push({
        playerId,
        won: state.won,
        attempts: state.attempts.length,
        points,
      });
    }

    const chooserBonus = failedCount * CHOOSER_STUMP_BONUS;
    if (chooserBonus > 0) {
      const chooser = this.players.get(this.currentChooserId);
      if (chooser) chooser.score += chooserBonus;
    }

    return {
      type: 'round_ended',
      secretWord: this.secretWord,
      chooserId: this.currentChooserId,
      chooserBonus,
      results,
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
      chooserId: this.currentChooserId,
      wordLength: WORD_LENGTH,
      maxAttempts: MAX_ATTEMPTS,
      scoreboard: this.scoreboard(),
    };
  }
}
