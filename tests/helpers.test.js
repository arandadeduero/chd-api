import test from 'ava';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sinon from 'sinon';
import axios from 'axios';
import { 
    parseStationsHTML, 
    parseStationDetailHTML, 
    parseStationAforoTypeHTML, 
    getAllStationsAforo,
    getStationDetail,
    getStationAforoType
} from '../helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Tests for async functions with mocked axios - Error cases (these properly test error handling)
test.serial('getAllStationsAforo returns empty array on network failure', async (t) => {
    const stub = sinon.stub(axios, 'get').rejects(new Error('Network error'));

    try {
        const result = await getAllStationsAforo();
        t.deepEqual(result, []); // Function returns empty array on error
    } finally {
        stub.restore();
    }
});

test.serial('getStationDetail returns empty object on network failure', async (t) => {
    const stub = sinon.stub(axios, 'get').rejects(new Error('Station not found'));

    try {
        const result = await getStationDetail('invalid');
        t.deepEqual(result, {}); // Function returns empty object on error
    } finally {
        stub.restore();
    }
});

test.serial('getStationAforoType returns empty array on network failure', async (t) => {
    const stub = sinon.stub(axios, 'get').rejects(new Error('Data not available'));

    try {
        const result = await getStationAforoType('aranda', 'nivel');
        t.deepEqual(result, []); // Function returns empty array on error
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
