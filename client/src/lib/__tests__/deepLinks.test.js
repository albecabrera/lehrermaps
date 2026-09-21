import test from 'node:test';
import assert from 'node:assert/strict';
import { hashForView, parseAppHash } from '../deepLinks.js';

test('maps only supported semantic hashes to rendered views', () => {
  assert.deepEqual(parseAppHash('#today'), { hash: '#today', view: 'today', focusId: null });
  assert.deepEqual(parseAppHash('#schedule'), { hash: '#schedule', view: 'schedule', focusId: null });
  assert.deepEqual(parseAppHash('#appointments'), { hash: '#appointments', view: 'appointments', focusId: null });
  assert.deepEqual(parseAppHash('#tasks'), { hash: '#tasks', view: 'today', focusId: 'tasks' });
});

test('ignores paths, query strings, tokens, fragments with parameters, and unknown anchors', () => {
  for (const value of ['', '/', '/schedule', '?view=schedule', '#schedule?token=secret', '#main-content', '#unknown']) {
    assert.equal(parseAppHash(value), null);
  }
});

test('returns canonical hashes only for public app views', () => {
  assert.equal(hashForView('today'), '#today');
  assert.equal(hashForView('schedule'), '#schedule');
  assert.equal(hashForView('appointments'), '#appointments');
  assert.equal(hashForView('subjects'), '');
  assert.equal(hashForView('klausurplan'), '');
});
