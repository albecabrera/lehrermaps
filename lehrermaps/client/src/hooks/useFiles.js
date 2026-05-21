import { useState, useEffect, useCallback } from 'react';
import { getFiles, uploadFile, deleteFile, renameFile, moveFile, toggleFileShare, setFileDeadline, toggleFilePublic } from '../lib/api';

export function useFiles(folderId) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!folderId) { setFiles([]); return; }
    try {
      setLoading(true);
      const data = await getFiles(folderId);
      setFiles(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => { load(); }, [load]);

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

  const toggleShare = useCallback(async (id) => {
    const updated = await toggleFileShare(id);
    setFiles((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }, []);

  const setDeadline = useCallback(async (id, due_at) => {
    const updated = await setFileDeadline(id, due_at);
    setFiles((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }, []);

  const togglePublic = useCallback(async (id) => {
    const updated = await toggleFilePublic(id);
    setFiles((prev) => prev.map((f) => (f.id === id ? updated : f)));
    return updated;
  }, []);

  return { files, loading, error, reload: load, upload, remove, rename, move, toggleShare, setDeadline, togglePublic };
}
