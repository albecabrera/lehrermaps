export const REFLECTION_CATEGORIES = Object.freeze([
  { id: 'koffer', label: 'Koffer', title: 'Das nehme ich mit', description: 'Hilfreiches, Verstandenes und Merkwürdiges' },
  { id: 'muellkorb', label: 'Müllkorb', title: 'Das können wir verbessern', description: 'Was wir beim nächsten Mal anders machen können' },
  { id: 'unklar', label: 'Noch unklar', title: 'Noch unklar', description: 'Fragen und offene Punkte' },
]);

export const REFLECTION_QUESTIONS = Object.freeze([
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

export function categoryById(category) {
  return REFLECTION_CATEGORIES.find((entry) => entry.id === category) || REFLECTION_CATEGORIES[0];
}

export function normalizeReflectionMetadata(metadata = {}) {
  const rawDate = String(metadata.date || '');
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? new Date(`${rawDate}T00:00:00.000Z`) : null;
  const validDate = parsedDate && !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === rawDate;
  return {
    subject: String(metadata.subject || '').trim().slice(0, 120),
    className: String(metadata.className || '').trim().slice(0, 120),
    topic: String(metadata.topic || '').trim().slice(0, 240),
    date: validDate ? rawDate : '',
  };
}

export function normalizeReflectionItem(item) {
  const category = REFLECTION_CATEGORIES.some((entry) => entry.id === item?.category) ? item.category : 'koffer';
  return {
    id: item?.id,
    category,
    content: String(item?.content || '').trim(),
    likes: Math.max(0, Number(item?.likes) || 0),
    sortOrder: Number(item?.sortOrder ?? item?.sort_order) || 0,
  };
}

export function groupReflectionItems(items = []) {
  return REFLECTION_CATEGORIES.reduce((groups, category) => {
    groups[category.id] = items
      .filter((item) => item.category === category.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id));
    return groups;
  }, {});
}

export function buildReflectionSummary(items = []) {
  const groups = groupReflectionItems(items);
  const mostSupported = [...items]
    .filter((item) => item.content)
    .sort((a, b) => b.likes - a.likes || a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id))
    .slice(0, 5);
  return { groups, mostSupported, total: items.length };
}

export function chooseNextReflectionQuestion(current, random = Math.random) {
  const candidates = REFLECTION_QUESTIONS.filter((question) => question !== current);
  return (candidates.length ? candidates : REFLECTION_QUESTIONS)[Math.floor(random() * (candidates.length || REFLECTION_QUESTIONS.length))];
}

export function todayIsoDate(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
