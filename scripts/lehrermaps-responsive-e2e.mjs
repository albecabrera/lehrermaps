#!/usr/bin/env node
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(new URL('../client/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.env.LEHRERMAPS_URL || 'http://localhost:8090';
const teacherPassword = process.env.LEHRERMAPS_TEACHER_PASSWORD || 'lehrer';
const viewports = [
  { name: 'iPhone 13', width: 390, height: 844, deviceScaleFactor: 3, touch: true, mobileUi: true },
  { name: 'iPad Pro 13 M5 portrait', width: 1032, height: 1376, deviceScaleFactor: 2, touch: true, mobileUi: true },
  // The app intentionally switches to its desktop header above 1100px.
  { name: 'iPad Pro 13 M5 landscape', width: 1376, height: 1032, deviceScaleFactor: 2, touch: true, mobileUi: false },
  { name: 'MacBook Pro 16 M1', width: 1728, height: 1117, deviceScaleFactor: 2, touch: false, mobileUi: false },
];

const results = [];
const pass = (name, detail = '') => results.push({ name, status: 'PASS', detail });
const fail = (name, error) => results.push({ name, status: 'FAIL', detail: error.message });

export function browserLaunchOptions(environment = process.env) {
  return environment.CHROME_PATH
    ? { headless: true, executablePath: environment.CHROME_PATH }
    : { headless: true };
}

export function browserLaunchError(error, environment = process.env) {
  const configuredBrowser = environment.CHROME_PATH
    ? `CHROME_PATH=${environment.CHROME_PATH}`
    : 'the bundled Playwright Chromium';
  return `Could not launch ${configuredBrowser}. Install the bundled browser with "npx playwright install chromium" from client/, or set CHROME_PATH to a valid Chromium/Chrome executable. Original error: ${error.message}`;
}

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
  if (viewport.touch) {
    const small = state.visible.filter((item) => item.inNav && (item.width < 44 || item.height < 44));
    assert(!small.length, `touch target below 44px: ${JSON.stringify(small.slice(0, 3))}`);
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

async function exerciseHomeDrawer(page) {
  // Seeded deployments may reopen the last teacher overlay; reset it before
  // exercising Home navigation underneath.
  if (await page.locator('.eb-board').count()) {
    const dismiss = page.getByRole('button', { name: /Weiter zu LehrerMaps/i });
    if (await dismiss.count()) await dismiss.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
  const menu = page.getByRole('button', { name: /Sidebar ausklappen|Seitenleiste öffnen/i }).first();
  assert(await menu.count() === 1, 'Home drawer trigger is unavailable');

  await menu.click();
  await page.locator('.lm-drawer').waitFor({ state: 'visible' });
  await page.mouse.click(page.viewportSize().width - 4, page.viewportSize().height / 2);
  await page.locator('.lm-drawer').waitFor({ state: 'hidden' });

  await menu.click();
  await page.locator('.lm-drawer').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.locator('.lm-drawer').waitFor({ state: 'hidden' });
}

async function exerciseKlausurplan(page) {
  const toggle = page.getByRole('button', { name: 'Klausurplan' }).first();
  assert(await toggle.count() === 1, 'Klausurplan toggle is unavailable');

  await toggle.click();
  await page.locator('#lm-klasurplan-menu').waitFor({ state: 'visible' });
  assert(await page.getByRole('menuitem', { name: /1\. Quartal/i }).count() === 1, '1. Quartal is unavailable');
  assert(await page.getByRole('menuitem', { name: /2\. Quartal/i }).count() === 1, '2. Quartal is unavailable');
  await page.keyboard.press('Escape');
  await page.locator('#lm-klasurplan-menu').waitFor({ state: 'hidden' });
}

async function run() {
  let browser;
  try {
    browser = await chromium.launch(browserLaunchOptions());
  } catch (error) {
    throw new Error(browserLaunchError(error));
  }
  try {
    for (const viewport of viewports) {
      for (const role of ['teacher']) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          isMobile: viewport.touch,
          hasTouch: viewport.touch,
          deviceScaleFactor: viewport.deviceScaleFactor,
        });
        const page = await context.newPage();
        page.setDefaultTimeout(5000);
        const consoleErrors = [];
        page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        page.on('pageerror', (error) => consoleErrors.push(error.message));
        try {
          await login(page);
          await measureLayout(page, viewport);
          if (viewport.mobileUi && role === 'teacher') await exerciseHomeDrawer(page);
          await exerciseKlausurplan(page);
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run().catch((error) => {
    console.error(JSON.stringify({ status: 'FAIL', error: error.message }, null, 2));
    process.exitCode = 1;
  });
}
