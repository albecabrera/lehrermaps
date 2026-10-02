#!/usr/bin/env node
import { chromium, assert, baseUrl, loginPage } from './e2e-helpers.mjs';

async function openPresentation(page) {
  const welcome = page.locator('.lm-login-welcome');
  if (await welcome.count()) await welcome.waitFor({ state: 'hidden', timeout: 5000 });
  await page.goto(`${baseUrl}/#reflection`, { waitUntil: 'domcontentloaded' });
  await page.locator('.lm-reflection-board').waitFor({ state: 'visible' });
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
    const stage = presentation.locator('.lm-reflection-presentation-stage');
    const start = page.getByRole('button', { name: 'Start', exact: true });
    assert(await stage.isVisible(), `${name}: playback stage is missing`);
    assert(await start.isVisible(), `${name}: playback must offer a start control`);
    assert(await presentation.getByText('Was nehme ich aus der heutigen Stunde mit?', { exact: true }).isVisible(), `${name}: intro must show the suitcase prompt`);
    assert(await presentation.getByText('Was lasse ich hier?', { exact: true }).isVisible(), `${name}: intro must show the trash prompt`);
    assert(await presentation.locator('.lm-reflection-presentation-intro .lm-reflection-suitcase-scene').isVisible(), `${name}: intro must show a suitcase`);
    assert(await presentation.locator('.lm-reflection-presentation-intro .lm-reflection-trash-scene').isVisible(), `${name}: intro must show a trash bin`);
    assert((await presentation.getByRole('button').count()) === 3, `${name}: presentation must only expose the three playback controls`);
    assert((await page.getByRole('button', { name: 'Präsentation beenden' }).count()) === 0, `${name}: presentation must not expose an exit control`);

    if ((await start.isDisabled())) {
      assert(await start.isDisabled(), `${name}: empty queue must not start playback`);
    } else {
      await start.click();
      const firstItem = presentation.locator('.lm-reflection-presentation-item');
      await firstItem.waitFor({ state: 'visible' });
      assert(await firstItem.evaluate((node) => node.classList.contains('lm-reflection-presentation-item--koffer')), `${name}: koffer items must play first`);

      const next = page.getByRole('button', { name: 'Weiter' });
      if (reducedMotion === 'reduce') {
        assert(!(await next.isDisabled()), `${name}: reduced motion must keep controls usable`);
        assert((await firstItem.locator('.lm-reflection-trash-pop').count()) === 0, `${name}: reduced motion must not show an explosion on koffer`);
      } else {
        const suitcaseSentence = firstItem.locator('.lm-reflection-presentation-sentence--suitcase');
        assert(await suitcaseSentence.count() === 1, `${name}: koffer items need a sentence that can emerge from the suitcase`);
        await page.waitForTimeout(1000);
        assert(Number(await suitcaseSentence.evaluate((node) => getComputedStyle(node).opacity)) === 0, `${name}: suitcase sentence must wait until one second after opening`);
        await page.waitForTimeout(650);
        assert(Number(await suitcaseSentence.evaluate((node) => getComputedStyle(node).opacity)) > 0, `${name}: suitcase sentence must emerge after the opening delay`);
        const sentenceTop = await suitcaseSentence.evaluate((node) => node.getBoundingClientRect().top);
        const suitcaseTop = await firstItem.locator('.lm-reflection-suitcase-scene').evaluate((node) => node.getBoundingClientRect().top);
        assert(sentenceTop < suitcaseTop, `${name}: suitcase sentence must finish above the suitcase`);
        assert(await next.isDisabled(), `${name}: next must wait for the active animation`);
        await expectEnabled(next, 3600, `${name}: koffer animation did not complete`);
      }

      const classNames = await firstItem.evaluate((node) => node.className);
      if (classNames.includes('muellkorb')) {
        assert(await firstItem.locator('.lm-reflection-trash-scene').isVisible(), `${name}: muellkorb step needs a bin`);
        if (reducedMotion === 'reduce') assert(!(await firstItem.locator('.lm-reflection-trash-pop').isVisible()), `${name}: reduced motion must hide the comic explosion`);
      } else if (reducedMotion === 'reduce') {
        await next.click();
        const trashItem = presentation.locator('.lm-reflection-presentation-item--muellkorb');
        if (await trashItem.count()) {
          await trashItem.waitFor({ state: 'visible' });
          assert(await trashItem.locator('.lm-reflection-trash-scene').isVisible(), `${name}: queue must render the muellkorb flow after koffer`);
          assert(!(await trashItem.locator('.lm-reflection-trash-pop').isVisible()), `${name}: reduced motion must suppress the comic explosion`);
        }
      }
      assert(await page.getByRole('button', { name: 'Neu starten' }).isEnabled(), `${name}: restart must be available after starting`);
    }

    console.log(JSON.stringify({ name, status: 'PASS', baseUrl }));
  } finally {
    await context.close();
  }
}

async function expectEnabled(locator, timeout, message) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (!(await locator.isDisabled())) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert(false, message);
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
