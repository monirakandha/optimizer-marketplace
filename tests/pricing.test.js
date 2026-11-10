const test = require('node:test');
const assert = require('node:assert/strict');
const { getPricingStatus } = require('../lib/analyzer.js');

test('pricing fails closed when inputs incomplete', () => {
  const res = getPricingStatus({ cost: 10, feePercent: null, targetMarginPercent: 20 });
  assert.equal(res.ok, false);
  assert.match(res.message, /unavailable|incomplete/i);
});

test('pricing computes only custom scenario with explicit inputs', () => {
  const res = getPricingStatus({ cost: 10, feePercent: 15, targetMarginPercent: 20 });
  assert.equal(res.ok, true);
  assert.equal(res.status, 'CUSTOM_SCENARIO');
  assert.ok(res.suggestedPrice > 10);
});
