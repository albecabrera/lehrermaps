import { useState, useCallback } from 'react';

const KEY = 'lm_recents';
const MAX = 5;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function useRecents() {
  const [recents, setRecents] = useState(load);

  const add = useCallback((folder, subjectColor) => {
    setRecents((prev) => {
      const entry = {
        id: folder.id,
        name: folder.name,
        subject: folder.subject,
        group_name: folder.group_name,
        color: subjectColor,
      };
      const filtered = prev.filter((r) => r.id !== folder.id);
      const next = [entry, ...filtered].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recents, add };
}
