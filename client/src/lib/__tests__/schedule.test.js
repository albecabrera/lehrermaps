import test from 'node:test';
import assert from 'node:assert/strict';
import { SCHEDULE_META_KEY, getCockpitLesson, getScheduleSettings, lessonsForDate } from '../schedule.js';

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
    { start: '12:30', end: '13:15' }, { start: '13:30', end: '14:15' },
  ], breaks: [
    { start: '09:45', end: '10:00' }, { start: '11:45', end: '12:30' },
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
