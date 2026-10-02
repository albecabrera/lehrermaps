import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShortLinkUrl } from '../shortLinks.js';

test('accepts and canonicalizes absolute HTTP(S) URLs', () => {
  assert.equal(normalizeShortLinkUrl(' https://example.org/lesson?q=1#page '), 'https://example.org/lesson?q=1#page');
  assert.equal(normalizeShortLinkUrl('http://example.org/ä'), 'http://example.org/%C3%A4');
});

test('rejects missing schemes, malformed URLs, whitespace, and non-HTTP(S) protocols', () => {
  for (const value of [null, '', 'example.org', 'https://', 'https://bad host', '//example.org', 'javascript:alert(1)', 'ftp://example.org']) {
    assert.equal(normalizeShortLinkUrl(value), null, String(value));
  }
});
