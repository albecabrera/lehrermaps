import axios from 'axios';

const isApacheStaticApp = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(window.location.hostname)
  && window.location.port === '8090';
const apiBaseUrl = isApacheStaticApp
  ? `${window.location.protocol}//${window.location.hostname}:3001/api`
  : '/api';

const api = axios.create({ baseURL: apiBaseUrl, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 = Session abgelaufen → zurück zum Login. Ausnahme: der Login-Request
    // selbst — dort bedeutet 401 nur „falsches Passwort" und das Formular muss
    // den Fehler anzeigen dürfen statt hart neu zu laden.
    const isLoginRequest = (err.config?.url || '').includes('/login');
    if (err.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('lm_token');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export const login = (password) =>
  api.post('/login', { password }).then((r) => r.data.token);

export const getFolders = (signal) =>
  api.get('/folders', { signal }).then((r) => r.data);

export const createFolder = (data) =>
  api.post('/folders', data).then((r) => r.data);

export const deleteFolder = (id) =>
  api.delete(`/folders/${id}`);

export const renameFolder = (id, name) =>
  api.put(`/folders/${id}`, { name }).then((r) => r.data);

export const moveFolderToParent = (id, parent_id, placement = 'inside') =>
  api.put(`/folders/${id}/move`, { parent_id, placement }).then((r) => r.data);

export const getFiles = (folderId, signal) =>
  api.get(`/files/${folderId}`, { signal }).then((r) => r.data);

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
export const openEditCopy = (id) => api.post(`/files/${id}/edit-copy`, { open: false }).then((r) => r.data);
export const downloadEditCopy = (id) => withToken(`/api/files/${id}/edit-copy/download`);
export const commitEditCopy = (id, file) => {
  if (!file) return api.post(`/files/${id}/versions/commit`).then((r) => r.data);
  const form = new FormData();
  form.append('file', file);
  return api.post(`/files/${id}/versions/commit`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};
export const getFileVersions = (id) => api.get(`/files/${id}/versions`).then((r) => r.data);
export const setFileRole = (id, material_role) => api.put(`/files/${id}`, { material_role }).then((r) => r.data);
export const setFilesRole = (ids, material_role) => api.put('/files/roles/bulk', { ids, material_role }).then((r) => r.data);

export const getLinks = (folderId) => api.get(`/links/${folderId}`).then((r) => r.data);
export const createLink = (data) => api.post('/links', data).then((r) => r.data);
export const deleteLink = (id) => api.delete(`/links/${id}`);
export const reorderFolders = (items) =>
  api.put('/folders/reorder', { items });

export const saveFolderNotes = (id, content) =>
  api.put(`/folders/${id}/notes`, { content });

export const toggleFolderFavorite = (id) =>
  api.put(`/folders/${id}/favorite`).then((r) => r.data);
export const setFolderColor = (id, color) =>
  api.put(`/folders/${id}/color`, { color }).then((r) => r.data);

export const getAnnualPlan = (rootFolderId, schoolYear) =>
  api.get('/plans', { params: { folder_id: rootFolderId, school_year: schoolYear } }).then((r) => r.data);
export const createAnnualPlan = (data) => api.post('/plans', data).then((r) => r.data);
export const updateAnnualPlan = (id, data) => api.patch(`/plans/${id}`, data).then((r) => r.data);
export const deleteAnnualPlan = (id) => api.delete(`/plans/${id}`);
export const getAnnualPlanMaterials = (rootFolderId, q = '') =>
  api.get('/plans/materials', { params: { root_folder_id: rootFolderId, q } }).then((r) => r.data);
export const createAnnualPlanEntry = (planId, data) => api.post(`/plans/${planId}/entries`, data).then((r) => r.data);
export const updateAnnualPlanEntry = (id, data) => api.patch(`/plans/entries/${id}`, data).then((r) => r.data);
export const duplicateAnnualPlanEntry = (id) => api.post(`/plans/entries/${id}/duplicate`).then((r) => r.data);
export const deleteAnnualPlanEntry = (id) => api.delete(`/plans/entries/${id}`);
export const startAnnualPlanLessonSession = (id) => api.post(`/plans/entries/${id}/lesson-session`).then((r) => r.data);
export const annualPlanExportUrl = (id) => withToken(`/api/plans/${id}/export.csv`);

export const searchGlobal = (q, fileOffset = 0, folderOffset = 0, linkOffset = 0) =>
  api.get('/files/search', { params: { q, fileOffset, folderOffset, linkOffset } }).then((r) => r.data);

export const downloadFolderZip = (folderId) => withToken(`/api/files/zip/${folderId}`);
export const downloadFilesZip = (ids) => withToken(`/api/files/zip-selected?ids=${ids.join(',')}`);


export const getDocumentAnnotations = (fileId) => api.get(`/files/${fileId}/annotations`).then((r) => r.data);
export const createDocumentAnnotation = (fileId, data) => api.post(`/files/${fileId}/annotations`, data).then((r) => r.data);
export const updateDocumentAnnotation = (id, data) => api.patch(`/document-annotations/${id}`, data).then((r) => r.data);
export const deleteDocumentAnnotation = (id) => api.delete(`/document-annotations/${id}`).then((r) => r.data);

export const generateLessonDraft = (payload) =>
  api.post('/ai/lesson-draft', payload).then((r) => r.data);

export const generateDocument = (payload) =>
  api.post('/ai/generate-document', payload).then((r) => r.data);

export const getAiStatus = () =>
  api.get('/ai/status').then((r) => r.data);

export const testAiStatus = () =>
  api.post('/ai/status/test').then((r) => r.data);

export const getLessonSessions = () => api.get('/lesson-sessions').then((r) => r.data);
export const getLessonSession = (id) => api.get(`/lesson-sessions/${id}`).then((r) => r.data);
export const createLessonSession = (data) => api.post('/lesson-sessions', data).then((r) => r.data);
export const updateLessonSession = (id, data) => api.patch(`/lesson-sessions/${id}`, data).then((r) => r.data);
export const deleteLessonSession = (id) => api.delete(`/lesson-sessions/${id}`);
export const createLessonPhase = (id, data) => api.post(`/lesson-sessions/${id}/phases`, data).then((r) => r.data);
export const updateLessonPhase = (id, data) => api.patch(`/lesson-phases/${id}`, data).then((r) => r.data);
export const deleteLessonPhase = (id) => api.delete(`/lesson-phases/${id}`);
export const setLessonPhaseVisibility = (id, data) => api.put(`/lesson-phases/${id}/visibility`, data).then((r) => r.data);
export const createLessonDisplaySession = (id) => api.post(`/lesson-sessions/${id}/display-session`).then((r) => r.data);
export const updateLessonDisplaySession = (token, active_phase_id) => api.patch(`/display/${encodeURIComponent(token)}`, { active_phase_id }).then((r) => r.data);
export const getDisplaySession = (token) => axios.get(`/api/display/${encodeURIComponent(token)}`).then((r) => r.data);
export const getLessonCanvas = (sessionId, phaseId) => api.get(`/lesson-sessions/${sessionId}/canvas`, { params: { phase_id: phaseId } }).then((r) => r.data);
export const createLessonCanvasElement = (sessionId, phaseId, data) => api.post(`/lesson-sessions/${sessionId}/canvas`, { phase_id: phaseId, ...data }).then((r) => r.data);
export const updateLessonCanvasElement = (id, data) => api.patch(`/lesson-canvas-elements/${id}`, data).then((r) => r.data);
export const deleteLessonCanvasElement = (id) => api.delete(`/lesson-canvas-elements/${id}`);
export const setLessonCanvasVisibility = (id, visibility) => api.put(`/lesson-canvas-elements/${id}/visibility`, { visibility }).then((r) => r.data);
export const saveLessonLiveLayer = (phaseId, elements) => api.post(`/lesson-phases/${phaseId}/live-layer/save`, { elements }).then((r) => r.data);

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

export const getTodayDashboard = (date) =>
  api.get('/today-dashboard', { params: { date } }).then((r) => r.data);
export const saveTodayDashboardTasks = (tasks) =>
  api.put('/today-dashboard/tasks', { tasks }).then((r) => r.data);
export const saveTodayDashboardNote = (date, content) =>
  api.put('/today-dashboard/note', { date, content }).then((r) => r.data);

export const getBugChecklist = () => api.get('/bug-checklist').then((r) => r.data);
export const saveBugChecklist = (items) => api.put('/bug-checklist', { items }).then((r) => r.data);

export const getExams = () => api.get('/exams').then((r) => r.data);
export const createExam = (data) => api.post('/exams', data).then((r) => r.data);
export const updateExam = (id, data) => api.put(`/exams/${id}`, data).then((r) => r.data);
export const deleteExam = (id) => api.delete(`/exams/${id}`);

export default api;
