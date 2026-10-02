import test from 'node:test';
import assert from 'node:assert/strict';
import { getHangmanStatus, isValidHangmanWord, normalizeGuess, normalizeHangmanWord } from '../hangman.js';

test('normalizes German letters and visible separators without losing sharp S', () => {
  assert.equal(normalizeHangmanWord("  künstliche  intelligenz - straße  "), 'KÜNSTLICHE INTELLIGENZ - STRAßE');
  assert.equal(normalizeHangmanWord('O’Neil'), "O'NEIL");
  assert.equal(normalizeGuess('ä'), 'Ä');
  assert.equal(normalizeGuess('ẞ'), 'ß');
});

test('requires at least one playable letter and rejects unsupported symbols', () => {
  assert.equal(isValidHangmanWord('---'), false);
  assert.equal(isValidHangmanWord('A-B'), true);
  assert.equal(isValidHangmanWord('A!'), false);
});

test('counts only wrong guesses and determines win or loss', () => {
  assert.deepEqual(getHangmanStatus('A-B', ['A', 'B'], 2), { errors: 0, won: true, lost: false });
  assert.deepEqual(getHangmanStatus('A-B', ['C', 'D'], 2), { errors: 2, won: false, lost: true });
});
