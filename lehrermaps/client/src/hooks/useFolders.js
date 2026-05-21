import { useState, useEffect, useCallback } from 'react';
import { getFolders, createFolder, deleteFolder, renameFolder, reorderFolders, toggleFolderFavorite, setFolderDeadline } from '../lib/api';

export function useFolders() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFolders();
      setFolders(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (subject, group_name, name, parent_id = null) => {
    const folder = await createFolder({ subject, group_name, name, ...(parent_id ? { parent_id } : {}) });
    setFolders((prev) => [...prev, folder]);
    return folder;
  }, []);

  const remove = useCallback(async (id) => {
    await deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const rename = useCallback(async (id, name) => {
    const updated = await renameFolder(id, name);
    setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }, []);

  const reorder = useCallback(async (orderedIds) => {
    const items = orderedIds.map((id, i) => ({ id, sort_order: i }));
    setFolders((prev) => {
      const map = Object.fromEntries(items.map((it) => [it.id, it.sort_order]));
      const updated = prev.map((f) => (map[f.id] !== undefined ? { ...f, sort_order: map[f.id] } : f));
      return updated.sort((a, b) => {
        if (a.subject !== b.subject) return 0;
        if (a.group_name !== b.group_name) return 0;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
    });
    try { await reorderFolders(items); } catch { await load(); }
  }, [load]);

  const toggleFavorite = useCallback(async (id) => {
    const updated = await toggleFolderFavorite(id);
    setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }, []);

  const setDeadline = useCallback(async (id, due_at) => {
    const updated = await setFolderDeadline(id, due_at);
    setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }, []);

  const bySubjectGroup = useCallback(
    (subject, group_name) =>
      folders.filter((f) => f.subject === subject && f.group_name === group_name),
    [folders]
  );

  return { folders, loading, error, reload: load, add, remove, rename, reorder, toggleFavorite, setDeadline, bySubjectGroup };
}
