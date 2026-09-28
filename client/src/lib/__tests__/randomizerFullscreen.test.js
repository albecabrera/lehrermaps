import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { closeRandomizerDisplayOnEscape, exitNativeRandomizerFullscreen, requestNativeRandomizerFullscreen } from '../randomizerFullscreen.js';

test('keeps the app fullscreen when the native Fullscreen API is unavailable', () => {
  let fallbackCalls = 0;
  const started = requestNativeRandomizerFullscreen({
    element: {},
    documentRef: {},
    onFallback: () => { fallbackCalls += 1; },
  });

  assert.equal(started, false);
  assert.equal(fallbackCalls, 1);
});

test('falls back to the app fullscreen when native fullscreen is rejected', async () => {
  let fallbackCalls = 0;
  const element = { requestFullscreen: () => Promise.reject(new Error('denied')) };
  const started = requestNativeRandomizerFullscreen({
    element,
    documentRef: {},
    onFallback: () => { fallbackCalls += 1; },
  });

  assert.equal(started, true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fallbackCalls, 1);
});

test('requests native fullscreen synchronously and keeps it on supported browsers', async () => {
  const documentRef = { fullscreenElement: null };
  const element = {
    requestFullscreen: () => {
      documentRef.fullscreenElement = element;
      return Promise.resolve();
    },
  };
  let nativeCalls = 0;

  const started = requestNativeRandomizerFullscreen({ element, documentRef, onNative: () => { nativeCalls += 1; } });
  assert.equal(started, true);
  assert.equal(documentRef.fullscreenElement, element, 'the request runs in the user action, before an async turn');
  await Promise.resolve();
  assert.equal(nativeCalls, 1);
});

test('close exits only the randomizer native fullscreen and Escape closes the app fallback', async () => {
  const display = {};
  let exits = 0;
  const documentRef = { fullscreenElement: display, exitFullscreen: async () => { exits += 1; } };
  assert.equal(await exitNativeRandomizerFullscreen({ element: display, documentRef }), true);
  assert.equal(exits, 1);
  assert.equal(await exitNativeRandomizerFullscreen({ element: {}, documentRef }), false);

  let closed = 0;
  let prevented = 0;
  let stopped = 0;
  assert.equal(closeRandomizerDisplayOnEscape({ key: 'Escape', preventDefault: () => { prevented += 1; }, stopImmediatePropagation: () => { stopped += 1; } }, () => { closed += 1; }), true);
  assert.equal(closed, 1);
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
});

test('renders the fallback through a body portal above the randomizer modal', async () => {
  const componentPath = fileURLToPath(new URL('../../components/HeaderRandomizer.jsx', import.meta.url));
  const appPath = fileURLToPath(new URL('../../pages/App.jsx', import.meta.url));
  const cssPath = fileURLToPath(new URL('../../index.css', import.meta.url));
  const [component, app, css] = await Promise.all([readFile(componentPath, 'utf8'), readFile(appPath, 'utf8'), readFile(cssPath, 'utf8')]);

  assert.match(component, /createPortal\(<section ref=\{displayRef\}/);
  assert.match(component, /<\/section>, document\.body\)}/);
  assert.match(css, /\.lm-header-randomizer-backdrop \{[^}]*z-index:5000/);
  assert.match(css, /\.lm-header-randomizer-display \{[^}]*z-index:6000/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(app, /className="lm-phone-randomizer-trigger"/);
  assert.match(app, /setRandomizerOpenRequest\(\(request\) => request \+ 1\)/);
  assert.equal((app.match(/<HeaderRandomizer\b/g) || []).length, 1, 'the mobile trigger must reuse the single HeaderRandomizer instance');
});
