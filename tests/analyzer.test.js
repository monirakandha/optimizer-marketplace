const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeListing, STATUS } = require('../lib/analyzer.js');

test('analyzeListing does not penalize missing/not-extracted data the same as bad values', () => {
  const data = {
    title: 'A sufficiently descriptive product title for testing purposes',
    imageCount: { status: STATUS.NOT_EXTRACTED, value: null },
    description: { status: STATUS.UNAVAILABLE, text: '' },
    bulletPoints: { status: STATUS.NOT_EXTRACTED, value: null },
    reviews: { status: STATUS.NOT_EXTRACTED, value: null },
    price: { status: STATUS.NOT_EXTRACTED, value: null },
    domain: 'www.amazon.com'
  };
  const res = analyzeListing(data, 'Amazon');
  assert.equal(res.scoreLabel, 'INTERNAL_HEURISTIC');
  assert.ok(res.score >= 60, `score should not be harshly penalized for unknowns, got ${res.score}`);
  const imageCheck = res.checks.find(c => c.title.includes('Image'));
  assert.ok(imageCheck && /NOT_EXTRACTED/i.test(imageCheck.message));
});
