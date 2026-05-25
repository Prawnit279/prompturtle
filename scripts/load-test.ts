/**
 * Load test targeting the Growth tier performance requirement:
 * 500 req/min sustained for the carrier rate comparison endpoint.
 *
 * Run against production (or staging) only — NEVER against local dev.
 *
 * Prerequisites:
 *   - Production must be deployed and healthy
 *   - Use a Growth tier test tenant's API key (realistic rate limits)
 *   - /api/mcp/carrier/rates endpoint must be implemented (see BLOCKER in PR 6.3/6.5)
 *
 * Usage:
 *   LOAD_TEST_URL=https://api.progue.ai LOAD_TEST_API_KEY=ptk_xxx npm run load-test
 */

// justification: autocannon doesn't ship bundled type declarations; any is required here
// eslint-disable-next-line @typescript-eslint/no-require-imports
const autocannon = require('autocannon') as typeof import('autocannon').default;

const BASE_URL = process.env.LOAD_TEST_URL;
const API_KEY  = process.env.LOAD_TEST_API_KEY;

if (!BASE_URL || !API_KEY) {
  process.stderr.write('Error: LOAD_TEST_URL and LOAD_TEST_API_KEY must be set\n');
  process.exit(1);
}

if (BASE_URL.includes('localhost')) {
  process.stderr.write('⚠️  Run load tests against production or staging only — not localhost\n');
  process.exit(1);
}

process.stdout.write(`\nLoad test target: ${BASE_URL}\n`);
process.stdout.write('Duration: 60s | Connections: 10 | Target: ~500 req/min\n\n');

const instance = autocannon({
  url:     `${BASE_URL}/api/mcp/carrier/rates`,
  method:  'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    origin:      { zip: '60601', city: 'Chicago', state: 'IL' },
    destination: { zip: '75201', city: 'Dallas', state: 'TX' },
    weight:      500,
    freightClass: 85,
  }),
  connections: 10,
  duration:    60,
  pipelining:  1,
});

autocannon.track(instance, { renderProgressBar: true });

instance.on('done', (results: import('autocannon').Result) => {
  const SEP = '═══════════════════════════════════════';
  process.stdout.write(`\n${SEP}\n`);
  process.stdout.write('LOAD TEST RESULTS\n');
  process.stdout.write(`${SEP}\n`);
  process.stdout.write(`Requests/sec (avg):  ${results.requests.average}\n`);
  process.stdout.write(`Requests total:      ${results.requests.total}\n`);
  process.stdout.write(`Latency p50:         ${results.latency.p50}ms   (target: < 200ms)\n`);
  process.stdout.write(`Latency p95:         ${results.latency.p95}ms   (target: < 500ms)\n`);
  process.stdout.write(`Latency p99:         ${results.latency.p99}ms   (target: < 1,000ms)\n`);
  process.stdout.write(`Errors:              ${results.errors}\n`);
  process.stdout.write(`Timeouts:            ${results.timeouts}\n`);
  process.stdout.write(`${SEP}\n`);

  const reqPerMin      = results.requests.average * 60;
  const p50Pass        = results.latency.p50  < 200;
  const p95Pass        = results.latency.p95  < 500;
  const p99Pass        = results.latency.p99  < 1000;
  const throughputPass = reqPerMin            >= 500;

  process.stdout.write('\nTARGET VALIDATION\n');
  process.stdout.write(`p50 < 200ms:         ${p50Pass        ? '✅' : '❌'} (${results.latency.p50}ms)\n`);
  process.stdout.write(`p95 < 500ms:         ${p95Pass        ? '✅' : '❌'} (${results.latency.p95}ms)\n`);
  process.stdout.write(`p99 < 1,000ms:       ${p99Pass        ? '✅' : '❌'} (${results.latency.p99}ms)\n`);
  process.stdout.write(`500 req/min:         ${throughputPass ? '✅' : '❌'} (${Math.round(reqPerMin)} req/min)\n`);

  const allPass = p50Pass && p95Pass && p99Pass && throughputPass;
  process.stdout.write(`\nOverall:             ${allPass ? '✅ PASS' : '❌ FAIL'}\n`);

  if (!allPass) {
    process.stderr.write('\n⚠️  Performance targets not met. Do not tag v0.6.0 until all targets pass.\n');
    process.exit(1);
  }
});
