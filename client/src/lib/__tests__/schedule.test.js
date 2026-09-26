import test from 'node:test';
import assert from 'node:assert/strict';
import { SCHEDULE_META_KEY, getCockpitLesson, getScheduleOverviewRows, getScheduleOverviewState, getScheduleSettings, lessonsForDate } from '../schedule.js';

const schedule = {
  [SCHEDULE_META_KEY]: { version: 1, periods: [
    { start: '08:00', end: '08:45' }, { start: '09:00', end: '09:45' },
    { start: '10:00', end: '10:45' }, { start: '11:00', end: '11:45' },
    { start: '12:00', end: '12:45' }, { start: '13:00', end: '13:45' },
  ] },
  '0-0': { label: '6a Informatik', location: 'S10' },
  '0-2': { label: '7b', location: 'S11' },
  '4-1': { label: 'Q1', location: 'Aula' },
};
const monday = (hours, minutes = 0) => new Date(2026, 8, 7, hours, minutes);

test('returns the class currently in progress', () => {
  const result = getCockpitLesson(schedule, monday(8, 20));
  assert.equal(result.kind, 'current');
  assert.equal(result.lesson.label, '6a Informatik');
  assert.equal(result.lesson.block, 1);
});

test('returns a later class on the same day during a gap', () => {
  const result = getCockpitLesson(schedule, monday(9, 50));
  assert.equal(result.kind, 'next');
  assert.equal(result.lesson.label, '7b');
});

test('finds the next weekday class from Friday through Monday', () => {
  const result = getCockpitLesson(schedule, new Date(2026, 8, 11, 15, 0));
  assert.equal(result.kind, 'next');
  assert.equal(result.lesson.label, '6a Informatik');
  assert.equal(result.lesson.start.getDay(), 1);
});

test('has no lesson in a gap when no later or future class exists', () => {
  const fridayOnly = { ...schedule, '0-0': undefined, '0-2': undefined, '4-1': undefined };
  const result = getCockpitLesson(fridayOnly, new Date(2026, 8, 11, 9, 50));
  assert.equal(result.kind, 'no-lessons');
});

test('reports unconfigured times and returns no timed lessons', () => {
  const unconfigured = { '0-0': { label: '6a' } };
  assert.equal(getCockpitLesson(unconfigured, monday(8)).kind, 'no-time-config');
  assert.deepEqual(lessonsForDate(unconfigured, monday(8)), []);
});

test('returns no lesson for a configured day without classes', () => {
  assert.deepEqual(lessonsForDate(schedule, new Date(2026, 8, 8, 8)), []);
});

test('rejects overlapping or reversed block times as unconfigured', () => {
  const invalid = {
    ...schedule,
    [SCHEDULE_META_KEY]: { version: 1, periods: [
      { start: '08:00', end: '08:45' }, { start: '08:30', end: '09:15' },
      { start: '10:00', end: '10:45' }, { start: '11:00', end: '11:45' },
      { start: '12:00', end: '12:45' }, { start: '13:00', end: '13:45' },
    ] },
  };
  assert.equal(getCockpitLesson(invalid, monday(8, 35)).kind, 'no-time-config');
  const reversed = { ...invalid, [SCHEDULE_META_KEY]: { version: 1, periods: [
    { start: '09:00', end: '09:45' }, { start: '08:00', end: '08:45' },
    { start: '10:00', end: '10:45' }, { start: '11:00', end: '11:45' },
    { start: '12:00', end: '12:45' }, { start: '13:00', end: '13:45' },
  ] } };
  assert.equal(getCockpitLesson(reversed, monday(8, 10)).kind, 'no-time-config');
});

const scheduleWithBreaks = {
  [SCHEDULE_META_KEY]: { version: 2, periods: [
    { start: '08:00', end: '08:45' }, { start: '09:00', end: '09:45' },
    { start: '10:00', end: '10:45' }, { start: '11:00', end: '11:45' },
    { start: '14:00', end: '14:45' }, { start: '15:00', end: '15:45' },
  ], breaks: [
    { start: '09:45', end: '10:00' }, { start: '12:50', end: '13:50' },
  ] },
  'break-fruehstueck': { 0: { label: 'Aufsicht 6a', location: 'Schulhof' } },
  'break-mittag': { 0: { label: 'Mensaaufsicht' } },
  '0-2': { label: '7b', location: 'S11' },
};

test('includes a populated first break as the current time-bound Today entry', () => {
  const result = getCockpitLesson(scheduleWithBreaks, monday(9, 50));
  assert.equal(result.kind, 'current');
  assert.equal(result.lesson.label, 'Aufsicht 6a');
  assert.equal(result.lesson.blockLabel, 'Pause 1');
  assert.equal(result.lesson.time, '09:45–10:00');
});

test('includes Pause 2 as a current time-bound Today entry', () => {
  const result = getCockpitLesson(scheduleWithBreaks, monday(13, 10));
  assert.equal(result.kind, 'current');
  assert.equal(result.lesson.label, 'Mensaaufsicht');
  assert.equal(result.lesson.blockLabel, 'Pause 2');
  assert.equal(result.lesson.time, '12:50–13:50');
});

test('selects a populated later break before a later lesson and on future weekdays', () => {
  const today = getCockpitLesson(scheduleWithBreaks, monday(10, 50));
  assert.equal(today.kind, 'next');
  assert.equal(today.lesson.label, 'Mensaaufsicht');
  const friday = getCockpitLesson(scheduleWithBreaks, new Date(2026, 8, 11, 15, 0));
  assert.equal(friday.kind, 'next');
  assert.equal(friday.lesson.label, 'Aufsicht 6a');
  assert.equal(friday.lesson.start.getDay(), 1);
});

test('requires explicit, chronological break ranges for v2 metadata', () => {
  const overlappingBreak = {
    ...scheduleWithBreaks,
    [SCHEDULE_META_KEY]: { ...scheduleWithBreaks[SCHEDULE_META_KEY], breaks: [
      { start: '09:40', end: '10:00' }, { start: '11:45', end: '12:30' },
    ] },
  };
  assert.equal(getScheduleSettings(overlappingBreak).configured, false);
  const missingBreak = {
    ...scheduleWithBreaks,
    [SCHEDULE_META_KEY]: { version: 2, periods: scheduleWithBreaks[SCHEDULE_META_KEY].periods },
  };
  assert.equal(getScheduleSettings(missingBreak).configured, true, 'legacy six-period metadata remains usable');
  assert.deepEqual(lessonsForDate(missingBreak, monday(9, 50)).map((entry) => entry.label), ['7b'], 'unconfigured breaks are never assigned invented times');
});


test('identifies today plus the cell for a current or next overview lesson', () => {
  const current = getScheduleOverviewState(schedule, monday(8, 20));
  assert.equal(current.todayDay, 0);
  assert.equal(current.highlightKey, '0-0');
  assert.equal(current.lessonState.kind, 'current');

  const next = getScheduleOverviewState(schedule, monday(9, 50));
  assert.equal(next.todayDay, 0);
  assert.equal(next.highlightKey, '0-2');
  assert.equal(next.lessonState.kind, 'next');
});

test('identifies a scheduled break cell and has no today column on weekends', () => {
  const breakState = getScheduleOverviewState(scheduleWithBreaks, monday(9, 50));
  assert.equal(breakState.highlightKey, 'break-fruehstueck-0');
  assert.equal(breakState.lessonState.kind, 'current');

  const weekend = getScheduleOverviewState(schedule, new Date(2026, 8, 6, 10));
  assert.equal(weekend.todayDay, null);
  assert.equal(weekend.highlightKey, '0-0');
});


test('orders overview rows with both pauses before their following blocks', () => {
  const order = getScheduleOverviewRows(scheduleWithBreaks).map((row) => (
    row.type === 'break' ? row.breakInfo.key : `period-${row.index + 1}`
  ));
  assert.deepEqual(order, [
    'period-1', 'period-2', 'break-fruehstueck', 'period-3',
    'period-4', 'break-mittag', 'period-5', 'period-6',
  ]);
});
