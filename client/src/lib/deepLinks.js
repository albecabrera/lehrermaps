const HASH_ROUTES = Object.freeze({
  '#today': Object.freeze({ hash: '#today', view: 'today', focusId: null }),
  '#schedule': Object.freeze({ hash: '#schedule', view: 'schedule', focusId: null }),
  '#appointments': Object.freeze({ hash: '#appointments', view: 'appointments', focusId: null }),
  '#tasks': Object.freeze({ hash: '#tasks', view: 'today', focusId: 'tasks' }),
});

const VIEW_HASHES = Object.freeze({
  today: '#today',
  schedule: '#schedule',
  appointments: '#appointments',
});

export function parseAppHash(hash) {
  return HASH_ROUTES[hash] || null;
}

export function hashForView(view) {
  return VIEW_HASHES[view] || '';
}
