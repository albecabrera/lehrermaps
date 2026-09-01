#!/usr/bin/env node

import assert from 'node:assert/strict';
import { browserLaunchError, browserLaunchOptions } from './lehrermaps-responsive-e2e.mjs';

assert.deepEqual(browserLaunchOptions({}), { headless: true }, 'bundled Playwright Chromium is the default');
assert.deepEqual(
  browserLaunchOptions({ CHROME_PATH: '/custom/chromium' }),
  { headless: true, executablePath: '/custom/chromium' },
  'CHROME_PATH remains an explicit override',
);
const bundledError = browserLaunchError(new Error('browser executable missing'), {});
assert.match(bundledError, /npx playwright install chromium/, 'bundled-browser errors explain how to install it');
const overrideError = browserLaunchError(new Error('not executable'), { CHROME_PATH: '/custom/chromium' });
assert.match(overrideError, /CHROME_PATH=\/custom\/chromium/, 'override errors identify the configured browser');

console.log(JSON.stringify({ status: 'PASS', checks: ['bundled Chromium default', 'CHROME_PATH override', 'actionable launch errors'] }));
