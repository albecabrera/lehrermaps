#!/usr/bin/env node
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(new URL('../client/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.env.LEHRERMAPS_URL || 'http://localhost:8090';
const teacherPassword = process.env.LEHRERMAPS_TEACHER_PASSWORD || 'lehrer';
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pass(name, detail) { results.push({ name, status: 'PASS', detail }); }
function fail(name, error) { results.push({ name, status: 'FAIL', detail: error.message }); }

async function submitLogin(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const teacherButton = page.getByRole('button', { name: /Lehrer/i });
  if (await teacherButton.count()) await teacherButton.first().click();
  await page.locator('input[type="password"]').fill(teacherPassword);
  await page.locator('form button[type="submit"]').click();
}

async function runCase(browser, { name, reducedMotion }) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  try {
    await submitLogin(page);
    if (reducedMotion === 'reduce') {
      await page.locator('.lm-app-shell').waitFor({ state: 'visible' });
      assert(!(await page.locator('.lm-login-welcome').isVisible().catch(() => false)), 'reduced motion must bypass the welcome screen');
      pass(name, 'welcome bypassed immediately');
      return;
    }

    const welcome = page.locator('.lm-login-welcome');
    const continueButton = page.getByRole('button', { name: 'Weiter zu LehrerMaps' });
    await welcome.waitFor({ state: 'visible' });
    await continueButton.waitFor({ state: 'visible' });
    assert(await continueButton.evaluate((node) => document.activeElement === node), 'continue action must receive focus immediately');
    const startedAt = Date.now();
    await welcome.waitFor({ state: 'hidden', timeout: 3000 });
    const elapsed = Date.now() - startedAt;
    assert(elapsed >= 1800 && elapsed <= 2700, `welcome must auto-close at about 2 seconds (received ${elapsed}ms)`);
    await page.locator('.lm-app-shell').waitFor({ state: 'visible' });
    for (const shortcut of ['Meta+s', 'Control+s']) {
      await page.keyboard.press(shortcut);
      assert(!(await page.locator('.lm-desktop-app-rail').isVisible().catch(() => false)), `${shortcut} must hide the app rail`);
      assert(!(await page.locator('.lm-tabbar').isVisible().catch(() => false)), `${shortcut} must hide the header`);
      await page.keyboard.press(shortcut);
      assert(await page.locator('.lm-desktop-app-rail').isVisible(), `${shortcut} must restore the app rail`);
      assert(await page.locator('.lm-tabbar').isVisible(), `${shortcut} must restore the header`);
    }
    pass(name, 'welcome auto-closes after about 2 seconds and Cmd/Ctrl+S toggles the workspace chrome');
  } catch (error) {
    fail(name, error);
  } finally {
    await context.close();
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    await runCase(browser, { name: 'standard motion welcome', reducedMotion: 'no-preference' });
    await runCase(browser, { name: 'reduced motion welcome', reducedMotion: 'reduce' });
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ baseUrl, results }, null, 2));
  if (results.some(({ status }) => status === 'FAIL')) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run().catch((error) => {
    console.error(JSON.stringify({ status: 'FAIL', error: error.message }, null, 2));
    process.exitCode = 1;
  });
}
