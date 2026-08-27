import { useState, useEffect, useCallback } from 'react';
import { getFolders, createFolder, deleteFolder, renameFolder, reorderFolders, toggleFolderFavorite, setFolderColor, moveFolderToParent } from '../lib/api';

export function useFolders() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getFolders(signal);
      if (signal?.aborted) return;
      setFolders(data);
    } catch (e) {
      if (signal?.aborted) return;
      setError(e.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

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

  const setColor = useCallback(async (id, color) => {
    const updated = await setFolderColor(id, color);
    setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }, []);

  const moveToParent = useCallback(async (id, newParentId, placement = 'inside') => {
    await moveFolderToParent(id, newParentId, placement);
    setFolders((prev) => prev.map((f) => {
      if (f.id !== id) return f;
      if (newParentId) {
        const parent = prev.find((p) => p.id === newParentId);
        return { ...f, parent_id: newParentId, group_name: parent?.group_name ?? f.group_name };
      }
      return { ...f, parent_id: null };
    }));
  }, []);

  const bySubjectGroup = useCallback(
    (subject, group_name) =>
      folders.filter((f) => f.subject === subject && f.group_name === group_name),
    [folders]
  );

  return { folders, loading, error, reload: load, add, remove, rename, reorder, toggleFavorite, setColor, moveToParent, bySubjectGroup };
}
