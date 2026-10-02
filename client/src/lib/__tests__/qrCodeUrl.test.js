import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQrCodeUrl } from '../qrCodeUrl.js';

test('accepts web links with or without a scheme and keeps their path and query', () => {
  assert.equal(normalizeQrCodeUrl(' example.org/course?a=1#day '), 'https://example.org/course?a=1#day');
  assert.equal(normalizeQrCodeUrl('http://example.org/'), 'http://example.org/');
  assert.equal(normalizeQrCodeUrl('https://example.org/ä'), 'https://example.org/%C3%A4');
});

test('rejects empty, malformed, and non-web addresses', () => {
  for (const value of ['', '   ', 'https://', 'javascript:alert(1)', 'mailto:a@example.org', 'ftp://example.org', '//example.org', 'example .org']) {
    assert.equal(normalizeQrCodeUrl(value), null, value);
  }
});
