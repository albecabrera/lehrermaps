import test from 'node:test';
import assert from 'node:assert/strict';
import { completionMessage, didTimerFinish, getFullscreenTimerHeading, isFinalMinute, isFullscreenCompletion, isNaturalCountdownCompletion } from '../classroomTimer.js';

test('identifies the final minute without including zero', () => {
  assert.equal(isFinalMinute(61), false);
  assert.equal(isFinalMinute(60), true);
  assert.equal(isFinalMinute(1), true);
  assert.equal(isFinalMinute(0), false);
});

test('identifies only a positive-to-zero countdown transition as completion', () => {
  assert.equal(didTimerFinish(1, 0), true);
  assert.equal(didTimerFinish(0, 0), false);
  assert.equal(didTimerFinish(5, 4), false);
});

test('rings only for an active deadline crossing zero, not manual clear, reset, or apply', () => {
  assert.equal(isNaturalCountdownCompletion({ hadDeadline: true, previous: 1, next: 0 }), true);
  assert.equal(isNaturalCountdownCompletion({ hadDeadline: false, previous: 1, next: 0 }), false, 'manual clear');
  assert.equal(isNaturalCountdownCompletion({ hadDeadline: false, previous: 0, next: 300 }), false, 'manual reset');
  assert.equal(isNaturalCountdownCompletion({ hadDeadline: false, previous: 300, next: 0 }), false, 'manual duration apply');
});

test('keeps the deadline completion signal independent of the visible clock mode', () => {
  assert.equal(isNaturalCountdownCompletion({ hadDeadline: true, previous: 2, next: 0 }), true);
});

test('uses a single accessible heading for the active fullscreen presentation', () => {
  assert.equal(getFullscreenTimerHeading('clock'), 'Aktuelle Uhrzeit');
  assert.equal(getFullscreenTimerHeading('countdown'), 'Countdown');
});

test('uses the dedicated completion screen only for a completed fullscreen countdown', () => {
  assert.equal(isFullscreenCompletion({ nativeFullscreen: true, completionCelebration: true }), true);
  assert.equal(isFullscreenCompletion({ nativeFullscreen: false, completionCelebration: true }), false);
  assert.equal(isFullscreenCompletion({ nativeFullscreen: true, completionCelebration: false }), false);
  assert.equal(completionMessage, 'Die Zeit ist aus');
});
