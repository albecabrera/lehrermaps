import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('lm_token');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export const login = (password) =>
  api.post('/login', { password }).then((r) => r.data.token);

export const loginStudent = (password) =>
  api.post('/login-student', { password }).then((r) => r.data.token);

export const getFolders = () =>
  api.get('/folders').then((r) => r.data);

export const createFolder = (data) =>
  api.post('/folders', data).then((r) => r.data);

export const deleteFolder = (id) =>
  api.delete(`/folders/${id}`);

export const renameFolder = (id, name) =>
  api.put(`/folders/${id}`, { name }).then((r) => r.data);

export const getFiles = (folderId) =>
  api.get(`/files/${folderId}`).then((r) => r.data);

export const uploadFile = (folderId, file, onProgress, signal) => {
  const form = new FormData();
  form.append('folder_id', folderId);
  form.append('file', file);
  return api.post('/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
    timeout: 0,
    signal,
  }).then((r) => r.data);
};

const withToken = (url) => {
  const token = localStorage.getItem('lm_token');
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
};

export const downloadFile = (id) => withToken(`/api/files/download/${id}`);
export const viewFile = (id) => withToken(`/api/files/view/${id}`);
export const previewFile = (id) => withToken(`/api/files/preview/${id}`);
export const openFileInApp = (id, app) =>
  api.get(`/files/open/${id}${app ? `?app=${encodeURIComponent(app)}` : ''}`);

export const getLinks = (folderId) => api.get(`/links/${folderId}`).then((r) => r.data);
export const createLink = (data) => api.post('/links', data).then((r) => r.data);
export const deleteLink = (id) => api.delete(`/links/${id}`);

export const reorderFolders = (items) =>
  api.put('/folders/reorder', { items });

export const saveFolderNotes = (id, content) =>
  api.put(`/folders/${id}/notes`, { content });

export const toggleFolderFavorite = (id) =>
  api.put(`/folders/${id}/favorite`).then((r) => r.data);
export const setFolderDeadline = (id, due_at) =>
  api.put(`/folders/${id}/deadline`, { due_at }).then((r) => r.data);
export const setFolderColor = (id, color) =>
  api.put(`/folders/${id}/color`, { color }).then((r) => r.data);

export const initUnterrichtsreihe = (id) =>
  api.post(`/folders/${id}/init-unterrichtsreihe`).then((r) => r.data);

export const searchGlobal = (q, fileOffset = 0, folderOffset = 0, linkOffset = 0) =>
  api.get('/files/search', { params: { q, fileOffset, folderOffset, linkOffset } }).then((r) => r.data);

export const downloadFolderZip = (folderId) => withToken(`/api/files/zip/${folderId}`);
export const downloadFilesZip = (ids) => withToken(`/api/files/zip-selected?ids=${ids.join(',')}`);

export const toggleFileShare = (id) =>
  api.put(`/files/${id}/share`).then((r) => r.data);
export const toggleFilePublic = (id) =>
  api.put(`/files/${id}/public`).then((r) => r.data);
export const setFileDeadline = (id, due_at) =>
  api.put(`/files/${id}/deadline`, { due_at }).then((r) => r.data);
export const publicFileUrl = (token) =>
  `${window.location.origin}/api/files/public/${encodeURIComponent(token)}`;

export const generateLessonDraft = (payload) =>
  api.post('/ai/lesson-draft', payload).then((r) => r.data);

export const generateDocument = (payload) =>
  api.post('/ai/generate-document', payload).then((r) => r.data);

export const getAiStatus = () =>
  api.get('/ai/status').then((r) => r.data);

export const testAiStatus = () =>
  api.post('/ai/status/test').then((r) => r.data);

export const deleteFile = (id) =>
  api.delete(`/files/${id}`);

export const renameFile = (id, original_name) =>
  api.put(`/files/${id}`, { original_name }).then((r) => r.data);

export const moveFile = (id, folder_id) =>
  api.put(`/files/${id}`, { folder_id }).then((r) => r.data);

export const getNotebooks = () => api.get('/notebooks').then((r) => r.data);
export const createNotebook = (data) => api.post('/notebooks', data).then((r) => r.data);
export const patchNotebook = (id, data) => api.patch(`/notebooks/${id}`, data).then((r) => r.data);
export const deleteNotebook = (id) => api.delete(`/notebooks/${id}`);

export const getSections = (notebookId) => api.get(`/sections/${notebookId}`).then((r) => r.data);
export const createSection = (data) => api.post('/sections', data).then((r) => r.data);
export const patchSection = (id, data) => api.patch(`/sections/${id}`, data).then((r) => r.data);
export const deleteSection = (id) => api.delete(`/sections/${id}`);

export const getPages = (sectionId) => api.get(`/pages/${sectionId}`).then((r) => r.data);
export const createPage = (data) => api.post('/pages', data).then((r) => r.data);
export const patchPage = (id, data) => api.patch(`/pages/${id}`, data).then((r) => r.data);
export const deletePage = (id) => api.delete(`/pages/${id}`);
export const getBlocks = (pageId) => api.get(`/blocks/${pageId}`).then((r) => r.data);
export const saveBlocks = (pageId, blocks) => api.put(`/blocks/${pageId}`, { blocks }).then((r) => r.data);
export const getQuickNotes = () => api.get('/quicknotes').then((r) => r.data);
export const createQuickNote = (content) => api.post('/quicknotes', { content }).then((r) => r.data);
export const deleteQuickNote = (id) => api.delete(`/quicknotes/${id}`);
export const searchOneNote = (q) => api.get('/search', { params: { q } }).then((r) => r.data);

export default api;
