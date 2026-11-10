const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const popup = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');
const popupHtml = fs.readFileSync(path.join(__dirname, '..', 'popup.html'), 'utf8');

test('popup.js has no fabricated metric generators', () => {
  assert.doesNotMatch(popup, /Math\.random\(\)\s*\*\s*50000/);
  assert.doesNotMatch(popup, /toLocaleString\(\).*Search Vol/i); // weak guard
  assert.match(popup, /Data unavailable — no verified source/);
  assert.doesNotMatch(popup, /29\.99/); // hardcoded competitor fallback removed
});

test('popup.js avoids innerHTML for untrusted rendering paths', () => {
  assert.doesNotMatch(popup, /li\.innerHTML\s*=\s*`/);
  assert.doesNotMatch(popup, /tr\.innerHTML\s*=\s*`/);
  assert.doesNotMatch(popup, /div\.innerHTML\s*=\s*`[^`]*\$\{compTitle/);
  assert.doesNotMatch(popup, /listContainer\.innerHTML = '<tr><td colspan/);
});

test('keywords labeled as suggestions only, not measured', () => {
  assert.match(popupHtml, /Autocomplete keyword suggestions only/i);
  assert.match(popup, /suggestions only, not measured search volume/i);
});
