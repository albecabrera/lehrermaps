import { useState, useEffect, useCallback } from 'react';
import { getLinks, createLink, deleteLink, toggleLinkShare } from '../lib/api';

export function useLinks(folderId) {
  const [links, setLinks] = useState([]);

  const load = useCallback(async () => {
    if (!folderId) { setLinks([]); return; }
    try { setLinks(await getLinks(folderId)); } catch { setLinks([]); }
  }, [folderId]);

  useEffect(() => { load(); }, [load]);

  const add = async (title, url, is_shared = false) => {
    const link = await createLink({ folder_id: folderId, title, url, is_shared });
    setLinks((prev) => [link, ...prev]);
    return link;
  };

  const remove = async (id) => {
    await deleteLink(id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };
  const toggleShare = async (id) => {
    const link = await toggleLinkShare(id);
    setLinks((prev) => prev.map((item) => item.id === id ? link : item));
    return link;
  };

  return { links, add, remove, toggleShare };
}
