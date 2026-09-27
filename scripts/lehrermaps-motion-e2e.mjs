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
    await continueButton.click();
    await page.locator('.lm-app-shell').waitFor({ state: 'visible' });
    pass(name, 'continue action is immediately visible and opens the workspace');
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
