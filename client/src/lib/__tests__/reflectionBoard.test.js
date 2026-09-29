import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReflectionSummary,
  chooseNextReflectionQuestion,
  groupReflectionItems,
  normalizeReflectionMetadata,
  REFLECTION_QUESTIONS,
} from '../reflectionBoard.js';

test('contains the twelve reflection questions from the codex', () => {
  assert.equal(REFLECTION_QUESTIONS.length, 12);
  assert.deepEqual(REFLECTION_QUESTIONS, [
    'Was hast du heute neu gelernt?',
    'Was war heute besonders hilfreich?',
    'Was möchtest du dir merken?',
    'Was war heute schwierig?',
    'Wo hattest du ein Aha-Erlebnis?',
    'Was sollten wir nächstes Mal anders machen?',
    'Welche Aufgabe hat dir geholfen?',
    'Welche Erklärung war verständlich?',
    'Wo brauchst du noch Unterstützung?',
    'Was hat heute besonders gut funktioniert?',
    'Was kannst du jetzt, was du vorher noch nicht konntest?',
    'Was würdest du einem Mitschüler aus der heutigen Stunde erklären können?',
  ]);
});

test('normalizes metadata and keeps invalid dates empty', () => {
  assert.deepEqual(normalizeReflectionMetadata({ subject: ' Informatik ', className: ' 6d ', topic: ' Zustände ', date: '2026-02-30' }), {
    subject: 'Informatik', className: '6d', topic: 'Zustände', date: '',
  });
});

test('groups all three categories and ranks supported statements', () => {
  const items = [
    { id: 1, category: 'muellkorb', content: 'Mehr Zeit', likes: 3, sortOrder: 1 },
    { id: 2, category: 'koffer', content: 'Kara hilft', likes: 5, sortOrder: 0 },
    { id: 3, category: 'unklar', content: 'Frage', likes: 1, sortOrder: 0 },
  ];
  const groups = groupReflectionItems(items);
  assert.equal(groups.koffer.length, 1);
  assert.equal(groups.muellkorb[0].content, 'Mehr Zeit');
  assert.equal(buildReflectionSummary(items).mostSupported[0].id, 2);
});

test('chooses a different question when alternatives exist', () => {
  assert.notEqual(chooseNextReflectionQuestion('Was hast du heute neu gelernt?', () => 0), 'Was hast du heute neu gelernt?');
});
