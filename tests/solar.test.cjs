const assert = require('node:assert/strict');
const Solar = require('../solar.js');
const reference = require('../data/nasa/solar-reference.json');

(async () => {
  const queried = [];
  const context = await Solar.load({
    now: Date.parse('2026-11-15T14:00Z'),
    rng: () => .4,
    fetcher: async url => {
      queried.push(url);
      if (url.startsWith('data/')) return { ok: true, json: async () => reference };
      if (url.includes('DONKI') && url.includes('2026-10-16')) return { ok: true, status: 200, json: async () => [] };
      if (url.includes('DONKI')) return { ok: true, status: 200, json: async () => reference.sep };
      throw new Error('Browser cannot access RadLab');
    }
  });
  assert.equal(context.eventSource, 'historical');
  assert.equal(context.measurementSource, 'cache');
  assert.equal(context.measurement.instrument_id, 'CRaTER-D1D2');
  assert.equal(context.level, 'moderate');
  assert(queried.some(url => url.includes('instrument=LND')));
  const immediate = Solar.resolve(context, 0, () => .5);
  const delayed = Solar.resolve(context, 1, () => .5);
  assert(immediate.dose < delayed.dose);
  assert(immediate.delta[0] > delayed.delta[0]);
  assert(immediate.delta[1] > delayed.delta[1]);
  assert(immediate.delta[2] < delayed.delta[2]);
  assert.equal(Solar.resolve({ ...context, level: 'high' }, 1), null);
  assert.equal(Solar.resolve(context, 0, () => 0).dose, immediate.dose * .75);
  assert.equal(Solar.resolve(context, 0, () => 1).dose, immediate.dose * 1.25);
  assert.equal(Solar.resolve({ ...context, measurement: null }, 0).dose, null);
  console.log('PASS solar: authentic fallback, bounded queries, both options, high-alert lock and variable dose.');
})().catch(error => { console.error(error); process.exitCode = 1; });
