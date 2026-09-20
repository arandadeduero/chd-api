import test from 'ava';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sinon from 'sinon';
import axios from 'axios';
import request from 'supertest';
import {
    parseStationsHTML,
    parseStationDetailHTML,
    parseStationAforoTypeHTML,
    getAllStationsAforo,
    getStationDetail,
    getStationAforoType,
    resetStationDetailCache,
    NotFoundError,
    UpstreamTimeoutError
} from '../helpers.js';
import { app } from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// getStationDetail() caches per station id; without this, tests that reuse
// the same station id (e.g. EA099) with different stubbed responses would
// see stale data left over from an earlier test.
test.beforeEach(() => {
    resetStationDetailCache();
});

const fixtureHTML = readFileSync(
    join(__dirname, 'fixtures', 'estaciones.html'),
    'utf-8'
);

const stationDetailHTML = readFileSync(
    join(__dirname, 'fixtures', 'risr-estacion-aranda.html'),
    'utf-8'
);

const stationAforoNivelHTML = readFileSync(
    join(__dirname, 'fixtures', 'risr-estacion-aranda-nivel.html'),
    'utf-8'
);

const stationAforoCaudalHTML = readFileSync(
    join(__dirname, 'fixtures', 'risr-estacion-aranda-caudal.html'),
    'utf-8'
);

const stationMultiTypeHTML = readFileSync(
    join(__dirname, 'fixtures', 'risr-estacion-multi.html'),
    'utf-8'
);

const stationTemperaturaHTML = readFileSync(
    join(__dirname, 'fixtures', 'risr-estacion-aranda-temperatura.html'),
    'utf-8'
);

const stationPluviometriaHTML = readFileSync(
    join(__dirname, 'fixtures', 'risr-estacion-aranda-pluviometria.html'),
    'utf-8'
);

test('parseStationsHTML returns only Aforo type stations', (t) => {
    const result = parseStationsHTML(fixtureHTML);

    // Should return multiple Aforo stations
    t.true(result.length > 0);

    // All results should have Tipo === 'Aforo'
    result.forEach((station) => {
        t.is(station.Tipo, 'Aforo');
    });

    // Check that first station has expected properties
    t.true('Descripción' in result[0]);
    t.true('Río' in result[0]);
    t.true('stationId' in result[0]);
});

test('parseStationsHTML extracts stationId from href', (t) => {
    const result = parseStationsHTML(fixtureHTML);

    // Check that stationId is extracted correctly
    result.forEach((station) => {
        t.true(station.stationId !== undefined && station.stationId !== '');
        // stationId should be something like 'EA153', 'EA046', etc.
        t.regex(station.stationId, /^[A-Z]{2}\d{3}$/);
    });
});

test('parseStationsHTML has correct column headers', (t) => {
    const result = parseStationsHTML(fixtureHTML);

    // Check that all expected columns are present
    const expectedHeaders = ['Tipo', 'Descripción', 'Río', 'Subcuenca', 'Localización', 'Provincia'];
    const station = result[0];

    expectedHeaders.forEach((header) => {
        t.true(header in station);
    });
});

test('parseStationsHTML returns empty array for invalid HTML', (t) => {
    const invalidHTML = '<html><body></body></html>';
    const result = parseStationsHTML(invalidHTML);

    t.deepEqual(result, []);
});

test('parseStationDetailHTML extracts historic URLs', (t) => {
    const result = parseStationDetailHTML(stationDetailHTML);

    // Should return an array with 2 items (nivel and caudal)
    t.is(result.length, 2);

    // Check that each item has type and url properties
    result.forEach((item) => {
        t.true('type' in item);
        t.true('url' in item);
        t.regex(item.url, /^https:\/\/www\.saihduero\.es\/risr\/[A-Z0-9]+\/historico\/[A-Za-z0-9]+$/);
    });
});

test('parseStationDetailHTML returns correct data', (t) => {
    const result = parseStationDetailHTML(stationDetailHTML);

    // Check specific entries from the fixture
    const nivelEntry = result.find((item) => item.type === 'nivel');
    const caudalEntry = result.find((item) => item.type === 'caudal');

    t.truthy(nivelEntry);
    t.truthy(caudalEntry);

    t.is(nivelEntry.url, 'https://www.saihduero.es/risr/EA013/historico/xATSOFURfNTMwEUR');
    t.is(caudalEntry.url, 'https://www.saihduero.es/risr/EA013/historico/xATVRFURfNTMwEUR');
});

test('parseStationDetailHTML returns empty array for HTML without historic links', (t) => {
    const invalidHTML = '<html><body><table><tr><td>Nivel</td></tr></table></body></html>';
    const result = parseStationDetailHTML(invalidHTML);

    t.deepEqual(result, []);
});

test('parseStationAforoTypeHTML extracts chartData', (t) => {
    const result = parseStationAforoTypeHTML(stationAforoNivelHTML);

    // Should return an array
    t.true(Array.isArray(result));
    t.true(result.length > 0);

    // Check structure of data points
    const firstPoint = result[0];
    t.true('d' in firstPoint);
    t.true('v' in firstPoint);
    t.true('@timestamp' in firstPoint);
});

test('parseStationAforoTypeHTML returns correct data format', (t) => {
    const result = parseStationAforoTypeHTML(stationAforoNivelHTML);

    // Check first data point
    t.is(result[0].d, '20/11/2025 00:00');
    t.is(result[0].v, 1.18);
    // November 20, 2025 00:00 in Madrid (CET = UTC+1) is November 19, 2025 23:00 UTC
    t.is(result[0]['@timestamp'], '2025-11-19T23:00:00.000Z');

    // Check that all entries have date, value, and timestamp
    result.forEach((entry) => {
        t.is(typeof entry.d, 'string');
        t.is(typeof entry.v, 'number');
        t.is(typeof entry['@timestamp'], 'string');
        t.regex(entry['@timestamp'], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
});

test('parseStationAforoTypeHTML returns empty array for HTML without chartData', (t) => {
    const invalidHTML = '<html><body><script>var someOtherVar = [];</script></body></html>';
    const result = parseStationAforoTypeHTML(invalidHTML);

    t.deepEqual(result, []);
});

test('parseStationAforoTypeHTML extracts chartData from caudal', (t) => {
    const result = parseStationAforoTypeHTML(stationAforoCaudalHTML);

    // Should return an array
    t.true(Array.isArray(result));
    t.true(result.length > 0);

    // Check structure of data points
    const firstPoint = result[0];
    t.true('d' in firstPoint);
    t.true('v' in firstPoint);
    t.true('@timestamp' in firstPoint);
});

test('parseStationAforoTypeHTML returns correct data format for caudal', (t) => {
    const result = parseStationAforoTypeHTML(stationAforoCaudalHTML);

    // Check first data point
    t.is(result[0].d, '21/11/2025 00:00');
    t.is(result[0].v, 10.51);
    // November 21, 2025 00:00 in Madrid (CET = UTC+1) is November 20, 2025 23:00 UTC
    t.is(result[0]['@timestamp'], '2025-11-20T23:00:00.000Z');

    // Check that all entries have date, value, and timestamp
    result.forEach((entry) => {
        t.is(typeof entry.d, 'string');
        t.is(typeof entry.v, 'number');
        t.is(typeof entry['@timestamp'], 'string');
        t.regex(entry['@timestamp'], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
});

// Tests for async functions with mocked axios - Error cases (these properly test error handling)
test.serial('getAllStationsAforo propagates network errors', async (t) => {
    const stub = sinon.stub(axios, 'get').rejects(new Error('Network error'));

    try {
        await t.throwsAsync(() => getAllStationsAforo(), { message: 'Network error' });
    } finally {
        stub.restore();
    }
});

test.serial('getStationDetail propagates network errors', async (t) => {
    const stub = sinon.stub(axios, 'get').rejects(new Error('Station not found'));

    try {
        await t.throwsAsync(() => getStationDetail('invalid'), { message: 'Station not found' });
    } finally {
        stub.restore();
    }
});

test.serial('getStationAforoType propagates network errors', async (t) => {
    const stub = sinon.stub(axios, 'get').rejects(new Error('Data not available'));

    try {
        await t.throwsAsync(() => getStationAforoType('aranda', 'nivel'), { message: 'Data not available' });
    } finally {
        stub.restore();
    }
});

// ── Timeout → 500 ───────────────────────────────────────────────────────────

test.serial('getAllStationsAforo throws UpstreamTimeoutError when SAIH does not answer in time', async (t) => {
    const timeoutError = new Error('timeout of 6000ms exceeded');
    timeoutError.code = 'ECONNABORTED';
    const stub = sinon.stub(axios, 'get').rejects(timeoutError);

    try {
        const err = await t.throwsAsync(() => getAllStationsAforo());
        t.true(err instanceof UpstreamTimeoutError);
        t.is(err.statusCode, 500);
    } finally {
        stub.restore();
    }
});

test.serial('GET /station/aforo/all returns 500 when SAIH times out', async (t) => {
    const timeoutError = new Error('timeout of 6000ms exceeded');
    timeoutError.code = 'ECONNABORTED';
    const stub = sinon.stub(axios, 'get').rejects(timeoutError);

    try {
        const res = await request(app).get('/station/aforo/all');
        t.is(res.status, 500);
    } finally {
        stub.restore();
    }
});

test.serial('getAllStationsAforo throws UpstreamTimeoutError when the response stream is aborted mid-download', async (t) => {
    // axios reports a timeout that fires after response headers were already
    // received (SAIH slow to finish the body) as a stream abort rather than
    // ECONNABORTED — see helpers.js isTimeoutError().
    const streamAbortedError = new Error('stream has been aborted');
    streamAbortedError.code = 'ERR_BAD_RESPONSE';
    const stub = sinon.stub(axios, 'get').rejects(streamAbortedError);

    try {
        const err = await t.throwsAsync(() => getAllStationsAforo());
        t.true(err instanceof UpstreamTimeoutError);
        t.is(err.statusCode, 500);
    } finally {
        stub.restore();
    }
});

test.serial('GET /graph/:id returns 500 (not an unhandled 500) when the response stream is aborted mid-download', async (t) => {
    const streamAbortedError = new Error('stream has been aborted');
    streamAbortedError.code = 'ERR_BAD_RESPONSE';
    const stub = sinon.stub(axios, 'get').rejects(streamAbortedError);

    try {
        const res = await request(app).get('/graph/EA153');
        t.is(res.status, 500);
        t.is(res.body.error, 'SAIH did not respond in time');
    } finally {
        stub.restore();
    }
});

// ── Not found → 404 ──────────────────────────────────────────────────────────

test.serial('getStationDetail throws NotFoundError when station has no historic links', async (t) => {
    const stub = sinon.stub(axios, 'get').resolves({ data: '<html><body></body></html>' });

    try {
        const err = await t.throwsAsync(() => getStationDetail('EA000'));
        t.true(err instanceof NotFoundError);
        t.is(err.statusCode, 404);
    } finally {
        stub.restore();
    }
});

test.serial('getStationAforoType throws NotFoundError when the type does not exist for the station', async (t) => {
    const stub = sinon.stub(axios, 'get').resolves({ data: stationDetailHTML });

    try {
        const err = await t.throwsAsync(() => getStationAforoType('EA013', 'pluviometria'));
        t.true(err instanceof NotFoundError);
        t.is(err.statusCode, 404);
    } finally {
        stub.restore();
    }
});

test.serial('GET /station/aforo/:id returns 404 for a station without data', async (t) => {
    const stub = sinon.stub(axios, 'get').resolves({ data: '<html><body></body></html>' });

    try {
        const res = await request(app).get('/station/aforo/EA000');
        t.is(res.status, 404);
        t.truthy(res.body.error);
    } finally {
        stub.restore();
    }
});

test.serial('GET /station/aforo/:id/:type returns 404 when type not found for station', async (t) => {
    const stub = sinon.stub(axios, 'get').resolves({ data: stationDetailHTML });

    try {
        const res = await request(app).get('/station/aforo/EA013/pluviometria');
        t.is(res.status, 404);
        t.truthy(res.body.error);
    } finally {
        stub.restore();
    }
});

// ── Station detail caching ──────────────────────────────────────────────────

test.serial('getStationDetail only fetches the station page once for repeated calls', async (t) => {
    const stub = sinon.stub(axios, 'get').resolves({ data: stationDetailHTML });

    try {
        const first = await getStationDetail('EA013');
        const second = await getStationDetail('EA013');
        t.deepEqual(first, second);
        t.is(stub.callCount, 1);
    } finally {
        stub.restore();
    }
});

test.serial('getStationAforoType reuses the cached station detail across types', async (t) => {
    const stub = sinon.stub(axios, 'get');
    stub.onCall(0).resolves({ data: stationMultiTypeHTML });   // getStationDetail('EA099')
    stub.onCall(1).resolves({ data: stationTemperaturaHTML }); // temperatura historico
    stub.onCall(2).resolves({ data: stationPluviometriaHTML }); // pluviometria historico — no repeat detail fetch

    try {
        // getStationAforoType() expects the exact scraped type string (as
        // resolved by index.js's TYPE_SLUG_MAP), not the URL slug.
        await getStationAforoType('EA099', 'temperatura ambiente');
        await getStationAforoType('EA099', 'pluviometría');
        t.is(stub.callCount, 3);
    } finally {
        stub.restore();
    }
});

test('parseStationsHTML returns empty array when no Aforo stations found', (t) => {
    const htmlWithoutAforo = `
        <html>
        <body>
            <table class="stations">
                <tbody>
                    <tr>
                        <td>1</td>
                        <td><a href="/station/other-123.html">Other Station</a></td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
    `;
    const result = parseStationsHTML(htmlWithoutAforo);

    t.deepEqual(result, []);
});

test('parseStationDetailHTML returns empty array when no historic links found', (t) => {
    const htmlWithoutHistoric = `
        <html>
        <body>
            <table>
                <tbody>
                    <tr>
                        <td>Info</td>
                        <td><a href="/other-link.html">Other Link</a></td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
    `;
    const result = parseStationDetailHTML(htmlWithoutHistoric);

    t.deepEqual(result, []);
});

// ── New types: temperatura ambiente and pluviometría ──────────────────────────

test('parseStationDetailHTML extracts temperatura ambiente and pluviometría types', (t) => {
    const result = parseStationDetailHTML(stationMultiTypeHTML);

    t.is(result.length, 4);

    const tempEntry = result.find(item => item.type === 'temperatura ambiente');
    const pluvEntry = result.find(item => item.type === 'pluviometría');

    t.truthy(tempEntry);
    t.truthy(pluvEntry);

    t.is(tempEntry.url, 'https://www.saihduero.es/risr/EA099/historico/AAAAtemperaturaToken3');
    t.is(pluvEntry.url,  'https://www.saihduero.es/risr/EA099/historico/AAAApluviometriaToken4');
});

test('parseStationAforoTypeHTML extracts chartData for temperatura', (t) => {
    const result = parseStationAforoTypeHTML(stationTemperaturaHTML);

    t.true(Array.isArray(result));
    t.true(result.length > 0);

    const first = result[0];
    t.is(first.d, '20/11/2025 00:00');
    t.is(first.v, 8.5);
    t.regex(first['@timestamp'], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('parseStationAforoTypeHTML extracts chartData for pluviometria', (t) => {
    const result = parseStationAforoTypeHTML(stationPluviometriaHTML);

    t.true(Array.isArray(result));
    t.true(result.length > 0);

    const first = result[0];
    t.is(first.d, '20/11/2025 00:00');
    t.is(first.v, 0.0);
    t.regex(first['@timestamp'], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

// ── HTTP route integration tests ──────────────────────────────────────────────

test('GET /health returns ok', async (t) => {
    const res = await request(app).get('/health');
    t.is(res.status, 200);
    t.is(res.body.status, 'ok');
});

test('GET / renders the home page with links to the API docs and dashboards', async (t) => {
    const res = await request(app).get('/');
    t.is(res.status, 200);
    t.regex(res.text, /\/api-docs/);
    t.regex(res.text, /\/graph/);
});

test('GET /openapi.json returns the OpenAPI spec', async (t) => {
    const res = await request(app).get('/openapi.json');
    t.is(res.status, 200);
    t.is(res.body.openapi, '3.0.3');
    t.truthy(res.body.paths['/health']);
});

test('GET /api-docs serves the Swagger UI', async (t) => {
    const res = await request(app).get('/api-docs/');
    t.is(res.status, 200);
    t.regex(res.text, /swagger-ui/);
});

test('GET /station/aforo/:id/:type rejects invalid type', async (t) => {
    const res = await request(app).get('/station/aforo/EA013/unknown');
    t.is(res.status, 400);
    t.truthy(res.body.error);
});

test('GET /station/aforo/:id/:type rejects invalid station id', async (t) => {
    // Express normalises path traversal before routing, so the request never
    // matches the route and returns 404 rather than reaching our validation.
    const res = await request(app).get('/station/aforo/../../etc/passwd/nivel');
    t.true(res.status === 400 || res.status === 404);
});

test.serial('GET /station/aforo/:id/:type returns data for temperatura slug', async (t) => {
    // Stub: getStationDetail returns a temperatura ambiente entry, then fetch returns fixture HTML
    const stub = sinon.stub(axios, 'get');
    stub.onFirstCall().resolves({ data: stationMultiTypeHTML });   // getStationDetail call
    stub.onSecondCall().resolves({ data: stationTemperaturaHTML }); // historico fetch

    try {
        const res = await request(app).get('/station/aforo/EA099/temperatura');
        t.is(res.status, 200);
        t.true(Array.isArray(res.body));
        t.true(res.body.length > 0);
        t.is(res.body[0].v, 8.5);
    } finally {
        stub.restore();
    }
});

test.serial('GET /station/aforo/:id/:type returns data for pluviometria slug', async (t) => {
    const stub = sinon.stub(axios, 'get');
    stub.onFirstCall().resolves({ data: stationMultiTypeHTML });
    stub.onSecondCall().resolves({ data: stationPluviometriaHTML });

    try {
        const res = await request(app).get('/station/aforo/EA099/pluviometria');
        t.is(res.status, 200);
        t.true(Array.isArray(res.body));
        t.true(res.body.length > 0);
        t.is(res.body[0].v, 0.0);
    } finally {
        stub.restore();
    }
});

test('GET /graph/:id/:type rejects unknown type', async (t) => {
    const res = await request(app).get('/graph/EA013/humidity');
    t.is(res.status, 400);
    t.truthy(res.body.error);
});

test.serial('GET /graph/:id/:type renders graph for temperatura', async (t) => {
    const stub = sinon.stub(axios, 'get');
    stub.onFirstCall().resolves({ data: stationMultiTypeHTML });
    stub.onSecondCall().resolves({ data: stationTemperaturaHTML });

    try {
        const res = await request(app).get('/graph/EA099/temperatura');
        t.is(res.status, 200);
        t.true(res.text.includes('EA099'));
        t.true(res.text.includes('temperatura'));
    } finally {
        stub.restore();
    }
});

test.serial('GET /graph/:id/:type renders graph for pluviometria', async (t) => {
    const stub = sinon.stub(axios, 'get');
    stub.onFirstCall().resolves({ data: stationMultiTypeHTML });
    stub.onSecondCall().resolves({ data: stationPluviometriaHTML });

    try {
        const res = await request(app).get('/graph/EA099/pluviometria');
        t.is(res.status, 200);
        t.true(res.text.includes('EA099'));
        t.true(res.text.includes('pluviometr'));
    } finally {
        stub.restore();
    }
});
