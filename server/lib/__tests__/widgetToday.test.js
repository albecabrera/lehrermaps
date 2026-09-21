import test from 'node:test';
import assert from 'node:assert/strict';
import { openTaskCount, scheduleSummary } from '../widgetToday.js';

const schedule = {
  __lehrermaps_schedule_meta_v1: {
    version: 1,
    periods: [
      { start: '08:00', end: '08:45' }, { start: '09:00', end: '09:45' },
      { start: '10:00', end: '10:45' }, { start: '11:00', end: '11:45' },
      { start: '12:00', end: '12:45' }, { start: '13:00', end: '13:45' },
    ],
  },
  '0-0': { label: '6a', location: 'S10' },
  '0-1': { label: '7b', location: 'S11' },
  '0-2': { label: 'Q1', location: 'Aula' },
  '0-3': { label: '9c', location: 'B12' },
};

test('selects current and next slots and bounds the widget timeline', () => {
  const result = scheduleSummary(schedule, '2026-09-07', new Date(2026, 8, 7, 8, 20));
  assert.equal(result.current?.label, '6a');
  assert.equal(result.next?.label, '7b');
  assert.deepEqual(result.slots.map((slot) => slot.label), ['6a', '7b', 'Q1']);
});

test('rejects v2 metadata with missing or overlapping explicit break times', () => {
  const invalid = {
    ...schedule,
    __lehrermaps_schedule_meta_v1: {
      ...schedule.__lehrermaps_schedule_meta_v1,
      version: 2,
      breaks: [{ start: '09:40', end: '10:00' }, { start: '11:45', end: '12:00' }],
    },
  };
  assert.deepEqual(scheduleSummary(invalid, '2026-09-07', new Date(2026, 8, 7, 8, 20)), {
    configured: false,
    current: null,
    next: null,
    slots: [],
  });
});

test('counts only open task state without exposing or trusting unbounded task data', () => {
  assert.equal(openTaskCount(JSON.stringify([
    { id: '1', text: 'private', done: false },
    { id: '2', text: 'private', done: true },
  ])), 1);
  assert.equal(openTaskCount(JSON.stringify(Array.from({ length: 21 }, (_, index) => ({ id: String(index), text: 'private', done: false })))), 0);
  assert.equal(openTaskCount('not-json'), 0);
});
