#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssPath = path.join(root, 'client/src/index.css');
const themeContextPath = path.join(root, 'client/src/contexts/ThemeContext.jsx');

const PREMIUM_DARK_TOKENS = {
  '--c-bg': '#0B0B0D',
  '--c-bg-secondary': '#111113',
  '--c-surface': '#161619',
  '--c-surface-elevated': '#1D1D21',
  '--c-input-bg': '#141416',
  '--c-border': '#2A2A2F',
  '--c-text': '#F5F5F7',
  '--c-text-2': '#B6B6BD',
  '--c-text-3': '#77777F',
  '--c-hover': '#232329',
  '--c-active': '#2B2B32',
  '--c-danger': '#FF5C5C',
  '--c-success': '#4CD97B',
  '--c-warning': '#FFC857',
  '--c-glass-border': '#2A2A2F',
  '--lm-liquid-highlight': 'none',
};

const LIGHT_REFERENCE_TOKENS = {
  '--c-bg': '#eef3f6',
  '--c-surface': '#ffffff',
  '--c-surface-2': '#f4f8fa',
  '--c-text': '#13283d',
  '--c-text-2': '#52677b',
  '--c-text-3': '#718397',
  '--c-turquoise': '#0f9e9a',
  '--c-orange': '#e87824',
};

const LEGACY_DARK_HEX_VALUES = [
  '#071827', '#10263a', '#162f45', '#061724', '#0c2639', '#12354b', '#082033',
];

function ruleBlocks(source, selector) {
  const blocks = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(selector, cursor);
    if (start === -1) break;
    const open = source.indexOf('{', start + selector.length);
    if (open === -1) break;

    let depth = 1;
    let end = open + 1;
    while (end < source.length && depth > 0) {
      if (source[end] === '{') depth += 1;
      if (source[end] === '}') depth -= 1;
      end += 1;
    }
    blocks.push(source.slice(open + 1, end - 1));
    cursor = end;
  }
  return blocks;
}

function declarations(blocks) {
  const result = new Map();
  for (const block of blocks) {
    for (const [, , name, value] of block.matchAll(/(^|[;\n])\s*(--[\w-]+)\s*:\s*([^;}]*)/gm)) {
      result.set(name, value.trim().toLowerCase());
    }
  }
  return result;
}

function expectTokens(tokens, expected, themeName) {
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(tokens.get(name), value.toLowerCase(), `${themeName} ${name} must be ${value}`);
  }
}

async function run() {
  const [css, themeContext] = await Promise.all([
    fs.readFile(cssPath, 'utf8'),
    fs.readFile(themeContextPath, 'utf8'),
  ]);

  const rootBlocks = ruleBlocks(css, ':root');
  assert.ok(rootBlocks.length > 0, 'the light :root token block must exist');
  expectTokens(declarations([rootBlocks[0]]), LIGHT_REFERENCE_TOKENS, 'light theme');

  const darkBlocks = ruleBlocks(css, '[data-theme="dark"]');
  const darkTokenBlocks = css.match(/^\[data-theme="dark"\]\s*\{/gm) || [];
  assert.equal(darkTokenBlocks.length, 1, 'premium dark tokens must have one central definition');
  assert.ok(darkBlocks.length > 0, 'the dark theme token block must exist');
  expectTokens(declarations(darkBlocks), PREMIUM_DARK_TOKENS, 'dark theme');

  const darkSource = darkBlocks.join('\n').toLowerCase();
  assert.doesNotMatch(darkSource, /#(?:000|000000)\b/i, 'dark theme blocks must not use pure black');
  for (const legacyValue of LEGACY_DARK_HEX_VALUES) {
    assert.ok(!darkSource.includes(legacyValue), `dark theme blocks must not retain legacy ${legacyValue}`);
  }

  assert.match(themeContext, /useState\(\(\)\s*=>\s*localStorage\.getItem\('lm_theme'\)\s*===\s*'dark'\)/, 'theme state must restore localStorage');
  assert.match(themeContext, /document\.documentElement\.setAttribute\('data-theme',\s*isDark\s*\?\s*'dark'\s*:\s*'light'\)/, 'theme state must update data-theme');
  assert.match(themeContext, /localStorage\.setItem\('lm_theme',\s*isDark\s*\?\s*'dark'\s*:\s*'light'\)/, 'theme state must persist the selected theme');
  assert.match(themeContext, /toggle:\s*\(\)\s*=>\s*setIsDark\(\(d\)\s*=>\s*!d\)/, 'theme toggle must update state without navigation');
  assert.doesNotMatch(themeContext, /(?:window\.)?location\.reload\s*\(/, 'theme toggle must not reload the page');
  assert.match(themeContext, /isDark\s*\?\s*'#0B0B0D'\s*:\s*'#EEF3F6'/, 'dark browser chrome must use Premium Black without changing light mode');

  for (const selector of [
    '.lm-tabbar',
    '.lm-sidebar',
    '.lm-modal-surface',
    '.lm-editorial-card',
    '.lm-annual-entry-card',
    '.lm-classroom-timer',
  ]) {
    assert.match(css, new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{}]*\\{[^}]*var\\(--c-(?:surface|surface-elevated|glass-bg|bg)`), `${selector} must consume central surface tokens`);
  }

  console.log(JSON.stringify({
    status: 'PASS',
    checks: [
      'light reference tokens',
      'premium black dark tokens',
      'legacy black token guard',
      'theme toggle persistence without reload',
      'key dark-mode surfaces consume tokens',
    ],
  }));
}

run().catch((error) => {
  console.error(`Dark-theme audit failed: ${error.message}`);
  process.exitCode = 1;
});
