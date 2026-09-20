import axios from 'axios';
import { load } from 'cheerio';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const puntosDeControlURL = 'https://www.saihduero.es/resultados-risr?q=&tipo=TT';
const baseURL = 'https://www.saihduero.es/';

// Max time to wait for a response from SAIH before giving up.
const REQUEST_TIMEOUT_MS = 6000;

// Thrown when a station or a measurement type/element doesn't exist upstream.
export class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
        this.statusCode = 404;
    }
}

// Thrown when SAIH doesn't answer within REQUEST_TIMEOUT_MS.
export class UpstreamTimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UpstreamTimeoutError';
        this.statusCode = 500;
    }
}

function isTimeoutError(error) {
    return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
}

async function fetchSaih(url) {
    try {
        return await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
    } catch (error) {
        if (isTimeoutError(error)) {
            throw new UpstreamTimeoutError(`SAIH did not respond within ${REQUEST_TIMEOUT_MS / 1000}s: ${url}`);
        }
        if (error.response?.status === 404) {
            throw new NotFoundError(`Not found upstream: ${url}`);
        }
        throw error;
    }
}

export function parseStationsHTML(html) {
    try {
        // Load with cheerio
        const $ = load(html);

        // Get the table
        const table = $('#table-estaciones-pagination');
        if (!table.length) {
            console.warn('Table not found');
            return [];
        }

        // Extract headers from thead
        const headers = [];
        table.find('thead th').each((index, element) => {
            headers.push($(element).text().trim());
        });

        // Parse table rows
        const rows = [];
        table.find('tbody tr').each((index, element) => {
            const cells = [];
            const cells$ = $(element).find('td');

            cells$.each((cellIndex, cellElement) => {
                cells.push($(cellElement).text().trim());
            });

            // Create object with headers as keys
            const rowObject = {};
            headers.forEach((header, idx) => {
                rowObject[header] = cells[idx];
            });

            // Extract stationId from the href in the second column (index 1)
            const secondColLink = cells$.eq(1).find('a');
            if (secondColLink.length > 0) {
                const href = secondColLink.attr('href');
                if (href) {
                    const stationId = href.split('/').pop();
                    rowObject.stationId = stationId;
                }
            }

            // Filter: only return rows where first column (Tipo) equals "Aforo"
            if (rowObject[headers[0]] === 'Aforo') {
                rows.push(rowObject);
            }
        });

        return rows;
    } catch (error) {
        console.error('Error parsing HTML:', error.message);
        return [];
    }
}

export function parseStationDetailHTML(html) {
    try {
        // Load with cheerio
        const $ = load(html);

        const result = [];

        // Find all <a> tags with href matching pattern "risr/<id>/historico/<randomstring>"
        $('a[href*="/historico/"]').each((index, element) => {
            const href = $(element).attr('href');

            // Check if href matches the expected pattern
            if (href && href.match(/^risr\/[A-Z0-9]+\/historico\/[A-Za-z0-9]+$/)) {
                // Get the parent <tr> element
                const row = $(element).closest('tr');
                if (row.length > 0) {
                    // Get the first <td> in the row to get the variable name
                    const variableName = row.find('td').eq(0).text().trim().toLowerCase();

                    if (variableName) {
                        // Create object with type and url
                        result.push({
                            type: variableName,
                            url: baseURL + href
                        });
                    }
                }
            }
        });

        return result;
    } catch (error) {
        console.error('Error parsing station detail HTML:', error.message);
        return [];
    }
}

export function parseStationAforoTypeHTML(html) {
    try {
        // Load with cheerio
        const $ = load(html);

        // Find all script tags
        const scripts = $('script');

        for (let i = 0; i < scripts.length; i++) {
            const scriptContent = $(scripts[i]).html();

            // Look for chartData variable declaration
            if (scriptContent && scriptContent.includes('var chartData = [')) {
                // Extract the chartData array using regex
                const match = scriptContent.match(/var chartData = (\[[\s\S]*?\]);/);

                if (match && match[1]) {
                    try {
                        // Convert JS object literal syntax to valid JSON (quote unquoted keys)
                        const jsonString = match[1]
                            .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');
                        const chartData = JSON.parse(jsonString);

                        // Add @timestamp field to each data point
                        const enrichedData = chartData.map(item => {
                            // Parse date format "DD/MM/YYYY HH:mm" as Europe/Madrid timezone
                            const madridDate = dayjs.tz(item.d, 'DD/MM/YYYY HH:mm', 'Europe/Madrid');

                            return {
                                ...item,
                                '@timestamp': madridDate.utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
                            };
                        });

                        return enrichedData;
                    } catch (parseError) {
                        console.error('Error parsing chartData:', parseError.message);
                        return [];
                    }
                }
            }
        }

        return [];
    } catch (error) {
        console.error('Error parsing station aforo type HTML:', error.message);
        return [];
    }
}

export async function getAllStationsAforo() {
    // Let NotFoundError/UpstreamTimeoutError (and any other error) propagate to the caller.
    const response = await fetchSaih(puntosDeControlURL);
    return parseStationsHTML(response.data);
}

export async function getStationDetail(stationId) {
    const stationURL = `https://www.saihduero.es/risr/${stationId}`;
    const response = await fetchSaih(stationURL);
    const details = parseStationDetailHTML(response.data);

    if (details.length === 0) {
        throw new NotFoundError(`Station "${stationId}" not found`);
    }

    return details;
}

export async function getStationAforoType(stationId, type) {
    // Throws NotFoundError if the station itself doesn't exist.
    const details = await getStationDetail(stationId);

    // Find the entry matching the requested type
    const typeEntry = details.find(item => item.type === type.toLowerCase());

    if (!typeEntry) {
        throw new NotFoundError(`Type "${type}" not found for station ${stationId}`);
    }

    const response = await fetchSaih(typeEntry.url);
    return parseStationAforoTypeHTML(response.data);
}
