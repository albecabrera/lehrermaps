import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAINSTORMING_BOARD_STORAGE_KEY, parseBrainstormingTerms, readBrainstormingTerms } from '../brainstormingBoard.js';

test('parses stored terms and discards invalid or empty entries', () => {
  assert.deepEqual(parseBrainstormingTerms('[" Idee ", "", 42, null, "zweiter Begriff"]'), ['Idee', 'zweiter Begriff']);
});

test('returns an empty board for malformed data or unavailable storage', () => {
  assert.deepEqual(parseBrainstormingTerms('{invalid'), []);
  assert.deepEqual(readBrainstormingTerms({ getItem: () => { throw new Error('storage unavailable'); } }), []);
  assert.deepEqual(readBrainstormingTerms({ getItem: (key) => {
    assert.equal(key, BRAINSTORMING_BOARD_STORAGE_KEY);
    return null;
  } }), []);
});
