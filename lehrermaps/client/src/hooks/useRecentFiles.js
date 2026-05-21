import { useState, useCallback } from 'react';

const KEY = 'lm_recent_files';
const MAX = 6;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState(load);

  const trackFile = useCallback((file, folderId, subjectId) => {
    if (!file?.id) return;
    setRecentFiles((prev) => {
      const entry = { id: file.id, name: file.original_name, folderId, subjectId };
      const filtered = prev.filter((r) => r.id !== file.id);
      const next = [entry, ...filtered].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recentFiles, trackFile };
}
