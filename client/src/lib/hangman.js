export const HANGMAN_LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜß'];
const LETTERS = new Set(HANGMAN_LETTERS);
const SEPARATORS = new Set([' ', '-', "'"]);

export function normalizeHangmanWord(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').replace(/[’‘]/g, "'")
    .split('').map((letter) => letter === 'ß' || letter === 'ẞ' ? 'ß' : letter.toLocaleUpperCase('de-DE')).join('');
}

export function isValidHangmanWord(word) {
  return [...word].some((letter) => LETTERS.has(letter))
    && [...word].every((letter) => LETTERS.has(letter) || SEPARATORS.has(letter));
}

export function normalizeGuess(value) {
  const letter = value === 'ß' || value === 'ẞ' ? 'ß' : String(value || '').toLocaleUpperCase('de-DE');
  return LETTERS.has(letter) ? letter : null;
}

export function getHangmanStatus(word, guesses, maxErrors) {
  const letters = [...word].filter((letter) => LETTERS.has(letter));
  const errors = guesses.filter((letter) => !letters.includes(letter)).length;
  const won = letters.every((letter) => guesses.includes(letter));
  return { errors, won, lost: !won && errors >= maxErrors };
}
