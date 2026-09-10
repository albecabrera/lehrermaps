import test from 'node:test';
import assert from 'node:assert/strict';
import { orderTasksByCompletion, toggleTodayTask, updateTodayTaskText } from '../todayTasks.js';

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
