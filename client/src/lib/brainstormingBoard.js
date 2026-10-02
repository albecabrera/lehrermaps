export const BRAINSTORMING_BOARD_STORAGE_KEY = 'lm_brainstorming_board_terms';

export function parseBrainstormingTerms(value) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((term) => typeof term === 'string').map((term) => term.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function readBrainstormingTerms(storage) {
  try {
    return parseBrainstormingTerms(storage.getItem(BRAINSTORMING_BOARD_STORAGE_KEY));
  } catch {
    return [];
  }
}
