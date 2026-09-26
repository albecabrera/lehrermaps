#!/usr/bin/env node

const apiBaseUrl = process.env.LEHRERMAPS_API_URL || 'http://localhost:3001';
const unknownToken = `audit-unknown-${Date.now()}`;

async function expectStatus(path, expected) {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (response.status !== expected) {
    const body = await response.text();
    throw new Error(`GET ${path} -> ${response.status}, erwartet ${expected}: ${body}`);
  }
}

try {
  await expectStatus(`/api/display/${unknownToken}`, 404);
  console.log(JSON.stringify({
    status: 'PASS',
    checks: ['öffentliche Projektion ohne JWT'],
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }, null, 2));
  process.exitCode = 1;
}
