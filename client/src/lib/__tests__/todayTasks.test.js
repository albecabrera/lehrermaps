import test from 'node:test';
import assert from 'node:assert/strict';
import { isTaskReminderEligible, normalizeTodayTasks, orderTasksByCompletion, taskDueAt, toggleTodayTask, updateTodayTaskDue, updateTodayTaskText } from '../todayTasks.js';

const tasks = [
  { id: 'first', text: 'Erste offene Aufgabe', done: false },
  { id: 'done-first', text: 'Erste erledigte Aufgabe', done: true },
  { id: 'second', text: 'Zweite offene Aufgabe', done: false },
  { id: 'done-second', text: 'Zweite erledigte Aufgabe', done: true },
];

test('orders incomplete tasks before completed tasks without changing either group order', () => {
  assert.deepEqual(orderTasksByCompletion(tasks).map((task) => task.id), [
    'first', 'second', 'done-first', 'done-second',
  ]);
});

test('moves a newly completed task to the completed group and keeps the rest stable', () => {
  assert.deepEqual(toggleTodayTask(orderTasksByCompletion(tasks), 'second').map((task) => task.id), [
    'first', 'done-first', 'done-second', 'second',
  ]);
});

test('updates an existing task text without changing completion state or order', () => {
  const updated = updateTodayTaskText(orderTasksByCompletion(tasks), 'second', '  Überarbeitete Aufgabe  ');
  assert.deepEqual(updated.map((task) => task.id), ['first', 'second', 'done-first', 'done-second']);
  assert.deepEqual(updated.find((task) => task.id === 'second'), { id: 'second', text: 'Überarbeitete Aufgabe', done: false });
});

test('keeps valid optional due fields and drops malformed legacy due fields', () => {
  const normalized = normalizeTodayTasks([
    { id: 'valid', text: 'Mit Termin', done: false, dueDate: '2026-09-12', dueTime: '08:30' },
    { id: 'legacy', text: 'Ohne Termin', done: false, dueDate: 'not-a-date', dueTime: '25:90' },
  ]);
  assert.deepEqual(normalized[0], { id: 'valid', text: 'Mit Termin', done: false, dueDate: '2026-09-12', dueTime: '08:30' });
  assert.deepEqual(normalized[1], { id: 'legacy', text: 'Ohne Termin', done: false });
});

test('computes reminder eligibility only for incomplete tasks with a full due date and time', () => {
  const due = { id: 'due', text: 'Fällig', done: false, dueDate: '2026-09-12', dueTime: '08:30' };
  assert.equal(taskDueAt(due)?.getHours(), 8);
  assert.equal(isTaskReminderEligible(due, new Date(2026, 8, 12, 8, 30)), true);
  assert.equal(isTaskReminderEligible({ ...due, done: true }, new Date(2026, 8, 12, 8, 31)), false);
  assert.equal(isTaskReminderEligible(updateTodayTaskDue([due], 'due', '', '')[0], new Date(2026, 8, 12, 8, 31)), false);
});
