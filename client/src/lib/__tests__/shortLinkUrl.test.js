import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShortLinkUrl } from '../shortLinkUrl.js';

test('normalizes HTTP(S) lesson URLs while preserving path, query, and fragment', () => {
  assert.equal(normalizeShortLinkUrl(' example.org/lesson?a=1#start '), 'https://example.org/lesson?a=1#start');
  assert.equal(normalizeShortLinkUrl('http://example.org/lesson'), 'http://example.org/lesson');
  assert.equal(normalizeShortLinkUrl('https://example.org/ä'), 'https://example.org/%C3%A4');
});

test('rejects empty, malformed, whitespace, and non-HTTP(S) destinations', () => {
  for (const value of ['', '   ', 'https://', 'javascript:alert(1)', 'mailto:teacher@example.org', 'ftp://example.org', '//example.org', 'example .org']) {
    assert.equal(normalizeShortLinkUrl(value), null, value);
  }
});
