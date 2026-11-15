const Solar = (() => {
  const radlab = 'https://visualization.osdr.nasa.gov/radlab/api/';
  const lndUrl = radlab + '?instrument=LND&timestamp%3E=2019-01-04&timestamp%3C2019-01-14&absorbed_dose_rate&format=json';
  const craterUrl = radlab + '?instrument=CRaTER&timestamp%3E=2020-05-09&timestamp%3C2020-05-11&absorbed_dose_rate&format=json';
  const sepUrl = (start, end) => `https://api.nasa.gov/DONKI/SEP?startDate=${start}&endDate=${end}&api_key=DEMO_KEY`;
  const archiveUrl = sepUrl('2024-05-09', '2024-05-20');
  const settings = { duration: 40, exitMinutes: [4, 14], shelter: .25, variation: .25 };
  const day = 86400000;

  function events(payload) {
    if (!Array.isArray(payload)) return [];
    return payload.filter(row => typeof row?.sepID === 'string' &&
      Number.isFinite(Date.parse(row.eventTime)) &&
      row.instruments?.some(instrument => !/^MODEL\b/i.test(instrument.displayName || '') && instrument.displayName));
  }

  function measurements(payload, family) {
    if (!Array.isArray(payload?.columns) || !Array.isArray(payload?.data)) return [];
    return payload.data.map(row => Object.fromEntries(payload.columns.map((key, index) => [key, row[index]])))
      .filter(row => row.instrument_id?.toUpperCase().startsWith(family) &&
        Number.isFinite(Date.parse(row.timestamp)) &&
        Number.isFinite(row.absorbed_dose_rate) && row.absorbed_dose_rate > 0);
  }

  async function request(url, select, fetcher) {
    const checkedAt = new Date().toISOString();
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(2800) });
      if (!response.ok) return { url, checkedAt, http: response.status, state: 'http', records: [] };
      const records = select(await response.json());
      return { url, checkedAt, http: response.status, state: records.length ? 'ok' : 'empty', records };
    } catch {
      return { url, checkedAt, state: 'unavailable', records: [] };
    }
  }

  async function load({ fetcher = fetch, now = Date.now(), rng = Math.random } = {}) {
    const date = delta => new Date(now + delta * day).toISOString().slice(0, 10);
    const recentUrl = sepUrl(date(-30), date(0));
    const [recent, lnd, crater, cache] = await Promise.all([
      request(recentUrl, events, fetcher),
      request(lndUrl, data => measurements(data, 'LND'), fetcher),
      request(craterUrl, data => measurements(data, 'CRATER'), fetcher),
      fetcher('data/nasa/solar-reference.json')
        .then(response => response.ok ? response.json() : null).catch(() => null)
    ]);
    const archive = recent.records.length ? null : await request(archiveUrl, events, fetcher);
    const donki = recent.records.length ? recent : archive;
    const radiation = lnd.records.length ? lnd : crater;
    const pick = records => records.length ? records[Math.min(records.length - 1, Math.floor(rng() * records.length))] : null;
    const event = pick(donki.records.length ? donki.records : events(cache?.sep));
    const measurement = pick(radiation.records.length ? radiation.records : measurements(cache?.crater, 'CRATER'));
    const severity = rng() + (event ? .16 : 0);
    return {
      event, measurement, level: severity >= .84 ? 'high' : severity >= .39 ? 'moderate' : 'low',
      eventSource: donki.records.length ? (donki === recent ? 'recent' : 'historical') : event ? 'cache' : 'none',
      measurementSource: radiation.records.length ? 'historical' : measurement ? 'cache' : 'none',
      cacheDate: cache?.captured,
      queries: [recent, archive, lnd, crater].filter(Boolean).map(({ records, ...audit }) => ({ ...audit, count: records.length }))
    };
  }

  function plan(context, option, variation = 1) {
    if (option !== 0 && option !== 1 || option === 1 && context.level === 'high') return null;
    const outside = settings.exitMinutes[option];
    const shelterMinutes = settings.duration - outside;
    const equivalentHours = (outside + shelterMinutes * settings.shelter) / 60;
    const rate = context.measurement?.absorbed_dose_rate;
    const dose = rate ? rate * equivalentHours * variation : null;
    const riskFactor = { low: .7, moderate: 1, high: 1.5 }[context.level];
    return {
      outside, shelterMinutes, variation, dose,
      delta: [-Math.round(4 + outside * .42), -Math.round(4 + outside * .46),
        Math.round((2 + outside * .52) * riskFactor * variation)]
    };
  }

  function resolve(context, option, rng = Math.random) {
    return plan(context, option, 1 + (2 * rng() - 1) * settings.variation);
  }

  return { load, plan, resolve, settings, measurements };
})();
if (typeof module !== 'undefined') module.exports = Solar;
