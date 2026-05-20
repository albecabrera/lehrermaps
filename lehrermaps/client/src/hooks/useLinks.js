import { useState, useEffect, useCallback } from 'react';
import { getLinks, createLink, deleteLink } from '../lib/api';

export function useLinks(folderId) {
  const [links, setLinks] = useState([]);

  const load = useCallback(async () => {
    if (!folderId) { setLinks([]); return; }
    try { setLinks(await getLinks(folderId)); } catch { setLinks([]); }
  }, [folderId]);

  useEffect(() => { load(); }, [load]);

  const add = async (title, url) => {
    const link = await createLink({ folder_id: folderId, title, url });
    setLinks((prev) => [link, ...prev]);
    return link;
  };

  const remove = async (id) => {
    await deleteLink(id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  return { links, add, remove };
}
