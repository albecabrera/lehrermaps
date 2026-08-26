#!/usr/bin/env node

const apiBaseUrl = process.env.LEHRERMAPS_API_URL || 'http://localhost:3001';
const teacherPassword = process.env.LEHRERMAPS_TEACHER_PASSWORD || 'lehrer';
const studentPassword = process.env.LEHRERMAPS_STUDENT_PASSWORD || 'schueler';
const marker = `AUTHZ${Date.now()}`;
const folders = [];
const files = [];
let sessionId;
let teacherToken;
let studentToken;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { token, method = 'GET', body, expected = 200 } = {}) {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body && !(body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  if (response.status !== expected) {
    throw new Error(`${method} ${path}: expected ${expected}, got ${response.status} (${JSON.stringify(data)})`);
  }
  return data;
}

async function upload(folderId, name, content, mimeType) {
  const form = new FormData();
  form.append('folder_id', String(folderId));
  form.append('file', new Blob([content], { type: mimeType }), name);
  const file = await request('/api/files/upload', { token: teacherToken, method: 'POST', body: form, expected: 201 });
  files.push(file.id);
  return file;
}

try {
  teacherToken = (await request('/api/login', { method: 'POST', body: { password: teacherPassword } })).token;
  studentToken = (await request('/api/login-student', { method: 'POST', body: { password: studentPassword } })).token;

  const grandparentFolder = await request('/api/folders', {
    token: teacherToken,
    method: 'POST',
    expected: 201,
    body: { subject: 'informatik', group_name: 'TEST', name: `${marker} GRANDPARENT` },
  });
  const parentFolder = await request('/api/folders', {
    token: teacherToken,
    method: 'POST',
    expected: 201,
    body: { subject: 'informatik', group_name: 'TEST', name: `${marker} PARENT`, parent_id: grandparentFolder.id },
  });
  const sharedFolder = await request('/api/folders', {
    token: teacherToken,
    method: 'POST',
    expected: 201,
    body: { subject: 'informatik', group_name: 'TEST', name: `${marker} SHARED`, parent_id: parentFolder.id },
  });
  const privateFolder = await request('/api/folders', {
    token: teacherToken,
    method: 'POST',
    expected: 201,
    body: { subject: 'informatik', group_name: 'TEST', name: `${marker} PRIVATE` },
  });
  folders.push(grandparentFolder.id, parentFolder.id, sharedFolder.id, privateFolder.id);
  await request(`/api/folders/${grandparentFolder.id}/notes`, { token: teacherToken, method: 'PUT', body: { content: `${marker} GRANDPARENT SECRET` } });
  await request(`/api/folders/${parentFolder.id}/notes`, { token: teacherToken, method: 'PUT', body: { content: `${marker} PARENT SECRET` } });
  await request(`/api/folders/${sharedFolder.id}/notes`, { token: teacherToken, method: 'PUT', body: { content: `${marker} SECRET NOTE` } });
  await request(`/api/folders/${privateFolder.id}/notes`, { token: teacherToken, method: 'PUT', body: { content: `${marker} PRIVATE FOLDER NOTE` } });

  const sharedFile = await upload(sharedFolder.id, `${marker}-shared.txt`, `${marker} SHARED CONTENT`, 'text/plain');
  const privateFile = await upload(sharedFolder.id, `${marker}-private.docx`, `${marker} PRIVATE CONTENT`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const privateOnlyFile = await upload(privateFolder.id, `${marker}-private-only.txt`, `${marker} PRIVATE ONLY`, 'text/plain');
  await request(`/api/files/${sharedFile.id}/share`, { token: teacherToken, method: 'PUT' });
  await request('/api/links', {
    token: teacherToken,
    method: 'POST',
    expected: 201,
    body: { folder_id: sharedFolder.id, title: `${marker} PRIVATE LINK`, url: 'https://example.invalid/private' },
  });

  const session = await request('/api/lesson-sessions', {
    token: teacherToken,
    method: 'POST',
    expected: 201,
    body: {
      folder_id: sharedFolder.id,
      title: `${marker} PRIVATE SESSION`,
      teacher_notes: `${marker} PRIVATE TEACHER NOTES`,
      phases: [{ title: 'Private Phase', teacher_notes: `${marker} PRIVATE PHASE NOTES` }],
    },
  });
  sessionId = session.id;
  await request(`/api/lesson-sessions/${session.id}/canvas`, {
    token: teacherToken,
    method: 'POST',
    expected: 201,
    body: { phase_id: session.phases[0].id, type: 'text', content: { text: `${marker} PRIVATE CANVAS` }, visibility: 'private' },
  });

  // Teacher compatibility: private resources remain available to the teacher.
  assert((await request(`/api/files/view/${privateFile.id}`, { token: teacherToken })).toString().includes('PRIVATE CONTENT'), 'teacher cannot view private file');
  assert((await request(`/api/links/${sharedFolder.id}`, { token: teacherToken })).some((link) => link.title.includes(marker)), 'teacher cannot read private link');
  assert((await request('/api/folders', { token: teacherToken })).some((folder) => folder.id === privateFolder.id && folder.notes?.includes(marker)), 'teacher cannot read private folder metadata');
  assert((await request(`/api/lesson-sessions/${session.id}`, { token: teacherToken })).teacher_notes.includes(marker), 'teacher cannot read private lesson session');
  assert((await request(`/api/lesson-sessions/${session.id}/canvas`, { token: teacherToken })).elements.some((element) => element.content?.text?.includes(marker)), 'teacher cannot read private canvas');

  // Students may only discover and retrieve explicitly shared current files.
  const studentFolders = await request('/api/folders', { token: studentToken });
  const visibleFolder = studentFolders.find((folder) => folder.id === sharedFolder.id);
  assert(visibleFolder, 'student cannot see folder containing a shared file');
  assert(studentFolders.some((folder) => folder.id === parentFolder.id), 'student folder list omits shared folder parent');
  assert(studentFolders.some((folder) => folder.id === grandparentFolder.id), 'student folder list omits shared folder grandparent');
  assert(!studentFolders.some((folder) => folder.id === privateFolder.id), 'student can see private-only folder');
  for (const folder of studentFolders.filter((entry) => [grandparentFolder.id, parentFolder.id, sharedFolder.id].includes(entry.id))) {
    for (const privateField of ['notes', 'is_favorite', 'file_count', 'total_size_bytes', 'thumbnail_file_id']) {
      assert(!Object.prototype.hasOwnProperty.call(folder, privateField), `student can read private folder field ${privateField}`);
    }
  }

  const studentFiles = await request(`/api/files/${sharedFolder.id}`, { token: studentToken });
  assert(studentFiles.length === 1 && studentFiles[0].id === sharedFile.id, 'student folder listing contains private files');
  assert((await request(`/api/files/view/${sharedFile.id}`, { token: studentToken })).toString().includes('SHARED CONTENT'), 'student cannot view shared file');
  for (const endpoint of ['view', 'download', 'preview']) {
    await request(`/api/files/${endpoint}/${privateFile.id}`, { token: studentToken, expected: 404 });
  }
  await request(`/api/files/open/${sharedFile.id}`, { token: studentToken, expected: 403 });
  await request(`/api/files/open/${privateFile.id}`, { token: studentToken, expected: 403 });
  await request(`/api/files/zip/${privateFolder.id}`, { token: studentToken, expected: 404 });
  await request(`/api/files/zip-selected?ids=${privateFile.id},${privateOnlyFile.id}`, { token: studentToken, expected: 404 });
  const folderZip = await request(`/api/files/zip/${sharedFolder.id}`, { token: studentToken });
  assert(folderZip.includes(Buffer.from(sharedFile.original_name)), 'student folder ZIP omits shared file');
  assert(!folderZip.includes(Buffer.from(privateFile.original_name)), 'student folder ZIP contains private file');
  const selectedZip = await request(`/api/files/zip-selected?ids=${sharedFile.id},${privateFile.id}`, { token: studentToken });
  assert(selectedZip.includes(Buffer.from(sharedFile.original_name)), 'student selected ZIP omits shared file');
  assert(!selectedZip.includes(Buffer.from(privateFile.original_name)), 'student selected ZIP contains private file');

  const search = await request(`/api/files/search?q=${marker}`, { token: studentToken });
  assert(search.files.length === 1 && search.files[0].id === sharedFile.id, 'student search contains private files');
  assert(search.folders.every((folder) => folder.id !== privateFolder.id), 'student search contains private-only folder');
  assert(search.links.length === 0 && search.totalLinks === 0, 'student search contains private links');
  assert((await request(`/api/links/${sharedFolder.id}`, { token: studentToken })).length === 0, 'student can read private links');

  await request('/api/lesson-sessions', { token: studentToken, expected: 403 });
  await request(`/api/lesson-sessions/${session.id}`, { token: studentToken, expected: 403 });
  await request(`/api/lesson-sessions/${session.id}/canvas`, { token: studentToken, expected: 403 });

  console.log(JSON.stringify({
    status: 'PASS',
    checks: ['private file reads', 'teacher-only local open', 'file search and ZIP', 'complete safe folder hierarchy', 'links', 'lesson sessions and canvas', 'teacher compatibility'],
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  if (teacherToken) {
    if (sessionId) await request(`/api/lesson-sessions/${sessionId}`, { token: teacherToken, method: 'DELETE' }).catch(() => {});
    for (const id of files) await request(`/api/files/${id}`, { token: teacherToken, method: 'DELETE' }).catch(() => {});
    for (const id of folders.reverse()) await request(`/api/folders/${id}`, { token: teacherToken, method: 'DELETE' }).catch(() => {});
  }
}
