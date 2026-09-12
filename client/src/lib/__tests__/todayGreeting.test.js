import test from 'node:test';
import assert from 'node:assert/strict';
import { getTodayGreeting } from '../todayGreeting.js';

const at = (day, hours) => new Date(2026, 8, day, hours, 0, 0);

test('uses the German weekday greeting for local morning, afternoon, and evening', () => {
  assert.equal(getTodayGreeting(at(7, 8)), 'Guten Morgen Cabrera!');
  assert.equal(getTodayGreeting(at(7, 12)), 'Guten Tag Cabrera!');
  assert.equal(getTodayGreeting(at(7, 18)), 'Guten Abend Cabrera!');
});

test('uses the weekend greeting regardless of local hour', () => {
  assert.equal(getTodayGreeting(at(6, 8)), 'Schönes Wochenende!');
  assert.equal(getTodayGreeting(at(6, 20)), 'Schönes Wochenende!');
  assert.equal(getTodayGreeting(at(13, 11)), 'Schönes Wochenende!');
});
