#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(new URL('../client/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.env.LEHRERMAPS_URL || 'http://localhost:8090';
const teacherPassword = process.env.LEHRERMAPS_TEACHER_PASSWORD || 'lehrer';
const viewports = [
  { name: 'iPhone SE', width: 375, height: 667, mobile: true, mobileUi: true },
  { name: 'iPhone 12/13', width: 390, height: 844, mobile: true, mobileUi: true },
  { name: 'iPhone Pro Max', width: 430, height: 932, mobile: true, mobileUi: true },
  { name: 'iPhone landscape', width: 844, height: 390, mobile: true, mobileUi: false },
  { name: 'iPad portrait', width: 768, height: 1024, mobile: true, mobileUi: false },
  { name: 'iPad landscape', width: 1024, height: 1366, mobile: true, mobileUi: false },
  { name: 'Desktop', width: 1440, height: 900, mobile: false },
];

const results = [];
const pass = (name, detail = '') => results.push({ name, status: 'PASS', detail });
const fail = (name, error) => results.push({ name, status: 'FAIL', detail: error.message });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function measureLayout(page, viewport) {
  const state = await page.evaluate(() => {
    const doc = document.documentElement;
    const visible = [...document.querySelectorAll('button, input, textarea, select, [role="dialog"]')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 30), width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom, position: getComputedStyle(element).position, inNav: Boolean(element.closest('nav')) };
      });
    return { scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth), innerWidth: window.innerWidth, innerHeight: window.innerHeight, visible };
  });
  assert(state.scrollWidth <= state.innerWidth + 2, `horizontal overflow ${state.scrollWidth}px > ${state.innerWidth}px`);
  // Controls in intentionally scrollable lists may be below the viewport. Only
  // fixed overlays and dialogs are layout-clipping regressions.
  const clipped = state.visible.filter((item) => (item.position === 'fixed' || item.label === undefined) && (item.right > state.innerWidth + 2 || item.bottom > state.innerHeight + 2));
  assert(!clipped.length, `clipped control/dialog: ${JSON.stringify(clipped.slice(0, 3))}`);
  if (viewport.mobileUi) {
    const small = state.visible.filter((item) => item.inNav && (item.width < 44 || item.height < 44));
    assert(!small.length, `touch target below 32px: ${JSON.stringify(small.slice(0, 3))}`);
  }
}

async function login(page) {
  // The app keeps API/service-worker activity alive; DOM readiness is the stable
  // boundary for this audit, followed by a short settling delay below.
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
  const teacherButton = page.getByRole('button', { name: /Lehrer/i });
  if (await teacherButton.count()) await teacherButton.first().click();
  await page.locator('input[type="password"]').waitFor({ state: 'visible' });
  await page.locator('input[type="password"]').fill(teacherPassword);
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(700);
  assert(!(await page.locator('body').innerText()).includes('Falsches Passwort'), 'teacher login failed');
}

async function exerciseTeacherMobile(page) {
  // Seeded deployments may reopen the last teacher overlay; reset it before
  // exercising the navigation underneath.
  if (await page.locator('.eb-board').count()) {
    const dismiss = page.getByRole('button', { name: /Weiter zu LehrerMaps/i });
    if (await dismiss.count()) await dismiss.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
  const menu = page.getByRole('button', { name: /Sidebar|Seitenleiste|Ordner/i }).first();
  if (await menu.count()) {
    await menu.click();
    assert(await page.locator('.lm-drawer').count() === 1, 'teacher drawer did not open');
    await page.mouse.click(page.viewportSize().width - 4, page.viewportSize().height / 2);
  }
  const more = page.getByRole('button', { name: /Mehr/i }).last();
  await more.click();
  assert(await page.locator('.lm-modal-surface').count() === 1, 'more sheet did not open');
  await page.mouse.click(10, 10);
  await page.getByRole('button', { name: /Suche/i }).click();
  await page.waitForTimeout(100);
  assert(await page.locator('input').count() > 0, 'search control did not open');
  await page.mouse.click(10, 10);
}

async function run() {
  const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const viewport of viewports) {
      for (const role of ['teacher']) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          isMobile: viewport.mobile,
          hasTouch: viewport.mobile,
          deviceScaleFactor: viewport.mobile ? 2 : 1,
        });
        const page = await context.newPage();
        page.setDefaultTimeout(5000);
        const consoleErrors = [];
        page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        page.on('pageerror', (error) => consoleErrors.push(error.message));
        try {
          await login(page);
          await measureLayout(page, viewport);
          if (viewport.mobileUi && role === 'teacher') await exerciseTeacherMobile(page);
          await measureLayout(page, viewport);
          assert(!consoleErrors.length, `console errors: ${consoleErrors.join('; ')}`);
          pass(`${viewport.name} · ${role}`, 'login, layout, interaction, console');
        } catch (error) {
          fail(`${viewport.name} · ${role}`, error);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
  if (results.some(({ status }) => status === 'FAIL')) process.exitCode = 1;
}

run().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }, null, 2));
  process.exitCode = 1;
});
