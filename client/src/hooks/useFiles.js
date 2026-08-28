import { useState, useEffect, useCallback } from 'react';
import { getFiles, uploadFile, deleteFile, renameFile, moveFile, setFileRole, setFilesRole, commitEditCopy } from '../lib/api';

export function useFiles(folderId) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (signal) => {
    if (!folderId) { setFiles([]); return; }
    try {
      setLoading(true);
      setError(null);
      const data = await getFiles(folderId, signal);
      if (signal?.aborted) return;
      setFiles(data);
    } catch (e) {
      if (signal?.aborted) return;
      setError(e.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const upload = useCallback(async (file, onProgress, signal) => {
    const newFile = await uploadFile(folderId, file, onProgress, signal);
    setFiles((prev) => [newFile, ...prev]);
    return newFile;
  }, [folderId]);

  const remove = useCallback(async (id) => {
    await deleteFile(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const rename = useCallback(async (id, name) => {
    const updated = await renameFile(id, name);
    setFiles((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }, []);

  const move = useCallback(async (id, targetFolderId) => {
    const updated = await moveFile(id, targetFolderId);
    setFiles((prev) => prev.filter((f) => f.id !== id));
    return updated;
  }, []);




  const setRole = useCallback(async (id, material_role) => {
    const updated = await setFileRole(id, material_role);
    setFiles((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }, []);

  const setBulkRole = useCallback(async (items, material_role) => {
    const ids = items.map((f) => f.id);
    const updated = await setFilesRole(ids, material_role);
    const byId = new Map(updated.map((f) => [f.id, f]));
    setFiles((prev) => prev.map((f) => byId.get(f.id) || f));
    return updated;
  }, []);

  const commitVersion = useCallback(async (id, file) => {
    const updated = await commitEditCopy(id, file);
    setFiles((prev) => [updated, ...prev.filter((f) => f.version_group_id !== updated.version_group_id)]);
    return updated;
  }, []);

  return { files, loading, error, reload: load, upload, remove, rename, move, setRole, setBulkRole, commitVersion };
}
