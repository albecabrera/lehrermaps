import { createRequire } from 'node:module';

const require = createRequire(new URL('../client/package.json', import.meta.url));
export const { chromium } = require('playwright');

export const baseUrl = process.env.LEHRERMAPS_URL || 'http://localhost:8090';
export const apiBaseUrl = process.env.LEHRERMAPS_API_URL
  || (new URL(baseUrl).port === '8090' ? 'http://localhost:3001' : baseUrl);
export const chromePath = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export class CleanupStack {
  #tasks = [];

  defer(label, task) {
    this.#tasks.push({ label, task });
  }

  async run() {
    const failures = [];
    while (this.#tasks.length) {
      const { label, task } = this.#tasks.pop();
      try { await task(); }
      catch (error) { failures.push(`${label}: ${error.message}`); }
    }
    return failures;
  }
}

export function createApiClient(defaultToken = null) {
  let token = defaultToken;

  return {
    setToken(value) { token = value; },
    async request(path, options = {}) {
      const { expectedStatus, token: requestToken = token, ...fetchOptions } = options;
      const headers = new Headers(fetchOptions.headers || {});
      if (requestToken) headers.set('Authorization', `Bearer ${requestToken}`);
      if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) headers.set('Content-Type', 'application/json');
      const response = await fetch(`${apiBaseUrl}${path}`, { ...fetchOptions, headers });
      const contentType = response.headers.get('content-type') || '';
      const body = contentType.includes('json')
        ? await response.json().catch(() => null)
        : await response.arrayBuffer();
      if (expectedStatus !== undefined) {
        if (response.status !== expectedStatus) {
          throw new Error(`${fetchOptions.method || 'GET'} ${path} -> ${response.status}, erwartet ${expectedStatus}: ${formatBody(body)}`);
        }
        return body;
      }
      if (!response.ok) {
        throw new Error(`${fetchOptions.method || 'GET'} ${path} -> ${response.status}: ${formatBody(body)}`);
      }
      return body;
    },
  };
}

function formatBody(body) {
  if (body instanceof ArrayBuffer) return `<${body.byteLength} Bytes>`;
  return JSON.stringify(body);
}

export async function loginApi(role, password) {
  const client = createApiClient();
  const endpoint = role === 'student' ? '/api/login-student' : '/api/login';
  const fallback = role === 'student' ? 'schueler' : 'lehrer';
  const result = await client.request(endpoint, {
    method: 'POST',
    body: JSON.stringify({ password: password || fallback }),
    token: null,
  });
  assert(result?.token, `${role} login lieferte kein Token`);
  return result.token;
}

export function collectConsoleErrors(page, { ignore = [] } = {}) {
  const errors = [];
  const ignored = ignore.map((entry) => entry instanceof RegExp ? entry : new RegExp(entry));
  const record = (message) => {
    if (!ignored.some((pattern) => pattern.test(message))) errors.push(message);
  };
  const onConsole = (message) => { if (message.type() === 'error') record(message.text()); };
  const onPageError = (error) => record(error.message);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  return {
    errors,
    assertEmpty(context = 'Browser') {
      assert(!errors.length, `${context} Console-Fehler: ${errors.join('; ')}`);
    },
    stop() {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    },
  };
}

export async function closeInitialAppointmentsOverlay(page) {
  const board = page.locator('.eb-board');
  if (!await board.count()) return false;
  const dismiss = page.getByRole('button', { name: /Weiter zu LehrerMaps/i });
  if (await dismiss.count()) await dismiss.first().click();
  else await page.keyboard.press('Escape');
  await board.waitFor({ state: 'detached', timeout: 5000 }).catch(async () => {
    await board.waitFor({ state: 'hidden', timeout: 1000 });
  });
  return true;
}

export async function loginPage(page, {
  role = 'teacher',
  token = null,
  password = null,
  closeAppointments = true,
} = {}) {
  page.setDefaultTimeout(7000);
  if (token) {
    await page.addInitScript(({ value, dismiss }) => {
      localStorage.setItem('lm_token', value);
      if (dismiss) sessionStorage.setItem('lm_exams_board_seen', '1');
      else sessionStorage.removeItem('lm_exams_board_seen');
    }, { value: token, dismiss: closeAppointments });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } else {
    await page.goto(`${baseUrl}/${role === 'student' ? '?student' : ''}`, {
      waitUntil: 'domcontentloaded', timeout: 15000,
    });
    if (role === 'teacher') {
      const teacherButton = page.getByRole('button', { name: /Lehrer/i });
      if (await teacherButton.count()) await teacherButton.first().click();
    }
    await page.locator('input[type="password"]').fill(password
      || (role === 'student'
        ? process.env.LEHRERMAPS_STUDENT_PASSWORD || 'schueler'
        : process.env.LEHRERMAPS_TEACHER_PASSWORD || 'lehrer'));
    await page.locator('form button[type="submit"]').click();
  }
  await page.waitForTimeout(500);
  assert(!/Falsches Passwort/i.test(await page.locator('body').innerText()), `${role} login fehlgeschlagen`);
  if (closeAppointments && role === 'teacher') await closeInitialAppointmentsOverlay(page);
}

export async function readDownload(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}
