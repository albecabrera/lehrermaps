#!/usr/bin/env node
import { chromium, assert, baseUrl, loginPage } from './e2e-helpers.mjs';

async function openPresentation(page) {
  const welcome = page.locator('.lm-login-welcome');
  if (await welcome.count()) await welcome.waitFor({ state: 'hidden', timeout: 5000 });
  await page.getByRole('button', { name: 'Koffer oder Müllkorb?' }).first().click();
  await page.getByRole('button', { name: 'Zusammenfassung präsentieren' }).click();
  const presentation = page.locator('.lm-reflection-presentation');
  await presentation.waitFor({ state: 'visible' });
  return presentation;
}

async function runCase(browser, { name, reducedMotion }) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  try {
    await loginPage(page, { closeAppointments: true });
    const presentation = await openPresentation(page);
    const destinations = presentation.locator('.lm-reflection-presentation-destinations .lm-reflection-column');
    assert(await destinations.count() === 2, `${name}: presentation must show exactly two destinations`);
    assert(await presentation.locator('.lm-reflection-presentation-phase').isVisible(), `${name}: reflection phase is missing`);
    assert(await presentation.locator('.lm-reflection-column--unklar').count() === 0, `${name}: Unklar must stay hidden`);

    const phaseTop = await presentation.locator('.lm-reflection-presentation-phase').evaluate((node) => node.getBoundingClientRect().top);
    const destinationsTop = await destinations.first().evaluate((node) => node.getBoundingClientRect().top);
    assert(phaseTop < destinationsTop, `${name}: reflection phase must be above destinations`);

    const animationName = await presentation.locator('.lm-reflection-presentation-phase').evaluate((node) => getComputedStyle(node).animationName);
    if (reducedMotion === 'reduce') assert(animationName === 'none', `${name}: reduced motion must disable presentation animation`);
    else assert(animationName !== 'none', `${name}: presentation should provide an entrance animation`);

    await page.getByRole('button', { name: 'Präsentation beenden' }).click();
    await page.locator('.lm-reflection-board.is-presentation').waitFor({ state: 'hidden' });
    console.log(JSON.stringify({ name, status: 'PASS', baseUrl }));
  } finally {
    await context.close();
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    await runCase(browser, { name: 'reflection presentation', reducedMotion: 'no-preference' });
    await runCase(browser, { name: 'reflection presentation reduced motion', reducedMotion: 'reduce' });
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, baseUrl }, null, 2));
  process.exitCode = 1;
});
